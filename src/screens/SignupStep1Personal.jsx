// This file must reflect: 'everything should be more extremely advanced, styled, ultra pro max professional creation and robust also production ready and working perfectly smooth'
// src/screens/SignupStep1Personal.jsx – ARVDOUL TRANSFORMED ULTIMATE VERSION
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";

// ==================== FLOATING LABEL INPUT (Arvdoul‑level) ====================
const FloatingLabelInput = React.memo(({ 
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
  const isActive = isFocused || value;

  const handleFocus = () => {
    setIsFocused(true);
    if (window.innerWidth < 768) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Field container */}
      <div className={`relative rounded-lg border transition-all duration-200 group ${
        error
          ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
          : isActive
          ? theme === 'dark'
            ? 'border-indigo-500 bg-gray-800/60'
            : 'border-indigo-500 bg-white'
          : theme === 'dark'
          ? 'border-gray-700 bg-gray-800/40'
          : 'border-gray-300 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Floating Label */}
        <label
          className={`absolute left-4 transition-all duration-200 pointer-events-none ${
            isActive
              ? 'top-2 text-xs font-medium'
              : 'top-1/2 -translate-y-1/2 text-base'
          } ${
            error
              ? 'text-red-600 dark:text-red-400'
              : isActive
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
          style={{ lineHeight: 1 }}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          onKeyPress={onKeyPress}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode={type === "number" ? "numeric" : "text"}
          enterKeyHint="next"
          className={`w-full px-4 pt-6 pb-2 bg-transparent outline-none text-base font-normal ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          } ${disabled ? 'cursor-not-allowed' : ''} min-h-[3.5rem]`}
          style={{
            WebkitAppearance: 'none',
            WebkitTapHighlightColor: 'transparent',
            fontSize: '16px',
          }}
        />

        {/* Bottom gradient focus line */}
        {isActive && !error && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)'
            }}
          />
        )}

        {/* Green checkmark on valid input */}
        {value && !error && (
          <motion.div
            className="absolute right-3 top-4 text-green-500"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Error message */}
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
FloatingLabelInput.displayName = 'FloatingLabelInput';

// ==================== GENDER CHIPS (Male/Female with ♂/♀ icons) ====================
const GenderChips = React.memo(({ value, onChange, error, theme }) => {
  const options = [
    { value: "Male", label: "Male", icon: "♂️" },
    { value: "Female", label: "Female", icon: "♀️" }
  ];

  return (
    <div>
      {/* Label */}
      <span id="gender-label" className={`block mb-2 text-sm font-medium ${
        error ? 'text-red-600 dark:text-red-400' : value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'
      }`}>
        Gender <span className="text-red-500">*</span>
      </span>

      {/* Chips group */}
      <div className="flex flex-col sm:flex-row gap-3" role="radiogroup" aria-labelledby="gender-label">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-white dark:bg-gray-800 border-2 border-transparent'
                  : theme === 'dark'
                  ? 'bg-gray-800/50 border-2 border-gray-700 hover:border-gray-600 text-gray-400'
                  : 'bg-gray-100 border-2 border-gray-300 hover:border-gray-400 text-gray-700'
              }`}
              style={
                isSelected
                  ? {
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                      backgroundImage: `linear-gradient(${theme === 'dark' ? '#1f2937' : '#fff'}, ${theme === 'dark' ? '#1f2937' : '#fff'}), linear-gradient(90deg, #4f46e5, #7c3aed)`,
                      borderColor: 'transparent',
                    }
                  : {}
              }
            >
              <span className="text-2xl" role="img" aria-label={opt.label}>{opt.icon}</span>
              <span>{opt.label}</span>
              {isSelected && (
                <svg className="w-4 h-4 ml-auto text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 mt-1">
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
GenderChips.displayName = 'GenderChips';

// ==================== MOBILE-OPTIMIZED SELECT (used for Date of Birth) ====================
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

  const selectedOption = options.find(opt => opt.value == value);

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

  return (
    <div className="relative" ref={selectRef}>
      <label className={`block mb-1 text-xs font-medium ${
        error ? 'text-red-600 dark:text-red-400' : value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {label}{required && <span className="text-red-500">*</span>}
      </label>

      <motion.div
        className={`relative cursor-pointer rounded-lg border transition-all duration-200 flex items-center ${
          error
            ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
            : isOpen
            ? theme === 'dark' ? 'border-indigo-500 bg-gray-800/60' : 'border-indigo-500 bg-white'
            : theme === 'dark' ? 'border-gray-700 bg-gray-800/40' : 'border-gray-300 bg-white'
        }`}
        whileTap={{ scale: 0.995 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="px-3 py-2 w-full">
          <div className="flex items-center justify-between text-sm">
            <span className={`truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'} ${!selectedOption ? 'opacity-70' : 'font-medium'}`}>
              {selectedOption ? selectedOption.label : label}
            </span>
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`fixed inset-x-4 bottom-4 z-50 rounded-lg border shadow-2xl max-h-[40vh] overflow-y-auto ${
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="p-2">
              {options.map((option) => (
                <div
                  key={option.value}
                  className={`px-4 py-2.5 cursor-pointer rounded-lg my-0.5 flex items-center ${
                    option.value == value
                      ? theme === 'dark' ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                      : theme === 'dark' ? 'active:bg-gray-800 text-gray-300' : 'active:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => { onChange(option.value); setIsOpen(false); }}
                >
                  <span className="text-sm">{option.label}</span>
                  {option.value == value && (
                    <svg className="w-4 h-4 ml-auto text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
MobileOptimizedSelect.displayName = 'MobileOptimizedSelect';

// ==================== DATE OF BIRTH SELECTOR (unchanged from original) ====================
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
          error ? 'text-red-600 dark:text-red-400' : (value.day || value.month || value.year) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'
        }`}>
          Date of Birth <span className="text-red-500">*</span>
        </label>
        {age !== null && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              age >= 13
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {age} years
          </motion.span>
        )}
      </div>

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

// ==================== STEP INDICATOR (matching SetupProfile/SignupStep2) ====================
const StepIndicator = React.memo(({ currentStep, theme }) => {
  const steps = [
    { number: 1, label: "Personal" },
    { number: 2, label: "Verify" },
    { number: 3, label: "Complete" }
  ];

  return (
    <div className="flex items-center justify-center mb-4 sm:mb-6">
      <div className="flex items-center space-x-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step.number === currentStep
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30'
                  : step.number < currentStep
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {step.number < currentStep ? '✓' : step.number}
              </div>
              <span className={`mt-2 text-xs font-medium ${
                step.number === currentStep
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 ${
                step.number < currentStep ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});
StepIndicator.displayName = 'StepIndicator';

// ==================== MAIN COMPONENT (Arvdoul Ultimate) ====================
export default function SignupStep1Personal() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: { day: "", month: "", year: "" }
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const firstNameRef = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => firstNameRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Real-time validation (same logic as original)
  useEffect(() => {
    if (!submissionAttempted) return;
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "Required";
    else if (formData.firstName.length < 2) newErrors.firstName = "Min 2 characters";
    else if (!/^[a-zA-Z\s'-]+$/.test(formData.firstName)) newErrors.firstName = "Invalid characters";

    if (!formData.lastName.trim()) newErrors.lastName = "Required";
    else if (formData.lastName.length < 2) newErrors.lastName = "Min 2 characters";
    else if (!/^[a-zA-Z\s'-]+$/.test(formData.lastName)) newErrors.lastName = "Invalid characters";

    if (!formData.gender) newErrors.gender = "Please select";

    if (!formData.dob.day || !formData.dob.month || !formData.dob.year) {
      newErrors.dob = "Complete all fields";
    } else {
      const birthDate = new Date(formData.dob.year, formData.dob.month - 1, formData.dob.day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 13) newErrors.dob = "Must be 13+ years";
      else if (age > 120) newErrors.dob = "Invalid year";
    }

    setErrors(newErrors);
  }, [formData, submissionAttempted]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmissionAttempted(true);
    setLoading(true);

    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the errors");
      setLoading(false);
      return;
    }

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
      const processedData = {
        ...formData,
        firstName: formData.firstName.trim().replace(/\b\w/g, l => l.toUpperCase()),
        lastName: formData.lastName.trim().replace(/\b\w/g, l => l.toUpperCase()),
      };

      sessionStorage.setItem('signup_step1', JSON.stringify(processedData));
      navigate("/signup/step2", {
        state: { step1Data: processedData, timestamp: Date.now() },
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
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

  const isFormValid = useMemo(() => {
    const noErrors = Object.keys(errors).length === 0;
    return (
      formData.firstName.trim().length >= 2 &&
      formData.lastName.trim().length >= 2 &&
      formData.gender &&
      formData.dob.day && formData.dob.month && formData.dob.year &&
      noErrors
    );
  }, [formData, errors]);

  // Pulse button only if device memory >= 4 GB
  const shouldPulse = useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
      return navigator.deviceMemory >= 4;
    }
    return true;
  }, []);
  const showPulse = isFormValid && !loading && shouldPulse;

  return (
    <div
      className="min-h-dvh w-full flex items-center justify-center p-2 sm:p-4"
      style={{
        background: theme === "dark"
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md sm:max-w-lg lg:max-w-2xl flex flex-col justify-between"
        style={{ maxHeight: '100dvh' }}
      >
        {/* Step indicator (matching SetupProfile style) */}
        <StepIndicator currentStep={1} theme={theme} />

        {/* Form card – fixed height, no scrolling */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`rounded-xl border shadow-lg sm:shadow-xl p-4 sm:p-6 flex flex-col flex-1 ${
            theme === 'dark' ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200'
          }`}
          style={{ overflow: 'hidden' }}
        >
          <div className="mb-4 sm:mb-6">
            <h1 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Personal Information
            </h1>
            <p className={`mt-1 text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Step 1 of 3 • Create account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="space-y-4 sm:space-y-5 flex-1">
              {/* First & Last Name side by side */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FloatingLabelInput
                  ref={firstNameRef}
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  error={errors.firstName}
                  autoFocus
                  onKeyPress={handleKeyPress}
                  theme={theme}
                />
                <FloatingLabelInput
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  error={errors.lastName}
                  onKeyPress={handleKeyPress}
                  theme={theme}
                />
              </div>

              {/* Gender chips with ♂/♀ icons */}
              <GenderChips
                value={formData.gender}
                onChange={(gender) => setFormData(prev => ({ ...prev, gender }))}
                error={errors.gender}
                theme={theme}
              />

              {/* Date of birth (original selects) */}
              <MobileDateOfBirthSelector
                value={formData.dob}
                onChange={(dob) => setFormData(prev => ({ ...prev, dob }))}
                error={errors.dob}
                theme={theme}
              />
            </div>

            {/* Continue button */}
            <div className="pt-4 mt-auto border-t border-gray-200 dark:border-gray-800">
              <motion.button
                type="submit"
                disabled={!isFormValid || loading}
                whileTap={(!loading && isFormValid) ? { scale: 0.98 } : {}}
                animate={showPulse ? { scale: [1, 1.02, 1] } : {}}
                transition={showPulse ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
                className={`w-full py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-colors duration-200 ${
                  isFormValid && !loading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-400'
                } min-h-[3rem]`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Continue</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </motion.button>

              <p className={`mt-3 text-center text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                By continuing, you agree to our Terms & Privacy.
              </p>
            </div>

            {/* Sign in link */}
            <div className="mt-4 text-center">
              <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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

        {/* Footer */}
        <div className="mt-2 sm:mt-4 text-center">
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            © {new Date().getFullYear()} Arvdoul
          </p>
        </div>
      </motion.div>
    </div>
  );
}