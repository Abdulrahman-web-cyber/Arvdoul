import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

/**
 * ArvdoulEmblem - Brand Insignia using official light & dark high-resolution assets
 */
export const ArvdoulEmblem = memo(({ 
  size = 32, 
  className = '', 
  theme = 'auto',
  animate = false,
  showPlate = false,
  alt = 'Arvdoul',
}) => {
  const s = typeof size === 'number' ? `${size}px` : size;

  // Resolve theme safely
  let isDarkTheme = true;
  try {
    const themeCtx = useTheme?.();
    if (themeCtx) {
      isDarkTheme = themeCtx.isDark ?? (themeCtx.theme === 'dark');
    }
  } catch {
    if (typeof window !== 'undefined' && window.matchMedia) {
      isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  const effectiveTheme = (theme === 'light' || theme === 'white')
    ? 'light'
    : (theme === 'dark' ? 'dark' : (isDarkTheme ? 'dark' : 'light'));

  const isLight = effectiveTheme === 'light';
  // Use exact transparent master logo matching Splash & Intro screens
  const logoSrc = '/icons/Logo transparent.svg';

  return (
    <div 
      role="img"
      aria-label="Arvdoul Insignia"
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        showPlate
          ? isLight
            ? 'rounded-[22%] shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-black/5 overflow-hidden'
            : 'rounded-[22%] shadow-[0_2px_16px_rgba(139,30,243,0.3)] ring-1 ring-white/10 overflow-hidden'
          : 'overflow-visible'
      } ${animate ? 'hover:scale-105 active:scale-95 transition-transform duration-200' : ''} ${className}`}
      style={{ width: s, height: s }}
    >
      <img
        src={logoSrc}
        alt={alt}
        className="w-full h-full object-contain block select-none pointer-events-none drop-shadow-[0_2px_12px_rgba(139,30,243,0.35)]"
        loading="eager"
        decoding="async"
      />
    </div>
  );
});

ArvdoulEmblem.displayName = 'ArvdoulEmblem';
ArvdoulEmblem.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  theme: PropTypes.string,
  animate: PropTypes.bool,
  showPlate: PropTypes.bool,
  alt: PropTypes.string,
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
 * ArvdoulLogo - Unified, world-class 2050 Master Brand Component
 */
const ArvdoulLogo = memo(({
  variant = 'full', // 'full' | 'emblem' | 'wordmark' | 'compact' | 'stroke'
  theme = 'auto', // 'auto' | 'dark' | 'light' | 'white'
  size = 'md',
  clickable = true,
  onClick,
  className = '',
  showWordmark,
  showEmblem,
  showPlate = true,
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

  // Support showWordmark and showEmblem booleans
  let effectiveVariant = variant;
  if (showWordmark === false) {
    effectiveVariant = 'emblem';
  } else if (showEmblem === false) {
    effectiveVariant = 'wordmark';
  }

  // Support both numeric size and preset key
  const emblemSize = typeof size === 'number' ? size : (emblemSizes[size] || 36);
  const wordmarkVariant = theme === 'white' ? 'white' : theme === 'light' ? 'dark' : 'auto';
  const effectiveShowPlate = variant === 'stroke' ? false : showPlate;

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
      {effectiveVariant !== 'wordmark' && (
        <ArvdoulEmblem 
          size={emblemSize} 
          theme={theme} 
          animate={clickable}
          showPlate={effectiveShowPlate}
        />
      )}

      {/* Wordmark */}
      {effectiveVariant !== 'emblem' && effectiveVariant !== 'stroke' && (
        <div className="flex flex-col justify-center">
          <ArvdoulWordmark
            variant={wordmarkVariant}
            size={typeof size === 'number' ? 'md' : size}
            className={effectiveVariant === 'compact' ? 'hidden sm:inline-block' : ''}
          />
        </div>
      )}
    </div>
  );
});

ArvdoulLogo.displayName = 'ArvdoulLogo';
ArvdoulLogo.propTypes = {
  variant: PropTypes.oneOf(['full', 'emblem', 'wordmark', 'compact', 'stroke']),
  theme: PropTypes.oneOf(['auto', 'dark', 'light', 'white']),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  clickable: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
  showWordmark: PropTypes.bool,
  showEmblem: PropTypes.bool,
  showPlate: PropTypes.bool,
};

export default ArvdoulLogo;
