/**
 * src/__tests__/vibesContractsAndValidation.test.js
 *
 * Verifies Arvdoul Vibes Part 1 shared contracts: media validation, text validation,
 * 6-tier audience validation, overlay/drawing clamping, duration calculations,
 * 24-hour expiry math, navigation transitions, and idempotency keys.
 */

import {
  VIBE_AUDIENCES,
  VIBE_AUDIENCE_OPTIONS,
  VIBE_LIMITS,
  validateVibeMedia,
  validateVibeText,
  validateAudienceSelection,
  clampOverlayPosition,
  sanitizeTextOverlays,
  sanitizeDrawingPaths,
  calculateVibeDuration,
  resolveVibeExpiryMs,
  isVibeExpired,
  createVibeIdempotencyKey,
  computeVibeNavigationTarget,
} from '../config/vibeContracts.js';

describe('Vibes Part 1 contracts & validation', () => {
  test('exposes all 6 required Part 1 audience tiers', () => {
    const ids = VIBE_AUDIENCE_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([
      VIBE_AUDIENCES.PUBLIC,
      VIBE_AUDIENCES.FOLLOWERS,
      VIBE_AUDIENCES.CONNECTIONS,
      VIBE_AUDIENCES.CLOSE_CIRCLE,
      VIBE_AUDIENCES.SELECTED,
      VIBE_AUDIENCES.PRIVATE,
    ]);
  });

  test('validateVibeMedia enforces image/video types and byte limits', () => {
    expect(validateVibeMedia(null).valid).toBe(false);
    expect(validateVibeMedia({ type: 'application/pdf', size: 1024 }).valid).toBe(false);
    expect(validateVibeMedia({ type: 'image/gif', size: 1024 }).valid).toBe(false);
    expect(validateVibeMedia({ type: 'image/jpeg', size: 500_000 })).toEqual({
      valid: true,
      kind: 'image',
      error: null,
    });
    expect(
      validateVibeMedia({ type: 'image/png', size: VIBE_LIMITS.IMAGE_MAX_BYTES + 1 }).valid
    ).toBe(false);
    expect(validateVibeMedia({ type: 'video/mp4', size: 5_000_000, durationSec: 12 })).toEqual({
      valid: true,
      kind: 'video',
      error: null,
    });
    expect(
      validateVibeMedia({ type: 'video/mp4', size: VIBE_LIMITS.VIDEO_MAX_BYTES + 1 }).valid
    ).toBe(false);
    expect(
      validateVibeMedia({ type: 'video/mp4', size: 2048 }, { durationSec: 0 }).valid
    ).toBe(false);
  });

  test('validateVibeText enforces non-empty and max character bounds', () => {
    expect(validateVibeText('   ').valid).toBe(false);
    expect(validateVibeText('Hello Arvdoul').trimmed).toBe('Hello Arvdoul');
    const tooLong = 'a'.repeat(VIBE_LIMITS.TEXT_MAX_LENGTH + 5);
    const res = validateVibeText(tooLong);
    expect(res.valid).toBe(false);
    expect(res.trimmed).toHaveLength(VIBE_LIMITS.TEXT_MAX_LENGTH);
  });

  test('validateAudienceSelection requires >= 1 recipient for Selected Users', () => {
    expect(validateAudienceSelection('invalid_tier').valid).toBe(false);
    expect(validateAudienceSelection(VIBE_AUDIENCES.SELECTED, []).valid).toBe(false);

    const selected = validateAudienceSelection(VIBE_AUDIENCES.SELECTED, ['u2', 'u2', 'u3', '']);
    expect(selected.valid).toBe(true);
    expect(selected.selectedUserIds).toEqual(['u2', 'u3']);

    const pub = validateAudienceSelection(VIBE_AUDIENCES.PUBLIC, ['u2']);
    expect(pub.valid).toBe(true);
    expect(pub.selectedUserIds).toEqual([]);
  });

  test('clampOverlayPosition and sanitizers bound coordinates, lengths, and strokes', () => {
    const pos = clampOverlayPosition(-0.4, 2.5);
    expect(pos.x).toBe(VIBE_LIMITS.SAFE_MIN);
    expect(pos.y).toBe(VIBE_LIMITS.SAFE_MAX);

    const overlays = sanitizeTextOverlays([
      { text: '   ' },
      { text: 'Check this out', x: 5, y: -1, bgStyle: 'solid', scale: 99 },
    ]);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].x).toBe(VIBE_LIMITS.SAFE_MAX);
    expect(overlays[0].y).toBe(VIBE_LIMITS.SAFE_MIN);
    expect(overlays[0].scale).toBe(2.2);

    const paths = sanitizeDrawingPaths([
      { points: [] },
      { mode: 'eraser', size: 200, points: [{ x: -1, y: 2 }, { x: 0.5, y: 0.5 }] },
    ]);
    expect(paths).toHaveLength(1);
    expect(paths[0].mode).toBe('eraser');
    expect(paths[0].size).toBe(28);
    expect(paths[0].points[0]).toEqual({ x: 0, y: 1 });
  });

  test('calculateVibeDuration uses trim window for video and readable span for text', () => {
    expect(calculateVibeDuration({ type: 'image' })).toBe(VIBE_LIMITS.IMAGE_DEFAULT_DURATION_SEC);
    expect(
      calculateVibeDuration({
        type: 'video',
        media: { duration: 90 },
        mediaEdits: { trimStart: 10, trimEnd: 28 },
      })
    ).toBe(18);
    expect(
      calculateVibeDuration({
        type: 'video',
        media: { duration: 120 },
      })
    ).toBe(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC);

    const shortTextDur = calculateVibeDuration({ type: 'text', content: 'Hi' });
    const longTextDur = calculateVibeDuration({
      type: 'text',
      content: 'word '.repeat(45),
    });
    expect(shortTextDur).toBeGreaterThanOrEqual(VIBE_LIMITS.TEXT_MIN_DURATION_SEC);
    expect(longTextDur).toBeLessThanOrEqual(VIBE_LIMITS.TEXT_MAX_DURATION_SEC);
    expect(longTextDur).toBeGreaterThan(shortTextDur);
  });

  test('expiry helpers detect expired, deleted, and timestamp shapes accurately', () => {
    const now = 1_700_000_000_000;
    expect(isVibeExpired(null, now)).toBe(true);
    expect(isVibeExpired({ status: 'expired' }, now)).toBe(true);
    expect(isVibeExpired({ isDeleted: true }, now)).toBe(true);
    expect(isVibeExpired({ expiresAt: new Date(now - 1000) }, now)).toBe(true);
    expect(isVibeExpired({ expiresAt: { toDate: () => new Date(now + 60_000) } }, now)).toBe(false);
    expect(resolveVibeExpiryMs({ expiresAt: { seconds: 1700000100 } })).toBe(1_700_000_100_000);
  });

  test('computeVibeNavigationTarget advances slides, creators, and closes cleanly', () => {
    const groups = [
      { userId: 'u1', stories: [{ id: 's1' }, { id: 's2' }] },
      { userId: 'u2', stories: [{ id: 's3' }] },
    ];
    expect(computeVibeNavigationTarget(groups, 0, 0, 'next')).toEqual({
      action: 'slide',
      creatorIndex: 0,
      itemIndex: 1,
    });
    expect(computeVibeNavigationTarget(groups, 0, 1, 'next')).toEqual({
      action: 'creator',
      creatorIndex: 1,
      itemIndex: 0,
    });
    expect(computeVibeNavigationTarget(groups, 1, 0, 'next')).toEqual({
      action: 'close',
      creatorIndex: 1,
      itemIndex: 0,
    });
    expect(computeVibeNavigationTarget(groups, 1, 0, 'prev')).toEqual({
      action: 'creator',
      creatorIndex: 0,
      itemIndex: 1,
    });
  });

  test('createVibeIdempotencyKey yields distinct scoped keys', () => {
    const k1 = createVibeIdempotencyKey('creator123');
    const k2 = createVibeIdempotencyKey('creator123');
    expect(k1).toMatch(/^vibe_creator123_/);
    expect(k1).not.toBe(k2);
  });
});
