// functions/index.js — Cloud Functions entry point
//
// Loads every feature module so their exports are registered for deploy.
// Covers coins, gifts, boosts, withdrawals, ads, videos, push, and email.

const functions = require('firebase-functions');
const { logger } = require('./logger');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const dns = require('node:dns');
const { checkRateLimit } = require('./rateLimit');
const { assertAdmin, getUserEmail, getRuntimeConfig } = require('./auth');

// ==================== FEATURE MODULES ====================
// Each module self-registers its https.onCall / trigger exports with
// firebase-functions. `require`-ing them only guarantees the module body runs;
// it does NOT publish their functions. Firebase deploys whatever this file
// exports, so every module's exports must be merged onto `exports` or the
// function is built and never deployed. Requiring without merging silently
// dropped ~130 of ~141 functions (only the 11 defined below deployed);
// src/__tests__/deployIntegrity.test.js guards this.
const merge = (mod) => {
  for (const [name, value] of Object.entries(mod)) {
    // Only real callable/trigger exports become deployed functions; plain
    // helpers (e.g. auth.js's assertAdmin) are skipped.
    if (typeof value === 'function' && (value.__trigger || value.__endpoint)) {
      exports[name] = value;
    }
  }
};

merge(require('./user.js'));
merge(require('./feed.js'));
merge(require('./comments.js'));
merge(require('./stories.js'));
merge(require('./video.js'));
merge(require('./videoMigration.js'));
// Live-stream aggregates (viewer totals) — derived server-side because the
// parent `live_streams` doc is owner-write-only and a viewer's client cannot
// maintain it.
merge(require('./live.js'));
merge(require('./notifications.js'));
merge(require('./messaging.js'));
merge(require('./calls.js'));
merge(require('./search.js'));
merge(require('./monetization.js'));
merge(require('./polls.js'));
// Q&A: post-embedded questions/answers (server-authoritative answer votes and
// the question author's accept-best decision).
merge(require('./questions.js'));
// GDPR compliance exports - MUST be merged or they never deploy
// (deleteUserData lives in user.js; exportUserData lives in userExport.js).
merge(require('./userExport.js'));
// AI gateway (client aiStudioService calls this via VITE_AI_GATEWAY_URL).
merge(require('./ai.js'));
// SAML assertion verification (server-only; a browser cannot validate a SAML
// assertion, so there is no client samlService — the app fails closed without it).
merge(require('./saml.js'));
// Level system (server-authoritative XP; client prefers this callable).
merge(require('./levelSystem.js'));
// Moderation, reporting, AI authoring and post-performance prediction.
merge(require('./moderation.js'));
// Server-authoritative feature-flag governance (platform-wide kill switches).
merge(require('./featureFlags.js'));
// Server-authoritative admin actions (ban/suspend/verify, user directory,
// report resolution). The client never writes privileged user fields directly.
merge(require('./admin.js'));
// auth.js / pushQueue.js are helper-only modules (no triggers); requiring them
// registers nothing, but their side effects (queue config) are still loaded.
require('./auth.js');
require('./pushQueue.js');
// Server-authoritative profile view analytics (trackProfileView callable).
merge(require('./analytics.js'));
// Authoritative post engagement counters (shard reader + scheduled mirror).
// The scheduled `aggregatePostCounters` writes the sharded like/comment/share/
// save sums back onto `posts/{postId}.stats` so ranking/search read real values
// instead of the never-written seeded zeros (N433).
merge(require('./postCounters.js'));
// PII boundary backfill: moves legacy contact/verification/Stripe fields off
// the world-readable users/{uid} doc into users_private/{uid}.
merge(require('./privacyMigration.js'));
// Keeps the denormalised posts.authorIsPrivate flag in step with the author's
// privacy (the post read rule gates a private account's content on it).
merge(require('./privacyPropagation.js'));
// Server-authoritative community mutations (create/join/leave/roles/spaces/
// moderation). The community document's members map and derived counters are
// privilege data, so the client never writes it directly.
merge(require('./communities.js'));
// Server-authoritative event participation (registration/waitlist/check-in/
// feedback). The rule only lets the organizer update the event document, so
// these cross-user mutations must go through callables.
merge(require('./events.js'));
// Community `stats.eventCount` trigger (N434): the community document is
// server-write-only, so the derived "Events" counter must be maintained here
// (a client cannot write it). Counts published/open/live/ended events only.
merge(require('./eventCounters.js'));
// Community `stats.postCount`/`stats.activityScore` trigger (N451): the
// community document is server-write-only, so the derived "Posts" counter must
// be maintained here. A net-delta trigger on posts/{postId} counts a live
// published community post (+1) and decrements on delete/unpublish (-1), plus a
// reconciliation job for pre-trigger drift. Previously only the create callable
// incremented the counters and nothing decremented them.
merge(require('./communityPostCounters.js'));
// Server-authoritative collaboration projects (team roles, content versions,
// review/publish). Membership is privilege data; the client never writes the
// project document or its team/content subcollections.
merge(require('./collaboration.js'));
// Server-authoritative Advertising Center (ad accounts, billing ledger,
// Spark post-preserve campaigns, moderation reviews & disputes).
merge(require('./advertising.js'));
// Scheduled-post publisher: the composer writes `status: 'scheduled'` with a
// future `scheduledTime`; this scheduled job is the only writer that flips a
// due post to `published` (otherwise a scheduled post never surfaces anywhere).
merge(require('./scheduledPosts.js'));
// Sharded-counter reader + mirror (N431). The scheduled job writes the summed
// follower/following shards back onto `users/{uid}` so every reader that trusts
// the raw field (search index, profile hydration, ranking) sees a real number.
// `readUserCounter` is a plain helper required in-process by the fan-out
// threshold decisions.
merge(require('./userCounters.js'));

// ==================== CONFIGURATION ====================
const VIDEO_CONFIG = {
  RATE_LIMIT: {
    LIKE_COOLDOWN: 60,
    SHARE_COOLDOWN: 30,
  },
  PERFORMANCE: {
    SIGNED_URL_EXPIRY: 3600,
  },
  CLEANUP: {
    SOFT_DELETE_RETENTION_DAYS: 30,
  },
};


// ==================== LINK PREVIEW (scrapeLink) ====================
// Client invokes this via httpsCallable to render rich link cards.
// Blocks loopback, link-local (incl. cloud metadata 169.254.169.254),
// private RFC1918 ranges and IPv6 equivalents. An unauthenticated callable
// that fetches a caller-supplied URL is an SSRF primitive otherwise.
const BLOCKED_HOST_RE = /^(localhost|\.local|.*\.local|.*\.internal)$/i;

function isPrivateIp(ip) {
  if (!ip) return true;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true;
  if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7));
  return false;
}

async function assertPublicUrl(parsed) {
  const host = parsed.hostname;
  if (BLOCKED_HOST_RE.test(host) || isPrivateIp(host)) {
    throw new functions.https.HttpsError('invalid-argument', 'Blocked host');
  }
  let addrs;
  try {
    addrs = await dns.promises.lookup(host, { all: true });
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', 'Unresolvable host');
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new functions.https.HttpsError('invalid-argument', 'Blocked host');
  }
}

// Follow redirects by hand so every hop is re-validated; `redirect: 'follow'`
// would let a public URL bounce to 169.254.169.254.
async function safeFetch(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop <= 3; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new functions.https.HttpsError('invalid-argument', 'unsupported protocol');
    }
    await assertPublicUrl(parsed);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let res;
    try {
      res = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'ArvdoulBot/1.0 (+https://arvdoul.web.app)' },
      });
    } finally {
      clearTimeout(timeout);
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).href;
      continue;
    }
    return res;
  }
  throw new functions.https.HttpsError('unavailable', 'Too many redirects');
}

async function readCapped(res, maxBytes) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    return (await res.text()).slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    chunks.push(value);
  }
  try { await reader.cancel(); } catch (_) { /* already closed */ }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8').slice(0, maxBytes);
}

function extractMeta(html, prop) {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return (a && a[1]) || (b && b[1]) || null;
}

function buildLinkPreview(html, parsed) {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    url: parsed.href,
    title: (extractMeta(html, 'og:title') || (titleTag && titleTag[1]) || '').trim(),
    description: (extractMeta(html, 'og:description') || extractMeta(html, 'description') || '').trim(),
    image: (extractMeta(html, 'og:image') || '').trim(),
    siteName: (extractMeta(html, 'og:site_name') || parsed.hostname || '').trim(),
  };
}

function parseHttpUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new functions.https.HttpsError('invalid-argument', 'unsupported protocol');
  }
  return parsed;
}

exports.scrapeLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  await checkRateLimit(context.auth.uid, 'scrapeLink', 30, 60000);

  const url = data && data.url;
  if (typeof url !== 'string' || !url) {
    throw new functions.https.HttpsError('invalid-argument', 'url is required');
  }
  const parsed = parseHttpUrl(url);

  try {
    const res = await safeFetch(parsed.href);
    if (!res.ok) {
      throw new functions.https.HttpsError('unavailable', 'Could not fetch link preview');
    }
    return buildLinkPreview(await readCapped(res, 512 * 1024), parsed);
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('unavailable', 'Could not fetch link preview');
  }
});

// ==================== CALLABLE FUNCTIONS ====================

// ADD COINS (ADMIN ONLY)
// SPEND COINS (SELF)
// TRANSFER COINS (SELF TO OTHER)
// SEND GIFT
// BOOST POST
// REQUEST WITHDRAWAL
// PROCESS WITHDRAWAL (ADMIN ONLY)
// RECORD AD IMPRESSION
// ==================== VIDEO FUNCTIONS ====================

exports.generateSignedUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { storagePath } = data;
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new functions.https.HttpsError('not-found', 'File not found');
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + VIDEO_CONFIG.PERFORMANCE.SIGNED_URL_EXPIRY * 1000,
  });
  return { signedUrl };
});

// deleteVideo is exported cleanly by functions/video.js (unified canonical posts + videos soft-delete + Mux/Storage cleanup).

// ==================== PUSH & EMAIL NOTIFICATIONS ====================

exports.sendEmailNotification = functions.https.onCall(async (data, context) => {
  // Admin-only: this is a server-side transactional-email primitive. An
  // authenticated-but-unprivileged caller could otherwise use it as an open
  // relay to send arbitrary HTML to any address from the Arvdoul domain.
  const uid = await assertAdmin(context);
  const { subject, body, notificationId } = data;

  // The recipient is derived server-side from the caller's own verified
  // account (or an explicit `to` an admin supplies for support flows) — never
  // an arbitrary client-chosen address.
  const to = data.to || (await getUserEmail(uid));
  if (!to) throw new functions.https.HttpsError('failed-precondition', 'No recipient email on file.');

  // Honest email delivery: real SendGrid call when configured. Without
  // configuration the function reports 'unconfigured' — it NEVER logs a
  // fake success ("would send") as if the email went out.
  const sendgridKey = getRuntimeConfig('SENDGRID_API_KEY', 'sendgrid.key');
  if (!sendgridKey) {
    return { success: false, status: 'unconfigured', reason: 'SENDGRID_API_KEY not configured' };
  }

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(sendgridKey);
    await sgMail.send({
      to,
      from: getRuntimeConfig('SENDGRID_FROM', 'sendgrid.from', 'no-reply@arvdoul.com'),
      subject,
      html: body,
    });
    return { success: true, status: 'sent', notificationId };
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Email send failed: ${err.message}`);
  }
});

// ==================== SCHEDULED FUNCTIONS ====================

// Notification read tracking. REMOVED: the previous trigger minted 1 coin
// per notification read (unbounded, ledger-free) — an exploitable coin
// faucet. Coins are only ever minted through the double-entry ledger in
// functions/monetization.js. Reading notifications now just records the
// read state (client-driven via markNotificationRead).
exports.awardCoinsOnNotificationRead = functions.firestore
  .document('notifications/{notificationId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before.isRead && after.isRead && !after.coinsAwarded) {
      await change.after.ref.update({ coinsAwarded: false });
    }
    return null;
  });

// Cleanup expired stories (every hour)
// Storage-finalize hook: HONEST processing state. Real transcoding happens
// via the Mux pipeline (functions/video.js handleMuxWebhook) — this trigger
// never fabricates 'ready' (previously it slept 5s and marked the video
// ready with no processing having occurred).
exports.processVideo = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name || '';
  if (!filePath.startsWith('videos/') && !filePath.startsWith('posts/')) return null;
  const pathParts = filePath.split('/').filter(Boolean);
  const rawName = pathParts[pathParts.length - 1] || '';
  const candidateId = (pathParts[2] || rawName).replace(/\.[^.]+$/, '');
  if (!candidateId) return null;

  const videoRef = db.doc(`videos/${candidateId}`);
  const postRef = db.doc(`posts/${candidateId}`);
  const [videoSnap, postSnap] = await Promise.all([
    videoRef.get().catch(() => null),
    postRef.get().catch(() => null),
  ]);

  const updates = [];
  if (videoSnap && videoSnap.exists) {
    const hasMux = Boolean(videoSnap.data()?.muxPlaybackId || videoSnap.data()?.playbackId);
    updates.push(videoRef.update({
      status: hasMux ? videoSnap.data().status || 'processing' : 'processing',
      transcodeStatus: hasMux ? 'mux_pipeline' : 'pending_upload_completion',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
  }
  if (postSnap && postSnap.exists && postSnap.data()?.type === 'video') {
    const hasMux = Boolean(postSnap.data()?.muxPlaybackId || postSnap.data()?.playbackId);
    updates.push(postRef.update({
      status: hasMux ? postSnap.data().status || 'processing' : 'processing',
      transcodeStatus: hasMux ? 'mux_pipeline' : 'pending_upload_completion',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
  }
  if (updates.length) await Promise.all(updates);
  return null;
});

// Update video ranking scores (every hour)
// Cleanup soft‑deleted videos (daily)
exports.cleanupSoftDeletedVideos = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VIDEO_CONFIG.CLEANUP.SOFT_DELETE_RETENTION_DAYS);
  const videosRef = db.collection('videos');
  const bucket = admin.storage().bucket();
  // Page with a bounded batch: the old version did one unbounded `.get()` and a
  // single batch delete, which throws (>500 ops) once more than 500 videos have
  // aged past retention — the cleanup silently failed and the backlog grew.
  let deleted = 0;
  for (;;) {
    const snapshot = await videosRef
      .where('isDeleted', '==', true)
      .where('deletedAt', '<', cutoff)
      .limit(400)
      .get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      const video = doc.data();
      if (video.storagePath) {
        bucket.file(video.storagePath).delete().catch(() => {});
      }
    });
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < 400) break;
  }
  if (deleted) logger.info('Cleaned up soft-deleted videos', { count: deleted });
  return null;
});

// Cleanup rate limit documents (daily)
//
// The flat `rate_limits` collection accumulates one parent doc per
// (user × action) from the shared sharded limiter (`rateLimit.js`, which stamps
// `expireAt`) and one doc per window from `messagesService._recordRateLimit`
// (which stamps `expiresAt`). The old query filtered on `expiresAt` ONLY, so it
// never matched the shared limiter's docs — the collection grew unbounded. It
// was also an unbounded `.get()` with a single >500-op batch. Query both field
// names (single-field indexes are automatic) and page with a bounded batch.
exports.cleanupRateLimits = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const rateLimitsRef = db.collection('rate_limits');
  let deleted = 0;
  for (const field of ['expireAt', 'expiresAt']) {
    for (;;) {
      const expired = await rateLimitsRef.where(field, '<', now).limit(400).get();
      if (expired.empty) break;
      const batch = db.batch();
      expired.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += expired.size;
      if (expired.size < 400) break;
    }
  }
  logger.info('Cleaned up expired rate limit documents', { count: deleted });
  return null;
});

// Health Check endpoint for Uptime monitoring & external probes.
// Reports live probe results, never a canned "all operational": Firestore is
// actually read and each service reflects the outcome.
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const probeStart = Date.now();
  let firestoreStatus = 'operational';
  try {
    await db.collection('system_health').limit(1).get();
  } catch (err) {
    firestoreStatus = 'degraded';
  }
  const firestore = firestoreStatus;
  const overall = firestoreStatus === 'operational' ? 'ok' : 'degraded';
  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || require('./package.json').version,
    probeLatencyMs: Date.now() - probeStart,
    services: {
      firestore,
      // Storage/Auth share the same Admin SDK credentials; a live Firestore
      // read confirms the credential chain is intact.
      storage: firestoreStatus,
      auth: firestoreStatus,
    },
  });
});

// System Metrics endpoint for Prometheus / Datadog scraping
exports.systemMetrics = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const memUsage = process.memoryUsage();
    res.status(200).json({
      status: 'healthy',
      timestamp: Date.now(),
      memory: {
        heapUsedMb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMb: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        rssMb: (memUsage.rss / 1024 / 1024).toFixed(2),
      },
      environment: process.env.NODE_ENV || 'production',
      nodeVersion: process.version,
      version: process.env.npm_package_version || require('./package.json').version,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});
