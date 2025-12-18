// src/firebase/firebase.js
// Arvdoul — Vite-safe, modular Firebase bootstrap (ESM, CI-safe, async-safe)

import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

/* ---------------------- ENV Validation ---------------------- */
const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !import.meta.env[k]);
  if (missing.length) {
    throw new Error(`[ARVDOUL][FIREBASE] Missing env vars: ${missing.join(", ")}`);
  }
}

function buildConfig() {
  assertEnv();
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
  };
}

/* ---------------------- VITE-SAFE NAMED EXPORTS ---------------------- */
/*
  Important: export names must exist at module-eval time so Rollup/Vite static analysis
  can see them. We assign to them during async initialization.
*/
export let auth = null;
export let db = null;
export let storage = null;
export let analytics = null;
export let performance = null;

/* ---------------------- INTERNAL STATE ---------------------- */
let app = null;
let _initPromise = null;

/* ---------------------- INITIALIZER ---------------------- */
/**
 * initializeFirebase()
 * - idempotent
 * - sets module-level named exports (auth, db, storage, analytics, performance)
 * - returns an object with services
 */
export async function initializeFirebase() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const cfg = buildConfig();
    app = initializeApp(cfg);

    // Auth
    auth = getAuth(app);
    try {
      await setPersistence(
        auth,
        import.meta.env.DEV ? inMemoryPersistence : browserLocalPersistence
      );
    } catch (e) {
      // not fatal - fallback to default persistence
      // keep going; warn for visibility in logs
      // eslint-disable-next-line no-console
      console.warn("[ARVDOUL][FIREBASE] setPersistence failed:", e?.message || e);
    }

    // Firestore
    db = getFirestore(app);
    try {
      // attempt to enable IndexedDB persistence (optional)
      await enableIndexedDbPersistence(db);
    } catch (e) {
      // Common reasons: multiple tabs / unsupported browser
      // Not fatal — Firestore will still work without persistence.
      // eslint-disable-next-line no-console
      console.warn("[ARVDOUL][FIRESTORE] persistence not enabled:", e?.code || e?.message || e);
    }

    // Storage
    storage = getStorage(app);

    // Optional: Analytics (guarded)
    try {
      if (await analyticsSupported()) {
        analytics = getAnalytics(app);
      }
    } catch (e) {
      // analytics not supported in this environment (SSR, test, etc.)
      // eslint-disable-next-line no-console
      console.warn("[ARVDOUL][ANALYTICS] not supported:", e?.message || e);
    }

    // Optional: Performance
    try {
      performance = getPerformance(app);
    } catch (e) {
      // not critical
      // eslint-disable-next-line no-console
      console.warn("[ARVDOUL][PERF] not supported:", e?.message || e);
    }

    return { app, auth, db, storage, analytics, performance };
  })();

  return _initPromise;
}

/* ---------------------- SAFE GETTERS ---------------------- */
export const getFirebaseAuth = () => {
  if (!auth) throw new Error("Firebase auth not initialized — call initializeFirebase() first");
  return auth;
};

export const getFirestoreDB = () => {
  if (!db) throw new Error("Firestore not initialized — call initializeFirebase() first");
  return db;
};

export const getFirebaseStorage = () => {
  if (!storage) throw new Error("Firebase storage not initialized — call initializeFirebase() first");
  return storage;
};

/* ---------------------- HEALTH CHECK ---------------------- */
export async function firebaseHealthCheck() {
  return {
    initialized: !!app,
    services: {
      auth: !!auth,
      db: !!db,
      storage: !!storage,
      analytics: !!analytics,
      performance: !!performance
    },
    ts: new Date().toISOString(),
    env: import.meta.env.MODE
  };
}

/* ---------------------- DEFAULT EXPORT (utility) ---------------------- */
export default {
  initializeFirebase,
  getFirebaseAuth,
  getFirestoreDB,
  getFirebaseStorage,
  firebaseHealthCheck
};