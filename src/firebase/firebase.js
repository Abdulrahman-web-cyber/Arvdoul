// src/firebase/firebase.js
// Arvdoul — production-grade Firebase bootstrap (CI-safe, async-safe)

import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

/* ───────────────────────── ENV VALIDATION ───────────────────────── */

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter(k => !import.meta.env[k]);
  if (missing.length) {
    throw new Error(`[ARVDOUL][FIREBASE] Missing env vars: ${missing.join(", ")}`);
  }
}

function firebaseConfig() {
  assertEnv();
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };
}

/* ───────────────────────── SINGLETON STATE ───────────────────────── */

let app;
let auth;
let db;
let storage;
let analytics;
let performance;
let initPromise;

/* ───────────────────────── INITIALIZER ───────────────────────── */

export async function initializeFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    app = initializeApp(firebaseConfig());

    // Auth
    auth = getAuth(app);
    try {
      await setPersistence(
        auth,
        import.meta.env.DEV ? inMemoryPersistence : browserLocalPersistence
      );
    } catch (e) {
      console.warn("[ARVDOUL][AUTH] persistence fallback:", e);
    }

    // Firestore
    db = getFirestore(app);
    try {
      await enableIndexedDbPersistence(db);
    } catch (e) {
      console.warn("[ARVDOUL][FIRESTORE] persistence disabled:", e?.code || e);
    }

    // Storage
    storage = getStorage(app);

    // Optional services
    try {
      if (await analyticsSupported()) {
        analytics = getAnalytics(app);
      }
    } catch {}

    try {
      performance = getPerformance(app);
    } catch {}

    return { app, auth, db, storage, analytics, performance };
  })();

  return initPromise;
}

/* ───────────────────────── NAMED EXPORTS (CRITICAL) ───────────────────────── */

// These exports FIX your build error
export { auth, db, storage };

/* ───────────────────────── SAFE ACCESSORS ───────────────────────── */

export const getFirebaseAuth = () => {
  if (!auth) throw new Error("Firebase not initialized");
  return auth;
};

export const getFirestoreDB = () => {
  if (!db) throw new Error("Firebase not initialized");
  return db;
};

export const getFirebaseStorage = () => {
  if (!storage) throw new Error("Firebase not initialized");
  return storage;
};

/* ───────────────────────── DEFAULT EXPORT ───────────────────────── */

export default {
  initializeFirebase,
  getFirebaseAuth,
  getFirestoreDB,
  getFirebaseStorage
};