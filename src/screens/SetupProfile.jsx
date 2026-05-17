// src/screens/SetupProfile.jsx – ARVDOUL SUPREMACY • FINAL ULTRA PRODUCTION
// ✅ Offline banner, non‑scrollable glass card, username generator based on display name
// ✅ Firebase Auth update, avatar upload, skip button, no delay, glowing button

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { updateProfile as firebaseUpdateProfile } from "firebase/auth";

import {
  createUserProfile,
  checkUsernameAvailability,
  generateDefaultAvatar,
} from "../services/userService.js";
import storageService from "../services/storageService.js";

// ==================== AVATAR UPLOADER (unchanged, perfect) ====================
const PerfectAvatarUploader = React.memo(
  ({ onUpload, currentAvatar, displayName, userId, theme, loading = false }) => {
    const [avatarPreview, setAvatarPreview] = useState(currentAvatar);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const fileInputRef = useRef(null);

    const resolvedTheme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    useEffect(() => {
      if (!currentAvatar && displayName && userId) {
        try {
          setAvatarPreview(generateDefaultAvatar(userId, displayName));
        } catch (error) {
          setAvatarPreview("/assets/default-profile.png");
        }
      } else if (currentAvatar) {
        setAvatarPreview(currentAvatar);
      }
    }, [currentAvatar, displayName, userId]);

    const handleFileSelect = async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please select a valid image");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Maximum file size is 5MB");
        return;
      }
      try {
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);
        setUploadProgress(10);
        const uploadPath = `avatars/${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}_${file.name.replace(/\s+/g, "_")}`;
        const result = await storageService.uploadFileWithProgress(
          file,
          uploadPath,
          {
            onProgress: (progressData) =>
              setUploadProgress(progressData.progress),
          }
        );
        setUploadProgress(100);
        if (result.success && onUpload) {
          onUpload(result.downloadURL);
          toast.success("🎉 Profile picture updated!");
        }
        setTimeout(() => setUploadProgress(0), 1000);
      } catch (error) {
        console.error("Avatar upload error:", error);
        toast.error("Upload failed. Please try again.");
        setUploadProgress(0);
      }
    };

    const handleClick = () => {
      if (!loading && fileInputRef.current) fileInputRef.current.click();
    };

    return (
      <div className="relative w-full">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          accept="image/*"
          className="hidden"
          disabled={loading}
        />
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleClick}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
              isDragging
                ? "border-3 border-dashed border-indigo-500 bg-indigo-500/10"
                : resolvedTheme === "dark"
                ? "border-2 border-gray-700 bg-gray-800/50"
                : "border-2 border-gray-300 bg-gray-50"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              {avatarPreview ? (
                <motion.img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{
                    scale: isHovering ? 1.1 : 1,
                    filter: isHovering ? "brightness(1.05)" : "brightness(1)",
                  }}
                  transition={{ duration: 0.3 }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = generateDefaultAvatar(
                      userId || "temp",
                      displayName || "User"
                    );
                  }}
                />
              ) : (
                <div
                  className={`w-full h-full flex items-center justify-center ${
                    resolvedTheme === "dark"
                      ? "bg-gray-800 text-gray-400"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <svg
                    className="w-16 h-16 sm:w-20 sm:h-20 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}
            </div>
            <motion.div
              className={`absolute bottom-2 right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                resolvedTheme === "dark"
                  ? "bg-gray-900/80 border border-gray-700"
                  : "bg-white/80 border border-gray-300"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </motion.div>
            {uploadProgress > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center"
              >
                <div className="relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="8"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="8"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: uploadProgress / 100 }}
                        transition={{ duration: 0.5 }}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white">
                        {uploadProgress}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
          <div className="text-center space-y-1">
            <p
              className={`text-sm font-medium ${
                resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Profile Picture
            </p>
            <p className="text-xs text-gray-500">
              Tap to upload or we'll generate one
            </p>
          </div>
        </div>
      </div>
    );
  }
);
PerfectAvatarUploader.displayName = "PerfectAvatarUploader";

// ==================== SMART USERNAME GENERATOR (FIXED) ====================
const SmartUsernameGenerator = React.memo(
  ({ username, onChange, theme, loading = false, displayName = "", userId = null }) => {
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const timeoutRef = useRef(null);

    const resolvedTheme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    const validateUsername = useCallback(
      async (value) => {
        if (!value || value.trim().length < 3) {
          setStatus("idle");
          setMessage("Minimum 3 characters");
          return;
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
          setStatus("invalid");
          setMessage("Use letters, numbers, dots, dashes, or underscores");
          return;
        }
        if (value.length > 30) {
          setStatus("invalid");
          setMessage("Maximum 30 characters");
          return;
        }

        setIsChecking(true);
        setStatus("checking");
        setMessage("Checking availability...");

        try {
          const result = await checkUsernameAvailability(value, userId);
          if (result.available) {
            setStatus("available");
            setMessage("Username available!");
          } else if (result.error) {
            console.warn("Username check failed:", result.error, result.errorCode);
            setStatus("error");
            setMessage("Unable to verify – try again");
          } else {
            setStatus("taken");
            setMessage("Username is taken");
          }
        } catch (error) {
          console.error("Username check exception:", error);
          setStatus("error");
          setMessage("Unable to verify");
        } finally {
          setIsChecking(false);
        }
      },
      [userId]
    );

    const generateSmartUsername = useCallback(async () => {
      if (!displayName || !displayName.trim()) {
        toast.error("Please enter a display name first");
        return;
      }
      setStatus("checking");
      setMessage("Generating unique username...");

      try {
        const { generateUniqueUsername } = await import("../services/userService.js");
        const generated = await generateUniqueUsername(displayName, userId);
        if (generated && generated.length >= 3) {
          onChange(generated);
          await validateUsername(generated);
          toast.success("Username generated!");
        } else {
          throw new Error("Generation returned empty");
        }
      } catch (error) {
        console.warn("Username generation failed, using fallback:", error);
        const fallback = `user_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
        onChange(fallback);
        setStatus("available");
        setMessage("Generated username!");
        toast.info("Auto‑generated username: " + fallback);
      }
    }, [displayName, onChange, userId, validateUsername]);

    useEffect(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (username.length >= 3) {
        timeoutRef.current = setTimeout(() => validateUsername(username), 500);
      } else {
        setStatus("idle");
        setMessage(username.length > 0 ? "Minimum 3 characters" : "");
      }
      return () => clearTimeout(timeoutRef.current);
    }, [username, validateUsername]);

    const getStatusColor = () => {
      switch (status) {
        case "available": return "text-emerald-500";
        case "taken":     return "text-rose-500";
        case "invalid":   return "text-amber-500";
        case "checking":  return "text-blue-500";
        case "error":     return "text-red-500";
        default:          return "text-gray-400";
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label
            className={`block text-sm font-semibold ${
              resolvedTheme === "dark" ? "text-gray-200" : "text-gray-800"
            }`}
          >
            Username
            <span className="text-rose-500 ml-1">*</span>
          </label>
          <span className="text-xs text-gray-500">{username.length}/30</span>
        </div>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</div>
          <input
            type="text"
            value={username}
            onChange={(e) => onChange(e.target.value.replace(/\s+/g, "").toLowerCase())}
            disabled={loading}
            placeholder="yourusername"
            className={`w-full pl-8 pr-10 py-3 rounded-lg border transition-all duration-200 text-sm ${
              resolvedTheme === "dark"
                ? "bg-gray-900 text-white placeholder-gray-500 border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                : "bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            } ${
              status === "available" ? "!border-emerald-500" :
              status === "taken" || status === "invalid" || status === "error" ? "!border-rose-500" : ""
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          {username.length >= 3 && status !== "idle" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {status === "checking" ? (
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : status === "available" ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : status === "taken" || status === "invalid" || status === "error" ? (
                <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {message && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${getStatusColor()}`}>{message}</span>
          </div>
        )}

        <button
          onClick={generateSmartUsername}
          disabled={loading || isChecking || !displayName}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            resolvedTheme === "dark"
              ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          } ${loading || isChecking || !displayName ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isChecking ? (
            <>
              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate Smart Username</span>
            </>
          )}
        </button>
      </div>
    );
  }
);
SmartUsernameGenerator.displayName = "SmartUsernameGenerator";

// ==================== MAIN COMPONENT ====================
export default function SetupProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const themeCtx = useTheme?.() || { theme: "light" };
  const { theme } = themeCtx;
  const { user, updateUserProfile, authService } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const signupData = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("signup_data");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const stateData = location.state?.userData || {};
  const stateMethod = location.state?.method || null;
  const step1FromState = location.state?.step1Data || {};

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const buildDisplayName = () => {
    // Priority: step1Data from signup_data (saved during step2)
    const step1 = signupData.firstName ? signupData : step1FromState;
    if (step1.firstName && step1.lastName) {
      return `${step1.firstName} ${step1.lastName}`.trim();
    }
    if (step1.firstName) return step1.firstName;
    if (step1.lastName) return step1.lastName;
    // Fallback: from stateData or user
    if (stateData.displayName) return stateData.displayName;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return "Arvdoul User";
  };

  const getInitials = () => {
    const displayName = buildDisplayName();
    const username =
      signupData.username ||
      stateData.username ||
      `user_${user?.uid?.slice(0, 8) || Date.now().toString(36)}`;
    const avatar = signupData.photoURL || stateData.photoURL || user?.photoURL || "";
    const authProvider = signupData.authProvider || stateData.authProvider || stateMethod || user?.authProvider || "email";
    const identifier = signupData.phoneNumber || signupData.email || stateData.phoneNumber || stateData.email || user?.phoneNumber || user?.email || "";
    return { displayName, username, avatar, authProvider, identifier };
  };

  const { displayName: initDn, username: initUn, avatar: initAv, authProvider: initAp, identifier: initId } = getInitials();

  const [displayName, setDisplayName] = useState(initDn);
  const [username, setUsername] = useState(initUn);
  const [avatarUrl, setAvatarUrl] = useState(initAv);
  const [authProvider, setAuthProvider] = useState(initAp);
  const [identifier, setIdentifier] = useState(initId);
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const { displayName: dn, username: un, avatar: av, authProvider: ap, identifier: id } = getInitials();
    if (dn !== displayName) setDisplayName(dn);
    if (un !== username) setUsername(un);
    if (av !== avatarUrl) setAvatarUrl(av);
    if (ap !== authProvider) setAuthProvider(ap);
    if (id !== identifier) setIdentifier(id);
  }, [signupData, stateData, user]);

  const handleAvatarUpload = (url) => setAvatarUrl(url);

  const updateFirebaseAuthProfile = async (authUser, profile) => {
    if (!authUser) return;
    try {
      await firebaseUpdateProfile(authUser, {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      });
    } catch (err) {
      console.warn("Failed to update Auth profile", err);
    }
  };

  const handleSubmit = async () => {
    if (loading || profileComplete || !displayName.trim() || username.length < 3) return;
    setLoading(true);
    try {
      const avail = await checkUsernameAvailability(username, user?.uid);
      if (!avail.available) {
        toast.error(avail.error || "Username not available");
        setLoading(false);
        return;
      }

      const finalAvatar = avatarUrl || generateDefaultAvatar(user.uid, displayName);
      const result = await createUserProfile(user.uid, {
        uid: user.uid,
        displayName: displayName.trim(),
        username: username.toLowerCase(),
        bio: bio.trim(),
        photoURL: finalAvatar,
        email: user?.email || "",
        emailVerified: user?.emailVerified || false,
        phoneNumber: user?.phoneNumber || "",
        isProfileComplete: true,
        authProvider: authProvider || "email",
        accountStatus: "active",
      });

      if (!result.success) throw new Error(result.error || "Profile creation failed");

      if (updateUserProfile) await updateUserProfile({ isProfileComplete: true });

      if (authService?.auth?.currentUser) {
        await updateFirebaseAuthProfile(authService.auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: finalAvatar,
        });
      }

      sessionStorage.removeItem("signup_data");
      localStorage.removeItem("signup_data_persist");
      setProfileComplete(true);
      toast.success("🎉 Profile setup complete!");
      setTimeout(() => navigate("/home", { replace: true, state: { welcomeMessage: true } }), 1500);
    } catch (error) {
      toast.error(error.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!displayName.trim()) return toast.error("Display name required");
    const finalUsername = username || `user_${Date.now().toString(36).slice(-8)}`;
    setUsername(finalUsername);
    setLoading(true);
    try {
      const finalAvatar = avatarUrl || generateDefaultAvatar(user.uid, displayName);
      const result = await createUserProfile(user.uid, {
        uid: user.uid,
        displayName: displayName.trim(),
        username: finalUsername.toLowerCase(),
        bio: bio.trim(),
        photoURL: finalAvatar,
        email: user?.email || "",
        emailVerified: user?.emailVerified || false,
        phoneNumber: user?.phoneNumber || "",
        isProfileComplete: true,
        authProvider: authProvider || "email",
        accountStatus: "active",
      });
      if (!result.success) throw new Error(result.error || "Profile creation failed");
      if (updateUserProfile) await updateUserProfile({ isProfileComplete: true });
      if (authService?.auth?.currentUser) {
        await updateFirebaseAuthProfile(authService.auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: finalAvatar,
        });
      }
      sessionStorage.removeItem("signup_data");
      localStorage.removeItem("signup_data_persist");
      setProfileComplete(true);
      toast.success("🎉 Profile setup complete!");
      setTimeout(() => navigate("/home", { replace: true, state: { welcomeMessage: true } }), 1500);
    } catch (err) {
      toast.error(err.message || "Profile creation failed");
    } finally {
      setLoading(false);
    }
  };

  const authMethodIcon = {
    phone: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    email: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    google: <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
  }[authProvider] || null;

  if (!user?.uid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Redirecting to login…</p>
        </div>
      </div>
    );
  }

  // NON‑SCROLLABLE WRAPPER + MAX‑WIDTH CARD WITH INTERNAL SCROLL
  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Offline Banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/95 text-white text-center py-2 text-xs font-semibold backdrop-blur-sm"
          >
            You are offline – profile setup requires internet
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center">
          {/* Progress Steps */}
          <div className="mb-4 flex items-center justify-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 3 ? "bg-indigo-600 text-white ring-4 ring-indigo-500/30" : step < 3 ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                }`}>{step < 3 ? "✓" : step}</div>
                {step < 3 && <div className="w-6 h-1 bg-emerald-500" />}
              </div>
            ))}
          </div>
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Complete Your Profile</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Almost done! Let's personalize your account</p>
          </div>

          {/* Glass Card with internal scroll */}
          <div className={`relative rounded-2xl border backdrop-blur-xl overflow-y-auto max-h-[calc(100dvh-12rem)] ${
            navigator.deviceMemory && navigator.deviceMemory >= 4 ? "shadow-2xl" : "shadow-lg"
          } ${
            resolvedTheme === "dark"
              ? "bg-gray-900/70 border-white/10 shadow-indigo-900/20"
              : "bg-white/70 border-gray-200/60 shadow-indigo-100/20"
          } p-6 space-y-6`}
          >
            <PerfectAvatarUploader onUpload={handleAvatarUpload} currentAvatar={avatarUrl} displayName={displayName} userId={user?.uid} theme={theme} loading={loading} />

            {/* Read‑Only Display Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Display Name</label>
              <div className={`w-full px-3 py-2 rounded-lg border ${resolvedTheme === "dark" ? "bg-gray-800/50 border-gray-600 text-gray-200" : "bg-gray-100 border-gray-300 text-gray-700"}`}>{displayName}</div>
            </div>

            {/* Auth Method with truncation for long email/phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Sign‑up Method</label>
              <div className={`w-full px-3 py-2 rounded-lg border flex items-center gap-2 ${resolvedTheme === "dark" ? "bg-gray-800/50 border-gray-600 text-gray-300" : "bg-gray-100 border-gray-300 text-gray-700"}`}>
                {authMethodIcon}
                <span className="capitalize font-medium">{authProvider}</span>
                {identifier && (
                  <span className={`text-xs ml-auto max-w-[150px] truncate ${resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    {identifier}
                  </span>
                )}
              </div>
            </div>

            <SmartUsernameGenerator username={username} onChange={setUsername} theme={theme} loading={loading} displayName={displayName} userId={user?.uid} />

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white">Bio (Optional)</label>
                <span className="text-xs text-gray-500">{150 - bio.length} chars left</span>
              </div>
              <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 150))} disabled={loading} placeholder="Tell us about yourself..." rows={3} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 resize-none border-gray-300 dark:border-gray-600 focus:border-indigo-500" />
            </div>

            {/* Buttons with glowing effect */}
            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={loading || profileComplete || !displayName.trim() || username.length < 3}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-300 ${
                  !loading && displayName.trim() && username.length >= 3
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-400 dark:bg-gray-700 cursor-not-allowed"
                }`}
              >
                {loading ? "Creating Profile..." : "Complete Setup"}
              </button>
              <button
                onClick={handleSkip}
                disabled={loading || !displayName.trim()}
                className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media screen and (max-width: 768px) {
          input, select, textarea { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}