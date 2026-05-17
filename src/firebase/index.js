// src/firebase/index.js - CLEAN MAIN EXPORT
// 📦 Single import point for all Firebase services
// ⚡ Zero circular dependencies

// Export everything from the main firebase module
export * from './firebase.js';

// Export compatibility layer for components that need it
export * from './compat.js';

// Auto-initialize in browser (non-blocking, background)
if (typeof window !== 'undefined') {
  const init = async () => {
    try {
      // Wait for DOM to be ready
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            document.addEventListener('DOMContentLoaded', resolve);
          }
        });
      }
      
      // Import dynamically to avoid circular dependencies
      const { initializeFirebase, isFirebaseInitialized } = await import('./firebase.js');
      
      // Only auto-initialize if not already initialized
      if (!isFirebaseInitialized()) {
        console.log('🔧 Auto-initializing Firebase in background...');
        
        // Don't await - let it run in background
        initializeFirebase().catch(error => {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Background Firebase init warning:', error.message);
          }
        });
      }
    } catch (error) {
      // Silent fail - components will handle initialization when needed
      if (import.meta.env.DEV) {
        console.warn('⚠️ Firebase auto-init failed:', error.message);
      }
    }
  };
  
  // Start after a small delay to let critical rendering happen
  setTimeout(init, 500);
}