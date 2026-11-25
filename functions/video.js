// functions/video.js — Arvdoul Sparks (Video) processing, playback, engagement, and lifecycle
//
// Canonical Posts Architecture:
//   - `posts/{postId}` (`type: 'video'`, `subType: 'spark' | 'reel' | 'video'`) is
//     the single authoritative social publication document.
//   - `videos/{mediaId}` stores media-processing / Mux telemetry bound to `canonicalPostId`.
//   - `video_migration_map/{legacyId}` maps any legacy `videos/{id}` to its canonical `postId`.
//   - Signed Mux playback URLs fail closed when signing keys are absent.
//   - Likes, saves, shares, views, and gifts write to canonical `posts/{postId}`
//     and `counter_shards` via `incrementShardedCounter` (keeping Home, Sparks,
//     Profiles, Saved, Search, and Analytics 100% unified).

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Mux } = require('@mux/mux-node');
const { VideoIntelligenceServiceClient } = require('@google-cloud/video-intelligence');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const videoIntelligenceClient = new VideoIntelligenceServiceClient();

const { onCall, onRequest } = functions.https;
const { pubsub } = functions;
const logger = functions.logger;

const { readCoinBalance, writeCoinBalance } = require('./coinBalance');
const { checkRateLimit } = require('./rateLimit');
const { assertAdmin, checkIsAdmin, getUserIdFromContext } = require('./auth');
const { awardXpSafe } = require('./xpAward');
const { writeAudit } = require('./admin');
const { enqueuePush } = require('./pushQueue');
const { writeNotification } = require('./notificationWriter');
const { incrementShardedCounter } = require('./analytics');
const {
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  SPARK_PROCESSING_STATES,
  canTransitionProcessingState,
  getDailyUploadLimit,
  normalizeSparkVisibility,
  validateSparkDuration,
  validateSparkFileSize,
  validateSparkMimeOrExtension,
} = require('./videoConfig.cjs');

// ----------------------------------------------------------------------
//  MUX CLIENT
// ----------------------------------------------------------------------
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});
const Video = mux.Video || mux.video;

// ----------------------------------------------------------------------
//  AUTH & CANONICAL TARGET HELPERS
// ----------------------------------------------------------------------
function validateAuth(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  return context.auth.uid;
}

async function assertVideoOwnerOrAdmin(record, uid, context) {
  const ownerId = record?.authorId || record?.userId;
  if (ownerId && ownerId === uid) return uid;
  if (await checkIsAdmin(context)) return uid;
  throw new functions.https.HttpsError('permission-denied', 'Only the video owner can perform this action.');
}

async function resolveSparkTarget(targetId) {
  if (!targetId || typeof targetId !== 'string') return null;

  const postRef = db.collection('posts').doc(targetId);
  const postSnap = await postRef.get();
  if (postSnap.exists) {
    const postData = postSnap.data() || {};
    const mediaId = postData.mediaAssetId || postData.migratedFromVideoId || targetId;
    const mediaRef = db.collection('videos').doc(mediaId);
    const mediaSnap = mediaId === targetId
      ? await mediaRef.get().catch(() => null)
      : await mediaRef.get().catch(() => null);
    return {
      targetId,
      postId: postSnap.id,
      postRef,
      postData,
      mediaId,
      mediaRef,
      videoData: mediaSnap && mediaSnap.exists ? mediaSnap.data() : null,
      ownerId: postData.authorId || postData.userId || mediaSnap?.data()?.userId || null,
    };
  }

  const mapSnap = await db.collection('video_migration_map').doc(targetId).get().catch(() => null);
  if (mapSnap && mapSnap.exists && mapSnap.data()?.canonicalPostId) {
    const canonicalPostId = mapSnap.data().canonicalPostId;
    const [mappedPostSnap, mediaSnap] = await Promise.all([
      db.collection('posts').doc(canonicalPostId).get(),
      db.collection('videos').doc(targetId).get(),
    ]);
    if (mappedPostSnap.exists) {
      const postData = mappedPostSnap.data() || {};
      return {
        targetId,
        postId: canonicalPostId,
        postRef: mappedPostSnap.ref,
        postData,
        mediaId: targetId,
        mediaRef: db.collection('videos').doc(targetId),
        videoData: mediaSnap.exists ? mediaSnap.data() : null,
        ownerId: postData.authorId || postData.userId || mediaSnap.data()?.userId || null,
      };
    }
  }

  const videoRef = db.collection('videos').doc(targetId);
  const videoSnap = await videoRef.get();
  if (!videoSnap.exists) return null;
  const videoData = videoSnap.data() || {};
  const linkedPostId = videoData.canonicalPostId || videoData.postId || null;
  if (linkedPostId) {
    const linkedSnap = await db.collection('posts').doc(linkedPostId).get().catch(() => null);
    if (linkedSnap && linkedSnap.exists) {
      const postData = linkedSnap.data() || {};
      return {
        targetId,
        postId: linkedPostId,
        postRef: linkedSnap.ref,
        postData,
        mediaId: targetId,
        mediaRef: videoRef,
        videoData,
        ownerId: postData.authorId || postData.userId || videoData.userId || null,
      };
    }
  }

  return {
    targetId,
    postId: null,
    postRef: null,
    postData: null,
    mediaId: targetId,
    mediaRef: videoRef,
    videoData,
    ownerId: videoData.userId || videoData.authorId || null,
  };
}

async function isMutuallyBlocked(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [outSnap, inSnap] = await Promise.all([
    db.doc(`blocks/${uidA}_${uidB}`).get(),
    db.doc(`blocks/${uidB}_${uidA}`).get(),
  ]);
  return outSnap.exists || inSnap.exists;
}

async function evaluateSparkAccessForViewer(resolved, uid, options = {}) {
  const isAdmin = await checkIsAdmin(uid);
  return evaluateSparkAccess(resolved, uid, isAdmin, options);
}

async function evaluateSparkAccess(resolved, uid, isAdmin, options = {}) {
  if (!resolved) return { allowed: false, reason: 'not-found' };
  if (isAdmin) return { allowed: true, reason: 'admin' };

  const primary = resolved.postData || resolved.videoData || {};
  const ownerId = resolved.ownerId || primary.authorId || primary.userId;
  if (ownerId && ownerId === uid) return { allowed: true, reason: 'owner' };

  if (primary.isDeleted === true || resolved.videoData?.isDeleted === true) {
    return { allowed: false, reason: 'deleted' };
  }

  const isPublished = resolved.postData
    ? (resolved.postData.status === 'published' || resolved.postData.status === 'live')
    : (resolved.videoData?.status === 'ready' || resolved.videoData?.status === 'live');
  if (!isPublished) {
    return { allowed: false, reason: 'not-ready' };
  }

  if (ownerId && (await isMutuallyBlocked(uid, ownerId))) {
    return { allowed: false, reason: 'blocked' };
  }

  const visibility = normalizeSparkVisibility(primary.visibility || 'public');
  if (visibility === 'private') {
    return { allowed: false, reason: 'private' };
  }

  if (visibility === 'followers') {
    const edge = ownerId ? await db.doc(`follows/${uid}_${ownerId}`).get() : null;
    if (!edge || !edge.exists) return { allowed: false, reason: 'followers-only' };
  } else if (visibility === 'friends') {
    const [outEdge, inEdge] = ownerId
      ? await Promise.all([
        db.doc(`follows/${uid}_${ownerId}`).get(),
        db.doc(`follows/${ownerId}_${uid}`).get(),
      ])
      : [null, null];
    if (!outEdge?.exists || !inEdge?.exists) {
      return { allowed: false, reason: 'friends-only' };
    }
  } else if (visibility === 'community' && primary.communityId) {
    const communitySnap = await db.doc(`communities/${primary.communityId}`).get().catch(() => null);
    const commData = communitySnap?.exists ? communitySnap.data() : {};
    const isMember = Boolean(commData?.members?.[uid]);
    if (!isMember) return { allowed: false, reason: 'community-only' };
  } else if (visibility === 'public' && primary.authorIsPrivate === true && ownerId) {
    const edge = await db.doc(`follows/${uid}_${ownerId}`).get();
    if (!edge.exists) return { allowed: false, reason: 'private-account' };
  }

  if (options.checkPurchase) {
    const monetization = primary.monetization || resolved.videoData?.monetization || {};
    const price = Number(monetization.price) || 0;
    if (monetization.type === 'ppv' && price > 0) {
      const candidateKeys = [
        resolved.postId ? `${uid}_${resolved.postId}` : null,
        resolved.mediaId ? `${uid}_${resolved.mediaId}` : null,
      ].filter(Boolean);
      const uniqueKeys = [...new Set(candidateKeys)];
      const snaps = await Promise.all(
        uniqueKeys.map((k) => db.collection('video_purchases').doc(k).get()),
      );
      if (!snaps.some((s) => s.exists)) {
        return { allowed: false, reason: 'ppv-required', price };
      }
    }
  }

  return { allowed: true, reason: 'ok' };
}

// ----------------------------------------------------------------------
//  DOUBLE-ENTRY COIN TRANSFER (idempotent, maintains system supply)
// ----------------------------------------------------------------------
async function transferCoinsInternal(fromUid, toUid, amount, reason, metadata = {}) {
  const idempotencyKey = metadata.idempotencyKey || `transfer_${fromUid}_${toUid}_${crypto.randomUUID()}`;
  const ledgerRef = db.collection('coin_transactions').doc(idempotencyKey);

  return db.runTransaction(async (t) => {
    const existing = await t.get(ledgerRef);
    if (existing.exists) return existing.data().result;

    const fromRef = db.collection('users').doc(fromUid);
    const toRef = db.collection('users').doc(toUid);
    const supplyRef = db.collection('system').doc('coin_supply');

    const fromDoc = await t.get(fromRef);
    const toDoc = await t.get(toRef);
    await t.get(supplyRef);

    if (!fromDoc.exists) throw new functions.https.HttpsError('not-found', 'Sender not found.');
    if (!toDoc.exists) throw new functions.https.HttpsError('not-found', 'Recipient not found.');

    const fromBal = await readCoinBalance(t, fromUid, { fallbackToPublic: true });
    if (fromBal.coins < amount) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient coins.');
    }

    const toBal = await readCoinBalance(t, toUid, { fallbackToPublic: true });
    const newFromBalance = fromBal.coins - amount;
    const newToBalance = toBal.coins + amount;

    writeCoinBalance(t, fromUid, { coins: newFromBalance, updatedAt: FieldValue.serverTimestamp() });
    writeCoinBalance(t, toUid, { coins: newToBalance, updatedAt: FieldValue.serverTimestamp() });

    const txId = idempotencyKey;
    const debitRef = db.collection('coin_transactions').doc(`${txId}_debit`);
    const creditRef = db.collection('coin_transactions').doc(`${txId}_credit`);

    t.set(debitRef, {
      userId: fromUid,
      type: 'debit',
      amount,
      reason,
      relatedUserId: toUid,
      metadata,
      balanceAfter: newFromBalance,
      createdAt: FieldValue.serverTimestamp(),
      transactionId: txId,
    });
    t.set(creditRef, {
      userId: toUid,
      type: 'credit',
      amount,
      reason,
      relatedUserId: fromUid,
      metadata,
      balanceAfter: newToBalance,
      createdAt: FieldValue.serverTimestamp(),
      transactionId: txId,
    });

    t.set(supplyRef, { totalCoins: FieldValue.increment(0) }, { merge: true });

    const result = { success: true, newFromBalance, newToBalance, transactionId: txId };
    t.set(ledgerRef, { result, processedAt: FieldValue.serverTimestamp(), idempotencyKey }, { merge: true });
    return result;
  });
}

// ======================================================================
//  1. createMuxUpload (canonical post + media reservation + quota + validation)
// ======================================================================
exports.createMuxUpload = onCall({
  memory: '512MB',
  timeoutSeconds: 30,
}, async (data, context) => {
  const uid = validateAuth(context);
  const {
    fileName,
    fileSize,
    mimeType,
    duration = null,
    visibility = 'public',
    isReel = false,
    subType = null,
    title = '',
    description = '',
    tags = [],
    allowDownload = true,
    duetEnabled = true,
    stitchEnabled = true,
    monetization = null,
    communityId = null,
    chapters = [],
    music = null,
    effects = null,
  } = data || {};

  if (!fileName || !fileSize || !mimeType) {
    throw new functions.https.HttpsError('invalid-argument', 'fileName, fileSize, and mimeType are required.');
  }

  const sizeCheck = validateSparkFileSize(fileSize);
  if (!sizeCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', sizeCheck.reason);
  }
  const typeCheck = validateSparkMimeOrExtension(mimeType, fileName);
  if (!typeCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', typeCheck.reason);
  }
  if (duration !== null && duration !== undefined) {
    const durCheck = validateSparkDuration(duration);
    if (!durCheck.valid) {
      throw new functions.https.HttpsError('invalid-argument', durCheck.reason);
    }
  }

  await checkRateLimit(uid, 'createMuxUpload', 15, 60000);

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const dailyLimit = getDailyUploadLimit(userData);
  const today = new Date().toISOString().slice(0, 10);
  const quotaRef = db.collection('daily_upload_counters').doc(`${uid}_${today}`);

  // Enforce atomic per-day upload quota before creating a Mux direct upload.
  await db.runTransaction(async (t) => {
    const quotaSnap = await t.get(quotaRef);
    const currentCount = quotaSnap.exists ? (Number(quotaSnap.data().count) || 0) : 0;
    if (currentCount >= dailyLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Daily Spark upload limit (${dailyLimit}) reached for your tier.`,
      );
    }
    t.set(quotaRef, {
      userId: uid,
      date: today,
      count: currentCount + 1,
      limit: dailyLimit,
      updatedAt: FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    }, { merge: true });
  });

  try {
    const postRef = db.collection('posts').doc();
    const postId = postRef.id;
    const videoRef = db.collection('videos').doc(postId);
    const normalizedVis = normalizeSparkVisibility(visibility);
    const resolvedSubType = subType || (isReel ? 'reel' : 'spark');
    const cleanTags = Array.isArray(tags)
      ? tags.slice(0, 20).map((t) => String(t).trim().replace(/^#/, '').toLowerCase()).filter(Boolean)
      : [];
    const safeTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 140) : 'Untitled Spark';
    const safeDesc = typeof description === 'string' ? description.trim().slice(0, 2200) : '';
    const safeMonetization = monetization && typeof monetization === 'object' && monetization.type === 'ppv'
      ? { type: 'ppv', price: Math.max(1, Math.min(100000, Number(monetization.price) || 1)) }
      : { type: 'none' };

    const upload = await Video.Uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['signed'],
        mp4_support: 'standard',
        passthrough: JSON.stringify({ postId, mediaAssetId: postId }),
      },
    });

    const baseStats = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      totalWatchTime: 0,
      viewerCount: 0,
      gifts: 0,
      giftValue: 0,
    };

    const batch = db.batch();
    batch.set(postRef, {
      authorId: uid,
      userId: uid,
      authorName: userData.displayName || userData.username || '',
      authorPhoto: userData.photoURL || null,
      authorIsPrivate: Boolean(userData.isPrivate),
      type: 'video',
      subType: resolvedSubType,
      title: safeTitle,
      content: safeDesc || safeTitle,
      description: safeDesc,
      tags: cleanTags,
      hashtags: cleanTags,
      visibility: normalizedVis,
      communityId: normalizedVis === 'community' ? (communityId || null) : null,
      status: 'processing',
      processingState: SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
      mediaAssetId: postId,
      canonicalPostId: postId,
      muxUploadId: upload.id || null,
      muxAssetId: null,
      muxPlaybackId: null,
      playbackPolicy: 'signed',
      duration: Number(duration) || 0,
      allowDownload: allowDownload !== false,
      duetEnabled: duetEnabled !== false,
      stitchEnabled: stitchEnabled !== false,
      music: music || null,
      effects: effects || null,
      chapters: Array.isArray(chapters) ? chapters : [],
      monetization: safeMonetization,
      media: [],
      stats: baseStats,
      rankingScore: 0,
      viralScore: 0,
      personalizationScore: 0,
      audioFingerprint: null,
      audioFingerprintStatus: 'pending',
      isDeleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      scoreUpdatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(videoRef, {
      userId: uid,
      authorId: uid,
      canonicalPostId: postId,
      postId,
      title: safeTitle,
      description: safeDesc,
      tags: cleanTags,
      visibility: normalizedVis,
      allowDownload: allowDownload !== false,
      status: 'uploading',
      processingState: SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
      muxUploadId: upload.id || null,
      muxAssetId: null,
      muxPlaybackId: null,
      playbackPolicy: 'signed',
      duration: Number(duration) || 0,
      stats: baseStats,
      type: resolvedSubType === 'reel' ? 'reel' : 'video',
      subType: resolvedSubType,
      music: music || null,
      effects: effects || null,
      chapters: Array.isArray(chapters) ? chapters : [],
      duetEnabled: duetEnabled !== false,
      stitchEnabled: stitchEnabled !== false,
      rankingScore: 0,
      viralScore: 0,
      monetization: safeMonetization,
      isDeleted: false,
      audioFingerprint: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    logger.info('Spark upload reserved', { postId, uploadId: upload.id, uid });
    return {
      uploadUrl: upload.url,
      uploadId: upload.id || null,
      postId,
      assetId: postId,
      mediaAssetId: postId,
      playbackId: null,
      processingState: SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
    };
  } catch (error) {
    logger.error('createMuxUpload', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Upload creation failed');
  }
});

// ======================================================================
//  2. getMuxPlaybackUrl (canonical access + PPV + fail-closed JWT signing)
// ======================================================================
async function canViewVideo(targetId, uid, isAdmin) {
  const resolved = await resolveSparkTarget(targetId);
  const access = await evaluateSparkAccess(resolved, uid, isAdmin, { checkPurchase: true });
  return access.allowed;
}

exports.getMuxPlaybackUrl = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { playbackId: requestedPlaybackId, videoId, postId, watermarked = false } = data || {};
  const targetId = postId || videoId;
  if (!targetId) {
    throw new functions.https.HttpsError('invalid-argument', 'postId or videoId required');
  }

  await checkRateLimit(uid, 'getPlayback', 60, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) {
    throw new functions.https.HttpsError('not-found', 'Spark not found');
  }

  const isAdmin = await checkIsAdmin(uid);
  const access = await evaluateSparkAccess(resolved, uid, isAdmin, { checkPurchase: true });
  if (!access.allowed) {
    if (access.reason === 'ppv-required') {
      throw new functions.https.HttpsError('failed-precondition', 'Purchase required to watch this Spark.');
    }
    throw new functions.https.HttpsError('permission-denied', 'You do not have access to this Spark.');
  }

  const storedPlaybackId =
    resolved.postData?.muxPlaybackId ||
    resolved.videoData?.muxPlaybackId ||
    resolved.videoData?.playbackId ||
    null;

  const playbackId = requestedPlaybackId || storedPlaybackId;
  if (!playbackId) {
    throw new functions.https.HttpsError('failed-precondition', 'Playback is not ready yet.');
  }
  if (storedPlaybackId && requestedPlaybackId && storedPlaybackId !== requestedPlaybackId) {
    throw new functions.https.HttpsError('permission-denied', 'Playback ID mismatch.');
  }

  if (watermarked) {
    if (!process.env.WATERMARK_BUCKET) {
      throw new functions.https.HttpsError('failed-precondition', 'Watermarked bucket is not configured.');
    }
    const bucket = admin.storage().bucket(process.env.WATERMARK_BUCKET);
    const wmId = resolved.mediaId || resolved.postId || targetId;
    const [signedWatermarkedUrl] = await bucket.file(`watermarked/${wmId}.mp4`).getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000,
    });
    return { url: signedWatermarkedUrl, expiresIn: 3600 };
  }

  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const keySecret = process.env.MUX_SIGNING_KEY_SECRET;
  const playbackPolicy = resolved.postData?.playbackPolicy || resolved.videoData?.playbackPolicy || 'signed';

  // Fail closed for signed assets (and whenever signing keys are expected).
  if (!keyId || !keySecret) {
    if (playbackPolicy === 'public' && process.env.ALLOW_PUBLIC_MUX_FALLBACK === 'true') {
      return {
        url: `https://stream.mux.com/${playbackId}.m3u8`,
        thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
        storyboardUrl: `https://image.mux.com/${playbackId}/storyboard.vtt`,
        expiresIn: 3600,
        signed: false,
      };
    }
    throw new functions.https.HttpsError('failed-precondition', 'Mux playback signing keys are not configured.');
  }

  try {
    const signToken = (type) => Mux.JWT.sign(playbackId, {
      keyId,
      keySecret,
      expiration: '1h',
      type,
    });

    const streamToken = signToken('video');
    const thumbToken = signToken('thumbnail');
    const storyboardToken = signToken('storyboard');

    return {
      url: `https://stream.mux.com/${playbackId}.m3u8?token=${streamToken}`,
      thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${thumbToken}`,
      storyboardUrl: `https://image.mux.com/${playbackId}/storyboard.vtt?token=${storyboardToken}`,
      expiresIn: 3600,
      signed: true,
    };
  } catch (error) {
    logger.error('getMuxPlaybackUrl', error);
    throw new functions.https.HttpsError('internal', error.message || 'Could not sign playback URL');
  }
});

// ======================================================================
//  3. handleMuxWebhook (transactional idempotency + monotonic states)
// ======================================================================
function parsePassthrough(raw) {
  if (!raw || typeof raw !== 'string') return { postId: null, mediaAssetId: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        postId: parsed.postId || parsed.canonicalPostId || null,
        mediaAssetId: parsed.mediaAssetId || parsed.videoId || parsed.postId || null,
      };
    }
  } catch {
    // plain id passthrough
  }
  return { postId: raw, mediaAssetId: raw };
}

async function resolveWebhookTargetRefs(asset) {
  const { postId, mediaAssetId } = parsePassthrough(asset?.passthrough);
  let resolvedPostRef = postId ? db.collection('posts').doc(postId) : null;
  let resolvedVideoRef = mediaAssetId ? db.collection('videos').doc(mediaAssetId) : null;

  if (!resolvedPostRef && asset?.upload_id) {
    const postByUpload = await db.collection('posts')
      .where('muxUploadId', '==', asset.upload_id)
      .limit(1)
      .get();
    if (!postByUpload.empty) {
      resolvedPostRef = postByUpload.docs[0].ref;
      resolvedVideoRef = db.collection('videos').doc(postByUpload.docs[0].data().mediaAssetId || postByUpload.docs[0].id);
    }
  }

  if (!resolvedVideoRef && asset?.id) {
    const videoByAsset = await db.collection('videos')
      .where('muxAssetId', '==', asset.id)
      .limit(1)
      .get();
    if (!videoByAsset.empty) {
      resolvedVideoRef = videoByAsset.docs[0].ref;
      const cid = videoByAsset.docs[0].data().canonicalPostId || videoByAsset.docs[0].id;
      resolvedPostRef = db.collection('posts').doc(cid);
    }
  }

  return { resolvedPostRef, resolvedVideoRef };
}

exports.handleMuxWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString() : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const signature = req.headers['mux-signature'];
  const secret = process.env.MUX_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('Missing MUX_WEBHOOK_SECRET');
    res.status(500).send('Server configuration error');
    return;
  }

  let event;
  try {
    event = Mux.Webhooks.verifyHeader(rawBody, signature, secret);
  } catch (err) {
    logger.error('Webhook verification failed', err);
    res.status(401).send('Invalid signature');
    return;
  }

  const eventId = event.id || crypto.createHash('sha256').update(rawBody).digest('hex');
  const eventRef = db.collection('mux_events').doc(eventId);
  const asset = event.data || {};

  try {
    let postPublishContext = null;

    const outcome = await db.runTransaction(async (t) => {
      const existingEvent = await t.get(eventRef);
      if (existingEvent.exists) {
        return { duplicate: true };
      }

      const { resolvedPostRef, resolvedVideoRef } = await resolveWebhookTargetRefs(asset);
      const postSnap = resolvedPostRef ? await t.get(resolvedPostRef) : null;
      const videoSnap = resolvedVideoRef ? await t.get(resolvedVideoRef) : null;

      t.set(eventRef, {
        eventId,
        type: event.type || 'unknown',
        assetId: asset.id || null,
        processedAt: FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      if ((!postSnap || !postSnap.exists) && (!videoSnap || !videoSnap.exists)) {
        return { missingTarget: true };
      }

      const postData = postSnap?.exists ? postSnap.data() : null;
      const videoData = videoSnap?.exists ? videoSnap.data() : null;
      const currentState = postData?.processingState || videoData?.processingState || SPARK_PROCESSING_STATES.UPLOAD_RESERVED;

      if (event.type === 'video.upload.asset_created' || event.type === 'video.asset.created') {
        if (canTransitionProcessingState(currentState, SPARK_PROCESSING_STATES.PROCESSING)) {
          const patch = {
            muxAssetId: asset.asset_id || asset.id || null,
            processingState: SPARK_PROCESSING_STATES.PROCESSING,
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (postSnap?.exists) t.update(resolvedPostRef, { ...patch, status: 'processing' });
          if (videoSnap?.exists) t.update(resolvedVideoRef, { ...patch, status: 'processing' });
        }
        return { handled: true };
      }

      if (event.type === 'video.upload.errored' || event.type === 'video.asset.errored') {
        const nextFailure = event.type === 'video.upload.errored'
          ? SPARK_PROCESSING_STATES.UPLOAD_FAILED
          : SPARK_PROCESSING_STATES.PROCESSING_FAILED;
        if (canTransitionProcessingState(currentState, nextFailure)) {
          const errorMessage = Array.isArray(asset.errors?.messages)
            ? asset.errors.messages.join(', ')
            : (asset.error?.message || 'Mux processing failed');
          const failPatch = {
            processingState: nextFailure,
            status: 'failed',
            error: String(errorMessage).slice(0, 500),
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (postSnap?.exists) t.update(resolvedPostRef, failPatch);
          if (videoSnap?.exists) t.update(resolvedVideoRef, failPatch);
        }
        return { handled: true };
      }

      if (event.type === 'video.asset.ready') {
        const durCheck = asset.duration ? validateSparkDuration(asset.duration) : { valid: true };
        if (!durCheck.valid) {
          const rejectPatch = {
            processingState: SPARK_PROCESSING_STATES.MODERATION_REJECTED,
            status: 'failed',
            moderationStatus: 'rejected',
            moderationNotes: durCheck.reason,
            isDeleted: true,
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (postSnap?.exists) t.update(resolvedPostRef, rejectPatch);
          if (videoSnap?.exists) t.update(resolvedVideoRef, rejectPatch);
          return { rejectedDuration: true };
        }

        const playbackObj = Array.isArray(asset.playback_ids) && asset.playback_ids[0] ? asset.playback_ids[0] : null;
        const playbackId = playbackObj?.id || null;
        const playbackPolicy = playbackObj?.policy || 'signed';
        if (!playbackId) {
          return { missingPlaybackId: true };
        }

        if (!canTransitionProcessingState(currentState, SPARK_PROCESSING_STATES.PUBLISHED)) {
          return { staleSkipped: true };
        }

        const thumbBase = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
        const streamBase = `https://stream.mux.com/${playbackId}.m3u8`;
        const durationSec = Number(asset.duration) || Number(postData?.duration) || 0;
        const aspectRatio = asset.aspect_ratio || postData?.aspectRatio || null;
        const ownerId = postData?.authorId || videoData?.userId || null;

        const commonReady = {
          muxAssetId: asset.id,
          muxPlaybackId: playbackId,
          playbackPolicy,
          processingState: SPARK_PROCESSING_STATES.PUBLISHED,
          duration: durationSec,
          aspectRatio,
          thumbnailUrl: thumbBase,
          videoUrl: streamBase,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (postSnap?.exists) {
          t.update(resolvedPostRef, {
            ...commonReady,
            status: 'published',
            media: [
              {
                type: 'video',
                mediaAssetId: resolvedVideoRef?.id || resolvedPostRef.id,
                muxPlaybackId: playbackId,
                playbackPolicy,
                url: streamBase,
                thumbnailUrl: thumbBase,
                duration: durationSec,
                aspectRatio,
              },
            ],
          });
        }
        if (videoSnap?.exists) {
          t.update(resolvedVideoRef, {
            ...commonReady,
            status: 'ready',
          });
        }

        postPublishContext = {
          postId: resolvedPostRef?.id || null,
          mediaId: resolvedVideoRef?.id || resolvedPostRef?.id || null,
          ownerId,
          visibility: normalizeSparkVisibility(postData?.visibility || videoData?.visibility || 'public'),
          isDeleted: Boolean(postData?.isDeleted || videoData?.isDeleted),
          title: postData?.title || videoData?.title || 'New Spark',
          tags: postData?.tags || videoData?.tags || [],
          playbackId,
          newlyPublished: currentState !== SPARK_PROCESSING_STATES.PUBLISHED,
        };
        return { published: true };
      }

      return { ignoredEventType: event.type };
    });

    if (outcome?.duplicate) {
      res.status(200).send('Duplicate event ignored');
      return;
    }

    if (postPublishContext && postPublishContext.newlyPublished) {
      const targetId = postPublishContext.postId || postPublishContext.mediaId;
      if (
        postPublishContext.postId &&
        postPublishContext.ownerId &&
        postPublishContext.visibility === 'public' &&
        !postPublishContext.isDeleted
      ) {
        await db.collection('fanout_tasks').doc(`${postPublishContext.postId}_${postPublishContext.ownerId}`).set({
          postId: postPublishContext.postId,
          authorId: postPublishContext.ownerId,
          snapshot: {
            type: 'video',
            content: postPublishContext.title,
            media: [postPublishContext.playbackId],
            tags: postPublishContext.tags,
          },
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await Promise.allSettled([
        targetId ? generateAudioFingerprintInternal(targetId) : Promise.resolve(),
        targetId ? updateViralScoreInternal(targetId) : Promise.resolve(),
        postPublishContext.ownerId
          ? awardXpSafe(postPublishContext.ownerId, 'post_created', { source: `spark_${targetId}` })
          : Promise.resolve(),
      ]);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// ======================================================================
//  4. likeVideo (canonical posts/{postId}/likes + sharded counters)
// ======================================================================
exports.likeVideo = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  await checkRateLimit(uid, 'likeVideo', 30, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  const access = await evaluateSparkAccessForViewer(resolved, uid);
  if (!access.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot like an inaccessible Spark.');
  }

  try {
    const primaryRef = resolved.postRef || resolved.mediaRef;
    const primaryId = primaryRef.id;
    const likeRef = primaryRef.collection('likes').doc(uid);
    const userLikeRef = db.collection('users').doc(uid).collection('liked_posts').doc(primaryId);
    const legacyLikeRef = resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path
      ? resolved.mediaRef.collection('likes').doc(uid)
      : null;

    const shardId = Math.floor(Math.random() * 10);
    const legacyShardRef = resolved.mediaRef
      ? resolved.mediaRef.collection('like_shards').doc(`shard_${shardId}`)
      : null;

    let action = 'liked';
    const ownerId = resolved.ownerId;

    await db.runTransaction(async (t) => {
      const primaryDoc = await t.get(primaryRef);
      if (!primaryDoc.exists) throw new functions.https.HttpsError('not-found', 'Spark not found');
      const likeDoc = await t.get(likeRef);
      const legacyLikeDoc = legacyLikeRef ? await t.get(legacyLikeRef) : null;
      const alreadyLiked = likeDoc.exists || Boolean(legacyLikeDoc && legacyLikeDoc.exists);

      if (alreadyLiked) {
        t.delete(likeRef);
        t.delete(userLikeRef);
        if (legacyLikeRef) t.delete(legacyLikeRef);
        if (legacyShardRef) t.set(legacyShardRef, { count: FieldValue.increment(-1) }, { merge: true });
        t.update(primaryRef, { 'stats.likes': FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
        if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
          t.update(resolved.mediaRef, { 'stats.likes': FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
        }
        action = 'unliked';
      } else {
        t.set(likeRef, { userId: uid, createdAt: FieldValue.serverTimestamp() });
        t.set(userLikeRef, { postId: primaryId, createdAt: FieldValue.serverTimestamp() });
        if (legacyLikeRef) t.set(legacyLikeRef, { userId: uid, createdAt: FieldValue.serverTimestamp() });
        if (legacyShardRef) t.set(legacyShardRef, { count: FieldValue.increment(1) }, { merge: true });
        t.update(primaryRef, { 'stats.likes': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
          t.update(resolved.mediaRef, { 'stats.likes': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        }
        action = 'liked';
      }
    });

    if (resolved.postId) {
      await incrementShardedCounter(`posts/${resolved.postId}`, 'likes', action === 'liked' ? 1 : -1);
    }

    if (action === 'liked' && ownerId && ownerId !== uid) {
      await Promise.allSettled([
        enqueuePush(ownerId, {
          type: 'like',
          senderId: uid,
          postId: primaryId,
          videoId: resolved.mediaId || primaryId,
          title: 'New Spark like',
        }),
        writeNotification(ownerId, {
          type: 'like',
          senderId: uid,
          title: 'Liked your Spark',
          message: 'Someone liked your Spark.',
          metadata: {
            postId: primaryId,
            videoId: resolved.mediaId || primaryId,
            actionUrl: `/sparks/${primaryId}`,
          },
        }),
      ]);
    }

    return { success: true, action, postId: primaryId };
  } catch (error) {
    logger.error('likeVideo', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  5. shareVideo
// ======================================================================
exports.shareVideo = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId, platform = 'arvdoul' } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  await checkRateLimit(uid, 'shareVideo', 20, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  try {
    const primaryRef = resolved.postRef || resolved.mediaRef;
    await db.runTransaction(async (t) => {
      const snap = await t.get(primaryRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Spark not found');
      t.update(primaryRef, { 'stats.shares': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
        t.update(resolved.mediaRef, { 'stats.shares': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      }
    });

    await Promise.all([
      resolved.postId ? incrementShardedCounter(`posts/${resolved.postId}`, 'shares', 1) : Promise.resolve(),
      db.collection('share_events').add({
        postId: resolved.postId || primaryRef.id,
        videoId: resolved.mediaId || primaryRef.id,
        userId: uid,
        platform,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return { success: true, postId: primaryRef.id };
  } catch (error) {
    logger.error('shareVideo', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  5b. toggleVideoSave (authoritative saves counter)
// ======================================================================
exports.toggleVideoSave = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId, save } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  await checkRateLimit(uid, 'toggleVideoSave', 30, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  const access = await evaluateSparkAccessForViewer(resolved, uid);
  if (!access.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot save an inaccessible Spark.');
  }

  try {
    const primaryRef = resolved.postRef || resolved.mediaRef;
    const primaryId = primaryRef.id;
    const savedRef = primaryRef.collection('saved_by').doc(uid);
    const legacySavedRef = resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path
      ? resolved.mediaRef.collection('saved_by').doc(uid)
      : null;
    const userSavedRef = db.collection('users').doc(uid).collection('saved_videos').doc(primaryId);

    const result = await db.runTransaction(async (t) => {
      const primaryDoc = await t.get(primaryRef);
      if (!primaryDoc.exists) throw new functions.https.HttpsError('not-found', 'Spark not found');
      const savedDoc = await t.get(savedRef);
      const legacySavedDoc = legacySavedRef ? await t.get(legacySavedRef) : null;
      const currentlySaved = savedDoc.exists || Boolean(legacySavedDoc && legacySavedDoc.exists);
      const shouldSave = typeof save === 'boolean' ? save : !currentlySaved;

      if (shouldSave === currentlySaved) {
        return { saved: currentlySaved, action: 'noop' };
      }

      if (shouldSave) {
        t.set(savedRef, { userId: uid, createdAt: FieldValue.serverTimestamp() });
        if (legacySavedRef) t.set(legacySavedRef, { userId: uid, createdAt: FieldValue.serverTimestamp() });
        t.set(userSavedRef, {
          videoId: primaryId,
          postId: resolved.postId || primaryId,
          savedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        t.update(primaryRef, { 'stats.saves': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
          t.update(resolved.mediaRef, { 'stats.saves': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        }
        return { saved: true, action: 'saved' };
      }

      t.delete(savedRef);
      if (legacySavedRef) t.delete(legacySavedRef);
      t.delete(userSavedRef);
      t.update(primaryRef, { 'stats.saves': FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
        t.update(resolved.mediaRef, { 'stats.saves': FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      }
      return { saved: false, action: 'unsaved' };
    });

    if (resolved.postId && result.action !== 'noop') {
      await incrementShardedCounter(`posts/${resolved.postId}`, 'saves', result.saved ? 1 : -1);
    }

    return { success: true, postId: primaryId, ...result };
  } catch (error) {
    logger.error('toggleVideoSave', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  6. recordVideoView (unified dedupe + clamped watchDuration + sharded views)
// ======================================================================
exports.recordVideoView = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId, watchDuration = 0 } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  await checkRateLimit(uid, 'recordVideoView', 10, 1000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) return { success: true, newView: false };

  const ownerId = resolved.ownerId;
  if (ownerId && ownerId === uid) {
    return { success: true, newView: false, skipped: 'self' };
  }
  if (ownerId && (await isMutuallyBlocked(uid, ownerId))) {
    return { success: true, newView: false, skipped: 'blocked' };
  }

  const maxWatchCap = Math.max(
    MAX_DURATION_SEC,
    Number(resolved.postData?.duration || resolved.videoData?.duration || 0) * 3,
  );
  const clampedWatch = Number.isFinite(Number(watchDuration))
    ? Math.max(0, Math.min(maxWatchCap, Number(watchDuration)))
    : 0;

  try {
    const primaryRef = resolved.postRef || resolved.mediaRef;
    const primaryId = primaryRef.id;
    const viewerRef = primaryRef.collection('viewers').doc(uid);
    const today = new Date().toISOString().slice(0, 10);
    const dailyStatRef = primaryRef.collection('daily_stats').doc(today);
    const shardId = Math.floor(Math.random() * 10);
    const viewShardRef = resolved.mediaRef
      ? resolved.mediaRef.collection('view_shards').doc(`shard_${shardId}`)
      : null;

    const result = await db.runTransaction(async (t) => {
      const [viewerDoc, dailySnap] = await Promise.all([
        t.get(viewerRef),
        t.get(dailyStatRef),
      ]);

      if (viewerDoc.exists) {
        const existingData = viewerDoc.data() || {};
        const previousDuration = Number(existingData.watchDuration) || 0;
        if (clampedWatch > previousDuration) {
          const delta = clampedWatch - previousDuration;
          t.update(viewerRef, {
            lastViewedAt: FieldValue.serverTimestamp(),
            watchDuration: clampedWatch,
          });
          t.update(primaryRef, {
            'stats.totalWatchTime': FieldValue.increment(delta),
            updatedAt: FieldValue.serverTimestamp(),
          });
          if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
            t.update(resolved.mediaRef, {
              'stats.totalWatchTime': FieldValue.increment(delta),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
        return { success: true, newView: false };
      }

      t.set(viewerRef, {
        userId: uid,
        firstViewedAt: FieldValue.serverTimestamp(),
        lastViewedAt: FieldValue.serverTimestamp(),
        viewedAt: FieldValue.serverTimestamp(),
        watchDuration: clampedWatch,
      });

      if (!dailySnap.exists) {
        t.set(dailyStatRef, {
          date: today,
          views: 1,
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        t.update(dailyStatRef, { views: FieldValue.increment(1) });
      }

      if (viewShardRef) {
        t.set(viewShardRef, { count: FieldValue.increment(1) }, { merge: true });
      }

      t.update(primaryRef, {
        'stats.views': FieldValue.increment(1),
        'stats.totalWatchTime': FieldValue.increment(clampedWatch),
        'stats.viewerCount': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (resolved.mediaRef && resolved.mediaRef.path !== primaryRef.path && resolved.videoData) {
        t.update(resolved.mediaRef, {
          'stats.views': FieldValue.increment(1),
          'stats.totalWatchTime': FieldValue.increment(clampedWatch),
          'stats.viewerCount': FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { success: true, newView: true };
    });

    if (result && result.newView) {
      await Promise.allSettled([
        resolved.postId ? incrementShardedCounter(`posts/${resolved.postId}`, 'views', 1) : Promise.resolve(),
        awardXpSafe(uid, 'video_watched', { source: primaryId }),
      ]);
    }

    return result;
  } catch (error) {
    logger.error('recordVideoView', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  7. payPerView (double-entry + canonical notification)
// ======================================================================
exports.payPerView = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  await checkRateLimit(uid, 'payPerView', 5, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  const primaryData = resolved.postData || resolved.videoData || {};
  const canonicalId = resolved.postId || resolved.mediaId;
  const price = Number(primaryData.monetization?.price || resolved.videoData?.monetization?.price || 0);
  const ownerId = resolved.ownerId;
  if (!ownerId) throw new functions.https.HttpsError('failed-precondition', 'Spark owner missing.');
  if (ownerId === uid) throw new functions.https.HttpsError('invalid-argument', 'Cannot purchase your own Spark');

  const purchaseRef = db.collection('video_purchases').doc(`${uid}_${canonicalId}`);
  const existing = await purchaseRef.get();
  if (existing.exists) throw new functions.https.HttpsError('already-exists', 'You already have access.');

  try {
    if (price <= 0) {
      await db.runTransaction(async (t) => {
        const snap = await t.get(purchaseRef);
        if (snap.exists) return;
        t.set(purchaseRef, {
          userId: uid,
          videoId: canonicalId,
          postId: canonicalId,
          price: 0,
          grantedAt: FieldValue.serverTimestamp(),
        });
      });
      return { success: true, free: true, postId: canonicalId };
    }

    const transferResult = await transferCoinsInternal(uid, ownerId, price, 'pay_per_view', {
      videoId: canonicalId,
      postId: canonicalId,
      idempotencyKey: `ppv_${uid}_${canonicalId}`,
    });
    await purchaseRef.set({
      userId: uid,
      videoId: canonicalId,
      postId: canonicalId,
      price,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await Promise.allSettled([
      enqueuePush(ownerId, {
        type: 'purchase',
        senderId: uid,
        postId: canonicalId,
        videoId: canonicalId,
        amount: price,
        title: 'New Spark purchase',
      }),
      writeNotification(ownerId, {
        type: 'purchase',
        senderId: uid,
        title: 'Spark unlocked',
        message: `Someone unlocked your Spark for ${price} coins.`,
        metadata: {
          postId: canonicalId,
          amount: price,
          actionUrl: `/sparks/${canonicalId}`,
        },
      }),
    ]);

    return { success: true, postId: canonicalId, ...transferResult };
  } catch (error) {
    logger.error('payPerView', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  8. sendTip (double-entry + canonical post + in-app notification)
// ======================================================================
exports.sendTip = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId, amount, message = '', idempotencyKey } = data || {};
  const targetId = explicitPostId || videoId;
  const safeAmount = Number(amount);
  if (!targetId || !Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'videoId and positive amount required');
  }

  await checkRateLimit(uid, 'sendTip', 10, 60000);

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  const ownerId = resolved.ownerId;
  const canonicalId = resolved.postId || resolved.mediaId;
  if (!ownerId) throw new functions.https.HttpsError('failed-precondition', 'Spark owner missing.');
  if (ownerId === uid) throw new functions.https.HttpsError('invalid-argument', 'Cannot tip yourself');

  try {
    const key = (typeof idempotencyKey === 'string' && idempotencyKey.length > 0)
      ? idempotencyKey
      : `tip_${uid}_${canonicalId}_${crypto.randomUUID()}`;
    const safeMessage = typeof message === 'string' ? message.trim().slice(0, 300) : '';
    const transferResult = await transferCoinsInternal(uid, ownerId, safeAmount, 'tip', {
      videoId: canonicalId,
      postId: canonicalId,
      message: safeMessage,
      idempotencyKey: key,
    });

    await db.collection('tips').add({
      videoId: canonicalId,
      postId: canonicalId,
      fromUserId: uid,
      toUserId: ownerId,
      amount: safeAmount,
      message: safeMessage,
      createdAt: FieldValue.serverTimestamp(),
    });

    await Promise.allSettled([
      enqueuePush(ownerId, {
        type: 'tip',
        senderId: uid,
        postId: canonicalId,
        videoId: canonicalId,
        amount: safeAmount,
        title: 'You received a Spark tip!',
      }),
      writeNotification(ownerId, {
        type: 'tip',
        senderId: uid,
        title: 'You received a tip!',
        message: `Someone sent you ${safeAmount} coins on your Spark.`,
        metadata: {
          postId: canonicalId,
          amount: safeAmount,
          actionUrl: `/sparks/${canonicalId}`,
        },
      }),
      awardXpSafe(uid, 'gift_sent', { source: `tip_${key}` }),
      awardXpSafe(ownerId, 'gift_received', { source: `tip_${key}` }),
    ]);

    return { success: true, postId: canonicalId, ...transferResult };
  } catch (error) {
    logger.error('sendTip', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  9. setVideoChapters
// ======================================================================
exports.setVideoChapters = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId, chapters } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId || !Array.isArray(chapters)) {
    throw new functions.https.HttpsError('invalid-argument', 'videoId/postId and chapters array required');
  }

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');
  if (resolved.ownerId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only owner can set chapters');
  }

  const cleanChapters = chapters.slice(0, 40).map((c) => ({
    title: String(c?.title || '').trim().slice(0, 100),
    startSec: Math.max(0, Number(c?.startSec) || 0),
  })).filter((c) => c.title);

  try {
    const batch = db.batch();
    if (resolved.postRef) {
      batch.update(resolved.postRef, { chapters: cleanChapters, updatedAt: FieldValue.serverTimestamp() });
    }
    if (resolved.mediaRef && resolved.videoData) {
      batch.update(resolved.mediaRef, { chapters: cleanChapters, updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    return { success: true, chapters: cleanChapters };
  } catch (error) {
    logger.error('setVideoChapters', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  10. createDuet / createStitch
// ======================================================================
async function createRemix(originalVideoId, userId, remixType, metadata = {}) {
  await checkRateLimit(userId, 'createDuetStitch', 5, 60000);

  const original = await resolveSparkTarget(originalVideoId);
  if (!original) throw new functions.https.HttpsError('not-found', 'Original Spark not found');
  const origData = original.postData || original.videoData || {};

  if (remixType === 'duet' && origData.duetEnabled === false) {
    throw new functions.https.HttpsError('failed-precondition', 'Duet not allowed for this Spark');
  }
  if (remixType === 'stitch' && origData.stitchEnabled === false) {
    throw new functions.https.HttpsError('failed-precondition', 'Stitch not allowed for this Spark');
  }

  const postRef = db.collection('posts').doc();
  const postId = postRef.id;
  const videoRef = db.collection('videos').doc(postId);
  const title = `${remixType === 'duet' ? 'Duet' : 'Stitch'} with ${origData.authorName || origData.title || 'Spark'}`;
  const baseStats = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, totalWatchTime: 0, viewerCount: 0, gifts: 0, giftValue: 0 };

  const batch = db.batch();
  batch.set(postRef, {
    authorId: userId,
    userId,
    type: 'video',
    subType: 'spark',
    title,
    content: metadata?.caption || title,
    tags: origData.tags || [],
    hashtags: origData.tags || [],
    visibility: 'public',
    status: 'processing',
    processingState: SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
    mediaAssetId: postId,
    canonicalPostId: postId,
    originalPostId: original.postId || original.mediaId,
    remixType,
    muxAssetId: null,
    muxPlaybackId: null,
    playbackPolicy: 'signed',
    stats: baseStats,
    duetEnabled: false,
    stitchEnabled: false,
    monetization: { type: 'none' },
    isDeleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(videoRef, {
    userId,
    authorId: userId,
    canonicalPostId: postId,
    postId,
    title,
    description: '',
    tags: origData.tags || [],
    visibility: 'public',
    status: 'uploading',
    processingState: SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
    muxAssetId: null,
    muxPlaybackId: null,
    originalVideoId: original.mediaId || original.postId,
    remixType,
    stats: baseStats,
    type: 'video',
    duetEnabled: false,
    stitchEnabled: false,
    monetization: { type: 'none' },
    isDeleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { success: true, videoId: postId, postId };
}

exports.createDuet = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { originalVideoId, metadata } = data || {};
  if (!originalVideoId) throw new functions.https.HttpsError('invalid-argument', 'originalVideoId required');
  return createRemix(originalVideoId, uid, 'duet', metadata);
});

exports.createStitch = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { originalVideoId, metadata } = data || {};
  if (!originalVideoId) throw new functions.https.HttpsError('invalid-argument', 'originalVideoId required');
  return createRemix(originalVideoId, uid, 'stitch', metadata);
});

// ======================================================================
//  11. live stream
// ======================================================================
exports.createLiveStream = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { title, visibility = 'public', tags = [] } = data || {};
  await checkRateLimit(uid, 'createLive', 2, 3600000);

  try {
    const liveStream = await Video.LiveStreams.create({
      playback_policy: 'signed',
      reconnect_window: 30,
      new_asset_settings: { playback_policy: 'signed' },
    });
    const postRef = db.collection('posts').doc();
    const postId = postRef.id;
    const videoRef = db.collection('videos').doc(postId);
    const playbackId = liveStream.playback_ids[0].id;
    const baseStats = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, totalWatchTime: 0, viewerCount: 0 };

    const batch = db.batch();
    batch.set(postRef, {
      authorId: uid,
      userId: uid,
      type: 'video',
      subType: 'live',
      title: title || 'Live Stream',
      content: title || 'Live Stream',
      tags: Array.isArray(tags) ? tags : [],
      visibility: normalizeSparkVisibility(visibility),
      status: 'live',
      processingState: SPARK_PROCESSING_STATES.PUBLISHED,
      mediaAssetId: postId,
      canonicalPostId: postId,
      muxAssetId: null,
      muxPlaybackId: playbackId,
      playbackPolicy: 'signed',
      liveStreamId: liveStream.id,
      stats: baseStats,
      monetization: { type: 'none' },
      isDeleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(videoRef, {
      userId: uid,
      authorId: uid,
      canonicalPostId: postId,
      postId,
      title: title || 'Live Stream',
      description: '',
      tags: Array.isArray(tags) ? tags : [],
      visibility: normalizeSparkVisibility(visibility),
      status: 'live',
      type: 'live',
      muxAssetId: null,
      muxPlaybackId: playbackId,
      playbackPolicy: 'signed',
      liveStreamId: liveStream.id,
      stats: baseStats,
      monetization: { type: 'none' },
      isDeleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return {
      success: true,
      postId,
      videoId: postId,
      streamKey: liveStream.stream_key,
      playbackId,
      rtmpUrl: liveStream.rtmp_url || 'rtmps://rtmp-live.mux.com:443/app',
    };
  } catch (error) {
    logger.error('createLiveStream', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.stopLiveStream = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { liveStreamId } = data || {};
  if (!liveStreamId) throw new functions.https.HttpsError('invalid-argument', 'liveStreamId required');

  try {
    await Video.LiveStreams.disable(liveStreamId);
    const [postSnap, videoSnap] = await Promise.all([
      db.collection('posts').where('liveStreamId', '==', liveStreamId).where('authorId', '==', uid).limit(1).get(),
      db.collection('videos').where('liveStreamId', '==', liveStreamId).where('userId', '==', uid).limit(1).get(),
    ]);
    const batch = db.batch();
    if (!postSnap.empty) {
      batch.update(postSnap.docs[0].ref, { status: 'live_ended', updatedAt: FieldValue.serverTimestamp() });
    }
    if (!videoSnap.empty) {
      batch.update(videoSnap.docs[0].ref, { status: 'live_ended', updatedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    return { success: true };
  } catch (error) {
    logger.error('stopLiveStream', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  13. getVideoRecommendations (canonical posts + mutual block filter)
// ======================================================================
exports.getVideoRecommendations = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId required');

  try {
    const resolved = await resolveSparkTarget(targetId);
    if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');
    const video = resolved.postData || resolved.videoData || {};
    const ownerId = resolved.ownerId || video.userId || video.authorId;

    // Mutual block filter (both outgoing and incoming blocks).
    const hiddenAuthors = new Set();
    try {
      const [outgoing, incoming] = await Promise.all([
        db.collection('blocks').where('blockerId', '==', uid).get(),
        db.collection('blocks').where('blockedId', '==', uid).get(),
      ]);
      outgoing.docs.forEach((d) => hiddenAuthors.add(d.data().blockedId));
      incoming.docs.forEach((d) => hiddenAuthors.add(d.data().blockerId));
    } catch (err) {
      logger.warn('getVideoRecommendations: block filter unavailable', { error: err.message });
    }

    const seenIds = new Set([resolved.postId || targetId, targetId]);
    const recommendations = [];

    if (ownerId && !hiddenAuthors.has(ownerId)) {
      const snap = await db.collection('posts')
        .where('authorId', '==', ownerId)
        .where('type', '==', 'video')
        .where('status', '==', 'published')
        .where('visibility', '==', 'public')
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();
      snap.forEach((doc) => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          recommendations.push({ id: doc.id, postId: doc.id, ...doc.data() });
        }
      });
    }

    const tags = (video.tags || []).slice(0, 2);
    for (const tag of tags) {
      if (recommendations.length >= 10) break;
      const snap = await db.collection('posts')
        .where('type', '==', 'video')
        .where('tags', 'array-contains', tag)
        .where('status', '==', 'published')
        .where('visibility', '==', 'public')
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();
      snap.forEach((doc) => {
        const d = doc.data();
        const author = d.authorId || d.userId;
        if (!seenIds.has(doc.id) && !hiddenAuthors.has(author)) {
          seenIds.add(doc.id);
          recommendations.push({ id: doc.id, postId: doc.id, ...d });
        }
      });
    }

    // Legacy fallback if canonical posts returned < 4 results (guarded by !hiddenAuthors.has(doc.data().userId)).
    if (recommendations.length < 4 && video.userId && !hiddenAuthors.has(video.userId)) {
      const legacySnap = await db.collection('videos')
        .where('userId', '==', video.userId)
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      legacySnap.forEach((doc) => {
        if (!seenIds.has(doc.id) && doc.data().status === 'ready' && !hiddenAuthors.has(doc.data().userId)) {
          seenIds.add(doc.id);
          recommendations.push({ id: doc.id, ...doc.data() });
        }
      });
    }

    recommendations.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return { recommendations: recommendations.slice(0, 10) };
  } catch (error) {
    logger.error('getVideoRecommendations', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  14. watermarkVideo (FFmpeg, visible + invisible)
// ======================================================================
async function watermarkVideoInternal(videoId) {
  const resolved = await resolveSparkTarget(videoId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');

  const video = resolved.postData || resolved.videoData || {};
  if (video.watermarkDisabled && resolved.ownerId !== 'system') {
    return { status: 'skipped' };
  }

  const playbackId = video.muxPlaybackId;
  if (!playbackId) throw new functions.https.HttpsError('failed-precondition', 'No playbackId');

  const sourceUrl = `https://stream.mux.com/${playbackId}/high.mp4`;
  const runSuffix = crypto.randomBytes(4).toString('hex');
  const tempInput = path.join(os.tmpdir(), `${videoId}_${runSuffix}_input.mp4`);
  const tempWatermark = path.join(os.tmpdir(), `${videoId}_${runSuffix}_wm.png`);
  const tempOutput = path.join(os.tmpdir(), `${videoId}_${runSuffix}_watermarked.mp4`);
  const watermarkUrl = 'https://storage.googleapis.com/arvdoul-assets/logo.png';

  try {
    const [sourceRes, wmRes] = await Promise.all([fetch(sourceUrl), fetch(watermarkUrl)]);
    if (!sourceRes.ok) throw new functions.https.HttpsError('unavailable', `Failed to fetch source video (${sourceRes.status})`);
    if (!wmRes.ok) throw new functions.https.HttpsError('unavailable', `Failed to fetch watermark (${wmRes.status})`);

    fs.writeFileSync(tempInput, Buffer.from(await sourceRes.arrayBuffer()));
    fs.writeFileSync(tempWatermark, Buffer.from(await wmRes.arrayBuffer()));

    const safeUserId = String(resolved.ownerId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeVideoId = String(resolved.mediaId || videoId).replace(/[^a-zA-Z0-9_-]/g, '');
    const forensicMetadata = `${safeUserId}|${safeVideoId}|${Date.now()}`;
    const watermarkFilter = `drawtext=text='Arvdoul':fontcolor=white:fontsize=24:x=w-tw-10:y=h-th-10:alpha=0.8`;
    const forensicFilter = `drawtext=text='${forensicMetadata}':fontcolor=white:fontsize=8:x=w-tw-10:y=10:alpha=0.2`;
    const filterComplex = `[1:v]scale=100:-1[wm];[0:v][wm]overlay=W-w-10:H-h-10,${watermarkFilter},${forensicFilter}`;

    await execFilePromise('ffmpeg', [
      '-y',
      '-i', tempInput,
      '-i', tempWatermark,
      '-filter_complex', filterComplex,
      '-c:a', 'copy',
      tempOutput,
    ]);

    const bucket = admin.storage().bucket(process.env.WATERMARK_BUCKET);
    await bucket.upload(tempOutput, { destination: `watermarked/${safeVideoId}.mp4` });
    const [signedUrl] = await bucket.file(`watermarked/${safeVideoId}.mp4`).getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const patch = {
      watermarkedUrl: signedUrl,
      watermarkedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    if (resolved.postRef) batch.update(resolved.postRef, patch);
    if (resolved.mediaRef && resolved.videoData) batch.update(resolved.mediaRef, patch);
    await batch.commit();

    return { success: true, watermarkedUrl: signedUrl };
  } finally {
    for (const filePath of [tempInput, tempWatermark, tempOutput]) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        logger.warn('Temp watermark file cleanup skipped', { filePath, error: cleanupErr.message });
      }
    }
  }
}

exports.watermarkVideo = onCall(async (data, context) => {
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId required');
  try {
    const uid = getUserIdFromContext(context);
    const resolved = await resolveSparkTarget(targetId);
    if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');
    await assertVideoOwnerOrAdmin(resolved.postData || resolved.videoData, uid, context);
    return await watermarkVideoInternal(targetId);
  } catch (error) {
    logger.error('watermarkVideo', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  15. moderateVideo (Google Video Intelligence + explicit policy check)
// ======================================================================
async function moderateVideoInternal(videoId) {
  const resolved = await resolveSparkTarget(videoId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');
  const video = resolved.postData || resolved.videoData || {};
  const playbackId = video.muxPlaybackId;
  if (!playbackId) throw new functions.https.HttpsError('failed-precondition', 'No playbackId');

  const gcsUri = `gs://${process.env.WATERMARK_BUCKET}/source/${resolved.mediaId || videoId}.mp4`;
  const [operation] = await videoIntelligenceClient.annotateVideo({
    inputUri: gcsUri,
    features: ['EXPLICIT_CONTENT_DETECTION', 'LABEL_DETECTION'],
  });
  const [result] = await operation.promise();
  const explicitFrames = result.annotationResults[0]?.explicitAnnotation?.frames || [];
  const badLikelihoods = ['LIKELY', 'VERY_LIKELY', 'POSSIBLE'];
  const hasExplicit = explicitFrames.some((f) => badLikelihoods.includes(f.likelihood));

  const moderationStatus = hasExplicit ? 'rejected' : 'approved';
  const moderationNotes = hasExplicit ? 'Explicit content detected' : '';
  const patch = {
    moderationStatus,
    moderationNotes,
    moderatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...(moderationStatus === 'rejected' && {
      isDeleted: true,
      status: 'failed',
      processingState: SPARK_PROCESSING_STATES.MODERATION_REJECTED,
    }),
  };

  const batch = db.batch();
  if (resolved.postRef) batch.update(resolved.postRef, patch);
  if (resolved.mediaRef && resolved.videoData) batch.update(resolved.mediaRef, patch);
  await batch.commit();

  return { success: true, moderationStatus };
}

exports.moderateVideo = onCall(async (data, context) => {
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId required');
  try {
    const uid = getUserIdFromContext(context);
    const resolved = await resolveSparkTarget(targetId);
    if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');
    await assertVideoOwnerOrAdmin(resolved.postData || resolved.videoData, uid, context);
    return await moderateVideoInternal(targetId);
  } catch (error) {
    logger.error('moderateVideo', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  16. generateAudioFingerprint (honest unavailable state until chromaprint)
// ======================================================================
async function generateAudioFingerprintInternal(videoId) {
  const resolved = await resolveSparkTarget(videoId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');

  const fingerprintPipelineConfigured = false;
  if (!fingerprintPipelineConfigured) {
    const patch = {
      audioFingerprint: null,
      audioFingerprintStatus: 'unavailable',
      audioFingerprintNote: 'Acoustic fingerprinting requires the ffmpeg/chromaprint pipeline (not configured)',
      updatedAt: FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    if (resolved.postRef) batch.update(resolved.postRef, patch);
    if (resolved.mediaRef && resolved.videoData) batch.update(resolved.mediaRef, patch);
    await batch.commit();
    return { success: false, status: 'unavailable', reason: 'chromaprint pipeline not configured' };
  }

  return { success: true, status: 'pending' };
}

exports.generateAudioFingerprint = onCall(async (data, context) => {
  await assertAdmin(context);
  const { videoId } = data || {};
  if (!videoId) throw new functions.https.HttpsError('invalid-argument', 'videoId required');
  await writeAudit(getUserIdFromContext(context), 'regenerate_audio_fingerprint', videoId, {}, 'video');
  try {
    return await generateAudioFingerprintInternal(videoId);
  } catch (error) {
    logger.error('generateAudioFingerprint', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  17. updateViralScore
// ======================================================================
async function updateViralScoreInternal(videoId) {
  const resolved = await resolveSparkTarget(videoId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Video not found');
  const video = resolved.postData || resolved.videoData || {};
  const stats = video.stats || {};
  const views = stats.views || 0;
  const likes = stats.likes || 0;
  const shares = stats.shares || 0;
  const createdAt = video.createdAt?.toMillis?.() || Date.now();
  const ageHours = Math.max(0.01, (Date.now() - createdAt) / 3600000);

  const viewsVelocity = views / ageHours;
  const sharesVelocity = shares / ageHours;
  const likeRatio = likes / Math.max(views, 1);
  const completionRate = (stats.totalWatchTime || 0) / Math.max(views, 1) / (video.duration || 1);

  const viralScore = Math.min(
    1000,
    (viewsVelocity * 0.35) + (sharesVelocity * 0.25) + (completionRate * 0.25) + (likeRatio * 0.15),
  );
  const patch = { viralScore, updatedAt: FieldValue.serverTimestamp() };
  const batch = db.batch();
  if (resolved.postRef) batch.update(resolved.postRef, patch);
  if (resolved.mediaRef && resolved.videoData) batch.update(resolved.mediaRef, patch);
  await batch.commit();
  return { success: true, viralScore };
}

exports.updateViralScore = onCall(async (data, context) => {
  await assertAdmin(context);
  const { videoId } = data || {};
  if (!videoId) throw new functions.https.HttpsError('invalid-argument', 'videoId required');
  await writeAudit(getUserIdFromContext(context), 'recompute_viral_score', videoId, {}, 'video');
  try {
    return await updateViralScoreInternal(videoId);
  } catch (error) {
    logger.error('updateViralScore', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  18. deleteVideo (unified canonical soft-delete + Mux/Storage cleanup)
// ======================================================================
exports.deleteVideo = onCall(async (data, context) => {
  const uid = validateAuth(context);
  const { videoId, postId: explicitPostId } = data || {};
  const targetId = explicitPostId || videoId;
  if (!targetId) throw new functions.https.HttpsError('invalid-argument', 'videoId or postId required');

  const resolved = await resolveSparkTarget(targetId);
  if (!resolved) throw new functions.https.HttpsError('not-found', 'Spark not found');

  await assertVideoOwnerOrAdmin(resolved.postData || resolved.videoData, uid, context);
  const isAdminAction = resolved.ownerId !== uid;

  const deletePatch = {
    isDeleted: true,
    status: 'deleted',
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  if (resolved.postRef) batch.update(resolved.postRef, deletePatch);
  if (resolved.mediaRef && resolved.videoData) batch.update(resolved.mediaRef, deletePatch);
  await batch.commit();

  const muxAssetId = resolved.postData?.muxAssetId || resolved.videoData?.muxAssetId;
  if (muxAssetId && process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
    await Video.Assets.delete(muxAssetId).catch((e) =>
      logger.warn('Mux asset cleanup failed', { muxAssetId, error: e.message }),
    );
  }

  const storagePath = resolved.postData?.storagePath || resolved.videoData?.storagePath;
  if (storagePath) {
    await admin.storage().bucket().file(storagePath).delete().catch((e) =>
      logger.warn('Storage video cleanup failed', { storagePath, error: e.message }),
    );
  }

  if (isAdminAction) {
    await writeAudit(uid, 'delete_spark', resolved.postId || resolved.mediaId, { ownerId: resolved.ownerId }, 'video');
  }

  return { success: true, postId: resolved.postId || resolved.mediaId };
});

// ======================================================================
//  SCHEDULED FUNCTIONS (cursor-based aggregation)
// ======================================================================
async function processBatchWithCursor(collectionName, processDocFn, cursorDocName, limit = 200) {
  const cursorRef = db.collection('system').doc(cursorDocName);
  const cursorSnap = await cursorRef.get();
  let lastProcessedId = cursorSnap.exists ? cursorSnap.data().lastId : null;

  let query = db.collection(collectionName).where('isDeleted', '==', false).orderBy('__name__').limit(limit);
  if (lastProcessedId) {
    const lastDoc = await db.collection(collectionName).doc(lastProcessedId).get();
    if (lastDoc.exists) query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();
  if (snapshot.empty) return { processed: 0 };

  for (const doc of snapshot.docs) {
    await processDocFn(doc);
    lastProcessedId = doc.id;
  }
  await cursorRef.set({ lastId: lastProcessedId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { processed: snapshot.size };
}

exports.aggregateVideoViews = pubsub.schedule('every 5 minutes').onRun(async () => {
  return processBatchWithCursor('videos', async (doc) => {
    const shardsSnap = await doc.ref.collection('view_shards').get();
    let totalViews = 0;
    shardsSnap.forEach((s) => { totalViews += s.data().count || 0; });
    await doc.ref.update({ 'stats.views': totalViews, updatedAt: FieldValue.serverTimestamp() });
  }, 'aggregation_cursor_views');
});

exports.aggregateVideoLikes = pubsub.schedule('every 5 minutes').onRun(async () => {
  return processBatchWithCursor('videos', async (doc) => {
    const shardsSnap = await doc.ref.collection('like_shards').get();
    let totalLikes = 0;
    shardsSnap.forEach((s) => { totalLikes += s.data().count || 0; });
    await doc.ref.update({ 'stats.likes': totalLikes, updatedAt: FieldValue.serverTimestamp() });
  }, 'aggregation_cursor_likes');
});

exports.aggregateVideoComments = pubsub.schedule('every 5 minutes').onRun(async () => {
  return processBatchWithCursor('videos', async (doc) => {
    const agg = await db.collection('comments')
      .where('postId', '==', doc.id)
      .where('isDeleted', '==', false)
      .count()
      .get();
    const totalComments = agg.data().count || 0;
    const stored = doc.data().stats?.comments;
    if (stored !== totalComments) {
      await doc.ref.update({ 'stats.comments': totalComments, updatedAt: FieldValue.serverTimestamp() });
    }
  }, 'aggregation_cursor_comments');
});

exports.updateVideoRankingScores = pubsub.schedule('every 15 minutes').onRun(async () => {
  return processBatchWithCursor('videos', async (doc) => {
    const data = doc.data();
    if (data.status !== 'ready') return;

    const stats = data.stats || {};
    const views = stats.views || 0;
    const likes = stats.likes || 0;
    const comments = stats.comments || 0;
    const shares = stats.shares || 0;
    const totalWatchTime = stats.totalWatchTime || 0;
    const viewerCount = stats.viewerCount || 1;

    const avgWatch = totalWatchTime / Math.max(1, viewerCount);
    const duration = data.duration || 1;
    const watchRatio = avgWatch / duration;

    let score = views * 0.2 + likes * 1 + comments * 2 + shares * 3 + watchRatio * 5;
    if (views > 1000 && ((likes + comments + shares) / views) > 0.1) score *= 1.5;
    const ageHours = (Date.now() - (data.createdAt?.toMillis?.() || 0)) / 3600000;
    score *= Math.exp(-ageHours / 48);

    const updates = { rankingScore: score, updatedAt: FieldValue.serverTimestamp() };
    await doc.ref.update(updates);
    if (data.canonicalPostId) {
      await db.collection('posts').doc(data.canonicalPostId).update(updates).catch(() => {});
    }
  }, 'aggregation_cursor_ranking');
});

exports.detectStuckVideos = pubsub.schedule('every 24 hours').onRun(async () => {
  return processBatchWithCursor('videos', async (doc) => {
    const data = doc.data();
    if (data.status !== 'uploading' && data.processingState !== SPARK_PROCESSING_STATES.UPLOAD_RESERVED) return;
    const createdAt = data.createdAt?.toMillis?.() || 0;
    if (Date.now() - createdAt > 24 * 60 * 60 * 1000) {
      const failPatch = {
        status: 'failed',
        processingState: SPARK_PROCESSING_STATES.PROCESSING_FAILED,
        error: 'Processing timed out',
        updatedAt: FieldValue.serverTimestamp(),
      };
      await doc.ref.update(failPatch);
      if (data.canonicalPostId) {
        await db.collection('posts').doc(data.canonicalPostId).update(failPatch).catch(() => {});
      }
    }
  }, 'aggregation_cursor_stuck', 200);
});

exports.cleanupOldShareEvents = pubsub.schedule('every 24 hours').onRun(async () => {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  let deleted = 0;
  for (;;) {
    const oldEvents = await db.collection('share_events').where('createdAt', '<=', cutoff).limit(400).get();
    if (oldEvents.empty) break;
    const batch = db.batch();
    oldEvents.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += oldEvents.size;
    if (oldEvents.size < 400) break;
  }
  if (deleted) logger.info('share_events cleanup', { deleted });
  return null;
});

module.exports.__test__ = {
  transferCoinsInternal,
  resolveSparkTarget,
  evaluateSparkAccess,
};
