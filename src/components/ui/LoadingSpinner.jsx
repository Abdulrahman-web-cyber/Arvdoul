// src/components/ui/LoadingSpinner.jsx
import React, { memo } from 'react';
import { cn } from '../../lib/utils';

export const LoadingSpinner = memo(({
  size = 'md',
  className = '',
  label = 'Loading...',
}) => {
  const sizes = {
    xs: 'w-4 h-4 border-2',
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  return (
    <div 
      role="status" 
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <div
        className={cn(
          'rounded-full animate-spin border-arvdoul-border border-t-arvdoul-purple border-r-arvdoul-blue',
          sizes[size] || sizes.md
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
