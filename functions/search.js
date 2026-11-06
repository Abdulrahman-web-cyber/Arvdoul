// functions/search.js — real-time Algolia indexing
//
// Firestore triggers for users, posts, and videos keep Algolia in sync with
// partial updates, retries, and structured logging. Also provides a batch
// reindex function and a dead-letter queue for failed indexing. No reads
// inside loops; all writes are batched.
//
// Required configuration:
//   firebase functions:config:set algolia.app_id="YOUR_APP_ID" algolia.admin_key="YOUR_ADMIN_API_KEY"
//
// Required Algolia indices (create in dashboard):
//   - users
//   - posts
//   - videos
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

if (!admin.apps.length) {
  admin.initializeApp();
}

// ----------------------------------------------------------------------
//  ALGOLIA CLIENT & INDICES
// ----------------------------------------------------------------------
const ALGOLIA_APP_ID = functions.config().algolia?.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia?.admin_key;

let client = null;
let userIndex = null;
let postIndex = null;
let videoIndex = null;

if (ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY) {
  try {
    client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
    userIndex = client.initIndex('users');
    postIndex = client.initIndex('posts');
    videoIndex = client.initIndex('videos');
  } catch (err) {
    console.error('Algolia client initialization failed:', err.message);
  }
} else {
  console.warn(
    'Missing Algolia configuration (algolia.app_id / algolia.admin_key). ' +
    'Real‑time indexing is disabled. Set via firebase functions:config:set.'
  );
}

// ----------------------------------------------------------------------
//  STRUCTURED LOGGING
// ----------------------------------------------------------------------
function log(severity, message, data = {}) {
  console.log(JSON.stringify({
    severity: severity.toUpperCase(),
    message,
    ...data,
    timestamp: new Date().toISOString(),
  }));
}

// ----------------------------------------------------------------------
//  RETRY HELPER – exponential backoff with jitter, max 3 attempts
// ----------------------------------------------------------------------
async function saveOrDeleteWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await operation();
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        log('error', 'Algolia operation failed after max retries', {
          error: error.message,
          attempt,
        });
        // Write to dead‑letter queue for manual recovery
        await admin.firestore().collection('algolia_dead_letter').add({
          error: error.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          operation: operation.toString(),
        });
        return;
      }
      const delay = Math.pow(2, attempt) * 500 + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ----------------------------------------------------------------------
//  HELPER: convert Firestore Timestamp to Unix seconds (number)
// ----------------------------------------------------------------------
function toUnixTimestamp(timestamp) {
  if (timestamp && typeof timestamp.toMillis === 'function') {
    return Math.floor(timestamp.toMillis() / 1000);
  }
  return 0;
}

// ----------------------------------------------------------------------
//  HELPER: build index records (shared by triggers and the full reindex so
//  the two can never drift)
// ----------------------------------------------------------------------
function isPostIndexable(data) {
  return Boolean(data && data.status === 'published' && data.visibility === 'public' && data.isDeleted !== true);
}

function buildPostRecord(postId, data) {
  let thumbnail = null;
  if (Array.isArray(data.media) && data.media.length > 0) {
    const first = data.media[0];
    thumbnail = typeof first === 'string' ? first : first?.url || first?.path || null;
  }
  const likeCount = data.stats?.likes || 0;
  const commentCount = data.stats?.comments || 0;
  return {
    objectID: postId,
    content: data.content || '',
    type: data.type || 'post',
    mediaThumbnail: thumbnail,
    authorId: data.authorId || '',
    authorName: data.authorName || '',
    hashtags: data.hashtags || [],
    tags: data.tags || [],
    likeCount,
    commentCount,
    engagementScore: likeCount * 2 + commentCount * 3,
    personalizationScore: data.personalizationScore || 0,
    createdAt: toUnixTimestamp(data.createdAt),
    updatedAt: toUnixTimestamp(data.updatedAt || data.createdAt),
  };
}

function isVideoIndexable(data) {
  return Boolean(data && data.status === 'ready' && data.visibility === 'public' && data.isDeleted !== true);
}

function buildVideoRecord(videoId, data) {
  const views = data.stats?.views || 0;
  const likes = data.stats?.likes || 0;
  return {
    objectID: videoId,
    title: data.title || 'Untitled',
    description: data.description || '',
    tags: data.tags || [],
    category: data.tags?.[0] || data.category || 'General',
    duration: data.duration || 0,
    views,
    likes,
    thumbnailUrl: data.thumbnailUrl || null,
    rankingScore: data.rankingScore || 0,
    engagementScore: views + likes * 5,
    createdAt: toUnixTimestamp(data.createdAt),
    updatedAt: toUnixTimestamp(data.updatedAt || data.createdAt),
  };
}

function buildUserRecord(userId, data) {
  return {
    objectID: userId,
    username: data.username || '',
    displayName: data.displayName || '',
    bio: data.bio || '',
    photoURL: data.photoURL || null,
    followerCount: data.followerCount || 0,
    isVerified: !!data.isVerified,
    isCreator: !!data.isCreator,
    location: data.location || '',
    createdAt: toUnixTimestamp(data.createdAt),
    updatedAt: toUnixTimestamp(data.updatedAt || data.createdAt),
  };
}

// ----------------------------------------------------------------------
//  1. indexUser – triggered on users/{userId}
// ----------------------------------------------------------------------
exports.indexUser = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    if (!client) return;

    const userId = context.params.userId;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!afterData) {
      log('info', `Deleting user from Algolia: ${userId}`);
      await saveOrDeleteWithRetry(() => userIndex.deleteObject(userId));
      return;
    }

    const record = buildUserRecord(userId, afterData);

    log('info', `Saving user to Algolia (partial update): ${userId}`);
    await saveOrDeleteWithRetry(() =>
      userIndex.partialUpdateObject(record, { createIfNotExists: true })
    );
  });

// ----------------------------------------------------------------------
//  2. indexPost – triggered on posts/{postId}
// ----------------------------------------------------------------------
exports.indexPost = functions.firestore
  .document('posts/{postId}')
  .onWrite(async (change, context) => {
    if (!client) return;

    const postId = context.params.postId;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!isPostIndexable(afterData)) {
      log('info', `Removing post from Algolia: ${postId}`);
      await saveOrDeleteWithRetry(() => postIndex.deleteObject(postId));
      return;
    }

    const record = buildPostRecord(postId, afterData);

    log('info', `Saving post to Algolia (partial update): ${postId}`);
    await saveOrDeleteWithRetry(() =>
      postIndex.partialUpdateObject(record, { createIfNotExists: true })
    );
  });

// ----------------------------------------------------------------------
//  3. indexVideo – triggered on videos/{videoId}
// ----------------------------------------------------------------------
exports.indexVideo = functions.firestore
  .document('videos/{videoId}')
  .onWrite(async (change, context) => {
    if (!client) return;

    const videoId = context.params.videoId;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!isVideoIndexable(afterData)) {
      log('info', `Removing video from Algolia: ${videoId}`);
      await saveOrDeleteWithRetry(() => videoIndex.deleteObject(videoId));
      return;
    }

    const record = buildVideoRecord(videoId, afterData);

    log('info', `Saving video to Algolia (partial update): ${videoId}`);
    await saveOrDeleteWithRetry(() =>
      videoIndex.partialUpdateObject(record, { createIfNotExists: true })
    );
  });

// ----------------------------------------------------------------------
//  4. batchReindex – scheduled function to rebuild indices (every 24h)
// ----------------------------------------------------------------------
exports.batchReindex = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    if (!client) return;

    log('info', 'Starting scheduled reindex');
    const firestore = admin.firestore();
    const PAGE = 500;

    const usersSnap = await firestore.collection('users').limit(PAGE).get();
    const userRecords = usersSnap.docs.map((doc) => buildUserRecord(doc.id, doc.data()));
    if (userRecords.length) {
      await saveOrDeleteWithRetry(() => userIndex.saveObjects(userRecords));
    }

    const postsSnap = await firestore.collection('posts').limit(PAGE).get();
    const postRecords = postsSnap.docs
      .filter((doc) => isPostIndexable(doc.data()))
      .map((doc) => buildPostRecord(doc.id, doc.data()));
    if (postRecords.length) {
      await saveOrDeleteWithRetry(() => postIndex.saveObjects(postRecords));
    }

    const videosSnap = await firestore.collection('videos').limit(PAGE).get();
    const videoRecords = videosSnap.docs
      .filter((doc) => isVideoIndexable(doc.data()))
      .map((doc) => buildVideoRecord(doc.id, doc.data()));
    if (videoRecords.length) {
      await saveOrDeleteWithRetry(() => videoIndex.saveObjects(videoRecords));
    }

    log('info', 'Reindex completed', {
      users: userRecords.length,
      posts: postRecords.length,
      videos: videoRecords.length,
    });
    return null;
  });