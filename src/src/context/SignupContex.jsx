// src/context/SignupContext.jsx
import React, { createContext, useContext, useState } from 'react';

const SignupContext = createContext();

export function SignupProvider({ children }) {
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dob: { day: '', month: '', year: '' },
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const updateSignupData = (updates) => {
    setSignupData(prev => ({ ...prev, ...updates }));
  };

  const value = {
    signupData,
    updateSignupData,
  };

  return (
    <SignupContext.Provider value={value}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (!context) {
    // Return a safe default instead of throwing
    return {
      signupData: {},
      updateSignupData: () => {},
    };
  }
  return context;
}