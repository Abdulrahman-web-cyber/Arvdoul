/**
 * Every screen, component and layout module must load: a module that resolves
 * and exposes a renderable default proves its entire import graph is intact —
 * no missing files, no syntax errors, no unresolved deep imports, no module
 * that throws at import time. This is the load guard for the UI layer; the
 * existing screen tests cover behaviour once a screen is up.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const collect = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsx$/.test(entry.name) && !/\.test\.jsx$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
};

const uiRoots = ['src/screens', 'src/components', 'src/layouts'];
const files = uiRoots
  .filter((r) => fs.existsSync(path.join(root, r)))
  .flatMap((r) => collect(path.join(root, r)));

// Renderable default: function component, class, or a memo/forwardRef object.
const isRenderable = (value) =>
  typeof value === 'function' || (value !== null && typeof value === 'object');

describe('UI modules load (screens, components, layouts)', () => {
  test('the walk actually found the UI tree', () => {
    expect(files.length).toBeGreaterThan(150);
  });

  test.each(files.map((f) => [path.relative(root, f), f]))('%s', async (_name, file) => {
    const mod = await import(file);
    expect(mod).toBeTruthy();
    expect(mod.default).toBeDefined();
    expect(isRenderable(mod.default)).toBe(true);
  });
});
