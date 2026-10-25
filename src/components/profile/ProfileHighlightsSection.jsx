/**
 * Production-grade Story Highlights Carousel.
 * Matches the exact design hierarchy in both reference images:
 * - Header: '✨ Highlights' on left, 'Manage >' / 'View all >' on right
 * - Horizontal carousel of circular story highlights with gradient rings:
 *   - '+ New' circular action for the profile owner
 *   - Circular story cards with title labels underneath (e.g. Life, Travel, Studio, Cars, Designs, Milestones, Memories)
 * 
 * @component
 */

import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';

// Default highlight topics with curated theme imagery for display when user hasn't created custom highlights
const DEFAULT_CURATED_HIGHLIGHTS = [
  { id: 'hl-1', title: 'Travel', cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-2', title: 'Work', cover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-3', title: 'Gaming', cover: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-4', title: 'Photography', cover: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-5', title: 'Life', cover: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-6', title: 'Achievements', cover: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-7', title: 'Studio', cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-8', title: 'Cars', cover: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-9', title: 'Designs', cover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-10', title: 'Milestones', cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80' },
  { id: 'hl-11', title: 'Memories', cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200&auto=format&fit=crop&q=80' },
];

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

  const [realHighlights, setRealHighlights] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const targetUserId = userId || (isOwner ? 'me' : null);

    async function loadHighlights() {
      if (!targetUserId) return;
      try {
        setLoading(true);
        const res = await storyService.getHighlights(targetUserId).catch(() => ({ highlights: [] }));
        if (isMounted && res?.highlights && Array.isArray(res.highlights) && res.highlights.length > 0) {
          setRealHighlights(res.highlights);
        }
      } catch (err) {
        console.warn('Highlights load note:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHighlights();
    return () => { isMounted = false; };
  }, [userId, isOwner]);

  // Combine passed props, fetched real highlights, or curated defaults
  const items = React.useMemo(() => {
    if (realHighlights.length > 0) {
      return realHighlights.map(h => ({
        id: h.id,
        title: h.title || 'Moment',
        cover: h.cover || h.coverUrl || h.thumbnailUrl,
      }));
    }
    if (Array.isArray(highlights) && highlights.length > 0) {
      return highlights.map(h => ({
        id: h.id,
        title: h.title || 'Highlight',
        cover: h.cover || h.coverUrl || h.thumbnailUrl,
      }));
    }
    return DEFAULT_CURATED_HIGHLIGHTS;
  }, [realHighlights, highlights]);

  const handleItemClick = (item) => {
    if (onHighlightPress) {
      onHighlightPress(item);
    } else {
      navigate(`/stories?highlight=${item.id}`);
    }
  };

  const handleHeaderAction = () => {
    if (isOwner) {
      navigate('/profile/highlights');
    } else {
      navigate('/stories');
    }
  };

  return (
    <div className={cn(
      "w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-200 backdrop-blur-xl shadow-sm",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 fill-purple-500" />
          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Highlights
          </h2>
        </div>

        <button
          type="button"
          onClick={handleHeaderAction}
          className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span>{isOwner ? 'Manage' : 'View all'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pb-1 pt-1 scrollbar-none scroll-smooth">
        {/* + New Button for Owner */}
        {isOwner && (
          <button
            type="button"
            onClick={onAddHighlight || (() => navigate('/profile/highlights?create=true'))}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            aria-label="Create new highlight"
          >
            <div className={cn(
              "w-16 h-16 sm:w-18 sm:h-18 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-200 group-hover:scale-105 active:scale-95",
              isDark
                ? "border-white/20 bg-white/[0.03] group-hover:border-purple-400 text-slate-300 group-hover:text-purple-300"
                : "border-slate-300 bg-slate-50 group-hover:border-purple-500 text-slate-600 group-hover:text-purple-600"
            )}>
              <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[70px]">
              New
            </span>
          </button>
        )}

        {/* Highlight Items */}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleItemClick(item)}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            aria-label={`Highlight: ${item.title}`}
          >
            {/* Glowing Ring Container */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full p-[2px] bg-gradient-to-tr from-[#8B1EF3] via-[#D946EF] to-[#00F0FF] shadow-sm group-hover:shadow-[0_0_15px_rgba(139,30,243,0.4)] group-hover:scale-105 active:scale-95 transition-all duration-200">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-2 ring-white dark:ring-[#0b1021]">
                <img
                  src={item.cover}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Title Label */}
            <span className="text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[72px] text-center group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
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
