/**
 * Service-worker update-flow guard.
 *
 * `sw.js` used to call `self.skipWaiting()` from its `install` handler, so a new
 * worker activated immediately: `SWUpdateBanner` could never observe a waiting
 * worker, the "Update available" prompt never appeared, and the running bundle
 * was swapped out from under the user. The banner also posted a `SKIP_WAITING`
 * message that no handler consumed.
 *
 * The update is now user-driven: install does not skipWaiting, the worker takes
 * over only on a `SKIP_WAITING` message, and the banner reloads on the resulting
 * `controllerchange`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const banner = fs.readFileSync(path.join(root, 'src', 'components', 'common', 'SWUpdateBanner.jsx'), 'utf8');

describe('service-worker update flow is user-driven', () => {
  test('install does not unconditionally skipWaiting', () => {
    const install = sw
      .slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"))
      .replace(/\/\/.*$/gm, '');
    expect(install).not.toMatch(/skipWaiting/);
  });

  test('a SKIP_WAITING message handler exists and calls skipWaiting', () => {
    expect(sw).toMatch(/addEventListener\('message'/);
    expect(sw).toMatch(/data\.type === 'SKIP_WAITING'/);
    const message = sw.slice(sw.indexOf("addEventListener('message'"));
    expect(message).toMatch(/self\.skipWaiting\(\)/);
  });

  test('the banner reloads only after the accepted worker takes control', () => {
    expect(banner).toMatch(/postMessage\(\{\s*type:\s*'SKIP_WAITING'\s*\}\)/);
    expect(banner).toMatch(/addEventListener\('controllerchange'/);
    expect(banner).toMatch(/if \(acceptedRef\.current\) window\.location\.reload\(\)/);
  });
});
