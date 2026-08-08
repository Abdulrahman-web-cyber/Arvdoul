// src/firebase/emulators.js
// 🛠️ Development-only emulator configuration
// 📍 Zero impact on production

export const connectEmulators = async () => {
  if (typeof window === 'undefined') return;
  
  const { ENVIRONMENT } = await import('./config.js');
  
  if (!ENVIRONMENT.isDevelopment) {
    console.info('🚫 Emulators disabled in production');
    return;
  }
  
  try {
    const { getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage } = await import('./core.js');
    
    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();
    
    // Emulator configuration
    const EMULATOR_CONFIG = {
      auth: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://localhost:9099',
      firestore: import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_URL || 'localhost:8080',
      storage: import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_URL || 'localhost:9199'
    };
    
    // Connect auth emulator
    if (EMULATOR_CONFIG.auth) {
      auth.useEmulator(EMULATOR_CONFIG.auth);
      console.info(`🔌 Auth emulator: ${EMULATOR_CONFIG.auth}`);
    }
    
    // Connect firestore emulator
    if (EMULATOR_CONFIG.firestore) {
      const [host, port] = EMULATOR_CONFIG.firestore.split(':');
      db.useEmulator(host, parseInt(port));
      console.info(`🔌 Firestore emulator: ${host}:${port}`);
    }
    
    // Connect storage emulator
    if (EMULATOR_CONFIG.storage) {
      const [host, port] = EMULATOR_CONFIG.storage.split(':');
      storage.useEmulator(host, parseInt(port));
      console.info(`🔌 Storage emulator: ${host}:${port}`);
    }
    
    console.info('🎮 Firebase emulators connected');
    
  } catch (error) {
    console.warn('⚠️ Could not connect to emulators:', error.message);
  }
};

export default { connectEmulators };