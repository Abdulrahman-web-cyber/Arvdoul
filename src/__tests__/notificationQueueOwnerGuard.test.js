/**
 * Notification offline-queue owner guard.
 *
 * `src/services/notificationsService.js` keeps its own device-local queue
 * (`arvdoul_notifications_offline`) for `sendNotification` / `markAsRead` ops
 * issued while offline. Like the monetization queue before its fix, it stored
 * no owner and drained every pending op under whoever was signed in, so a
 * notification account A queued replayed (sent / marked read) as account B on
 * the same device. Nothing purged it on sign-out either.
 *
 * This guard pins the fix: the owner is stamped at enqueue, the drain is scoped
 * to the live session, and sign-out/switch purge the departing account's ops.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SERVICE = 'src/services/notificationsService.js';
const AUTH = 'src/context/AuthContext.jsx';

describe('the notifications offline queue is owner-scoped', () => {
  const svc = read(SERVICE);

  test('queued ops are stamped with the session owner', () => {
    expect(svc).toMatch(/store\.add\(\{\s*operation,\s*params,\s*ownerUid/);
    expect(svc).toContain('this.service?.authMethods?.getCurrentUser?.()?.uid');
  });

  test('the drain replays only the live session\u2019s ops', () => {
    const start = svc.indexOf('async processAll()');
    expect(start).toBeGreaterThan(-1);
    const body = svc.slice(start, start + 1200);
    expect(body).toContain('const sessionUid = this.service?.authMethods?.getCurrentUser?.()?.uid');
    expect(body).toMatch(/item\.ownerUid !== sessionUid/);
  });

  test('a module-level purge helper exists and is owner-scoped', () => {
    expect(svc).toContain('export async function purgeNotificationQueueForOwner');
    const start = svc.indexOf('export async function purgeNotificationQueueForOwner');
    const body = svc.slice(start, start + 900);
    expect(body).toMatch(/all\[i\]\.ownerUid === uid/);
  });

  test('sign-out and account switch purge the departing account\u2019s queue', () => {
    const auth = read(AUTH);
    const calls = auth.match(/purgeNotificationQueueForOwner\(/g) || [];
    // one on account switch, one on logout
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
