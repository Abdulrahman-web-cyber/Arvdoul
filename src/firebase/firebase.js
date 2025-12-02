import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence 
} from "firebase/auth";
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED 
} from "firebase/firestore";
import { 
  getStorage, 
  connectStorageEmulator 
} from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

// Advanced environment validation
const validateEnvironment = () => {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate Firebase configuration format
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Invalid Firebase API key configuration');
  }

  console.info('✅ Environment validation passed');
};

// Enhanced Firebase configuration with validation
const getFirebaseConfig = () => {
  validateEnvironment();

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || null,
    
    // Advanced configuration options
    auth: {
      persistence: 'local', // 'local', 'session', or 'none'
    },
    firestore: {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true, // Better for unreliable networks
    },
    storage: {
      maxUploadRetryTime: 30000, // 30 seconds
      maxOperationRetryTime: 30000,
    }
  };
};

// Advanced error handling for Firebase initialization
class FirebaseInitializationError extends Error {
  constructor(message, component) {
    super(`Firebase ${component} initialization failed: ${message}`);
    this.name = 'FirebaseInitializationError';
    this.component = component;
  }
}

// Performance monitoring setup
const initializePerformanceMonitoring = async (app) => {
  try {
    const performanceSupported = await isSupported();
    if (performanceSupported) {
      const performance = getPerformance(app);
      console.info('✅ Performance monitoring enabled');
      return performance;
    }
    console.warn('⚠️ Performance monitoring not supported in this environment');
    return null;
  } catch (error) {
    console.warn('⚠️ Performance monitoring initialization failed:', error);
    return null;
  }
};

// Analytics setup with privacy compliance
const initializeAnalytics = async (app) => {
  try {
    const analyticsSupported = await isSupported();
    if (analyticsSupported && import.meta.env.PROD) {
      const analytics = getAnalytics(app);
      
      // Disable automatic data collection for privacy compliance
      analytics.setAnalyticsCollectionEnabled(true);
      
      console.info('✅ Analytics enabled (production only)');
      return analytics;
    }
    console.warn('⚠️ Analytics disabled (development mode or not supported)');
    return null;
  } catch (error) {
    console.warn('⚠️ Analytics initialization failed:', error);
    return null;
  }
};

// Enhanced Firebase services initialization
class FirebaseServices {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.analytics = null;
    this.performance = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeServices();
    return this.initializationPromise;
  }

  async _initializeServices() {
    try {
      console.group('🚀 Initializing Firebase Services');

      // 1. Initialize Firebase App
      const firebaseConfig = getFirebaseConfig();
      this.app = initializeApp(firebaseConfig);
      console.info('✅ Firebase App initialized');

      // 2. Initialize Authentication with advanced configuration
      this.auth = getAuth(this.app);
      
      // Configure auth persistence based on environment
      const persistenceType = import.meta.env.DEV ? 
        inMemoryPersistence : browserLocalPersistence;
      
      await setPersistence(this.auth, persistenceType);
      console.info(`✅ Authentication configured (${import.meta.env.DEV ? 'memory' : 'local'} persistence)`);

      // 3. Initialize Firestore with offline persistence
      this.db = getFirestore(this.app);
      
      try {
        await enableMultiTabIndexedDbPersistence(this.db);
        console.info('✅ Firestore offline persistence enabled');
      } catch (persistenceError) {
        if (persistenceError.code === 'failed-precondition') {
          console.warn('⚠️ Firestore persistence failed: Multiple tabs open');
        } else if (persistenceError.code === 'unimplemented') {
          console.warn('⚠️ Firestore persistence not supported in this browser');
        } else {
          console.warn('⚠️ Firestore persistence error:', persistenceError);
        }
      }

      // 4. Initialize Storage
      this.storage = getStorage(this.app);
      console.info('✅ Cloud Storage initialized');

      // 5. Initialize optional services
      this.performance = await initializePerformanceMonitoring(this.app);
      this.analytics = await initializeAnalytics(this.app);

      // 6. Emulator configuration for development
      if (import.meta.env.DEV) {
        await this._configureEmulators();
      }

      this.isInitialized = true;
      console.groupEnd();
      console.info('🎉 All Firebase services initialized successfully');

      return this;
    } catch (error) {
      console.groupEnd();
      console.error('💥 Firebase initialization failed:', error);
      throw new FirebaseInitializationError(error.message, 'core');
    }
  }

  async _configureEmulators() {
    try {
      const emulatorHost = 'localhost';
      
      // Auth Emulator
      if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
        connectAuthEmulator(this.auth, `http://${emulatorHost}:9099`, {
          disableWarnings: false
        });
        console.info('🔧 Auth emulator connected');
      }

      // Firestore Emulator
      if (import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
        connectFirestoreEmulator(this.db, emulatorHost, 8080);
        console.info('🔧 Firestore emulator connected');
      }

      // Storage Emulator
      if (import.meta.env.VITE_USE_STORAGE_EMULATOR === 'true') {
        connectStorageEmulator(this.storage, emulatorHost, 9199);
        console.info('🔧 Storage emulator connected');
      }
    } catch (emulatorError) {
      console.warn('⚠️ Emulator configuration failed:', emulatorError);
    }
  }

  // Service health check
  async healthCheck() {
    const services = {
      app: !!this.app,
      auth: !!this.auth,
      db: !!this.db,
      storage: !!this.storage,
      analytics: !!this.analytics,
      performance: !!this.performance
    };

    const healthy = Object.values(services).every(Boolean);
    
    return {
      healthy,
      services,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.MODE
    };
  }

  // Safe service access with error handling
  getAuth() {
    if (!this.auth) {
      throw new FirebaseInitializationError('Auth service not initialized', 'auth');
    }
    return this.auth;
  }

  getFirestore() {
    if (!this.db) {
      throw new FirebaseInitializationError('Firestore service not initialized', 'firestore');
    }
    return this.db;
  }

  getStorage() {
    if (!this.storage) {
      throw new FirebaseInitializationError('Storage service not initialized', 'storage');
    }
    return this.storage;
  }

  getAnalytics() {
    return this.analytics;
  }

  getPerformance() {
    return this.performance;
  }

  // Cleanup method for tests and hot reloading
  async cleanup() {
    if (this.app) {
      // Firebase doesn't have a direct cleanup method, but we can reset state
      this.isInitialized = false;
      this.initializationPromise = null;
      console.info('🧹 Firebase services cleanup completed');
    }
  }
}

// Create and export singleton instance
const firebaseServices = new FirebaseServices();

// Export initialized services with error handling
export const initializeFirebase = () => firebaseServices.initialize();

export const getFirebaseAuth = () => firebaseServices.getAuth();
export const getFirestoreDB = () => firebaseServices.getFirestore();
export const getFirebaseStorage = () => firebaseServices.getStorage();
export const getFirebaseAnalytics = () => firebaseServices.getAnalytics();
export const getFirebasePerformance = () => firebaseServices.getPerformance();
export const getFirebaseHealth = () => firebaseServices.healthCheck();

// Default exports for backward compatibility
export const auth = getFirebaseAuth();
export const db = getFirestoreDB();
export const storage = getFirebaseStorage();

// Enhanced error boundary for Firebase operations
export const withFirebaseErrorHandling = (operation) => {
  return async (...args) => {
    try {
      if (!firebaseServices.isInitialized) {
        await firebaseServices.initialize();
      }
      return await operation(...args);
    } catch (error) {
      console.error(`Firebase operation failed: ${operation.name}`, error);
      
      // Enhanced error classification
      if (error.code?.startsWith('auth/')) {
        throw new Error(`Authentication error: ${error.message}`);
      } else if (error.code?.startsWith('firestore/')) {
        throw new Error(`Database error: ${error.message}`);
      } else if (error.code?.startsWith('storage/')) {
        throw new Error(`Storage error: ${error.message}`);
      } else if (error.name === 'FirebaseInitializationError') {
        throw error;
      } else {
        throw new Error(`Service unavailable: ${error.message}`);
      }
    }
  };
};

// React hook for Firebase initialization status
export const useFirebase = () => {
  const [isInitialized, setIsInitialized] = React.useState(firebaseServices.isInitialized);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await firebaseServices.initialize();
        if (mounted) {
          setIsInitialized(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setIsInitialized(false);
        }
      }
    };

    if (!isInitialized && !error) {
      initialize();
    }

    return () => {
      mounted = false;
    };
  }, [isInitialized, error]);

  return {
    isInitialized,
    error,
    healthCheck: getFirebaseHealth,
    services: {
      auth: getFirebaseAuth,
      db: getFirestoreDB,
      storage: getFirebaseStorage,
      analytics: getFirebaseAnalytics,
      performance: getFirebasePerformance
    }
  };
};

export default firebaseServices;