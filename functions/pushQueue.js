// functions/pushQueue.js — SINGLE SOURCE OF TRUTH for push dispatch.
//
// Previously comments.js, messaging.js, monetization.js and video.js each
// carried their own copy of the Cloud Tasks enqueue logic (with drifting retry
// config and a fabricated `https://example.com/push` worker fallback that would
// silently POST notifications into the void). Every module now calls this one
// implementation.
//
// Delivery contract:
//   - When PUSH_WORKER_URL is configured, the task is enqueued to Cloud Tasks
//     with bounded retries and OIDC auth.
//   - When it is NOT configured, or Cloud Tasks rejects the task, the payload
//     is written to the `push_queue` collection, where the
//     sendPushNotification trigger and the retry scheduler pick it up. A push
//     is therefore never dropped and never sent to a made-up endpoint.

const { CloudTasksClient } = require('@google-cloud/tasks');
const admin = require('firebase-admin');

const PUSH_QUEUE_COLLECTION = 'push_queue';

let tasksClient = null;
function getTasksClient() {
  if (!tasksClient) tasksClient = new CloudTasksClient();
  return tasksClient;
}

function getPushQueueConfig() {
  return {
    projectId: process.env.GCLOUD_PROJECT,
    location: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
    queueName: process.env.PUSH_QUEUE_NAME || 'push-queue',
    workerUrl: process.env.PUSH_WORKER_URL || null,
  };
}

/** Durable fallback: persist the push so the queue trigger retries it. */
async function persistPushTask(userId, payload) {
  await admin.firestore().collection(PUSH_QUEUE_COLLECTION).add({
    userId,
    payload,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Enqueue a push notification for `userId`.
 *
 * @param {string} userId  Recipient uid.
 * @param {object} payload Notification payload (type, senderId, title, ...).
 * @returns {Promise<{ queued: 'cloud_tasks'|'firestore' }>}
 */
async function enqueuePush(userId, payload) {
  if (!userId) throw new Error('enqueuePush requires a userId');

  const { projectId, location, queueName, workerUrl } = getPushQueueConfig();

  if (workerUrl) {
    try {
      const client = getTasksClient();
      const parent = client.queuePath(projectId, location, queueName);
      const task = {
        httpRequest: {
          httpMethod: 'POST',
          url: workerUrl,
          body: Buffer.from(JSON.stringify({ userId, payload })).toString('base64'),
          headers: { 'Content-Type': 'application/json' },
          oidcToken: { serviceAccountEmail: `${projectId}@appspot.gserviceaccount.com` },
        },
        retryConfig: {
          maxAttempts: 5,
          maxBackoff: '60s',
          minBackoff: '1s',
          maxDoublings: 5,
        },
      };
      await client.createTask({ parent, task });
      return { queued: 'cloud_tasks' };
    } catch (error) {
      console.warn('Cloud Tasks enqueue failed, falling back to Firestore queue:', error.message);
    }
  }

  await persistPushTask(userId, payload);
  return { queued: 'firestore' };
}

module.exports = {
  enqueuePush,
  persistPushTask,
  getPushQueueConfig,
  PUSH_QUEUE_COLLECTION,
};
