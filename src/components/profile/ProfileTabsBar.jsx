/**
 * Production-grade Profile Tabs Bar.
 * Matches the exact pill tab design in both Light and Dark reference images:
 * - Tabs: Posts, Videos, Reels, Photos, Stories, Saved (for owner), Tagged, About
 * - Active Tab: Vibrant gradient purple pill with white text & icon
 * - Inactive Tabs: Subtle text with clean icon and smooth hover transition
 * - Right Side: Optional Grid/Feed View mode toggle
 * 
 * @component
 */

import React, { memo } from 'react';
import { 
  Grid3x3, 
  Video, 
  Film, 
  Image as ImageIcon, 
  Disc, 
  Bookmark, 
  Tag, 
  Info,
  LayoutGrid,
  Rows3
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileTabsBar = memo(({
  activeTab = 'posts',
  onTabChange,
  viewMode = 'grid',
  onViewModeChange,
  isOwner = false,
  theme = 'light',
  counts = {},
}) => {
  const isDark = theme === 'dark';

  const tabs = [
    { id: 'posts', label: 'Posts', icon: Grid3x3 },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
    { id: 'stories', label: 'Stories', icon: Disc },
    ...(isOwner ? [{ id: 'saved', label: 'Saved', icon: Bookmark }] : []),
    { id: 'tagged', label: 'Tagged', icon: Tag },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className={cn(
      "w-full rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 border backdrop-blur-xl transition-all duration-200 flex items-center justify-between gap-2 shadow-sm overflow-hidden",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
    )}>
      {/* Category Tabs Pill Row */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 px-0.5 w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 cursor-pointer select-none",
                isActive
                  ? "bg-gradient-to-r from-[#8B1EF3] to-[#4431F7] text-white shadow-md shadow-purple-600/25 scale-[1.02]"
                  : isDark
                    ? "text-slate-400 hover:text-white hover:bg-white/5 active:scale-95"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95"
              )}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Mode Toggle (Grid vs Feed) if enabled */}
      {typeof onViewModeChange === 'function' && activeTab !== 'about' && (
        <div className={cn(
          "hidden sm:flex items-center gap-1 p-1 rounded-xl border shrink-0 mr-1",
          isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
        )}>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
            aria-label="Grid view"
            className={cn(
              "p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === 'grid'
                ? "bg-purple-600 text-white shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('feed')}
            title="Feed view"
            aria-label="Feed view"
            className={cn(
              "p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === 'feed'
                ? "bg-purple-600 text-white shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

ProfileTabsBar.displayName = 'ProfileTabsBar';

export default ProfileTabsBar;
