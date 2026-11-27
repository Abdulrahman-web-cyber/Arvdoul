// src/hooks/useSparksFeed.js
//
// Single source of truth for Sparks / Videos / Reels feed loading, normalization,
// cursor pagination, not-interested filtering, creator follow hydration, and
// cross-surface interest-vector feedback.

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import videoService from '../services/videoService.js';
import feedService from '../services/feedService.js';
import { useVideoStore } from '../store/videoStore.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import {
  useSparkCreatorFollowMap,
  toggleSparkCreatorFollow,
  toggleSparkLike,
  toggleSparkSave,
  shareSpark,
} from './useSparkInteractions.js';

/**
 * Normalize a canonical video/post item into one unified Spark shape shared by
 * VideosScreen, VideoFeed, and ReelsScreen. Never fabricates 0s for missing counters.
 */
export function normalizeSparkItem(v) {
  if (!v) return null;
  const creatorName = v.creator?.name || v.authorName || '';
  const creatorUsername = v.creator?.username || v.authorUsername || '';
  const creatorId = v.creator?.id || v.authorId || v.userId || null;
  const likes = v.likes ?? v.stats?.likes ?? null;
  const comments = v.comments ?? v.stats?.comments ?? null;
  const shares = v.shares ?? v.stats?.shares ?? null;
  const saves = v.saves ?? v.stats?.saves ?? null;
  const views = v.views ?? v.stats?.views ?? null;
  const gifts = v.gifts ?? v.stats?.gifts ?? null;

  return {
    ...v,
    id: v.id,
    canonicalPostId: v.canonicalPostId || null,
    _sourceCollection: v._sourceCollection || 'posts',
    muxPlaybackId: v.muxPlaybackId || null,
    playbackPolicy: v.playbackPolicy || null,
    creator: {
      id: creatorId,
      name: creatorName,
      username: creatorUsername,
      avatar: getSafeAvatarUrl(v.creator?.avatar || v.authorPhoto, creatorName, creatorId),
      verified: Boolean(v.creator?.verified ?? v.creator?.isVerified ?? v.authorVerified),
      isFollowing: Boolean(v.creator?.isFollowing),
      requestStatus: v.creator?.requestStatus ?? null,
    },
    title: v.title || v.description || '',
    description: v.description || v.title || '',
    hashtags: Array.isArray(v.hashtags) ? v.hashtags : [],
    topics: Array.isArray(v.topics) ? v.topics : [],
    music: v.audio?.title || v.music || '',
    videoUrl: v.signedUrl || v.videoUrl || '',
    thumbnailUrl: v.thumbnailUrl || v.thumbnail || '',
    likes,
    comments,
    shares,
    saves,
    views,
    gifts,
    stats: {
      likes,
      comments,
      shares,
      saves,
      views,
      gifts,
    },
    duration: v.duration || 0,
    isLiked: Boolean(v.isLiked),
    isSaved: Boolean(v.isSaved),
  };
}

export function extractSparkSignals(spark) {
  if (!spark) return [];
  const tags = [
    ...(Array.isArray(spark.hashtags) ? spark.hashtags.map((t) => String(t).replace(/^#/, '').toLowerCase()) : []),
    ...(Array.isArray(spark.topics) ? spark.topics.map((t) => String(t).toLowerCase()) : []),
  ].filter(Boolean);
  const creatorId = spark.creator?.id || spark.authorId || spark.userId;
  if (creatorId) tags.push(`creator:${creatorId}`);
  return tags;
}

export function recordSparkSignal(viewerUid, spark, action = 'view') {
  if (!viewerUid || !spark) return;
  const signals = extractSparkSignals(spark);
  if (signals.length === 0) return;
  feedService.updateUserInterestVector(viewerUid, signals, action).catch(() => {});
}

/**
 * Unified Sparks / Reels feed controller hook.
 *
 * mode: 'store' shares state with useVideoStore (VideosScreen);
 * mode: 'local' keeps isolated component state (ReelsScreen).
 */
export function useSparksFeed({
  viewerUid = null,
  feedType = 'sparks',
  limit = 20,
  mode = 'store',
  targetId = null,
  syncWatchLater = true,
  fetchFeedFn = null,
  likeFn = null,
  shareFn = null,
  normalizeFn = null,
} = {}) {
  const store = useVideoStore();
  const [localItems, setLocalItems] = useState([]);
  const [localLoading, setLocalLoading] = useState(Boolean(viewerUid) || mode === 'store');
  const [localLoadingMore, setLocalLoadingMore] = useState(false);
  const [localHasMore, setLocalHasMore] = useState(false);
  const [localCursor, setLocalCursor] = useState(null);
  const [error, setError] = useState(null);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  const cursorRef = useRef(null);

  const rawItems = mode === 'store' ? store.videos : localItems;
  const loading = mode === 'store' ? store.loading : localLoading;
  const loadingMore = mode === 'store' ? store.loadingMore : localLoadingMore;
  const hasMore = mode === 'store' ? store.hasMore : localHasMore;
  const currentCursor = mode === 'store' ? store.nextCursor : localCursor;

  const normalize = useCallback(
    (v) => (typeof normalizeFn === 'function' ? normalizeFn(v) : normalizeSparkItem(v)),
    [normalizeFn]
  );

  const setItems = useCallback((next) => {
    const normalized = (typeof next === 'function' ? next(rawItems) : next)
      .map(normalize)
      .filter(Boolean);
    if (mode === 'store') {
      store.setVideos(normalized);
    } else {
      setLocalItems(normalized);
    }
  }, [mode, store, rawItems, normalize]);

  const setLoading = mode === 'store' ? store.setLoading : setLocalLoading;
  const setLoadingMore = mode === 'store' ? store.setLoadingMore : setLocalLoadingMore;
  const setHasMore = mode === 'store' ? store.setHasMore : setLocalHasMore;
  const setNextCursor = useCallback((c) => {
    cursorRef.current = c || null;
    if (mode === 'store') store.setNextCursor(c || null);
    else setLocalCursor(c || null);
  }, [mode, store]);

  const items = useMemo(() => {
    const blocked = new Set(store.notInterestedIds || []);
    return rawItems
      .map(normalizeSparkItem)
      .filter((item) => item && !blocked.has(item.id));
  }, [rawItems, store.notInterestedIds]);

  const creatorIds = useMemo(
    () => items.map((r) => r.creator?.id).filter(Boolean),
    [items]
  );

  const { followStates, setCreatorFollowState } = useSparkCreatorFollowMap(creatorIds, viewerUid);

  const hydratedItems = useMemo(() => {
    if (followStates.size === 0) return items;
    return items.map((r) => {
      const state = followStates.get(r.creator?.id);
      if (!state) return r;
      const nextFollowing = Boolean(state.isFollowing);
      const nextRequest = state.requestStatus ?? null;
      if (r.creator.isFollowing === nextFollowing && (r.creator.requestStatus ?? null) === nextRequest) {
        return r;
      }
      return {
        ...r,
        creator: {
          ...r.creator,
          isFollowing: nextFollowing,
          requestStatus: nextRequest,
        },
      };
    });
  }, [items, followStates]);

  const loadFeed = useCallback(async (overrideFeedType = feedType, { replace = false } = {}) => {
    if (replace || items.length === 0) {
      setLoading(true);
      if (replace) {
        if (mode === 'store') store.setVideos([]);
        else setLocalItems([]);
      }
    } else {
      setBackgroundRefreshing(true);
    }
    setError(null);

    try {
      const fetcher = typeof fetchFeedFn === 'function'
        ? fetchFeedFn
        : (uid, opts) => videoService.getVideoFeed(uid, opts);
      const res = await fetcher(viewerUid ?? null, {
        feedType: overrideFeedType,
        limit,
        type: 'video',
      });
      const mapped = (res?.feed || res?.videos || []).map(normalize).filter(Boolean);
      let resolvedIndex = 0;

      if (targetId) {
        const idx = mapped.findIndex((r) => r.id === targetId);
        if (idx >= 0) {
          resolvedIndex = idx;
        } else {
          try {
            const fetched = await videoService.getVideo(targetId);
            if (fetched?.video) {
              const single = normalize(fetched.video);
              if (single && !mapped.some((m) => m.id === single.id)) {
                mapped.unshift(single);
              }
              resolvedIndex = 0;
            }
          } catch {
            resolvedIndex = 0;
          }
        }
      }

      if (mode === 'store') {
        store.setVideos(mapped);
      } else {
        setLocalItems(mapped);
      }
      setHasMore(Boolean(res?.hasMore && res?.nextCursor));
      setNextCursor(res?.nextCursor || null);
      return { success: true, items: mapped, initialIndex: resolvedIndex };
    } catch (err) {
      const msg = err?.message || 'Could not load Sparks.';
      if (replace || items.length === 0) {
        setError(msg);
      }
      setHasMore(false);
      setNextCursor(null);
      return { success: false, items: [], initialIndex: 0, error: msg };
    } finally {
      setLoading(false);
      setBackgroundRefreshing(false);
    }
  }, [feedType, items.length, viewerUid, limit, targetId, mode, store, fetchFeedFn, normalize, setLoading, setHasMore, setNextCursor]);

  const loadMore = useCallback(async ({ overrideFeedType = feedType, cursor, cursorOverride } = {}) => {
    const activeCursor = cursorOverride !== undefined
      ? cursorOverride
      : (cursor !== undefined ? cursor : (cursorRef.current || currentCursor));
    if (loadingMore || !hasMore || !activeCursor) return [];
    setLoadingMore(true);
    try {
      const fetcher = typeof fetchFeedFn === 'function'
        ? fetchFeedFn
        : (uid, opts) => videoService.getVideoFeed(uid, opts);
      const res = await fetcher(viewerUid ?? null, {
        feedType: overrideFeedType,
        limit,
        type: 'video',
        cursor: activeCursor,
      });
      const mapped = (res?.feed || res?.videos || []).map(normalize).filter(Boolean);
      if (mapped.length > 0) {
        if (mode === 'store') {
          store.appendVideos(mapped);
        } else {
          setLocalItems((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
          });
        }
      }
      setHasMore(Boolean(res?.hasMore && res?.nextCursor));
      setNextCursor(res?.nextCursor || null);
      return mapped;
    } catch (err) {
      console.warn('[SparksFeed] loadMore failed:', err?.message);
      return [];
    } finally {
      setLoadingMore(false);
    }
  }, [feedType, currentCursor, loadingMore, hasMore, viewerUid, limit, mode, store, fetchFeedFn, normalize, setLoadingMore, setHasMore, setNextCursor]);

  const patchItem = useCallback((id, patch) => {
    if (!id) return;
    if (mode === 'store') {
      store.updateVideo(id, patch);
    } else {
      setLocalItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
  }, [mode, store]);

  const removeItem = useCallback((id) => {
    if (!id) return;
    if (mode === 'store') {
      store.removeVideo(id);
    } else {
      setLocalItems((prev) => prev.filter((r) => r.id !== id));
    }
  }, [mode, store]);

  const markNotInterested = useCallback((spark) => {
    const id = typeof spark === 'string' ? spark : spark?.id;
    if (!id) return;
    store.markNotInterested(id);
    removeItem(id);
    if (viewerUid && typeof spark === 'object') {
      recordSparkSignal(viewerUid, spark, 'not_interested');
    }
  }, [store, removeItem, viewerUid]);

  const handleToggleLike = useCallback(async (spark) => {
    if (!spark?.id) return null;
    const res = await toggleSparkLike({
      video: spark,
      viewerUid,
      knownLikesOverride: spark.stats?.likes ?? spark.likes ?? null,
      likeFn: typeof likeFn === 'function' ? likeFn : (id) => videoService.likeVideo(id),
      applyState: ({ isLiked, likes }) => {
        patchItem(spark.id, {
          isLiked,
          likes,
          stats: { ...(spark.stats || {}), likes },
        });
      },
    });
    if (res?.isLiked) {
      recordSparkSignal(viewerUid, spark, 'like');
    }
    return res;
  }, [viewerUid, patchItem, likeFn]);

  const handleToggleSave = useCallback(async (spark) => {
    if (!spark?.id) return null;
    const applyState = ({ isSaved, saves }) => {
      patchItem(spark.id, {
        isSaved,
        saves,
        stats: { ...(spark.stats || {}), saves },
      });
    };
    const res = await toggleSparkSave({
      video: spark,
      viewerUid,
      knownSavesOverride: spark.stats?.saves ?? spark.saves ?? null,
      syncWatchLater,
      saveFn: (id, uid) => videoService.saveVideo(id, uid),
      unsaveFn: (id, uid) => videoService.unsaveVideo(id, uid),
      applyState,
    });
    if (res?.isSaved) {
      recordSparkSignal(viewerUid, spark, 'save');
    }
    return res;
  }, [viewerUid, syncWatchLater, patchItem]);

  const handleShare = useCallback(async (spark) => {
    if (!spark?.id) return { shared: false, cancelled: false };
    return shareSpark({
      videoId: spark.id,
      canonicalId: spark.canonicalPostId || spark.id,
      title: spark.title || 'Watch this on ARVDOUL',
      shareFn: typeof shareFn === 'function' ? shareFn : (id, platform) => videoService.shareVideo(id, platform),
      onShared: () => {
        const curShares = spark.stats?.shares ?? spark.shares;
        if (curShares != null) {
          patchItem(spark.id, {
            shares: curShares + 1,
            stats: { ...(spark.stats || {}), shares: curShares + 1 },
          });
        }
        recordSparkSignal(viewerUid, spark, 'share');
      },
    });
  }, [viewerUid, patchItem, shareFn]);

  const handleFollowCreator = useCallback(async (creator, actions) => {
    if (!creator?.id) return null;
    return toggleSparkCreatorFollow({
      viewerUid,
      creatorId: creator.id,
      creatorLabel: creator.username || creator.name,
      wasFollowing: Boolean(creator.isFollowing),
      wasRequested: creator.requestStatus === 'pending',
      applyState: ({ isFollowing, requestStatus = null }) => {
        setCreatorFollowState(creator.id, { isFollowing, requestStatus });
        if (mode === 'local') {
          setLocalItems((prev) =>
            prev.map((r) =>
              r.creator?.id === creator.id
                ? { ...r, creator: { ...r.creator, isFollowing, requestStatus } }
                : r
            )
          );
        }
      },
      actions,
    });
  }, [viewerUid, mode, setCreatorFollowState]);

  useEffect(() => {
    cursorRef.current = currentCursor || null;
  }, [currentCursor]);

  return {
    items: hydratedItems,
    setItems,
    loading,
    setLoading,
    loadingMore,
    hasMore,
    error,
    setError,
    backgroundRefreshing,
    cursorRef,
    nextCursor: currentCursor,
    loadFeed,
    loadMore,
    patchItem,
    removeItem,
    markNotInterested,
    toggleLike: handleToggleLike,
    toggleSave: handleToggleSave,
    shareItem: handleShare,
    followCreator: handleFollowCreator,
  };
}
