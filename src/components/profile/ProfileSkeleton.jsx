// src/components/profile/ProfileSkeleton.jsx

import { Skeleton } from '../UI/Skeleton';
import { cn } from '../../lib/utils';

export default function ProfileSkeleton({ theme = 'light', variant = 'public' }) {
  const isDark = theme === 'dark';
  const isOwner = variant === 'owner';

  const cardSurface = isDark
    ? 'border-white/[0.08] bg-white/[0.025] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'border-white/90 bg-white/75 backdrop-blur-xl shadow-xs';

  const cellSkeleton = isDark ? 'bg-white/[0.04]' : 'bg-slate-200/75';

  return (
    <div
      aria-label="Loading profile"
      className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 pt-2 pb-6 sm:pt-3 space-y-4 sm:space-y-5 lg:space-y-6 animate-pulse"
    >
      {/* 1. Centered Hero Skeleton matching ProfileHeroSection */}
      <div className="mx-auto w-full max-w-[520px] flex flex-col items-center text-center pt-1">
        {/* Circular Portrait */}
        <div
          className={cn(
            'rounded-full p-1.5 border',
            isDark ? 'bg-white/[0.025] border-white/[0.10]' : 'bg-slate-200/70 border-white'
          )}
          style={{ width: 'clamp(96px, 26vw, 128px)', height: 'clamp(96px, 26vw, 128px)' }}
        >
          <div className={cn('w-full h-full rounded-full', cellSkeleton)} />
        </div>

        {/* Display Name, @handle, and equal Level/Designation pills */}
        <Skeleton className={cn('mt-3 h-7 w-44 sm:w-52 rounded-xl', cellSkeleton)} />
        <Skeleton className={cn('mt-1.5 h-3.5 w-28 rounded-lg', cellSkeleton)} />
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Skeleton className={cn('h-[30px] w-24 rounded-full', cellSkeleton)} />
          <Skeleton className={cn('h-[30px] w-24 rounded-full', cellSkeleton)} />
        </div>

        {/* Single-line Metadata + Bio */}
        <div className="mt-2.5 flex items-center justify-center gap-2.5">
          <Skeleton className={cn('h-3 w-20 rounded-md', cellSkeleton)} />
          <Skeleton className={cn('h-3 w-20 rounded-md', cellSkeleton)} />
          <Skeleton className={cn('h-3 w-16 rounded-md', cellSkeleton)} />
        </div>
        <div className="mt-2.5 w-full max-w-[40ch] space-y-1.5 flex flex-col items-center">
          <Skeleton className={cn('h-3 w-full rounded-md', cellSkeleton)} />
          <Skeleton className={cn('h-3 w-2/3 rounded-md', cellSkeleton)} />
        </div>

        {/* Single-row Action Bar: Primary pill + 4 square icon tiles */}
        <div className="mt-3 w-full flex items-center gap-1.5 sm:gap-2">
          <Skeleton className={cn('flex-1 h-[44px] rounded-[16px]', cellSkeleton)} />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={cn('w-[44px] h-[44px] rounded-[16px] shrink-0', cellSkeleton)} />
          ))}
        </div>
      </div>

      {/* 2. Single-row Metrics Strip + Treasury (Owner) */}
      <div className={cn('grid grid-cols-1 gap-4 sm:gap-5 items-stretch', isOwner && 'lg:grid-cols-12')}>
        <div className={cn('min-w-0', isOwner ? 'lg:col-span-7' : 'w-full')}>
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={cn(
                  'min-h-[62px] sm:min-h-[82px] rounded-[13px] sm:rounded-[18px] border p-1.5 sm:p-2.5 flex flex-col items-center justify-center gap-1.5',
                  cardSurface
                )}
              >
                <Skeleton className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md', cellSkeleton)} />
                <Skeleton className={cn('w-7 sm:w-9 h-3.5 sm:h-4 rounded', cellSkeleton)} />
                <Skeleton className={cn('w-8 sm:w-11 h-2 rounded', cellSkeleton)} />
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <div className={cn('lg:col-span-5 rounded-[22px] border p-4 flex items-center justify-between gap-3', cardSurface)}>
            <div className="flex items-center gap-3">
              <Skeleton className={cn('w-10 h-10 rounded-xl shrink-0', cellSkeleton)} />
              <div className="space-y-1.5">
                <Skeleton className={cn('h-3 w-24 rounded', cellSkeleton)} />
                <Skeleton className={cn('h-5 w-20 rounded', cellSkeleton)} />
              </div>
            </div>
            <Skeleton className={cn('w-5 h-5 rounded-md shrink-0', cellSkeleton)} />
          </div>
        )}
      </div>

      {/* 3. Progression + Highlights */}
      {isOwner ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            <div className={cn('lg:col-span-7 rounded-[20px] border p-3.5 sm:p-4 space-y-2.5', cardSurface)}>
              <div className="flex items-center gap-3">
                <Skeleton className={cn('w-10 h-10 rounded-xl shrink-0', cellSkeleton)} />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between gap-2">
                    <Skeleton className={cn('h-4 w-32 rounded', cellSkeleton)} />
                    <Skeleton className={cn('h-3.5 w-16 rounded', cellSkeleton)} />
                  </div>
                  <Skeleton className={cn('h-1.5 w-full rounded-full', cellSkeleton)} />
                </div>
              </div>
            </div>

            <div className={cn('lg:col-span-5 rounded-[22px] border px-3.5 py-2.5 space-y-2', cardSurface)}>
              <div className="flex items-center justify-between">
                <Skeleton className={cn('h-4 w-24 rounded', cellSkeleton)} />
                <Skeleton className={cn('h-3 w-14 rounded', cellSkeleton)} />
              </div>
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={cn('w-14 h-14 rounded-full', cellSkeleton)} />
                    <Skeleton className={cn('h-2.5 w-11 rounded', cellSkeleton)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Creator Dashboard Strip */}
          <div className={cn('rounded-[22px] border p-3.5 sm:p-4 space-y-3', cardSurface)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className={cn('w-5 h-5 rounded-md', cellSkeleton)} />
                <div className="space-y-1">
                  <Skeleton className={cn('h-4 w-32 rounded', cellSkeleton)} />
                  <Skeleton className={cn('h-2.5 w-24 rounded', cellSkeleton)} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className={cn('h-9 w-24 rounded-xl hidden sm:block', cellSkeleton)} />
                <Skeleton className={cn('h-9 w-24 rounded-xl', cellSkeleton)} />
                <Skeleton className={cn('h-9 w-9 rounded-xl', cellSkeleton)} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={cn('rounded-[22px] border p-3.5 flex items-center justify-between gap-3', cardSurface)}>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className={cn('w-8 h-8 rounded-full', cellSkeleton)} />
              ))}
            </div>
            <Skeleton className={cn('h-3.5 w-40 rounded', cellSkeleton)} />
          </div>
          <Skeleton className={cn('h-7 w-16 rounded-lg', cellSkeleton)} />
        </div>
      )}

      {/* 5. Tabs Strip + Media Feed Grid */}
      <div className={cn('flex items-center gap-2 overflow-hidden px-3 py-2 rounded-[18px] border', cardSurface)}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className={cn('h-8 w-16 rounded-xl shrink-0', cellSkeleton)} />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-[20px] sm:rounded-[24px] border',
              cardSurface
            )}
          />
        ))}
      </div>
    </div>
  );
}
