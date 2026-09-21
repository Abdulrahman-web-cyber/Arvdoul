/**
 * functions/levelSystem.js - ARVDOUL LEVEL SYSTEM (server-authoritative)
 *
 * Server-side XP awarding so XP cannot be farmed by editing client code.
 * The client levelSystemService prefers this callable and falls back to its
 * local transaction only when the function is unreachable (offline/dev).
 *
 * The curve, reward tables, XP rules and gating thresholds are NOT defined
 * here: they are required from ./levelConfig.cjs, a byte-identical copy of the
 * canonical src/shared/levelConfig.cjs that the client imports. Firebase only
 * uploads the functions/ directory, so scripts/sync-shared-config.mjs (wired to
 * `npm run sync:shared` and the `predeploy` hook) keeps the copy in step, and
 * src/__tests__/sharedConfigSync.test.js fails CI if they ever diverge.
 *
 * Atomic transaction: XP +=, level recompute, coin reward + coin_ledger
 * entry, idempotency by action+source+date, per-action daily caps.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkRateLimit } = require('./rateLimit');
const {
  LEVELS,
  XP_RULES,
  getLevelInfo: computeLevelInfo,
  getLevelUpReward,
} = require('./levelConfig.cjs');

const db = admin.firestore();

exports.awardExperience = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    await checkRateLimit(uid, 'awardExperience', 60, 60000);

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
          info: { level: after.level, progress: after.progress, xpToNext: after.xpToNext },
        };
      });

      return result;
    } catch (err) {
      functions.logger.error('awardExperience failed', { uid, action, error: err.message });
      throw new functions.https.HttpsError('internal', 'Could not award XP');
    }
  });

exports.recordActiveDay = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    await checkRateLimit(uid, 'recordActiveDay', 30, 60000);

    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    const userRef = db.doc(`users/${uid}`);
    const ledgerRef = db.doc(`active_days_ledger/${uid}_${today}`);

    try {
      let result = null;
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const userData = userSnap.data();
        const lastActiveDay = userData.lastActiveDay || null;

        if (lastActiveDay === today) {
          result = {
            success: true,
            activeStreak: userData.activeStreak || 1,
            activeDaysCount: userData.activeDaysCount || 1,
            alreadyRecordedToday: true,
            lastActiveDay: today,
          };
          return;
        }

        let newStreak = 1;
        if (lastActiveDay === yesterday) {
          newStreak = (userData.activeStreak || 0) + 1;
        } else {
          newStreak = 1;
        }

        const newDaysCount = (userData.activeDaysCount || 0) + 1;

        tx.set(ledgerRef, {
          uid,
          userId: uid,
          date: today,
          streak: newStreak,
          totalDays: newDaysCount,
          status: 'verified',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(userRef, {
          lastActiveDay: today,
          activeStreak: newStreak,
          activeDaysCount: newDaysCount,
          lastActive: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        result = {
          success: true,
          activeStreak: newStreak,
          activeDaysCount: newDaysCount,
          alreadyRecordedToday: false,
          lastActiveDay: today,
        };
      });

      return result;
    } catch (err) {
      functions.logger.error('recordActiveDay failed', { uid, error: err.message });
      throw new functions.https.HttpsError('internal', 'Could not record active day');
    }
  });
