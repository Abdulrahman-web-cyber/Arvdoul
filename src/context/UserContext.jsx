// src/context/UserContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  onAuthStateChanged,
  signOut,
  updateProfile as updateAuthProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  reload,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  multiFactor,
  getMultiFactorResolver,
  PhoneMultiFactorGenerator,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  query,
  where,
  getDocs,
  collection,
  orderBy,
  limit,
  writeBatch,
  deleteDoc,
  setDoc,
  getCountFromServer,
  onSnapshot
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "../firebase/firebase";
import { toast } from "sonner";
import CryptoJS from "crypto-js";
import localforage from "localforage";
import { v4 as uuidv4 } from "uuid";
import { writeBatch as _writeBatch } from "firebase/firestore"; // not necessary but kept if used by tooling

/** ---------- USER MANAGEMENT CONSTANTS ---------- */
const USER_CONFIG = {
  // Profile Limits
  MAX_BIO_LENGTH: 500,
  MAX_NICKNAME_LENGTH: 30,
  MAX_USERNAME_LENGTH: 20,
  MIN_USERNAME_LENGTH: 3,

  // Media Limits
  MAX_PROFILE_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_COVER_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  // Activity Limits
  MAX_RECENT_ACTIVITIES: 100,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  DATA_RETENTION_DAYS: 365,

  // Performance
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_MS: 500,

  // Security
  MAX_PASSWORD_AGE_DAYS: 90,
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCKOUT_MINUTES: 15,
  ENABLE_LOGIN_ALERTS: true,
  ENABLE_SUSPICIOUS_ACTIVITY_DETECTION: true
};

/** ---------- ADVANCED USER VALIDATION ---------- */
class UserValidator {
  static validateProfileUpdate(updates) {
    const errors = {};
    const warnings = {};

    // Username validation
    if (updates.username !== undefined) {
      if (updates.username.length < USER_CONFIG.MIN_USERNAME_LENGTH) {
        errors.username = `Username must be at least ${USER_CONFIG.MIN_USERNAME_LENGTH} characters`;
      } else if (updates.username.length > USER_CONFIG.MAX_USERNAME_LENGTH) {
        errors.username = `Username must be less than ${USER_CONFIG.MAX_USERNAME_LENGTH} characters`;
      } else if (!/^[a-zA-Z0-9_.]+$/.test(updates.username)) {
        errors.username = "Username can only contain letters, numbers, underscores, and periods";
      } else if (/^[0-9]/.test(updates.username)) {
        errors.username = "Username cannot start with a number";
      }
    }

    // Bio validation
    if (updates.bio !== undefined) {
      if (updates.bio.length > USER_CONFIG.MAX_BIO_LENGTH) {
        errors.bio = `Bio must be less than ${USER_CONFIG.MAX_BIO_LENGTH} characters`;
      }
    }

    // Nickname validation
    if (updates.nickname !== undefined) {
      if (updates.nickname.length > USER_CONFIG.MAX_NICKNAME_LENGTH) {
        errors.nickname = `Nickname must be less than ${USER_CONFIG.MAX_NICKNAME_LENGTH} characters`;
      }
    }

    // Display name validation
    if (updates.displayName !== undefined) {
      if (updates.displayName.trim().length < 2) {
        errors.displayName = "Name must be at least 2 characters";
      }
      if (updates.displayName.trim().length > 50) {
        warnings.displayName = "Name is quite long";
      }
    }

    // Privacy settings validation
    if (updates.privacy !== undefined) {
      const validPrivacy = ['public', 'private', 'friends_only', 'mutual_friends'];
      if (!validPrivacy.includes(updates.privacy)) {
        errors.privacy = "Invalid privacy setting";
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }

  static validatePasswordChange(currentPassword, newPassword) {
    const issues = [];

    if (!currentPassword) {
      issues.push("Current password is required");
    }

    if (!newPassword) {
      issues.push("New password is required");
    } else {
      if (newPassword.length < 8) issues.push("Password must be at least 8 characters");
      if (!/[A-Z]/.test(newPassword)) issues.push("Password must contain at least one uppercase letter");
      if (!/[a-z]/.test(newPassword)) issues.push("Password must contain at least one lowercase letter");
      if (!/[0-9]/.test(newPassword)) issues.push("Password must contain at least one number");
      if (!/[^A-Za-z0-9]/.test(newPassword)) issues.push("Password must contain at least one special character");
      if (/(.)\1{2,}/.test(newPassword)) issues.push("Password contains repeated characters");
      if (/123|abc|qwerty|password/i.test(newPassword)) issues.push("Password is too common");
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

/** ---------- ENCRYPTION SERVICE ---------- */
class UserEncryptionService {
  static encrypt(data, key = import.meta.env.VITE_ENCRYPTION_KEY || "arvdoul-secure-key-2024") {
    try {
      return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    } catch (error) {
      console.error("Encryption error:", error);
      return JSON.stringify(data);
    }
  }

  static decrypt(encryptedData, key = import.meta.env.VITE_ENCRYPTION_KEY || "arvdoul-secure-key-2024") {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      console.error("Decryption error:", error);
      try {
        // fallback attempt
        return JSON.parse(encryptedData);
      } catch (e) {
        return encryptedData;
      }
    }
  }

  static hashData(data) {
    try {
      return CryptoJS.SHA256(JSON.stringify(data)).toString();
    } catch (error) {
      console.error("Hashing error:", error);
      return String(Math.random()).slice(2, 10);
    }
  }
}

/** ---------- CACHE MANAGER ---------- */
class UserCacheManager {
  constructor() {
    this.cache = localforage.createInstance({
      name: "arvdoul_user_cache",
      driver: [
        localforage.INDEXEDDB,
        localforage.WEBSQL,
        localforage.LOCALSTORAGE
      ]
    });
  }

  async set(key, data, ttl = USER_CONFIG.CACHE_TTL) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      };
      await this.cache.setItem(key, cacheItem);
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async get(key) {
    try {
      const cacheItem = await this.cache.getItem(key);
      if (!cacheItem) return null;

      if (cacheItem.expiresAt && Date.now() > cacheItem.expiresAt) {
        await this.cache.removeItem(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async invalidate(prefix = "") {
    try {
      const keys = await this.cache.keys();
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          await this.cache.removeItem(key);
        }
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  async clear() {
    try {
      await this.cache.clear();
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }
}

/** ---------- ACTIVITY TRACKER ---------- */
class ActivityTracker {
  static async track(userId, action, details = {}) {
    try {
      const activityId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const activity = {
        id: activityId,
        userId,
        action,
        details: UserEncryptionService.encrypt(details),
        timestamp: serverTimestamp(),
        ip: await this.getClientIP(),
        userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "node"),
        platform: this.getPlatformInfo()
      };

      const userRef = doc(db, "users", userId);
      const activityRef = doc(db, "users", userId, "activities", activityId);

      const batch = writeBatch(db);
      batch.set(activityRef, activity);

      // Update recent activities (limited)
      batch.update(userRef, {
        recentActivities: arrayUnion({
          id: activityId,
          action,
          timestamp: new Date().toISOString()
        })
      });

      await batch.commit();

      // Trim activities if needed
      await this.trimActivities(userId);

    } catch (error) {
      console.error("Activity tracking failed:", error);
    }
  }

  static async getClientIP() {
    try {
      if (typeof fetch === "undefined") return "unknown";
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return "unknown";
    }
  }

  static getPlatformInfo() {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      return {
        browser: this.getBrowser(),
        os: this.getOS(),
        isMobile: /iPhone|iPad|iPod|Android/i.test(ua),
        screenResolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "unknown"
      };
    } catch (e) {
      return {};
    }
  }

  static getBrowser() {
    const userAgent = (typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  }

  static getOS() {
    const userAgent = (typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
    return "Unknown";
  }

  static async trimActivities(userId) {
    try {
      const activitiesRef = collection(db, "users", userId, "activities");
      const q = query(activitiesRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);

      if (snapshot.docs.length > USER_CONFIG.MAX_RECENT_ACTIVITIES) {
        const toDelete = snapshot.docs.slice(USER_CONFIG.MAX_RECENT_ACTIVITIES);
        const batch = writeBatch(db);

        for (const d of toDelete) {
          batch.delete(d.ref);
        }

        await batch.commit();
      }
    } catch (error) {
      console.error("Trim activities error:", error);
    }
  }
}

/** ---------- SECURITY MONITOR ---------- */
class SecurityMonitor {
  static async detectSuspiciousActivity(userId, action, context = {}) {
    if (!USER_CONFIG.ENABLE_SUSPICIOUS_ACTIVITY_DETECTION) return false;

    try {
      const activitiesRef = collection(db, "users", userId, "activities");
      const recentQuery = query(
        activitiesRef,
        where("action", "==", action),
        orderBy("timestamp", "desc"),
        limit(10)
      );

      const snapshot = await getDocs(recentQuery);

      // Check frequency
      if (snapshot.docs.length >= 10) {
        const first = snapshot.docs[snapshot.docs.length - 1].data();
        const last = snapshot.docs[0].data();

        const timeDiff = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
        const frequency = snapshot.docs.length / (timeDiff / (1000 * 60)); // actions per minute

        if (frequency > 60) { // More than 1 action per second
          await this.triggerSecurityAlert(userId, "high_frequency", { action, frequency });
          return true;
        }
      }

      // Check IP changes
      const ipQuery = query(
        activitiesRef,
        where("action", "in", ["login", "password_change", "email_update"]),
        orderBy("timestamp", "desc"),
        limit(5)
      );

      const ipSnapshot = await getDocs(ipQuery);
      const uniqueIPs = new Set();

      ipSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.ip) uniqueIPs.add(data.ip);
      });

      if (uniqueIPs.size > 3) {
        await this.triggerSecurityAlert(userId, "multiple_ips", {
          action,
          ipCount: uniqueIPs.size,
          ips: Array.from(uniqueIPs)
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Security monitoring error:", error);
      return false;
    }
  }

  static async triggerSecurityAlert(userId, alertType, details = {}) {
    try {
      const alertId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const alert = {
        id: alertId,
        userId,
        type: alertType,
        details: UserEncryptionService.encrypt(details),
        timestamp: serverTimestamp(),
        resolved: false,
        severity: alertType.includes("high") ? "high" : "medium"
      };

      await setDoc(doc(db, "security_alerts", alertId), alert);

      // Send notification if enabled
      if (USER_CONFIG.ENABLE_LOGIN_ALERTS) {
        await this.sendSecurityNotification(userId, alertType);
      }

    } catch (error) {
      console.error("Security alert creation failed:", error);
    }
  }

  static async sendSecurityNotification(userId, alertType) {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const notification = {
          id: uuidv4(),
          type: "security_alert",
          title: "Security Alert",
          message: `Suspicious activity detected: ${alertType.replace(/_/g, ' ')}`,
          timestamp: serverTimestamp(),
          read: false,
          action: {
            type: "review_activity",
            data: { userId }
          }
        };

        await updateDoc(userRef, {
          notifications: arrayUnion(notification)
        });
      }
    } catch (error) {
      console.error("Security notification failed:", error);
    }
  }
}

/** ---------- USER CONTEXT ---------- */
const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  // Core State
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Session State
  const [session, setSession] = useState({
    token: null,
    expiresAt: null,
    refreshToken: null,
    lastActive: Date.now()
  });

  // Activity State
  const [activities, setActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    engagementRate: 0
  });

  // References
  const authUnsubscribeRef = useRef(null);
  const profileUnsubscribeRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const debounceTimersRef = useRef({});

  // Services
  const cacheManager = useRef(new UserCacheManager());

  /** ---------- INITIALIZATION ---------- */
  useEffect(() => {
    initializeUser();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---------- CLEANUP ---------- */
  const cleanup = useCallback(() => {
    if (authUnsubscribeRef.current) {
      authUnsubscribeRef.current();
      authUnsubscribeRef.current = null;
    }
    if (profileUnsubscribeRef.current) {
      profileUnsubscribeRef.current();
      profileUnsubscribeRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Clear all debounce timers
    Object.values(debounceTimersRef.current).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    debounceTimersRef.current = {};
  }, []);

  /** ---------- AUTH STATE LISTENER ---------- */
  const initializeUser = useCallback(async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cachedUser = await cacheManager.current.get("current_user");
      const cachedProfile = await cacheManager.current.get("user_profile");

      if (cachedUser && cachedProfile) {
        setUser(cachedUser);
        setUserProfile(cachedProfile);
        setInitialized(true);
      }

      // Setup auth state listener
      authUnsubscribeRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          setInitialized(true);
          await cacheManager.current.clear();
          return;
        }

        await handleAuthenticatedUser(firebaseUser);
      });

    } catch (error) {
      console.error("User initialization failed:", error);
      setError("Failed to initialize user session");
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  /** ---------- HANDLE AUTHENTICATED USER ---------- */
  const handleAuthenticatedUser = useCallback(async (firebaseUser) => {
    try {
      // Load user profile
      await loadUserProfile(firebaseUser.uid);

      // Setup session management
      initializeSession(firebaseUser);

      // Track login activity
      await ActivityTracker.track(firebaseUser.uid, "login", {
        method: firebaseUser.providerData[0]?.providerId || "unknown",
        emailVerified: firebaseUser.emailVerified,
        multiFactorEnabled: firebaseUser.multiFactor?.enrolledFactors?.length > 0
      });

      // Security monitoring
      await SecurityMonitor.detectSuspiciousActivity(firebaseUser.uid, "login");

      setLoading(false);
      setInitialized(true);

    } catch (error) {
      console.error("User authentication handling failed:", error);
      setError("Failed to load user profile");
      setLoading(false);
    }
  }, []);

  /** ---------- LOAD USER PROFILE ---------- */
  const loadUserProfile = useCallback(async (userId) => {
    try {
      const cachedProfile = await cacheManager.current.get(`profile_${userId}`);
      if (cachedProfile) {
        setUserProfile(cachedProfile);
      }

      // Setup real-time profile listener
      const userRef = doc(db, "users", userId);

      profileUnsubscribeRef.current = onSnapshot(userRef, async (snapshot) => {
        if (!snapshot.exists()) {
          // Create initial profile if doesn't exist
          await createInitialProfile(userId);
          return;
        }

        const profileData = snapshot.data();
        const enhancedProfile = {
          ...profileData,
          lastSeen: new Date().toISOString(),
          isOnline: true
        };

        setUserProfile(enhancedProfile);
        await cacheManager.current.set(`profile_${userId}`, enhancedProfile);

        // Update user stats if they exist
        if (profileData.stats) {
          setStats(profileData.stats);
        }

        // Update notifications
        if (profileData.notifications) {
          setNotifications(profileData.notifications);
        }
      });

    } catch (error) {
      console.error("Profile loading failed:", error);
      throw error;
    }
  }, []);

  /** ---------- CREATE INITIAL PROFILE ---------- */
  const createInitialProfile = useCallback(async (userId) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      const initialProfile = {
        uid: userId,
        email: firebaseUser.email || "",
        phone: firebaseUser.phoneNumber || "",
        displayName: firebaseUser.displayName || "User",
        username: firebaseUser.email?.split("@")[0] || `user_${userId.slice(0, 8)}`,
        bio: "",
        profilePicture: firebaseUser.photoURL || "/assets/default-profile.png",
        coverPhoto: "",
        privacy: "public",
        verified: false,
        badges: ["new_user"],
        settings: {
          theme: "system",
          notifications: true,
          emailNotifications: true,
          pushNotifications: true,
          privacy: "public",
          language: "en",
          twoFactorEnabled: false
        },
        stats: {
          totalPosts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          engagementRate: 0,
          followersCount: 0,
          followingCount: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp()
      };

      await setDoc(doc(db, "users", userId), initialProfile);

    } catch (error) {
      console.error("Initial profile creation failed:", error);
    }
  }, []);

  /** ---------- SESSION MANAGEMENT ---------- */
  const initializeSession = useCallback((firebaseUser) => {
    const sessionToken = uuidv4();
    const expiresAt = Date.now() + USER_CONFIG.SESSION_TIMEOUT;
    const refreshToken = uuidv4();

    const userSession = {
      token: sessionToken,
      expiresAt,
      refreshToken,
      lastActive: Date.now(),
      userId: firebaseUser.uid,
      deviceInfo: {
        userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "node"),
        platform: (typeof navigator !== "undefined" ? navigator.platform : "node"),
        language: (typeof navigator !== "undefined" ? navigator.language : "en")
      }
    };

    setSession(userSession);

    // Store session
    try {
      localStorage.setItem("user_session", JSON.stringify(userSession));
    } catch (e) {
      // ignore storage errors in restricted environments
    }

    // Setup session timer
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      checkSessionValidity();
    }, 60000); // Check every minute

    // Setup inactivity tracker
    setupInactivityTracker();

    // Update last active
    updateLastActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSessionValidity = useCallback(() => {
    try {
      if (!session || !session.expiresAt) return;
      if (Date.now() > session.expiresAt) {
        toast.warning("Your session has expired. Please log in again.");
        logout();
      }
    } catch (e) {
      console.error("checkSessionValidity error:", e);
    }
  }, [session, logout]);

  const setupInactivityTracker = useCallback(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const resetInactivityTimer = () => {
      setSession(prev => ({
        ...prev,
        lastActive: Date.now()
      }));
    };

    events.forEach(event => {
      try {
        document.addEventListener(event, resetInactivityTimer);
      } catch (e) {
        // ignore in non-browser envs
      }
    });

    inactivityTimerRef.current = setInterval(() => {
      try {
        const inactiveTime = Date.now() - (session?.lastActive || Date.now());
        if (inactiveTime > 5 * 60 * 1000) { // 5 minutes
          // User is inactive
          if (inactiveTime > 10 * 60 * 1000) { // 10 minutes
            toast.info("You've been inactive. Session will expire soon.");
          }
        }
      } catch (e) {
        console.error("inactivityTimer error:", e);
      }
    }, 60000); // Check every minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const updateLastActive = useCallback(async () => {
    if (!userProfile?.uid) return;

    try {
      const userRef = doc(db, "users", userProfile.uid);
      await updateDoc(userRef, {
        lastActive: serverTimestamp()
      });

      setSession(prev => ({
        ...prev,
        lastActive: Date.now()
      }));
    } catch (error) {
      console.error("Last active update failed:", error);
    }
  }, [userProfile]);

  /** ---------- USER PROFILE MANAGEMENT ---------- */
  const updateProfile = useCallback(async (updates) => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      // Validate updates
      const validation = UserValidator.validateProfileUpdate(updates);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors)[0]);
      }

      // Check for username uniqueness if changing username
      if (updates.username && updates.username !== userProfile.username) {
        const usernameExists = await checkUsernameExists(updates.username);
        if (usernameExists) {
          throw new Error("Username is already taken");
        }
      }

      const userRef = doc(db, "users", userProfile.uid);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      // Update Firestore
      await updateDoc(userRef, updateData);

      // Update Firebase Auth profile if needed
      if (updates.displayName || updates.profilePicture) {
        try {
          await updateAuthProfile(auth.currentUser, {
            displayName: updates.displayName || userProfile.displayName,
            photoURL: updates.profilePicture || userProfile.profilePicture
          });
        } catch (e) {
          // non-critical
          console.warn("updateAuthProfile failed:", e);
        }
      }

      // Invalidate cache
      await cacheManager.current.invalidate(`profile_${userProfile.uid}`);

      // Track activity
      await ActivityTracker.track(userProfile.uid, "profile_update", {
        updatedFields: Object.keys(updates)
      });

      toast.success("Profile updated successfully");
      return true;

    } catch (error) {
      console.error("Profile update failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Failed to update profile");
      throw error;
    }
  }, [userProfile]);

  const uploadProfileImage = useCallback(async (file, type = "profile") => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      // Validate file
      if (!USER_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Please use JPEG, PNG, WEBP, or GIF.");
      }

      const maxSize = type === "profile"
        ? USER_CONFIG.MAX_PROFILE_IMAGE_SIZE
        : USER_CONFIG.MAX_COVER_IMAGE_SIZE;

      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      }

      // Upload to storage
      const storagePath = `${type}_images/${userProfile.uid}/${Date.now()}_${file.name}`;
      const imageRef = storageRef(storage, storagePath);

      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);

      // Update profile
      const updateField = type === "profile" ? "profilePicture" : "coverPhoto";
      await updateProfile({ [updateField]: downloadURL });

      // Track activity
      await ActivityTracker.track(userProfile.uid, `${type}_image_upload`, {
        fileSize: file.size,
        fileType: file.type
      });

      return downloadURL;

    } catch (error) {
      console.error("Image upload failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Image upload failed");
      throw error;
    }
  }, [userProfile, updateProfile]);

  const deleteProfileImage = useCallback(async (type = "profile") => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      const imageUrl = type === "profile"
        ? userProfile.profilePicture
        : userProfile.coverPhoto;

      if (!imageUrl || imageUrl.includes("default")) {
        throw new Error(`No ${type} image to delete`);
      }

      // Extract storage path from URL — best-effort for Firebase Storage
      const parts = imageUrl.split("/o/");
      if (parts.length < 2) throw new Error("Unsupported image URL format");
      const storagePath = decodeURIComponent(parts[1].split("?")[0]);

      // Delete from storage
      const imageRef = storageRef(storage, storagePath);
      await deleteObject(imageRef);

      // Update profile
      const updateField = type === "profile" ? "profilePicture" : "coverPhoto";
      const defaultValue = type === "profile"
        ? "/assets/default-profile.png"
        : "";

      await updateProfile({ [updateField]: defaultValue });

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} image deleted`);

    } catch (error) {
      console.error("Image deletion failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Failed to delete image");
      throw error;
    }
  }, [userProfile, updateProfile]);

  /** ---------- ACCOUNT MANAGEMENT ---------- */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No authenticated user");
    }

    try {
      // Validate passwords
      const validation = UserValidator.validatePasswordChange(currentPassword, newPassword);
      if (!validation.isValid) {
        throw new Error(validation.issues[0]);
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      // Track activity
      await ActivityTracker.track(auth.currentUser.uid, "password_change", {
        timestamp: new Date().toISOString()
      });

      // Security monitoring
      await SecurityMonitor.detectSuspiciousActivity(auth.currentUser.uid, "password_change");

      toast.success("Password changed successfully");
      return true;

    } catch (error) {
      console.error("Password change failed:", error);

      let userMessage = "Failed to change password";
      if (error.code === "auth/wrong-password") {
        userMessage = "Current password is incorrect";
      } else if (error.code === "auth/weak-password") {
        userMessage = "New password is too weak";
      } else if (error.code === "auth/requires-recent-login") {
        userMessage = "Please re-authenticate to change password";
      }

      setError(userMessage);
      toast.error(userMessage);
      throw new Error(userMessage);
    }
  }, []);

  const changeEmail = useCallback(async (newEmail, password) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No authenticated user");
    }

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update email with verification
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);

      // Track activity
      await ActivityTracker.track(auth.currentUser.uid, "email_change_requested", {
        oldEmail: auth.currentUser.email,
        newEmail
      });

      toast.success("Verification email sent to new address");
      return true;

    } catch (error) {
      console.error("Email change failed:", error);

      let userMessage = "Failed to change email";
      if (error.code === "auth/requires-recent-login") {
        userMessage = "Please re-authenticate to change email";
      } else if (error.code === "auth/email-already-in-use") {
        userMessage = "Email is already in use";
      }

      setError(userMessage);
      toast.error(userMessage);
      throw new Error(userMessage);
    }
  }, []);

  const deleteAccount = useCallback(async (password) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No authenticated user");
    }

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Create deletion request
      const deletionRequest = {
        userId: auth.currentUser.uid,
        requestedAt: serverTimestamp(),
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        reason: "user_requested",
        status: "pending"
      };

      await setDoc(doc(db, "account_deletions", auth.currentUser.uid), deletionRequest);

      // Track activity
      await ActivityTracker.track(auth.currentUser.uid, "account_deletion_requested", {
        timestamp: new Date().toISOString()
      });

      // Log out user
      await logout();

      toast.info("Account deletion scheduled. You can cancel within 30 days.");
      return true;

    } catch (error) {
      console.error("Account deletion failed:", error);

      let userMessage = "Failed to delete account";
      if (error.code === "auth/wrong-password") {
        userMessage = "Incorrect password";
      }

      setError(userMessage);
      toast.error(userMessage);
      throw new Error(userMessage);
    }
  }, [logout]);

  /** ---------- SOCIAL FEATURES ---------- */
  const followUser = useCallback(async (targetUserId) => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    if (userProfile.uid === targetUserId) {
      throw new Error("Cannot follow yourself");
    }

    try {
      const userRef = doc(db, "users", userProfile.uid);
      const targetRef = doc(db, "users", targetUserId);

      // Run transaction
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const targetSnap = await transaction.get(targetRef);

        if (!userSnap.exists() || !targetSnap.exists()) {
          throw new Error("User not found");
        }

        const userData = userSnap.data();

        // Check if already following
        if (userData.following?.includes(targetUserId)) {
          throw new Error("Already following this user");
        }

        // Update following list
        transaction.update(userRef, {
          following: arrayUnion(targetUserId),
          followingCount: increment(1),
          updatedAt: serverTimestamp()
        });

        // Update followers list
        transaction.update(targetRef, {
          followers: arrayUnion(userProfile.uid),
          followersCount: increment(1),
          updatedAt: serverTimestamp()
        });
      });

      // Create notification for target user
      const notification = {
        id: uuidv4(),
        type: "follow",
        userId: userProfile.uid,
        title: "New Follower",
        message: `${userProfile.displayName} started following you`,
        timestamp: serverTimestamp(),
        read: false,
        data: {
          followerId: userProfile.uid,
          followerName: userProfile.displayName
        }
      };

      await updateDoc(targetRef, {
        notifications: arrayUnion(notification)
      });

      // Track activity
      await ActivityTracker.track(userProfile.uid, "follow_user", {
        targetUserId
      });

      toast.success("User followed successfully");
      return true;

    } catch (error) {
      console.error("Follow user failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Failed to follow user");
      throw error;
    }
  }, [userProfile]);

  const unfollowUser = useCallback(async (targetUserId) => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      const userRef = doc(db, "users", userProfile.uid);
      const targetRef = doc(db, "users", targetUserId);

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const targetSnap = await transaction.get(targetRef);

        if (!userSnap.exists() || !targetSnap.exists()) {
          throw new Error("User not found");
        }

        // Update following list
        transaction.update(userRef, {
          following: arrayRemove(targetUserId),
          followingCount: increment(-1),
          updatedAt: serverTimestamp()
        });

        // Update followers list
        transaction.update(targetRef, {
          followers: arrayRemove(userProfile.uid),
          followersCount: increment(-1),
          updatedAt: serverTimestamp()
        });
      });

      // Track activity
      await ActivityTracker.track(userProfile.uid, "unfollow_user", {
        targetUserId
      });

      toast.success("User unfollowed");
      return true;

    } catch (error) {
      console.error("Unfollow user failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Failed to unfollow user");
      throw error;
    }
  }, [userProfile]);

  const blockUser = useCallback(async (targetUserId, reason = "") => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      const userRef = doc(db, "users", userProfile.uid);

      await updateDoc(userRef, {
        blockedUsers: arrayUnion({
          userId: targetUserId,
          reason,
          blockedAt: serverTimestamp()
        }),
        updatedAt: serverTimestamp()
      });

      // Also unfollow if following
      try { await unfollowUser(targetUserId); } catch (e) { /* ignore */ }

      // Track activity
      await ActivityTracker.track(userProfile.uid, "block_user", {
        targetUserId,
        reason
      });

      toast.success("User blocked successfully");
      return true;

    } catch (error) {
      console.error("Block user failed:", error);
      setError(error.message || String(error));
      toast.error(error.message || "Failed to block user");
      throw error;
    }
  }, [userProfile, unfollowUser]);

  /** ---------- NOTIFICATIONS ---------- */
  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      const userRef = doc(db, "users", userProfile.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const notificationsArr = userSnap.data().notifications || [];
      const updatedNotifications = notificationsArr.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true, readAt: new Date().toISOString() }
          : notification
      );

      await updateDoc(userRef, {
        notifications: updatedNotifications
      });

      setNotifications(updatedNotifications);

    } catch (error) {
      console.error("Mark notification as read failed:", error);
    }
  }, [userProfile]);

  const clearAllNotifications = useCallback(async () => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      const userRef = doc(db, "users", userProfile.uid);

      await updateDoc(userRef, {
        notifications: []
      });

      setNotifications([]);
      toast.success("Notifications cleared");

    } catch (error) {
      console.error("Clear notifications failed:", error);
      toast.error("Failed to clear notifications");
    }
  }, [userProfile]);

  /** ---------- UTILITIES ---------- */
  const checkUsernameExists = useCallback(async (username) => {
    if (!username) return false;

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const snapshot = await getDocs(q);

      return !snapshot.empty;
    } catch (error) {
      console.error("Username check failed:", error);
      return false;
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!userProfile?.uid) return;

    try {
      await cacheManager.current.invalidate(`profile_${userProfile.uid}`);
      try { await reload(auth.currentUser); } catch (e) { /* ignore if reload fails */ }

      toast.success("User data refreshed");
    } catch (error) {
      console.error("User data refresh failed:", error);
    }
  }, [userProfile]);

  const exportUserData = useCallback(async () => {
    if (!userProfile?.uid) {
      throw new Error("No user logged in");
    }

    try {
      // Get all user data
      const userRef = doc(db, "users", userProfile.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User data not found");
      }

      // Get activities
      const activitiesRef = collection(db, "users", userProfile.uid, "activities");
      const activitiesSnap = await getDocs(activitiesRef);
      const activitiesData = activitiesSnap.docs.map(d => d.data());

      const exportData = {
        profile: userSnap.data(),
        activities: activitiesData,
        exportDate: new Date().toISOString(),
        exportFormat: "JSON v1.0"
      };

      // Create downloadable file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

      const exportFileName = `arvdoul_export_${userProfile.uid}_${Date.now()}.json`;

      // Create temporary link and trigger download
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();

      // Track activity
      await ActivityTracker.track(userProfile.uid, "data_export", {
        fileSize: dataStr.length
      });

      toast.success("Data exported successfully");

    } catch (error) {
      console.error("Data export failed:", error);
      toast.error("Failed to export data");
      throw error;
    }
  }, [userProfile]);

  /** ---------- LOGOUT ---------- */
  const logout = useCallback(async () => {
    try {
      if (userProfile?.uid) {
        // Track logout activity
        await ActivityTracker.track(userProfile.uid, "logout", {
          timestamp: new Date().toISOString()
        });
      }

      await signOut(auth);

      // Clear local state
      setUser(null);
      setUserProfile(null);
      setSession({
        token: null,
        expiresAt: null,
        refreshToken: null,
        lastActive: null
      });

      // Clear cache
      await cacheManager.current.clear();

      // Clear local storage
      try { localStorage.removeItem("user_session"); } catch (e) { /* ignore */ }

      // Cleanup listeners
      cleanup();

      toast.success("Logged out successfully");

    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed");
      throw error;
    }
  }, [userProfile, cleanup]);

  /** ---------- CONTEXT VALUE ---------- */
  const contextValue = useMemo(() => ({
    // State
    user: auth.currentUser,
    userProfile,
    loading,
    initialized,
    error,
    session,
    activities,
    notifications,
    stats,

    // Profile Management
    updateProfile,
    uploadProfileImage,
    deleteProfileImage,

    // Account Management
    changePassword,
    changeEmail,
    deleteAccount,

    // Social Features
    followUser,
    unfollowUser,
    blockUser,

    // Notifications
    markNotificationAsRead,
    clearAllNotifications,

    // Utilities
    checkUsernameExists,
    refreshUserData,
    exportUserData,

    // Auth
    logout,

    // Services
    validator: UserValidator,
    encryption: UserEncryptionService,
    cache: cacheManager.current,
    config: USER_CONFIG
  }), [
    userProfile,
    loading,
    initialized,
    error,
    session,
    activities,
    notifications,
    stats,
    updateProfile,
    uploadProfileImage,
    deleteProfileImage,
    changePassword,
    changeEmail,
    deleteAccount,
    followUser,
    unfollowUser,
    blockUser,
    markNotificationAsRead,
    clearAllNotifications,
    checkUsernameExists,
    refreshUserData,
    exportUserData,
    logout
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

/** ---------- CUSTOM HOOK ---------- */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

/** ---------- HIGHER ORDER COMPONENT ---------- */
export const withUser = (Component) => {
  return function WithUserComponent(props) {
    const userContext = useUser();
    return <Component {...props} userContext={userContext} />;
  };
};