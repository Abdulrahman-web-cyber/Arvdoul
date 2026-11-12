/**
 * src/__tests__/sharedStatePrimitivesGuard.test.js
 *
 * One implementation per state surface. Three admin screens each hand-rolled an
 * identical "Access Denied / Admin privileges required" card (with three
 * different button styles); they now render `design-system/PermissionDenied`.
 * This guard stops that duplication (and any future hand-rolled copy of the
 * shared empty/error/denied surfaces) from creeping back.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');
const PRIMITIVE = 'src/design-system/PermissionDenied.jsx';

const UI_DIRS = [path.join(SRC, 'screens'), path.join(SRC, 'components')];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

const uiFiles = UI_DIRS.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));

describe('shared state primitives — one implementation, reused', () => {
  test('the PermissionDenied primitive exists and is wired to at least one screen', () => {
    expect(fs.existsSync(path.join(root, PRIMITIVE))).toBe(true);
    const importers = uiFiles.filter((f) =>
      /design-system\/PermissionDenied/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(importers.length).toBeGreaterThan(0);
  });

  test('no screen re-declares the access-denied copy inline', () => {
    const offenders = [];
    for (const file of uiFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (/Admin privileges required|>Access Denied</.test(text)) {
        offenders.push(path.relative(root, file).split(path.sep).join('/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no design-system state primitive uses an emoji as its icon', () => {
    // The design language bans emoji as interface icons. ErrorState (⚠️) and
    // PermissionDenied (🔒) shipped with emoji glyphs; they now use lucide icons.
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const dsDir = path.join(SRC, 'design-system');
    const offenders = [];
    for (const entry of fs.readdirSync(dsDir)) {
      if (!entry.endsWith('.jsx')) continue;
      const text = fs.readFileSync(path.join(dsDir, entry), 'utf8');
      if (EMOJI.test(text)) offenders.push(`src/design-system/${entry}`);
    }
    expect(offenders).toEqual([]);
  });
});
