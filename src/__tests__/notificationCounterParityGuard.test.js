/**
 * src/__tests__/notificationCounterParityGuard.test.js
 *
 * N489 — server-side in-app notifications were written with a bare
 * `set()` that never touched the sharded unread counter, so the Alerts badge
 * silently under-counted:
 *
 *   * `notifications.js#processBulkNotifications` (announcement fan-out) and
 *     `#generateNotificationDigest` wrote `read: false` records directly, so a
 *     user could have a full inbox of unread notifications while the badge
 *     showed nothing from them.
 *   * `scheduledPosts.js#notifyAuthorPublished` bumped the counter AFTER the
 *     idempotent `create()` — but the `create()` is a no-op on a re-run, so a
 *     retried publish added an unread that had no notification row.
 *
 * The canonical writer is `functions/notificationWriter.js#writeNotification`
 * (record + counter, in step). This guard fails if a module writes an in-app
 * notification document without going through it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('in-app notification writes keep the unread counter in step (N489)', () => {
  test('notifications.js routes every in-app notification through writeNotification', () => {
    const src = read('functions/notifications.js');
    expect(src).toMatch(/require\('\.\/notificationWriter'\)/);
    // sendNotification, processBulkNotifications, generateNotificationDigest.
    const calls = src.match(/writeNotification\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    // No direct writer left on the notifications subcollection.
    expect(src).not.toMatch(/collection\('notifications'\)\.doc\([^)]*\)\.set\(/);
  });

  test('scheduledPosts.js only bumps the unread counter after a genuine create', () => {
    const src = read('functions/scheduledPosts.js');
    const fn = src.slice(
      src.indexOf('async function notifyAuthorPublished'),
      src.indexOf('push_queue')
    );
    const createIdx = fn.indexOf('.create(');
    const incrementIdx = fn.indexOf('notification_counters');
    const catchIdx = fn.indexOf('return;');
    expect(createIdx).toBeGreaterThan(-1);
    expect(incrementIdx).toBeGreaterThan(-1);
    // The counter bump must come after the create AND after the early-return
    // that swallows ALREADY_EXISTS, so a duplicate run cannot bump it.
    expect(incrementIdx).toBeGreaterThan(createIdx);
    expect(incrementIdx).toBeGreaterThan(catchIdx);
  });

  test('the canonical writer bumps the unread shard exactly once per record', () => {
    const src = read('functions/notificationWriter.js');
    expect(src).toMatch(/notification_counters/);
    expect(src).toMatch(/FieldValue\.increment\(1\)/);
    expect((src.match(/FieldValue\.increment\(1\)/g) || []).length).toBe(1);
  });
});
