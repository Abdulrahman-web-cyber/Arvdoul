// src/components/ui/GlassCard.jsx
import React, { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export const GlassCard = memo(forwardRef(({
  children,
  className = '',
  hoverable = false,
  interactive = false,
  glow = false,
  rounded = 'lg',
  padding = 'p-4',
  onClick,
  ...props
}, ref) => {
  const roundedMap = {
    sm: 'rounded-arvdoul-sm',
    md: 'rounded-arvdoul-md',
    lg: 'rounded-arvdoul-lg',
    xl: 'rounded-arvdoul-xl',
    full: 'rounded-full',
  };

  const isClickable = interactive || hoverable || Boolean(onClick);

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      whileHover={isClickable ? { scale: 1.01, y: -2 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className={cn(
        'bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border shadow-arvdoul-glass text-arvdoul-text-primary',
        roundedMap[rounded] || roundedMap.lg,
        padding,
        glow && 'ring-1 ring-arvdoul-purple/30 shadow-[0_8px_32px_rgba(139,30,243,0.25)]',
        isClickable && 'cursor-pointer hover:border-arvdoul-purple/40 transition-colors duration-200',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}));

GlassCard.displayName = 'GlassCard';

export default GlassCard;
