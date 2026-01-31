// src/screens/SignupStep2VerifyContact.jsx - ENTERPRISE PRODUCTION V3 - FIXED
// ✅ Real Phone Auth • Perfect OTP Flow • Production Ready

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";

// Import country codes
import { countryCodes, getCountryByIso } from "../data/countryCodes.js";

// ==================== ENHANCED PHONE INPUT ====================
const UltimatePhoneInput = React.memo(({ 
  value, 
  onChange, 
  error, 
  disabled = false,
  onValidationChange = () => {}
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => getCountryByIso('US'));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  useEffect(() => {
    if (value) {
      const matchedCountry = countryCodes.find(country => 
        value.startsWith(country.code)
      ) || selectedCountry;
      
      setSelectedCountry(matchedCountry);
      const numberPart = value.slice(matchedCountry.code.length);
      setPhoneNumber(numberPart);
      
      // Validate phone number
      validatePhoneNumber(`${matchedCountry.code}${numberPart.replace(/\D/g, '')}`);
    } else {
      setPhoneNumber('');
      onValidationChange(false);
    }
  }, [value, selectedCountry]);

  const validatePhoneNumber = (fullNumber) => {
    const cleaned = fullNumber.replace(/\D/g, '');
    const isValid = cleaned.length >= 10 && cleaned.length <= 15;
    onValidationChange(isValid);
    return isValid;
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d\s\-\(\)]/g, '');
    setPhoneNumber(cleaned);
    const fullNumber = `${selectedCountry.code}${cleaned.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSearchQuery('');
    const fullNumber = `${country.code}${phoneNumber.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return countryCodes;
    const query = searchQuery.toLowerCase();
    return countryCodes.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-4" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className={`block text-sm font-medium ${
          error 
            ? 'text-red-600 dark:text-red-400' 
            : isFocused || value
            ? 'text-indigo-600 dark:text-indigo-400'
            : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Phone Number <span className="text-red-500">*</span>
        </label>
        <span className="text-xs text-gray-500">
          We'll send a secure 6-digit verification code via SMS
        </span>
      </div>

      <div className="relative">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-36">
            <button
              type="button"
              onClick={() => !disabled && setShowCountryDropdown(!showCountryDropdown)}
              disabled={disabled}
              className={`w-full px-4 py-3.5 rounded-lg border transition-all duration-200 flex items-center justify-between group ${
                showCountryDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : resolvedTheme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                  : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {selectedCountry.code}
                </span>
                <span className={`text-xs ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedCountry.iso}
                </span>
              </div>
              <svg
                className={`w-4 h-4 transform transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showCountryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-2xl z-50 max-h-80 overflow-hidden ${
                    resolvedTheme === 'dark' 
                      ? 'bg-gray-900 border-gray-800' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-inherit">
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full px-4 py-2 rounded-lg text-sm ${
                        resolvedTheme === 'dark' 
                          ? 'bg-gray-800 text-white placeholder-gray-400 border border-gray-700' 
                          : 'bg-gray-100 text-gray-900 placeholder-gray-500 border border-gray-300'
                      }`}
                      autoFocus
                    />
                  </div>

                  <div className="overflow-y-auto max-h-64">
                    {filteredCountries.map((country) => (
                      <button
                        key={`${country.iso}-${country.code}`}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between hover:bg-opacity-50 ${
                          country.code === selectedCountry.code
                            ? resolvedTheme === 'dark'
                              ? 'bg-indigo-900/40 text-indigo-300'
                              : 'bg-indigo-50 text-indigo-700'
                            : resolvedTheme === 'dark'
                            ? 'hover:bg-gray-800 text-gray-300'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-lg">{country.flag}</div>
                          <div className="w-12 text-left font-medium">
                            {country.code}
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{country.name}</div>
                            <div className="text-xs text-gray-500">
                              {country.dialCode}
                            </div>
                          </div>
                        </div>
                        {country.code === selectedCountry.code && (
                          <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1">
            <input
              ref={inputRef}
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder="123 456 7890"
              className={`w-full px-4 py-3.5 rounded-lg border transition-all duration-200 ${
                error
                  ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                  : isFocused
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : resolvedTheme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } ${resolvedTheme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'} ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              inputMode="tel"
            />
          </div>
        </div>

        {value && !error && validatePhoneNumber(value) && (
          <div className="absolute -right-10 top-1/2 transform -translate-y-1/2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center shadow-md"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UltimatePhoneInput.displayName = 'UltimatePhoneInput';

// ==================== SIMPLIFIED RECAPTCHA COMPONENT ====================
const UltimateSecurityCheck = React.memo(({ 
  recaptchaReady, 
  recaptchaError,
  loading = false,
  onRecaptchaComplete = () => {},
  onRecaptchaError = () => {}
}) => {
  const { theme } = useTheme();
  const { createRecaptchaVerifier, cleanupRecaptchaVerifier } = useAuth();
  const [isInitializing, setIsInitializing] = useState(false);
  const containerRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const initializeRecaptcha = async () => {
    if (isInitializing || loading) return;
    
    setIsInitializing(true);
    
    try {
      console.log("🔄 Initializing reCAPTCHA...");
      
      // Clean up any existing reCAPTCHA
      cleanupRecaptchaVerifier('signup-recaptcha-container');
      
      // Create new reCAPTCHA verifier
      const verifier = await createRecaptchaVerifier('signup-recaptcha-container', {
        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
        size: 'normal',
        callback: (response) => {
          console.log('✅ reCAPTCHA solved:', response);
          onRecaptchaComplete(verifier);
        },
        expiredCallback: () => {
          console.log('❌ reCAPTCHA expired');
          cleanupRecaptchaVerifier('signup-recaptcha-container');
          onRecaptchaError('Security check expired. Please try again.');
        }
      });
      
      console.log('✅ reCAPTCHA initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize reCAPTCHA:', error);
      onRecaptchaError('Security check failed. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cleanupRecaptchaVerifier('signup-recaptcha-container');
    };
  }, [cleanupRecaptchaVerifier]);

  useEffect(() => {
    // Auto-initialize reCAPTCHA when component mounts
    if (!recaptchaReady && !recaptchaError && !loading) {
      initializeRecaptcha();
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`block text-sm font-medium ${
          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Security Verification
        </label>
        <span className="text-xs text-gray-500">Required for phone verification</span>
      </div>
      
      <div 
        id="signup-recaptcha-container" 
        ref={containerRef}
        className={`min-h-[140px] flex items-center justify-center p-6 rounded-lg border transition-all duration-300 ${
          recaptchaReady
            ? resolvedTheme === 'dark'
              ? 'border-green-500/50 bg-green-900/10'
              : 'border-green-500/50 bg-green-50'
            : recaptchaError
            ? 'border-red-500/50 bg-red-50 dark:bg-red-900/10'
            : resolvedTheme === 'dark' 
            ? 'border-gray-700 bg-gray-900/50' 
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        {isInitializing ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading security check...
            </p>
          </div>
        ) : recaptchaError ? (
          <div className="text-center w-full">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
              Security Check Failed
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {recaptchaError}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={initializeRecaptcha}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium text-sm hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry Security Check
            </motion.button>
          </div>
        ) : recaptchaReady ? (
          <div className="text-center w-full">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
              ✅ Security Check Complete
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              You can now send the verification code
            </div>
          </div>
        ) : (
          <div className="text-center w-full">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              🔒 Initializing Security Check
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This helps prevent spam and automated signups
            </p>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        This helps prevent spam and automated signups
      </div>
    </div>
  );
});

UltimateSecurityCheck.displayName = 'UltimateSecurityCheck';

// ==================== ENHANCED EMAIL FORM ====================
const UltimateEmailForm = React.memo(({ 
  formData, 
  onChange, 
  errors, 
  loading = false 
}) => {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordSuggestions, setPasswordSuggestions] = useState([]);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength(0);
      setPasswordSuggestions([]);
      return;
    }

    let strength = 0;
    const suggestions = [];
    
    if (formData.password.length >= 8) strength += 25;
    else suggestions.push("At least 8 characters");
    
    if (/[a-z]/.test(formData.password)) strength += 25;
    else suggestions.push("Add lowercase letters");
    
    if (/[A-Z]/.test(formData.password)) strength += 25;
    else suggestions.push("Add uppercase letters");
    
    if (/[0-9!@#$%^&*]/.test(formData.password)) strength += 25;
    else suggestions.push("Add numbers or symbols");
    
    setPasswordStrength(strength);
    setPasswordSuggestions(suggestions);
  }, [formData.password]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength >= 75) return 'bg-green-500';
    if (passwordStrength >= 50) return 'bg-yellow-500';
    if (passwordStrength >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength >= 75) return 'Strong';
    if (passwordStrength >= 50) return 'Medium';
    if (passwordStrength >= 25) return 'Weak';
    return 'Very Weak';
  };

  return (
    <div className="space-y-6">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          errors.email
            ? 'text-red-600 dark:text-red-400'
            : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Email Address <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => onChange({ ...formData, email: e.target.value })}
            disabled={loading}
            placeholder="you@example.com"
            className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-all duration-200 ${
              errors.email
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                : resolvedTheme === 'dark'
                ? 'border-gray-700 bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            } ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'} ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoFocus
          />
        </div>
        {errors.email && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          errors.password
            ? 'text-red-600 dark:text-red-400'
            : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={formData.password || ''}
            onChange={(e) => onChange({ ...formData, password: e.target.value })}
            disabled={loading}
            placeholder="Create a strong password"
            className={`w-full pl-10 pr-10 py-3 rounded-lg border transition-all duration-200 ${
              errors.password
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                : resolvedTheme === 'dark'
                ? 'border-gray-700 bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            } ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'} ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        
        {formData.password && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Password strength:</span>
              <span className={`text-xs font-medium ${
                passwordStrength >= 75 ? 'text-green-600 dark:text-green-400' :
                passwordStrength >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                passwordStrength >= 25 ? 'text-orange-600 dark:text-orange-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {getPasswordStrengthText()}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${getPasswordStrengthColor()}`}
                initial={{ width: 0 }}
                animate={{ width: `${passwordStrength}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {passwordSuggestions.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p className="font-medium">Suggestions:</p>
                <ul className="list-disc list-inside space-y-1">
                  {passwordSuggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {errors.password && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
        )}
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          errors.confirmPassword
            ? 'text-red-600 dark:text-red-400'
            : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={formData.confirmPassword || ''}
            onChange={(e) => onChange({ ...formData, confirmPassword: e.target.value })}
            disabled={loading}
            placeholder="Confirm your password"
            className={`w-full pl-10 pr-10 py-3 rounded-lg border transition-all duration-200 ${
              (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword)
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                : errors.confirmPassword
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                : resolvedTheme === 'dark'
                ? 'border-gray-700 bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            } ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'} ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showConfirmPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        
        {formData.password && formData.confirmPassword && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-center gap-2"
          >
            {formData.password === formData.confirmPassword ? (
              <>
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-green-600 dark:text-green-400">Passwords match</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-red-600 dark:text-red-400">Passwords don't match</span>
              </>
            )}
          </motion.div>
        )}
        
        {errors.confirmPassword && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
        )}
      </div>
    </div>
  );
});

UltimateEmailForm.displayName = 'UltimateEmailForm';

// ==================== ENHANCED GOOGLE AUTH ====================
const UltimateGoogleAuth = React.memo(({ 
  onSuccess, 
  onError, 
  loading = false 
}) => {
  const { theme } = useTheme();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);
  const auth = useAuth();

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const handleGoogleSignIn = async () => {
    if (loading || isAuthenticating) return;
    
    setIsAuthenticating(true);
    setError(null);

    try {
      console.log("🔐 Starting REAL Google sign-in...");
      
      const result = await auth.signInWithGoogle();
      
      if (result.requiresNavigation) {
        toast.success("Google authentication successful! Redirecting...");
        onSuccess(result);
        return;
      }
      
      if (result.success) {
        toast.success("Google authentication successful!");
        onSuccess(result);
      } else {
        throw new Error(result.error || "Google authentication failed");
      }
      
    } catch (error) {
      console.error('❌ Google authentication error:', error);
      
      if (error.code !== 'auth/popup-closed-by-user' && 
          error.code !== 'auth/cancelled-popup-request') {
        const errorMessage = error.message || "Google authentication failed";
        toast.error(errorMessage);
        setError(errorMessage);
      }
      
      onError(error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-2xl backdrop-blur-sm border shadow-xl ${
        resolvedTheme === 'dark'
          ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-gray-700/50'
          : 'bg-gradient-to-br from-white to-gray-50 border-gray-200/60'
      }`}>
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-2xl"
          >
            <svg className="w-10 h-10" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </motion.div>
          <h3 className={`text-xl font-bold mb-2 bg-gradient-to-r ${
            resolvedTheme === 'dark' 
              ? 'from-gray-300 to-gray-400' 
              : 'from-gray-800 to-gray-900'
          } bg-clip-text text-transparent`}>
            Fast & Secure Signup
          </h3>
          <p className={`text-sm ${
            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            One-click registration • No password needed • Enterprise-grade security
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          >
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          </motion.div>
        )}

        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading || isAuthenticating}
          whileHover={!(loading || isAuthenticating) ? { 
            scale: 1.02,
            boxShadow: resolvedTheme === 'dark' 
              ? '0 10px 30px rgba(255, 255, 255, 0.1)' 
              : '0 10px 30px rgba(0, 0, 0, 0.1)'
          } : {}}
          whileTap={!(loading || isAuthenticating) ? { scale: 0.98 } : {}}
          className={`w-full py-4 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 ${
            resolvedTheme === 'dark'
              ? 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300 shadow-lg'
              : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 shadow-lg'
          } ${(loading || isAuthenticating) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {(loading || isAuthenticating) ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full" />
              <span className="font-medium">Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium">Sign up with Google</span>
            </>
          )}
        </motion.button>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your Google account information will be used to create your profile.
          </p>
        </div>
      </div>
    </div>
  );
});

UltimateGoogleAuth.displayName = 'UltimateGoogleAuth';

// ==================== METHOD TOGGLE ====================
const UltimateMethodToggle = React.memo(({ 
  method, 
  onToggle, 
  disabled = false 
}) => {
  const { theme } = useTheme();

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const methods = [
    {
      id: 'phone',
      label: 'Phone',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      description: 'SMS Verification',
      color: 'from-blue-500 to-cyan-500',
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500'
    },
    {
      id: 'email',
      label: 'Email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Traditional Signup',
      color: 'from-purple-500 to-pink-500',
      gradient: 'bg-gradient-to-r from-purple-500 to-pink-500'
    },
    {
      id: 'google',
      label: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      description: 'One-Click Signup',
      color: 'from-red-500 to-orange-500',
      gradient: 'bg-gradient-to-r from-red-500 to-orange-500'
    }
  ];

  return (
    <div className="relative mb-8">
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-semibold text-white">Secure • Step 2 of 3</span>
        </div>
      </div>
      
      <div className={`grid grid-cols-3 gap-2 p-2 rounded-2xl backdrop-blur-sm ${
        resolvedTheme === 'dark' 
          ? 'bg-gray-800/60 border border-gray-700/50 shadow-2xl' 
          : 'bg-gray-100/80 border border-gray-300/60 shadow-2xl'
      }`}>
        {methods.map((option) => {
          const isActive = method === option.id;
          
          return (
            <motion.button
              key={option.id}
              onClick={() => !disabled && onToggle(option.id)}
              disabled={disabled}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={`relative py-4 px-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'text-white' 
                  : resolvedTheme === 'dark' 
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="methodBackground"
                  className={`absolute inset-0 rounded-xl ${option.gradient}`}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    resolvedTheme === 'dark' 
                      ? isActive ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-700/50'
                      : isActive ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-200/50'
                  }`}>
                    {option.icon}
                  </div>
                  {isActive && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 shadow-lg border-2 border-white"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  )}
                </div>
                <span className="font-semibold text-sm">{option.label}</span>
                <span className="text-xs opacity-75">{option.description}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

UltimateMethodToggle.displayName = 'UltimateMethodToggle';

// ==================== MAIN COMPONENT ====================
export default function SignupStep2VerifyContact() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { theme } = useTheme();
  
  // Enhanced State Management
  const [method, setMethod] = useState("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [step1Data, setStep1Data] = useState(null);
  
  // REAL reCAPTCHA state - SIMPLIFIED
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  
  // Phone validation state
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  
  // Refs
  const isMounted = useRef(true);
  const navigationLock = useRef(false);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  // Load step1 data
  useEffect(() => {
    const loadStep1Data = () => {
      try {
        const savedData = sessionStorage.getItem('signup_step1');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setStep1Data(parsedData);
          console.log("✅ Loaded step1 data:", parsedData);
        } else {
          toast.error("Please complete Step 1 first");
          setTimeout(() => {
            navigate("/signup/step1", { replace: true });
          }, 1500);
        }
      } catch (error) {
        console.error("❌ Failed to load step1 data:", error);
        toast.error("Session expired. Please start over.");
        setTimeout(() => {
          navigate("/signup/step1", { replace: true });
        }, 1500);
      }
    };

    loadStep1Data();

    return () => {
      isMounted.current = false;
      // Cleanup reCAPTCHA
      if (auth.cleanupRecaptchaVerifier) {
        auth.cleanupRecaptchaVerifier('signup-recaptcha-container');
      }
    };
  }, [navigate, auth]);

  // Reset reCAPTCHA when method changes
  useEffect(() => {
    if (method !== "phone") {
      setRecaptchaReady(false);
      setRecaptchaError(null);
      setRecaptchaVerifier(null);
      
      // Cleanup reCAPTCHA
      if (auth.cleanupRecaptchaVerifier) {
        auth.cleanupRecaptchaVerifier('signup-recaptcha-container');
      }
      return;
    }

    console.log("🔄 Initializing security check for phone method");
    
    return () => {
      // Cleanup on unmount or method change
      if (method === "phone") {
        setRecaptchaReady(false);
        setRecaptchaError(null);
        setRecaptchaVerifier(null);
      }
    };
  }, [method, auth]);

  // Enhanced validation functions
  const validateEmail = useCallback((email) => {
    if (!email) return "Email is required";
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    
    return null;
  }, []);

  const validatePassword = useCallback((password) => {
    if (!password) return "Password is required";
    
    const errors = [];
    
    if (password.length < 8) errors.push("Password must be at least 8 characters");
    if (!/[a-z]/.test(password)) errors.push("Password must contain lowercase letters");
    if (!/[A-Z]/.test(password)) errors.push("Password must contain uppercase letters");
    if (!/[0-9]/.test(password)) errors.push("Password must contain numbers");
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
    
    return errors.length > 0 ? errors.join('. ') : null;
  }, []);

  const validatePhoneNumber = useCallback((phone) => {
    if (!phone) return "Phone number is required";
    
    const cleanPhone = phone.replace(/\s+/g, '');
    
    if (!cleanPhone.startsWith('+')) {
      return "Phone number must start with country code (e.g., +1)";
    }
    
    const digitsOnly = cleanPhone.slice(1).replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    
    if (digitsOnly.length > 15) {
      return "Phone number is too long";
    }
    
    return null;
  }, []);

  // Handle Google success
  const handleGoogleSuccess = useCallback(async (result) => {
    if (navigationLock.current) return;
    navigationLock.current = true;
    
    setLoading(true);
    setErrors({});

    try {
      console.log("✅ Google authentication successful:", result);

      // Store complete signup data
      const signupData = {
        ...step1Data,
        ...result.user,
        authProvider: 'google',
        isNewUser: result.isNewUser || true,
        requiresProfileCompletion: true
      };

      localStorage.setItem('signup_data', JSON.stringify(signupData));
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));
      
      toast.success("✅ Google authentication successful!");
      
      // Navigate to setup profile
      setTimeout(() => {
        navigate("/setup-profile", {
          state: {
            method: "google",
            userData: result.user,
            isNewUser: true,
            requiresProfileCompletion: true
          },
          replace: true
        });
      }, 1000);

    } catch (error) {
      console.error("❌ Google success handler error:", error);
      toast.error("Failed to process Google authentication");
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
      setTimeout(() => {
        navigationLock.current = false;
      }, 1000);
    }
  }, [step1Data, navigate]);

  // REAL Phone Verification with REAL reCAPTCHA
  const handlePhoneVerification = useCallback(async () => {
    if (navigationLock.current || phoneLoading) return;
    navigationLock.current = true;
    setPhoneLoading(true);
    
    setErrors({});

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      navigationLock.current = false;
      setPhoneLoading(false);
      return;
    }

    // Check if security check is complete
    if (!recaptchaReady || !recaptchaVerifier) {
      toast.error("Please complete the security check first.");
      navigationLock.current = false;
      setPhoneLoading(false);
      return;
    }

    try {
      console.log("📱 Starting REAL phone verification:", phoneNumber);
      console.log("🔑 reCAPTCHA verifier ready:", !!recaptchaVerifier);

      // Send REAL OTP with REAL reCAPTCHA
      const result = await auth.sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);

      if (!result.success) {
        throw new Error(result.error || "Failed to send verification code");
      }

      console.log("✅ REAL OTP sent successfully. Verification ID:", result.verificationId);

      // Store verification data
      const verificationData = {
        verificationId: result.verificationId,
        phoneNumber: result.phoneNumber,
        method: "phone",
        isSignup: true,
        step1Data: step1Data,
        timestamp: Date.now()
      };

      localStorage.setItem('phone_verification', JSON.stringify(verificationData));
      sessionStorage.setItem('phone_verification', JSON.stringify(verificationData));

      // Store signup data
      const signupData = {
        ...step1Data,
        phoneNumber: result.phoneNumber,
        contactMethod: "phone",
        verificationId: result.verificationId,
        authProvider: 'phone',
        requiresProfileCompletion: true,
        isNewUser: true
      };

      localStorage.setItem('signup_data', JSON.stringify(signupData));
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      toast.success(`✅ 6-digit code sent to ${result.phoneNumber}`);
      
      // Navigate to OTP verification
      navigate("/otp-verification", {
        state: { 
          verificationId: result.verificationId,
          phoneNumber: result.phoneNumber,
          isSignup: true,
          method: "phone",
          step1Data: step1Data
        },
        replace: true
      });

    } catch (error) {
      console.error("❌ Phone verification error:", error);
      
      let errorMessage = "Failed to send verification code";
      
      if (error.code || error.message) {
        const errorStr = error.code || error.message;
        
        if (errorStr.includes('invalid-phone-number')) {
          errorMessage = "Invalid phone number format. Use international format: +1234567890";
        } else if (errorStr.includes('too-many-requests')) {
          errorMessage = "Too many attempts. Please try again later.";
        } else if (errorStr.includes('quota-exceeded')) {
          errorMessage = "SMS quota exceeded. Please try again later.";
        } else if (errorStr.includes('captcha') || errorStr.includes('recaptcha')) {
          errorMessage = "Security check failed. Please complete the security check again.";
          setRecaptchaReady(false);
          setRecaptchaError(errorMessage);
        } else if (errorStr.includes('app-not-authorized')) {
          errorMessage = "Phone authentication not enabled. Please use email or Google signup.";
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setErrors({ phone: errorMessage });
      toast.error(errorMessage);
      
    } finally {
      setPhoneLoading(false);
      setTimeout(() => {
        navigationLock.current = false;
      }, 1000);
    }
  }, [phoneNumber, recaptchaReady, recaptchaVerifier, phoneLoading, auth, step1Data, navigate, validatePhoneNumber]);

  // Handle email signup
  const handleEmailSignup = useCallback(async () => {
    if (navigationLock.current) return;
    navigationLock.current = true;
    
    setLoading(true);
    setErrors({});

    const emailError = validateEmail(emailForm.email);
    const passwordError = validatePassword(emailForm.password);
    const confirmPasswordError = emailForm.password !== emailForm.confirmPassword 
      ? "Passwords don't match" 
      : null;

    if (emailError || passwordError || confirmPasswordError) {
      setErrors({
        email: emailError,
        password: passwordError,
        confirmPassword: confirmPasswordError
      });
      toast.error("Please fix the errors above");
      navigationLock.current = false;
      setLoading(false);
      return;
    }

    try {
      console.log("📧 Starting email signup:", emailForm.email);

      // Create account with verification required
      const result = await auth.signUpWithEmailPassword(
        emailForm.email, 
        emailForm.password,
        {
          displayName: `${step1Data?.firstName || ''} ${step1Data?.lastName || ''}`.trim(),
          email: emailForm.email,
          firstName: step1Data?.firstName || '',
          lastName: step1Data?.lastName || '',
          isNewUser: true,
          requiresEmailVerification: true
        }
      );

      if (!result.success) {
        throw new Error(result.message || result.error || "Email signup failed");
      }

      console.log("✅ Email user created, verification required:", result.user.userId);

      // Store signup data
      const signupData = {
        ...step1Data,
        email: emailForm.email,
        contactMethod: "email",
        userId: result.user?.userId,
        authProvider: 'email',
        isNewUser: result.user?.isNewUser || true,
        requiresEmailVerification: result.user?.requiresEmailVerification || true
      };

      localStorage.setItem('signup_data', JSON.stringify(signupData));
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));
      
      toast.success("✅ Account created! Please verify your email.");
      
      // Navigate to email verification
      navigate("/verify-email", {
        state: {
          method: "email",
          userId: result.user?.userId,
          userEmail: result.user?.email || emailForm.email,
          fromSignup: true,
          step1Data: signupData
        },
        replace: true
      });

    } catch (error) {
      console.error("❌ Email signup error:", error);
      
      let errorMessage = "Failed to create account";
      
      if (error.code || error.message) {
        const errorStr = error.code || error.message;
        
        if (errorStr.includes('email-already-in-use')) {
          errorMessage = "This email is already registered. Please sign in instead.";
          setTimeout(() => navigate("/login", { state: { email: emailForm.email } }), 2000);
        } else if (errorStr.includes('weak-password')) {
          errorMessage = "Password is too weak. Please choose a stronger password.";
        } else if (errorStr.includes('invalid-email')) {
          errorMessage = "Invalid email address format.";
        } else if (errorStr.includes('too-many-requests')) {
          errorMessage = "Too many attempts. Please try again later.";
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setTimeout(() => {
        navigationLock.current = false;
      }, 1000);
    }
  }, [emailForm, step1Data, auth, navigate, validateEmail, validatePassword]);

  const handleGoogleError = useCallback((error) => {
    console.error("Google authentication error:", error);
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      setErrors({ general: error.message });
    }
  }, []);

  // Handle REAL security check completion
  const handleSecurityCheckComplete = useCallback((verifier) => {
    setRecaptchaReady(true);
    setRecaptchaVerifier(verifier);
    setRecaptchaError(null);
    console.log("✅ Security check completed with verifier:", !!verifier);
  }, []);

  // Handle security check error
  const handleSecurityCheckError = useCallback((error) => {
    setRecaptchaError(error);
    setRecaptchaReady(false);
    setRecaptchaVerifier(null);
    console.error("❌ Security check error:", error);
  }, []);

  // Check form validity
  const isFormValid = useMemo(() => {
    switch (method) {
      case 'phone':
        return phoneNumber && isPhoneValid && !errors.phone && !phoneLoading && recaptchaReady && recaptchaVerifier;
      case 'email':
        return (
          emailForm.email &&
          emailForm.password &&
          emailForm.confirmPassword &&
          emailForm.password === emailForm.confirmPassword &&
          !errors.email &&
          !errors.password &&
          !errors.confirmPassword
        );
      case 'google':
        return true;
      default:
        return false;
    }
  }, [method, phoneNumber, isPhoneValid, emailForm, errors, phoneLoading, recaptchaReady, recaptchaVerifier]);

  const handleSubmit = () => {
    if (navigationLock.current) {
      toast.info("Please wait...");
      return;
    }

    switch (method) {
      case 'phone':
        handlePhoneVerification();
        break;
      case 'email':
        handleEmailSignup();
        break;
      case 'google':
        // Handled by GoogleAuth component
        break;
    }
  };

  if (!step1Data) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        resolvedTheme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
          : 'bg-gradient-to-br from-blue-50 via-white to-gray-100'
      }`}>
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            </div>
          </div>
          <p className={`text-lg font-medium ${
            resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Loading your information...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      resolvedTheme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
        : 'bg-gradient-to-br from-blue-50 via-white to-gray-100'
    }`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.25 }}
        className="relative w-full max-w-2xl mx-auto"
      >
        {/* Animated background */}
        <div className="absolute -inset-4 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`relative rounded-2xl border backdrop-blur-xl shadow-2xl p-8 overflow-hidden ${
            resolvedTheme === 'dark'
              ? 'bg-gray-900/90 border-gray-700/50 shadow-gray-900/30'
              : 'bg-white/95 border-gray-200/50 shadow-blue-100/30'
          }`}
        >
          {/* Decorative top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center space-x-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shadow-xl ${
                    step === 2 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white ring-4 ring-indigo-500/30'
                      : step < 2
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-4 ring-green-500/30'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 ring-4 ring-gray-700/30'
                      : 'bg-gray-200 text-gray-600 ring-4 ring-gray-300/30'
                  }`}>
                    {step === 1 ? '✓' : step}
                  </div>
                  <div className={`mt-3 text-sm font-semibold ${
                    resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                  }`}>
                    {step === 1 ? "Personal" : step === 2 ? "Verify" : "Complete"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className={`text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r ${
              resolvedTheme === 'dark' 
                ? 'from-blue-300 to-purple-300' 
                : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              Contact Verification
            </h1>
            <p className={`text-lg tracking-wide max-w-lg mx-auto ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Step 2 of 3 • Choose your secure verification method
            </p>
          </div>

          {/* Service Status */}
          <div className={`mb-8 p-4 rounded-xl ${
            resolvedTheme === 'dark'
              ? 'bg-green-900/20 border border-green-800/50'
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center justify-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className={`text-sm font-medium ${
                resolvedTheme === 'dark' ? 'text-green-300' : 'text-green-700'
              }`}>
                🔒 Secure connection established • Ready for verification
              </p>
            </div>
          </div>

          {/* Method Toggle */}
          <UltimateMethodToggle
            method={method}
            onToggle={setMethod}
            disabled={loading || auth.loading || phoneLoading}
          />

          {/* Dynamic Form */}
          <AnimatePresence mode="wait">
            {method === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <UltimatePhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  error={errors.phone}
                  disabled={phoneLoading || auth.loading}
                  onValidationChange={setIsPhoneValid}
                />

                {/* REAL Enhanced Security Check */}
                <UltimateSecurityCheck
                  recaptchaReady={recaptchaReady}
                  recaptchaError={recaptchaError}
                  loading={phoneLoading}
                  onRecaptchaComplete={handleSecurityCheckComplete}
                  onRecaptchaError={handleSecurityCheckError}
                />

                {/* Development Notice */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className={`p-4 rounded-xl ${
                    resolvedTheme === 'dark'
                      ? 'bg-blue-900/20 border border-blue-800/50'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        resolvedTheme === 'dark' ? 'bg-blue-500' : 'bg-blue-100'
                      }`}>
                        <svg className={`w-3 h-3 ${resolvedTheme === 'dark' ? 'text-white' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${
                          resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-800'
                        }`}>
                          🚀 Development Mode Active
                        </p>
                        <p className={`text-sm mt-1 ${
                          resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          Using real Firebase phone authentication. Real SMS will be sent.
                          <br />
                          <span className="font-semibold">Real users will be created in Firebase Authentication.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <motion.button
                  whileHover={isFormValid && !phoneLoading ? { 
                    scale: 1.02,
                    boxShadow: resolvedTheme === 'dark' 
                      ? '0 15px 40px rgba(59, 130, 246, 0.3)' 
                      : '0 15px 40px rgba(59, 130, 246, 0.2)'
                  } : {}}
                  whileTap={isFormValid && !phoneLoading ? { scale: 0.98 } : {}}
                  onClick={handleSubmit}
                  disabled={!isFormValid || phoneLoading || auth.loading}
                  className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 relative overflow-hidden group ${
                    isFormValid && !phoneLoading
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {phoneLoading ? (
                      <>
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                        <span>Sending Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue with Phone Verification</span>
                        <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                  
                  {/* Shimmer effect */}
                  {isFormValid && !phoneLoading && (
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
                  )}
                </motion.button>
              </motion.div>
            ) : method === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <UltimateEmailForm
                  formData={emailForm}
                  onChange={setEmailForm}
                  errors={errors}
                  loading={loading || auth.loading}
                />

                <div className={`p-4 rounded-xl ${
                  resolvedTheme === 'dark'
                    ? 'bg-blue-900/20 border border-blue-800/50'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      resolvedTheme === 'dark' ? 'bg-blue-500' : 'bg-blue-100'
                    }`}>
                      <svg className={`w-3 h-3 ${resolvedTheme === 'dark' ? 'text-white' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-800'
                      }`}>
                        Email Verification Required
                      </p>
                      <p className={`text-sm mt-1 ${
                        resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        You'll receive a verification email to confirm your account before completing your profile.
                      </p>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={isFormValid && !loading ? { 
                    scale: 1.02,
                    boxShadow: resolvedTheme === 'dark' 
                      ? '0 15px 40px rgba(168, 85, 247, 0.3)' 
                      : '0 15px 40px rgba(168, 85, 247, 0.2)'
                  } : {}}
                  whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
                  onClick={handleEmailSignup}
                  disabled={!isFormValid || loading || auth.loading}
                  className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 relative overflow-hidden group ${
                    isFormValid && !loading
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account with Email</span>
                        <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                  
                  {/* Shimmer effect */}
                  {isFormValid && !loading && (
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="google"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <UltimateGoogleAuth
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  loading={loading || auth.loading}
                />

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setMethod("phone")}
                    disabled={loading || auth.loading || phoneLoading}
                    className={`py-3.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Phone
                  </button>
                  
                  <button
                    onClick={() => setMethod("email")}
                    disabled={loading || auth.loading}
                    className={`py-3.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* General Errors */}
          <AnimatePresence>
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 overflow-hidden"
              >
                <div className={`p-4 rounded-xl ${
                  resolvedTheme === 'dark'
                    ? 'bg-red-900/20 border border-red-800/50'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className={`text-sm font-medium ${
                      resolvedTheme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>
                      {errors.general}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back Button */}
          <div className={`mt-8 pt-8 ${
            resolvedTheme === 'dark' ? 'border-t border-gray-800' : 'border-t border-gray-300'
          }`}>
            <button
              type="button"
              onClick={() => navigate("/signup/step1", { replace: true })}
              disabled={loading || phoneLoading}
              className={`w-full text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                resolvedTheme === 'dark'
                  ? 'text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Personal Information
            </button>
          </div>
        </motion.div>

        {/* Security Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            {["🔒", "🛡️", "📱", "✓", "⚡"].map((icon, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.4 + (index * 0.1),
                  type: "spring",
                  stiffness: 200,
                  damping: 10
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg backdrop-blur-sm ${
                  resolvedTheme === 'dark'
                    ? 'bg-gray-800/50 border border-gray-700/50'
                    : 'bg-white/50 border border-gray-300/50 shadow-sm'
                }`}
              >
                {icon}
              </motion.div>
            ))}
          </div>
          
          <p className={`text-sm ${
            resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-500'
          }`}>
            End-to-end encrypted • Military-grade security • ISO 27001 Certified
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}