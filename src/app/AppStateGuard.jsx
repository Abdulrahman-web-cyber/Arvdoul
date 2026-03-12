// src/app/AppStateGuard.jsx - ULTIMATE FIXED VERSION - PERFECT FLOW
// ✅ Fixed: Now waits for profile to load AND respects in‑progress signups
// 🔥 No more flicker between Home and email verification or setup profile

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    loading: authLoading,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    authInitialized,
    isSignupInProgress,
  } = useAuth();

  const [isChecking, setIsChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);
  const [redirectTo, setRedirectTo] = useState(null);

  const lastDecision = useRef({ path: "", decision: null });

  const publicRoutes = useMemo(
    () => [
      "/",
      "/intro",
      "/login",
      "/signup/step1",
      "/signup/step2",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/otp-verification",
      "/setup-profile",
    ],
    []
  );

  const verificationRoutes = useMemo(() => ["/verify-email", "/otp-verification"], []);
  const setupProfileRoute = "/setup-profile";

  const isPublicRoute = useMemo(
    () => publicRoutes.some((route) => location.pathname === route || location.pathname.startsWith(route)),
    [location.pathname, publicRoutes]
  );

  const isVerificationRoute = useMemo(
    () => verificationRoutes.some((route) => location.pathname === route || location.pathname.startsWith(route)),
    [location.pathname, verificationRoutes]
  );

  const isSetupProfileRoute = useMemo(
    () => location.pathname === setupProfileRoute || location.pathname.startsWith(setupProfileRoute + "/"),
    [location.pathname]
  );

  useEffect(() => {
    if (!authInitialized && location.pathname !== "/") {
      setIsChecking(true);
      return;
    }

    if (authLoading && isAuthenticated) {
      setIsChecking(true);
      return;
    }

    const currentStateKey = `${location.pathname}-${isAuthenticated}-${isEmailVerified}-${isProfileComplete}`;
    if (lastDecision.current.path === currentStateKey) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setShouldRender(false);
    setRedirectTo(null);

    const timer = setTimeout(() => {
      console.log("🛡️ Route Guard Decision:", {
        path: location.pathname,
        isAuthenticated,
        isEmailVerified,
        isProfileComplete,
        isPublicRoute,
        isVerificationRoute,
        isSetupProfileRoute,
        isSignupInProgress,
      });

      // 1. SPLASH SCREEN - Always allow
      if (location.pathname === "/") {
        console.log("✅ Allowing splash screen");
        setShouldRender(true);
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: "allow-splash" };
        return;
      }

      // 2. UNAUTHENTICATED user on PROTECTED route
      if (!isAuthenticated && !isPublicRoute) {
        console.log("🔒 Redirecting unauthenticated to /intro");
        setRedirectTo("/intro");
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: "redirect-intro" };
        return;
      }

      // 3. AUTHENTICATED user on PUBLIC AUTH routes (except setup/verification)
      if (
        isAuthenticated &&
        isPublicRoute &&
        !isVerificationRoute &&
        !isSetupProfileRoute &&
        (location.pathname.includes("/login") ||
          location.pathname.includes("/signup") ||
          location.pathname.includes("/intro"))
      ) {
        // Allow signup pages while a signup operation is in progress
        if (isSignupInProgress && location.pathname.includes("/signup")) {
          console.log("✅ Signup in progress, allowing signup page");
          setShouldRender(true);
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: "allow-signup-in-progress" };
          return;
        }
        console.log("🔒 Redirecting authenticated away from auth pages");
        setRedirectTo("/home");
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: "redirect-home" };
        return;
      }

      // 4. Handle EMAIL VERIFICATION flow
      if (isAuthenticated && !isEmailVerified) {
        if (isVerificationRoute) {
          console.log("✅ Allowing unverified user on verification route");
          setShouldRender(true);
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: "allow-verification" };
          return;
        } else if (!isPublicRoute) {
          console.log("📧 Redirecting unverified user to /verify-email");
          setRedirectTo("/verify-email");
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: "redirect-verify" };
          return;
        }
      }

      // 5. Handle PROFILE SETUP flow
      if (isAuthenticated && isEmailVerified && !isProfileComplete) {
        if (isSetupProfileRoute) {
          console.log("✅ Allowing incomplete profile on setup route");
          setShouldRender(true);
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: "allow-setup" };
          return;
        } else if (location.state?.fromVerification) {
          console.log("⏳ User just verified, checking profile...");
          setTimeout(() => {
            if (!isProfileComplete) {
              console.log("👤 Redirecting to setup-profile after verification");
              navigate("/setup-profile", { replace: true });
            }
          }, 1000);
          setShouldRender(true);
          setIsChecking(false);
          return;
        } else {
          console.log("👤 Redirecting to /setup-profile for incomplete profile");
          setRedirectTo("/setup-profile");
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: "redirect-setup" };
          return;
        }
      }

      // 6. Profile complete but on setup route - redirect to home
      if (isAuthenticated && isEmailVerified && isProfileComplete && isSetupProfileRoute) {
        console.log("🏠 Redirecting complete profile away from setup");
        setRedirectTo("/home");
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: "redirect-home-from-setup" };
        return;
      }

      // 7. ALL CHECKS PASSED
      console.log("✅ All checks passed - Rendering content");
      setShouldRender(true);
      setIsChecking(false);
      lastDecision.current = { path: currentStateKey, decision: "allow" };
    }, 50);

    return () => clearTimeout(timer);
  }, [
    location.pathname,
    location.state,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    isPublicRoute,
    isVerificationRoute,
    isSetupProfileRoute,
    authInitialized,
    authLoading,
    isSignupInProgress,
    navigate,
  ]);

  useEffect(() => {
    if (redirectTo && redirectTo !== location.pathname) {
      console.log(`🔄 Redirecting to: ${redirectTo}`);
      navigate(redirectTo, {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [redirectTo, navigate, location.pathname]);

  useEffect(() => {
    if (lastDecision.current.path !== location.pathname) {
      lastDecision.current = { path: "", decision: null };
    }
  }, [location.pathname]);

  if (isChecking || (authLoading && isAuthenticated && location.pathname !== "/")) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {authLoading ? "Loading profile..." : "Checking permissions..."}
          </p>
        </div>
      </div>
    );
  }

  if (redirectTo && redirectTo !== location.pathname) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />
    );
  }

  if (shouldRender) {
    return children;
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />
  );
}