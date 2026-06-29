// src/components/messaging/SkeletonLoader.jsx
// 🎯 Skeleton loading component

import React from 'react';
import { cn } from '../../lib/utils';

const SkeletonLoader = React.memo(({
  type = 'conversation', // 'conversation', 'message', 'messageList'
  count = 1,
  theme,
}) => {
  if (type === 'conversation') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center p-4 border-b gap-3',
              theme === 'dark'
                ? 'border-gray-800 bg-gray-900/50'
                : 'border-gray-200 bg-gray-50/50',
              'animate-pulse'
            )}
          >
            <div className={cn(
              'w-12 h-12 rounded-full',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300'
            )} />
            <div className="flex-1 space-y-2">
              <div className={cn(
                'h-4 rounded',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300',
                'w-3/4'
              )} />
              <div className={cn(
                'h-3 rounded',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300',
                'w-1/2'
              )} />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'message') {
    return (
      <div className={cn(
        'flex gap-3 mb-4',
        'animate-pulse'
      )}>
        <div className={cn(
          'w-8 h-8 rounded-full',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300'
        )} />
        <div className="flex-1 space-y-2">
          <div className={cn(
            'h-4 rounded',
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300',
            'w-3/4'
          )} />
          <div className={cn(
            'h-3 rounded',
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300',
            'w-1/2'
          )} />
        </div>
      </div>
    );
  }

  if (type === 'messageList') {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className={cn(
              'h-12 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300',
              'w-2/3'
            )} />
          </div>
        ))}
      </div>
    );
  }

  return null;
});

SkeletonLoader.displayName = 'SkeletonLoader';

export default SkeletonLoader;
