import React from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const AuthLayout = () => {
  const location = useLocation();
  const showLogo = location.pathname !== "/intro";
  const { resolvedTheme } = useTheme();

  const logoLight = "/logo/logo-light.png";
  const logoDark = "/logo/logo-dark.png";

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      <div className="w-full min-h-screen">
        {showLogo && (
          <div className="flex justify-center pt-8 pb-4">
            <img
              src={resolvedTheme === "dark" ? logoDark : logoLight}
              alt="Arvdoul Logo"
              className="w-16 h-16 rounded-full object-cover"
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
