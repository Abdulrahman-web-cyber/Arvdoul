// src/screens/EmailVerification.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowRight, Shield, X, Clock, Lock, UserCheck } from "lucide-react";

// Security Shield Component (Reduced Size)
const SecurityShield = ({ status }) => {
  const getShieldConfig = () => {
    switch (status) {
      case 'sending':
        return { 
          icon: <RefreshCw className="animate-spin" size={20} />,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30'
        };
      case 'sent':
        return { 
          icon: <Mail size={20} />,
          color: 'text-indigo-500',
          bg: 'bg-indigo-500/10',
          border: 'border-indigo-500/30'
        };
      case 'verifying':
        return { 
          icon: <RefreshCw className="animate-spin" size={20} />,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30'
        };
      case 'verified':
        return { 
          icon: <CheckCircle2 size={20} />,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30'
        };
      case 'error':
        return { 
          icon: <AlertCircle size={20} />,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30'
        };
      default:
        return { 
          icon: <Shield size={20} />,
          color: 'text-gray-500',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30'
        };
    }
  };

  const config = getShieldConfig();

  return (
    <motion.div
      className={`relative rounded-full p-5 border-2 ${config.bg} ${config.border} transition-all duration-500`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="w-16 h-16 flex items-center justify-center">
        <div className={config.color}>
          {config.icon}
        </div>
      </div>
      <div className={`text-xs font-semibold ${config.color} text-center mt-2`}>
        {status === 'sending' && 'Sending...'}
        {status === 'sent' && 'Email Sent'}
        {status === 'verifying' && 'Verifying...'}
        {status === 'verified' && 'Verified'}
        {status === 'error' && 'Error'}
      </div>
    </motion.div>
  );
};

// Perfect Countdown Timer Component
const CountdownTimer = ({ duration = 60, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsActive(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onComplete]);

  const progress = (timeLeft / duration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Resend available in:
        </span>
        <span className={`text-base font-bold flex items-center gap-1 ${
          timeLeft < 10 ? 'text-red-500' : 'text-indigo-500'
        }`}>
          <Clock size={14} />
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        <motion.div
          className={`h-1.5 rounded-full ${
            timeLeft < 10 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 
            'bg-gradient-to-r from-indigo-500 to-purple-500'
          }`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
};

// Verification Steps Component
const VerificationSteps = ({ steps, theme }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-center text-gray-900 dark:text-white uppercase tracking-wider">
      Verification Progress
    </h3>
    
    <div className="space-y-2">
      {steps.map((step, index) => (
        <motion.div
          key={step.key}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + index * 0.1 }}
          className={`flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
            step.completed
              ? theme === 'dark'
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-green-50 border-green-200'
              : theme === 'dark'
              ? 'bg-gray-800/30 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
            step.completed 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {step.completed ? '✓' : step.icon}
          </div>
          <span className={`text-xs font-medium ${
            step.completed
              ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {step.label}
          </span>
        </motion.div>
      ))}
    </div>
  </div>
);

// Main Component
export default function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { 
    user, 
    checkEmailVerification, 
    resendEmailVerification, 
    signOut,
    loading: authLoading 
  } = useAuth();

  const [verificationStatus, setVerificationStatus] = useState('sent');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);

  const verificationIntervalRef = useRef(null);
  const isMounted = useRef(true);

  // Get email and userId from location state or user context
  useEffect(() => {
    const stateEmail = location.state?.email || user?.email;
    const stateUserId = location.state?.userId || user?.uid;
    
    if (stateEmail) {
      setEmail(stateEmail);
    } else {
      toast.error("No email found. Please sign up again.");
      navigate("/signup/step1");
      return;
    }
    
    if (stateUserId) {
      setUserId(stateUserId);
    }
    
    // Start checking verification status immediately
    startVerificationCheck();
  }, [location.state, user, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
        verificationIntervalRef.current = null;
      }
    };
  }, []);

  // Send verification email ONLY when user clicks resend
  const sendVerificationEmail = useCallback(async () => {
    if (!userId || !email) {
      toast.error("Missing user information. Please try again.");
      navigate("/signup/step1");
      return;
    }

    setLoading(true);
    setVerificationStatus('sending');

    try {
      await resendEmailVerification(userId);
      
      if (isMounted.current) {
        setVerificationStatus('sent');
        setResendCooldown(60);
        setCanResend(false);
        setVerificationAttempts(prev => prev + 1);
      }
      
      toast.success("Verification email resent successfully!");
      
    } catch (error) {
      console.error("Email verification error:", error);
      
      if (isMounted.current) {
        setVerificationStatus('error');
      }
      
      let message = "Failed to send verification email.";
      if (error.code === 'auth/too-many-requests') {
        message = "Too many attempts. Please try again in 5 minutes.";
        setResendCooldown(300); // 5 minutes cooldown
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error. Please check your connection.";
      } else if (error.code === 'auth/requires-recent-login') {
        message = "Session expired. Please sign in again.";
      }
      
      toast.error(message);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [userId, email, resendEmailVerification, navigate]);

  // Check verification status
  const checkVerification = useCallback(async () => {
    if (!userId || !isMounted.current) return false;

    try {
      const result = await checkEmailVerification(userId);
      
      if (result.verified) {
        if (isMounted.current) {
          setVerificationStatus('verified');
          setIsCheckingVerification(false);
        }
        
        // Clear interval when verified
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
          verificationIntervalRef.current = null;
        }
        
        toast.success("Email verified successfully! Setting up your profile...");
        
        // Navigate to setup profile after verification
        setTimeout(() => {
          navigate("/setup-profile", { 
            state: {
              email: email,
              userId: userId,
              method: 'email',
              isNewUser: true,
              requiresProfileCompletion: true
            },
            replace: true 
          });
        }, 1000);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking verification:", error);
      return false;
    }
  }, [userId, email, checkEmailVerification, navigate]);

  // Start periodic verification check
  const startVerificationCheck = useCallback(() => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
    }

    // Check immediately
    checkVerification();
    
    // Then check every 5 seconds
    verificationIntervalRef.current = setInterval(() => {
      if (isMounted.current) {
        checkVerification();
      }
    }, 5000);
  }, [checkVerification]);

  // Handle manual verification check
  const handleManualCheck = async () => {
    setLoading(true);
    const isVerified = await checkVerification();
    setLoading(false);
    
    if (!isVerified) {
      toast.info("Email not verified yet. Please check your inbox.");
    }
  };

  // Handle resend verification email
  const handleResendEmail = async () => {
    if (!canResend) return;
    await sendVerificationEmail();
  };

  // Handle continue to profile setup
  const handleContinue = async () => {
    if (verificationStatus === 'verified') {
      navigate("/setup-profile", { 
        state: {
          email: email,
          userId: userId,
          method: 'email',
          isNewUser: true,
          requiresProfileCompletion: true
        },
        replace: true 
      });
    } else {
      const isVerified = await checkVerification();
      if (!isVerified) {
        toast.error("Please verify your email before continuing.");
      }
    }
  };

  // Handle change email - delete unverified user and go back to signup
  const handleChangeEmail = async () => {
    if (window.confirm("Are you sure you want to use a different email? This will cancel your current signup.")) {
      try {
        setLoading(true);
        
        // Delete unverified user from Firebase
        if (userId) {
          const { getAuth, deleteUser } = await import('firebase/auth');
          const auth = getAuth();
          const currentUser = auth.currentUser;
          
          if (currentUser) {
            try {
              // Sign out first
              await signOut();
              
              // Try to delete user
              await deleteUser(currentUser);
              console.log("Unverified user deleted:", userId);
            } catch (deleteError) {
              console.warn("Could not delete user:", deleteError);
            }
          }
        }

        // Clear all signup data
        sessionStorage.removeItem('signup_step1');
        sessionStorage.removeItem('signup_data');
        sessionStorage.removeItem('email_auth_data');
        sessionStorage.removeItem('email_verification_data');
        
        toast.info("Please sign up again with your new email.");
        
        // Navigate back to signup step 2
        navigate("/signup/step2", { replace: true });
        
      } catch (error) {
        console.error("Error changing email:", error);
        toast.error("Failed to change email. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle cooldown timer completion
  const handleCooldownComplete = () => {
    setCanResend(true);
  };

  // Handle cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) {
      handleCooldownComplete();
      return;
    }

    const timer = setTimeout(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Stop checking verification when component unmounts or email is verified
  useEffect(() => {
    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, []);

  // Verification steps
  const verificationSteps = useMemo(() => [
    { 
      key: 'emailValid', 
      label: 'Email Validated', 
      icon: '✓',
      completed: !!email 
    },
    { 
      key: 'emailSent', 
      label: 'Email Sent', 
      icon: '📨',
      completed: verificationStatus === 'sent' || verificationStatus === 'verified' 
    },
    { 
      key: 'linkClicked', 
      label: 'Link Clicked', 
      icon: '🔗',
      completed: verificationStatus === 'verifying' || verificationStatus === 'verified' 
    },
    { 
      key: 'verificationComplete', 
      label: 'Verified', 
      icon: '✅',
      completed: verificationStatus === 'verified' 
    }
  ], [email, verificationStatus]);

  const isVerified = verificationStatus === 'verified';
  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 via-gray-800 to-gray-950">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${
            resolvedTheme === 'dark' ? '#4f46e5' : '#6366f1'
          } 2px, transparent 2px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
        className="relative z-10 w-full max-w-5xl"
      >
        {/* Header with Perfect Circular Logo */}
        <div className="flex justify-center mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-xl">
              <img 
                src={resolvedTheme === "dark" ? "/logo/logo-dark.png" : "/logo/logo-light.png"} 
                alt="Arvdoul Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg">
                      A
                    </div>
                  `;
                }}
              />
            </div>
            <div className="mt-3 text-center">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Arvdoul
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Secure Account Verification
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left Column - Status & Progress */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Status Card */}
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Verification Status
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Real-time email verification
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  verificationStatus === 'verified' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {isVerified ? 'COMPLETE' : 'IN PROGRESS'}
                </div>
              </div>
              
              <div className="flex justify-center mb-4">
                <SecurityShield status={verificationStatus} />
              </div>
              
              <VerificationSteps steps={verificationSteps} theme={resolvedTheme} />
            </div>

            {/* Security Info */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Lock className="text-blue-500 dark:text-blue-400" size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-1">
                    Security Features
                  </h4>
                  <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <li className="flex items-center gap-1">
                      <span className="text-blue-500">•</span>
                      <span>256-bit encryption</span>
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-blue-500">•</span>
                      <span>24-hour link expiry</span>
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-blue-500">•</span>
                      <span>Single-use verification</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Verification Interface */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl shadow-xl border bg-white/95 dark:bg-gray-900/95 border-gray-200/60 dark:border-gray-700/50 p-5 md:p-6"
          >
            {/* Email Display Card */}
            <div className="mb-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Mail className="text-indigo-500 dark:text-indigo-400" size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Verification Email Sent To
                    </p>
                    <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white break-all mt-1">
                      {email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock size={12} />
                  <span>Link expires in 24 hours • Check spam folder</span>
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-4 rounded-xl mb-6 text-center ${
              verificationStatus === 'verified'
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50'
                : verificationStatus === 'error'
                ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800/50'
                : 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800/50'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {verificationStatus === 'verified' && <CheckCircle2 className="text-green-500" size={20} />}
                {verificationStatus === 'error' && <AlertCircle className="text-red-500" size={20} />}
                {verificationStatus === 'sending' && <RefreshCw className="animate-spin text-blue-500" size={20} />}
                {verificationStatus === 'sent' && <Mail className="text-indigo-500" size={20} />}
                {verificationStatus === 'verifying' && <RefreshCw className="animate-spin text-amber-500" size={20} />}
                
                <span className={`font-semibold ${
                  verificationStatus === 'verified' ? 'text-green-600 dark:text-green-400' :
                  verificationStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                  verificationStatus === 'sending' ? 'text-blue-600 dark:text-blue-400' :
                  verificationStatus === 'sent' ? 'text-indigo-600 dark:text-indigo-400' :
                  'text-amber-600 dark:text-amber-400'
                }`}>
                  {verificationStatus === 'sending' && 'Sending Email...'}
                  {verificationStatus === 'sent' && 'Check Your Email'}
                  {verificationStatus === 'verifying' && 'Checking Status...'}
                  {verificationStatus === 'verified' && 'Email Verified Successfully!'}
                  {verificationStatus === 'error' && 'Verification Error'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {verificationStatus === 'sending' && 'Sending verification email...'}
                {verificationStatus === 'sent' && 'Click the verification link in your email.'}
                {verificationStatus === 'verifying' && 'Verifying your email...'}
                {verificationStatus === 'verified' && 'Your account is now verified and secure.'}
                {verificationStatus === 'error' && 'Failed to send email. Please try again.'}
              </p>
              
              {isCheckingVerification && !isVerified && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-gray-500 dark:text-gray-400" size={14} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Auto-checking verification status...
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Manual Check Button */}
              <button
                onClick={handleManualCheck}
                disabled={loading || isVerified}
                className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                  loading || isVerified
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-md hover:shadow-blue-500/20'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span className="text-sm">Checking...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span className="text-sm">Check Verification Status</span>
                  </>
                )}
              </button>

              {/* Resend Email with Timer */}
              {verificationStatus === 'sent' && !isVerified && (
                <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700">
                  <CountdownTimer 
                    duration={60} 
                    onComplete={handleCooldownComplete}
                  />
                  
                  <button
                    onClick={handleResendEmail}
                    disabled={!canResend || loading}
                    className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                      !canResend || loading
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-md hover:shadow-purple-500/20'
                    }`}
                  >
                    <Mail size={16} />
                    <span className="text-sm">
                      {loading ? 'Resending...' : 'Resend Verification Email'}
                    </span>
                  </button>
                </div>
              )}

              {/* Change Email Button */}
              <button
                onClick={handleChangeEmail}
                disabled={loading || isVerified}
                className={`w-full py-3 px-4 rounded-lg font-medium border flex items-center justify-center gap-2 transition-all duration-200 ${
                  loading || isVerified
                    ? 'border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <X size={16} />
                <span className="text-sm">Use Different Email Address</span>
              </button>

              {/* Continue Button */}
              <button
                onClick={handleContinue}
                disabled={loading || !isVerified}
                className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                  !(loading || !isVerified)
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-md hover:shadow-emerald-500/20'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isVerified ? (
                  <>
                    <UserCheck size={16} />
                    <span className="text-sm">Continue to Profile Setup</span>
                    <ArrowRight size={16} />
                  </>
                ) : (
                  <span className="text-sm">Verify Email to Continue</span>
                )}
              </button>
            </div>

            {/* Help Section */}
            <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="text-amber-500 dark:text-amber-400" size={14} />
                </div>
                <div>
                  <h4 className="font-medium text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Need Help?
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Check spam/junk folder</li>
                    <li>• Ensure correct email address</li>
                    <li>• Wait a few minutes</li>
                    <li>• Contact support if issues persist</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-4 mb-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Secure</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Encrypted</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Verified</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Arvdoul • Enterprise Security Platform
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}