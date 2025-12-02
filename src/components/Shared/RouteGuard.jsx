// src/components/Shared/RouteGuard.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, AlertTriangle } from 'lucide-react';

// Route configuration for security levels
const ROUTE_SECURITY_LEVELS = {
  // Public routes
  '/': { authRequired: false, title: 'Welcome' },
  '/intro': { authRequired: false, title: 'Introduction' },
  '/login': { authRequired: false, title: 'Login' },
  '/forgot-password': { authRequired: false, title: 'Reset Password' },
  '/reset-password': { authRequired: false, title: 'Set New Password' },
  '/email-password-reset': { authRequired: false, title: 'Email Password Reset' },
  '/reset-otp-verification': { authRequired: false, title: 'Verify OTP' },
  
  // Signup routes (using SignupContext)
  '/signup/step1': { authRequired: false, title: 'Sign Up - Step 1' },
  '/signup/step2': { authRequired: false, title: 'Sign Up - Step 2' },
  '/otp-verification': { authRequired: false, title: 'Verify OTP' },
  '/email-verification': { authRequired: false, title: 'Verify Email' },
  '/set-password': { authRequired: false, title: 'Set Password' },
  '/setup-profile': { authRequired: false, title: 'Setup Profile' },
  
  // Protected routes (require authentication)
  '/home': { authRequired: true, title: 'Home' },
  '/messages': { authRequired: true, title: 'Messages' },
  '/reels': { authRequired: true, title: 'Reels' },
  '/videos': { authRequired: true, title: 'Videos' },
  '/post/:id': { authRequired: true, title: 'Post' },
  
  // Admin routes (additional security)
  '/admin': { authRequired: true, adminRequired: true, title: 'Admin' },
};

export default function RouteGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [securityCheck, setSecurityCheck] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [securityMessage, setSecurityMessage] = useState('');
  const [previousPath, setPreviousPath] = useState('');

  // Get current route configuration
  const currentRoute = ROUTE_SECURITY_LEVELS[location.pathname] || { 
    authRequired: false, 
    title: 'Arvdoul' 
  };

  // Security validation
  useEffect(() => {
    const validateAccess = async () => {
      setSecurityCheck(false);
      
      try {
        // Get authentication state
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        const isAuthenticated = !!(token && userData);
        
        // Check if route requires authentication
        if (currentRoute.authRequired && !isAuthenticated) {
          setIsAuthorized(false);
          setSecurityMessage('Authentication required to access this page.');
          return;
        }
        
        // Check admin access if required
        if (currentRoute.adminRequired) {
          const user = JSON.parse(userData || '{}');
          const isAdmin = user.role === 'admin' || user.isAdmin === true;
          
          if (!isAdmin) {
            setIsAuthorized(false);
            setSecurityMessage('Administrator privileges required.');
            return;
          }
        }
        
        // Check session expiry
        const lastActivity = localStorage.getItem('last_activity');
        if (lastActivity) {
          const now = Date.now();
          const timeSinceActivity = now - parseInt(lastActivity);
          
          if (timeSinceActivity > 30 * 60 * 1000) { // 30 minutes
            // Session expired
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            setIsAuthorized(false);
            setSecurityMessage('Your session has expired. Please log in again.');
            return;
          }
          
          // Update activity timestamp
          localStorage.setItem('last_activity', now.toString());
        }
        
        // Update document title
        document.title = `${currentRoute.title} • Arvdoul`;
        
        setIsAuthorized(true);
        setPreviousPath(location.pathname);
        
      } catch (error) {
        console.error('Security validation error:', error);
        setIsAuthorized(false);
        setSecurityMessage('Security validation failed. Please try again.');
      } finally {
        setSecurityCheck(true);
      }
    };

    validateAccess();
  }, [location.pathname, currentRoute]);

  // Handle unauthorized access
  if (!isAuthorized && securityCheck) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
              <p className="text-red-100 mt-2">Security protocol activated</p>
            </div>
            
            {/* Content */}
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <Lock className="w-12 h-12 text-gray-400" />
                  <AlertTriangle className="w-6 h-6 text-red-500 absolute -top-2 -right-2" />
                </div>
              </div>
              
              <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-4">
                Unauthorized Access Attempt
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                {securityMessage}
              </p>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                      Security Notice
                    </h4>
                    <p className="text-yellow-700 dark:text-yellow-400 text-xs">
                      All access attempts are logged for security monitoring.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login', { state: { from: location.pathname } })}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
                >
                  Go to Login
                </button>
                
                <button
                  onClick={() => navigate(previousPath || '/')}
                  className="w-full py-3 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Incident ID: {Date.now().toString(36).toUpperCase()}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show loading during security check
  if (!securityCheck) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4 relative"
          >
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="absolute inset-4 border-2 border-purple-500 border-b-transparent rounded-full"
            />
          </motion.div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Verifying security permissions...</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Route: {location.pathname}</p>
        </div>
      </div>
    );
  }

  // Render children with route transition animation
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.