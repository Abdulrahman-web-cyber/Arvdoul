// functions/notificationWriter.js — trusted server-side in-app notification writes.
//
// `sendNotification` is a client callable with a type allowlist, so a client
// cannot mint a system/financial notification (gift received, payout,
// verification, security alert). A Cloud Function that has *proved* the event
// writes the in-app record through this helper instead, keeping the unread
// counter in step. Helper-only module (no triggers), like auth.js/pushQueue.js.

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

const NOTIFICATION_SHARDS = 10;

/**
 * Write an in-app notification for `recipientId` and bump their unread shard.
 *
 * @param {string} recipientId
 * @param {object} notificationDoc type/title/message/senderId/senderName/metadata/id
 * @returns {Promise<string>} the notification id
 */
async function writeNotification(recipientId, notificationDoc = {}) {
  if (!recipientId) throw new Error('writeNotification requires a recipientId');
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const notificationId = notificationDoc.id || uuidv4();

  await db.collection('users').doc(recipientId).collection('notifications').doc(notificationId).set({
    id: notificationId,
    type: notificationDoc.type || 'system',
    title: notificationDoc.title || 'Notification',
    message: notificationDoc.message || '',
    read: false,
    clicked: false,
    senderId: notificationDoc.senderId || null,
    senderName: notificationDoc.senderName || null,
    metadata: notificationDoc.metadata || {},
    createdAt: FieldValue.serverTimestamp(),
  });

  const shardIndex = Math.floor(Math.random() * NOTIFICATION_SHARDS);
  await db.collection('notification_counters').doc(`${recipientId}_shard_${shardIndex}`)
    .set({ count: FieldValue.increment(1) }, { merge: true });

  return notificationId;
}

module.exports = { writeNotification, NOTIFICATION_SHARDS };
