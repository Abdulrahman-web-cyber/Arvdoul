/**
 * Fail-open read guard.
 *
 * A `catch` block that returns a permissive value for an authorization or
 * uniqueness question turns an outage into a bypass:
 *
 *  - `storyService._canViewStory` returned `true` for a PUBLIC story when the
 *    block-edge lookup threw, so a transient graph failure served a blocked
 *    user's story.
 *  - `userService.checkUsernameAvailability` returned `available: true` when
 *    the lookup threw, so a taken username passed the UI as free.
 *
 * The rule is: when the check cannot be performed, answer "no", never "yes".
 * This guard scans every service for catch blocks that answer a permission,
 * privacy, block or availability question with `true` / `success: true` / `[]`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Strong security/uniqueness terms only. Deliberately excludes the loose
// "access"/"blocked"/"unavailable" substrings that produced false positives
// (a popup being *blocked*, a feed being *unavailable*).
const QUESTION = /privacy|private|permission|canView|capab|moderat|visib|authoriz|(?<!un)availab|isAdmin/i;
const PERMISSIVE = /return\s+(true|\{\s*success:\s*true|\[\])\s*;?/;

function catchBlocks(source) {
  const blocks = [];
  const re = /catch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ body: source.slice(start, i - 1), line: source.slice(0, m.index).split('\n').length });
  }
  return blocks;
}

describe('fail-open read guard: a failed check must not answer "yes"', () => {
  test('no catch block answers an authorization/availability question permissively', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { body, line } of catchBlocks(source)) {
        if (PERMISSIVE.test(body) && QUESTION.test(body)) {
          violations.push(`${path.relative(root, file)}:${line}: catch returns a permissive value for an access/uniqueness question`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('_canViewStory fails closed when the block edge cannot be resolved', () => {
    const src = fs.readFileSync(path.join(SRC, 'services/storyService.js'), 'utf8');
    const fn = src.slice(src.indexOf('async _canViewStory'));
    const blockCatch = fn.slice(fn.indexOf('getRelationship(viewerId, story.userId)'));
    // The catch that follows the relationship read must return false before the
    // PUBLIC short-circuit is reached.
    const catchIdx = blockCatch.indexOf('catch');
    const publicIdx = blockCatch.indexOf('VISIBILITY.PUBLIC');
    expect(catchIdx).toBeGreaterThan(-1);
    expect(blockCatch.slice(catchIdx, publicIdx)).toMatch(/return false;/);
  });

  test('checkUsernameAvailability fails closed when the lookup throws', () => {
    const src = fs.readFileSync(path.join(SRC, 'services/userService.js'), 'utf8');
    const fn = src.slice(src.indexOf('async checkUsernameAvailability'));
    const end = fn.indexOf('async generateUniqueUsername');
    const body = fn.slice(0, end);
    const catchBody = body.slice(body.lastIndexOf('catch')).replace(/\/\/[^\n]*/g, '');
    expect(catchBody).not.toMatch(/available:\s*true/);
    expect(catchBody).toMatch(/available:\s*false/);
  });

  test('like/unlike fail closed instead of reporting a persisted write', () => {
    const src = fs.readFileSync(path.join(SRC, 'services/firestoreService.js'), 'utf8');
    for (const name of ['async likePost(', 'async unlikePost(']) {
      const fn = src.slice(src.indexOf(name));
      const end = fn.indexOf('\n  async ', 10);
      const body = fn.slice(0, end === -1 ? fn.length : end);
      // The permissive pattern: catch returns success:true with localFallback.
      expect(body).not.toMatch(/success:\s*true,\s*(alreadyLiked:\s*false,\s*)?localFallback:\s*true/);
      // The transaction must not be wrapped in its own swallow-and-succeed catch.
      expect(body).not.toMatch(/catch \(txErr\)/);
    }
  });

  test('feed/read paths fail closed instead of caching an empty success page', () => {
    const files = [
      'src/services/feedService.js',
      'src/services/videoService.js',
      'src/services/storyService.js',
      'src/services/commentService.js',
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      for (const { body, line } of catchBlocks(src)) {
        expect({ file: rel, line, body: body.trim().slice(0, 80) }).not.toMatchObject({
          body: expect.stringMatching(/^return \{ success: true/),
        });
      }
    }
  });
});
