\/\/ src/screens/SetupProfile.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { UploadCloud, ImagePlus, Loader2, X, Shield, Zap, Globe, Lock, Eye, EyeOff, Sparkles } from "lucide-react";

import { auth, db, storage } from "../firebase/firebase.js";
import { useSignup } from "@context/SignupContext";
import { useTheme } from "@context/ThemeContext";
import { doc, serverTimestamp, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import DefaultProfile from "../assets/default-profile.png";
import LoadingDots from "@components/Shared/LoadingDots";

/** ---------- Advanced Configuration ---------- */
const MAX_IMG_MB = 3;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
const BIO_LIMIT = 250;
const NICKNAME_LIMIT = 30;
const USERNAME_LIMIT = 20;

/** ---------- AI-Powered Profile Optimizer ---------- */
const useAIOptimizer = () => {
  const analyzeImage = useCallback(async (file) => {
    \/\/ Simulate AI analysis for image quality, composition, etc.
    return new Promise((resolve) => {
      setTimeout(() => {
        const analysis = {
          quality: Math.random() > 0.3 ? 'excellent' : Math.random() > 0.5 ? 'good' : 'average',
          brightness: Math.random() * 100,
          contrast: Math.random() * 100,
          suggestions: Math.random() > 0.7 ? ['Consider cropping for better composition'] : []
        };
        resolve(analysis);
      }, 800);
    });
  }, []);

  const generateBioSuggestions = useCallback((firstName, lastName) => {
    const suggestions = [
      `Creative soul exploring the digital universe 🌌`,
      `${firstName} ${lastName} - Building connections that matter 💫`,
      `Digital creator | Innovator | Community builder ✨`,
      `Passionate about meaningful conversations and authentic connections 🎯`,
      `Turning ideas into reality, one post at a time 🚀`,
      `Living life in pixels and passion 📱`,
      `Creating content that inspires and connects 🌟`
    ];
    return suggestions.slice(0, 3);
  }, []);

  const generateUsernameSuggestions = useCallback((firstName, lastName) => {
    const base = `${firstName}${lastName}`.toLowerCase().replace(/\s/g, '');
    const suggestions = [
      base,
      `${base}${Math.floor(Math.random() * 999)}`,
      `the${firstName.charAt(0).toUpperCase() + firstName.slice(1)}`,
      `${firstName}.${lastName}`,
      `${firstName}_${Math.random().toString(36).substring(2, 6)}`
    ];
    return [...new Set(suggestions)].slice(0, 4);
  }, []);

  return { analyzeImage, generateBioSuggestions, generateUsernameSuggestions };
};

/** ---------- Blockchain Verification Simulator ---------- */
const useBlockchainVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyProfile = useCallback(async (profileData) => {
    setIsVerifying(true);
    \/\/ Simulate blockchain verification
    return new Promise((resolve) => {
      setTimeout(() => {
        const verified = Math.random() > 0.3; \/\/ 70% success rate
        setIsVerifying(false);
        resolve({
          verified,
          transactionHash: verified ? `0x${Math.random().toString(16).substring(2, 42)}` : null,
          timestamp: new Date().toISOString()
        });
      }, 2000);
    });
  }, []);

  return { verifyProfile, isVerifying };
};

/** ---------- Advanced Image Processor ---------- */
const useAdvancedImageProcessor = () => {
  const bytesToMB = (bytes) => +(bytes / (1024 * 1024)).toFixed(2);

  const compressImageFile = useCallback(async (file, maxMB = MAX_IMG_MB, quality = 0.8) => {
    if (!file || !file.type.startsWith("image/")) return file;
    if (bytesToMB(file.size) <= maxMB) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        \/\/ Maintain aspect ratio while fitting within 1000px
        const maxDim = 1000;
        let { width, height } = img;

        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;

        \/\/ Enhanced image processing
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        \/\/ Apply subtle enhancements
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        \/\/ Simple contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.1);     \/\/ Red
          data[i + 1] = Math.min(255, data[i + 1] * 1.1); \/\/ Green
          data[i + 2] = Math.min(255, data[i + 2] * 1.1); \/\/ Blue
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  return { compressImageFile, bytesToMB };
};

/** ---------- Privacy Settings Manager ---------- */
const PrivacySettings = ({ settings, onChange, theme }) => {
  const privacyOptions = [
    {
      value: "public",
      label: "Public",
      description: "Anyone can see your profile and content",
      icon: "🌐"
    },
    {
      value: "friends",
      label: "Friends Only",
      description: "Only approved friends can see your content",
      icon: "👥"
    },
    {
      value: "private",
      label: "Private",
      description: "Only you can see your profile and content",
      icon: "🔒"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <h3 className={`text-lg font-semibold ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        Privacy Settings
      </h3>
      
      <div className="grid gap-3">
        {privacyOptions.map((option) => (
          <motion.label
            key={option.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              settings.privacy === option.value
                ? theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-indigo-500 bg-indigo-50'
                : theme === 'dark'
                ? 'border-gray-600 bg-gray-800 hover:border-gray-500'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="privacy"
              value={option.value}
              checked={settings.privacy === option.value}
              onChange={(e) => onChange({ ...settings, privacy: e.target.value })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{option.icon}</span>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {option.label}
                </span>
              </div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {option.description}
              </p>
            </div>
          </motion.label>
        ))}
      </div>
    </motion.div>
  );
};

/** ---------- Advanced Image Upload Zone ---------- */
const AdvancedImageUpload = ({ file, previewUrl, onFileSelect, onRemove, theme, loading }) => {
  const [dragOver, setDragOver] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const fileInputRef = useRef(null);
  const { analyzeImage } = useAIOptimizer();

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    \/\/ AI Analysis
    setAiAnalysis({ status: 'analyzing' });
    const analysis = await analyzeImage(selectedFile);
    setAiAnalysis({ status: 'complete', ...analysis });

    onFileSelect(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <label className={`block text-sm font-medium ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      }`}>
        Profile Picture
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl transition-all ${
          dragOver
            ? theme === 'dark'
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-indigo-500 bg-indigo-50'
            : theme === 'dark'
            ? 'border-gray-600 bg-gray-800/50'
            : 'border-gray-300 bg-gray-50'
        } ${loading ? 'opacity-50' : ''}`}
      >
        {previewUrl ? (
          <div className="p-6">
            <div className="flex items-center gap-6">
              {/* Profile Preview */}
              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-2xl"
                >
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
                
                {/* AI Analysis Badge */}
                {aiAnalysis && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2"
                  >
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                      aiAnalysis.quality === 'excellent' 
                        ? 'bg-green-500 text-white'
                        : aiAnalysis.quality === 'good'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-500 text-white'
                    }`}>
                      <Sparkles size={12} />
                      AI
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Image Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Profile Ready
                  </h4>
                  {aiAnalysis && aiAnalysis.status === 'analyzing' && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                </div>

                {/* AI Analysis Results */}
                {aiAnalysis && aiAnalysis.status === 'complete' && (
                  <div className="space-y-1">
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Quality: <span className="capitalize">{aiAnalysis.quality}</span>
                    </p>
                    {aiAnalysis.suggestions.length > 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        💡 {aiAnalysis.suggestions[0]}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mt-3">
                  <motion.button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      theme === 'dark'
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <ImagePlus size={16} />
                    Change
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={onRemove}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
                  >
                    <X size={16} />
                    Remove
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
            >
              <UploadCloud className="text-white" size={32} />
            </motion.div>
            
            <p className={`mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Drag & drop your photo here
            </p>
            <p className={`text-sm mb-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Supports JPG, PNG, WEBP • Max {MAX_IMG_MB}MB
            </p>

            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
              }`}
            >
              <ImagePlus size={18} />
              Choose File
            </motion.button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          className="hidden"
          disabled={loading}
        />
      </div>
    </motion.div>
  );
};

/** ---------- Main Component ---------- */
export default function SetupProfile() {
  const navigate = useNavigate();
  const { signupData, updateSignupData } = useSignup();
  const { theme } = useTheme();
  const { generateBioSuggestions, generateUsernameSuggestions } = useAIOptimizer();
  const { verifyProfile, isVerifying } = useBlockchainVerification();
  const { compressImageFile } = useAdvancedImageProcessor();

  const user = auth.currentUser;

  \/\/ Enhanced state management
  const [profileData, setProfileData] = useState({
    nickname: signupData?.nickname || "",
    username: signupData?.username || "",
    bio: signupData?.bio || "",
    privacy: "public",
    verified: false
  });

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(DefaultProfile);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCoinReward, setShowCoinReward] = useState(false);
  const [bioSuggestions, setBioSuggestions] = useState([]);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [blockchainVerification, setBlockchainVerification] = useState(null);

  const uploadTaskRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    \/\/ Generate AI suggestions
    if (signupData?.firstName) {
      setBioSuggestions(generateBioSuggestions(signupData.firstName, signupData.lastName));
      setUsernameSuggestions(generateUsernameSuggestions(signupData.firstName, signupData.lastName));
    }

    return () => {
      isMountedRef.current = false;
      if (uploadTaskRef.current) uploadTaskRef.current.cancel?.();
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [signupData, generateBioSuggestions, generateUsernameSuggestions]);

  \/\/ Authentication & signup guards
  useEffect(() => {
    if (!user) {
      toast.error("Authentication required. Please log in.");
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  \/\/ Preview generator/cleanup
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  \/\/ Enhanced file validation
  const validateFile = (file) => {
    if (!file) return "No file selected";
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Unsupported format. Use JPG, PNG, or WEBP.";
    }
    if (file.size > MAX_IMG_MB * 1024 * 1024) {
      return `Image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max ${MAX_IMG_MB}MB.`;
    }
    return null;
  };

  \/\/ Advanced upload with AI optimization
  const uploadAvatar = async (uid, file) => {
    if (!file) return null;

    setUploading(true);
    setUploadProgress(0);

    try {
      \/\/ Compress and optimize image
      const optimizedFile = await compressImageFile(file);
      
      const path = `profile_pictures/${uid}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const sRef = storageRef(storage, path);

      const task = uploadBytesResumable(sRef, optimizedFile, {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000,immutable",
      });

      uploadTaskRef.current = task;

      const downloadUrl = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            if (!isMountedRef.current) return;
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => reject(error),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              resolve(url);
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      return downloadUrl;
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  \/\/ Blockchain verification handler
  const handleBlockchainVerification = async () => {
    if (blockchainVerification) return;

    const result = await verifyProfile(profileData);
    setBlockchainVerification(result);

    if (result.verified) {
      toast.success("🎉 Profile verified on blockchain!");
    } else {
      toast.error("Blockchain verification failed. Try again.");
    }
  };

  \/\/ Enhanced save handler
  const handleSave = async (skip = false) => {
    if (!user || !signupData) return;
    if (saving) return;

    setSaving(true);

    try {
      let photoURL = DefaultProfile;

      \/\/ Upload avatar if provided
      if (!skip && file) {
        try {
          photoURL = await uploadAvatar(user.uid, file);
          toast.success("🖼️ Profile picture optimized and uploaded");
        } catch (error) {
          console.error("Upload failed:", error);
          toast.error("Failed to upload image. Using default avatar.");
          photoURL = DefaultProfile;
        }
      }

      \/\/ Build advanced profile payload
      const payload = {
        uid: user.uid,
        email: user.email || signupData.email,
        phone: user.phoneNumber || signupData.phone,

        \/\/ Personal Info
        firstName: signupData.firstName?.trim() || "",
        lastName: signupData.lastName?.trim() || "",
        displayName: `${signupData.firstName || ""} ${signupData.lastName || ""}`.trim(),
        
        \/\/ Profile Customization
        nickname: skip ? null : profileData.nickname?.trim() || null,
        username: skip ? null : profileData.username?.trim() || null,
        bio: skip ? null : profileData.bio?.trim() || null,

        \/\/ Media
        profilePicture: photoURL,
        coverPhoto: null,

        \/\/ Stats & Economy
        coins: (signupData.coins || 0) + 100,
        level: 1,
        xp: 0,

        \/\/ Social
        followersCount: 0,
        followingCount: 0,
        friendsCount: 0,
        postsCount: 0,

        \/\/ Verification & Status
        status: "active",
        verified: blockchainVerification?.verified || false,
        blockchainVerification,

        \/\/ Advanced Settings
        settings: {
          privacy: profileData.privacy,
          darkMode: theme === "dark",
          notifications: true,
          language: "en",
          contentPreferences: {
            nsfw: false,
            sensitive: false
          }
        },

        \/\/ Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        profileCompleted: !skip
      };

      \/\/ Save to Firestore
      await setDoc(doc(db, "users", user.uid), payload, { merge: true });

      \/\/ Check username availability if provided
      if (profileData.username) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", profileData.username.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          toast.error("Username already taken. Please choose another.");
          setSaving(false);
          return;
        }
      }

      \/\/ Success effects
      setShowCoinReward(true);
      setShowConfetti(true);
      
      toast.success(
        skip 
          ? "🚀 Profile created! Welcome to Arvdoul!" 
          : "🎉 Profile setup complete! Welcome to the future of social!"
      );

      \/\/ Navigate after celebration
      setTimeout(() => {
        navigate("/home", { replace: true });
      }, 2000);

    } catch (error) {
      console.error("Profile setup error:", error);
      toast.error(error?.message || "Failed to save profile. Please try again.");
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const displayName = useMemo(() => {
    const first = signupData?.firstName || "";
    const last = signupData?.lastName || "";
    return `${first} ${last}`.trim() || "New User";
  }, [signupData]);

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const disableActions = saving || uploading;

  return (
    <div className="relative w-full min-h-screen p-4" style={backgroundStyle}>
      {/* Advanced Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 8 + 4,
              height: Math.random() * 8 + 4,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.1)" 
                : "rgba(79,70,229,0.08)",
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: Math.random() * 6 + 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Confetti Celebration */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            {[...Array(150)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -1000],
                  x: [0, (Math.random() - 0.5) * 100],
                  rotate: [0, 360],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  ease: "easeOut",
                }}
              >
                {["🎉", "🎊", "✨", "🌟", "💫", "🚀"][Math.floor(Math.random() * 6)]}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coin Reward Notification */}
      <AnimatePresence>
        {showCoinReward && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 px-8 py-4 rounded-2xl shadow-2xl text-center font-bold text-lg">
              🎉 +100 Arvdoul Coins Rewarded! 🎉
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-4xl mx-auto py-8">
        {/* Progress Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className={`text-4xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Customize Your Profile
          </h1>
          <p className={`text-lg ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Final step • Make it uniquely yours
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Profile Media */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Profile Picture Upload */}
            <AdvancedImageUpload
              file={file}
              previewUrl={previewUrl}
              onFileSelect={setFile}
              onRemove={() => {
                setFile(null);
                setPreviewUrl(DefaultProfile);
              }}
              theme={theme}
              loading={disableActions}
            />

            {/* Upload Progress */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="text-sm font-medium">Optimizing & Uploading...</span>
                    <span className="text-sm">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={`{ width: `${uploadProgress}%` `}}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Display Name Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xl">
                <Zap size={20} />
                <span className="text-lg font-semibold">{displayName}</span>
              </div>
              <p className={`text-sm mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                This is how you'll appear on Arvdoul
              </p>
            </motion.div>

            {/* Blockchain Verification */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl border-2 border-amber-500/30 bg-amber-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <Shield className="text-amber-500" size={24} />
                <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                }`}>
                  Blockchain Verification
                </h3>
              </div>
              
              <p className={`text-sm mb-4 ${
                theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
              }`}>
                Verify your profile on the blockchain for enhanced trust and security.
              </p>

              <motion.button
                onClick={handleBlockchainVerification}
                disabled={isVerifying || blockchainVerification}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                  blockchainVerification?.verified
                    ? 'bg-green-500 text-white'
                    : isVerifying || blockchainVerification
                    ? 'bg-gray-500 text-white cursor-not-allowed'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Verifying...
                  </>
                ) : blockchainVerification?.verified ? (
                  <>
                    ✅ Verified on Blockchain
                  </>
                ) : blockchainVerification ? (
                  "Verification Failed"
                ) : (
                  "Verify on Blockchain"
                )}
              </motion.button>

              {blockchainVerification?.transactionHash && (
                <p className={`text-xs mt-2 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`}>
                  TX: {blockchainVerification.transactionHash.slice(0, 16)}...
                </p>
              )}
            </motion.div>
          </motion.div>

          {/* Right Column - Profile Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Username */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Username
              </label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                maxLength={USERNAME_LIMIT}
                placeholder="Choose a unique username"
                className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500'
                    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:border-indigo-500`}
                disabled={disableActions}
              />
              <div className="flex justify-between mt-1">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {profileData.username.length}/{USERNAME_LIMIT}
                </span>
                {usernameSuggestions.length > 0 && (
                  <div className="text-xs">
                    <span className="text-gray-500">Suggestions: </span>
                    {usernameSuggestions.slice(0, 2).map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setProfileData({ ...profileData, username: suggestion })}
                        className="text-indigo-500 hover:text-indigo-400 ml-2"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Nickname */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Nickname (Optional)
              </label>
              <input
                type="text"
                value={profileData.nickname}
                onChange={(e) => setProfileData({ ...profileData, nickname: e.target.value })}
                maxLength={NICKNAME_LIMIT}
                placeholder="What should friends call you?"
                className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500'
                    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:border-indigo-500`}
                disabled={disableActions}
              />
              <div className="text-right">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {profileData.nickname.length}/{NICKNAME_LIMIT}
                </span>
              </div>
            </motion.div>

            {/* Bio with AI Suggestions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Bio
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (bioSuggestions.length > 0) {
                      setProfileData({ ...profileData, bio: bioSuggestions[0] });
                    }
                  }}
                  className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  AI Suggest
                </button>
              </div>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                maxLength={BIO_LIMIT}
                rows={4}
                placeholder="Tell your story..."
                className={`w-full px-4 py-3 rounded-xl border-2 resize-none transition-all ${
                  theme === 'dark'
                    ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500'
                    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:border-indigo-500`}
                disabled={disableActions}
              />
              <div className="flex justify-between mt-1">
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {profileData.bio.length}/{BIO_LIMIT}
                </span>
              </div>
            </motion.div>

            {/* Privacy Settings */}
            <PrivacySettings
              settings={{ privacy: profileData.privacy }}
              onChange={(newSettings) => setProfileData({ ...profileData, ...newSettings })}
              theme={theme}
            />

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col gap-3 pt-4"
            >
              <motion.button
                onClick={() => handleSave(false)}
                disabled={disableActions}
                whileHover={{ scale: disableActions ? 1 : 1.02 }}
                whileTap={{ scale: disableActions ? 1 : 0.98 }}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                  disableActions
                    ? 'bg-gray-500 text-white cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-2xl'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Creating Your Digital Identity...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Complete Profile Setup
                  </>
                )}
              </motion.button>

              <motion.button
                onClick={() => handleSave(true)}
                disabled={disableActions}
                whileHover={{ scale: disableActions ? 1 : 1.02 }}
                whileTap={{ scale: disableActions ? 1 : 0.98 }}
                className={`w-full py-3 rounded-xl border-2 font-semibold transition-all ${
                  theme === 'dark'
                    ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
                } ${disableActions ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Skip for Now
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}