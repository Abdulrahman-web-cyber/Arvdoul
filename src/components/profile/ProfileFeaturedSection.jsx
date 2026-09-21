// src/components/profile/ProfileFeaturedSection.jsx

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Pin, Heart, ChevronRight, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileFeaturedSection = memo(({
  profile,
  posts = [],
  theme = 'light',
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const creatorName = profile?.displayName || 'Creator';
  
  const items = posts.slice(0, 3);

  return (
    <div className={cn(
      "w-full rounded-3xl p-5 sm:p-6 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/70 border-white/10 text-white"
        : "bg-white/95 border-slate-200/90 text-slate-900"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm sm:text-base">
            Featured by {creatorName}
          </h2>
        </div>

        <button
          onClick={() => navigate(`/profile/${profile?.id || profile?.uid}`)}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity"
        >
          <span>See all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of 3 Featured Cards */}
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No featured posts yet.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-md bg-slate-900"
          >
            <img
              src={item.mediaURL || item.thumbnailUrl || item.mediaUrl}
              alt={item.title || 'Featured item'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Top Badges: Category & Pin */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10">
                {item.category || (item.type === 'video' ? 'Video' : 'Artwork')}
              </span>
              <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-400">
                <Pin className="w-3 h-3 fill-amber-400" />
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <h3 className="text-xs font-bold line-clamp-1 group-hover:text-purple-300 transition-colors">
                {item.title || 'Original Creation'}
              </h3>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-300">
                <span className="flex items-center gap-1 font-semibold text-rose-400">
                  <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                  {item.likes ?? 0}
                </span>
                {item.type === 'video' && (
                  <span className="flex items-center gap-1 font-semibold text-amber-300">
                    <Play className="w-3 h-3 fill-amber-300" />
                    <span>Video</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
});

ProfileFeaturedSection.displayName = 'ProfileFeaturedSection';

export default ProfileFeaturedSection;
