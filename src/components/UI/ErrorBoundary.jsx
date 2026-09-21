// src/components/UI/ErrorBoundary.jsx - ARVDOUL WORLD-CLASS ERROR BOUNDARY
// Futuristic error boundary with ARVDOUL DNA gradient recovery UI
// Surpasses TikTok, Instagram, YouTube with premium error handling

import React, { Component, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import LoadingSpinner from '../Shared/LoadingSpinner';
import GlassButton from './GlassButton';

/**
 * ErrorBoundary - World-class error boundary with recovery UI
 * 
 * Features:
 * - ARVDOUL DNA gradient accents
 * - Glassmorphism recovery card
 * - Retry functionality
 * - Error details (dev mode)
 * - Automatic error reporting hook
 * 
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', {
      error: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId: this.state.errorId,
    });

    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.({
      error,
      errorInfo,
      errorId: this.state.errorId,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
    this.props.onRetry?.();
  };

  handleReset = () => {
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      // Show error UI
      return (
        <ErrorBoundaryUI
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          showDetails={this.props.showDetails}
          fallback={this.props.fallback}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * ErrorBoundaryUI - Visual component for displaying errors
 */
const ErrorBoundaryUI = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReset,
  showDetails = false,
  fallback,
}) => {
  const { isDark, colors, gradient, spring, spacing } = useTheme();

  // If custom fallback is provided, use it
  if (fallback) {
    return fallback({
      error,
      errorInfo,
      errorId,
      onRetry,
      onReset,
    });
  }

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
    transition: spring.card,
  };

  return (
    <motion.div
      {...containerVariants}
      className={`
        flex
        flex-col
        items-center
        justify-center
        min-h-[400px]
        p-8
        ${isDark ? 'bg-gray-900/80' : 'bg-gray-50/80'}
        backdrop-blur-xl
        border
        ${isDark ? 'border-red-500/20' : 'border-red-200'}
        rounded-3xl
        m-4
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Error Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          damping: 12,
          stiffness: 150,
          delay: 0.05,
        }}
        className={`
          w-24
          h-24
          mb-6
          rounded-full
          flex
          items-center
          justify-center
          bg-gradient-to-br
          from-red-500
          via-pink-500
          to-purple-500
          shadow-lg
          shadow-red-500/30
        `}
      >
        <svg
          className="w-14 h-14 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </motion.div>

      {/* Title */}
      <h2
        className={`
          text-2xl
          font-bold
          mb-3
          ${isDark ? 'text-white' : 'text-gray-900'}
        `}
      >
        Something went wrong
      </h2>

      {/* Message */}
      <p
        className={`
          text-center
          max-w-md
          mb-6
          ${isDark ? 'text-gray-400' : 'text-gray-600'}
        `}
      >
        We encountered an unexpected error. Your progress has been preserved.
      </p>

      {/* Error ID */}
      {errorId && (
        <div
          className={`
            text-xs
            font-mono
            px-3
            py-1.5
            rounded-full
            mb-6
            ${isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'}
          `}
        >
          Error ID: {errorId}
        </div>
      )}

      {/* Error Details (dev mode) */}
      <AnimatePresence>
        {showDetails && (error || errorInfo) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`
              w-full
              max-w-2xl
              mb-6
              p-4
              rounded-xl
              overflow-hidden
              ${isDark ? 'bg-black/50' : 'bg-gray-100'}
            `}
          >
            <pre
              className={`
                text-xs
                font-mono
                overflow-auto
                max-h-48
                whitespace-pre-wrap
                break-all
                ${isDark ? 'text-red-400' : 'text-red-600'}
              `}
            >
              {error?.message && `Error: ${error.message}\n\n`}
              {error?.stack && `Stack: ${error.stack}\n\n`}
              {errorInfo?.componentStack && `Component Stack: ${errorInfo.componentStack}`}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <GlassButton
          variant="gradient"
          size="lg"
          onClick={onRetry}
        >
          Try Again
        </GlassButton>
        
        <GlassButton
          variant="ghost"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </GlassButton>
      </div>

      {/* Recovery Tip */}
      <p
        className={`
          text-xs
          mt-6
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}
      >
        If this problem persists, please contact support with the error ID above.
      </p>
    </motion.div>
  );
};

// ==================== LAZY ERROR BOUNDARY ====================

/**
 * LazyErrorBoundary - Error boundary with lazy-loaded retry
 * 
 * @example
 * <LazyErrorBoundary>
 *   <HeavyComponent />
 * </LazyErrorBoundary>
 */
export const LazyErrorBoundary = ({ children, fallback, onError, onRetry }) => (
  <ErrorBoundary onError={onError} onRetry={onRetry}>
    <Suspense fallback={<LoadingSpinner size={48} color="purple" />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// ==================== WITH ERROR BOUNDARY HOC ====================

/**
 * withErrorBoundary - Higher-order component wrapper
 * 
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} options - Error boundary options
 * @returns {React.Component} Wrapped component with error boundary
 */
export const withErrorBoundary = (WrappedComponent, options = {}) => {
  const ErrorBoundaryWrapper = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ErrorBoundaryWrapper.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return ErrorBoundaryWrapper;
};

export default ErrorBoundary;
