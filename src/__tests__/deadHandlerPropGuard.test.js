/**
 * Dead handler-prop guard (N367).
 *
 * `deadWiringGuard.test.js` catches a prop that is *destructured but never
 * referenced*. `deadPropsGuard.test.js` catches a prop that is *passed but
 * never destructured*. This is the third side of the triangle: a handler prop
 * that a component *references and even wires into an onClick* but that **no
 * caller ever passes**, and that is never guarded (`if (!handler)` / `handler &&`
 * / `handler?.()`), so it is an always-undefined function.
 *
 * The shipped defects this pins (all fixed under N367):
 *
 *   - `TimelineToolbar` rendered Back/Crop/Settings buttons bound to
 *     `onBack` / `onCrop` / `onOpenSettings`; `VideoEditorScreen` passed none of
 *     them, so three visible buttons did nothing.
 *   - `TextTool` rendered a whole "Text Layers" section whose `textLayers` prop
 *     no caller supplies (so the block never mounted) and whose
 *     `onSelectLayer` / `onDuplicateLayer` / `onDeleteLayer` callbacks were
 *     therefore dead.
 *   - `MessageBubble.onLongPress`, `VideoGiftModal.onSendGift`,
 *     `MessageInput.onStartRecording` / `onStopRecording` and
 *     `ExportModal.onCompleteExport` were optional-chained calls no caller wired.
 *   - `ProfileSocialContext`'s shared-communities card called a never-passed
 *     `onCommunityClick` from a `cursor-pointer` div — a dead *and* misleading
 *     control.
 *
 * The scan is deliberately conservative to hold at zero false positives on the
 * real tree:
 *
 *   - a component with a rest parameter (`...rest`) is skipped (it can forward
 *     any prop);
 *   - a call site with a spread (`{...props}`) is skipped (the prop may be
 *     forwarded through it);
 *   - a prop is only reported when it has no default value, is passed by **no**
 *     call site, is referenced in the body, is **never** guarded
 *     (`if (!p)` / `p &&` / `p ||` / `p?.` / `typeof p`), and **every**
 *     reference is a bare call or a JSX `={p}` value.
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

/** Scan one JSX opening tag (comment/string aware). Returns its attribute text. */
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

// Stripped source per file, shared between the contract builder and the scan so
// every index is in the same coordinate space.
const stripped = new Map();
for (const file of collect(SRC)) stripped.set(file, stripComments(fs.readFileSync(file, 'utf8')));

// 1. Build each component's destructured prop contract. `paramStart`/`paramEnd`
//    delimit the destructure braces in the stripped source, so mentions inside
//    the parameter list are not mistaken for body references.
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
      list: splitTopLevel(props)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => ({ raw: p.split(/[=:]/)[0].replace(/\.\.\./, '').trim(), hasDefault: p.includes('=') })),
    });
  }
  contracts.set(file, map);
}

// 2. Record which props every call site passes.
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

/** True when the reference at `start` (length `len`) executes the value. */
function isExecutingReference(source, start, len) {
  let k = start + len;
  while (source[k] === ' ') k += 1;
  if (source[k] === '?' && source[k + 1] === '.') {
    k += 2;
    while (source[k] === ' ') k += 1;
    return source[k] === '(';
  }
  if (source[k] === '(') return true;
  if (source[k] === '}') {
    let b = start - 1;
    while (source[b] === ' ') b -= 1;
    if (source[b] === '{') {
      let e = b - 1;
      while (source[e] === ' ') e -= 1;
      return source[e] === '=';
    }
  }
  return false;
}

describe('dead handler-prop guard: a referenced handler is actually wired', () => {
  test('no handler is referenced but never passed and never guarded', () => {
    const violations = [];
    for (const [file, map] of contracts) {
      const source = stripped.get(file);
      for (const [name, contract] of map) {
        if (contract.rest) continue;
        const rec = passedBy.get(`${file}::${name}`);
        if (!rec || rec.spread) continue;
        for (const prop of contract.list) {
          if (!/^on[A-Z]/.test(prop.raw)) continue;
          if (prop.hasDefault) continue;
          if (rec.props.has(prop.raw)) continue;
          const id = prop.raw;
          const safe = id.replace(/\$/g, '\\$');
          const guarded = new RegExp(
            `(if\\s*\\(\\s*!?${safe}\\b|${safe}\\s*&&|${safe}\\s*\\|\\||typeof\\s+${safe}\\b|${safe}\\s*\\?\\?|!${safe}\\b)`
          ).test(source);
          if (guarded) continue;
          const refs = [];
          const re = new RegExp(`(?<![\\w.$])${safe}(?![\\w$])`, 'g');
          let mm;
          while ((mm = re.exec(source))) {
            const start = mm.index;
            if (start >= contract.paramStart && start <= contract.paramEnd) continue;
            refs.push(start);
          }
          if (!refs.length) continue;
          if (refs.every((start) => isExecutingReference(source, start, id.length))) {
            violations.push(
              `${path.relative(root, file)} <${name}> wires handler prop "${id}" that no caller passes`
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
