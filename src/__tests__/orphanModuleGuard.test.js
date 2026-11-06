/**
 * Orphaned-module guard.
 *
 * A source file that nothing in the real app imports is dead weight: it can
 * drift, keep stale tests green, and give a false impression of capability
 * (the repository once carried whole "phase N" subsystems reachable only from
 * their own test). This guard walks the import graph from the real entry point
 * (`src/main.jsx`) and fails if any non-entry `src/**` module is unreachable.
 *
 * If a module is genuinely dead, delete it (and its test) instead of exempting
 * it here. The allowlist below holds only hand-edited, non-runtime data
 * registries whose sole consumer is a guard test.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');
const EXTS = ['.js', '.jsx', '.cjs', '.mjs'];
const ENTRY = path.join(SRC, 'main.jsx');

// Non-runtime source-of-truth data modules. `tokens.js` is the hand-edited
// design-token registry, mirrored 1:1 into `tokens.css` (the runtime CSS
// variables) and `tokens.json`; `designTokens.test.js` enforces that parity.
const DATA_MODULE_ALLOWLIST = new Set(['src/design-system/tokens.js']);

// Mirrors vite.config.js `resolve.alias` - keep in sync if an alias is added.
const ALIASES = {
  '@': SRC,
  '@components': path.join(SRC, 'components'),
  '@screens': path.join(SRC, 'screens'),
  '@context': path.join(SRC, 'context'),
  '@lib': path.join(SRC, 'lib'),
  '@hooks': path.join(SRC, 'hooks'),
  '@data': path.join(SRC, 'data'),
  '@assets': path.join(SRC, 'assets'),
  '@app-firebase': path.join(SRC, 'firebase'),
  '@styles': path.join(SRC, 'styles'),
};

function collectFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (EXTS.includes(path.extname(entry.name))) out.push(path.normalize(full));
  }
  return out;
}

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    base = path.normalize(path.join(path.dirname(fromFile), spec));
  } else {
    const alias = Object.keys(ALIASES)
      .sort((a, b) => b.length - a.length)
      .find((a) => spec === a || spec.startsWith(`${a}/`));
    if (!alias) return null;
    base = path.normalize(path.join(ALIASES[alias], spec.slice(alias.length).replace(/^\//, '')));
  }
  const candidates = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, `index${e}`)),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

const IMPORT_RE = /(?:import\s+[^'"]*?from\s*|export\s+[^'"]*?from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

describe('orphan-module guard (no dead source files)', () => {
  const files = collectFiles(SRC);
  const reachable = new Set();
  const stack = [path.normalize(ENTRY)];

  while (stack.length) {
    const file = stack.pop();
    if (reachable.has(file) || !fs.existsSync(file)) continue;
    reachable.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const match of src.matchAll(IMPORT_RE)) {
      const resolved = resolveSpecifier(match[1], file);
      if (resolved && !reachable.has(resolved)) stack.push(resolved);
    }
  }

  test('every src module is reachable from the app entry point', () => {
    const orphans = files
      .filter((f) => !reachable.has(f))
      .map((f) => path.relative(root, f))
      .filter((f) => !DATA_MODULE_ALLOWLIST.has(f))
      .sort();
    expect(orphans).toEqual([]);
  });
});
