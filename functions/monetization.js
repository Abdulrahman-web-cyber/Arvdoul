// functions/monetization.js — monetization engine
//
// Double-entry ledger, wallet locking, sharded rate limiting, and idempotent
// Stripe payouts behind a distributed lock. Cloud Tasks push with retry
// config, velocity and new-account abuse detection, self-gift / collusion
// detection, an incremental O(1) coin-supply aggregate, scheduled coin audit
// via counter diff, stuck-lock recovery, and a Stripe webhook for
// subscription events.
//
// Required composite indexes (create in Firebase Console):
// ads: active ASC, startDate ASC, endDate ASC, placements ARRAY, priority DESC
// coin_transactions: userId ASC, createdAt DESC
// ledger_entries: debitAccount ASC, creditAccount ASC, createdAt DESC
// withdrawal_requests: status ASC, createdAt ASC
// ad_impressions: userId ASC, timestamp ASC
// fraud_limits: __system__ TTL field = expireAt
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const { enqueuePush } = require('./pushQueue');
const { getUserIdFromContext, getUserEmail } = require('./auth');
const { settleWithdrawal } = require('./withdrawalSettlement');

// ----------------------------------------------------------------------
// CONSTANTS & ENVIRONMENT CONFIG
// ----------------------------------------------------------------------
const MAX_COIN_OPERATION = functions.config().monetization?.max_coin_operation || 10000;
const WITHDRAWAL_COOLDOWN_MS = (functions.config().monetization?.withdrawal_cooldown_hours || 24) * 3600000;
const MAX_DAILY_WITHDRAWAL_REQUESTS = functions.config().monetization?.max_daily_withdrawal_requests || 3;
const MANUAL_REVIEW_THRESHOLD = functions.config().monetization?.manual_review_threshold || 50000;
const SUSPICIOUS_NEW_ACCOUNT_HOURS = 24;
const GIFT_SELF_SEND_FLAG = true;
const COINS_PER_DOLLAR = functions.config().monetization?.coins_per_dollar || require('./levelConfig.cjs').COINS_PER_DOLLAR;
const MIN_WITHDRAWAL_COINS = functions.config().monetization?.min_withdrawal_coins || require('./levelConfig.cjs').MIN_WITHDRAWAL_COINS;
const NUM_RATE_SHARDS = 10; // increased from 3 for higher throughput

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------
const generateIdempotencyKey = (providedKey) =>
  (providedKey && typeof providedKey === 'string' && providedKey.length > 0) ? providedKey : uuidv4();

const createFirestoreTransaction = async (updateFn, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await admin.firestore().runTransaction(updateFn);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Transaction retry ${attempt}`, error.message);
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
    }
  }
};

const logEvent = (type, data) =>
  console.log(JSON.stringify({ severity: 'INFO', type, ...data, timestamp: new Date().toISOString() }));

const handleError = (err) => {
  if (err instanceof functions.https.HttpsError) return err;
  console.error('Unhandled error:', err);
  return new functions.https.HttpsError('internal', err.message || 'Unexpected error');
};

/** Double‑entry ledger: creates two immutable ledger entries (one debit, one credit). */
const createLedgerEntry = (transaction, debitAccount, creditAccount, amount, metadata = {}) => {
  const entriesRef = admin.firestore().collection('ledger_entries');
  const entryId = uuidv4();
  const base = {
    amount,
    metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    transactionId: metadata.transactionId || null,
  };
  transaction.set(entriesRef.doc(`${entryId}_debit`), {
    ...base,
    account: debitAccount,
    type: 'debit',
    linkedEntryId: entryId,
  });
  transaction.set(entriesRef.doc(`${entryId}_credit`), {
    ...base,
    account: creditAccount,
    type: 'credit',
    linkedEntryId: entryId,
  });
};

// ----------------------------------------------------------------------
// SHARDED RATE LIMITER – globally accurate by aggregating all shards
// ----------------------------------------------------------------------
const { checkRateLimit } = require('./rateLimit');
const { LEVEL_GATES } = require('./levelConfig.cjs');

// ----------------------------------------------------------------------
// FRAUD PROTECTION – daily velocity, new account, interaction pairs
// ----------------------------------------------------------------------
const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const enforceDailyLimit = async (userId, amount, type, limit) => {
  const today = getTodayKey();
  const docRef = admin.firestore().collection('fraud_limits').doc(`${userId}_${today}`);
  await admin.firestore().runTransaction(async (t) => {
    const snap = await t.get(docRef);
    const current = snap.exists ? (snap.data()[`${type}Total`] || 0) : 0;
    if (current + amount > limit) {
      throw new functions.https.HttpsError('resource-exhausted', `Daily ${type} limit exceeded.`);
    }
    t.set(docRef, {
      [`${type}Total`]: admin.firestore.FieldValue.increment(amount),
      expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    }, { merge: true });
  });
};

const flagSuspiciousActivity = async (userId, amount, reason) => {
  await admin.firestore().collection('fraud_flags').add({
    userId,
    amount,
    reason,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const checkNewAccountAbuse = async (userId, amount) => {
  if (amount < 5000) return;
  try {
    const userSnap = await admin.firestore().collection('users').doc(userId).get();
    if (!userSnap.exists) return;
    const createdAt = userSnap.data().createdAt;
    if (!createdAt) return;
    const accountAgeMs = Date.now() - createdAt.toMillis();
    if (accountAgeMs < SUSPICIOUS_NEW_ACCOUNT_HOURS * 3600000) {
      await flagSuspiciousActivity(userId, amount,
        `High-value operation from account younger than ${SUSPICIOUS_NEW_ACCOUNT_HOURS}h`);
    }
  } catch (e) {
    console.warn('New account abuse check failed', e);
  }
};

const checkMutualTransfer = async (senderUid, receiverUid, amount) => {
  if (senderUid === receiverUid) return;
  const key = [senderUid, receiverUid].sort().join('_');
  const docRef = admin.firestore().collection('fraud_interactions').doc(key);
  await admin.firestore().runTransaction(async (t) => {
    const snap = await t.get(docRef);
    const data = snap.exists ? snap.data() : { totalAmount: 0, count: 0, lastTs: 0 };
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (data.lastTs < oneHourAgo) {
      t.set(docRef, {
        totalAmount: amount,
        count: 1,
        lastTs: Date.now(),
        firstTs: Date.now(),
        expireAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      }, { merge: true });
      return;
    }
    const newTotal = data.totalAmount + amount;
    const newCount = data.count + 1;
    if (newTotal > 50000 || newCount > 5) {
      await flagSuspiciousActivity(senderUid, amount,
        `Suspicious mutual transfer pair with ${receiverUid}: total ${newTotal}, count ${newCount}`);
      await flagSuspiciousActivity(receiverUid, amount,
        `Suspicious mutual transfer pair with ${senderUid}: total ${newTotal}, count ${newCount}`);
    }
    t.set(docRef, {
      totalAmount: newTotal,
      count: newCount,
      lastTs: Date.now(),
      expireAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    }, { merge: true });
  });
};

// ----------------------------------------------------------------------
// WALLET LOCKING HELPERS
// ----------------------------------------------------------------------
const getAvailableBalance = (userData) => {
  return (userData.coins || 0) - (userData.lockedCoins || 0);
};

// ----------------------------------------------------------------------
// ENVIRONMENT & STRIPE
// ----------------------------------------------------------------------
const stripe = new Stripe(functions.config().stripe?.secret_key, { apiVersion: '2023-10-16' });
const DEFAULT_GIFT_TYPES = require('./levelConfig.cjs').GIFT_VALUES;

// ----------------------------------------------------------------------
// 1. addCoins (credit) – double‑entry: credit user, debit system coin supply
// ----------------------------------------------------------------------
// Client-callable addCoins is RESTRICTED to allowlisted engagement reasons
// with per-reason daily caps. Everything else (purchases, ads, gifts, levels)
// is minted through dedicated server-side functions; a generic client coin
// faucet would be an exploit.
// Client-allowlisted reward reasons. Caps are expressed as BOTH a per-call
// ceiling and a daily COIN-VOLUME ceiling — never as a transaction count.
// Capping the number of calls while trusting a client-supplied `amount`
// (bounded only by MAX_COIN_OPERATION) let a caller mint the maximum on every
// call; the daily budget below is enforced on summed coin volume.
const CLIENT_ADD_REASON_LIMITS = {
  post_created_bonus: { perTx: 10, dailyCoins: 100 },
  reel_watch: { perTx: 20, dailyCoins: 500 },
  reel_reaction: { perTx: 5, dailyCoins: 200 },
  comment: { perTx: 5, dailyCoins: 200 },
  like: { perTx: 1, dailyCoins: 100 },
  watch_ad: { perTx: 5, dailyCoins: 200 },
  feed_view: { perTx: 5, dailyCoins: 500 },
  quiz_correct: { perTx: 20, dailyCoins: 100 },
  profile_complete: { perTx: 100, dailyCoins: 100 },
};

exports.addCoins = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { amount, reason, metadata = {}, idempotencyKey } = data;
    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > MAX_COIN_OPERATION) {
      throw new functions.https.HttpsError('invalid-argument', `amount must be between 1 and ${MAX_COIN_OPERATION}.`);
    }
    const dailyLimit = CLIENT_ADD_REASON_LIMITS[reason];
    if (!dailyLimit) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `Reason "${reason}" is not allowlisted for client addCoins. Use the dedicated server-side function for this credit.`
      );
    }
    if (amount > dailyLimit.perTx) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Amount ${amount} exceeds the per-call ceiling of ${dailyLimit.perTx} for "${reason}".`
      );
    }
    await checkRateLimit(uid, 'addCoins', 10, 60000);

    // Per-reason DAILY COIN-VOLUME CAP: sum today's credited coins for this
    // reason. Counting transactions (the previous behaviour) did not bound the
    // value a caller could mint, because `amount` is client-supplied.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const todaysTx = await admin.firestore()
        .collection('coin_transactions')
        .where('userId', '==', uid)
        .where('reason', '==', reason)
        .where('createdAt', '>=', todayStart)
        .select('amount')
        .get();
      const creditedToday = todaysTx.docs.reduce((sum, d) => sum + (Number(d.data().amount) || 0), 0);
      if (creditedToday + amount > dailyLimit.dailyCoins) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Daily coin budget reached for "${reason}" (${dailyLimit.dailyCoins} coins/day).`
        );
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      // Query failed (index missing) — fail closed, never bypass the cap.
      throw new functions.https.HttpsError('internal', 'Reward cap check failed: ' + err.message);
    }

    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        const existing = ledgerSnap.data();
        if (existing.userId !== uid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return existing.result;
      }

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

      const oldBalance = userSnap.data().coins || 0;
      const newBalance = oldBalance + amount;
      t.update(userRef, { coins: newBalance });

      const txRef = admin.firestore().collection('coin_transactions').doc();
      const txData = {
        userId: uid, type: 'credit', amount, reason, metadata,
        idempotencyKey: key, balanceAfter: newBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };
      t.set(txRef, txData);

      createLedgerEntry(t, 'system:coin_supply', `users:${uid}`, amount, { reason, transactionId: txRef.id });

      const resultData = { success: true, newBalance, transactionId: txRef.id };
      t.set(ledgerRef, {
        function: 'addCoins',
        userId: uid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Incremental supply (O(1))
      const supplyRef = admin.firestore().collection('system').doc('coin_supply');
      t.set(supplyRef, { totalCoins: admin.firestore.FieldValue.increment(amount) }, { merge: true });

      return resultData;
    });

    logEvent('add_coins_success', { uid, amount, newBalance: result.newBalance });
    return result;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 2. spendCoins (debit) – respects lockedCoins; ledger: debit user, credit system
// ----------------------------------------------------------------------
exports.spendCoins = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { amount, reason, metadata = {}, idempotencyKey } = data;
    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > MAX_COIN_OPERATION) {
      throw new functions.https.HttpsError('invalid-argument', `amount must be between 1 and ${MAX_COIN_OPERATION}.`);
    }
    await checkRateLimit(uid, 'spendCoins', 10, 60000);
    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== uid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

      const data = userSnap.data();
      const available = getAvailableBalance(data);
      if (available < amount) throw new functions.https.HttpsError('failed-precondition', 'Insufficient available coins (some may be locked).');

      const newBalance = (data.coins || 0) - amount;
      t.update(userRef, { coins: newBalance });

      const txRef = admin.firestore().collection('coin_transactions').doc();
      t.set(txRef, {
        userId: uid, type: 'debit', amount, reason, metadata,
        idempotencyKey: key, balanceAfter: newBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      createLedgerEntry(t, `users:${uid}`, 'system:coin_supply', amount, { reason, transactionId: txRef.id });

      const resultData = { success: true, newBalance, transactionId: txRef.id };
      t.set(ledgerRef, {
        function: 'spendCoins',
        userId: uid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      t.set(admin.firestore().collection('system').doc('coin_supply'),
        { totalCoins: admin.firestore.FieldValue.increment(-amount) }, { merge: true });

      return resultData;
    });

    logEvent('spend_coins_success', { uid, amount, newBalance: result.newBalance });
    return result;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 3. transferCoins – double‑entry: debit sender, credit receiver
// ----------------------------------------------------------------------
exports.transferCoins = functions.https.onCall(async (data, context) => {
  try {
    const senderUid = getUserIdFromContext(context);
    const { toUserId, amount, reason, metadata = {}, idempotencyKey } = data;
    if (!toUserId || typeof toUserId !== 'string') throw new functions.https.HttpsError('invalid-argument', 'toUserId is required.');
    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > MAX_COIN_OPERATION) {
      throw new functions.https.HttpsError('invalid-argument', `amount must be between 1 and ${MAX_COIN_OPERATION}.`);
    }
    if (toUserId === senderUid) throw new functions.https.HttpsError('invalid-argument', 'Cannot transfer to yourself.');

    await checkRateLimit(senderUid, 'transferCoins', 5, 60000);
    await enforceDailyLimit(senderUid, amount, 'transferOut', 100000);
    await checkNewAccountAbuse(senderUid, amount);
    await checkMutualTransfer(senderUid, toUserId, amount);

    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== senderUid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      const senderRef = admin.firestore().collection('users').doc(senderUid);
      const receiverRef = admin.firestore().collection('users').doc(toUserId);
      const [senderSnap, receiverSnap] = await Promise.all([t.get(senderRef), t.get(receiverRef)]);
      if (!senderSnap.exists) throw new functions.https.HttpsError('not-found', 'Sender not found.');
      if (!receiverSnap.exists) throw new functions.https.HttpsError('not-found', 'Receiver not found.');

      const senderData = senderSnap.data();
      const available = getAvailableBalance(senderData);
      if (available < amount) throw new functions.https.HttpsError('failed-precondition', 'Insufficient available balance.');

      const receiverData = receiverSnap.data();
      const senderNewBalance = (senderData.coins || 0) - amount;
      const receiverNewBalance = (receiverData.coins || 0) + amount;

      t.update(senderRef, { coins: senderNewBalance });
      t.update(receiverRef, { coins: receiverNewBalance });

      const senderTxRef = admin.firestore().collection('coin_transactions').doc();
      const receiverTxRef = admin.firestore().collection('coin_transactions').doc();
      const baseTx = {
        reason, metadata, idempotencyKey: key,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };
      t.set(senderTxRef, { userId: senderUid, type: 'debit', amount, balanceAfter: senderNewBalance, relatedUserId: toUserId, ...baseTx });
      t.set(receiverTxRef, { userId: toUserId, type: 'credit', amount, balanceAfter: receiverNewBalance, relatedUserId: senderUid, ...baseTx });

      createLedgerEntry(t, `users:${senderUid}`, `users:${toUserId}`, amount, { reason, transactionId: senderTxRef.id });

      const resultData = { success: true, senderNewBalance, receiverNewBalance, transactionId: senderTxRef.id };
      t.set(ledgerRef, {
        function: 'transferCoins',
        userId: senderUid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      enqueuePush(toUserId, {
        title: 'Coins received',
        body: `You received ${amount} coins from ${senderUid}`,
        type: 'coin_transfer',
        data: { from: senderUid, amount },
      }).catch(console.warn);

      return resultData;
    });

    logEvent('transfer_coins_success', { sender: senderUid, receiver: toUserId, amount });
    return result;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 4. sendGift – subcollection for gift details, self‑gift & mutual‑pair detection
// ----------------------------------------------------------------------
exports.sendGift = functions.https.onCall(async (data, context) => {
  try {
    const senderUid = getUserIdFromContext(context);
    const { postId, giftType, idempotencyKey } = data;
    if (!postId || !giftType) throw new functions.https.HttpsError('invalid-argument', 'postId and giftType required.');

    const giftConfig = { ...DEFAULT_GIFT_TYPES, ...(functions.config().app?.gift_types || {}) };
    const giftValue = giftConfig[giftType];
    if (!giftValue) throw new functions.https.HttpsError('invalid-argument', `Unknown gift type: ${giftType}`);

    await checkRateLimit(senderUid, 'sendGift', 10, 60000);
    await enforceDailyLimit(senderUid, giftValue, 'giftSent', 50000);
    await checkNewAccountAbuse(senderUid, giftValue);

    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== senderUid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      const senderRef = admin.firestore().collection('users').doc(senderUid);
      const senderSnap = await t.get(senderRef);
      if (!senderSnap.exists) throw new functions.https.HttpsError('not-found', 'Sender not found.');

      const senderData = senderSnap.data();
      const available = getAvailableBalance(senderData);
      if (available < giftValue) throw new functions.https.HttpsError('failed-precondition', 'Insufficient available coins.');

      const postRef = admin.firestore().collection('posts').doc(postId);
      const postSnap = await t.get(postRef);
      if (!postSnap.exists) throw new functions.https.HttpsError('not-found', 'Post not found.');
      const authorUid = postSnap.data().userId;
      if (!authorUid) throw new functions.https.HttpsError('internal', 'Post has no author.');

      if (senderUid === authorUid && GIFT_SELF_SEND_FLAG) {
        await flagSuspiciousActivity(senderUid, giftValue, 'Self-gifting detected on own post');
      }

      await checkMutualTransfer(senderUid, authorUid, giftValue);

      const authorRef = admin.firestore().collection('users').doc(authorUid);
      const authorSnap = (authorUid !== senderUid) ? await t.get(authorRef) : senderSnap;

      const senderNewBalance = (senderData.coins || 0) - giftValue;
      const authorNewBalance = (authorSnap.data().coins || 0) + giftValue;

      t.update(senderRef, { coins: senderNewBalance });
      if (authorUid !== senderUid) t.update(authorRef, { coins: authorNewBalance });

      t.update(postRef, {
        'stats.gifts': admin.firestore.FieldValue.increment(1),
        'stats.giftValue': admin.firestore.FieldValue.increment(giftValue),
      });

      const giftDetailRef = postRef.collection('gift_details').doc();
      t.set(giftDetailRef, {
        senderId: senderUid,
        giftType,
        value: giftValue,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const giftTxRef = admin.firestore().collection('gift_transactions').doc();
      t.set(giftTxRef, {
        senderId: senderUid, receiverId: authorUid, postId, giftType, value: giftValue,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        idempotencyKey: key,
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      createLedgerEntry(t, `users:${senderUid}`, `users:${authorUid}`, giftValue, { reason: 'gift', postId, giftType, transactionId: giftTxRef.id });

      const resultData = { success: true, newBalance: senderNewBalance, giftTxId: giftTxRef.id };
      t.set(ledgerRef, {
        function: 'sendGift',
        userId: senderUid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      if (authorUid !== senderUid) {
        enqueuePush(authorUid, {
          title: 'New gift received!',
          body: `You received a ${giftType} gift worth ${giftValue} coins`,
          type: 'gift_received',
          data: { from: senderUid, postId, giftType },
        }).catch(console.warn);
      }

      return resultData;
    });

    logEvent('gift_sent', { sender: senderUid, postId, giftType, value: giftValue });
    return result;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 5. boostPost – ownership enforced, cost cap
// ----------------------------------------------------------------------
exports.boostPost = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { postId, days, idempotencyKey } = data;
    if (!postId || !days || typeof days !== 'number' || days <= 0 || days > 30) {
      throw new functions.https.HttpsError('invalid-argument', 'postId and days (1‑30) required.');
    }

    const boostDailyRate = functions.config().app?.boost_daily_rate || 10;
    const totalCost = boostDailyRate * days;
    if (totalCost > MAX_COIN_OPERATION) throw new functions.https.HttpsError('invalid-argument', `Boost cost exceeds maximum allowed.`);

    await checkRateLimit(uid, 'boostPost', 3, 60000);
    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== uid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

      const userData = userSnap.data();
      const available = getAvailableBalance(userData);
      if (available < totalCost) throw new functions.https.HttpsError('failed-precondition', 'Insufficient available coins.');

      const postRef = admin.firestore().collection('posts').doc(postId);
      const postSnap = await t.get(postRef);
      if (!postSnap.exists) throw new functions.https.HttpsError('not-found', 'Post does not exist.');
      if (postSnap.data().userId !== uid) throw new functions.https.HttpsError('permission-denied', 'Only the post owner can boost.');
      if (postSnap.data().boostData?.isBoosted) throw new functions.https.HttpsError('failed-precondition', 'Post is already boosted.');

      const newBalance = (userData.coins || 0) - totalCost;
      t.update(userRef, { coins: newBalance });

      const txRef = admin.firestore().collection('coin_transactions').doc();
      t.set(txRef, {
        userId: uid, type: 'debit', amount: totalCost, reason: 'post_boost',
        metadata: { postId, days }, idempotencyKey: key, balanceAfter: newBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      createLedgerEntry(t, `users:${uid}`, 'system:coin_supply', totalCost, { reason: 'post_boost', postId, transactionId: txRef.id });

      const boostExpiresAt = Date.now() + days * 86400000;
      t.update(postRef, {
        'boostData.isBoosted': true,
        'boostData.boostedBy': uid,
        'boostData.boostExpiresAt': boostExpiresAt,
      });

      const boostedRef = admin.firestore().collection('boosted_posts').doc(postId);
      t.set(boostedRef, {
        postId, userId: postSnap.data().userId, boostedBy: uid,
        expiresAt: boostExpiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const resultData = { success: true, newBalance, boostedExpiresAt };
      t.set(ledgerRef, {
        function: 'boostPost',
        userId: uid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      return resultData;
    });

    logEvent('post_boosted', { uid, postId, days, cost: totalCost });
    return result;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 6. requestWithdrawal – with wallet locking, cooldown, daily cap, review
// ----------------------------------------------------------------------
exports.requestWithdrawal = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { amount, paymentMethod, paymentDetails, idempotencyKey } = data;
    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > MAX_COIN_OPERATION * 5) {
      throw new functions.https.HttpsError('invalid-argument', `amount must be between 1 and ${MAX_COIN_OPERATION * 5}.`);
    }
    if (amount < MIN_WITHDRAWAL_COINS) {
      throw new functions.https.HttpsError('invalid-argument', `Minimum withdrawal is ${MIN_WITHDRAWAL_COINS} coins.`);
    }
    if (!paymentMethod || !paymentDetails) throw new functions.https.HttpsError('invalid-argument', 'paymentMethod and paymentDetails required.');

    const minLevel = functions.config().app?.withdrawal_min_level || LEVEL_GATES.withdrawals;
    const userRef = admin.firestore().collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const userData = userSnap.data();
    if ((userData.level || 0) < minLevel) throw new functions.https.HttpsError('failed-precondition', `Minimum level ${minLevel} required.`);

    const available = getAvailableBalance(userData);
    if (available < amount) throw new functions.https.HttpsError('failed-precondition', 'Insufficient available coins (some may be locked).');

    const lastWithdrawalCompletedAt = userData.lastWithdrawalCompletedAt?.toMillis() || 0;
    if (Date.now() - lastWithdrawalCompletedAt < WITHDRAWAL_COOLDOWN_MS) {
      throw new functions.https.HttpsError('failed-precondition', 'Please wait before requesting another withdrawal.');
    }

    const today = getTodayKey();
    const dailyDocRef = admin.firestore().collection('fraud_limits').doc(`wd_${uid}_${today}`);
    await admin.firestore().runTransaction(async (t) => {
      const snap = await t.get(dailyDocRef);
      const count = snap.exists ? (snap.data().count || 0) : 0;
      if (count >= MAX_DAILY_WITHDRAWAL_REQUESTS) throw new Error('DAILY_LIMIT');
      t.set(dailyDocRef, { count: admin.firestore.FieldValue.increment(1), expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000) }, { merge: true });
    }).catch(() => {
      throw new functions.https.HttpsError('resource-exhausted', 'Daily withdrawal request limit reached.');
    });

    const requiresReview = amount > MANUAL_REVIEW_THRESHOLD;
    const key = generateIdempotencyKey(idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);
    const withdrawalRef = admin.firestore().collection('withdrawal_requests').doc();

    // Lock the coins, write the request, the lock transaction and the
    // idempotency record in ONE transaction. Previously the ledger was read
    // before the lock and written after it, so a retried request re-locked the
    // same coins (double lock, and a second withdrawal row for one intent).
    const resultData = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) return ledgerSnap.data().result;

      const freshSnap = await t.get(userRef);
      const freshData = freshSnap.data();
      const freshAvailable = getAvailableBalance(freshData);
      if (freshAvailable < amount) throw new functions.https.HttpsError('failed-precondition', 'Insufficient coins at lock time.');

      t.update(userRef, { lockedCoins: admin.firestore.FieldValue.increment(amount) });
      t.set(withdrawalRef, {
        userId: uid, amount, paymentMethod, paymentDetails,
        status: requiresReview ? 'pending_review' : 'pending',
        idempotencyKey: key,
        createdAt: serverTS(),
      });

      const lockTxRef = admin.firestore().collection('coin_transactions').doc();
      t.set(lockTxRef, {
        userId: uid, type: 'withdrawal_lock', amount, reason: 'withdrawal_request',
        metadata: { withdrawalId: withdrawalRef.id },
        idempotencyKey: key,
        balanceAfter: freshData.coins || 0,
        createdAt: serverTS(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const res = { success: true, withdrawalId: withdrawalRef.id, requiresReview };
      t.set(ledgerRef, {
        function: 'requestWithdrawal',
        userId: uid,
        result: res,
        processedAt: serverTS(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      return res;
    });

    await admin.firestore().collection('admin_notifications').add({
      type: 'new_withdrawal', userId: uid, amount,
      withdrawalId: withdrawalRef.id, requiresReview,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logEvent('withdrawal_requested', { uid, amount, withdrawalId: withdrawalRef.id });
    return resultData;
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 7. processWithdrawal (admin HTTPS) – distributed lock, coin‑to‑fiat conversion
// ----------------------------------------------------------------------
exports.processWithdrawal = functions.https.onRequest(async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = functions.config()?.admin?.withdrawal_secret; // fail-closed: must be configured
  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { withdrawalId, action } = req.body || {};
  try {
    const result = await settleWithdrawal(
      { stripe, createLedgerEntry, coinsPerDollar: COINS_PER_DOLLAR },
      withdrawalId,
      action
    );
    if (result.status === 'completed') {
      logEvent('withdrawal_approved', {
        withdrawalId, amount: result.amount, usdAmount: result.usdAmount,
      });
      res.json({ success: true, ...result });
    } else {
      logEvent('withdrawal_rejected', { withdrawalId });
      res.json({ success: true, ...result });
    }
  } catch (err) {
    if (err instanceof functions.https.HttpsError) {
      const code = err.code === 'not-found' ? 404
        : err.code === 'invalid-argument' ? 400
        : err.code === 'failed-precondition' || err.code === 'aborted' ? 409
        : err.code === 'unavailable' ? 502
        : 500;
      res.status(code).json({ error: err.message });
      return;
    }
    console.error('processWithdrawal error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ----------------------------------------------------------------------
// 8. recordAdImpression (sharded counter)
// ----------------------------------------------------------------------
exports.recordAdImpression = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { adId, placement } = data;
    if (!adId || !placement) throw new functions.https.HttpsError('invalid-argument', 'adId and placement required.');

    await admin.firestore().collection('ad_impressions').add({
      adId, userId: uid, placement,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    const adStatsRef = admin.firestore().collection('ad_stats').doc(adId);
    const shardId = Math.floor(Math.random() * 10);
    await adStatsRef.collection('shards').doc(String(shardId)).set(
      { impressions: admin.firestore.FieldValue.increment(1) }, { merge: true }
    );

    logEvent('ad_impression', { adId, userId: uid, placement });
    return { success: true };
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 8b. reportAd — a user flags a creative as misleading/offensive
//
//  Ads are server-written, so an ad report is stored server-side too. The
//  document shape matches the other report queues (status/reporterId/reason)
//  so the admin moderation queue can read it with no special casing.
// ----------------------------------------------------------------------
exports.reportAd = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  const { adId, reason = '', details = '' } = data || {};
  if (!adId) throw new functions.https.HttpsError('invalid-argument', 'adId is required.');

  const cleanedReason = String(reason).replace(/<[^>]*>/g, '').trim().slice(0, 300) || 'unspecified';
  await checkRateLimit(uid, 'reportAd', 10, 60000);

  const reportRef = admin.firestore().collection('ad_reports').doc(`${uid}_${adId}`);
  if ((await reportRef.get()).exists) {
    throw new functions.https.HttpsError('already-exists', 'You have already reported this ad.');
  }

  const reporterSnap = await admin.firestore().doc(`users/${uid}`).get().catch(() => null);
  const reporter = reporterSnap && reporterSnap.exists ? reporterSnap.data() : {};
  const adSnap = await admin.firestore().doc(`ads/${adId}`).get().catch(() => null);
  const ad = adSnap && adSnap.exists ? adSnap.data() : {};

  await reportRef.set({
    adId,
    reporterId: uid,
    reporterName: reporter.username || reporter.displayName || 'Arvdoul user',
    reason: cleanedReason,
    details: String(details).replace(/<[^>]*>/g, '').trim().slice(0, 1000),
    content: ad.title || ad.brandName || '',
    status: 'pending',
    priority: 'normal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });

  return { success: true, adId };
});

// ----------------------------------------------------------------------
// 9. getSponsoredSearchResult (returns exact shape client expects)
// ----------------------------------------------------------------------
exports.getSponsoredSearchResult = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { query, context: searchContext } = data;
    if (!query || typeof query !== 'string') throw new functions.https.HttpsError('invalid-argument', 'query must be a string.');

    let userProfile = {};
    try {
      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      if (userSnap.exists) userProfile = userSnap.data();
    } catch (_) {}

    const adsSnapshot = await admin.firestore().collection('ads')
      .where('placements', 'array-contains', 'search')
      .where('active', '==', true)
      .orderBy('priority', 'desc')
      .limit(20)
      .get();

    let bestAd = null;
    let bestScore = -1;
    const queryLower = query.toLowerCase();
    const now = new Date();
    const withinSchedule = (value) => {
      const date = value?.toDate ? value.toDate() : (value instanceof Date ? value : null);
      return !date || (date <= now);
    };
    const notExpired = (value) => {
      const date = value?.toDate ? value.toDate() : (value instanceof Date ? value : null);
      return !date || (date >= now);
    };

    adsSnapshot.docs.forEach(doc => {
      const ad = doc.data();
      if (!withinSchedule(ad.startDate) || !notExpired(ad.endDate)) return;
      const keywords = (ad.keywords || []).map((kw) => String(kw).toLowerCase());
      const matchCount = keywords.filter(kw => kw && queryLower.includes(kw)).length;
      // Ads without keywords are valid catch-all inventory; keep them with a
      // neutral score so the priority ordering still applies.
      const relevance = matchCount > 0 ? matchCount : 0.5;

      if (ad.targetAgeMin && userProfile.age < ad.targetAgeMin) return;
      if (ad.targetAgeMax && userProfile.age > ad.targetAgeMax) return;
      if (ad.targetCountry && userProfile.country && ad.targetCountry !== userProfile.country) return;

      const score = relevance + (ad.priority || 0) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestAd = { id: doc.id, ...ad };
      }
    });

    if (!bestAd) return { sponsoredResult: null };

    admin.firestore().collection('ad_impressions').add({
      adId: bestAd.id, userId: uid, placement: 'search', query,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).catch(console.warn);

    return {
      sponsoredResult: {
        type: bestAd.adType || 'post',
        id: bestAd.id,
        data: {
          title: bestAd.title,
          description: bestAd.description,
          imageUrl: bestAd.mediaUrl || bestAd.imageUrl,
          link: bestAd.url || bestAd.link,
        },
      },
    };
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// 10. Stripe Webhook – handle subscription events, payouts, etc.
// ----------------------------------------------------------------------
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = functions.config().stripe?.webhook_secret;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const db = admin.firestore();

  switch (event.type) {
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      const customerId = invoice.customer;
      // Find user by stripeCustomerId (stored on the private doc)
      const userQuery = await db.collection('users_private').where('stripeCustomerId', '==', customerId).get();
      if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        const subscriptionId = invoice.subscription;
        // `subscriptions` is keyed by uid (that is what the client and the
        // callables read). Keying it by the Stripe subscription id here would
        // create a phantom doc and leave the real one stale, so renewals would
        // never find the tier and would silently grant 0 coins.
        const subRef = db.collection('subscriptions').doc(userId);
        const subSnap = await subRef.get();
        const subData = subSnap.exists ? subSnap.data() : {};
        // Ignore an invoice for a superseded Stripe subscription.
        if (subData.stripeSubscriptionId && subscriptionId && subData.stripeSubscriptionId !== subscriptionId) {
          break;
        }
        await subRef.set({
          status: 'active',
          latestInvoice: invoice.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // The tier + monthly grant live on the subscription doc (written at
        // subscribe time). Never read them from a `config/monetization` doc
        // that nothing writes — that silently granted 0 coins.
        const tier = subData.tier;
        const coinAmount = SUBSCRIPTION_TIERS[tier]?.coinsPerMonth || subData.coinsPerMonth || 0;
        if (coinAmount > 0) {
          // Grant idempotently, keyed on the Stripe invoice id so redelivered
          // webhook events can never double-credit.
          const ledgerRef = db.collection('idempotency_ledger').doc(`webhook_${event.id}`);
          const granted = await createFirestoreTransaction(async (t) => {
            const ledgerSnap = await t.get(ledgerRef);
            if (ledgerSnap.exists) return false;
            await creditSubscriptionCoins(t, {
              userId, tier, coinsPerMonth: coinAmount, idempotencyKey: `webhook_${event.id}`,
            });
            t.set(ledgerRef, {
              function: 'stripeWebhook', userId, result: { success: true, coins: coinAmount },
              processedAt: serverTS(), expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            return true;
          });
          if (granted) {
            await enqueuePush(userId, {
              title: 'Subscription renewed',
              body: `You received ${coinAmount} coins!`,
              type: 'subscription_renewal',
            });
          }
        }
      }
      break;

    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      // Resolve the uid-keyed doc (see the invoice case above).
      const delQuery = await db.collection('users_private')
        .where('stripeCustomerId', '==', subscription.customer).get();
      if (!delQuery.empty) {
        await db.collection('subscriptions').doc(delQuery.docs[0].id).set({
          status: 'canceled',
          endedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// ----------------------------------------------------------------------
// 11. SCHEDULED FUNCTIONS – coin audit using incremental counters (O(1))
// ----------------------------------------------------------------------
exports.auditCoins = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const supplyDoc = await admin.firestore().collection('system').doc('coin_supply').get();
    const supplyTotal = supplyDoc.exists ? (supplyDoc.data().totalCoins || 0) : 0;

    // Reconcile the incremental supply counter against the authoritative sum of
    // every user balance. A server-side aggregate is a single index scan, so
    // this stays O(1) in result size even at large user counts. If the counter
    // drifts (a mint/burn path that forgot to bump it), the gap is reported
    // instead of being logged and trusted.
    if (typeof admin.firestore.AggregateField === 'undefined'
        || typeof admin.firestore().collection('users').aggregate !== 'function') {
      functions.logger.warn('Coin audit skipped: aggregate queries unavailable on this firebase-admin version.');
      return null;
    }

    const agg = await admin.firestore().collection('users')
      .aggregate({ total: admin.firestore.AggregateField.sum('coins') })
      .get();
    const balanceTotal = Number(agg.data().total) || 0;
    const drift = supplyTotal - balanceTotal;

    if (drift === 0) {
      functions.logger.info(`Coin audit OK: supply = balances = ${supplyTotal}`);
      return null;
    }

    functions.logger.error('Coin audit drift detected', { supplyTotal, balanceTotal, drift });
    await admin.firestore().collection('admin_notifications').add({
      type: 'coin_audit_drift',
      supplyTotal,
      balanceTotal,
      drift,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  } catch (err) {
    functions.logger.error('Coin audit failed:', err);
    return null;
  }
});

exports.recoverStuckWithdrawals = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  try {
    const now = new Date();
    const staleDocs = await admin.firestore().collection('withdrawal_requests')
      .where('status', '==', 'processing')
      .where('lockExpiresAt', '<', now)
      .get();

    const batch = admin.firestore().batch();
    staleDocs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'pending',
        processingError: 'Lock expired – automatically reset',
        lockOwner: admin.firestore.FieldValue.delete(),
        lockExpiresAt: admin.firestore.FieldValue.delete(),
      });
    });
    await batch.commit();
    if (staleDocs.size > 0) {
      console.log(`Reset ${staleDocs.size} stuck withdrawal locks.`);
    }
    return null;
  } catch (err) {
    console.error('Failed to recover stuck withdrawals:', err);
    return null;
  }
});
// ======================================================================
// 11. COIN PURCHASES, SUBSCRIPTIONS, PAYOUTS, ADS, VIDEO EVENTS
//     (client-facing callables that were referenced but never deployed)
// ======================================================================

// Coin packages and subscription tiers come from the shared levelConfig so the
// store UI, this callable and the Stripe price creation can never disagree.
const COIN_PACKAGES = require('./levelConfig.cjs').COIN_PACKAGES_BY_ID;
const SUBSCRIPTION_TIERS = require('./levelConfig.cjs').SUBSCRIPTION_TIERS;

const AD_REWARD_PER_30S = require('./levelConfig.cjs').AD_REWARD_COINS;
const serverTS = () => admin.firestore.FieldValue.serverTimestamp();

/**
 * Credit a monthly subscription grant as a real double-entry transaction.
 * Shared by createSubscription (first month) and the invoice.payment_succeeded
 * webhook (renewals) so the ledger shape can never diverge between them.
 * Must run inside a Firestore transaction; idempotencyKey makes retries safe.
 */
async function creditSubscriptionCoins(t, { userId, tier, coinsPerMonth, idempotencyKey }) {
  if (!coinsPerMonth || coinsPerMonth <= 0) return null;
  const userRef = admin.firestore().collection('users').doc(userId);
  const userSnap = await t.get(userRef);
  if (!userSnap.exists) return null;
  const oldBalance = userSnap.data().coins || 0;
  const newBalance = oldBalance + coinsPerMonth;
  t.update(userRef, { coins: newBalance });

  const txRef = admin.firestore().collection('coin_transactions').doc();
  t.set(txRef, {
    userId, type: 'credit', amount: coinsPerMonth, reason: 'subscription',
    metadata: { tier }, idempotencyKey,
    balanceAfter: newBalance, createdAt: serverTS(),
    expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });
  createLedgerEntry(t, 'system:coin_supply', `users:${userId}`, coinsPerMonth, {
    reason: 'subscription', transactionId: txRef.id,
  });
  const supplyRef = admin.firestore().collection('system').doc('coin_supply');
  t.set(supplyRef, { totalCoins: admin.firestore.FieldValue.increment(coinsPerMonth) }, { merge: true });
  return newBalance;
}

async function getOrCreateStripeCustomer(uid) {
  const userRef = admin.firestore().collection('users').doc(uid);
  const privateRef = admin.firestore().collection('users_private').doc(uid);
  const [userSnap, privateSnap] = await Promise.all([userRef.get(), privateRef.get()]);
  if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
  if (privateSnap.data()?.stripeCustomerId) return { id: privateSnap.data().stripeCustomerId };
  // PII lives on users_private; the helper falls back to the legacy public doc.
  const email = await getUserEmail(uid);
  const customer = await stripe.customers.create({ email, metadata: { userId: uid } });
  await privateRef.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer;
}

// ---------------------------------------------------------------
// PURCHASE COINS — real Stripe charge when a payment method is
// supplied; otherwise records the order for a provider callback.
// Idempotent + double-entry ledger + rate limited.
// ---------------------------------------------------------------
exports.purchaseCoins = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { packageId, paymentMethodId, deviceMetadata = {} } = data;
    const pkg = COIN_PACKAGES[packageId];
    if (!pkg) throw new functions.https.HttpsError('invalid-argument', 'Invalid coin package.');
    // No free coins: a real payment method is required for purchases.
    if (!paymentMethodId) {
      throw new functions.https.HttpsError('failed-precondition', 'A payment method is required to purchase coins.');
    }
    if (!stripe) {
      throw new functions.https.HttpsError('failed-precondition', 'Payments are not configured yet.');
    }
    await checkRateLimit(uid, 'purchaseCoins', 5, 60000);
    const key = generateIdempotencyKey(data.idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== uid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      // Real revenue path: charge the card (payment method validated above).
      const customer = await getOrCreateStripeCustomer(uid);
      await stripe.paymentIntents.create({
        amount: pkg.priceUsdCents,
        currency: 'usd',
        payment_method: paymentMethodId,
        customer: customer.id,
        confirm: true,
        off_session: true,
        metadata: { userId: uid, packageId },
      }, { idempotencyKey: `pi_${key}` });

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

      const oldBalance = userSnap.data().coins || 0;
      const newBalance = oldBalance + pkg.coins;
      t.update(userRef, { coins: newBalance });

      const txRef = admin.firestore().collection('coin_transactions').doc();
      t.set(txRef, {
        userId: uid, type: 'credit', amount: pkg.coins, reason: 'purchase',
        metadata: { packageId, platform: deviceMetadata.platform || 'web', charged: !!paymentMethodId },
        idempotencyKey: key, balanceAfter: newBalance,
        createdAt: serverTS(), expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      createLedgerEntry(t, 'system:coin_supply', `users:${uid}`, pkg.coins, { reason: 'purchase', transactionId: txRef.id });

      const resultData = { success: true, newBalance, coinsAdded: pkg.coins, transactionId: txRef.id };
      t.set(ledgerRef, {
        function: 'purchaseCoins', userId: uid, result: resultData,
        processedAt: serverTS(), expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      const supplyRef = admin.firestore().collection('system').doc('coin_supply');
      t.set(supplyRef, { totalCoins: admin.firestore.FieldValue.increment(pkg.coins) }, { merge: true });
      return resultData;
    });

    logEvent('purchase_coins_success', { uid, packageId, newBalance: result.newBalance });
    return result;
  } catch (err) { throw handleError(err); }
});

// ---------------------------------------------------------------
// SUBSCRIPTIONS — status / create / cancel (Stripe-backed when
// configured; config-based tiers otherwise).
// ---------------------------------------------------------------
exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const snap = await admin.firestore().collection('subscriptions').doc(uid).get();
    if (!snap.exists) return { success: true, active: false, subscription: null };
    const sub = snap.data();
    const active = sub.status === 'active';
    return {
      success: true,
      active,
      subscription: {
        ...sub,
        currentPeriodEnd: sub.currentPeriodEnd?.toDate?.()?.toISOString?.() || sub.currentPeriodEnd || null,
        createdAt: sub.createdAt?.toDate?.()?.toISOString?.() || null,
      },
    };
  } catch (err) { throw handleError(err); }
});

exports.createSubscription = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { tier, paymentMethodId, deviceMetadata = {} } = data;
    const tierCfg = SUBSCRIPTION_TIERS[tier];
    if (!tierCfg) throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
    // No free subscriptions: a real payment method + Stripe are required.
    if (!paymentMethodId) {
      throw new functions.https.HttpsError('failed-precondition', 'A payment method is required to subscribe.');
    }
    if (!stripe) {
      throw new functions.https.HttpsError('failed-precondition', 'Payments are not configured yet.');
    }
    await checkRateLimit(uid, 'createSubscription', 5, 60000);
    const key = generateIdempotencyKey(data.idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) return ledgerSnap.data().result;

      // Real recurring subscription: create a monthly price from the tier
      // config, attach the payment method, and set the default invoice to
      // auto-charge it.
      const price = await stripe.prices.create({
        unit_amount: tierCfg.priceUsdCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        product_data: { name: `Arvdoul ${tier.charAt(0).toUpperCase() + tier.slice(1)}` },
      });
      const customer = await getOrCreateStripeCustomer(uid);
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: paymentMethodId } });
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId: uid, tier },
      });
      const stripeSubscriptionId = sub.id;

      const subRef = admin.firestore().collection('subscriptions').doc(uid);
      t.set(subRef, {
        userId: uid, tier, status: 'active', coinsPerMonth: tierCfg.coinsPerMonth,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId, createdAt: serverTS(), updatedAt: serverTS(),
      });

      // Credit first month coins (same double-entry path as purchases).
      await creditSubscriptionCoins(t, {
        userId: uid, tier, coinsPerMonth: tierCfg.coinsPerMonth, idempotencyKey: `${key}_first`,
      });

      const resultData = { success: true, tier, stripeSubscriptionId };
      t.set(ledgerRef, {
        function: 'createSubscription', userId: uid, result: resultData,
        processedAt: serverTS(), expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      return resultData;
    });

    logEvent('subscription_created', { uid, tier });
    return result;
  } catch (err) { throw handleError(err); }
});

exports.cancelSubscription = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const key = generateIdempotencyKey(data.idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) return ledgerSnap.data().result;
      const subRef = admin.firestore().collection('subscriptions').doc(uid);
      const subSnap = await t.get(subRef);
      if (!subSnap.exists) throw new functions.https.HttpsError('not-found', 'No active subscription.');

      if (subSnap.data().stripeSubscriptionId && stripe) {
        try {
          await stripe.subscriptions.update(subSnap.data().stripeSubscriptionId, { cancel_at_period_end: true });
        } catch (stripeErr) {
          // Non-fatal: still mark locally; Stripe webhook reconciles.
          logEvent('stripe_cancel_failed', { uid, error: stripeErr.message });
        }
      }
      t.update(subRef, { status: 'canceled', cancelAtPeriodEnd: true, canceledAt: serverTS(), updatedAt: serverTS() });

      const resultData = { success: true, message: 'Subscription will end at the current period.' };
      t.set(ledgerRef, {
        function: 'cancelSubscription', userId: uid, result: resultData,
        processedAt: serverTS(), expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      return resultData;
    });
    return result;
  } catch (err) { throw handleError(err); }
});

// ---------------------------------------------------------------
// CREATOR PAYOUTS (Stripe Express onboarding + settings)
// ---------------------------------------------------------------
exports.getPayoutSettings = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const snap = await admin.firestore().collection('payout_settings').doc(uid).get();
    return { success: true, settings: snap.exists ? snap.data() : null };
  } catch (err) { throw handleError(err); }
});

exports.createPayoutAccount = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { countryCode = 'US', returnUrl, deviceMetadata = {} } = data;
    await checkRateLimit(uid, 'createPayoutAccount', 5, 60000);
    if (!stripe) throw new functions.https.HttpsError('failed-precondition', 'Payouts are not configured yet.');

    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

    const account = await stripe.accounts.create({
      type: 'express',
      country: countryCode,
      email: await getUserEmail(uid),
      capabilities: { transfers: { requested: true } },
    });
    const refreshUrl = returnUrl || 'https://arvdoul.app/payouts';
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: refreshUrl,
      type: 'account_onboarding',
    });

    await admin.firestore().collection('payout_settings').doc(uid).set({
      stripeAccountId: account.id,
      status: 'onboarding',
      onboardingUrl: link.url,
      updatedAt: serverTS(),
    }, { merge: true });

    logEvent('payout_account_created', { uid, accountId: account.id });
    return { success: true, onboardingUrl: link.url, accountId: account.id };
  } catch (err) { throw handleError(err); }
});

// ---------------------------------------------------------------
// ADS — serve the highest-priority active ad for a placement,
// and reward coins for completed ad views (idempotent).
// ---------------------------------------------------------------
exports.getAd = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { placement, userId, context: adContext = {} } = data;
    if (!placement) throw new functions.https.HttpsError('invalid-argument', 'placement is required.');
    await checkRateLimit(uid, 'getAd', 30, 60000);

    const now = new Date();
    const snap = await admin.firestore().collection('ads')
      .where('active', '==', true)
      .where('placements', 'array-contains', placement)
      .orderBy('priority', 'desc')
      .limit(5)
      .get();

    const candidates = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a =>
        (!a.startDate || !a.startDate.toDate || a.startDate.toDate() <= now) &&
        (!a.endDate || !a.endDate.toDate || a.endDate.toDate() >= now)
      );
    if (candidates.length === 0) return { success: true, ad: null, cacheTTL: 300 };

    const ad = candidates[0];
    return {
      success: true,
      ad: {
        id: ad.id, type: ad.type, media: ad.media, link: ad.link,
        title: ad.title, cta: ad.cta, advertiserId: ad.advertiserId,
      },
      cacheTTL: 300,
    };
  } catch (err) { throw handleError(err); }
});

exports.watchAd = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { placement, adId, watchDurationSeconds, deviceMetadata = {} } = data;
    if (!adId || !placement) throw new functions.https.HttpsError('invalid-argument', 'adId and placement are required.');
    if (!watchDurationSeconds || watchDurationSeconds < 5) {
      throw new functions.https.HttpsError('invalid-argument', 'watchDurationSeconds must be >= 5.');
    }
    await checkRateLimit(uid, 'watchAd', 20, 60000);

    // Rewarded ads must map to a real, active campaign. Without this check a
    // client could mint coins by inventing an adId, since the reward below is
    // granted unconditionally.
    const adSnap = await admin.firestore().collection('ads').doc(adId).get();
    const ad = adSnap.exists ? adSnap.data() : null;
    const now = new Date();
    const started = !ad?.startDate?.toDate || ad.startDate.toDate() <= now;
    const notEnded = !ad?.endDate?.toDate || ad.endDate.toDate() >= now;
    if (!ad || ad.active !== true || !started || !notEnded) {
      throw new functions.https.HttpsError('not-found', 'Ad campaign not found or inactive.');
    }

    // Clamp the client-supplied watch time so a forged duration cannot inflate
    // the reward beyond a real rewarded-ad session.
    const MAX_AD_WATCH_SECONDS = 120;
    const watchedSeconds = Math.min(Number(watchDurationSeconds), MAX_AD_WATCH_SECONDS);
    const reward = Math.max(AD_REWARD_PER_30S, Math.floor(watchedSeconds / 30) * AD_REWARD_PER_30S);
    const key = generateIdempotencyKey(data.idempotencyKey);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) return ledgerSnap.data().result;

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

      const oldBalance = userSnap.data().coins || 0;
      const newBalance = oldBalance + reward;
      t.update(userRef, { coins: newBalance });

      const impRef = admin.firestore().collection('ad_impressions').doc();
      t.set(impRef, {
        userId: uid, adId, placement, watchDurationSeconds, reward,
        createdAt: serverTS(), expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      const txRef = admin.firestore().collection('coin_transactions').doc();
      t.set(txRef, {
        userId: uid, type: 'credit', amount: reward, reason: 'ad_reward',
        metadata: { adId, placement }, idempotencyKey: key, balanceAfter: newBalance,
        createdAt: serverTS(), expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      createLedgerEntry(t, 'system:coin_supply', `users:${uid}`, reward, { reason: 'ad_reward', transactionId: txRef.id });

      const resultData = { success: true, coinsAdded: reward, newBalance };
      t.set(ledgerRef, {
        function: 'watchAd', userId: uid, result: resultData,
        processedAt: serverTS(), expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      return resultData;
    });

    logEvent('ad_rewarded', { uid, adId, reward });
    return result;
  } catch (err) { throw handleError(err); }
});

// ---------------------------------------------------------------
// VIDEO EVENTS — status pipeline callbacks (created → processed →
// moderated → watermarked). Owner-scoped.
// ---------------------------------------------------------------
exports.processVideoEvent = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { eventType, videoId, payload = {} } = data;
    if (!eventType || !videoId) throw new functions.https.HttpsError('invalid-argument', 'eventType and videoId are required.');

    const videoRef = admin.firestore().collection('videos').doc(videoId);
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) throw new functions.https.HttpsError('not-found', 'Video not found.');
    if (videoSnap.data().userId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the video owner can process events.');
    }

    const updates = {};
    switch (eventType) {
      case 'video.created':
        updates.status = 'processing';
        break;
      case 'video.processed':
        updates.status = 'ready';
        if (payload.playbackId) updates.playbackId = payload.playbackId;
        break;
      case 'video.moderated':
        updates.moderationStatus = payload.approved ? 'approved' : 'rejected';
        break;
      case 'video.watermarked':
        updates.watermarkStatus = 'done';
        break;
      default:
        throw new functions.https.HttpsError('invalid-argument', 'Unknown eventType.');
    }
    updates.updatedAt = serverTS();
    await videoRef.update(updates);

    logEvent('video_event_processed', { uid, videoId, eventType });
    return { success: true, videoId, eventType };
  } catch (err) { throw handleError(err); }
});

// ----------------------------------------------------------------------
// Marketplace purchase — server-authoritative coin debit + stock + order.
// Client-side stock writes are denied by rules (buyer != creator), so the
// whole purchase must happen here atomically.
// ----------------------------------------------------------------------
exports.purchaseMarketplaceItem = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { productId, orderId } = data || {};
    if (!productId) throw new functions.https.HttpsError('invalid-argument', 'productId required.');
    await checkRateLimit(uid, 'marketplacePurchase', 10, 60000);

    const key = generateIdempotencyKey(orderId || `mp-${uid}-${productId}-${Date.now()}`);
    const ledgerRef = admin.firestore().collection('idempotency_ledger').doc(key);

    const result = await createFirestoreTransaction(async (t) => {
      const ledgerSnap = await t.get(ledgerRef);
      if (ledgerSnap.exists) {
        if (ledgerSnap.data().userId !== uid) {
          throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
        }
        return ledgerSnap.data().result;
      }

      const db = admin.firestore();
      const productRef = db.collection('marketplace_items').doc(productId);
      const productSnap = await t.get(productRef);
      if (!productSnap.exists) throw new functions.https.HttpsError('not-found', 'Product not found.');
      const product = productSnap.data();
      if ((product.stock || 0) <= 0) {
        throw new functions.https.HttpsError('failed-precondition', 'This item is currently out of stock.');
      }

      const price = Number(product.priceCoins) || 0;
      if (price <= 0) throw new functions.https.HttpsError('invalid-argument', 'Product has no valid coin price.');

      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
      const available = getAvailableBalance(userSnap.data());
      if (available < price) {
        throw new functions.https.HttpsError('failed-precondition', `Insufficient Arvdoul Coins. You need ${price} coins, but have ${available}.`);
      }

      // 1. Debit coins (same double-entry ledger as spendCoins)
      const newBalance = (userSnap.data().coins || 0) - price;
      t.update(userRef, { coins: newBalance });

      const txRef = db.collection('coin_transactions').doc();
      t.set(txRef, {
        userId: uid, type: 'debit', amount: price,
        reason: 'marketplace_purchase',
        metadata: { productId, productTitle: product.title || '' },
        idempotencyKey: key, balanceAfter: newBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      createLedgerEntry(t, `users:${uid}`, 'system:coin_supply', price, { reason: 'marketplace_purchase', transactionId: txRef.id });
      t.set(db.collection('system').doc('coin_supply'),
        { totalCoins: admin.firestore.FieldValue.increment(-price) }, { merge: true });

      // 2. Stock + sales
      t.update(productRef, {
        stock: admin.firestore.FieldValue.increment(-1),
        salesCount: admin.firestore.FieldValue.increment(1),
      });

      // 3. Order (matches firestore.rules: buyerId top-level)
      const orderRef = db.collection('orders').doc();
      const orderData = {
        orderId: orderRef.id,
        productId,
        productTitle: product.title || '',
        product,
        buyerId: uid,
        sellerId: product.creatorId || null,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        amountPaidCoins: price,
        downloadUrl: product.downloadUrl || null,
        status: 'Completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      t.set(orderRef, orderData);

      const resultData = {
        success: true,
        order: { id: orderRef.id, ...orderData, purchasedAt: new Date().toISOString() },
        newBalance,
        transactionId: txRef.id,
      };
      t.set(ledgerRef, {
        function: 'purchaseMarketplaceItem',
        userId: uid,
        result: resultData,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      return resultData;
    });

    logEvent('marketplace_purchase_success', { uid, productId, newBalance: result.newBalance });
    return result;
  } catch (err) { throw handleError(err); }
});

// Shared internals exposed to sibling modules (admin.js) so the money-path
// helpers exist exactly once: the single configured Stripe client and the
// double-entry ledger writer. Not deployed as callables.
module.exports.getMonetizationStripe = () => stripe;
module.exports.createLedgerEntry = createLedgerEntry;
