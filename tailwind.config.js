// Arvdoul/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  
  // Disable Preflight to prevent conflicts with our custom CSS variables
  corePlugins: {
    preflight: false,
  },
  
  theme: {
    // Extend our custom CSS variables
    extend: {
      // Animation system
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      
      // Keyframes for animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      
      // Transition timing functions
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
        'ease-in-out-back': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      
      // Custom spacing scale for consistency
      spacing: {
        '0': '0px',
        '1': 'var(--spacing-1, 0.25rem)',
        '2': 'var(--spacing-2, 0.5rem)',
        '3': 'var(--spacing-3, 0.75rem)',
        '4': 'var(--spacing-4, 1rem)',
        '5': 'var(--spacing-5, 1.25rem)',
        '6': 'var(--spacing-6, 1.5rem)',
        '8': 'var(--spacing-8, 2rem)',
        '10': 'var(--spacing-10, 2.5rem)',
        '12': 'var(--spacing-12, 3rem)',
        '14': 'var(--spacing-14, 3.5rem)',
        '16': 'var(--spacing-16, 4rem)',
        '20': 'var(--spacing-20, 5rem)',
        '24': 'var(--spacing-24, 6rem)',
        '28': 'var(--spacing-28, 7rem)',
        '32': 'var(--spacing-32, 8rem)',
        '36': 'var(--spacing-36, 9rem)',
        '40': 'var(--spacing-40, 10rem)',
        '44': 'var(--spacing-44, 11rem)',
        '48': 'var(--spacing-48, 12rem)',
      },
      
      // Custom colors using CSS variables
      colors: {
        // Primary colors
        primary: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
        },
        
        // Surface colors
        surface: {
          0: 'var(--color-surface-0, #ffffff)',
          50: 'var(--color-surface-50, #f8fafc)',
          100: 'var(--color-surface-100, #f1f5f9)',
          200: 'var(--color-surface-200, #e2e8f0)',
          300: 'var(--color-surface-300, #cbd5e1)',
          400: 'var(--color-surface-400, #94a3b8)',
          500: 'var(--color-surface-500, #64748b)',
          600: 'var(--color-surface-600, #475569)',
          700: 'var(--color-surface-700, #334155)',
          800: 'var(--color-surface-800, #1e293b)',
          900: 'var(--color-surface-900, #0f172a)',
        },
        
        // Semantic colors
        success: 'var(--color-success, #10b981)',
        warning: 'var(--color-warning, #f59e0b)',
        error: 'var(--color-error, #ef4444)',
        info: 'var(--color-info, #3b82f6)',
        
        // Extended colors
        accent: {
          purple: 'var(--color-accent-purple, #8b5cf6)',
          pink: 'var(--color-accent-pink, #ec4899)',
          orange: 'var(--color-accent-orange, #f97316)',
          teal: 'var(--color-accent-teal, #14b8a6)',
          cyan: 'var(--color-accent-cyan, #06b6d4)',
        },
      },
      
      // Typography using CSS variables
      fontSize: {
        'xs': 'var(--font-size-xs, 0.75rem)',
        'sm': 'var(--font-size-sm, 0.875rem)',
        'base': 'var(--font-size-base, 1rem)',
        'lg': 'var(--font-size-lg, 1.125rem)',
        'xl': 'var(--font-size-xl, 1.25rem)',
        '2xl': 'var(--font-size-2xl, 1.5rem)',
        '3xl': 'var(--font-size-3xl, 1.875rem)',
        '4xl': 'var(--font-size-4xl, 2.25rem)',
        '5xl': 'var(--font-size-5xl, 3rem)',
        '6xl': 'var(--font-size-6xl, 3.75rem)',
        '7xl': 'var(--font-size-7xl, 4.5rem)',
        '8xl': 'var(--font-size-8xl, 6rem)',
        '9xl': 'var(--font-size-9xl, 8rem)',
      },
      
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      
      lineHeight: {
        'none': '1',
        'tight': '1.25',
        'snug': '1.375',
        'normal': '1.5',
        'relaxed': '1.625',
        'loose': '2',
      },
      
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
        'normal': '0em',
        'wide': '0.025em',
        'wider': '0.05em',
        'widest': '0.1em',
      },
      
      // Border radius using CSS variables
      borderRadius: {
        'none': 'var(--radius-none, 0px)',
        'sm': 'var(--radius-sm, 0.125rem)',
        'DEFAULT': 'var(--radius-base, 0.25rem)',
        'md': 'var(--radius-md, 0.375rem)',
        'lg': 'var(--radius-lg, 0.5rem)',
        'xl': 'var(--radius-xl, 0.75rem)',
        '2xl': 'var(--radius-2xl, 1rem)',
        '3xl': 'var(--radius-3xl, 1.5rem)',
        'full': 'var(--radius-full, 9999px)',
      },
      
      // Box shadow using CSS variables
      boxShadow: {
        'sm': 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        'DEFAULT': 'var(--shadow-md, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))',
        'md': 'var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))',
        'lg': 'var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1))',
        'xl': 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))',
        '2xl': 'var(--shadow-2xl, 0 25px 50px -12px rgb(0 0 0 / 0.25))',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'none': 'none',
      },
      
      // Custom shadows for depth system
      dropShadow: {
        'sm': '0 1px 1px rgb(0 0 0 / 0.05)',
        'DEFAULT': ['0 1px 2px rgb(0 0 0 / 0.1)', '0 1px 1px rgb(0 0 0 / 0.06)'],
        'md': ['0 4px 3px rgb(0 0 0 / 0.07)', '0 2px 2px rgb(0 0 0 / 0.06)'],
        'lg': ['0 10px 8px rgb(0 0 0 / 0.04)', '0 4px 3px rgb(0 0 0 / 0.1)'],
        'xl': ['0 20px 13px rgb(0 0 0 / 0.03)', '0 8px 5px rgb(0 0 0 / 0.08)'],
        '2xl': '0 25px 25px rgb(0 0 0 / 0.15)',
        'none': '0 0 #0000',
      },
      
      // Z-index system for proper layering
      zIndex: {
        'hide': -1,
        'auto': 'auto',
        'base': 0,
        'docked': 10,
        'dropdown': 1000,
        'sticky': 1100,
        'banner': 1200,
        'overlay': 1300,
        'modal': 1400,
        'popover': 1500,
        'skipLink': 1600,
        'toast': 1700,
        'tooltip': 1800,
      },
      
      // Opacity scale
      opacity: {
        '0': '0',
        '5': '0.05',
        '10': '0.1',
        '15': '0.15',
        '20': '0.2',
        '25': '0.25',
        '30': '0.3',
        '35': '0.35',
        '40': '0.4',
        '45': '0.45',
        '50': '0.5',
        '55': '0.55',
        '60': '0.6',
        '65': '0.65',
        '70': '0.7',
        '75': '0.75',
        '80': '0.8',
        '85': '0.85',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
      },
      
      // Custom gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-shimmer': 'linear-gradient(90deg, transparent, var(--tw-gradient-from, rgba(255,255,255,0.2)), transparent)',
      },
      
      // Grid system
      gridTemplateColumns: {
        '1': 'repeat(1, minmax(0, 1fr))',
        '2': 'repeat(2, minmax(0, 1fr))',
        '3': 'repeat(3, minmax(0, 1fr))',
        '4': 'repeat(4, minmax(0, 1fr))',
        '5': 'repeat(5, minmax(0, 1fr))',
        '6': 'repeat(6, minmax(0, 1fr))',
        '7': 'repeat(7, minmax(0, 1fr))',
        '8': 'repeat(8, minmax(0, 1fr))',
        '9': 'repeat(9, minmax(0, 1fr))',
        '10': 'repeat(10, minmax(0, 1fr))',
        '11': 'repeat(11, minmax(0, 1fr))',
        '12': 'repeat(12, minmax(0, 1fr))',
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
      },
      
      gridColumn: {
        'span-13': 'span 13 / span 13',
        'span-14': 'span 14 / span 14',
        'span-15': 'span 15 / span 15',
        'span-16': 'span 16 / span 16',
        'span-17': 'span 17 / span 17',
        'span-18': 'span 18 / span 18',
        'span-19': 'span 19 / span 19',
        'span-20': 'span 20 / span 20',
        'span-21': 'span 21 / span 21',
        'span-22': 'span 22 / span 22',
        'span-23': 'span 23 / span 23',
        'span-24': 'span 24 / span 24',
      },
      
      // Container configuration
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        },
      },
      
      // Safe areas for modern devices
      padding: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      
      margin: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      
      // Height and width utilities
      height: {
        'screen-dynamic': '100dvh',
        'screen-small': '100svh',
        'screen-large': '100lvh',
      },
      
      minHeight: {
        'screen-dynamic': '100dvh',
        'screen-small': '100svh',
        'screen-large': '100lvh',
      },
      
      maxHeight: {
        'screen-dynamic': '100dvh',
        'screen-small': '100svh',
        'screen-large': '100lvh',
      },
      
      // Aspect ratios
      aspectRatio: {
        'auto': 'auto',
        'square': '1 / 1',
        'video': '16 / 9',
        'cinema': '21 / 9',
        'portrait': '9 / 16',
        'golden': '1.618 / 1',
      },
      
      // Scroll behavior
      scrollBehavior: ['responsive'],
      
      // Backdrop blur
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      
      // Backdrop opacity
      backdropOpacity: {
        '0': '0',
        '5': '0.05',
        '10': '0.1',
        '20': '0.2',
        '25': '0.25',
        '30': '0.3',
        '40': '0.4',
        '50': '0.5',
        '60': '0.6',
        '70': '0.7',
        '75': '0.75',
        '80': '0.8',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
      },
    },
  },
  
  // Dark mode configuration
  darkMode: ['class', '[data-theme="dark"]'],
  
  // Variants
  variants: {
    extend: {
      backgroundColor: ['active', 'disabled', 'group-hover', 'group-focus', 'focus-within'],
      borderColor: ['active', 'disabled', 'group-hover', 'group-focus', 'focus-within'],
      textColor: ['active', 'disabled', 'group-hover', 'group-focus', 'focus-within'],
      opacity: ['active', 'disabled', 'group-hover', 'group-focus'],
      scale: ['active', 'group-hover', 'group-focus'],
      translate: ['active', 'group-hover', 'group-focus'],
      animation: ['responsive', 'motion-safe', 'motion-reduce'],
      transitionProperty: ['responsive', 'motion-safe', 'motion-reduce'],
      transform: ['hover', 'focus', 'active', 'group-hover'],
      display: ['group-hover', 'group-focus'],
      visibility: ['group-hover', 'group-focus'],
      position: ['responsive', 'sticky'],
      inset: ['responsive', 'hover', 'focus'],
      zIndex: ['responsive', 'hover', 'focus'],
      overflow: ['responsive', 'hover'],
      cursor: ['responsive', 'hover', 'focus', 'disabled'],
      pointerEvents: ['responsive', 'hover', 'focus', 'disabled'],
      userSelect: ['responsive', 'disabled'],
    },
  },
  
  // Plugins
  plugins: [
    // Custom plugin for CSS variable support
    function({ addBase, addComponents, addUtilities, theme }) {
      // Base styles that use CSS variables
      addBase({
        ':root': {
          '--color-primary-50': theme('colors.primary.50'),
          '--color-primary-100': theme('colors.primary.100'),
          '--color-primary-200': theme('colors.primary.200'),
          '--color-primary-300': theme('colors.primary.300'),
          '--color-primary-400': theme('colors.primary.400'),
          '--color-primary-500': theme('colors.primary.500'),
          '--color-primary-600': theme('colors.primary.600'),
          '--color-primary-700': theme('colors.primary.700'),
          '--color-primary-800': theme('colors.primary.800'),
          '--color-primary-900': theme('colors.primary.900'),
          
          '--color-surface-0': theme('colors.surface.0'),
          '--color-surface-50': theme('colors.surface.50'),
          '--color-surface-100': theme('colors.surface.100'),
          '--color-surface-200': theme('colors.surface.200'),
          '--color-surface-300': theme('colors.surface.300'),
          '--color-surface-400': theme('colors.surface.400'),
          '--color-surface-500': theme('colors.surface.500'),
          '--color-surface-600': theme('colors.surface.600'),
          '--color-surface-700': theme('colors.surface.700'),
          '--color-surface-800': theme('colors.surface.800'),
          '--color-surface-900': theme('colors.surface.900'),
          
          '--color-success': theme('colors.success'),
          '--color-warning': theme('colors.warning'),
          '--color-error': theme('colors.error'),
          '--color-info': theme('colors.info'),
          
          '--font-size-xs': theme('fontSize.xs'),
          '--font-size-sm': theme('fontSize.sm'),
          '--font-size-base': theme('fontSize.base'),
          '--font-size-lg': theme('fontSize.lg'),
          '--font-size-xl': theme('fontSize.xl'),
          '--font-size-2xl': theme('fontSize.2xl'),
          '--font-size-3xl': theme('fontSize.3xl'),
          '--font-size-4xl': theme('fontSize.4xl'),
          '--font-size-5xl': theme('fontSize.5xl'),
          
          '--shadow-sm': theme('boxShadow.sm'),
          '--shadow-md': theme('boxShadow.md'),
          '--shadow-lg': theme('boxShadow.lg'),
          '--shadow-xl': theme('boxShadow.xl'),
          '--shadow-2xl': theme('boxShadow.2xl'),
          
          '--radius-none': theme('borderRadius.none'),
          '--radius-sm': theme('borderRadius.sm'),
          '--radius-base': theme('borderRadius.DEFAULT'),
          '--radius-md': theme('borderRadius.md'),
          '--radius-lg': theme('borderRadius.lg'),
          '--radius-xl': theme('borderRadius.xl'),
          '--radius-2xl': theme('borderRadius.2xl'),
          '--radius-full': theme('borderRadius.full'),
          
          '--spacing-0': '0px',
          '--spacing-1': '0.25rem',
          '--spacing-2': '0.5rem',
          '--spacing-3': '0.75rem',
          '--spacing-4': '1rem',
          '--spacing-5': '1.25rem',
          '--spacing-6': '1.5rem',
          '--spacing-8': '2rem',
          '--spacing-10': '2.5rem',
          '--spacing-12': '3rem',
          '--spacing-14': '3.5rem',
          '--spacing-16': '4rem',
          '--spacing-20': '5rem',
          '--spacing-24': '6rem',
          '--spacing-28': '7rem',
          '--spacing-32': '8rem',
          '--spacing-36': '9rem',
          '--spacing-40': '10rem',
          '--spacing-44': '11rem',
          '--spacing-48': '12rem',
        },
        
        // Base font and color
        'html': {
          fontFamily: theme('fontFamily.sans'),
          fontSize: '16px',
          lineHeight: '1.5',
          WebkitTextSizeAdjust: '100%',
          textRendering: 'optimizeLegibility',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          color: 'var(--color-surface-900)',
          backgroundColor: 'var(--color-surface-0)',
        },
        
        // Smooth scrolling
        'html, body': {
          scrollBehavior: 'smooth',
        },
        
        // Selection styles
        '::selection': {
          backgroundColor: 'var(--color-primary-500)',
          color: 'white',
        },
        
        // Focus styles for accessibility
        ':focus-visible': {
          outline: '2px solid var(--color-primary-500)',
          outlineOffset: '2px',
        },
        
        // Remove tap highlight on mobile
        '*': {
          WebkitTapHighlightColor: 'transparent',
        },
        
        // Better box-sizing
        '*, *::before, *::after': {
          boxSizing: 'border-box',
        },
        
        // Remove default margins
        'body, h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd': {
          margin: '0',
        },
      });
      
      // Add custom utilities
      addUtilities({
        // Theme transitions
        '.theme-transition': {
          transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
          transitionDuration: '150ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
        
        // Safe area insets
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        
        // Dynamic viewport units
        '.h-dvh': {
          height: '100dvh',
        },
        '.min-h-dvh': {
          minHeight: '100dvh',
        },
        '.max-h-dvh': {
          maxHeight: '100dvh',
        },
        
        // Scrollbar styling
        '.scrollbar-thin': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'var(--color-surface-300)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'var(--color-surface-400)',
          },
        },
        
        '.scrollbar-hidden': {
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
        },
        
        // Text balance for better readability
        '.text-balance': {
          textWrap: 'balance',
        },
        
        // Line clamp utilities
        '.line-clamp-1': {
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: '1',
          WebkitBoxOrient: 'vertical',
        },
        '.line-clamp-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: '2',
          WebkitBoxOrient: 'vertical',
        },
        '.line-clamp-3': {
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: '3',
          WebkitBoxOrient: 'vertical',
        },
        '.line-clamp-4': {
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: '4',
          WebkitBoxOrient: 'vertical',
        },
        
        // Glass effect
        '.glass': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        
        '.glass-dark': {
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.2)',
        },
        
        // Gradient text
        '.gradient-text': {
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        },
        
        // Aspect ratio containers
        '.aspect-video': {
          aspectRatio: '16 / 9',
        },
        '.aspect-square': {
          aspectRatio: '1 / 1',
        },
        '.aspect-portrait': {
          aspectRatio: '9 / 16',
        },
      });
      
      // Add custom components
      addComponents({
        // Card component
        '.card': {
          backgroundColor: 'var(--color-surface-0)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-surface-200)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--spacing-6)',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          
          '&:hover': {
            boxShadow: 'var(--shadow-md)',
            borderColor: 'var(--color-surface-300)',
          },
        },
        
        // Button component
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-2) var(--spacing-4)',
          borderRadius: 'var(--radius-md)',
          fontWeight: '500',
          fontSize: 'var(--font-size-sm)',
          lineHeight: '1.5',
          textAlign: 'center',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
          border: '1px solid transparent',
          
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
          
          '&:focus-visible': {
            outline: '2px solid var(--color-primary-500)',
            outlineOffset: '2px',
          },
        },
        
        // Input component
        '.input': {
          display: 'block',
          width: '100%',
          padding: 'var(--spacing-2) var(--spacing-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-surface-300)',
          backgroundColor: 'var(--color-surface-0)',
          color: 'var(--color-surface-900)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: '1.5',
          transition: 'border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          
          '&:focus': {
            outline: 'none',
            borderColor: 'var(--color-primary-500)',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
          
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
      });
    },
    
    // Form plugin for better form styling
    require('@tailwindcss/forms'),
    
    // Aspect ratio plugin
    require('@tailwindcss/aspect-ratio'),
    
    // Typography plugin
    require('@tailwindcss/typography'),
    
    // Line clamp plugin
    require('@tailwindcss/line-clamp'),
  ],
  
  // Purge settings for production
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    options: {
      safelist: [
        'dark',
        'light',
        'theme-transition',
        'glass',
        'glass-dark',
        'scrollbar-thin',
        'scrollbar-hidden',
      ],
    },
  },
};