// src/layouts/AuthLayout.jsx - FIXED VERSION
import React from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const AuthLayout = () => {
  const location = useLocation();
  const showLogo = location.pathname !== "/intro";
  const { resolvedTheme } = useTheme();

  // Define logo paths
  const logoLight = "/logo/logo-light.png";
  const logoDark = "/logo/logo-dark.png";

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        {showLogo && (
          <div className="flex justify-center mb-6">
            <img
              src={resolvedTheme === "dark" ? logoDark : logoLight}
              alt="Arvdoul Logo"
              className="w-16 h-16 rounded-full"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/logo/logo-default.png";
              }}
            />
          </div>
        )}
        
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;