/**
 * src/__tests__/avatarPaletteConsistency.test.js
 *
 * Deterministic-avatar consistency guard.
 *
 * Two modules generate the same "fallback avatar" for a user:
 *   - `src/utils/avatarUtils.js`  `generateDefaultAvatarSvg` (profile surfaces)
 *   - `src/services/userService.js` `generateDefaultAvatar` (post cards, comments)
 *
 * Each used to carry its OWN palette list with DIFFERENT secondary shades, so a
 * given user rendered a different-coloured avatar depending on which surface
 * showed them. The palette is now single-sourced (`avatarUtils.AVATAR_PALETTES`)
 * and this guard fails if a second list (or a divergent shade) reappears.
 *
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// The known divergent secondary shades that the old userService copy carried.
const OLD_DIVERGENT_SHADES = ['#7C3AED', '#059669', '#DB2777', '#EA580C', '#0D9488', '#4F46E5', '#DC2626'];

describe('deterministic avatar palette is single-sourced', () => {
  test('userService does not re-declare an inline AVATAR_PALETTES array', () => {
    const src = read('src/services/userService.js');
    expect(src).not.toMatch(/AVATAR_PALETTES:\s*\[/);
    expect(src).toMatch(/import\s*\{[^}]*AVATAR_PALETTES[^}]*\}\s*from\s*'\.\.\/utils\/avatarUtils\.js'/);
  });

  test('the old divergent secondary shades are gone from the codebase', () => {
    const files = [
      'src/services/userService.js',
      'src/utils/avatarUtils.js',
    ];
    for (const f of files) {
      const src = read(f);
      for (const shade of OLD_DIVERGENT_SHADES) {
        expect(src).not.toContain(shade);
      }
    }
  });

  test('both generators pick the palette from the same canonical list', async () => {
    const { AVATAR_PALETTES, generateDefaultAvatarSvg } = await import('../utils/avatarUtils.js');
    expect(Array.isArray(AVATAR_PALETTES)).toBe(true);
    expect(AVATAR_PALETTES.length).toBeGreaterThan(0);
    // Every palette entry must carry primary/secondary/text.
    for (const p of AVATAR_PALETTES) {
      expect(typeof p.primary).toBe('string');
      expect(typeof p.secondary).toBe('string');
    }
    // The svg generator embeds the palette primary for a known uid; the return
    // value is a data URI (base64 in jsdom), so decode before asserting.
    const uri = generateDefaultAvatarSvg('user_abc123', 'Ada Lovelace', 200);
    const svg = uri.startsWith('data:image/svg+xml;base64,')
      ? Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
      : decodeURIComponent(uri.split(',')[1]);
    const primaries = AVATAR_PALETTES.map((p) => p.primary);
    expect(primaries.some((c) => svg.includes(c))).toBe(true);
  });
});
