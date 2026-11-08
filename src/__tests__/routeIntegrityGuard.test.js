/**
 * Route integrity guard (N127).
 *
 * A `navigate('/path')` whose target matches no `<Route>` is a dead end: the
 * router falls through to the `*` NotFound screen (or, worse, matches a
 * dynamic route with the wrong value). `CommunityDetailScreen` linked to
 * `/community/:id/members` and `/community/:id/bans`, neither of which is a
 * route, so both buttons silently 404'd even though the members and moderation
 * tabs already rendered that content in-page.
 *
 * Only *fully static* string-literal targets are checked (no `${...}` and no
 * query string): those are the ones a reader can verify by hand, and dynamic
 * segments cannot be validated without running the router. Dynamic routes are
 * normalised to `:p` on both sides.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const normalise = (p) => '/' + p.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? ':p' : s)).join('/');

/**
 * Absolute route paths, resolving nested (relative) child routes. JSX tags can
 * span lines and contain `>` inside `{...}` expressions, so the opening tag is
 * found by scanning to the first `>` at brace depth zero rather than by regex.
 */
function definedRoutes() {
  const src = fs.readFileSync(path.join(SRC, 'routes/AppRoutes.jsx'), 'utf8');
  const routes = new Set();
  const prefix = [];
  const openRe = /<Route\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    let i = openRe.lastIndex;
    let depth = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
      else if (ch === '>' && depth === 0) break;
      i++;
    }
    const tag = src.slice(m.index, i + 1);
    if (tag.startsWith('</Route')) { prefix.pop(); continue; }
    const pathMatch = /path="([^"]*)"/.exec(tag);
    const p = pathMatch ? pathMatch[1] : '';
    const full = p.startsWith('/') ? p : [prefix.filter(Boolean).join('/'), p].filter(Boolean).join('/');
    if (p) routes.add(normalise('/' + full.replace(/^\//, '')));
    if (!tag.trimEnd().endsWith('/>')) prefix.push(p);
    openRe.lastIndex = i + 1;
  }
  return routes;
}

/** Fully static `navigate('/literal')` targets (no interpolation, no query). */
function staticNavigateTargets() {
  const targets = new Map();
  for (const file of collect(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/navigate\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = m[1];
      if (!target.startsWith('/')) continue;
      if (target.includes('${') || target.includes('?')) continue;
      targets.set(normalise(target), path.relative(root, file));
    }
  }
  return targets;
}

describe('every static navigate() target resolves to a defined route', () => {
  const routes = definedRoutes();
  const targets = staticNavigateTargets();

  test('the route table is parsed (sanity)', () => {
    expect(routes.has('/messages/new')).toBe(true);
    expect(routes.has('/profile/:p/followers')).toBe(true);
    expect(routes.size).toBeGreaterThan(100);
  });

  test('no static navigate() target is missing a route', () => {
    const missing = [...targets.entries()]
      .filter(([target]) => !routes.has(target))
      .map(([target, file]) => `${target}  (${file})`);
    expect(missing).toEqual([]);
  });

  test('query-string nav targets are consumed by their receiving screen', () => {
    // `navigate('/path?key=value')` is excluded from the static-route check
    // above, so the *param* needs its own guard: the panel linked to
    // /profile?tab=posts, /create-post?type=poll and /videos?tab=sparks, none
    // of which any screen read.
    const profile = fs.readFileSync(path.join(SRC, 'screens/Profile/ProfileMyScreen.jsx'), 'utf8');
    expect(profile).toContain("searchParams.get('tab')");

    const composer = fs.readFileSync(path.join(SRC, 'screens/CreatePost.jsx'), 'utf8');
    expect(composer).toContain('searchParams.get("type")');

    const videos = fs.readFileSync(path.join(SRC, 'screens/VideosScreen.jsx'), 'utf8');
    expect(videos).toContain("searchParams.get('tab')");
    expect(videos).toContain('if (initialTab !== feedType) setFeedType(initialTab);');
  });

  test('the community members/bans links point at in-page tabs, not dead routes', () => {
    const src = fs.readFileSync(path.join(SRC, 'screens/Community/CommunityDetailScreen.jsx'), 'utf8');
    expect(src).not.toContain('/members`');
    expect(src).not.toContain('/bans`');
    expect(src).toContain("setActiveTab('members')");
    expect(src).toContain("setActiveTab('moderation')");
  });
});
