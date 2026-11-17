// src/components/UI/GlassButton.jsx

import { memo, useMemo } from "react";
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { brandRgba } from '../../design-system/tokens.js';

/**
 * @param {Object} props
 * @param {string} props.variant - Button style: 'gradient' | 'glass' | 'outline' | 'solid'
 * @param {string} props.size - Button size: 'sm' | 'md' | 'lg'
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.disabled - Disable button
 * @param {string} props.color - Gradient color direction
 */
const GlassButton = memo(({
  children,
  variant = 'gradient',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const { isDark, glass, spring, colors, gradient } = useTheme();

  // Size configurations
  const sizeConfig = useMemo(() => {
    const sizes = {
      sm: {
        padding: 'px-3 py-1.5',
        text: 'text-xs',
        icon: 'w-4 h-4',
        gap: 'gap-1.5',
      },
      md: {
        padding: 'px-5 py-2.5',
        text: 'text-sm',
        icon: 'w-5 h-5',
        gap: 'gap-2',
      },
      lg: {
        padding: 'px-7 py-3.5',
        text: 'text-base',
        icon: 'w-6 h-6',
        gap: 'gap-2.5',
      },
    };
    return sizes[size] || sizes.md;
  }, [size]);

  // Variant styles
  const variantStyles = useMemo(() => {
    const variants = {
      gradient: {
        base: `bg-arvdoul-gradient text-white font-semibold ${isDark ? 'shadow-lg shadow-purple-900/40' : 'shadow-lg shadow-purple-500/25'}`,
        hover: 'hover:brightness-110 hover:shadow-xl',
        active: 'active:scale-95',
      },
      glass: {
        base: `${glass.medium} font-medium ${isDark ? 'text-white' : 'text-slate-900'}`,
        hover: isDark ? 'hover:bg-white/15' : 'hover:bg-black/5',
        active: 'active:scale-95',
      },
      outline: {
        base: `border-2 font-medium ${isDark ? 'border-purple-500/50 text-purple-300 bg-purple-500/10' : 'border-arvdoul-purple/50 text-arvdoul-purple bg-purple-50'}`,
        hover: isDark ? 'hover:bg-purple-500/20 hover:border-purple-400' : 'hover:bg-purple-100/80 hover:border-arvdoul-purple',
        active: 'active:scale-95',
      },
      solid: {
        base: `${isDark ? 'bg-white/10 text-white' : 'bg-gray-900 text-white'} font-semibold`,
        hover: `${isDark ? 'hover:bg-white/20' : 'hover:bg-gray-800'}`,
        active: 'active:scale-95',
      },
    };
    return variants[variant] || variants.gradient;
  }, [variant, isDark, glass]);

  // Combine all styles
  const buttonClass = useMemo(() => [
    'relative',
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-2xl',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-arvdoul-purple',
    'focus:ring-offset-2',
    sizeConfig.padding,
    sizeConfig.text,
    sizeConfig.gap,
    variantStyles.base,
    variantStyles.hover,
    variantStyles.active,
    disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className,
  ].filter(Boolean).join(' '), [
    sizeConfig,
    variantStyles,
    disabled,
    loading,
    className,
  ]);

  // Animation config
  const animationProps = useMemo(() => ({
    whileHover: disabled || loading ? {} : { scale: 1.02 },
    whileTap: disabled || loading ? {} : { scale: 0.95 },
    transition: spring.button,
  }), [disabled, loading, spring.button]);

  return (
    <motion.button
      {...animationProps}
      type={type}
      className={buttonClass}
      style={
        variant === 'gradient' && !disabled && !loading
          ? { boxShadow: `0 8px 28px ${brandRgba(isDark ? 0.38 : 0.25)}` }
          : undefined
      }
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <LoadingSpinner 
          size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} 
          color="light"
        />
      )}

      {/* Icon (left) */}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className={sizeConfig.icon} />
      )}

      {/* Content */}
      {!loading && children}

      {/* Icon (right) */}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={sizeConfig.icon} />
      )}
    </motion.button>
  );
});

GlassButton.displayName = 'GlassButton';

export default GlassButton;
