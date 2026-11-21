/**
 * Production-grade Architectural Underline Tabs Bar for Arvdoul Profiles.
 * Replaces pill-card containers with a clean, sticky horizontal hairline underline bar
 * supporting optional Grid/Feed mode switching.
 *
 * @component
 */

import { memo } from "react";
import {
  Grid3x3,
  Video,
  Film,
  Image as ImageIcon,
  Sparkles,
  Music,
  Bookmark,
  Tag,
  Info,
  ShieldCheck,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { getAdaptiveTuning } from '../../utils/deviceCapabilities.js';

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
  const isLiteMode = getAdaptiveTuning().isLiteMode;

  const tabs = [
    { id: 'posts', label: 'Posts', icon: Grid3x3 },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
    { id: 'stories', label: 'Vibes', icon: Sparkles },
    { id: 'audio', label: 'Audio', icon: Music },
    ...(isOwner ? [{ id: 'saved', label: 'Saved', icon: Bookmark }] : []),
    { id: 'tagged', label: 'Tagged', icon: Tag },
    { id: 'citizenship', label: 'Citizenship', icon: ShieldCheck },
    { id: 'about', label: 'About', icon: Info },
  ];

  const showViewToggle =
    typeof onViewModeChange === 'function' &&
    activeTab !== 'about' &&
    activeTab !== 'citizenship' &&
    activeTab !== 'audio';

  return (
    <div
      className={cn(
        "w-full rounded-[22px] border transition-colors flex items-center justify-between gap-2 px-2",
        !isLiteMode && "backdrop-blur-xl",
        isDark
          ? "bg-[#080F2E]/82 border-white/[0.12] text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
          : "bg-white/75 border-white/90 text-slate-900 shadow-[0_10px_28px_rgba(38,56,120,0.08)]"
      )}
    >
      {/* Horizontal Scrollable Tab Strip */}
      <div
        role="tablist"
        aria-label="Profile sections"
        className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "relative min-h-[42px] flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer select-none whitespace-nowrap rounded-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                isActive
                  ? "text-white shadow-[0_5px_16px_rgba(52,70,220,0.24)]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              style={isActive ? { background: BRAND_GRADIENT } : undefined}
            >
              <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", isActive && "text-white")} />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    isActive ? "text-arvdoul-purple dark:text-purple-300" : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {count}
                </span>
              )}

            </button>
          );
        })}
      </div>

      {/* View Mode Switcher */}
      {showViewToggle && (
        <div className={cn(
          "flex items-center gap-1 p-1 rounded-2xl border shrink-0 my-1.5",
          isDark ? "bg-white/[0.04] border-white/10" : "bg-white border-slate-200 shadow-xs"
        )}>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            className={cn(
              "min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              viewMode === 'grid'
                ? "text-white shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
            style={viewMode === 'grid' ? { background: BRAND_GRADIENT } : undefined}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('feed')}
            title="Feed view"
            aria-label="Feed view"
            aria-pressed={viewMode === 'feed'}
            className={cn(
              "min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              viewMode === 'feed'
                ? "text-white shadow-sm"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
            style={viewMode === 'feed' ? { background: BRAND_GRADIENT } : undefined}
          >
            <Rows3 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

ProfileTabsBar.displayName = 'ProfileTabsBar';

export default ProfileTabsBar;
