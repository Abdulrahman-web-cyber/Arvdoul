// src/components/Shared/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, requireAuth = true, requireVerified = false }) {
  const location = useLocation();
  const { isAuthenticated, isEmailVerified, authInitialized } = useAuth();

  // If auth is still initializing on cold start, allow seamless render
  if (!authInitialized) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated and auth is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Redirect to verification page if verification is required but not verified
  if (requireAuth && requireVerified && !isEmailVerified) {
    return <Navigate to="/verify-email" state={{ from: location.pathname }} replace />;
  }

  // If all checks pass, render children
  return children;
}