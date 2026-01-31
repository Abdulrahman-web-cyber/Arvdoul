import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, ...props }) => (
  <div
    className={cn(
      'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={cn('p-6', className)} {...props}>
    {children}
  </div>
);
