// src/components/feed/InFeedStoriesModule.jsx
//
// Home Feed Vibes Strip (Part 1 Core Experience):
//   - Own active Vibe + quick Create affordance
//   - Distinct unseen (BRAND_GRADIENT) vs seen ring states
//   - Deterministic ordering (unseen first, seen second, sorted by recency)
//   - Batched profile hydration (hydrateProfiles), no N+1 profile queries
//   - Loading skeleton, Error + Retry, Offline/Cached status, Empty CTA
//   - Scroll position preservation across navigation & pagination

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ChevronRight, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';
import { getSocialGraphService } from '../../services/socialGraphService.js';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { resolveActorName } from '../../services/profileReadModel.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';

const STRIP_SCROLL_KEY = 'arvdoul_vibes_strip_scroll';

function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const InFeedStoriesModule = memo(function InFeedStoriesModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [ownGroup, setOwnGroup] = useState(null);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const scrollerRef = useRef(null);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setReloadNonce((n) => n + 1);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const hydrateAndSortGroups = useCallback(async (groups = []) => {
    if (!groups.length || !user?.uid) return [];
    const creatorIds = [...new Set(groups.map((g) => g.userId).filter(Boolean))];
    const profiles = await getSocialGraphService()
      .hydrateProfiles(creatorIds, { viewerId: user.uid })
      .catch(() => []);
    const byId = new Map(profiles.map((p) => [p.id, p]));

    return groups
      .map((g) => {
        const p = byId.get(g.userId) || null;
        const name = resolveActorName([p?.displayName, p?.name], g.userId);
        const latestMs = Math.max(...(g.stories || []).map((s) => toEpochMs(s.createdAt)), 0);
        return {
          id: g.userId,
          name,
          avatar: getSafeAvatarUrl(p?.photoURL, name, g.userId),
          hasUnseen: Boolean(g.stories?.some((s) => !s.seen)),
          itemsCount: g.stories?.length || 0,
          latestMs,
        };
      })
      .sort((a, b) => {
        if (a.hasUnseen !== b.hasUnseen) return Number(b.hasUnseen) - Number(a.hasUnseen);
        return b.latestMs - a.latestMs;
      });
  }, [user?.uid]);

  useEffect(() => {
    let isMounted = true;
    async function loadStories() {
      if (!user?.uid) {
        if (isMounted) {
          setOwnGroup(null);
          setCreators([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const feedData = await storyService.getStoriesFeed?.(user.uid, { cacheFirst: true, limit: 12 });
        if (!isMounted) return;
        const rawGroups = feedData?.groups || [];
        const mine = rawGroups.find((g) => g.userId === user.uid) || null;
        const others = rawGroups.filter((g) => g.userId !== user.uid);
        const hydratedOthers = await hydrateAndSortGroups(others);

        if (!isMounted) return;
        setOwnGroup(
          mine
            ? {
                id: mine.userId,
                itemsCount: mine.stories?.length || 0,
                hasUnseen: Boolean(mine.stories?.some((s) => !s.seen)),
              }
            : null
        );
        setCreators(hydratedOthers);
        setIsCached(Boolean(feedData?.cached));
        setHasMore(Boolean(feedData?.hasMore));
        setLastDocId(feedData?.lastDocId || null);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || 'Could not load Vibes right now.');
        setCreators([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStories();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, reloadNonce, hydrateAndSortGroups]);

  // Restore saved horizontal scroll position once strip finishes initial render
  useEffect(() => {
    if (loading || !scrollerRef.current) return;
    try {
      const saved = Number(sessionStorage.getItem(STRIP_SCROLL_KEY) || 0);
      if (Number.isFinite(saved) && saved > 0) {
        scrollerRef.current.scrollLeft = saved;
      }
    } catch {
      // Ignore storage failures
    }
  }, [loading]);

  const handleLoadMore = async () => {
    if (!user?.uid || !hasMore || loadingMore || !lastDocId) return;
    setLoadingMore(true);
    try {
      const next = await storyService.getStoriesFeed(user.uid, {
        cacheFirst: false,
        limit: 12,
        lastDocId,
      });
      const existingIds = new Set([user.uid, ...creators.map((c) => c.id)]);
      const freshGroups = (next?.groups || []).filter((g) => !existingIds.has(g.userId));
      const hydrated = await hydrateAndSortGroups(freshGroups);
      setCreators((prev) => [...prev, ...hydrated]);
      setHasMore(Boolean(next?.hasMore));
      setLastDocId(next?.lastDocId || null);
    } catch (err) {
      setError(err?.message || 'Could not load more Vibes.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleStripScroll = () => {
    if (!scrollerRef.current) return;
    try {
      sessionStorage.setItem(STRIP_SCROLL_KEY, String(scrollerRef.current.scrollLeft));
    } catch {
      // Ignore storage quota errors
    }
  };

  return (
    <section
      aria-label="Vibes feed"
      className={cn(
        'my-4 rounded-2xl p-4 border transition-all duration-200 overflow-hidden',
        isDark
          ? 'bg-[#0A102D]/90 border-white/10 shadow-lg'
          : 'bg-white/95 border-slate-200 shadow-md shadow-slate-200/50'
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
            style={{ background: BRAND_GRADIENT }}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className={cn('text-sm font-bold tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
              Vibes
            </h3>
            {(isOffline || isCached) && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                  isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800'
                )}
              >
                {isOffline && <WifiOff className="w-3 h-3" aria-hidden="true" />}
                <span>{isOffline ? 'Offline' : 'Cached'}</span>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/stories')}
          className={cn(
            'min-h-[36px] flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer',
            isDark
              ? 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <span>All Vibes</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Error State Banner */}
      {error && !loading && (
        <div
          role="alert"
          className={cn(
            'mb-3 px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs',
            isDark
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className={cn(
              'min-h-[32px] px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer',
              isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-rose-100 text-rose-900 border border-rose-200'
            )}
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Horizontal Vibes Rail */}
      <div
        ref={scrollerRef}
        onScroll={handleStripScroll}
        className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide select-none -mx-1 px-1"
      >
        {/* User's Own Vibe / Create Entry */}
        <div className="relative flex-shrink-0 flex flex-col items-center gap-1.5 w-[74px]">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (ownGroup && ownGroup.itemsCount > 0) {
                navigate('/stories', { state: { vibeUserId: ownGroup.id } });
              } else {
                navigate('/create-story');
              }
            }}
            aria-label={ownGroup ? 'View your Vibe' : 'Create your Vibe'}
            className="flex flex-col items-center gap-1.5 cursor-pointer w-full bg-transparent border-0 p-0"
          >
            <div
              className={cn(
                'relative w-14 h-14 rounded-full p-[2.5px] transition-all',
                !ownGroup && (isDark ? 'bg-slate-800' : 'bg-slate-200')
              )}
              style={ownGroup ? { background: BRAND_GRADIENT } : undefined}
            >
              <div className={cn('w-full h-full rounded-full overflow-hidden p-[2px]', isDark ? 'bg-[#0A102D]' : 'bg-white')}>
                <LazyImage
                  src={getSafeAvatarUrl(user?.photoURL, user?.displayName || 'You', user?.uid)}
                  alt="Your Vibe"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {ownGroup && ownGroup.itemsCount > 1 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-white border border-white/30 text-[10px] font-bold flex items-center justify-center">
                  {ownGroup.itemsCount}
                </span>
              )}
            </div>
            <span className={cn('text-[11px] font-semibold text-center truncate w-full', isDark ? 'text-slate-200' : 'text-slate-800')}>
              {ownGroup ? 'Your Vibe' : 'Add Vibe'}
            </span>
          </motion.button>

          {/* Always-accessible quick Create (+) button when user already has active Vibe */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/create-story');
            }}
            aria-label="Add new Vibe"
            className={cn(
              'absolute top-9 right-1 w-6 h-6 rounded-full text-white flex items-center justify-center ring-2 shadow-md cursor-pointer',
              isDark ? 'ring-[#0A102D]' : 'ring-white'
            )}
            style={{ background: BRAND_GRADIENT }}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        {/* Loading Skeletons */}
        {loading &&
          [0, 1, 2, 3, 4].map((slot) => (
            <div key={slot} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[74px]" aria-hidden="true">
              <div className={cn('w-14 h-14 rounded-full animate-pulse', isDark ? 'bg-white/10' : 'bg-slate-200')} />
              <div className={cn('w-11 h-2.5 rounded animate-pulse', isDark ? 'bg-white/10' : 'bg-slate-200')} />
            </div>
          ))}

        {/* Creator Vibe Items */}
        {!loading &&
          creators.map((creator) => (
            <motion.button
              type="button"
              key={creator.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/stories', { state: { vibeUserId: creator.id } })}
              aria-label={`Open Vibe from ${creator.name}`}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer w-[74px] group bg-transparent border-0 p-0"
            >
              <div
                className={cn(
                  'relative w-14 h-14 rounded-full p-[2.5px] transition-all duration-300',
                  creator.hasUnseen
                    ? 'shadow-sm group-hover:scale-105'
                    : isDark
                      ? 'bg-slate-700/80'
                      : 'bg-slate-300'
                )}
                style={creator.hasUnseen ? { background: BRAND_GRADIENT } : undefined}
              >
                <div className={cn('w-full h-full rounded-full overflow-hidden p-[2px]', isDark ? 'bg-[#0A102D]' : 'bg-white')}>
                  <LazyImage
                    src={creator.avatar}
                    alt={creator.name}
                    className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>

              <span
                className={cn(
                  'text-[11px] text-center truncate w-full transition-colors',
                  creator.hasUnseen
                    ? isDark
                      ? 'text-white font-semibold'
                      : 'text-slate-900 font-semibold'
                    : isDark
                      ? 'text-slate-400 font-medium'
                      : 'text-slate-600 font-medium'
                )}
              >
                {creator.name.split(' ')[0]}
              </span>
            </motion.button>
          ))}

        {/* Empty State Prompt */}
        {!loading && !error && !ownGroup && creators.length === 0 && (
          <button
            type="button"
            onClick={() => navigate('/create-story')}
            className={cn(
              'flex-1 min-w-[200px] min-h-[56px] px-4 py-2 rounded-2xl border border-dashed text-left transition-colors cursor-pointer',
              isDark
                ? 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06] text-slate-300'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
            )}
          >
            <p className="text-xs font-bold">No active Vibes right now</p>
            <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Tap to post a 24h photo, video, or text Vibe.
            </p>
          </button>
        )}

        {/* Load More Pagination Pill */}
        {!loading && hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-label="Load more Vibes"
            className={cn(
              'flex-shrink-0 h-14 px-4 rounded-2xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60',
              isDark
                ? 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
            )}
          >
            <span>{loadingMore ? 'Loading…' : 'More'}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
});

export default InFeedStoriesModule;
