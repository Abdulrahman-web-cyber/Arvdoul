/**
 * Every screen, component and layout module must load: a module that resolves
 * and exposes a renderable default proves its entire import graph is intact —
 * no missing files, no syntax errors, no unresolved deep imports, no module
 * that throws at import time. This is the load guard for the UI layer; the
 * existing screen tests cover behaviour once a screen is up.
 */

import fs from 'node:fs';
import path from 'node:path';

class MockLogger {
  child() { return this; }
  debug() {}
  info() {}
  warn() {}
  error() {}
  fatal() {}
}

jest.mock('../utils/Logger.js', () => ({
  Logger: MockLogger,
  logger: new MockLogger(),
  LOG_LEVELS: { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 },
  setCorrelationId: jest.fn(),
  getCorrelationId: jest.fn(),
}));

jest.mock('../services/messagesService.js', () => ({
  getMessagingService: jest.fn(() => ({})),
  messagesService: {},
}));

jest.mock('../firebase/firebase.js', () => ({
  db: {},
  auth: { currentUser: null, onAuthStateChanged: jest.fn(() => () => {}) },
  storage: {},
  getFirestoreInstance: () => ({}),
  getAuthInstance: () => ({ currentUser: null, onAuthStateChanged: jest.fn(() => () => {}) }),
  getStorageInstance: () => ({}),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  setPersistence: jest.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: jest.fn(() => () => {}),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  serverTimestamp: jest.fn(),
  increment: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));
jest.mock('lodash-es/clamp', () => (val, min, max) => Math.min(Math.max(val, min), max));
jest.mock('quick-lru', () => class QuickLRU { get() {} set() {} has() { return false; } });
jest.mock('marked', () => ({ marked: jest.fn((text) => text) }));
jest.mock('konva', () => ({}));
jest.mock('react-konva', () => ({
  Stage: () => null,
  Layer: () => null,
  Image: () => null,
  Text: () => null,
  Rect: () => null,
  Circle: () => null,
  Group: () => null,
}));

const root = path.resolve(process.cwd());

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
