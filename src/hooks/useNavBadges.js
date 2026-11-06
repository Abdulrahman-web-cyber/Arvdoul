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

      const [messages, stats, requests] = await Promise.allSettled([
        getMessagingService().getTotalUnreadCount(uid),
        getNotificationsService().getNotificationStats(uid),
        getUserService().getFriendRequests(uid, 'received'),
      ]);

      setCounts({
        messages: messages.status === 'fulfilled' ? Number(messages.value) || 0 : 0,
        notifications:
          stats.status === 'fulfilled' ? Number(stats.value?.stats?.unread) || 0 : 0,
        network:
          requests.status === 'fulfilled' && Array.isArray(requests.value?.requests)
            ? requests.value.requests.length
            : 0,
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
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('arvdoul:messages-read', onMessageEvent);
      window.removeEventListener('arvdoul:notification-read', onMessageEvent);
      window.removeEventListener('arvdoul:friend-request-changed', onMessageEvent);
    };
  }, [uid, refresh]);

  return counts;
}

export default useNavBadges;
