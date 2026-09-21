// src/components/profile/ProfileTabsBar.jsx

import React, { memo } from 'react';
import { 
  Grid3x3, 
  Video, 
  Film, 
  Image, 
  Sparkles, 
  Bookmark, 
  Tag, 
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
    { id: 'videos', label: 'Videos', icon: Video, count: counts.videos },
    { id: 'reels', label: 'Reels', icon: Film, count: counts.reels },
    { id: 'photos', label: 'Photos', icon: Image, count: counts.photos },
    { id: 'stories', label: 'Stories', icon: Sparkles },
    ...(isOwner ? [{ id: 'saved', label: 'Saved', icon: Bookmark, count: counts.saved }] : []),
    { id: 'tagged', label: 'Tagged', icon: Tag },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className={cn(
      "w-full rounded-2xl p-1.5 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/80 border-white/10"
        : "bg-white/95 border-slate-200/90"
    )}>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all shrink-0",
                isActive
                  ? (isDark
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20")
                  : (isDark
                      ? "text-gray-400 hover:text-white hover:bg-white/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100")
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-semibold",
                  isActive
                    ? "bg-white/20 text-white"
                    : (isDark ? "bg-white/10 text-gray-300" : "bg-slate-200 text-slate-700")
                )}>
                  {tab.count}
                </span>
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
