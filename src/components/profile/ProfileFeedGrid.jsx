// src/components/profile/ProfileFeedGrid.jsx

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, 
  MessageCircle, 
  Play, 
  Film, 
  Image as ImageIcon, 
  Bookmark,
  Award,
  Globe,
  MapPin,
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPerksForLevel } from '../../services/levelSystemService';

const ProfileFeedGrid = memo(({
  posts = [],
  savedPosts = [],
  videos = [],
  activeTab = 'posts',
  loading = false,
  error = null,
  isOnline = true,
  onRetry,
  hasMore = false,
  onLoadMore,
  theme = 'light',
  profile,
  onPostClick,
  onVideoClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Counts come from real post data only. A like list, number, or explicit
  // `*Count` field is accepted; anything else renders an honest dash.
  const countOf = (item, key) => {
    const v = item?.[key];
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number') return v;
    const alt = item?.[`${key}Count`];
    return typeof alt === 'number' ? alt : null;
  };

  // Handle 'about' tab
  if (activeTab === 'about') {
    // Perks are only meaningful against a known level; unknown means none are
    // shown rather than assuming level 1.
    const knownLevel = Number.isFinite(Number(profile?.level)) && Number(profile?.level) > 0
      ? Number(profile.level)
      : null;
    const perks = (knownLevel !== null && typeof getPerksForLevel === 'function')
      ? (getPerksForLevel(knownLevel) || [])
      : [];
    return (
      <div className={cn(
        "w-full rounded-2xl p-5 sm:p-6 border transition-all shadow-sm space-y-6",
        isDark ? "bg-arvdoul-bg-elevated border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
      )}>
        <div>
          <h3 className="text-base font-bold mb-2">About Creator</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {profile?.bio || 'No bio yet.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-white/10">
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Profile Information
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-500" />
                <span>Location: {profile?.location || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <span>Website: {profile?.website || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>
                  Citizen Since:{' '}
                  {profile?.createdAt
                    ? new Date(profile.createdAt).getFullYear()
                    : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {knownLevel !== null ? `Unlocked Perks (Level ${knownLevel})` : 'Unlocked Perks'}
            </h4>
            <div className="space-y-2">
              {perks.slice(0, 4).map((perk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-base">{perk.icon}</span>
                  <span className="font-semibold">{perk.title}</span>
                  <span className="text-slate-400 text-[11px]">— {perk.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter items by active tab. Tab ids mirror ProfileTabsBar exactly.
  let displayItems = posts;
  if (activeTab === 'saved') {
    displayItems = savedPosts;
  } else if (activeTab === 'media') {
    displayItems = displayItems.filter(p => p.type === 'video' || p.type === 'reel' || p.type === 'image');
  } else if (activeTab === 'videos') {
    displayItems = displayItems.filter(p => p.type === 'video');
  } else if (activeTab === 'reels') {
    displayItems = displayItems.filter(p => p.type === 'reel');
  } else if (activeTab === 'photos') {
    displayItems = displayItems.filter(p => p.type === 'image');
  } else if (activeTab === 'sparks') {
    // Sparks are the canonical video-domain content for this Profile (the
    // `/sparks` route is an alias of the video experience). No synthetic Spark
    // records are invented.
    displayItems = (Array.isArray(videos) ? videos : []).map((v) => ({ ...v, type: v.type || 'video' }));
  }

  // Canonical content states: a failed load surfaces an error + retry rather
  // than an empty grid, and offline is stated honestly (Firestore may still
  // serve cached content, so cached items remain visible underneath).
  const errorState = error && displayItems.length === 0 ? (
    <div className="py-12 text-center space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {error}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  ) : null;

  if (errorState) {
    return <div className="w-full">{errorState}</div>;
  }

  return (
    <div className="w-full">
      {!isOnline && displayItems.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          Offline - showing the last content cached on this device.
        </div>
      )}
      {displayItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          {activeTab === 'saved'
            ? 'No saved posts yet.'
            : activeTab === 'sparks'
              ? 'No sparks yet.'
              : activeTab === 'media'
                ? 'No media yet.'
                : 'No posts yet.'}
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {displayItems.map((item, idx) => {
          const isVid = item.type === 'video' || item.type === 'reel' || Boolean(item.duration);
          const isReel = item.type === 'reel';

          return (
            <div
              key={item.id || idx}
              onClick={() => (
                activeTab === 'sparks'
                  ? (onVideoClick?.(item) || navigate(`/video/${item.id}`))
                  : (onPostClick?.(item) || navigate(`/post/${item.id}`))
              )}
              className={cn(
                "group relative rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-sm bg-slate-900 transition-all hover:scale-[1.02]",
                isReel ? "aspect-[9/16]" : "aspect-square"
              )}
            >
              {/* Media Thumbnail or Text Content Fallback */}
              {(item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image) ? (
                <img
                  src={item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image}
                  alt={item.title || item.caption || item.text || 'Media item'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-purple-900/40 via-indigo-950/40 to-slate-900 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-200 line-clamp-4 leading-relaxed">
                    {item.content || item.caption || item.text || item.title || 'Post'}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="capitalize">{item.type || 'post'}</span>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                </div>
              )}

              {/* Video Indicator at Top Right */}
              {isVid && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold">
                  {isReel ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                  {item.duration && <span>{item.duration}</span>}
                </div>
              )}

              {/* Hover Overlay with Stats */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Heart className="w-4 h-4 fill-white text-white" />
                  <span>{countOf(item, 'likes') ?? '—'}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <MessageCircle className="w-4 h-4 fill-white text-white" />
                  <span>{countOf(item, 'comments') ?? '—'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
});

ProfileFeedGrid.displayName = 'ProfileFeedGrid';

export default ProfileFeedGrid;
