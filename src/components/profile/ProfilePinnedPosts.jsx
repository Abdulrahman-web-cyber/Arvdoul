/**
 * Production-grade Unboxed Pinned Posts Section.
 * Renders pinned showcase media directly on the profile canvas with a crisp
 * editorial section header and rounded media tiles.
 *
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, Heart, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LazyImage } from '../../components/Shared/LazyImage';

const ProfilePinnedPosts = memo(({
  posts = [],
  isOwner = false,
  profileId = null,
  theme = 'light',
  onPostClick,
  onViewAll,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const items = React.useMemo(() => {
    if (Array.isArray(posts) && posts.length > 0) {
      const pinned = posts.filter(p => p.isPinned || p.pinned);
      if (pinned.length > 0) {
        return pinned.slice(0, 4).map((p) => {
          const rawLikes = p.likesCount ?? (Array.isArray(p.likes) ? p.likes.length : p.likes) ?? p.stats?.likes;
          const numLikes = typeof rawLikes === 'number' ? rawLikes : null;
          const formattedLikes = numLikes == null
            ? '—'
            : numLikes >= 1000000
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

  if (items.length === 0) {
    if (!isOwner) return null;
    return (
      <div className={cn(
        "w-full rounded-[22px] px-4 py-4 border flex items-center justify-between gap-3 shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
        isDark
          ? "bg-white/[0.045] border-white/[0.12] text-white"
          : "bg-white/65 border-white/90 text-slate-900"
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Pin className="w-4 h-4 text-arvdoul-purple rotate-45 shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            You haven&apos;t pinned any posts yet. Pin top creations to spotlight them above your feed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Pinned Posts" className={cn("w-full rounded-[24px] border p-4 sm:p-5", isDark ? "bg-white/[0.035] border-white/[0.10]" : "bg-white/45 border-white/85")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-arvdoul-purple rotate-45" />
          <h2 className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
            Pinned Posts
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onViewAll) onViewAll();
            else navigate(isOwner ? '/profile' : profileId ? `/profile/${profileId}` : '/profile');
          }}
          className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-semibold text-arvdoul-purple dark:text-purple-300 hover:underline transition-opacity cursor-pointer"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            aria-label={item.title}
            className="group relative aspect-[3/4] sm:aspect-[4/3] w-full text-left rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer border border-slate-200/60 dark:border-white/10 bg-slate-900 select-none hover:scale-[1.015] active:scale-[0.985] transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
          >
            <LazyImage
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />

            <div className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/55 backdrop-blur-md text-white">
              <Pin className="w-3 h-3 rotate-45" />
            </div>

            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-white">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span className="text-xs font-bold tabular-nums drop-shadow-sm">
                {item.likes}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
});

ProfilePinnedPosts.displayName = 'ProfilePinnedPosts';

export default ProfilePinnedPosts;
