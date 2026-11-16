/**
 * @jest-environment node
 *
 * Form-control accessible-name guard (N512).
 *
 * A `<input>`, `<textarea>` or `<select>` with no programmatic accessible name
 * is announced by a screen reader as an unlabelled edit field ("edit text",
 * "combo box") and cannot be targeted by voice control. A *visible* text label
 * sitting next to the control is not enough — WCAG 1.3.1 / 4.1.2 require the
 * name to be programmatically associated, via one of:
 *
 *   - `aria-label`
 *   - `aria-labelledby` (pointing at an element id)
 *   - `title`
 *   - a wrapping `<label>` ancestor
 *   - a sibling `<label htmlFor={id}>` that matches the control's `id`
 *
 * A `placeholder` is explicitly NOT accepted: it disappears on input, is not
 * announced as the field name by every screen reader, and fails WCAG 1.3.1.
 *
 * The 194 offenders this guard was written against were all cases where a real
 * visible label ("User UID", "Category", "Brightness", …) sat adjacent to the
 * control but was never associated with it.
 *
 * Parsing uses @babel/parser (already a repo dependency) rather than regex so
 * multi-line JSX attributes and expression values are handled correctly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Input types that are inherently non-labellable (buttons, hidden inputs, file
// pickers triggered by a visible button, etc.).
const EXEMPT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

function collectFile(src, rel) {
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const htmlForIds = new Set();
  traverse(ast, {
    JSXAttribute(p) {
      const name = p.node.name?.name;
      if (name === 'htmlFor' && typeof p.node.value?.value === 'string') {
        htmlForIds.add(p.node.value.value);
      }
    },
  });

  const offenders = [];
  traverse(ast, {
    JSXOpeningElement(p) {
      const tag = p.node.name?.name;
      if (!['input', 'textarea', 'select'].includes(tag)) return;
      const attrs = p.node.attributes.filter((a) => a.type === 'JSXAttribute');
      const get = (k) => attrs.find((a) => a.name?.name === k);
      const has = (k) => !!get(k);
      const type = get('type')?.value?.value;
      if (EXEMPT_TYPES.has(type)) return;
      if (has('aria-label') || has('aria-labelledby') || has('title')) return;

      const id = get('id')?.value?.value;
      if (typeof id === 'string' && htmlForIds.has(id)) return;

      let anc = p.parentPath;
      while (anc) {
        if (anc.node?.type === 'JSXElement' && anc.node.openingElement?.name?.name === 'label') return;
        anc = anc.parentPath;
      }

      offenders.push(`${rel}:${p.node.loc.start.line}`);
    },
  });
  return offenders;
}

describe('N512 — every form control has a programmatic accessible name', () => {
  test('no input/textarea/select lacks a name', () => {
    const offenders = [];
    for (const full of walk(path.join(root, 'src'))) {
      const rel = path.relative(root, full);
      offenders.push(...collectFile(fs.readFileSync(full, 'utf8'), rel));
    }
    expect(offenders).toEqual([]);
  });
});
