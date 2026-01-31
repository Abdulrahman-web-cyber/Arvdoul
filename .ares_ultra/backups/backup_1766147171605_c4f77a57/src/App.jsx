import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext.jsx';

// Lazy load components
const SplashScreen = React.lazy(() => import('./screens/SplashScreen.jsx'));
const IntroScreen = React.lazy(() => import('./screens/IntroScreen.jsx'));

function LoadingFallback() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Arvdoul</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading interface...</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { theme } = useTheme();

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/intro" element={<IntroScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
