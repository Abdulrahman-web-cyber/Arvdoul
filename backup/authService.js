// src/services/authService.js - ARVDOUL AUTHENTICATION SERVICE
// 🔐 Production-grade authentication - All issues fixed
// ⚡ Perfect Firebase v12.7.0 compliance
// 🎯 Mobile/PWA ready with fallbacks

import { getAuthInstance } from '../firebase/firebase.js';

// ========== STATIC SDK IMPORTS (NO DYNAMIC) ==========
import { 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult as firebaseGetRedirectResult,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updatePassword as firebaseUpdatePassword,
  signOut as firebaseSignOut
} from 'firebase/auth';

// ========== SERVICE CONFIGURATION ==========
const getCurrentAuth = () => {
  try {
    return getAuthInstance();
  } catch (error) {
    console.error('[AuthService] Failed to get auth instance:', error);
    throw new Error('Authentication service unavailable. Please try again.');
  }
};

// ========== HEALTH CHECK ==========
export const checkAuthServiceHealth = async () => {
  try {
    const auth = getCurrentAuth();
    
    const checks = {
      authInstance: !!auth,
      currentUser: !!auth.currentUser,
      network: navigator.onLine,
      timestamp: Date.now()
    };
    
    return {
      status: 'healthy',
      ...checks
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    };
  }
};

// ========== GOOGLE AUTHENTICATION ==========
export const signInWithGoogleService = async (options = {}) => {
  try {
    const auth = getCurrentAuth();
    
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ 
      prompt: 'select_account',
      ...(options.loginHint && { login_hint: options.loginHint })
    });
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const prefersRedirect = isMobile || options.forceRedirect;
    
    let result;
    
    if (prefersRedirect) {
      await signInWithRedirect(auth, provider);
      return {
        success: true,
        redirecting: true,
        method: 'redirect'
      };
    } else {
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError) {
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, provider);
          return {
            success: true,
            redirecting: true,
            method: 'redirect_fallback'
          };
        }
        throw popupError;
      }
    }
    
    const user = result.user;
    const additionalInfo = getAdditionalUserInfo(result);
    
    console.log('✅ Google authentication successful:', user.uid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        phoneNumber: user.phoneNumber,
        metadata: {
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime
        }
      },
      isNewUser: additionalInfo?.isNewUser || false,
      providerId: additionalInfo?.providerId || null
    };
    
  } catch (error) {
    console.error('❌ Google authentication error:', error);
    
    const errorMap = {
      'auth/popup-closed-by-user': 'Sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Multiple sign-in attempts detected.',
      'auth/unauthorized-domain': 'This domain is not authorized.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled.',
      'auth/network-request-failed': 'Network error.',
      'auth/internal-error': 'Internal authentication error.',
      'auth/account-exists-with-different-credential': 'An account already exists.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found.',
      'default': 'Google sign-in failed.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== HANDLE REDIRECT RESULT ==========
export const handleRedirectResultService = async () => {
  try {
    const auth = getCurrentAuth();
    const result = await firebaseGetRedirectResult(auth);
    
    if (!result) {
      return { success: false, reason: 'no_redirect_result' };
    }
    
    const user = result.user;
    const additionalInfo = getAdditionalUserInfo(result);
    
    if (!user) {
      return { success: false, reason: 'no_user_in_result' };
    }
    
    console.log('✅ Redirect authentication successful:', user.uid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        metadata: {
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime
        }
      },
      isNewUser: additionalInfo?.isNewUser || false
    };
    
  } catch (error) {
    console.error('❌ Redirect result error:', error);
    
    const errorMap = {
      'auth/account-exists-with-different-credential': 'An account already exists.',
      'auth/credential-already-in-use': 'This credential is already associated.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/operation-not-allowed': 'This authentication method is not enabled.',
      'default': 'Failed to complete authentication.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== EMAIL/PASSWORD AUTHENTICATION ==========
export const signInWithEmailPasswordService = async (email, password) => {
  try {
    const auth = getCurrentAuth();
    
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    console.log('✅ Email authentication successful:', user.uid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        metadata: {
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Email authentication error:', error);
    
    const errorMap = {
      'auth/invalid-email': 'Invalid email address format.',
      'auth/user-not-found': 'No account found.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many failed attempts.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-token-expired': 'Session expired.',
      'auth/network-request-failed': 'Network error.',
      'auth/internal-error': 'Internal authentication error.',
      'default': 'Sign in failed.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== USER CREATION ==========
export const createUserWithEmailPasswordService = async (email, password, profileData = {}) => {
  try {
    const auth = getCurrentAuth();
    
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    const additionalInfo = getAdditionalUserInfo(result);
    
    if (profileData.displayName || profileData.photoURL) {
      await firebaseUpdateProfile(user, {
        displayName: profileData.displayName || '',
        photoURL: profileData.photoURL || null
      });
    }
    
    firebaseSendEmailVerification(user).catch(error => {
      console.warn('Email verification sending failed:', error.message);
    });
    
    console.log('✅ User creation successful:', user.uid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || profileData.displayName || '',
        emailVerified: user.emailVerified,
        isNewUser: additionalInfo?.isNewUser || true,
        metadata: {
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime
        }
      }
    };
    
  } catch (error) {
    console.error('❌ User creation error:', error);
    
    const errorMap = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Invalid email address format.',
      'auth/weak-password': 'Password is too weak.',
      'auth/operation-not-allowed': 'Email/password sign-up is not enabled.',
      'auth/network-request-failed': 'Network error.',
      'auth/internal-error': 'Internal authentication error.',
      'default': 'Account creation failed.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== PASSWORD MANAGEMENT ==========
export const sendPasswordResetEmailService = async (email) => {
  try {
    const auth = getCurrentAuth();
    
    if (!email) {
      throw new Error('Email is required');
    }
    
    await firebaseSendPasswordResetEmail(auth, email);
    
    console.log('✅ Password reset email sent to:', email);
    
    return { 
      success: true,
      message: 'Password reset email sent.'
    };
    
  } catch (error) {
    console.error('❌ Password reset error:', error);
    
    const errorMap = {
      'auth/user-not-found': 'No account found.',
      'auth/invalid-email': 'Invalid email address format.',
      'auth/too-many-requests': 'Too many attempts.',
      'auth/network-request-failed': 'Network error.',
      'default': 'Failed to send reset email.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

export const confirmPasswordResetService = async (code, newPassword) => {
  try {
    const auth = getCurrentAuth();
    
    if (!code || !newPassword) {
      throw new Error('Reset code and new password are required');
    }
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    await firebaseConfirmPasswordReset(auth, code, newPassword);
    
    console.log('✅ Password reset successful');
    
    return { 
      success: true,
      message: 'Password has been reset successfully.'
    };
    
  } catch (error) {
    console.error('❌ Password reset confirmation error:', error);
    
    const errorMap = {
      'auth/expired-action-code': 'Reset code has expired.',
      'auth/invalid-action-code': 'Invalid reset code.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found.',
      'auth/weak-password': 'Password is too weak.',
      'default': 'Password reset failed.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== PROFILE MANAGEMENT ==========
export const updateAuthProfileService = async (profileData) => {
  try {
    const auth = getCurrentAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No authenticated user found.');
    }
    
    if (!profileData || (Object.keys(profileData).length === 0)) {
      throw new Error('No profile data provided');
    }
    
    await firebaseUpdateProfile(user, profileData);
    
    console.log('✅ Auth profile updated:', user.uid);
    
    return { 
      success: true, 
      user: {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    
    const errorMap = {
      'auth/requires-recent-login': 'Please sign in again.',
      'auth/network-request-failed': 'Network error.',
      'auth/too-many-requests': 'Too many attempts.',
      'default': 'Failed to update profile.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

export const updateUserPasswordService = async (newPassword) => {
  try {
    const auth = getCurrentAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No authenticated user found.');
    }
    
    if (!newPassword) {
      throw new Error('New password is required');
    }
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    await firebaseUpdatePassword(user, newPassword);
    
    console.log('✅ Password updated:', user.uid);
    
    return { 
      success: true,
      message: 'Password updated successfully.'
    };
    
  } catch (error) {
    console.error('❌ Password update error:', error);
    
    const errorMap = {
      'auth/requires-recent-login': 'Please sign in again.',
      'auth/weak-password': 'Password is too weak.',
      'auth/network-request-failed': 'Network error.',
      'default': 'Failed to update password.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== PHONE AUTHENTICATION ==========
export const createRecaptchaVerifier = (containerId, options = {}) => {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only run in the browser');
  }
  
  try {
    const auth = getCurrentAuth();
    
    if (window.arvdoulRecaptchaVerifier) {
      try {
        window.arvdoulRecaptchaVerifier.clear();
      } catch (clearError) {
        // Ignore
      }
      window.arvdoulRecaptchaVerifier = null;
    }
    
    const recaptchaVerifier = new RecaptchaVerifier(
      containerId,
      {
        size: options.size || 'invisible',
        callback: (response) => {
          console.log('✅ reCAPTCHA verified');
          if (options.onVerified) {
            options.onVerified(response);
          }
        },
        'expired-callback': () => {
          console.warn('⚠️ reCAPTCHA expired');
          if (options.onExpired) {
            options.onExpired();
          }
        }
      },
      auth
    );
    
    window.arvdoulRecaptchaVerifier = recaptchaVerifier;
    
    console.log('✅ reCAPTCHA verifier created');
    return recaptchaVerifier;
    
  } catch (error) {
    console.error('❌ reCAPTCHA verifier creation error:', error);
    throw new Error('Failed to initialize security verification.');
  }
};

export const cleanupRecaptchaVerifier = () => {
  if (window.arvdoulRecaptchaVerifier) {
    try {
      window.arvdoulRecaptchaVerifier.clear();
    } catch (error) {
      console.warn('Failed to cleanup reCAPTCHA verifier:', error);
    }
    window.arvdoulRecaptchaVerifier = null;
    console.log('🧹 reCAPTCHA verifier cleaned up');
  }
};

export const sendPhoneVerificationCode = async (phoneNumber, recaptchaVerifier) => {
  try {
    const auth = getCurrentAuth();
    
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }
    
    const formattedPhone = phoneNumber.startsWith('+') ? 
      phoneNumber : `+${phoneNumber.replace(/\D/g, '')}`;
    
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(formattedPhone)) {
      throw new Error('Invalid phone number format');
    }
    
    console.log('📱 Sending verification code to:', formattedPhone);
    
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
    
    console.log('✅ Verification code sent');
    
    return {
      success: true,
      verificationId: confirmationResult.verificationId,
      phoneNumber: formattedPhone
    };
    
  } catch (error) {
    console.error('❌ Phone verification error:', error);
    
    const errorMap = {
      'auth/invalid-phone-number': 'Invalid phone number format.',
      'auth/missing-phone-number': 'Phone number is required.',
      'auth/quota-exceeded': 'SMS quota exceeded.',
      'auth/too-many-requests': 'Too many attempts.',
      'auth/captcha-check-failed': 'Security check failed.',
      'auth/operation-not-allowed': 'Phone authentication is not enabled.',
      'auth/network-request-failed': 'Network error.',
      'default': 'Failed to send verification code.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

export const verifyPhoneOTP = async (verificationId, otp) => {
  try {
    const auth = getCurrentAuth();
    
    if (!verificationId || !otp) {
      throw new Error('Verification ID and OTP are required');
    }
    
    if (otp.length !== 6) {
      throw new Error('OTP must be 6 digits');
    }
    
    const credential = PhoneAuthProvider.credential(verificationId, otp);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;
    const additionalInfo = getAdditionalUserInfo(result);
    
    console.log('✅ Phone OTP verified:', user.uid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        phoneNumber: user.phoneNumber
      },
      isNewUser: additionalInfo?.isNewUser || false
    };
    
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    
    const errorMap = {
      'auth/invalid-verification-code': 'Invalid verification code.',
      'auth/code-expired': 'Code expired.',
      'auth/credential-already-in-use': 'This phone number is already registered.',
      'auth/invalid-verification-id': 'Invalid verification session.',
      'auth/too-many-requests': 'Too many attempts.',
      'default': 'Failed to verify code.'
    };
    
    const errorMessage = errorMap[error.code] || errorMap.default;
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
};

// ========== SESSION MANAGEMENT ==========
export const getAuthStateService = () => {
  try {
    const auth = getCurrentAuth();
    const user = auth.currentUser;
    
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber
    };
    
  } catch (error) {
    console.error('❌ Get auth state error:', error);
    return null;
  }
};

export const signOutService = async () => {
  try {
    const auth = getCurrentAuth();
    
    cleanupRecaptchaVerifier();
    
    await firebaseSignOut(auth);
    
    console.log('✅ User signed out');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Sign out error:', error);
    throw new Error('Failed to sign out.');
  }
};

// ========== DEFAULT EXPORT ==========
export default {
  // Authentication
  signInWithGoogle: signInWithGoogleService,
  handleRedirectResult: handleRedirectResultService,
  signInWithEmailPassword: signInWithEmailPasswordService,
  createUserWithEmailPassword: createUserWithEmailPasswordService,
  
  // Password Management
  sendPasswordResetEmail: sendPasswordResetEmailService,
  confirmPasswordReset: confirmPasswordResetService,
  
  // Profile Management
  updateAuthProfile: updateAuthProfileService,
  updatePassword: updateUserPasswordService,
  
  // Phone Authentication
  createRecaptchaVerifier,
  cleanupRecaptchaVerifier,
  sendPhoneVerificationCode,
  verifyPhoneOTP,
  
  // Session Management
  getAuthState: getAuthStateService,
  signOut: signOutService,
  
  // Health Check
  checkHealth: checkAuthServiceHealth
};