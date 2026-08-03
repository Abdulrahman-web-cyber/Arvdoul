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

  // 🔁 Replace with your actual email sending logic (SendGrid, AWS SES, etc.)
  console.log(`[EMAIL] Would send to ${to}: subject="${subject}" body="${body}" (notificationId=${notificationId})`);

  // For production, integrate with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(functions.config().sendgrid.key);
  // await sgMail.send({ to, from: 'no-reply@arvdoul.com', subject, html: body });

  return { success: true, mock: true };
});

// ==================== PURCHASE VERIFICATION (In‑App) ====================
exports.verifyPurchase = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { userId, productId, receipt, platform, idempotencyKey } = data;

  // 🔁 Implement real validation for Apple/Google receipts
  console.log(`[PURCHASE] Verifying purchase for user ${userId}, product ${productId}, platform ${platform}`);

  // Example: Validate receipt with Apple/Google servers, then award coins
  // For now, we'll just simulate success and award coins.
  let coinAmount = 0;
  switch (productId) {
    case 'coins_100': coinAmount = 100; break;
    case 'coins_500': coinAmount = 500; break;
    case 'coins_1000': coinAmount = 1000; break;
    default: throw new functions.https.HttpsError('invalid-argument', 'Invalid product');
  }

  await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'verifyPurchase')) {
      return { success: true, message: 'Idempotent request' };
    }
    await _addCoins(transaction, userId, coinAmount, 'iap', { productId, platform }, idempotencyKey);
  });

  return { success: true, coinsAdded: coinAmount };
});

// ==================== SCHEDULED FUNCTIONS ====================

// Award coins when a notification is read (trigger)
exports.awardCoinsOnNotificationRead = functions.firestore
  .document('notifications/{notificationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before.isRead && after.isRead && !after.coinsAwarded) {
      const userId = after.recipientId;
      const userRef = db.doc(`users/${userId}`);
      await userRef.update({
        coins: admin.firestore.FieldValue.increment(1),
        totalEarned: admin.firestore.FieldValue.increment(1),
      });
      await change.after.ref.update({ coinsAwarded: true });
    }
    return null;
  });

// Cleanup expired stories (every hour)
// Process video after upload (placeholder – use Cloud Run for real transcoding)
exports.processVideo = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  if (!filePath.startsWith('videos/')) return null;
  const pathParts = filePath.split('/');
  const videoId = pathParts[2].replace('.mp4', '');
  const videoRef = db.doc(`videos/${videoId}`);
  await new Promise(resolve => setTimeout(resolve, 5000)); // simulate processing
  await videoRef.update({
    status: 'ready',
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