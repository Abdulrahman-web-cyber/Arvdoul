/**
 * shared/videoConfig.cjs — SINGLE SOURCE OF TRUTH for Arvdoul Sparks (Video) Architecture.
 *
 * Consumed by BOTH:
 *   - the client (src/services/videoService.js, CreateVideo, ExportModal, videoUtils)
 *   - Cloud Functions (functions/video.js, functions/videoMigration.js, functions/monetization.js)
 *
 * Written as dependency-free CommonJS so the exact same bytes execute in the
 * Vite browser bundle and in Node 22 Cloud Functions.
 */

const MIN_DURATION_SEC = 1;
const MAX_DURATION_SEC = 600; // 10 minutes
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_SPONSORED_VIDEOS_PER_DAY = 3;

const ALLOWED_VIDEO_MIME_TYPES = Object.freeze([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

const ALLOWED_VIDEO_EXTENSIONS = Object.freeze([
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
]);

/**
 * Daily Spark / Video upload quotas by creator standing.
 * Enforced both in client preflight UX and server-side in createMuxUpload.
 */
const DAILY_UPLOAD_LIMITS = Object.freeze({
  standard: 15,
  creator: 30,
  advanced: 50,
  professional: 75,
  elite: 100,
  partner: 150,
  verified: 100,
});

function getDailyUploadLimit(profile) {
  if (!profile) return DAILY_UPLOAD_LIMITS.standard;
  if (profile.role === 'admin' || profile.isAdmin) return DAILY_UPLOAD_LIMITS.partner;
  const rawTier = String(profile.creatorTier || '').toLowerCase();
  if (rawTier && DAILY_UPLOAD_LIMITS[rawTier]) {
    return DAILY_UPLOAD_LIMITS[rawTier];
  }
  if (profile.isVerified || profile.verified) return DAILY_UPLOAD_LIMITS.verified;
  if (profile.isCreator || profile.creatorStatus === 'approved') {
    return DAILY_UPLOAD_LIMITS.creator;
  }
  return DAILY_UPLOAD_LIMITS.standard;
}

/**
 * Canonical monotonic processing states for Sparks.
 * Lives on canonical `posts/{postId}.processingState` and media asset doc.
 */
const SPARK_PROCESSING_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  UPLOAD_RESERVED: 'UPLOAD_RESERVED',
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  MODERATION: 'MODERATION',
  READY_TO_PUBLISH: 'READY_TO_PUBLISH',
  PUBLISHED: 'PUBLISHED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  MODERATION_REJECTED: 'MODERATION_REJECTED',
});

const PROCESSING_STATE_RANK = Object.freeze({
  [SPARK_PROCESSING_STATES.DRAFT]: 0,
  [SPARK_PROCESSING_STATES.UPLOAD_RESERVED]: 1,
  [SPARK_PROCESSING_STATES.UPLOADING]: 2,
  [SPARK_PROCESSING_STATES.PROCESSING]: 3,
  [SPARK_PROCESSING_STATES.MODERATION]: 4,
  [SPARK_PROCESSING_STATES.READY_TO_PUBLISH]: 5,
  [SPARK_PROCESSING_STATES.PUBLISHED]: 6,
  // Failure states sit alongside processing/moderation and cannot regress an already PUBLISHED spark
  // unless an explicit moderation rejection occurs.
  [SPARK_PROCESSING_STATES.UPLOAD_FAILED]: 3,
  [SPARK_PROCESSING_STATES.PROCESSING_FAILED]: 4,
  [SPARK_PROCESSING_STATES.MODERATION_REJECTED]: 99,
});

/**
 * Verify whether a state transition is monotonically valid.
 * Allows idempotent re-application of the same state or advancing to a higher rank.
 * Allows retrying from UPLOAD_FAILED / PROCESSING_FAILED back to UPLOAD_RESERVED / PROCESSING.
 */
function canTransitionProcessingState(currentState, nextState) {
  if (!nextState || !(nextState in PROCESSING_STATE_RANK)) return false;
  if (!currentState || !(currentState in PROCESSING_STATE_RANK)) return true;
  if (currentState === nextState) return true;

  // Explicit moderation rejection can always quarantine even a published spark.
  if (nextState === SPARK_PROCESSING_STATES.MODERATION_REJECTED) return true;

  // Once published, out-of-order upload/processing webhooks cannot regress to draft/uploading/processing.
  if (currentState === SPARK_PROCESSING_STATES.PUBLISHED) return false;

  // Allow explicit retry transitions from non-policy failures.
  if (
    (currentState === SPARK_PROCESSING_STATES.UPLOAD_FAILED ||
      currentState === SPARK_PROCESSING_STATES.PROCESSING_FAILED) &&
    (nextState === SPARK_PROCESSING_STATES.UPLOAD_RESERVED ||
      nextState === SPARK_PROCESSING_STATES.UPLOADING ||
      nextState === SPARK_PROCESSING_STATES.PROCESSING)
  ) {
    return true;
  }

  return PROCESSING_STATE_RANK[nextState] >= PROCESSING_STATE_RANK[currentState];
}

const SPARK_VISIBILITIES = Object.freeze([
  'public',
  'followers',
  'friends',
  'private',
  'unlisted',
  'community',
]);

function normalizeSparkVisibility(visibility) {
  const v = typeof visibility === 'string' ? visibility.trim().toLowerCase() : '';
  if (v === 'connections') return 'friends';
  if (v === 'only_me' || v === 'onlyme') return 'private';
  return SPARK_VISIBILITIES.includes(v) ? v : 'public';
}

function validateSparkDuration(durationSeconds) {
  if (durationSeconds === null || durationSeconds === undefined) {
    return { valid: true, reason: null };
  }
  const dur = Number(durationSeconds);
  if (!Number.isFinite(dur) || dur <= 0) {
    return { valid: false, reason: 'Invalid video duration.' };
  }
  if (dur < MIN_DURATION_SEC) {
    return {
      valid: false,
      reason: `Video too short. Minimum duration is ${MIN_DURATION_SEC} second.`,
    };
  }
  if (dur > MAX_DURATION_SEC) {
    return {
      valid: false,
      reason: `Video too long. Maximum duration is ${Math.round(MAX_DURATION_SEC / 60)} minutes (${MAX_DURATION_SEC}s).`,
    };
  }
  return { valid: true, reason: null };
}

function validateSparkFileSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, reason: 'File is empty or size is invalid.' };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return {
      valid: false,
      reason: `File too large. Maximum size is ${maxMb} MB.`,
    };
  }
  return { valid: true, reason: null };
}

function validateSparkMimeOrExtension(mimeType, fileName = '') {
  const mime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase().split(';')[0] : '';
  const ext = typeof fileName === 'string' && fileName.includes('.')
    ? fileName.split('.').pop().trim().toLowerCase()
    : '';
  const okMime = mime ? ALLOWED_VIDEO_MIME_TYPES.includes(mime) || mime.startsWith('video/') : false;
  const okExt = ext ? ALLOWED_VIDEO_EXTENSIONS.includes(ext) : false;
  if (!okMime && !okExt) {
    return {
      valid: false,
      reason: `Unsupported video format. Allowed: ${ALLOWED_VIDEO_EXTENSIONS.join(', ').toUpperCase()}.`,
    };
  }
  return { valid: true, reason: null };
}

function resolveCanonicalPostId(record, fallbackId = null) {
  if (!record || typeof record !== 'object') return fallbackId || null;
  return record.canonicalPostId || record.postId || record.id || fallbackId || null;
}

/**
 * Server-owned Spark/Video fields on canonical `posts/{postId}`.
 * Clients cannot write or overwrite these via Firestore update rules.
 */
const POST_PROTECTED_SPARK_FIELDS = Object.freeze([
  'muxAssetId',
  'muxPlaybackId',
  'muxUploadId',
  'mediaAssetId',
  'processingState',
  'playbackPolicy',
  'audioFingerprint',
  'audioFingerprintStatus',
  'viralScore',
  'rankingScore',
  'videoStats',
]);

module.exports = {
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  MAX_FILE_SIZE_BYTES,
  MAX_SPONSORED_VIDEOS_PER_DAY,
  ALLOWED_VIDEO_MIME_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  DAILY_UPLOAD_LIMITS,
  SPARK_PROCESSING_STATES,
  PROCESSING_STATE_RANK,
  SPARK_VISIBILITIES,
  POST_PROTECTED_SPARK_FIELDS,
  getDailyUploadLimit,
  canTransitionProcessingState,
  normalizeSparkVisibility,
  validateSparkDuration,
  validateSparkFileSize,
  validateSparkMimeOrExtension,
  resolveCanonicalPostId,
};
