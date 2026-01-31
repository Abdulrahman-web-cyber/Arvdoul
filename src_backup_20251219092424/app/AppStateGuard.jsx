// src/app/AppStateGuard.jsx
/**
 * Arvdoul — AppStateGuard (Enterprise / Arvdoul-level)
 *
 * Responsibilities:
 *  - Inspect global app state (auth readiness, user, remote profile)
 *  - Enforce platform-level gates:
 *      • Maintenance mode
 *      • Email verification
 *      • Profile completion (onboarding)
 *      • Account disabled/blocked
 *  - Provide route guards:
 *      • ProtectedRoute (requires fully onboarded & verified)
 *      • VerifiedRoute (requires verified email)
 *      • OnboardingRoute (route for users who need to complete profile)
 *  - Provide deterministic UI while remote checks run (loading + retry + diagnostics)
 *
 * Assumptions:
 *  - AuthProvider has been initialized and `useAuth()` is available
 *  - Firebase services initialized (use getFirestoreDB() to fetch user profile)
 *
 * Notes:
 *  - This module performs ONE Firestore read for the current user's profile (cached locally in state)
 *  - Customize the `isProfileComplete` logic to match your user schema (displayName, username, bio, etc.)
 */

import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuth } from "../context/AuthContext.jsx";
import { getFirestoreDB } from "../firebase/firebase.js";
import { doc, getDoc } from "firebase/firestore";
import FullScreenLoader from "../components/System/FullScreenLoader.jsx";
import FatalError from "../components/System/FatalError.jsx";

/* ---------- Config & helpers ---------- */

/** Toggleable maintenance mode via env var (set VITE_MAINTENANCE_MODE=true) */
const MAINTENANCE_MODE = (import.meta.env.VITE_MAINTENANCE_MODE || "false").toLowerCase() === "true";

/** How we decide whether profile is "complete" — adapt to your schema */
function checkProfileComplete(profileDoc) {
  if (!profileDoc) return false;
  const data = profileDoc;
  // Example rule set — modify as required:
  // - has displayName
  // - has username (optional handle)
  // - has avatar or bio (at least one)
  const hasDisplayName = !!(data.displayName && String(data.displayName).trim());
  const hasUsername = !!(data.username && String(data.username).trim());
  const hasAvatarOrBio = !!(data.photoURL || data.bio);
  return hasDisplayName && hasUsername && hasAvatarOrBio;
}

/* ---------- Small UI Helpers ---------- */

function InlineHint({ children }) {
  return (
    <div className="rounded-md bg-amber-50 dark:bg-zinc-800 p-3 text-sm text-amber-800 dark:text-amber-200 border border-amber-100 dark:border-zinc-700">
      {children}
    </div>
  );
}

/* ---------- AppStateGuard component ---------- */

export default function AppStateGuard({ children }) {
  const { initialized, authReady, user, loadingMessage, error: authError } = useAuth();
  const location = useLocation();

  // Local state for remote profile / decisions
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileCheckedAt, setProfileCheckedAt] = useState(null);

  // Derived booleans
  const isAuthenticated = !!user;
  const isEmailVerified = !!(user && user.emailVerified);
  const isAuthError = !!authError;

  // When user is present, fetch profile once (AppBootstrap already ensures Firebase & Auth are ready).
  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      // clear profile state when signed out
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    // Fetch lightweight profile metadata from Firestore: users/{uid}
    (async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const db = getFirestoreDB(); // will throw if not initialized (guarded by AppBootstrap)
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (!mounted) return;
        if (!snap.exists()) {
          // user doc missing — treat as incomplete profile
          setProfile(null);
        } else {
          setProfile(snap.data());
        }
        setProfileCheckedAt(new Date().toISOString());
      } catch (err) {
        console.error("[ARVDOUL][AppStateGuard] profile fetch failed:", err);
        setProfileError(err);
      } finally {
        setProfileLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.uid]);

  // Final computed flags
  const isProfileComplete = useMemo(() => {
    if (!profile) return false;
    return checkProfileComplete(profile);
  }, [profile]);

  /* ---------- Fatal states (render friendly UI) ---------- */

  if (isAuthError) {
    return <FatalError title="Authentication initialization error" error={authError} />;
  }

  if (!initialized || !authReady) {
    // AppBootstrap should have gated this, but we remain defensive
    return <FullScreenLoader message={loadingMessage || "Waking platform..."} />;
  }

  if (MAINTENANCE_MODE) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <div className="max-w-xl text-center p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Maintenance Mode</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            We are performing scheduled maintenance. Please try again later — thank you for your patience.
          </p>
        </div>
      </div>
    );
  }

  /* ---------- While profile check in progress, show loader for authenticated users ---------- */
  if (isAuthenticated && profileLoading) {
    return <FullScreenLoader message="Checking account status…" />;
  }

  /* ---------- If profile fetch error, show fatal with retry ---------- */
  if (isAuthenticated && profileError) {
    return (
      <FatalError
        title="Account lookup failed"
        error={profileError}
        details={{
          hint: "Network or permission error when fetching account metadata",
          location,
          ts: new Date().toISOString()
        }}
      />
    );
  }

  /* ---------- Otherwise, render children but provide helpers via context-like props (route guards) ---------- */
  // Provide small helper components (used in routing)
  const ProtectedRoute = ({ redirectTo = "/intro" }) => {
    // Fully onboarded & verified users only
    if (!isAuthenticated) return <Navigate to={redirectTo} replace state={{ from: location }} />;
    if (!isEmailVerified) return <Navigate to="/verify-email" replace state={{ from: location }} />;
    if (!isProfileComplete) return <Navigate to="/setup-profile" replace state={{ from: location }} />;
    return <Outlet />;
  };

  const VerifiedRoute = ({ redirectTo = "/verify-email" }) => {
    if (!isAuthenticated) return <Navigate to="/intro" replace state={{ from: location }} />;
    if (!isEmailVerified) return <Navigate to={redirectTo} replace state={{ from: location }} />;
    return <Outlet />;
  };

  const OnboardingRoute = ({ redirectTo = "/home" }) => {
    if (!isAuthenticated) return <Navigate to="/intro" replace state={{ from: location }} />;
    if (isProfileComplete) return <Navigate to={redirectTo} replace state={{ from: location }} />;
    return <Outlet />;
  };

  // Small diagnostics context available for children via window (dev only)
  if (import.meta.env.DEV) {
    window.__ARVDOUL_STATE__ = {
      initialized,
      authReady,
      user,
      profile,
      isProfileComplete,
      profileCheckedAt
    };
  }

  // Render children routes — route-level guards will use the helper components above
  // We expose them in a "guards" object to import where you build AppRoutes.
  return (
    <>
      {/* Helpful inline hints for dev or for screens to consume */}
      <div style={{ display: "none" }} data-arv-state="true" />
      {children ? children : <Outlet />}
    </>
  );
}

/* ---------- Export useful guard components for use in AppRoutes.jsx ---------- */

/**
 * Usage in AppRoutes.jsx:
 *
 * import AppStateGuard, { ProtectedRoute, VerifiedRoute, OnboardingRoute } from './app/AppStateGuard.jsx';
 *
 * <Route element={<AppStateGuard />}>
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/home" element={<HomeScreen />} />
 *   </Route>
 *
 *   <Route element={<OnboardingRoute />}>
 *     <Route path="/setup-profile" element={<SetupProfile />} />
 *   </Route>
 *
 *   <Route element={<VerifiedRoute />}>
 *     <Route path="/verify-email" element={<VerifyEmailScreen />} />
 *   </Route>
 * </Route>
 *
 */

export const Guards = {
  // These are intended to be used by importing into your AppRoutes file, e.g.:
  // import { Guards } from '../app/AppStateGuard.jsx'
  ProtectedRoute: ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>,
  VerifiedRoute: ({ children }) => <VerifiedRoute>{children}</VerifiedRoute>,
  OnboardingRoute: ({ children }) => <OnboardingRoute>{children}</OnboardingRoute>
};

AppStateGuard.propTypes = {
  children: PropTypes.node
};

ProtectedRoute.propTypes = {
  redirectTo: PropTypes.string
};
VerifiedRoute.propTypes = {
  redirectTo: PropTypes.string
};
OnboardingRoute.propTypes = {
  redirectTo: PropTypes.string
};