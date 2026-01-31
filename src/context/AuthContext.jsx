// src/context/AuthContext.jsx - ENTERPRISE PRODUCTION V7 - FIXED EMAIL VERIFICATION
// ✅ COMPLETE VERIFICATION FLOW • BLOCK UNVERIFIED LOGINS • PRODUCTION ROBUST

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";

const AuthContext = createContext(null);

// ==================== CUSTOM AUTH ERROR ====================
export class AuthError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
  }
}

// ==================== STORAGE UTILITIES ====================
const StorageManager = {
  clearAll() {
    const itemsToClear = [
      'email_verification_data',
      'google_auth_data', 
      'phone_auth_data',
      'signup_step1',
      'signup_data',
      'pending_verification',
      'pending_profile_creation',
      'email_verified_user',
      'google_signup_data',
      'phone_signup_data',
      'phone_verification',
      'firebase_auth_state',
      'email_not_verified_user' // New key for unverified login attempts
    ];
    
    itemsToClear.forEach(key => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
    
    console.log('🧹 Auth storage cleared');
  },
  
  set(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  },
  
  get(key) {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  
  remove(key) {
    sessionStorage.removeItem(key);
  }
};

// ==================== USER PROFILE SYNC ====================
const syncUserWithAppStore = (user, userProfile, setCurrentUser) => {
  if (!user) {
    setCurrentUser(null);
    return;
  }
  
  const userData = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'User',
    username: userProfile?.username || user.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${user.uid?.slice(0, 8)}`,
    photoURL: userProfile?.photoURL || user.photoURL || "/assets/default-profile.png",
    phoneNumber: userProfile?.phoneNumber || user.phoneNumber,
    authProvider: userProfile?.authProvider || user.authProvider || 'email',
    isProfileComplete: userProfile?.isProfileComplete || false,
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
    requiresProfileCompletion: user.requiresProfileCompletion || false
  };
  
  setCurrentUser(userData);
  console.log('🔄 Synced user with app store:', userData.username);
};

// ==================== AUTH PROVIDER ====================
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);
  
  // App Store Integration
  const { setCurrentUser, clearUserData, updateUserProfile: updateAppStoreProfile } = useAppStore();
  
  // Enhanced State Management
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authService, setAuthService] = useState(null);
  const [userService, setUserService] = useState(null);
  
  // Auth State
  const [isSignupInProgress, setIsSignupInProgress] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    firebaseReady: false,
    servicesLoaded: false,
    authListenerActive: false
  });

  // ========== CLEANUP ON UNMOUNT ==========
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      console.log('🧹 AuthContext cleanup completed');
    };
  }, []);

  // ========== SERVICE INITIALIZATION ==========
  useEffect(() => {
    const abortController = new AbortController();
    
    const initServices = async () => {
      if (!isMounted.current || abortController.signal.aborted) return;
      
      try {
        console.log('🚀 ENTERPRISE: Initializing auth services...');
        setLoading(true);
        
        // Load services with retry logic
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            const [authModule, userModule] = await Promise.all([
              import('../services/authService.js'),
              import('../services/userService.js')
            ]);
            
            if (!isMounted.current || abortController.signal.aborted) return;
            
            const authSvc = authModule.default ? authModule.default() : authModule.getAuthService();
            const userSvc = userModule.default ? userModule.default() : userModule.getUserService();
            
            setAuthService(authSvc);
            setUserService(userSvc);
            setSecurityChecks(prev => ({ ...prev, servicesLoaded: true }));
            
            console.log('✅ ENTERPRISE: Auth services initialized');
            break;
            
          } catch (err) {
            retries++;
            console.warn(`Service load attempt ${retries} failed:`, err);
            
            if (retries === maxRetries) {
              throw new Error('Failed to initialize authentication services');
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
        
      } catch (error) {
        if (!isMounted.current || abortController.signal.aborted) return;
        
        console.error('❌ ENTERPRISE: Service initialization failed:', error);
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

  // ========== AUTH STATE LISTENER (FIXED WITH APP STORE SYNC) ==========
  useEffect(() => {
    if (!authService || authInitialized || !isMounted.current) return;
    
    const abortController = new AbortController();
    
    const setupAuthListener = async () => {
      try {
        // Initialize auth service
        await authService.initialize();
        
        if (!isMounted.current || abortController.signal.aborted) return;
        
        // Import Firebase auth for listener
        const firebaseAuth = await import('firebase/auth');
        const { onAuthStateChanged } = firebaseAuth;
        
        // Get auth instance
        const auth = await authService._ensureInitialized?.() || authService.auth;
        
        if (!auth) {
          throw new Error('Failed to get Firebase auth instance');
        }
        
        // Setup auth state listener
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted.current) return;
          
          console.log('👤 Auth state changed:', firebaseUser ? `User logged in (${firebaseUser.uid})` : 'No user');
          
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
              }
            };
            
            setUser(userData);
            
            // Load user profile
            if (userService) {
              try {
                const profile = await userService.getUserProfile(firebaseUser.uid);
                if (profile && isMounted.current) {
                  setUserProfile(profile);
                  // Sync with app store
                  syncUserWithAppStore(userData, profile, setCurrentUser);
                } else {
                  // Sync basic user data if no profile exists
                  syncUserWithAppStore(userData, null, setCurrentUser);
                }
              } catch (profileError) {
                console.warn('Profile load failed:', profileError);
                // Still sync basic user data
                syncUserWithAppStore(userData, null, setCurrentUser);
              }
            } else {
              // Sync basic user data if userService not available
              syncUserWithAppStore(userData, null, setCurrentUser);
            }
            
            // Handle pending profile creation
            handlePendingProfileCreation(firebaseUser.uid);
            
          } else {
            // User logged out
            setUser(null);
            setUserProfile(null);
            clearUserData();
            console.log('👤 User logged out, app store cleared');
          }
          
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
        
        console.log('✅ ENTERPRISE: Auth listener setup complete');
        
      } catch (error) {
        if (!isMounted.current || abortController.signal.aborted) return;
        
        console.error('❌ ENTERPRISE: Auth listener setup failed:', error);
        toast.error('Authentication system error');
        setLoading(false);
      }
    };
    
    setupAuthListener();
    
    return () => {
      abortController.abort();
    };
  }, [authService, userService, authInitialized, setCurrentUser, clearUserData]);

  // ========== PENDING PROFILE CREATION HANDLER ==========
  const handlePendingProfileCreation = useCallback(async (userId) => {
    if (!isMounted.current || !userService) return;
    
    try {
      const pendingData = StorageManager.get('pending_profile_creation');
      if (!pendingData || pendingData.userId !== userId) return;
      
      console.log('👤 Processing pending profile creation for:', userId);
      
      // Clear storage
      StorageManager.remove('pending_profile_creation');
      
      // Check if profile already exists
      const existingProfile = await userService.getUserProfile(userId);
      
      if (!existingProfile) {
        // Navigate to setup profile
        setTimeout(() => {
          if (isMounted.current) {
            navigate('/setup-profile', {
              state: {
                method: pendingData.method,
                userData: pendingData.userData,
                isNewUser: true,
                requiresProfileCompletion: true
              },
              replace: true
            });
          }
        }, 500);
      }
    } catch (error) {
      console.warn('Profile creation handler error:', error);
    }
  }, [navigate, userService]);

  // ========== EMAIL SIGNUP (FIXED - USER SIGNED OUT IMMEDIATELY) ==========
  const signUpWithEmailPassword = useCallback(async (email, password, profileData = {}) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('📧 ENTERPRISE: Creating email user with MANDATORY verification');
      
      const result = await authService.createUserWithEmailPassword(email, password, profileData);
      
      if (!result.success) {
        throw new AuthError('auth/email-signup-failed', result.error || 'Email signup failed');
      }
      
      console.log('✅ ENTERPRISE: Firebase user created (UNVERIFIED):', result.user.userId);
      
      // Store user data for verification flow
      StorageManager.set('email_auth_data', {
        userId: result.user.userId,
        email: result.user.email,
        requiresVerification: true,
        profileData: profileData,
        isUnverified: true
      });
      
      // DO NOT SYNC WITH APP STORE - User is not logged in
      // User is signed out by authService and cannot login until verified
      
      toast.success('Account created! Please verify your email before logging in.');
      
      return {
        success: true,
        user: result.user,
        requiresVerification: true,
        message: result.message || 'Verification email sent'
      };
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Email signup error:', error);
      
      let errorMessage = error.message || 'Failed to create account';
      const errorCode = error.code || 'auth/unknown-error';
      
      const errorMap = {
        'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
        'auth/invalid-email': 'Invalid email address format.',
        'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
        'auth/too-many-requests': 'Too many attempts. Please try again in 5 minutes.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.'
      };
      
      errorMessage = errorMap[errorCode] || errorMessage;
      
      if (errorCode === 'auth/email-already-in-use') {
        setTimeout(() => {
          if (isMounted.current) {
            navigate('/login', { state: { email } });
          }
        }, 2000);
      }
      
      toast.error(errorMessage);
      throw new AuthError(errorCode, errorMessage, error);
      
    } finally {
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService, navigate]);

  // ========== EMAIL SIGN IN WITH VERIFICATION CHECK (FIXED) ==========
  const signInWithEmailPassword = useCallback(async (email, password) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      setError(null);
      
      console.log('🔐 ENTERPRISE: Attempting email login with verification check');
      
      const result = await authService.signInWithEmailPassword(email, password);
      
      if (!result.success) {
        throw new AuthError('auth/signin-failed', result.error || 'Failed to sign in');
      }
      
      // If we get here, email is VERIFIED. Sync with app store
      const userData = {
        uid: result.user.uid,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
        username: result.user.username || result.user.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${result.user.uid?.slice(0, 8)}`,
        photoURL: result.user.photoURL || "/assets/default-profile.png",
        authProvider: 'email',
        isOnline: true,
        lastActive: new Date().toISOString(),
        createdAt: result.user.metadata?.creationTime || new Date().toISOString()
      };
      
      setCurrentUser(userData);
      
      // Load full profile if available
      if (userService && result.user.uid) {
        try {
          const profile = await userService.getUserProfile(result.user.uid);
          if (profile) {
            syncUserWithAppStore(result.user, profile, setCurrentUser);
          }
        } catch (profileError) {
          console.warn('Profile load failed on sign in:', profileError);
        }
      }
      
      toast.success('Welcome back!');
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Email sign in failed:', error);
      
      const errorMap = {
        'auth/user-not-found': 'No account found with this email. Please sign up first.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/user-disabled': 'Account disabled. Please contact support.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/email-not-verified': 'Please verify your email before logging in.'
      };
      
      const errorMessage = errorMap[error.code] || error.message || 'Failed to sign in';
      
      // SPECIAL HANDLING FOR UNVERIFIED EMAIL
      if (error.code === 'auth/email-not-verified') {
        // Store unverified user data for verification flow
        StorageManager.set('email_not_verified_user', {
          email: email,
          userId: error.originalError?.userId,
          requiresVerification: true,
          fromLogin: true
        });
        
        // Navigate to verification page
        if (isMounted.current) {
          navigate('/verify-email', {
            state: {
              email: email,
              userId: error.originalError?.userId,
              fromLogin: true,
              message: error.message
            }
          });
        }
        
        // Don't show toast here - navigation handles it
        throw new AuthError(error.code, errorMessage, error);
      }
      
      toast.error(errorMessage);
      throw new AuthError(error.code, errorMessage, error);
    }
  }, [authService, userService, setCurrentUser, navigate]);

  // ========== GOOGLE AUTH (UNCHANGED - WORKING) ==========
  const signInWithGoogle = useCallback(async (options = {}) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('🔐 ENTERPRISE: Starting Google authentication...');
      
      const result = await authService.signInWithGoogle(options);
      
      if (!result.success) {
        throw new AuthError('auth/google-failed', result.error || 'Google authentication failed');
      }
      
      console.log('✅ ENTERPRISE: Google auth successful. New user:', result.isNewUser);
      
      // Sync with app store
      const userData = {
        uid: result.user.uid,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
        username: result.user.username || result.user.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${result.user.uid?.slice(0, 8)}`,
        photoURL: result.user.photoURL || "/assets/default-profile.png",
        isNewUser: result.isNewUser,
        requiresProfileCompletion: result.isNewUser,
        authProvider: 'google',
        isOnline: true,
        lastActive: new Date().toISOString(),
        createdAt: result.user.metadata?.creationTime || new Date().toISOString()
      };
      
      setCurrentUser(userData);
      
      if (result.isNewUser) {
        // Store pending profile data
        StorageManager.set('pending_profile_creation', {
          userId: result.user.uid,
          method: 'google',
          userData: result.user,
          timestamp: Date.now()
        });
        
        toast.success('Google authentication successful! Setting up your profile...');
        
        // Return navigation instructions
        return {
          ...result,
          requiresNavigation: true,
          navigateTo: '/setup-profile'
        };
      }
      
      toast.success('Welcome back!');
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Google auth error:', error);
      
      // Don't show toast for user-cancelled operations
      if (error.code !== 'auth/popup-closed-by-user' && 
          error.code !== 'auth/cancelled-popup-request') {
        toast.error(error.message || 'Google sign-in failed');
        setError(error.message);
      }
      throw error;
      
    } finally {
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService, setCurrentUser]);

  // ========== REAL PHONE VERIFICATION (UNCHANGED - WORKING) ==========
  const sendPhoneVerificationCode = useCallback(async (phoneNumber, recaptchaVerifier) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      setIsSignupInProgress(true);
      setError(null);
      
      console.log('📱 ENTERPRISE: Sending phone verification:', phoneNumber);
      
      const result = await authService.sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);
      
      if (!result.success) {
        throw new AuthError('auth/phone-failed', result.error || 'Failed to send verification code');
      }
      
      toast.success(`✅ 6-digit code sent to ${result.phoneNumber}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Phone verification failed:', error);
      
      let errorMessage = 'Failed to send verification code';
      const errorCode = error.code || 'auth/unknown-error';
      
      const errorMap = {
        'auth/invalid-phone-number': 'Invalid phone number format. Use international format: +1234567890',
        'auth/quota-exceeded': 'SMS quota exceeded. Please try again in 24 hours.',
        'auth/captcha-check-failed': 'Security check failed. Please complete the reCAPTCHA again.',
        'auth/too-many-requests': 'Too many attempts. Please wait 5 minutes before trying again.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/app-not-authorized': 'Phone authentication not enabled. Please use email or Google signup.'
      };
      
      errorMessage = errorMap[errorCode] || error.message || errorMessage;
      
      toast.error(errorMessage);
      throw new AuthError(errorCode, errorMessage, error);
      
    } finally {
      if (isMounted.current) {
        setIsSignupInProgress(false);
      }
    }
  }, [authService]);

  // ========== REAL OTP VERIFICATION (UNCHANGED - WORKING) ==========
  const verifyPhoneOTP = useCallback(async (verificationId, otp) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      setError(null);
      
      console.log('🔢 ENTERPRISE: Verifying phone OTP...');
      
      const result = await authService.verifyPhoneOTP(verificationId, otp);
      
      if (!result.success) {
        throw new AuthError('auth/otp-failed', result.error || 'Failed to verify OTP');
      }
      
      console.log('✅ ENTERPRISE: Phone verification successful:', result.user.uid);
      
      // Sync with app store
      const userData = {
        uid: result.user.uid,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        displayName: result.user.displayName || `Phone User ${result.user.phoneNumber}`,
        username: result.user.username || `phone_${result.user.phoneNumber?.replace(/\D/g, '')}` || `user_${result.user.uid?.slice(0, 8)}`,
        photoURL: result.user.photoURL || "/assets/default-profile.png",
        phoneNumber: result.user.phoneNumber,
        isNewUser: result.isNewUser,
        requiresProfileCompletion: result.isNewUser,
        authProvider: 'phone',
        isOnline: true,
        lastActive: new Date().toISOString(),
        createdAt: result.user.metadata?.creationTime || new Date().toISOString()
      };
      
      setCurrentUser(userData);
      
      if (result.isNewUser) {
        // Store pending profile data
        StorageManager.set('pending_profile_creation', {
          userId: result.user.uid,
          method: 'phone',
          userData: result.user,
          timestamp: Date.now()
        });
        
        toast.success('Phone number verified successfully! Setting up your profile...');
      } else {
        toast.success('Phone number verified successfully!');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: OTP verification failed:', error);
      
      let errorMessage = 'Failed to verify OTP';
      const errorCode = error.code || 'auth/unknown-error';
      
      const errorMap = {
        'auth/invalid-verification-code': 'Invalid verification code',
        'auth/code-expired': 'Code expired. Please request a new one.',
        'auth/credential-already-in-use': 'This phone number is already linked to another account.',
        'auth/invalid-verification-id': 'Session expired. Please request a new verification code.',
        'auth/too-many-requests': 'Too many attempts. Please wait before trying again.'
      };
      
      errorMessage = errorMap[errorCode] || error.message || errorMessage;
      
      toast.error(errorMessage);
      throw new AuthError(errorCode, errorMessage, error);
    }
  }, [authService, setCurrentUser]);

  // ========== EMAIL VERIFICATION CHECK (UPDATED) ==========
  const checkEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      console.log('📧 ENTERPRISE: Checking email verification for:', userId);
      
      const result = await authService.checkEmailVerification(userId);
      
      if (result.verified && result.user) {
        // Sync with app store
        const userData = {
          uid: result.user.uid,
          email: result.user.email,
          emailVerified: true,
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          username: result.user.username || result.user.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `user_${result.user.uid?.slice(0, 8)}`,
          photoURL: result.user.photoURL || "/assets/default-profile.png",
          authProvider: 'email',
          isNewUser: result.user.isNewUser,
          requiresProfileCompletion: result.user.requiresProfileCompletion,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: result.user.metadata?.creationTime || new Date().toISOString()
        };
        
        setCurrentUser(userData);
        
        // Store pending profile data
        StorageManager.set('pending_profile_creation', {
          userId: result.user.uid,
          method: 'email',
          userData: result.user,
          timestamp: Date.now()
        });
        
        toast.success('Email verified successfully! Setting up your profile...');
        
        return result;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Email verification check failed:', error);
      return { verified: false, error: error.message };
    }
  }, [authService, setCurrentUser]);
  
  const resendEmailVerification = useCallback(async (userId) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      const result = await authService.resendEmailVerification(userId);
      
      toast.success('Verification email resent!');
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Failed to resend verification:', error);
      
      const errorMessage = error.code === 'auth/too-many-requests'
        ? 'Too many resend attempts. Please try again later.'
        : error.message || 'Failed to resend verification';
      
      toast.error(errorMessage);
      throw new AuthError(error.code, errorMessage, error);
    }
  }, [authService]);

  // ========== RECAPTCHA MANAGEMENT (UNCHANGED - WORKING) ==========
  const createRecaptchaVerifier = useCallback(async (containerId, options = {}) => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      console.log('🔄 ENTERPRISE: Creating reCAPTCHA verifier for:', containerId);
      
      const verifier = await authService.createRecaptchaVerifier(containerId, options);
      
      console.log('✅ ENTERPRISE: reCAPTCHA verifier created');
      return verifier;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Failed to create reCAPTCHA verifier:', error);
      throw error;
    }
  }, [authService]);
  
  const cleanupRecaptchaVerifier = useCallback((containerId) => {
    if (!authService) return;
    
    try {
      authService.cleanupRecaptchaVerifier(containerId);
      console.log('✅ ENTERPRISE: reCAPTCHA verifier cleaned up');
    } catch (error) {
      console.warn('Failed to cleanup reCAPTCHA verifier:', error);
    }
  }, [authService]);

  // ========== PROFILE MANAGEMENT (UNCHANGED - WORKING) ==========
  const createUserProfile = useCallback(async (profileData) => {
    if (!userService || !user) throw new AuthError('auth/service-not-ready', 'Services not ready');
    
    try {
      console.log('👤 ENTERPRISE: Creating user profile for:', user.uid);
      
      const result = await userService.createUserProfile(user.uid, profileData);
      
      if (isMounted.current) {
        setUserProfile(result.profile);
      }
      
      // Sync with app store
      syncUserWithAppStore(user, result.profile, setCurrentUser);
      
      // Clear all signup session data
      StorageManager.clearAll();
      
      toast.success('Profile created successfully!');
      
      return result;
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Profile creation failed:', error);
      toast.error('Failed to create profile');
      throw error;
    }
  }, [userService, user, setCurrentUser]);
  
  const updateUserProfile = useCallback(async (updates) => {
    if (!userService || !user) throw new AuthError('auth/service-not-ready', 'Services not ready');
    
    try {
      await userService.updateUserProfile(user.uid, updates);
      
      if (isMounted.current) {
        setUserProfile(prev => ({ ...prev, ...updates }));
      }
      
      // Update app store
      const updatedProfile = { ...userProfile, ...updates };
      syncUserWithAppStore(user, updatedProfile, setCurrentUser);
      
      toast.success('Profile updated!');
      
    } catch (error) {
      toast.error('Failed to update profile');
      throw error;
    }
  }, [userService, user, userProfile, setCurrentUser]);

  // ========== SIGN OUT (UNCHANGED - WORKING) ==========
  const signOut = useCallback(async () => {
    if (!authService) throw new AuthError('auth/service-not-ready', 'Auth service not ready');
    
    try {
      await authService.signOut();
      
      // Clear all state
      if (isMounted.current) {
        setUser(null);
        setUserProfile(null);
        setIsSignupInProgress(false);
        setPendingVerification(null);
      }
      
      // Clear app store
      clearUserData();
      
      // Clear all storage
      StorageManager.clearAll();
      
      toast.success('Signed out successfully');
      
      // Navigate to home
      if (isMounted.current) {
        navigate('/', { replace: true });
      }
      
    } catch (error) {
      console.error('❌ ENTERPRISE: Sign out failed:', error);
      toast.error('Failed to sign out');
      throw error;
    }
  }, [authService, navigate, clearUserData]);

  // ========== UTILITY FUNCTIONS ==========
  const getCurrentUser = useCallback(() => {
    return user;
  }, [user]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const resetSignupState = useCallback(() => {
    setIsSignupInProgress(false);
    setPendingVerification(null);
    StorageManager.clearAll();
  }, []);

  // ========== AUTO UPDATE LAST ACTIVE ==========
  useEffect(() => {
    if (!user || !isMounted.current) return;
    
    const interval = setInterval(() => {
      if (user && setCurrentUser) {
        // Update last active time every minute
        const { updateUserLastActive } = useAppStore.getState();
        updateUserLastActive();
      }
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [user, setCurrentUser]);

  // ========== CHECK FOR UNVERIFIED LOGIN ATTEMPTS ==========
  useEffect(() => {
    // Check if user arrived from unverified login attempt
    const unverifiedUser = StorageManager.get('email_not_verified_user');
    if (unverifiedUser && location.pathname !== '/verify-email') {
      StorageManager.remove('email_not_verified_user');
    }
  }, [location]);

  // ========== CONTEXT VALUE ==========
  const contextValue = {
    // State
    user,
    userProfile,
    loading,
    error,
    isSignupInProgress,
    pendingVerification,
    authInitialized,
    securityChecks,
    
    // Services
    authService,
    userService,
    
    // Status
    isAuthenticated: !!user,
    isEmailVerified: !!(user && user.emailVerified),
    isProfileComplete: !!(userProfile && userProfile.isProfileComplete),
    
    // Auth Methods
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    sendPhoneVerificationCode,
    verifyPhoneOTP,
    signOut,
    checkEmailVerification,
    resendEmailVerification,
    
    // Security
    createRecaptchaVerifier,
    cleanupRecaptchaVerifier,
    
    // Profile Management
    createUserProfile,
    updateUserProfile,
    
    // Utilities
    getCurrentUser,
    clearError,
    resetSignupState
  };

  // ========== LOADING STATE ==========
  if (loading && !authInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            </div>
          </div>
          <p className="text-white text-lg font-medium mb-2">Initializing Enterprise Authentication</p>
          <p className="text-gray-400 text-sm">Securing your connection...</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {Object.entries(securityChecks).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className="text-xs text-gray-500">{key}</span>
              </div>
            ))}
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

// ========== USE AUTH HOOK ==========
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}