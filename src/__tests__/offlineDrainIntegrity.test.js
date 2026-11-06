/**
 * Offline drain integrity guard.
 *
 * The canonical queue (`src/utils/OfflineQueue.js`) is drained by exactly one
 * place: `src/offline/syncEngine.js`, whose `registerSyncHandler` map is the
 * single op-type → service registry. Two other modules previously carried their
 * own divergent copies of that switch (an inline switch in `AppBootstrap.jsx`
 * and `BackgroundSyncService.triggerQueueDrain`). They called methods that do
 * not exist (`messagesService.getMessagesService`, `feedService.addReaction`,
 * `videoService.createReel`, `commentService.addComment`, `postService.*`), so
 * the same queued op was handled by a broken drain and retried forever.
 *
 * This guard fails if:
 *   1. an op type enqueued into the canonical queue has no registered handler, or
 *   2. a module other than the engine drains the canonical queue directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join('src', 'offline', 'syncEngine.js');
const QUEUE = path.join('src', 'utils', 'OfflineQueue.js');
const SERVICE_KIT = path.join('src', 'services', 'ServiceKit.js');

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

const files = collect(path.join(root, 'src'));

/** Op types registered on the canonical engine (including legacy aliases). */
function registeredTypes() {
  const src = fs.readFileSync(path.join(root, ENGINE), 'utf8');
  const types = new Set();
  for (const m of src.matchAll(/registerSyncHandler\(\s*'([^']+)'/g)) types.add(m[1]);
  return types;
}

/** Op types enqueued into the canonical queue as string literals. */
function enqueuedTypes() {
  const types = new Set();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/offlineQueue\.enqueue\(|enqueueAction\(|queue\.enqueue\(/.test(src)) continue;
    for (const m of src.matchAll(
      /(?:offlineQueue\.enqueue|enqueueAction|queue\.enqueue)\(\{[\s\S]{0,400}?type:\s*'([^']+)'/g
    )) {
      types.add(m[1]);
    }
  }
  return types;
}

describe('offline drain integrity', () => {
  test('every enqueued op type has a registered drain handler', () => {
    const registered = registeredTypes();
    const missing = [...enqueuedTypes()].filter((t) => !registered.has(t)).sort();
    expect(missing).toEqual([]);
  });

  test('only the sync engine drains the canonical queue', () => {
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      if (rel === ENGINE || rel === QUEUE || rel === SERVICE_KIT) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/offlineQueue\.(process|drain|onOnline)\s*\(/.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test('the engine registers a handler for the canonical post/reaction op types', () => {
    const registered = registeredTypes();
    for (const type of ['post.like', 'post.unlike', 'post.save', 'post.unsave', 'user.follow', 'user.unfollow']) {
      expect(registered.has(type)).toBe(true);
    }
  });
});
