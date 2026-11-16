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
 * Parsing uses @babel/parser (a declared devDependency) and a small local AST
 * walker — no @babel/traverse, which is only a transitive dependency here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.jsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Input types that are inherently non-labellable (buttons, hidden inputs, file
// pickers triggered by a visible button, etc.).
const EXEMPT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', 'leadingComments', 'trailingComments', 'innerComments']);

/** Depth-first walk carrying the ancestor node stack. */
function walk(node, ancestors, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, ancestors, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node, ancestors);
  ancestors.push(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (value && typeof value === 'object') walk(value, ancestors, visit);
  }
  ancestors.pop();
}

function jsxAttr(node, name) {
  return node.attributes.find((a) => a.type === 'JSXAttribute' && a.name?.name === name);
}

function staticString(attr) {
  return attr?.value?.type === 'StringLiteral' ? attr.value.value : undefined;
}

function collectFile(src, rel) {
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });

  const htmlForIds = new Set();
  walk(ast, [], (node) => {
    if (node.type === 'JSXOpeningElement' && node.name?.name === 'label') {
      const id = staticString(jsxAttr(node, 'htmlFor'));
      if (id) htmlForIds.add(id);
    }
  });

  const offenders = [];
  walk(ast, [], (node, ancestors) => {
    if (node.type !== 'JSXOpeningElement') return;
    const tag = node.name?.name;
    if (!['input', 'textarea', 'select'].includes(tag)) return;

    const type = staticString(jsxAttr(node, 'type'));
    if (EXEMPT_TYPES.has(type)) return;
    if (jsxAttr(node, 'aria-label') || jsxAttr(node, 'aria-labelledby') || jsxAttr(node, 'title')) return;

    const id = staticString(jsxAttr(node, 'id'));
    if (id && htmlForIds.has(id)) return;

    const wrapped = ancestors.some(
      (a) => a.type === 'JSXElement' && a.openingElement?.name?.name === 'label',
    );
    if (wrapped) return;

    offenders.push(`${rel}:${node.loc.start.line}`);
  });
  return offenders;
}

describe('N512 — every form control has a programmatic accessible name', () => {
  test('no input/textarea/select lacks a name', () => {
    const offenders = [];
    for (const full of walkFiles(path.join(root, 'src'))) {
      const rel = path.relative(root, full);
      offenders.push(...collectFile(fs.readFileSync(full, 'utf8'), rel));
    }
    expect(offenders).toEqual([]);
  });
});
