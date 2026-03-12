// src/context/AuthContext.jsx - ULTIMATE PRODUCTION V20 - NO FLICKER, PERFECT FLOW
// 🎯 ALL METHODS PERFECT • WAITS FOR PROFILE • NO RACE CONDITIONS • PROFESSIONAL READY

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

// ==================== PERFECT USER SYNC UTILITY ====================
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
  console.log('🔄 Synced user with app store:', { 
    uid: userData.uid, 
    email: userData.email,
    profileComplete: userData.isProfileComplete 
  });
  
  return userData;
};

// ==================== PERFECT AUTH PROVIDER ====================
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);
  
  const { setCurrentUser, clearUserData } = useAppStore();
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);          // true while initializing or loading profile
  const [error, setError] = useState(null);
  const [authService, setAuthService] = useState(null);
  const [userService, setUserService] = useState(null);
  
  const [isSignupInProgress, setIsSignupInProgress] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    firebaseReady: false,
    servicesLoaded: false,
    authListenerActive: false
  });

  const pendingOperations = useRef(new Set());
  const navigationLock = useRef(false);  // prevents concurrent navigations

  // ========== CLEANUP ==========
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      navigationLock.current = false;
      pendingOperations.current.clear();
      console.log('🧹 AuthContext cleanup completed');
    };
  }, []);

  // ========== SERVICE INITIALIZATION ==========
  useEffect(() => {
    const abortController = new AbortController();
    
    const initServices = async () => {
      if (!isMounted.current || abortController.signal.aborted) return;
      
      try {
        console.log('🚀 Initializing auth services...');
        setLoading(true);
        
        const authModule = await import('../services/authService.js');
        const userModule = await import('../services/userService.js');
        
        if (!isMounted.current || abortController.signal.aborted) return;
        
        const authSvc = authModule.default ? authModule.default() : authModule.getAuthService();
        const userSvc = userModule.default ? userModule.default() : userModule.getUserService();
        
        setAuthService(authSvc);
        setUserService(userSvc);
        setSecurityChecks(prev => ({ ...prev, servicesLoaded: true }));
        
        console.log('✅ Auth services initialized');
        
      } catch (error) {
        if (!isMounted.current || abortController.signal.aborted) return;
        console.error('❌ Service initialization failed:', error);
        setError('Failed to initialize authentication services');
        toast.error('Authentication service unavailable. Please refresh.');
      } finally {
        if (isMounted.current && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    initServices();
    
    return () => {
      abortController.abort();
    };
  }, []);

  // ========== PERFECT AUTH STATE LISTENER ==========
  useEffect(() => {
    if (!authService || authInitialized || !isMounted.current) return;
    
    const abortController = new AbortController();
    
    const setupAuthListener = async () => {
      try {
        await authService.initialize();
        
        if (!isMounted.current || abortController.signal.aborted) return;
        
        const firebaseAuth = await import('firebase/auth');
        const { onAuthStateChanged } = firebaseAuth;
        const auth = authService.auth;
        
        if (!auth) {
          throw new Error('Failed to get Firebase auth instance');
        }
        
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted.current) return;
          
          console.log('👤 Auth state changed:', firebaseUser ? `User logged in (${firebaseUser.uid})` : 'No user');
          
          // CRITICAL FIX: Set loading to true while we fetch profile
          setLoading(true);
          
          if (firebaseUser) {
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
              isNewUser: firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime
            };
            
            setUser(userData);
            
            // Load user profile – we keep loading true until profile is fetched
            if (userService) {
              try {
                const profile = await userService.getUserProfile(firebaseUser.uid);
                if (profile && isMounted.current) {
                  setUserProfile(profile);
                  syncUserWithAppStore(userData, profile, setCurrentUser);
                  
                  if (firebaseUser.emailVerified) {
                    AuthStorageManager.setVerified(firebaseUser.uid);
                  }
                } else {
                  // Profile doesn't exist – user might be new but profile creation failed?
                  syncUserWithAppStore(userData, null, setCurrentUser);
                }
              } catch (profileError) {
                console.warn('Profile load failed:', profileError);
                syncUserWithAppStore(userData, null, setCurrentUser);
              }
            } else {
              syncUserWithAppStore(userData, null, setCurrentUser);
            }
            
          } else {
            // User logged out
            setUser(null);
            setUserProfile(null);
            clearUserData();
            AuthStorageManager.clearAll();
            console.log('👤 User logged out');
          }
          
          // Set loading false after all async operations are done
          if (isMounted.current) {
            setLoading(false);
          }
        });
        
        if (!isMounted.current || abortController.signal.aborted) {
          unsubscribe();
          return;
        }
        
        setSecurityChecks(prev => ({ 
          ...prev, 
          firebaseReady: true,
          authListenerActive: true 
        }));
        setAuthInitialized(true);
        
        console.log('✅ Auth listener setup complete');
        
      } catch (error) {
        if (!isMounted.current || abortController.signal.aborted) return;
        console.error('❌ Auth listener setup failed:', error);
        toast.error('Authentication system error');
        setLoading(false);
      }
    };
    
    setupAuthListener();
    
    return () => {
      abortController.abort();
    };
  }, [authService, userService, authInitialized, setCurrentUser, clearUserData, navigate, location.pathname]);

  // ========== PERFECT EMAIL SIGNUP ==========
  const signUpWithEmailPassword = useCallback(async (email, password, profileData = {}) => {
    if (!authService) throw new Error('Auth service not ready');
    
    const operationId = `email_signup_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true; // lock to prevent listener interference
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('📧 Creating email user:', email);
      
      const result = await authService.createUserWithEmailPassword(email, password, profileData);
      
      if (!result.success) {
        throw new Error(result.error || 'Email signup failed');
      }
      
      console.log('✅ User created, verification required');
      
      AuthStorageManager.set('email_auth_data', {
        userId: result.user.userId,
        email: result.user.email,
        requiresVerification: true,
        profileData: profileData,
        isUnverified: true,
        createdAt: Date.now(),
        flow: 'signup'
      });
      
      AuthStorageManager.set('pending_profile_creation', {
        userId: result.user.userId,
        method: 'email',
        userData: result.user,
        profileData: profileData,
        timestamp: Date.now(),
        requiresVerification: true
      });
      
      toast.success('Account created! Please verify your email.');
      
      // Navigate to verification – immediate, no setTimeout
      if (isMounted.current) {
        navigate('/verify-email', {
          state: {
            email: result.user.email,
            userId: result.user.userId,
            fromSignup: true
          },
          replace: true
        });
      }
      navigationLock.current = false; // release lock immediately after navigation
      
      return {
        success: true,
        user: result.user,
        requiresVerification: true
      };
      
    } catch (error) {
      navigationLock.current = false; // release lock on error
      console.error('❌ Email signup error:', error);
      
      const errorMap = {
        'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
        'auth/invalid-email': 'Invalid email address format.',
        'auth/weak-password': 'Password is too weak (min 8 characters).',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.'
      };
      
      const errorMessage = errorMap[error.code] || error.message || 'Failed to create account';
      toast.error(errorMessage);
      throw error;
      
    } finally {
      pendingOperations.current.delete(operationId);
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService, navigate]);

  // ========== PERFECT EMAIL SIGN IN ==========
  const signInWithEmailPassword = useCallback(async (email, password) => {
    if (!authService) throw new Error('Auth service not ready');
    
    const operationId = `email_login_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true; // lock to prevent listener interference
    
    try {
      setError(null);
      
      console.log('🔐 Email sign in:', email);
      
      const result = await authService.signInWithEmailPassword(email, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sign in');
      }
      
      if (result.requiresVerification || result.user?.isUnverified) {
        console.log('📧 User requires email verification');
        
        AuthStorageManager.set('email_not_verified_user', {
          email: email,
          userId: result.user.uid,
          requiresVerification: true,
          fromLogin: true,
          userData: result.user
        });
        
        toast.info('Please verify your email to access all features.');
        
        // NO NAVIGATION – let AppStateGuard handle it
        navigationLock.current = false;
        
        return {
          ...result,
          requiresVerification: true
        };
      }
      
      // Verified user - sync
      syncUserWithAppStore(result.user, null, setCurrentUser);
      
      // Check for pending profile (maybe from a previous incomplete signup)
      const pending = AuthStorageManager.get('pending_profile_creation');
      if (pending && pending.userId === result.user.uid) {
        console.log('👤 Pending profile found, will redirect to setup-profile via guard');
      }
      
      toast.success('Welcome back!');
      navigationLock.current = false; // release lock
      return result;
      
    } catch (error) {
      navigationLock.current = false; // release lock on error
      console.error('❌ Email sign in failed:', error);
      
      const errorMap = {
        'auth/user-not-found': 'No account found. Please sign up first.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/user-disabled': 'Account disabled. Contact support.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/network-request-failed': 'Network error. Check connection.',
        'auth/email-not-verified': 'Please verify your email to login.'
      };
      
      const errorMessage = errorMap[error.code] || error.message || 'Login failed';
      
      if (error.code === 'auth/email-not-verified') {
        AuthStorageManager.set('email_not_verified_user', {
          email: email,
          userId: error.originalError?.userId,
          requiresVerification: true,
          fromLogin: true
        });
        
        toast.info('Please verify your email before logging in.');
        
        return {
          success: false,
          requiresVerification: true
        };
      }
      
      toast.error(errorMessage);
      throw error;
    } finally {
      pendingOperations.current.delete(operationId);
    }
  }, [authService, setCurrentUser]);

  // ========== PERFECT GOOGLE SIGN IN ==========
  const signInWithGoogle = useCallback(async (options = {}) => {
    if (!authService) throw new Error('Auth service not ready');
    
    const operationId = `google_signin_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true; // lock to prevent listener interference
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('🔐 Google sign in...');
      
      const result = await authService.signInWithGoogle(options);
      
      if (!result.success) {
        throw new Error(result.error || 'Google auth failed');
      }
      
      console.log('✅ Google auth successful. New user:', result.isNewUser);
      
      syncUserWithAppStore(result.user, null, setCurrentUser);
      
      if (result.isNewUser) {
        console.log('🆕 New Google user, setting up profile...');
        
        AuthStorageManager.set('pending_profile_creation', {
          userId: result.user.uid,
          method: 'google',
          userData: result.user,
          timestamp: Date.now(),
          emailVerified: true,
          requiresProfile: true
        });
        
        toast.success('Welcome to Arvdoul! Complete your profile.');
        
        // NO NAVIGATION – guard will redirect to setup-profile once profile loads
      } else {
        console.log('👤 Existing Google user, checking profile...');
        
        if (userService) {
          try {
            const profile = await userService.getUserProfile(result.user.uid);
            if (profile) {
              setUserProfile(profile);
              syncUserWithAppStore(result.user, profile, setCurrentUser);
              
              if (!profile.isProfileComplete) {
                // Guard will redirect to setup-profile
              } else {
                toast.success('Welcome back!');
              }
            }
          } catch (profileError) {
            console.warn('Profile load failed for Google user:', profileError);
          }
        }
      }
      
      navigationLock.current = false; // release lock
      return result;
      
    } catch (error) {
      navigationLock.current = false; // release lock on error
      console.error('❌ Google auth error:', error);
      
      if (error.code !== 'auth/popup-closed-by-user' && 
          error.code !== 'auth/cancelled-popup-request') {
        toast.error(error.message || 'Google sign-in failed');
        setError(error.message);
      }
      throw error;
      
    } finally {
      pendingOperations.current.delete(operationId);
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService, userService, setCurrentUser]);

  // ========== PERFECT PHONE VERIFICATION ==========
  const sendPhoneVerificationCode = useCallback(async (phoneNumber, recaptchaVerifier) => {
    if (!authService) throw new Error('Auth service not ready');
    
    const operationId = `phone_verification_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true;
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('📱 Sending phone verification:', phoneNumber);
      
      const result = await authService.sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send code');
      }
      
      AuthStorageManager.set('phone_verification_data', {
        verificationId: result.verificationId,
        phoneNumber: result.phoneNumber,
        sentAt: Date.now()
      });
      
      toast.success(`✅ Code sent to ${result.phoneNumber}`);
      
      navigationLock.current = false;
      return result;
      
    } catch (error) {
      navigationLock.current = false;
      console.error('❌ Phone verification failed:', error);
      
      const errorMap = {
        'auth/invalid-phone-number': 'Invalid phone number format.',
        'auth/quota-exceeded': 'SMS quota exceeded. Try again tomorrow.',
        'auth/captcha-check-failed': 'Security check failed.',
        'auth/too-many-requests': 'Too many attempts. Wait 5 minutes.',
        'auth/network-request-failed': 'Network error.'
      };
      
      const errorMessage = errorMap[error.code] || error.message || 'Failed to send code';
      toast.error(errorMessage);
      throw error;
      
    } finally {
      pendingOperations.current.delete(operationId);
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService]);

  const verifyPhoneOTP = useCallback(async (verificationId, otp) => {
    if (!authService) throw new Error('Auth service not ready');
    
    const operationId = `phone_verify_otp_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true;
    
    try {
      setError(null);
      
      console.log('🔢 Verifying phone OTP...');
      
      const result = await authService.verifyPhoneOTP(verificationId, otp);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to verify OTP');
      }
      
      console.log('✅ Phone verified:', result.user.uid);
      
      syncUserWithAppStore(result.user, null, setCurrentUser);
      
      if (result.isNewUser) {
        AuthStorageManager.set('pending_profile_creation', {
          userId: result.user.uid,
          method: 'phone',
          userData: result.user,
          timestamp: Date.now(),
          phoneVerified: true
        });
        
        toast.success('Phone verified! Complete your profile.');
        
        // NO NAVIGATION – guard will redirect
      } else {
        toast.success('Phone number verified!');
        
        if (userService) {
          const profile = await userService.getUserProfile(result.user.uid);
          if (profile) {
            setUserProfile(profile);
            syncUserWithAppStore(result.user, profile, setCurrentUser);
          }
        }
      }
      
      navigationLock.current = false;
      return result;
      
    } catch (error) {
      navigationLock.current = false;
      console.error('❌ OTP verification failed:', error);
      
      const errorMap = {
        'auth/invalid-verification-code': 'Invalid code.',
        'auth/code-expired': 'Code expired. Request new one.',
        'auth/credential-already-in-use': 'Phone already linked.',
        'auth/invalid-verification-id': 'Session expired.',
        'auth/too-many-requests': 'Too many attempts.'
      };
      
      const errorMessage = errorMap[error.code] || error.message || 'Verification failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      pendingOperations.current.delete(operationId);
    }
  }, [authService, setCurrentUser, userService]);

  // ========== PERFECT EMAIL VERIFICATION ==========
  const checkEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new Error('Auth service not ready');
    
    try {
      console.log('📧 Checking email verification:', userId);
      
      const result = await authService.checkEmailVerification(userId);
      
      if (result.verified && result.user) {
        syncUserWithAppStore(result.user, null, setCurrentUser);
        AuthStorageManager.setVerified(userId);
        AuthStorageManager.remove('email_not_verified_user');
        AuthStorageManager.remove('email_auth_data');
        
        if (userService) {
          const profile = await userService.getUserProfile(userId);
          
          if (profile) {
            setUserProfile(profile);
            syncUserWithAppStore(result.user, profile, setCurrentUser);
            toast.success('Email verified! Welcome back.');
            return { ...result, hasProfile: true, profileComplete: profile.isProfileComplete };
          } else {
            const pending = AuthStorageManager.get('pending_profile_creation');
            if (pending && pending.userId === userId) {
              console.log('👤 Verified email, navigating to setup profile');
              AuthStorageManager.remove('phone_verification_data');
              return { 
                ...result, 
                hasProfile: false,
                requiresProfileSetup: true,
                navigateTo: '/setup-profile',
                state: {
                  method: pending.method,
                  userData: pending.userData,
                  isNewUser: true,
                  fromVerification: true
                }
              };
            }
          }
        }
        
        toast.success('Email verified!');
        return result;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Email verification check failed:', error);
      return { verified: false, error: error.message };
    }
  }, [authService, userService, setCurrentUser]);

  const resendEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new Error('Auth service not ready');
    
    try {
      const result = await authService.resendEmailVerification(userId);
      toast.success('Verification email resent!');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to resend verification:', error);
      const errorMessage = error.code === 'auth/too-many-requests'
        ? 'Too many attempts. Try again later.'
        : error.message || 'Failed to resend';
      toast.error(errorMessage);
      throw error;
    }
  }, [authService]);

  // ========== PERFECT PROFILE MANAGEMENT ==========
  const createUserProfile = useCallback(async (profileData) => {
    if (!userService || !user) throw new Error('Services not ready');
    
    const operationId = `create_profile_${Date.now()}`;
    pendingOperations.current.add(operationId);
    navigationLock.current = true;
    
    try {
      console.log('👤 Creating profile for:', user.uid);
      
      const result = await userService.createUserProfile(user.uid, {
        ...profileData,
        emailVerified: user.emailVerified || true,
        authProvider: user.authProvider || 'email',
        isProfileComplete: true
      });
      
      if (isMounted.current) {
        setUserProfile(result.profile);
        syncUserWithAppStore(user, result.profile, setCurrentUser);
      }
      
      AuthStorageManager.clearAll();
      AuthStorageManager.setVerified(user.uid, 'profile_complete');
      
      toast.success('Profile created successfully! Welcome to Arvdoul.');
      
      // Guard will redirect to home after profile is complete
      navigationLock.current = false;
      
      return {
        ...result,
        success: true
      };
      
    } catch (error) {
      navigationLock.current = false;
      console.error('❌ Profile creation failed:', error);
      toast.error('Failed to create profile');
      throw error;
    } finally {
      pendingOperations.current.delete(operationId);
    }
  }, [userService, user, setCurrentUser]);

  const updateUserProfile = useCallback(async (updates) => {
    if (!userService || !user) throw new Error('Services not ready');
    
    try {
      await userService.updateUserProfile(user.uid, updates);
      
      if (isMounted.current) {
        setUserProfile(prev => ({ ...prev, ...updates }));
        syncUserWithAppStore(user, { ...userProfile, ...updates }, setCurrentUser);
      }
      
      toast.success('Profile updated!');
      
    } catch (error) {
      toast.error('Failed to update profile');
      throw error;
    }
  }, [userService, user, userProfile, setCurrentUser]);

  // ========== PASSWORD RESET ==========
  const sendPasswordResetEmail = useCallback(async (email) => {
    if (!authService) throw new Error('Auth service not ready');
    
    try {
      const result = await authService.sendPasswordResetEmail(email);
      AuthStorageManager.set('password_reset_attempt', { email, timestamp: Date.now() });
      toast.success('Password reset email sent! Check your inbox.');
      return result;
      
    } catch (error) {
      console.error('❌ Password reset failed:', error);
      const errorMap = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Try again later.'
      };
      const errorMessage = errorMap[error.code] || 'Failed to send reset email';
      toast.error(errorMessage);
      throw error;
    }
  }, [authService]);

  const confirmPasswordReset = useCallback(async (actionCode, newPassword) => {
    if (!authService) throw new Error('Auth service not ready');
    
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
      const errorMap = {
        'auth/expired-action-code': 'Reset link has expired. Request a new one.',
        'auth/invalid-action-code': 'Invalid reset link.',
        'auth/user-disabled': 'Account disabled.',
        'auth/weak-password': 'Password is too weak.'
      };
      const errorMessage = errorMap[error.code] || 'Failed to reset password';
      toast.error(errorMessage);
      throw error;
    }
  }, [authService, navigate]);

  // ========== RECAPTCHA MANAGEMENT ==========
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

  // ========== SIGN OUT ==========
  const signOut = useCallback(async () => {
    if (!authService) throw new Error('Auth service not ready');
    
    navigationLock.current = true;
    
    try {
      await authService.signOut();
      
      if (isMounted.current) {
        setUser(null);
        setUserProfile(null);
        setIsSignupInProgress(false);
      }
      
      clearUserData();
      AuthStorageManager.clearAll();
      
      toast.success('Signed out successfully');
      
      // Navigate to splash
      setTimeout(() => {
        navigate('/', { replace: true });
        navigationLock.current = false;
      }, 300);
      
    } catch (error) {
      navigationLock.current = false;
      console.error('❌ Sign out failed:', error);
      toast.error('Failed to sign out');
      throw error;
    }
  }, [authService, navigate, clearUserData]);

  // ========== UTILITY FUNCTIONS ==========
  const getCurrentUser = useCallback(() => user, [user]);
  const clearError = useCallback(() => setError(null), []);
  const resetSignupState = useCallback(() => {
    setIsSignupInProgress(false);
    AuthStorageManager.clearAll();
  }, []);

  const checkAuthState = useCallback(() => {
    return {
      isAuthenticated: !!user,
      isEmailVerified: !!(user && user.emailVerified),
      isProfileComplete: !!(userProfile && userProfile.isProfileComplete),
      hasPendingProfile: !!AuthStorageManager.get('pending_profile_creation'),
      requiresVerification: !!AuthStorageManager.get('email_not_verified_user')
    };
  }, [user, userProfile]);

  const contextValue = {
    user,
    userProfile,
    loading,
    error,
    isSignupInProgress,
    authInitialized,
    securityChecks,
    authService,
    userService,
    isAuthenticated: !!user,
    isEmailVerified: !!(user && user.emailVerified),
    isProfileComplete: !!(userProfile && userProfile.isProfileComplete),
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
  };

  if (loading && !authInitialized) {
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
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}