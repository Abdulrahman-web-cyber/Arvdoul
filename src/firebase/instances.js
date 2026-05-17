// src/firebase/instances.js - SIMPLE INSTANCE EXPORTS
import { 
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseStorage,
  getFirebaseApp,
  isFirebaseInitialized 
} from "./firebase.js";

// Direct instance exports for components
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

export const app = {
  get: () => getFirebaseApp(),
  isReady: () => isFirebaseInitialized() && !!getFirebaseApp()
};

// Default export
export default {
  auth,
  db,
  storage,
  app,
  isInitialized: isFirebaseInitialized
};