import React from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import { cn } from "../lib/utils";

const logoLight = "/logo/logo-light.png";
const logoDark = "/logo/logo-dark.png";

const AuthLayout = () => {
  const location = useLocation();
  const showLogo = location.pathname !== "/intro";
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center px-4 py-8 bg-gray-100 dark:bg-zinc-900",
        "transition-colors duration-300 ease-in-out",
      )}
    >
      <div className="w-full max-w-md md:max-w-lg space-y-8 bg-white dark:bg-zinc-800 shadow-xl rounded-2xl p-6 sm:p-8">
        {showLogo && (
          <div className="flex justify-center">
            <img
              src={theme === "dark" ? logoDark : logoLight}
              alt="Arvdoul Logo"
              className="w-16 h-16 rounded-full animate-fadeIn"
            />
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
