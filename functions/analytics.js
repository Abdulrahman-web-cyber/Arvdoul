// functions/analytics.js — server-authoritative profile view analytics.
//
// Before this module existed the client wrote `profile_views` and
// `profile_analytics` directly. The rules permitted any signed-in user to
// create/increment another creator's daily stats and to mint arbitrary view
// documents (audit N010/N019), so a single account could inflate a profile's
// reach without bound. Views are now counted here:
//   * the daily marker and the owner's daily stats are claimed in ONE
//     transaction, so concurrent tabs cannot double-count a viewer;
//   * the per-viewer rate limit is enforced server-side;
//   * blocked viewers are not counted;
//   * totals are written to the same `counter_shards` layout the client's
//     CountersManager reads, so `getUserAnalytics` needs no change.
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getUserIdFromContext } = require('./auth');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const COUNTER_SHARDS_COLLECTION = 'counter_shards';
const COUNTER_SHARDS = 10;
const MAX_VIEWS_PER_MINUTE = 120;

// Must stay byte-identical to hashString() in src/utils/CountersManager.js:
// both sides derive the shard document id from the logical doc path.
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function shardRef(docPath, field, shardIndex) {
  return db.collection(COUNTER_SHARDS_COLLECTION)
    .doc(`${hashString(docPath)}__${field}__${shardIndex}`);
}

async function incrementShardedCounter(docPath, field, amount = 1) {
  const shardIndex = Math.floor(Math.random() * COUNTER_SHARDS);
  await shardRef(docPath, field, shardIndex)
    .set({ value: FieldValue.increment(amount) }, { merge: true });
}

exports.trackProfileView = functions.https.onCall(async (data, context) => {
  const viewerId = getUserIdFromContext(context);
  const { profileOwnerId } = data || {};
  if (!profileOwnerId || typeof profileOwnerId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'profileOwnerId is required.');
  }
  // Self-views are never counted.
  if (profileOwnerId === viewerId) return { success: true, counted: false };

  await checkRateLimit(viewerId, 'trackProfileView', MAX_VIEWS_PER_MINUTE, 60000);

  // A block is mutual and absolute: a blocked viewer's visit is not analytics.
  const blocked = await db.doc(`blocks/${viewerId}_${profileOwnerId}`).get();
  if (blocked.exists) return { success: true, counted: false };

  const today = new Date().toISOString().slice(0, 10);
  const viewId = `${viewerId}_${profileOwnerId}_${today}`;
  const viewRef = db.collection('profile_views').doc(viewId);
  const analyticsRef = db.collection('profile_analytics').doc(profileOwnerId);

  const counted = await db.runTransaction(async (transaction) => {
    const viewSnap = await transaction.get(viewRef);
    if (viewSnap.exists) return false;

    // Firestore requires every read before the first write; the previous order
    // read `analyticsRef` AFTER `transaction.set(viewRef, …)`, so the SDK threw
    // ("transactions require all reads before all writes") and profile views
    // were never counted.
    const analyticsSnap = await transaction.get(analyticsRef);

    transaction.set(viewRef, {
      viewerId,
      profileOwnerId,
      date: today,
      viewedAt: FieldValue.serverTimestamp(),
    });

    if (!analyticsSnap.exists) {
      transaction.set(analyticsRef, {
        // `totalEngagement`/`coinsEarned` are NOT seeded: no writer ever
        // increments them, so a `0` seed made every creator read a fabricated
        // measured "0 coins earned" / "0 engagement". The client derives both
        // live (wallet balance + recent-post engagement). See
        // analyticsService.getUserAnalytics.
        //
        // Per-day `engagement`/`coins` are NOT seeded either, for the same
        // reason: only `views`/`reach` are ever incremented below, so a seeded
        // `engagement: 0` / `coins: 0` rendered as a measured flat zero
        // sparkline. The daily series carries only the counters this path
        // actually maintains; a day with no engagement reading stays absent
        // (the client renders an explicit "no trend data" placeholder).
        dailyStats: { [today]: { views: 1, reach: 1 } },
        topPosts: [],
        // No writer maintains a growth rate or an active-day count on this
        // doc; seeding `growthRate: 0` / `activeDays: 1` fabricated a measured
        // trend (and the canonical active days live on `users/{uid}`).
        demographics: { ageGroups: {}, gender: {}, locations: {}, interests: {} },
        lastUpdated: FieldValue.serverTimestamp(),
      });
    } else {
      const existing = analyticsSnap.data();
      const dailyStats = existing.dailyStats || {};
      const todayStats = dailyStats[today] || { views: 0, reach: 0 };
      transaction.update(analyticsRef, {
        [`dailyStats.${today}`]: {
          views: (todayStats.views || 0) + 1,
          reach: (todayStats.reach || 0) + 1,
        },
        lastUpdated: FieldValue.serverTimestamp(),
      });
    }
    return true;
  });

  if (counted) {
    const docPath = `profile_analytics/${profileOwnerId}`;
    await Promise.all([
      incrementShardedCounter(docPath, 'totalViews'),
      incrementShardedCounter(docPath, 'totalReach'),
    ]);
  }

  return { success: true, counted };
});

  // ---------------------------------------------------------------------
  // Post view analytics — server-authoritative, mirroring trackProfileView.
  //
  // `posts/{postId}/view_shards`, `/view_aggregate` and `/daily_stats` are not
  // writable by clients (the posts `{subcollection}` rule binds every child id
  // to the caller's uid), so a client `recordPostView` was always denied and
  // the author analytics panel could only ever read 0 views. Counting lives
  // here instead:
  //   * one view per (post, viewer) per day, claimed in a transaction;
  //   * the author's own views are never counted;
  //   * blocked viewers are not counted;
  //   * the total is written to the same `counter_shards` layout the client's
  //     CountersManager reads, so `getPostAnalytics` needs no change.
  const MAX_POST_VIEWS_PER_MINUTE = 240;

  exports.recordPostView = functions.https.onCall(async (data, context) => {
    const viewerId = getUserIdFromContext(context);
    const { postId } = data || {};
    if (!postId || typeof postId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
    }

    await checkRateLimit(viewerId, 'recordPostView', MAX_POST_VIEWS_PER_MINUTE, 60000);

    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return { success: true, counted: false };

    const authorId = postSnap.data().authorId;
    // Self-views are never counted.
    if (authorId && authorId === viewerId) return { success: true, counted: false };

    // A block is mutual and absolute: a blocked viewer's visit is not analytics.
    if (authorId) {
      const blocked = await db.doc(`blocks/${viewerId}_${authorId}`).get();
      if (blocked.exists) return { success: true, counted: false };
    }

    const today = new Date().toISOString().slice(0, 10);
    const viewerRef = postRef.collection('viewers').doc(viewerId);
    const dailyStatRef = postRef.collection('daily_stats').doc(today);

    const counted = await db.runTransaction(async (transaction) => {
      const viewerSnap = await transaction.get(viewerRef);
      if (viewerSnap.exists) return false;

      // All reads before all writes (see trackProfileView above): the daily-stat
      // read must precede the `viewerRef` set or the SDK throws and post views
      // are never counted.
      const dailySnap = await transaction.get(dailyStatRef);

      transaction.set(viewerRef, { userId: viewerId, viewedAt: FieldValue.serverTimestamp() });

      if (!dailySnap.exists) {
        transaction.set(dailyStatRef, {
          date: today,
          views: 1,
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.update(dailyStatRef, { views: FieldValue.increment(1) });
      }
      return true;
    });

    if (counted) {
      await incrementShardedCounter(`posts/${postId}`, 'views');
    }

    return { success: true, counted };
  });

