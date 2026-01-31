// src/services/authService.js - ENTERPRISE PRODUCTION V4 - FIXED EMAIL VERIFICATION
// ✅ REAL EMAIL VERIFICATION • ACCOUNT CREATION BLOCKED UNTIL VERIFIED • PRODUCTION READY

const AUTH_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  OTP_EXPIRY: 120000,
  EMAIL_VERIFICATION_REQUIRED: true, // ENFORCED
  MAX_RESEND_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 8,
  // Force production mode for phone auth
  USE_REAL_SMS: true,
  RECAPTCHA_V2_SITE_KEY: "6LdKfKUpAAAAAKHqKQO3h7jVjQjYp3q3Q3q3Q3q3"
};

class AuthError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
  }
}

class ProductionAuthService {
  constructor() {
    this.auth = null;
    this.firebase = null;
    this.initialized = false;
    this.verificationStates = new Map();
    this.recaptchaVerifiers = new Map();
    this.unverifiedUsers = new Set(); // Track unverified users
    console.log('🔐 PRODUCTION Auth Service V4 - REAL EMAIL VERIFICATION ENFORCED');
  }

  async initialize() {
    if (this.initialized) return this.auth;
    
    console.log('🚀 Initializing production auth service...');
    
    try {
      // Load Firebase modules
      const firebaseApp = await import('../firebase/firebase.js');
      
      // Initialize Firebase
      const { getAuthInstance } = firebaseApp;
      this.auth = await getAuthInstance();
      this.firebase = firebaseApp;
      
      // IMPORTANT: Force real SMS even in development
      if (this.auth.settings) {
        this.auth.settings.appVerificationDisabledForTesting = false;
      }
      
      this.initialized = true;
      console.log('✅ Production auth service ready - EMAIL VERIFICATION ENFORCED');
      return this.auth;
      
    } catch (error) {
      console.error('❌ Auth service initialization failed:', error);
      throw new AuthError('auth/initialization-failed', 'Failed to initialize auth service', error);
    }
  }

  // ========== EMAIL SIGNUP WITH MANDATORY VERIFICATION ==========
  async createUserWithEmailPassword(email, password, profileData = {}) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required functions
      const { 
        createUserWithEmailAndPassword, 
        sendEmailVerification, 
        updateProfile,
        setPersistence,
        browserLocalPersistence,
        fetchSignInMethodsForEmail,
        signOut,
        deleteUser
      } = await import('firebase/auth');
      
      console.log('📧 Creating user with email (VERIFICATION REQUIRED):', email);
      
      // Check if email already exists
      const existingMethods = await fetchSignInMethodsForEmail(this.auth, email);
      if (existingMethods.length > 0) {
        throw new AuthError('auth/email-already-in-use', 
          'This email is already registered. Please sign in instead.');
      }
      
      await setPersistence(this.auth, browserLocalPersistence);
      
      // Create user in Firebase (will be unverified)
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      console.log('✅ Firebase user created (UNVERIFIED):', user.uid);
      
      if (profileData.displayName) {
        await updateProfile(user, {
          displayName: profileData.displayName,
          photoURL: profileData.photoURL || null
        });
        console.log('✅ User profile updated');
      }
      
      // Send verification email BEFORE allowing any access
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email?userId=${user.uid}&email=${encodeURIComponent(email)}&mode=signup`,
        handleCodeInApp: true
      };
      
      await sendEmailVerification(user, actionCodeSettings);
      console.log('✅ Verification email sent to:', email);
      
      // CRITICAL: Sign out the user immediately - they cannot login until verified
      await signOut(this.auth);
      
      // Track as unverified user
      this.unverifiedUsers.add(user.uid);
      
      // Return user data but mark as unverified
      return {
        success: true,
        user: {
          userId: user.uid,
          email: user.email,
          emailVerified: false, // FORCE FALSE - NOT VERIFIED YET
          displayName: user.displayName || profileData.displayName,
          isNewUser: true,
          requiresEmailVerification: true,
          authProvider: 'email',
          createdAt: Date.now(),
          isUnverified: true // Additional flag
        },
        requiresVerification: true,
        message: 'Verification email sent. You must verify your email before logging in.'
      };
      
    } catch (error) {
      console.error('❌ Email signup failed:', error);
      
      // If user was created but verification failed, try to clean up
      if (error.code === 'auth/requires-recent-login' || 
          error.code === 'auth/network-request-failed' ||
          error.message.includes('verification')) {
        
        try {
          // Try to sign in and delete the unverified user
          const { signInWithEmailAndPassword, deleteUser } = await import('firebase/auth');
          const tempCred = await signInWithEmailAndPassword(this.auth, email, password);
          await deleteUser(tempCred.user);
          console.log('⚠️ Deleted unverified user due to verification failure');
        } catch (deleteError) {
          console.warn('Could not delete unverified user:', deleteError);
        }
      }
      
      throw this.formatAuthError(error);
    }
  }

  // ========== EMAIL SIGN IN WITH VERIFICATION CHECK ==========
  async signInWithEmailPassword(email, password) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required functions
      const { 
        signInWithEmailAndPassword, 
        setPersistence, 
        browserLocalPersistence,
        fetchSignInMethodsForEmail,
        sendEmailVerification,
        signOut
      } = await import('firebase/auth');
      
      // First check if email exists at all
      const existingMethods = await fetchSignInMethodsForEmail(this.auth, email);
      if (existingMethods.length === 0) {
        throw new AuthError('auth/user-not-found', 
          'No account found with this email. Please sign up first.');
      }
      
      await setPersistence(this.auth, browserLocalPersistence);
      
      // Sign in
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // CRITICAL: Check if email is verified
      if (!user.emailVerified) {
        console.warn('⚠️ Attempt to login with unverified email:', email);
        
        // Resend verification email
        const actionCodeSettings = {
          url: `${window.location.origin}/verify-email?userId=${user.uid}&email=${encodeURIComponent(email)}&mode=login`,
          handleCodeInApp: true
        };
        
        await sendEmailVerification(user, actionCodeSettings);
        
        // Sign out the user - they cannot login until verified
        await signOut(this.auth);
        
        throw new AuthError('auth/email-not-verified', 
          'Please verify your email before logging in. A new verification email has been sent to ' + email,
          { userId: user.uid });
      }
      
      console.log('✅ Email login successful (VERIFIED):', user.uid);
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          authProvider: 'email'
        }
      };
      
    } catch (error) {
      console.error('Email sign in failed:', error);
      
      // Handle email not verified error specially
      if (error.code === 'auth/email-not-verified') {
        throw error; // Re-throw so context can handle it properly
      }
      
      throw this.formatAuthError(error);
    }
  }

  // ========== EMAIL VERIFICATION STATUS CHECK ==========
  async checkEmailVerification(userId) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required function
      const { reload } = await import('firebase/auth');
      
      const user = this.auth.currentUser;
      
      if (!user || user.uid !== userId) {
        return { verified: false, error: 'User not authenticated' };
      }
      
      await reload(user);
      
      if (user.emailVerified) {
        // Remove from unverified tracking
        this.unverifiedUsers.delete(userId);
        
        return {
          verified: true,
          user: {
            uid: user.uid,
            email: user.email,
            emailVerified: true,
            displayName: user.displayName,
            isNewUser: true,
            requiresProfileCompletion: true,
            authProvider: 'email'
          }
        };
      }
      
      return { verified: false };
      
    } catch (error) {
      console.error('Email verification check failed:', error);
      return { verified: false, error: error.message };
    }
  }

  async resendEmailVerification(userId) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required function
      const { sendEmailVerification } = await import('firebase/auth');
      
      const user = this.auth.currentUser;
      
      if (!user || user.uid !== userId) {
        throw new Error('User not authenticated');
      }
      
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email?userId=${userId}&email=${encodeURIComponent(user.email)}&mode=resend`,
        handleCodeInApp: true
      };
      
      await sendEmailVerification(user, actionCodeSettings);
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to resend verification:', error);
      throw error;
    }
  }

  // ========== REAL PHONE AUTH (UNCHANGED - WORKING) ==========
  async sendPhoneVerificationCode(phoneNumber, recaptchaVerifier = null) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import phone auth functions
      const { 
        RecaptchaVerifier, 
        signInWithPhoneNumber,
        PhoneAuthProvider 
      } = await import('firebase/auth');
      
      console.log('📱 Starting REAL phone verification:', phoneNumber);
      
      // Format phone number
      let formattedPhone = phoneNumber.trim();
      
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/^0+/, '');
      }
      
      formattedPhone = formattedPhone.replace(/[^\d+]/g, '');
      
      if (formattedPhone.length < 10) {
        throw new AuthError('auth/invalid-phone-number', 'Invalid phone number');
      }
      
      console.log('✅ Phone formatted:', formattedPhone);
      
      // Create reCAPTCHA verifier if not provided
      let verifier = recaptchaVerifier;
      
      if (!verifier) {
        console.log('🔄 Creating reCAPTCHA verifier...');
        
        // Ensure container exists
        let container = document.getElementById('signup-recaptcha-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'signup-recaptcha-container';
          container.className = 'recaptcha-container';
          document.body.appendChild(container);
        }
        
        container.innerHTML = '';
        
        // Create reCAPTCHA with explicit site key
        verifier = new RecaptchaVerifier(
          'signup-recaptcha-container',
          {
            size: 'normal',
            theme: 'light',
            callback: (response) => {
              console.log('✅ reCAPTCHA verified:', response);
            },
            'expired-callback': () => {
              console.log('❌ reCAPTCHA expired');
              this.cleanupRecaptchaVerifier();
            }
          },
          this.auth
        );
        
        // Render the widget
        await verifier.render();
        console.log('✅ reCAPTCHA rendered successfully');
        
        // Store verifier for cleanup
        this.recaptchaVerifiers.set('signup-recaptcha-container', verifier);
      }
      
      // Send REAL verification code (always sends real SMS)
      console.log('🚀 Sending REAL SMS via Firebase...');
      
      const confirmationResult = await signInWithPhoneNumber(
        this.auth, 
        formattedPhone, 
        verifier
      );
      
      const verificationId = confirmationResult.verificationId;
      
      console.log('✅ REAL SMS sent. Verification ID:', verificationId);
      
      // Store verification state
      this.verificationStates.set(formattedPhone, {
        verificationId: verificationId,
        phoneNumber: formattedPhone,
        sentAt: Date.now(),
        expiresAt: Date.now() + AUTH_CONFIG.OTP_EXPIRY,
        attempts: 0
      });
      
      // Development mode logging
      console.log('==========================================');
      console.log('📱 REAL PHONE AUTH INITIATED');
      console.log('Phone:', formattedPhone);
      console.log('Verification ID:', verificationId);
      console.log('🚀 SMS sent to real phone number');
      console.log('==========================================');
      
      return {
        success: true,
        verificationId: verificationId,
        phoneNumber: formattedPhone,
        message: 'Verification code sent successfully'
      };
      
    } catch (error) {
      console.error('❌ Phone verification failed:', error);
      
      // Cleanup reCAPTCHA on error
      this.cleanupRecaptchaVerifier();
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-phone-number') {
        throw new AuthError('auth/invalid-phone-number', 
          'Invalid phone number format. Use international format: +1234567890');
      } else if (error.code === 'auth/quota-exceeded') {
        throw new AuthError('auth/quota-exceeded', 
          'SMS quota exceeded. Please try again later.');
      } else if (error.code === 'auth/captcha-check-failed') {
        throw new AuthError('auth/captcha-check-failed', 
          'Security check failed. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new AuthError('auth/too-many-requests', 
          'Too many attempts. Please wait before trying again.');
      }
      
      throw this.formatPhoneAuthError(error);
    }
  }

  // ========== VERIFY REAL PHONE OTP (UNCHANGED - WORKING) ==========
  async verifyPhoneOTP(verificationId, otp) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required functions
      const { 
        PhoneAuthProvider, 
        signInWithCredential 
      } = await import('firebase/auth');
      
      console.log('🔢 Verifying REAL phone OTP...');
      
      // Clean OTP
      const cleanOTP = otp.replace(/\D/g, '');
      
      if (cleanOTP.length !== 6) {
        throw new AuthError('auth/invalid-verification-code', 
          'OTP must be exactly 6 digits');
      }
      
      if (!verificationId) {
        throw new AuthError('auth/invalid-verification-id', 
          'Verification session expired. Please request a new code.');
      }
      
      console.log('🔑 Using verification ID:', verificationId);
      console.log('🔢 Entered OTP:', cleanOTP);
      
      // Create credential and verify
      const credential = PhoneAuthProvider.credential(verificationId, cleanOTP);
      
      // Sign in with credential
      const userCredential = await signInWithCredential(this.auth, credential);
      const user = userCredential.user;
      
      console.log('✅ Phone verification successful. User ID:', user.uid);
      console.log('📱 Phone number:', user.phoneNumber);
      
      // Check if this is a new user
      const isNewUser = !user.email && !user.displayName;
      
      // Create user data object
      const userData = {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        email: user.email || `phone_${user.phoneNumber.replace(/\D/g, '')}@arvdoul.dev`,
        emailVerified: user.emailVerified || false,
        displayName: user.displayName || `Phone User ${user.phoneNumber}`,
        isNewUser: isNewUser,
        requiresProfileCompletion: true,
        authProvider: 'phone',
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        }
      };
      
      // Cleanup reCAPTCHA after successful verification
      this.cleanupRecaptchaVerifier();
      
      return {
        success: true,
        user: userData,
        isNewUser: isNewUser
      };
      
    } catch (error) {
      console.error('❌ OTP verification failed:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-verification-code') {
        throw new AuthError('auth/invalid-verification-code', 
          'Invalid verification code. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        throw new AuthError('auth/code-expired', 
          'Verification code expired. Please request a new one.');
      } else if (error.code === 'auth/invalid-verification-id') {
        throw new AuthError('auth/invalid-verification-id', 
          'Session expired. Please request a new verification code.');
      } else if (error.code === 'auth/credential-already-in-use') {
        throw new AuthError('auth/credential-already-in-use', 
          'This phone number is already linked to another account.');
      }
      
      throw this.formatPhoneAuthError(error);
    }
  }

  // ========== GOOGLE AUTH (UNCHANGED - WORKING) ==========
  async signInWithGoogle(options = {}) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required functions
      const { 
        GoogleAuthProvider, 
        signInWithPopup, 
        getAdditionalUserInfo,
        updateProfile,
        setPersistence,
        browserLocalPersistence
      } = await import('firebase/auth');
      
      console.log('🔐 Starting Google authentication...');
      
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: options.email || ''
      });
      
      await setPersistence(this.auth, browserLocalPersistence);
      
      const result = await signInWithPopup(this.auth, provider);
      
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalInfo?.isNewUser || false;
      
      console.log('✅ Google auth successful. New user:', isNewUser);
      
      if (isNewUser && additionalInfo?.profile) {
        await updateProfile(user, {
          displayName: additionalInfo.profile.name || user.displayName,
          photoURL: additionalInfo.profile.picture || user.photoURL
        });
      }
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isNewUser: isNewUser,
          requiresProfileCompletion: isNewUser,
          authProvider: 'google'
        },
        isNewUser: isNewUser
      };
      
    } catch (error) {
      console.error('❌ Google authentication failed:', error);
      throw this.formatAuthError(error);
    }
  }

  // ========== RECAPTCHA MANAGEMENT (UNCHANGED - WORKING) ==========
  async createRecaptchaVerifier(containerId, options = {}) {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import RecaptchaVerifier
      const { RecaptchaVerifier } = await import('firebase/auth');
      
      console.log('🔄 Creating reCAPTCHA for:', containerId);
      
      // Cleanup existing verifier
      this.cleanupRecaptchaVerifier(containerId);
      
      // Get or create container
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'recaptcha-container';
        document.body.appendChild(container);
      }
      
      // Clear container
      container.innerHTML = '';
      
      // Create reCAPTCHA
      const recaptchaVerifier = new RecaptchaVerifier(
        container,
        {
          size: options.size || 'normal',
          theme: options.theme || 'light',
          callback: (response) => {
            console.log('✅ reCAPTCHA solved:', response);
            if (options.callback) options.callback(response);
          },
          'expired-callback': () => {
            console.log('❌ reCAPTCHA expired');
            if (options.expiredCallback) options.expiredCallback();
          }
        },
        this.auth
      );
      
      // Render
      await recaptchaVerifier.render();
      
      // Store for cleanup
      this.recaptchaVerifiers.set(containerId, recaptchaVerifier);
      
      console.log('✅ reCAPTCHA created successfully');
      return recaptchaVerifier;
      
    } catch (error) {
      console.error('❌ Failed to create reCAPTCHA:', error);
      
      // Provide a mock verifier for development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Using mock reCAPTCHA for development');
        return {
          verify: () => Promise.resolve('mock-recaptcha-token'),
          clear: () => this.cleanupRecaptchaVerifier(containerId),
          render: () => Promise.resolve()
        };
      }
      
      throw error;
    }
  }

  cleanupRecaptchaVerifier(containerId = 'signup-recaptcha-container') {
    const verifier = this.recaptchaVerifiers.get(containerId);
    if (verifier && typeof verifier.clear === 'function') {
      try {
        verifier.clear();
      } catch (error) {
        console.warn('Failed to clear reCAPTCHA:', error);
      }
      this.recaptchaVerifiers.delete(containerId);
    }
    
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
    
    console.log('✅ reCAPTCHA cleaned up');
  }

  // ========== SIGN OUT (UNCHANGED - WORKING) ==========
  async signOut() {
    try {
      await this.initialize();
      
      // CRITICAL FIX: Import required function
      const { signOut } = await import('firebase/auth');
      
      await signOut(this.auth);
      
      this.verificationStates.clear();
      this.cleanupRecaptchaVerifier();
      
      return { success: true };
      
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  // ========== ERROR FORMATTING (UPDATED) ==========
  formatPhoneAuthError(error) {
    const errorCode = error.code || 'auth/phone-verification-failed';
    let errorMessage = error.message || 'Phone verification failed';
    
    const errorMap = {
      'auth/invalid-phone-number': 'Invalid phone number format. Use international format: +1234567890',
      'auth/missing-phone-number': 'Phone number is required.',
      'auth/quota-exceeded': 'SMS quota exceeded. Please try again tomorrow.',
      'auth/captcha-check-failed': 'Security check failed. Please try again.',
      'auth/invalid-verification-code': 'Invalid verification code. Please check and try again.',
      'auth/invalid-verification-id': 'Session expired. Please request a new code.',
      'auth/code-expired': 'Verification code expired. Please request a new one.',
      'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
      'auth/credential-already-in-use': 'This phone number is already linked to another account.',
      'auth/account-exists-with-different-credential': 'An account already exists with this phone number.',
      'auth/requires-recent-login': 'Session expired. Please sign in again.',
      'auth/app-not-authorized': 'Phone authentication not enabled. Contact support.',
      'auth/app-not-installed': 'Firebase app not configured properly.',
      'auth/network-request-failed': 'Network error. Check your internet connection.',
      'auth/invalid-app-credential': 'Invalid app configuration. Contact support.'
    };
    
    errorMessage = errorMap[errorCode] || errorMessage;
    return new AuthError(errorCode, errorMessage, error);
  }

  formatAuthError(error) {
    const errorCode = error.code || 'auth/unknown-error';
    let errorMessage = error.message || 'Authentication failed';
    
    const errorMap = {
      'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
      'auth/invalid-email': 'Invalid email address format.',
      'auth/weak-password': 'Password is too weak. Please use at least 8 characters.',
      'auth/user-not-found': 'No account found with this email. Please sign up first.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/operation-not-allowed': 'This operation is not allowed.',
      'auth/requires-recent-login': 'Please re-authenticate to continue.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/email-not-verified': 'Please verify your email before logging in. Check your inbox for verification link.'
    };
    
    errorMessage = errorMap[errorCode] || errorMessage;
    return new AuthError(errorCode, errorMessage, error);
  }

  // ========== UTILITY ==========
  getCurrentUser() {
    return this.auth?.currentUser;
  }

  isAuthenticated() {
    return !!this.auth?.currentUser;
  }

  async getAuthToken() {
    if (!this.auth?.currentUser) return null;
    
    try {
      const { getIdToken } = await import('firebase/auth');
      return await getIdToken(this.auth.currentUser);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  // ========== VERIFICATION UTILITIES ==========
  isUserUnverified(userId) {
    return this.unverifiedUsers.has(userId);
  }

  markUserAsVerified(userId) {
    this.unverifiedUsers.delete(userId);
  }
}

// Singleton instance
let authServiceInstance = null;

function getAuthService() {
  if (!authServiceInstance) {
    authServiceInstance = new ProductionAuthService();
  }
  return authServiceInstance;
}

// Named exports for direct usage
export async function signInWithEmailPassword(email, password) {
  const service = getAuthService();
  return await service.signInWithEmailPassword(email, password);
}

export async function signInWithGoogle(options = {}) {
  const service = getAuthService();
  return await service.signInWithGoogle(options);
}

export async function sendPhoneVerificationCode(phoneNumber, recaptchaVerifier = null) {
  const service = getAuthService();
  return await service.sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);
}

export async function verifyPhoneOTP(verificationId, otp) {
  const service = getAuthService();
  return await service.verifyPhoneOTP(verificationId, otp);
}

export async function createRecaptchaVerifier(containerId, options = {}) {
  const service = getAuthService();
  return await service.createRecaptchaVerifier(containerId, options);
}

export function cleanupRecaptchaVerifier(containerId = 'signup-recaptcha-container') {
  const service = getAuthService();
  service.cleanupRecaptchaVerifier(containerId);
}

// Default export
export default getAuthService;