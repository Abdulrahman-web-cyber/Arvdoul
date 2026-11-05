/**
 * Service reachability guard.
 *
 * The repository once carried 54 "enterprise" services (chaos/failover meshes,
 * decentralized token curves, client-side audit ledgers, observability stacks)
 * that no screen, hook or service ever imported — they were reachable only from
 * their own tests, so a green suite proved nothing about the product. This guard
 * walks the real import graph from the app entry (`src/main.jsx`) and the
 * Functions entry (`functions/index.js`) and fails if any service is unreachable.
 *
 * If a service is genuinely dead, delete it (and its test) instead of exempting
 * it here. The allowlist is intentionally empty.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTS = ['.js', '.jsx', '.cjs', '.mjs'];

const ENTRY_POINTS = ['src/main.jsx', 'functions/index.js'];

function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('./') && !spec.startsWith('../') && !spec.startsWith('/')) return null;
  const base = path.normalize(path.join(path.dirname(fromFile), spec));
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, `index${e}`))];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

const IMPORT_RE = /(?:import\s+[^'"]*?from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (EXTS.includes(path.extname(entry.name))) out.push(path.normalize(full));
  }
  return out;
}

function buildGraph(files) {
  const edges = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const deps = new Set();
    for (const match of src.matchAll(IMPORT_RE)) {
      const resolved = resolveSpecifier(match[1], file);
      if (resolved) deps.add(resolved);
    }
    edges.set(file, deps);
  }
  return edges;
}

function reachableFrom(entries, edges) {
  const seen = new Set();
  const stack = entries.map((e) => path.normalize(path.join(root, e))).filter((e) => fs.existsSync(e));
  while (stack.length) {
    const node = stack.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    for (const dep of edges.get(node) || []) if (!seen.has(dep)) stack.push(dep);
  }
  return seen;
}

describe('service reachability (no dead service theatre)', () => {
  const allFiles = [...collectFiles(path.join(root, 'src')), ...collectFiles(path.join(root, 'functions'))];
  const edges = buildGraph(allFiles);
  const reachable = reachableFrom(ENTRY_POINTS, edges);

  const serviceDir = path.join(root, 'src', 'services');
  const services = fs
    .readdirSync(serviceDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.normalize(path.join(serviceDir, f)));

  test('the entry points exist and the graph is non-trivial', () => {
    expect(reachable.size).toBeGreaterThan(100);
  });

  test('every service under src/services is reachable from an app entry point', () => {
    const orphans = services
      .filter((s) => !reachable.has(s))
      .map((s) => path.relative(root, s))
      .sort();
    expect(orphans).toEqual([]);
  });
});
