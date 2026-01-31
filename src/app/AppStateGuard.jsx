// src/app/AppStateGuard.jsx - SIMPLIFIED & FIXED
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const { 
    user, 
    userProfile,
    loading: authLoading, 
    isAuthenticated,
    isEmailVerified,
    authInitialized
  } = useAuth();
  
  const [isChecking, setIsChecking] = useState(true);
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/intro', 
    '/login', 
    '/signup/step1', 
    '/signup/step2',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/otp-verification'
  ];
  
  useEffect(() => {
    // Skip checking if we're on the splash screen
    if (location.pathname === '/') {
      setIsChecking(false);
      return;
    }
    
    if (authLoading || !authInitialized) {
      return;
    }
    
    const currentPath = location.pathname;
    const isPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));
    
    // Case 1: Unauthenticated user trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      console.log("🔒 Redirecting to login: Not authenticated");
    }
    
    // Case 2: Authenticated user trying to access auth pages
    if (isAuthenticated && isPublicRoute && 
        (currentPath.includes('/login') || currentPath.includes('/signup') || currentPath === '/intro')) {
      console.log("🔒 Redirecting to home: Already authenticated");
    }
    
    setIsChecking(false);
  }, [authLoading, authInitialized, isAuthenticated, location.pathname]);
  
  // Show loading while checking (except for splash screen)
  if (location.pathname !== '/' && (authLoading || !authInitialized || isChecking)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  // Skip guard logic for splash screen
  if (location.pathname === '/') {
    return children;
  }
  
  const currentPath = location.pathname;
  const isPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));
  
  // Redirect logic
  if (!isAuthenticated && !isPublicRoute) {
    return <Navigate to="/intro" state={{ from: location.pathname }} replace />;
  }
  
  if (isAuthenticated && isPublicRoute && 
      (currentPath.includes('/login') || currentPath.includes('/signup') || currentPath === '/intro')) {
    return <Navigate to="/home" replace />;
  }
  
  // Email verification check (optional)
  if (isAuthenticated && user?.email && !isEmailVerified && 
      !currentPath.includes('/verify-email') && !isPublicRoute) {
    return <Navigate to="/verify-email" replace />;
  }
  
  // Profile completion check (optional)
  if (isAuthenticated && userProfile && !userProfile.isProfileComplete && 
      !currentPath.includes('/setup-profile') && !isPublicRoute) {
    return <Navigate to="/setup-profile" replace />;
  }
  
  // All checks passed
  return children;
}