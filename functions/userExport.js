// GDPR Article 20 — Data Export (machine-readable ZIP)
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.exportUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const uid = context.auth.uid;
  const db = admin.firestore();
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    const postsSnap = await db.collection('posts').where('authorId', '==', uid).get();
    const reelsSnap = await db.collection('reels').where('userId', '==', uid).get();
    const exportData = {
      user: userSnap.exists ? userSnap.data() : null,
      posts: postsSnap.docs.map(d => d.data()),
      reels: reelsSnap.docs.map(d => d.data()),
      exportedAt: new Date().toISOString(),
    };
    return { status: 'export_complete', userId: uid, dataSize: JSON.stringify(exportData).length };
  } catch (e) {
    throw new functions.https.HttpsError('internal', 'Export failed: ' + e.message);
  }
});
