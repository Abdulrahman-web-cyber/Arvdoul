/**
 * src/components/profile/ProfileSkeleton.jsx - ARVDOUL Profile Skeleton Component
 * 
 * Loading skeleton for profile screens.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

/**
 * ProfileSkeleton Component
 * @param {Object} props
 */
const ProfileSkeleton = ({
  theme = 'light',
  variant = 'full', // 'full' | 'header' | 'minimal'
}) => {
  const bgBase = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200';
  const bgLight = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100';

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-3">
        <div className={cn('w-12 h-12 rounded-full', bgBase, 'animate-pulse')} />
        <div className="space-y-2">
          <div className={cn('h-4 w-24 rounded', bgBase, 'animate-pulse')} />
          <div className={cn('h-3 w-16 rounded', bgLight, 'animate-pulse')} />
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className="space-y-4">
        {/* Cover */}
        <div className={cn('h-48 rounded-2xl', bgBase, 'animate-pulse')} />
        
        {/* Avatar and basic info */}
        <div className="flex items-end gap-4 -mt-12 px-4">
          <div className={cn('w-28 h-28 rounded-full border-4 border-white dark:border-gray-900', bgBase, 'animate-pulse')} />
          <div className="flex-1 pb-2 space-y-2">
            <div className={cn('h-6 w-40 rounded', bgBase, 'animate-pulse')} />
            <div className={cn('h-4 w-24 rounded', bgLight, 'animate-pulse')} />
          </div>
        </div>
        
        {/* Stats */}
        <div className={cn('h-16 rounded-xl mx-4', bgLight, 'animate-pulse')} />
      </div>
    );
  }

  // Full variant
  return (
    <div className="space-y-4 animate-pulse">
      {/* Cover */}
      <div className={cn('h-48 rounded-2xl', bgBase)} />
      
      {/* Profile Info */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end justify-between">
          <div className={cn('w-28 h-28 rounded-full border-4 border-white dark:border-gray-900', bgBase)} />
          <div className="flex gap-2 pb-2">
            <div className={cn('h-10 w-24 rounded-xl', bgBase)} />
            <div className={cn('h-10 w-10 rounded-xl', bgLight)} />
          </div>
        </div>
        
        {/* Name and badges */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn('h-6 w-32 rounded', bgBase)} />
            <div className={cn('w-5 h-5 rounded-full', bgLight)} />
          </div>
          <div className={cn('h-4 w-20 rounded', bgLight)} />
        </div>
        
        {/* Bio */}
        <div className="mt-3 space-y-1.5">
          <div className={cn('h-4 w-full rounded', bgLight)} />
          <div className={cn('h-4 w-3/4 rounded', bgLight)} />
        </div>
        
        {/* Level and badges */}
        <div className="mt-3 flex items-center gap-2">
          <div className={cn('h-6 w-20 rounded-full', bgLight)} />
          <div className={cn('h-6 w-16 rounded-full', bgLight)} />
        </div>
      </div>
      
      {/* Stats */}
      <div className={cn('h-20 rounded-xl mx-4', bgLight)} />
      
      {/* Tabs */}
      <div className={cn('h-12 rounded-xl', bgLight)} />
      
      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={cn('aspect-square rounded', bgBase)} />
        ))}
      </div>
    </div>
  );
};

export default memo(ProfileSkeleton);
