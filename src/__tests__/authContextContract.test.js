/**
 * AuthContext contract guard.
 *
 * A screen may destructure anything it likes from `useAuth()`, but the context
 * only provides the keys listed in `contextValue`. Destructuring a key that is
 * not provided yields `undefined` — the call site then silently no-ops (e.g.
 * `if (refreshUser) await refreshUser()` never refreshed, and
 * `const { currentUser } = useAuth()` passed `undefined` down as the viewer).
 *
 * These were real dead wires found in TitlesScreen / CreatorOnboardingScreen /
 * PostDetails. This guard reads the provided keys straight from AuthContext's
 * `contextValue` object, so it can never drift, and fails if any
 * `const { ... } = useAuth()` destructures a key the context does not expose.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const authContextPath = path.join(root, 'src', 'context', 'AuthContext.jsx');

/** Parse the keys of the `contextValue` object literal from AuthContext.jsx. */
function providedAuthKeys() {
  const src = fs.readFileSync(authContextPath, 'utf8');
  const start = src.indexOf('const contextValue = useMemo(() => ({');
  if (start === -1) throw new Error('AuthContext: contextValue object literal not found');
  const bodyStart = src.indexOf('({', start) + 2;
  const bodyEnd = src.indexOf('}), [', bodyStart);
  if (bodyEnd === -1) throw new Error('AuthContext: contextValue object literal end not found');
  const body = src.slice(bodyStart, bodyEnd);
  const keys = new Set();
  for (const raw of body.split(',')) {
    const entry = raw.replace(/\/\/.*$/gm, '').trim();
    if (!entry) continue;
    const key = entry.split(':')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.add(key);
  }
  return keys;
}

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Extract every destructured key from `const { ... } = useAuth()` call sites. */
function destructuredAuthKeys(src) {
  const found = [];
  for (const match of src.matchAll(/=\s*useAuth\(\)/g)) {
    let i = match.index - 1;
    while (i >= 0 && /\s/.test(src[i])) i--;
    if (src[i] !== '}') continue;
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (src[j] === '}') depth++;
      else if (src[j] === '{') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (!/(const|let|var)\s*$/.test(src.slice(Math.max(0, j - 24), j))) continue;
    const body = src.slice(j + 1, i);
    for (const raw of body.split(',')) {
      const key = raw.trim().split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(key)) found.push(key);
    }
  }
  return found;
}

describe('AuthContext contract - every useAuth() destructure resolves', () => {
  const provided = providedAuthKeys();

  test('the provider exposes a non-trivial key set', () => {
    expect(provided.has('user')).toBe(true);
    expect(provided.size).toBeGreaterThan(20);
  });

  test('no file destructures a key useAuth() does not provide', () => {
    const offenders = [];
    for (const full of collect(path.join(root, 'src'))) {
      for (const key of destructuredAuthKeys(fs.readFileSync(full, 'utf8'))) {
        if (!provided.has(key)) offenders.push(`${path.relative(root, full)} -> ${key}`);
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
