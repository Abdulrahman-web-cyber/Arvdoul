\/\/ src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  reauthenticateWithCredential,
  EmailAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  getAdditionalUserInfo
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { toast } from 'sonner';

\/\/ Security constants
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, \/\/ 15 minutes
  PASSWORD_MIN_LENGTH: 8,
  SESSION_TIMEOUT: 30 * 60 * 1000, \/\/ 30 minutes
  TOKEN_REFRESH_INTERVAL: 10 * 60 * 1000, \/\/ 10 minutes
};

\/\/ Security event types
const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  PROFILE_UPDATE: 'profile_update',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_UNLOCKED: 'account_unlocked',
  SESSION_EXPIRED: 'session_expired',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
};

\/\/ Create context
const AuthContext = createContext(null);

\/\/ Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

\/\/ Security logger
const createSecurityLogger = (userId) => {
  const logEvent = (eventType, details = {}) => {
    const logEntry = {
      userId,
      eventType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: '127.0.0.1', \/\/ In production, get from request headers
      details
    };
    
    \/\/ In production, send to security monitoring service
    console.log('[SECURITY LOG]:', logEntry);
    
    \/\/ Also store in localStorage for debugging
    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    logs.push(logEntry);
    if (logs.length > 100) logs.shift(); \/\/ Keep last 100 logs
    localStorage.setItem('security_logs', JSON.stringify(logs));
  };
  
  return { logEvent };
};

\/\/ Rate limiter
const createRateLimiter = (maxAttempts, lockoutDuration) => {
  const attempts = new Map();
  
  const check = (identifier) => {
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];
    
    \/\/ Clean old attempts
    const recentAttempts = userAttempts.filter(time => now - time < lockoutDuration);
    
    if (recentAttempts.length >= maxAttempts) {
      return { allowed: false, remaining: 0 };
    }
    
    return { 
      allowed: true, 
      remaining: maxAttempts - recentAttempts.length 
    };
  };
  
  const recordAttempt = (identifier) => {
    const userAttempts = attempts.get(identifier) || [];
    userAttempts.push(Date.now());
    attempts.set(identifier, userAttempts);
  };
  
  const reset = (identifier) => {
    attempts.delete(identifier);
  };
  
  return { check, recordAttempt, reset };
};

\/\/ Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [loginAttempts, setLoginAttempts] = useState({});
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);

  \/\/ Initialize rate limiter
  const rateLimiter = useMemo(() => 
    createRateLimiter(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS, SECURITY_CONFIG.LOCKOUT_DURATION),
    []
  );

  \/\/ Initialize security logger
  const securityLogger = useMemo(() => 
    createSecurityLogger(user?.uid || 'anonymous'),
    [user?.uid]
  );

  \/\/ Initialize reCAPTCHA
  const initializeRecaptcha = useCallback((containerId) => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        }
      });
    }
    setRecaptchaVerifier(window.recaptchaVerifier);
  }, []);

  \/\/ Security event logger
  const logSecurityEvent = useCallback((eventType, details = {}) => {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || null,
      details
    };
    
    setSecurityEvents(prev => [...prev.slice(-49), event]); \/\/ Keep last 50 events
    
    \/\/ Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH SECURITY] ${eventType}:`, details);
    }
  }, [user]);

  \/\/ Check rate limiting
  const checkRateLimit = useCallback((identifier) => {
    const result = rateLimiter.check(identifier);
    
    if (!result.allowed) {
      logSecurityEvent(SECURITY_EVENTS.ACCOUNT_LOCKED, { identifier });
      toast.error('Too many failed attempts. Account temporarily locked.');
      return false;
    }
    
    return true;
  }, [rateLimiter, logSecurityEvent]);

  \/\/ Record failed attempt
  const recordFailedAttempt = useCallback((identifier) => {
    rateLimiter.recordAttempt(identifier);
    logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { identifier });
  }, [rateLimiter, logSecurityEvent]);

  \/\/ Reset attempts
  const resetAttempts = useCallback((identifier) => {
    rateLimiter.reset(identifier);
    logSecurityEvent(SECURITY_EVENTS.ACCOUNT_UNLOCKED, { identifier });
  }, [rateLimiter, logSecurityEvent]);

  \/\/ Session management
  const updateSessionExpiry = useCallback(() => {
    const expiry = Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT;
    setSessionExpiry(expiry);
    localStorage.setItem('session_expiry', expiry.toString());
  }, []);

  const checkSessionExpiry = useCallback(() => {
    if (!sessionExpiry) return true;
    
    if (Date.now() > sessionExpiry) {
      logSecurityEvent(SECURITY_EVENTS.SESSION_EXPIRED);
      handleLogout();
      return false;
    }
    
    return true;
  }, [sessionExpiry]);

  \/\/ Initialize session timer
  useEffect(() => {
    if (user) {
      updateSessionExpiry();
      
      \/\/ Refresh session periodically
      const refreshInterval = setInterval(() => {
        if (checkSessionExpiry()) {
          updateSessionExpiry();
        }
      }, SECURITY_CONFIG.TOKEN_REFRESH_INTERVAL);
      
      \/\/ Check session expiry periodically
      const expiryCheckInterval = setInterval(() => {
        checkSessionExpiry();
      }, 60000); \/\/ Check every minute
      
      return () => {
        clearInterval(refreshInterval);
        clearInterval(expiryCheckInterval);
      };
    }
  }, [user, updateSessionExpiry, checkSessionExpiry]);

  \/\/ Validate password strength
  const validatePassword = useCallback((password) => {
    const errors = [];
    
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`);
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    \/\/ Check common passwords
    const commonPasswords = [
      'password', '123456', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', 'dragon', 'baseball', 'football'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('This password is too common and insecure');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' : 'weak'
    };
  }, []);

  \/\/ Create user document in Firestore
  const createUserDocument = useCallback(async (userData) => {
    try {
      const userRef = doc(db, 'users', userData.uid);
      const userDoc = {
        uid: userData.uid,
        email: userData.email || null,
        phone: userData.phoneNumber || null,
        emailVerified: userData.emailVerified || false,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        security: {
          twoFactorEnabled: false,
          loginAttempts: 0,
          lastFailedAttempt: null,
          accountLockedUntil: null
        },
        preferences: {
          theme: 'system',
          notifications: true,
          language: 'en'
        }
      };
      
      await setDoc(userRef, userDoc);
      return userDoc;
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  }, []);

  \/\/ Update user document
  const updateUserDocument = useCallback(async (userId, updates) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user document:', error);
      throw error;
    }
  }, []);

  \/\/ Get user document
  const getUserDocument = useCallback(async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error getting user document:', error);
      return null;
    }
  }, []);

  \/\/ Check if email exists
  const checkEmailExists = useCallback(async (email) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }, []);

  \/\/ Check if phone exists
  const checkPhoneExists = useCallback(async (phone) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phone', '==', phone));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking phone:', error);
      return false;
    }
  }, []);

  \/\/ Check if username exists
  const checkUsernameExists = useCallback(async (username) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('displayName', '==', username));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  }, []);

  \/\/ Sign up with email and password
  const signUpWithEmail = useCallback(async (email, password, userData = {}) => {
    setAuthLoading(true);
    
    try {
      \/\/ Check if email already exists
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        throw new Error('Email already registered');
      }
      
      \/\/ Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors[0]);
      }
      
      \/\/ Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user: firebaseUser } = userCredential;
      
      \/\/ Update profile with user data
      if (userData.displayName) {
        await updateProfile(firebaseUser, {
          displayName: userData.displayName,
          ...(userData.photoURL && { photoURL: userData.photoURL })
        });
      }
      
      \/\/ Create user document in Firestore
      await createUserDocument({
        ...firebaseUser,
        displayName: userData.displayName || '',
        ...userData
      });
      
      \/\/ Update local state
      setUser({
        ...firebaseUser,
        metadata: await getUserDocument(firebaseUser.uid)
      });
      
      updateSessionExpiry();
      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, { method: 'email_signup' });
      
      toast.success('Account created successfully!');
      return { success: true, user: firebaseUser };
      
    } catch (error) {
      console.error('Sign up error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      toast.error(errorMessage);
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { method: 'email_signup', error: error.message });
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, [checkEmailExists, validatePassword, createUserDocument, updateSessionExpiry, logSecurityEvent]);

  \/\/ Sign up with phone number
  const signUpWithPhone = useCallback(async (phoneNumber, userData = {}) => {
    setAuthLoading(true);
    
    try {
      \/\/ Check if phone already exists
      const phoneExists = await checkPhoneExists(phoneNumber);
      if (phoneExists) {
        throw new Error('Phone number already registered');
      }
      
      \/\/ In production, you would use Firebase Phone Auth
      \/\/ For now, simulate successful signup
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Phone verification initiated!');
      return { success: true, requiresVerification: true };
      
    } catch (error) {
      console.error('Phone sign up error:', error);
      toast.error(error.message || 'Failed to initiate phone signup');
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { method: 'phone_signup', error: error.message });
      return { success: false, error: error.message };
      
    } finally {
      setAuthLoading(false);
    }
  }, [checkPhoneExists, logSecurityEvent]);

  \/\/ Login with email and password
  const loginWithEmail = useCallback(async (email, password, rememberMe = false) => {
    setAuthLoading(true);
    
    try {
      \/\/ Check rate limiting
      if (!checkRateLimit(email)) {
        return { success: false, error: 'Account temporarily locked' };
      }
      
      \/\/ Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { user: firebaseUser } = userCredential;
      
      \/\/ Get user document
      const userDoc = await getUserDocument(firebaseUser.uid);
      
      \/\/ Update last login
      await updateUserDocument(firebaseUser.uid, {
        lastLoginAt: serverTimestamp(),
        'security.loginAttempts': 0
      });
      
      \/\/ Update local state
      setUser({
        ...firebaseUser,
        metadata: userDoc
      });
      
      updateSessionExpiry();
      resetAttempts(email);
      
      \/\/ Store remember me preference
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
        localStorage.setItem('remembered_email', email);
      }
      
      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, { method: 'email', userId: firebaseUser.uid });
      toast.success('Login successful!');
      
      return { success: true, user: firebaseUser };
      
    } catch (error) {
      console.error('Login error:', error);
      
      \/\/ Record failed attempt
      recordFailedAttempt(email);
      
      let errorMessage = 'Login failed';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Account temporarily locked.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Account has been disabled';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      toast.error(errorMessage);
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { method: 'email', email, error: error.message });
      
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, [checkRateLimit, getUserDocument, updateUserDocument, updateSessionExpiry, resetAttempts, recordFailedAttempt, logSecurityEvent]);

  \/\/ Login with phone number
  const loginWithPhone = useCallback(async (phoneNumber, password) => {
    setAuthLoading(true);
    
    try {
      \/\/ Check rate limiting
      if (!checkRateLimit(phoneNumber)) {
        return { success: false, error: 'Account temporarily locked' };
      }
      
      \/\/ In production, you would use Firebase Phone Auth
      \/\/ For now, simulate login
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      \/\/ Simulated user
      const simulatedUser = {
        uid: `phone_${Date.now()}`,
        phoneNumber,
        emailVerified: false,
        displayName: 'Phone User'
      };
      
      setUser(simulatedUser);
      updateSessionExpiry();
      resetAttempts(phoneNumber);
      
      logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, { method: 'phone', userId: simulatedUser.uid });
      toast.success('Login successful!');
      
      return { success: true, user: simulatedUser };
      
    } catch (error) {
      console.error('Phone login error:', error);
      
      recordFailedAttempt(phoneNumber);
      toast.error('Phone login failed');
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { method: 'phone', phoneNumber, error: error.message });
      
      return { success: false, error: error.message };
      
    } finally {
      setAuthLoading(false);
    }
  }, [checkRateLimit, updateSessionExpiry, resetAttempts, recordFailedAttempt, logSecurityEvent]);

  \/\/ Verify phone OTP
  const verifyPhoneOtp = useCallback(async (verificationId, verificationCode) => {
    setAuthLoading(true);
    
    try {
      \/\/ In production, use PhoneAuthProvider.credential
      \/\/ const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      \/\/ await signInWithCredential(auth, credential);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Phone verified successfully!');
      return { success: true };
      
    } catch (error) {
      console.error('OTP verification error:', error);
      
      let errorMessage = 'Verification failed';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code has expired';
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, []);

  \/\/ Send password reset email
  const sendPasswordReset = useCallback(async (email) => {
    setAuthLoading(true);
    
    try {
      \/\/ Check if email exists
      const emailExists = await checkEmailExists(email);
      if (!emailExists) {
        throw new Error('No account found with this email');
      }
      
      \/\/ Send password reset email
      await sendPasswordResetEmail(auth, email);
      
      logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET, { email });
      toast.success('Password reset email sent!');
      
      return { success: true };
      
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, [checkEmailExists, logSecurityEvent]);

  \/\/ Confirm password reset
  const confirmPasswordReset = useCallback(async (code, newPassword) => {
    setAuthLoading(true);
    
    try {
      \/\/ Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors[0]);
      }
      
      \/\/ Confirm password reset
      await confirmPasswordReset(auth, code, newPassword);
      
      logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET, { action: 'confirmed' });
      toast.success('Password reset successfully!');
      
      return { success: true };
      
    } catch (error) {
      console.error('Confirm password reset error:', error);
      
      let errorMessage = 'Failed to reset password';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Reset code has expired';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid reset code';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, [validatePassword, logSecurityEvent]);

  \/\/ Update user password
  const updateUserPassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    
    setAuthLoading(true);
    
    try {
      \/\/ Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      \/\/ Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors[0]);
      }
      
      \/\/ Update password
      await updatePassword(user, newPassword);
      
      logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET, { action: 'updated', userId: user.uid });
      toast.success('Password updated successfully!');
      
      return { success: true };
      
    } catch (error) {
      console.error('Update password error:', error);
      
      let errorMessage = 'Failed to update password';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please reauthenticate to change password';
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
      
    } finally {
      setAuthLoading(false);
    }
  }, [user, validatePassword, logSecurityEvent]);

  \/\/ Update user profile
  const updateUserProfile = useCallback(async (updates) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    
    setAuthLoading(true);
    
    try {
      \/\/ Update in Firebase Auth
      await updateProfile(user, updates);
      
      \/\/ Update in Firestore
      await updateUserDocument(user.uid, updates);
      
      \/\/ Update local state
      setUser(prev => ({
        ...prev,
        ...updates,
        metadata: { ...prev.metadata, ...updates }
      }));
      
      logSecurityEvent(SECURITY_EVENTS.PROFILE_UPDATE, { userId: user.uid, updates });
      toast.success('Profile updated successfully!');
      
      return { success: true };
      
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
      return { success: false, error: error.message };
      
    } finally {
      setAuthLoading(false);
    }
  }, [user, updateUserDocument, logSecurityEvent]);

  \/\/ Logout
  const handleLogout = useCallback(async () => {
    setAuthLoading(true);
    
    try {
      await signOut(auth);
      
      setUser(null);
      setSessionExpiry(null);
      
      \/\/ Clear session data
      localStorage.removeItem('session_expiry');
      localStorage.removeItem('remembered_email');
      
      logSecurityEvent(SECURITY_EVENTS.LOGOUT, { userId: user?.uid });
      toast.success('Logged out successfully');
      
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
      
    } finally {
      setAuthLoading(false);
    }
  }, [user, logSecurityEvent]);

  \/\/ Reauthenticate user
  const reauthenticateUser = useCallback(async (password) => {
    if (!user || !user.email) {
      throw new Error('No user logged in');
    }
    
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      return { success: true };
    } catch (error) {
      console.error('Reauthentication error:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  \/\/ Check user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        \/\/ Get user document from Firestore
        const userDoc = await getUserDocument(firebaseUser.uid);
        
        setUser({
          ...firebaseUser,
          metadata: userDoc
        });
        
        updateSessionExpiry();
        logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, { method: 'session_restore', userId: firebaseUser.uid });
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, [getUserDocument, updateSessionExpiry, logSecurityEvent]);

  \/\/ Context value
  const contextValue = useMemo(() => ({
    \/\/ State
    user,
    loading,
    authLoading,
    sessionExpiry,
    securityEvents,
    recaptchaVerifier,
    
    \/\/ Authentication methods
    signUpWithEmail,
    signUpWithPhone,
    loginWithEmail,
    loginWithPhone,
    verifyPhoneOtp,
    handleLogout,
    
    \/\/ Password management
    sendPasswordReset,
    confirmPasswordReset,
    updateUserPassword,
    
    \/\/ Profile management
    updateUserProfile,
    reauthenticateUser,
    
    \/\/ Validation methods
    validatePassword,
    checkEmailExists,
    checkPhoneExists,
    checkUsernameExists,
    
    \/\/ Security methods
    checkRateLimit,
    resetAttempts,
    checkSessionExpiry,
    
    \/\/ Utility methods
    initializeRecaptcha,
    logSecurityEvent,
    getUserDocument,
    updateUserDocument
  }), [
    user,
    loading,
    authLoading,
    sessionExpiry,
    securityEvents,
    recaptchaVerifier,
    signUpWithEmail,
    signUpWithPhone,
    loginWithEmail,
    loginWithPhone,
    verifyPhoneOtp,
    handleLogout,
    sendPasswordReset,
    confirmPasswordReset,
    updateUserPassword,
    updateUserProfile,
    reauthenticateUser,
    validatePassword,
    checkEmailExists,
    checkPhoneExists,
    checkUsernameExists,
    checkRateLimit,
    resetAttempts,
    checkSessionExpiry,
    initializeRecaptcha,
    logSecurityEvent,
    getUserDocument,
    updateUserDocument
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

\/\/ Higher-order component for protected routes
export const withAuth = (Component) => {
  return function WithAuthComponent(props) {
    const { user, loading, checkSessionExpiry } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
      if (!loading && !user) {
        navigate('/login', { replace: true });
      }
      
      if (user && !checkSessionExpiry()) {
        navigate('/login', { replace: true });
      }
    }, [user, loading, navigate, checkSessionExpiry]);
    
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    
    if (!user) {
      return null;
    }
    
    return <Component {...props} />;
  };
};