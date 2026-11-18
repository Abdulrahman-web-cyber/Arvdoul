import { useState, useEffect, memo } from "react";
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { LazyImage } from '../../components/Shared/LazyImage';

export const InFeedStoriesModule = memo(function InFeedStoriesModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [creators, setCreators] = useState([]);

  // Only real story groups are rendered. With no stories the strip is empty
  // (the "Your Story" affordance still lets the user post one).
  useEffect(() => {
    let isMounted = true;
    async function loadStories() {
      if (!user?.uid) { if (isMounted) setCreators([]); return; }
      try {
        const feedData = await storyService.getStoriesFeed?.(user.uid, { cacheFirst: true, limit: 10 });
        if (isMounted && feedData?.groups?.length > 0) {
          // One batched profile read for every creator in the strip instead of
          // a `getUserProfile` per group (an N+1 whose cost grew with the
          // viewer's story feed). `hydrateProfiles` reads `users` in bounded
          // `documentId() in` chunks and rejects placeholder names/avatars.
          const { getSocialGraphService } = await import('../../services/socialGraphService.js');
          const creatorIds = [...new Set(feedData.groups.map((g) => g.userId).filter(Boolean))];
          const profiles = await getSocialGraphService()
            .hydrateProfiles(creatorIds, { viewerId: user.uid })
            .catch(() => []);
          const byId = new Map(profiles.map((p) => [p.id, p]));
          const realList = feedData.groups.map((g) => {
            const p = byId.get(g.userId) || null;
            const name = p?.displayName || p?.name || 'Creator';
            return {
              id: g.userId,
              name,
              avatar: getSafeAvatarUrl(p?.photoURL, name, g.userId),
              hasUnseen: g.stories?.some((s) => !s.seen),
            };
          });
          if (isMounted) setCreators(realList);
        }
      } catch (err) {
        // The strip degrades to just "Your Story", but a failed feed read must
        // still be observable rather than looking like "nobody has stories".
        console.warn('InFeedStoriesModule: story feed load failed', err);
        if (isMounted) setCreators([]);
      }
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
          <div className="w-7 h-7 rounded-full bg-arvdoul-gradient flex items-center justify-center text-white shadow-sm shadow-arvdoul-purple/25">
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
          type="button"
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
              <LazyImage
                src={getSafeAvatarUrl(user?.photoURL, user?.displayName || 'You', user?.uid)}
                alt="My Story"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center" />
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-arvdoul-gradient text-white flex items-center justify-center ring-2 ring-white dark:ring-[#0f1424] shadow-md">
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
              creator.hasUnseen
                ? "bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 shadow-sm shadow-purple-500/30 group-hover:scale-105"
                : isDark ? "bg-slate-800" : "bg-slate-300"
            )}>
              <div className="w-full h-full rounded-full overflow-hidden p-[2px] bg-white dark:bg-[#0f1424]">
                <LazyImage
                  src={creator.avatar}
                  alt={creator.name}
                  className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
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
