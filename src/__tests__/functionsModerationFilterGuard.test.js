/**
 * Server-side block/moderation filter guard.
 *
 * Several `functions/*.js` read paths served content from authors the viewer had
 * blocked, or who had blocked the viewer:
 *   - `functions/feed.js`'s three builders read only the outgoing block direction
 *     (`blocks.where('blockerId','==',uid)`), so a user who blocked the viewer
 *     still had their posts served into the viewer's feed (N227).
 *   - `functions/video.js#getVideoRecommendations` ("watch next") had **no** block
 *     filter at all, so blocked creators surfaced in the recommendation rail (N228).
 * A block is a mutual denial; every server content read must hide both the
 * viewer's blocks and the users who blocked the viewer.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const feed = fs.readFileSync(path.join(root, 'functions/feed.js'), 'utf8');
const video = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');

describe('functions/feed.js block filter', () => {
  test('resolveHiddenAuthorIds reads both block directions', () => {
    const helper = feed.slice(feed.indexOf('async function resolveHiddenAuthorIds'));
    const body = helper.slice(0, helper.indexOf('\n}\n'));
    expect(body).toContain("where('blockerId', '==', userId)");
    expect(body).toContain("where('blockedId', '==', userId)");
  });

  test('no feed builder reads only the outgoing block direction', () => {
    const inlineBlockReads = feed.match(/db\.collection\('blocks'\)/g) || [];
    expect(inlineBlockReads.length).toBe(2); // both directions, inside the helper
    expect(feed).not.toMatch(/const blockedSnap = await db\.collection\('blocks'\)/);
  });
});

describe('functions/video.js recommendations block filter', () => {
  test('getVideoRecommendations reads both block directions', () => {
    const start = video.indexOf('exports.getVideoRecommendations');
    const body = video.slice(start, video.indexOf('//  14. watermarkVideo'));
    expect(body).toContain("where('blockerId', '==', uid)");
    expect(body).toContain("where('blockedId', '==', uid)");
  });

  test('recommendations exclude hidden authors on both the same-creator and tag paths', () => {
    const start = video.indexOf('exports.getVideoRecommendations');
    const body = video.slice(start, video.indexOf('//  14. watermarkVideo'));
    // Same-creator path gates on the video owner; tag path gates per result.
    expect(body).toContain('!hiddenAuthors.has(video.userId)');
    expect(body).toContain('!hiddenAuthors.has(doc.data().userId)');
  });
});
