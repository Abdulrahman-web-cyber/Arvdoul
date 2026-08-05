/**
 * src/components/profile/ProfileSkeleton.jsx - ARVDOUL Profile Skeleton Loader
 *
 * Elegant glassmorphic skeleton loader for the profile screen.
 *
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

const ProfileSkeleton = memo(({ theme = 'light' }) => {
  const isDark = theme === 'dark';

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6 px-4 pt-4">
      {/* Cover and Avatar Skeleton */}
      <div className="relative rounded-3xl overflow-hidden border border-gray-200/50 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm shadow-sm">
        {/* Cover Photo Area */}
        <div className="h-48 w-full shimmer" />

        {/* Avatar Area */}
        <div className="absolute top-36 left-6">
          <div className="w-24 h-24 rounded-full border-4 border-white dark:border-[#0b1220] shimmer" />
        </div>

        {/* Header Action Buttons Space */}
        <div className="pt-16 pb-6 px-6 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              {/* Display Name */}
              <div className="h-6 w-1/3 shimmer rounded-lg" />
              {/* Username */}
              <div className="h-4 w-1/4 shimmer rounded-lg" />
            </div>
            {/* Button */}
            <div className="h-9 w-24 shimmer rounded-full" />
          </div>

          {/* Bio */}
          <div className="space-y-2 mt-2">
            <div className="h-4 w-full shimmer rounded-lg" />
            <div className="h-4 w-5/6 shimmer rounded-lg" />
          </div>

          {/* Stats Bar */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
            <div className="h-8 w-16 shimmer rounded-lg" />
            <div className="h-8 w-16 shimmer rounded-lg" />
            <div className="h-8 w-16 shimmer rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-4 border-b border-gray-200/50 dark:border-white/10 pb-2">
        <div className="h-8 w-20 shimmer rounded-lg" />
        <div className="h-8 w-20 shimmer rounded-lg" />
        <div className="h-8 w-20 shimmer rounded-lg" />
      </div>

      {/* Media Grid Skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-2xl shimmer" />
        ))}
      </div>
    </div>
  );
});

ProfileSkeleton.displayName = 'ProfileSkeleton';

export default ProfileSkeleton;
