import React from "react";

/**
 * Universal Shimmer component using CSS gradient animation
 */
export function Shimmer({ className = "" }) {
  return (
    <div
      className={`bg-gray-200/70 dark:bg-white/[0.07] shimmer rounded-xl ${className}`}
    />
  );
}

/**
 * Screen Header placeholder
 */
export function HeaderSkeleton() {
  return (
    <div className="w-full h-14 border-b border-gray-200/60 dark:border-white/10 px-4 flex items-center justify-between bg-white/70 dark:bg-[#03071B]/70 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-xl" />
        <Shimmer className="w-24 h-4 rounded-md" />
      </div>
      <div className="flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-full" />
        <Shimmer className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Stories / VibeStrip skeleton
 */
export function StoriesSkeleton({ count = 6 }) {
  return (
    <div className="flex gap-4 overflow-x-hidden py-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10">
            <Shimmer className="w-full h-full rounded-full" />
          </div>
          <Shimmer className="w-12 h-2.5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Feed post card skeleton
 */
export function PostSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-white/10 p-4 sm:p-5 shadow-sm space-y-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shimmer className="w-11 h-11 rounded-full flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Shimmer className="w-32 h-3.5 rounded-md" />
          <Shimmer className="w-20 h-2.5 rounded-md" />
        </div>
        <Shimmer className="w-7 h-7 rounded-full" />
      </div>

      {/* Content Text lines */}
      <div className="space-y-2 py-1">
        <Shimmer className="w-full h-3.5 rounded-md" />
        <Shimmer className="w-4/5 h-3.5 rounded-md" />
        <Shimmer className="w-2/3 h-3.5 rounded-md" />
      </div>

      {/* Media placeholder */}
      <Shimmer className="w-full h-64 sm:h-80 rounded-xl" />

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-4">
          <Shimmer className="w-14 h-7 rounded-full" />
          <Shimmer className="w-14 h-7 rounded-full" />
          <Shimmer className="w-14 h-7 rounded-full" />
        </div>
        <Shimmer className="w-8 h-7 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Full HomeScreen Screen Skeleton
 */
export function HomeScreenSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-[#03071B] flex flex-col">
      <HeaderSkeleton />
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-2 space-y-3">
        {/* Vibe Stories */}
        <StoriesSkeleton count={6} />
        {/* Feed tabs */}
        <div className="flex gap-2 px-4 py-1">
          <Shimmer className="w-24 h-8 rounded-full" />
          <Shimmer className="w-24 h-8 rounded-full" />
          <Shimmer className="w-24 h-8 rounded-full" />
        </div>
        {/* Posts list */}
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </div>
  );
}

/**
 * FeedSkeleton alias
 */
export function FeedSkeleton({ count = 2 }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-2 space-y-4">
      <StoriesSkeleton count={6} />
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Full Create Post Screen Skeleton
 */
export function CreatePostSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-[#030712] flex flex-col">
      {/* Header */}
      <div className="h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/30 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Shimmer className="w-6 h-6 rounded-full" />
          <Shimmer className="w-28 h-4 rounded-md" />
        </div>
        <Shimmer className="w-16 h-8 rounded-full" />
      </div>

      {/* Body */}
      <div className="max-w-lg w-full mx-auto p-4 space-y-5">
        {/* Top Hero Card */}
        <div className="rounded-3xl p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 space-y-3 text-center">
          <Shimmer className="w-36 h-6 rounded-md mx-auto" />
          <Shimmer className="w-64 h-3.5 rounded-md mx-auto" />
        </div>

        {/* Post Types Grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/40 p-4 flex flex-col items-center justify-center space-y-2.5"
            >
              <Shimmer className="w-10 h-10 rounded-full" />
              <Shimmer className="w-14 h-3 rounded-md" />
              <Shimmer className="w-10 h-2 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Full Profile Screen Skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-[#03071B] flex flex-col">
      <HeaderSkeleton />
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
    </div>
  );
}

/**
 * Chat and Messaging Screen Skeleton
 */
export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full min-h-[70vh] bg-white dark:bg-[#080F2E] rounded-2xl border border-gray-200/80 dark:border-white/10 p-4 space-y-4">
      {/* Top chat partner bar */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <Shimmer className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Shimmer className="w-28 h-3.5 rounded-md" />
          <Shimmer className="w-16 h-2.5 rounded-md" />
        </div>
        <Shimmer className="w-8 h-8 rounded-full" />
      </div>

      {/* Messages bubbles */}
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

      {/* Input bar */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200/60 dark:border-white/10">
        <Shimmer className="w-9 h-9 rounded-full" />
        <Shimmer className="flex-1 h-10 rounded-full" />
        <Shimmer className="w-9 h-9 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Full Videos Screen Skeleton
 */
export function VideosScreenSkeleton() {
  return (
    <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden bg-gray-900 border border-white/10 shadow-2xl flex flex-col justify-between p-4">
        {/* Top header */}
        <div className="flex justify-between items-center z-10">
          <Shimmer className="w-20 h-6 rounded-full" />
          <Shimmer className="w-8 h-8 rounded-full" />
        </div>

        {/* Right action column */}
        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 z-10">
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
        </div>

        {/* Bottom user & caption info */}
        <div className="space-y-2 z-10 max-w-[75%]">
          <div className="flex items-center gap-2">
            <Shimmer className="w-8 h-8 rounded-full" />
            <Shimmer className="w-24 h-4 rounded-md" />
          </div>
          <Shimmer className="w-full h-3 rounded-md" />
          <Shimmer className="w-3/4 h-3 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Post Details Screen Skeleton
 */
export function PostScreenSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-[#03071B] flex flex-col">
      <HeaderSkeleton />
      <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-4">
        <PostSkeleton />
        {/* Comments Section skeleton */}
        <div className="rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-white/10 p-5 space-y-4">
          <Shimmer className="w-32 h-4 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Shimmer className="w-24 h-3 rounded-md" />
                  <Shimmer className="w-full h-3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generic Screen Skeleton
 */
export function GenericScreenSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-[#03071B] flex flex-col">
      <HeaderSkeleton />
      <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Shimmer className="w-48 h-7 rounded-lg" />
        <Shimmer className="w-full h-40 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Shimmer className="h-32 rounded-xl" />
          <Shimmer className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default {
  Shimmer,
  HeaderSkeleton,
  StoriesSkeleton,
  PostSkeleton,
  HomeScreenSkeleton,
  FeedSkeleton,
  CreatePostSkeleton,
  ProfileSkeleton,
  ChatSkeleton,
  VideosScreenSkeleton,
  PostScreenSkeleton,
  GenericScreenSkeleton,
};
