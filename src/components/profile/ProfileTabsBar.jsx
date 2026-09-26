/**
 * src/components/profile/ProfileTabsBar.jsx - ARVDOUL Clean Profile Tabs Navigation
 * 
 * Elegant, high-contrast tab strip adhering to Zero-Pill discipline.
 * Clean border-bottom active indicator, crisp typography, and uncluttered layout.
 * 
 * @component
 */

import React, { memo } from 'react';
import { 
  Grid3x3, 
  Film, 
  Sparkles, 
  Bookmark, 
  Info 
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileTabsBar = memo(({
  activeTab = 'posts',
  onTabChange,
  isOwner = false,
  theme = 'light',
  counts = {},
}) => {
  const isDark = theme === 'dark';

  const tabs = [
    { id: 'posts', label: 'Posts', icon: Grid3x3, count: counts.posts },
    { id: 'media', label: 'Media', icon: Film, count: counts.videos },
    { id: 'sparks', label: 'Sparks', icon: Sparkles },
    ...(isOwner ? [{ id: 'saved', label: 'Saved', icon: Bookmark, count: counts.saved }] : []),
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className={cn(
      "w-full border-b transition-colors",
      isDark ? "border-slate-800 bg-[#060816]/95" : "border-slate-200 bg-white/95"
    )}>
      <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto scrollbar-none px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer",
                isActive
                  ? (isDark ? "text-white" : "text-slate-900")
                  : (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800")
              )}
            >
              <Icon className={cn("w-4 h-4", isActive && "text-indigo-500")} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "text-[11px] font-mono px-1.5 py-0.2 rounded-md",
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
    </div>
  );
});

ProfileTabsBar.displayName = 'ProfileTabsBar';

export default ProfileTabsBar;
