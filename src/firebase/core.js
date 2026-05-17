// src/firebase/core.js - ULTIMATE FIXED VERSION
// 🏗️ PURE INFRASTRUCTURE - No React, No Business Logic
// ⚡ Zero blocking, Instant initialization

let _app = null;
let _auth = null;
let _db = null;
let _storage = null;
let _analytics = null;
let _messaging = null;
let _performance = null;

let _isInitialized = false;
let _initializationPromise = null;
let _serviceHealth = {
  auth: 'unknown',
  firestore: 'unknown',
  storage: 'unknown',
  lastCheck: null
};

// Health status constants
const HEALTH_STATUS = {
  UNKNOWN: 'unknown',
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  ERROR: 'error'
};

/**
 * Initialize Firebase services (idempotent)
 * @returns {Promise<boolean>} True if successful
 */
export const initializeFirebase = async () => {
  if (_initializationPromise) return _initializationPromise;
  
  _initializationPromise = (async () => {
    try {
      console.info('🚀 Firebase initialization starting...');
      
      // Check if Firebase SDK is loaded
      if (typeof window === 'undefined' || !window.firebase) {
        throw new Error('Firebase SDK not loaded. Check index.html scripts.');
      }
      
      const { FIREBASE_CONFIG, ENVIRONMENT, FEATURES } = await import('./config.js');
      
      // Initialize Firebase App
      if (!window.firebase.apps.length) {
        _app = window.firebase.initializeApp(FIREBASE_CONFIG);
        console.info('🔥 Firebase App initialized');
      } else {
        _app = window.firebase.apps[0];
        console.info('🔥 Using existing Firebase App');
      }
      
      // Initialize services
      _auth = window.firebase.auth();
      _db = window.firebase.firestore();
      _storage = window.firebase.storage();
      
      // Configure Firestore
      if (FEATURES.ENABLE_PERSISTENCE) {
        try {
          await _db.enablePersistence({
            synchronizeTabs: true,
            experimentalForceOwningTab: true
          });
          console.info('💾 Firestore persistence enabled');
        } catch (error) {
          console.warn('⚠️ Firestore persistence error:', error.message);
        }
      }
      
      // Configure Auth persistence
      await _auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
      
      // Connect to emulators in development
      if (FEATURES.ENABLE_EMULATORS && ENVIRONMENT.isDevelopment) {
        try {
          const { connectEmulators } = await import('./emulators.js');
          await connectEmulators();
        } catch (error) {
          console.warn('⚠️ Could not connect to emulators:', error.message);
        }
      }
      
      // Health check
      await _checkServiceHealth();
      
      _isInitialized = true;
      console.info('✅ Firebase infrastructure ready');
      
      return true;
      
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      
      _serviceHealth = {
        auth: HEALTH_STATUS.ERROR,
        firestore: HEALTH_STATUS.ERROR,
        storage: HEALTH_STATUS.ERROR,
        lastCheck: Date.now(),
        error: error.message
      };
      
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  })();
  
  return _initializationPromise;
};

/**
 * Get Firebase App instance
 */
export const getFirebaseApp = () => {
  _assertInitialized();
  return _app;
};

/**
 * Get Firebase Auth instance
 */
export const getFirebaseAuth = () => {
  _assertInitialized();
  return _auth;
};

/**
 * Get Firestore instance
 */
export const getFirebaseFirestore = () => {
  _assertInitialized();
  return _db;
};

/**
 * Get Storage instance
 */
export const getFirebaseStorage = () => {
  _assertInitialized();
  return _storage;
};

/**
 * Check if Firebase is initialized
 */
export const isFirebaseInitialized = () => _isInitialized;

/**
 * Get service health status
 */
export const getServiceHealth = () => ({ ..._serviceHealth });

/**
 * Force reconnection (for network recovery)
 */
export const reconnectServices = async () => {
  console.info('🔄 Attempting to reconnect Firebase services...');
  
  // Clear existing instances
  _auth = null;
  _db = null;
  _storage = null;
  _isInitialized = false;
  _initializationPromise = null;
  
  // Reinitialize
  return initializeFirebase();
};

// 🔒 Private methods
const _assertInitialized = () => {
  if (!_isInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
};

const _checkServiceHealth = async () => {
  const health = {
    auth: HEALTH_STATUS.UNKNOWN,
    firestore: HEALTH_STATUS.UNKNOWN,
    storage: HEALTH_STATUS.UNKNOWN,
    lastCheck: Date.now()
  };
  
  try {
    // Check auth
    if (_auth) {
      try {
        await _auth.currentUser?.getIdToken(true);
        health.auth = HEALTH_STATUS.HEALTHY;
      } catch (error) {
        health.auth = HEALTH_STATUS.UNHEALTHY;
      }
    }
    
    // Check firestore (lightweight operation)
    if (_db) {
      try {
        // Test with a lightweight operation
        const testDoc = _db.collection('_health').doc('test');
        await testDoc.get({ source: 'cache' });
        health.firestore = HEALTH_STATUS.HEALTHY;
      } catch (error) {
        health.firestore = HEALTH_STATUS.UNHEALTHY;
      }
    }
    
    // Check storage
    if (_storage) {
      try {
        const ref = _storage.ref('.health-check');
        await ref.getMetadata();
        health.storage = HEALTH_STATUS.HEALTHY;
      } catch (error) {
        health.storage = HEALTH_STATUS.UNHEALTHY;
      }
    }
    
  } catch (error) {
    console.warn('⚠️ Firebase health check warning:', error.message);
  }
  
  _serviceHealth = health;
  return health;
};

// Export raw instances for compatibility
export const auth = { 
  get: getFirebaseAuth, 
  isReady: isFirebaseInitialized 
};

export const db = { 
  get: getFirebaseFirestore, 
  isReady: isFirebaseInitialized 
};

export const storage = { 
  get: getFirebaseStorage, 
  isReady: isFirebaseInitialized 
};

// Default export
export default {
  initializeFirebase,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseStorage,
  isFirebaseInitialized,
  getServiceHealth,
  reconnectServices,
  auth,
  db,
  storage
};