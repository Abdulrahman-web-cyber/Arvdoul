// src/context/AuthContext.jsx - ULTIMATE PRODUCTION V33 - NO BLINK, STABLE LOADING
// 🎯 SINGLE SOURCE OF TRUTH (ZUSTAND) • REALTIME PROFILE SYNC • MULTI-TAB COORDINATION
// 🔧 FIXED: Removed `user` dependency from auth listener – prevents re-subscription on every profile change
// 🔧 ADDED: `initialProfileLoaded` flag to avoid loading flicker after first load
// ✅ NO BLINKING • SMOOTH AUTH TRANSITIONS

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";

const AuthContext = createContext(null);

// ==================== ENHANCED STORAGE MANAGER ====================
const AuthStorageManager = {
  clearAll() {
    const sessionItems = [
      'email_auth_data',
      'google_auth_data',
      'phone_auth_data',
      'pending_profile_creation',
      'email_not_verified_user',
      'pending_redirect',
      'last_auth_path',
      'auth_flow_state',
      'phone_verification_data'
    ];
    const localItems = [
      'auth_verification_attempts',
      'last_auth_method',
      'phone_verification_attempts'
    ];
    sessionItems.forEach(key => sessionStorage.removeItem(key));
    localItems.forEach(key => localStorage.removeItem(key));
    console.log('🧹 Auth storage cleared completely');
  },
  
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data: value,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Storage set failed:', error);
    }
  },
  
  get(key) {
    try {
      const item = sessionStorage.getItem(key);
      if (!item) return null;
      const parsed = JSON.parse(item);
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        this.remove(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  },
  
  remove(key) {
    sessionStorage.removeItem(key);
  },
  
  setVerified(userId, method = 'email') {
    localStorage.setItem(`verified_${userId}`, JSON.stringify({
      verified: true,
      method,
      timestamp: Date.now()
    }));
  },
  
  isVerified(userId) {
    const item = localStorage.getItem(`verified_${userId}`);
    if (!item) return false;
    try {
      const data = JSON.parse(item);
      return data.verified === true;
    } catch {
      return false;
    }
  },
  
  setFlowState(state) {
    this.set('auth_flow_state', state);
  },
  
  getFlowState() {
    return this.get('auth_flow_state') || {};
  },
  
  clearFlowState() {
    this.remove('auth_flow_state');
  }
};

// ==================== TOAST DEBOUNCER ====================
let lastToastTime = 0;
const debouncedToast = (message, type = 'error') => {
  const now = Date.now();
  if (now - lastToastTime > 3000) {
    lastToastTime = now;
    if (type === 'error') toast.error(message);
    else if (type === 'success') toast.success(message);
    else if (type === 'info') toast.info(message);
    else toast(message);
  }
};

// ==================== ERROR NORMALIZATION ====================
const normalizeFirebaseError = (error) => {
  const code = error?.code || 'unknown';
  const commonMap = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
    'auth/invalid-email': 'Invalid email address format.',
    'auth/weak-password': 'Password is too weak. Use at least 8 characters with letters and numbers.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/expired-action-code': 'Reset link has expired. Request a new one.',
    'auth/invalid-action-code': 'Invalid reset link.',
    'auth/user-mismatch': 'This reset link is for a different account.',
    'auth/argument-error': 'Invalid reset link format.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in cancelled. Please try again.',
    'auth/popup-blocked': 'Pop-up blocked by browser. Please allow pop-ups.',
    'auth/unauthorized-domain': 'This domain is not authorized for OAuth operations.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email but different sign-in method.',
    'auth/credential-already-in-use': 'This credential is already associated with a different user account.',
    'auth/invalid-phone-number': 'Invalid phone number format. Use international format: +1234567890',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again tomorrow.',
    'auth/captcha-check-failed': 'Security check failed. Please try again.',
    'auth/invalid-verification-code': 'Invalid verification code. Please check and try again.',
    'auth/invalid-verification-id': 'Session expired. Please request a new code.',
    'auth/code-expired': 'Verification code expired. Please request a new one.',
    'auth/requires-recent-login': 'Session expired. Please sign in again.',
    'auth/app-not-authorized': 'Phone authentication not enabled. Contact support.',
    'auth/operation-not-allowed': 'SMS not enabled for this region. Enable phone auth in Firebase console.',
    'auth/recaptcha-failed': 'reCAPTCHA setup failed. Check your domain configuration.'
  };
  return commonMap[code] || error?.message || 'Authentication failed. Please try again.';
};

// ==================== AUTH STATE MACHINE ====================
const AuthState = {
  BOOTING: 'booting',
  AUTHENTICATED: 'authenticated',
  PROFILE_INCOMPLETE: 'profile_incomplete',
  BANNED: 'banned',
  SUSPENDED: 'suspended',
  UNAUTHENTICATED: 'unauthenticated',
  ERROR: 'error',
};

// ==================== SYNC HELPER ====================
const syncUserWithAppStore = (user, userProfile, setCurrentUser) => {
  if (!user) {
    setCurrentUser(null);
    return null;
  }
  
  const isProfileComplete = !!(userProfile && userProfile.isProfileComplete);
  
  const userData = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'User',
    username: userProfile?.username || user.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${user.uid?.slice(0, 8)}`,
    photoURL: userProfile?.photoURL || user.photoURL || "/assets/default-profile.png",
    phoneNumber: userProfile?.phoneNumber || user.phoneNumber,
    authProvider: userProfile?.authProvider || user.providerData?.[0]?.providerId || 'email',
    isProfileComplete,
    accountStatus: userProfile?.accountStatus || 'active',
    coins: userProfile?.coins || 0,
    level: userProfile?.level || 1,
    postCount: userProfile?.postCount || 0,
    videoCount: userProfile?.videoCount || 0,
    savedCount: userProfile?.savedCount || 0,
    followerCount: userProfile?.followerCount || 0,
    followingCount: userProfile?.followingCount || 0,
    isOnline: true,
    lastActive: new Date().toISOString(),
    createdAt: user.metadata?.creationTime || new Date().toISOString(),
    isNewUser: user.isNewUser || false,
    requiresProfileCompletion: !isProfileComplete
  };
  
  setCurrentUser(userData);
  return userData;
};

// ==================== OPERATION DEDUPLICATOR ====================
const pendingOperations = new Map();
const CLEANUP_INTERVAL = 60000;
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of pendingOperations.entries()) {
      if (now - timestamp > CLEANUP_INTERVAL) pendingOperations.delete(key);
    }
  }, CLEANUP_INTERVAL);
}

const runOnce = async (key, fn) => {
  if (pendingOperations.has(key)) return { alreadyRunning: true };
  pendingOperations.set(key, Date.now());
  try {
    return await fn();
  } finally {
    pendingOperations.delete(key);
  }
};

// ==================== PERFECT AUTH PROVIDER ====================
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);
  
  const { setCurrentUser, clearUserData } = useAppStore();
  const setCurrentUserRef = useRef(setCurrentUser);
  const clearUserDataRef = useRef(clearUserData);
  
  useEffect(() => {
    setCurrentUserRef.current = setCurrentUser;
    clearUserDataRef.current = clearUserData;
  }, [setCurrentUser, clearUserData]);
  
  // React state for UI
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authService, setAuthService] = useState(null);
  const [userService, setUserService] = useState(null);
  const [authState, setAuthState] = useState(AuthState.BOOTING);
  
  const [isSignupInProgress, setIsSignupInProgress] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    firebaseReady: false,
    servicesLoaded: false,
    authListenerActive: false
  });

  const navigationLock = useRef(false);
  const listenerSetUp = useRef(false);
  const isLoggingOutRef = useRef(false);
  const prevProfileRef = useRef(null);
  const unsubscribeProfileRef = useRef(null);
  const unsubscribeAuthRef = useRef(null);
  const unsubscribeIdTokenRef = useRef(null);
  const broadcastRef = useRef(null);
  const storageEventHandlerRef = useRef(null);
  
  // Guard to prevent loading flicker after initial profile load
  const initialProfileLoaded = useRef(false);
  
  // ========== MULTI‑TAB BROADCAST ==========
  useEffect(() => {
    let channel;
    let storageHandler;
    
    const handleMessage = (event) => {
      const data = event.data || event.detail;
      if (data?.type === 'signOut') {
        if (authService?.signOut) authService.signOut();
      }
    };
    
    if (typeof window !== 'undefined') {
      if (window.BroadcastChannel) {
        channel = new BroadcastChannel('arvdoul_auth');
        channel.addEventListener('message', handleMessage);
        broadcastRef.current = channel;
      } else {
        storageHandler = (e) => {
          if (e.key === 'arvdoul_auth_broadcast' && e.newValue) {
            try {
              const data = JSON.parse(e.newValue);
              handleMessage({ data });
            } catch (err) {}
          }
        };
        window.addEventListener('storage', storageHandler);
        storageEventHandlerRef.current = storageHandler;
        broadcastRef.current = {
          postMessage: (data) => {
            localStorage.setItem('arvdoul_auth_broadcast', JSON.stringify({ ...data, _timestamp: Date.now() }));
            setTimeout(() => localStorage.removeItem('arvdoul_auth_broadcast'), 100);
          },
          close: () => {}
        };
      }
    }
    
    return () => {
      if (channel) {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      }
      if (storageHandler) {
        window.removeEventListener('storage', storageHandler);
      }
      broadcastRef.current = null;
    };
  }, [authService]);

  // ========== CLEANUP ==========
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (unsubscribeAuthRef.current) unsubscribeAuthRef.current();
      if (unsubscribeIdTokenRef.current) unsubscribeIdTokenRef.current();
      if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
      console.log('🧹 AuthContext cleanup completed');
    };
  }, []);

  // ========== SERVICE INITIALIZATION ==========
  useEffect(() => {
    const abortController = new AbortController();
    let mounted = true;
    
    const initServices = async () => {
      if (!mounted || abortController.signal.aborted) return;
      try {
        console.log('🚀 Initializing auth services...');
        const authModule = await import('../services/authService.js');
        const userModule = await import('../services/userService.js');
        if (!mounted || abortController.signal.aborted) return;
        setAuthService(authModule.default ? authModule.default() : authModule.getAuthService());
        setUserService(userModule.default ? userModule.default() : userModule.getUserService());
        setSecurityChecks(prev => ({ ...prev, servicesLoaded: true }));
        console.log('✅ Auth services initialized');
      } catch (error) {
        if (!mounted || abortController.signal.aborted) return;
        console.error('❌ Service initialization failed:', error);
        setError('Failed to initialize authentication services');
        setAuthError(error.message);
        debouncedToast('Authentication service unavailable. Please refresh.', 'error');
      }
    };
    
    initServices();
    
    return () => {
      mounted = false;
      abortController.abort();
    };
  }, []);

  // ========== REALTIME PROFILE LISTENER (SAFE, NO UNNECESSARY LOADING TOGGLES) ==========
  const setupRealtimeProfile = useCallback(async (uid, firebaseUser) => {
    if (!userService || !uid || !firebaseUser) return;
    
    // Clean up previous listener
    if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
    
    try {
      // Ensure Firestore is initialized
      await userService.initialize();
      const { doc, onSnapshot } = await import('firebase/firestore');
      const firestore = userService.firestore;
      if (!firestore) throw new Error('Firestore not ready');
      
      const userDocRef = doc(firestore, 'users', uid);
      let isFirstSnapshot = true;
      let fallbackTimer = null;
      
      // Fallback timer: if no snapshot after 8 seconds, mark as incomplete but don't hang
      fallbackTimer = setTimeout(() => {
        if (isFirstSnapshot && isMounted.current && !initialProfileLoaded.current) {
          console.warn('Profile snapshot timeout – marking as incomplete');
          setUserProfile(null);
          setAuthState(AuthState.PROFILE_INCOMPLETE);
          setLoading(false);
          initialProfileLoaded.current = true;
          isFirstSnapshot = false;
        }
      }, 8000);
      
      const unsubscribe = onSnapshot(userDocRef, 
        (snap) => {
          if (!isMounted.current) return;
          
          if (fallbackTimer) clearTimeout(fallbackTimer);
          
          if (snap.exists()) {
            const profile = { id: snap.id, ...snap.data() };
            
            // Only update if changed (simple timestamp check)
            if (prevProfileRef.current?.updatedAt !== profile.updatedAt) {
              prevProfileRef.current = profile;
              setUserProfile(profile);
              syncUserWithAppStore(firebaseUser, profile, setCurrentUserRef.current);
            }
            
            // Enforce account status
            const status = profile.accountStatus;
            if (status === 'banned') {
              setAuthState(AuthState.BANNED);
              debouncedToast('Your account has been banned. Please contact support.', 'error');
              if (authService?.signOut) authService.signOut();
              return;
            } else if (status === 'suspended') {
              setAuthState(AuthState.SUSPENDED);
              debouncedToast('Your account is temporarily suspended.', 'error');
              return;
            }
            
            // Profile completeness
            const isComplete = profile.isProfileComplete === true ||
              !!(profile.displayName?.trim() && profile.bio?.trim() && profile.photoURL);
            
            if (status === 'active') {
              setAuthState(isComplete ? AuthState.AUTHENTICATED : AuthState.PROFILE_INCOMPLETE);
            }
          } else {
            setUserProfile(null);
            setAuthState(AuthState.PROFILE_INCOMPLETE);
          }
          
          // Resolve loading on first snapshot, but only once
          if (isFirstSnapshot && !initialProfileLoaded.current) {
            isFirstSnapshot = false;
            initialProfileLoaded.current = true;
            setLoading(false);
          }
        },
        (err) => {
          console.warn('Profile snapshot error:', err);
          if (fallbackTimer) clearTimeout(fallbackTimer);
          if (isFirstSnapshot && isMounted.current && !initialProfileLoaded.current) {
            setUserProfile(null);
            setAuthState(AuthState.PROFILE_INCOMPLETE);
            setLoading(false);
            initialProfileLoaded.current = true;
            isFirstSnapshot = false;
          }
        }
      );
      
      unsubscribeProfileRef.current = unsubscribe;
    } catch (err) {
      console.error('Failed to setup realtime profile:', err);
      if (!initialProfileLoaded.current) {
        setUserProfile(null);
        setAuthState(AuthState.PROFILE_INCOMPLETE);
        setLoading(false);
        initialProfileLoaded.current = true;
      }
    }
  }, [userService, authService]);

  // ========== AUTH STATE LISTENER (NO `user` DEPENDENCY – PREVENTS BLINK) ==========
  useEffect(() => {
    if (!authService || listenerSetUp.current || !isMounted.current) return;
    
    const abortController = new AbortController();
    
    const setupAuthListener = async () => {
      try {
        await authService.initialize();
        if (!isMounted.current || abortController.signal.aborted) return;
        
        const firebaseAuth = await import('firebase/auth');
        const { onAuthStateChanged, onIdTokenChanged } = firebaseAuth;
        const auth = authService.auth;
        if (!auth) throw new Error('Failed to get Firebase auth instance');
        
        unsubscribeAuthRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted.current) return;
          
          console.log('👤 Auth state changed:', firebaseUser ? `User logged in (${firebaseUser.uid})` : 'No user');
          
          // CRITICAL: Only set loading true if profile not loaded yet
          if (!initialProfileLoaded.current) {
            setLoading(true);
          }
          setAuthState(AuthState.PROFILE_INCOMPLETE);
          navigationLock.current = true;
          
          if (firebaseUser) {
            isLoggingOutRef.current = false;
            
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              phoneNumber: firebaseUser.phoneNumber,
              authProvider: firebaseUser.providerData[0]?.providerId || 'unknown',
              metadata: {
                creationTime: firebaseUser.metadata.creationTime,
                lastSignInTime: firebaseUser.metadata.lastSignInTime
              },
              isNewUser: false
            };
            
            setUser(userData);
            
            // Setup realtime profile (will call setLoading(false) eventually)
            await setupRealtimeProfile(firebaseUser.uid, firebaseUser);
            
          } else {
            // Logout – reset everything
            isLoggingOutRef.current = true;
            initialProfileLoaded.current = false;
            setUser(null);
            setUserProfile(null);
            prevProfileRef.current = null;
            if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
            clearUserDataRef.current();
            AuthStorageManager.clearAll();
            setAuthState(AuthState.UNAUTHENTICATED);
            setLoading(false);
            console.log('👤 User logged out');
          }
          navigationLock.current = false;
        });
        
        // Token refresh listener
        unsubscribeIdTokenRef.current = onIdTokenChanged(auth, async (firebaseUser) => {
          if (!isMounted.current) return;
          if (!firebaseUser && user) {
            try {
              const { getAuth } = firebaseAuth;
              const currentAuth = getAuth();
              await currentAuth.currentUser?.getIdToken(true);
              console.log('🔄 Token refreshed successfully');
              return;
            } catch (refreshError) {
              console.warn('Token refresh failed, signing out', refreshError);
            }
            
            console.log('🔄 Token expired or user disabled, signing out');
            isLoggingOutRef.current = true;
            initialProfileLoaded.current = false;
            setUser(null);
            setUserProfile(null);
            if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
            clearUserDataRef.current();
            AuthStorageManager.clearAll();
            debouncedToast('Session expired. Please sign in again.', 'info');
            setAuthState(AuthState.UNAUTHENTICATED);
            navigate('/login', { replace: true });
          }
        });
        
        if (!isMounted.current || abortController.signal.aborted) {
          if (unsubscribeAuthRef.current) unsubscribeAuthRef.current();
          if (unsubscribeIdTokenRef.current) unsubscribeIdTokenRef.current();
          return;
        }
        
        setSecurityChecks(prev => ({ ...prev, firebaseReady: true, authListenerActive: true }));
        setAuthInitialized(true);
        listenerSetUp.current = true;
        console.log('✅ Auth listener setup complete');
        
      } catch (error) {
        if (!isMounted.current || abortController.signal.aborted) return;
        console.error('❌ Auth listener setup failed:', error);
        setAuthError(error.message);
        debouncedToast('Authentication system error', 'error');
        setLoading(false);
        setAuthInitialized(true);
        setAuthState(AuthState.ERROR);
      }
    };
    
    setupAuthListener();
    
    return () => {
      abortController.abort();
      if (unsubscribeAuthRef.current) unsubscribeAuthRef.current();
      if (unsubscribeIdTokenRef.current) unsubscribeIdTokenRef.current();
      if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
      unsubscribeAuthRef.current = null;
      unsubscribeIdTokenRef.current = null;
      unsubscribeProfileRef.current = null;
      listenerSetUp.current = false;
    };
    // ✅ CRITICAL: `user` is NOT in dependencies – prevents re‑subscription on every profile change
  }, [authService, navigate, setupRealtimeProfile]);

  // ========== AUTH METHODS (unchanged, all stable) ==========
  const signUpWithEmailPassword = useCallback(async (email, password, profileData = {}) => {
    return runOnce(`signup_${email}`, async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        setIsSignupInProgress(true);
        setError(null);
        const result = await authService.createUserWithEmailPassword(email, password, profileData);
        if (!result.success) throw new Error(result.error || 'Email signup failed');
        AuthStorageManager.set('email_auth_data', {
          userId: result.user.userId,
          email: result.user.email,
          requiresVerification: true,
          profileData,
          isUnverified: true,
          createdAt: Date.now(),
          flow: 'signup'
        });
        AuthStorageManager.set('pending_profile_creation', {
          userId: result.user.userId,
          method: 'email',
          userData: result.user,
          profileData,
          timestamp: Date.now(),
          requiresVerification: true
        });
        toast.success('Account created! Please verify your email.');
        return { success: true, user: result.user, requiresVerification: true };
      } catch (error) {
        console.error('❌ Email signup error:', error);
        const errorMessage = normalizeFirebaseError(error);
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        if (isMounted.current) setIsSignupInProgress(false);
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const signInWithEmailPassword = useCallback(async (email, password) => {
    return runOnce(`login_${email}`, async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        setError(null);
        const result = await authService.signInWithEmailPassword(email, password);
        if (!result.success) throw new Error(result.error || 'Failed to sign in');
        if (result.requiresVerification || result.user?.isUnverified) {
          AuthStorageManager.set('email_not_verified_user', {
            email,
            userId: result.user.uid,
            requiresVerification: true,
            fromLogin: true,
            userData: result.user
          });
          debouncedToast('Please verify your email to access all features.', 'info');
          return { ...result, requiresVerification: true };
        }
        toast.success('Welcome back!');
        return result;
      } catch (error) {
        console.error('❌ Email sign in failed:', error);
        const errorMessage = normalizeFirebaseError(error);
        if (error.code === 'auth/email-not-verified') {
          AuthStorageManager.set('email_not_verified_user', {
            email,
            userId: error.originalError?.userId,
            requiresVerification: true,
            fromLogin: true
          });
          debouncedToast('Please verify your email before logging in.', 'info');
          return { success: false, requiresVerification: true };
        }
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const signInWithGoogle = useCallback(async (options = {}) => {
    return runOnce('google_login', async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        setIsSignupInProgress(true);
        setError(null);
        const result = await authService.signInWithGoogle(options);
        if (!result.success) throw new Error(result.error || 'Google auth failed');
        if (result.isNewUser) {
          AuthStorageManager.set('pending_profile_creation', {
            userId: result.user.uid,
            method: 'google',
            userData: result.user,
            timestamp: Date.now(),
            emailVerified: true,
            requiresProfile: true
          });
          toast.success('Welcome to Arvdoul! Complete your profile.');
        } else {
          toast.success('Welcome back!');
        }
        return result;
      } catch (error) {
        console.error('❌ Google auth error:', error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
          const errorMessage = normalizeFirebaseError(error);
          debouncedToast(errorMessage, 'error');
          setError(errorMessage);
        }
        throw error;
      } finally {
        if (isMounted.current) setIsSignupInProgress(false);
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const sendPhoneVerificationCode = useCallback(async (phoneNumber, recaptchaVerifier) => {
    return runOnce(`phone_send_${phoneNumber}`, async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        setIsSignupInProgress(true);
        setError(null);
        const result = await authService.sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);
        if (!result.success) throw new Error(result.error || 'Failed to send code');
        AuthStorageManager.set('phone_verification_data', {
          verificationId: result.verificationId,
          phoneNumber: result.phoneNumber,
          sentAt: Date.now()
        });
        toast.success(`✅ Code sent to ${result.phoneNumber}`);
        return result;
      } catch (error) {
        console.error('❌ Phone verification failed:', error);
        const errorMessage = normalizeFirebaseError(error);
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        if (isMounted.current) setIsSignupInProgress(false);
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const verifyPhoneOTP = useCallback(async (verificationId, otp) => {
    return runOnce(`phone_verify_${verificationId}`, async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        setError(null);
        const result = await authService.verifyPhoneOTP(verificationId, otp);
        if (!result.success) throw new Error(result.error || 'Failed to verify OTP');
        if (result.isNewUser) {
          AuthStorageManager.set('pending_profile_creation', {
            userId: result.user.uid,
            method: 'phone',
            userData: result.user,
            timestamp: Date.now(),
            phoneVerified: true
          });
          toast.success('Phone verified! Complete your profile.');
        } else {
          toast.success('Phone number verified!');
        }
        return result;
      } catch (error) {
        console.error('❌ OTP verification failed:', error);
        const errorMessage = normalizeFirebaseError(error);
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const checkEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new Error('Auth service not ready');
    try {
      const result = await authService.checkEmailVerification(userId);
      if (result.verified && result.user) {
        AuthStorageManager.setVerified(userId);
        AuthStorageManager.remove('email_not_verified_user');
        AuthStorageManager.remove('email_auth_data');
        toast.success('Email verified! Welcome back.');
        return { ...result, hasProfile: !!userProfile, profileComplete: userProfile?.isProfileComplete };
      }
      return result;
    } catch (error) {
      console.error('❌ Email verification check failed:', error);
      return { verified: false, error: error.message };
    }
  }, [authService, userProfile]);

  const resendEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new Error('Auth service not ready');
    try {
      const result = await authService.resendEmailVerification(userId);
      toast.success('Verification email resent!');
      return result;
    } catch (error) {
      console.error('❌ Failed to resend verification:', error);
      const errorMessage = normalizeFirebaseError(error);
      debouncedToast(errorMessage, 'error');
      throw error;
    }
  }, [authService]);

  const createUserProfile = useCallback(async (profileData) => {
    return runOnce(`create_profile_${user?.uid}`, async () => {
      if (!userService || !user) throw new Error('Services not ready');
      navigationLock.current = true;
      try {
        const result = await userService.createUserProfile(user.uid, {
          ...profileData,
          emailVerified: user.emailVerified || true,
          authProvider: user.authProvider || 'email',
          isProfileComplete: true
        });
        if (isMounted.current && result.profile) setUserProfile(result.profile);
        AuthStorageManager.clearAll();
        AuthStorageManager.setVerified(user.uid, 'profile_complete');
        toast.success('Profile created successfully! Welcome to Arvdoul.');
        return { ...result, success: true };
      } catch (error) {
        console.error('❌ Profile creation failed:', error);
        const errorMessage = normalizeFirebaseError(error);
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        navigationLock.current = false;
      }
    });
  }, [userService, user]);

  const updateUserProfile = useCallback(async (updates) => {
    if (!userService || !user) throw new Error('Services not ready');
    try {
      await userService.updateUserProfile(user.uid, updates);
      toast.success('Profile updated!');
    } catch (error) {
      const errorMessage = normalizeFirebaseError(error);
      debouncedToast(errorMessage, 'error');
      throw error;
    }
  }, [userService, user]);

  const sendPasswordResetEmail = useCallback(async (email) => {
    return runOnce(`reset_${email}`, async () => {
      if (!authService) throw new Error('Auth service not ready');
      navigationLock.current = true;
      try {
        const result = await authService.sendPasswordResetEmail(email);
        AuthStorageManager.set('password_reset_attempt', { email, timestamp: Date.now() });
        toast.success('Password reset email sent! Check your inbox.');
        return result;
      } catch (error) {
        console.error('❌ Password reset failed:', error);
        const errorMessage = normalizeFirebaseError(error);
        debouncedToast(errorMessage, 'error');
        throw error;
      } finally {
        navigationLock.current = false;
      }
    });
  }, [authService]);

  const confirmPasswordReset = useCallback(async (actionCode, newPassword) => {
    if (!authService) throw new Error('Auth service not ready');
    navigationLock.current = true;
    try {
      const result = await authService.confirmPasswordReset(actionCode, newPassword);
      AuthStorageManager.remove('password_reset_attempt');
      toast.success('Password reset successful! You can now login.');
      setTimeout(() => {
        navigate('/login', {
          state: { passwordResetSuccess: true },
          replace: true
        });
      }, 1500);
      return result;
    } catch (error) {
      console.error('❌ Password reset confirmation failed:', error);
      const errorMessage = normalizeFirebaseError(error);
      debouncedToast(errorMessage, 'error');
      throw error;
    } finally {
      navigationLock.current = false;
    }
  }, [authService, navigate]);

  const createRecaptchaVerifier = useCallback(async (containerId, options = {}) => {
    if (!authService) throw new Error('Auth service not ready');
    try {
      return await authService.createRecaptchaVerifier(containerId, options);
    } catch (error) {
      console.error('❌ Failed to create reCAPTCHA:', error);
      throw error;
    }
  }, [authService]);
  
  const cleanupRecaptchaVerifier = useCallback((containerId) => {
    if (!authService) return;
    try {
      authService.cleanupRecaptchaVerifier(containerId);
    } catch (error) {
      console.warn('Failed to cleanup reCAPTCHA:', error);
    }
  }, [authService]);

  const signOut = useCallback(async () => {
    if (!authService) throw new Error('Auth service not ready');
    navigationLock.current = true;
    isLoggingOutRef.current = true;
    try {
      await authService.signOut();
      if (isMounted.current) {
        setUser(null);
        setUserProfile(null);
        setIsSignupInProgress(false);
      }
      clearUserDataRef.current();
      AuthStorageManager.clearAll();
      broadcastRef.current?.postMessage({ type: 'signOut' });
      toast.success('Signed out successfully');
      setTimeout(() => navigate('/', { replace: true }), 300);
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      debouncedToast('Failed to sign out', 'error');
      throw error;
    } finally {
      navigationLock.current = false;
      isLoggingOutRef.current = false;
    }
  }, [authService, navigate]);

  const getCurrentUser = useCallback(() => user, [user]);
  const clearError = useCallback(() => setError(null), []);
  const resetSignupState = useCallback(() => {
    setIsSignupInProgress(false);
    AuthStorageManager.clearAll();
  }, []);

  const checkAuthState = useCallback(() => ({
    isAuthenticated: !!user,
    isEmailVerified: !!(user && user.emailVerified),
    isProfileComplete: !!(userProfile && userProfile.isProfileComplete),
    hasPendingProfile: !!AuthStorageManager.get('pending_profile_creation'),
    requiresVerification: !!AuthStorageManager.get('email_not_verified_user'),
    authState,
  }), [user, userProfile, authState]);

  const contextValue = useMemo(() => ({
    user,
    userProfile,
    loading,
    error,
    authError,
    isSignupInProgress,
    authInitialized,
    securityChecks,
    authService,
    userService,
    authState,
    isAuthenticated: !!user,
    isEmailVerified: !!(user && user.emailVerified),
    isProfileComplete: !!(userProfile && userProfile.isProfileComplete),
    requiresEmailVerification: !!(user && !user.emailVerified),
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    sendPhoneVerificationCode,
    verifyPhoneOTP,
    signOut,
    checkEmailVerification,
    resendEmailVerification,
    sendPasswordResetEmail,
    confirmPasswordReset,
    createRecaptchaVerifier,
    cleanupRecaptchaVerifier,
    createUserProfile,
    updateUserProfile,
    getCurrentUser,
    clearError,
    resetSignupState,
    checkAuthState
  }), [
    user, userProfile, loading, error, authError, isSignupInProgress, authInitialized,
    securityChecks, authService, userService, authState,
    signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogle,
    sendPhoneVerificationCode, verifyPhoneOTP, signOut, checkEmailVerification,
    resendEmailVerification, sendPasswordResetEmail, confirmPasswordReset,
    createRecaptchaVerifier, cleanupRecaptchaVerifier, createUserProfile,
    updateUserProfile, getCurrentUser, clearError, resetSignupState, checkAuthState
  ]);

  if (loading && !authInitialized && !initialProfileLoaded.current) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black z-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Initializing Authentication</p>
          <p className="text-gray-400 text-sm mt-2">Preparing secure connection...</p>
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}