// src/components/Shared/ArvdoulLogo.jsx

import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

/**
 * ArvdoulEmblem - World-class, precision-crafted vector brand insignia.
 * Features crystalline facet geometry forming the iconic aerodynamic "A" monogram,
 * specular apex refraction, ambient chromatic glow, and zero-distortion retina scaling.
 */
export const ArvdoulEmblem = memo(({ 
  size = 32, 
  className = '', 
  theme = 'auto',
  preferVector = true,
  animate = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const s = typeof size === 'number' ? `${size}px` : size;
  const numSize = typeof size === 'number' ? size : parseInt(size, 10) || 32;
  const logoSrc = theme === 'light' ? '/logo/logo-light.png' : '/logo/logo-dark.png';

  // If raster is explicitly requested and loaded without error, wrap in liquid glass rim
  if (!preferVector && !imageError) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center rounded-full overflow-hidden p-[1.5px] bg-gradient-to-tr from-[#8B1EF3] via-[#4431F7] to-[#00F0FF] shadow-[0_4px_16px_rgba(139,30,243,0.35)] shrink-0 transition-transform duration-300 ${animate ? 'hover:scale-105 active:scale-95' : ''} ${className}`}
        style={{ width: s, height: s }}
      >
        <img
          src={logoSrc}
          alt="Arvdoul"
          width={numSize}
          height={numSize}
          onError={() => setImageError(true)}
          className="w-full h-full rounded-full object-cover"
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  const rawId = React.useId ? React.useId() : 'arv';
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // World-Class Geometric Crystalline Vector Emblem
  return (
    <div 
      role="img"
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${animate ? 'hover:scale-105 active:scale-95 transition-transform duration-300' : ''} ${className}`}
      style={{ width: s, height: s }}
      aria-label="Arvdoul Insignia"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_16px_rgba(139,30,243,0.4)]"
      >
        <defs>
          {/* Left Wing Facet: Electric Cyan to Azure Blue */}
          <linearGradient id={`arvdoul-wing-left-${uid}`} x1="6" y1="48" x2="28" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="45%" stopColor="#055BFB" />
            <stop offset="100%" stopColor="#4431F7" />
          </linearGradient>

          {/* Right Wing Facet: Royal Violet to Vibrant Magenta */}
          <linearGradient id={`arvdoul-wing-right-${uid}`} x1="50" y1="48" x2="28" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="40%" stopColor="#A855F7" />
            <stop offset="85%" stopColor="#8B1EF3" />
            <stop offset="100%" stopColor="#4431F7" />
          </linearGradient>

          {/* Central Keystone Diamond Core */}
          <linearGradient id={`arvdoul-core-${uid}`} x1="28" y1="16" x2="28" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#C82BFF" />
            <stop offset="70%" stopColor="#4431F7" />
            <stop offset="100%" stopColor="#055BFB" />
          </linearGradient>

          {/* Specular Edge Highlights */}
          <linearGradient id={`arvdoul-specular-${uid}`} x1="28" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Inner Shadow Filter */}
          <filter id={`arvdoul-soft-glow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#8B1EF3" floodOpacity="0.45" />
          </filter>
        </defs>

        <g filter={`url(#arvdoul-soft-glow-${uid})`}>
          {/* Ambient Outer Halo Ring */}
          <circle
            cx="28"
            cy="28"
            r="25.5"
            stroke={`url(#arvdoul-wing-left-${uid})`}
            strokeWidth="0.8"
            strokeOpacity="0.3"
            strokeDasharray="2 4"
          />

          {/* Left Architectural Wing */}
          <path
            d="M28 5L8 46C7.5 47 8.3 48.2 9.5 48.2H18.5C19.3 48.2 20 47.7 20.4 47L28 31L23.5 20.5L28 5Z"
            fill={`url(#arvdoul-wing-left-${uid})`}
          />

          {/* Right Architectural Wing */}
          <path
            d="M28 5L48 46C48.5 47 47.7 48.2 46.5 48.2H37.5C36.7 48.2 36 47.7 35.6 47L28 31L32.5 20.5L28 5Z"
            fill={`url(#arvdoul-wing-right-${uid})`}
          />

          {/* Central Prismatic Diamond Bridge */}
          <path
            d="M17 38.5L28 21L39 38.5H31L28 33L25 38.5H17Z"
            fill={`url(#arvdoul-core-${uid})`}
          />

          {/* Center Energy Nexus */}
          <polygon
            points="28,21 31.5,27 28,33 24.5,27"
            fill="#FFFFFF"
            fillOpacity="0.88"
          />

          {/* Apex Specular Sheen */}
          <polygon
            points="28,5 25,12 28,15 31,12"
            fill={`url(#arvdoul-specular-${uid})`}
          />

          {/* Bottom Horizon Accent Line */}
          <line
            x1="12"
            y1="51"
            x2="44"
            y2="51"
            stroke={`url(#arvdoul-core-${uid})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
});

ArvdoulEmblem.displayName = 'ArvdoulEmblem';
ArvdoulEmblem.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  theme: PropTypes.string,
  preferVector: PropTypes.bool,
  animate: PropTypes.bool,
};

/**
 * ArvdoulWordmark - Clean, geometric, tracking-wide brand typography wordmark
 */
export const ArvdoulWordmark = memo(({ 
  variant = 'gradient', // 'gradient' | 'white' | 'dark' | 'auto'
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className = '',
}) => {
  const sizeClasses = {
    xs: 'text-xs tracking-[0.2em]',
    sm: 'text-sm tracking-[0.22em]',
    md: 'text-base sm:text-lg tracking-[0.24em]',
    lg: 'text-xl sm:text-2xl tracking-[0.26em]',
    xl: 'text-2xl sm:text-3xl tracking-[0.28em]',
  };

  const variantClasses = {
    gradient: 'bg-gradient-to-r from-white via-purple-200 to-[#00F0FF] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(139,30,243,0.35)]',
    white: 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
    dark: 'text-slate-900 dark:text-white',
    auto: 'bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900 dark:from-white dark:via-purple-200 dark:to-cyan-200 bg-clip-text text-transparent',
  };

  return (
    <span
      className={`font-black font-sans select-none uppercase inline-block leading-none ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.gradient} ${className}`}
      style={{ letterSpacing: '0.24em' }}
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
 * ArvdoulLogo - Unified, world-class Master Brand Component
 */
const ArvdoulLogo = memo(({
  variant = 'full', // 'full' | 'emblem' | 'wordmark' | 'compact'
  theme = 'auto', // 'auto' | 'dark' | 'light' | 'white'
  size = 'md',
  clickable = true,
  onClick,
  className = '',
  preferVector = true,
}) => {
  const navigate = useNavigate();

  const emblemSizes = {
    xs: 22,
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (clickable) {
      navigate('/home');
    }
  };

  const emblemSize = emblemSizes[size] || 36;
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
      className={`inline-flex items-center gap-3 transition-transform duration-200 select-none ${
        clickable ? 'cursor-pointer hover:opacity-95 active:scale-[0.98]' : ''
      } ${className}`}
      aria-label="ARVDOUL Home"
    >
      {/* Emblem */}
      {variant !== 'wordmark' && (
        <ArvdoulEmblem 
          size={emblemSize} 
          theme={theme} 
          preferVector={preferVector}
          animate={clickable}
        />
      )}

      {/* Wordmark */}
      {variant !== 'emblem' && (
        <div className="flex flex-col justify-center">
          <ArvdoulWordmark
            variant={wordmarkVariant}
            size={size}
            className={variant === 'compact' ? 'hidden sm:inline-block' : ''}
          />
        </div>
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
  preferVector: PropTypes.bool,
};

export default ArvdoulLogo;
