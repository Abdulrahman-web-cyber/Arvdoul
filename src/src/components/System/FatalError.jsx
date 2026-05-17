import React from "react";

export default function FatalError({ 
  title = "Something went wrong", 
  error, 
  errorInfo,
  showReload = true 
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
            <span className="text-3xl text-red-600 dark:text-red-400">⚠️</span>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {title}
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We encountered an unexpected error. Our team has been notified.
          </p>
          
          {error && (
            <div className="mb-6 text-left">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error details:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-xs text-gray-800 dark:text-gray-200 overflow-auto max-h-40">
                {error.toString()}
              </pre>
            </div>
          )}
          
          {showReload && (
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Reload Application
              </button>
              
              <button
                onClick={() => window.location.href = "/"}
                className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200"
              >
                Return to Home
              </button>
            </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              If the problem persists, please contact support@arvdoul.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
