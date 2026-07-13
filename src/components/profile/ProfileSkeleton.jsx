/**
 * src/components/profile/ProfileSkeleton.jsx - ARVDOUL Profile Skeleton Component
 * 
 * Loading skeleton for profile screen.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileSkeletonProps
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

/**
 * ProfileSkeleton Component
 * @type {React.FC<ProfileSkeletonProps>}
 */
const ProfileSkeleton = memo(({ theme = 'light' }) => {
  return (
    <div className="animate-pulse">
      {/* Header Card */}
      <div className={cn(
        'mx-4 mt-4 rounded-2xl overflow-hidden',
        theme === 'dark' ? 'bg-gray-800' : 'bg-white',
        'shadow-lg'
      )}>
        {/* Cover */}
        <div className={cn(
          'h-32',
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        )} />
        
        {/* Avatar and Info */}
        <div className="px-4 pb-4 -mt-12">
          <div className="flex items-end justify-between">
            {/* Avatar */}
            <div className={cn(
              'w-24 h-24 rounded-full',
              'ring-4 ring-white dark:ring-gray-900',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )} />
            
            {/* Action buttons */}
            <div className="flex gap-2 pb-2">
              <div className={cn(
                'w-24 h-9 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />
              <div className={cn(
                'w-9 h-9 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />
            </div>
          </div>
          
          {/* Name */}
          <div className="mt-3">
            <div className={cn(
              'h-6 w-40 rounded',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )} />
            <div className={cn(
              'h-4 w-24 mt-2 rounded',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )} />
          </div>
          
          {/* Bio */}
          <div className="mt-3 space-y-2">
            <div className={cn(
              'h-4 w-full rounded',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )} />
            <div className={cn(
              'h-4 w-3/4 rounded',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )} />
          </div>
          
          {/* Stats */}
          <div className={cn(
            'mt-4 p-3 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
          )}>
            <div className="grid grid-cols-6 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={cn(
                    'h-5 w-8 rounded',
                    theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                  )} />
                  <div className={cn(
                    'h-3 w-10 mt-1 rounded',
                    theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                  )} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Highlights Skeleton */}
      <div className={cn(
        'mx-4 mt-4 p-4 rounded-2xl',
        theme === 'dark' ? 'bg-gray-800' : 'bg-white',
        'shadow-lg'
      )}>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={cn(
                'w-16 h-16 rounded-full',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />
              <div className={cn(
                'h-3 w-12 mt-2 rounded',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Posts Grid Skeleton */}
      <div className="mx-4 mt-4">
        <div className="grid grid-cols-3 gap-1">
          {[...Array(9)].map((_, i) => (
            <div 
              key={i} 
              className={cn(
                'aspect-square rounded-lg',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
              )} 
            />
          ))}
        </div>
      </div>
    </div>
  );
});

ProfileSkeleton.displayName = 'ProfileSkeleton';

export default ProfileSkeleton;
