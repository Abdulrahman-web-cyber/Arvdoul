\/\/ src/screens/ResetPassword.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle, Key, Zap, ArrowRight } from "lucide-react";

\/\/ Advanced Password Strength Analyzer with Real Security Metrics
const PasswordStrengthAnalyzer = ({ password, theme }) => {
  const analyzePassword = useCallback((pwd) => {
    let score = 0;
    const requirements = [];
    const feedback = [];

    \/\/ Length check
    if (pwd.length >= 8) {
      score += 20;
      requirements.push({ met: true, text: "At least 8 characters" });
    } else {
      requirements.push({ met: false, text: "At least 8 characters" });
      feedback.push("Increase length to at least 8 characters");
    }

    \/\/ Upper/lower case check
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    if (hasUpperCase && hasLowerCase) {
      score += 20;
      requirements.push({ met: true, text: "Mixed case letters" });
    } else {
      requirements.push({ met: false, text: "Mixed case letters" });
      feedback.push("Include both uppercase and lowercase letters");
    }

    \/\/ Numbers check
    const hasNumbers = /[0-9]/.test(pwd);
    if (hasNumbers) {
      score += 20;
      requirements.push({ met: true, text: "Contains numbers" });
    } else {
      requirements.push({ met: false, text: "Contains numbers" });
      feedback.push("Add at least one number");
    }

    \/\/ Special characters check
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    if (hasSpecial) {
      score += 20;
      requirements.push({ met: true, text: "Special characters" });
    } else {
      requirements.push({ met: false, text: "Special characters" });
      feedback.push("Add special characters (!@#$%^&*)");
    }

    \/\/ Length bonus
    if (pwd.length >= 12) {
      score += 10;
      requirements.push({ met: true, text: "12+ characters" });
    } else if (pwd.length > 0) {
      requirements.push({ met: false, text: "12+ characters for maximum security" });
    }

    \/\/ Common pattern detection
    const commonPatterns = [
      '123456', 'password', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', 'dragon', 'baseball', 'football'
    ];
    
    const isCommon = commonPatterns.some(pattern => 
      pwd.toLowerCase().includes(pattern)
    );
    
    if (isCommon) {
      score -= 30;
      feedback.push("Avoid common passwords");
    }

    \/\/ Sequential characters detection
    if (/(.)\1{2,}/.test(pwd)) {
      score -= 15;
      feedback.push("Avoid repeated characters");
    }

    \/\/ Sequential numbers detection (123, 456, etc.)
    if (/123|234|345|456|567|678|789/.test(pwd)) {
      score -= 15;
      feedback.push("Avoid sequential numbers");
    }

    \/\/ Determine strength level
    let strength = 'very-weak';
    let color = 'bg-red-500';
    let textColor = 'text-red-500';
    let level = 0;

    if (score >= 80) {
      strength = 'very-strong';
      color = 'bg-gradient-to-r from-green-500 to-emerald-500';
      textColor = 'text-green-500';
      level = 4;
    } else if (score >= 60) {
      strength = 'strong';
      color = 'bg-gradient-to-r from-blue-500 to-cyan-500';
      textColor = 'text-blue-500';
      level = 3;
    } else if (score >= 40) {
      strength = 'good';
      color = 'bg-gradient-to-r from-yellow-500 to-amber-500';
      textColor = 'text-yellow-500';
      level = 2;
    } else if (score >= 20) {
      strength = 'weak';
      color = 'bg-gradient-to-r from-orange-500 to-red-500';
      textColor = 'text-orange-500';
      level = 1;
    } else if (pwd.length > 0) {
      strength = 'very-weak';
      color = 'bg-gradient-to-r from-red-500 to-rose-500';
      textColor = 'text-red-500';
      level = 0;
    }

    \/\/ Security assessment
    let assessment = '';
    if (strength === 'very-strong') {
      assessment = 'Maximum Security';
    } else if (strength === 'strong') {
      assessment = 'Strong Protection';
    } else if (strength === 'good') {
      assessment = 'Good Protection';
    } else if (strength === 'weak') {
      assessment = 'Weak - Needs Improvement';
    } else {
      assessment = 'Very Weak - Please Improve';
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      strength,
      color,
      textColor,
      level,
      assessment,
      requirements,
      feedback,
      isCommon
    };
  }, []);

  const analysis = useMemo(() => analyzePassword(password), [password, analyzePassword]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Strength Meter */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Password Strength
          </span>
          <span className={`text-sm font-bold ${analysis.textColor}`}>
            {analysis.assessment}
          </span>
        </div>
        
        {/* Visual Strength Bar */}
        <div className={`w-full h-2 rounded-full overflow-hidden ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
        }`}>
          <motion.div
            className={`h-2 rounded-full ${analysis.color}`}
            initial={{ width: 0 }}
            animate={`{ width: `${analysis.score}%` `}}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        
        {/* Level Indicators */}
        <div className="flex justify-between">
          {['Very Weak', 'Weak', 'Good', 'Strong', 'Max'].map((label, index) => (
            <div
              key={label}
              className={`text-xs font-medium ${
                index <= analysis.level
                  ? analysis.textColor
                  : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Requirements Grid */}
      {password && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <div className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Requirements:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {analysis.requirements.map((req, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2"
              >
                <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                  req.met 
                    ? 'bg-green-500 text-white text-xs' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {req.met ? '✓' : ''}
                </div>
                <span className={`text-xs ${
                  req.met 
                    ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                    : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {req.text}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feedback */}
      {analysis.feedback.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg ${
            analysis.strength === 'very-weak' || analysis.strength === 'weak'
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-yellow-500/10 border border-yellow-500/20'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className={`w-4 h-4 mt-0.5 ${
              analysis.strength === 'very-weak' || analysis.strength === 'weak'
                ? 'text-red-500'
                : 'text-yellow-500'
            }`} />
            <div className="text-left">
              <p className={`text-xs font-medium ${
                analysis.strength === 'very-weak' || analysis.strength === 'weak'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                Security Recommendations
              </p>
              <ul className="text-xs mt-1 space-y-1">
                {analysis.feedback.map((item, index) => (
                  <li key={index} className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Common Password Warning */}
      {analysis.isCommon && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              ⚠️ This password is commonly used and vulnerable to attacks
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

\/\/ Secure Password Input Component
const SecurePasswordInput = ({ 
  value, 
  onChange, 
  error, 
  theme,
  placeholder = "Enter your password",
  autoFocus = false,
  disabled = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

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

      {/* Focus Indicator */}
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

\/\/ Main Component
export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState("idle"); \/\/ idle, validating, success, error
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    length: false,
    mixedCase: false,
    numbers: false,
    specialChars: false,
    notCommon: false,
    match: false
  });

  const theme = "dark"; \/\/ Should come from ThemeContext
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  \/\/ Get reset method from location state
  const resetMethod = location.state?.verificationMethod || "otp"; \/\/ otp or email
  const phone = location.state?.phone || "";
  const email = location.state?.email || "";

  \/\/ Auto-focus on mount
  useEffect(() => {
    newPasswordRef.current?.focus();
  }, []);

  \/\/ Real-time password validation
  useEffect(() => {
    const newChecks = { ...securityChecks };
    const newErrors = { ...errors };

    \/\/ Length check
    newChecks.length = passwords.newPassword.length >= 8;
    
    \/\/ Mixed case check
    newChecks.mixedCase = /[A-Z]/.test(passwords.newPassword) && /[a-z]/.test(passwords.newPassword);
    
    \/\/ Numbers check
    newChecks.numbers = /[0-9]/.test(passwords.newPassword);
    
    \/\/ Special characters check
    newChecks.specialChars = /[^A-Za-z0-9]/.test(passwords.newPassword);
    
    \/\/ Not common password check
    const commonPasswords = ['123456', 'password', 'qwerty', 'admin', 'letmein'];
    newChecks.notCommon = !commonPasswords.includes(passwords.newPassword.toLowerCase());
    
    \/\/ Match check
    newChecks.match = passwords.newPassword === passwords.confirmPassword && passwords.confirmPassword.length > 0;
    
    \/\/ Update errors
    if (passwords.confirmPassword && !newChecks.match) {
      newErrors.confirmPassword = "Passwords do not match";
    } else {
      delete newErrors.confirmPassword;
    }

    if (passwords.newPassword && passwords.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else {
      delete newErrors.newPassword;
    }

    setSecurityChecks(newChecks);
    setErrors(newErrors);
  }, [passwords.newPassword, passwords.confirmPassword]);

  \/\/ Check if all requirements are met
  const allRequirementsMet = useMemo(() => {
    return Object.values(securityChecks).every(check => check === true);
  }, [securityChecks]);

  \/\/ Handle password reset submission
  const handleResetPassword = async () => {
    \/\/ Validate passwords
    if (!passwords.newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (!passwords.confirmPassword) {
      toast.error("Please confirm your new password");
      return;
    }

    if (!allRequirementsMet) {
      toast.error("Please meet all password requirements");
      return;
    }

    setLoading(true);
    setResetStatus("validating");

    try {
      \/\/ Simulate API call to reset password
      await new Promise(resolve => setTimeout(resolve, 2000));

      \/\/ In production: await resetPasswordAPI(passwords.newPassword, resetToken);
      console.log("Password reset for:", resetMethod === "otp" ? phone : email);
      
      \/\/ Success
      setResetStatus("success");
      
      \/\/ Success toast
      toast.success("✅ Password reset successfully! Logging you in...");
      
      \/\/ Store password reset completion in localStorage
      localStorage.setItem("password_reset_complete", "true");
      localStorage.setItem("last_password_reset", new Date().toISOString());
      
      \/\/ Wait for success animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      \/\/ Navigate to home screen
      navigate("/home", { replace: true });
      
    } catch (error) {
      console.error("Password reset error:", error);
      setResetStatus("error");
      
      \/\/ Enhanced error handling
      let message = "Failed to reset password. Please try again.";
      if (error.code === "auth/weak-password") {
        message = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === "auth/requires-recent-login") {
        message = "Session expired. Please restart the reset process.";
        navigate("/forgot-password");
      } else if (error.code === "auth/invalid-action-code") {
        message = "Reset link has expired. Please request a new one.";
        navigate("/forgot-password");
      }
      
      toast.error(message);
      
      \/\/ Clear form on error
      setPasswords({ newPassword: "", confirmPassword: "" });
      newPasswordRef.current?.focus();
      
    } finally {
      setLoading(false);
    }
  };

  \/\/ Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && allRequirementsMet) {
      handleResetPassword();
    }
  };

  \/\/ Handle view toggle
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

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
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http:\/\/www.w3.org/2000/svg">
          <defs>
            <pattern id="passwordPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="currentColor"/>
              <path d="M30,15 L30,45 M15,30 L45,30" stroke="currentColor" strokeWidth="0.5" fill="none"/>
              <circle cx="30" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#passwordPattern)" />
        </svg>
      </div>

      {/* Floating Security Indicators */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.2)" 
                : "rgba(79,70,229,0.1)",
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.3, 0.7, 0.3],
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
        className="relative z-10 w-full max-w-lg"
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
                    : 'bg-green-500 text-white'
                }`}>
                  {step < 3 ? "✓" : "3"}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 bg-green-500`} />
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
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-5xl mb-4"
            >
              🔐
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Set New Password
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Final Step • Create a strong new password
            </motion.p>
          </header>

          <div className="space-y-6">
            {/* New Password Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <label className={`block text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                New Password
              </label>
              <SecurePasswordInput
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                error={errors.newPassword}
                theme={theme}
                placeholder="Create a strong new password"
                autoFocus={true}
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
            </motion.div>

            {/* Confirm Password Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <label className={`block text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Confirm New Password
              </label>
              <SecurePasswordInput
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
            </motion.div>

            {/* Password Strength Analyzer */}
            {passwords.newPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.5 }}
              >
                <PasswordStrengthAnalyzer password={passwords.newPassword} theme={theme} />
              </motion.div>
            )}

            {/* Security Requirements Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 gap-3"
            >
              {Object.entries(securityChecks).map(([key, value], index) => {
                const labels = {
                  length: "8+ characters",
                  mixedCase: "Mixed case",
                  numbers: "Contains numbers",
                  specialChars: "Special chars",
                  notCommon: "Not common",
                  match: "Passwords match"
                };
                
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * index }}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      value 
                        ? 'bg-green-500/10 border border-green-500/20' 
                        : 'bg-gray-500/10 border border-gray-500/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      value 
                        ? 'bg-green-500 text-white text-xs' 
                        : 'bg-gray-400 text-gray-800 text-xs'
                    }`}>
                      {value ? '✓' : '○'}
                    </div>
                    <span className={`text-xs font-medium ${
                      value 
                        ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {labels[key]}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* View Password Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2"
            >
              <motion.button
                onClick={togglePasswordVisibility}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  passwordVisible 
                    ? 'bg-indigo-500' 
                    : theme === 'dark' 
                    ? 'bg-gray-700' 
                    : 'bg-gray-300'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md`}
                  animate={{ x: passwordVisible ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                />
              </motion.button>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Show passwords
              </span>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={allRequirementsMet && !loading ? { scale: 1.02 } : {}}
              whileTap={allRequirementsMet && !loading ? { scale: 0.98 } : {}}
              onClick={handleResetPassword}
              disabled={!allRequirementsMet || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 ${
                allRequirementsMet && !loading
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-xl hover:shadow-green-500/30'
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
                  <span className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Securing Account...
                  </span>
                </div>
              ) : resetStatus === "success" ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Success! Redirecting...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Key className="w-5 h-5" />
                  Reset Password & Continue
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </div>
              )}
            </motion.button>

            {/* Status Indicators */}
            <AnimatePresence>
              {resetStatus === "success" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <h4 className="text-sm font-bold text-green-600 dark:text-green-400">
                        Password Reset Successful!
                      </h4>
                      <p className="text-xs text-green-600/80 dark:text-green-400/80">
                        Your password has been updated. Redirecting to your account...
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {resetStatus === "error" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/30"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <div>
                      <h4 className="text-sm font-bold text-red-600 dark:text-red-400">
                        Reset Failed
                      </h4>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80">
                        Could not reset password. Please try again.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Security Information */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className={`p-4 rounded-xl ${
                theme === 'dark' 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700' 
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <Shield className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <div className="text-left">
                  <h4 className={`text-sm font-semibold ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Password Security
                  </h4>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Your new password is encrypted end-to-end. We never store passwords in plain text.
                    For maximum security, use a unique password that you don't use elsewhere.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}