// GDPR Article 17 — Data Deletion (soft delete + purge after 30 days)
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.deleteUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const uid = context.auth.uid;
  const db = admin.firestore();
  try {
    await db.collection('users').doc(uid).update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deleted: true,
      purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    return { status: 'deletion_queued', userId: uid, purgeAfterDays: 30, purgeAt: new Date(Date.now() + 30*24*60*60*1000).toISOString() };
  } catch (e) {
    throw new functions.https.HttpsError('internal', 'Deletion failed: ' + e.message);
  }
});
