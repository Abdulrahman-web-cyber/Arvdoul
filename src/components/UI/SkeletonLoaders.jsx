// src/components/UI/SkeletonLoaders.jsx
// Authentic, non-intrusive screen skeletons matching the Arvdoul design system.
import React from "react";

/**
 * Universal Shimmer component using smooth pulse/gradient
 */
export function Shimmer({ className = "" }) {
  return (
    <div
      className={`bg-gray-200/80 dark:bg-white/[0.08] shimmer rounded-xl ${className}`}
    />
  );
}

/**
 * Stories / VibeStrip skeleton
 */
export function StoriesSkeleton({ count = 6 }) {
  return (
    <div className="flex items-center gap-4 overflow-x-hidden py-3 px-3 sm:px-4 bg-white/70 dark:bg-[#080F2E]/70 backdrop-blur-md rounded-2xl border border-gray-200/70 dark:border-white/10 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 border-2 border-violet-500/20 dark:border-violet-400/20">
            <Shimmer className="w-full h-full rounded-full" />
          </div>
          <Shimmer className="w-11 sm:w-12 h-2.5 rounded-full" />
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
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <Shimmer className="w-28 sm:w-36 h-3.5 rounded-md" />
            <Shimmer className="w-12 h-3 rounded-full" />
          </div>
          <Shimmer className="w-20 h-2.5 rounded-md" />
        </div>
        <Shimmer className="w-7 h-7 rounded-full" />
      </div>

      {/* Content Text lines */}
      <div className="space-y-2 py-0.5">
        <Shimmer className="w-full h-3.5 rounded-md" />
        <Shimmer className="w-11/12 h-3.5 rounded-md" />
        <Shimmer className="w-3/5 h-3.5 rounded-md" />
      </div>

      {/* Media placeholder */}
      <Shimmer className="w-full h-56 sm:h-72 rounded-2xl" />

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 sm:gap-4">
          <Shimmer className="w-16 h-8 rounded-full" />
          <Shimmer className="w-16 h-8 rounded-full" />
          <Shimmer className="w-16 h-8 rounded-full" />
        </div>
        <Shimmer className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}

/**
 * HomeScreen Screen Skeleton (Authentic page content, no duplicate headers)
 */
export function HomeScreenSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Vibe Stories */}
      <StoriesSkeleton count={6} />
      {/* Feed tabs */}
      <div className="flex items-center gap-2 px-1 py-1">
        <Shimmer className="w-24 h-9 rounded-xl" />
        <Shimmer className="w-24 h-9 rounded-xl" />
        <Shimmer className="w-24 h-9 rounded-xl" />
      </div>
      {/* Posts list */}
      <PostSkeleton />
      <PostSkeleton />
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
 * Create Post Screen Skeleton
 */
export function CreatePostSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Wizard Steps Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-[#080F2E] p-4 rounded-2xl border border-gray-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Shimmer className="w-8 h-8 rounded-xl" />
          <Shimmer className="w-36 h-4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="w-20 h-7 rounded-full" />
          <Shimmer className="w-20 h-7 rounded-full" />
          <Shimmer className="w-20 h-7 rounded-full" />
        </div>
      </div>

      {/* Main Studio Card */}
      <div className="bg-white dark:bg-[#080F2E] p-5 sm:p-7 rounded-3xl border border-gray-200/80 dark:border-white/10 space-y-5">
        {/* Post Type Chips */}
        <div className="flex items-center gap-2 overflow-x-hidden pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="w-24 h-10 rounded-xl flex-shrink-0" />
          ))}
        </div>

        {/* Text Area */}
        <Shimmer className="w-full h-36 rounded-2xl" />

        {/* Media Upload Box */}
        <Shimmer className="w-full h-44 rounded-2xl" />

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
          <Shimmer className="w-24 h-10 rounded-xl" />
          <Shimmer className="w-36 h-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Profile Screen Skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 rounded-b-3xl overflow-hidden bg-gray-200/60 dark:bg-white/[0.06]">
        <Shimmer className="w-full h-full rounded-none" />
      </div>

      {/* Profile Card Info */}
      <div className="px-4 sm:px-6 relative -mt-16 sm:-mt-20">
        <div className="bg-white dark:bg-[#080F2E] rounded-3xl p-5 sm:p-7 border border-gray-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white dark:border-[#080F2E] shadow-md overflow-hidden flex-shrink-0">
                <Shimmer className="w-full h-full rounded-none" />
              </div>
              <div className="space-y-2 pb-1">
                <Shimmer className="w-36 sm:w-48 h-5 rounded-md" />
                <Shimmer className="w-24 h-3.5 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shimmer className="w-28 h-10 rounded-xl" />
              <Shimmer className="w-10 h-10 rounded-xl" />
            </div>
          </div>

          {/* Bio lines */}
          <div className="space-y-2 pt-2">
            <Shimmer className="w-full sm:w-3/4 h-3.5 rounded-md" />
            <Shimmer className="w-1/2 h-3.5 rounded-md" />
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100 dark:border-white/5">
            <Shimmer className="w-20 h-5 rounded-md" />
            <Shimmer className="w-24 h-5 rounded-md" />
            <Shimmer className="w-24 h-5 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 flex gap-2">
        <Shimmer className="w-24 h-9 rounded-xl" />
        <Shimmer className="w-24 h-9 rounded-xl" />
        <Shimmer className="w-24 h-9 rounded-xl" />
      </div>

      {/* Grid of Posts */}
      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Chat Screen Skeleton
 */
export function ChatSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto h-[calc(100vh-6rem)] p-3 sm:p-4 flex gap-4">
      {/* Conversations List */}
      <div className="w-72 sm:w-80 hidden md:flex flex-col bg-white dark:bg-[#080F2E] rounded-3xl border border-gray-200/80 dark:border-white/10 p-4 space-y-3">
        <Shimmer className="w-full h-10 rounded-xl" />
        <div className="space-y-2.5 flex-1 overflow-hidden pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-2xl">
              <Shimmer className="w-11 h-11 rounded-full flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Shimmer className="w-28 h-3.5 rounded-md" />
                <Shimmer className="w-40 h-2.5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#080F2E] rounded-3xl border border-gray-200/80 dark:border-white/10 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5">
              <Shimmer className="w-28 h-3.5 rounded-md" />
              <Shimmer className="w-16 h-2.5 rounded-md" />
            </div>
          </div>
          <Shimmer className="w-8 h-8 rounded-full" />
        </div>

        {/* Message bubbles */}
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
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
          <Shimmer className="w-9 h-9 rounded-full" />
          <Shimmer className="flex-1 h-11 rounded-xl" />
          <Shimmer className="w-10 h-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Videos Screen Skeleton
 */
export function VideosScreenSkeleton() {
  return (
    <div className="w-full min-h-[calc(100vh-6rem)] flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden bg-gray-900 border border-white/10 shadow-2xl flex flex-col justify-between p-4">
        <div className="flex justify-between items-center z-10">
          <Shimmer className="w-20 h-6 rounded-full" />
          <Shimmer className="w-8 h-8 rounded-full" />
        </div>

        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 z-10">
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
          <Shimmer className="w-11 h-11 rounded-full" />
        </div>

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
    <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
      <PostSkeleton />
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
  );
}

/**
 * Generic Screen Skeleton (Clean, header-less page content placeholder)
 */
export function GenericScreenSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Shimmer className="w-48 h-7 rounded-xl" />
      <Shimmer className="w-full h-36 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Shimmer className="h-32 rounded-2xl" />
        <Shimmer className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Sleek, non-intrusive Suspense fallback for general routes.
 * Avoids flashing full fake dashboard layouts.
 */
export function RouteFallback() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-16 min-h-[50vh]">
      <div className="w-7 h-7 rounded-full border-2 border-violet-500/20 border-t-violet-600 animate-spin" />
    </div>
  );
}

export default {
  Shimmer,
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
  RouteFallback,
};
