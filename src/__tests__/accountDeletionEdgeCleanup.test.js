/**
 * Account deletion must clean every party-readable graph/safety edge the
 * account is part of — not just `follows`/`blocks`/`friend_requests`.
 *
 * `functions/user.js#deleteUserData` cleaned follows, blocks and friend
 * requests but never `mutes`, `restricts` or `follow_requests`, so a deleted
 * account left orphaned edges: everyone it had muted stayed muted, and a
 * pending follow request to the deleted account sat in the owner's
 * notifications forever (N523).
 *
 * It also offloaded remaining work to a `DELETION_WORKER_URL` that had no
 * worker: when the env var was unset the enqueue returned silently and the
 * callable still reported `partial_with_offload` (N524). The worker now exists
 * (`functions/userDeleteWorker.js`, merged by index.js) and the enqueue records
 * the remainder durably or fails the status.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const user = fs.readFileSync(path.join(root, 'functions/user.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'functions/userDeleteWorker.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

describe('deleteUserData cleans every graph edge', () => {
  test('covers follows, blocks, friend_requests, mutes, restricts, follow_requests', () => {
    const start = user.indexOf('const TWO_WAY_EDGE_COLLECTIONS');
    const body = user.slice(start, user.indexOf('];', start));
    expect(body).toContain("['follows', 'followerId', 'followingId']");
    expect(body).toContain("['blocks', 'blockerId', 'blockedId']");
    expect(body).toContain("['friend_requests', 'fromUserId', 'toUserId']");
    expect(body).toContain("['mutes', 'muterId', 'mutedId']");
    expect(body).toContain("['restricts', 'restricterId', 'restrictedId']");
    expect(body).toContain("['follow_requests', 'fromUserId', 'toUserId']");
  });

  test('the cascade iterates the edge table in both directions', () => {
    expect(user).toContain('deleteTwoWayEdges(collName, actorField, otherField, userId)');
    expect(user).toContain("where(actorField, '==', userId)");
    expect(user).toContain("where(otherField, '==', userId)");
  });
});

describe('the deletion offload has a real worker (N524)', () => {
  test('a processDeletionTask onRequest worker exists and verifies OIDC', () => {
    expect(worker).toContain('exports.processDeletionTask');
    expect(worker).toMatch(/OAuth2Client/);
    expect(worker).toMatch(/assertOidcTask\s*\(/);
    expect(worker).not.toMatch(/admin\.auth\(\)\.verifyIdToken/);
  });

  test('the worker resumes the cascade in-process (no fetch back to a callable)', () => {
    expect(worker).toContain('runUserDataDeletion');
    expect(worker).not.toMatch(/cloudfunctions\.net\/deleteUserData/);
    expect(user).toContain('exports.runUserDataDeletion = runUserDataDeletion');
  });

  test('index.js merges the worker module', () => {
    expect(index).toContain("merge(require('./userDeleteWorker.js'))");
  });

  test('a scheduled drainer executes recorded deletion_tasks rows', () => {
    expect(worker).toContain('exports.drainPendingDeletionTasks');
    expect(worker).toContain("where('status', '==', 'pending')");
  });

  test('enqueue records the remainder or fails the status (no silent drop)', () => {
    expect(user).toContain("'partial_offload_failed'");
    expect(user).not.toMatch(/if \(!deletionWorkerUrl\) return;/);
  });
});
