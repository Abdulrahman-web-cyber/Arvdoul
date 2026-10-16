/**
 * Elegant, high-contrast tab strip adhering to Zero-Pill discipline.
 * Features tabs on the left and multi-view switcher (Grid, Masonry, Full Feed) on the right.
 * Clean active indicators, crisp typography, and uncluttered responsive layout.
 * 
 * @component
 */

import React, { memo } from 'react';
import { 
  Grid3x3, 
  Film, 
  Music, 
  Bookmark, 
  Tag,
  Info,
  LayoutGrid,
  Columns3,
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
    { id: 'posts', label: 'Posts', icon: Grid3x3, count: counts.posts },
    { id: 'reels', label: 'Reels', icon: Film, count: counts.reels ?? counts.videos },
    { id: 'audio', label: 'Audio', icon: Music, count: counts.audio },
    ...(isOwner ? [{ id: 'saved', label: 'Saved', icon: Bookmark, count: counts.saved }] : []),
    { id: 'tagged', label: 'Tagged', icon: Tag, count: counts.tagged },
    { id: 'about', label: 'About', icon: Info },
  ];

  const viewModes = [
    { id: 'grid', label: 'Grid View', icon: LayoutGrid },
    { id: 'masonry', label: 'Masonry View', icon: Columns3 },
    { id: 'feed', label: 'Feed View', icon: Rows3 },
  ];

  const showViewSwitcher = activeTab !== 'about' && activeTab !== 'audio' && typeof onViewModeChange === 'function';

  return (
    <div className={cn(
      "w-full border-b transition-colors flex items-center justify-between gap-2 px-2 sm:px-4",
      isDark ? "border-slate-800 bg-[#060816]/95 backdrop-blur-md" : "border-slate-200 bg-white/95 backdrop-blur-md"
    )}>
      {/* Category Tabs */}
      <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 sm:gap-2 py-3 px-2.5 sm:px-3.5 text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer",
                isActive
                  ? (isDark ? "text-white" : "text-slate-900")
                  : (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800")
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-indigo-500" : "opacity-70")} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "text-[10px] sm:text-[11px] font-mono px-1.5 py-0.2 rounded-md",
                  isActive
                    ? (isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-800")
                    : (isDark ? "bg-slate-900 text-slate-400" : "bg-slate-50 text-slate-500")
                )}>
                  {tab.count}
                </span>
              )}
              {/* Clean active indicator underline */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Multi-View Mode Switcher (Grid, Masonry, Full Feed) */}
      {showViewSwitcher && (
        <div className={cn(
          "flex items-center gap-1 p-1 rounded-xl border shrink-0 transition-colors my-1.5",
          isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-100/80 border-slate-200"
        )}>
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = viewMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onViewModeChange(mode.id)}
                title={mode.label}
                aria-label={mode.label}
                className={cn(
                  "p-1.5 sm:px-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer",
                  isSelected
                    ? (isDark ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm")
                    : (isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50")
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px] capitalize">{mode.id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

ProfileTabsBar.displayName = 'ProfileTabsBar';

export default ProfileTabsBar;
