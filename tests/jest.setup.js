/**
 * tests/jest.setup.js - Shared Jest environment setup for the entire Arvdoul suite.
 *
 * Provides the browser-ish globals the services rely on, so tests are
 * deterministic in CI (jsdom) and in local runs:
 *   - fake-indexeddb (offline queue / idb)
 *   - TextEncoder/TextDecoder (fieldEncryption, E2EE)
 *   - WebCrypto (AES-GCM, PBKDF2, X25519-free E2EE helpers)
 *   - sessionStorage/localStorage shims
 *   - jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...)
 *   - ResizeObserver / matchMedia stubs for component tests
 */

import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import nodeUtil from 'node:util';
import nodeCrypto from 'node:crypto';

// ---------------------------------------------------------------------------
// structuredClone polyfill (required by fake-indexeddb in some Node/jsdom versions)
// ---------------------------------------------------------------------------
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => (val === undefined ? undefined : JSON.parse(JSON.stringify(val)));
}

// ---------------------------------------------------------------------------
// Fetch / Response / Request / Headers shims for jsdom component tests loading Firebase Auth
// ---------------------------------------------------------------------------
if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = class Headers {
    constructor(init = {}) {
      this._map = new Map(Object.entries(init || {}));
    }
    get(k) { return this._map.get(String(k).toLowerCase()) ?? null; }
    set(k, v) { this._map.set(String(k).toLowerCase(), String(v)); }
    has(k) { return this._map.has(String(k).toLowerCase()); }
    forEach(cb) { this._map.forEach((v, k) => cb(v, k, this)); }
  };
}
if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class Response {
    constructor(body = null, init = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new globalThis.Headers(init.headers);
    }
    async json() { return typeof this.body === 'string' ? JSON.parse(this.body || '{}') : (this.body ?? {}); }
    async text() { return typeof this.body === 'string' ? this.body : JSON.stringify(this.body ?? ''); }
    clone() { return new globalThis.Response(this.body, { status: this.status }); }
  };
}
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class Request {
    constructor(url, init = {}) {
      this.url = String(url);
      this.method = init.method || 'GET';
      this.headers = new globalThis.Headers(init.headers);
      this.body = init.body ?? null;
    }
  };
}
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = async () => new globalThis.Response('{}', { status: 503 });
}

// ---------------------------------------------------------------------------
// TextEncoder / TextDecoder (Node 22 provides globals, but keep for parity)
// ---------------------------------------------------------------------------
if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextEncoder = nodeUtil.TextEncoder;
  globalThis.TextDecoder = nodeUtil.TextDecoder;
}

// ---------------------------------------------------------------------------
// WebCrypto (crypto.subtle) - required by messagesService and storage helpers
// ---------------------------------------------------------------------------
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
    writable: true,
  });
}

// ---------------------------------------------------------------------------
// Storage shims
// ---------------------------------------------------------------------------
function createStorageShim() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => store.set(String(k), String(v)),
    removeItem: (k) => store.delete(String(k)),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createStorageShim();
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageShim();
}

// ---------------------------------------------------------------------------
// IndexedDB class stubs (idb package introspects some of these)
// ---------------------------------------------------------------------------
for (const name of ['IDBRequest', 'IDBDatabase', 'IDBTransaction', 'IDBIndex', 'IDBObjectStore', 'IDBCursor']) {
  if (typeof globalThis[name] === 'undefined') {
    globalThis[name] = class {};
  }
}

// ---------------------------------------------------------------------------
// jsdom gaps commonly hit by UI components
// ---------------------------------------------------------------------------
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof window !== 'undefined' && typeof window.scrollTo === 'undefined') {
  window.scrollTo = () => {};
}

// Silence Firebase's noisy "initialized" console chatter in test output.
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

if (process.env.SILENCE_CONSOLE === '1') {
  globalThis.console.log = () => {};
  globalThis.console.warn = (...args) => {
    if (String(args[0]).includes('Firebase')) return;
    originalWarn(...args);
  };
  globalThis.console.error = (...args) => {
    if (String(args[0]).includes('Firebase') || String(args[0]).includes('WebSocket')) return;
    originalError(...args);
  };
}

// Restore console if a test file wants to assert on output.
if (typeof afterAll === 'function') {
  afterAll(() => {
    globalThis.console.log = originalLog;
    globalThis.console.warn = originalWarn;
    globalThis.console.error = originalError;
  });
}
