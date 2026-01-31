// src/screens/EmailPasswordReset.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, Shield, Lock, Key, AlertCircle, CheckCircle, Clock, RefreshCw, Eye, EyeOff, ArrowRight, XCircle } from "lucide-react";

// Enhanced Token Status Component
const TokenStatusIndicator = ({ status, theme, expiresIn = null }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'verifying':
        return {
          icon: '⏳',
          color: 'text-blue-500',
          bg: 'from-blue-500/10 to-blue-600/10',
          border: 'border-blue-500/30',
          text: 'Verifying Reset Link',
          subtext: 'Checking link validity and security'
        };
      case 'valid':
        return {
          icon: '✅',
          color: 'text-green-500',
          bg: 'from-green-500/10 to-emerald-600/10',
          border: 'border-green-500/30',
          text: 'Link Verified',
          subtext: 'Reset link is valid and secure'
        };
      case 'expired':
        return {
          icon: '⏰',
          color: 'text-amber-500',
          bg: 'from-amber-500/10 to-yellow-600/10',
          border: 'border-amber-500/30',
          text: 'Link Expired',
          subtext: 'This reset link has expired'
        };
      case 'invalid':
        return {
          icon: '❌',
          color: 'text-red-500',
          bg: 'from-red-500/10 to-rose-600/10',
          border: 'border-red-500/30',
          text: 'Invalid Link',
          subtext: 'This reset link is not valid'
        };
      case 'used':
        return {
          icon: '🔐',
          color: 'text-gray-500',
          bg: 'from-gray-500/10 to-gray-600/10',
          border: 'border-gray-500/30',
          text: 'Link Already Used',
          subtext: 'This reset link has already been used'
        };
      default:
        return {
          icon: '🔒',
          color: 'text-gray-500',
          bg: 'from-gray-500/10 to-gray-600/10',
          border: 'border-gray-500/30',
          text: 'Waiting for Verification',
          subtext: 'Please wait while we verify the link'
        };
    }
  };

  const config = getStatusConfig();
  const [timeLeft, setTimeLeft] = useState(expiresIn);

  useEffect(() => {
    if (!expiresIn || expiresIn <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresIn]);

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-6 border-2 bg-gradient-to-r ${config.bg} ${config.border} transition-all duration-500`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <motion.div
            className={`text-4xl ${config.color}`}
            animate={status === 'verifying' ? { rotate: 360 } : {}}
            transition={status === 'verifying' ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
          >
            {config.icon}
          </motion.div>
          <div>
            <div className={`text-lg font-bold ${config.color}`}>
              {config.text}
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {config.subtext}
            </div>
            {expiresIn && expiresIn > 0 && status === 'valid' && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Link expires in: <span className="font-bold text-amber-500">{formatTime(timeLeft)}</span>
                  </span>
                </div>
                <div className={`w-full h-1.5 rounded-full mt-1 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}>
                  <motion.div
                    className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / expiresIn) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {expiresIn && expiresIn > 0 && (
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            timeLeft < 60 
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' 
              : 'bg-green-500/20 text-green-600 dark:text-green-400'
          }`}>
            {timeLeft < 60 ? 'Expiring Soon' : 'Active'}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Enhanced Security Checklist
const SecurityChecklist = ({ checks, theme }) => {
  const checklistItems = [
    { key: 'linkValid', label: 'Reset Link Validated', icon: '🔗' },
    { key: 'tokenVerified', label: 'Security Token Verified', icon: '🔐' },
    { key: 'sessionSecure', label: 'Session Secured', icon: '🛡️' },
    { key: 'identityConfirmed', label: 'Identity Confirmed', icon: '✅' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <h4 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
        Security Verification Steps
      </h4>
      <div className="space-y-2">
        {checklistItems.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              checks[item.key]
                ? theme === 'dark'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-green-50 border-green-200'
                : theme === 'dark'
                ? 'bg-gray-800/50 border-gray-600'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <span className={`text-lg ${
              checks[item.key] ? 'text-green-500' : 'text-gray-400'
            }`}>
              {checks[item.key] ? '✓' : item.icon}
            </span>
            <span className={`text-sm font-medium ${
              checks[item.key]
                ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {item.label}
            </span>
            {!checks[item.key] && index === 0 && (
              <motion.div
                className="ml-auto w-2 h-2 rounded-full bg-blue-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Secure Password Input Component
const SecurePasswordInput = ({ 
  value, 
  onChange, 
  error, 
  theme,
  placeholder = "Enter new password",
  disabled = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  return (
    <motion.div
      className={`relative rounded-xl border-2 transition-all duration-300 ${
        error 
          ? "border-red-500 shadow-lg shadow-red-500/20" 
          : isFocused 
          ? "border-indigo-500 shadow-lg shadow-indigo-500/20" 
          : theme === 'dark' 
          ? "border-gray-600" 
          : "border-gray-300"
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      animate={error ? { x: [-5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center">
        <Lock className={`ml-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} w-5 h-5`} />
        <input
          ref={inputRef}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-4 bg-transparent outline-none text-lg pr-12 ${
            theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
          }`}
        />
        
        <motion.button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-lg transition-colors ${
            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5 text-gray-400" />
          ) : (
            <Eye className="w-5 h-5 text-gray-400" />
          )}
        </motion.button>
      </div>

      <motion.div
        className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${
          isFocused ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-transparent'
        }`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: isFocused ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};

// Main Component
export default function EmailPasswordReset() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [tokenStatus, setTokenStatus] = useState('verifying');
  const [securityChecks, setSecurityChecks] = useState({
    linkValid: false,
    tokenVerified: false,
    sessionSecure: false,
    identityConfirmed: false
  });
  
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [expiresIn, setExpiresIn] = useState(600); // 10 minutes default
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetAttempts, setResetAttempts] = useState(0);
  const [token, setToken] = useState("");
  
  const theme = "dark"; // Should come from ThemeContext
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // Extract token from URL
  useEffect(() => {
    const urlToken = searchParams.get('token');
    const urlEmail = searchParams.get('email');
    const urlExpires = searchParams.get('expires');
    
    if (urlToken) {
      setToken(urlToken);
    }
    
    if (urlEmail) {
      setEmail(urlEmail);
    }
    
    if (urlExpires) {
      const remaining = Math.max(0, Math.floor((parseInt(urlExpires) - Date.now()) / 1000));
      setExpiresIn(remaining);
    }
  }, [searchParams]);

  // Simulate token verification
  useEffect(() => {
    const verifyToken = async () => {
      setVerificationLoading(true);
      
      try {
        // Simulate API call to verify token
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if token is valid
        // In production, you would verify against your backend
        const isValid = token && token.length > 10;
        const isExpired = expiresIn <= 0;
        
        if (!isValid) {
          setTokenStatus('invalid');
          toast.error("Invalid or tampered reset link");
          return;
        }
        
        if (isExpired) {
          setTokenStatus('expired');
          toast.error("Reset link has expired");
          return;
        }
        
        // Simulate checking if token was already used
        const isUsed = localStorage.getItem(`used_token_${token}`);
        if (isUsed) {
          setTokenStatus('used');
          toast.error("This reset link has already been used");
          return;
        }
        
        // Update security checks
        setSecurityChecks(prev => ({ ...prev, linkValid: true }));
        await new Promise(resolve => setTimeout(resolve, 500));
        setSecurityChecks(prev => ({ ...prev, tokenVerified: true }));
        await new Promise(resolve => setTimeout(resolve, 500));
        setSecurityChecks(prev => ({ ...prev, sessionSecure: true }));
        await new Promise(resolve => setTimeout(resolve, 500));
        setSecurityChecks(prev => ({ ...prev, identityConfirmed: true }));
        
        setTokenStatus('valid');
        toast.success("✅ Reset link verified successfully!");
        
        // Auto-focus password input
        setTimeout(() => {
          newPasswordRef.current?.focus();
        }, 300);
        
      } catch (error) {
        console.error("Token verification error:", error);
        setTokenStatus('invalid');
        toast.error("Failed to verify reset link");
      } finally {
        setVerificationLoading(false);
      }
    };
    
    if (token) {
      verifyToken();
    } else {
      setTokenStatus('invalid');
      setVerificationLoading(false);
      toast.error("No reset token found in URL");
    }
  }, [token, expiresIn]);

  // Real-time password validation
  useEffect(() => {
    const newErrors = {};
    
    if (passwords.newPassword && passwords.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    
    if (passwords.confirmPassword && passwords.confirmPassword !== passwords.newPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    setErrors(newErrors);
  }, [passwords.newPassword, passwords.confirmPassword]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return (
      passwords.newPassword.length >= 8 &&
      passwords.confirmPassword.length >= 8 &&
      passwords.newPassword === passwords.confirmPassword &&
      tokenStatus === 'valid' &&
      Object.values(securityChecks).every(check => check)
    );
  }, [passwords, tokenStatus, securityChecks]);

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!isFormValid) {
      toast.error("Please complete all requirements");
      return;
    }

    // Check for common passwords
    const commonPasswords = ['123456', 'password', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(passwords.newPassword.toLowerCase())) {
      toast.error("Please choose a stronger password. This one is too common.");
      return;
    }

    setLoading(true);

    try {
      // Simulate API call to reset password
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mark token as used
      localStorage.setItem(`used_token_${token}`, 'true');
      localStorage.setItem(`last_password_reset_${email}`, new Date().toISOString());
      
      // Success
      toast.success("✅ Password reset successfully! Logging you in...");
      
      // Simulate login after reset
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to home screen
      navigate("/home", { replace: true });
      
    } catch (error) {
      console.error("Password reset error:", error);
      
      // Increment reset attempts
      setResetAttempts(prev => prev + 1);
      
      let message = "Failed to reset password. Please try again.";
      if (error.code === "auth/weak-password") {
        message = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === "auth/invalid-action-code") {
        message = "Reset token is invalid or expired. Please request a new reset link.";
        setTokenStatus('invalid');
      }
      
      toast.error(message);
      
      // Clear passwords on error
      setPasswords({ newPassword: "", confirmPassword: "" });
      newPasswordRef.current?.focus();
      
    } finally {
      setLoading(false);
    }
  };

  // Handle resend reset link
  const handleResendLink = async () => {
    if (!email) {
      toast.error("No email address available for resend");
      return;
    }

    setLoading(true);

    try {
      // Simulate API call to resend reset link
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("📧 New reset link sent to your email!");
      
      // Reset verification state
      setTokenStatus('verifying');
      setSecurityChecks({
        linkValid: false,
        tokenVerified: false,
        sessionSecure: false,
        identityConfirmed: false
      });
      
      // Generate new token (simulated)
      const newToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setToken(newToken);
      setExpiresIn(600); // 10 minutes
      
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && isFormValid) {
      handlePasswordReset();
    }
  };

  // Mask email for display
  const maskedEmail = useMemo(() => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    const maskedName = name[0] + '*'.repeat(Math.max(0, name.length - 2)) + (name.length > 1 ? name[name.length - 1] : '');
    return `${maskedName}@${domain}`;
  }, [email]);

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Security Pattern Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="emailPattern" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40,0 L80,40 L40,80 L0,40 Z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              <circle cx="40" cy="40" r="4" fill="currentColor"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#emailPattern)" />
        </svg>
      </div>

      {/* Floating Security Indicators */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: 1,
              height: 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.3)" 
                : "rgba(79,70,229,0.2)",
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Progress Indicator */}
        <motion.div 
          className="flex items-center justify-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 3 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white ring-4 ring-indigo-500/30' 
                    : step === 2
                    ? 'bg-green-500 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {step < 3 ? (step === 2 ? "✓" : step) : "3"}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step === 1 
                      ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
                      : 'bg-green-500'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
            theme === 'dark' 
              ? 'bg-gray-900/80 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/60'
          } p-8`}
        >
          {/* Header */}
          <header className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Email Password Reset
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Secure Password Recovery via Email
            </motion.p>
          </header>

          {/* Email Display */}
          {email && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
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
            </motion.div>
          )}

          {/* Token Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <TokenStatusIndicator 
              status={tokenStatus} 
              theme={theme} 
              expiresIn={expiresIn} 
            />
          </motion.div>

          {/* Security Checklist */}
          {tokenStatus === 'verifying' || tokenStatus === 'valid' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-6"
            >
              <SecurityChecklist checks={securityChecks} theme={theme} />
            </motion.div>
          ) : null}

          {/* Error States */}
          <AnimatePresence>
            {(tokenStatus === 'expired' || tokenStatus === 'invalid' || tokenStatus === 'used') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-xl mb-6 ${
                  tokenStatus === 'expired'
                    ? theme === 'dark' 
                      ? 'bg-amber-900/20 border border-amber-700/50' 
                      : 'bg-amber-50 border border-amber-200'
                    : theme === 'dark' 
                    ? 'bg-red-900/20 border border-red-700/50' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {tokenStatus === 'expired' ? (
                    <Clock className="text-amber-500 mt-0.5" size={20} />
                  ) : (
                    <XCircle className="text-red-500 mt-0.5" size={20} />
                  )}
                  <div className="text-left">
                    <h4 className={`font-semibold ${
                      tokenStatus === 'expired'
                        ? theme === 'dark' ? 'text-amber-300' : 'text-amber-700'
                        : theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>
                      {tokenStatus === 'expired' 
                        ? 'Reset Link Expired' 
                        : tokenStatus === 'used'
                        ? 'Link Already Used'
                        : 'Invalid Reset Link'
                      }
                    </h4>
                    <p className={`text-sm ${
                      tokenStatus === 'expired'
                        ? theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                        : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {tokenStatus === 'expired'
                        ? 'This password reset link has expired. Please request a new one.'
                        : tokenStatus === 'used'
                        ? 'This reset link has already been used. Each link can only be used once for security.'
                        : 'The reset link is invalid or may have been tampered with.'
                      }
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Password Reset Form (Only when token is valid) */}
          {tokenStatus === 'valid' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-6"
            >
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Set New Password
              </h3>

              {/* New Password Input */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  New Password
                </label>
                <SecurePasswordInput
                  ref={newPasswordRef}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  error={errors.newPassword}
                  theme={theme}
                  placeholder="Enter your new password"
                  onKeyPress={handleKeyPress}
                />
                {errors.newPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.newPassword}
                  </motion.p>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Confirm New Password
                </label>
                <SecurePasswordInput
                  ref={confirmPasswordRef}
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  error={errors.confirmPassword}
                  theme={theme}
                  placeholder="Confirm your new password"
                  onKeyPress={handleKeyPress}
                />
                {errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.confirmPassword}
                  </motion.p>
                )}
              </div>

              {/* Password Requirements */}
              <div className={`p-4 rounded-xl ${
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password Requirements
                </h4>
                <ul className={`text-xs space-y-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <li className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      passwords.newPassword.length >= 8 ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    At least 8 characters
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      passwords.newPassword === passwords.confirmPassword && passwords.confirmPassword.length > 0 
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`} />
                    Passwords match
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      passwords.newPassword.length >= 12 ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    12+ characters for maximum security
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <motion.button
                  onClick={handlePasswordReset}
                  disabled={!isFormValid || loading}
                  whileHover={isFormValid && !loading ? { scale: 1.02 } : {}}
                  whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
                  className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                    isFormValid && !loading
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl'
                      : theme === 'dark'
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Resetting Password...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Key className="w-5 h-5" />
                      Reset Password & Login
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </motion.button>

                {/* Back to Login */}
                <div className="text-center">
                  <button
                    onClick={() => navigate("/login")}
                    className={`text-sm font-medium transition-colors ${
                      theme === 'dark' 
                        ? 'text-indigo-400 hover:text-indigo-300' 
                        : 'text-indigo-600 hover:text-indigo-500'
                    }`}
                  >
                    ← Back to Login
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Action for Invalid/Expired Tokens */}
          {(tokenStatus === 'expired' || tokenStatus === 'invalid' || tokenStatus === 'used') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-4"
            >
              <motion.button
                onClick={handleResendLink}
                disabled={loading || !email}
                whileHover={!loading && email ? { scale: 1.02 } : {}}
                whileTap={!loading && email ? { scale: 0.98 } : {}}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                  !loading && email
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-xl'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Sending New Link...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Send New Reset Link
                  </div>
                )}
              </motion.button>

              <div className="text-center">
                <button
                  onClick={() => navigate("/forgot-password")}
                  className={`text-sm font-medium transition-colors ${
                    theme === 'dark' 
                      ? 'text-gray-400 hover:text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Try Different Reset Method
                </button>
              </div>
            </motion.div>
          )}

          {/* Security Information */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className={`mt-6 p-4 rounded-xl ${
              theme === 'dark' 
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700' 
                : 'bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <Shield className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
              <div className="text-left">
                <h4 className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email Reset Security
                </h4>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Each reset link is unique and can only be used once. Links expire after 10 minutes for security.
                  If you didn't request this reset, please ignore this email.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}