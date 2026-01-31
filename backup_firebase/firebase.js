// src/firebase/firebase.js - ULTIMATE PRODUCTION VERSION v12.7.0+
// 🚀 Pure modular Firebase v9+ - NO compat mode
// ⚡ Zero circular dependencies, Perfect exports

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence,
  onAuthStateChanged as firebaseAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ========== CONFIGURATION ==========
import { FIREBASE_CONFIG, ENVIRONMENT, FEATURES } from './config.js';

// ========== STATE MANAGEMENT ==========
let _app = null;
let _auth = null;
let _db = null;
let _storage = null;
let _isInitialized = false;
let _initializationPromise = null;

// ========== CORE INITIALIZATION ==========
/**
 * Initialize Firebase (modular v9+)
 * @returns {Promise<boolean>} Initialization success
 */
export const initializeFirebase = async () => {
  if (_initializationPromise) {
    return _initializationPromise;
  }

  _initializationPromise = (async () => {
    try {
      console.info('🚀 Firebase v12.7.0+ initialization starting...');

      // Check if already initialized
      const existingApps = getApps();
      if (existingApps.length > 0) {
        _app = getApp();
        console.info('🔥 Using existing Firebase App');
      } else {
        _app = initializeApp(FIREBASE_CONFIG);
        console.info('🔥 Firebase App initialized (modular v9+)');
      }

      // Initialize services
      _auth = getAuth(_app);
      _db = getFirestore(_app);
      _storage = getStorage(_app);

      // Set auth persistence
      await setPersistence(_auth, browserLocalPersistence);

      // Enable Firestore persistence in background
      if (FEATURES.ENABLE_PERSISTENCE) {
        try {
          await enableIndexedDbPersistence(_db);
          console.info('💾 Firestore persistence enabled');
        } catch (persistenceError) {
          if (persistenceError.code === 'failed-precondition') {
            console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only');
          } else if (persistenceError.code === 'unimplemented') {
            console.warn('⚠️ Persistence not available in this environment');
          }
        }
      }

      // Connect emulators in development
      if (FEATURES.ENABLE_EMULATORS && ENVIRONMENT.isDevelopment) {
        try {
          const { connectEmulators } = await import('./emulators.js');
          await connectEmulators();
        } catch (emulatorError) {
          console.warn('⚠️ Emulator connection failed:', emulatorError.message);
        }
      }

      _isInitialized = true;
      console.info('✅ Firebase v12.7.0+ ready');

      return true;

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      _isInitialized = false;
      _initializationPromise = null;
      throw error;
    }
  })();

  return _initializationPromise;
};

// ========== INSTANCE GETTERS ==========
export const getFirebaseApp = () => {
  if (!_isInitialized) throw new Error('Firebase not initialized');
  return _app;
};

export const getFirebaseAuth = () => {
  if (!_isInitialized) throw new Error('Firebase not initialized');
  return _auth;
};

export const getFirebaseFirestore = () => {
  if (!_isInitialized) throw new Error('Firebase not initialized');
  return _db;
};

export const getFirebaseStorage = () => {
  if (!_isInitialized) throw new Error('Firebase not initialized');
  return _storage;
};

export const isFirebaseInitializedCompat = () => _isInitialized;

// ========== AUTH HELPERS ==========
export const onAuthStateChanged = (callback) => {
  if (!_auth) {
    console.warn('⚠️ Auth not ready, delaying listener');
    setTimeout(() => onAuthStateChanged(callback), 100);
    return () => {};
  }
  return firebaseAuthStateChanged(_auth, callback);
};

export const getCurrentUser = () => _auth?.currentUser || null;

export const signOut = async () => {
  if (!_auth) throw new Error('Auth not initialized');
  return firebaseSignOut(_auth);
};

// ========== FIRESTORE HELPERS ==========
export {
  collection as firestoreCollection,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  query as firestoreQuery,
  where as firestoreWhere,
  getDocs as firestoreGetDocs,
  serverTimestamp as firestoreServerTimestamp
};

// Helper to get collection ref
export const getCollection = (collectionName) => {
  if (!_db) throw new Error('Firestore not initialized');
  return collection(_db, collectionName);
};

// Helper to get document ref
export const getDocument = (collectionName, docId) => {
  if (!_db) throw new Error('Firestore not initialized');
  return doc(_db, collectionName, docId);
};

// ========== COMPATIBILITY LAYER (For existing code) ==========
export const getAuthInstance = getFirebaseAuth;
export const getDbInstance = getFirebaseFirestore;
export const getStorageInstance = getFirebaseStorage;
export const initializeFirebaseServices = initializeFirebase;

// ========== DEFAULT EXPORT ==========
export default {
  // Core
  initializeFirebase,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseStorage,
  isFirebaseInitializedCompat,
  
  // Instance getters
  getAuthInstance,
  getDbInstance,
  getStorageInstance,
  initializeFirebaseServices,
  
  // Auth
  onAuthStateChanged,
  getCurrentUser,
  signOut,
  
  // Firestore
  firestoreCollection,
  firestoreDoc,
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreUpdateDoc,
  firestoreQuery,
  firestoreWhere,
  firestoreGetDocs,
  firestoreServerTimestamp,
  getCollection,
  getDocument,
  
  // Config
  FIREBASE_CONFIG,
  ENVIRONMENT,
  FEATURES
};
