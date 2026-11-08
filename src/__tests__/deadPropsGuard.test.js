/**
 * Dead-prop guard (passed but never consumed).
 *
 * `deadWiringGuard.test.js` catches a prop that is *destructured but never
 * referenced*. This is the mirror-image bug: a caller passes a prop the callee
 * never destructures at all, so the value is silently dropped. `navigate` on
 * `PostOptionsDrawer` (it builds its own), `isDark` on `TrendingSection` /
 * `CreatorCarousel` (both read `useTheme()`), and `theme` on `VideoCreatorInfo`
 * all shipped that way — the caller looked wired, the component ignored it.
 *
 * The scan resolves each local import to the file that defines the component
 * and compares the JSX attribute names against the callee's destructured
 * parameter list. It is deliberately conservative: a component with a rest
 * parameter (`...rest`), a spread at the call site, or a callee that cannot be
 * resolved is skipped, so it stays at zero false positives on the real tree.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');
const EXTS = ['', '.jsx', '.js', '.tsx', '.cjs', '.mjs'];

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

function balanced(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
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

function buildContracts(files) {
  const contracts = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const map = new Map();
    const re = /(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)?\s*\(?\s*\()/g;
    let m;
    while ((m = re.exec(source))) {
      const name = m[1] || m[2];
      let i = m.index + m[0].length;
      while (i < source.length && /\s/.test(source[i])) i += 1;
      if (source[i] !== '{') continue;
      const body = balanced(source, i);
      if (body == null) continue;
      const props = stripComments(body);
      map.set(name, {
        rest: /\.\.\./.test(props),
        names: new Set(
          splitTopLevel(props)
            .map((p) => p.trim().split(/[=:]/)[0].replace(/\.\.\./, '').trim())
            .filter(Boolean)
        ),
      });
    }
    contracts.set(file, map);
  }
  return contracts;
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

describe('dead-prop guard: a passed prop the callee consumes', () => {
  test('no JSX passes a prop the resolved component never destructures', () => {
    const files = collect(SRC);
    const contracts = buildContracts(files);
    const SKIP = new Set(['key', 'ref']);
    const violations = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const imports = new Map();
      for (const m of source.matchAll(/import\s+([A-Z]\w*)\s+from\s+['"]([^'"]+)['"]/g)) {
        const target = resolveImport(file, m[2]);
        if (target) imports.set(m[1], target);
      }
      for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
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
        const contract = contracts.get(target)?.get(name);
        if (!contract || contract.rest) continue;

        let j = m.index + m[0].length;
        let depth = 0;
        let end = -1;
        for (; j < source.length; j += 1) {
          const ch = source[j];
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
          else if (ch === '>' && depth === 0) { end = j; break; }
        }
        if (end < 0) continue;
        const attrs = source.slice(m.index + m[0].length, end);
        if (/\.\.\./.test(attrs)) continue;

        let d = 0;
        let buf = '';
        for (const ch of attrs) {
          if (ch === '{' || ch === '(') d += 1;
          else if (ch === '}' || ch === ')') d -= 1;
          if (d === 0) buf += ch;
        }
        const passed = [...buf.matchAll(/(?:^|\s)([a-zA-Z_]\w*)\s*=/g)]
          .map((x) => x[1])
          .filter((p) => !SKIP.has(p));
        const dead = passed.filter((p) => !contract.names.has(p));
        if (dead.length) {
          const line = source.slice(0, m.index).split('\n').length;
          violations.push(
            `${path.relative(root, file)}:${line} <${name}> passes unused prop(s): ${dead.join(', ')}`
          );
        }
      }
    }

    expect([...new Set(violations)]).toEqual([]);
  });
});
