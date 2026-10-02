/**
 * src/__tests__/architectureBoundaries.test.js
 * Repository reconstruction guard (REPOSITORY_RECONSTRUCTION_V1.md §2.3/§9).
 *
 * The directive requires that UI (screens/components) reach the backend through
 * services, never by importing the Firebase SDK directly. Direct SDK use in a
 * screen bypasses cache scoping, authorization helpers and error normalisation,
 * and is exactly how the audit's duplicate-read and privacy bugs were possible.
 *
 * This test freezes the current set of offenders as an explicit allowlist so no
 * NEW violation can be introduced while the existing ones are migrated.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Files that still import firebase/* directly. Each entry is a migration item;
// remove a line here only when the file goes through a service instead.
// (Empty: all previously tracked offenders now reach the backend via services.)
const KNOWN_VIOLATIONS = new Set([]);

const FIREBASE_IMPORT = /(from\s+|import\(\s*)['"]firebase\/(firestore|auth|storage|functions|database|app)['"]/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('architecture boundary: UI must not import the Firebase SDK directly', () => {
  test('no new screen/component imports firebase/* directly', () => {
    const offenders = [];
    for (const dir of ['src/screens', 'src/components']) {
      for (const full of walk(path.join(root, dir))) {
        const rel = path.relative(root, full);
        const src = fs.readFileSync(full, 'utf8');
        if (FIREBASE_IMPORT.test(src) && !KNOWN_VIOLATIONS.has(rel)) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the allowlist contains no file that has already been migrated', () => {
    const stale = [];
    for (const rel of KNOWN_VIOLATIONS) {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) {
        stale.push(`${rel} (missing)`);
        continue;
      }
      if (!FIREBASE_IMPORT.test(fs.readFileSync(full, 'utf8'))) {
        stale.push(`${rel} (already migrated — remove from allowlist)`);
      }
    }
    expect(stale).toEqual([]);
  });
});

// Lower layers must never import a higher layer. Services, stores, hooks and
// utilities are consumed BY screens/components, never the other way round; an
// upward import creates a cycle and drags JSX into a module the Cloud
// Functions runtime or a service test may load. (Directive §84.)
const UI_IMPORT = /(from\s+|import\(\s*)['"][^'"]*(?:screens|components)\//;

// `routePrefetcher` is a routing concern owned by the app shell: its whole
// purpose is to warm the screen chunks the router will render next, so its
// dynamic imports of `../screens/*` are the feature, not an upward dependency.
// It is consumed only by `src/app/AppBootstrap.jsx`.
const UI_IMPORT_EXCEPTIONS = new Set(['src/utils/routePrefetcher.js']);

describe('architecture boundary: lower layers must not import UI', () => {
  test('services, stores, hooks and utils do not import screens/components', () => {
    const offenders = [];
    for (const dir of ['src/services', 'src/store', 'src/hooks', 'src/utils', 'src/context']) {
      for (const full of walk(path.join(root, dir))) {
        const rel = path.relative(root, full);
        if (UI_IMPORT_EXCEPTIONS.has(rel)) continue;
        if (UI_IMPORT.test(fs.readFileSync(full, 'utf8'))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
