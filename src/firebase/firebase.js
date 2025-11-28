// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
import { getRemoteConfig } from "firebase/remote-config";

// -------------------- Firebase Config --------------------
// These values are injected from .env via Vite (see your .env file)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// -------------------- Initialize Firebase --------------------
const app = initializeApp(firebaseConfig);

// Core services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export const remoteConfig = getRemoteConfig(app);

// -------------------- Async Analytics --------------------
export let analytics = null;
export const getAnalyticsInstance = async () => {
  if (!analytics && (await isAnalyticsSupported())) {
    analytics = getAnalytics(app);
  }
  return analytics;
};

// -------------------- Async Messaging --------------------
export let messaging = null;
export const getMessagingInstance = async () => {
  if (!messaging && (await isMessagingSupported())) {
    messaging = getMessaging(app);
  }
  return messaging;
};

// -------------------- reCAPTCHA for Phone Auth --------------------
let recaptchaInstance = null;
export const getRecaptchaVerifier = (containerId = "recaptcha-container") => {
  if (!recaptchaInstance) {
    recaptchaInstance = new RecaptchaVerifier(
      containerId,
      {
        size: "invisible",
        callback: (response) => {
          console.log("reCAPTCHA verified:", response);
        },
        "expired-callback": () => {
          console.warn("reCAPTCHA expired");
        },
      },
      auth
    );
  }
  return recaptchaInstance;
};

// -------------------- Export Firebase App --------------------
export default app;
