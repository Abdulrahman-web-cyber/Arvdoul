\/\/ src/screens/SignupStep1Personal.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

\/\/ Advanced input component with futuristic features
const AdvancedInput = ({ 
  label, 
  value, 
  onChange, 
  error, 
  type = "text",
  placeholder,
  autoFocus = false,
  onKeyPress,
  disabled = false,
  theme
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div className="relative">
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
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyPress={onKeyPress}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full px-4 py-4 bg-transparent outline-none text-lg ${
            theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
          }`}
        />
        
        {/* Animated label */}
        <motion.label
          className={`absolute left-4 pointer-events-none transition-all duration-300 ${
            value || isFocused 
              ? 'top-2 text-xs font-medium' 
              : 'top-4 text-base'
          } ${
            error 
              ? 'text-red-500' 
              : isFocused 
              ? 'text-indigo-500' 
              : theme === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-500'
          }`}
        >
          {label}
        </motion.label>

        {/* Focus indicator line */}
        <motion.div
          className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${
            isFocused ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-transparent'
          }`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isFocused ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>

      {/* Error message with animation */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 text-sm text-red-500 flex items-center gap-2"
          >
            <span className="text-lg">⚠️</span>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

\/\/ Advanced select component
const AdvancedSelect = ({ 
  label, 
  value, 
  onChange, 
  options, 
  error, 
  theme 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={selectRef}>
      <motion.div
        className={`relative rounded-xl border-2 transition-all duration-300 cursor-pointer ${
          error 
            ? "border-red-500 shadow-lg shadow-red-500/20" 
            : isOpen 
            ? "border-indigo-500 shadow-lg shadow-indigo-500/20" 
            : theme === 'dark' 
            ? "border-gray-600" 
            : "border-gray-300"
        }`}
        whileHover={{ scale: 1.02 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="px-4 py-4">
          <div className={`text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {selectedOption ? selectedOption.label : label}
          </div>
        </div>

        {/* Dropdown arrow */}
        <motion.div
          className="absolute right-4 top-1/2 transform -translate-y-1/2"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            ▼
          </span>
        </motion.div>
      </motion.div>

      {/* Dropdown options */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`absolute top-full left-0 right-0 mt-2 rounded-xl border-2 shadow-2xl z-50 ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-300'
            }`}
          >
            {options.map((option, index) => (
              <motion.div
                key={option.value}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-700 text-white' 
                    : 'hover:bg-gray-100 text-gray-900'
                } ${option.value === value ? 'bg-indigo-500 text-white' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                whileHover={{ scale: 1.02 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 text-sm text-red-500 flex items-center gap-2"
          >
            <span className="text-lg">⚠️</span>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

\/\/ Enhanced DOB Selector with age calculation
const DOBSelector = ({ value, onChange, error, theme }) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Date of Birth
        </label>
        {age !== null && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-sm px-3 py-1 rounded-full ${
              age >= 13 
                ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                : 'bg-red-500/20 text-red-600 dark:text-red-400'
            }`}
          >
            Age: {age}
          </motion.span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Day Selector */}
        <AdvancedSelect
          label="Day"
          value={value.day}
          onChange={(day) => onChange({ ...value, day })}
          options={days.map(day => ({ value: day, label: day }))}
          theme={theme}
        />

        {/* Month Selector */}
        <AdvancedSelect
          label="Month"
          value={value.month}
          onChange={(month) => onChange({ ...value, month })}
          options={months}
          theme={theme}
        />

        {/* Year Selector */}
        <AdvancedSelect
          label="Year"
          value={value.year}
          onChange={(year) => onChange({ ...value, year })}
          options={years.map(year => ({ value: year, label: year }))}
          theme={theme}
        />
      </div>

      {/* DOB Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-red-500 flex items-center gap-2"
          >
            <span className="text-lg">⚠️</span>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

\/\/ Main component
export default function SignupStep1Personal() {
  const navigate = useNavigate();
  const { signupData, updateSignupData, theme } = useSignup();

  const [localData, setLocalData] = useState({
    firstName: signupData.firstName || "",
    lastName: signupData.lastName || "",
    gender: signupData.gender || "",
    dob: signupData.dob || { day: "", month: "", year: "" },
    username: signupData.username || "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState({});

  const firstNameRef = useRef(null);

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  \/\/ Real-time validation
  useEffect(() => {
    const newValidationStatus = {};
    
    \/\/ First Name validation
    if (localData.firstName) {
      if (localData.firstName.length < 2) {
        newValidationStatus.firstName = "Too short (min 2 chars)";
      } else if (!/^[a-zA-Z\s]+$/.test(localData.firstName)) {
        newValidationStatus.firstName = "Only letters allowed";
      } else {
        newValidationStatus.firstName = "valid";
      }
    }

    \/\/ Last Name validation
    if (localData.lastName) {
      if (localData.lastName.length < 2) {
        newValidationStatus.lastName = "Too short (min 2 chars)";
      } else if (!/^[a-zA-Z\s]+$/.test(localData.lastName)) {
        newValidationStatus.lastName = "Only letters allowed";
      } else {
        newValidationStatus.lastName = "valid";
      }
    }

    \/\/ Age validation
    if (localData.dob.day && localData.dob.month && localData.dob.year) {
      const birthDate = new Date(localData.dob.year, localData.dob.month - 1, localData.dob.day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13) {
        newValidationStatus.dob = "Must be 13+ years old";
      } else if (age > 120) {
        newValidationStatus.dob = "Please enter a valid age";
      } else {
        newValidationStatus.dob = "valid";
      }
    }

    setValidationStatus(newValidationStatus);
  }, [localData]);

  \/\/ Enhanced validation with detailed error messages
  const validate = async () => {
    const newErrors = {};

    \/\/ First Name validation
    if (!localData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (localData.firstName.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s]+$/.test(localData.firstName)) {
      newErrors.firstName = "First name can only contain letters";
    }

    \/\/ Last Name validation
    if (!localData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    } else if (localData.lastName.length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s]+$/.test(localData.lastName)) {
      newErrors.lastName = "Last name can only contain letters";
    }

    \/\/ Gender validation
    if (!localData.gender) {
      newErrors.gender = "Please select your gender";
    }

    \/\/ Date of Birth validation
    if (!localData.dob.day || !localData.dob.month || !localData.dob.year) {
      newErrors.dob = "Please complete your date of birth";
    } else {
      const birthDate = new Date(localData.dob.year, localData.dob.month - 1, localData.dob.day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13) {
        newErrors.dob = "You must be at least 13 years old to join";
      } else if (age > 120) {
        newErrors.dob = "Please enter a valid date of birth";
      }
    }

    \/\/ Username uniqueness check
    if (localData.username && localData.username.trim()) {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", localData.username.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          newErrors.username = "Username is already taken";
        }
      } catch (err) {
        console.error("Username validation error:", err);
        toast.error("Could not validate username. Try again.");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (!(await validate())) {
        toast.error("Please fix the errors before proceeding.");
        setLoading(false);
        return;
      }

      \/\/ Auto-capitalize names
      const capitalizedData = {
        ...localData,
        firstName: localData.firstName.trim().replace(/\b\w/g, l => l.toUpperCase()),
        lastName: localData.lastName.trim().replace(/\b\w/g, l => l.toUpperCase()),
      };

      \/\/ Commit to signup context
      updateSignupData({ ...capitalizedData });
      
      \/\/ Success animation delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate("/signup/step2");
    } catch (err) {
      console.error("handleNext error:", err);
      toast.error(err?.message || "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  \/\/ Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const isFormValid = 
    localData.firstName?.length >= 2 &&
    localData.lastName?.length >= 2 &&
    localData.gender &&
    localData.dob.day &&
    localData.dob.month &&
    localData.dob.year;

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 8 + 4,
              height: Math.random() * 8 + 4,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.1)" 
                : "rgba(79,70,229,0.08)",
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: Math.random() * 6 + 4,
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
        {/* Progress indicator */}
        <motion.div 
          className="flex items-center justify-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 1 
                    ? 'bg-indigo-600 text-white' 
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-1 mx-2 ${
                    step === 1 
                      ? 'bg-indigo-600' 
                      : theme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-gray-300'
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
          } p-8 md:p-10`}
        >
          <header className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Create Your Account
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Step 1 • Personal Information
            </motion.p>
          </header>

          <div className="space-y-6">
            {/* Name fields side by side */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <AdvancedInput
                label="First Name"
                value={localData.firstName}
                onChange={(e) => setLocalData({ ...localData, firstName: e.target.value })}
                error={errors.firstName}
                placeholder="John"
                autoFocus={true}
                onKeyPress={handleKeyPress}
                theme={theme}
              />

              <AdvancedInput
                label="Last Name"
                value={localData.lastName}
                onChange={(e) => setLocalData({ ...localData, lastName: e.target.value })}
                error={errors.lastName}
                placeholder="Doe"
                onKeyPress={handleKeyPress}
                theme={theme}
              />
            </motion.div>

            {/* Gender Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <AdvancedSelect
                label="Select Gender"
                value={localData.gender}
                onChange={(gender) => setLocalData({ ...localData, gender })}
                options={[
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                ]}
                error={errors.gender}
                theme={theme}
              />
            </motion.div>

            {/* Date of Birth */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <DOBSelector
                value={localData.dob}
                onChange={(dob) => setLocalData({ ...localData, dob })}
                error={errors.dob}
                theme={theme}
              />
            </motion.div>

            {/* Optional Username */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <AdvancedInput
                label="Username (optional)"
                value={localData.username}
                onChange={(e) => setLocalData({ ...localData, username: e.target.value })}
                error={errors.username}
                placeholder="johndoe123"
                onKeyPress={handleKeyPress}
                theme={theme}
              />
              <p className={`text-xs mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Choose a unique username. If not provided, we'll generate one for you.
              </p>
            </motion.div>

            {/* Continue Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={isFormValid && !loading ? { scale: 1.02 } : {}}
              whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
              onClick={handleNext}
              disabled={!isFormValid || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 ${
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
                  Validating...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Continue to Step 2
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </div>
              )}
            </motion.button>

            {/* Login link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center"
            >
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-indigo-500 hover:text-indigo-400 font-semibold underline transition-colors"
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}