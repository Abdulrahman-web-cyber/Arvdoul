// src/hooks/useSparkInteractions.js
//
// Single source of truth for Sparks / Reels / VideoDetail engagement and
// telemetry: watch-duration view flushing, creator follow hydration & toggles,
// like/save optimistic updates with server reconciliation & in-flight locks,
// and AbortError-safe share recording.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import videoService from '../services/videoService.js';
import { useVideoStore } from '../store/videoStore.js';
import { generateShareUrl } from '../utils/videoUtils.js';

const inFlightLikes = new Set();
const inFlightSaves = new Set();

function resolveCreatorHandle(label) {
  if (!label) return 'creator';
  const cleaned = String(label).trim().replace(/^@/, '');
  return cleaned || 'creator';
}

/**
 * Flush real elapsed watch duration for an active Spark/Reel/Video on
 * video switch, pagehide, or unmount.
 */
export function useSparkViewTracking(
  videoId,
  viewerUid,
  recordViewFn,
  sourceLabel = 'Sparks'
) {
  const viewStartRef = useRef(null);
  const flushedViewRef = useRef(null);
  const recordRef = useRef(recordViewFn);
  recordRef.current = recordViewFn;

  useEffect(() => {
    if (!videoId || !viewerUid) return undefined;
    viewStartRef.current = Date.now();
    flushedViewRef.current = null;

    const flushView = () => {
      if (!viewStartRef.current || flushedViewRef.current === videoId) return;
      const seconds = Math.round((Date.now() - viewStartRef.current) / 1000);
      viewStartRef.current = null;
      if (seconds >= 1) {
        flushedViewRef.current = videoId;
        const sender =
          typeof recordRef.current === 'function'
            ? recordRef.current
            : (id, meta) => videoService.recordVideoView(id, meta);
        Promise.resolve(sender(videoId, { watchDuration: seconds, duration: seconds })).catch(
          (err) => {
            console.warn(`[${sourceLabel}] view not recorded`, err?.message);
          }
        );
      }
    };

    window.addEventListener('pagehide', flushView);
    return () => {
      window.removeEventListener('pagehide', flushView);
      flushView();
    };
  }, [videoId, viewerUid, sourceLabel]);
}

/**
 * Canonical follow/unfollow/withdraw-request helper with optimistic update
 * and rollback for private-account follow requests (`requestStatus: 'pending'`).
 */
export async function toggleSparkCreatorFollow({
  viewerUid,
  creatorId,
  creatorLabel = '',
  wasFollowing = false,
  wasRequested = false,
  applyState,
  actions,
}) {
  if (!viewerUid) {
    toast.error('Sign in to follow creators');
    return null;
  }
  if (!creatorId) {
    toast.error('Cannot follow: creator unknown');
    return null;
  }
  if (creatorId === viewerUid) return null;

  const prevState = {
    isFollowing: Boolean(wasFollowing),
    requestStatus: wasRequested ? 'pending' : null,
  };
  const optimisticState = {
    isFollowing: !prevState.isFollowing && !wasRequested,
    requestStatus: null,
  };
  applyState?.(optimisticState);

  try {
    let resolvedActions = actions;
    if (!resolvedActions) {
      const { getUserService } = await import('../services/userService.js');
      const svc = getUserService();
      resolvedActions = {
        follow: (uid, targetId) => svc.followUser(uid, targetId),
        unfollow: (uid, targetId) => svc.unfollowUser(uid, targetId),
        cancelRequest: (uid, targetId) => svc.cancelFollowRequest(uid, targetId),
      };
    }

    const handle = `@${resolveCreatorHandle(creatorLabel)}`;

    if (prevState.isFollowing || wasRequested) {
      if (wasRequested) {
        await resolvedActions.cancelRequest(viewerUid, creatorId);
        toast.success('Request withdrawn');
      } else {
        await resolvedActions.unfollow(viewerUid, creatorId);
        toast.success(`Unfollowed ${handle}`);
      }
      const nextState = { isFollowing: false, requestStatus: null };
      applyState?.(nextState);
      return nextState;
    }

    const res = await resolvedActions.follow(viewerUid, creatorId);
    if (res?.requested || res?.requestStatus === 'pending') {
      const nextState = { isFollowing: false, requestStatus: 'pending' };
      applyState?.(nextState);
      toast.success('Follow request sent');
      return nextState;
    }

    const nextState = { isFollowing: true, requestStatus: null };
    applyState?.(nextState);
    toast.success(`Following ${handle}`);
    return nextState;
  } catch (err) {
    applyState?.(prevState);
    toast.error(err?.message || 'Could not update follow status');
    return prevState;
  }
}

/**
 * Batch-hydrates follow states for a feed of creators (`getFollowStates`)
 * and exposes `toggleCreatorFollow` without scanning the full graph.
 */
export function useSparkCreatorFollowMap(creatorIds, viewerUid, loadFollowStatesFn) {
  const [followStates, setFollowStates] = useState(() => new Map());
  const busyCreatorsRef = useRef(new Set());
  const loaderRef = useRef(loadFollowStatesFn);
  loaderRef.current = loadFollowStatesFn;

  const creatorIdsKey = useMemo(
    () => [...new Set((creatorIds || []).filter(Boolean))].join(','),
    [creatorIds]
  );

  useEffect(() => {
    if (!viewerUid || !creatorIdsKey) {
      setFollowStates(new Map());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = creatorIdsKey.split(',').filter(Boolean);
        if (ids.length === 0) return;
        let states;
        if (typeof loaderRef.current === 'function') {
          states = await loaderRef.current(viewerUid, ids);
        } else {
          const { getUserService } = await import('../services/userService.js');
          states = await getUserService().getFollowStates(viewerUid, ids);
        }
        if (cancelled || !states) return;
        setFollowStates(
          new Map(
            [...states].map(([id, state]) => [
              id,
              {
                isFollowing: Boolean(state?.isFollowing),
                requestStatus: state?.requestStatus ?? null,
              },
            ])
          )
        );
      } catch (err) {
        console.warn('Could not resolve follow state:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerUid, creatorIdsKey]);

  const setCreatorFollowState = useCallback((creatorId, nextState) => {
    if (!creatorId || !nextState) return;
    setFollowStates((prev) => {
      const next = new Map(prev);
      next.set(creatorId, {
        isFollowing: Boolean(nextState.isFollowing),
        requestStatus: nextState.requestStatus ?? null,
      });
      return next;
    });
  }, []);

  const toggleCreatorFollow = useCallback(
    async ({ creatorId, creatorLabel, currentIsFollowing, currentRequestStatus, actions }) => {
      if (!creatorId || busyCreatorsRef.current.has(creatorId)) return null;
      const existing = followStates.get(creatorId);
      const wasFollowing =
        typeof currentIsFollowing === 'boolean'
          ? currentIsFollowing
          : Boolean(existing?.isFollowing);
      const wasRequested =
        (currentRequestStatus ?? existing?.requestStatus ?? null) === 'pending';

      busyCreatorsRef.current.add(creatorId);
      try {
        return await toggleSparkCreatorFollow({
          viewerUid,
          creatorId,
          creatorLabel,
          wasFollowing,
          wasRequested,
          applyState: (next) => setCreatorFollowState(creatorId, next),
          actions,
        });
      } finally {
        busyCreatorsRef.current.delete(creatorId);
      }
    },
    [viewerUid, followStates, setCreatorFollowState]
  );

  return {
    followStates,
    setCreatorFollowState,
    toggleCreatorFollow,
  };
}

/**
 * Optimistically toggles Spark/Reel/Video like with an in-flight lock and
 * reconciles with the authoritative `action` returned by `videoService.likeVideo`.
 */
export async function toggleSparkLike({
  video,
  viewerUid,
  applyState,
  wasLikedOverride,
  knownLikesOverride,
  requireOwner = false,
  likeFn,
}) {
  if (!video?.id) return null;
  if (!viewerUid) {
    toast.error('Sign in to like Sparks');
    return null;
  }
  if (requireOwner && !(video.authorId || video.userId || video.creator?.id)) {
    toast.info('External videos cannot be liked.');
    return null;
  }
  if (inFlightLikes.has(video.id)) return null;

  const wasLiked =
    typeof wasLikedOverride === 'boolean' ? wasLikedOverride : Boolean(video.isLiked);
  const rawKnownLikes =
    knownLikesOverride !== undefined
      ? knownLikesOverride
      : (typeof video.likes === 'number'
          ? video.likes
          : (typeof video.stats?.likes === 'number' ? video.stats.likes : null));
  const knownLikes = typeof rawKnownLikes === 'number' ? rawKnownLikes : null;

  const optimisticLikes =
    knownLikes === null ? null : Math.max(0, knownLikes + (wasLiked ? -1 : 1));
  applyState?.({ isLiked: !wasLiked, likes: optimisticLikes });

  inFlightLikes.add(video.id);
  try {
    const res =
      typeof likeFn === 'function' ? await likeFn(video.id) : await videoService.likeVideo(video.id);
    const serverLiked = res?.action
      ? res.action === 'liked'
      : (typeof res?.data?.liked === 'boolean' ? res.data.liked : !wasLiked);
    const serverLikes =
      knownLikes === null
        ? null
        : (serverLiked === wasLiked
            ? knownLikes
            : Math.max(0, knownLikes + (serverLiked ? 1 : -1)));
    const next = { isLiked: serverLiked, likes: serverLikes };
    applyState?.(next);
    return next;
  } catch {
    applyState?.({ isLiked: wasLiked, likes: knownLikes });
    toast.error('Could not update like');
    return null;
  } finally {
    inFlightLikes.delete(video.id);
  }
}

/**
 * Optimistically toggles Spark/Reel/Video bookmark state, syncs the local Watch
 * Later store, persists via `videoService.saveVideo`/`unsaveVideo`, and rolls back
 * atomically on failure.
 */
export async function toggleSparkSave({
  video,
  viewerUid,
  applyState,
  wasSavedOverride,
  knownSavesOverride,
  syncWatchLater = true,
  saveFn,
  unsaveFn,
}) {
  if (!video?.id) return null;
  if (!viewerUid) {
    toast.error('Sign in to save Sparks');
    return null;
  }
  if (inFlightSaves.has(video.id)) return null;

  const wasSaved =
    typeof wasSavedOverride === 'boolean' ? wasSavedOverride : Boolean(video.isSaved);
  const rawKnownSaves =
    knownSavesOverride !== undefined
      ? knownSavesOverride
      : (typeof video.saves === 'number'
          ? video.saves
          : (typeof video.stats?.saves === 'number' ? video.stats.saves : null));
  const knownSaves = typeof rawKnownSaves === 'number' ? rawKnownSaves : null;
  const nextSaved = !wasSaved;
  const nextSaves =
    knownSaves === null ? null : Math.max(0, knownSaves + (wasSaved ? -1 : 1));

  applyState?.({ isSaved: nextSaved, saves: nextSaves });

  const store = useVideoStore.getState();
  if (syncWatchLater) {
    if (nextSaved) store.addToWatchLater?.(video);
    else store.removeFromWatchLater?.(video.id);
  }

  inFlightSaves.add(video.id);
  try {
    if (wasSaved) {
      if (typeof unsaveFn === 'function') await unsaveFn(video.id, viewerUid);
      else await videoService.unsaveVideo(video.id, viewerUid);
      toast.info('Removed from saved');
    } else {
      if (typeof saveFn === 'function') await saveFn(video.id, viewerUid);
      else await videoService.saveVideo(video.id, viewerUid);
      toast.success('Saved to your collection');
    }
    return { isSaved: nextSaved, saves: nextSaves };
  } catch (err) {
    applyState?.({ isSaved: wasSaved, saves: knownSaves });
    if (syncWatchLater) {
      if (wasSaved) store.addToWatchLater?.(video);
      else store.removeFromWatchLater?.(video.id);
    }
    toast.error(err?.message || 'Could not sync save');
    return null;
  } finally {
    inFlightSaves.delete(video.id);
  }
}

/**
 * Native Web Share / clipboard fallback with AbortError cancellation guard.
 * Records the share via `videoService.shareVideo` ONLY after a share succeeds.
 */
export async function shareSpark({
  videoId,
  canonicalId,
  title = 'Watch this on ARVDOUL',
  onShared,
  shareFn,
}) {
  if (!videoId) return { shared: false, cancelled: false };
  const url = generateShareUrl(canonicalId || videoId);
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success('Spark link copied');
    } else {
      toast.info(url);
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { shared: false, cancelled: true };
    }
    toast.error('Could not share Spark');
    return { shared: false, cancelled: false };
  }

  try {
    const res =
      typeof shareFn === 'function'
        ? await shareFn(videoId, 'arvdoul')
        : await videoService.shareVideo(videoId, 'arvdoul');
    if (res?.success) {
      onShared?.(res);
    }
  } catch (err) {
    console.warn('[SparkShare] share counter sync deferred', err?.message);
  }
  return { shared: true, cancelled: false };
}
