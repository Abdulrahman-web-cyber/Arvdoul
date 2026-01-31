\/\/ src/components/ErrorFallback.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ErrorFallback = ({ error, resetErrorBoundary, errorCount = 0 }) => {
  const navigate = useNavigate();
  
  const handleReset = () => {
    resetErrorBoundary();
  };
  
  const handleGoHome = () => {
    navigate('/');
  };
  
  const handleReload = () => {
    window.location.reload();
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800 p-4">
      <div className="max-w-md w-full bg-surface-0 dark:bg-surface-800 rounded-2xl shadow-2xl p-8 border border-surface-200 dark:border-surface-700">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-error-50 dark:bg-error-900/30 mb-4">
            <AlertTriangle className="w-10 h-10 text-error-600 dark:text-error-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
            Something went wrong
          </h1>
          
          <p className="text-surface-600 dark:text-surface-400 mb-6">
            {errorCount >= 3 
              ? "We're experiencing multiple issues. Please try refreshing the page."
              : "An unexpected error occurred while loading the application."
            }
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-surface-100 dark:bg-surface-700 rounded-lg text-left">
              <p className="text-sm font-mono text-surface-700 dark:text-surface-300 break-all">
                {error?.message || 'Unknown error'}
              </p>
              <details className="mt-2">
                <summary className="text-sm text-surface-500 dark:text-surface-400 cursor-pointer">
                  Stack trace
                </summary>
                <pre className="mt-2 text-xs text-surface-600 dark:text-surface-400 overflow-auto max-h-40">
                  {error?.stack}
                </pre>
              </details>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={handleReset}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full py-3 px-4 bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to homepage
          </button>
          
          {errorCount >= 3 && (
            <button
              onClick={handleReload}
              className="w-full py-3 px-4 bg-surface-200 hover:bg-surface-300 dark:bg-surface-600 dark:hover:bg-surface-500 text-surface-800 dark:text-surface-200 rounded-xl font-semibold transition-colors"
            >
              Reload application
            </button>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
          <p className="text-sm text-surface-500 dark:text-surface-400 text-center">
            Need help?{' '}
            <a 
              href="mailto:support@arvdoul.com" 
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;