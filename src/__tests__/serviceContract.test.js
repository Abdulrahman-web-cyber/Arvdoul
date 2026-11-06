// src/__tests__/serviceContract.test.js
//
// Regression guard: every method invoked on an exported service singleton must
// exist on that singleton's API. This is the generalised form of
// `userServiceContract.test.js`, which only watched `userService`.
//
// It exists because the same class of bug kept shipping: screens called
// `commentService.addReaction`, `commentService.getCommentHistoryUI`,
// `commentService.pinCommentToTarget`, `commentService.getCommentsByTarget` and
// `messagingService.getConversationMessages` — none of which were defined — so
// the feature silently no-op'd (a thrown `TypeError` swallowed by a `catch`, or
// an `?.()` optional call that just did nothing). A green unit suite proved
// nothing about the wiring; this guard does.
//
// It understands the three singleton shapes used in `src/services`:
//   1. `export default objectLiteral`
//   2. `export default new ClassName()` (methods parsed from the same file)
//   3. `export default Object.assign(fn, { ...methods })`
// If a shape cannot be resolved the service is skipped rather than guessed at,
// so the guard never reports a false positive.
//
// Scope: method EXISTENCE only. It does not check argument shapes.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const srcDir = path.join(root, 'src');
const servicesDir = path.join(srcDir, 'services');

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') walk(p, acc);
    } else if (/\.(js|jsx)$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

/** Index of the matching close brace for the `{` at `open`, or -1. */
function matchBrace(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** [name, body] for each top-level `const NAME = { ... }` literal. */
function objectLiterals(source) {
  const out = [];
  const re = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(source, open);
    if (close > 0) out.push([m[1], source.slice(open, close + 1)]);
  }
  return out;
}

/** Method names declared on an object literal body. Over-collects on purpose. */
function keysOf(body) {
  const keys = new Set();
  for (const m of body.matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*:/gm)) keys.add(m[1]);
  for (const m of body.matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)) keys.add(m[1]);
  for (const m of body.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*,?\s*$/gm)) keys.add(m[1]);
  return keys;
}

/** Method names declared on `class ClassName { ... }` in the same source. */
function classMethods(source, className) {
  const re = new RegExp(`\\bclass\\s+${className}\\b[^{]*\\{`);
  const m = re.exec(source);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = matchBrace(source, open);
  if (close < 0) return null;
  const body = source.slice(open, close + 1);
  const methods = new Set();
  for (const mm of body.matchAll(/^\s{2}(?:async\s+|static\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\(/gm)) {
    methods.add(mm[1]);
  }
  return methods;
}

/** file -> { exportName: Set(method) } for resolvable service singletons. */
const serviceApis = new Map();
for (const entry of readdirSync(servicesDir)) {
  if (!entry.endsWith('.js')) continue;
  const file = path.join(servicesDir, entry);
  const source = readFileSync(file, 'utf8');
  const literals = new Map(objectLiterals(source).map(([n, b]) => [n, keysOf(b)]));
  const apis = {};

  const addExport = (name, methods) => {
    if (methods && methods.size) apis[name] = methods;
  };

  const def = source.match(/export\s+default\s+([A-Za-z_$][\w$]*)/);
  if (def) {
    const name = def[1];
    if (literals.has(name)) {
      addExport(name, literals.get(name));
    } else if (new RegExp(`\\bnew\\s+${name}\\s*\\(`).test(source)) {
      addExport(name, classMethods(source, name));
    }
  }

  // `const X = Object.assign(getThing, { ... })`
  for (const m of source.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*Object\.assign\s*\([^,]+,\s*\{/gm)) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(source, open);
    if (close > 0) addExport(m[1], keysOf(source.slice(open, close + 1)));
  }

  for (const m of source.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    addExport(m[1], classMethods(source, m[2]));
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const nm = part.trim().split(' as ').pop().trim();
      if (literals.has(nm)) addExport(nm, literals.get(nm));
    }
  }

  if (Object.keys(apis).length) serviceApis.set(path.normalize(file), apis);
}

/** file -> { localName: serviceFile } for imports that resolve to a service. */
function serviceImports(file, source) {
  const map = {};
  const resolve = (spec) => {
    if (!spec.includes('services/')) return null;
    let target = path.normalize(path.join(path.dirname(file), spec));
    if (!/\.[a-z]+$/.test(target)) target += '.js';
    return serviceApis.has(target) ? target : null;
  };
  for (const m of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolve(m[2]);
    if (!target) continue;
    for (const part of m[1].split(',')) {
      const local = part.trim().split(' as ').pop().trim();
      if (local) map[local] = target;
    }
  }
  for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolve(m[2]);
    if (target) map[m[1]] = target;
  }
  return map;
}

const IGNORED = new Set(['then', 'catch', 'finally', 'map', 'filter', 'forEach', 'bind', 'call', 'apply', 'js', 'toJSON']);

describe('service contract (no dead method calls on service singletons)', () => {
  test('the scan resolves a meaningful number of services', () => {
    expect(serviceApis.size).toBeGreaterThan(20);
  });

  test('every `service.method(...)` call resolves to a defined method', () => {
    const missing = new Set();
    for (const file of walk(srcDir)) {
      const source = readFileSync(file, 'utf8');
      const imports = serviceImports(file, source);
      if (!Object.keys(imports).length) continue;
      for (const m of source.matchAll(/\b([A-Za-z_$][\w$]*)\??\.([A-Za-z_$][\w$]*)\s*\(/g)) {
        const [, obj, method] = m;
        const target = imports[obj];
        if (!target || IGNORED.has(method)) continue;
        const api = serviceApis.get(target)[obj];
        if (api && !api.has(method)) {
          missing.add(`${path.relative(root, file)} -> ${obj}.${method}`);
        }
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
