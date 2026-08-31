// src/app/AppStateGuard.jsx - Resilient route guard and navigation coordinator
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    authInitialized,
    isSignupInProgress,
  } = useAuth();

  const [shouldRender, setShouldRender] = useState(false);
  const lastDecision = useRef({ path: "", decision: null });

  // Routes intended for non-authenticated guests or auth entry
  const authGuestRoutes = useMemo(
    () => [
      "/intro",
      "/login",
      "/signup/step1",
      "/signup/step2",
      "/forgot-password",
      "/reset-password",
    ],
    []
  );

  const verificationRoutes = useMemo(() => ["/verify-email", "/otp-verification"], []);
  const setupProfileRoute = "/setup-profile";

  const isSplashRoute = location.pathname === "/";
  const isAuthGuestRoute = useMemo(
    () => authGuestRoutes.some((route) => location.pathname === route || location.pathname.startsWith(route + "/")),
    [location.pathname, authGuestRoutes]
  );
  const isVerificationRoute = useMemo(
    () => verificationRoutes.some((route) => location.pathname === route || location.pathname.startsWith(route + "/")),
    [location.pathname, verificationRoutes]
  );
  const isSetupProfileRoute = useMemo(
    () => location.pathname === setupProfileRoute || location.pathname.startsWith(setupProfileRoute + "/"),
    [location.pathname]
  );

  // Safe check: Google and Phone providers are pre-verified
  const needsEmailVerification = useMemo(() => {
    if (!user) return false;
    const provider = (user.authProvider || '').toLowerCase();
    if (provider.includes('google') || provider.includes('phone') || provider.includes('apple')) {
      return false;
    }
    return (provider === 'email' || provider === 'password' || provider === 'unknown') && !!user.email && !user.emailVerified;
  }, [user]);

  useEffect(() => {
    // Splash screen handles its own timed transition
    if (isSplashRoute) {
      setShouldRender(true);
      return;
    }

    // Wait until auth is initialized before routing decisions
    if (!authInitialized || authLoading) {
      // If guest is on login/signup/intro before auth loads, let them see it immediately
      if (isAuthGuestRoute && !isAuthenticated) {
        setShouldRender(true);
        return;
      }
      setShouldRender(false);
      return;
    }

    const currentStateKey = `${location.pathname}-${isAuthenticated}-${isEmailVerified}-${isProfileComplete}-${isSignupInProgress}-${needsEmailVerification}`;

    // Prevent repeated navigation for the same identical state
    if (lastDecision.current.path === currentStateKey) {
      setShouldRender(true);
      return;
    }

    // ===== UNAUTHENTICATED USERS =====
    if (!isAuthenticated) {
      if (isAuthGuestRoute || isVerificationRoute || isSetupProfileRoute) {
        setShouldRender(true);
        lastDecision.current = { path: currentStateKey, decision: "allow-guest" };
        return;
      }
      console.log("🔒 Not authenticated, redirecting to /intro");
      navigate("/intro", { replace: true });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "redirect-intro" };
      return;
    }

    // ===== AUTHENTICATED: EMAIL VERIFICATION REQUIRED =====
    if (needsEmailVerification && !isEmailVerified) {
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

    // ===== AUTHENTICATED: PROFILE SETUP REQUIRED =====
    if (!isProfileComplete) {
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

    // ===== AUTHENTICATED & COMPLETE ON AUTH/GUEST/ONBOARDING ROUTES =====
    if (isAuthGuestRoute || isVerificationRoute || isSetupProfileRoute) {
      console.log("🏠 Authenticated and profile complete, redirecting to /home");
      const from = new URLSearchParams(window.location.search).get('from') || '/home';
      navigate(from, { replace: true });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "redirect-home" };
      return;
    }

    // ===== ALL CHECKS PASSED: PROTECTED ROUTE =====
    setShouldRender(true);
    lastDecision.current = { path: currentStateKey, decision: "allow" };
  }, [
    location.pathname,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    isSplashRoute,
    isAuthGuestRoute,
    isVerificationRoute,
    isSetupProfileRoute,
    authInitialized,
    authLoading,
    isSignupInProgress,
    needsEmailVerification,
    user,
    navigate,
  ]);

  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-600 dark:border-purple-400/20 dark:border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}