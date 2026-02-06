// src/app/AppStateGuard.jsx - ULTIMATE FIXED VERSION - PERFECT FLOW
import React, { useEffect, useState, useMemo, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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
    securityChecks
  } = useAuth();
  
  const [isChecking, setIsChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);
  const [redirectTo, setRedirectTo] = useState(null);
  
  // Refs for tracking
  const lastDecision = useRef({ path: '', decision: null });
  const verificationChecked = useRef(false);

  // Public routes
  const publicRoutes = useMemo(() => [
    '/',
    '/intro', 
    '/login', 
    '/signup/step1', 
    '/signup/step2',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/otp-verification',
    '/setup-profile'
  ], []);
  
  // Verification allowed routes
  const verificationRoutes = useMemo(() => [
    '/verify-email',
    '/otp-verification'
  ], []);
  
  // Setup profile route
  const setupProfileRoute = '/setup-profile';
  
  // Determine route type
  const isPublicRoute = useMemo(() => {
    const path = location.pathname;
    return publicRoutes.some(route => path === route || path.startsWith(route));
  }, [location.pathname, publicRoutes]);
  
  const isVerificationRoute = useMemo(() => {
    const path = location.pathname;
    return verificationRoutes.some(route => path === route || path.startsWith(route));
  }, [location.pathname, verificationRoutes]);
  
  const isSetupProfileRoute = useMemo(() => 
    location.pathname === setupProfileRoute || location.pathname.startsWith(setupProfileRoute + '/'),
    [location.pathname]
  );

  // MAIN DECISION LOGIC
  useEffect(() => {
    // Skip if auth not initialized
    if (!authInitialized && location.pathname !== '/') {
      setIsChecking(true);
      return;
    }
    
    // Skip if we've already made this decision
    const currentStateKey = `${location.pathname}-${isAuthenticated}-${isEmailVerified}-${isProfileComplete}`;
    if (lastDecision.current.path === currentStateKey) {
      setIsChecking(false);
      return;
    }
    
    setIsChecking(true);
    setShouldRender(false);
    setRedirectTo(null);
    
    const timer = setTimeout(() => {
      console.log('🛡️ Route Guard Decision:', {
        path: location.pathname,
        isAuthenticated,
        isEmailVerified,
        isProfileComplete,
        isPublicRoute,
        isVerificationRoute,
        isSetupProfileRoute
      });
      
      // 1. SPLASH SCREEN - Always allow
      if (location.pathname === '/') {
        console.log("✅ Allowing splash screen");
        setShouldRender(true);
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: 'allow-splash' };
        return;
      }
      
      // 2. UNAUTHENTICATED user on PROTECTED route
      if (!isAuthenticated && !isPublicRoute) {
        console.log("🔒 Redirecting unauthenticated to /intro");
        setRedirectTo('/intro');
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: 'redirect-intro' };
        return;
      }
      
      // 3. AUTHENTICATED user on PUBLIC AUTH routes (except setup/verification)
      if (isAuthenticated && isPublicRoute && 
          !isVerificationRoute && !isSetupProfileRoute &&
          (location.pathname.includes('/login') || 
           location.pathname.includes('/signup') ||
           location.pathname.includes('/intro'))) {
        console.log("🔒 Redirecting authenticated away from auth pages");
        setRedirectTo('/home');
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: 'redirect-home' };
        return;
      }
      
      // 4. Handle EMAIL VERIFICATION flow
      if (isAuthenticated && !isEmailVerified) {
        // Allow verification routes
        if (isVerificationRoute) {
          console.log("✅ Allowing unverified user on verification route");
          setShouldRender(true);
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: 'allow-verification' };
          return;
        }
        // Redirect to verification for other routes
        else if (!isPublicRoute) {
          console.log("📧 Redirecting unverified user to /verify-email");
          setRedirectTo('/verify-email');
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: 'redirect-verify' };
          return;
        }
      }
      
      // 5. Handle PROFILE SETUP flow (CRITICAL FIX)
      if (isAuthenticated && isEmailVerified && !isProfileComplete) {
        // Allow setup profile route
        if (isSetupProfileRoute) {
          console.log("✅ Allowing incomplete profile on setup route");
          setShouldRender(true);
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: 'allow-setup' };
          return;
        }
        // Check if user just verified email - allow a moment for profile creation
        else if (location.state?.fromVerification) {
          console.log("⏳ User just verified, checking profile...");
          // Wait 1 second for profile check
          setTimeout(() => {
            if (!isProfileComplete) {
              console.log("👤 Redirecting to setup-profile after verification");
              navigate('/setup-profile', { replace: true });
            }
          }, 1000);
          setShouldRender(true);
          setIsChecking(false);
          return;
        }
        // Redirect to setup profile for other routes
        else {
          console.log("👤 Redirecting to /setup-profile for incomplete profile");
          setRedirectTo('/setup-profile');
          setIsChecking(false);
          lastDecision.current = { path: currentStateKey, decision: 'redirect-setup' };
          return;
        }
      }
      
      // 6. Profile complete but on setup route - redirect to home
      if (isAuthenticated && isEmailVerified && isProfileComplete && isSetupProfileRoute) {
        console.log("🏠 Redirecting complete profile away from setup");
        setRedirectTo('/home');
        setIsChecking(false);
        lastDecision.current = { path: currentStateKey, decision: 'redirect-home-from-setup' };
        return;
      }
      
      // 7. ALL CHECKS PASSED
      console.log("✅ All checks passed - Rendering content");
      setShouldRender(true);
      setIsChecking(false);
      lastDecision.current = { path: currentStateKey, decision: 'allow' };
      
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
    navigate
  ]);
  
  // Handle redirects
  useEffect(() => {
    if (redirectTo && redirectTo !== location.pathname) {
      console.log(`🔄 Redirecting to: ${redirectTo}`);
      navigate(redirectTo, { 
        replace: true,
        state: { from: location.pathname }
      });
    }
  }, [redirectTo, navigate, location.pathname]);
  
  // Reset decision on route change
  useEffect(() => {
    if (lastDecision.current.path !== location.pathname) {
      lastDecision.current = { path: '', decision: null };
    }
  }, [location.pathname]);
  
  // ========== RENDER LOGIC ==========
  
  // Show loading during check
  if (isChecking && !isPublicRoute && location.pathname !== '/') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Checking permissions...</p>
        </div>
      </div>
    );
  }
  
  // If we have a redirect, show nothing
  if (redirectTo && redirectTo !== location.pathname) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />
    );
  }
  
  // Render children
  if (shouldRender) {
    return children;
  }
  
  // Fallback
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />
  );
}