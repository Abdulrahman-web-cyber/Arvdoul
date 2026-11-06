/**
 * Offline queue single-owner guard.
 *
 * `src/utils/OfflineQueue.js` exports the one canonical `offlineQueue`
 * singleton; `src/offline/syncEngine.js` re-exports it and owns every drain.
 * UI once opened a SECOND IndexedDB under the same name
 * (`arvdoul_offline_queue`) at a different version, which made the canonical
 * open throw a VersionError in a real browser, so queued likes/reactions/saves
 * were silently dropped. This guard fails if any module other than the
 * canonical queue opens that database, or if a parallel "actions" queue is
 * reintroduced.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL = path.join('src', 'utils', 'OfflineQueue.js');

function collect(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('offline queue has exactly one owner', () => {
  const files = collect(path.join(root, 'src'));

  test('only the canonical OfflineQueue opens arvdoul_offline_queue', () => {
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      if (rel === CANONICAL) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (src.includes('arvdoul_offline_queue')) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test('no second parallel action queue is opened', () => {
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (/arvdoul_actions_offline/.test(src)) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  test('no second OfflineQueue instance is constructed', () => {
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      if (rel === CANONICAL) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/new\s+OfflineQueue\s*\(/.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
