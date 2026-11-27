// src/hooks/useNavBadges.js
//
// Live navigation badge counts for the bottom navigation.
//
// The counts come from the real counters, not from a store slice:
//   messages      -> messagesService.getTotalUnreadCount  (user_unread_totals shards)
//   notifications -> notificationsService.getNotificationStats (notification_counters shards)
//   network       -> userService.getFriendRequests        (friend_requests, pending)
//
// `appStore.unreadCounts` used to back these badges, but nothing ever wrote
// that key, so the Chat and Alerts badges rendered 0 forever. This hook reads
// the real sources and refreshes on the events that change them.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const INITIAL = { messages: 0, notifications: 0, network: 0 };
const BADGE_FOCUS_COOLDOWN_MS = 30000;
const BADGE_SHARED_CACHE_TTL_MS = 2500;

let sharedState = { uid: null, counts: INITIAL, fetchedAt: 0 };
let sharedInFlight = { uid: null, promise: null };
const badgeListeners = new Set();

function publishCounts(uid, nextCounts) {
  sharedState = { uid, counts: nextCounts, fetchedAt: Date.now() };
  for (const listener of badgeListeners) {
    listener(uid, nextCounts);
  }
}

async function fetchBadgesShared(uid, force = false) {
  if (!uid) return INITIAL;
  const now = Date.now();
  if (sharedInFlight.uid === uid && sharedInFlight.promise) {
    return sharedInFlight.promise;
  }
  if (
    sharedState.uid === uid &&
    sharedState.fetchedAt > 0 &&
    now - sharedState.fetchedAt < (force ? BADGE_SHARED_CACHE_TTL_MS : BADGE_FOCUS_COOLDOWN_MS)
  ) {
    return sharedState.counts;
  }

  const promise = (async () => {
    try {
      const { getMessagingService } = await import('../services/messagesService.js');
      const { getNotificationsService } = await import('../services/notificationsService.js');
      const { getUserService } = await import('../services/userService.js');

      const userSvc = getUserService();
      const [messages, stats, requests, followRequests] = await Promise.allSettled([
        getMessagingService().getTotalUnreadCount(uid),
        getNotificationsService().getNotificationStats(uid),
        userSvc.getFriendRequests(uid, 'received'),
        typeof userSvc.getFollowRequests === 'function'
          ? userSvc.getFollowRequests(uid)
          : Promise.resolve({ requests: [] }),
      ]);

      const friendReqCount =
        requests.status === 'fulfilled' && Array.isArray(requests.value?.requests)
          ? requests.value.requests.length
          : 0;
      const followReqCount =
        followRequests.status === 'fulfilled' && Array.isArray(followRequests.value?.requests)
          ? followRequests.value.requests.length
          : 0;

      const nextCounts = {
        messages: messages.status === 'fulfilled' ? Number(messages.value) || 0 : 0,
        notifications:
          stats.status === 'fulfilled' ? Number(stats.value?.stats?.unread) || 0 : 0,
        network: friendReqCount + followReqCount,
      };
      publishCounts(uid, nextCounts);
      return nextCounts;
    } finally {
      if (sharedInFlight.uid === uid) {
        sharedInFlight = { uid: null, promise: null };
      }
    }
  })();

  sharedInFlight = { uid, promise };
  return promise;
}

export function useNavBadges() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [counts, setCounts] = useState(() => (uid && sharedState.uid === uid ? sharedState.counts : INITIAL));
  const lastEventRefreshRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!uid) return;
    if (!force && lastEventRefreshRef.current > 0 && Date.now() - lastEventRefreshRef.current < BADGE_FOCUS_COOLDOWN_MS) {
      return;
    }
    lastEventRefreshRef.current = Date.now();
    const next = await fetchBadgesShared(uid, force);
    setCounts(next);
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setCounts(INITIAL);
      return undefined;
    }
    const listener = (targetUid, nextCounts) => {
      if (targetUid === uid) setCounts(nextCounts);
    };
    badgeListeners.add(listener);
    refresh(true);

    const onFocus = () => refresh(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(false);
    };
    const onMessageEvent = () => {
      sharedState = { ...sharedState, fetchedAt: 0 };
      refresh(true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('arvdoul:messages-read', onMessageEvent);
    window.addEventListener('arvdoul:notification-read', onMessageEvent);
    window.addEventListener('arvdoul:friend-request-changed', onMessageEvent);
    window.addEventListener('arvdoul:follow-request-changed', onMessageEvent);
    return () => {
      badgeListeners.delete(listener);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('arvdoul:messages-read', onMessageEvent);
      window.removeEventListener('arvdoul:notification-read', onMessageEvent);
      window.removeEventListener('arvdoul:friend-request-changed', onMessageEvent);
      window.removeEventListener('arvdoul:follow-request-changed', onMessageEvent);
    };
  }, [uid, refresh]);

  return counts;
}

export default useNavBadges;
