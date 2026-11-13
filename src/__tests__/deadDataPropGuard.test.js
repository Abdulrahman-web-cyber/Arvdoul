/**
 * Dead data-prop guard (N367, part 2).
 *
 * `deadWiringGuard.test.js` catches a prop that is *destructured but never
 * referenced*. `deadPropsGuard.test.js` catches a prop a caller *passes* that
 * the callee never destructures. This is the fourth side: a **data prop** that
 * the component references only as a JSX truthiness gate
 * (`{items.length > 0 && …}`, `{overlay && …}`) but that **no caller ever
 * passes** and that has no default — so the entire block it guards can never
 * render, and the prop is dead weight that hides a missing feature.
 *
 * The shipped defect this pins (fixed under N367): `TextTool` rendered a whole
 * "Text Layers" section (`textLayers.length > 0 && …` plus a `layers` toggle)
 * that no caller supplied — the panel could never mount, and the three layer
 * callbacks it wired were therefore dead too.
 *
 * Conservative by construction, to hold at zero false positives on the real
 * tree:
 *
 *   - a rest parameter or a call-site spread is skipped (the prop may be
 *     forwarded);
 *   - a prop with a default value is skipped (it is genuinely optional);
 *   - a prop referenced as a legacy fallback (`profile || user`,
 *     `isOwner ?? isCurrentUser`) is skipped — it is a documented alias, not a
 *     dead gate;
 *   - a component that re-renders itself with `{...props}` (the
 *     `ImageCardErrorBoundary` pattern) is skipped, since `props` carries the
 *     destructured names back in;
 *   - a prop is only reported when **every** reference is a JSX truthiness gate
 *     (`{` / `&&` / `||` / `?` / `!` immediately before it) and none is a call
 *     or property access.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');
const EXTS = ['', '.jsx', '.js'];

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of EXTS) if (fs.existsSync(base + ext)) return base + ext;
  for (const ext of EXTS) {
    const idx = path.join(base, `index${ext}`);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function balanced(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function scanTag(source, start) {
  let depth = 0;
  let inStr = null;
  let out = '';
  for (let j = start + 1; j < source.length; j += 1) {
    const ch = source[j];
    const next = source[j + 1];
    if (inStr) {
      out += ch;
      if (ch === '\\') { out += next; j += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; out += ch; continue; }
    if (ch === '/' && next === '/') { while (j < source.length && source[j] !== '\n') j += 1; continue; }
    if (ch === '/' && next === '*') { j += 2; while (j < source.length && !(source[j] === '*' && source[j + 1] === '/')) j += 1; j += 1; continue; }
    if (ch === '{') { depth += 1; out += ch; continue; }
    if (ch === '}') { depth -= 1; out += ch; continue; }
    if (ch === '>' && depth === 0) return out;
    out += ch;
  }
  return null;
}

const stripped = new Map();
for (const file of collect(SRC)) stripped.set(file, stripComments(fs.readFileSync(file, 'utf8')));

const contracts = new Map();
for (const [file, source] of stripped) {
  const map = new Map();
  const re = /(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)?\s*\(?\s*\()/g;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1] || m[2];
    let i = m.index + m[0].length;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (source[i] !== '{') continue;
    const end = balanced(source, i);
    if (end < 0) continue;
    const props = source.slice(i + 1, end);
    map.set(name, {
      paramStart: i,
      paramEnd: end,
      rest: /\.\.\./.test(props),
      selfSpread: new RegExp(`<${name}\\s+\\{\\.\\.\\.`).test(source),
      list: splitTopLevel(props)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => ({ raw: p.split(/[=:]/)[0].replace(/\.\.\./, '').trim(), hasDefault: p.includes('=') })),
    });
  }
  contracts.set(file, map);
}

const passedBy = new Map();
for (const [file, source] of stripped) {
  const imports = new Map();
  for (const m of source.matchAll(/import\s+([A-Z]\w*)\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveImport(file, m[2]);
    if (target) imports.set(m[1], target);
  }
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveImport(file, m[2]);
    if (!target) continue;
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.split(/\s+as\s+/).map((x) => x.trim());
      if (orig) imports.set(alias || orig, target);
    }
  }
  for (const m of source.matchAll(/<([A-Z]\w*)\b/g)) {
    const name = m[1];
    const target = imports.get(name);
    if (!target) continue;
    const attrs = scanTag(source, m.index);
    if (attrs == null) continue;
    const key = `${target}::${name}`;
    if (!passedBy.has(key)) passedBy.set(key, { props: new Set(), spread: false });
    const rec = passedBy.get(key);
    if (/\.\.\./.test(attrs)) rec.spread = true;
    let depth = 0;
    let flat = '';
    for (const ch of attrs) {
      if (ch === '{' || ch === '(') depth += 1;
      else if (ch === '}' || ch === ')') depth -= 1;
      if (depth === 0) flat += ch;
    }
    for (const x of flat.matchAll(/(?:^|\s)([a-zA-Z_]\w*)\s*=/g)) rec.props.add(x[1]);
  }
}

/** True when the reference at `start` is only ever a JSX truthiness gate. */
function isGateOnly(source, start, id) {
  const before = source.slice(Math.max(0, start - 12), start);
  const after = source.slice(start + id.length, start + id.length + 3);
  const isGate =
    (/\{\s*$/.test(before) && !/=\s*\{\s*$/.test(before)) ||
    /&&\s*$/.test(before) ||
    /\|\|\s*$/.test(before) ||
    /\?\s*$/.test(before) ||
    /!\s*$/.test(before);
  const isCallOrAccess = /^\s*[.(]/.test(after) || /^\s*\?\./.test(after);
  return isGate && !isCallOrAccess;
}

describe('dead data-prop guard: a gate-only prop is actually passed', () => {
  test('no data prop is used only as a JSX gate and never passed', () => {
    const violations = [];
    for (const [file, map] of contracts) {
      const source = stripped.get(file);
      for (const [name, contract] of map) {
        if (contract.rest || contract.selfSpread) continue;
        const rec = passedBy.get(`${file}::${name}`);
        if (!rec || rec.spread) continue;
        for (const prop of contract.list) {
          const id = prop.raw;
          if (prop.hasDefault) continue;
          if (id === 'children') continue;
          if (!/^[a-zA-Z_]\w*$/.test(id)) continue;
          if (rec.props.has(id)) continue;
          const safe = id.replace(/\$/g, '\\$');
          const re = new RegExp(`(?<![\\w.$])${safe}(?![\\w$])`, 'g');
          let mm;
          const refs = [];
          let alias = false;
          while ((mm = re.exec(source))) {
            if (mm.index >= contract.paramStart && mm.index <= contract.paramEnd) continue;
            const before = source.slice(Math.max(0, mm.index - 4), mm.index);
            if (/\|\|\s*$/.test(before) || /\?\?\s*$/.test(before)) alias = true;
            refs.push(mm.index);
          }
          if (!refs.length || alias) continue;
          if (refs.every((start) => isGateOnly(source, start, id))) {
            violations.push(
              `${path.relative(root, file)} <${name}> gates on data prop "${id}" that no caller passes`
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
