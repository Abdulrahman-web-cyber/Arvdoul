// functions/videoMigration.js — Resumable, idempotent migration from legacy `videos/{id}`
// to Canonical Posts Architecture (`posts/{postId}` + `video_migration_map/{legacyId}`).
//
// Security & safety guarantees:
//   - Admin-only (`assertAdmin`) with mandatory audit log (`writeAudit`).
//   - Never writes coins, XP, or notifications (pure structural migration).
//   - Preserves original `createdAt`, counters (`stats`), likes, saves, viewers,
//     comments (`postId`), and PPV purchases (`video_purchases`).
//   - Checkpointed in `migration_checkpoints/{jobId}` for safe resume and rollback.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { assertAdmin, getUserIdFromContext } = require('./auth');
const { writeAudit } = require('./admin');
const {
  SPARK_PROCESSING_STATES,
  normalizeSparkVisibility,
} = require('./videoConfig.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function mapLegacyStatusToProcessingState(legacy) {
  const s = String(legacy?.status || '').toLowerCase();
  if (legacy?.processingState) return legacy.processingState;
  if (legacy?.moderationStatus === 'rejected') return SPARK_PROCESSING_STATES.MODERATION_REJECTED;
  if (s === 'ready' || s === 'published' || s === 'live') return SPARK_PROCESSING_STATES.PUBLISHED;
  if (s === 'failed' || s === 'error') return SPARK_PROCESSING_STATES.PROCESSING_FAILED;
  if (s === 'processing') return SPARK_PROCESSING_STATES.PROCESSING;
  return SPARK_PROCESSING_STATES.UPLOAD_RESERVED;
}

function mapLegacyStatusToPostStatus(legacy) {
  if (legacy?.isDeleted === true) return 'deleted';
  const s = String(legacy?.status || '').toLowerCase();
  if (s === 'ready' || s === 'published' || s === 'live') return 'published';
  if (s === 'failed' || s === 'error') return 'failed';
  return 'processing';
}

function sanitizeStats(rawStats = {}) {
  return {
    views: Math.max(0, Number(rawStats.views) || 0),
    likes: Math.max(0, Number(rawStats.likes) || 0),
    comments: Math.max(0, Number(rawStats.comments) || 0),
    shares: Math.max(0, Number(rawStats.shares) || 0),
    saves: Math.max(0, Number(rawStats.saves) || 0),
    totalWatchTime: Math.max(0, Number(rawStats.totalWatchTime) || 0),
    viewerCount: Math.max(0, Number(rawStats.viewerCount) || 0),
    gifts: Math.max(0, Number(rawStats.gifts) || 0),
    giftValue: Math.max(0, Number(rawStats.giftValue) || 0),
  };
}

async function copySubcollectionPaged(sourceParentRef, targetParentRef, subName, transformFn) {
  let cursor = null;
  let copied = 0;
  for (;;) {
    let q = sourceParentRef.collection(subName).orderBy('__name__').limit(200);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const payload = transformFn ? transformFn(doc.data(), doc.id) : doc.data();
      batch.set(targetParentRef.collection(subName).doc(doc.id), payload, { merge: true });
    });
    await batch.commit();
    copied += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 200) break;
  }
  return copied;
}

async function migrateSingleLegacyVideo(videoDoc, dryRun = false) {
  const legacyId = videoDoc.id;
  const legacy = videoDoc.data() || {};
  const ownerId = legacy.authorId || legacy.userId || null;
  if (!ownerId) {
    return { legacyId, status: 'skipped_no_owner' };
  }

  // Already mapped or already linked to an existing post?
  const mapRef = db.collection('video_migration_map').doc(legacyId);
  const existingMap = await mapRef.get();
  if (existingMap.exists && existingMap.data()?.canonicalPostId) {
    return {
      legacyId,
      canonicalPostId: existingMap.data().canonicalPostId,
      status: 'already_migrated',
    };
  }

  const candidatePostId = legacy.canonicalPostId || legacy.postId || legacyId;
  const postRef = db.collection('posts').doc(candidatePostId);

  if (dryRun) {
    return {
      legacyId,
      canonicalPostId: candidatePostId,
      status: 'would_migrate',
    };
  }

  const [ownerSnap, existingPostSnap] = await Promise.all([
    db.collection('users').doc(ownerId).get(),
    postRef.get(),
  ]);
  const ownerData = ownerSnap.exists ? ownerSnap.data() : {};
  const authorName = legacy.authorName || ownerData.displayName || ownerData.username || '';
  const authorPhoto = legacy.authorPhoto || ownerData.photoURL || null;
  const authorIsPrivate = typeof legacy.authorIsPrivate === 'boolean'
    ? legacy.authorIsPrivate
    : Boolean(ownerData.isPrivate);

  const playbackId = legacy.muxPlaybackId || legacy.playbackId || null;
  const stats = sanitizeStats(legacy.stats);
  const visibility = normalizeSparkVisibility(legacy.visibility || 'public');
  const postStatus = mapLegacyStatusToPostStatus(legacy);
  const processingState = mapLegacyStatusToProcessingState(legacy);
  const subType = legacy.type === 'reel' || legacy.subType === 'reel' ? 'reel' : 'spark';
  const playbackUrl = legacy.videoUrl || (playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null);
  const thumbnailUrl = legacy.thumbnailUrl || (playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null);

  const batch = db.batch();

  const postPayload = {
    authorId: ownerId,
    userId: ownerId,
    authorName,
    authorPhoto,
    authorIsPrivate,
    type: 'video',
    subType,
    title: legacy.title || 'Spark',
    content: legacy.description || legacy.caption || legacy.title || '',
    description: legacy.description || '',
    tags: Array.isArray(legacy.tags) ? legacy.tags : [],
    hashtags: Array.isArray(legacy.hashtags) ? legacy.hashtags : (Array.isArray(legacy.tags) ? legacy.tags : []),
    visibility,
    status: postStatus,
    processingState,
    isDeleted: legacy.isDeleted === true,
    mediaAssetId: legacyId,
    canonicalPostId: candidatePostId,
    muxAssetId: legacy.muxAssetId || null,
    muxPlaybackId: playbackId,
    playbackPolicy: legacy.playbackPolicy || (playbackId ? 'public' : 'signed'),
    videoUrl: playbackUrl,
    thumbnailUrl,
    duration: Number(legacy.duration) || 0,
    aspectRatio: legacy.aspectRatio || null,
    allowDownload: legacy.allowDownload !== false,
    duetEnabled: legacy.duetEnabled !== false,
    stitchEnabled: legacy.stitchEnabled !== false,
    music: legacy.music || null,
    effects: legacy.effects || null,
    chapters: Array.isArray(legacy.chapters) ? legacy.chapters : [],
    monetization: legacy.monetization || { type: 'none' },
    media: [
      {
        type: 'video',
        mediaAssetId: legacyId,
        muxPlaybackId: playbackId,
        url: playbackUrl,
        thumbnailUrl,
        duration: Number(legacy.duration) || 0,
      },
    ],
    stats,
    rankingScore: Number(legacy.rankingScore) || 0,
    viralScore: Number(legacy.viralScore) || 0,
    personalizationScore: existingPostSnap.exists
      ? (existingPostSnap.data().personalizationScore || Number(legacy.rankingScore) || 0)
      : (Number(legacy.rankingScore) || 0),
    createdAt: legacy.createdAt || FieldValue.serverTimestamp(),
    updatedAt: legacy.updatedAt || FieldValue.serverTimestamp(),
    migratedFromVideoId: legacyId,
    migratedAt: FieldValue.serverTimestamp(),
  };

  batch.set(postRef, postPayload, { merge: true });
  batch.set(videoDoc.ref, {
    canonicalPostId: candidatePostId,
    postId: candidatePostId,
    authorId: ownerId,
    migratedToPostAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(mapRef, {
    legacyVideoId: legacyId,
    canonicalPostId: candidatePostId,
    ownerId,
    status: 'migrated',
    migratedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Mirror subcollections idempotently if candidatePostId !== legacyId, OR ensure likes/saves/viewers exist on posts/{candidatePostId}.
  await Promise.all([
    copySubcollectionPaged(videoDoc.ref, postRef, 'likes', (d) => ({
      ...d,
      postId: candidatePostId,
      userId: d.userId,
    })),
    copySubcollectionPaged(videoDoc.ref, postRef, 'saved_by', (d) => ({ ...d })),
    copySubcollectionPaged(videoDoc.ref, postRef, 'viewers', (d) => ({ ...d })),
  ]);

  // If canonicalPostId differs from legacyId, also re-key comments referencing legacyId onto canonicalPostId
  if (candidatePostId !== legacyId) {
    let commentCursor = null;
    for (;;) {
      let cq = db.collection('comments').where('postId', '==', legacyId).orderBy('__name__').limit(200);
      if (commentCursor) cq = cq.startAfter(commentCursor);
      const cSnap = await cq.get();
      if (cSnap.empty) break;
      const cBatch = db.batch();
      cSnap.docs.forEach((cd) => {
        cBatch.update(cd.ref, {
          postId: candidatePostId,
          legacyVideoId: legacyId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await cBatch.commit();
      commentCursor = cSnap.docs[cSnap.docs.length - 1];
      if (cSnap.size < 200) break;
    }
  }

  return {
    legacyId,
    canonicalPostId: candidatePostId,
    status: 'migrated',
  };
}

exports.migrateLegacyVideosToPosts = functions.https.onCall(async (data, context) => {
  const adminUid = await assertAdmin(context);
  const {
    dryRun = false,
    batchSize = 50,
    jobId = 'legacy_videos_to_posts_v1',
    resetCursor = false,
  } = data || {};

  const safeBatchSize = Math.min(Math.max(Number(batchSize) || 50, 1), 200);
  const safeJobId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'legacy_videos_to_posts_v1';
  const checkpointRef = db.collection('migration_checkpoints').doc(safeJobId);

  let lastDocId = null;
  if (!resetCursor) {
    const checkpointSnap = await checkpointRef.get();
    if (checkpointSnap.exists) {
      lastDocId = checkpointSnap.data().lastDocId || null;
    }
  }

  let query = db.collection('videos').orderBy('__name__').limit(safeBatchSize);
  if (lastDocId) {
    const cursorSnap = await db.collection('videos').doc(lastDocId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  if (snap.empty) {
    if (!dryRun) {
      await checkpointRef.set({
        jobId: safeJobId,
        completed: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminUid,
      }, { merge: true });
    }
    return {
      success: true,
      dryRun: Boolean(dryRun),
      processed: 0,
      migrated: 0,
      alreadyMigrated: 0,
      skipped: 0,
      hasMore: false,
      lastDocId,
      results: [],
    };
  }

  const results = [];
  for (const doc of snap.docs) {
    try {
      const res = await migrateSingleLegacyVideo(doc, Boolean(dryRun));
      results.push(res);
    } catch (err) {
      results.push({ legacyId: doc.id, status: 'error', error: err.message });
    }
  }

  const nextCursor = snap.docs[snap.docs.length - 1].id;
  const hasMore = snap.size === safeBatchSize;

  if (!dryRun) {
    await checkpointRef.set({
      jobId: safeJobId,
      lastDocId: nextCursor,
      completed: !hasMore,
      lastRunCount: snap.size,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUid,
    }, { merge: true });
  }

  await writeAudit(
    adminUid,
    'migrate_legacy_videos_to_posts',
    safeJobId,
    {
      dryRun: Boolean(dryRun),
      processed: snap.size,
      lastDocId: nextCursor,
      hasMore,
    },
    'migration',
  );

  return {
    success: true,
    dryRun: Boolean(dryRun),
    processed: snap.size,
    migrated: results.filter((r) => r.status === 'migrated' || r.status === 'would_migrate').length,
    alreadyMigrated: results.filter((r) => r.status === 'already_migrated').length,
    skipped: results.filter((r) => r.status.startsWith('skipped') || r.status === 'error').length,
    hasMore,
    lastDocId: nextCursor,
    results,
  };
});

exports.rollbackLegacyVideoMigration = functions.https.onCall(async (data, context) => {
  const adminUid = await assertAdmin(context);
  const { legacyVideoId, jobId = 'legacy_videos_to_posts_v1' } = data || {};
  if (!legacyVideoId || typeof legacyVideoId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'legacyVideoId is required.');
  }

  const mapRef = db.collection('video_migration_map').doc(legacyVideoId);
  const mapSnap = await mapRef.get();
  if (!mapSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Migration mapping not found.');
  }

  const { canonicalPostId } = mapSnap.data();
  const batch = db.batch();
  if (canonicalPostId) {
    batch.set(db.collection('posts').doc(canonicalPostId), {
      status: 'archived',
      isDeleted: true,
      rolledBackAt: FieldValue.serverTimestamp(),
      rolledBackBy: adminUid,
    }, { merge: true });
  }
  batch.set(db.collection('videos').doc(legacyVideoId), {
    canonicalPostId: FieldValue.delete(),
    migratedToPostAt: FieldValue.delete(),
  }, { merge: true });
  batch.delete(mapRef);
  await batch.commit();

  await writeAudit(
    getUserIdFromContext(context),
    'rollback_legacy_video_migration',
    legacyVideoId,
    { canonicalPostId, jobId },
    'migration',
  );

  return { success: true, legacyVideoId, canonicalPostId };
});
