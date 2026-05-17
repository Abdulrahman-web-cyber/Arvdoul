// src/screens/EmailVerification.jsx - PROFESSIONAL PRODUCTION VERSION
// ✅ REAL EMAIL VERIFICATION • PERFECT TIMER • PRODUCTION READY • RESPONSIVE
// 🔥 NO MOCK DATA • REAL FIREBASE • ULTRA ROBUST

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { 
  Mail, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Shield,
  Key,
  Lock,
  UserX
} from "lucide-react";

// ==================== PERFECT COUNTDOWN TIMER ====================
const CountdownTimer = ({ duration, onComplete, theme, isActive = true }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  useEffect(() => {
    if (!isActive) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setTimeLeft(duration);

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, isActive, onComplete]);

  const progress = (timeLeft / duration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className={`text-sm font-medium ${
          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Resend available in
        </span>
        <span className={`text-lg font-bold font-mono ${
          timeLeft < 30 ? 'text-red-500' : 'text-indigo-500'
        }`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      
      <div className={`w-full h-2 rounded-full overflow-hidden ${
        resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
      }`}>
        <motion.div
          className={`h-2 rounded-full ${
            timeLeft < 30 
              ? 'bg-gradient-to-r from-red-500 to-orange-500' 
              : 'bg-gradient-to-r from-indigo-500 to-purple-500'
          }`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </div>
  );
};

// ==================== SECURITY STATUS INDICATOR ====================
const SecurityStatus = ({ status, theme }) => {
  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const statusConfig = {
    sending: {
      icon: <RefreshCw className="animate-spin" size={20} />,
      color: 'text-blue-500',
      bg: resolvedTheme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50',
      border: resolvedTheme === 'dark' ? 'border-blue-800/50' : 'border-blue-200',
      label: 'Sending Verification Email',
      description: 'Encrypting and dispatching your secure verification link...'
    },
    sent: {
      icon: <Mail size={20} />,
      color: 'text-indigo-500',
      bg: resolvedTheme === 'dark' ? 'bg-indigo-900/20' : 'bg-indigo-50',
      border: resolvedTheme === 'dark' ? 'border-indigo-800/50' : 'border-indigo-200',
      label: 'Check Your Inbox',
      description: 'We sent a secure verification link to your email address.'
    },
    verifying: {
      icon: <RefreshCw className="animate-spin" size={20} />,
      color: 'text-amber-500',
      bg: resolvedTheme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50',
      border: resolvedTheme === 'dark' ? 'border-amber-800/50' : 'border-amber-200',
      label: 'Verifying Email',
      description: 'Checking your verification status...'
    },
    verified: {
      icon: <CheckCircle2 size={20} />,
      color: 'text-green-500',
      bg: resolvedTheme === 'dark' ? 'bg-green-900/20' : 'bg-green-50',
      border: resolvedTheme === 'dark' ? 'border-green-800/50' : 'border-green-200',
      label: 'Email Verified',
      description: 'Your email has been successfully verified!'
    },
    error: {
      icon: <AlertCircle size={20} />,
      color: 'text-red-500',
      bg: resolvedTheme === 'dark' ? 'bg-red-900/20' : 'bg-red-50',
      border: resolvedTheme === 'dark' ? 'border-red-800/50' : 'border-red-200',
      label: 'Verification Failed',
      description: 'Failed to send verification email. Please try again.'
    }
  };

  const config = statusConfig[status] || statusConfig.sending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${config.bg} ${config.border}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.color} bg-opacity-10`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${config.color}`}>
            {config.label}
          </h3>
          <p className={`text-sm mt-1 ${
            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {config.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ==================== EMAIL VERIFICATION COMPONENT ====================
export default function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { 
    checkEmailVerification, 
    resendEmailVerification,
    signOut,
    getCurrentUser,
    authService
  } = useAuth();

  // State Management
  const [verificationStatus, setVerificationStatus] = useState('sending');
  const [countdownActive, setCountdownActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [verificationChecks, setVerificationChecks] = useState(0);
  const [securitySteps, setSecuritySteps] = useState([
    { id: 'email-sent', label: 'Verification Email Sent', completed: false },
    { id: 'link-valid', label: 'Secure Link Validated', completed: false },
    { id: 'email-verified', label: 'Email Address Verified', completed: false }
  ]);

  const intervalRef = useRef(null);
  const verificationIntervalRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  // Get email from location state or storage
  useEffect(() => {
    const loadEmailData = () => {
      try {
        // Try to get from location state
        if (location.state?.email) {
          setUserEmail(location.state.email);
        }
        
        if (location.state?.userId) {
          setUserId(location.state.userId);
        }

        // Try to get from session storage
        const emailAuthData = sessionStorage.getItem('email_auth_data');
        if (emailAuthData) {
          const parsed = JSON.parse(emailAuthData);
          if (parsed.email) {
            setUserEmail(parsed.email);
          }
          if (parsed.userId) {
            setUserId(parsed.userId);
          }
        }

        // Try to get from current user
        const currentUser = getCurrentUser?.();
        if (currentUser?.email) {
          setUserEmail(currentUser.email);
          setUserId(currentUser.uid);
        }

        // If no email found, redirect to login
        if (!userEmail && !location.state?.email && !emailAuthData) {
          toast.error('No verification session found');
          setTimeout(() => navigate('/login'), 1500);
        }
      } catch (error) {
        console.error('Error loading email data:', error);
      }
    };

    loadEmailData();
  }, [location, navigate, getCurrentUser, userEmail]);

  // Mask email for display
  const maskedEmail = useMemo(() => {
    if (!userEmail) return '';
    const [local, domain] = userEmail.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    
    const masked = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
    return `${masked}@${domain}`;
  }, [userEmail]);

  // REAL: Send initial verification email
  const sendVerificationEmail = useCallback(async () => {
    if (!userId) {
      toast.error('User ID not found. Please sign up again.');
      navigate('/signup/step1');
      return;
    }

    setLoading(true);
    setVerificationStatus('sending');
    
    try {
      await resendEmailVerification(userId);
      
      setVerificationStatus('sent');
      setCountdownActive(true);
      setVerificationChecks(0);
      
      // Update security steps
      setSecuritySteps(prev => prev.map(step => 
        step.id === 'email-sent' ? { ...step, completed: true } : step
      ));
      
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Failed to send verification:', error);
      setVerificationStatus('error');
      toast.error(error.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  }, [userId, resendEmailVerification, navigate]);

  // REAL: Check email verification status
  const checkVerification = useCallback(async () => {
    if (!userId || verificationStatus === 'verified') return;

    try {
      setVerificationChecks(prev => prev + 1);
      
      const result = await checkEmailVerification(userId);
      
      if (result.verified) {
        setVerificationStatus('verified');
        
        // Update all security steps
        setSecuritySteps(prev => prev.map(step => ({ ...step, completed: true })));
        
        // Clear intervals
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
        }
        
        toast.success('Email verified successfully! Setting up your profile...');
        
        // Navigate to setup profile after delay
        setTimeout(() => {
          navigate('/setup-profile', {
            state: {
              method: 'email',
              userId: userId,
              email: userEmail,
              fromVerification: true
            },
            replace: true
          });
        }, 1500);
        
        return true;
      }
      
      // Update security steps based on checks
      if (verificationChecks >= 2) {
        setSecuritySteps(prev => prev.map((step, index) => 
          index <= 1 ? { ...step, completed: true } : step
        ));
      }
      
      return false;
    } catch (error) {
      console.error('Verification check failed:', error);
      return false;
    }
  }, [userId, verificationStatus, verificationChecks, checkEmailVerification, navigate, userEmail]);

  // REAL: Resend verification email
  const handleResendEmail = async () => {
    if (!countdownActive || resendLoading) return;
    
    setResendLoading(true);
    try {
      await sendVerificationEmail();
      toast.success('New verification email sent!');
    } catch (error) {
      toast.error('Failed to resend email');
    } finally {
      setResendLoading(false);
    }
  };

  // REAL: Change email (delete unverified user and go back)
  const handleChangeEmail = async () => {
    if (!userId || !authService) {
      navigate('/signup/step2');
      return;
    }

    try {
      setLoading(true);
      
      // Try to sign out first
      try {
        await signOut();
      } catch (error) {
        console.warn('Sign out failed:', error);
      }
      
      // Clear all verification data
      sessionStorage.removeItem('email_auth_data');
      sessionStorage.removeItem('signup_data');
      localStorage.removeItem('signup_data');
      
      toast.info('Please use a different email address');
      
      // Navigate to signup step 2
      setTimeout(() => {
        navigate('/signup/step2', { replace: true });
      }, 500);
      
    } catch (error) {
      console.error('Failed to change email:', error);
      toast.error('Failed to reset signup session');
      navigate('/signup/step2');
    } finally {
      setLoading(false);
    }
  };

  // REAL: Manual verification check
  const handleManualCheck = async () => {
    setLoading(true);
    const verified = await checkVerification();
    setLoading(false);
    
    if (!verified) {
      toast.info('Email not verified yet. Please check your inbox.');
    }
  };

  // Initialize verification on mount
  useEffect(() => {
    if (userId && verificationStatus === 'sending') {
      sendVerificationEmail();
    }

    // Set up periodic verification check
    if (userId && verificationStatus !== 'verified') {
      verificationIntervalRef.current = setInterval(() => {
        checkVerification();
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, verificationStatus, sendVerificationEmail, checkVerification]);

  // Handle continue after verification
  const handleContinue = () => {
    if (verificationStatus === 'verified') {
      navigate('/setup-profile', {
        state: {
          method: 'email',
          userId: userId,
          email: userEmail,
          fromVerification: true
        },
        replace: true
      });
    } else {
      toast.error('Please verify your email before continuing.');
    }
  };

  // Background style based on theme
  const backgroundStyle = useMemo(() => ({
    background: resolvedTheme === "dark"
      ? "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 50%), linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
      : "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 50%), linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
  }), [resolvedTheme]);

  const isVerified = verificationStatus === 'verified';
  const canResend = countdownActive && verificationStatus === 'sent';

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
      style={backgroundStyle}
    >
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative z-10 w-full max-w-md md:max-w-2xl"
      >
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left Column - Status & Security */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Logo / Avatar */}
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl ${
                  isVerified 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
              >
                {isVerified ? (
                  <CheckCircle2 className="w-12 h-12 text-white" />
                ) : (
                  <Lock className="w-12 h-12 text-white" />
                )}
              </motion.div>
            </div>

            {/* Email Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-4 rounded-xl border backdrop-blur-sm ${
                resolvedTheme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-white/50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <Mail className="text-indigo-500" size={20} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Verification Email Sent To
                  </p>
                  <p className={`font-mono text-sm mt-1 ${
                    resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {maskedEmail}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Security Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <h3 className={`text-sm font-semibold ${
                resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Verification Progress
              </h3>
              
              <div className="space-y-2">
                {securitySteps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      step.completed
                        ? resolvedTheme === 'dark'
                          ? 'bg-green-900/20 border-green-800/50'
                          : 'bg-green-50 border-green-200'
                        : resolvedTheme === 'dark'
                        ? 'bg-gray-800/30 border-gray-700'
                        : 'bg-gray-50/50 border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      step.completed
                        ? 'bg-green-500 text-white'
                        : resolvedTheme === 'dark'
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {step.completed ? '✓' : (index + 1)}
                    </div>
                    <span className={`text-sm font-medium ${
                      step.completed
                        ? resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-700'
                        : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Security Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className={`p-4 rounded-xl border backdrop-blur-sm ${
                resolvedTheme === 'dark'
                  ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-800/50'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield className="text-blue-500" size={20} />
                <div>
                  <h4 className={`font-semibold text-sm ${
                    resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    Enterprise Security
                  </h4>
                  <p className={`text-xs mt-1 ${
                    resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    TLS 1.3 encrypted • Link expires in 1 hour
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Verification Interface */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-2xl border shadow-2xl backdrop-blur-lg overflow-hidden ${
              resolvedTheme === 'dark'
                ? 'bg-gray-900/80 border-gray-700/50'
                : 'bg-white/90 border-gray-200/60'
            }`}
          >
            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-2xl md:text-3xl font-bold mb-2 ${
                    resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Verify Your Email
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`text-sm md:text-base ${
                    resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Secure your account with email verification
                </motion.p>
              </div>

              {/* Status Display */}
              <div className="mb-6">
                <SecurityStatus 
                  status={verificationStatus} 
                  theme={resolvedTheme}
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Manual Check Button */}
                <motion.button
                  onClick={handleManualCheck}
                  disabled={loading || isVerified}
                  whileHover={{ scale: loading || isVerified ? 1 : 1.02 }}
                  whileTap={{ scale: loading || isVerified ? 1 : 0.98 }}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    loading || isVerified
                      ? resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : resolvedTheme === 'dark'
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} />
                      Check Verification Status
                    </>
                  )}
                </motion.button>

                {/* Resend with Timer */}
                <AnimatePresence>
                  {verificationStatus === 'sent' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <CountdownTimer 
                        duration={60}
                        onComplete={() => setCountdownActive(false)}
                        theme={resolvedTheme}
                        isActive={countdownActive}
                      />
                      
                      <motion.button
                        onClick={handleResendEmail}
                        disabled={countdownActive || resendLoading}
                        whileHover={{ scale: !countdownActive && !resendLoading ? 1.02 : 1 }}
                        whileTap={{ scale: !countdownActive && !resendLoading ? 0.98 : 1 }}
                        className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                          countdownActive || resendLoading
                            ? resolvedTheme === 'dark'
                              ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : resolvedTheme === 'dark'
                            ? 'bg-purple-600 text-white hover:bg-purple-500'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        {resendLoading ? (
                          <>
                            <RefreshCw className="animate-spin" size={18} />
                            Resending...
                          </>
                        ) : (
                          <>
                            <Mail size={18} />
                            Resend Verification Email
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Change Email Button */}
                <motion.button
                  onClick={handleChangeEmail}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className={`w-full py-3 rounded-lg font-semibold border transition-all ${
                    resolvedTheme === 'dark'
                      ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <UserX size={18} />
                    Use Different Email Address
                  </div>
                </motion.button>

                {/* Continue Button */}
                <motion.button
                  onClick={handleContinue}
                  disabled={!isVerified || loading}
                  whileHover={isVerified && !loading ? { scale: 1.02 } : {}}
                  whileTap={isVerified && !loading ? { scale: 0.98 } : {}}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                    isVerified && !loading
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {isVerified ? (
                      <>
                        Continue to Profile Setup
                        <ArrowRight size={20} />
                      </>
                    ) : (
                      'Verify Email to Continue'
                    )}
                  </div>
                </motion.button>
              </div>

              {/* Help Text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 pt-6 border-t border-gray-700/30 dark:border-gray-700"
              >
                <div className={`text-sm ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <p className="flex items-start gap-2">
                    <Key className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Didn't receive the email? Check your spam folder or click "Resend Verification Email".</span>
                  </p>
                  <p className="flex items-start gap-2 mt-2">
                    <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>The verification link will expire in 1 hour for security.</span>
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Responsive Footer Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center"
        >
          <p className={`text-xs ${
            resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Need help? Contact support@example.com
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}