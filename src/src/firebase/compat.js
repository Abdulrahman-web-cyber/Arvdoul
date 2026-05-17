// src/firebase/compat.js - ULTIMATE COMPATIBILITY LAYER
// 🔄 Perfect backward compatibility for all components
// ⚡ Uses modular v9+ services, NO direct Firebase imports

import { 
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseStorage,
  isFirebaseInitialized,
  initializeFirebase,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getCurrentUser as firebaseGetCurrentUser,
  signOut as firebaseSignOut,
  getCollection,
  getDocument,
  firestoreGetDoc,
  firestoreSetDoc,
  firestoreUpdateDoc,
  firestoreQuery,
  firestoreWhere,
  firestoreGetDocs,
  firestoreServerTimestamp
} from './firebase.js';

// Import service functions
import { 
  signInWithGoogle as googleSignIn,
  updateAuthProfile,
  verifyPhoneOTP as verifyPhoneOTPService,
  createRecaptchaVerifier as createRecaptchaService,
  sendPhoneVerificationCode as sendPhoneCodeService
} from '../services/authService.js';

import { 
  getUserProfile,
  createUserProfile,
  checkUsernameAvailability,
  checkPhoneNumberAvailability
} from '../services/userService.js';

// ========== COMPATIBILITY EXPORTS ==========

// Core instance getters
export const getAuthInstance = getFirebaseAuth;
export const getDbInstance = getFirebaseFirestore;
export const getStorageInstance = getFirebaseStorage;
export const initializeFirebaseServices = initializeFirebase;

// Instance objects for components
export const auth = {
  get: () => getFirebaseAuth(),
  isReady: () => isFirebaseInitialized() && !!getFirebaseAuth()
};

export const db = {
  get: () => getFirebaseFirestore(),
  isReady: () => isFirebaseInitialized() && !!getFirebaseFirestore()
};

export const storage = {
  get: () => getFirebaseStorage(),
  isReady: () => isFirebaseInitialized() && !!getFirebaseStorage()
};

// Firestore helpers (with proper error handling)
export const collection = (collectionName) => {
  try {
    return getCollection(collectionName);
  } catch (error) {
    console.error('Collection access error:', error);
    throw new Error(`Failed to access collection '${collectionName}': ${error.message}`);
  }
};

export const doc = (collectionName, docId) => {
  try {
    return getDocument(collectionName, docId);
  } catch (error) {
    console.error('Document access error:', error);
    throw new Error(`Failed to access document '${docId}' in '${collectionName}': ${error.message}`);
  }
};

export const getDoc = async (documentRef) => {
  try {
    return await firestoreGetDoc(documentRef);
  } catch (error) {
    console.error('Get document error:', error);
    throw new Error(`Failed to get document: ${error.message}`);
  }
};

export const setDoc = async (documentRef, data, options = {}) => {
  try {
    return await firestoreSetDoc(documentRef, data, options);
  } catch (error) {
    console.error('Set document error:', error);
    throw new Error(`Failed to set document: ${error.message}`);
  }
};

export const updateDoc = async (documentRef, data) => {
  try {
    return await firestoreUpdateDoc(documentRef, data);
  } catch (error) {
    console.error('Update document error:', error);
    throw new Error(`Failed to update document: ${error.message}`);
  }
};

export const getDocs = async (queryRef) => {
  try {
    return await firestoreGetDocs(queryRef);
  } catch (error) {
    console.error('Get documents error:', error);
    throw new Error(`Failed to get documents: ${error.message}`);
  }
};

export const query = (collectionRef, ...constraints) => {
  try {
    let q = collectionRef;
    constraints.forEach(constraint => {
      if (constraint.type === 'where') {
        q = firestoreQuery(q, firestoreWhere(constraint.fieldPath, constraint.opStr, constraint.value));
      }
    });
    return q;
  } catch (error) {
    console.error('Query creation error:', error);
    throw new Error(`Failed to create query: ${error.message}`);
  }
};

export const where = (fieldPath, opStr, value) => ({
  type: 'where',
  fieldPath,
  opStr,
  value
});

// Auth state management
export const onAuthStateChanged = (callback) => {
  try {
    return firebaseOnAuthStateChanged(callback);
  } catch (error) {
    console.error('Auth state listener error:', error);
    // Return a cleanup function that does nothing
    return () => {};
  }
};

export const getCurrentUser = () => {
  try {
    return firebaseGetCurrentUser();
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

export const signOut = async () => {
  try {
    return await firebaseSignOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw new Error(`Sign out failed: ${error.message}`);
  }
};

// Service re-exports
export const signInWithGoogle = googleSignIn;
export { 
  getUserProfile, 
  createUserProfile, 
  checkUsernameAvailability,
  checkPhoneNumberAvailability,
  updateAuthProfile 
};

// Phone verification
export const verifyPhoneOTP = verifyPhoneOTPService;
export const createRecaptchaVerifier = createRecaptchaService;
export const sendPhoneVerificationCode = sendPhoneCodeService;

// Utilities
export const serverTimestamp = () => firestoreServerTimestamp();

export const checkFirebaseHealth = async () => {
  try {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    
    if (user) {
      await user.getIdToken(true);
      return { 
        status: 'healthy', 
        authenticated: true,
        timestamp: new Date().toISOString() 
      };
    }
    
    return { 
      status: 'healthy', 
      authenticated: false,
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// ========== DEFAULT EXPORT ==========
export default {
  // Core
  getAuthInstance,
  getDbInstance,
  getStorageInstance,
  isFirebaseInitialized: () => isFirebaseInitialized(),
  initializeFirebaseServices,
  
  // Instances
  auth,
  db,
  storage,
  
  // Firestore
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  
  // Auth
  onAuthStateChanged,
  getCurrentUser,
  signOut,
  
  // Services
  signInWithGoogle,
  getUserProfile,
  createUserProfile,
  checkUsernameAvailability,
  checkPhoneNumberAvailability,
  updateAuthProfile,
  verifyPhoneOTP,
  
  // Phone verification
  createRecaptchaVerifier,
  sendPhoneVerificationCode,
  
  // Utilities
  serverTimestamp,
  checkFirebaseHealth
};