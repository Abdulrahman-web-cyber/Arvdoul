\/\/ src/components/Shared/ProtectedRoute.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, AlertCircle } from 'lucide-react';

export default function ProtectedRoute({ children, requireAuth = true, requireVerified = false }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isVerified, setIsVerified] = useState(null);
  const [loading, setLoading] = useState(true);
  const [securityCheck, setSecurityCheck] = useState(false);

  \/\/ Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        \/\/ Check if user is logged in (simulate - replace with your actual auth check)
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
          setIsAuthenticated(true);
          
          \/\/ Parse user data
          const user = JSON.parse(userData);
          
          \/\/ Check if email is verified (if required)
          if (requireVerified) {
            const isEmailVerified = user.emailVerified || localStorage.getItem('email_verified') === 'true';
            setIsVerified(isEmailVerified);
          } else {
            setIsVerified(true);
          }
          
          \/\/ Additional security check
          const lastActivity = localStorage.getItem('last_activity');
          const now = Date.now();
          
          if (lastActivity && (now - parseInt(lastActivity)) > 30 * 60 * 1000) {
            \/\/ Session expired (30 minutes)
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            setIsAuthenticated(false);
          } else {
            \/\/ Update last activity
            localStorage.setItem('last_activity', now.toString());
          }
        } else {
          setIsAuthenticated(false);
          setIsVerified(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        setIsVerified(false);
      } finally {
        setSecurityCheck(true);
        setLoading(false);
      }
    };

    checkAuth();
    
    \/\/ Set up activity tracker
    const updateActivity = () => {
      localStorage.setItem('last_activity', Date.now().toString());
    };
    
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('scroll', updateActivity);
    
    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [requireVerified]);

  \/\/ Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-600 dark:text-gray-400">Checking security permissions...</p>
        </div>
      </div>
    );
  }

  \/\/ Redirect to login if not authenticated and auth is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  \/\/ Redirect to verification page if verification is required but not verified
  if (requireAuth && requireVerified && !isVerified) {
    return <Navigate to="/email-verification" state={{ from: location.pathname }} replace />;
  }

  \/\/ Show security warning if security check failed
  if (securityCheck && !isAuthenticated && requireAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Security Alert
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your session has expired or is invalid. Please log in again to continue.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
            >
              Go to Login
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  \/\/ If all checks pass, render children
  return children;
}