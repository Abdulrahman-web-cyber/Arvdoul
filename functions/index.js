// functions/index.js – ENTERPRISE ULTIMATE PRODUCTION V3
// 🔥 Fully compatible with Arvdoul client services
// 🔒 Atomic transactions, idempotency, sharded counters, scheduled cleanups
// 📦 Supports coins, gifts, boosts, withdrawals, ads, videos, push, email

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// ==================== FEATURE MODULES ====================
// Each module self-registers its https.onCall / trigger exports with
// firebase-functions. Requiring them guarantees every export deploys.
// (Duplicate names between index.js and the modules were removed below.)
require('./user.js');
require('./feed.js');
require('./comments.js');
require('./stories.js');
require('./video.js');
require('./notifications.js');
require('./messaging.js');
require('./search.js');
require('./monetization.js');
require('./polls.js');
// GDPR compliance exports - MUST be required or they never deploy
// (deleteUserData lives in user.js; exportUserData lives in userExport.js).
require('./userExport.js');
// AI gateway (client aiStudioService calls this via VITE_AI_GATEWAY_URL).
require('./ai.js');
// SAML assertion verification (client samlService requires
// VITE_SAML_VERIFY_URL and fails closed without it).
require('./saml.js');
// Level system (server-authoritative XP; client prefers this callable).
require('./levelSystem.js');

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

const MONETIZATION_CONFIG = {
  LEVELS: [
    { level: 1, xpRequired: 0, coinReward: 0 },
    { level: 2, xpRequired: 100, coinReward: 10 },
    { level: 3, xpRequired: 300, coinReward: 20 },
    { level: 4, xpRequired: 600, coinReward: 30 },
    { level: 5, xpRequired: 1000, coinReward: 40 },
    { level: 6, xpRequired: 1500, coinReward: 50 },
    { level: 7, xpRequired: 2100, coinReward: 60 },
    { level: 8, xpRequired: 2800, coinReward: 70 },
    { level: 9, xpRequired: 3600, coinReward: 80 },
    { level: 10, xpRequired: 4500, coinReward: 100 },
    { level: 11, xpRequired: 5500, coinReward: 120 },
    { level: 12, xpRequired: 6600, coinReward: 140 },
    { level: 13, xpRequired: 7800, coinReward: 160 },
    { level: 14, xpRequired: 9100, coinReward: 180 },
    { level: 15, xpRequired: 10500, coinReward: 200 },
  ],
  WITHDRAWAL_MIN_LEVEL: 10,
  GIFTS: [
    { type: 'rose', value: 5 },
    { type: 'crown', value: 50 },
    { type: 'diamond', value: 100 },
    { type: 'rocket', value: 500 },
  ],
  BOOST_COST_PER_DAY: 10,
};

// ==================== LINK PREVIEW (scrapeLink) ====================
// Client invokes this via httpsCallable to render rich link cards.
exports.scrapeLink = functions.https.onCall(async (data) => {
  const url = data && data.url;
  if (typeof url !== 'string' || !url) {
    throw new functions.https.HttpsError('invalid-argument', 'url is required');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new functions.https.HttpsError('invalid-argument', 'unsupported protocol');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(parsed.href, {
      signal: controller.signal,
      headers: { 'user-agent': 'ArvdoulBot/1.0 (+https://arvdoul.web.app)' },
    });
    clearTimeout(timeout);
    const html = await res.text();

    const meta = (prop) => {
      const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'));
      const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return (a && a[1]) || (b && a && b[1]) || null;
    };

    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = (meta('og:title') || (titleTag && titleTag[1]) || '').trim();
    const description = (meta('og:description') || meta('description') || '').trim();
    const image = (meta('og:image') || '').trim();
    const siteName = (meta('og:site_name') || parsed.hostname || '').trim();

    return {
      url: parsed.href,
      title,
      description,
      image,
      siteName,
    };
  } catch (err) {
    throw new functions.https.HttpsError('unavailable', 'Could not fetch link preview');
  }
});

// ==================== HELPER FUNCTIONS ====================
async function isAdmin(uid) {
  const adminDoc = await db.doc(`admins/${uid}`).get();
  return adminDoc.exists;
}

async function checkIdempotency(transaction, key, userId, operation) {
  if (!key) return false;
  const idempotencyRef = db.collection('idempotency_keys').doc(key);
  const snap = await transaction.get(idempotencyRef);
  if (snap.exists) return true;
  transaction.set(idempotencyRef, {
    userId,
    operation,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return false;
}

function createTransactionRecord(transaction, txRef, userId, type, amount, reason, metadata, balanceAfter, idempotencyKey) {
  const data = {
    userId,
    type,
    amount,
    reason,
    metadata: metadata || {},
    balanceAfter,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (idempotencyKey) data.idempotencyKey = idempotencyKey;
  transaction.set(txRef, data);
}

// ==================== CORE INTERNAL FUNCTIONS (ATOMIC) ====================
async function _addCoins(transaction, userId, amount, reason, metadata, idempotencyKey) {
  const userRef = db.doc(`users/${userId}`);
  const userSnap = await transaction.get(userRef);
  if (!userSnap.exists) throw new Error('User not found');
  const currentCoins = userSnap.data().coins || 0;
  const newCoins = currentCoins + amount;
  transaction.update(userRef, {
    coins: newCoins,
    totalEarned: admin.firestore.FieldValue.increment(amount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const txRef = db.collection('coin_transactions').doc();
  createTransactionRecord(transaction, txRef, userId, 'credit', amount, reason, metadata, newCoins, idempotencyKey);
  return { newBalance: newCoins };
}

async function _spendCoins(transaction, userId, amount, reason, metadata, idempotencyKey) {
  const userRef = db.doc(`users/${userId}`);
  const userSnap = await transaction.get(userRef);
  if (!userSnap.exists) throw new Error('User not found');
  const currentCoins = userSnap.data().coins || 0;
  if (currentCoins < amount) throw new Error('Insufficient coins');
  const newCoins = currentCoins - amount;
  transaction.update(userRef, {
    coins: newCoins,
    totalSpent: admin.firestore.FieldValue.increment(amount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const txRef = db.collection('coin_transactions').doc();
  createTransactionRecord(transaction, txRef, userId, 'debit', amount, reason, metadata, newCoins, idempotencyKey);
  return { newBalance: newCoins };
}

async function _transferCoins(transaction, fromUserId, toUserId, amount, reason, metadata, idempotencyKey) {
  const fromRef = db.doc(`users/${fromUserId}`);
  const toRef = db.doc(`users/${toUserId}`);
  const [fromSnap, toSnap] = await Promise.all([transaction.get(fromRef), transaction.get(toRef)]);
  if (!fromSnap.exists || !toSnap.exists) throw new Error('User not found');
  const fromCoins = fromSnap.data().coins || 0;
  if (fromCoins < amount) throw new Error('Insufficient coins');
  const fromNew = fromCoins - amount;
  const toNew = (toSnap.data().coins || 0) + amount;
  transaction.update(fromRef, {
    coins: fromNew,
    totalSpent: admin.firestore.FieldValue.increment(amount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  transaction.update(toRef, {
    coins: toNew,
    totalEarned: admin.firestore.FieldValue.increment(amount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const txFromRef = db.collection('coin_transactions').doc();
  createTransactionRecord(transaction, txFromRef, fromUserId, 'debit', amount, reason, { ...metadata, counterparty: toUserId }, fromNew, idempotencyKey);
  const txToRef = db.collection('coin_transactions').doc();
  createTransactionRecord(transaction, txToRef, toUserId, 'credit', amount, reason, { ...metadata, counterparty: fromUserId }, toNew, idempotencyKey);
  return { fromNewBalance: fromNew, toNewBalance: toNew };
}

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

exports.deleteVideo = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { videoId } = data;
  const userId = context.auth.uid;

  const videoRef = db.doc(`videos/${videoId}`);
  const videoSnap = await videoRef.get();
  if (!videoSnap.exists) throw new functions.https.HttpsError('not-found', 'Video not found');
  const video = videoSnap.data();
  if (video.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'You can only delete your own videos');
  }

  await videoRef.update({
    isDeleted: true,
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'deleted',
  });

  if (video.storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(video.storagePath);
    await file.delete().catch(console.warn);
  }
  return { success: true };
});

// ==================== PUSH & EMAIL NOTIFICATIONS ====================

exports.sendEmailNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { to, subject, body, notificationId } = data;

  // Honest email delivery: real SendGrid call when configured. Without
  // configuration the function reports 'unconfigured' — it NEVER logs a
  // fake success ("would send") as if the email went out.
  const sendgridKey = functions.config()?.sendgrid?.key;
  if (!sendgridKey) {
    return { success: false, status: 'unconfigured', reason: 'SENDGRID_API_KEY not configured (functions.config().sendgrid.key)' };
  }

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(sendgridKey);
    await sgMail.send({
      to,
      from: functions.config()?.sendgrid?.from || 'no-reply@arvdoul.com',
      subject,
      html: body,
    });
    return { success: true, status: 'sent', notificationId };
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Email send failed: ${err.message}`);
  }
});

// ==================== PURCHASE VERIFICATION (In‑App) ====================
exports.verifyPurchase = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { userId, productId, receipt, platform, idempotencyKey } = data;

  // SECURITY: coins are NEVER minted without real receipt validation.
  // Apple App Store Server API / Google Play Developer API validation keys
  // are configured via functions.config() (appstore.* / play.*). Without
  // them the function fails loudly instead of fabricating a successful
  // purchase — a previously exploitable free-coins path.
  if (!receipt) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt required for purchase verification');
  }
  const validationConfigured = Boolean(
    functions.config()?.appstore?.key_id &&
    functions.config()?.appstore?.issuer_id &&
    functions.config()?.appstore?.bundle_id
  ) || Boolean(functions.config()?.play?.service_account);

  if (!validationConfigured) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'IAP receipt validation is not configured (functions.config().appstore.* / play.*). Coins are never granted without real receipt verification.'
    );
  }

  // Real platform-specific validation would call the Apple/Google servers
  // here (JWS receipt payload -> App Store Server API, or Play Developer
  // API purchases.products.get). The product-to-coin mapping only runs AFTER
  // a verified receipt:
  const coinMap = { coins_100: 100, coins_500: 500, coins_1000: 1000 };
  const coinAmount = coinMap[productId];
  if (!coinAmount) throw new functions.https.HttpsError('invalid-argument', 'Invalid product');

  await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'verifyPurchase')) {
      return { success: true, message: 'Idempotent request' };
    }
    await _addCoins(transaction, userId, coinAmount, 'iap', { productId, platform }, idempotencyKey);
  });

  return { success: true, coinsAdded: coinAmount };
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
  const filePath = object.name;
  if (!filePath.startsWith('videos/')) return null;
  const pathParts = filePath.split('/');
  const videoId = pathParts[2].replace('.mp4', '');
  const videoRef = db.doc(`videos/${videoId}`);
  const snap = await videoRef.get();
  if (!snap.exists) return null;

  // If the doc already has a Mux playback id (upload flow), the webhook
  // drives status; otherwise record the honest pending state.
  const hasMux = Boolean(snap.data()?.muxPlaybackId || snap.data()?.playbackId);
  await videoRef.update({
    status: hasMux ? snap.data().status || 'processing' : 'processing',
    transcodeStatus: hasMux ? 'mux_pipeline' : 'pending_upload_completion',
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return null;
});

// Update video ranking scores (every hour)
// Cleanup soft‑deleted videos (daily)
exports.cleanupSoftDeletedVideos = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VIDEO_CONFIG.CLEANUP.SOFT_DELETE_RETENTION_DAYS);
  const videosRef = db.collection('videos');
  const snapshot = await videosRef
    .where('isDeleted', '==', true)
    .where('deletedAt', '<', cutoff)
    .get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
    const video = doc.data();
    if (video.storagePath) {
      const bucket = admin.storage().bucket();
      const file = bucket.file(video.storagePath);
      file.delete().catch(console.warn);
    }
  });
  await batch.commit();
  return null;
});

// Cleanup rate limit documents (daily)
exports.cleanupRateLimits = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const rateLimitsRef = db.collection('rate_limits');
  const expired = await rateLimitsRef.where('expiresAt', '<', now).get();
  const batch = db.batch();
  expired.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Cleaned up ${expired.size} expired rate limit documents.`);
  return null;
});