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

export function useNavBadges() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [counts, setCounts] = useState(INITIAL);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!uid || inFlight.current) return;
    inFlight.current = true;
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

      setCounts({
        messages: messages.status === 'fulfilled' ? Number(messages.value) || 0 : 0,
        notifications:
          stats.status === 'fulfilled' ? Number(stats.value?.stats?.unread) || 0 : 0,
        network: friendReqCount + followReqCount,
      });
    } finally {
      inFlight.current = false;
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setCounts(INITIAL);
      return undefined;
    }
    refresh();

    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onMessageEvent = () => refresh();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('arvdoul:messages-read', onMessageEvent);
    window.addEventListener('arvdoul:notification-read', onMessageEvent);
    window.addEventListener('arvdoul:friend-request-changed', onMessageEvent);
    window.addEventListener('arvdoul:follow-request-changed', onMessageEvent);
    return () => {
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
