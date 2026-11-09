/**
 * Service offline-queue owner guard.
 *
 * Three device-local queues outside the canonical `src/utils/OfflineQueue.js`
 * drain account-owned ops: `notificationsService` (`sendNotification` /
 * `markAsRead`), `messagesService` (queued sends) and `monetizationService`
 * (queued purchase / ad reward). Each previously stored no owner and replayed
 * every pending op under whoever was signed in, so account A's op ran as
 * account B on the same device. Nothing purged them on sign-out either.
 *
 * This guard pins the fix for all three: the owner is stamped at enqueue, the
 * drain is scoped to the live session, a module-level purge helper exists, and
 * sign-out/account switch purge the departing account's ops.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const AUTH = 'src/context/AuthContext.jsx';

const QUEUES = [
  {
    label: 'notifications',
    service: 'src/services/notificationsService.js',
    ownerAtEnqueue: /store\.add\(\{\s*operation,\s*params,\s*ownerUid/,
    drainMarker: 'async processAll()',
    sessionExpr: 'const sessionUid = this.service?.authMethods?.getCurrentUser?.()?.uid',
    purgeExport: 'export async function purgeNotificationQueueForOwner',
    purgeOwnerMatch: /all\[i\]\.ownerUid === uid/,
    authPurge: /purgeNotificationQueueForOwner\(/g,
  },
  {
    label: 'messages',
    service: 'src/services/messagesService.js',
    ownerAtEnqueue: /const record = \{\s*\.\.\.message,\s*ownerUid/,
    drainMarker: 'async sync()',
    sessionExpr: 'const sessionUid = this.service?.auth?.currentUser?.uid',
    purgeExport: 'export async function purgeMessageQueueForOwner',
    purgeOwnerMatch: /values\[i\]\.ownerUid === uid/,
    authPurge: /purgeMessageQueueForOwner\(/g,
  },
  {
    label: 'monetization',
    service: 'src/services/monetizationService.js',
    ownerAtEnqueue: /db\.add\('queue',\s*\{[^}]*ownerUid/,
    drainMarker: 'async sync()',
    sessionExpr: 'const sessionUid = auth?.currentUser?.uid',
    purgeExport: 'export async function purgeMonetizationQueueForOwner',
    purgeOwnerMatch: /items\[i\]\.ownerUid === uid/,
    authPurge: /purgeMonetizationQueueForOwner\(/g,
  },
];

describe.each(QUEUES)('the $label offline queue is owner-scoped', (q) => {
  const svc = read(q.service);

  test('queued ops are stamped with the session owner', () => {
    expect(svc).toMatch(q.ownerAtEnqueue);
  });

  test('the drain replays only the live session\u2019s ops', () => {
    const start = svc.indexOf(q.drainMarker);
    expect(start).toBeGreaterThan(-1);
    const body = svc.slice(start, start + 1500);
    expect(body).toContain(q.sessionExpr);
    expect(body).toMatch(/\.ownerUid !== sessionUid/);
  });

  test('a module-level purge helper exists and is owner-scoped', () => {
    expect(svc).toContain(q.purgeExport);
    const start = svc.indexOf(q.purgeExport);
    const body = svc.slice(start, start + 1000);
    expect(body).toMatch(q.purgeOwnerMatch);
  });

  test('sign-out and account switch purge the departing account\u2019s queue', () => {
    const auth = read(AUTH);
    const calls = auth.match(q.authPurge) || [];
    // one on account switch, one on logout
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
