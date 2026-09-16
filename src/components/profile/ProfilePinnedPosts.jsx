/**
 * src/components/profile/ProfilePinnedPosts.jsx - ARVDOUL Pinned Posts Section
 * 
 * Recreates the Pinned Posts row from the uploaded designs:
 * - Header with Pin icon and 'View all >' link
 * - 3 pinned post cards with aspect ratio, pinned badge, likes counter & click handler
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, Heart, ChevronRight, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

const DEFAULT_PINNED = [
  {
    id: 'pin-1',
    title: 'Visual Architecture Showcase',
    type: 'video',
    mediaURL: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    likes: 3420,
  },
  {
    id: 'pin-2',
    title: 'Arvdoul Mobile App Launch',
    type: 'image',
    mediaURL: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    likes: 2180,
  },
  {
    id: 'pin-3',
    title: 'Sound Design & Synth Session',
    type: 'audio',
    mediaURL: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80',
    likes: 1890,
  }
];

const ProfilePinnedPosts = memo(({
  posts = [],
  theme = 'light',
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const pinnedItems = (posts && posts.filter(p => p.isPinned).length > 0)
    ? posts.filter(p => p.isPinned).slice(0, 3)
    : (posts.length > 0 ? posts.slice(0, 3) : DEFAULT_PINNED);

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
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Pin className="w-4 h-4 fill-indigo-500/20" />
          </div>
          <h2 className="font-bold text-sm sm:text-base">
            Pinned Posts
          </h2>
        </div>

        <button
          onClick={() => navigate('/posts?pinned=true')}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3 Pinned Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {pinnedItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-md bg-slate-900"
          >
            <img
              src={item.mediaURL || item.thumbnailUrl || item.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'}
              alt={item.title || 'Pinned post'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

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
                  {item.likes || item.likesCount || 340}
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
    </div>
  );
});

ProfilePinnedPosts.displayName = 'ProfilePinnedPosts';

export default ProfilePinnedPosts;
