/**
 * Server-side feed block filter (both directions).
 *
 * The `functions/feed.js` builders read only the outgoing block direction
 * (`blocks.where('blockerId','==',userId)`), so a user who blocked the viewer
 * still had their posts served into the viewer's feed by the server engine —
 * the same one-directional bug the client feed had (N223/N226). A block is a
 * mutual denial; every feed path must hide both the viewer's blocks and the
 * users who blocked the viewer. `resolveHiddenAuthorIds` is the single server
 * helper and must read both directions.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const feed = fs.readFileSync(path.join(root, 'functions/feed.js'), 'utf8');

describe('functions/feed.js block filter', () => {
  test('resolveHiddenAuthorIds reads both block directions', () => {
    const helper = feed.slice(feed.indexOf('async function resolveHiddenAuthorIds'));
    const body = helper.slice(0, helper.indexOf('\n}\n'));
    expect(body).toContain("where('blockerId', '==', userId)");
    expect(body).toContain("where('blockedId', '==', userId)");
  });

  test('no feed builder reads only the outgoing block direction', () => {
    // Any remaining inline `blocks` read outside the helper is a regression to
    // the one-directional filter. The helper is the only place allowed to query
    // the collection for feed filtering.
    const inlineBlockReads = feed.match(/db\.collection\('blocks'\)/g) || [];
    expect(inlineBlockReads.length).toBe(2); // both directions, inside the helper
    expect(feed).not.toMatch(/const blockedSnap = await db\.collection\('blocks'\)/);
  });
});
