// src/components/profile/ProfileSkeleton.jsx
import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

export default function ProfileSkeleton({ theme = 'light' }) {
  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6 animate-pulse">
      {/* Cover Image Skeleton */}
      <div className="relative h-44 sm:h-52 w-full rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {/* Avatar Skeleton */}
        <div className="absolute -bottom-8 left-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-700" />
        </div>
      </div>

      {/* Profile Info Header */}
      <div className="pt-10 px-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44 rounded-lg" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5 pt-2">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-around py-4 border-y border-gray-100 dark:border-gray-800">
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-12 mx-auto rounded" />
            <Skeleton className="h-3 w-16 mx-auto rounded" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-12 mx-auto rounded" />
            <Skeleton className="h-3 w-16 mx-auto rounded" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-12 mx-auto rounded" />
            <Skeleton className="h-3 w-16 mx-auto rounded" />
          </div>
        </div>
      </div>

      {/* Highlights Bar */}
      <div className="flex gap-3 px-2 overflow-x-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center space-y-1.5 flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 px-2 justify-around pt-2">
        <Skeleton className="h-8 w-20 rounded-t-lg" />
        <Skeleton className="h-8 w-20 rounded-t-lg" />
        <Skeleton className="h-8 w-20 rounded-t-lg" />
      </div>

      {/* Grid of posts */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-800"
          />
        ))}
      </div>
    </div>
  );
}
