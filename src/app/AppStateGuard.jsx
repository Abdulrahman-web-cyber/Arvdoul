// src/app/AppStateGuard.jsx - WAITS FOR PROFILE, FIXED SPLASH, NO PREMATURE REDIRECT
// 🔧 FIXED: Google/phone users no longer redirected to email verification
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
    requiresEmailVerification,
  } = useAuth();

  const [shouldRender, setShouldRender] = useState(false);
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

  // ✅ Safe check: only email/password users need email verification
  const needsEmailVerification = useMemo(() => {
    if (!user) return false;
    const provider = user.authProvider;
    // Only force verification for email/password providers
    const isEmailProvider = provider === 'email' || provider === 'password' || provider === 'unknown';
    // Also, if the user has an email and it's not verified AND the provider is email-like
    return isEmailProvider && user.email && !user.emailVerified;
  }, [user]);

  useEffect(() => {
    // DO NOT make any decisions until auth is fully initialized AND loading is complete
    if (!authInitialized || authLoading) {
      setShouldRender(false);
      return;
    }

    const currentStateKey = `${location.pathname}-${isAuthenticated}-${isEmailVerified}-${isProfileComplete}-${isSignupInProgress}-${needsEmailVerification}`;

    // Prevent repeated navigation for the same state
    if (lastDecision.current.path === currentStateKey) {
      setShouldRender(true);
      return;
    }

    // ===== SPLASH SCREEN AUTO‑REDIRECT =====
    if (location.pathname === "/") {
      setShouldRender(true);
      lastDecision.current = { path: currentStateKey, decision: "allow-splash" };
      return;
    }

    // ===== UNAUTHENTICATED USERS =====
    if (!isAuthenticated) {
      if (!isPublicRoute) {
        console.log("🔒 Not authenticated, redirecting to /intro");
        navigate("/intro", { replace: true });
        setShouldRender(false);
        lastDecision.current = { path: currentStateKey, decision: "redirect-intro" };
        return;
      }
      setShouldRender(true);
      lastDecision.current = { path: currentStateKey, decision: "allow-public-unauth" };
      return;
    }

    // ===== EMAIL VERIFICATION REQUIRED (ONLY for email/password users) =====
    if (isAuthenticated && needsEmailVerification && !isEmailVerified) {
      if (isVerificationRoute) {
        setShouldRender(true);
        lastDecision.current = { path: currentStateKey, decision: "allow-verification" };
        return;
      }
      console.log("📧 Must verify email, redirecting to /verify-email");
      navigate("/verify-email", { replace: true, state: { email: user?.email, userId: user?.uid, fromSignup: true } });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "redirect-verify" };
      return;
    }

    // ===== PROFILE INCOMPLETE (only if email verified or not required) =====
    if (isAuthenticated && (!needsEmailVerification || isEmailVerified) && !isProfileComplete) {
      if (isSetupProfileRoute) {
        setShouldRender(true);
        lastDecision.current = { path: currentStateKey, decision: "allow-setup" };
        return;
      }
      console.log("👤 Profile incomplete, redirecting to /setup-profile");
      navigate("/setup-profile", { replace: true, state: { fromVerification: isVerificationRoute } });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "redirect-setup" };
      return;
    }

    // ===== PROFILE COMPLETE BUT ON SETUP‑PROFILE → redirect to home =====
    if (isAuthenticated && isEmailVerified && isProfileComplete && isSetupProfileRoute) {
      console.log("🏠 Profile complete, redirecting to /home");
      navigate("/home", { replace: true });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "redirect-home-from-setup" };
      return;
    }

    // ===== ALL CHECKS PASSED – render the requested component =====
    setShouldRender(true);
    lastDecision.current = { path: currentStateKey, decision: "allow" };
  }, [
    location.pathname,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    isPublicRoute,
    isVerificationRoute,
    isSetupProfileRoute,
    authInitialized,
    authLoading,
    isSignupInProgress,
    needsEmailVerification,
    user,
    navigate,
  ]);

  // Show a minimal loading spinner while auth is not ready
  if (!shouldRender) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {authLoading ? "Loading your profile..." : "Checking permissions..."}
          </p>
        </div>
      </div>
    );
  }

  return children;
}