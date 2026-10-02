/**
 * Canonical profile read-model contract (AUDIT V3 A-3 / N018).
 *
 * These are the derivations that were previously copy-pasted into
 * ProfilePublicScreen / ProfilePreviewScreen / ProfileMyScreen and drifted.
 * The test pins the single implementation: placeholder rejection, avatar
 * fallback, count/level coercion, creator/verified flags, and the
 * capability-driven masking applied exactly once.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeString,
  isPlaceholderName,
  isPlaceholderHandle,
  deriveHandle,
  pickHandle,
  pickDisplayName,
  resolveAvatarUrl,
  resolveCount,
  resolveLevelValue,
  resolveCreatorFlag,
  resolveVerifiedFlag,
  projectProfileForViewer,
  OFFLINE_PRESENCE,
} from '../services/profileReadModel.js';

describe('profileReadModel - handle derivation', () => {
  it('rejects synthetic user_* ids and generic placeholders', () => {
    expect(isPlaceholderHandle('user_abc123')).toBe(true);
    expect(isPlaceholderHandle('creator')).toBe(true);
    expect(isPlaceholderHandle('USER')).toBe(true);
    expect(isPlaceholderHandle('')).toBe(true);
    expect(isPlaceholderHandle('elena')).toBe(false);
  });

  it('derives a clean handle from an email or name, never a placeholder', () => {
    expect(deriveHandle('Elena.Marchetti@example.com')).toBe('elenamarchetti');
    expect(deriveHandle('user_123')).toBeNull();
    expect(deriveHandle('user@example.com')).toBeNull();
    expect(deriveHandle('')).toBeNull();
  });

  it('picks the first real handle, skipping placeholders', () => {
    expect(pickHandle(['user_9', 'creator', 'elena'])).toBe('elena');
    expect(pickHandle(['user_9', undefined, null])).toBeNull();
  });
});

describe('profileReadModel - display name', () => {
  it('skips placeholder names but keeps a real one', () => {
    expect(pickDisplayName(['User', 'Creator', 'Elena'], { fallback: 'Creator' })).toBe('Elena');
    expect(pickDisplayName(['User', ''], { fallback: 'Creator' })).toBe('Creator');
  });

  it('can keep a literal placeholder when the owner set it', () => {
    expect(pickDisplayName(['User'], { fallback: 'Creator', rejectPlaceholder: false })).toBe('User');
  });

  it('supports a null fallback so absence is reported as absence', () => {
    expect(pickDisplayName([undefined, 'Creator'], { fallback: null })).toBeNull();
  });

  it('isPlaceholderName is case-insensitive and trims', () => {
    expect(isPlaceholderName('  creator ')).toBe(true);
    expect(isPlaceholderName('Elena')).toBe(false);
    expect(normalizeString('  x ')).toBe('x');
  });
});

describe('profileReadModel - numeric coercion', () => {
  it('resolveCount takes the first numeric candidate, treating 0 as real', () => {
    expect(resolveCount(undefined, 0, 12)).toBe(0);
    expect(resolveCount('12', undefined)).toBe(12);
    expect(resolveCount(null, '')).toBe(0);
  });

  it('resolveLevelValue keeps absent standing unknown, never a fake Level 1', () => {
    expect(resolveLevelValue(undefined, null, 0)).toBeNull();
    expect(resolveLevelValue(0, 7)).toBe(7);
    expect(resolveLevelValue('8')).toBe(8);
  });
});

describe('profileReadModel - standing flags', () => {
  it('creator flag honours an explicit profile/viewer flag then the level gate', () => {
    expect(resolveCreatorFlag({ isCreator: true }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({}, { isCreator: true }, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorStatus: 'approved' }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorTier: 'partner' }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorTier: 'standard' }, {}, null)).toBe(false);
  });

  it('verified flag reads either stored field', () => {
    expect(resolveVerifiedFlag({ isVerified: true })).toBe(true);
    expect(resolveVerifiedFlag({ verified: true })).toBe(true);
    expect(resolveVerifiedFlag({})).toBe(false);
  });

  it('avatar falls back to a deterministic SVG, never an empty string', () => {
    const url = resolveAvatarUrl('', 'Elena', 'u1');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    expect(resolveAvatarUrl('https://cdn/x.png', 'Elena', 'u1')).toBe('https://cdn/x.png');
  });
});

describe('profileReadModel - capability projection', () => {
  const profile = { id: 'u1', coins: 500, links: ['a'], presence: { isOnline: true, status: 'online', lastActive: 1 } };

  it('masks economic status, links and presence when the engine denies them', () => {
    const projected = projectProfileForViewer(profile, {
      canViewEconomicStatus: false,
      canViewLinks: false,
      canViewPresence: false,
    });
    expect(projected.coins).toBeNull();
    expect(projected.links).toEqual([]);
    expect(projected.presence).toEqual(OFFLINE_PRESENCE);
  });

  it('passes sections through when the engine allows them', () => {
    const projected = projectProfileForViewer(profile, {
      canViewEconomicStatus: true,
      canViewLinks: true,
      canViewPresence: true,
      canViewActivity: true,
      canViewFollowers: true,
    });
    expect(projected.coins).toBe(500);
    expect(projected.links).toEqual(['a']);
    expect(projected.presence).toEqual(profile.presence);
    expect(projected.canViewActivity).toBe(true);
    expect(projected.canViewFollowersList).toBe(true);
  });

  it('owner always sees economic status even in a simulated public view', () => {
    const projected = projectProfileForViewer(profile, { canViewEconomicStatus: false }, { isOwner: true });
    expect(projected.coins).toBe(500);
  });

  it('null profile projects to null', () => {
    expect(projectProfileForViewer(null, {})).toBeNull();
  });
});

describe('profile surfaces consume the canonical read model (N018)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const surfaces = [
    'src/screens/Profile/ProfilePublicScreen.jsx',
    'src/screens/Profile/ProfilePreviewScreen.jsx',
    'src/screens/Profile/ProfileMyScreen.jsx',
    'src/screens/Profile/AboutScreen.jsx',
    'src/services/passportService.js',
  ];

  it('every profile surface imports the canonical read model', () => {
    for (const file of surfaces) {
      expect(read(file)).toContain('profileReadModel');
    }
  });

  it('no surface re-derives privacy masking with its own capability ternary', () => {
    for (const file of surfaces) {
      const src = read(file);
      // The projection is applied once, by projectProfileForViewer — screens
      // must not inline their own `capabilities.canViewX ? ... : null` masking.
      expect(src).not.toMatch(/capabilities\.canViewEconomicStatus\s*\?/);
    }
  });

  it('no surface hardcodes the creator level gate', () => {
    for (const file of surfaces) {
      expect(read(file)).not.toContain('LEVEL_GATES.creatorProfile');
    }
  });

  it('no surface re-implements the user_/creator placeholder filter', () => {
    for (const file of surfaces) {
      expect(read(file)).not.toContain("startsWith('user_')");
    }
  });
});
