// src/firebase/firebase.js  (Arvdoul-level, async-safe)
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

function assertEnv() {
  const missing = requiredEnvVars.filter(k => !import.meta.env[k]);
  if (missing.length) {
    throw new Error(`[ARVDOUL][FIREBASE] Missing env: ${missing.join(", ")}`);
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

class FirebaseServices {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.analytics = null;
    this.performance = null;
    this._initPromise = null;
  }

  async initialize() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const cfg = buildConfig();
      this.app = initializeApp(cfg);

      // Auth
      this.auth = getAuth(this.app);
      try {
        await setPersistence(this.auth, import.meta.env.DEV ? inMemoryPersistence : browserLocalPersistence);
      } catch (err) {
        console.warn("[ARVDOUL][FIREBASE] setPersistence failed:", err);
      }

      // Firestore
      this.db = getFirestore(this.app);
      try {
        await enableIndexedDbPersistence(this.db, { forceOwnership: false });
      } catch (err) {
        // if persistence fails, app still works in memory
        console.warn("[ARVDOUL][FIRESTORE] persistence not enabled:", err?.code || err?.message || err);
      }

      // Storage
      this.storage = getStorage(this.app);

      // Optional services
      try {
        if (await analyticsSupported()) {
          this.analytics = getAnalytics(this.app);
        }
      } catch (err) {
        console.warn("[ARVDOUL][ANALYTICS] not supported:", err);
      }

      try {
        this.performance = getPerformance(this.app);
      } catch (err) {
        // not critical
        console.warn("[ARVDOUL][PERF] not supported:", err);
      }

      return this;
    })();

    return this._initPromise;
  }

  // getters (lazy and guarded)
  getAuth() {
    if (!this.auth) throw new Error("Auth not initialized — call initialize() first");
    return this.auth;
  }
  getDB() {
    if (!this.db) throw new Error("Firestore not initialized — call initialize() first");
    return this.db;
  }
  getStorage() {
    if (!this.storage) throw new Error("Storage not initialized — call initialize() first");
    return this.storage;
  }

  async healthCheck() {
    return {
      initialized: !!this.app,
      services: {
        auth: !!this.auth,
        db: !!this.db,
        storage: !!this.storage,
        analytics: !!this.analytics,
        performance: !!this.performance
      },
      ts: new Date().toISOString(),
      env: import.meta.env.MODE
    };
  }
}

export const firebaseServices = new FirebaseServices();

export const initializeFirebase = async () => {
  return firebaseServices.initialize();
};

export const getFirebaseAuth = () => firebaseServices.getAuth();
export const getFirestoreDB = () => firebaseServices.getDB();
export const getFirebaseStorage = () => firebaseServices.getStorage();
export const firebaseHealthCheck = () => firebaseServices.healthCheck();
export default firebaseServices;