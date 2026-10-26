/**
 * Production-grade Pinned Posts Section.
 * Recreates the exact 4-card grid from both reference images:
 * - Header: '📌 Pinned Posts' and 'View all >'
 * - 4 cards with:
 *   - High-fidelity rounded cover image
 *   - Pin badge icon on top right
 *   - Red heart icon + like count on bottom left
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, Heart, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfilePinnedPosts = memo(({
  posts = [],
  isOwner = false,
  theme = 'light',
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const items = React.useMemo(() => {
    if (Array.isArray(posts) && posts.length > 0) {
      const pinned = posts.filter(p => p.isPinned || p.pinned);
      if (pinned.length > 0) {
        return pinned.slice(0, 4).map((p) => {
          const rawLikes = p.likesCount ?? (Array.isArray(p.likes) ? p.likes.length : p.likes) ?? 0;
          const numLikes = Number(rawLikes) || 0;
          const formattedLikes = numLikes >= 1000000 
            ? `${(numLikes / 1000000).toFixed(1)}M` 
            : numLikes >= 1000 
              ? `${(numLikes / 1000).toFixed(1)}K` 
              : `${numLikes}`;

          return {
            id: p.id,
            title: p.title || p.caption || 'Pinned post',
            image: p.mediaURL || p.thumbnailUrl || p.mediaUrl || p.coverImage || p.image || '',
            likes: formattedLikes,
          };
        }).filter(item => Boolean(item.image));
      }
    }
    return [];
  }, [posts]);

  // If no pinned posts exist, return null for visitors or an empty state for owner
  if (items.length === 0) {
    if (!isOwner) return null;
    return (
      <div className={cn(
        "w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 border backdrop-blur-xl transition-all duration-200 shadow-sm",
        isDark
          ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Pin className="w-4 h-4 text-purple-600 dark:text-purple-400 rotate-45" />
          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Pinned Posts
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You haven't pinned any posts yet. Pin your top photos or videos to showcase them here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 border backdrop-blur-xl transition-all duration-200 shadow-sm",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-purple-600 dark:text-purple-400 rotate-45" />
          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Pinned Posts
          </h2>
        </div>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className="group relative aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-md bg-slate-900 select-none hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30" />

            {/* Top Right: Pin Badge */}
            <div className="absolute top-2.5 right-2.5">
              <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white shadow-md">
                <Pin className="w-3 h-3 rotate-45" />
              </div>
            </div>

            {/* Bottom Left: Heart + Likes */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-white">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span className="text-xs font-bold text-white drop-shadow-sm">
                {item.likes}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ProfilePinnedPosts.displayName = 'ProfilePinnedPosts';

export default ProfilePinnedPosts;
