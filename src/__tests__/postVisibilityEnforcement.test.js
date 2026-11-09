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
  const body = rules.slice(rules.indexOf('function postReadableByViewer'), rules.indexOf('function isCommunityMember'));

  test('requires published, not deleted, not expired', () => {
    expect(body).toMatch(/status == 'published'/);
    expect(body).toMatch(/isDeleted == false/);
    expect(body).toMatch(/expiresAt/);
  });

  test('requires a permitted visibility (public, followers-with-edge, friends mutual, community)', () => {
    expect(body).toMatch(/visibility == 'public'/);
    expect(body).toMatch(/visibility == 'followers'/);
    expect(body).toMatch(/visibility == 'friends'/);
    expect(body).toMatch(/followEdgeExists/);
    expect(body).toMatch(/visibility == 'community'/);
  });

  test('the author and an admin are always admitted', () => {
    expect(body).toMatch(/authorId == uid\(\)/);
    expect(body).toMatch(/isAdmin\(\)/);
  });
});

describe('posts list rule proves the query shape', () => {
  test('list is split from get and authorises on the document, not the query', () => {
    // `request.query` exposes only limit/offset/orderBy — there is no
    // `request.query.get()`. The list rule must therefore authorise on
    // `resource.data` (evaluated per candidate document) so a query that could
    // surface a draft/only-me post is denied wholesale.
    expect(rules).toMatch(/allow get: if postReadableByViewer\(\)/);
    expect(rules).toMatch(/allow list: if postListableByViewer\(\)/);
    expect(rules).not.toMatch(/request\.query\.get\(['"]/);
    expect(rules).toMatch(/resource\.data\.authorId == uid\(\) \|\| postListableShape\(\)/);
  });

  test('the public list shape requires published, non-deleted, public, non-private', () => {
    const body = rules.slice(rules.indexOf('function postListableShape'), rules.indexOf('function postListableByViewer'));
    expect(body).toMatch(/isDeleted == false/);
    expect(body).toMatch(/status == 'published'/);
    expect(body).toMatch(/visibility == 'public'/);
    expect(body).toMatch(/authorIsPrivate == false/);
    expect(body).toMatch(/visibility == 'community'/);
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

  test('the composer only offers visibility scopes the rules can honour', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/CreatePost.jsx'), 'utf8');
    const block = src.slice(src.indexOf('const VISIBILITY_OPTIONS'), src.indexOf('const MONETIZATION_TYPES'));
    const offered = [...block.matchAll(/value:\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(offered.length).toBeGreaterThan(0);
    // Scopes with no backing model (no list/edge/tier collection, no management
    // UI) must not be selectable.
    for (const unsupported of ['close_friends', 'subscribers', 'custom_list']) {
      expect(offered).not.toContain(unsupported);
    }
    // Every offered scope must be honoured by the post visibility rule —
    // `only_me` is honored implicitly (only the author branch admits it).
    for (const scope of offered.filter((s) => s !== 'only_me')) {
      expect(rules).toContain(`visibility == '${scope}'`);
    }
  });
});
