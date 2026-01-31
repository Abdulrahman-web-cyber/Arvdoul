// src/context/SignupContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  updatePassword,
  reload,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  applyActionCode,
  checkActionCode,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateEmail,
  updatePhoneNumber
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "../firebase/firebase";
import { toast } from "sonner";
import CryptoJS from "crypto-js";

/** ---------- ADVANCED SECURITY CONFIGURATION ---------- */
const SECURITY_CONFIG = {
  // Rate Limiting
  MAX_OTP_ATTEMPTS: 5,
  OTP_COOLDOWN_SECONDS: 60,
  MAX_SIGNUP_ATTEMPTS_PER_HOUR: 10,
  ACCOUNT_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  
  // Password Security
  MIN_PASSWORD_LENGTH: 8,
  PASSWORD_STRENGTH_THRESHOLD: 40, // 0-100 scale
  PASSWORD_HISTORY_LIMIT: 5,
  
  // Session Security
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  REFRESH_TOKEN_INTERVAL: 5 * 60 * 1000, // 5 minutes
  
  // Data Protection
  ENCRYPTION_KEY: import.meta.env.VITE_ENCRYPTION_KEY || "arvdoul-secure-key-2024",
  DATA_RETENTION_DAYS: 90,
  
  // Advanced Features
  ENABLE_BIOMETRIC: true,
  ENABLE_2FA: true,
  ENABLE_IP_WHITELISTING: false,
  
  // Storage Limits
  MAX_PROFILE_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_COVER_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};

/** ---------- ADVANCED VALIDATION UTILITIES ---------- */
class AdvancedValidator {
  static validateEmail(email) {
    if (!email) return { valid: false, message: "Email is required" };
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: "Invalid email format" };
    }
    
    // Disposable email check (simplified)
    const disposableDomains = ['tempmail.com', 'guerrillamail.com', 'mailinator.com'];
    const domain = email.split('@')[1];
    if (disposableDomains.some(d => domain.includes(d))) {
      return { valid: false, message: "Disposable emails are not allowed" };
    }
    
    return { valid: true, message: "Valid email" };
  }

  static validatePhone(phone) {
    if (!phone) return { valid: false, message: "Phone number is required" };
    
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, message: "Invalid phone format. Use +[country code][number]" };
    }
    
    // Country code validation
    const countryCode = phone.substring(0, 3);
    const validCountryCodes = ['+1', '+44', '+91', '+86', '+81', '+49', '+33', '+7', '+55', '+52', '+61', '+34', '+39', '+82', '+971', '+966', '+27', '+234', '+20', '+254'];
    if (!validCountryCodes.includes(countryCode)) {
      return { valid: false, message: "Country code not supported" };
    }
    
    return { valid: true, message: "Valid phone number" };
  }

  static validatePassword(password) {
    if (!password) return { 
      valid: false, 
      message: "Password is required",
      strength: 0,
      requirements: []
    };
    
    const requirements = [];
    let strength = 0;
    
    // Length check
    if (password.length >= SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      strength += 20;
    } else {
      requirements.push(`At least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters`);
    }
    
    // Uppercase
    if (/[A-Z]/.test(password)) {
      strength += 20;
    } else {
      requirements.push("One uppercase letter");
    }
    
    // Lowercase
    if (/[a-z]/.test(password)) {
      strength += 20;
    } else {
      requirements.push("One lowercase letter");
    }
    
    // Numbers
    if (/[0-9]/.test(password)) {
      strength += 20;
    } else {
      requirements.push("One number");
    }
    
    // Special characters
    if (/[^A-Za-z0-9]/.test(password)) {
      strength += 20;
    } else {
      requirements.push("One special character");
    }
    
    // Bonus for length
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;
    
    // Penalty for common patterns
    if (/(.)\1{2,}/.test(password)) strength -= 15; // Repeated characters
    if (/123|abc|qwerty|password|admin/i.test(password)) strength -= 30; // Common patterns
    
    strength = Math.max(0, Math.min(100, strength));
    
    let strengthLabel = "Very Weak";
    if (strength >= 80) strengthLabel = "Very Strong";
    else if (strength >= 60) strengthLabel = "Strong";
    else if (strength >= 40) strengthLabel = "Good";
    else if (strength >= 20) strengthLabel = "Weak";
    
    return {
      valid: strength >= SECURITY_CONFIG.PASSWORD_STRENGTH_THRESHOLD,
      message: strengthLabel,
      strength,
      requirements
    };
  }

  static validateName(name, field = "Name") {
    if (!name || name.trim().length === 0) {
      return { valid: false, message: `${field} is required` };
    }
    
    if (name.length < 2) {
      return { valid: false, message: `${field} must be at least 2 characters` };
    }
    
    if (name.length > 50) {
      return { valid: false, message: `${field} must be less than 50 characters` };
    }
    
    if (!/^[a-zA-Z\s\-'.]+$/.test(name)) {
      return { valid: false, message: `${field} can only contain letters, spaces, hyphens, apostrophes, and periods` };
    }
    
    return { valid: true, message: "Valid name" };
  }

  static validateUsername(username) {
    if (!username) return { valid: false, message: "Username is required" };
    
    if (username.length < 3) {
      return { valid: false, message: "Username must be at least 3 characters" };
    }
    
    if (username.length > 20) {
      return { valid: false, message: "Username must be less than 20 characters" };
    }
    
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      return { valid: false, message: "Username can only contain letters, numbers, underscores, and periods" };
    }
    
    if (/^[0-9]/.test(username)) {
      return { valid: false, message: "Username cannot start with a number" };
    }
    
    const reservedNames = ['admin', 'root', 'system', 'support', 'help', 'info'];
    if (reservedNames.includes(username.toLowerCase())) {
      return { valid: false, message: "This username is reserved" };
    }
    
    return { valid: true, message: "Valid username" };
  }

  static validateDOB(dob) {
    if (!dob || !dob.day || !dob.month || !dob.year) {
      return { valid: false, message: "Complete date of birth is required" };
    }
    
    const birthDate = new Date(dob.year, dob.month - 1, dob.day);
    const today = new Date();
    
    // Check if date is valid
    if (birthDate.getDate() !== parseInt(dob.day) ||
        birthDate.getMonth() + 1 !== parseInt(dob.month) ||
        birthDate.getFullYear() !== parseInt(dob.year)) {
      return { valid: false, message: "Invalid date" };
    }
    
    // Age calculation
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 13) {
      return { valid: false, message: "You must be at least 13 years old" };
    }
    
    if (age > 120) {
      return { valid: false, message: "Please enter a valid date of birth" };
    }
    
    return { 
      valid: true, 
      message: `Age: ${age} years`,
      age 
    };
  }

  static validateGender(gender) {
    const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
    if (!gender || !validGenders.includes(gender)) {
      return { valid: false, message: "Please select a valid gender" };
    }
    return { valid: true, message: "Valid gender" };
  }
}

/** ---------- ENCRYPTION SERVICE ---------- */
class EncryptionService {
  static encrypt(data) {
    try {
      return CryptoJS.AES.encrypt(
        JSON.stringify(data), 
        SECURITY_CONFIG.ENCRYPTION_KEY
      ).toString();
    } catch (error) {
      console.error("Encryption error:", error);
      return data;
    }
  }

  static decrypt(encryptedData) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, SECURITY_CONFIG.ENCRYPTION_KEY);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      console.error("Decryption error:", error);
      return encryptedData;
    }
  }

  static hashPassword(password) {
    return CryptoJS.SHA256(password + SECURITY_CONFIG.ENCRYPTION_KEY).toString();
  }
}

/** ---------- RATE LIMITING SERVICE ---------- */
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.locks = new Map();
  }

  check(identifier, action, maxAttempts, windowMs) {
    const key = `${identifier}:${action}`;
    const now = Date.now();
    
    // Clean old entries
    this.cleanup();
    
    // Check if locked
    if (this.isLocked(key)) {
      const lockTime = this.locks.get(key);
      const remainingTime = Math.ceil((lockTime + SECURITY_CONFIG.ACCOUNT_LOCKOUT_DURATION - now) / 1000);
      return {
        allowed: false,
        remainingTime,
        message: `Too many attempts. Try again in ${remainingTime} seconds.`
      };
    }
    
    // Get attempts for this key
    const userAttempts = this.attempts.get(key) || [];
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      // Lock the account
      this.locks.set(key, now);
      return {
        allowed: false,
        remainingTime: Math.ceil(SECURITY_CONFIG.ACCOUNT_LOCKOUT_DURATION / 1000),
        message: "Account temporarily locked due to too many attempts."
      };
    }
    
    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return {
      allowed: true,
      attempts: recentAttempts.length,
      remainingAttempts: maxAttempts - recentAttempts.length
    };
  }

  isLocked(key) {
    const lockTime = this.locks.get(key);
    if (!lockTime) return false;
    
    if (Date.now() - lockTime > SECURITY_CONFIG.ACCOUNT_LOCKOUT_DURATION) {
      this.locks.delete(key);
      this.attempts.delete(key);
      return false;
    }
    
    return true;
  }

  cleanup() {
    const now = Date.now();
    
    // Clean attempts older than 1 hour
    for (const [key, attempts] of this.attempts.entries()) {
      const recent = attempts.filter(time => now - time < 3600000);
      if (recent.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recent);
      }
    }
    
    // Clean expired locks
    for (const [key, lockTime] of this.locks.entries()) {
      if (now - lockTime > SECURITY_CONFIG.ACCOUNT_LOCKOUT_DURATION) {
        this.locks.delete(key);
        this.attempts.delete(key);
      }
    }
  }

  reset(identifier, action) {
    const key = `${identifier}:${action}`;
    this.attempts.delete(key);
    this.locks.delete(key);
  }
}

/** ---------- AUDIT LOGGER ---------- */
class AuditLogger {
  static async log(userId, action, details = {}) {
    try {
      const logEntry = {
        userId,
        action,
        details: EncryptionService.encrypt(details),
        timestamp: serverTimestamp(),
        ip: await this.getClientIP(),
        userAgent: navigator.userAgent
      };

      await setDoc(doc(db, "audit_logs", `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`), logEntry);
    } catch (error) {
      console.error("Audit logging failed:", error);
    }
  }

  static async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return "unknown";
    }
  }
}

/** ---------- ADVANCED SIGNUP CONTEXT ---------- */
const SignupContext = createContext(null);

export const SignupProvider = ({ children }) => {
  // Core State
  const [signupData, setSignupData] = useState({
    // Personal Information
    firstName: "",
    lastName: "",
    gender: "",
    dob: { day: "", month: "", year: "" },
    username: "",
    
    // Contact Information
    contactMethod: "", // "email" or "phone"
    contactValue: "",
    email: "",
    phone: "",
    
    // Security
    password: "",
    confirmPassword: "",
    
    // Profile
    profilePictureFile: null,
    bio: "",
    nickname: "",
    
    // Progress
    currentStep: 1,
    completedSteps: new Set(),
    verificationStatus: "pending",
    
    // Metadata
    signupTimestamp: null,
    deviceFingerprint: null
  });

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  const [securityChecks, setSecurityChecks] = useState({});
  const [session, setSession] = useState({
    token: null,
    expiresAt: null,
    refreshToken: null
  });

  const recaptchaVerifierRef = useRef(null);
  const rateLimiter = useRef(new RateLimiter());
  const sessionTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  /** ---------- SESSION MANAGEMENT ---------- */
  const initializeSession = useCallback((user) => {
    const token = Math.random().toString(36).substr(2) + Date.now().toString(36);
    const expiresAt = Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT;
    const refreshToken = Math.random().toString(36).substr(2);
    
    setSession({ token, expiresAt, refreshToken });
    
    // Start session timer
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      if (Date.now() > expiresAt) {
        handleSessionExpired();
      }
    }, 60000); // Check every minute
  }, []);

  const refreshSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      expiresAt: Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT
    }));
  }, []);

  const handleSessionExpired = useCallback(() => {
    toast.error("Session expired. Please sign in again.");
    logout();
  }, []);

  /** ---------- DATA MANAGEMENT ---------- */
  const updateSignupData = useCallback((updates) => {
    setSignupData(prev => {
      const newData = typeof updates === 'function' ? updates(prev) : updates;
      const merged = { ...prev, ...newData };
      
      // Auto-update contact values
      if (newData.contactMethod) {
        merged.contactValue = 
          newData.contactMethod === "phone" 
            ? (newData.phone || prev.phone)
            : (newData.email || prev.email);
      }
      
      // Auto-capitalize names
      if (newData.firstName) {
        merged.firstName = newData.firstName
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      
      if (newData.lastName) {
        merged.lastName = newData.lastName
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      
      // Validate and update security level
      const securityLevel = calculateSecurityLevel(merged);
      merged.securityLevel = securityLevel;
      
      return merged;
    });
  }, []);

  const calculateSecurityLevel = useCallback((data) => {
    let score = 0;
    
    // Personal info
    if (data.firstName && data.lastName) score += 20;
    if (data.dob?.day && data.dob?.month && data.dob?.year) score += 20;
    if (data.gender) score += 10;
    
    // Contact info
    if (data.contactMethod && data.contactValue) score += 30;
    
    // Password strength
    if (data.password) {
      const validation = AdvancedValidator.validatePassword(data.password);
      score += Math.min(20, validation.strength / 5);
    }
    
    if (score >= 80) return "maximum";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    return "basic";
  }, []);

  /** ---------- STEP MANAGEMENT ---------- */
  const nextStep = useCallback(() => {
    setStep(prev => {
      const next = prev + 1;
      setSignupData(data => ({
        ...data,
        currentStep: next,
        completedSteps: new Set([...data.completedSteps, prev])
      }));
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setStep(prev => Math.max(1, prev - 1));
  }, []);

  const goToStep = useCallback((stepNumber) => {
    setStep(Math.max(1, Math.min(stepNumber, 6)));
  }, []);

  /** ---------- reCAPTCHA MANAGEMENT ---------- */
  const initRecaptcha = useCallback(async (containerId = "recaptcha-container") => {
    if (recaptchaVerifierRef.current) {
      setRecaptchaReady(true);
      return recaptchaVerifierRef.current;
    }

    try {
      const verifier = new RecaptchaVerifier(
        containerId,
        {
          size: "invisible",
          callback: () => {
            setRecaptchaReady(true);
            console.log("reCAPTCHA verified successfully");
          },
          "expired-callback": () => {
            setRecaptchaReady(false);
            toast.warning("Security verification expired. Please try again.");
          },
          "error-callback": (error) => {
            console.error("reCAPTCHA error:", error);
            setRecaptchaReady(false);
            toast.error("Security verification failed.");
          }
        },
        auth
      );

      await verifier.render();
      recaptchaVerifierRef.current = verifier;
      setRecaptchaReady(true);
      
      return verifier;
    } catch (error) {
      console.error("reCAPTCHA initialization failed:", error);
      toast.error("Security verification initialization failed. Please refresh.");
      throw error;
    }
  }, []);

  const cleanupRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      } catch (error) {
        console.warn("Error cleaning up reCAPTCHA:", error);
      }
    }
    setRecaptchaReady(false);
  }, []);

  /** ---------- PHONE AUTHENTICATION ---------- */
  const sendOtp = useCallback(async (phoneNumber, options = {}) => {
    const { forceInit = false, identifier = "unknown" } = options;
    
    // Rate limiting check
    const rateLimit = rateLimiter.current.check(
      identifier,
      "send_otp",
      SECURITY_CONFIG.MAX_OTP_ATTEMPTS,
      3600000 // 1 hour window
    );
    
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.message);
    }

    setLoading(true);
    setError(null);

    try {
      // Validate phone number
      const validation = AdvancedValidator.validatePhone(phoneNumber);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Check if phone already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phone", "==", phoneNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error("This phone number is already registered");
      }

      // Initialize reCAPTCHA if needed
      let verifier = recaptchaVerifierRef.current;
      if (!verifier || forceInit) {
        verifier = await initRecaptcha();
      }

      if (!recaptchaReady) {
        throw new Error("Security verification not ready");
      }

      // Send OTP
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      
      setVerificationId(confirmationResult.verificationId);
      window.confirmationResult = confirmationResult;

      // Log the attempt
      await AuditLogger.log("system", "OTP_SENT", {
        phone: phoneNumber,
        timestamp: new Date().toISOString()
      });

      // Update signup data
      updateSignupData({
        phone: phoneNumber,
        contactMethod: "phone",
        contactValue: phoneNumber
      });

      toast.success("🔐 Verification code sent to your phone!");
      return confirmationResult;
    } catch (error) {
      console.error("OTP sending failed:", error);
      
      let userMessage = "Failed to send verification code";
      if (error.code === "auth/too-many-requests") {
        userMessage = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/invalid-phone-number") {
        userMessage = "Invalid phone number format.";
      } else if (error.code === "auth/quota-exceeded") {
        userMessage = "Verification service quota exceeded. Please try again later.";
      }
      
      setError(userMessage);
      throw new Error(userMessage);
    } finally {
      setLoading(false);
    }
  }, [initRecaptcha, recaptchaReady, updateSignupData]);

  const verifyOtp = useCallback(async (otpCode, identifier = "unknown") => {
    // Rate limiting check
    if (rateLimiter.current.isLocked(`${identifier}:verify_otp`)) {
      throw new Error("Too many verification attempts. Account temporarily locked.");
    }

    setLoading(true);
    setError(null);

    try {
      if (!otpCode || otpCode.length !== 6) {
        throw new Error("Please enter a valid 6-digit code");
      }

      let userCredential;
      
      // Try using confirmation result first
      if (window.confirmationResult?.confirm) {
        userCredential = await window.confirmationResult.confirm(otpCode);
      } 
      // Fallback to verification ID
      else if (verificationId) {
        const credential = PhoneAuthProvider.credential(verificationId, otpCode);
        userCredential = await signInWithCredential(auth, credential);
      } else {
        throw new Error("No active verification session");
      }

      if (!userCredential?.user) {
        throw new Error("Verification failed");
      }

      const user = userCredential.user;
      
      // Reset rate limiting on success
      rateLimiter.current.reset(identifier, "verify_otp");
      
      // Initialize session
      initializeSession(user);
      
      // Log successful verification
      await AuditLogger.log(user.uid, "PHONE_VERIFIED", {
        phone: user.phoneNumber,
        timestamp: new Date().toISOString()
      });

      toast.success("✅ Phone verified successfully!");
      return user;
    } catch (error) {
      console.error("OTP verification failed:", error);
      
      // Track failed attempt
      rateLimiter.current.check(identifier, "verify_otp", 3, 900000); // 3 attempts in 15 minutes
      
      let userMessage = "Verification failed. Please check the code and try again.";
      
      if (error.code === "auth/invalid-verification-code") {
        userMessage = "Invalid verification code.";
      } else if (error.code === "auth/code-expired") {
        userMessage = "Verification code has expired. Please request a new one.";
      } else if (error.code === "auth/too-many-requests") {
        userMessage = "Too many failed attempts. Please try again later.";
      }
      
      setError(userMessage);
      throw new Error(userMessage);
    } finally {
      setLoading(false);
    }
  }, [verificationId, initializeSession]);

  /** ---------- EMAIL AUTHENTICATION ---------- */
  const sendEmailVerificationCode = useCallback(async (email, identifier = "unknown") => {
    // Rate limiting check
    const rateLimit = rateLimiter.current.check(
      identifier,
      "send_email_verification",
      5,
      3600000
    );
    
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.message);
    }

    setLoading(true);
    setError(null);

    try {
      // Validate email
      const validation = AdvancedValidator.validateEmail(email);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Check if email already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error("This email is already registered");
      }

      // Create temporary user account
      const temporaryPassword = `Arvdoul@${Math.random().toString(36).substr(2, 10)}`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, temporaryPassword);
      const user = userCredential.user;
      
      // Send verification email
      await sendEmailVerification(user, {
        url: `${window.location.origin}/complete-signup?email=${encodeURIComponent(email)}`,
        handleCodeInApp: true
      });

      // Set display name temporarily
      await updateAuthProfile(user, {
        displayName: "New User"
      });

      // Store temporary password in encrypted session storage
      const encryptedPassword = EncryptionService.encrypt({
        email,
        tempPassword: temporaryPassword,
        timestamp: Date.now()
      });
      
      sessionStorage.setItem(`temp_auth_${user.uid}`, encryptedPassword);

      // Update signup data
      updateSignupData({
        email,
        contactMethod: "email",
        contactValue: email
      });

      // Log the attempt
      await AuditLogger.log(user.uid, "EMAIL_VERIFICATION_SENT", {
        email,
        timestamp: new Date().toISOString()
      });

      toast.success("📧 Verification email sent! Check your inbox.");
      return user;
    } catch (error) {
      console.error("Email verification sending failed:", error);
      
      let userMessage = "Failed to send verification email";
      if (error.code === "auth/email-already-in-use") {
        userMessage = "This email is already registered";
      } else if (error.code === "auth/too-many-requests") {
        userMessage = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        userMessage = "Network error. Please check your connection.";
      }
      
      setError(userMessage);
      throw new Error(userMessage);
    } finally {
      setLoading(false);
    }
  }, [updateSignupData]);

  const verifyEmail = useCallback(async (actionCode) => {
    setLoading(true);
    setError(null);

    try {
      // Check the action code
      const info = await checkActionCode(auth, actionCode);
      
      // Apply the action code
      await applyActionCode(auth, actionCode);
      
      // Get the user
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Reload user to get updated email verification status
      await reload(user);
      
      if (!user.emailVerified) {
        throw new Error("Email verification failed");
      }

      // Initialize session
      initializeSession(user);
      
      // Log successful verification
      await AuditLogger.log(user.uid, "EMAIL_VERIFIED", {
        email: user.email,
        timestamp: new Date().toISOString()
      });

      toast.success("✅ Email verified successfully!");
      return user;
    } catch (error) {
      console.error("Email verification failed:", error);
      
      let userMessage = "Email verification failed";
      if (error.code === "auth/invalid-action-code") {
        userMessage = "Invalid verification link. Please request a new one.";
      } else if (error.code === "auth/expired-action-code") {
        userMessage = "Verification link has expired. Please request a new one.";
      }
      
      setError(userMessage);
      throw new Error(userMessage);
    } finally {
      setLoading(false);
    }
  }, [initializeSession]);

  /** ---------- PASSWORD MANAGEMENT ---------- */
  const setUserPassword = useCallback(async (password, user = auth.currentUser) => {
    if (!user) {
      throw new Error("No authenticated user");
    }

    // Validate password
    const validation = AdvancedValidator.validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Password is too weak: ${validation.requirements.join(", ")}`);
    }

    // Check password history (simplified - in production, store and check against previous passwords)
    const passwordHash = EncryptionService.hashPassword(password);
    
    // Update password
    await updatePassword(user, password);
    
    // Update signup data
    updateSignupData({ password });
    
    // Log password change
    await AuditLogger.log(user.uid, "PASSWORD_SET", {
      timestamp: new Date().toISOString(),
      strength: validation.strength
    });

    toast.success("🔐 Password set successfully!");
    
    return true;
  }, [updateSignupData]);

  /** ---------- COMPLETE SIGNUP ---------- */
  const completeSignup = useCallback(async (profileData = {}) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user");
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare user data
      const userData = {
        uid: user.uid,
        email: signupData.email || user.email || "",
        phone: signupData.phone || user.phoneNumber || "",
        
        // Personal Info
        firstName: signupData.firstName || "",
        lastName: signupData.lastName || "",
        displayName: `${signupData.firstName || ""} ${signupData.lastName || ""}`.trim() || "User",
        gender: signupData.gender || "",
        dob: signupData.dob || { day: "", month: "", year: "" },
        
        // Profile Customization
        username: signupData.username?.toLowerCase() || "",
        nickname: profileData.nickname || "",
        bio: profileData.bio || "",
        
        // Security
        emailVerified: user.emailVerified || false,
        phoneVerified: !!user.phoneNumber,
        accountStatus: "active",
        signupMethod: signupData.contactMethod,
        signupTimestamp: serverTimestamp(),
        
        // Settings
        settings: {
          privacy: profileData.privacy || "public",
          darkMode: false,
          notifications: true,
          language: "en",
          emailNotifications: true,
          pushNotifications: true,
          twoFactorEnabled: false,
          loginAlerts: true
        },
        
        // Stats
        coins: 100, // Initial coins
        level: 1,
        xp: 0,
        followersCount: 0,
        followingCount: 0,
        friendsCount: 0,
        postsCount: 0,
        
        // Social
        followers: [],
        following: [],
        friends: [],
        blockedUsers: [],
        
        // Media
        profilePicture: profileData.profilePicture || "/assets/default-profile.png",
        coverPhoto: profileData.coverPhoto || "",
        
        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        lastLogin: serverTimestamp(),
        profileCompleted: true,
        
        // Advanced Features
        badges: ["early-adopter"],
        achievements: [],
        preferences: {
          theme: "system",
          contentFilter: "standard",
          autoplayVideos: true,
          dataSaver: false
        }
      };

      // Upload profile picture if provided
      if (signupData.profilePictureFile) {
        try {
          const file = signupData.profilePictureFile;
          
          // Validate file
          if (!SECURITY_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            throw new Error("Invalid file type. Please use JPEG, PNG, WEBP, or GIF.");
          }
          
          if (file.size > SECURITY_CONFIG.MAX_PROFILE_IMAGE_SIZE) {
            throw new Error(`File too large. Maximum size is ${SECURITY_CONFIG.MAX_PROFILE_IMAGE_SIZE / (1024 * 1024)}MB.`);
          }
          
          // Upload to Firebase Storage
          const storagePath = `profile_pictures/${user.uid}/${Date.now()}_${file.name}`;
          const imageRef = storageRef(storage, storagePath);
          
          await uploadBytes(imageRef, file);
          const downloadURL = await getDownloadURL(imageRef);
          
          userData.profilePicture = downloadURL;
          
          // Update auth profile
          await updateAuthProfile(user, {
            photoURL: downloadURL,
            displayName: userData.displayName
          });
        } catch (uploadError) {
          console.warn("Profile picture upload failed:", uploadError);
          // Continue without profile picture
        }
      }

      // Create user document in Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, userData, { merge: true });

      // Create additional collections
      const batch = writeBatch(db);
      
      // Create user_stats subcollection
      const statsRef = doc(db, "users", user.uid, "stats", "overview");
      batch.set(statsRef, {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        engagementRate: 0,
        lastUpdated: serverTimestamp()
      });
      
      // Create user_security subcollection
      const securityRef = doc(db, "users", user.uid, "security", "settings");
      batch.set(securityRef, {
        loginHistory: [],
        trustedDevices: [],
        passwordChangedAt: serverTimestamp(),
        twoFactorEnabled: false,
        backupCodes: []
      });
      
      await batch.commit();

      // Log successful signup
      await AuditLogger.log(user.uid, "SIGNUP_COMPLETED", {
        method: signupData.contactMethod,
        timestamp: new Date().toISOString(),
        device: navigator.userAgent
      });

      // Clear temporary auth data
      sessionStorage.removeItem(`temp_auth_${user.uid}`);
      
      // Reset signup data
      resetSignup();
      
      toast.success("🎉 Welcome to Arvdoul! Your account has been created successfully!");
      
      return userData;
    } catch (error) {
      console.error("Signup completion failed:", error);
      
      let userMessage = "Failed to complete signup";
      if (error.code === "auth/requires-recent-login") {
        userMessage = "Session expired. Please verify your account again.";
      } else if (error.code === "auth/network-request-failed") {
        userMessage = "Network error. Please check your connection.";
      }
      
      setError(userMessage);
      throw new Error(userMessage);
    } finally {
      setLoading(false);
    }
  }, [signupData, resetSignup]);

  /** ---------- ERROR HANDLING ---------- */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetSignup = useCallback(() => {
    setSignupData({
      firstName: "",
      lastName: "",
      gender: "",
      dob: { day: "", month: "", year: "" },
      username: "",
      contactMethod: "",
      contactValue: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      profilePictureFile: null,
      bio: "",
      nickname: "",
      currentStep: 1,
      completedSteps: new Set(),
      verificationStatus: "pending",
      signupTimestamp: null,
      deviceFingerprint: null
    });
    setStep(1);
    setError(null);
    setVerificationId(null);
    setSecurityChecks({});
    cleanupRecaptcha();
    
    // Clear session
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    setSession({ token: null, expiresAt: null, refreshToken: null });
    
    // Reset rate limiter
    rateLimiter.current = new RateLimiter();
  }, [cleanupRecaptcha]);

  /** ---------- ADDITIONAL SECURITY FEATURES ---------- */
  const checkUsernameAvailability = useCallback(async (username) => {
    if (!username) return { available: false, message: "Username required" };
    
    const validation = AdvancedValidator.validateUsername(username);
    if (!validation.valid) {
      return { available: false, message: validation.message };
    }
    
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      return { 
        available: querySnapshot.empty, 
        message: querySnapshot.empty ? "Username available" : "Username already taken"
      };
    } catch (error) {
      console.error("Username check failed:", error);
      return { available: false, message: "Error checking username" };
    }
  }, []);

  const validateSignupStep = useCallback((stepNumber, data) => {
    switch (stepNumber) {
      case 1: // Personal Info
        const nameValidation = AdvancedValidator.validateName(data.firstName, "First name");
        if (!nameValidation.valid) return nameValidation;
        
        const lastNameValidation = AdvancedValidator.validateName(data.lastName, "Last name");
        if (!lastNameValidation.valid) return lastNameValidation;
        
        const dobValidation = AdvancedValidator.validateDOB(data.dob);
        if (!dobValidation.valid) return dobValidation;
        
        const genderValidation = AdvancedValidator.validateGender(data.gender);
        if (!genderValidation.valid) return genderValidation;
        
        return { valid: true, message: "Step 1 validation passed" };
        
      case 2: // Contact Info
        if (data.contactMethod === "email") {
          return AdvancedValidator.validateEmail(data.contactValue);
        } else if (data.contactMethod === "phone") {
          return AdvancedValidator.validatePhone(data.contactValue);
        }
        return { valid: false, message: "Please select a contact method" };
        
      case 3: // Verification
        return { valid: true, message: "Verification step" };
        
      case 4: // Password
        const passwordValidation = AdvancedValidator.validatePassword(data.password);
        if (!passwordValidation.valid) return passwordValidation;
        
        if (data.password !== data.confirmPassword) {
          return { valid: false, message: "Passwords do not match" };
        }
        
        return { valid: true, message: "Password validation passed" };
        
      default:
        return { valid: true, message: "Step validation passed" };
    }
  }, []);

  /** ---------- LOGOUT ---------- */
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      resetSignup();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed");
    }
  }, [resetSignup]);

  /** ---------- CONTEXT VALUE ---------- */
  const contextValue = useMemo(() => ({
    // State
    signupData,
    step,
    loading,
    error,
    recaptchaReady,
    verificationId,
    securityChecks,
    session,
    
    // Actions
    updateSignupData,
    nextStep,
    prevStep,
    goToStep,
    initRecaptcha,
    cleanupRecaptcha,
    sendOtp,
    verifyOtp,
    sendEmailVerificationCode,
    verifyEmail,
    setUserPassword,
    completeSignup,
    checkUsernameAvailability,
    validateSignupStep,
    clearError,
    resetSignup,
    logout,
    refreshSession,
    
    // Utilities
    validators: AdvancedValidator,
    encryption: EncryptionService,
    securityConfig: SECURITY_CONFIG
  }), [
    signupData,
    step,
    loading,
    error,
    recaptchaReady,
    verificationId,
    securityChecks,
    session,
    updateSignupData,
    nextStep,
    prevStep,
    goToStep,
    initRecaptcha,
    cleanupRecaptcha,
    sendOtp,
    verifyOtp,
    sendEmailVerificationCode,
    verifyEmail,
    setUserPassword,
    completeSignup,
    checkUsernameAvailability,
    validateSignupStep,
    clearError,
    resetSignup,
    logout,
    refreshSession
  ]);

  /** ---------- CLEANUP ---------- */
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
      cleanupRecaptcha();
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupRecaptcha]);

  return (
    <SignupContext.Provider value={contextValue}>
      {children}
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container" style={{ display: "none" }} />
    </SignupContext.Provider>
  );
};

/** ---------- HOOK EXPORT ---------- */
export const useSignup = () => {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error("useSignup must be used within a SignupProvider");
  }
  return context;
};