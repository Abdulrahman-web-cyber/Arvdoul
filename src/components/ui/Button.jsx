// src/components/ui/Button.jsx
import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  leftIcon,
  rightIcon,
  onClick,
  type = 'button',
  ...props
}, ref) => {
  const variants = {
    primary: 'bg-arvdoul-gradient text-white shadow-arvdoul-button hover:opacity-95 active:opacity-90 border-0',
    secondary: 'bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border text-white hover:bg-white/10 active:bg-white/15',
    ghost: 'bg-transparent text-arvdoul-text-secondary hover:text-white hover:bg-white/5 active:bg-white/10 border-0',
    danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-md border-0',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-arvdoul-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm rounded-arvdoul-md min-h-[44px]',
    lg: 'px-6 py-3 text-base rounded-arvdoul-lg min-h-[48px]',
    icon: 'p-2 rounded-full min-h-[44px] min-w-[44px]',
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={!isDisabled ? { scale: 0.96 } : undefined}
      transition={{ duration: 0.12 }}
      disabled={isDisabled}
      onClick={!isDisabled ? onClick : undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium font-sans transition-all duration-150 select-none cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-arvdoul-blue focus:ring-offset-2 focus:ring-offset-arvdoul-bg',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>{children}</span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </span>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;
