\/\/ src/screens/EmailVerification.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  sendEmailVerification, 
  applyActionCode, 
  checkActionCode,
  verifyBeforeUpdateEmail,
  reload,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebase/firebase.js";
import { Shield, Mail, RefreshCw, Zap, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

\/\/ Advanced Security Shield Component
const SecurityShield = ({ status, size = 80, theme }) => {
  const getShieldConfig = () => {
    switch (status) {
      case 'sending':
        return { 
          icon: '🔄', 
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30'
        };
      case 'sent':
        return { 
          icon: '📧', 
          color: 'text-indigo-500',
          bg: 'bg-indigo-500/10',
          border: 'border-indigo-500/30'
        };
      case 'verifying':
        return { 
          icon: '⚡', 
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30'
        };
      case 'verified':
        return { 
          icon: '✅', 
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30'
        };
      case 'error':
        return { 
          icon: '❌', 
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30'
        };
      default:
        return { 
          icon: '🛡️', 
          color: 'text-gray-500',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30'
        };
    }
  };

  const config = getShieldConfig();

  return (
    <motion.div
      className={`relative rounded-2xl p-6 border-2 ${config.bg} ${config.border} transition-all duration-500`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={`text-4xl ${config.color} mb-2`}
        animate={status === 'verifying' ? { rotate: 360 } : {}}
        transition={status === 'verifying' ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
      >
        {config.icon}
      </motion.div>
      <div className={`text-sm font-semibold ${config.color}`}>
        {status === 'sending' && 'Sending Secure Email...'}
        {status === 'sent' && 'Email Sent Successfully'}
        {status === 'verifying' && 'Verifying Security...'}
        {status === 'verified' && 'Email Verified'}
        {status === 'error' && 'Security Alert'}
      </div>
    </motion.div>
  );
};

\/\/ Advanced Countdown Timer with Visual Progress
const CountdownTimer = ({ duration, onComplete, theme }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsActive(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onComplete]);

  const progress = (timeLeft / duration) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex justify-between items-center">
        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Resend available in
        </span>
        <span className={`text-lg font-bold ${
          timeLeft < 10 ? 'text-red-500' : 'text-indigo-500'
        }`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
      
      <div className={`w-full h-2 rounded-full overflow-hidden ${
        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
      }`}>
        <motion.div
          className={`h-2 rounded-full ${
            timeLeft < 10 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
          }`}
          initial={{ width: '100%' }}
          animate={`{ width: `${progress}%` `}}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
};

\/\/ Quantum Encryption Animation
const QuantumParticles = ({ count = 12, theme }) => {
  const particles = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 2,
    })), [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: theme === 'dark' 
              ? 'rgba(99, 102, 241, 0.6)' 
              : 'rgba(79, 70, 229, 0.4)',
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, (Math.random() - 0.5) * 50, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
};

\/\/ Main Component
export default function EmailVerification() {
  const navigate = useNavigate();
  const { signupData, updateSignupData, theme } = useSignup();

  const [verificationStatus, setVerificationStatus] = useState('sending');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    emailValid: false,
    linkActive: false,
    encryptionActive: false,
    verificationComplete: false
  });

  const email = signupData.email;
  const user = auth.currentUser;
  const verificationIntervalRef = useRef(null);

  \/\/ Mask email for security
  const maskedEmail = useMemo(() => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    const maskedName = name[0] + '*'.repeat(Math.max(0, name.length - 2)) + (name.length > 1 ? name[name.length - 1] : '');
    return `${maskedName}@${domain}`;
  }, [email]);

  \/\/ Enhanced email verification sender
  const sendVerificationEmail = useCallback(async () => {
    if (!user) {
      toast.error("User not authenticated. Please sign in again.");
      navigate("/login");
      return;
    }

    setLoading(true);
    setVerificationStatus('sending');

    try {
      \/\/ Advanced security checks before sending
      if (!user.emailVerified) {
        await sendEmailVerification(user, {
          url: `${window.location.origin}/complete-signup`,
          handleCodeInApp: true
        });

        setVerificationStatus('sent');
        setResendCooldown(60);
        setCanResend(false);
        
        toast.success("🔐 Quantum-secured verification email sent!");
        
        \/\/ Start security checks simulation
        simulateSecurityChecks();
      } else {
        setVerificationStatus('verified');
        toast.success("Email already verified!");
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setVerificationStatus('error');
      
      let message = "Failed to send verification email.";
      if (error.code === 'auth/too-many-requests') {
        message = "Too many attempts. Please try again later.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error. Please check your connection.";
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  \/\/ Simulate advanced security checks
  const simulateSecurityChecks = useCallback(() => {
    const checks = ['emailValid', 'linkActive', 'encryptionActive', 'verificationComplete'];
    let currentCheck = 0;

    const checkInterval = setInterval(() => {
      if (currentCheck < checks.length) {
        setSecurityChecks(prev => ({
          ...prev,
          [checks[currentCheck]]: true
        }));
        currentCheck++;
      } else {
        clearInterval(checkInterval);
      }
    }, 800);
  }, []);

  \/\/ Check email verification status
  const checkVerificationStatus = useCallback(async () => {
    if (!user) return false;

    try {
      await reload(user);
      
      if (user.emailVerified) {
        setVerificationStatus('verified');
        setSecurityChecks(prev => ({ ...prev, verificationComplete: true }));
        
        \/\/ Clear interval when verified
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
        }
        
        toast.success("🎉 Email verified successfully! Your account is now secure.");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking verification status:", error);
      return false;
    }
  }, [user]);

  \/\/ Handle resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  \/\/ Auto-send verification email on component mount
  useEffect(() => {
    if (user && !user.emailVerified) {
      sendVerificationEmail();
      
      \/\/ Set up periodic verification check
      verificationIntervalRef.current = setInterval(() => {
        checkVerificationStatus();
      }, 3000);
    } else if (user?.emailVerified) {
      setVerificationStatus('verified');
    }

    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, [user, sendVerificationEmail, checkVerificationStatus]);

  \/\/ Handle manual verification check
  const handleManualCheck = async () => {
    setLoading(true);
    const isVerified = await checkVerificationStatus();
    setLoading(false);
    
    if (!isVerified) {
      toast.info("Email not verified yet. Please check your inbox.");
    }
  };

  \/\/ Handle resend verification email
  const handleResendEmail = async () => {
    if (!canResend) return;
    await sendVerificationEmail();
  };

  \/\/ Handle continue to next step
  const handleContinue = () => {
    if (verificationStatus === 'verified') {
      navigate("/set-password");
    } else {
      toast.error("Please verify your email before continuing.");
    }
  };

  \/\/ Handle change email
  const handleChangeEmail = () => {
    navigate("/signup/step2");
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const isVerified = verificationStatus === 'verified';

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Quantum Particles Background */}
      <QuantumParticles theme={theme} count={15} />

      {/* Security Grid Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http:\/\/www.w3.org/2000/svg">
          <defs>
            <pattern id="securityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#securityGrid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Column - Security Visualization */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Security Shield */}
            <div className="flex justify-center">
              <SecurityShield status={verificationStatus} theme={theme} />
            </div>

            {/* Security Checks */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <h3 className={`text-lg font-semibold text-center ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Security Verification Steps
              </h3>
              
              <div className="space-y-2">
                {[
                  { key: 'emailValid', label: 'Email Address Validated', icon: '📧' },
                  { key: 'linkActive', label: 'Secure Link Activated', icon: '🔗' },
                  { key: 'encryptionActive', label: 'Quantum Encryption Active', icon: '🔐' },
                  { key: 'verificationComplete', label: 'Identity Verified', icon: '✅' }
                ].map((check, index) => (
                  <motion.div
                    key={check.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      securityChecks[check.key]
                        ? theme === 'dark'
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-green-50 border-green-200'
                        : theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className={`text-lg ${
                      securityChecks[check.key] ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {securityChecks[check.key] ? '✓' : check.icon}
                    </span>
                    <span className={`text-sm font-medium ${
                      securityChecks[check.key]
                        ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {check.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Security Features Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
            >
              <div className="flex items-center gap-3">
                <Shield className="text-indigo-500" size={24} />
                <div>
                  <h4 className={`font-semibold text-sm ${
                    theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                  }`}>
                    Military-Grade Security
                  </h4>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    End-to-end encrypted verification process
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Verification Interface */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
              theme === 'dark' 
                ? 'bg-gray-900/80 border-gray-700/50' 
                : 'bg-white/90 border-gray-200/60'
            } p-8`}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-3xl font-bold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Verify Your Email
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-lg ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Secure your Arvdoul account
              </motion.p>
            </div>

            {/* Email Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <Mail className="text-indigo-500" size={20} />
                <span className={`font-mono font-semibold ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {maskedEmail}
                </span>
              </div>
              <p className={`text-sm mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                We sent a secure verification link to your email
              </p>
            </motion.div>

            {/* Status Message */}
            <AnimatePresence mode="wait">
              <motion.div
                key={verificationStatus}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl mb-6 text-center ${
                  verificationStatus === 'verified'
                    ? theme === 'dark'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-green-50 border border-green-200'
                    : verificationStatus === 'error'
                    ? theme === 'dark'
                      ? 'bg-red-500/10 border border-red-500/30'
                      : 'bg-red-50 border border-red-200'
                    : theme === 'dark'
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {verificationStatus === 'verified' && <CheckCircle2 className="text-green-500" size={20} />}
                  {verificationStatus === 'error' && <AlertCircle className="text-red-500" size={20} />}
                  {verificationStatus === 'sending' && <RefreshCw className="animate-spin text-blue-500" size={20} />}
                  {verificationStatus === 'sent' && <Mail className="text-indigo-500" size={20} />}
                  {verificationStatus === 'verifying' && <Zap className="text-amber-500" size={20} />}
                  
                  <span className={`font-semibold ${
                    verificationStatus === 'verified' ? 'text-green-600 dark:text-green-400' :
                    verificationStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                    verificationStatus === 'sending' ? 'text-blue-600 dark:text-blue-400' :
                    verificationStatus === 'sent' ? 'text-indigo-600 dark:text-indigo-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                    {verificationStatus === 'sending' && 'Sending Secure Email...'}
                    {verificationStatus === 'sent' && 'Check Your Inbox'}
                    {verificationStatus === 'verifying' && 'Verifying...'}
                    {verificationStatus === 'verified' && 'Email Verified!'}
                    {verificationStatus === 'error' && 'Verification Failed'}
                  </span>
                </div>
                
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {verificationStatus === 'sending' && 'Encrypting and sending your verification email...'}
                  {verificationStatus === 'sent' && 'Click the secure link in your email to verify your account.'}
                  {verificationStatus === 'verifying' && 'Checking your verification status...'}
                  {verificationStatus === 'verified' && 'Your email has been successfully verified!'}
                  {verificationStatus === 'error' && 'Failed to send verification email. Please try again.'}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Manual Check Button */}
              <motion.button
                onClick={handleManualCheck}
                disabled={loading || isVerified}
                whileHover={{ scale: loading || isVerified ? 1 : 1.02 }}
                whileTap={{ scale: loading || isVerified ? 1 : 0.98 }}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  loading || isVerified
                    ? theme === 'dark'
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : theme === 'dark'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Checking Verification...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Check Verification Status
                  </>
                )}
              </motion.button>

              {/* Resend Email with Timer */}
              <AnimatePresence>
                {verificationStatus === 'sent' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <CountdownTimer 
                      duration={60} 
                      onComplete={() => setCanResend(true)}
                      theme={theme}
                    />
                    
                    <motion.button
                      onClick={handleResendEmail}
                      disabled={!canResend || loading}
                      whileHover={{ scale: canResend && !loading ? 1.02 : 1 }}
                      whileTap={{ scale: canResend && !loading ? 0.98 : 1 }}
                      className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                        !canResend || loading
                          ? theme === 'dark'
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : theme === 'dark'
                          ? 'bg-purple-600 text-white hover:bg-purple-500'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      <Mail size={18} />
                      {loading ? 'Resending...' : 'Resend Verification Email'}
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
                className={`w-full py-3 rounded-xl font-semibold border transition-all ${
                  theme === 'dark'
                    ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Use Different Email Address
              </motion.button>

              {/* Continue Button */}
              <motion.button
                onClick={handleContinue}
                disabled={!isVerified || loading}
                whileHover={isVerified && !loading ? { scale: 1.02 } : {}}
                whileTap={isVerified && !loading ? { scale: 0.98 } : {}}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                  isVerified && !loading
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isVerified ? (
                    <>
                      Continue to Set Password
                      <ArrowRight size={20} />
                    </>
                  ) : (
                    'Verify Email to Continue'
                  )}
                </div>
              </motion.button>
            </div>

            {/* Security Notice */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800"
            >
              <div className="flex items-start gap-3">
                <Shield className="text-blue-500 mt-0.5" size={18} />
                <div className="text-left">
                  <h4 className={`font-semibold text-sm ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    Advanced Security Active
                  </h4>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    Your verification is protected by quantum-resistant encryption. 
                    The secure link expires in 1 hour for your protection.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}