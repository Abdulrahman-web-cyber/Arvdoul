/**
 * Zustand store contract guard.
 *
 * A component may read any key it likes from a Zustand store, but the store
 * only exposes the keys defined in its state creator. Reading a key that does
 * not exist yields `undefined` — the surface then silently renders a zero/empty
 * value forever (this is exactly how `appStore.unreadCounts` backed the
 * BottomNav Chat/Alerts badges while nothing ever wrote it).
 *
 * This guard imports each store and compares its live state keys against every
 * selector / destructure / getState access in `src`, so the store can never
 * drift from its consumers. It is the store analogue of
 * `authContextContract.test.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { useAppStore } from '../store/appStore.js';
import { useProfileStore } from '../store/profileStore.js';
import { useMessagingStore } from '../store/messagingStore.js';
import { useSearchStore } from '../store/searchStore.js';
import { useVideoStore } from '../store/videoStore.js';
import { useAnalyticsStore } from '../store/analyticsStore.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STORES = {
  useAppStore,
  useProfileStore,
  useMessagingStore,
  useSearchStore,
  useVideoStore,
  useAnalyticsStore,
};

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Extract the object key from a single selector-parameter entry. */
function entryKey(raw) {
  return raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\.\.\./, '')
    .split(/[:=]/)[0]
    .trim();
}

/**
 * Every store key read in a file: selector form `useXStore(s => s.key)`,
 * destructure form `const { a, b } = useXStore()`, and
 * `useXStore.getState().key`.
 */
function readKeys(src, storeName) {
  const keys = [];

  // useXStore((state) => state.key) / useXStore(s => s.key)
  const selectorRe = new RegExp(
    `${storeName}\\s*\\(\\s*\\(?\\s*[A-Za-z_$][\\w$]*\\s*\\)?\\s*=>\\s*[A-Za-z_$][\\w$]*\\.([A-Za-z_$][\\w$]*)`,
    'g',
  );
  for (const m of src.matchAll(selectorRe)) keys.push(m[1]);

  // const { a, b } = useXStore()
  // The body may contain default values that themselves use braces/brackets
  // (`const { userStats = {}, list = [] } = useXStore()`), which a plain
  // `[^}]*` stopped at — silently missing every defaulted destructure.
  const destructureRe = new RegExp(
    `(?:const|let|var)\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*|\\[[^\\[\\]]*\\][^{}]*)*)\\}\\s*=\\s*${storeName}\\s*\\(`,
    'g',
  );
  for (const m of src.matchAll(destructureRe)) {
    for (const raw of m[1].split(',')) {
      const key = entryKey(raw);
      if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.push(key);
    }
  }

  // useXStore.getState().key
  const getStateRe = new RegExp(`${storeName}\\.getState\\(\\)\\.([A-Za-z_$][\\w$]*)`, 'g');
  for (const m of src.matchAll(getStateRe)) keys.push(m[1]);

  return keys;
}

describe('store contract - every store key read resolves', () => {
  const stateKeys = Object.fromEntries(
    Object.entries(STORES).map(([name, store]) => [name, new Set(Object.keys(store.getState()))]),
  );

  test('each store exposes a non-trivial key set', () => {
    for (const [name, keys] of Object.entries(stateKeys)) {
      expect(`${name}:${keys.size > 5}`).toBe(`${name}:true`);
    }
  });

  test('no file reads a store key the store does not expose', () => {
    const offenders = [];
    for (const full of collect(path.join(root, 'src'))) {
      const src = fs.readFileSync(full, 'utf8');
      for (const storeName of Object.keys(STORES)) {
        if (!src.includes(storeName)) continue;
        for (const key of readKeys(src, storeName)) {
          if (!stateKeys[storeName].has(key)) {
            offenders.push(`${path.relative(root, full)} -> ${storeName}.${key}`);
          }
        }
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
