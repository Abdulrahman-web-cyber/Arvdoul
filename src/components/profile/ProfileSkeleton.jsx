// src/components/profile/ProfileSkeleton.jsx
import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

export default function ProfileSkeleton({ theme = 'light' }) {
  const isDark = theme === 'dark';

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-5 animate-pulse">
      {/* 1. Sub-App Top Bar */}
      <div className="flex items-center justify-between py-1">
        <Skeleton className="h-7 w-32 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-2xl" />
          <Skeleton className="h-9 w-9 rounded-2xl" />
          <Skeleton className="h-9 w-9 rounded-2xl" />
        </div>
      </div>

      {/* 2. Hero Card */}
      <div className={cn(
        "rounded-3xl p-5 sm:p-6 lg:p-7 border transition-all",
        isDark ? "bg-[#0d1424]/60 border-white/10" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Identity Left */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full lg:w-auto">
            {/* Avatar skeleton */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-200 dark:bg-white/10 ring-4 ring-purple-500/20" />
            </div>

            {/* Names, Badges, Bio */}
            <div className="space-y-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-44 sm:w-56 rounded-xl" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>

              <Skeleton className="h-4 w-28 rounded-lg" />

              <div className="flex items-center gap-2 pt-0.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>

              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-3.5 w-full max-w-md rounded-md" />
                <Skeleton className="h-3.5 w-3/4 max-w-sm rounded-md" />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
            </div>
          </div>

          {/* Level & Progression Card */}
          <div className={cn(
            "w-full lg:w-72 p-4 rounded-2xl border shrink-0 space-y-3",
            isDark ? "bg-[#131b2e]/60 border-white/10" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-16 rounded" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-16 rounded" />
                <Skeleton className="h-2.5 w-20 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Unified Metric Strip Skeleton */}
      <div className={cn(
        "rounded-2xl p-4 sm:p-5 border transition-all shadow-sm",
        isDark ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800/70">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center justify-center p-2 space-y-1.5">
              <Skeleton className="h-6 w-12 rounded-md" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Vibes & Stories Carousel */}
      <div className={cn(
        "rounded-2xl p-4 sm:p-5 border space-y-3",
        isDark ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-6 h-6 rounded-lg" />
            <Skeleton className="h-4 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>

        {/* Clean Story Cards Carousel */}
        <div className="flex gap-3 overflow-x-hidden pt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-24 sm:w-28 h-36 sm:h-40 rounded-xl bg-slate-200 dark:bg-white/10 shrink-0"
            />
          ))}
        </div>
      </div>

      {/* 5. Tabs Bar */}
      <div className="flex gap-4 overflow-x-hidden py-2 border-b border-slate-200 dark:border-slate-800">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded shrink-0" />
        ))}
      </div>

      {/* 6. Feed Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl bg-slate-200 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}

