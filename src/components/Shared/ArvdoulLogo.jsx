// src/components/Shared/ArvdoulLogo.jsx - ARVDOUL OFFICIAL BRAND LOGO SYSTEM
import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

/**
 * ArvdoulEmblem - Precision faceted geometric "A" vector emblem
 * Featuring 3D polygonal gradients (Cyan left facet, Royal blue core, Magenta/Purple right facet)
 */
export const ArvdoulEmblem = memo(({ size = 32, className = '' }) => {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 ${className}`}
      aria-label="ARVDOUL Emblem"
    >
      <defs>
        {/* Left facet gradient: Neon Cyan -> Vivid Sky Blue */}
        <linearGradient id="arvdoul-cyan-facet" x1="6" y1="42" x2="22" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="60%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        {/* Right facet gradient: Royal Violet -> Vivid Pink/Magenta */}
        <linearGradient id="arvdoul-purple-facet" x1="42" y1="42" x2="26" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* Center / crossbar facet gradient: Deep Indigo -> Cobalt */}
        <linearGradient id="arvdoul-center-facet" x1="14" y1="26" x2="34" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Outer ambient glow */}
        <filter id="arvdoul-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8B5CF6" floodOpacity="0.35" />
        </filter>
      </defs>

      <g filter="url(#arvdoul-glow)">
        {/* Left wing facet */}
        <path
          d="M24 6L6 42H16L24 24L20 15L24 6Z"
          fill="url(#arvdoul-cyan-facet)"
        />

        {/* Right wing facet */}
        <path
          d="M24 6L42 42H32L24 24L28 15L24 6Z"
          fill="url(#arvdoul-purple-facet)"
        />

        {/* Center crossbar bridge */}
        <path
          d="M13.5 32L24 18L34.5 32H28L24 26L20 32H13.5Z"
          fill="url(#arvdoul-center-facet)"
        />

        {/* Subtle highlight sheen on apex */}
        <polygon
          points="24,6 21,12 24,14 27,12"
          fill="#FFFFFF"
          fillOpacity="0.4"
        />
      </g>
    </svg>
  );
});

ArvdoulEmblem.displayName = 'ArvdoulEmblem';
ArvdoulEmblem.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

/**
 * ArvdoulWordmark - Clean, geometric, tracking-wide brand wordmark
 */
export const ArvdoulWordmark = memo(({ 
  variant = 'gradient', // 'gradient' | 'white' | 'dark' | 'auto'
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className = '',
}) => {
  const sizeClasses = {
    xs: 'text-xs tracking-[0.18em]',
    sm: 'text-sm tracking-[0.2em]',
    md: 'text-base sm:text-lg tracking-[0.22em]',
    lg: 'text-xl sm:text-2xl tracking-[0.24em]',
    xl: 'text-2xl sm:text-3xl tracking-[0.26em]',
  };

  const variantClasses = {
    gradient: 'bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent drop-shadow-sm',
    white: 'text-white drop-shadow-md',
    dark: 'text-gray-900 dark:text-white',
    auto: 'text-gray-900 dark:text-white',
  };

  return (
    <span
      className={`font-black font-sans select-none uppercase inline-block ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.gradient} ${className}`}
      style={{ letterSpacing: '0.22em' }}
    >
      ARVDOUL
    </span>
  );
});

ArvdoulWordmark.displayName = 'ArvdoulWordmark';
ArvdoulWordmark.propTypes = {
  variant: PropTypes.oneOf(['gradient', 'white', 'dark', 'auto']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  className: PropTypes.string,
};

/**
 * ArvdoulLogo - Full brand component (Emblem + Wordmark)
 */
const ArvdoulLogo = memo(({
  variant = 'full', // 'full' | 'emblem' | 'wordmark' | 'compact'
  theme = 'auto', // 'auto' | 'dark' | 'light' | 'white'
  size = 'md',
  clickable = true,
  onClick,
  className = '',
}) => {
  const navigate = useNavigate();

  const emblemSizes = {
    xs: 20,
    sm: 26,
    md: 32,
    lg: 40,
    xl: 48,
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (clickable) {
      navigate('/home');
    }
  };

  const emblemSize = emblemSizes[size] || 32;

  const wordmarkVariant = theme === 'white' ? 'white' : theme === 'light' ? 'dark' : 'auto';

  return (
    <div
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          handleClick(e);
        }
      }}
      className={`inline-flex items-center gap-2.5 transition-transform duration-200 ${
        clickable ? 'cursor-pointer hover:opacity-95 active:scale-[0.98]' : ''
      } ${className}`}
      aria-label="ARVDOUL Home"
    >
      {/* Emblem */}
      {variant !== 'wordmark' && (
        <ArvdoulEmblem size={emblemSize} />
      )}

      {/* Wordmark */}
      {variant !== 'emblem' && (
        <ArvdoulWordmark
          variant={wordmarkVariant}
          size={size}
          className={variant === 'compact' ? 'hidden sm:inline-block' : ''}
        />
      )}
    </div>
  );
});

ArvdoulLogo.displayName = 'ArvdoulLogo';
ArvdoulLogo.propTypes = {
  variant: PropTypes.oneOf(['full', 'emblem', 'wordmark', 'compact']),
  theme: PropTypes.oneOf(['auto', 'dark', 'light', 'white']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  clickable: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default ArvdoulLogo;
