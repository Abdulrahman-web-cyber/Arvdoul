import React, { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useLocation } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import SplashScreen from "./screens/SplashScreen";

export default function App() {
  const { isInitialized } = useAuth();
  const location = useLocation(); // get current route
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (isInitialized) {
      const timer = setTimeout(() => setShowSplash(false), 3000); // splash min 3s
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Show splash only on root route "/" (or wherever you want)
  if (!isInitialized || (location.pathname === "/" && showSplash)) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <SplashScreen />
      </div>
    );
  }

  // Render the actual app routes after splash
  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <AppRoutes />
    </div>
  );
}