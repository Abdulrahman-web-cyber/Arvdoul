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
  LEVEL_GATES,
  ACHIEVEMENTS_CATALOG,
  TITLES_CATALOG,
  ROYAL_ELIGIBILITY,
  getLevelInfo: computeLevelInfo,
  getLevelUpReward,
  getRoyalEligibility,
  getCreatorCapabilities,
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

/**
 * Server-authoritative achievement evaluation.
 * Validates user stats against ACHIEVEMENTS_CATALOG criteria and grants new achievements idempotently.
 */
exports.evaluateAchievements = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    await checkRateLimit(uid, 'evaluateAchievements', 20, 60000);

    const userRef = db.doc(`users/${uid}`);
    const achievementsCol = db.collection(`achievements/${uid}/items`);

    try {
      const [userSnap, existingSnaps] = await Promise.all([
        userRef.get(),
        achievementsCol.get(),
      ]);

      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userSnap.data() || {};
      const existingIds = new Set(existingSnaps.docs.map((d) => d.id));

      const newlyEarned = [];
      const batch = db.batch();

      for (const ach of ACHIEVEMENTS_CATALOG) {
        if (existingIds.has(ach.id)) continue;

        let eligible = true;
        const c = ach.criteria;

        if (c.minLevel && (userData.level || 1) < c.minLevel) eligible = false;
        if (c.minStreak && (userData.activeStreak || 0) < c.minStreak) eligible = false;
        if (c.minPosts && (userData.postsCount || userData.postCount || 0) < c.minPosts) eligible = false;
        if (c.minLikes && (userData.likesCount || 0) < c.minLikes) eligible = false;
        if (c.isCreator && !userData.isCreator) eligible = false;
        if (c.hostedLive && !userData.hostedLive) eligible = false;
        if (c.pollVotes && (userData.pollVotesCount || 0) < c.pollVotes) eligible = false;
        if (c.commentsCount && (userData.commentsCount || 0) < c.commentsCount) eligible = false;
        if (c.profilesVisited && (userData.profilesVisitedCount || 0) < c.profilesVisited) eligible = false;
        if (c.friendsCount && (userData.friendsCount || userData.mutualConnectionsCount || 0) < c.friendsCount) eligible = false;
        if (c.giftsSent && (userData.giftsSentCount || 0) < c.giftsSent) eligible = false;
        if (c.lifetimeCoinsEarned && (userData.lifetimeCoinsEarned || userData.totalEarned || 0) < c.lifetimeCoinsEarned) eligible = false;
        if (c.hasPassport && !userData.hasPassport && !userData.passportCreated) eligible = false;
        if (c.isRoyal && !userData.isRoyal && userData.primaryTitle !== 'Duke' && userData.primaryTitle !== 'King / Queen') eligible = false;
        if (c.isPioneer && !userData.isPioneer) eligible = false;

        if (eligible) {
          const itemRef = achievementsCol.doc(ach.id);
          batch.set(itemRef, {
            id: ach.id,
            category: ach.category,
            title: ach.title,
            description: ach.description,
            icon: ach.icon,
            points: ach.points,
            rarity: ach.rarity,
            criteriaVersion: ach.criteriaVersion,
            earnedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'system_evaluation',
          });
          newlyEarned.push(ach);
        }
      }

      if (newlyEarned.length > 0) {
        batch.set(userRef, {
          achievementsCount: admin.firestore.FieldValue.increment(newlyEarned.length),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
      }

      return {
        success: true,
        newlyEarnedCount: newlyEarned.length,
        newlyEarned: newlyEarned.map((a) => ({ id: a.id, title: a.title, icon: a.icon, points: a.points })),
        totalCount: existingIds.size + newlyEarned.length,
      };
    } catch (err) {
      functions.logger.error('evaluateAchievements failed', { uid, error: err.message });
      throw new functions.https.HttpsError('internal', 'Could not evaluate achievements');
    }
  });

/**
 * Claim an eligible title with provenance.
 * Verifies multidimensional criteria — Zero Pay-To-Legitimacy.
 */
exports.claimTitle = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    const titleId = data && data.titleId;
    if (!titleId || typeof titleId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Valid titleId required');
    }

    const titleDef = TITLES_CATALOG[titleId];
    if (!titleDef) {
      throw new functions.https.HttpsError('not-found', `Unknown title: ${titleId}`);
    }

    await checkRateLimit(uid, 'claimTitle', 20, 60000);

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const userData = userSnap.data() || {};

    // Multidimensional verification
    let eligible = false;
    let missingReasons = [];

    if (titleId === 'duke' || titleId === 'king') {
      const evalRes = getRoyalEligibility(titleId, userData);
      eligible = evalRes.eligible;
      missingReasons = evalRes.missing;
    } else {
      const c = titleDef.criteria || {};
      const userLevel = Number(userData.level) || 1;
      const activeDays = Number(userData.activeDaysCount) || 0;
      const contribution = Number(userData.contributionScore || userData.contribution) || 0;
      const reputation = Number(userData.reputationScore || userData.reputation) || 0;
      const influence = Number(userData.influenceScore || userData.influence) || 0;

      if (c.minLevel && userLevel < c.minLevel) missingReasons.push(`Requires Level ${c.minLevel}`);
      if (c.minActiveDays && activeDays < c.minActiveDays) missingReasons.push(`Requires ${c.minActiveDays} Active Days`);
      if (c.minContribution && contribution < c.minContribution) missingReasons.push(`Requires ${c.minContribution} Contribution`);
      if (c.minReputation && reputation < c.minReputation) missingReasons.push(`Requires ${c.minReputation} Reputation`);
      if (c.minInfluence && influence < c.minInfluence) missingReasons.push(`Requires ${c.minInfluence} Influence`);
      if (c.isCreator && !userData.isCreator) missingReasons.push('Requires Creator status');
      if (c.isFounder && !userData.isFounder) missingReasons.push('Requires Founder status');
      if (c.isPioneer && !userData.isPioneer) missingReasons.push('Requires Pioneer status');

      eligible = missingReasons.length === 0;
    }

    if (!eligible) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Not eligible for title ${titleDef.name}: ${missingReasons.join(', ')}`
      );
    }

    const titleRef = db.doc(`titles/${uid}/items/${titleId}`);
    await titleRef.set({
      titleId,
      domain: titleDef.domain,
      name: titleDef.name,
      icon: titleDef.icon,
      description: titleDef.description,
      criteriaVersion: 1,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'system_provenance',
      status: 'active',
    }, { merge: true });

    return {
      success: true,
      title: {
        id: titleId,
        name: titleDef.name,
        domain: titleDef.domain,
        icon: titleDef.icon,
      },
    };
  });

/**
 * Set the user's active primary title displayed across profiles.
 * Verifies that the user actually owns the title.
 */
exports.setActiveTitle = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    const titleId = data && data.titleId;

    await checkRateLimit(uid, 'setActiveTitle', 30, 60000);

    const userRef = db.doc(`users/${uid}`);

    // If clearing title
    if (!titleId) {
      await userRef.set({
        primaryTitle: null,
        activeTitle: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return { success: true, activeTitle: null };
    }

    // Default 'resident' is always held by any citizen
    let titleData = null;
    if (titleId === 'resident') {
      titleData = TITLES_CATALOG.resident;
    } else {
      const titleSnap = await db.doc(`titles/${uid}/items/${titleId}`).get();
      if (!titleSnap.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'You have not unlocked this title');
      }
      titleData = titleSnap.data();
    }

    const activeTitle = {
      id: titleId,
      name: titleData.name,
      icon: titleData.icon,
      domain: titleData.domain,
    };

    await userRef.set({
      primaryTitle: titleData.name,
      activeTitle,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      activeTitle,
    };
  });

/**
 * Server-authoritative Creator Onboarding & Application.
 * Evaluates minimum eligibility gate before granting creator tier.
 */
exports.applyForCreator = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    await checkRateLimit(uid, 'applyForCreator', 10, 60000);

    const category = String(data?.category || 'General').slice(0, 50);
    const bio = String(data?.bio || '').slice(0, 300);
    const links = Array.isArray(data?.links) ? data.links.slice(0, 5) : [];

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userSnap.data() || {};
    const userLevel = Number(userData.level) || 1;

    // Minimum gate: level >= LEVEL_GATES.creatorProfile (Level 5)
    if (userLevel < LEVEL_GATES.creatorProfile) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Creator status requires Level ${LEVEL_GATES.creatorProfile} (Current: Level ${userLevel})`
      );
    }

    if (userData.policyStanding && userData.policyStanding !== 'good') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Your account must be in good policy standing to apply for Creator status.'
      );
    }

    const creatorProfileRef = db.doc(`creator_profiles/${uid}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await creatorProfileRef.set({
      uid,
      userId: uid,
      category,
      bio,
      links,
      tier: 'creator',
      status: 'approved',
      monetizationEligible: true,
      appliedAt: now,
      approvedAt: now,
      updatedAt: now,
    }, { merge: true });

    await userRef.set({
      isCreator: true,
      creatorTier: 'creator',
      creatorCategory: category,
      monetizationEligible: true,
      updatedAt: now,
    }, { merge: true });

    return {
      success: true,
      status: 'approved',
      tier: 'creator',
      category,
    };
  });

