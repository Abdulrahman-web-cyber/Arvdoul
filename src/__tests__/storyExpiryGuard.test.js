/**
 * Story/Vibe expiry — enforced in the data-access path (#9).
 *
 * Expiry is authoritative in `firestore.rules` (`vibeIsActive` requires
 * `expiresAt > request.time`), but a *list* read the rules admit regardless of
 * expiry — the owner's own grid — must not hand expired content back to the UI
 * as if it were an active, pickable story. `_isStoryExpired` is the single
 * client-side mirror of that rule, used by both `getUserStories` and
 * `_canViewStory`.
 *
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStoryService } from '../services/storyService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const ts = (ms) => ({ toDate: () => new Date(ms) });

describe('story expiry is a single, tested helper', () => {
  const svc = getStoryService();

  test('a story past its expiry is expired', () => {
    const now = Date.now();
    expect(svc._isStoryExpired({ expiresAt: ts(now - 1) }, now)).toBe(true);
    expect(svc._isStoryExpired({ expiresAt: new Date(now - 1).toISOString() }, now)).toBe(true);
  });

  test('a story within its window is not expired', () => {
    const now = Date.now();
    expect(svc._isStoryExpired({ expiresAt: ts(now + 60_000) }, now)).toBe(false);
    expect(svc._isStoryExpired({ expiresAt: new Date(now + 60_000).toISOString() }, now)).toBe(false);
  });

  test('an absent or unparseable expiry is not treated as expired (rules stay authoritative)', () => {
    expect(svc._isStoryExpired({}, Date.now())).toBe(false);
    expect(svc._isStoryExpired({ expiresAt: null }, Date.now())).toBe(false);
    expect(svc._isStoryExpired({ expiresAt: 'not-a-date' }, Date.now())).toBe(false);
    expect(svc._isStoryExpired(null, Date.now())).toBe(false);
  });

  test('_canViewStory and getUserStories both delegate to the helper', () => {
    const src = read('src/services/storyService.js');
    // _canViewStory must not re-implement the inline toDate()/Date comparison.
    const canViewStart = src.indexOf('async _canViewStory');
    const canView = src.slice(canViewStart, canViewStart + 2000);
    expect(canView).toContain('this._isStoryExpired(story)');
    expect(canView).not.toMatch(/expiresAt\?\.toDate/);
    // getUserStories filters expired docs out of its list result.
    const list = src.slice(src.indexOf('async getUserStories'), src.indexOf('async getHighlightStories'));
    expect(list).toContain('this._isStoryExpired(s)');
  });
});
