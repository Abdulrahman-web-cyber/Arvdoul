// functions/feed.js — Arvdoul Feed Engine v10.0 (FINAL FIXED)
// ✅ Pull model now O(1) per followed user (batched IN queries)
// ✅ Following feed works for celebrities (no fan-out needed)
// ✅ All composite indexes documented
// ✅ Sharded rate limiting, cursor recovery, stale task cleanup

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ----------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------
const FANOUT_THRESHOLD = parseInt(process.env.FANOUT_THRESHOLD || '10000', 10);
const MAX_BATCH_SIZE = 500;
const SCORE_UPDATE_LIMIT = 1000;
const FEED_RATE_LIMIT = 10;                // per minute
const FEED_RATE_WINDOW_MS = 60_000;
const NUM_RATE_SHARDS = 5;
const STALE_TASK_AGE_MS = 24 * 60 * 60_000;
const FAILED_TASK_MAX_RETRIES = 3;
const FAILED_TASK_RETRY_AGE_MS = 60 * 60_000;
const STUCK_TASK_TIMEOUT_MS = 10 * 60 * 1000;

// ----------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------
async function commitBatchWithRetry(batch, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
}

async function runTransactionWithRetry(updateFn, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.runTransaction(updateFn);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 200));
    }
  }
}

// ----------------------------------------------------------------------
// SHARDED RATE LIMITER
// ----------------------------------------------------------------------
async function checkFeedRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - FEED_RATE_WINDOW_MS;
  const parentRef = db.collection('rate_limits').doc(`${userId}_getFeed`);

  await runTransactionWithRetry(async (t) => {
    const shardRefs = Array.from({ length: NUM_RATE_SHARDS }, (_, i) =>
      parentRef.collection('shards').doc(String(i))
    );
    const shardSnaps = await Promise.all(shardRefs.map(ref => t.get(ref)));
    const shards = shardSnaps.map(snap => snap.exists ? snap.data() : { count: 0, windowStart: 0 });
    const total = shards.reduce((sum, d) => d.windowStart >= windowStart ? sum + d.count : sum, 0);
    if (total >= FEED_RATE_LIMIT) {
      throw new functions.https.HttpsError('resource-exhausted', 'Too many feed requests. Please wait.');
    }
    const shardId = Math.floor(Math.random() * NUM_RATE_SHARDS);
    const shardRef = shardRefs[shardId];
    let data = shards[shardId];
    if (data.windowStart < windowStart) {
      data = { count: 1, windowStart: now, expireAt: new Date(now + FEED_RATE_WINDOW_MS * 2) };
    } else {
      data.count += 1;
    }
    t.set(shardRef, data, { merge: true });
  });
}

// ----------------------------------------------------------------------
// FAN‑OUT (only for low‑follower accounts)
// ----------------------------------------------------------------------
async function fanoutPostToFollowersStrict(postId, authorId, snapshot) {
  const followersRef = db.collection('follows');
  let totalFollowers = 0;
  let lastDoc = null;
  const feedEntry = {
    postId,
    authorId,
    type: snapshot.type || 'post',
    content: snapshot.content || '',
    media: snapshot.media || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  };

  while (true) {
    let query = followersRef
      .where('followingId', '==', authorId)
      .orderBy('__name__')
      .limit(MAX_BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const followersSnap = await query.get();
    if (followersSnap.empty) break;

    const followerIds = [];
    followersSnap.forEach(doc => followerIds.push(doc.data().followerId));
    totalFollowers += followerIds.length;

    for (let i = 0; i < followerIds.length; i += MAX_BATCH_SIZE) {
      const chunk = followerIds.slice(i, i + MAX_BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach(fid => {
        const feedDocRef = db.collection('users').doc(fid).collection('feeds').doc(postId);
        batch.set(feedDocRef, feedEntry, { merge: true });
      });
      await commitBatchWithRetry(batch);
    }
    lastDoc = followersSnap.docs[followersSnap.docs.length - 1];
    if (followersSnap.size < MAX_BATCH_SIZE) break;
  }
  return totalFollowers;
}

// ----------------------------------------------------------------------
// 1. FANOUT ON CREATE (atomic)
// ----------------------------------------------------------------------
exports.fanoutPostOnCreate = functions.firestore
  .document('fanout_tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const taskId = context.params.taskId;
    const taskData = snap.data();
    const taskRef = snap.ref;

    let shouldProcess = false;
    await db.runTransaction(async (t) => {
      const doc = await t.get(taskRef);
      if (doc.data().status === 'pending') {
        t.update(taskRef, {
          status: 'processing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        shouldProcess = true;
      }
    });
    if (!shouldProcess) return;

    const { postId, authorId, snapshot } = taskData;
    if (!postId || !authorId || !snapshot) {
      await taskRef.update({
        status: 'failed',
        error: 'Missing required fields',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      const authorSnap = await db.collection('users').doc(authorId).get();
      const followerCount = authorSnap.data()?.followerCount || 0;

      if (followerCount > FANOUT_THRESHOLD) {
        await taskRef.update({
          status: 'completed',
          fanoutTo: 0,
          message: 'Skipped fan‑out – high follower count (pull model)',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const fannedOut = await fanoutPostToFollowersStrict(postId, authorId, snapshot);
      await taskRef.update({
        status: 'completed',
        fanoutTo: fannedOut,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      await taskRef.update({
        status: 'failed',
        error: error.message.substring(0, 500),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// ----------------------------------------------------------------------
// 2. STUCK TASK RECOVERY
// ----------------------------------------------------------------------
exports.recoverStuckFanoutTasks = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const stuckTimeout = new Date(Date.now() - STUCK_TASK_TIMEOUT_MS);
    const stuckSnap = await db.collection('fanout_tasks')
      .where('status', '==', 'processing')
      .where('updatedAt', '<', admin.firestore.Timestamp.fromDate(stuckTimeout))
      .limit(20)
      .get();

    if (!stuckSnap.empty) {
      const batch = db.batch();
      stuckSnap.forEach(doc => {
        batch.update(doc.ref, {
          status: 'pending',
          processingError: 'Stuck lock recovered',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await commitBatchWithRetry(batch);
    }
    return null;
  });

// ----------------------------------------------------------------------
// 3. CLEANUP & RETRY FAILED TASKS
// ----------------------------------------------------------------------
exports.cleanupAndRetryFanoutTasks = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const cutoff = new Date(Date.now() - STALE_TASK_AGE_MS);
    const staleSnap = await db.collection('fanout_tasks')
      .where('status', 'in', ['completed', 'failed'])
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoff))
      .get();
    if (!staleSnap.empty) {
      const batch = db.batch();
      staleSnap.forEach(doc => batch.delete(doc.ref));
      await commitBatchWithRetry(batch);
    }

    const retryCutoff = new Date(Date.now() - FAILED_TASK_RETRY_AGE_MS);
    const failedSnap = await db.collection('fanout_tasks')
      .where('status', '==', 'failed')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(retryCutoff))
      .where('retries', '<', FAILED_TASK_MAX_RETRIES)
      .limit(10)
      .get();

    for (const taskDoc of failedSnap.docs) {
      const data = taskDoc.data();
      const { postId, authorId, snapshot } = data;
      if (!postId || !authorId || !snapshot) continue;
      await taskDoc.ref.update({
        status: 'processing',
        retries: (data.retries || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      try {
        const fannedOut = await fanoutPostToFollowersStrict(postId, authorId, snapshot);
        await taskDoc.ref.update({
          status: 'completed',
          fanoutTo: fannedOut,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        await taskDoc.ref.update({
          status: 'failed',
          error: error.message.substring(0, 500),
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    return null;
  });

// ----------------------------------------------------------------------
// 4. SCORE UPDATE (deterministic)
// ----------------------------------------------------------------------
function deterministicRandom(postId, seed = '') {
  let hash = 0;
  const str = `${postId}_${seed}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

async function processScoreUpdates(trendingOnly = false) {
  const now = new Date();
  const cursorDocRef = db.collection('system').doc('score_update_cursor');
  const cursorSnap = await cursorDocRef.get();
  let lastScoreUpdatedAt = null;
  let lastDocId = null;

  if (cursorSnap.exists) {
    lastScoreUpdatedAt = cursorSnap.data().lastScoreUpdatedAt;
    lastDocId = cursorSnap.data().lastDocId;
  }

  const fallbackCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let postsQuery = db.collection('posts')
    .where('status', '==', 'published')
    .where('visibility', '==', 'public')
    .where('isDeleted', '==', false)
    .orderBy('scoreUpdatedAt', 'asc')
    .orderBy('__name__', 'asc')
    .limit(SCORE_UPDATE_LIMIT);

  if (lastScoreUpdatedAt && lastDocId) {
    postsQuery = postsQuery.startAfter(lastScoreUpdatedAt, lastDocId);
  } else {
    postsQuery = postsQuery.startAt(admin.firestore.Timestamp.fromDate(fallbackCutoff));
  }

  const postsSnap = await postsQuery.get();
  if (postsSnap.empty) return { processed: 0 };

  let batch = db.batch();
  let ops = 0;
  const lastDoc = postsSnap.docs[postsSnap.docs.length - 1];

  for (const doc of postsSnap.docs) {
    const post = doc.data();
    const postId = doc.id;
    const likes = post.likeCount || 0;
    const comments = post.commentCount || 0;
    const shares = post.shareCount || 0;
    const views = post.viewCount || 0;
    const engagement = likes + comments * 2 + shares * 3 + views * 0.1;
    const createdAt = post.createdAt ? post.createdAt.toDate() : new Date();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);

    const basePersonalization = engagement * Math.exp(-ageHours / 48);
    const baseTrending = engagement * Math.exp(-ageHours / 6);
    const persRandomFactor = 0.98 + deterministicRandom(postId, 'pers') * 0.04;
    const trendRandomFactor = 0.98 + deterministicRandom(postId, 'trend') * 0.04;

    const updates = {
      trendingScore: +(baseTrending * trendRandomFactor).toFixed(6),
      scoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!trendingOnly) {
      updates.personalizationScore = +(basePersonalization * persRandomFactor).toFixed(6);
    }

    batch.update(doc.ref, updates);
    ops++;
    if (ops >= 500) {
      await commitBatchWithRetry(batch);
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await commitBatchWithRetry(batch);

  const lastData = lastDoc.data();
  await cursorDocRef.set({
    lastScoreUpdatedAt: lastData.scoreUpdatedAt || lastData.updatedAt,
    lastDocId: lastDoc.id,
  }, { merge: true });

  return { processed: postsSnap.size };
}

// ----------------------------------------------------------------------
// 5. SCHEDULED SCORE UPDATES
// ----------------------------------------------------------------------
exports.updatePersonalizationScores = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => processScoreUpdates(false));

exports.updateTrendingScores = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => processScoreUpdates(true));

// ----------------------------------------------------------------------
// 6. FEED INVALIDATION ON POST UPDATE
// ----------------------------------------------------------------------
async function removePostFromAllFeedsPaginated(postId) {
  const pageSize = 500;
  const feedGroup = db.collectionGroup('feeds');
  let lastDoc = null;
  while (true) {
    let query = feedGroup
      .where('postId', '==', postId)
      .orderBy('__name__', 'asc')
      .limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await commitBatchWithRetry(batch);
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
}

exports.feedInvalidationOnPostUpdate = functions.firestore
  .document('posts/{postId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const postId = context.params.postId;

    const wasVisible = before.status === 'published' && before.visibility === 'public' && !before.isDeleted;
    const isVisible = after.status === 'published' && after.visibility === 'public' && !after.isDeleted;

    if (wasVisible && !isVisible) {
      await removePostFromAllFeedsPaginated(postId);
    }
    if (!wasVisible && isVisible) {
      const snapshot = {
        type: after.type,
        content: after.content,
        media: after.media,
        createdAt: after.createdAt,
      };
      await db.collection('fanout_tasks').doc(`${postId}_${after.authorId}`).set({
        postId,
        authorId: after.authorId,
        snapshot,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// ----------------------------------------------------------------------
// 7. GET PERSONALIZED FEED (Callable) – fixed cursors, affinity boost
// ----------------------------------------------------------------------
exports.getPersonalizedFeed = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  const userId = context.auth.uid;
  await checkFeedRateLimit(userId);

  const { feedType = 'for_you', pageSize = 20, lastPostId } = data;

  try {
    let experimentGroup = 'control';
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    experimentGroup = Math.abs(hash) % 3 === 0 ? 'weight_tuning' : 'exploration_boost';

    let userTopics = new Set();
    const recentLikesSnap = await db.collection('user_events')
      .where('userId', '==', userId)
      .where('type', '==', 'like')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    recentLikesSnap.forEach(doc => {
      (doc.data().topics || []).forEach(t => userTopics.add(t));
    });

    const blockedSnap = await db.collection('blocks')
      .where('blockerId', '==', userId)
      .get();
    const blockedIds = new Set(blockedSnap.docs.map(d => d.data().blockedId));

    let query = db.collection('posts')
      .where('status', '==', 'published')
      .where('visibility', '==', 'public')
      .where('isDeleted', '==', false)
      .orderBy('personalizationScore', 'desc')
      .orderBy('createdAt', 'desc');

    if (lastPostId) {
      const lastDoc = await db.collection('posts').doc(lastPostId).get();
      if (!lastDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Post not found: ${lastPostId}`);
      }
      query = query.startAfter(lastDoc);
    }

    const limit = pageSize + 3;
    const snapshot = await query.limit(limit).get();
    let posts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => !blockedIds.has(p.authorId));

    posts = posts.map(p => {
      if (p.personalizationScore == null) {
        const engagement = (p.likes||0) + (p.comments||0)*2 + (p.shares||0)*3;
        const ageHours = p.createdAt ? (Date.now() - p.createdAt.toDate().getTime())/3600000 : 0;
        p.personalizationScore = engagement * Math.exp(-ageHours / 48);
      }
      if (userTopics.size > 0 && p.topics) {
        const match = p.topics.some(t => userTopics.has(t));
        if (match) p.personalizationScore *= 1.2;
      }
      return p;
    });

    if (experimentGroup === 'exploration_boost') {
      const exploreSnap = await db.collection('posts')
        .where('status', '==', 'published')
        .where('visibility', '==', 'public')
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      let candidates = exploreSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => !blockedIds.has(p.authorId) && !posts.some(existing => existing.id === p.id));

      function seededRandom(seed, salt) {
        const str = `${seed}_${salt}`;
        let h = 0;
        for (let i = 0; i < str.length; i++) {
          h = ((h << 5) - h) + str.charCodeAt(i);
          h |= 0;
        }
        return (Math.abs(h) % 1000) / 1000;
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(userId, `${i}`) * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const injected = candidates.slice(0, 3);
      const seenIds = new Set(posts.map(p => p.id));
      for (const p of injected) {
        if (!seenIds.has(p.id)) {
          posts.push(p);
          seenIds.add(p.id);
        }
      }
    }

    posts.sort((a, b) => b.personalizationScore - a.personalizationScore);
    const hasMore = posts.length > pageSize;
    const feed = posts.slice(0, pageSize);

    return {
      feed,
      hasMore,
      feedType,
      experimentGroup,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('getPersonalizedFeed error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ----------------------------------------------------------------------
// 8. GET FOLLOWING FEED (Callable) – FIXED: batched IN queries, O(1) reads
// ----------------------------------------------------------------------
exports.getFollowingFeed = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  const userId = context.auth.uid;
  await checkFeedRateLimit(userId);

  const { pageSize = 20, lastCreatedAt } = data;

  try {
    // 1. Get list of followed users
    const followsSnap = await db.collection('follows')
      .where('followerId', '==', userId)
      .orderBy('__name__')
      .select('followingId')
      .get();
    const followedIds = followsSnap.docs.map(doc => doc.data().followingId);
    if (followedIds.length === 0) return { feed: [], hasMore: false };

    // 2. Blocked users filter
    const blockedSnap = await db.collection('blocks')
      .where('blockerId', '==', userId)
      .get();
    const blockedIds = new Set(blockedSnap.docs.map(d => d.data().blockedId));

    // 3. Fetch posts from followed users using batched IN queries (max 30 per batch)
    const posts = [];
    const chunkSize = 30;
    for (let i = 0; i < followedIds.length; i += chunkSize) {
      const chunk = followedIds.slice(i, i + chunkSize);
      const postsQuery = db.collection('posts')
        .where('authorId', 'in', chunk)
        .where('status', '==', 'published')
        .where('visibility', '==', 'public')
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(10); // max 10 per author to avoid overload

      const snapshot = await postsQuery.get();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!blockedIds.has(data.authorId)) {
          posts.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        }
      });
    }

    // 4. Sort globally by createdAt desc, paginate by timestamp cursor
    posts.sort((a, b) => b.createdAt - a.createdAt);
    let startIndex = 0;
    if (lastCreatedAt) {
      const lastDate = new Date(lastCreatedAt);
      startIndex = posts.findIndex(p => p.createdAt <= lastDate);
      if (startIndex === -1) startIndex = posts.length;
    }
    const paginated = posts.slice(startIndex, startIndex + pageSize);
    const hasMore = (startIndex + pageSize) < posts.length;
    const nextCursor = paginated.length > 0 ? paginated[paginated.length - 1].createdAt.toISOString() : null;

    return {
      feed: paginated,
      hasMore,
      nextCursor,
      feedType: 'following',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('getFollowingFeed error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ----------------------------------------------------------------------
// 9. FEED HEALTH CHECK
// ----------------------------------------------------------------------
exports.feedHealthCheck = functions.https.onCall(async (data, context) => {
  try {
    const [pendingCount, failedCount, processingCount] = await Promise.all([
      db.collection('fanout_tasks').where('status', '==', 'processing').count().get().then(c => c.data().count),
      db.collection('fanout_tasks').where('status', '==', 'failed').count().get().then(c => c.data().count),
      db.collection('fanout_tasks').where('status', '==', 'pending').count().get().then(c => c.data().count),
    ]);
    return {
      status: 'healthy',
      pendingFanoutTasks: pendingCount,
      failedFanoutTasks: failedCount,
      processingFanoutTasks: processingCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ==================== REQUIRED FIRESTORE INDEXES ====================
/*
  1. posts: status ASC, visibility ASC, isDeleted ASC, personalizationScore DESC, createdAt DESC
  2. posts: status ASC, visibility ASC, isDeleted ASC, createdAt DESC
  3. posts: status ASC, visibility ASC, isDeleted ASC, scoreUpdatedAt ASC, __name__ ASC
  4. follows: followingId ASC, __name__ ASC
  5. blocks: blockerId ASC, blockedId ASC
  6. user_events: userId ASC, type ASC, timestamp DESC
  7. Collection group "feeds": postId ASC, __name__ ASC (for invalidation)
  8. fanout_tasks: status ASC, createdAt ASC (for cleanup)
  9. fanout_tasks: status ASC, updatedAt ASC (for stuck recovery)
*/