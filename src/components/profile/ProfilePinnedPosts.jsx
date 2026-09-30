// src/components/profile/ProfilePinnedPosts.jsx

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, Heart, ChevronRight, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfilePinnedPosts = memo(({
  posts = [],
  theme = 'light',
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const pinnedItems = (posts && posts.filter(p => p.isPinned).length > 0)
    ? posts.filter(p => p.isPinned).slice(0, 3)
    : posts.slice(0, 3);

  return (
    <div className={cn(
      "w-full rounded-2xl p-5 sm:p-6 border transition-all shadow-sm",
      isDark
        ? "bg-[#0B0F19] border-slate-800 text-white"
        : "bg-white border-slate-200 text-slate-900"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Pin className="w-4 h-4 fill-indigo-500/20" />
          </div>
          <h2 className="font-bold text-sm sm:text-base">
            Pinned Posts
          </h2>
        </div>

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3 Pinned Cards */}
      {pinnedItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No pinned posts yet.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {pinnedItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-md bg-slate-900"
          >
            {(item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image) ? (
              <img
                src={item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image}
                alt={item.title || item.caption || item.text || 'Pinned post'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-indigo-900/40 via-purple-950/40 to-slate-900">
                <span className="text-xs font-semibold text-slate-200 line-clamp-3">
                  {item.content || item.caption || item.text || item.title || 'Pinned Post'}
                </span>
                <span className="text-[10px] text-slate-400 capitalize">{item.type || 'post'}</span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Top Pin Badge */}
            <div className="absolute top-2.5 right-2.5">
              <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-400 shadow">
                <Pin className="w-3.5 h-3.5 fill-amber-400" />
              </div>
            </div>

            {/* Bottom Content */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <h3 className="text-xs font-bold line-clamp-1 group-hover:text-purple-300 transition-colors">
                {item.title || item.caption || 'Featured post'}
              </h3>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-300">
                <span className="flex items-center gap-1 font-semibold text-rose-400">
                  <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                  {item.likes || item.likesCount || 0}
                </span>
                {item.type === 'video' && (
                  <span className="flex items-center gap-1 font-semibold text-cyan-300">
                    <Play className="w-3 h-3 fill-cyan-300" />
                    <span>0:45</span>
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

ProfilePinnedPosts.displayName = 'ProfilePinnedPosts';

export default ProfilePinnedPosts;
