/**
 * Guard: scheduled background jobs must (a) bound every collection read, (b)
 * drain their whole backlog with a bounded page instead of a single capped read,
 * and (c) query the fields the writers actually stamp.
 *
 * N493 — `functions/index.js#cleanupRateLimits` filtered `rate_limits` on
 * `expiresAt` only, but the shared sharded limiter (`functions/rateLimit.js`)
 * stamps `expireAt` on its parent docs, so those were never cleaned and the
 * collection grew without bound. Several sibling jobs (`cleanupSoftDeletedVideos`,
 * `cleanupOldCalls`, `cleanupOldShareEvents`, `recoverStuckWithdrawals`) also did
 * one unbounded/single-page read with a single batch, which throws (>500 ops) or
 * silently leaves a backlog.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Slice the handler body of `exports.<name> = ...` by brace-matching the first
// `{` after its `=>` so we never bleed into the next export.
function exportBody(src, name) {
  const start = src.indexOf(`exports.${name} `);
  expect(start).toBeGreaterThan(-1);
  const braceStart = src.indexOf('{', src.indexOf('=>', start));
  expect(braceStart).toBeGreaterThan(-1);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(braceStart, i + 1);
}

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const DRAIN_JOBS = [
  ['functions/index.js', 'cleanupRateLimits'],
  ['functions/index.js', 'cleanupSoftDeletedVideos'],
  ['functions/messaging.js', 'cleanupOldCalls'],
  ['functions/video.js', 'cleanupOldShareEvents'],
  ['functions/monetization.js', 'recoverStuckWithdrawals'],
  ['functions/feed.js', 'cleanupAndRetryFanoutTasks'],
  ['functions/notifications.js', 'generateNotificationDigest'],
];

describe('scheduled job hygiene', () => {
  test('cleanup jobs bound every read with .limit() and drain with a loop or cursor', () => {
    for (const [file, name] of DRAIN_JOBS) {
      const body = stripComments(exportBody(read(file), name));
      expect({ file, name, limited: /\.limit\(/.test(body) }).toEqual({ file, name, limited: true });
      const drains = /for\s*\(\s*;\s*;\s*\)/.test(body) || /startAfter\(/.test(body) || /while\s*\(/.test(body);
      expect({ file, name, drains }).toEqual({ file, name, drains: true });
    }
  });

  test('cleanupRateLimits queries BOTH field names the writers stamp', () => {
    const body = stripComments(exportBody(read('functions/index.js'), 'cleanupRateLimits'));
    // functions/rateLimit.js stamps `expireAt`; messagesService._recordRateLimit
    // stamps `expiresAt`. Filtering on only one leaves the other unbounded.
    expect(body).toContain('expireAt');
    expect(body).toContain('expiresAt');

    expect(read('functions/rateLimit.js')).toMatch(/expireAt:/);
    expect(read('src/services/messagesService.js')).toMatch(/expiresAt,/);
  });

  test('no cleanup job issues an unbounded .where(...).get()', () => {
    for (const [file, name] of DRAIN_JOBS) {
      const body = stripComments(exportBody(read(file), name));
      // Any statement that opens a collection query (`.where(`) must also carry
      // a `.limit(` (a point read uses `.doc(...)` and no `.where`).
      for (const stmt of body.split(';')) {
        if (!/\.where\(/.test(stmt)) continue;
        expect({ file, name, stmt: stmt.trim().slice(-70), bounded: /\.limit\(/.test(stmt) })
          .toMatchObject({ bounded: true });
      }
    }
  });
});
