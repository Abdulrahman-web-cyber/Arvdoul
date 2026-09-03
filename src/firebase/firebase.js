// src/firebase/firebase.js - ULTRA PRO MAX ENTERPRISE EDITION V4
// 🏢 Perfect Singleton • Zero Race Conditions • Global Ready
// 🔐 Complete Firebase v12.7.0+ Support • All Services Working
// ✅ FIXED: Added getStorageInstance and getMessagingInstance exports
// 🔧 CRITICAL FIX: Force `auth.settings.appVerificationDisabledForTesting` to exist
//    immediately after creating the Auth instance, so RecaptchaVerifier never crashes.

// ==================== ENTERPRISE CONFIGURATION ====================
// Environment-overridable Firebase config. VITE_FIREBASE_* takes precedence
// (set in CI / .env); fallbacks keep local dev working. The committed values
// are public client keys (not secrets) — rotate in the Firebase console and
// deploy with env vars for production.
const FIREBASE_CONFIG = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyCP8E8KAbpNiAKHarAf98MMlcxxXcqmW7s",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "ecstatic-medium-3f6jr.firebaseapp.com",
  databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || "https://ecstatic-medium-3f6jr-default-rtdb.firebaseio.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "ecstatic-medium-3f6jr",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "ecstatic-medium-3f6jr.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "266743197979",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:266743197979:web:e95ccab595e04a90fb23be",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || ""
};

const FIRESTORE_DATABASE_ID = import.meta.env?.VITE_FIREBASE_DATABASE_ID || "ai-studio-arvdoul-22fc8386-1c12-445c-a748-45267b88f61a";

// ==================== EAGER SYNCHRONOUS INITIALIZATION ====================
// Several components import `db` / `auth` / `storage` as *live* SDK instances and
// use them synchronously (e.g. `collection(db, …)`, `signInWithPhoneNumber(auth, …)`).
// We initialize the app and these services eagerly at module load so those bindings
// are never `undefined`. `getFirestore(app)` / `getAuth(app)` / `getStorage(app)` are
// cached per-app, so these are the exact same instances the lazy manager returns below.
import { initializeApp as _fbInitializeApp, getApps as _fbGetApps, getApp as _fbGetApp } from 'firebase/app';
import { getFirestore as _fbGetFirestore } from 'firebase/firestore';
import { getAuth as _fbGetAuth, setPersistence as _fbSetPersistence, browserLocalPersistence as _fbBrowserLocalPersistence } from 'firebase/auth';
import { getStorage as _fbGetStorage } from 'firebase/storage';

const _fbApp = _fbGetApps().length ? _fbGetApp() : _fbInitializeApp(FIREBASE_CONFIG);
export const db = _fbGetFirestore(_fbApp, FIRESTORE_DATABASE_ID);
export const auth = _fbGetAuth(_fbApp);
export const storage = _fbGetStorage(_fbApp);

// Mirror the manager's auth hardening so phone/SMS auth keeps working.
try {
  if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV !== 'test') {
    _fbSetPersistence(auth, _fbBrowserLocalPersistence);
  }
  if (!auth.settings) auth.settings = {};
  auth.settings.appVerificationDisabledForTesting = false;
  auth.languageCode = (typeof navigator !== 'undefined' && navigator.language) || 'en';
} catch (_eagerAuthErr) {
  /* Persistence may be unavailable in some environments (e.g. private mode). */
}

// ==================== ULTIMATE SINGLETON MANAGER ====================
class UltimateFirebaseManager {
  constructor() {
    this._app = null;
    this._auth = null;
    this._firestore = null;
    this._storage = null;
    this._messaging = null;
    
    this._initialized = false;
    this._initializing = false;
    this._initPromise = null;
    
    this._services = {
      auth: null,
      firestore: null,
      storage: null,
      messaging: null
    };
    
    this._listeners = new Map();
    this._health = {
      status: 'initializing',
      startTime: Date.now(),
      services: {}
    };
    
    console.log('🔥 Ultimate Firebase Manager created');
  }

  // ==================== SINGLE INITIALIZATION PATH ====================
  async initialize() {
    if (this._initialized) {
      console.log('✅ Firebase already initialized');
      return this._app;
    }
    
    if (this._initializing) {
      console.log('⏳ Firebase initialization in progress');
      return this._initPromise;
    }
    
    this._initializing = true;
    console.log('🚀 Starting Ultimate Firebase initialization...');
    
    this._initPromise = (async () => {
      try {
        // 1. Load Firebase Core
        const { initializeApp, getApps } = await import('firebase/app');
        
        // 2. Check for existing app
        const existingApps = getApps();
        if (existingApps.length > 0) {
          this._app = existingApps.find(app => 
            app.name === '[DEFAULT]' || 
            app.options.apiKey === FIREBASE_CONFIG.apiKey
          ) || existingApps[0];
          console.log('✅ Using existing Firebase app:', this._app.name);
        } else {
          // 3. Initialize new app
          this._app = initializeApp(FIREBASE_CONFIG);
          console.log('✅ Created new Firebase app');
        }
        
        // 4. Mark as initialized
        this._initialized = true;
        this._initializing = false;
        this._health.status = 'healthy';
        
        console.log('🎉 Ultimate Firebase initialized successfully');
        return this._app;
        
      } catch (error) {
        this._initializing = false;
        console.error('❌ Firebase initialization failed:', error);
        throw error;
      }
    })();
    
    return this._initPromise;
  }

  // ==================== LAZY SERVICE LOADING ====================
  async getAuth() {
    if (!this._initialized) await this.initialize();
    
    if (this._auth) return this._auth;
    
    try {
      const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
      
      this._auth = getAuth(this._app);
      
      // 🔧 CRITICAL FIX: Immediately guarantee that auth.settings and the required
      // property exist, so the RecaptchaVerifier constructor does not crash.
      if (!this._auth.settings) {
        this._auth.settings = {};
      }
      this._auth.settings.appVerificationDisabledForTesting = false;
      
      // Configure persistence
      await setPersistence(this._auth, browserLocalPersistence);
      
      // Set language
      this._auth.languageCode = navigator.language || 'en';
      
      console.log('✅ Auth service loaded');
      return this._auth;
      
    } catch (error) {
      console.error('❌ Failed to load Auth service:', error);
      throw error;
    }
  }

  async getFirestore() {
    if (!this._initialized) await this.initialize();
    
    if (this._firestore) return this._firestore;
    
    try {
      const { getFirestore } = await import('firebase/firestore');
      
      this._firestore = getFirestore(this._app, FIRESTORE_DATABASE_ID);
      
      console.log('✅ Firestore service loaded');
      return this._firestore;
      
    } catch (error) {
      console.error('❌ Failed to load Firestore service:', error);
      throw error;
    }
  }

  async getStorage() {
    if (!this._initialized) await this.initialize();
    
    if (this._storage) return this._storage;
    
    try {
      const { getStorage } = await import('firebase/storage');
      
      this._storage = getStorage(this._app);
      
      console.log('✅ Storage service loaded');
      return this._storage;
      
    } catch (error) {
      console.error('❌ Failed to load Storage service:', error);
      throw error;
    }
  }

  async getStorageInstance() {
    return this.getStorage();
  }

  async getAuthInstance() {
    return this.getAuth();
  }

  async getFirestoreInstance() {
    return this.getFirestore();
  }

  async getMessaging() {
    if (!this._initialized) await this.initialize();
    
    if (this._messaging) return this._messaging;
    
    try {
      const { getMessaging } = await import('firebase/messaging');
      
      this._messaging = getMessaging(this._app);
      
      console.log('✅ Messaging service loaded');
      return this._messaging;
      
    } catch (error) {
      console.error('❌ Failed to load Messaging service:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================
  async awaitReady(timeout = 10000) {
    if (this._initialized) return true;
    
    if (this._initializing) {
      return this._initPromise.then(() => true);
    }
    
    return Promise.race([
      this.initialize().then(() => true),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase initialization timeout')), timeout)
      )
    ]);
  }

  isReady() {
    return this._initialized;
  }

  getApp() {
    return this._app;
  }

  async cleanup() {
    // Firebase handles cleanup automatically in v9+
    this._auth = null;
    this._firestore = null;
    this._storage = null;
    this._messaging = null;
    console.log('🧹 Firebase cleanup completed');
  }
}

// ==================== SINGLETON INSTANCE ====================
let managerInstance = null;

function getFirebaseManager() {
  if (!managerInstance) {
    managerInstance = new UltimateFirebaseManager();
  }
  return managerInstance;
}

// ==================== COMPATIBILITY EXPORTS ====================
async function getAuthInstance() {
  const manager = getFirebaseManager();
  return manager.getAuth();
}

async function getFirestoreInstance() {
  const manager = getFirebaseManager();
  return manager.getFirestore();
}

async function getStorageInstance() {
  const manager = getFirebaseManager();
  return manager.getStorage();
}

async function getMessagingInstance() {
  const manager = getFirebaseManager();
  return manager.getMessaging();
}

async function initializeFirebase() {
  const manager = getFirebaseManager();
  return manager.initialize();
}

async function awaitFirebaseReady(timeout = 10000) {
  const manager = getFirebaseManager();
  return manager.awaitReady(timeout);
}

function isFirebaseInitialized() {
  const manager = getFirebaseManager();
  return manager.isReady();
}

// ==================== EXPORTS ====================
export {
  getAuthInstance,
  getFirestoreInstance,
  getStorageInstance,
  getMessagingInstance,
  initializeFirebase,
  awaitFirebaseReady,
  isFirebaseInitialized,
  FIREBASE_CONFIG
};

export default getFirebaseManager();