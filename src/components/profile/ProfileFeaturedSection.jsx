/**
 * Production-grade 'Featured by [Name]' Section for Public Profile view.
 * Matches Image 2 hierarchy:
 * - Header with Sparkles icon, 'Featured by [Name]' and 'See all >' button
 * - 4 horizontal cards:
 *   1. Pinned Post (with Pin icon & title)
 *   2. Pinned Reel (with Play icon & title)
 *   3. Pinned Album (with Album icon & title)
 *   4. More Handpicked card (with Sparkles icon)
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Pin, Play, Images, ChevronRight, Heart } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileFeaturedSection = memo(({
  profile,
  posts = [],
  theme = 'dark',
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const creatorName = profile?.displayName || 'Creator';

  // Extract pinned or featured posts if available (strictly real posts)
  const items = React.useMemo(() => {
    if (Array.isArray(posts) && posts.length > 0) {
      const pinned = posts.filter(p => p.isPinned || p.isFeatured || p.featured || p.pinned);
      if (pinned.length > 0) {
        return pinned.slice(0, 3).map((p, idx) => {
          const rawLikes = p.likesCount ?? (Array.isArray(p.likes) ? p.likes.length : p.likes) ?? 0;
          const numLikes = Number(rawLikes) || 0;
          const formattedLikes = numLikes >= 1000000 
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

  // If creator has no explicit featured items, don't show mock photos
  if (items.length === 0) {
    return null;
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
          <Sparkles className="w-4 h-4 text-purple-500 fill-purple-500" />
          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Featured by {creatorName}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/profile/${profile?.id || profile?.uid || 'user'}/posts`)}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span>See all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className="group relative aspect-[16/11] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-md bg-slate-900 select-none hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <img
              src={item.cover}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

            {/* Top Badge: Type Indicator */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/15">
              {item.type === 'reel' ? (
                <Play className="w-2.5 h-2.5 fill-white" />
              ) : item.type === 'album' ? (
                <Images className="w-2.5 h-2.5" />
              ) : (
                <Pin className="w-2.5 h-2.5 fill-white" />
              )}
              <span>{item.badgeType}</span>
            </div>

            {/* Bottom Title & Info */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <h3 className="text-xs font-bold truncate group-hover:text-purple-300 transition-colors">
                {item.title}
              </h3>
            </div>
          </div>
        ))}

        {/* 4th Card: More Handpicked */}
        <div
          onClick={() => navigate(`/profile/${profile?.id || profile?.uid || 'user'}/collections`)}
          className={cn(
            "group relative aspect-[16/11] rounded-2xl border border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "border-white/15 bg-white/[0.02] hover:bg-white/[0.05] text-white"
              : "border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-slate-800"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4 fill-purple-500/20" />
          </div>
          <div className="text-xs font-bold">
            More
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            Handpicked
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileFeaturedSection.displayName = 'ProfileFeaturedSection';

export default ProfileFeaturedSection;
