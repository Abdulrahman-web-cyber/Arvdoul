/**
 * Hook contract guard.
 *
 * `useAnalytics()` returned `track` while BottomNav destructured `trackEvent`,
 * so every navigation analytics call silently no-op'd. The same class as the
 * AuthContext / store dead-key bugs, one layer over.
 *
 * This guard parses the returned object literal of each hook that returns one
 * and fails if any `const { ... } = useXHook()` destructures a key the hook
 * does not return.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooksDir = path.join(root, 'src', 'hooks');

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

/**
 * Keys of a hook's returned object literal, or `null` when the hook does not
 * end in a single parseable `return { ... };` (e.g. it returns null/a tuple or
 * spreads a computed object) — those are skipped rather than guessed.
 */
function returnedKeys(file) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /return\s*\{/g;
  let match;
  let last = null;
  while ((match = re.exec(src)) !== null) last = match;
  if (!last) return null;

  const open = last.index + last[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  const body = src.slice(open + 1, end);
  if (body.includes('...')) return null;

  const keys = new Set();
  for (const raw of body.split(',')) {
    const entry = raw.replace(/\/\/.*$/gm, '').trim();
    if (!entry) continue;
    const key = entry.split(':')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.add(key);
  }
  return keys.size > 1 ? keys : null;
}

/** Every `const { ... } = useX()` destructure in a file, with the hook name. */
function destructures(src) {
  const found = [];
  for (const match of src.matchAll(/=\s*(use[A-Z][\w$]*)\(\)/g)) {
    const hook = match[1];
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
      if (/^[A-Za-z_$][\w$]*$/.test(key)) found.push({ hook, key });
    }
  }
  return found;
}

const HOOKS = {};
for (const file of collect(hooksDir)) {
  const hook = path.basename(file).replace(/\.(js|jsx)$/, '');
  if (!/^use[A-Z]/.test(hook)) continue;
  const keys = returnedKeys(file);
  if (keys) HOOKS[hook] = { file, keys };
}

describe('hook contract - every hook destructure resolves', () => {
  const files = collect(path.join(root, 'src'));

  test('a non-trivial set of hooks was parsed', () => {
    expect(Object.keys(HOOKS).length).toBeGreaterThanOrEqual(3);
  });

  test('no file destructures a key its hook does not return', () => {
    const offenders = [];
    for (const full of files) {
      const src = fs.readFileSync(full, 'utf8');
      if (!src.includes('use')) continue;
      for (const { hook, key } of destructures(src)) {
        if (!HOOKS[hook]) continue; // not a local parsed hook
        if (!HOOKS[hook].keys.has(key)) {
          offenders.push(`${path.relative(root, full)} -> ${hook}().${key}`);
        }
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
