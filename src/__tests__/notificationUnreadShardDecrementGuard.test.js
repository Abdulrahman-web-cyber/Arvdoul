/**
 * The sharded unread-notification counter must not lose decrements (N486).
 *
 * `notification_counters` is a SUM of 10 shards (`{uid}_shard_{n}`); the client
 * adds every shard on read. `markNotificationRead` and `deleteNotification`
 * decremented a RANDOM shard with `Math.max(0, current - 1)`: when the chosen
 * shard was already 0 the write was clamped to nothing, so the decrement was
 * lost and the Alerts badge over-counted unread notifications permanently.
 *
 * The fix picks a shard that actually holds a count (scanning the shards in one
 * transaction) so the total genuinely drops by one.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/notifications.js'), 'utf8');

function fnBlock(name) {
  const start = src.indexOf(`async function ${name}`);
  expect(start).toBeGreaterThan(-1);
  // function bodies here are small; slice to the next top-level `async function`
  const next = src.indexOf('\nasync function ', start + 10);
  const nextExport = src.indexOf('\n// ---', start + 10);
  const end = [next, nextExport].filter((n) => n > -1).sort((a, b) => a - b)[0] ?? src.length;
  return src.slice(start, end);
}

describe('notification unread shards lose no decrements (N486)', () => {
  test('a decrement helper scans the shards and targets a non-empty one', () => {
    const body = fnBlock('decrementUnreadShard');
    expect(body).toMatch(/t\.getAll\(\.\.\.refs\)/);
    // Finds the first shard whose count is > 0 rather than a random shard.
    expect(body).toMatch(/c\s*>\s*0/);
    expect(body).not.toMatch(/Math\.random\(\)/);
  });

  test('the helper never no-ops on a positive total (clamp drift is corrected)', () => {
    const body = fnBlock('decrementUnreadShard');
    // Only an already-zero total is a no-op; otherwise a shard is written.
    expect(body).toMatch(/if\s*\(total\s*<=\s*0\)\s*return/);
    expect(body).toMatch(/t\.set\(refs\[idx\]/);
  });

  test('markNotificationRead and deleteNotification use the helper, not a random shard', () => {
    const read = src.slice(src.indexOf('exports.markNotificationRead'), src.indexOf('exports.markAllNotificationsRead'));
    const del = src.slice(src.indexOf('exports.deleteNotification'), src.indexOf('exports.getUserNotifications'));
    expect(read).toMatch(/await decrementUnreadShard\(userId\)/);
    expect(del).toMatch(/await decrementUnreadShard\(userId\)/);
    // The old lost-decrement pattern is gone from both.
    expect(read).not.toMatch(/Math\.random\(\)\s*\*\s*shardCount/);
    expect(del).not.toMatch(/Math\.random\(\)\s*\*\s*shardCount/);
  });
});
