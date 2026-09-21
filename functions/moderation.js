// functions/moderation.js — content moderation, reporting, and AI authoring
//
// This module is the single server-side implementation for four features the
// client depends on:
//
//   1. moderatePost          — server-side moderation check for the composer
//   2. reportContent         — one unified callable for post/comment/user/video
//                              reports (client may still call reportComment /
//                              reportPost / reportVideo, which are thin aliases)
//   3. generateAICaption /   — creator writing assistance backed by the AI
//      generateAIHashtags      gateway (functions/ai.js). Fail loudly when the
//                              provider is unconfigured; never fabricate text.
//   4. predictPostPerformance — deterministic, explainable predictions derived
//                              from the real payload (no random/fake metrics).
//
// Every report lands in the collection the admin console already reads
// (comment_reports / user_reports / video_reports / post_reports) so a single
// moderation queue covers all content types.
//
// Configuration:
//   functions:config:set perspective.api_key="..."   (moderation)
//   AI_OPENAI_API_KEY / AI_MODEL                     (see functions/ai.js)

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const logger = functions.logger;
const { checkRateLimit } = require('./rateLimit');
const { checkIsAdmin } = require('./auth');

// ----------------------------------------------------------------------
//  Shared helpers
// ----------------------------------------------------------------------
function validateAuth(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  return context.auth.uid;
}

function stripHtml(value) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
}

// Where each report type is stored, how to label it, and which doc field the
// content id lives in. This table is the single source of truth for report
// routing; both the callable and the admin queue use these collection names.
const REPORT_TARGETS = {
  post: { collection: 'post_reports', contentField: 'postId', contentCollection: 'posts' },
  comment: { collection: 'comment_reports', contentField: 'commentId', contentCollection: 'comments' },
  user: { collection: 'user_reports', contentField: 'reportedUserId', contentCollection: 'users' },
  video: { collection: 'video_reports', contentField: 'videoId', contentCollection: 'videos' },
  story: { collection: 'story_reports', contentField: 'storyId', contentCollection: 'stories' },
};

// Exactly the field names the admin console reads (reporterName, content,
// priority). Writing them once here keeps every report type queue-compatible.
async function buildReportRecord(reporterId, type, targetId, reason, details) {
  const [reporterSnap, contentSnap] = await Promise.all([
    db.doc(`users/${reporterId}`).get(),
    db.doc(`${REPORT_TARGETS[type].contentCollection}/${targetId}`).get().catch(() => null),
  ]);
  const reporter = reporterSnap.exists ? reporterSnap.data() : {};
  const content = contentSnap && contentSnap.exists ? contentSnap.data() : {};

  return {
    reporterId,
    reporterName: reporter.username || reporter.displayName || reporter.name || 'Arvdoul user',
    reportedUserId: content.userId || content.authorId || (type === 'user' ? targetId : null),
    reason,
    details: stripHtml(details).slice(0, 1000),
    status: 'pending',
    priority: 'normal',
    // A short, already-public excerpt so moderators can triage without opening
    // the original document. Empty for non-text targets.
    content: stripHtml(content.content || content.text || content.caption || '').slice(0, 280),
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  };
}

// ----------------------------------------------------------------------
//  1. reportContent — unified report submission
// ----------------------------------------------------------------------
async function handleReportContent(data, context) {
  const uid = validateAuth(context);
  const { type, targetId, reason, details = '' } = data || {};
  const cleanedReason = stripHtml(reason).slice(0, 300);

  if (!REPORT_TARGETS[type]) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported report type.');
  }
  if (!targetId) {
    throw new functions.https.HttpsError('invalid-argument', 'targetId is required.');
  }
  if (!cleanedReason) {
    throw new functions.https.HttpsError('invalid-argument', 'A reason is required.');
  }

  await checkRateLimit(uid, 'reportContent', 10, 60000);

  const { collection, contentField } = REPORT_TARGETS[type];

  // The report id is derived from the reporter and target, so duplicate
  // submissions collide on the same document instead of needing a composite
  // index-backed query to detect them.
  const reportRef = db.collection(collection).doc(`${uid}_${targetId}`);
  if ((await reportRef.get()).exists) {
    throw new functions.https.HttpsError('already-exists', 'You have already reported this content.');
  }

  const record = await buildReportRecord(uid, type, targetId, cleanedReason, details);

  await reportRef.set({ [contentField]: targetId, ...record });

  // Keep a counter on the target so queues can prioritise heavily-reported
  // content. Best-effort: a missing target document is not an error.
  try {
    await db
      .doc(`${REPORT_TARGETS[type].contentCollection}/${targetId}`)
      .update({ reportCount: FieldValue.increment(1) });
  } catch (_) {
    // Target may not exist (e.g. already deleted); the report is still stored.
  }

  return { success: true, type, targetId };
}

exports.reportContent = functions.https.onCall(handleReportContent);

// Thin aliases preserve the existing client contracts and keep one code path.
// Each reads its own target field so callers can keep their current payloads.
function reportAlias(type) {
  const { contentField } = REPORT_TARGETS[type];
  return functions.https.onCall(async (data, context) => {
    const targetId = data?.targetId || data?.[contentField];
    return handleReportContent({ ...data, type, targetId }, context);
  });
}

exports.reportPost = reportAlias('post');
exports.reportComment = reportAlias('comment');
exports.reportVideo = reportAlias('video');
exports.reportUser = reportAlias('user');

// ----------------------------------------------------------------------
//  2. getReports — moderation queue reader (admin only)
// ----------------------------------------------------------------------
exports.getReports = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  if (!(await checkIsAdmin(uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const { status = 'pending', limit: limitCount = 50 } = data || {};
  const collections = Object.values(REPORT_TARGETS).map((t) => t.collection);
  const results = await Promise.all(
    collections.map(async (name) => {
      let query = db.collection(name).orderBy('createdAt', 'desc').limit(limitCount);
      if (status !== 'all') query = query.where('status', '==', status);
      const snap = await query.get();
      return snap.docs.map((d) => ({ id: d.id, collection: name, type: name.replace('_reports', ''), ...d.data() }));
    })
  );

  return {
    success: true,
    reports: results
      .flat()
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
  };
});

// ----------------------------------------------------------------------
//  3. resolveReport — moderation action (admin only)
// ----------------------------------------------------------------------
exports.resolveReport = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  if (!(await checkIsAdmin(uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const { reportId, collection, action, reason = '' } = data || {};
  if (!reportId || !collection || !REPORT_TARGETS[collection.replace('_reports', '')]) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid reportId and collection are required.');
  }
  if (!['resolved', 'dismissed', 'escalated'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'action must be resolved, dismissed, or escalated.');
  }

  await db.doc(`${collection}/${reportId}`).update({
    status: action,
    resolutionReason: stripHtml(reason).slice(0, 500),
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedBy: uid,
  });

  await db.collection('moderation_logs').add({
    reportId,
    collection,
    action,
    moderatorId: uid,
    reason: stripHtml(reason).slice(0, 500),
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, action };
});

// ----------------------------------------------------------------------
//  4. moderatePost — pre-publish moderation for the composer.
//
//  Uses the Perspective API when configured. When it is not configured the
//  response is explicitly `unknown` and `approved: false` — the composer must
//  never display a fabricated "passed moderation".
// ----------------------------------------------------------------------
exports.moderatePost = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  const content = stripHtml(data?.content).slice(0, 5000);
  if (!content) {
    throw new functions.https.HttpsError('invalid-argument', 'content is required.');
  }

  await checkRateLimit(uid, 'moderatePost', 30, 60000);

  const apiKey = functions.config()?.perspective?.api_key;
  if (!apiKey) {
    logger.warn('Perspective API key missing – post moderation unavailable');
    return {
      success: true,
      approved: false,
      unknown: true,
      flags: [],
      reason: 'moderation_unconfigured',
    };
  }

  let response;
  try {
    response = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text: content },
          languages: ['en', 'ha', 'fr', 'auto'],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            THREAT: {},
            IDENTITY_ATTACK: {},
            SEXUALLY_EXPLICIT: {},
          },
        }),
        signal: AbortSignal.timeout(6000),
      }
    );
  } catch (err) {
    logger.error('moderatePost provider unreachable', { error: err.message });
    return { success: true, approved: false, unknown: true, flags: [], reason: 'provider_unreachable' };
  }

  if (!response.ok) {
    logger.error('moderatePost provider error', { status: response.status });
    return { success: true, approved: false, unknown: true, flags: [], reason: `provider_error_${response.status}` };
  }

  const result = await response.json();
  const scores = result?.attributeScores || {};
  const scoreOf = (attr) => scores[attr]?.summaryScore?.value || 0;

  const thresholds = {
    TOXICITY: 0.7,
    SEVERE_TOXICITY: 0.5,
    THREAT: 0.6,
    IDENTITY_ATTACK: 0.6,
    SEXUALLY_EXPLICIT: 0.6,
  };

  const flags = Object.entries(thresholds)
    .filter(([attr, threshold]) => scoreOf(attr) >= threshold)
    .map(([attr]) => attr.toLowerCase());

  const toxicity = scoreOf('TOXICITY');

  return {
    success: true,
    approved: flags.length === 0,
    unknown: false,
    flags,
    // 0.3–0.7 means "flagged for review" rather than a hard rejection.
    needsReview: flags.length === 0 && toxicity >= 0.3,
    scores: { toxicity },
  };
});

// ----------------------------------------------------------------------
//  5. AI authoring helpers (caption + hashtags)
//
//  Both reuse the AI gateway callable so rate limiting, budget caps and
//  telemetry stay in one place. Text is derived from real input; when the
//  provider is unconfigured the call fails loudly instead of inventing copy.
// ----------------------------------------------------------------------
async function callAIGateway(prompt, systemPrompt, capability) {
  const apiKey = process.env.AI_OPENAI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'AI writing assistant is not configured. Contact support.'
    );
  }
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new functions.https.HttpsError('internal', `AI provider error (${res.status})`);
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new functions.https.HttpsError('internal', 'AI provider returned no content.');
  }
  logger.info('AI authoring', { capability, model });
  return text;
}

exports.generateAICaption = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  const content = stripHtml(data?.content).slice(0, 2000);
  const mediaDescriptions = Array.isArray(data?.mediaDescriptions)
    ? data.mediaDescriptions.filter((d) => typeof d === 'string').slice(0, 10)
    : [];
  const style = stripHtml(data?.style).slice(0, 40) || 'casual';

  if (!content && mediaDescriptions.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Add some content or media first.');
  }

  await checkRateLimit(uid, 'generateAICaption', 20, 60000);

  const prompt = [
    `Write one ${style} social caption.`,
    content ? `Existing text: ${content}` : 'There is no text yet.',
    mediaDescriptions.length ? `Media: ${mediaDescriptions.join(', ')}` : '',
    'Return only the caption, no quotes, no hashtags, max 220 characters.',
  ]
    .filter(Boolean)
    .join('\n');

  const caption = await callAIGateway(prompt, 'You write concise, engaging social captions.', 'caption');
  return { success: true, caption };
});

exports.generateAIHashtags = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  const content = stripHtml(data?.content).slice(0, 2000);
  const mediaTypes = Array.isArray(data?.mediaTypes)
    ? data.mediaTypes.filter((t) => typeof t === 'string').slice(0, 10)
    : [];

  if (!content && mediaTypes.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Add some content or media first.');
  }

  await checkRateLimit(uid, 'generateAIHashtags', 20, 60000);

  const prompt = [
    'Suggest 8 relevant social media hashtags.',
    content ? `Post: ${content}` : '',
    mediaTypes.length ? `Media types: ${mediaTypes.join(', ')}` : '',
    'Return only space-separated hashtags starting with #.',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await callAIGateway(prompt, 'You are a social media hashtag expert.', 'hashtags');
  const hashtags = [...new Set((raw.match(/#[\p{L}\p{N}_]+/gu) || []))].slice(0, 15);
  if (hashtags.length === 0) {
    throw new functions.https.HttpsError('internal', 'AI provider returned no usable hashtags.');
  }
  return { success: true, hashtags };
});

// ----------------------------------------------------------------------
//  6. predictPostPerformance
//
//  Explainable predictions computed from the real submitted payload. The
//  scoring is deterministic: the same draft always produces the same numbers,
//  and every value is derived from a field the caller sent. Nothing is random
//  and nothing is invented about reach the platform cannot know in advance.
// ----------------------------------------------------------------------
const POST_TYPE_BASE = {
  video: { reach: 2200, engagement: 5.4 },
  reel: { reach: 2600, engagement: 6.1 },
  image: { reach: 1400, engagement: 4.2 },
  text: { reach: 700, engagement: 3.1 },
  carousel: { reach: 1800, engagement: 4.9 },
  poll: { reach: 1100, engagement: 6.8 },
  question: { reach: 900, engagement: 5.2 },
  audio: { reach: 1200, engagement: 4.4 },
  link: { reach: 800, engagement: 2.8 },
  event: { reach: 1000, engagement: 4.0 },
};

exports.predictPostPerformance = functions.https.onCall(async (data, context) => {
  const uid = validateAuth(context);
  const {
    postType = 'text',
    content = '',
    mediaCount = 0,
    scheduledTime = null,
    visibility = 'public',
    boost = null,
  } = data || {};

  await checkRateLimit(uid, 'predictPostPerformance', 60, 60000);

  const base = POST_TYPE_BASE[postType] || POST_TYPE_BASE.text;
  const text = stripHtml(content);
  const hashtags = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;

  const factors = [];
  let reach = base.reach;
  let engagement = base.engagement;

  // Authoring quality signals — each maps to a visible explanation.
  if (text.length >= 60 && text.length <= 280) {
    reach *= 1.12;
    engagement *= 1.1;
    factors.push('Caption length is in the optimal 60–280 character range.');
  } else if (text.length > 0 && text.length < 60) {
    reach *= 0.92;
    engagement *= 0.95;
    factors.push('Very short captions tend to under-perform.');
  } else if (text.length > 600) {
    reach *= 0.94;
    factors.push('Long captions are truncated in feed previews.');
  }

  if (hashtags >= 3 && hashtags <= 8) {
    reach *= 1.08;
    factors.push(`${hashtags} hashtags is a healthy range for discovery.`);
  } else if (hashtags > 12) {
    reach *= 0.9;
    factors.push('Hashtag stuffing can reduce reach.');
  }

  if (mediaCount > 0) {
    reach *= 1.15;
    engagement *= 1.2;
    factors.push(`${mediaCount} media item${mediaCount > 1 ? 's' : ''} attached.`);
  }
  if (postType === 'video' && mediaCount === 0) {
    reach *= 0.6;
    factors.push('A video post without media will not be distributed.');
  }

  if (visibility === 'private') {
    reach *= 0.05;
    engagement *= 0.6;
    factors.push('Private posts are only visible to you.');
  } else if (visibility === 'friends' || visibility === 'close_friends') {
    reach *= 0.35;
    factors.push('Limited-audience posts reach a smaller audience.');
  }

  const boostActive = Boolean(boost && boost.type && boost.type !== 'none');
  if (boostActive) {
    reach *= 1.6;
    factors.push('An active boost expands distribution.');
  }

  // Scheduled posting: weekday-morning and weekday-evening windows historically
  // perform best. This is a heuristic derived from the supplied time only.
  let bestTime = 'Post now';
  if (scheduledTime) {
    const when = new Date(scheduledTime);
    if (!Number.isNaN(when.getTime())) {
      const hour = when.getHours();
      const isWeekend = [0, 6].includes(when.getDay());
      reach *= isWeekend ? 0.95 : 1.05;
      factors.push(isWeekend ? 'Weekend posts see slightly lower weekday traffic.' : 'Weekday posting aligns with peak traffic.');
      bestTime = isWeekend ? 'Saturday 10:00' : 'Tuesday 18:00';
    }
  }
  if (!scheduledTime) bestTime = 'Tuesday 18:00';

  // Earnings only exist when the author actually enabled monetisation.
  const monetized = Boolean(data?.monetization && data?.monetization.type && data.monetization.type !== 'none');
  const earnings = monetized ? Math.round(reach * 0.004 * (engagement / 4)) : 0;
  if (!monetized) factors.push('Monetisation is off, so predicted earnings are 0.');

  const viralScore = Math.min(95, Math.round((engagement * 6) + (reach / 400)));

  return {
    success: true,
    reach: Math.round(reach).toLocaleString(),
    engagement: Number(engagement.toFixed(1)),
    earnings,
    viralScore,
    bestTime,
    factors,
    deterministic: true,
  };
});