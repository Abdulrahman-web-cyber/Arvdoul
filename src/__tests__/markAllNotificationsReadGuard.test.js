/**
 * `markAllNotificationsRead` must not fabricate an empty inbox (N485).
 *
 * The callable marked a single 500-document page of unread notifications and
 * then unconditionally set every `notification_counters` shard to `0`. A user
 * with more than 500 unread notifications therefore had the remainder left
 * unread — the Alerts list still rendered them — while the badge (and
 * `getNotificationStats`) reported `0` unread: a fabricated "all read".
 *
 * The fix marks unread notifications in bounded pages until none remain, then
 * writes the REAL remaining unread total (a server-side `count()`), so a
 * backlog beyond the batch ceiling is left honestly counted.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const src = read('functions/notifications.js');

function markAllBlock() {
  const start = src.indexOf('exports.markAllNotificationsRead');
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('exports.', start + 10));
}

describe('markAllNotificationsRead marks every unread, never fabricates empty (N485)', () => {
  test('it loops bounded pages instead of a single 500-doc batch', () => {
    const body = markAllBlock();
    // A loop that re-queries unread until the page is empty.
    expect(body).toMatch(/for\s*\(/);
    expect(body).toMatch(/where\('read',\s*'==',\s*false\)/);
    expect(body).toMatch(/\.limit\(PAGE\)/);
    expect(body).toMatch(/if\s*\(snapshot\.empty\)\s*break;/);
  });

  test('it writes the real remaining unread total, not an unconditional 0', () => {
    const body = markAllBlock();
    // A server-side count of what is still unread.
    expect(body).toMatch(/where\('read',\s*'==',\s*false\)\.count\(\)\.get\(\)/);
    // The shard write uses the computed `remaining`, never a bare 0 literal.
    expect(body).toMatch(/count:\s*i\s*===\s*0\s*\?\s*remaining\s*:\s*0/);
    expect(body).not.toMatch(/count:\s*0\s*\}/);
  });

  test('it reports the remaining count so the caller can tell the truth', () => {
    const body = markAllBlock();
    expect(body).toMatch(/markedCount:\s*marked,\s*remaining/);
  });
});
