// src/components/AdvancedPhoneInput.jsx - PERFECT PHONE INPUT
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sortedCountryCodes } from "@data/countryCodes";

const AdvancedPhoneInput = React.memo(({ 
  value = "", 
  onChange, 
  error, 
  theme,
  disabled = false,
  autoFocus = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(() => 
    sortedCountryCodes.find(c => c.code === '+1') || sortedCountryCodes[0]
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const phoneInputRef = useRef(null);
  const countryButtonRef = useRef(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const match = value.match(/^(\+\d{1,4})(\d+)$/);
      if (match) {
        const foundCountry = sortedCountryCodes.find(c => c.code === match[1]);
        if (foundCountry) {
          setSelectedCountry(foundCountry);
          setPhoneNumber(match[2]);
        }
      }
    }
  }, [value]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return sortedCountryCodes;
    
    const query = searchQuery.toLowerCase();
    return sortedCountryCodes.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query) ||
      country.region.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle country selection
  const handleCountrySelect = useCallback((country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSearchQuery("");
    
    // Update parent with new full phone number
    if (phoneNumber) {
      onChange(`${country.code}${phoneNumber}`);
    }
    
    // Focus phone input after selection
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 50);
  }, [phoneNumber, onChange]);

  // Handle phone number change
  const handlePhoneNumberChange = useCallback((e) => {
    const input = e.target.value.replace(/\D/g, '');
    setPhoneNumber(input);
    setIsTyping(true);
    
    // Format with spaces for better readability
    const formatted = formatPhoneNumber(input, selectedCountry.code);
    setPhoneNumber(formatted);
    
    // Update parent with full phone number
    onChange(`${selectedCountry.code}${input}`);
    
    // Reset typing indicator
    setTimeout(() => setIsTyping(false), 500);
  }, [selectedCountry.code, onChange]);

  // Format phone number based on country
  const formatPhoneNumber = useCallback((number, countryCode) => {
    if (!number) return "";
    
    // Different formatting patterns based on country
    const patterns = {
      '+1': (num) => num.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
      '+44': (num) => num.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3'),
      '+91': (num) => num.replace(/(\d{5})(\d{5})/, '$1 $2'),
      '+86': (num) => num.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3'),
      // Default formatting
      default: (num) => {
        if (num.length <= 4) return num;
        if (num.length <= 7) return num.replace(/(\d{4})/, '$1 ');
        return num.replace(/(\d{4})(\d{3})/, '$1 $2');
      }
    };
    
    const formatter = patterns[countryCode] || patterns.default;
    return formatter(number);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
        setSearchQuery("");
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (showCountryDropdown && searchRef.current) {
      setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
    }
  }, [showCountryDropdown]);

  // Auto focus phone input
  useEffect(() => {
    if (autoFocus && phoneInputRef.current && !showCountryDropdown) {
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 300);
    }
  }, [autoFocus, showCountryDropdown]);

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className={`block text-sm font-medium tracking-wide transition-colors duration-200 ${
        error 
          ? 'text-red-600 dark:text-red-400' 
          : isFocused || phoneNumber
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        Mobile Phone Number <span className="text-red-500">*</span>
      </label>

      {/* Phone Input Container */}
      <div className="relative">
        <div className={`flex items-stretch rounded-lg border transition-all duration-200 ${
          error
            ? 'border-red-500 dark:border-red-400 shadow-red-500/10'
            : isFocused
            ? theme === 'dark'
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
              : 'border-indigo-500 shadow-lg shadow-indigo-500/20'
            : theme === 'dark'
            ? 'border-gray-700 hover:border-gray-600'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          
          {/* Country Code Selector */}
          <div className="relative" ref={countryButtonRef}>
            <button
              type="button"
              onClick={() => !disabled && setShowCountryDropdown(!showCountryDropdown)}
              disabled={disabled}
              className={`flex items-center gap-2 px-3 py-3 border-r transition-all ${
                theme === 'dark' 
                  ? 'border-gray-700 bg-gray-800/50 text-gray-200 hover:bg-gray-800'
                  : 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} rounded-l-lg`}
              aria-label="Select country code"
            >
              <span className={`font-medium text-sm ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>
                {selectedCountry.code}
              </span>
              <svg 
                className={`w-4 h-4 transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Phone Number Input */}
          <div className="flex-1 relative">
            <input
              ref={phoneInputRef}
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder="Enter your phone number"
              className={`w-full px-3 py-3 bg-transparent outline-none text-base ${
                theme === 'dark' 
                  ? 'text-white placeholder-gray-500' 
                  : 'text-gray-900 placeholder-gray-400'
              } ${disabled ? 'cursor-not-allowed' : ''}`}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
            />
            
            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((dot) => (
                    <motion.div
                      key={dot}
                      className="w-1 h-1 rounded-full bg-indigo-500"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ 
                        duration: 0.6, 
                        repeat: Infinity, 
                        delay: dot * 0.2 
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Country Dropdown */}
        <AnimatePresence>
          {showCountryDropdown && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-2xl z-50 max-h-80 ${
                theme === 'dark' 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-white border-gray-200'
              }`}
              style={{
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Search Input */}
              <div className="p-3 border-b sticky top-0 bg-inherit z-10">
                <div className="relative">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm ${
                      theme === 'dark' 
                        ? 'bg-gray-800 text-white placeholder-gray-400' 
                        : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  <svg 
                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Country List */}
              <div className="overflow-y-auto max-h-64">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => (
                    <motion.button
                      key={`${country.code}-${country.iso}`}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between ${
                        selectedCountry.code === country.code
                          ? theme === 'dark'
                            ? 'bg-indigo-900/40 text-indigo-300'
                            : 'bg-indigo-50 text-indigo-700'
                          : theme === 'dark'
                          ? 'hover:bg-gray-800 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                      whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(243, 244, 246, 0.8)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-4 rounded-sm overflow-hidden border ${
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                        }`}>
                          {/* Country flag placeholder - could implement with flag icons */}
                          <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${
                            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                          }`}>
                            {country.iso}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-sm">{country.name}</div>
                          <div className="text-xs opacity-75">{country.region}</div>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-medium">
                        {country.code}
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="p-4 text-center">
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      No countries found
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border border-red-200 dark:border-red-800/50">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {!error && phoneNumber && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Valid phone number • Format: {selectedCountry.code} {phoneNumber}
          </span>
        </motion.div>
      )}
    </div>
  );
});

AdvancedPhoneInput.displayName = 'AdvancedPhoneInput';

export default AdvancedPhoneInput;