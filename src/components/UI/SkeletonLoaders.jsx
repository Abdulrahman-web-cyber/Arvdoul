import React from "react";

export function Shimmer({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-200/80 dark:bg-gray-800/80 rounded-xl before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 dark:before:via-white/5 before:to-transparent ${className}`}
    />
  );
}

export function StoriesSkeleton({ count = 6 }) {
  return (
    <div className="flex gap-4 overflow-x-hidden py-3 px-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-800">
            <Shimmer className="w-full h-full rounded-full" />
          </div>
          <Shimmer className="w-12 h-2.5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800/80 p-5 shadow-sm space-y-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shimmer className="w-11 h-11 rounded-full flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Shimmer className="w-32 h-3.5 rounded-md" />
          <Shimmer className="w-20 h-2.5 rounded-md" />
        </div>
        <Shimmer className="w-6 h-6 rounded-full" />
      </div>

      {/* Content Text lines */}
      <div className="space-y-2 py-1">
        <Shimmer className="w-full h-3 rounded-md" />
        <Shimmer className="w-4/5 h-3 rounded-md" />
        <Shimmer className="w-2/3 h-3 rounded-md" />
      </div>

      {/* Media placeholder */}
      <Shimmer className="w-full h-64 sm:h-80 rounded-xl" />

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-6">
          <Shimmer className="w-14 h-6 rounded-full" />
          <Shimmer className="w-14 h-6 rounded-full" />
          <Shimmer className="w-14 h-6 rounded-full" />
        </div>
        <Shimmer className="w-8 h-6 rounded-full" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto py-2">
      <StoriesSkeleton />
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 rounded-b-3xl overflow-hidden">
        <Shimmer className="w-full h-full rounded-none" />
      </div>

      {/* Profile Header Info */}
      <div className="px-4 sm:px-6 relative -mt-16 sm:-mt-20">
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          <div className="relative">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 bg-white dark:bg-[#03071B] shadow-xl">
              <Shimmer className="w-full h-full rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Shimmer className="w-28 h-10 rounded-xl" />
            <Shimmer className="w-10 h-10 rounded-xl" />
          </div>
        </div>

        <div className="mt-4 space-y-2 text-center sm:text-left">
          <Shimmer className="w-48 h-5 rounded-md mx-auto sm:mx-0" />
          <Shimmer className="w-32 h-3.5 rounded-md mx-auto sm:mx-0" />
          <Shimmer className="w-72 h-3 rounded-md mx-auto sm:mx-0 mt-2" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 my-6 max-w-md mx-auto sm:mx-0">
          <Shimmer className="h-16 rounded-xl" />
          <Shimmer className="h-16 rounded-xl" />
          <Shimmer className="h-16 rounded-xl" />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-2 mb-6">
          <Shimmer className="w-24 h-8 rounded-lg" />
          <Shimmer className="w-24 h-8 rounded-lg" />
          <Shimmer className="w-24 h-8 rounded-lg" />
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <Shimmer className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Shimmer className="w-28 h-3.5 rounded-md" />
          <Shimmer className="w-16 h-2.5 rounded-md" />
        </div>
      </div>
      <div className="flex-1 space-y-4 py-4">
        <div className="flex items-start gap-2.5">
          <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
          <Shimmer className="w-48 h-12 rounded-2xl rounded-tl-sm" />
        </div>
        <div className="flex items-end justify-end gap-2.5">
          <Shimmer className="w-64 h-16 rounded-2xl rounded-tr-sm" />
        </div>
        <div className="flex items-start gap-2.5">
          <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
          <Shimmer className="w-36 h-10 rounded-2xl rounded-tl-sm" />
        </div>
      </div>
    </div>
  );
}

export default {
  Shimmer,
  StoriesSkeleton,
  PostSkeleton,
  FeedSkeleton,
  ProfileSkeleton,
  ChatSkeleton,
};
