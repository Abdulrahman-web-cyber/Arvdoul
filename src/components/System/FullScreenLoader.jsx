import React from "react";
import LoadingSpinner from "../Shared/LoadingSpinner";

export default function FullScreenLoader({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size={48} color="#8b5cf6" />
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            {message}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please wait while we prepare your experience
          </p>
        </div>
      </div>
    </div>
  );
}
