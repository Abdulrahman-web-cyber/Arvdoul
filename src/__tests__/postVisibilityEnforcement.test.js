/**
 * Content-visibility enforcement guard (Area 4).
 *
 * The posts read rule gated ONLY on `authorIsPrivate`, so a draft, a scheduled
 * post, an `only_me` post or a soft-deleted post was readable by any signed-in
 * user through a direct `getDoc` — and the public feed paths (`for_you`,
 * `trending`, `discover`, `videos`, fallback) filtered only `isDeleted`, so they
 * surfaced drafts/private/scheduled posts to everyone.
 *
 * The fix: `postReadableByViewer()` now requires `status == 'published'`,
 * `isDeleted == false`, a non-expired `expiresAt`, and a permitted `visibility`;
 * the list rule is split out (`allow list: if postListableByViewer()`) and
 * requires the QUERY to prove a safe shape (`request.query.get`), since rules
 * are not filters.
 *
 * This guard fails if the per-document predicate loses a clause, if the list
 * rule stops constraining the query, or if a public feed query regresses to the
 * `authorIsPrivate`-only shape.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('posts per-document visibility rule', () => {
  const body = rules.slice(rules.indexOf('function postReadableByViewer'), rules.indexOf('function postQueryConstrainsPublic'));

  test('requires published, not deleted, not expired', () => {
    expect(body).toMatch(/status == 'published'/);
    expect(body).toMatch(/isDeleted == false/);
    expect(body).toMatch(/expiresAt/);
  });

  test('requires a permitted visibility (public, followers-with-edge, community)', () => {
    expect(body).toMatch(/visibility == 'public'/);
    expect(body).toMatch(/visibility == 'followers'/);
    expect(body).toMatch(/followEdgeExists/);
    expect(body).toMatch(/visibility == 'community'/);
  });

  test('the author and an admin are always admitted', () => {
    expect(body).toMatch(/authorId == uid\(\)/);
    expect(body).toMatch(/isAdmin\(\)/);
  });
});

describe('posts list rule proves the query shape', () => {
  test('list is split from get and uses request.query.get', () => {
    expect(rules).toMatch(/allow get: if postReadableByViewer\(\)/);
    expect(rules).toMatch(/allow list: if postListableByViewer\(\)/);
    expect(rules).toMatch(/request\.query\.get\('authorIsPrivate'/);
    expect(rules).toMatch(/request\.query\.get\('visibility'/);
    expect(rules).toMatch(/request\.query\.get\('status'/);
    expect(rules).toMatch(/request\.query\.get\('isDeleted'/);
  });
});

describe('client post queries constrain a rule-provable shape', () => {
  const services = walk(path.join(root, 'src'));

  test('no public feed query regresses to the authorIsPrivate-only shape', () => {
    // The old bug: `where('authorIsPrivate','==',false)` with no status/visibility.
    const offenders = [];
    for (const file of services) {
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes("collection(") || !/'posts'/.test(src)) continue;
      const usesAuthorIsPrivate = /where\('authorIsPrivate',\s*'==',\s*false\)/.test(src);
      if (!usesAuthorIsPrivate) continue;
      const hasStatus = /where\('status',\s*'==',\s*'published'\)/.test(src);
      const hasVisibility = /where\('visibility',\s*'==',\s*'public'\)/.test(src);
      if (!hasStatus || !hasVisibility) {
        offenders.push(path.relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('feedService centralises the public predicate in _publicPostFilters', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/feedService.js'), 'utf8');
    expect(src).toMatch(/_publicPostFilters\(\)\s*\{/);
    // The helper is the single definition; ad-hoc authorIsPrivate filters are gone.
    expect(src.match(/where\('authorIsPrivate'/g)?.length || 0).toBe(1);
  });
});
