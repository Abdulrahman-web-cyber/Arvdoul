/**
 * Production-grade 'Featured by [Name]' Canvas Section.
 * Renders pinned/featured creations cleanly on the profile canvas without an enclosing box wrapper.
 *
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Pin, Play, Images, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { pickDisplayName } from '../../services/profileReadModel.js';
import { LazyImage } from '../../components/Shared/LazyImage';

const ProfileFeaturedSection = memo(({
  profile,
  posts = [],
  theme = 'dark',
  isOwner = false,
  onPostClick,
  onViewAll,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const creatorName = pickDisplayName([profile?.displayName, profile?.name], { fallback: '—' });

  const items = React.useMemo(() => {
    if (Array.isArray(posts) && posts.length > 0) {
      const pinned = posts.filter(p => p.isPinned || p.isFeatured || p.featured || p.pinned);
      if (pinned.length > 0) {
        return pinned.slice(0, 3).map((p, idx) => {
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
            type: p.type || 'post',
            badgeType: idx === 0 ? 'Pinned Post' : (idx === 1 ? 'Pinned Reel' : 'Featured'),
            title: p.title || p.caption || 'Featured Creation',
            cover: p.mediaURL || p.thumbnailUrl || p.cover || p.mediaUrl || '',
            likes: formattedLikes,
          };
        }).filter(item => Boolean(item.cover));
      }
    }
    return [];
  }, [posts]);

  if (items.length === 0) {
    return null;
  }

  const showCollectionsCard = Boolean(isOwner);

  return (
    <section aria-label="Featured Creations" className="w-full py-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-arvdoul-purple shrink-0" />
          <h2 className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
            Featured by {creatorName}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onViewAll) onViewAll();
            else navigate(`/profile/${profile?.id || profile?.uid || 'me'}?tab=posts`);
          }}
          className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-semibold text-arvdoul-purple dark:text-purple-300 hover:underline transition-opacity cursor-pointer shrink-0"
        >
          <span>See all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            aria-label={`${item.badgeType}: ${item.title}`}
            className="group relative aspect-[16/11] w-full text-left rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer border border-slate-200/60 dark:border-white/10 bg-slate-900 select-none hover:scale-[1.015] active:scale-[0.985] transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
          >
            <LazyImage
              src={item.cover}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />

            <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 backdrop-blur-md text-white">
              {item.type === 'reel' ? (
                <Play className="w-2.5 h-2.5 fill-white" />
              ) : item.type === 'album' ? (
                <Images className="w-2.5 h-2.5" />
              ) : (
                <Pin className="w-2.5 h-2.5 fill-white" />
              )}
              <span>{item.badgeType}</span>
            </div>

            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <h3 className="text-xs font-semibold truncate group-hover:text-purple-300 transition-colors">
                {item.title}
              </h3>
            </div>
          </button>
        ))}

        {showCollectionsCard && (
          <button
            type="button"
            onClick={() => navigate('/collections')}
            className={cn(
              "group relative aspect-[16/11] w-full rounded-xl sm:rounded-2xl border border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-arvdoul-purple",
              isDark
                ? "border-white/15 bg-white/[0.02] hover:bg-white/[0.05] text-white"
                : "border-slate-300 bg-white/60 hover:bg-white text-slate-800"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold">More</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Handpicked</div>
          </button>
        )}
      </div>
    </section>
  );
});

ProfileFeaturedSection.displayName = 'ProfileFeaturedSection';

export default ProfileFeaturedSection;
