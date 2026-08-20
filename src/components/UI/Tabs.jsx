// src/components/ui/Tabs.jsx
import React from 'react';
import { cn } from '../../lib/utils';

export const Tabs = ({ children, className, ...props }) => (
  <div className={cn('w-full', className)} {...props}>
    {children}
  </div>
);

export const TabsList = ({ children, className, ...props }) => (
  <div className={cn('flex space-x-2', className)} {...props}>
    {children}
  </div>
);

export const TabsTrigger = ({ children, active, className, ...props }) => (
  <button
    className={cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      active
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

export const TabsContent = ({ children, className, ...props }) => (
  <div className={cn('mt-4', className)} {...props}>
    {children}
  </div>
);