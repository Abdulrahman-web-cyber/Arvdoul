/**
 * No blocking native dialogs (N503).
 *
 * `window.confirm` / `window.alert` / `window.prompt` freeze the main thread,
 * cannot be styled to the Arvdoul design system, and are not announced
 * accessibly. Destructive actions must use the promise-based `useConfirm()`
 * primitive (`src/components/Shared/ConfirmProvider.jsx`), which renders the
 * accessible `Dialog`. This guard fails if a native dialog is reintroduced.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('N503 — no blocking native dialogs in src', () => {
  test('window.confirm / window.alert / window.prompt are not used', () => {
    const offenders = [];
    for (const file of walk(srcDir)) {
      const src = fs.readFileSync(file, 'utf8');
      const matches = src.match(/\bwindow\.(confirm|alert|prompt)\s*\(/g);
      if (matches) offenders.push(`${path.relative(root, file)}: ${[...new Set(matches)].join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
