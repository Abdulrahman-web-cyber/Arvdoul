import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
        Welcome to Arvdoul!
      </h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        This is the main application after splash screen.
      </p>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        Toggle Theme (Current: {theme})
      </button>
    </div>
  );
}
