/**
 * src/components/profile/ProfileHighlightsSection.jsx - ARVDOUL Profile Highlights
 * 
 * Recreates the Highlights carousel from the uploaded designs:
 * - Header with Sparkles icon and 'Manage >' / 'View all >' action
 * - Owner '+ New' dashed button to create story highlights
 * - Circular story thumbnails with multi-color gradient rings & titles
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

// Default highlight categories when user has not yet customized their highlights
const DEFAULT_HIGHLIGHT_CATEGORIES = [
  { id: 'life', title: 'Life', emoji: '✨', cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80' },
  { id: 'travel', title: 'Travel', emoji: '✈️', cover: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=300&auto=format&fit=crop&q=80' },
  { id: 'studio', title: 'Studio', emoji: '🎨', cover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80' },
  { id: 'cars', title: 'Cars', emoji: '🏎️', cover: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=300&auto=format&fit=crop&q=80' },
  { id: 'designs', title: 'Designs', emoji: '🔮', cover: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=300&auto=format&fit=crop&q=80' },
  { id: 'milestones', title: 'Milestones', emoji: '🏆', cover: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=300&auto=format&fit=crop&q=80' },
  { id: 'memories', title: 'Memories', emoji: '📸', cover: 'https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?w=300&auto=format&fit=crop&q=80' },
];

const ProfileHighlightsSection = memo(({
  highlights = [],
  isOwner = false,
  theme = 'light',
  onHighlightPress,
  onAddHighlight,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Merge real highlights with fallbacks if empty
  const items = Array.isArray(highlights) && highlights.length > 0
    ? highlights
    : (isOwner ? DEFAULT_HIGHLIGHT_CATEGORIES : DEFAULT_HIGHLIGHT_CATEGORIES.slice(0, 5));

  return (
    <div className={cn(
      "w-full rounded-3xl p-5 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/70 border-white/10 text-white"
        : "bg-white/95 border-slate-200/90 text-slate-900"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Highlights</span>
        </div>

        <button
          onClick={() => navigate(isOwner ? '/profile/highlights' : '/stories')}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity"
        >
          <span>{isOwner ? 'Manage' : 'View all'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
        {/* '+ New' button for Owner */}
        {isOwner && (
          <button
            onClick={onAddHighlight || (() => navigate('/create-story'))}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={cn(
              "w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all group-hover:scale-105 group-hover:border-purple-500",
              isDark
                ? "border-white/20 bg-white/5 text-gray-300 group-hover:text-purple-400"
                : "border-slate-300 bg-slate-50 text-slate-600 group-hover:text-purple-600"
            )}>
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-purple-500 transition-colors">
              + New
            </span>
          </button>
        )}

        {/* Highlights Items */}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onHighlightPress?.(item) || navigate(`/stories?highlight=${item.id}`)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            {/* Circular Gradient Ring */}
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 group-hover:scale-105 transition-transform shadow-sm">
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-slate-800 ring-2 ring-white dark:ring-[#0d1424]">
                {item.cover || item.coverUrl ? (
                  <img
                    src={item.cover || item.coverUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl bg-purple-500/20 text-purple-300">
                    {item.emoji || '✨'}
                  </div>
                )}
              </div>
            </div>

            {/* Label */}
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[70px] text-center">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

ProfileHighlightsSection.displayName = 'ProfileHighlightsSection';

export default ProfileHighlightsSection;
