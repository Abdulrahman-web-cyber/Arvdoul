// src/firebase/firebase.js - ULTIMATE ARVDOUL INFRASTRUCTURE
// 🚀 Single source of truth for Firebase v12.7.0
// 🔒 Zero circular dependencies, Pure infrastructure

import { initializeApp } from "firebase/app";
import { 
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  getRedirectResult as firebaseGetRedirectResult
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ========== CONFIGURATION ==========
const firebaseConfig = {
  apiKey: "AIzaSyDm9ks21qUT7vCVh6USGVtHJblBzEEPjxk",
  authDomain: "arvdoul-8057b.firebaseapp.com",
  databaseURL: "https://arvdoul-8057b-default-rtdb.firebaseio.com",
  projectId: "arvdoul-8057b",
  storageBucket: "arvdoul-8057b.firebasestorage.app",
  messagingSenderId: "892956185588",
  appId: "1:892956185588:web:5ca931799f5da7846b9fa1",
  measurementId: "G-MQL0JXL584"
};

// ========== SINGLETON STATE ==========
let appInstance = null;
let authInstance = null;
let firestoreInstance = null;
let storageInstance = null;
let isInitialized = false;
let initializationPromise = null;
let authListeners = new Set();

// ========== CORE INITIALIZATION ==========
export const initializeFirebase = async (options = {}) => {
  if (isInitialized) {
    console.debug("🔥 Firebase already initialized");
    return getServiceInstances();
  }

  if (initializationPromise) {
    console.debug("⏳ Firebase initialization in progress");
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.time("Firebase Initialization");
      
      // 1. Initialize Firebase App
      appInstance = initializeApp(firebaseConfig);
      
      // 2. Initialize services
      authInstance = getAuth(appInstance);
      firestoreInstance = getFirestore(appInstance);
      storageInstance = getStorage(appInstance);
      
      // 3. Set persistence
      await setPersistence(authInstance, 
        options.useSessionPersistence ? browserSessionPersistence : browserLocalPersistence
      );
      
      isInitialized = true;
      
      console.timeEnd("Firebase Initialization");
      console.info("✅ Firebase infrastructure initialized");
      
      return getServiceInstances();
      
    } catch (error) {
      console.error("❌ Firebase initialization failed:", error);
      resetState();
      throw new Error(`Firebase initialization failed: ${error.message}`);
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

// ========== SERVICE ACCESSORS ==========
export const getAuthInstance = () => {
  assertInitialized();
  return authInstance;
};

export const getFirestoreInstance = () => {
  assertInitialized();
  return firestoreInstance;
};

export const getStorageInstance = () => {
  assertInitialized();
  return storageInstance;
};

export const getAppInstance = () => {
  assertInitialized();
  return appInstance;
};

// ========== AUTH INFRASTRUCTURE WRAPPERS ==========
export const onAuthStateChanged = (callback, errorCallback, completedCallback) => {
  const auth = getAuthInstance();
  
  const unsubscribe = firebaseOnAuthStateChanged(
    auth, 
    callback, 
    errorCallback, 
    completedCallback
  );
  
  authListeners.add(unsubscribe);
  
  return () => {
    if (authListeners.has(unsubscribe)) {
      unsubscribe();
      authListeners.delete(unsubscribe);
    }
  };
};

export const signOut = async () => {
  const auth = getAuthInstance();
  return await firebaseSignOut(auth);
};

export const getCurrentUser = () => {
  const auth = getAuthInstance();
  return auth.currentUser;
};

export const getRedirectResult = () => {
  const auth = getAuthInstance();
  return firebaseGetRedirectResult(auth);
};

// ========== STATUS & HEALTH ==========
export const isFirebaseInitialized = () => isInitialized;

export const getFirebaseStatus = () => ({
  isInitialized,
  hasAuth: !!authInstance,
  hasFirestore: !!firestoreInstance,
  hasStorage: !!storageInstance,
  currentUser: !!authInstance?.currentUser,
  timestamp: Date.now()
});

// ========== CLEANUP ==========
export const cleanupFirebase = () => {
  if (appInstance) {
    console.info("🧹 Cleaning up Firebase instances");
    
    authListeners.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("Failed to cleanup auth listener:", error);
      }
    });
    authListeners.clear();
    
    resetState();
  }
};

// ========== INTERNAL HELPERS ==========
const assertInitialized = () => {
  if (!isInitialized) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  }
};

const getServiceInstances = () => ({
  app: appInstance,
  auth: authInstance,
  db: firestoreInstance,
  storage: storageInstance
});

const resetState = () => {
  appInstance = null;
  authInstance = null;
  firestoreInstance = null;
  storageInstance = null;
  isInitialized = false;
  initializationPromise = null;
  authListeners.clear();
};

// ========== DEFAULT EXPORT ==========
export default {
  // Core
  initialize: initializeFirebase,
  cleanup: cleanupFirebase,
  
  // Service Accessors
  getAuth: getAuthInstance,
  getFirestore: getFirestoreInstance,
  getStorage: getStorageInstance,
  getApp: getAppInstance,
  
  // Auth Operations
  onAuthStateChanged,
  signOut,
  getCurrentUser,
  getRedirectResult,
  
  // Status
  isInitialized: isFirebaseInitialized,
  getStatus: getFirebaseStatus
};