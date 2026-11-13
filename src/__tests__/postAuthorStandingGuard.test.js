/**
 * Post author-standing guard.
 *
 * `PostCard` derived the creator/premium badge from `post.authorLevel`
 * (`>= 5` / `>= 8`) and the verified badge from `post.isVerified`. No writer ever
 * put `authorLevel` or `isVerified` on a `posts/{id}` document — the standing
 * lives on the author's `users/{uid}` profile — so every one of those reads was
 * permanently falsy: the avatar rings, the verified check, the creator zap and
 * the creator-gated gift button never rendered.
 *
 * The card now takes a resolved `authorStanding` prop (`useAuthorStanding`),
 * which hydrates the author profiles in one bounded batch and returns nothing
 * for an unresolved/denied profile (no fabricated badge). This guard fails if a
 * dead `authorLevel` read or a post-document standing read creeps back in.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(root, f);

/** Remove `//` line comments and `/* ... *\/` blocks so prose is not matched. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('post author standing is resolved, never read off the post doc', () => {
  const srcFiles = walk(path.join(root, 'src'));

  test('no module reads the dead `authorLevel` field', () => {
    const offenders = [];
    for (const file of srcFiles) {
      if (stripComments(fs.readFileSync(file, 'utf8')).match(/\bauthorLevel\b/)) {
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('PostCard resolves standing from a prop, not from `post.isVerified`', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'screens', 'PostCard.jsx'), 'utf8');
    expect(src).not.toMatch(/post\.isVerified/);
    expect(src).toMatch(/authorStanding/);
    expect(src).toMatch(/authorStanding\?\.isVerified/);
    expect(src).toMatch(/authorStanding\?\.isCreator/);
  });

  test('useAuthorStanding hydrates via the batched social-graph spine', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'hooks', 'useAuthorStanding.js'), 'utf8');
    // Bounded batch read — never one profile fetch per author.
    expect(src).toMatch(/hydrateProfiles/);
    expect(src).not.toMatch(/getUserProfile\s*\(/);
  });
});
