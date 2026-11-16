/**
 * Post author field is `authorId`, everywhere.
 *
 * A `posts/{id}` document stores its author as `authorId` (firestoreService
 * postDoc, the communities writer, and the `posts` create rule all agree). Any
 * server code that reads `post.userId` gets `undefined`. In
 * `functions/monetization.js` that made `sendGift` throw "Post has no author"
 * on every gift and made `boostPost` reject the real owner — both features were
 * dead. This guard fails if a post author is read from `userId` again.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const functionFiles = fs
  .readdirSync(path.join(root, 'functions'))
  .filter((f) => f.endsWith('.js') && f !== 'index.js');

describe('post author field consistency', () => {
  test('the client post writer stores authorId, never a post userId', () => {
    const src = read('src/services/firestoreService.js');
    const start = src.indexOf('const postDoc = {');
    const body = src.slice(start, start + 2000);
    expect(body).toContain('authorId:');
    expect(body).not.toMatch(/^\s*userId:\s*postData\.authorId/m);
  });

  test('the posts create rule keys on authorId', () => {
    expect(read('firestore.rules')).toContain("authoredBy('authorId')");
  });

  test('no Cloud Function reads a post author from `userId`', () => {
    const offenders = [];
    for (const f of functionFiles) {
      const src = read(`functions/${f}`);
      // Direct reads of the post author as `.userId`. A trailing fallback
      // (`authorId || postSnap.data().userId`) is the safe legacy shape.
      const direct = /postSnap\.data\(\)\.userId\b|postDoc\.data\(\)\.userId\b/g;
      for (const m of src.matchAll(direct)) {
        const before = src.slice(Math.max(0, m.index - 30), m.index);
        if (!/authorId\s*\|\|\s*$/.test(before)) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('monetization resolves the post author through authorId', () => {
    const src = read('functions/monetization.js');
    expect(src).toContain('postData.authorId || postData.userId');
    expect(src).toContain('boostPostData.authorId || boostPostData.userId');
  });
});
