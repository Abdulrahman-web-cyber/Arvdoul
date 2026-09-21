// GDPR Article 20 - Data Export.
//
// Portability requires the subject receive the personal data itself, so this
// returns the collected data. The client writes the response to a downloadable
// JSON file. A size-only response would hand the user an empty export.
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkRateLimit } = require('./rateLimit');

// Upper bound per collection. Keeps the response inside the callable payload
// limit and bounds memory for very active accounts.
const MAX_DOCS_PER_COLLECTION = 2000;

async function collectWhere(db, collection, field, value, limit) {
  const snap = await db
    .collection(collection)
    .where(field, '==', value)
    .limit(limit)
    .get()
    .catch(() => null);
  return snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
}

async function collectSub(db, collection, docId, sub) {
  const snap = await db
    .collection(collection)
    .doc(docId)
    .collection(sub)
    .limit(MAX_DOCS_PER_COLLECTION)
    .get()
    .catch(() => null);
  return snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
}

exports.exportUserData = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const uid = context.auth.uid;
    await checkRateLimit(uid, 'exportUserData', 1, 300000); // max 1 export / 5 min

    const db = admin.firestore();
    const lim = MAX_DOCS_PER_COLLECTION;

    try {
      const userSnap = await db.collection('users').doc(uid).get().catch(() => null);
      const settingsSnap = await db.collection('user_settings').doc(uid).get().catch(() => null);

      const [
        posts, videos, comments, stories, highlights, reels,
        following, followers, blocks, savedPosts, likedPosts,
      ] = await Promise.all([
        collectWhere(db, 'posts', 'authorId', uid, lim),
        collectWhere(db, 'videos', 'userId', uid, lim),
        collectWhere(db, 'comments', 'authorId', uid, lim),
        collectWhere(db, 'stories', 'userId', uid, lim),
        collectWhere(db, 'highlights', 'userId', uid, lim),
        collectWhere(db, 'reels', 'userId', uid, lim),
        collectWhere(db, 'follows', 'followerId', uid, lim),
        collectWhere(db, 'follows', 'followingId', uid, lim),
        collectWhere(db, 'blocks', 'blockerId', uid, lim),
        collectSub(db, 'users', uid, 'saved_posts'),
        collectSub(db, 'users', uid, 'liked_posts'),
      ]);

      return {
        status: 'export_complete',
        userId: uid,
        exportedAt: new Date().toISOString(),
        data: {
          profile: userSnap && userSnap.exists ? { id: uid, ...userSnap.data() } : null,
          settings: settingsSnap && settingsSnap.exists ? settingsSnap.data() : null,
          posts,
          videos,
          comments,
          stories,
          highlights,
          reels,
          following,
          followers,
          blockedUsers: blocks.map(b => b.blockedId).filter(Boolean),
          savedPosts,
          likedPosts,
        },
      };
    } catch (e) {
      throw new functions.https.HttpsError('internal', 'Export failed: ' + e.message);
    }
  });
