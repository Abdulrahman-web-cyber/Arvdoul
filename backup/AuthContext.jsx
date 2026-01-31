// src/context/AuthContext.jsx - ULTIMATE FIXED VERSION
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { toast } from "sonner";
import { 
  onAuthStateChanged,
  getCurrentUser,
  signOut,
  updateAuthProfile,
  isFirebaseInitialized
} from '../firebase/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    userProfile: null,
    authReady: false,
    loading: true,
    initializing: true,
    loadingMessage: "Initializing security systems...",
    error: null,
    retryCount: 0,
    maxRetries: 3
  });
  
  const authStateRef = useRef(state);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    authStateRef.current = state;
  }, [state]);

  const initializeAuth = useCallback(async () => {
    if (authStateRef.current.authReady && !authStateRef.current.error) {
      return true;
    }
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      initializing: true,
      loadingMessage: "Initializing security systems..." 
    }));
    
    try {
      console.log("🚀 Starting authentication system...");
      
      const firebaseResult = await initializeFirebaseServices();
      
      if (!firebaseResult.initialized) {
        throw new Error(firebaseResult.error || "Firebase services failed to initialize");
      }
      
      console.log("✅ Firebase initialized:", firebaseResult);
      
      const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
        try {
          if (firebaseUser) {
            console.log("👤 Auth state changed - User logged in:", firebaseUser.uid);
            
            const formattedUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified,
              phoneNumber: firebaseUser.phoneNumber,
              providerId: firebaseUser.providerId,
              isAnonymous: firebaseUser.isAnonymous,
              metadata: {
                creationTime: firebaseUser.metadata?.creationTime,
                lastSignInTime: firebaseUser.metadata?.lastSignInTime
              }
            };
            
            let userProfile = null;
            try {
              userProfile = await getUserProfile(firebaseUser.uid);
              console.log("📊 User profile loaded:", userProfile ? 'yes' : 'no');
            } catch (profileError) {
              console.warn("Could not load user profile:", profileError);
            }
            
            setState(prev => ({
              ...prev,
              user: formattedUser,
              userProfile,
              error: null,
              loading: false,
              loadingMessage: null
            }));
            
          } else {
            console.log("👤 Auth state changed - User logged out");
            
            setState(prev => ({
              ...prev,
              user: null,
              userProfile: null,
              error: null,
              loading: false,
              loadingMessage: null
            }));
          }
        } catch (error) {
          console.error("Auth state change handler error:", error);
          setState(prev => ({
            ...prev,
            error: error.message
          }));
        }
      });
      
      unsubscribeRef.current = unsubscribe;
      
      setState(prev => ({
        ...prev,
        authReady: true,
        initializing: false,
        loading: false,
        loadingMessage: null,
        error: null,
        retryCount: 0
      }));
      
      console.log("🎉 Authentication system ready");
      return true;
      
    } catch (error) {
      console.error("❌ Authentication initialization failed:", error);
      
      setState(prev => ({
        ...prev,
        error: error.message || "Authentication system failed to initialize",
        loading: false,
        initializing: false,
        loadingMessage: null,
        retryCount: prev.retryCount + 1
      }));
      
      if (authStateRef.current.retryCount < authStateRef.current.maxRetries) {
        console.log(`🔄 Retrying auth initialization in 3 seconds (${authStateRef.current.retryCount + 1}/${authStateRef.current.maxRetries})...`);
        
        setTimeout(() => {
          if (!authStateRef.current.authReady) {
            initializeAuth();
          }
        }, 3000);
      }
      
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted) {
        await initializeAuth();
      }
    };
    
    init();
    
    return () => {
      mounted = false;
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [initializeAuth]);

  const handleSignInWithGoogle = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      loading: true,
      loadingMessage: "Connecting to Google..." 
    }));
    
    try {
      if (!authStateRef.current.authReady) {
        throw new Error("Authentication system not ready");
      }
      
      const result = await signInWithGoogle();
      
      toast.success(`Welcome, ${result.user.displayName || 'User'}!`);
      
      return {
        success: true,
        user: result.user,
        isNewUser: result._tokenResponse?.isNewUser || false,
        credential: result.credential
      };
      
    } catch (error) {
      console.error("Google sign in error:", error);
      
      let userMessage = "Google sign in failed";
      
      if (error.code === 'auth/popup-closed-by-user') {
        userMessage = "Sign in cancelled";
      } else if (error.code === 'auth/popup-blocked') {
        userMessage = "Popup blocked. Please allow popups";
      } else if (error.code === 'auth/network-request-failed') {
        userMessage = "Network error. Please check your connection";
      }
      
      setState(prev => ({
        ...prev,
        error: userMessage
      }));
      
      toast.error(userMessage);
      
      return {
        success: false,
        error: userMessage,
        originalError: error
      };
      
    } finally {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        loadingMessage: null 
      }));
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      loading: true,
      loadingMessage: "Signing out..." 
    }));
    
    try {
      await signOut();
      
      toast.success("Signed out successfully");
      return { success: true };
      
    } catch (error) {
      console.error("Sign out error:", error);
      
      setState(prev => ({
        ...prev,
        error: error.message
      }));
      
      toast.error("Failed to sign out");
      return { success: false, error: error.message };
      
    } finally {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        loadingMessage: null 
      }));
    }
  }, []);

  const refreshUserProfile = useCallback(async (userId = null) => {
    const targetUserId = userId || authStateRef.current.user?.uid;
    
    if (!targetUserId) {
      throw new Error("No user ID provided");
    }
    
    try {
      const profile = await getUserProfile(targetUserId);
      
      if (profile) {
        setState(prev => ({
          ...prev,
          userProfile: profile
        }));
      }
      
      return profile;
    } catch (error) {
      console.error("Failed to refresh user profile:", error);
      throw error;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      loading: true,
      loadingMessage: "Refreshing authentication..." 
    }));
    
    try {
      await initializeAuth();
      
      const currentUser = getCurrentUser();
      
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        
        setState(prev => ({
          ...prev,
          user: {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            emailVerified: currentUser.emailVerified
          },
          userProfile: profile
        }));
      }
      
      toast.success("Authentication refreshed");
      return { success: true, user: currentUser };
      
    } catch (error) {
      console.error("Auth refresh failed:", error);
      
      setState(prev => ({
        ...prev,
        error: error.message
      }));
      
      return { success: false, error: error.message };
      
    } finally {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        loadingMessage: null 
      }));
    }
  }, [initializeAuth]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  const contextValue = useMemo(() => ({
    user: state.user,
    userProfile: state.userProfile,
    authReady: state.authReady,
    loading: state.loading,
    initializing: state.initializing,
    loadingMessage: state.loadingMessage,
    error: state.error,
    retryCount: state.retryCount,
    
    isAuthenticated: !!state.user,
    isEmailVerified: !!(state.user && state.user.emailVerified),
    isPhoneVerified: !!(state.user && state.user.phoneNumber),
    isProfileComplete: !!(state.userProfile && state.userProfile.isProfileComplete),
    userId: state.user?.uid,
    userEmail: state.user?.email,
    userName: state.user?.displayName,
    userPhoto: state.user?.photoURL,
    
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    refreshUserProfile,
    refreshAuth,
    clearError,
    updateUserProfile: updateAuthProfile,
    
    reinitializeAuth: initializeAuth,
    
    hasError: !!state.error,
    isReady: state.authReady && !state.loading && !state.initializing,
    isFirebaseReady: isFirebaseInitialized()
    
  }), [state, handleSignInWithGoogle, handleSignOut, refreshUserProfile, refreshAuth, clearError, initializeAuth]);

  if (state.loading && state.initializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 z-50">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {state.loadingMessage || "Initializing Arvdoul..."}
            </h3>
            {state.retryCount > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Attempt {state.retryCount} of {state.maxRetries}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state.error && !state.authReady && state.retryCount >= state.maxRetries) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 z-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Authentication System Error
          </h2>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400 font-medium">
              {state.error}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={initializeAuth}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Retry Initialization
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
