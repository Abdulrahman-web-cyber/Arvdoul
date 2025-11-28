import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  updateProfile as updateAuthProfile,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import localforage from "localforage";
import { auth, db } from "../firebase/firebase";
import { uploadToCloudinary } from "../lib/cloudinaryService";

// ---- Defaults (env overrides recommended) ----
const DEFAULT_COIN_BALANCE = parseInt(import.meta.env.VITE_INITIAL_COIN_BALANCE || "100", 10);
const DEFAULT_PROFILE_PIC = import.meta.env.VITE_DEFAULT_PROFILE_PICTURE || "/assets/default-profile.png";
const DEFAULT_COVER_PHOTO = import.meta.env.VITE_DEFAULT_COVER_IMAGE || "";

const UserContext = createContext(null);

// ---------- helpers ----------
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
const phoneOk = (p) => /^\+?[0-9]{7,15}$/.test(String(p || "").trim());
const passOk = (pw) => typeof pw === "string" && pw.length >= 8;
const dobOk = ({ day, month, year }) => {
  const d = String(day || "").padStart(2, "0");
  const m = String(month || "").padStart(2, "0");
  const y = String(year || "");
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return false;
  const dt = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return !Number.isNaN(dt.valueOf()) && dt.getUTCFullYear() === +y && dt.getUTCMonth() + 1 === +m && dt.getUTCDate() === +d;
};

const retry = async (fn, times = 3, delayMs = 500) => {
  let last;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < times - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
};

const baseProfileDoc = (firebaseUser, overrides = {}) => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email || "",
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

const TEST_NUMBERS = {
  "+1234567890": "123456",
  "+1111111111": "654321",
};

export const UserProvider = ({ children }) => {
  // core state
  const [user, setUser] = useState(null); // { uid, email, ... , profile }
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);
  const [error, setError] = useState(null);

  // signup wizard state
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: { day: "", month: "", year: "" },
    contactMethod: "", // "email" | "phone" | "google"
    contactValue: "",  // mirrors email/phone
    email: "",
    phone: "",
    password: "",
    profilePictureFile: null,
  });
  const [step, setStep] = useState(1);

  // OTP & reCAPTCHA
  const [verificationId, setVerificationId] = useState(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const recaptchaWidgetIdRef = useRef(null);

  // listeners/debounce
  const profileUnsubRef = useRef(null);
  const snapshotDebounceRef = useRef(null);

  const log = (...a) => console.debug("[UserContext]", ...a);

  // cache helpers
  const cacheUserProfile = async (profile) => {
    try {
      await localforage.setItem("cachedUserProfile", profile);
    } catch (e) {
      console.warn("cacheUserProfile failed", e);
    }
  };
  const loadCachedProfile = async () => {
    try {
      const cached = await localforage.getItem("cachedUserProfile");
      if (cached) setUser(cached);
    } catch (e) {
      console.warn("loadCachedProfile failed", e);
    }
  };

  // handle Google redirect (if used in mobile flows)
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          const u = res.user;
          setSignupData((prev) => ({
            ...prev,
            contactMethod: "google",
            email: u.email || prev.email,
            contactValue: u.email || prev.contactValue,
          }));
          log("Google redirect result applied");
        }
      } catch (e) {
        console.warn("getRedirectResult error", e);
      }
    })();
  }, []);

  // Auth state + Firestore user profile snapshot
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      await loadCachedProfile();

      const userRef = doc(db, "users", firebaseUser.uid);

      // ensure user doc exists (idempotent)
      const ensureDoc = async () => {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const docData = baseProfileDoc(firebaseUser);
          await setDoc(userRef, docData);
          try {
            await updateAuthProfile(firebaseUser, {
              displayName: docData.displayName,
              photoURL: docData.profilePicture,
            });
          } catch (e) {
            console.warn("sync auth profile failed", e);
          }
        }
      };
      try {
        await retry(ensureDoc);
      } catch (e) {
        console.error("ensure user doc failed", e);
      }

      // subscribe to user doc
      if (profileUnsubRef.current) profileUnsubRef.current();
      profileUnsubRef.current = onSnapshot(
        userRef,
        (snap) => {
          if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current);
          snapshotDebounceRef.current = setTimeout(async () => {
            try {
              const profileData = snap.exists() ? snap.data() : baseProfileDoc(firebaseUser);
              const uiUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                phoneNumber: firebaseUser.phoneNumber || "",
                displayName: firebaseUser.displayName || profileData.displayName || "",
                photoURL: firebaseUser.photoURL || profileData.profilePicture || "",
                providerData: firebaseUser.providerData || [],
                profile: profileData,
              };
              setUser(uiUser);
              await cacheUserProfile(uiUser);
            } catch (e) {
              console.error("snapshot merge error", e);
            } finally {
              setLoading(false);
              setIsInitialized(true);
            }
          }, 120);
        },
        (err) => {
          console.error("onSnapshot error", err);
          setLoading(false);
          setIsInitialized(true);
        }
      );
    });

    return () => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      unsubAuth();
      if (snapshotDebounceRef.current) clearTimeout(snapshotDebounceRef.current);
    };
  }, []);

  // ----- signup wizard helpers -----
  const updateSignupData = (field, value) => {
    setSignupData((prev) => {
      const next = { ...prev, [field]: value };
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
  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  // ----- reCAPTCHA init -----
  const initRecaptcha = async (containerOrId = "recaptcha-container") => {
    if (typeof window === "undefined") throw new Error("No window");
    if (window.recaptchaVerifier) {
      setRecaptchaReady(true);
      return window.recaptchaVerifier;
    }
    const verifier = new RecaptchaVerifier(
      containerOrId,
      {
        size: "invisible",
        callback: () => setRecaptchaReady(true),
        "expired-callback": () => setRecaptchaReady(false),
      },
      auth
    );
    const widgetId = await verifier.render();
    recaptchaWidgetIdRef.current = widgetId;
    window.recaptchaVerifier = verifier;
    setRecaptchaReady(true);
    return verifier;
  };

  // ----- phone auth (OTP) -----
  const sendOtp = async (phone, { forceInit = false } = {}) => {
    setError(null);
    try {
      if (!phone) throw new Error("Phone number required");
      if (!phone.startsWith("+")) throw new Error("Include country code, e.g. +1234567890");

      if (TEST_NUMBERS[phone]) {
        window.confirmationResult = {
          confirm: async (code) => {
            if (code === TEST_NUMBERS[phone]) {
              return { user: { uid: "test-uid", phoneNumber: phone } };
            }
            const e = new Error("Invalid OTP for test number");
            e.code = "auth/invalid-verification-code";
            throw e;
          },
        };
        setVerificationId("test-verification-id");
        return window.confirmationResult;
      }

      if (!window.recaptchaVerifier || forceInit) await initRecaptcha();
      const confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setVerificationId(confirmationResult.verificationId);
      window.confirmationResult = confirmationResult;
      return confirmationResult;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  const verifyOtp = async (otp) => {
    setError(null);
    try {
      if (!otp) throw new Error("OTP required");
      if (window.confirmationResult?.confirm) {
        const res = await window.confirmationResult.confirm(otp);
        return res.user;
      }
      if (!verificationId) throw new Error("No OTP session available");
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const signInResult = await signInWithCredential(auth, credential);
      return signInResult.user;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  // ----- complete signup -----
  const completeSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      const {
        firstName,
        lastName,
        contactMethod,
        contactValue: rawContactValue,
        email,
        phone,
        password,
        profilePictureFile,
        dob,
        gender,
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
        try {
          await updateAuthProfile(fbUser, { displayName: `${firstName} ${lastName}`.trim() });
        } catch {}
      } else if (contactMethod === "google") {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        fbUser = cred.user;
      } else if (contactMethod === "phone") {
        fbUser = auth.currentUser;
        if (!fbUser) throw new Error("Phone user is not currently authenticated");
      } else {
        throw new Error("Unknown contact method");
      }

      // optional profile picture upload
      let profilePicUrl = fbUser.photoURL || DEFAULT_PROFILE_PIC;
      if (profilePictureFile) {
        const upload = await retry(() =>
          uploadToCloudinary(profilePictureFile, `profile_pictures/${fbUser.uid}`, {
            resource_type: "image",
            unique_filename: true,
          })
        );
        profilePicUrl = upload.url;
      }

      // build profile doc
      const userRef = doc(db, "users", fbUser.uid);
      const profileDoc = baseProfileDoc(fbUser, {
        firstName,
        lastName,
        gender,
        dob,
        contactMethod,
        phone: contactMethod === "phone" ? contactValue : "",
        displayName: `${firstName} ${lastName}`.trim() || fbUser.email?.split("@")[0],
        profilePicture: profilePicUrl,
      });

      await retry(() => setDoc(userRef, profileDoc, { merge: true }));

      // local merge/cache
      const uiUser = {
        uid: fbUser.uid,
        email: fbUser.email || "",
        phoneNumber: fbUser.phoneNumber || "",
        displayName: fbUser.displayName || profileDoc.displayName,
        photoURL: fbUser.photoURL || profileDoc.profilePicture,
        providerData: fbUser.providerData || [],
        profile: profileDoc,
      };
      setUser(uiUser);
      await cacheUserProfile(uiUser);

      return profileDoc;
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ----- logout -----
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      await localforage.removeItem("cachedUserProfile");
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  // ----- update profile (partial) -----
  const updateProfileData = async (updates) => {
    if (!user?.uid) throw new Error("No user logged in");
    const userRef = doc(db, "users", user.uid);
    try {
      await retry(() => updateDoc(userRef, updates));
      const mergedProfile = { ...user.profile, ...updates };
      setUser((prev) => (prev ? { ...prev, profile: mergedProfile } : prev));

      // reflect to Firebase Auth when relevant
      if (updates.displayName || updates.profilePicture) {
        try {
          await retry(() =>
            updateAuthProfile(auth.currentUser, {
              displayName: updates.displayName || user.profile.displayName,
              photoURL: updates.profilePicture || user.profile.profilePicture,
            })
          );
        } catch (e) {
          console.warn("updateAuthProfile failed", e);
        }
      }

      await cacheUserProfile({ ...user, profile: mergedProfile });
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  // ----- coins (transactional) -----
  const addCoins = async (amount, reason = "bonus") => {
    if (!user?.uid) throw new Error("No user");
    const userRef = doc(db, "users", user.uid);
    try {
      await retry(() =>
        runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) throw new Error("User doc missing");
          const current = snap.data().coins || 0;
          const newBalance = current + Number(amount || 0);
          tx.update(userRef, {
            coins: newBalance,
            coinsHistory: arrayUnion({ amount: Number(amount || 0), reason, ts: serverTimestamp() }),
          });
        })
      );
      setUser((prev) =>
        prev
          ? { ...prev, profile: { ...prev.profile, coins: (prev.profile.coins || 0) + Number(amount || 0) } }
          : prev
      );
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  // ----- user-scoped message log (separate from real chat) -----
  const addMessage = async (message) => {
    if (!user?.uid) throw new Error("No user");
    const userRef = doc(db, "users", user.uid);
    try {
      await retry(() =>
        runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) throw new Error("User doc missing");
          tx.update(userRef, { messages: arrayUnion(message) });
        })
      );
      setUser((prev) =>
        prev
          ? { ...prev, profile: { ...prev.profile, messages: [...(prev.profile.messages || []), message] } }
          : prev
      );
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    }
  };

  const ctx = {
    // state
    user,
    loading,
    isInitialized,
    error,

    // signup
    signupData,
    step,
    updateSignupData,
    nextStep,
    prevStep,

    // phone auth
    initRecaptcha,
    recaptchaReady,
    sendOtp,
    verifyOtp,

    // actions
    completeSignup,
    logout,
    updateProfileData,
    addCoins,
    addMessage,
  };

  return <UserContext.Provider value={ctx}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);