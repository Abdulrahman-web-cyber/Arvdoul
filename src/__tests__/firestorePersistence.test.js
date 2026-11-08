/**
 * Firestore offline-persistence guard.
 *
 * The bug: six services each called the deprecated
 * `enableIndexedDbPersistence(firestore)` lazily during their own init. That is
 * racy — a service that issued a read before another service enabled persistence
 * got the memory cache, the call sites disagreed on `synchronizeTabs`, and the
 * call throws once the instance has already served a query (so "enabled" was
 * non-deterministic). Offline behaviour must be configured exactly once, at
 * instance creation, with the modern API.
 *
 * These assertions fail on the pre-fix code so the race cannot return.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const srcFiles = walk('src').filter((f) => !f.includes('__tests__'));

describe('Firestore persistence is configured once, at init', () => {
  test('no service enables persistence lazily', () => {
    const offenders = srcFiles.filter((f) =>
      fs.readFileSync(path.join(root, f), 'utf8').includes('enableIndexedDbPersistence('),
    );
    expect(offenders).toEqual([]);
  });

  test('the single init uses the modern multi-tab persistent cache', () => {
    const firebase = fs.readFileSync(path.join(root, 'src/firebase/firebase.js'), 'utf8');
    expect(firebase).toContain('initializeFirestore');
    expect(firebase).toContain('persistentLocalCache');
    expect(firebase).toContain('persistentMultipleTabManager');
    // Persistence is configured on the instance we export as `db`.
    expect(firebase).toMatch(/export const db = _createFirestore\(\)/);
  });
});
