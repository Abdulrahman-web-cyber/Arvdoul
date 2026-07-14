// src/components/UI/ErrorState.jsx - ARVDOUL WORLD-CLASS ERROR STATE
// Futuristic error state with ARVDOUL DNA gradient accents
// Surpasses TikTok, Instagram, YouTube with premium UI

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import GlassButton from './GlassButton';

/**
 * ErrorState - World-class error state component
 * 
 * Features:
 * - ARVDOUL DNA gradient accents
 * - Glassmorphism container
 * - Retry functionality
 * - Error details
 * - Full accessibility
 * 
 * @param {Object} props
 * @param {string} props.title - Error title
 * @param {string} props.message - Error description
 * @param {string} props.code - Error code
 * @param {Function} props.onRetry - Retry handler
 * @param {Function} props.onDismiss - Dismiss handler
 */
const ErrorState = memo(({
  title = "Something went wrong",
  message = "We encountered an error while loading this content.",
  code,
  onRetry,
  onDismiss,
  severity = 'error', // 'error' | 'warning' | 'info'
  className = '',
}) => {
  const { isDark, colors, gradient, spring, spacing } = useTheme();

  // Severity colors
  const severityConfig = useMemo(() => {
    const configs = {
      error: {
        icon: (
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        gradient: 'from-red-500 via-pink-500 to-red-400',
        border: isDark ? 'border-red-500/30' : 'border-red-200',
        bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
        text: isDark ? 'text-red-400' : 'text-red-600',
      },
      warning: {
        icon: (
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        gradient: 'from-amber-500 via-orange-500 to-amber-400',
        border: isDark ? 'border-amber-500/30' : 'border-amber-200',
        bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
        text: isDark ? 'text-amber-400' : 'text-amber-600',
      },
      info: {
        icon: (
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        gradient: 'from-blue-500 via-indigo-500 to-blue-400',
        border: isDark ? 'border-blue-500/30' : 'border-blue-200',
        bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
        text: isDark ? 'text-blue-400' : 'text-blue-600',
      },
    };
    return configs[severity] || configs.error;
  }, [severity, isDark]);

  // Animation variants
  const containerVariants = useMemo(() => ({
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -20 },
    transition: spring.card,
  }), [spring.card]);

  const iconVariants = useMemo(() => ({
    initial: { scale: 0, rotate: -90 },
    animate: { 
      scale: 1, 
      rotate: 0,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 180,
        delay: 0.05,
      },
    },
  }), []);

  return (
    <motion.div
      {...containerVariants}
      className={`
        flex
        flex-col
        items-center
        justify-center
        p-8
        text-center
        ${severityConfig.bg}
        backdrop-blur-xl
        border
        ${severityConfig.border}
        rounded-3xl
        ${className}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Animated Icon */}
      <motion.div
        {...iconVariants}
        className={`
          w-20
          h-20
          mb-6
          rounded-full
          flex
          items-center
          justify-center
          ${isDark ? 'bg-white/10' : 'bg-white'}
          shadow-lg
        `}
      >
        <div 
          className="w-14 h-14"
          style={{
            color: severity === 'error' ? '#EF4444' : severity === 'warning' ? '#F59E0B' : '#3B82F6',
          }}
        >
          {severityConfig.icon}
        </div>
      </motion.div>

      {/* Error Code */}
      {code && (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`
            text-xs
            font-mono
            px-2
            py-1
            rounded-full
            mb-3
            ${isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'}
          `}
        >
          {code}
        </motion.span>
      )}

      {/* Title */}
      <h3
        className={`
          text-xl
          font-bold
          mb-2
          ${isDark ? 'text-white' : 'text-gray-900'}
        `}
      >
        {title}
      </h3>

      {/* Message */}
      {message && (
        <p
          className={`
            text-sm
            max-w-md
            mb-6
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          {message}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRetry && (
          <GlassButton
            variant="gradient"
            size="md"
            onClick={onRetry}
            icon={RefreshIcon}
          >
            Try Again
          </GlassButton>
        )}
        
        {onDismiss && (
          <GlassButton
            variant="ghost"
            size="md"
            onClick={onDismiss}
          >
            Dismiss
          </GlassButton>
        )}
      </div>
    </motion.div>
  );
});

ErrorState.displayName = 'ErrorState';

// ==================== REFRESH ICON ====================

const RefreshIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default ErrorState;

// ==================== PRESET ERROR STATES ====================

/**
 * Preset: Network Error
 */
ErrorState.Network = memo(({ onRetry }) => (
  <ErrorState
    title="Connection lost"
    message="Please check your internet connection and try again."
    code="ERR_NETWORK"
    severity="warning"
    onRetry={onRetry}
  />
));

ErrorState.Network.displayName = 'ErrorState.Network';

/**
 * Preset: Server Error
 */
ErrorState.Server = memo(({ onRetry }) => (
  <ErrorState
    title="Server error"
    message="Our servers are having trouble. Please try again in a few moments."
    code="ERR_SERVER"
    severity="error"
    onRetry={onRetry}
  />
));

ErrorState.Server.displayName = 'ErrorState.Server';

/**
 * Preset: Auth Error
 */
ErrorState.Auth = memo(({ onLogin }) => (
  <ErrorState
    title="Session expired"
    message="Please sign in again to continue."
    code="ERR_AUTH"
    severity="warning"
    onRetry={onLogin}
  />
));

ErrorState.Auth.displayName = 'ErrorState.Auth';

/**
 * Preset: Not Found
 */
ErrorState.NotFound = memo(({ onGoBack }) => (
  <ErrorState
    title="Content not found"
    message="The content you're looking for doesn't exist or has been removed."
    code="ERR_NOT_FOUND"
    severity="info"
    onRetry={onGoBack}
  />
));

ErrorState.NotFound.displayName = 'ErrorState.NotFound';
