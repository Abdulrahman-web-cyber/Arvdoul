// src/components/profile/ProfileSkeleton.jsx

import { Skeleton } from '../UI/Skeleton';
import { cn } from '../../lib/utils';

export default function ProfileSkeleton({ theme = 'light' }) {
  const isDark = theme === 'dark';

  return (
    <div className="w-full max-w-[1160px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-pulse">
      {/* 1. Unboxed Editorial Identity Hero */}
      <div className={cn(
        "pb-6 border-b",
        isDark ? "border-white/[0.08]" : "border-slate-200/80"
      )}>
        <div className="flex flex-col lg:flex-row items-start justify-between gap-6 lg:gap-8">
          <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6 flex-1 min-w-0 w-full">
            <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />

            <div className="space-y-3 flex-1 min-w-0 w-full">
              <div className="space-y-2">
                <Skeleton className="h-8 w-52 sm:w-64 rounded-xl" />
                <Skeleton className="h-4 w-40 rounded-lg" />
              </div>

              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-3.5 w-full max-w-md rounded-md" />
                <Skeleton className="h-3.5 w-2/3 max-w-sm rounded-md" />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>
          </div>

          <div className={cn(
            "w-full lg:w-64 shrink-0 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l space-y-3",
            isDark ? "border-white/[0.08]" : "border-slate-200/80"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-16 rounded" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-xl" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* 2. Hairline-Divided Metrics Ledger */}
      <div className={cn(
        "rounded-2xl border overflow-hidden",
        isDark ? "border-white/[0.08] bg-white/[0.06]" : "border-slate-200/90 bg-slate-200/75"
      )}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={cn(
                "px-4 py-4 space-y-2",
                isDark ? "bg-[#080F2E]" : "bg-white"
              )}
            >
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Unboxed Highlights Carousel */}
      <div className="space-y-3 py-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28 rounded-lg" />
          <Skeleton className="h-3.5 w-16 rounded-md" />
        </div>

        <div className="flex gap-4 overflow-x-hidden pt-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Underline Tabs Bar */}
      <div className={cn(
        "flex gap-5 overflow-x-hidden py-3 border-b",
        isDark ? "border-white/[0.08]" : "border-slate-200/80"
      )}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-5 w-16 rounded shrink-0" />
        ))}
      </div>

      {/* 5. Feed Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-xl sm:rounded-2xl bg-slate-200 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}
