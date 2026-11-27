// functions/stories.js — stories callables and triggers
//
// Hybrid fan-out, atomic moderation, and async video moderation driven by
// operation.promise() with a timeout (no busy polling). Includes recovery for
// stories stuck in 'processing', sharded counters, cleanup jobs, and retry
// handling. Cloud Tasks requests are secured with OIDC (the token the queue
// actually mints) and fanout tasks are deduplicated by task name.
const functions = require('firebase-functions');
const { log } = require('./logger');
const admin = require('firebase-admin');
const { CloudTasksClient } = require('@google-cloud/tasks');
const { OAuth2Client } = require('google-auth-library');
const videoIntelligence = require('@google-cloud/video-intelligence').v1;
const fetch = require('node-fetch');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const tasksClient = new CloudTasksClient();
const videoClient = new videoIntelligence.VideoIntelligenceServiceClient();
const bucket = admin.storage().bucket();

// Verifies the Google-signed OIDC token that Cloud Tasks attaches to a queued
// request (the `oidcToken` on the task, see enqueueModerationTask). An ID token
// cannot be used here: the queue mints an OIDC token, not a Firebase ID token.
const oauthClient = new OAuth2Client();
async function assertOidcTask(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw new Error('missing bearer token');
  }
  const ticket = await oauthClient.verifyIdToken({
    idToken: header.slice('Bearer '.length),
    audience: process.env.CLOUD_TASKS_OIDC_AUDIENCE || videoModerationUrl,
  });
  const payload = ticket.getPayload();
  const expectedSa = `${projectId}@appspot.gserviceaccount.com`;
  if (payload?.email !== expectedSa) {
    throw new Error(`unexpected task identity: ${payload?.email}`);
  }
}

// ----------------------------------------------------------------------
//  CONFIGURATION
// ----------------------------------------------------------------------
const FANOUT_THRESHOLD = 10000;
const MAX_BATCH_WRITE = 500;
const FOLLOWER_PAGE_SIZE = 1000;
const STORY_SCORE_UPDATE_LIMIT = 200;
const STALE_TASK_AGE_MS = 24 * 60 * 60_000;
const FAILED_TASK_RETRY_AGE_MS = 60 * 60_000;
const STUCK_TASK_TIMEOUT_MS = 10 * 60_000;
const MODERATION_VIDEO_TIMEOUT_MS = 8 * 60 * 1000;
const { checkRateLimit } = require('./rateLimit');
const { getRuntimeConfig } = require('./auth');
const { awardXpSafe } = require('./xpAward');
const { writeNotification } = require('./notificationWriter');
const { enqueuePush } = require('./pushQueue');
const { v4: uuidv4 } = require('uuid');

// ----------------------------------------------------------------------
//  CLOUD TASKS CONFIG (with deduplication)
// ----------------------------------------------------------------------
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || getRuntimeConfig()?.projectId || '';
const location = 'us-central1';
const serviceAccountEmail = projectId ? `${projectId}@appspot.gserviceaccount.com` : '';
const videoModerationUrl = projectId ? `https://${location}-${projectId}.cloudfunctions.net/processVideoModeration` : '';

// ----------------------------------------------------------------------
//  STRUCTURED LOGGING
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
//  BATCH COMMIT WITH EXPONENTIAL BACKOFF
// ----------------------------------------------------------------------
async function commitBatchWithRetry(batch, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 500;
      log('warn', `Batch commit retry ${attempt}`, { error: error.message, delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ----------------------------------------------------------------------
//  SHARDED RATE LIMITER — shared implementation in ./rateLimit.js.
//  This module previously used deterministic single-shard selection, which
//  diverged from every other endpoint's shard algorithm.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
//  ENQUEUE VIDEO MODERATION TASK (with idempotent task name)
// ----------------------------------------------------------------------
async function enqueueModerationTask(storyId, gcsUri) {
  const parent = tasksClient.queuePath(projectId, location, 'story-moderation-queue');
  const taskName = `projects/${projectId}/locations/${location}/queues/story-moderation-queue/tasks/story-${storyId}`;
  const task = {
    name: taskName,
    httpRequest: {
      httpMethod: 'POST',
      url: videoModerationUrl,
      body: Buffer.from(JSON.stringify({ storyId, gcsUri })).toString('base64'),
      headers: { 'Content-Type': 'application/json' },
      oidcToken: {
        serviceAccountEmail,
      },
    },
  };
  try {
    await tasksClient.createTask({ parent, task });
    log('info', 'Video moderation task enqueued (OIDC)', { storyId });
  } catch (err) {
    if (err.code === 6) { // ALREADY_EXISTS
      log('info', 'Video moderation task already exists', { storyId });
    } else {
      throw err;
    }
  }
}

// ----------------------------------------------------------------------
//  CORE FAN‑OUT LOGIC (reused by trigger, recovery, retry)
// ----------------------------------------------------------------------
async function getCreatorSafetyExclusions(ownerId) {
  const excluded = new Set();
  try {
    const [blockedByOwner, blockedOwner, restrictedByOwner] = await Promise.all([
      db.collection('blocks').where('blockerId', '==', ownerId).limit(500).get(),
      db.collection('blocks').where('blockedId', '==', ownerId).limit(500).get(),
      db.collection('restricts').where('restricterId', '==', ownerId).limit(500).get(),
    ]);
    blockedByOwner.docs.forEach((d) => excluded.add(d.data().blockedId));
    blockedOwner.docs.forEach((d) => excluded.add(d.data().blockerId));
    restrictedByOwner.docs.forEach((d) => excluded.add(d.data().restrictedId));
  } catch (err) {
    log('warn', 'Failed reading creator safety exclusions during fanout', { ownerId, error: err.message });
  }
  excluded.delete(ownerId);
  return excluded;
}

async function processFanoutTaskInternal(taskRef, taskId, taskData) {
  const { storyId, ownerId, snapshot } = taskData;
  if (!storyId || !ownerId || !snapshot) {
    await taskRef.update({
      status: 'failed',
      error: 'Missing required fields',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  let shouldProcess = false;
  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(taskRef);
      if (doc.data().status === 'pending') {
        t.update(taskRef, {
          status: 'processing',
          processingStartedAt: FieldValue.serverTimestamp(),
        });
        shouldProcess = true;
      }
    });
  } catch (err) {
    log('error', 'Fan‑out lock failed', { taskId, error: err.message });
    return;
  }

  if (!shouldProcess) {
    log('info', 'Fan‑out task already claimed', { taskId });
    return;
  }

  const visibility = snapshot.visibility || 'public';
  if (visibility === 'private') {
    await taskRef.update({
      status: 'completed',
      fanoutTo: 0,
      message: 'Private Vibe — owner only',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const excluded = await getCreatorSafetyExclusions(ownerId);
  const writeRecipientBatch = async (recipientIds) => {
    const cleanIds = recipientIds.filter((fid) => fid && fid !== ownerId && !excluded.has(fid));
    for (let i = 0; i < cleanIds.length; i += MAX_BATCH_WRITE) {
      const chunk = cleanIds.slice(i, i + MAX_BATCH_WRITE);
      const batch = db.batch();
      const now = FieldValue.serverTimestamp();
      chunk.forEach((fid) => {
        const feedRef = db.collection('users').doc(fid).collection('feeds').doc(storyId);
        batch.set(feedRef, {
          userId: fid,
          storyId,
          ownerId,
          storySnapshot: snapshot,
          createdAt: now,
        }, { merge: true });
      });
      await commitBatchWithRetry(batch);
    }
    return cleanIds.length;
  };

  // Targeted small-list audiences: selected & close_circle never traverse full follower graph
  if (visibility === 'selected') {
    try {
      const storySnap = await db.collection('stories').doc(storyId).get();
      const selectedIds = Array.isArray(storySnap.data()?.selectedUserIds) ? storySnap.data().selectedUserIds : [];
      const delivered = await writeRecipientBatch(selectedIds);
      await taskRef.update({
        status: 'completed',
        fanoutTo: delivered,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    } catch (error) {
      log('error', 'Selected-audience fanout failed', { taskId, storyId, error: error.message });
      await taskRef.update({
        status: 'failed',
        error: error.message.substring(0, 500),
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
  }

  if (visibility === 'close_circle') {
    try {
      const circleSnap = await db.collection('users').doc(ownerId).collection('close_circle').limit(500).get();
      const memberIds = circleSnap.docs.map((d) => d.id);
      const delivered = await writeRecipientBatch(memberIds);
      await taskRef.update({
        status: 'completed',
        fanoutTo: delivered,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    } catch (error) {
      log('error', 'Close-circle fanout failed', { taskId, storyId, error: error.message });
      await taskRef.update({
        status: 'failed',
        error: error.message.substring(0, 500),
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
  }

  let followerCount = 0;
  try {
    const { readUserCounter } = require('./userCounters');
    followerCount = await readUserCounter(ownerId, 'followerCount');
  } catch (err) {
    log('error', 'Failed to fetch follower count', { ownerId, error: err.message });
    await taskRef.update({
      status: 'failed',
      error: 'Could not determine follower count',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (followerCount > FANOUT_THRESHOLD) {
    await taskRef.update({
      status: 'completed',
      fanoutTo: 0,
      message: 'Skipped – celebrity account (pull model)',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    log('info', 'Fan‑out skipped (large account)', { storyId, followerCount });
    return;
  }

  let totalFollowers = 0;
  let lastDoc = null;
  const followsRef = db.collection('follows');

  try {
    while (true) {
      let q = followsRef
        .where('followingId', '==', ownerId)
        .orderBy('followerId')
        .limit(FOLLOWER_PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const followerSnap = await q.get();
      if (followerSnap.empty) break;

      let candidateIds = followerSnap.docs.map((d) => d.data().followerId);
      lastDoc = followerSnap.docs[followerSnap.docs.length - 1];

      if (visibility === 'connections' && candidateIds.length > 0) {
        const mutualSet = new Set();
        for (let i = 0; i < candidateIds.length; i += 30) {
          const chunk = candidateIds.slice(i, i + 30);
          const mutualRefs = chunk.map((fid) => db.collection('follows').doc(`${ownerId}_${fid}`));
          const mutualSnaps = await db.getAll(...mutualRefs);
          mutualSnaps.forEach((s, idx) => {
            if (s.exists) mutualSet.add(chunk[idx]);
          });
        }
        candidateIds = candidateIds.filter((fid) => mutualSet.has(fid));
      }

      totalFollowers += await writeRecipientBatch(candidateIds);
      if (followerSnap.size < FOLLOWER_PAGE_SIZE) break;
    }

    await taskRef.update({
      status: 'completed',
      fanoutTo: totalFollowers,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    log('info', 'Fan‑out completed', { storyId, totalFollowers, visibility });
  } catch (error) {
    log('error', 'Fan‑out failed', { taskId, storyId, error: error.message });
    await taskRef.update({
      status: 'failed',
      error: error.message.substring(0, 500),
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// ----------------------------------------------------------------------
//  1. processFanoutTask (onCreate trigger)
// ----------------------------------------------------------------------
exports.processFanoutTask = functions.firestore
  .document('fanout_tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const taskId = context.params.taskId;
    const taskData = snap.data();
    if (!taskData || taskData.status !== 'pending') return;
    // The SAME `fanout_tasks/{taskId}` collection is written by two producers:
    // posts (`feed.js` `fanoutPostOnCreate`, carrying `postId`) and stories
    // (`{ storyId }`). Both triggers fire for every created doc, and both used
    // to claim it unconditionally — so the loser's `processFanoutTaskInternal`
    // found status !== 'pending' and marked the task `failed` with "Missing
    // required fields", cancelling the winner's fan-out. Claim only story tasks.
    if (!taskData.storyId) return;
    await processFanoutTaskInternal(snap.ref, taskId, taskData);
  });

// ----------------------------------------------------------------------
//  2. moderateStory – onCreate story, transactional idempotency, SELF‑HEALING
// ----------------------------------------------------------------------
exports.moderateStory = functions.firestore
  .document('stories/{storyId}')
  .onCreate(async (snap, context) => {
    const storyId = context.params.storyId;
    const storyData = snap.data();
    const storyRef = snap.ref;

    // ---- Idempotency lock ----
    let alreadyModerated = false;
    try {
      await db.runTransaction(async (t) => {
        const freshSnap = await t.get(storyRef);
        const freshData = freshSnap.data();
        if (freshData.moderationStatus && freshData.moderationStatus !== 'pending') {
          alreadyModerated = true;
          return;
        }
        t.update(storyRef, {
          moderationStatus: 'processing',
          moderationStartedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      log('error', 'Moderation lock failed', { storyId, error: err.message });
      return;
    }

    if (alreadyModerated) {
      log('info', 'Story already moderated', { storyId, status: storyData.moderationStatus });
      return;
    }

    // ---- Rate‑limit protection ----
    if (storyData.content) {
      try {
        await checkRateLimit(storyData.userId, 'moderate_text', 10, 60000);
      } catch (rateLimitError) {
        log('warn', 'Text moderation rate limit reached, routing to manual review', { storyId });
        await storyRef.update({
          moderationStatus: 'pending_manual_review',
          moderationNotes: `Rate limit exceeded: ${rateLimitError.message}`,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
    }

    // ---- Perform moderation in a try/catch ----
    try {
      let shouldReject = false;
      let rejectionReason = '';

      // ---- 1. Text moderation (Perspective API) ----
      if (storyData.content) {
        const apiKey = getRuntimeConfig('PERSPECTIVE_API_KEY', 'perspective.api_key');
        if (apiKey) {
          const response = await fetch(
            `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                comment: { text: storyData.content },
                languages: ['en'],
                requestedAttributes: { TOXICITY: {} },
              }),
            }
          );
          if (response.ok) {
            const result = await response.json();
            const score = result.attributeScores?.TOXICITY?.summaryScore?.value || 0;
            if (score > 0.7) {
              shouldReject = true;
              rejectionReason = 'Toxic text content';
            }
          } else {
            throw new Error(`Perspective API returned status ${response.status}`);
          }
        }
      }

      // ---- 2. Video moderation (enqueue async job) ----
      if (!shouldReject && storyData.type === 'video' && storyData.media?.path) {
        const filePath = storyData.media.path;
        const file = bucket.file(filePath);
        const [exists] = await file.exists();
        if (exists) {
          const gcsUri = `gs://${bucket.name}/${filePath}`;
          await enqueueModerationTask(storyId, gcsUri);
          await storyRef.update({
            moderationStatus: 'pending_media_review',
            moderationNotes: 'Video analysis enqueued',
            updatedAt: FieldValue.serverTimestamp(),
          });
          return; // worker handles the rest
        } else {
          log('warn', 'Media file not found, skipping video moderation', { storyId, filePath });
        }
      }

      // ---- 3. Final decision ----
      if (shouldReject) {
        if (storyData.media?.path) {
          try { await bucket.file(storyData.media.path).delete(); } catch (err) {
            log('warn', 'Rejected story media delete failed', { storyId, error: err.message });
          }
        }
        await storyRef.update({
          moderationStatus: 'rejected',
          isDeleted: true,
          moderationNotes: rejectionReason,
          moderatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          moderationScore: 1.0,
        });
        log('info', 'Story rejected', { storyId, reason: rejectionReason });
      } else {
        await storyRef.update({
          moderationStatus: 'approved',
          moderationScore: 0.0,
          moderatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        log('info', 'Story approved', { storyId });
      }
    } catch (error) {
      log('error', 'Moderation failed, resetting status to pending', {
        storyId,
        error: error.message,
      });
      await storyRef.update({
        moderationStatus: 'pending',
        moderationNotes: `Moderation failed – will retry. Error: ${error.message}`,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      throw error; // retry by Firebase
    }
  });

// ----------------------------------------------------------------------
//  3. processVideoModeration – HTTP worker (OIDC‑authenticated, correct polling)
// ----------------------------------------------------------------------
exports.processVideoModeration = functions.https.onRequest(async (req, res) => {
  // Authenticate the Cloud Tasks request. The queue sends an OIDC token, so
  // the worker must verify OIDC — verifying a Firebase ID token here (the
  // previous code) rejected every task with 403 and no story video was ever
  // moderated.
  try {
    await assertOidcTask(req);
  } catch (err) {
    log('warn', 'Rejected video moderation request', { error: err.message });
    res.status(403).send('Forbidden');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { storyId, gcsUri } = req.body;
  if (!storyId || !gcsUri) {
    res.status(400).json({ error: 'Missing storyId or gcsUri' });
    return;
  }

  const storyRef = db.collection('stories').doc(storyId);
  try {
    const storySnap = await storyRef.get();
    if (!storySnap.exists || storySnap.data().moderationStatus !== 'pending_media_review') {
      res.status(200).json({ status: 'already processed' });
      return;
    }

    const [operation] = await videoClient.annotateVideo({
      inputUri: gcsUri,
      features: ['EXPLICIT_CONTENT_DETECTION'],
    });

    // Wait for operation completion with timeout (no busy polling)
    let result;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Video analysis timeout')), MODERATION_VIDEO_TIMEOUT_MS)
    );
    try {
      const [opResult] = await Promise.race([operation.promise(), timeoutPromise]);
      result = opResult;
    } catch (err) {
      log('error', 'Video analysis timed out', { storyId, error: err.message });
      await storyRef.update({
        moderationStatus: 'pending_manual_review',
        moderationNotes: 'Video analysis timed out',
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).json({ status: 'timeout' });
      return;
    }

    const annotation = result.annotationResults[0];
    const explicitFrames = annotation?.explicitAnnotation?.frames || [];
    const badLikelihoods = ['LIKELY', 'VERY_LIKELY', 'POSSIBLE'];
    const hasExplicit = explicitFrames.some(frame => badLikelihoods.includes(frame.likelihood));

    if (hasExplicit) {
      const storyData = storySnap.data();
      if (storyData.media?.path) {
        try { await bucket.file(storyData.media.path).delete(); } catch (e) {
          log('warn', 'Explicit story media delete failed', { storyId, error: e.message });
        }
      }
      await storyRef.update({
        moderationStatus: 'rejected',
        isDeleted: true,
        moderationNotes: 'Explicit video content',
        moderatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        moderationScore: 1.0,
      });
    } else {
      await storyRef.update({
        moderationStatus: 'approved',
        moderationScore: 0.0,
        moderatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    res.status(200).json({ status: 'completed' });
  } catch (error) {
    log('error', 'Video moderation worker failed', { storyId, error: error.message });
    await storyRef.update({
      moderationStatus: 'pending_manual_review',
      moderationNotes: `Analysis error: ${error.message}`,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------
//  4. aggregateStoryStats – scheduled sharded counter merge
// ----------------------------------------------------------------------
exports.aggregateStoryStats = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    log('info', 'Starting story stats aggregation');
    const batchSize = STORY_SCORE_UPDATE_LIMIT;
    const storiesRef = db.collection('stories');
    const cursorRef = db.collection('system').doc('story_stats_cursor');
    const cursorSnap = await cursorRef.get();
    let lastStoryId = cursorSnap.exists ? cursorSnap.data().lastStoryId : null;
    let totalAggregated = 0;
    let hasMore = true;
    let safety = 0;

    while (hasMore && safety++ < 1000) {
      let q = storiesRef
        .where('expiresAt', '>', new Date())
        .where('isDeleted', '==', false)
        .orderBy('__name__')
        .limit(batchSize);
      if (lastStoryId) {
        const lastDoc = await storiesRef.doc(lastStoryId).get();
        if (lastDoc.exists) q = q.startAfter(lastDoc);
        else lastStoryId = null;
      }
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        try {
          let totalViews = 0;
          const viewShardsSnap = await doc.ref.collection('view_shards').get();
          viewShardsSnap.forEach(s => totalViews += s.data().count || 0);

          const reactionCounts = {};
          const reactionShardsSnap = await doc.ref.collection('reaction_shards').get();
          reactionShardsSnap.forEach(s => {
            const data = s.data();
            Object.entries(data).forEach(([reaction, count]) => {
              if (reaction !== 'updatedAt') reactionCounts[reaction] = (reactionCounts[reaction] || 0) + (count || 0);
            });
          });

          // Aggregate interaction counters (completions + forward/back taps)
          // from the analytics shards (spec §58 — client only ever writes
          // batched shards; the aggregator owns the story-doc stats).
          let completions = 0;
          let forwardTaps = 0;
          let backTaps = 0;
          let replies = 0;
          let comments = 0;
          const analyticsShardsSnap = await doc.ref.collection('analytics_shards').get();
          analyticsShardsSnap.forEach((s) => {
            const d = s.data() || {};
            completions += d.completions || 0;
            forwardTaps += d.forwardTaps || 0;
            backTaps += d.backTaps || 0;
            replies += d.replies || 0;
            comments += d.comments || 0;
          });

          await doc.ref.update({
            'stats.views': totalViews,
            'stats.reactions': reactionCounts,
            'stats.completions': completions,
            'stats.forwardTaps': forwardTaps,
            'stats.backTaps': backTaps,
            'stats.replies': replies,
            'stats.comments': comments,
            'stats.completionRate': totalViews > 0 ? completions / totalViews : 0,
            updatedAt: FieldValue.serverTimestamp(),
          });
          totalAggregated++;
        } catch (err) {
          log('error', 'Failed to aggregate story', { storyId: doc.id, error: err.message });
        }
      }

      lastStoryId = snap.docs[snap.docs.length - 1].id;
      hasMore = snap.size === batchSize;
    }

    await cursorRef.set({
      lastStoryId,
      updatedAt: Timestamp.fromDate(new Date()),
      totalProcessed: totalAggregated,
    }, { merge: true });

    log('info', 'Story stats aggregation completed', { aggregated: totalAggregated });
    return null;
  });

// ----------------------------------------------------------------------
//  5. cleanupExpiredStories – scheduled hard deletion (optimised)
// ----------------------------------------------------------------------
async function deleteSubcollection(subRef, pageSize = 500) {
  let safety = 0;
  while (safety++ < 100) {
    const snap = await subRef.limit(pageSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await commitBatchWithRetry(batch);
  }
}

exports.cleanupExpiredStories = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async (context) => {
    log('info', 'Starting expired story cleanup');
    const now = new Date();
    const storiesRef = db.collection('stories');
    let lastDoc = null;
    let totalDeleted = 0;
    const MAX_LOOPS = 50;

    for (let loops = 0; loops < MAX_LOOPS; loops++) {
      let q = storiesRef
        .where('expiresAt', '<=', now)
        .where('isDeleted', '==', false)
        .orderBy('__name__')
        .limit(500);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const storyId = doc.id;
        const storyData = doc.data();

        // Delete subcollections in parallel (limited concurrency)
        await Promise.all([
          deleteSubcollection(doc.ref.collection('viewers')),
          deleteSubcollection(doc.ref.collection('view_shards')),
          deleteSubcollection(doc.ref.collection('reactions')),
          deleteSubcollection(doc.ref.collection('reaction_shards')),
        ]);

        // Keep the media object when the story was archived at creation — the
        // archive (and the highlights built from it) still render that file.
        // Deleting it left every archived story with a broken image.
        let archived = false;
        try {
          const archiveSnap = await db.collection('archived_stories').doc(storyId).get();
          archived = archiveSnap.exists;
        } catch (err) {
          archived = false;
        }

        if (!archived && storyData.media?.path) {
          try { await bucket.file(storyData.media.path).delete(); } catch (err) {
            log('warn', 'Expired story media delete failed', { storyId, error: err.message });
          }
        }

        await doc.ref.delete();
        totalDeleted++;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 500) break;
    }

    log('info', 'Expired story cleanup completed', { totalDeleted });
    return null;
  });

// ----------------------------------------------------------------------
//  7. retryFailedFanoutTasks – retry recent failed tasks
// ----------------------------------------------------------------------
exports.retryFailedFanoutTasks = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const cutoff = new Date(Date.now() - FAILED_TASK_RETRY_AGE_MS);
    const failedSnap = await db.collection('fanout_tasks')
      .where('status', '==', 'failed')
      .where('createdAt', '>=', Timestamp.fromDate(cutoff))
      .where('retries', '<', 3)
      .limit(10)
      .get();

    for (const doc of failedSnap.docs) {
      const data = doc.data();
      // Only story tasks (post tasks carry `postId` and are retried by
      // `feed.js#cleanupAndRetryFanoutTasks`). Without this guard the story
      // retrier would mark every failed POST task as "Missing required fields".
      if (!data.storyId) continue;
      await doc.ref.update({
        status: 'pending',
        retries: (data.retries || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const freshData = (await doc.ref.get()).data();
      await processFanoutTaskInternal(doc.ref, doc.id, freshData);
    }
    return null;
  });

// ----------------------------------------------------------------------
//  8. recoverStuckModerations – reset stories stuck in 'processing' state
// ----------------------------------------------------------------------
exports.recoverStuckModerations = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const stuckTimeout = new Date(Date.now() - STUCK_TASK_TIMEOUT_MS);
    const stuckSnap = await db.collection('stories')
      .where('moderationStatus', '==', 'processing')
      .where('moderationStartedAt', '<', admin.firestore.Timestamp.fromDate(stuckTimeout))
      .limit(100)
      .get();

    if (!stuckSnap.empty) {
      const batch = db.batch();
      stuckSnap.forEach(doc => {
        batch.update(doc.ref, {
          moderationStatus: 'pending',
          moderationNotes: 'Automatically recovered from stuck moderation',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await commitBatchWithRetry(batch);
      log('info', `Recovered ${stuckSnap.size} stuck story moderations`);
    }
    return null;
  });

// ----------------------------------------------------------------------
//  9. personalizeFeed – callable: blended public + followed stories
// ----------------------------------------------------------------------
exports.personalizeFeed = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const userId = context.auth.uid;
  const { pageSize = 20, lastStoryId } = data;

  await checkRateLimit(userId, 'personalizeFeed', 10, 60000);

  const now = new Date();

  // Blocked, muted & restricted users (mutual block + outgoing mutes + creator restricts)
  const blockedIds = new Set();
  const blockers = new Set();
  const mutedIds = new Set();
  const restrictedBy = new Set();
  try {
    const [blocksSnap, blockedMeSnap, mutesSnap, restrictsSnap] = await Promise.all([
      db.collection('blocks').where('blockerId', '==', userId).limit(300).get(),
      db.collection('blocks').where('blockedId', '==', userId).limit(300).get(),
      db.collection('mutes').where('muterId', '==', userId).limit(300).get(),
      db.collection('restricts').where('restrictedId', '==', userId).limit(300).get(),
    ]);
    blocksSnap.docs.forEach(d => blockedIds.add(d.data().blockedId));
    blockedMeSnap.docs.forEach(d => blockers.add(d.data().blockerId));
    mutesSnap.docs.forEach(d => mutedIds.add(d.data().mutedId));
    restrictsSnap.docs.forEach(d => restrictedBy.add(d.data().restricterId));
  } catch (err) {
    log('error', 'Failed to load moderation lists', { userId, error: err.message });
  }

  // Followed users (bounded)
  const followedUserIds = [];
  const followedSet = new Set();
  const mutualSet = new Set();
  try {
    const [followsSnap, followersSnap] = await Promise.all([
      db.collection('follows').where('followerId', '==', userId).select('followingId').limit(300).get(),
      db.collection('follows').where('followingId', '==', userId).select('followerId').limit(300).get(),
    ]);
    const followerSet = new Set(followersSnap.docs.map((d) => d.data().followerId));
    followsSnap.docs.forEach((d) => {
      const targetId = d.data().followingId;
      if (!targetId) return;
      followedUserIds.push(targetId);
      followedSet.add(targetId);
      if (followerSet.has(targetId)) mutualSet.add(targetId);
    });
  } catch (err) {
    log('error', 'Failed to load follows', { userId, error: err.message });
  }

  const storiesRef = db.collection('stories');

  async function canViewerSeeStory(docData) {
    if (!docData || docData.isDeleted) return false;
    if (docData.status === 'expired' || docData.status === 'removed') return false;
    if (docData.userId === userId) return true;
    if (blockedIds.has(docData.userId) || blockers.has(docData.userId) || mutedIds.has(docData.userId) || restrictedBy.has(docData.userId)) {
      return false;
    }
    const vis = docData.visibility || 'public';
    if (vis === 'public') return true;
    if (vis === 'followers') return followedSet.has(docData.userId);
    if (vis === 'connections') return mutualSet.has(docData.userId);
    if (vis === 'selected') {
      return Array.isArray(docData.selectedUserIds) && docData.selectedUserIds.includes(userId);
    }
    if (vis === 'close_circle') {
      const memberSnap = await db.collection('users').doc(docData.userId).collection('close_circle').doc(userId).get();
      return memberSnap.exists;
    }
    return false;
  }

  async function fetchStories(query, limitCount) {
    const result = [];
    const snap = await query.limit(limitCount).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (await canViewerSeeStory(data)) {
        result.push({ id: doc.id, ...data });
      }
    }
    return result;
  }

  // Public stories
  const publicQuery = storiesRef
    .where('visibility', '==', 'public')
    .where('moderationStatus', '==', 'approved')
    .where('isDeleted', '==', false)
    .where('expiresAt', '>', now)
    .orderBy('createdAt', 'desc')
    .limit(pageSize * 2);
  const publicStories = await fetchStories(publicQuery, pageSize * 2);

  // Own active stories
  const ownQuery = storiesRef
    .where('userId', '==', userId)
    .where('isDeleted', '==', false)
    .where('expiresAt', '>', now)
    .orderBy('createdAt', 'desc')
    .limit(20);
  const ownStories = await fetchStories(ownQuery, 20);

  // Followed users (batched IN queries)
  let followedStories = [];
  if (followedUserIds.length > 0) {
    const batchSize = 30;
    const batches = [];
    for (let i = 0; i < followedUserIds.length; i += batchSize) {
      batches.push(followedUserIds.slice(i, i + batchSize));
    }
    const batchPromises = batches.map(chunk => {
      const q = storiesRef
        .where('userId', 'in', chunk)
        .where('moderationStatus', '==', 'approved')
        .where('isDeleted', '==', false)
        .where('expiresAt', '>', now)
        .orderBy('createdAt', 'desc')
        .limit(pageSize * 2);
      return fetchStories(q, pageSize * 2);
    });
    const results = await Promise.all(batchPromises);
    const seen = new Set();
    for (const arr of results) {
      for (const s of arr) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          followedStories.push(s);
        }
      }
    }
  }

  // Merge & score
  const merged = [];
  const seenIds = new Set();
  for (const s of [...ownStories, ...followedStories, ...publicStories]) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      merged.push(s);
    }
  }

  const scored = merged.map(s => {
    const stats = s.stats || {};
    const reactions = Object.values(stats.reactions || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const engagement = reactions * 2.5 + (stats.comments || 0) * 2.5
      + (stats.replies || 0) * 2 + (stats.shares || 0) * 4 + (stats.views || 0) * 0.2;
    const ageHours = (now - (s.createdAt?.toDate() || now)) / 3600000;
    const decay = Math.exp(-ageHours / 12);
    const randomFactor = 0.95 + Math.random() * 0.1;
    return { ...s, _score: engagement * decay * randomFactor };
  });
  scored.sort((a,b) => b._score - a._score);

  let startIndex = 0;
  if (lastStoryId) {
    const idx = scored.findIndex(s => s.id === lastStoryId);
    if (idx !== -1) startIndex = idx + 1;
  }

  const feed = scored.slice(startIndex, startIndex + pageSize);
  return {
    success: true,
    feed,
    hasMore: (startIndex + pageSize) < scored.length,
    generatedAt: now.toISOString(),
  };
});

// ----------------------------------------------------------------------
//  10. publishVibe – authoritative server publish + idempotency + 24h expiry
// ----------------------------------------------------------------------
const ALLOWED_VIBE_TYPES = new Set(['image', 'video', 'text', 'audio', 'event']);
const ALLOWED_VIBE_AUDIENCES = new Set(['public', 'followers', 'connections', 'close_circle', 'selected', 'private']);

exports.publishVibe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'publishVibe', 10, 60000);

  const payload = data && typeof data === 'object' ? data : {};
  const idempotencyKey = typeof payload.idempotencyKey === 'string'
    ? payload.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)
    : '';
  const type = String(payload.type || '').toLowerCase();
  const visibility = String(payload.visibility || 'public').toLowerCase();

  if (!ALLOWED_VIBE_TYPES.has(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported Vibe type.');
  }
  if (!ALLOWED_VIBE_AUDIENCES.has(visibility)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported audience.');
  }

  const selectedUserIds = Array.isArray(payload.selectedUserIds)
    ? [...new Set(payload.selectedUserIds.map((id) => String(id || '').trim()).filter((id) => id && id !== uid))].slice(0, 100)
    : [];
  if (visibility === 'selected' && selectedUserIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Select at least one recipient.');
  }

  const content = typeof payload.content === 'string' ? payload.content.trim().slice(0, 500) : '';
  if (type === 'text' && !content) {
    throw new functions.https.HttpsError('invalid-argument', 'Text Vibe requires content.');
  }

  let media = null;
  if (['image', 'video', 'audio'].includes(type)) {
    const m = payload.media;
    if (!m || typeof m.url !== 'string' || !m.path || typeof m.path !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Uploaded media reference is required.');
    }
    if (!m.path.startsWith(`stories/${uid}/`)) {
      throw new functions.https.HttpsError('permission-denied', 'Media path does not belong to creator.');
    }
    media = {
      url: m.url,
      path: m.path,
      size: Number(m.size) || 0,
      type: String(m.type || ''),
      name: String(m.name || '').slice(0, 180),
      ...(m.coverUrl ? { coverUrl: String(m.coverUrl), coverPath: String(m.coverPath || '') } : {}),
      ...(Number.isFinite(Number(m.duration)) ? { duration: Math.min(60, Math.max(1, Number(m.duration))) } : {}),
    };
  } else if (type === 'event' && payload.media && typeof payload.media.url === 'string' && typeof payload.media.path === 'string') {
    if (!payload.media.path.startsWith(`stories/${uid}/`)) {
      throw new functions.https.HttpsError('permission-denied', 'Media path does not belong to creator.');
    }
    media = {
      url: payload.media.url,
      path: payload.media.path,
      size: Number(payload.media.size) || 0,
      type: String(payload.media.type || 'image/jpeg'),
      name: String(payload.media.name || '').slice(0, 180),
    };
  }

  let eventData = null;
  if (type === 'event') {
    const rawEv = payload.eventData && typeof payload.eventData === 'object' ? payload.eventData : {};
    const title = String(rawEv.title || content || '').trim().slice(0, 120);
    if (!title) {
      throw new functions.https.HttpsError('invalid-argument', 'Event Vibe requires a title.');
    }
    eventData = {
      title,
      startsAt: typeof rawEv.startsAt === 'string' ? rawEv.startsAt.trim().slice(0, 64) : null,
      location: typeof rawEv.location === 'string' ? rawEv.location.trim().slice(0, 140) : null,
      ctaText: typeof rawEv.ctaText === 'string' && rawEv.ctaText.trim() ? rawEv.ctaText.trim().slice(0, 40) : 'RSVP / Details',
      ctaUrl: typeof rawEv.ctaUrl === 'string' ? rawEv.ctaUrl.trim().slice(0, 500) : null,
      description: typeof rawEv.description === 'string' ? rawEv.description.trim().slice(0, 300) : null,
    };
  }

  const requestedStoryId = typeof payload.storyId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(payload.storyId)
    ? payload.storyId
    : db.collection('stories').doc().id;

  // Idempotency guard: avoid duplicate story docs when clients retry
  if (idempotencyKey) {
    const idemRef = db.collection('vibe_idempotency').doc(`${uid}_${idempotencyKey}`);
    const existingIdem = await idemRef.get();
    if (existingIdem.exists && existingIdem.data()?.storyId) {
      const existingStory = await db.collection('stories').doc(existingIdem.data().storyId).get();
      if (existingStory.exists) {
        return {
          success: true,
          deduped: true,
          storyId: existingStory.id,
          expiresAtMs: existingStory.data().expiresAt?.toMillis?.() || Date.now() + 24 * 3600000,
        };
      }
    }
  }

  // Respect user's autoArchive opt-in/opt-out setting and default Vibe interaction policies
  let shouldAutoArchive = true;
  let userVibeSettings = {};
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) {
      userVibeSettings = userSnap.data()?.settings?.vibes || {};
      if (userVibeSettings.autoArchive === false) {
        shouldAutoArchive = false;
      }
    }
  } catch (err) {
    log('warn', 'Could not read user vibe settings; using defaults', { uid, error: err.message });
  }

  const ALLOWED_POLICY = new Set(['everyone', 'followers', 'connections', 'close_circle', 'nobody']);
  const normalizePolicy = (raw, fallback, legacyFlag) => {
    if (legacyFlag === false) return 'nobody';
    if (typeof raw === 'string' && ALLOWED_POLICY.has(raw.toLowerCase())) {
      return raw.toLowerCase();
    }
    if (typeof fallback === 'string' && ALLOWED_POLICY.has(fallback.toLowerCase())) {
      return fallback.toLowerCase();
    }
    return 'everyone';
  };

  const whoCanReact = normalizePolicy(payload.whoCanReact, userVibeSettings.whoCanReact, payload.allowReactions);
  const whoCanReply = normalizePolicy(payload.whoCanReply, userVibeSettings.whoCanReply, payload.allowReplies);
  const whoCanShare = normalizePolicy(payload.whoCanShare, userVibeSettings.whoCanShare || 'followers', undefined);
  const whoCanSendGifts = normalizePolicy(payload.whoCanSendGifts, userVibeSettings.whoCanSendGifts, payload.allowGifts);

  const nowMs = Date.now();
  const expiresAtTs = Timestamp.fromMillis(nowMs + 24 * 3600000);
  const nowTs = FieldValue.serverTimestamp();
  const hashtags = (content.match(/#\w+/g) || []).slice(0, 15);
  const durationNum = Number(payload.duration);
  const duration = Number.isFinite(durationNum) && durationNum > 0
    ? Math.min(60, Math.max(1, durationNum))
    : (type === 'video' || type === 'audio' ? 15 : type === 'event' ? 7 : 5);

  const storyDoc = {
    id: requestedStoryId,
    userId: uid,
    status: 'published',
    processingState: 'done',
    type,
    content,
    hashtags,
    media,
    mediaEdits: payload.mediaEdits && typeof payload.mediaEdits === 'object' ? payload.mediaEdits : null,
    textOverlays: Array.isArray(payload.textOverlays) ? payload.textOverlays.slice(0, 10) : [],
    drawingPaths: Array.isArray(payload.drawingPaths) ? payload.drawingPaths.slice(0, 120) : [],
    textStyle: payload.textStyle && typeof payload.textStyle === 'object' ? payload.textStyle : null,
    duration,
    visibility,
    selectedUserIds,
    whoCanReact,
    whoCanReply,
    whoCanShare,
    whoCanSendGifts,
    allowReactions: whoCanReact !== 'nobody',
    allowReplies: whoCanReply !== 'nobody',
    allowGifts: whoCanSendGifts !== 'nobody',
    allowComments: payload.allowComments !== false,
    music: payload.music || null,
    location: payload.location || eventData?.location || null,
    taggedUsers: Array.isArray(payload.taggedUsers) ? payload.taggedUsers.slice(0, 20) : [],
    backgroundColor: typeof payload.backgroundColor === 'string' ? payload.backgroundColor : '#000000',
    textColor: typeof payload.textColor === 'string' ? payload.textColor : '#FFFFFF',
    font: typeof payload.font === 'string' ? payload.font : 'display',
    isSponsored: false,
    moderationStatus: 'pending',
    stickers: Array.isArray(payload.stickers) ? payload.stickers.slice(0, 10) : null,
    collaborators: Array.isArray(payload.collaborators) ? payload.collaborators.slice(0, 10) : [],
    linkUrl: typeof payload.linkUrl === 'string' ? payload.linkUrl.slice(0, 500) : (eventData?.ctaUrl || null),
    ctaText: typeof payload.ctaText === 'string' ? payload.ctaText.slice(0, 40) : (eventData?.ctaText || null),
    ctaUrl: typeof payload.ctaUrl === 'string' ? payload.ctaUrl.slice(0, 500) : (eventData?.ctaUrl || null),
    eventData,
    templateId: typeof payload.templateId === 'string' ? payload.templateId : null,
    stats: {
      views: 0,
      uniqueViewers: 0,
      completions: 0,
      replays: 0,
      comments: 0,
      shares: 0,
      replies: 0,
      gifts: 0,
      giftCoins: 0,
      totalReactions: 0,
      reactionBreakdown: {},
      reactions: {},
    },
    createdAt: nowTs,
    publishedAt: nowTs,
    updatedAt: nowTs,
    expiresAt: expiresAtTs,
    isDeleted: false,
  };

  const batch = db.batch();
  const storyRef = db.collection('stories').doc(requestedStoryId);
  batch.set(storyRef, storyDoc);

  if (idempotencyKey) {
    batch.set(db.collection('vibe_idempotency').doc(`${uid}_${idempotencyKey}`), {
      userId: uid,
      storyId: requestedStoryId,
      createdAt: nowTs,
      expireAt: Timestamp.fromMillis(nowMs + 7 * 24 * 3600000),
    });
  }

  if (shouldAutoArchive) {
    batch.set(db.collection('archived_stories').doc(requestedStoryId), {
      ...storyDoc,
      originalStoryId: requestedStoryId,
      archivedAt: nowTs,
      userId: uid,
    });
  }

  if (visibility !== 'private') {
    const fanoutSnapshot = {
      id: requestedStoryId,
      userId: uid,
      type,
      visibility,
      createdAt: Timestamp.fromMillis(nowMs),
      expiresAt: expiresAtTs,
    };
    batch.set(db.collection('fanout_tasks').doc(`story_${requestedStoryId}`), {
      storyId: requestedStoryId,
      ownerId: uid,
      snapshot: fanoutSnapshot,
      status: 'pending',
      retries: 0,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  await batch.commit();
  log('info', 'Authoritative Vibe published', { storyId: requestedStoryId, uid, visibility, shouldAutoArchive });

  // Server-authoritative XP & achievement progression for publishing a Vibe
  await awardXpSafe(uid, 'story_created', { source: requestedStoryId });
  try {
    const { evaluateAchievementsForUser } = require('./levelSystem');
    await evaluateAchievementsForUser(uid);
  } catch (_) {
    /* achievement evaluation is best-effort post-publish */
  }

  return {
    success: true,
    storyId: requestedStoryId,
    archived: shouldAutoArchive,
    expiresAtMs: expiresAtTs.toMillis(),
  };
});

// ----------------------------------------------------------------------
//  11. deleteVibe – authoritative creator delete & feed/media cleanup
// ----------------------------------------------------------------------
exports.deleteVibe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  const storyId = typeof data?.storyId === 'string' ? data.storyId.trim() : '';
  if (!storyId) {
    throw new functions.https.HttpsError('invalid-argument', 'storyId is required.');
  }

  const storyRef = db.collection('stories').doc(storyId);
  const snap = await storyRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Vibe not found.');
  }
  const story = snap.data();
  if (story.userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'You can only delete your own Vibes.');
  }

  await storyRef.update({
    isDeleted: true,
    status: 'removed',
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Delete media only if NOT preserved inside creator's archive
  const archiveSnap = await db.collection('archived_stories').doc(storyId).get().catch(() => null);
  const keepArchived = Boolean(archiveSnap && archiveSnap.exists);
  if (!keepArchived && story.media?.path) {
    await bucket.file(story.media.path).delete().catch((err) => {
      log('warn', 'Failed deleting deleted Vibe media', { storyId, path: story.media.path, error: err.message });
    });
  }

  log('info', 'Authoritative Vibe deleted', { storyId, uid, keepArchived });
  return { success: true, storyId, keptInArchive: keepArchived };
});

// ----------------------------------------------------------------------
//  12. cleanupAbandonedVibeMedia – remove orphan uploads >26h old
// ----------------------------------------------------------------------
exports.cleanupAbandonedVibeMedia = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoffMs = Date.now() - 26 * 60 * 60 * 1000;
    let cleaned = 0;
    try {
      const [files] = await bucket.getFiles({ prefix: 'stories/', maxResults: 200 });
      for (const file of files) {
        const createdMs = file.metadata?.timeCreated ? Date.parse(file.metadata.timeCreated) : 0;
        if (!createdMs || createdMs > cutoffMs) continue;
        const [activeSnap, archiveSnap] = await Promise.all([
          db.collection('stories').where('media.path', '==', file.name).limit(1).get(),
          db.collection('archived_stories').where('media.path', '==', file.name).limit(1).get(),
        ]);
        if (activeSnap.empty && archiveSnap.empty) {
          await file.delete().catch((err) => {
            log('warn', 'Orphan vibe media delete skipped', { path: file.name, error: err.message });
          });
          cleaned++;
        }
      }
    } catch (err) {
      log('warn', 'Abandoned Vibe media scan failed', { error: err.message });
    }
    log('info', 'Abandoned Vibe media cleanup finished', { cleaned });
    return null;
  });

// ----------------------------------------------------------------------
//  10. onStoryReactionCreate – rate limit reactions
// ----------------------------------------------------------------------
exports.onStoryReactionCreate = functions.firestore
  .document('stories/{storyId}/reactions/{userId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    try {
      await checkRateLimit(userId, 'story_reaction', 30, 60000);
    } catch (err) {
      log('warn', 'Reaction rate limit exceeded', { userId });
      await snap.ref.delete(); // rollback
    }
  });

// ----------------------------------------------------------------------
//  11. generateCaptionForImage – callable: AI caption for an image story
//
//  storyService calls this (STORY_CONFIG.AI_CAPTION.CLOUD_FUNCTION) before
//  publishing an image story with no text. The caller supplies either an
//  `imageUrl` (as today) or a ready-made `mediaDescription`. The image URL is
//  never fetched server-side (SSRF surface); the caption is produced from the
//  caller's own description or draft text via the AI gateway, and is scoped to
//  the authenticated uid like every other AI write.
// ----------------------------------------------------------------------
exports.generateCaptionForImage = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const userId = context.auth.uid;

  const description = typeof data?.mediaDescription === 'string'
    ? data.mediaDescription.slice(0, 500)
    : '';
  const draft = typeof data?.content === 'string' ? data.content.slice(0, 500) : '';
  // `imageUrl` is accepted for call-site compatibility but is not dereferenced.
  const hasImageReference = typeof data?.imageUrl === 'string' && data.imageUrl.length > 0;

  if (!description && !draft && !hasImageReference) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Provide a mediaDescription, draft content, or imageUrl.'
    );
  }

  await checkRateLimit(userId, 'generateCaptionForImage', 20, 60000);

  const apiKey = process.env.AI_OPENAI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'AI captioning is not configured. Contact support.'
    );
  }

  const prompt = [
    'Write one short, vivid caption for an image story (max 140 characters).',
    draft ? `Draft/topic: ${draft}` : '',
    description ? `Image description: ${description}` : '',
    !description && !draft ? 'No description was provided; write a neutral, inviting caption.' : '',
    'Return only the caption text, no quotes, no hashtags.',
  ].filter(Boolean).join('\n');

  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You write concise, engaging social captions.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 120,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new functions.https.HttpsError('unavailable', `AI provider unreachable: ${err.message}`);
  }

  if (!res.ok) {
    throw new functions.https.HttpsError('internal', `AI provider error (${res.status})`);
  }

  const json = await res.json();
  const caption = json?.choices?.[0]?.message?.content?.trim();
  if (!caption) {
    throw new functions.https.HttpsError('internal', 'AI provider returned no caption.');
  }

  log('info', 'Story caption generated', { userId, model });
  return { success: true, caption };
});

// ----------------------------------------------------------------------
//  ARVDOUL VIBES — PART 2 AUTHORITATIVE HELPERS & CALLABLES
// ----------------------------------------------------------------------
const VIBE_REACTION_KEYS = new Set(['like', 'love', 'laugh', 'celebrate', 'wow', 'support', 'sad']);
const VIBE_REACTION_LABELS = {
  like: 'Like',
  love: 'Love',
  laugh: 'Laugh',
  celebrate: 'Celebrate',
  wow: 'Wow',
  support: 'Support',
  sad: 'Sad',
};
const VIBE_LEGACY_REACTION_MAP = {
  '👍': 'like',
  '❤️': 'love',
  '❤': 'love',
  '♥️': 'love',
  '😂': 'laugh',
  '👏': 'celebrate',
  '🔥': 'celebrate',
  '😮': 'wow',
  '💎': 'support',
  '🙌': 'support',
  '😢': 'sad',
};
const VIBE_MILESTONES = [25, 100, 500, 1000];

function normalizeVibeReactionKey(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (VIBE_REACTION_KEYS.has(lower)) return lower;
  return VIBE_LEGACY_REACTION_MAP[trimmed] || null;
}

function stripVibeText(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

async function isMutualBlockedOrRestricted(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [b1, b2, r1, r2] = await db.getAll(
    db.doc(`blocks/${uidA}_${uidB}`),
    db.doc(`blocks/${uidB}_${uidA}`),
    db.doc(`restricts/${uidA}_${uidB}`),
    db.doc(`restricts/${uidB}_${uidA}`),
  );
  return b1.exists || b2.exists || r1.exists || r2.exists;
}

async function isMutualBlockedOnly(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [b1, b2] = await db.getAll(
    db.doc(`blocks/${uidA}_${uidB}`),
    db.doc(`blocks/${uidB}_${uidA}`),
  );
  return b1.exists || b2.exists;
}

async function satisfiesVibeScope(ownerId, viewerId, scope, storyData = {}) {
  if (!ownerId || !viewerId) return false;
  if (ownerId === viewerId) return true;
  const s = String(scope || 'everyone').toLowerCase();
  if (s === 'nobody' || s === 'private') return false;
  if (s === 'everyone' || s === 'public') return true;
  if (s === 'selected') {
    return Array.isArray(storyData.selectedUserIds) && storyData.selectedUserIds.includes(viewerId);
  }
  if (s === 'followers') {
    const f = await db.doc(`follows/${viewerId}_${ownerId}`).get();
    return f.exists;
  }
  if (s === 'connections') {
    const [f1, f2] = await db.getAll(
      db.doc(`follows/${viewerId}_${ownerId}`),
      db.doc(`follows/${ownerId}_${viewerId}`),
    );
    return f1.exists && f2.exists;
  }
  if (s === 'close_circle') {
    const cc = await db.doc(`users/${ownerId}/close_circle/${viewerId}`).get();
    return cc.exists;
  }
  return false;
}

async function resolveVibeForViewer(storyId, viewerId) {
  if (!storyId || typeof storyId !== 'string') {
    return { ok: false, reason: 'not_found' };
  }
  const ref = db.collection('stories').doc(storyId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };
  const story = { id: snap.id, ...snap.data() };
  if (story.isDeleted || story.status === 'removed' || story.moderationStatus === 'rejected') {
    return { ok: false, reason: 'removed', story, ref };
  }
  const expiresMs = story.expiresAt?.toMillis?.() || 0;
  if (story.userId !== viewerId && (story.status === 'expired' || (expiresMs && expiresMs <= Date.now()))) {
    return { ok: false, reason: 'expired', story, ref };
  }
  if (await isMutualBlockedOrRestricted(viewerId, story.userId)) {
    return { ok: false, reason: 'blocked', story, ref };
  }
  const visible = await satisfiesVibeScope(story.userId, viewerId, story.visibility || 'public', story);
  if (!visible) {
    return { ok: false, reason: 'unauthorized', story, ref };
  }
  return { ok: true, story, ref };
}

async function notifyVibeEventSafely({
  recipientId,
  senderId,
  senderName = null,
  type,
  title,
  message,
  privateMessage = null,
  metadata = {},
  dedupKey = null,
  storyVisibility = 'public',
}) {
  if (!recipientId) return { skipped: true, reason: 'no_recipient' };
  if (senderId && recipientId === senderId) return { skipped: true, reason: 'self' };

  if (senderId && await isMutualBlockedOnly(recipientId, senderId)) {
    return { skipped: true, reason: 'blocked' };
  }

  if (dedupKey) {
    const cleanKey = dedupKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 140);
    const dedupRef = db.collection('vibe_idempotency').doc(`notif_${cleanKey}`);
    const dedupSnap = await dedupRef.get();
    if (dedupSnap.exists) {
      return { skipped: true, reason: 'duplicate' };
    }
    await dedupRef.set({
      recipientId,
      type,
      createdAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + 24 * 3600000),
    });
  }

  const [userSnap, settingsSnap] = await Promise.all([
    db.collection('users').doc(recipientId).get().catch(() => null),
    db.collection('user_settings').doc(recipientId).get().catch(() => null),
  ]);
  const userData = userSnap?.exists ? userSnap.data() : {};
  const settingsData = settingsSnap?.exists ? settingsSnap.data() : {};
  const vibePrefs = userData?.settings?.vibes || {};

  if (type === 'gift_received' && vibePrefs.giftNotifications === false) {
    return { skipped: true, reason: 'gift_notifications_disabled' };
  }
  if (type !== 'gift_received' && vibePrefs.vibeNotifications === false) {
    return { skipped: true, reason: 'vibe_notifications_disabled' };
  }

  const pushEnabled = settingsData?.notifications?.push !== false && userData?.settings?.notifications?.push !== false;
  const isRestrictedAudience = storyVisibility === 'close_circle' || storyVisibility === 'selected' || storyVisibility === 'private';
  const safeBody = (isRestrictedAudience && privateMessage) ? privateMessage : message;

  await writeNotification(recipientId, {
    type,
    title,
    message: safeBody,
    senderId: senderId || null,
    senderName: senderName || null,
    metadata,
  });

  if (pushEnabled) {
    enqueuePush(recipientId, {
      title,
      body: isRestrictedAudience ? 'New Vibe activity' : safeBody,
      type,
      data: metadata,
    }).catch((err) => log('warn', 'Vibe push enqueue failed', { recipientId, type, error: err.message }));
  }

  return { sent: true };
}

function getConversationShardPath(conversationId, convData = {}, date = new Date()) {
  if (convData?.type === 'group' && (Number(convData?.participantCount) || 0) >= 500) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `conversations/${conversationId}/messages_${year}_${month}`;
  }
  return `conversations/${conversationId}/messages`;
}

function buildVibePreviewPayload(story) {
  const thumb = story.media?.coverUrl || (story.type === 'image' ? story.media?.url : null) || story.media?.thumbnailUrl || null;
  return {
    type: 'vibe',
    vibeId: story.id,
    storyId: story.id,
    creatorId: story.userId,
    mediaType: story.type || 'image',
    previewUrl: thumb,
    caption: stripVibeText(story.content || '', 120),
    backgroundColor: story.backgroundColor || null,
    expiresAtMs: story.expiresAt?.toMillis?.() || null,
  };
}

// ----------------------------------------------------------------------
//  13. reactToVibe – curated semantic reactions (max 1 per user per Vibe)
// ----------------------------------------------------------------------
exports.reactToVibe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'reactToVibe', 40, 60000);

  const vibeId = typeof data?.vibeId === 'string' ? data.vibeId.trim() : (typeof data?.storyId === 'string' ? data.storyId.trim() : '');
  const rawReaction = data?.reaction;
  const isRemoval = rawReaction === null || rawReaction === '' || rawReaction === 'remove';
  const reactionKey = isRemoval ? null : normalizeVibeReactionKey(rawReaction);

  if (!vibeId) {
    throw new functions.https.HttpsError('invalid-argument', 'vibeId is required.');
  }
  if (!isRemoval && !reactionKey) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported Vibe reaction.');
  }

  const access = await resolveVibeForViewer(vibeId, uid);
  if (!access.ok) {
    throw new functions.https.HttpsError(
      access.reason === 'not_found' ? 'not-found' : 'permission-denied',
      'This Vibe is no longer available.'
    );
  }
  const reactPolicy = access.story.whoCanReact || (access.story.allowReactions === false ? 'nobody' : 'everyone');
  if (access.story.userId !== uid && !(await satisfiesVibeScope(access.story.userId, uid, reactPolicy, access.story))) {
    throw new functions.https.HttpsError('permission-denied', 'Reactions are restricted on this Vibe.');
  }

  const reactorSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const reactorData = reactorSnap?.exists ? reactorSnap.data() : {};
  const reactorName = reactorData.displayName || reactorData.username || `user ${uid.slice(0, 6)}`;
  const reactorAvatar = reactorData.photoURL || null;

  const storyRef = db.collection('stories').doc(vibeId);
  const reactionRef = storyRef.collection('reactions').doc(uid);

  const txResult = await db.runTransaction(async (t) => {
    const [storySnap, existingReactionSnap] = await Promise.all([t.get(storyRef), t.get(reactionRef)]);
    if (!storySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Vibe not found.');
    }
    const s = storySnap.data() || {};
    if (s.isDeleted || s.status === 'removed' || s.moderationStatus === 'rejected') {
      throw new functions.https.HttpsError('failed-precondition', 'This Vibe is no longer active.');
    }

    const prevKey = existingReactionSnap.exists
      ? normalizeVibeReactionKey(existingReactionSnap.data()?.reaction || existingReactionSnap.data()?.reactionType)
      : null;

    const currentBreakdown = {};
    const rawMap = s.stats?.reactionBreakdown || s.stats?.reactions || {};
    for (const [k, count] of Object.entries(rawMap)) {
      const normalized = normalizeVibeReactionKey(k);
      if (normalized) {
        currentBreakdown[normalized] = (currentBreakdown[normalized] || 0) + Math.max(0, Number(count) || 0);
      }
    }

    let nextKey = reactionKey;
    if (isRemoval || prevKey === reactionKey) {
      nextKey = null;
    }

    if (prevKey && prevKey !== nextKey) {
      currentBreakdown[prevKey] = Math.max(0, (currentBreakdown[prevKey] || 0) - 1);
      if (currentBreakdown[prevKey] === 0) delete currentBreakdown[prevKey];
    }
    if (nextKey && nextKey !== prevKey) {
      currentBreakdown[nextKey] = (currentBreakdown[nextKey] || 0) + 1;
    }

    const totalReactions = Object.values(currentBreakdown).reduce((sum, n) => sum + (Number(n) || 0), 0);

    if (nextKey === null) {
      if (existingReactionSnap.exists) {
        t.delete(reactionRef);
      }
    } else {
      t.set(reactionRef, {
        userId: uid,
        storyId: vibeId,
        targetType: 'vibe',
        reaction: nextKey,
        reactionType: nextKey,
        reactorName,
        reactorAvatar,
        createdAt: existingReactionSnap.exists ? (existingReactionSnap.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    t.update(storyRef, {
      'stats.reactionBreakdown': currentBreakdown,
      'stats.reactions': currentBreakdown,
      'stats.totalReactions': totalReactions,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      userReaction: nextKey,
      reactionBreakdown: currentBreakdown,
      totalReactions,
      isNewOrUpdated: Boolean(nextKey && nextKey !== prevKey),
      creatorId: s.userId,
      visibility: s.visibility || 'public',
    };
  });

  if (txResult.isNewOrUpdated && txResult.creatorId && txResult.creatorId !== uid) {
    const label = VIBE_REACTION_LABELS[txResult.userReaction] || txResult.userReaction;
    await notifyVibeEventSafely({
      recipientId: txResult.creatorId,
      senderId: uid,
      senderName: reactorName,
      type: 'vibe_reaction',
      title: 'New Vibe reaction',
      message: `${reactorName} reacted (${label}) to your Vibe.`,
      privateMessage: 'Someone reacted to your Vibe.',
      metadata: {
        vibeId,
        storyId: vibeId,
        reaction: txResult.userReaction,
        actionUrl: `/stories?vibeId=${vibeId}`,
      },
      dedupKey: `react_${vibeId}_${uid}_${txResult.userReaction}`,
      storyVisibility: txResult.visibility,
    }).catch((e) => log('warn', 'vibe_reaction notification failed', { vibeId, error: e.message }));

    await awardXpSafe(uid, 'vibe_reaction_sent', { source: vibeId });
    try {
      const { evaluateAchievementsForUser } = require('./levelSystem');
      await evaluateAchievementsForUser(uid);
    } catch (_) {
      /* best-effort post-reaction achievements */
    }
  }

  return {
    success: true,
    vibeId,
    userReaction: txResult.userReaction,
    reactionBreakdown: txResult.reactionBreakdown,
    totalReactions: txResult.totalReactions,
  };
});

// ----------------------------------------------------------------------
//  14. replyToVibe – send a direct reply referencing the Vibe into 1:1 chat
// ----------------------------------------------------------------------
exports.replyToVibe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'replyToVibe', 20, 60000);

  const vibeId = typeof data?.vibeId === 'string' ? data.vibeId.trim() : (typeof data?.storyId === 'string' ? data.storyId.trim() : '');
  const cleanText = stripVibeText(data?.text ?? data?.reply ?? '', 500);
  if (!vibeId || !cleanText) {
    throw new functions.https.HttpsError('invalid-argument', 'vibeId and non-empty reply text are required.');
  }

  const access = await resolveVibeForViewer(vibeId, uid);
  if (!access.ok) {
    throw new functions.https.HttpsError(
      access.reason === 'not_found' ? 'not-found' : 'permission-denied',
      'This Vibe is no longer available.'
    );
  }
  const story = access.story;
  if (story.userId === uid) {
    throw new functions.https.HttpsError('invalid-argument', 'You cannot reply to your own Vibe.');
  }

  const replyPolicy = story.whoCanReply || (story.allowReplies === false ? 'nobody' : 'everyone');
  if (!(await satisfiesVibeScope(story.userId, uid, replyPolicy, story))) {
    throw new functions.https.HttpsError('permission-denied', 'Replies are restricted on this Vibe.');
  }

  const senderSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const senderData = senderSnap?.exists ? senderSnap.data() : {};
  const senderName = senderData.displayName || senderData.username || `user ${uid.slice(0, 6)}`;
  const senderPhoto = senderData.photoURL || null;

  const participants = [uid, story.userId].sort();
  const conversationId = `direct_${participants.join('_')}`;
  const messageId = uuidv4();
  const convRef = db.collection('conversations').doc(conversationId);
  const msgRef = db.collection(getConversationShardPath(conversationId, { type: 'direct' })).doc(messageId);
  const lastMsgRef = db.collection('last_messages').doc(conversationId);
  const replyLogRef = db.collection('story_replies').doc(messageId);
  const storyRef = db.collection('stories').doc(vibeId);

  const attachment = buildVibePreviewPayload(story);
  const nowTs = FieldValue.serverTimestamp();
  const ttlExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const txResult = await db.runTransaction(async (t) => {
    const [convSnap, storySnap] = await Promise.all([t.get(convRef), t.get(storyRef)]);
    if (!storySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Vibe not found.');
    }
    const freshStory = storySnap.data() || {};
    if (freshStory.isDeleted || freshStory.status === 'removed' || freshStory.allowReplies === false || freshStory.whoCanReply === 'nobody') {
      throw new functions.https.HttpsError('failed-precondition', 'Replies are unavailable for this Vibe.');
    }

    if (!convSnap.exists) {
      t.set(convRef, {
        id: conversationId,
        type: 'direct',
        participants,
        participantCount: 2,
        createdBy: uid,
        createdAt: nowTs,
        updatedAt: nowTs,
        lastActivity: nowTs,
        isDeleted: false,
      });
    } else {
      t.update(convRef, {
        lastActivity: nowTs,
        updatedAt: nowTs,
      });
    }

    t.set(msgRef, {
      id: messageId,
      conversationId,
      senderId: uid,
      senderName,
      senderPhoto,
      type: 'text',
      content: cleanText,
      encrypted: false,
      encryptedData: null,
      media: null,
      attachment,
      metadata: {
        type: 'vibe_reply',
        storyId: vibeId,
        vibeId,
        creatorId: story.userId,
        previewText: stripVibeText(story.content || '', 120),
      },
      mentions: [],
      threadId: null,
      threadDepth: 0,
      reactions: {},
      isEdited: false,
      isDeleted: false,
      deletedFor: [],
      readBy: [uid],
      deliveredTo: [],
      createdAt: nowTs,
      updatedAt: nowTs,
      ttlExpiresAt,
    });

    t.set(lastMsgRef, {
      messageId,
      text: cleanText.slice(0, 60),
      senderId: uid,
      type: 'text',
      timestamp: nowTs,
      updatedAt: nowTs,
    });

    t.set(replyLogRef, {
      id: messageId,
      storyId: vibeId,
      vibeId,
      userId: uid,
      authorId: uid,
      toUserId: story.userId,
      conversationId,
      text: cleanText,
      createdAt: nowTs,
    });

    t.update(storyRef, {
      'stats.replies': FieldValue.increment(1),
      updatedAt: nowTs,
    });

    return {
      replyCount: (Number(freshStory.stats?.replies) || 0) + 1,
    };
  });

  await notifyVibeEventSafely({
    recipientId: story.userId,
    senderId: uid,
    senderName,
    type: 'vibe_reply',
    title: 'New Vibe reply',
    message: `${senderName}: "${cleanText.slice(0, 80)}"`,
    privateMessage: `${senderName} replied to your Vibe.`,
    metadata: {
      vibeId,
      storyId: vibeId,
      conversationId,
      messageId,
      actionUrl: `/chat/${conversationId}`,
    },
    dedupKey: `reply_${vibeId}_${messageId}`,
    storyVisibility: story.visibility || 'public',
  }).catch((e) => log('warn', 'vibe_reply notification failed', { vibeId, error: e.message }));

  await awardXpSafe(uid, 'vibe_reply_sent', { source: `${vibeId}_${messageId}` });
  try {
    const { evaluateAchievementsForUser } = require('./levelSystem');
    await evaluateAchievementsForUser(uid);
  } catch (_) {
    /* best-effort post-reply achievements */
  }

  return {
    success: true,
    vibeId,
    messageId,
    conversationId,
    replyCount: txResult.replyCount,
  };
});

// ----------------------------------------------------------------------
//  15. shareVibe – share to direct/group chat or copy authorized deep-link
// ----------------------------------------------------------------------
exports.shareVibe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'shareVibe', 25, 60000);

  const vibeId = typeof data?.vibeId === 'string' ? data.vibeId.trim() : (typeof data?.storyId === 'string' ? data.storyId.trim() : '');
  const mode = String(data?.mode || 'link').toLowerCase();
  const caption = stripVibeText(data?.caption || '', 300);
  const targetConversationIds = Array.isArray(data?.conversationIds)
    ? [...new Set(data.conversationIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 10)
    : (typeof data?.conversationId === 'string' && data.conversationId.trim() ? [data.conversationId.trim()] : []);
  const recipientIds = Array.isArray(data?.recipientIds)
    ? [...new Set(data.recipientIds.map((id) => String(id || '').trim()).filter((id) => id && id !== uid))].slice(0, 10)
    : [];

  if (!vibeId || !['direct', 'group', 'link'].includes(mode)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid vibeId and share mode are required.');
  }

  const access = await resolveVibeForViewer(vibeId, uid);
  if (!access.ok) {
    throw new functions.https.HttpsError(
      access.reason === 'not_found' ? 'not-found' : 'permission-denied',
      'This Vibe cannot be shared.'
    );
  }
  const story = access.story;
  const sharePolicy = story.whoCanShare || 'followers';
  if (story.userId !== uid && !(await satisfiesVibeScope(story.userId, uid, sharePolicy, story))) {
    throw new functions.https.HttpsError('permission-denied', 'Sharing is restricted on this Vibe.');
  }

  const visibility = String(story.visibility || 'public').toLowerCase();
  if (visibility === 'private') {
    throw new functions.https.HttpsError('permission-denied', 'Private Vibes cannot be shared.');
  }
  if (mode === 'link' && visibility === 'selected') {
    throw new functions.https.HttpsError('permission-denied', 'Selected-audience Vibes cannot be shared via link.');
  }

  const senderSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const senderData = senderSnap?.exists ? senderSnap.data() : {};
  const senderName = senderData.displayName || senderData.username || `user ${uid.slice(0, 6)}`;
  const senderPhoto = senderData.photoURL || null;
  const attachment = buildVibePreviewPayload(story);
  const deepLink = `/stories?vibeId=${encodeURIComponent(vibeId)}`;
  const nowTs = FieldValue.serverTimestamp();
  const ttlExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const deliveredConversations = [];

  if (mode === 'direct' || mode === 'group') {
    // Resolve direct recipients into direct conversation entries
    const directTargets = [];
    for (const recipientId of recipientIds) {
      if (await isMutualBlockedOrRestricted(uid, recipientId)) continue;
      if (story.userId !== recipientId && await isMutualBlockedOrRestricted(story.userId, recipientId)) continue;
      const recipientAllowed = visibility === 'public'
        ? true
        : await satisfiesVibeScope(story.userId, recipientId, visibility, story);
      if (!recipientAllowed) continue;
      const sorted = [uid, recipientId].sort();
      directTargets.push({ conversationId: `direct_${sorted.join('_')}`, participants: sorted, createIfMissing: true });
    }

    for (const cid of targetConversationIds) {
      const convSnap = await db.collection('conversations').doc(cid).get();
      if (!convSnap.exists) continue;
      const conv = convSnap.data() || {};
      const parts = Array.isArray(conv.participants) ? conv.participants : [];
      if (!parts.includes(uid) || conv.isDeleted) continue;

      if (conv.type === 'direct') {
        const otherId = parts.find((p) => p !== uid);
        if (!otherId) continue;
        if (await isMutualBlockedOrRestricted(uid, otherId)) continue;
        if (story.userId !== otherId && await isMutualBlockedOrRestricted(story.userId, otherId)) continue;
        const allowed = visibility === 'public'
          ? true
          : await satisfiesVibeScope(story.userId, otherId, visibility, story);
        if (!allowed) continue;
        directTargets.push({ conversationId: cid, conv, participants: parts, createIfMissing: false });
      } else {
        // Group / channel sharing is only allowed when Vibe audience is public/everyone
        if (visibility !== 'public') continue;
        directTargets.push({ conversationId: cid, conv, participants: parts, createIfMissing: false });
      }
    }

    if (directTargets.length === 0) {
      throw new functions.https.HttpsError('permission-denied', 'No eligible recipients can view this Vibe.');
    }

    const dedupTargets = new Map();
    for (const target of directTargets) {
      dedupTargets.set(target.conversationId, target);
    }

    const batch = db.batch();
    for (const target of dedupTargets.values()) {
      const msgId = uuidv4();
      const convRef = db.collection('conversations').doc(target.conversationId);
      const shardPath = getConversationShardPath(target.conversationId, target.conv || { type: 'direct' });
      const msgRef = db.collection(shardPath).doc(msgId);
      const lastMsgRef = db.collection('last_messages').doc(target.conversationId);

      if (target.createIfMissing) {
        batch.set(convRef, {
          id: target.conversationId,
          type: 'direct',
          participants: target.participants,
          participantCount: 2,
          createdBy: uid,
          createdAt: nowTs,
          updatedAt: nowTs,
          lastActivity: nowTs,
          isDeleted: false,
        }, { merge: true });
      } else {
        batch.update(convRef, { lastActivity: nowTs, updatedAt: nowTs });
      }

      batch.set(msgRef, {
        id: msgId,
        conversationId: target.conversationId,
        senderId: uid,
        senderName,
        senderPhoto,
        type: 'text',
        content: caption || 'Shared a Vibe',
        encrypted: false,
        encryptedData: null,
        media: null,
        attachment,
        metadata: {
          type: 'vibe_share',
          storyId: vibeId,
          vibeId,
          creatorId: story.userId,
        },
        mentions: [],
        threadId: null,
        threadDepth: 0,
        reactions: {},
        isEdited: false,
        isDeleted: false,
        deletedFor: [],
        readBy: [uid],
        deliveredTo: [],
        createdAt: nowTs,
        updatedAt: nowTs,
        ttlExpiresAt,
      });

      batch.set(lastMsgRef, {
        messageId: msgId,
        text: caption ? caption.slice(0, 60) : 'Shared a Vibe',
        senderId: uid,
        type: 'text',
        timestamp: nowTs,
        updatedAt: nowTs,
      });
      deliveredConversations.push(target.conversationId);
    }

    batch.update(db.collection('stories').doc(vibeId), {
      'stats.shares': FieldValue.increment(deliveredConversations.length),
      updatedAt: nowTs,
    });
    await batch.commit();
  } else {
    await db.collection('stories').doc(vibeId).update({
      'stats.shares': FieldValue.increment(1),
      updatedAt: nowTs,
    });
  }

  const shareDelta = mode === 'link' ? 1 : deliveredConversations.length;
  if (story.userId !== uid) {
    await notifyVibeEventSafely({
      recipientId: story.userId,
      senderId: uid,
      senderName,
      type: 'vibe_share',
      title: 'Vibe shared',
      message: `${senderName} shared your Vibe.`,
      privateMessage: 'Someone shared your Vibe.',
      metadata: {
        vibeId,
        storyId: vibeId,
        actionUrl: deepLink,
      },
      dedupKey: `share_${vibeId}_${uid}`,
      storyVisibility: visibility,
    }).catch((e) => log('warn', 'vibe_share notification failed', { vibeId, error: e.message }));
  }

  await awardXpSafe(uid, 'vibe_shared', { source: vibeId });

  return {
    success: true,
    vibeId,
    mode,
    sharedCount: shareDelta,
    conversationIds: deliveredConversations,
    deepLink,
  };
});

// ----------------------------------------------------------------------
//  16. recordVibeEngagement – idempotent view, completion, replay & milestones
// ----------------------------------------------------------------------
exports.recordVibeEngagement = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'recordVibeEngagement', 120, 60000);

  const vibeId = typeof data?.vibeId === 'string' ? data.vibeId.trim() : (typeof data?.storyId === 'string' ? data.storyId.trim() : '');
  const eventType = String(data?.eventType || 'view').toLowerCase();
  if (!vibeId || !['view', 'completion', 'replay'].includes(eventType)) {
    throw new functions.https.HttpsError('invalid-argument', 'vibeId and valid eventType are required.');
  }

  const access = await resolveVibeForViewer(vibeId, uid);
  if (!access.ok) {
    throw new functions.https.HttpsError(
      access.reason === 'not_found' ? 'not-found' : 'permission-denied',
      'This Vibe is no longer available.'
    );
  }
  const story = access.story;
  if (story.userId === uid) {
    return { success: true, vibeId, ignoredOwner: true, stats: story.stats || {} };
  }

  const viewerSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const viewerData = viewerSnap?.exists ? viewerSnap.data() : {};
  const showViewingActivity = viewerData?.settings?.vibes?.showViewingActivity !== false;
  const viewerName = showViewingActivity ? (viewerData.displayName || viewerData.username || null) : null;
  const viewerAvatar = showViewingActivity ? (viewerData.photoURL || null) : null;

  const storyRef = db.collection('stories').doc(vibeId);
  const viewRef = storyRef.collection('views').doc(uid);

  const txResult = await db.runTransaction(async (t) => {
    const [storySnap, viewSnap] = await Promise.all([t.get(storyRef), t.get(viewRef)]);
    if (!storySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Vibe not found.');
    }
    const s = storySnap.data() || {};
    const stats = s.stats || {};
    const currentViews = Number(stats.views) || 0;
    const currentUnique = Number(stats.uniqueViewers) || 0;
    const currentCompletions = Number(stats.completions) || 0;
    const currentReplays = Number(stats.replays) || 0;

    let isNewView = false;
    let nextViews = currentViews;
    let nextUnique = currentUnique;
    let nextCompletions = currentCompletions;
    let nextReplays = currentReplays;
    const milestonesAwarded = Array.isArray(s.milestonesAwarded) ? [...s.milestonesAwarded] : [];
    const triggeredMilestones = [];

    if (!viewSnap.exists) {
      isNewView = true;
      nextViews += 1;
      nextUnique += 1;
      t.set(viewRef, {
        viewerId: uid,
        hiddenFromCreator: !showViewingActivity,
        viewerName,
        viewerAvatar,
        viewCount: 1,
        completed: eventType === 'completion',
        replayCount: 0,
        viewedAt: FieldValue.serverTimestamp(),
        lastViewedAt: FieldValue.serverTimestamp(),
      });
      if (eventType === 'completion') nextCompletions += 1;
    } else {
      const vd = viewSnap.data() || {};
      const viewUpdate = {
        hiddenFromCreator: !showViewingActivity,
        viewerName,
        viewerAvatar,
        lastViewedAt: FieldValue.serverTimestamp(),
      };
      if (eventType === 'completion' && !vd.completed) {
        viewUpdate.completed = true;
        viewUpdate.completedAt = FieldValue.serverTimestamp();
        nextCompletions += 1;
      } else if (eventType === 'replay' && (Number(vd.replayCount) || 0) < 5) {
        viewUpdate.replayCount = (Number(vd.replayCount) || 0) + 1;
        nextReplays += 1;
      }
      t.update(viewRef, viewUpdate);
    }

    for (const threshold of VIBE_MILESTONES) {
      if (nextViews >= threshold && !milestonesAwarded.includes(threshold)) {
        milestonesAwarded.push(threshold);
        triggeredMilestones.push(threshold);
      }
    }

    t.update(storyRef, {
      'stats.views': nextViews,
      'stats.uniqueViewers': nextUnique,
      'stats.completions': nextCompletions,
      'stats.replays': nextReplays,
      ...(triggeredMilestones.length > 0 ? { milestonesAwarded } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      isNewView,
      creatorId: s.userId,
      visibility: s.visibility || 'public',
      triggeredMilestones,
      stats: {
        ...stats,
        views: nextViews,
        uniqueViewers: nextUnique,
        completions: nextCompletions,
        replays: nextReplays,
      },
    };
  });

  if (txResult.isNewView) {
    await awardXpSafe(uid, 'story_viewed', { source: vibeId });
  }

  for (const milestone of txResult.triggeredMilestones) {
    await notifyVibeEventSafely({
      recipientId: txResult.creatorId,
      senderId: null,
      type: 'vibe_milestone',
      title: `Vibe milestone: ${milestone} views`,
      message: `Your Vibe reached ${milestone} genuine views.`,
      metadata: {
        vibeId,
        storyId: vibeId,
        milestone,
        actionUrl: `/stories?vibeId=${vibeId}`,
      },
      dedupKey: `milestone_${vibeId}_${milestone}`,
      storyVisibility: txResult.visibility,
    }).catch((e) => log('warn', 'vibe_milestone notification failed', { vibeId, milestone, error: e.message }));

    await awardXpSafe(txResult.creatorId, 'vibe_milestone_reached', { source: `${vibeId}_${milestone}` });
  }

  if (txResult.triggeredMilestones.length > 0) {
    try {
      const { evaluateAchievementsForUser } = require('./levelSystem');
      await evaluateAchievementsForUser(txResult.creatorId);
    } catch (_) {
      /* best-effort milestone achievement eval */
    }
  }

  return {
    success: true,
    vibeId,
    isNewView: txResult.isNewView,
    stats: txResult.stats,
  };
});

// ----------------------------------------------------------------------
//  17. getVibeInsights – creator-only engagement & reactor/gift breakdown
// ----------------------------------------------------------------------
exports.getVibeInsights = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'getVibeInsights', 30, 60000);

  const vibeId = typeof data?.vibeId === 'string' ? data.vibeId.trim() : (typeof data?.storyId === 'string' ? data.storyId.trim() : '');
  if (!vibeId) {
    throw new functions.https.HttpsError('invalid-argument', 'vibeId is required.');
  }

  const storyRef = db.collection('stories').doc(vibeId);
  const storySnap = await storyRef.get();
  let story = storySnap.exists ? storySnap.data() : null;
  if (!story) {
    const archiveSnap = await db.collection('archived_stories').doc(vibeId).get();
    story = archiveSnap.exists ? archiveSnap.data() : null;
  }
  if (!story) {
    throw new functions.https.HttpsError('not-found', 'Vibe not found.');
  }
  if (story.userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the creator can inspect Vibe insights.');
  }

  const creatorSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const showReactionDetails = creatorSnap?.exists ? creatorSnap.data()?.settings?.vibes?.showReactionDetails !== false : true;

  const [viewsSnap, reactionsSnap, giftsSnap] = await Promise.all([
    storyRef.collection('views').orderBy('lastViewedAt', 'desc').limit(100).get().catch(() => ({ docs: [] })),
    showReactionDetails
      ? storyRef.collection('reactions').orderBy('updatedAt', 'desc').limit(100).get().catch(() => ({ docs: [] }))
      : Promise.resolve({ docs: [] }),
    storyRef.collection('gifts').orderBy('createdAt', 'desc').limit(100).get().catch(() => ({ docs: [] })),
  ]);

  const rawViewers = viewsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((v) => !v.hiddenFromCreator && v.viewerId && v.viewerId !== uid);
  const rawReactors = reactionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.userId && r.userId !== uid);
  const rawGifts = giftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Exclude users blocked in either direction
  const candidateIds = [...new Set([
    ...rawViewers.map((v) => v.viewerId),
    ...rawReactors.map((r) => r.userId),
    ...rawGifts.map((g) => g.senderId).filter(Boolean),
  ])];

  const blockedSet = new Set();
  const profileMap = new Map();
  if (candidateIds.length > 0) {
    const userRefs = candidateIds.slice(0, 60).map((cid) => db.collection('users').doc(cid));
    const blockRefs = candidateIds.slice(0, 60).flatMap((cid) => [
      db.doc(`blocks/${uid}_${cid}`),
      db.doc(`blocks/${cid}_${uid}`),
    ]);
    const [userSnaps, blockSnaps] = await Promise.all([
      db.getAll(...userRefs),
      db.getAll(...blockRefs),
    ]);
    userSnaps.forEach((s) => {
      if (s.exists) profileMap.set(s.id, s.data());
    });
    candidateIds.slice(0, 60).forEach((cid, i) => {
      if (blockSnaps[i * 2]?.exists || blockSnaps[i * 2 + 1]?.exists) {
        blockedSet.add(cid);
      }
    });
  }

  const stats = story.stats || {};
  const reactionBreakdown = {};
  const rawBd = stats.reactionBreakdown || stats.reactions || {};
  for (const [k, count] of Object.entries(rawBd)) {
    const norm = normalizeVibeReactionKey(k);
    if (norm) reactionBreakdown[norm] = (reactionBreakdown[norm] || 0) + Math.max(0, Number(count) || 0);
  }
  const totalReactions = Number(stats.totalReactions ?? Object.values(reactionBreakdown).reduce((a, b) => a + b, 0)) || 0;

  return {
    success: true,
    vibeId,
    showReactionDetails,
    stats: {
      views: Number(stats.views) || 0,
      uniqueViewers: Number(stats.uniqueViewers) || 0,
      completions: Number(stats.completions) || 0,
      replays: Number(stats.replays) || 0,
      totalReactions,
      reactionBreakdown,
      replies: Number(stats.replies) || 0,
      shares: Number(stats.shares) || 0,
      gifts: Number(stats.gifts) || 0,
      giftCoins: Number(stats.giftCoins) || 0,
    },
    viewers: rawViewers
      .filter((v) => !blockedSet.has(v.viewerId))
      .map((v) => {
        const p = profileMap.get(v.viewerId) || {};
        return {
          userId: v.viewerId,
          displayName: p.displayName || p.username || v.viewerName || null,
          username: p.username || null,
          photoURL: p.photoURL || v.viewerAvatar || null,
          completed: Boolean(v.completed),
          viewedAtMs: v.lastViewedAt?.toMillis?.() || v.viewedAt?.toMillis?.() || null,
        };
      }),
    reactors: showReactionDetails
      ? rawReactors
          .filter((r) => !blockedSet.has(r.userId))
          .map((r) => {
            const p = profileMap.get(r.userId) || {};
            return {
              userId: r.userId,
              displayName: p.displayName || p.username || r.reactorName || null,
              username: p.username || null,
              photoURL: p.photoURL || r.reactorAvatar || null,
              reaction: normalizeVibeReactionKey(r.reaction || r.reactionType),
              updatedAtMs: r.updatedAt?.toMillis?.() || null,
            };
          })
      : [],
    gifts: rawGifts
      .filter((g) => !blockedSet.has(g.senderId))
      .map((g) => {
        const p = profileMap.get(g.senderId) || {};
        return {
          id: g.id,
          senderId: g.senderId,
          displayName: p.displayName || p.username || g.senderName || null,
          photoURL: p.photoURL || g.senderAvatar || null,
          giftType: g.giftType,
          coins: Number(g.coins) || 0,
          createdAtMs: g.createdAt?.toMillis?.() || null,
        };
      }),
  };
});

// ----------------------------------------------------------------------
//  18. reorderHighlights – owner-verified persistent highlight ordering
// ----------------------------------------------------------------------
exports.reorderHighlights = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = context.auth.uid;
  await checkRateLimit(uid, 'reorderHighlights', 30, 60000);

  const orderedIds = Array.isArray(data?.orderedIds)
    ? [...new Set(data.orderedIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 50)
    : [];
  if (orderedIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'orderedIds array is required.');
  }

  const refs = orderedIds.map((id) => db.collection('highlights').doc(id));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();

  snaps.forEach((snap, idx) => {
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', `Highlight ${orderedIds[idx]} not found.`);
    }
    if (snap.data()?.userId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'You can only reorder your own Highlights.');
    }
    batch.update(snap.ref, {
      sortOrder: idx,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  return { success: true, orderedIds };
});

// ==================== REQUIRED FIRESTORE INDEXES ====================
/*
  Create the following composite indexes in the Firebase Console:

  1. stories: visibility ASC, moderationStatus ASC, isDeleted ASC, expiresAt ASC, createdAt DESC
  2. stories: userId ASC, moderationStatus ASC, isDeleted ASC, expiresAt ASC, createdAt DESC
  3. follows: followingId ASC, followerId ASC
  4. blocks: blockerId ASC
  5. blocks: blockedId ASC
  6. fanout_tasks: status ASC, createdAt ASC
  7. fanout_tasks: status ASC, processingStartedAt ASC

  TTL POLICY:
  Enable TTL on rate_limits/<shard>/shards.expireAt to automatically clean up old rate limit documents.
*/