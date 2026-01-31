import React, { Suspense } from "react";
import AppRoutes from "./routes/AppRoutes.jsx";
import { useTheme } from "./context/ThemeContext.jsx";

export default function App() {
  const { theme } = useTheme();

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <Suspense fallback={<ArvdoulBootScreen />}>
        <AppRoutes />
      </Suspense>
    </div>
  );
}

function ArvdoulBootScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <span className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Arvdoul
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Initializing platform…
        </span>
      </div>
    </div>
  );
}