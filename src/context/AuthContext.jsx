import React, { createContext, useContext } from "react";
import { useUser } from "./UserContext";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { user, loading, isInitialized, logout, updateProfileData } = useUser();

  return (
    <AuthContext.Provider value={{ user, loading, isInitialized, logout, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);