// functions/xpAward.js — the single server-side XP award routine.
//
// `awardExperience` (the client-facing callable) and every server action that
// grants XP (watching a rewarded ad, casting a civic vote, recording a streak
// milestone, watching a live minute) all funnel through `awardXp`. Before this
// helper existed, only the callable could award XP, so the other XP rules in
// levelConfig.cjs (ad_reward_claimed, civic_vote_cast, streak_milestone,
// live_minute) were dead configuration: nothing ever credited them.
//
// XP, level and coin rewards are server-authoritative. This module is the only
// place that mutates `experience`/`level`, so a client cannot forge an award.

const admin = require('firebase-admin');
const {
  XP_RULES,
  getLevelInfo: computeLevelInfo,
  getLevelUpReward,
} = require('./levelConfig.cjs');

const db = admin.firestore();

/**
 * Award XP for `action` to `uid` inside one transaction, applying the
 * per-action daily cap and action+source idempotency, recomputing the level and
 * crediting any level-up coin reward to the ledger + supply counter.
 *
 * @returns {Promise<object>} the same shape the awardExperience callable returns.
 */
async function awardXp(uid, action, { count = 1, source = null } = {}) {
  const rule = XP_RULES[action];
  if (!rule) throw new Error(`Unknown XP action: ${action}`);
  const idempotencyKey = source ? `${action}:${source}` : null;
  const userRef = db.doc(`users/${uid}`);

  let result = null;
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const dataDoc = userSnap.exists ? userSnap.data() : {};

    const today = new Date().toISOString().slice(0, 10);
    const counters = dataDoc.xpCounters || {};
    const todayEntry = counters[today] || {};
    const usedTodayXp = todayEntry[action] || 0;
    const allowed = Math.max(0, Math.min(count, Math.floor((rule.dailyCap - usedTodayXp) / rule.xp)));
    if (allowed <= 0) {
      result = { success: true, xpAwarded: 0, leveledUp: false, newLevel: dataDoc.level || 1, coinReward: 0, capped: true };
      return;
    }

    const recent = dataDoc.xpAwards || {};
    if (idempotencyKey && recent[idempotencyKey] === today) {
      result = { success: true, xpAwarded: 0, leveledUp: false, newLevel: dataDoc.level || 1, coinReward: 0, duplicate: true };
      return;
    }

    const xpAwarded = allowed * rule.xp;
    const experience = (dataDoc.experience || 0) + xpAwarded;
    const before = computeLevelInfo(dataDoc.experience || 0);
    const after = computeLevelInfo(experience);
    const leveledUp = after.level > before.level;
    const coinReward = leveledUp ? getLevelUpReward(before.level, after.level) : 0;

    const patch = {
      experience,
      level: after.level,
      experienceToNextLevel: after.nextLevelXp === null ? null : Math.max(0, after.nextLevelXp - experience),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (idempotencyKey) patch[`xpAwards.${idempotencyKey}`] = today;
    const nextCounters = { ...counters };
    nextCounters[today] = { ...todayEntry, [action]: usedTodayXp + xpAwarded };
    patch.xpCounters = nextCounters;
    if (leveledUp) patch.lastLevelUpAt = admin.firestore.FieldValue.serverTimestamp();

    tx.set(userRef, patch, { merge: true });

    if (coinReward > 0) {
      // The reward is a real coin credit, so it lands in the same
      // coin_transactions ledger the wallet reads and increments the system
      // supply, keeping the ledger and supply counters consistent.
      const rewardTxRef = db.collection('coin_transactions').doc();
      tx.set(rewardTxRef, {
        userId: uid,
        type: 'credit',
        amount: coinReward,
        reason: 'level_up_reward',
        metadata: { level: after.level },
        balanceAfter: (dataDoc.coins || 0) + coinReward,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      tx.set(db.collection('system').doc('coin_supply'),
        { totalCoins: admin.firestore.FieldValue.increment(coinReward) }, { merge: true });
      tx.set(userRef, { coins: admin.firestore.FieldValue.increment(coinReward) }, { merge: true });
    }

    result = {
      success: true,
      xpAwarded,
      leveledUp,
      newLevel: after.level,
      coinReward,
      info: { level: after.level, progress: after.progress, xpToNext: after.xpToNext },
    };
  });

  return result;
}

/** Best-effort XP grant: never throws, so a secondary action cannot fail on XP. */
async function awardXpSafe(uid, action, options) {
  try {
    return await awardXp(uid, action, options);
  } catch (err) {
    try {
      require('firebase-functions').logger.warn('awardXpSafe failed', { uid, action, error: err.message });
    } catch {
      /* the logger itself failed; nothing further can be recorded */
    }
    return { success: false, xpAwarded: 0 };
  }
}

module.exports = { awardXp, awardXpSafe };
