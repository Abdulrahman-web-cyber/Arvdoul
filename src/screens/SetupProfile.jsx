// src/screens/SetupProfile.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Confetti from "react-confetti";
import { UploadCloud, ImagePlus, Loader2, X } from "lucide-react";

import { auth, db, storage } from "../firebase/firebase.js";
import { useSignup } from "@context/SignupContext";
import { useTheme } from "@context/ThemeContext";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
ref as storageRef,
uploadBytesResumable,
getDownloadURL,
} from "firebase/storage";

import DefaultProfile from "../assets/default-profile.png";
import LoadingDots from "@components/Shared/LoadingDots";

/** ---------- Tunables ---------- */
const MAX_IMG_MB = 2; // 2MB limit
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BIO_LIMIT = 150;
const NICKNAME_LIMIT = 30;

/** ---------- Helpers ---------- */
const bytesToMB = (bytes) => +(bytes / (1024 * 1024)).toFixed(2);

const sanitize = (s) =>
(s || "")
.toString()
.trim()
// allow letters, numbers, whitespace, dot, underscore, dash
.replace(/[^\p{L}\p{N}\s._-]/gu, "")
.slice(0, 64);

// crypto fallback (if browser supports window.crypto)
function cryptoRandom(len = 6) {
try {
const bytes = new Uint8Array(len);
crypto.getRandomValues(bytes);
return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
} catch (err) {
// fallback
return Math.random().toString(16).slice(2, 2 + len * 2);
}
}

const buildFilePath = (uid, file) => {
const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
const ts = Date.now();
return profilePictures/${uid}/${ts}-${cryptoRandom(6)}.${ext};
};

// Simple retry helper
const retryAsync = async (fn, retries = 3, delay = 700) => {
let lastErr;
for (let i = 0; i < retries; i++) {
try {
return await fn();
} catch (err) {
lastErr = err;
if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
}
}
throw lastErr;
};

// Client-side image compression (optional) to reduce upload size.
// Keeps aspect ratio, uses canvas, returns a Blob.
async function compressImageFile(file, maxMB = MAX_IMG_MB, qualityStep = 0.9) {
if (!file || !file.type.startsWith("image/")) return file;

// if already small enough, return original
if (bytesToMB(file.size) <= maxMB) return file;

// load image
const imgBitmap = await createImageBitmap(file);
const canvas = document.createElement("canvas");
const maxDim = Math.max(imgBitmap.width, imgBitmap.height);
// scale down if huge (maintain aspect)
const scale = Math.min(1, Math.sqrt((maxMB * 1024 * 1024) / file.size) * 0.95);
canvas.width = Math.round(imgBitmap.width * scale);
canvas.height = Math.round(imgBitmap.height * scale);
const ctx = canvas.getContext("2d");
ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);

// attempt descending quality values until small enough
let quality = 0.92;
for (let i = 0; i < 6; i++) {
const blob = await new Promise((res) =>
canvas.toBlob(res, "image/jpeg", quality)
);
if (!blob) break;
if (bytesToMB(blob.size) <= maxMB || quality < 0.35) return blob;
quality = quality * qualityStep;
}
// final fallback — return last produced blob or original
const finalBlob = await new Promise((res) =>
canvas.toBlob(res, "image/jpeg", Math.max(0.35, quality))
);
return finalBlob || file;
}

/** ---------- Component ---------- */
export default function SetupProfile() {
const navigate = useNavigate();
const { signupData } = useSignup();
const { theme } = useTheme();

const user = auth.currentUser;

const displayName = useMemo(() => {
const first = signupData?.firstName || "";
const last = signupData?.lastName || "";
return ${first} ${last}.trim();
}, [signupData]);

// UI state
const [nickname, setNickname] = useState(signupData?.nickname || "");
const [bio, setBio] = useState(signupData?.bio || "");
const [file, setFile] = useState(null);
const [previewUrl, setPreviewUrl] = useState(DefaultProfile);
const [dragOver, setDragOver] = useState(false);

// upload state
const [uploadProgress, setUploadProgress] = useState(0);
const [uploading, setUploading] = useState(false);
const uploadTaskRef = useRef(null);

// flow control
const [saving, setSaving] = useState(false);
const [showConfetti, setShowConfetti] = useState(false);
const [showCoinReward, setShowCoinReward] = useState(false);
const rewardTimeoutRef = useRef(null);
const isMountedRef = useRef(true);

useEffect(() => {
isMountedRef.current = true;
return () => {
isMountedRef.current = false;
if (rewardTimeoutRef.current) clearTimeout(rewardTimeoutRef.current);
if (uploadTaskRef.current) uploadTaskRef.current.cancel?.();
if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Authentication & signup guards
useEffect(() => {
if (!user) {
toast.error("You must be logged in to set up your profile.");
navigate("/login", { replace: true });
}
}, [user, navigate]);

useEffect(() => {
if (!signupData) {
toast.error("Missing signup context. Please restart signup.");
navigate("/signup", { replace: true });
}
}, [signupData, navigate]);

// Preview generator/cleanup
useEffect(() => {
if (file) {
const url = URL.createObjectURL(file);
setPreviewUrl(url);
return () => {
URL.revokeObjectURL(url);
};
} else {
setPreviewUrl(DefaultProfile);
}
}, [file]);

/** ---------- File helpers ---------- */
const validateFile = (f) => {
if (!f) return "No file selected.";
if (!ALLOWED_TYPES.includes(f.type))
return "Unsupported format. Use JPG, PNG or WEBP.";
if (bytesToMB(f.size) > MAX_IMG_MB)
return Image too large (${bytesToMB(f.size)}MB). Max is ${MAX_IMG_MB}MB.;
return null;
};

const onFileInput = async (e) => {
const f = e.target.files?.[0];
if (!f) return;
const err = validateFile(f);
if (err) {
// try compression attempt: if a bit bigger than limit, compress, otherwise reject
if (bytesToMB(f.size) <= MAX_IMG_MB * 2 && f.type.startsWith("image/")) {
toast("Compressing image...");
try {
const compressed = await compressImageFile(f, MAX_IMG_MB);
if (compressed && bytesToMB(compressed.size) <= MAX_IMG_MB) {
setFile(new File([compressed], f.name.replace(/..+$/, ".jpg"), { type: "image/jpeg" }));
toast.success("Image compressed for upload.");
return;
} else {
toast.error(err);
return;
}
} catch (compErr) {
console.error("Compression error:", compErr);
toast.error(err);
return;
}
} else {
toast.error(err);
return;
}
}
setFile(f);
};

const onDrop = async (e) => {
e.preventDefault();
setDragOver(false);
const f = e.dataTransfer.files?.[0];
if (!f) return;
const err = validateFile(f);
if (err) {
// try compression fallback
if (bytesToMB(f.size) <= MAX_IMG_MB * 2 && f.type.startsWith("image/")) {
toast("Compressing image...");
try {
const compressed = await compressImageFile(f, MAX_IMG_MB);
if (compressed && bytesToMB(compressed.size) <= MAX_IMG_MB) {
setFile(new File([compressed], f.name.replace(/..+$/, ".jpg"), { type: "image/jpeg" }));
toast.success("Image compressed for upload.");
return;
} else {
toast.error(err);
return;
}
} catch (compErr) {
console.error("Compression error:", compErr);
toast.error(err);
return;
}
} else {
toast.error(err);
return;
}
}
setFile(f);
};

/** ---------- Upload logic (resumable) ---------- */
const uploadAvatar = async (uid, f) => {
if (!f) return null;
// If a Blob from compression was passed, it may have no name — wrap into File.
const fileToUpload = f instanceof File ? f : new File([f], avatar-${Date.now()}.jpg, { type: f.type || "image/jpeg" });

// build path  
const path = buildFilePath(uid, fileToUpload);  
const sRef = storageRef(storage, path);  

setUploading(true);  
setUploadProgress(0);  

const task = uploadBytesResumable(sRef, fileToUpload, {  
  contentType: fileToUpload.type,  
  cacheControl: "public,max-age=31536000,immutable",  
});  
uploadTaskRef.current = task;  

const downloadUrl = await new Promise((resolve, reject) => {  
  task.on(  
    "state_changed",  
    (snapshot) => {  
      if (!isMountedRef.current) return;  
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);  
      setUploadProgress(pct);  
    },  
    (err) => {  
      uploadTaskRef.current = null;  
      setUploading(false);  
      reject(err);  
    },  
    async () => {  
      try {  
        const url = await getDownloadURL(task.snapshot.ref);  
        uploadTaskRef.current = null;  
        setUploading(false);  
        setUploadProgress(100);  
        resolve(url);  
      } catch (err) {  
        uploadTaskRef.current = null;  
        setUploading(false);  
        reject(err);  
      }  
    }  
  );  
});  

return downloadUrl;

};

const cancelUpload = () => {
if (uploadTaskRef.current) {
try {
uploadTaskRef.current.cancel();
} catch (err) {
console.warn("Cancel upload not supported by this SDK instance", err);
}
uploadTaskRef.current = null;
setUploading(false);
setUploadProgress(0);
toast("Upload canceled.");
}
};

/** ---------- Save profile ---------- */
const handleSave = async (skip = false) => {
if (!user || !signupData) return;
if (saving) return;

// Basic validation: nickname length only (optional)  
if (!skip) {  
  if (nickname && nickname.length > NICKNAME_LIMIT) {  
    toast.error(`Nickname max ${NICKNAME_LIMIT} characters.`);  
    return;  
  }  
  if (bio && bio.length > BIO_LIMIT) {  
    toast.error(`Bio max ${BIO_LIMIT} characters.`);  
    return;  
  }  
}  

setSaving(true);  
setUploadProgress(0);  

let photoURL = DefaultProfile;  
try {  
  // Upload avatar if provided (with retry)  
  if (!skip && file) {  
    try {  
      photoURL = await retryAsync(() => uploadAvatar(user.uid, file), 3, 800);  
    } catch (upErr) {  
      console.error("Upload failed, using default avatar:", upErr);  
      toast.error("Avatar upload failed. Using default avatar.");  
      photoURL = DefaultProfile;  
    }  
  } else {  
    // skip or no file => default  
    photoURL = DefaultProfile;  
  }  

  // Compose payload  
  const existingCoins = typeof signupData?.coins === "number" ? signupData.coins : 0;  
  const coins = existingCoins + 100;  

  const payload = {  
    uid: user.uid,  
    email: user.email || signupData.email || null,  
    phone: user.phoneNumber || signupData.phone || null,  

    firstName: sanitize(signupData.firstName) || "",  
    lastName: sanitize(signupData.lastName) || "",  
    displayName:  
      sanitize(signupData.displayName) ||  
      `${signupData.firstName || ""} ${signupData.lastName || ""}`.trim(),  

    nickname: skip ? null : sanitize(nickname) || null,  
    bio: skip ? null : sanitize(bio) || null,  

    gender: signupData.gender || null,  
    dob: {  
      day: signupData.day ?? null,  
      month: signupData.month ?? null,  
      year: signupData.year ?? null,  
    },  

    profilePicture: photoURL,  
    coverPhoto: null,  

    coins,  
    friendsCount: 0,  
    followersCount: 0,  
    followingCount: 0,  
    postsCount: 0,  

    status: "active",  
    verified: false,  
    settings: {  
      privacy: "public",  
      darkMode: theme === "dark",  
      notifications: true,  
    },  

    createdAt: serverTimestamp(),  
    updatedAt: serverTimestamp(),  
  };  

  // Save (merge) to Firestore — retry wrapped  
  await retryAsync(() => setDoc(doc(db, "users", user.uid), payload, { merge: true }), 3, 700);  

  // Reward UI  
  setShowCoinReward(true);  
  setShowConfetti(true);  
  toast.success(  
    skip  
      ? "Profile skipped! 🎉 You received 100 coins!"  
      : "Profile setup complete! 🎉 You received 100 coins!"  
  );  

  // short delay to show confetti, then navigate  
  rewardTimeoutRef.current = setTimeout(() => {  
    setShowCoinReward(false);  
    setShowConfetti(false);  
    navigate("/home", { replace: true });  
  }, 1700);  
} catch (err) {  
  console.error("Profile setup error:", err);  
  toast.error(err?.message || "Failed to save profile. Try again.");  
} finally {  
  if (isMountedRef.current) setSaving(false);  
}

};

const disableActions = saving || uploading;

return (
<div
className={relative flex items-center justify-center min-h-screen w-full p-4 ${   theme === "dark" ? "bg-gradient-to-b from-gray-950 to-gray-900" : "bg-gradient-to-b from-gray-50 to-gray-100"   }}
>
<AnimatePresence>
{showConfetti && <Confetti numberOfPieces={260} recycle={false} />}
</AnimatePresence>

<AnimatePresence>  
    {showCoinReward && (  
      <motion.div  
        initial={{ y: -12, opacity: 0 }}  
        animate={{ y: 0, opacity: 1 }}  
        exit={{ y: -12, opacity: 0 }}  
        className="absolute top-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 text-gray-900 px-6 py-3 rounded-3xl shadow-2xl text-center font-bold text-lg z-50"  
      >  
        🎉 You’ve been gifted <span className="text-white">100 Arvdoul Coins</span>! 🎉  
      </motion.div>  
    )}  
  </AnimatePresence>  

  <motion.div  
    className={`max-w-md w-full rounded-3xl p-6 md:p-8 shadow-2xl ${  
      theme === "dark" ? "bg-gray-900/80" : "bg-white/90"  
    } backdrop-blur-sm`}  
    initial={{ opacity: 0, y: 12 }}  
    animate={{ opacity: 1, y: 0 }}  
    transition={{ duration: 0.35 }}  
  >  
    <div className="text-center mb-6">  
      <h2 className={`text-3xl font-extrabold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>  
        Setup Your Profile  
      </h2>  
      <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>  
        Add your avatar, nickname and short bio. You can skip for now.  
      </p>  
    </div>  

    {/* Avatar zone */}  
    <div  
      onDragOver={(e) => {  
        e.preventDefault();  
        setDragOver(true);  
      }}  
      onDragLeave={() => setDragOver(false)}  
      onDrop={onDrop}  
      className="mb-6"  
    >  
      <div className="flex items-center justify-center">  
        <div  
          className={`relative w-36 h-36 rounded-full overflow-hidden border-4 transition ${  
            dragOver ? "ring-4 ring-primary-300/40" : "ring-0"  
          }`}  
          aria-label="Profile picture dropzone"  
        >  
          <img src={previewUrl} alt="Profile preview" className="w-full h-full object-cover" />  
          <label  
            htmlFor="avatar-input"  
            className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/0 hover:bg-black/30 transition-colors"  
            title="Upload a new photo"  
          >  
            <div className="hidden group-hover:flex items-center gap-2 text-white text-sm font-medium">  
              <ImagePlus size={18} /> Change  
            </div>  
          </label>  
          <input  
            id="avatar-input"  
            type="file"  
            accept={ALLOWED_TYPES.join(",")}  
            className="sr-only"  
            onChange={onFileInput}  
            disabled={disableActions}  
          />  
        </div>  
      </div>  

      {/* Upload progress */}  
      <AnimatePresence>  
        {uploading && (  
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">  
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mb-1">  
              <UploadCloud size={14} />  
              Uploading avatar… {uploadProgress}%  
            </div>  
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">  
              <div className="h-2 bg-primary-500 transition-all" style={{ width: `${uploadProgress}%` }} />  
            </div>  
            <div className="text-right mt-2">  
              <button  
                type="button"  
                onClick={cancelUpload}  
                className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200 hover:underline disabled:opacity-50"  
                disabled={!uploading}  
              >  
                <X size={14} /> Cancel upload  
              </button>  
            </div>  
          </motion.div>  
        )}  
      </AnimatePresence>  
    </div>  

    {/* Display name */}  
    <div className="text-center mb-5">  
      <span className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 text-white text-lg font-semibold shadow-md">  
        {displayName || "Your name"}  
      </span>  
    </div>  

    {/* Nickname */}  
    <div className="mb-4">  
      <label htmlFor="nickname" className={`block mb-1 text-sm font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>  
        Nickname (optional)  
      </label>  
      <input  
        id="nickname"  
        type="text"  
        maxLength={NICKNAME_LIMIT}  
        value={nickname}  
        onChange={(e) => setNickname(e.target.value)}  
        placeholder="Enter a nickname"  
        className={`w-full px-4 py-3 rounded-2xl border ${  
          theme === "dark" ? "border-gray-700 bg-gray-800 text-white" : "border-gray-300 bg-white text-gray-900"  
        } focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all`}  
        aria-describedby="nickname-help"  
        disabled={disableActions}  
      />  
      <div id="nickname-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">  
        {nickname.length}/{NICKNAME_LIMIT}  
      </div>  
    </div>  

    {/* Bio */}  
    <div className="mb-6">  
      <label htmlFor="bio" className={`block mb-1 text-sm font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>  
        Bio (optional)  
      </label>  
      <div className="relative">  
        <textarea  
          id="bio"  
          rows={4}  
          maxLength={BIO_LIMIT}  
          value={bio}  
          onChange={(e) => setBio(e.target.value)}  
          placeholder="Tell us about yourself…"  
          className={`w-full px-4 py-3 rounded-2xl border resize-none ${  
            theme === "dark" ? "border-gray-700 bg-gray-800 text-white" : "border-gray-300 bg-white text-gray-900"  
          } focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all`}  
          disabled={disableActions}  
        />  
        <span className={`absolute bottom-2 right-3 text-xs ${bio.length >= BIO_LIMIT ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>  
          {bio.length}/{BIO_LIMIT}  
        </span>  
      </div>  
    </div>  

    {/* Actions */}  
    <div className="flex flex-col gap-3">  
      <button  
        type="button"  
        onClick={() => handleSave(false)}  
        className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl shadow-lg hover:scale-[1.01] hover:shadow-2xl transition-transform disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"  
        disabled={disableActions}  
        aria-disabled={disableActions}  
      >  
        {saving ? <Loader2 className="animate-spin" size={18} /> : null}  
        {saving ? "Saving…" : "Save & Continue"}  
      </button>  

      <button  
        type="button"  
        onClick={() => handleSave(true)}  
        className={`w-full py-3 rounded-2xl border ${theme === "dark" ? "border-gray-700 text-gray-200 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-100"} transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}  
        disabled={disableActions}  
      >  
        Skip for Now  
      </button>  
    </div>  

    <AnimatePresence>  
      {saving && !uploading && (  
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-4 flex justify-center">  
          <LoadingDots label="Saving profile..." />  
        </motion.div>  
      )}  
    </AnimatePresence>  

    <p className={`mt-6 text-center text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>  
      You can always change these later in Settings.  
    </p>  
  </motion.div>  
</div>

);
}