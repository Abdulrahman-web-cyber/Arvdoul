// src/context/SignupContext.jsx
import React, { createContext, useContext, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebase"; // <-- make sure your firebase file exports both `auth` and `db`
import { uploadToCloudinary } from "../lib/cloudinaryService";

/**
 * SignupContext: centralizes signup state & helpers
 * Clean, defensive and production-ready.
 */

// defaults from env with fallbacks
const DEFAULT_COIN_BALANCE = parseInt(import.meta.env.VITE_INITIAL_COIN_BALANCE || "100", 10);
const DEFAULT_PROFILE_PIC = import.meta.env.VITE_DEFAULT_PROFILE_PICTURE || "/assets/default-profile.png";
const DEFAULT_COVER_PHOTO = import.meta.env.VITE_DEFAULT_COVER_IMAGE || "";

// validators
const emailOk = (e = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
const phoneOk = (p = "") => /^\+?[0-9]{7,15}$/.test(String(p).trim());
const passOk = (pw) => typeof pw === "string" && pw.length >= 8;
const dobOk = ({ day, month, year } = {}) => {
  const d = String(day || "").padStart(2, "0");
  const m = String(month || "").padStart(2, "0");
  const y = String(year || "");
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return false;
  const dt = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return !Number.isNaN(dt.valueOf())
    && dt.getUTCFullYear() === +y
    && dt.getUTCMonth() + 1 === +m
    && dt.getUTCDate() === +d;
};

// retry helper
const retry = async (fn, times = 3, delayMs = 500) => {
  let last;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < times - 1) await new Promise(r => setTimeout(r, delayMs)); }
  }
  throw last;
};

// base profile doc factory
const baseProfileDoc = (firebaseUser, overrides = {}) => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email || "",
  username: "",
  firstName: "",
  lastName: "",
  gender: "",
  dob: { day: "", month: "", year: "" },
  contactMethod: "",
  phone: "",
  displayName: firebaseUser.displayName || "User",
  nickname: "",
  profilePicture: firebaseUser.photoURL || DEFAULT_PROFILE_PIC,
  coverPhoto: DEFAULT_COVER_PHOTO,
  coins: DEFAULT_COIN_BALANCE,
  coinsHistory: [],
  bio: "",
  followers: [],
  following: [],
  stories: [],
  posts: [],
  messages: [],
  notifications: [],
  settings: { privacy: "public", darkMode: false, notifications: true },
  createdAt: serverTimestamp(),
  status: "active",
  verified: false,
  ...overrides,
});

const SignupContext = createContext(null);

export const SignupProvider = ({ children }) => {
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: { day: "", month: "", year: "" },
    contactMethod: "", // "email" | "phone" | "google"
    contactValue: "",
    email: "",
    phone: "",
    password: "",
    profilePictureFile: null,
  });

  const [step, setStep] = useState(1);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const recaptchaVerifierRef = useRef(null);
  const [verificationId, setVerificationId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // merge-friendly updater: either (field, value) or pass an object
  const updateSignupData = (field, value) => {
    setSignupData(prev => {
      if (typeof field === "object" && field !== null) {
        const updates = field;
        return {
          ...prev,
          ...updates,
          dob: { ...prev.dob, ...(updates.dob || {}) },
          contactValue:
            updates.contactMethod === "phone" ? (updates.phone || prev.phone)
              : updates.contactMethod === "email" ? (updates.email || prev.email)
              : updates.contactMethod === "google" ? (updates.email || prev.contactValue)
              : (updates.contactValue ?? prev.contactValue),
        };
      }

      const next = { ...prev };
      if (field === "dob") next.dob = { ...prev.dob, ...value };
      else next[field] = value;

      if (field === "phone" && prev.contactMethod === "phone") next.contactValue = value;
      if (field === "email" && prev.contactMethod === "email") next.contactValue = value;
      if (field === "contactMethod") {
        if (value === "phone" && prev.phone) next.contactValue = prev.phone;
        if (value === "email" && prev.email) next.contactValue = prev.email;
        if (value === "google") next.contactValue = prev.email || prev.contactValue;
      }

      return next;
    });
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  // init reCAPTCHA (invisible). renders once and keeps verifier ref.
  const initRecaptcha = () => {
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;
    if (typeof window === "undefined") throw new Error("No window object for reCAPTCHA");

    // RecaptchaVerifier requires valid `auth` instance
    const verifier = new RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible",
        callback: () => setRecaptchaReady(true),
        "expired-callback": () => setRecaptchaReady(false),
      },
      auth
    );
    // render asynchronously
    verifier.render().then(() => setRecaptchaReady(true)).catch(() => setRecaptchaReady(true)); // best-effort
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  // send phone OTP
  const sendOtp = async (phone) => {
    if (!phone) throw new Error("Phone required");
    const verifier = recaptchaVerifierRef.current || initRecaptcha();
    // signInWithPhoneNumber from firebase/auth
    const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
    setVerificationId(confirmationResult.verificationId);
    // keep a window ref for older flows
    window.confirmationResult = confirmationResult;
    return confirmationResult;
  };

  // verify OTP
  const verifyOtp = async (otp) => {
    if (!otp) throw new Error("OTP required");
    if (window.confirmationResult?.confirm) {
      const result = await window.confirmationResult.confirm(otp);
      return result.user;
    }
    if (!verificationId) throw new Error("No OTP session available");
    const credential = PhoneAuthProvider.credential(verificationId, otp);
    return (await signInWithCredential(auth, credential)).user;
  };

  // complete signup: validate, create auth user, upload pic, create firestore profile
  const completeSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        firstName, lastName, contactMethod, contactValue: rawContactValue, email, phone, password, profilePictureFile, dob, gender,
      } = signupData;
      const contactValue = rawContactValue || (contactMethod === "phone" ? phone : email);

      if (!firstName || !lastName) throw new Error("Name required");
      if (contactMethod === "email" && !emailOk(contactValue)) throw new Error("Invalid email");
      if (contactMethod === "phone" && !phoneOk(contactValue)) throw new Error("Invalid phone");
      if (contactMethod === "email" && !passOk(password)) throw new Error("Password must be 8+ chars");
      if (!dobOk(dob)) throw new Error("Invalid date of birth");

      let fbUser = null;

      if (contactMethod === "email") {
        const cred = await createUserWithEmailAndPassword(auth, contactValue, password);
        fbUser = cred.user;
        await updateAuthProfile(fbUser, { displayName: `${firstName} ${lastName}`.trim() });
      } else if (contactMethod === "google") {
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        fbUser = cred.user;
      } else if (contactMethod === "phone") {
        fbUser = auth.currentUser;
        if (!fbUser) throw new Error("Phone user not authenticated");
      } else {
        throw new Error("Unknown contact method");
      }

      // upload profile picture (optional)
      let profilePicUrl = fbUser?.photoURL || DEFAULT_PROFILE_PIC;
      if (profilePictureFile) {
        const upload = await retry(() => uploadToCloudinary(profilePictureFile, `profile_pictures/${fbUser.uid}`, { resource_type: "image", unique_filename: true }));
        profilePicUrl = upload.url || profilePicUrl;
      }

      // create / merge Firestore user profile
      const userRef = doc(db, "users", fbUser.uid);
      const profileDoc = baseProfileDoc(fbUser, {
        firstName,
        lastName,
        gender,
        dob,
        contactMethod,
        phone: contactMethod === "phone" ? contactValue : "",
        displayName: `${firstName} ${lastName}`.trim(),
        profilePicture: profilePicUrl,
      });

      await retry(() => setDoc(userRef, profileDoc, { merge: true }));

      return profileDoc;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignupContext.Provider
      value={{
        signupData,
        step,
        updateSignupData,
        nextStep,
        prevStep,
        sendOtp,
        verifyOtp,
        completeSignup,
        recaptchaReady,
        error,
        loading,
      }}
    >
      {children}
      {/* invisible reCAPTCHA container for Firebase phone flows */}
      <div id="recaptcha-container" style={{ display: "none" }} />
    </SignupContext.Provider>
  );
};

export const useSignup = () => useContext(SignupContext);