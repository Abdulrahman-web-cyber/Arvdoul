import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ChevronRight, Eye, Flame, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

// Sample featured creators with stories for rich community preview
const DEFAULT_STORY_CREATORS = [
  {
    id: 'creator_1',
    name: 'Elena Rostova',
    username: 'elena_vibes',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true,
    isLive: false,
    preview: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
    title: 'Studio sessions 🎧'
  },
  {
    id: 'creator_2',
    name: 'Marcus Chen',
    username: 'marcus_tech',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true,
    isLive: true,
    preview: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=300&auto=format&fit=crop&q=80',
    title: 'Tokyo Night Walk 🌙'
  },
  {
    id: 'creator_3',
    name: 'Sophia Williams',
    username: 'sophia_art',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true,
    isLive: false,
    preview: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&auto=format&fit=crop&q=80',
    title: 'New Canvas 🎨'
  },
  {
    id: 'creator_4',
    name: 'Alex Rivera',
    username: 'alex_beats',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    hasUnseen: false,
    isLive: false,
    preview: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    title: 'Acoustic jam 🎸'
  },
  {
    id: 'creator_5',
    name: 'Zara Thorne',
    username: 'zara_wander',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true,
    isLive: false,
    preview: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&auto=format&fit=crop&q=80',
    title: 'Alpine Sunrise 🏔️'
  }
];

export const InFeedStoriesModule = memo(function InFeedStoriesModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [creators, setCreators] = useState(DEFAULT_STORY_CREATORS);

  useEffect(() => {
    let isMounted = true;
    async function loadStories() {
      if (!user?.uid) return;
      try {
        const feedData = await storyService.getStoriesFeed?.(user.uid, { cacheFirst: true, limit: 10 });
        if (isMounted && feedData?.groups?.length > 0) {
          const { getUserService } = await import('../../services/userService.js');
          const realList = await Promise.all(
            feedData.groups.map(async (g) => {
              const first = g.stories?.[0] || {};
              let name = 'Creator';
              let avatar = null;
              try {
                const p = await getUserService().getUserProfile(g.userId);
                if (p) {
                  name = p.displayName || p.username || name;
                  avatar = p.photoURL;
                }
              } catch {}
              return {
                id: g.userId,
                name,
                username: name.toLowerCase().replace(/\s+/g, '_'),
                avatar: getSafeAvatarUrl(avatar, name, g.userId),
                hasUnseen: g.stories?.some(s => !s.seen),
                isLive: !!first.isLive,
                preview: first.mediaUrl || first.thumbnailUrl || avatar,
                title: first.caption || 'New Story'
              };
            })
          );
          if (realList.length > 0) {
            setCreators(realList);
          }
        }
      } catch {}
    }
    loadStories();
    return () => { isMounted = false; };
  }, [user?.uid]);

  return (
    <div className={cn(
      "my-4 rounded-2xl p-4 border transition-all duration-200 overflow-hidden",
      isDark
        ? "bg-[#0f1424]/90 border-slate-800/80 shadow-lg shadow-purple-950/20"
        : "bg-white/95 border-slate-200 shadow-md shadow-slate-200/50"
    )}>
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Stories & Vibes
              </h3>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Live
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/stories')}
          className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer",
            isDark
              ? "text-purple-400 hover:text-purple-300 hover:bg-purple-950/40"
              : "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          )}
        >
          <span>View all stories</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stories Scroll Container */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide select-none -mx-1 px-1">
        {/* User's Add Story Card */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/create-story')}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer w-[72px]"
        >
          <div className="relative w-14 h-14 rounded-full p-[2px] bg-slate-200 dark:bg-slate-800">
            <div className="w-full h-full rounded-full overflow-hidden relative">
              <img
                src={getSafeAvatarUrl(user?.photoURL, user?.displayName || 'You', user?.uid)}
                alt="My Story"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center" />
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-[#0f1424] shadow-md">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className={cn("text-[11px] font-semibold text-center truncate w-full", isDark ? "text-slate-300" : "text-slate-700")}>
            Your Story
          </span>
        </motion.div>

        {/* Creator Story Items */}
        {creators.map((creator) => (
          <motion.div
            key={creator.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/stories')}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer w-[72px] group"
          >
            <div className={cn(
              "relative w-14 h-14 rounded-full p-[2.5px] transition-all duration-300",
              creator.isLive
                ? "bg-gradient-to-tr from-red-500 via-pink-500 to-amber-500 animate-pulse shadow-md shadow-red-500/30"
                : creator.hasUnseen
                  ? "bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 shadow-sm shadow-purple-500/30 group-hover:scale-105"
                  : isDark ? "bg-slate-800" : "bg-slate-300"
            )}>
              <div className="w-full h-full rounded-full overflow-hidden p-[2px] bg-white dark:bg-[#0f1424]">
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>

              {creator.isLive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-[1px] rounded bg-red-600 text-white text-[8px] font-black uppercase tracking-wider shadow">
                  LIVE
                </div>
              )}
            </div>

            <span className={cn(
              "text-[11px] font-medium text-center truncate w-full transition-colors",
              creator.hasUnseen
                ? isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"
                : isDark ? "text-slate-400" : "text-slate-600"
            )}>
              {creator.name.split(' ')[0]}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default InFeedStoriesModule;
