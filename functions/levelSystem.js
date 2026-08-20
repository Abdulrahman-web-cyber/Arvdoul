/**
 * functions/levelSystem.js - ARVDOUL LEVEL SYSTEM (server-authoritative)
 *
 * Server-side XP awarding so XP cannot be farmed by editing client code.
 * The client levelSystemService prefers this callable and falls back to its
 * local transaction only when the function is unreachable (offline/dev).
 *
 * Shares the exact LEVELS curve with the client (src/services/levelSystemService.js):
 *   1:0  2:100  3:300  4:600  5:1000  6:1500  7:2100  8:2800  9:3600
 *   10:4500  11:5500  12:6600  13:7800  14:9100  15:10500
 *
 * Atomic transaction: XP +=, level recompute, coin reward + coin_ledger
 * entry, idempotency by action+source+date, per-action daily caps.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const LEVELS = [
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
];

const XP_RULES = {
  post_created: { xp: 10, dailyCap: 100 },
  comment_created: { xp: 5, dailyCap: 50 },
  like_received: { xp: 1, dailyCap: 50 },
  follow_received: { xp: 15, dailyCap: 150 },
  daily_login: { xp: 20, dailyCap: 20 },
  gift_received: { xp: 2, dailyCap: 100 },
  live_minute: { xp: 1, dailyCap: 60 },
};

function getLevelInfo(experience) {
  const xp = Math.max(0, Number(experience) || 0);
  let level = LEVELS[0].level;
  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      level = current.level;
      next = LEVELS[i + 1] || null;
    } else break;
  }
  return { level, current, next };
}

exports.awardExperience = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;

    const action = data && data.action;
    const count = Number((data && data.count) || 1);
    const source = data && data.source ? String(data.source).slice(0, 120) : null;

    const rule = XP_RULES[action];
    if (!rule) {
      throw new functions.https.HttpsError('invalid-argument', `Unknown XP action: ${action}`);
    }
    if (!Number.isFinite(count) || count < 1 || count > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'count must be 1-100');
    }

    const idempotencyKey = source ? `${action}:${source}` : null;
    const userRef = db.doc(`users/${uid}`);

    try {
      let result = null;
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const dataDoc = userSnap.exists ? userSnap.data() : {};

        // Daily cap (XP-tracked)
        const today = new Date().toISOString().slice(0, 10);
        const counters = dataDoc.xpCounters || {};
        const todayEntry = counters[today] || {};
        const usedTodayXp = todayEntry[action] || 0;
        const allowed = Math.max(0, Math.min(count, Math.floor((rule.dailyCap - usedTodayXp) / rule.xp)));
        if (allowed <= 0) {
          result = { success: true, xpAwarded: 0, leveledUp: false, newLevel: dataDoc.level || 1, coinReward: 0, capped: true };
          return;
        }

        // Idempotency
        const recent = dataDoc.xpAwards || {};
        if (idempotencyKey && recent[idempotencyKey] === today) {
          result = { success: true, xpAwarded: 0, leveledUp: false, newLevel: dataDoc.level || 1, coinReward: 0, duplicate: true };
          return;
        }

        const xpAwarded = allowed * rule.xp;
        const experience = (dataDoc.experience || 0) + xpAwarded;
        const before = getLevelInfo(dataDoc.experience || 0);
        const after = getLevelInfo(experience);
        const leveledUp = after.level > before.level;
        const coinReward = leveledUp
          ? LEVELS.filter((l) => l.level > before.level && l.level <= after.level)
              .reduce((sum, l) => sum + l.coinReward, 0)
          : 0;

        const patch = {
          experience,
          level: after.level,
          experienceToNextLevel: after.next ? Math.max(0, after.next.xpRequired - experience) : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (idempotencyKey) patch[`xpAwards.${idempotencyKey}`] = today;
        const nextCounters = { ...counters };
        nextCounters[today] = { ...todayEntry, [action]: usedTodayXp + xpAwarded };
        patch.xpCounters = nextCounters;
        if (leveledUp) patch.lastLevelUpAt = admin.firestore.FieldValue.serverTimestamp();

        tx.set(userRef, patch, { merge: true });

        if (coinReward > 0) {
          tx.set(db.doc(`coin_ledger/${uid}_levelup_${after.level}_${Date.now()}`), {
            userId: uid,
            amount: coinReward,
            type: 'level_up_reward',
            reason: `Level ${after.level} reward`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.set(userRef, { coins: admin.firestore.FieldValue.increment(coinReward) }, { merge: true });
        }

        result = {
          success: true,
          xpAwarded,
          leveledUp,
          newLevel: after.level,
          coinReward,
          info: { level: after.level, progress: 0, xpToNext: after.next ? after.next.xpRequired - experience : 0 },
        };
      });

      return result;
    } catch (err) {
      functions.logger.error('awardExperience failed', { uid, action, error: err.message });
      throw new functions.https.HttpsError('internal', 'Could not award XP');
    }
  });
