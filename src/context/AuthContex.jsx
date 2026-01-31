// src/context/AuthContext.jsx
/* Arvdoul — AuthContext (production-ready, robust, boot-safe) */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  fetchSignInMethodsForEmail,
  getIdToken,
  getIdTokenResult
} from "firebase/auth";

import {
  initializeFirebase,
  getFirebaseAuth,
  getFirebaseStorage,
  getFirestoreDB
} from '../firebase/compat.js';

/**
 * Arvdoul AuthContext
 * - Waits for initializeFirebase() before using auth
 * - Exposes initialized/authReady state to avoid boot deadlocks
 * - Safety timeout prevents infinite loader on slow environments
 * - Keeps API stable (signIn, signOut, signUp, token helpers)
 */

const AuthContext = createContext(null);

/* ---------------------- Helpers ---------------------- */
function normalizeUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    emailVerified: !!user.emailVerified
  };
}

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/* ---------------------- Provider ---------------------- */
export function AuthProvider({ children }) {
  // initialization flags
  const [initialized, setInitialized] = useState(false); // firebase services initialized
  const [authReady, setAuthReady] = useState(false); // onAuthStateChanged first event fired
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [error, setError] = useState(null);

  // user state
  const [internalUser, setInternalUser] = useState(null); // firebase.User
  const [user, setUser] = useState(null); // normalized user

  // refs
  const authRef = useRef(null);
  const tokenRefreshTimerRef = useRef(null);

  /* ---------------------- Init Firebase (once) ---------------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingMessage("Initializing Firebase services");
        // initializeFirebase is idempotent; returns promise for services
        await initializeFirebase();
        if (!mounted) return;

        // store a local reference for quick access (not required but convenient)
        authRef.current = getFirebaseAuth();

        setInitialized(true);
        setLoadingMessage(null);
      } catch (e) {
        console.error("[ARVDOUL][Auth] initializeFirebase failed:", e);
        setError(e);
        setLoadingMessage(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------------- Attach Auth Listeners (safe) ---------------------- */
  useEffect(() => {
    if (!initialized) return;

    let mounted = true;
    let resolved = false;
    let unsubAuth = null;
    let unsubIdToken = null;

    try {
      const auth = getFirebaseAuth();

      setLoadingMessage("Connecting auth state");

      unsubAuth = onAuthStateChanged(
        auth,
        async (fbUser) => {
          if (!mounted) return;
          resolved = true;

          try {
            setInternalUser(fbUser || null);
            setUser(normalizeUser(fbUser));
            // mark authReady on the first event (even if user is null)
            if (!authReady) setAuthReady(true);
            setLoadingMessage(null);
            // ensure auth ref is populated
            authRef.current = auth;
          } catch (err) {
            console.error("[ARVDOUL][Auth] onAuthStateChanged handler error:", err);
            setError(err);
            setLoadingMessage(null);
            if (!authReady) setAuthReady(true);
          }
        },
        (listenError) => {
          console.error("[ARVDOUL][Auth] onAuthStateChanged error:", listenError);
          setError(listenError);
          setLoadingMessage(null);
          if (!authReady) setAuthReady(true);
        }
      );

      // Also listen for token changes to facilitate proactive token refresh handling
      unsubIdToken = onIdTokenChanged(
        auth,
        async (fbUser) => {
          if (!mounted) return;
          // update normalized user on token changes (e.g., custom claims)
          setInternalUser(fbUser || null);
          setUser(normalizeUser(fbUser));
        }
      );

      // Safety net: if auth doesn't emit first event within timeout, allow app to continue
      const safetyTimer = setTimeout(() => {
        if (!resolved && mounted) {
          console.warn("[ARVDOUL][Auth] auth listener timeout — proceeding unauthenticated");
          if (!authReady) setAuthReady(true);
          setLoadingMessage(null);
        }
      }, 3000);

      // cleanup
      return () => {
        mounted = false;
        clearTimeout(safetyTimer);
        try { if (unsubAuth) unsubAuth(); } catch {}
        try { if (unsubIdToken) unsubIdToken(); } catch {}
        // clear token refresh timer
        try { clearTimeout(tokenRefreshTimerRef.current); } catch {}
      };
    } catch (err) {
      console.error("[ARVDOUL][Auth] failed to attach auth listeners:", err);
      setError(err);
      if (!authReady) setAuthReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  /* ---------------------- Token helpers ---------------------- */
  const getToken = async (forceRefresh = false) => {
    if (!internalUser) return null;
    try {
      return await getIdToken(internalUser, forceRefresh);
    } catch (err) {
      console.warn("[ARVDOUL][Auth] getToken failed:", err);
      throw new AuthError("auth/token_error", err.message || "Failed to retrieve token");
    }
  };

  const getTokenDetails = async (forceRefresh = false) => {
    if (!internalUser) return null;
    try {
      return await getIdTokenResult(internalUser, forceRefresh);
    } catch (err) {
      console.warn("[ARVDOUL][Auth] getTokenDetails failed:", err);
      throw new AuthError("auth/token_result_error", err.message || "Failed to retrieve token details");
    }
  };

  /* ---------------------- Public API (auth operations) ---------------------- */

  const signUpWithEmailPassword = async (email, password, profile = {}) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      setLoadingMessage("Creating account");
      const auth = getFirebaseAuth();

      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // try update profile if available
      try {
        if (profile.displayName || profile.photoURL) {
          if (typeof userCred.user.updateProfile === "function") {
            await userCred.user.updateProfile(profile);
          }
        }
      } catch (e) {
        console.warn("[ARVDOUL][Auth] updateProfile non-fatal:", e);
      }

      try {
        await sendEmailVerification(userCred.user);
      } catch (e) {
        console.warn("[ARVDOUL][Auth] sendEmailVerification non-fatal:", e);
      }

      setLoadingMessage(null);
      return normalizeUser(userCred.user);
    } catch (err) {
      console.error("[ARVDOUL][Auth] signUpWithEmailPassword error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/signup_failed", err.message || "Signup failed");
    }
  };

  const startEmailLinkSignup = async (email, actionCodeSettings) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      setLoadingMessage("Sending sign-in link to email");
      const auth = getFirebaseAuth();

      // optionally check existing methods
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        // developer policy may inspect methods
        // console.log("methods", methods);
      } catch (e) {
        // not fatal
        console.warn("[ARVDOUL][Auth] fetchSignInMethods failed:", e);
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      try { localStorage.setItem("arvdoul_email_for_signin", email); } catch {}

      setLoadingMessage(null);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] startEmailLinkSignup error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/email_link_send_failed", err.message || "Failed to send email link");
    }
  };

  const completeEmailLinkSignup = async (maybeEmail = null, url = typeof window !== "undefined" ? window.location.href : null) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      const auth = getFirebaseAuth();

      if (!url) throw new AuthError("auth/missing_link", "No link URL provided");
      if (!isSignInWithEmailLink(auth, url)) {
        throw new AuthError("auth/invalid_link", "Provided URL is not a sign-in email link");
      }

      let email = maybeEmail;
      if (!email) {
        try {
          email = localStorage.getItem("arvdoul_email_for_signin");
        } catch {}
      }

      if (!email) {
        throw new AuthError("auth/email_required", "Email is required to complete sign-in with the link");
      }

      setLoadingMessage("Completing sign-in");
      const cred = await signInWithEmailLink(auth, email, url);

      try { localStorage.removeItem("arvdoul_email_for_signin"); } catch {}

      setLoadingMessage(null);
      return normalizeUser(cred.user);
    } catch (err) {
      console.error("[ARVDOUL][Auth] completeEmailLinkSignup error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/email_link_complete_failed", err.message || "Failed to complete email-link sign-in");
    }
  };

  const setPasswordForCurrentUser = async (newPassword) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      if (!internalUser) throw new AuthError("auth/no_user", "No signed-in user to set password for");
      setLoadingMessage("Setting password");
      await updatePassword(internalUser, newPassword);
      setLoadingMessage(null);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] setPasswordForCurrentUser error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/set_password_failed", err.message || "Failed to set password");
    }
  };

  const signIn = async (email, password) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      setLoadingMessage("Signing in");
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // optional enforcement of email verification
      if (cred.user && !cred.user.emailVerified) {
        // sign them out immediately to prevent access if your policy requires it
        try { await firebaseSignOut(auth); } catch {}
        throw new AuthError("auth/email_not_verified", "Please verify your email before logging in");
      }

      setLoadingMessage(null);
      return normalizeUser(cred.user);
    } catch (err) {
      console.error("[ARVDOUL][Auth] signIn error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/signin_failed", err.message || "Sign-in failed");
    }
  };

  const signOut = async () => {
    try {
      if (!initialized) return { success: true };
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      setInternalUser(null);
      setUser(null);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] signOut error:", err);
      throw new AuthError(err.code || "auth/signout_failed", err.message || "Sign out failed");
    }
  };

  const sendPasswordReset = async (email) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      setLoadingMessage("Checking account");
      const auth = getFirebaseAuth();
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (!methods || methods.length === 0) {
        setLoadingMessage(null);
        throw new AuthError("auth/user_not_found", "No account found for that email");
      }
      if (!methods.includes("password")) {
        setLoadingMessage(null);
        throw new AuthError("auth/reset_not_allowed", "Password reset not allowed for this account");
      }
      setLoadingMessage("Sending password reset email");
      await sendPasswordResetEmail(auth, email);
      setLoadingMessage(null);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] sendPasswordReset error:", err);
      setLoadingMessage(null);
      throw new AuthError(err.code || "auth/reset_failed", err.message || "Failed to send password reset email");
    }
  };

  const resendVerification = async () => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      if (!internalUser) throw new AuthError("auth/no_user", "No signed-in user to send verification to");
      await sendEmailVerification(internalUser);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] resendVerification error:", err);
      throw new AuthError(err.code || "auth/resend_verification_failed", err.message || "Failed to resend verification email");
    }
  };

  const reauthenticate = async (currentPassword) => {
    try {
      if (!initialized) throw new AuthError("auth/not_initialized", "Firebase not initialized");
      if (!internalUser) throw new AuthError("auth/no_user", "No user to reauthenticate");
      const cred = EmailAuthProvider.credential(internalUser.email, currentPassword);
      await reauthenticateWithCredential(internalUser, cred);
      return { success: true };
    } catch (err) {
      console.error("[ARVDOUL][Auth] reauthenticate error:", err);
      throw new AuthError(err.code || "auth/reauth_failed", err.message || "Reauthentication failed");
    }
  };

  /* ---------------------- Token refresh / health helpers ---------------------- */

  // Optional: a simple token refresh loop to attempt keep tokens fresh (best-effort)
  useEffect(() => {
    if (!internalUser) return;

    let mounted = true;
    const scheduleRefresh = async () => {
      try {
        // get token details and schedule next refresh a bit before expiry
        const result = await getIdTokenResult(internalUser);
        if (!mounted) return;

        // estimate ms until token expiry (tokenResult.expirationTime is ISO)
        const exp = new Date(result.expirationTime).getTime();
        const now = Date.now();
        const msUntil = Math.max(1000 * 30, exp - now - 60 * 1000); // refresh 60s before expiry, min 30s
        tokenRefreshTimerRef.current = setTimeout(async () => {
          try {
            await getIdToken(internalUser, true);
          } catch (e) {
            console.warn("[ARVDOUL][Auth] token refresh failed:", e);
          } finally {
            // schedule again
            if (mounted) scheduleRefresh();
          }
        }, msUntil);
      } catch (e) {
        // If token details fail, retry after a short delay
        tokenRefreshTimerRef.current = setTimeout(() => {
          if (mounted) scheduleRefresh();
        }, 30 * 1000);
      }
    };

    scheduleRefresh();

    return () => {
      mounted = false;
      try { clearTimeout(tokenRefreshTimerRef.current); } catch {}
    };
  }, [internalUser]);

  /* ---------------------- Public context value ---------------------- */
  const value = useMemo(() => ({
    // state
    initialized,
    authReady,
    loadingMessage,
    error,
    user: normalizeUser(internalUser),

    // auth operations
    signUpWithEmailPassword,
    startEmailLinkSignup,
    completeEmailLinkSignup,
    setPasswordForCurrentUser,
    signIn,
    signOut,
    sendPasswordReset,
    resendVerification,
    reauthenticate,

    // token helpers
    getToken,
    getTokenDetails,

    // low-level accessors (careful: used rarely)
    _internalUser: internalUser
  }), [
    initialized,
    authReady,
    loadingMessage,
    error,
    internalUser
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ---------------------- Hook ---------------------- */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export default AuthProvider;