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
const KNOWN_VIOLATIONS = new Set([
  'src/screens/CallScreen.jsx',
  'src/screens/CommentsDrawer.jsx',
  'src/screens/CreatePost.jsx',
  'src/screens/CreatePost/CreateImage.jsx',
  'src/screens/CreatePost/CreateLink.jsx',
  'src/screens/GiftScreen.jsx',
  'src/screens/Help/HelpCenterScreen.jsx',
  'src/screens/PostOptionsDrawer.jsx',
  'src/screens/SetupProfile.jsx',
  'src/screens/VideoDetailScreen.jsx',
]);

const FIREBASE_IMPORT = /from\s+['"]firebase\/(firestore|auth|storage|functions|database)['"]/;

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
