// src/components/profile/ProfileHighlightsSection.jsx

import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Plus, ChevronRight, Play, Eye, Flame, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';

const ProfileHighlightsSection = memo(({
  highlights = [],
  userId,
  isOwner = false,
  theme = 'light',
  onHighlightPress,
  onAddHighlight,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [realVibes, setRealVibes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch actual user vibes & stories
  useEffect(() => {
    let isMounted = true;
    const targetUserId = userId || (isOwner ? 'me' : null);

    async function loadUserVibes() {
      if (!targetUserId) return;
      try {
        setLoading(true);
        // Fetch highlights & active stories
        const [highlightsRes, storiesList] = await Promise.all([
          storyService.getHighlights(targetUserId).catch(() => ({ highlights: [] })),
          storyService.getUserStories(targetUserId).catch(() => [])
        ]);

        if (isMounted) {
          const combined = [];
          if (Array.isArray(storiesList) && storiesList.length > 0) {
            storiesList.forEach(s => {
              combined.push({
                id: s.id,
                title: s.caption || s.text || 'Vibe Moment',
                tag: '⚡ Story',
                views: s.viewCount ? `${s.viewCount}` : 'Live',
                cover: s.mediaUrl || s.thumbnailUrl || s.cover,
                date: 'Active',
                mediaType: s.mediaType || 'image',
              });
            });
          }

          if (Array.isArray(highlightsRes?.highlights) && highlightsRes.highlights.length > 0) {
            highlightsRes.highlights.forEach(h => {
              combined.push({
                id: h.id,
                title: h.title || 'Highlight',
                tag: '✨ Vibe',
                views: h.views ? `${h.views}` : 'Highlight',
                cover: h.cover || h.coverUrl,
                date: 'Saved',
                isHighlight: true
              });
            });
          }

          setRealVibes(combined);
        }
      } catch (err) {
        console.error('Error fetching user vibes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUserVibes();
    return () => {
      isMounted = false;
    };
  }, [userId, isOwner]);

  // Combine passed highlights, fetched real vibes, and default vibes
  const items = React.useMemo(() => {
    if (realVibes.length > 0) return realVibes;
    if (Array.isArray(highlights) && highlights.length > 0) {
      return highlights.map(h => ({
        id: h.id,
        title: h.title || 'Vibe',
        tag: '⚡ Vibe',
        views: h.views,
        cover: h.cover || h.coverUrl,
        date: 'Recent'
      }));
    }
    return [];
  }, [realVibes, highlights]);

  return (
    <div className={cn(
      "w-full rounded-3xl p-5 sm:p-6 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/80 border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span>Vibes & Stories</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                {items.length}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate(isOwner ? '/profile/highlights' : '/vibes')}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity"
        >
          <span>{isOwner ? 'Manage Vibes' : 'Explore all'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal Carousel with Rectangular Cards */}
      <div className="flex items-center gap-3.5 overflow-x-auto pb-2 pt-1 scrollbar-none scroll-smooth">
        {items.length === 0 && !isOwner && (
          <div className="w-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No vibes yet.
          </div>
        )}
        {/* Rectangular '+ Create Vibe' Card for Owner */}
        {isOwner && (
          <button
            onClick={onAddHighlight || (() => navigate('/create-story'))}
            className={cn(
              "w-28 sm:w-36 h-48 sm:h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all group shrink-0 hover:scale-[1.02] active:scale-[0.98] shadow-sm",
              isDark
                ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-400 hover:bg-purple-500/10 text-gray-300"
                : "border-purple-300 bg-purple-50/60 hover:border-purple-500 hover:bg-purple-100/60 text-slate-700"
            )}
            title="Create a new Vibe"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-purple-500 transition-colors">
              New Vibe
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Share moment
            </span>
          </button>
        )}

        {/* Rectangular Vibes Cards */}
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              // Only one navigation path may run: calling the optional handler
              // and then navigating too would open two viewers.
              if (onHighlightPress) onHighlightPress(item);
              else navigate(`/stories?vibe=${item.id}`);
            }}
            className="relative w-28 sm:w-36 h-48 sm:h-56 rounded-2xl overflow-hidden shrink-0 group cursor-pointer shadow-md hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 border border-black/10 dark:border-white/10"
          >
            {/* Background Media Thumbnail or Fallback Gradient */}
            {item.cover ? (
              <img
                src={item.cover}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-purple-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-purple-400/40" />
              </div>
            )}

            {/* Cinematic Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20 group-hover:via-black/20 transition-colors duration-300" />

            {/* Top Bar: Tag pill and Play indicator */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/50 text-white backdrop-blur-md border border-white/15 truncate max-w-[80px]">
                {item.tag || '⚡ Vibe'}
              </span>
              <div className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
              </div>
            </div>

            {/* Bottom Info: Title, Views & Date */}
            <div className="absolute bottom-2.5 inset-x-2.5 text-left pointer-events-none space-y-1">
              <h4 className="text-xs font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
                {item.title}
              </h4>
              <div className="flex items-center justify-between text-[10px] font-medium text-white/80">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-white/70" />
                  <span>{item.views}</span>
                </span>
                <span className="text-white/60 text-[9px]">{item.date}</span>
              </div>
            </div>

            {/* Glowing Border on Hover */}
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-purple-500/80 transition-colors pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
});

ProfileHighlightsSection.displayName = 'ProfileHighlightsSection';

export default ProfileHighlightsSection;

