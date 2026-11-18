// functions/userDeleteWorker.js — Cloud Tasks worker that resumes an account
// deletion cascade that exceeded the per-call document budget.
//
// `functions/user.js#deleteUserData` performs the cascade directly and offloads
// to a Cloud Task (targeting this worker via `DELETION_WORKER_URL`) once it has
// removed 2000 documents. Before this module existed there was NO worker at any
// URL: `enqueueDeletionTask` returned silently when `DELETION_WORKER_URL` was
// unset, so the callable reported `partial_with_offload` while the remaining
// collections were never cleaned. This worker shares the cascade implementation
// (`runUserDataDeletion`) and is invoked in-process — never via a fetch back to
// the callable, which would be rejected (a callable needs the JSON `data`
// envelope and an ID token).
const functions = require('firebase-functions');
const { log } = require('./logger');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const projectId = process.env.GCLOUD_PROJECT;
const deletionWorkerUrl =
  process.env.DELETION_WORKER_URL || `https://us-central1-${projectId}.cloudfunctions.net/processDeletionTask`;

// Verifies the Google-signed OIDC token that Cloud Tasks attaches to a queued
// request (see `enqueueDeletionTask`). An ID token cannot be used here: the
// queue mints an OIDC token, not a Firebase ID token.
const oauthClient = new OAuth2Client();
async function assertOidcTask(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw new Error('missing bearer token');
  }
  const ticket = await oauthClient.verifyIdToken({
    idToken: header.slice('Bearer '.length),
    audience: process.env.CLOUD_TASKS_OIDC_AUDIENCE || deletionWorkerUrl,
  });
  const payload = ticket.getPayload();
  const expectedSa = `${projectId}@appspot.gserviceaccount.com`;
  if (payload?.email !== expectedSa) {
    throw new Error(`unexpected task identity: ${payload?.email}`);
  }
}

// Lazy require: user.js also requires ./auth and firebase-admin; requiring it at
// module load is fine, but keep the reference local so a future refactor of the
// export surface is a one-line change here.
function getCascade() {
  // eslint-disable-next-line global-require
  const { runUserDataDeletion } = require('./user.js');
  return runUserDataDeletion;
}

exports.processDeletionTask = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    try {
      await assertOidcTask(req);
    } catch (err) {
      log('warn', 'Rejected deletion task request', { error: err.message });
      res.status(403).send('Forbidden');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { userId } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }

    try {
      const result = await getCascade()(userId);
      // A cascade that again exceeds the budget re-enqueues itself (see
      // enqueueDeletionTask inside runUserDataDeletion), so `partial_with_offload`
      // here just means another task is already queued.
      log('info', 'Deletion task processed', { userId, status: result.status, totalDeleted: result.totalDeleted });
      res.status(200).json(result);
    } catch (err) {
      log('error', 'Deletion task failed', { userId, error: err.message });
      // Non-2xx so Cloud Tasks retries per the queue's retry policy.
      res.status(500).json({ error: 'Deletion task failed' });
    }
  });

// Marks a `deletion_tasks` fallback row as consumed. Exposed for an operator
// drain path; kept separate from the trigger so it can be called in-process.
exports.markDeletionTaskDone = async (docId) => {
  await db.collection('deletion_tasks').doc(docId).set(
    { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
};
