/**
 * Canonical Sparks Architecture & Shared Config Contract Tests.
 *
 * Verifies:
 *  - Shared `videoConfig.cjs` single-source limits, validation, monotonic state machine,
 *    visibility normalization, and canonical post ID resolution.
 *  - Server (`functions/video.js`), Firestore rules, Storage rules, and Client (`videoService`,
 *    `useHlsVideo`, `AppRoutes`) wiring contracts.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import videoConfig from '../shared/videoConfig.cjs';

const {
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  MAX_FILE_SIZE_BYTES,
  DAILY_UPLOAD_LIMITS,
  SPARK_PROCESSING_STATES,
  POST_PROTECTED_SPARK_FIELDS,
  getDailyUploadLimit,
  canTransitionProcessingState,
  normalizeSparkVisibility,
  validateSparkDuration,
  validateSparkFileSize,
  validateSparkMimeOrExtension,
  resolveCanonicalPostId,
} = videoConfig;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('shared videoConfig.cjs contracts', () => {
  test('enforces canonical duration, file size, and daily tier quotas', () => {
    expect(MIN_DURATION_SEC).toBe(1);
    expect(MAX_DURATION_SEC).toBe(600);
    expect(MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);

    expect(getDailyUploadLimit(null)).toBe(DAILY_UPLOAD_LIMITS.standard);
    expect(getDailyUploadLimit({ isCreator: true })).toBe(DAILY_UPLOAD_LIMITS.creator);
    expect(getDailyUploadLimit({ isVerified: true })).toBe(DAILY_UPLOAD_LIMITS.verified);
    expect(getDailyUploadLimit({ creatorTier: 'partner' })).toBe(DAILY_UPLOAD_LIMITS.partner);
    expect(getDailyUploadLimit({ role: 'admin' })).toBe(DAILY_UPLOAD_LIMITS.partner);
  });

  test('validates duration, file size, and MIME/extension inputs', () => {
    expect(validateSparkDuration(null).valid).toBe(true);
    expect(validateSparkDuration(30).valid).toBe(true);
    expect(validateSparkDuration(0).valid).toBe(false);
    expect(validateSparkDuration(0.5).valid).toBe(false);
    expect(validateSparkDuration(601).valid).toBe(false);

    expect(validateSparkFileSize(1024).valid).toBe(true);
    expect(validateSparkFileSize(0).valid).toBe(false);
    expect(validateSparkFileSize(MAX_FILE_SIZE_BYTES + 1).valid).toBe(false);

    expect(validateSparkMimeOrExtension('video/mp4', 'clip.mp4').valid).toBe(true);
    expect(validateSparkMimeOrExtension('video/quicktime; codecs="avc1"', 'clip.mov').valid).toBe(true);
    expect(validateSparkMimeOrExtension('', 'clip.webm').valid).toBe(true);
    expect(validateSparkMimeOrExtension('image/png', 'photo.png').valid).toBe(false);
  });

  test('enforces monotonic Spark processing state transitions', () => {
    const S = SPARK_PROCESSING_STATES;
    expect(canTransitionProcessingState(null, S.UPLOAD_RESERVED)).toBe(true);
    expect(canTransitionProcessingState(S.UPLOAD_RESERVED, S.PROCESSING)).toBe(true);
    expect(canTransitionProcessingState(S.PROCESSING, S.PUBLISHED)).toBe(true);
    // Out-of-order stale webhook cannot regress an already PUBLISHED Spark.
    expect(canTransitionProcessingState(S.PUBLISHED, S.PROCESSING)).toBe(false);
    expect(canTransitionProcessingState(S.PUBLISHED, S.UPLOAD_RESERVED)).toBe(false);
    expect(canTransitionProcessingState(S.PUBLISHED, S.PROCESSING_FAILED)).toBe(false);
    // Explicit moderation rejection can quarantine a published Spark.
    expect(canTransitionProcessingState(S.PUBLISHED, S.MODERATION_REJECTED)).toBe(true);
    // Retries from upload/processing failures are permitted.
    expect(canTransitionProcessingState(S.UPLOAD_FAILED, S.UPLOAD_RESERVED)).toBe(true);
    expect(canTransitionProcessingState(S.PROCESSING_FAILED, S.PROCESSING)).toBe(true);
    // Rejects unknown states.
    expect(canTransitionProcessingState(S.PROCESSING, 'UNKNOWN_STATE')).toBe(false);
  });

  test('normalizes visibility aliases and resolves canonical post IDs', () => {
    expect(normalizeSparkVisibility('public')).toBe('public');
    expect(normalizeSparkVisibility('connections')).toBe('friends');
    expect(normalizeSparkVisibility('only_me')).toBe('private');
    expect(normalizeSparkVisibility('invalid_scope')).toBe('public');

    expect(resolveCanonicalPostId({ id: 'legacy1', canonicalPostId: 'post99' })).toBe('post99');
    expect(resolveCanonicalPostId({ id: 'legacy1', postId: 'post88' })).toBe('post88');
    expect(resolveCanonicalPostId({ id: 'post77' })).toBe('post77');
    expect(resolveCanonicalPostId(null, 'fallback_id')).toBe('fallback_id');
  });
});

describe('Canonical Sparks cross-layer invariants', () => {
  test('firestore.rules protects server-owned Spark fields on posts updates', () => {
    const rules = read('firestore.rules');
    expect(POST_PROTECTED_SPARK_FIELDS).toEqual(expect.arrayContaining([
      'muxAssetId',
      'muxPlaybackId',
      'processingState',
      'playbackPolicy',
      'viralScore',
      'rankingScore',
    ]));
    for (const field of ['muxAssetId', 'muxPlaybackId', 'processingState', 'playbackPolicy']) {
      expect(rules).toContain(field);
    }
    expect(rules).toContain('match /video_migration_map/{legacyId}');
    expect(rules).toContain('match /migration_checkpoints/{jobId}');
  });

  test('functions/video.js uses shared videoConfig.cjs and canonical posts + Mux signed playback', () => {
    const fnSrc = read('functions/video.js');
    expect(fnSrc).toContain("require('./videoConfig.cjs')");
    expect(fnSrc).toContain('exports.createMuxUpload =');
    expect(fnSrc).toContain('exports.getMuxPlaybackUrl =');
    expect(fnSrc).toContain('exports.handleMuxWebhook =');
    expect(fnSrc).toContain('exports.deleteVideo =');
    expect(fnSrc).toContain('canTransitionProcessingState(');
    expect(fnSrc).toContain("collection('posts')");
  });

  test('useHlsVideo and AppRoutes wire Mux HLS playback and canonical /sparks routes', () => {
    const hookSrc = read('src/hooks/useHlsVideo.js');
    const routesSrc = read('src/routes/AppRoutes.jsx');
    const videoSvcSrc = read('src/services/videoService.js');

    expect(hookSrc).toContain('videoService.getMuxPlaybackUrl');
    expect(hookSrc).toContain('Hls.Events.MANIFEST_PARSED');
    expect(hookSrc).toContain('status === 401 || status === 403');

    expect(routesSrc).toContain('path="/sparks"');
    expect(routesSrc).toContain('path="/sparks/:videoId"');
    expect(routesSrc).toContain('path="/video/:videoId"');

    expect(videoSvcSrc).toContain("from '../shared/videoConfig.cjs'");
    expect(videoSvcSrc).toContain('getMuxPlaybackUrl');
    expect(videoSvcSrc).toContain('deleteVideo');
  });
});
