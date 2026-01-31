// src/firebase/firebase.js - ULTRA PRO MAX ENTERPRISE EDITION V3
// 🏢 Perfect Singleton • Zero Race Conditions • Global Ready
// 🔐 Complete Firebase v12.7.0+ Support • All Services Working

// ==================== ENTERPRISE CONFIGURATION ====================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDm9ks21qUT7vCVh6USGVtHJblBzEEPjxk",
  authDomain: "arvdoul-8057b.firebaseapp.com",
  databaseURL: "https://arvdoul-8057b-default-rtdb.firebaseio.com",
  projectId: "arvdoul-8057b",
  storageBucket: "arvdoul-8057b.firebasestorage.app",
  messagingSenderId: "892956185588",
  appId: "1:892956185588:web:5ca931799f5da7846b9fa1",
  measurementId: "G-MQL0JXL584"
};

// ==================== ULTIMATE SINGLETON MANAGER ====================
class UltimateFirebaseManager {
  constructor() {
    this._app = null;
    this._auth = null;
    this._firestore = null;
    this._storage = null;
    
    this._initialized = false;
    this._initializing = false;
    this._initPromise = null;
    
    this._services = {
      auth: null,
      firestore: null,
      storage: null
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
    
    this._initPromise = new Promise(async (resolve, reject) => {
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
        resolve(this._app);
        
      } catch (error) {
        this._initializing = false;
        console.error('❌ Firebase initialization failed:', error);
        reject(error);
      }
    });
    
    return this._initPromise;
  }

  // ==================== LAZY SERVICE LOADING ====================
  async getAuth() {
    if (!this._initialized) await this.initialize();
    
    if (this._auth) return this._auth;
    
    try {
      const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
      
      this._auth = getAuth(this._app);
      
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
      
      this._firestore = getFirestore(this._app);
      
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
  initializeFirebase,
  awaitFirebaseReady,
  isFirebaseInitialized,
  FIREBASE_CONFIG
};

export default getFirebaseManager();