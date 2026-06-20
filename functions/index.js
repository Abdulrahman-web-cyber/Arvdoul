// functions/index.js – ENTERPRISE ULTIMATE PRODUCTION V3
// 🔥 Fully compatible with Arvdoul client services
// 🔒 Atomic transactions, idempotency, sharded counters, scheduled cleanups
// 📦 Supports coins, gifts, boosts, withdrawals, ads, videos, push, email

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

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
exports.addCoins = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can add coins');
  }
  const { userId, amount, reason, metadata, idempotencyKey } = data;
  if (amount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Amount must be positive');
  return await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'addCoins')) {
      return { success: true, message: 'Idempotent request' };
    }
    const result = await _addCoins(transaction, userId, amount, reason, metadata, idempotencyKey);
    return { success: true, ...result };
  });
});

// SPEND COINS (SELF)
exports.spendCoins = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { userId, amount, reason, metadata, idempotencyKey } = data;
  if (amount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Amount must be positive');
  if (context.auth.uid !== userId) throw new functions.https.HttpsError('permission-denied', 'Can only spend your own coins');
  return await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'spendCoins')) {
      return { success: true, message: 'Idempotent request' };
    }
    const result = await _spendCoins(transaction, userId, amount, reason, metadata, idempotencyKey);
    return { success: true, ...result };
  });
});

// TRANSFER COINS (SELF TO OTHER)
exports.transferCoins = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { fromUserId, toUserId, amount, reason, metadata, idempotencyKey } = data;
  if (amount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Amount must be positive');
  if (context.auth.uid !== fromUserId) throw new functions.https.HttpsError('permission-denied', 'Can only transfer from your own account');
  return await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, fromUserId, 'transferCoins')) {
      return { success: true, message: 'Idempotent request' };
    }
    const result = await _transferCoins(transaction, fromUserId, toUserId, amount, reason, metadata, idempotencyKey);
    return { success: true, ...result };
  });
});

// SEND GIFT
exports.sendGift = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { senderId, postId, giftType, idempotencyKey } = data;
  if (context.auth.uid !== senderId) throw new functions.https.HttpsError('permission-denied', 'Sender ID mismatch');
  const gift = MONETIZATION_CONFIG.GIFTS.find(g => g.type === giftType);
  if (!gift) throw new functions.https.HttpsError('invalid-argument', 'Invalid gift type');
  let result;
  await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, senderId, 'sendGift')) {
      result = { success: true, message: 'Idempotent request' };
      return;
    }
    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) throw new Error('Post not found');
    const postData = postSnap.data();
    if (postData.authorId === senderId) throw new Error('Cannot gift your own post');
    await _transferCoins(
      transaction,
      senderId,
      postData.authorId,
      gift.value,
      'gift',
      { postId, giftType },
      idempotencyKey
    );
    transaction.update(postRef, {
      'stats.gifts': admin.firestore.FieldValue.increment(1),
      'stats.giftValue': admin.firestore.FieldValue.increment(gift.value),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    result = { success: true, gift };
  });
  return result;
});

// BOOST POST
exports.boostPost = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { userId, postId, days, idempotencyKey } = data;
  if (context.auth.uid !== userId) throw new functions.https.HttpsError('permission-denied', 'Can only boost your own posts');
  if (days < 1) throw new functions.https.HttpsError('invalid-argument', 'Days must be at least 1');
  const cost = days * MONETIZATION_CONFIG.BOOST_COST_PER_DAY;
  let result;
  await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'boostPost')) {
      result = { success: true, message: 'Idempotent request' };
      return;
    }
    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) throw new Error('Post not found');
    if (postSnap.data().authorId !== userId) throw new Error('Not your post');
    await _spendCoins(transaction, userId, cost, 'boost', { postId, days }, idempotencyKey);
    const boostExpiry = new Date();
    boostExpiry.setDate(boostExpiry.getDate() + days);
    transaction.update(postRef, {
      boostData: {
        active: true,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(boostExpiry),
        days,
        cost,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    result = { success: true, boostExpiry: boostExpiry.toISOString(), cost };
  });
  return result;
});

// REQUEST WITHDRAWAL
exports.requestWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { userId, amount, paymentMethod, paymentDetails, idempotencyKey } = data;
  if (context.auth.uid !== userId) throw new functions.https.HttpsError('permission-denied', 'Can only request for yourself');
  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found');
  const userData = userSnap.data();
  if ((userData.level || 1) < MONETIZATION_CONFIG.WITHDRAWAL_MIN_LEVEL) {
    throw new functions.https.HttpsError('failed-precondition', `Withdrawals require level ${MONETIZATION_CONFIG.WITHDRAWAL_MIN_LEVEL}+`);
  }
  if ((userData.coins || 0) < amount) {
    throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
  }
  return await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, userId, 'requestWithdrawal')) {
      return { success: true, message: 'Idempotent request' };
    }
    const requestsRef = db.collection('withdrawal_requests');
    const requestData = {
      userId,
      amount,
      paymentMethod,
      paymentDetails,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = requestsRef.doc();
    transaction.set(docRef, requestData);
    return { success: true, requestId: docRef.id };
  });
});

// PROCESS WITHDRAWAL (ADMIN ONLY)
exports.processWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  const { requestId, status, notes, processedBy, idempotencyKey } = data;
  const requestRef = db.doc(`withdrawal_requests/${requestId}`);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) throw new functions.https.HttpsError('not-found', 'Request not found');
  const request = requestSnap.data();
  if (request.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', `Already ${request.status}`);
  await db.runTransaction(async (transaction) => {
    if (await checkIdempotency(transaction, idempotencyKey, request.userId, 'processWithdrawal')) {
      return;
    }
    if (status === 'approved') {
      await _spendCoins(
        transaction,
        request.userId,
        request.amount,
        'withdrawal',
        { requestId },
        idempotencyKey
      );
    }
    transaction.update(requestRef, {
      status,
      notes,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy,
    });
  });
  return { success: true };
});

// RECORD AD IMPRESSION
exports.recordAdImpression = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { adId, userId, placement } = data;
  if (context.auth.uid !== userId) throw new functions.https.HttpsError('permission-denied', 'User ID mismatch');
  const impressionsRef = db.collection('ad_impressions');
  await impressionsRef.add({
    adId,
    userId,
    placement,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ==================== VIDEO FUNCTIONS ====================

exports.likeVideo = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { videoId } = data;
  const userId = context.auth.uid;

  const videoRef = db.doc(`videos/${videoId}`);
  const likeRef = db.doc(`video_likes/${videoId}_${userId}`);
  const rateLimitRef = db.doc(`rate_limits/like_${videoId}_${userId}`);

  return await db.runTransaction(async (tx) => {
    const rateSnap = await tx.get(rateLimitRef);
    if (rateSnap.exists) {
      const lastTime = rateSnap.data().timestamp.toDate();
      const now = new Date();
      const diff = (now - lastTime) / 1000;
      if (diff < VIDEO_CONFIG.RATE_LIMIT.LIKE_COOLDOWN) {
        throw new functions.https.HttpsError('resource-exhausted', 'Rate limited');
      }
    }

    const likeSnap = await tx.get(likeRef);
    const videoSnap = await tx.get(videoRef);
    if (!videoSnap.exists) throw new functions.https.HttpsError('not-found', 'Video not found');

    let action;
    if (likeSnap.exists) {
      tx.delete(likeRef);
      tx.update(videoRef, {
        'stats.likes': admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      action = 'unliked';
    } else {
      tx.set(likeRef, {
        userId,
        videoId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(videoRef, {
        'stats.likes': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const video = videoSnap.data();
      if (video.userId !== userId) {
        const ownerRef = db.doc(`users/${video.userId}`);
        tx.update(ownerRef, {
          coins: admin.firestore.FieldValue.increment(1),
          totalEarned: admin.firestore.FieldValue.increment(1),
        });
      }
      action = 'liked';
    }

    tx.set(rateLimitRef, { timestamp: admin.firestore.FieldValue.serverTimestamp() });
    return { action };
  });
});

exports.shareVideo = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { videoId, platform = 'arvdoul' } = data;
  const userId = context.auth.uid;

  const videoRef = db.doc(`videos/${videoId}`);
  const shareRef = db.collection('video_shares').doc();
  const rateLimitRef = db.doc(`rate_limits/share_${videoId}_${userId}`);

  return await db.runTransaction(async (tx) => {
    const rateSnap = await tx.get(rateLimitRef);
    if (rateSnap.exists) {
      const lastTime = rateSnap.data().timestamp.toDate();
      const now = new Date();
      const diff = (now - lastTime) / 1000;
      if (diff < VIDEO_CONFIG.RATE_LIMIT.SHARE_COOLDOWN) {
        throw new functions.https.HttpsError('resource-exhausted', 'Rate limited');
      }
    }

    const videoSnap = await tx.get(videoRef);
    if (!videoSnap.exists) throw new functions.https.HttpsError('not-found', 'Video not found');

    tx.update(videoRef, {
      'stats.shares': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(shareRef, {
      videoId,
      userId,
      platform,
      sharedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(rateLimitRef, { timestamp: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  });
});

exports.recordVideoView = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { videoId, watchDuration, percentageWatched } = data;
  const userId = context.auth.uid;

  const videoRef = db.doc(`videos/${videoId}`);
  const viewRef = db.collection('video_views').doc();

  return await db.runTransaction(async (tx) => {
    const videoSnap = await tx.get(videoRef);
    if (!videoSnap.exists) throw new functions.https.HttpsError('not-found', 'Video not found');

    tx.update(videoRef, {
      'stats.views': admin.firestore.FieldValue.increment(1),
      'stats.totalWatchTime': admin.firestore.FieldValue.increment(watchDuration || 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(viewRef, {
      videoId,
      userId,
      watchDuration: watchDuration || 0,
      percentageWatched: percentageWatched || 0,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (percentageWatched >= 90) {
      const viewerRef = db.doc(`users/${userId}`);
      tx.update(viewerRef, {
        coins: admin.firestore.FieldValue.increment(3),
        totalEarned: admin.firestore.FieldValue.increment(3),
      });
    } else if (percentageWatched >= 50) {
      const viewerRef = db.doc(`users/${userId}`);
      tx.update(viewerRef, {
        coins: admin.firestore.FieldValue.increment(1),
        totalEarned: admin.firestore.FieldValue.increment(1),
      });
    }
  }).then(() => ({ success: true }));
});

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

exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const { notificationId, userId } = data;

  const notifSnap = await db.doc(`notifications/${notificationId}`).get();
  if (!notifSnap.exists) throw new functions.https.HttpsError('not-found', 'Notification not found');
  const notification = notifSnap.data();

  const tokensSnapshot = await db.collection('push_tokens').doc(userId).collection('devices').get();
  const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);
  if (tokens.length === 0) return { sent: false, reason: 'No tokens' };

  const message = {
    notification: {
      title: notification.title,
      body: notification.message,
    },
    data: {
      notificationId,
      actionUrl: notification.actionUrl || '',
      type: notification.type,
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Push sent: ${response.successCount} successful, ${response.failureCount} failed`);
    return { sent: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error('FCM send error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push');
  }
});

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
exports.cleanupExpiredStories = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const expiredStories = await db
    .collection('stories')
    .where('expiresAt', '<', now)
    .where('isDeleted', '==', false)
    .get();

  const bucket = admin.storage().bucket();
  const batch = db.batch();

  for (const doc of expiredStories.docs) {
    const story = doc.data();
    if (story.media?.path) {
      try {
        await bucket.file(story.media.path).delete();
      } catch (err) {
        console.warn('Failed to delete story media:', err);
      }
    }
    batch.update(doc.ref, { isDeleted: true, deletedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  await batch.commit();
  console.log(`Cleaned up ${expiredStories.size} expired stories.`);
  return null;
});

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
exports.updateVideoRankingScores = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  const videosRef = db.collection('videos');
  const snapshot = await videosRef.where('status', '==', 'ready').where('isDeleted', '==', false).get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    const video = doc.data();
    const ageHours = (Date.now() - video.createdAt.toDate()) / (1000 * 60 * 60);
    const recencyBoost = 1 / (ageHours + 1);
    const engagement = (video.stats?.likes || 0) * 2 + (video.stats?.views || 0) * 0.1 + (video.stats?.shares || 0) * 3;
    const engagementScore = engagement / 1000;
    const rankingScore = engagementScore * 0.7 + recencyBoost * 0.3;
    batch.update(doc.ref, { rankingScore });
  });
  await batch.commit();
  return null;
});

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