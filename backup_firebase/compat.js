
export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// src/firebase/compat.js - CLEAN COMPATIBILITY LAYER

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// 🔄 For components that still use old patterns

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// ⚡ No direct Firebase imports, uses service layer

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
import { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getFirebaseAuth,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getFirebaseFirestore,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getFirebaseStorage,
  isFirebaseInitializedCompat,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  initializeFirebase,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  onAuthStateChanged as firebaseAuthStateChanged,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getCurrentUser as firebaseGetCurrentUser,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  signOut as firebaseSignOut,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getCollection,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getDocument,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreGetDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreSetDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreUpdateDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreQuery,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreWhere,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreGetDocs,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  firestoreServerTimestamp

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
} from './firebase.js';

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Import service functions

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
import { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  signInWithGoogle as googleSignIn,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  updateAuthProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  verifyPhoneOTP as verifyPhoneOTPService,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  createRecaptchaVerifier as createRecaptchaService,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  sendPhoneVerificationCode as sendPhoneCodeService

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
} from '../services/authService.js';

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
import { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getUserProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  createUserProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkUsernameAvailability,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkPhoneNumberAvailability

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
} from '../services/userService.js';

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// ========== COMPATIBILITY EXPORTS ==========

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Core instance getters

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getAuthInstance = getFirebaseAuth;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getDbInstance = getFirebaseFirestore;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getStorageInstance = getFirebaseStorage;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const initializeFirebaseServices = initializeFirebase;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Instance objects for components

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const auth = {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  get: () => getFirebaseAuth(),
  isReady: () => isFirebaseInitializedCompat() && !!getFirebaseAuth()

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const db = {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  get: () => getFirebaseFirestore(),
  isReady: () => isFirebaseInitializedCompat() && !!getFirebaseFirestore()

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const storage = {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  get: () => getFirebaseStorage(),
  isReady: () => isFirebaseInitializedCompat() && !!getFirebaseStorage()

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Firestore helpers with proper error handling

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const collection = (collectionName) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return getCollection(collectionName);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to access collection: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const doc = (collectionName, docId) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return getDocument(collectionName, docId);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to access document: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getDoc = async (documentRef) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return await firestoreGetDoc(documentRef);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to get document: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const setDoc = async (documentRef, data, options = {}) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return await firestoreSetDoc(documentRef, data, options);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to set document: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const updateDoc = async (documentRef, data) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return await firestoreUpdateDoc(documentRef, data);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to update document: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getDocs = async (queryRef) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return await firestoreGetDocs(queryRef);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Failed to get documents: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const query = (collectionRef, ...constraints) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  return firestoreQuery(collectionRef, ...constraints);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const where = firestoreWhere;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Auth state management

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const onAuthStateChanged = (callback) => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return firebaseAuthStateChanged(callback);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    console.error('Auth state listener error:', error);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return () => {};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const getCurrentUser = () => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return firebaseGetCurrentUser();

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return null;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const signOut = async () => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return await firebaseSignOut();

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    throw new Error(`Sign out failed: ${error.message}`);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Service re-exports

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const signInWithGoogle = googleSignIn;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getUserProfile, 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  createUserProfile, 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkUsernameAvailability,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkPhoneNumberAvailability,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  updateAuthProfile 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Phone verification

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const verifyPhoneOTP = verifyPhoneOTPService;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const createRecaptchaVerifier = createRecaptchaService;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const sendPhoneVerificationCode = sendPhoneCodeService;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Utilities

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const serverTimestamp = () => firestoreServerTimestamp();

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export const checkFirebaseHealth = async () => {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  try {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    const auth = getFirebaseAuth();

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    const user = auth?.currentUser;

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    if (user) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      await user.getIdToken(true);

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      return { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
        status: 'healthy', 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
        authenticated: true,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
        timestamp: new Date().toISOString() 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      };

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      status: 'healthy', 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      authenticated: false,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      timestamp: new Date().toISOString() 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    };

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  } catch (error) {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    return { 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      status: 'unhealthy', 

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      error: error.message,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
      timestamp: new Date().toISOString()

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
    };

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  }

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();


export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
// Default export

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
export default {

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Core

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getAuthInstance,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getDbInstance,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getStorageInstance,
  isFirebaseInitializedCompat: () => isFirebaseInitializedCompat(),

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  initializeFirebaseServices,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Instances

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  auth,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  db,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  storage,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Firestore

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  collection,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  doc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  setDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  updateDoc,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getDocs,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  query,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  where,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Auth

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  onAuthStateChanged,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getCurrentUser,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  signOut,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Services

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  signInWithGoogle,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  getUserProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  createUserProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkUsernameAvailability,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkPhoneNumberAvailability,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  updateAuthProfile,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  verifyPhoneOTP,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Phone verification

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  createRecaptchaVerifier,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  sendPhoneVerificationCode,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  // Utilities

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  serverTimestamp,

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
  checkFirebaseHealth

export const isFirebaseInitializedCompat = () => isFirebaseInitialized();
};
