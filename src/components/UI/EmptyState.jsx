// src/components/UI/EmptyState.jsx - ARVDOUL WORLD-CLASS EMPTY STATE
// Futuristic empty state with ARVDOUL DNA gradient accents
// Surpasses TikTok, Instagram, YouTube with premium UI

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import GlassButton from './GlassButton';

/**
 * EmptyState - World-class empty state component
 * 
 * Features:
 * - ARVDOUL DNA gradient accents
 * - Glassmorphism container
 * - Animated illustration
 * - Action button
 * - Full accessibility
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon or illustration
 * @param {string} props.title - Main message
 * @param {string} props.description - Secondary message
 * @param {string} props.actionLabel - Button label
 * @param {Function} props.onAction - Button handler
 */
const EmptyState = memo(({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className = '',
}) => {
  const { isDark, colors, gradient, spring, spacing } = useTheme();

  // Animation variants
  const containerVariants = useMemo(() => ({
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: spring.card,
  }), [spring.card]);

  const iconVariants = useMemo(() => ({
    initial: { scale: 0, rotate: -180 },
    animate: { 
      scale: 1, 
      rotate: 0,
      transition: {
        type: 'spring',
        damping: 15,
        stiffness: 200,
        delay: 0.1,
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
        ${isDark ? 'bg-white/5' : 'bg-white/50'}
        backdrop-blur-xl
        border
        ${isDark ? 'border-white/10' : 'border-gray-200'}
        rounded-3xl
        ${className}
      `}
      role="status"
      aria-live="polite"
    >
      {/* Animated Icon */}
      {Icon && (
        <motion.div
          {...iconVariants}
          className={`
            w-24
            h-24
            mb-6
            rounded-full
            flex
            items-center
            justify-center
            ${isDark ? 'bg-white/10' : 'bg-gray-100'}
          `}
        >
          <div 
            className="w-16 h-16 flex items-center justify-center"
            style={{
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            <Icon className="w-16 h-16" />
          </div>
        </motion.div>
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

      {/* Description */}
      {description && (
        <p
          className={`
            text-sm
            max-w-sm
            mb-6
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          {description}
        </p>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <GlassButton
          variant="gradient"
          size="md"
          onClick={onAction}
          icon={ActionIcon}
        >
          {actionLabel}
        </GlassButton>
      )}
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;

// ==================== PRESET EMPTY STATES ====================

/**
 * Preset: No Videos
 */
EmptyState.NoVideos = memo(({ onRefresh }) => (
  <EmptyState
    icon={({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )}
    title="No videos yet"
    description="Follow creators to see their latest videos in your feed"
    actionLabel="Refresh"
    onAction={onRefresh}
  />
));

EmptyState.NoVideos.displayName = 'EmptyState.NoVideos';

/**
 * Preset: No Posts
 */
EmptyState.NoPosts = memo(({ onCreate }) => (
  <EmptyState
    icon={({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )}
    title="No posts yet"
    description="Be the first to share something amazing"
    actionLabel="Create Post"
    onAction={onCreate}
  />
));

EmptyState.NoPosts.displayName = 'EmptyState.NoPosts';

/**
 * Preset: No Messages
 */
EmptyState.NoMessages = memo(({ onMessage }) => (
  <EmptyState
    icon={({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )}
    title="No messages yet"
    description="Start a conversation with someone special"
    actionLabel="Send Message"
    onAction={onMessage}
  />
));

EmptyState.NoMessages.displayName = 'EmptyState.NoMessages';

/**
 * Preset: No Notifications
 */
EmptyState.NoNotifications = memo(() => (
  <EmptyState
    icon={({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )}
    title="All caught up!"
    description="You have no new notifications"
  />
));

EmptyState.NoNotifications.displayName = 'EmptyState.NoNotifications';

/**
 * Preset: No Results
 */
EmptyState.NoResults = memo(({ query, onClear }) => (
  <EmptyState
    icon={({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )}
    title="No results found"
    description={query ? `No results for "${query}"` : "Try a different search term"}
    actionLabel={query ? "Clear Search" : undefined}
    onAction={onClear}
  />
));

EmptyState.NoResults.displayName = 'EmptyState.NoResults';
