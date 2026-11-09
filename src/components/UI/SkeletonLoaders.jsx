// src/components/UI/SkeletonLoaders.jsx
//
// Lightweight, non-intrusive loaders adhering strictly to the TopAppLoadingBanner design.
// Zero screen-covering skeletons, zero layout interference.

import { TopAppLoadingBanner } from "../Navigation/RouteProgressBar.jsx";
import { cn } from "../../lib/utils";

export function StoriesSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading stories..." />;
}

/**
 * Row-shaped skeleton for list/inbox surfaces (notifications, connections,
 * search results). Matches the avatar + two-line row layout those screens use,
 * so the first paint has the same geometry as the loaded content and does not
 * shift when the real rows arrive.
 */
export function ListRowsSkeleton({ count = 6, className = "" }) {
  return (
    <div className={cn("w-full space-y-2.5", className)} role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl p-3 border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#0b101b]/70 animate-pulse"
        >
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-1/3 rounded-md bg-gray-200 dark:bg-white/10" />
            <div className="h-3 w-3/4 rounded-md bg-gray-200/70 dark:bg-white/5" />
          </div>
          <div className="h-3 w-10 rounded-md bg-gray-200/60 dark:bg-white/5 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function PostSkeleton({ count = 1 }) {
  return (
    <div className="w-full space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-full rounded-2xl p-4 border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#0b101b]/70 backdrop-blur-sm space-y-3.5 animate-pulse"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded-md bg-gray-200 dark:bg-white/10" />
              <div className="h-2.5 w-16 rounded-md bg-gray-200/70 dark:bg-white/5" />
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-200/60 dark:bg-white/5" />
          </div>

          {/* Body Text */}
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-md bg-gray-200 dark:bg-white/10" />
            <div className="h-3.5 w-4/5 rounded-md bg-gray-200/80 dark:bg-white/10" />
            <div className="h-3.5 w-2/3 rounded-md bg-gray-200/60 dark:bg-white/5" />
          </div>

          {/* Media box */}
          <div className="w-full h-52 sm:h-64 rounded-xl bg-gray-200/80 dark:bg-white/10" />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              <div className="h-7 w-12 rounded-full bg-gray-200/70 dark:bg-white/10" />
              <div className="h-7 w-12 rounded-full bg-gray-200/70 dark:bg-white/10" />
              <div className="h-7 w-12 rounded-full bg-gray-200/70 dark:bg-white/10" />
            </div>
            <div className="h-7 w-8 rounded-full bg-gray-200/70 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeScreenSkeleton() {
  return (
    <div className="w-full px-4 py-3 space-y-4">
      <TopAppLoadingBanner isAnimating={true} label="Loading fresh feed..." />
      <PostSkeleton count={3} />
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="w-full space-y-4">
      <PostSkeleton count={3} />
    </div>
  );
}

export function CreatePostSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Preparing creator studio..." />;
}

export function ProfileSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading profile..." />;
}

export function ChatSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading chats..." />;
}

export function VideosScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />;
}

export function PostScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading post..." />;
}

export function GenericScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} />;
}

export function RouteFallback() {
  return <TopAppLoadingBanner isAnimating={true} />;
}

export default {
  StoriesSkeleton,
  ListRowsSkeleton,
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
