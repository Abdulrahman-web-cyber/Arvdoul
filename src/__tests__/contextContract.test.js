/**
 * Context contract guard.
 *
 * `authContextContract.test.js` covers `useAuth()`. This generalises the same
 * check to every context hook: a component may destructure anything it likes,
 * but the provider only supplies the keys in its context value object, and a
 * missing key is a silent `undefined` no-op (`const { gradient } = useTheme()`
 * would be `undefined` if the provider stopped exposing it).
 *
 * The provided key set is parsed from the provider source, so the guard cannot
 * drift from the implementation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONTEXTS = [
  { hook: 'useAuth', file: 'src/context/AuthContext.jsx' },
  { hook: 'useTheme', file: 'src/context/ThemeProvider.jsx' },
];

/** Parse the keys of the provider's context value object literal. */
function providedKeys(relPath) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  const start = src.indexOf('const contextValue = useMemo(() => ({');
  if (start === -1) throw new Error(`${relPath}: contextValue object literal not found`);
  const bodyStart = src.indexOf('({', start) + 2;
  const bodyEnd = src.indexOf('}), [', bodyStart);
  if (bodyEnd === -1) throw new Error(`${relPath}: contextValue object literal end not found`);
  const keys = new Set();
  for (const raw of src.slice(bodyStart, bodyEnd).split(',')) {
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

/** Extract every destructured key from `const { ... } = useHook()` call sites. */
function destructuredKeys(src, hook) {
  const found = [];
  for (const match of src.matchAll(new RegExp(`=\\s*${hook}\\(\\)`, 'g'))) {
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
    for (const raw of src.slice(j + 1, i).split(',')) {
      const key = raw.trim().split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(key)) found.push(key);
    }
  }
  return found;
}

describe('context contract - every context-hook destructure resolves', () => {
  const files = collect(path.join(root, 'src'));

  test.each(CONTEXTS)('$hook exposes a non-trivial key set', ({ hook, file }) => {
    const provided = providedKeys(file);
    expect(provided.size).toBeGreaterThan(hook === 'useAuth' ? 20 : 8);
  });

  test('no file destructures a key its context hook does not provide', () => {
    const offenders = [];
    for (const { hook, file } of CONTEXTS) {
      const provided = providedKeys(file);
      for (const full of files) {
        const src = fs.readFileSync(full, 'utf8');
        if (!src.includes(`${hook}(`)) continue;
        for (const key of destructuredKeys(src, hook)) {
          if (!provided.has(key)) offenders.push(`${path.relative(root, full)} -> ${hook}().${key}`);
        }
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
