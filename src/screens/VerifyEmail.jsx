// src/screens/VerifyEmail.jsx - PRODUCTION READY FIXED VERSION
// ✅ Perfect deep link detection • Auto-redirects • Setup profile navigation

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState("checking"); // checking, pending, verified, failed
  const [countdown, setCountdown] = useState(60);
  const [userData, setUserData] = useState(null);
  const [isDeepLink, setIsDeepLink] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const [actionCodeProcessed, setActionCodeProcessed] = useState(false);
  
  const countdownRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const verificationAttempts = useRef(0);
  const maxAttempts = 30; // Increased for better user experience
  const isMounted = useRef(true);
  const deepLinkProcessed = useRef(false);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  // Check for deep link on mount
  useEffect(() => {
    const actionCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    
    console.log('📧 VerifyEmail mounted with params:', { actionCode, mode, userId, email });
    
    if (actionCode && mode === 'verifyEmail') {
      console.log('🔗 DEEP LINK DETECTED! Processing email verification link...');
      setIsDeepLink(true);
      setVerificationStatus("checking");
      
      // Process the deep link
      handleDeepLinkVerification(actionCode, userId, email);
    } else {
      // Regular email verification flow
      console.log('📧 Starting regular email verification flow');
      loadUserData();
    }
    
    return () => {
      isMounted.current = false;
      clearInterval(countdownRef.current);
      clearInterval(checkIntervalRef.current);
    };
  }, []);

  // Handle deep link verification
  const handleDeepLinkVerification = async (actionCode, userId, email) => {
    if (deepLinkProcessed.current) return;
    deepLinkProcessed.current = true;
    
    try {
      setLoading(true);
      console.log('🔗 Processing deep link verification with action code');
      
      // Handle the verification link
      const result = await auth.handleEmailVerificationLink(actionCode);
      
      if (result.success) {
        console.log('✅ Deep link verification successful:', result);
        
        if (result.user) {
          // We have user data, store it and navigate to setup profile
          setUserData(result.user);
          setVerificationStatus("verified");
          
          // Store verified user data
          sessionStorage.setItem('email_verified_user', JSON.stringify(result.user));
          sessionStorage.setItem('pending_profile_creation', JSON.stringify({
            userId: result.user.uid,
            method: 'email',
            timestamp: Date.now(),
            fromDeepLink: true
          }));
          
          toast.success('Email verified successfully!');
          
          // Navigate to setup profile after delay
          setTimeout(() => {
            navigate('/setup-profile', {
              state: {
                method: "email",
                userData: result.user,
                isNewUser: true,
                requiresProfileCompletion: true,
                fromDeepLink: true
              },
              replace: true
            });
          }, 2000);
        } else if (result.email) {
          // Email verified but no user data (user needs to sign in)
          setVerificationStatus("verified");
          toast.success('Email verified! Please sign in to continue.');
          
          // Store verification status
          sessionStorage.setItem('email_verified', result.email);
          
          // Navigate to login with verified email
          setTimeout(() => {
            navigate('/login', {
              state: {
                email: result.email,
                verified: true,
                message: 'Email verified! Please sign in.'
              },
              replace: true
            });
          }, 2000);
        }
      } else {
        throw new Error(result.message || 'Verification failed');
      }
      
    } catch (error) {
      console.error('❌ Deep link verification failed:', error);
      setVerificationStatus("failed");
      
      let errorMessage = error.message || 'Failed to verify email';
      
      if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Verification link is invalid or has expired.';
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Verification link has expired. Please request a new one.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found for this verification link.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setActionCodeProcessed(true);
    }
  };

  // Load user data from session storage or location state
  const loadUserData = () => {
    try {
      // Try to get data from location state first
      if (location.state) {
        const { userId, userEmail, method, step1Data } = location.state;
        if (userId || userEmail) {
          setUserData({
            userId,
            email: userEmail,
            method,
            step1Data,
            source: 'location_state'
          });
          console.log("✅ Loaded user data from location state");
          
          // Start verification check
          if (userId) {
            startVerificationChecking(userId);
          }
          return;
        }
      }

      // Try to get data from session storage
      const emailVerificationData = sessionStorage.getItem('email_verification_data');
      const signupData = sessionStorage.getItem('signup_data');
      const pendingVerification = sessionStorage.getItem('pending_verification');
      
      if (emailVerificationData) {
        const parsed = JSON.parse(emailVerificationData);
        setUserData({
          userId: parsed.userId,
          email: parsed.email,
          displayName: parsed.displayName,
          requiresEmailVerification: parsed.requiresEmailVerification,
          source: 'email_verification_data'
        });
        console.log("✅ Loaded user data from email_verification_data");
        startVerificationChecking(parsed.userId);
      } else if (signupData) {
        const parsed = JSON.parse(signupData);
        if (parsed.email && parsed.authProvider === 'email') {
          setUserData({
            userId: parsed.userId,
            email: parsed.email,
            method: 'email',
            step1Data: parsed,
            source: 'signup_data'
          });
          console.log("✅ Loaded user data from signup_data");
          if (parsed.userId) {
            startVerificationChecking(parsed.userId);
          }
        }
      } else if (pendingVerification) {
        const parsed = JSON.parse(pendingVerification);
        setUserData({
          userId: parsed.userId,
          email: parsed.email,
          source: 'pending_verification'
        });
        console.log("✅ Loaded user data from pending_verification");
        startVerificationChecking(parsed.userId);
      } else {
        console.warn("❌ No user data found for email verification");
        setVerificationStatus("failed");
        setLoading(false);
        toast.error("Session expired. Please sign up again.");
        setTimeout(() => navigate("/signup/step1"), 3000);
      }
    } catch (error) {
      console.error("❌ Failed to load user data:", error);
      setVerificationStatus("failed");
      setLoading(false);
      toast.error("Failed to load verification data");
    }
  };

  // Start automatic verification checking
  const startVerificationChecking = (userId) => {
    if (!userId) {
      setVerificationStatus("failed");
      setLoading(false);
      return;
    }

    // Check immediately
    checkEmailVerification(userId);

    // Then check every 3 seconds
    checkIntervalRef.current = setInterval(() => {
      if (verificationAttempts.current < maxAttempts && autoChecking && verificationStatus !== "verified") {
        checkEmailVerification(userId);
      } else if (verificationAttempts.current >= maxAttempts) {
        clearInterval(checkIntervalRef.current);
        if (verificationStatus !== "verified") {
          setVerificationStatus("pending");
          toast.info("Verification taking longer than expected. Please check your email.");
        }
      }
    }, 3000);
  };

  // Check email verification status
  const checkEmailVerification = async (userId) => {
    if (!userId || verificationStatus === "verified" || actionCodeProcessed) {
      return;
    }

    try {
      setLoading(true);
      setVerificationStatus("checking");
      
      console.log(`📧 Checking email verification (attempt ${verificationAttempts.current + 1}/${maxAttempts})`);
      
      const result = await auth.checkEmailVerification(userId);
      
      verificationAttempts.current++;
      
      if (result.verified) {
        console.log("✅ Email verified!");
        setVerificationStatus("verified");
        
        // Store user data
        if (result.user) {
          setUserData(result.user);
          
          // Store for profile completion
          sessionStorage.setItem('email_verified_user', JSON.stringify(result.user));
          sessionStorage.setItem('pending_profile_creation', JSON.stringify({
            userId: result.user.uid,
            method: 'email',
            timestamp: Date.now()
          }));
        }
        
        // Clear intervals
        clearInterval(checkIntervalRef.current);
        setAutoChecking(false);
        
        toast.success('Email verified successfully!');
        
        // Navigate to setup profile after delay
        setTimeout(() => {
          navigate('/setup-profile', {
            state: {
              method: "email",
              userData: result.user || userData,
              isNewUser: true,
              requiresProfileCompletion: true
            },
            replace: true
          });
        }, 1500);
        
      } else {
        setVerificationStatus("pending");
        console.log(`⏳ Email not verified yet (attempt ${verificationAttempts.current}/${maxAttempts})`);
        
        // Show progress
        if (verificationAttempts.current % 5 === 0) {
          toast.info(`Still checking... (${verificationAttempts.current}/${maxAttempts} attempts)`);
        }
      }
      
    } catch (error) {
      console.error("❌ Email verification check failed:", error);
      setVerificationStatus("pending");
      
      if (verificationAttempts.current >= maxAttempts) {
        toast.error("Verification timeout. Please try again or resend the email.");
        clearInterval(checkIntervalRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0 && verificationStatus === "pending") {
      countdownRef.current = setTimeout(() => {
        if (isMounted.current) {
          setCountdown(countdown - 1);
        }
      }, 1000);
    }

    return () => {
      clearTimeout(countdownRef.current);
    };
  }, [countdown, verificationStatus]);

  // Resend verification email
  const resendVerification = async () => {
    if (!userData?.userId || countdown > 0) return;

    try {
      setLoading(true);
      
      await auth.resendEmailVerification(userData.userId);
      
      setCountdown(60);
      verificationAttempts.current = 0;
      setAutoChecking(true);
      
      toast.success("Verification email sent!");
      
      // Restart checking
      startVerificationChecking(userData.userId);
      
    } catch (error) {
      console.error("❌ Failed to resend verification:", error);
      toast.error(error.message || "Failed to resend verification");
    } finally {
      setLoading(false);
    }
  };

  // Manual check
  const handleManualCheck = () => {
    if (!userData?.userId) return;
    
    verificationAttempts.current = 0;
    setAutoChecking(true);
    checkEmailVerification(userData.userId);
  };

  // Handle setup profile button (for verified users)
  const handleSetupProfile = () => {
    const emailVerifiedUser = sessionStorage.getItem('email_verified_user');
    
    if (emailVerifiedUser) {
      const user = JSON.parse(emailVerifiedUser);
      
      navigate("/setup-profile", {
        state: {
          method: "email",
          userData: user,
          isNewUser: true,
          requiresProfileCompletion: true
        },
        replace: true
      });
    } else if (userData) {
      checkEmailVerification(userData.userId);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("❌ Failed to sign out:", error);
    }
  };

  // Render loading state
  if (loading && verificationStatus === "checking") {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        resolvedTheme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 to-black' 
          : 'bg-gradient-to-br from-gray-100 to-gray-300'
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-lg ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            {isDeepLink ? 'Verifying email...' : 'Checking verification...'}
          </p>
          <p className={`text-sm mt-2 ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
            Attempt {verificationAttempts.current + 1} of {maxAttempts}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      resolvedTheme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 to-black' 
        : 'bg-gradient-to-br from-gray-100 to-gray-300'
    }`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative w-full max-w-md mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl border backdrop-blur-xl shadow-2xl p-6 sm:p-8 ${
            resolvedTheme === 'dark'
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/95 border-gray-200/50'
          }`}
        >
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                verificationStatus === "verified" 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : verificationStatus === "checking"
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : verificationStatus === "failed"
                  ? 'bg-gradient-to-r from-red-500 to-pink-500'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}>
                {verificationStatus === "verified" ? (
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : verificationStatus === "checking" ? (
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : verificationStatus === "failed" ? (
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              
              {verificationStatus === "checking" && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>

            <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${
              resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {verificationStatus === "verified" ? "Email Verified!" : 
               verificationStatus === "checking" ? "Checking Verification..." :
               verificationStatus === "failed" ? "Verification Failed" :
               "Verify Your Email"}
            </h1>
            
            <p className={`text-sm sm:text-base ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {verificationStatus === "verified" ? "Your email has been successfully verified!" :
               verificationStatus === "checking" ? "Checking your verification status..." :
               verificationStatus === "failed" ? "Unable to verify your email. Please try again." :
               isDeepLink ? "Processing your verification link..." :
               "We sent a verification link to your email"}
            </p>
          </div>

          {/* User Info */}
          {userData?.email && (
            <div className={`mb-6 p-4 rounded-lg ${
              resolvedTheme === 'dark'
                ? 'bg-gray-800/50 border border-gray-700/50'
                : 'bg-gray-100/80 border border-gray-300/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {userData.email[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${
                    resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-800'
                  }`}>
                    {userData.email}
                  </p>
                  <p className={`text-xs ${
                    resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                  }`}>
                    {userData.displayName || "New User"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions for pending verification */}
          {verificationStatus === "pending" && (
            <div className="space-y-4 mb-8">
              <div className={`p-4 rounded-lg ${
                resolvedTheme === 'dark'
                  ? 'bg-blue-900/20 border border-blue-800/50'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                      Check your inbox
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      We've sent a verification email to your address. Click the link in the email to verify your account.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Open your email client (Gmail, Outlook, etc.)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Find our email (check spam folder too)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Click the verification link in the email
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Come back here to continue
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Auto-checking indicator */}
          {verificationStatus === "pending" && autoChecking && (
            <div className={`mb-6 p-3 rounded-lg ${
              resolvedTheme === 'dark'
                ? 'bg-gray-800/50 border border-gray-700/50'
                : 'bg-gray-100/80 border border-gray-300/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Auto-checking for verification...
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  Attempt {verificationAttempts.current}/{maxAttempts}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            {verificationStatus === "verified" ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSetupProfile}
                  className={`w-full py-4 rounded-xl font-bold text-base shadow-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-xl`}
                >
                  Continue to Profile Setup
                </motion.button>
                
                <button
                  onClick={() => navigate("/home")}
                  className={`w-full py-3 rounded-lg text-sm font-medium ${
                    resolvedTheme === 'dark'
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Go to Dashboard
                </button>
              </>
            ) : verificationStatus === "failed" ? (
              <div className="space-y-4">
                <button
                  onClick={() => navigate("/signup/step1")}
                  className={`w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-red-500 to-pink-500 text-white`}
                >
                  Start Over
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className={`w-full py-3 rounded-lg text-sm font-medium ${
                    resolvedTheme === 'dark'
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualCheck}
                    disabled={loading}
                    className={`py-3 rounded-lg font-medium text-sm ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                    }`}
                  >
                    Check Now
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resendVerification}
                    disabled={loading || countdown > 0}
                    className={`py-3 rounded-lg font-medium text-sm ${
                      countdown > 0 || loading
                        ? resolvedTheme === 'dark'
                          ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-md'
                    }`}
                  >
                    {countdown > 0 ? `Resend (${countdown}s)` : "Resend Email"}
                  </motion.button>
                </div>
                
                {verificationStatus === "pending" && (
                  <button
                    onClick={handleManualCheck}
                    disabled={loading}
                    className={`w-full py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'text-blue-400 hover:text-blue-300 disabled:opacity-50'
                        : 'text-blue-600 hover:text-blue-500 disabled:opacity-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Check for verification manually
                  </button>
                )}
              </>
            )}
          </div>

          {/* Troubleshooting */}
          {verificationStatus === "pending" && (
            <div className={`mt-8 pt-6 border-t ${
              resolvedTheme === 'dark' ? 'border-gray-800' : 'border-gray-300'
            }`}>
              <div className="space-y-3">
                <h3 className={`font-medium text-sm ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Didn't receive the email?
                </h3>
                
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5" />
                    <span className={resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>
                      Check your spam or junk folder
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5" />
                    <span className={resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>
                      Ensure you entered the correct email
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5" />
                    <span className={resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>
                      Wait a few minutes and try again
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5" />
                    <span className={resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>
                      Click "Resend Email" above
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Back/Sign Out */}
          <div className={`mt-8 pt-6 ${
            resolvedTheme === 'dark' ? 'border-t border-gray-800' : 'border-t border-gray-300'
          }`}>
            <button
              onClick={handleSignOut}
              disabled={loading}
              className={`w-full text-sm font-medium flex items-center justify-center gap-2 ${
                resolvedTheme === 'dark'
                  ? 'text-red-400 hover:text-red-300 disabled:opacity-50'
                  : 'text-red-600 hover:text-red-500 disabled:opacity-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </motion.div>

        {/* Security Footer */}
        <div className="mt-6 text-center">
          <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            🔒 Secure email verification • Your data is protected
          </p>
        </div>
      </motion.div>
    </div>
  );
}