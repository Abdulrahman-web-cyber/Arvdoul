/**
 * Account deletion must clean every party-readable graph/safety edge the
 * account is part of — not just `follows`/`blocks`/`friend_requests`.
 *
 * `functions/user.js#deleteUserData` cleaned follows, blocks and friend
 * requests but never `mutes`, `restricts` or `follow_requests`, so a deleted
 * account left orphaned edges: everyone it had muted stayed muted, and a
 * pending follow request to the deleted account sat in the owner's
 * notifications forever.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const user = fs.readFileSync(path.join(root, 'functions/user.js'), 'utf8');

describe('deleteUserData cleans every graph edge', () => {
  test('removes mutes, restricts and follow_requests (both directions)', () => {
    const start = user.indexOf('exports.deleteUserData');
    const body = user.slice(start);
    expect(body).toContain("['mutes', 'muterId', 'mutedId']");
    expect(body).toContain("['restricts', 'restricterId', 'restrictedId']");
    expect(body).toContain("['follow_requests', 'fromUserId', 'toUserId']");
  });

  test('still removes the original follows/blocks/friend_requests edges', () => {
    const start = user.indexOf('exports.deleteUserData');
    const body = user.slice(start);
    expect(body).toContain("db.collection('follows')");
    expect(body).toContain("db.collection('blocks')");
    expect(body).toContain("db.collection('friend_requests')");
  });
});
