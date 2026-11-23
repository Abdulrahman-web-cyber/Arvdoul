// src/components/profile/ProfileSkeleton.jsx

import { Skeleton } from '../UI/Skeleton';
import { cn } from '../../lib/utils';

export default function ProfileSkeleton({ theme = 'light', variant = 'public' }) {
  const isDark = theme === 'dark';
  const isOwner = variant === 'owner';

  const cardSurface = isDark
    ? 'border-white/[0.10] bg-white/[0.04]'
    : 'border-white/90 bg-white/75';

  return (
    <div
      aria-label="Loading profile"
      className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-pulse"
    >
      {/* 1. Centered Editorial Hero Skeleton (matches ProfileHeroSection) */}
      <div className="mx-auto w-full max-w-[560px] flex flex-col items-center text-center pt-2 pb-1">
        {/* Orbital circular portrait */}
        <div
          className={cn(
            'rounded-full p-1.5',
            isDark ? 'bg-white/[0.08]' : 'bg-slate-200/80'
          )}
          style={{ width: 'clamp(148px, calc(100px + 15vw), 200px)', aspectRatio: '1 / 1' }}
        >
          <div className="w-full h-full rounded-full bg-slate-200 dark:bg-white/10" />
        </div>

        {/* Display name + @handle + Level pill */}
        <Skeleton className="mt-4 h-8 w-52 sm:w-64 rounded-xl" />
        <Skeleton className="mt-2 h-4 w-32 rounded-lg" />
        <Skeleton className="mt-2.5 h-9 w-36 rounded-full" />

        {/* Bio + metadata lines */}
        <div className="mt-4 w-full max-w-[42ch] space-y-2 flex flex-col items-center">
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
        </div>

        <div className="mt-3.5 flex items-center justify-center gap-3">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
        </div>

        {/* Principal CTA + 4-tile secondary dock */}
        <div className="mt-5 w-full max-w-[460px] space-y-2.5">
          <Skeleton className="w-full h-[52px] rounded-[18px]" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-full h-[64px] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      {isOwner ? (
        /* Owner Studio Skeleton Hierarchy */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            <div className={cn('lg:col-span-7 rounded-[24px] border overflow-hidden', cardSurface)}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'min-h-[84px] px-3.5 py-3.5 space-y-2.5',
                      isDark ? 'bg-[#0B1234]/34' : 'bg-white/75'
                    )}
                  >
                    <Skeleton className="h-3 w-14 rounded" />
                    <Skeleton className="h-6 w-12 rounded" />
                  </div>
                ))}
              </div>
            </div>

            <div className={cn('lg:col-span-5 rounded-[24px] border p-4 flex items-center justify-between gap-3', cardSurface)}>
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className={cn('lg:col-span-7 rounded-[24px] border p-4 sm:p-5 space-y-3', cardSurface)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
                <Skeleton className="h-8 w-28 rounded-xl" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            <div className={cn('lg:col-span-5 rounded-[24px] border p-4 sm:p-5 space-y-3', cardSurface)}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <div className="flex gap-3.5 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-white/10" />
                    <Skeleton className="h-2.5 w-12 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Visitor Content-First Skeleton Hierarchy */
        <>
          <div className={cn('rounded-[22px] border p-3.5 flex items-center justify-between gap-3', cardSurface)}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10" />
                ))}
              </div>
              <Skeleton className="h-3.5 w-44 rounded" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>

          <div className={cn('rounded-[24px] border p-4 sm:p-5 space-y-3', cardSurface)}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-slate-200 dark:bg-white/10" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tabs Strip + Media Feed Grid */}
      <div className={cn('flex gap-3 overflow-hidden px-3 py-2.5 rounded-[22px] border', cardSurface)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-[14px] shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-[20px] sm:rounded-[24px] bg-slate-200/80 dark:bg-white/[0.08]"
          />
        ))}
      </div>
    </div>
  );
}
