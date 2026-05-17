// src/screens/SignupStep1Personal.jsx - MOBILE OPTIMIZED ULTIMATE VERSION - FIXED
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";

// ==================== MOBILE-OPTIMIZED INPUT COMPONENT ====================
const MobileOptimizedInput = React.memo(({ 
  label, 
  value, 
  onChange, 
  error, 
  type = "text",
  autoFocus = false,
  onKeyPress,
  disabled = false,
  theme,
  className = "",
  required = true
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setIsFocused(true);
    // On mobile, ensure virtual keyboard doesn't cover input
    if (window.innerWidth < 768) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  const handleBlur = () => setIsFocused(false);

  const isActive = isFocused || value;

  return (
    <div className={`relative ${className}`}>
      {/* Label - Optimized for mobile touch */}
      <label className={`block mb-1.5 text-sm font-medium transition-colors duration-200 touch-none ${
        error 
          ? 'text-red-600 dark:text-red-400' 
          : isActive
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Input Container with mobile-optimized sizing */}
      <div className="relative">
        <motion.div
          className={`relative rounded-lg border transition-all duration-200 overflow-hidden ${
            error
              ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
              : isFocused
              ? theme === 'dark'
                ? 'border-indigo-500 bg-gray-800/50'
                : 'border-indigo-500 bg-white'
              : theme === 'dark'
              ? 'border-gray-700 bg-gray-800/30 active:border-gray-600'
              : 'border-gray-300 bg-white active:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.995]'}`}
          whileTap={!disabled ? { scale: 0.995 } : {}}
        >
          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyPress={onKeyPress}
            disabled={disabled}
            autoFocus={autoFocus}
            // Mobile-specific attributes
            inputMode={type === "number" ? "numeric" : "text"}
            enterKeyHint="next"
            className={`w-full px-4 py-3 bg-transparent outline-none text-base font-normal 
              ${theme === 'dark' ? 'text-white' : 'text-gray-900'} 
              ${disabled ? 'cursor-not-allowed' : ''}
              min-h-[44px]`} // Minimum touch target size for mobile
            style={{
              WebkitAppearance: 'none',
              WebkitTapHighlightColor: 'transparent',
              fontSize: '16px', // Prevents iOS zoom on focus
            }}
          />

          {/* Focus Indicator */}
          {isFocused && !error && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'
                  : 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)'
              }}
            />
          )}
        </motion.div>

        {/* Validation Indicator - Mobile optimized */}
        {value && !error && (
          <motion.div
            className="absolute right-3 top-1/2 -translate-y-1/2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </motion.div>
        )}
      </div>

      {/* Error Message - Mobile optimized */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

MobileOptimizedInput.displayName = 'MobileOptimizedInput';

// ==================== MOBILE-OPTIMIZED SELECT COMPONENT ====================
const MobileOptimizedSelect = React.memo(({ 
  label, 
  value, 
  onChange, 
  options, 
  error, 
  theme,
  required = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelectClick = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={selectRef}>
      {/* Label */}
      <label className={`block mb-1.5 text-sm font-medium touch-none ${
        error
          ? 'text-red-600 dark:text-red-400'
          : value
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Select Container - Mobile optimized */}
      <motion.div
        className={`relative cursor-pointer rounded-lg border transition-all duration-200 min-h-[44px] flex items-center ${
          error
            ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
            : isOpen
            ? theme === 'dark'
              ? 'border-indigo-500 bg-gray-800/50'
              : 'border-indigo-500 bg-white'
            : theme === 'dark'
            ? 'border-gray-700 bg-gray-800/30 active:border-gray-600'
            : 'border-gray-300 bg-white active:border-gray-400'
        }`}
        whileTap={{ scale: 0.995 }}
        onClick={handleSelectClick}
      >
        <div className="px-4 py-3 w-full">
          <div className={`flex items-center justify-between ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          } ${!selectedOption ? 'opacity-70' : 'font-medium'}`}>
            <span className="truncate">{selectedOption ? selectedOption.label : `Select ${label.toLowerCase()}`}</span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Dropdown Options - Mobile optimized */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`fixed inset-x-4 bottom-4 top-auto z-50 rounded-lg border shadow-2xl ${
              theme === 'dark'
                ? 'bg-gray-900 border-gray-800'
                : 'bg-white border-gray-200'
            }`}
            style={{
              maxHeight: '50vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div className="p-2">
              {options.map((option) => (
                <div
                  key={option.value}
                  className={`px-4 py-3 cursor-pointer rounded-lg my-1 min-h-[44px] flex items-center ${
                    option.value === value
                      ? theme === 'dark'
                        ? 'bg-indigo-900/40 text-indigo-300'
                        : 'bg-indigo-50 text-indigo-700'
                      : theme === 'dark'
                      ? 'active:bg-gray-800 text-gray-300'
                      : 'active:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => handleOptionClick(option.value)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{option.label}</span>
                    {option.value === value && (
                      <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

MobileOptimizedSelect.displayName = 'MobileOptimizedSelect';

// ==================== DATE OF BIRTH COMPONENT (Mobile Optimized) ====================
const MobileDateOfBirthSelector = React.memo(({ value, onChange, error, theme }) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
    { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
    { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
    { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const calculateAge = useCallback(() => {
    if (!value.day || !value.month || !value.year) return null;
    
    const birthDate = new Date(value.year, value.month - 1, value.day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }, [value]);

  const age = calculateAge();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`text-sm font-medium ${
          error
            ? 'text-red-600 dark:text-red-400'
            : value.day || value.month || value.year
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          Date of Birth <span className="text-red-500">*</span>
        </label>
        
        {age !== null && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              age >= 13
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {age} years
          </motion.span>
        )}
      </div>

      {/* Day, Month, Year - Mobile optimized grid */}
      <div className="grid grid-cols-3 gap-2">
        <MobileOptimizedSelect
          label="Day"
          value={value.day}
          onChange={(day) => onChange({ ...value, day })}
          options={days.map(day => ({ value: day, label: day }))}
          theme={theme}
          required={true}
        />

        <MobileOptimizedSelect
          label="Month"
          value={value.month}
          onChange={(month) => onChange({ ...value, month })}
          options={months}
          theme={theme}
          required={true}
        />

        <MobileOptimizedSelect
          label="Year"
          value={value.year}
          onChange={(year) => onChange({ ...value, year })}
          options={years.map(year => ({ value: year, label: year }))}
          theme={theme}
          required={true}
        />
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

MobileDateOfBirthSelector.displayName = 'MobileDateOfBirthSelector';

// ==================== MAIN COMPONENT (Mobile Optimized) ====================
export default function SignupStep1Personal() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: 'light' };
  const { theme } = themeCtx;
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: { day: "", month: "", year: "" },
    username: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Refs for focus management
  const firstNameRef = useRef(null);

  // Auto-focus first name on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      firstNameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Real-time validation
  useEffect(() => {
    if (!submissionAttempted) return;

    const newErrors = {};

    // First Name
    if (!formData.firstName.trim()) {
      newErrors.firstName = "Required";
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = "Min 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.firstName)) {
      newErrors.firstName = "Invalid characters";
    }

    // Last Name
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Required";
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = "Min 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.lastName)) {
      newErrors.lastName = "Invalid characters";
    }

    // Gender
    if (!formData.gender) {
      newErrors.gender = "Please select";
    }

    // Date of Birth
    if (!formData.dob.day || !formData.dob.month || !formData.dob.year) {
      newErrors.dob = "Complete all fields";
    } else {
      const birthDate = new Date(formData.dob.year, formData.dob.month - 1, formData.dob.day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13) {
        newErrors.dob = "Must be 13+ years";
      } else if (age > 120) {
        newErrors.dob = "Invalid year";
      }
    }

    // Username (if provided)
    if (formData.username.trim()) {
      if (formData.username.length < 3) {
        newErrors.username = "Min 3 characters";
      } else if (formData.username.length > 30) {
        newErrors.username = "Max 30 characters";
      } else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username)) {
        newErrors.username = "Invalid format";
      }
    }

    setErrors(newErrors);
  }, [formData, submissionAttempted]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    setSubmissionAttempted(true);
    setLoading(true);

    // Check for any existing errors
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the errors");
      setLoading(false);
      return;
    }

    // Final validation
    const isValid = 
      formData.firstName.trim().length >= 2 &&
      formData.lastName.trim().length >= 2 &&
      formData.gender &&
      formData.dob.day && formData.dob.month && formData.dob.year;

    if (!isValid) {
      toast.error("Complete all required fields");
      setLoading(false);
      return;
    }

    try {
      // Process data
      const processedData = {
        ...formData,
        firstName: formData.firstName.trim().replace(/\b\w/g, l => l.toUpperCase()),
        lastName: formData.lastName.trim().replace(/\b\w/g, l => l.toUpperCase()),
        username: formData.username.trim().toLowerCase(),
      };

      // Store in session storage
      sessionStorage.setItem('signup_step1', JSON.stringify(processedData));

      // Navigate to next step
      navigate("/signup/step2", {
        state: { 
          step1Data: processedData,
          timestamp: Date.now()
        },
        replace: true
      });

    } catch (error) {
      console.error("Form error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  // Check form validity
  const isFormValid = useMemo(() => {
    return (
      formData.firstName.trim().length >= 2 &&
      formData.lastName.trim().length >= 2 &&
      formData.gender &&
      formData.dob.day && formData.dob.month && formData.dob.year &&
      Object.keys(errors).length === 0
    );
  }, [formData, errors]);

  // Background style
  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
      : `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`
  }), [theme]);

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 md:p-6 safe-area-bottom"
      style={backgroundStyle}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md sm:max-w-lg md:max-w-2xl"
      >
        {/* Progress Indicator - Mobile optimized */}
        <div className="flex items-center justify-center mb-6 sm:mb-8">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold ${
                  step === 1 
                    ? theme === 'dark'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-indigo-500 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {step}
                </div>
                <div className={`mt-1 text-xs sm:text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Step {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Form Card - Mobile optimized */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`rounded-xl border ${
            theme === 'dark'
              ? 'bg-gray-900/80 border-gray-800'
              : 'bg-white border-gray-200'
          } shadow-lg sm:shadow-xl p-4 sm:p-6 md:p-8`}
          style={{
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Personal Information
            </h1>
            <p className={`mt-1 text-sm sm:text-base ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Step 1 of 3 • Create account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* FIRST & LAST NAME - SIDE BY SIDE ON MOBILE & DESKTOP */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
              <MobileOptimizedInput
                ref={firstNameRef}
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                error={errors.firstName}
                autoFocus={true}
                onKeyPress={handleKeyPress}
                theme={theme}
                required={true}
              />

              <MobileOptimizedInput
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                error={errors.lastName}
                onKeyPress={handleKeyPress}
                theme={theme}
                required={true}
              />
            </div>

            {/* Gender Selection */}
            <div className="mb-4 sm:mb-6">
              <MobileOptimizedSelect
                label="Gender"
                value={formData.gender}
                onChange={(gender) => setFormData(prev => ({ ...prev, gender }))}
                options={[
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                  { value: "Prefer not to say", label: "Prefer not to say" }
                ]}
                error={errors.gender}
                theme={theme}
                required={true}
              />
            </div>

            {/* Date of Birth */}
            <div className="mb-4 sm:mb-6">
              <MobileDateOfBirthSelector
                value={formData.dob}
                onChange={(dob) => setFormData(prev => ({ ...prev, dob }))}
                error={errors.dob}
                theme={theme}
              />
            </div>

            {/* Optional Username */}
            <div className="mb-6 sm:mb-8">
              <MobileOptimizedInput
                label="Username (optional)"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                error={errors.username}
                onKeyPress={handleKeyPress}
                theme={theme}
                required={false}
              />
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                If not provided, we'll generate one for you.
              </p>
            </div>

            {/* Continue Button - Mobile optimized */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <motion.button
                type="submit"
                disabled={!isFormValid || loading}
                whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
                className={`w-full py-3 sm:py-3.5 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 ${
                  isFormValid && !loading
                    ? theme === 'dark'
                      ? 'bg-indigo-600 active:bg-indigo-700 text-white'
                      : 'bg-indigo-600 active:bg-indigo-700 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-gray-200 text-gray-400'
                } min-h-[48px] active:scale-[0.98]`}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Continue</span>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </motion.button>

              {/* Terms Notice - Mobile optimized */}
              <p className={`mt-3 text-center text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                By continuing, you agree to our Terms & Privacy.
              </p>
            </div>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className={`font-medium ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        </motion.div>

        {/* Footer Note */}
        <div className="mt-4 text-center">
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            © {new Date().getFullYear()} Arvdoul
          </p>
        </div>
      </motion.div>

      {/* Mobile-specific CSS */}
      <style jsx>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        
        /* Prevent text size adjustment on mobile */
        @media screen and (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
        
        /* Better scrolling on mobile */
        * {
          -webkit-tap-highlight-color: transparent;
        }
        
        /* Hide scrollbar but allow scrolling */
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}