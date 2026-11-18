/**
 * Production-grade Unboxed Story Highlights Carousel.
 * Renders cleanly directly on the profile canvas without an enclosing box wrapper,
 * and resets local state cleanly when switching target userIds.
 *
 * @component
 */

import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

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

  useEffect(() => {
    let isMounted = true;
    const targetUserId = userId || (isOwner ? 'me' : null);
    setRealHighlights([]);

    async function loadHighlights() {
      if (!targetUserId) return;
      try {
        const res = await storyService.getHighlights(targetUserId).catch(() => ({ highlights: [] }));
        if (isMounted && res?.highlights && Array.isArray(res.highlights)) {
          setRealHighlights(res.highlights);
        }
      } catch (err) {
        console.warn('Highlights load note:', err);
      }
    }

    loadHighlights();
    return () => { isMounted = false; };
  }, [userId, isOwner]);

  const items = React.useMemo(() => {
    const source = realHighlights.length > 0 ? realHighlights : (Array.isArray(highlights) ? highlights : []);
    const fallbackTitle = realHighlights.length > 0 ? 'Moment' : 'Highlight';
    return source
      .map(h => ({
        id: h.id,
        title: h.title || fallbackTitle,
        cover: h.cover || h.coverUrl || h.thumbnailUrl || h.mediaURL,
      }))
      .filter(item => Boolean(item.cover));
  }, [realHighlights, highlights]);

  if (!isOwner && items.length === 0) {
    return null;
  }

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
    <section aria-label="Highlights" className="w-full py-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-arvdoul-purple" />
          <h2 className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
            Highlights
          </h2>
        </div>

        <button
          type="button"
          onClick={handleHeaderAction}
          className="inline-flex items-center gap-1 text-xs font-semibold text-arvdoul-purple dark:text-purple-300 hover:underline transition-opacity cursor-pointer"
        >
          <span>{isOwner ? 'Manage' : 'View all'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto pb-1 pt-0.5 scrollbar-none scroll-smooth">
        {isOwner && (
          <button
            type="button"
            onClick={onAddHighlight || (() => navigate('/profile/highlights?create=true'))}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            aria-label="Create new highlight"
          >
            <div className={cn(
              "w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-200 group-hover:scale-105 active:scale-95",
              isDark
                ? "border-white/20 bg-white/[0.03] group-hover:border-arvdoul-purple text-slate-300 group-hover:text-purple-300"
                : "border-slate-300 bg-white group-hover:border-arvdoul-purple text-slate-600 group-hover:text-arvdoul-purple"
            )}>
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[70px]">
              New
            </span>
          </button>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleItemClick(item)}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            aria-label={`Highlight: ${item.title}`}
          >
            <div
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full p-[2px] group-hover:scale-105 active:scale-95 transition-all duration-200"
              style={{ background: BRAND_GRADIENT }}
            >
              <div className={cn(
                "w-full h-full rounded-full overflow-hidden ring-2",
                isDark ? "bg-[#080F2E] ring-[#03071B]" : "bg-slate-100 ring-[#F6F8FC]"
              )}>
                <LazyImage
                  src={item.cover}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            </div>

            <span className="text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[72px] text-center group-hover:text-arvdoul-purple dark:group-hover:text-purple-300 transition-colors">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
});

ProfileHighlightsSection.displayName = 'ProfileHighlightsSection';

export default ProfileHighlightsSection;
