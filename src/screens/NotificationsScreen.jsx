// src/screens/NotificationsScreen.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as ReactWindow from 'react-window';
const { FixedSizeList: List } = ReactWindow;
import {
  Heart, MessageCircle, Repeat, UserPlus, Bell, CheckCheck,
  Sparkles, Coins, Award, AlertCircle, ExternalLink, Settings,
  X, Volume2, VolumeX, Loader2, Flag, ThumbsUp, Clock,
} from 'lucide-react';
import notificationsService, { getNotificationsService } from '../services/notificationsService.js';
const NOTIFICATION_TYPES = notificationsService.TYPES;
import { getAuth } from 'firebase/auth';

// ----------------------------------------------------------------------
// Helper: safe timestamp extraction (Firestore Timestamp or string)
// ----------------------------------------------------------------------
const getTime = (t) => {
  if (!t) return 0;
  if (t.toDate) return t.toDate().getTime();
  return new Date(t).getTime();
};

// ----------------------------------------------------------------------
// Priority order for ranking
// ----------------------------------------------------------------------
const PRIORITY_ORDER = {
  high: 0,
  normal: 1,
  low: 2,
};

// ----------------------------------------------------------------------
// Icon mapping
// ----------------------------------------------------------------------
const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.LIKE:
      return <Heart className="w-5 h-5 text-red-500" />;
    case NOTIFICATION_TYPES.COMMENT:
    case NOTIFICATION_TYPES.REPLY:
      return <MessageCircle className="w-5 h-5 text-blue-500" />;
    case NOTIFICATION_TYPES.REPOST:
    case NOTIFICATION_TYPES.QUOTE:
      return <Repeat className="w-5 h-5 text-green-500" />;
    case NOTIFICATION_TYPES.FOLLOW:
    case NOTIFICATION_TYPES.FOLLOW_REQUEST:
    case NOTIFICATION_TYPES.FOLLOW_ACCEPTED:
      return <UserPlus className="w-5 h-5 text-purple-500" />;
    case NOTIFICATION_TYPES.COINS_EARNED:
    case NOTIFICATION_TYPES.GIFT_RECEIVED:
      return <Coins className="w-5 h-5 text-yellow-500" />;
    case NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED:
    case NOTIFICATION_TYPES.LEVEL_UP:
    case NOTIFICATION_TYPES.BADGE_EARNED:
      return <Award className="w-5 h-5 text-indigo-500" />;
    case NOTIFICATION_TYPES.SPONSORED:
      return <Sparkles className="w-5 h-5 text-pink-500" />;
    case NOTIFICATION_TYPES.SYSTEM_ALERT:
    case NOTIFICATION_TYPES.SECURITY_ALERT:
      return <AlertCircle className="w-5 h-5 text-orange-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

// ----------------------------------------------------------------------
// Skeleton loader (compatible with virtualized list)
// ----------------------------------------------------------------------
const NotificationSkeleton = ({ style }) => (
  <div style={style} className="animate-pulse flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
    <div className="flex-1">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
    </div>
  </div>
);

// ----------------------------------------------------------------------
// Settings Modal
// ----------------------------------------------------------------------
const SettingsModal = ({ isOpen, onClose, preferences, onUpdate, loading }) => {
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preferences) setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(localPrefs);
      toast.success('Settings saved');
      onClose();
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notification Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <span>Mute all notifications</span>
            </div>
            <button
              onClick={() => setLocalPrefs(prev => ({ ...prev, muted: !prev.muted }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localPrefs?.muted ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localPrefs?.muted ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Notification types</p>
            {Object.values(NOTIFICATION_TYPES).map((type) => (
              <div key={type} className="flex items-center justify-between">
                <label className="text-sm capitalize">{type.replace('_', ' ')}</label>
                <button
                  onClick={() => setLocalPrefs(prev => ({
                    ...prev,
                    blockedTypes: prev.blockedTypes?.includes(type)
                      ? prev.blockedTypes.filter(t => t !== type)
                      : [...(prev.blockedTypes || []), type]
                  }))}
                  className={`px-2 py-1 text-xs rounded-full ${localPrefs?.blockedTypes?.includes(type) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                >
                  {localPrefs?.blockedTypes?.includes(type) ? 'Blocked' : 'Enabled'}
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Priority override</p>
            {Object.values(NOTIFICATION_TYPES).map((type) => (
              <div key={type} className="flex items-center justify-between">
                <label className="text-sm capitalize">{type.replace('_', ' ')}</label>
                <select
                  value={localPrefs?.priorityMap?.[type] || 'normal'}
                  onChange={(e) => setLocalPrefs(prev => ({
                    ...prev,
                    priorityMap: { ...prev.priorityMap, [type]: e.target.value }
                  }))}
                  className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-2 py-1"
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Error Boundary
// ----------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('NotificationsScreen error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Something went wrong. Please refresh the page.</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
const NotificationsScreen = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [lastDocId, setLastDocId] = useState(null);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({ muted: false, blockedTypes: [], priorityMap: {} });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [listHeight, setListHeight] = useState(window.innerHeight - 80); // adjust header height

  const { ref, inView } = useInView({ threshold: 0.1 });
  const notificationsServiceRef = useRef(null);
  const unreadSubscriptionRef = useRef(null);
  const notificationsSubscriptionRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const auth = getAuth();
  const currentUserId = userId || auth.currentUser?.uid;

  // Handle window resize for virtual list
  useEffect(() => {
    const handleResize = () => {
      setListHeight(window.innerHeight - 80); // 80px = header height
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize service
  useEffect(() => {
    let isMounted = true;
    const initService = async () => {
      try {
        const service = getNotificationsService();
        await service.ensureInitialized();
        if (isMounted) {
          notificationsServiceRef.current = service;
          setIsServiceReady(true);
        }
      } catch (err) {
        console.error('Failed to initialize notifications service:', err);
        if (isMounted) {
          setError('Notification service unavailable. Please try again later.');
          setLoading(false);
        }
      }
    };
    initService();
    return () => { isMounted = false; };
  }, []);

  // Fetch preferences
  useEffect(() => {
    if (!isServiceReady || !currentUserId || !notificationsServiceRef.current) return;
    const fetchPrefs = async () => {
      setPrefsLoading(true);
      try {
        const prefs = await notificationsServiceRef.current.getUserNotificationPreferences(currentUserId);
        setPreferences(prefs);
      } catch (err) {
        console.warn('Failed to fetch preferences', err);
      } finally {
        setPrefsLoading(false);
      }
    };
    fetchPrefs();
  }, [isServiceReady, currentUserId]);

  // Helper to deduplicate and sort notifications
  const dedupeAndSort = useCallback((list) => {
    const map = new Map();
    list.forEach(n => {
      const existing = map.get(n.id);
      if (!existing || getTime(n.createdAt) > getTime(existing.createdAt)) {
        map.set(n.id, n);
      }
    });
    const unique = Array.from(map.values());
    return unique.sort((a, b) => {
      // Priority first
      const aPriority = PRIORITY_ORDER[a.priority] ?? 1;
      const bPriority = PRIORITY_ORDER[b.priority] ?? 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Then newest first
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (!isServiceReady || !currentUserId || !notificationsServiceRef.current) return;

    const fetchInitial = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await notificationsServiceRef.current.getUserNotifications(currentUserId, {
          limit: 20,
          includeSponsored: true,
        });
        const sorted = dedupeAndSort(data);
        setNotifications(sorted);
        setHasMore(data.length === 20);
        if (sorted.length > 0) {
          setLastDocId(sorted[sorted.length - 1].id);
        }
      } catch (err) {
        setError(err.message || 'Failed to load notifications');
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();

    // Real-time subscription (merge and dedupe)
    notificationsSubscriptionRef.current = notificationsServiceRef.current.subscribeToUserNotifications(
      currentUserId,
      (newNotifications) => {
        setNotifications(prev => dedupeAndSort([...newNotifications, ...prev]));
        setHasMore(newNotifications.length === 20);
        if (newNotifications.length > 0) {
          const latestId = newNotifications[0]?.id;
          if (latestId) setLastDocId(latestId);
        }
      }
    );

    // Unread count subscription
    unreadSubscriptionRef.current = notificationsServiceRef.current.subscribeToNotificationCount(
      currentUserId,
      (count) => {
        setUnreadCount(count);
      }
    );

    return () => {
      if (notificationsSubscriptionRef.current) {
        notificationsServiceRef.current.unsubscribe(notificationsSubscriptionRef.current);
      }
      if (unreadSubscriptionRef.current) {
        notificationsServiceRef.current.unsubscribe(unreadSubscriptionRef.current);
      }
    };
  }, [currentUserId, isServiceReady, dedupeAndSort]);

  // Infinite scroll (load more)
  useEffect(() => {
    if (!inView || loadingMore || !hasMore || loading || !isServiceReady || !notificationsServiceRef.current) return;

    const loadMore = async () => {
      try {
        setLoadingMore(true);
        const more = await notificationsServiceRef.current.getUserNotifications(currentUserId, {
          limit: 20,
          startAfter: lastDocId,
          includeSponsored: true,
        });
        if (more.length === 0) {
          setHasMore(false);
        } else {
          setNotifications(prev => dedupeAndSort([...prev, ...more]));
          setLastDocId(more[more.length - 1].id);
          setHasMore(more.length === 20);
        }
      } catch (err) {
        toast.error('Failed to load more notifications');
      } finally {
        setLoadingMore(false);
      }
    };

    loadMore();
  }, [inView, loadingMore, hasMore, lastDocId, loading, currentUserId, isServiceReady, dedupeAndSort]);

  // Batch mark as read (using service batch method)
  const handleMarkAsRead = useCallback(async (ids) => {
    const idsArray = ids instanceof Set ? Array.from(ids) : [ids];
    if (idsArray.length === 0 || !isServiceReady || !notificationsServiceRef.current) return;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (idsArray.includes(n.id) ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(prev - idsArray.length, 0));
    setSelectedIds(new Set());

    try {
      // Use a batch method in the service (e.g., markNotificationsAsReadBatch)
      await notificationsServiceRef.current.markNotificationsAsReadBatch(idsArray, currentUserId);
    } catch (err) {
      // Revert
      setNotifications(prev =>
        prev.map(n => (idsArray.includes(n.id) ? { ...n, read: false } : n))
      );
      setUnreadCount(prev => prev + idsArray.length);
      toast.error('Failed to mark as read');
      // Add to offline queue for retry
      offlineQueueRef.current.push({ type: 'MARK_READ', payload: { ids: idsArray, userId: currentUserId } });
    }
  }, [currentUserId, isServiceReady]);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!isServiceReady || !notificationsServiceRef.current) return;
    try {
      await notificationsServiceRef.current.markAllAsRead(currentUserId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  }, [currentUserId, isServiceReady]);

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification) => {
      if (notification.sponsored && notification.actionUrl) {
        window.open(notification.actionUrl, '_blank');
        return;
      }
      if (!notification.read) {
        handleMarkAsRead(notification.id);
      }
      if (notification.targetId) {
        // Navigate (replace with your router)
        console.log('Navigate to:', notification.targetId, notification.type);
      }
    },
    [handleMarkAsRead]
  );

  // Toggle selection for batch
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  // Update preferences
  const handleUpdatePreferences = useCallback(async (newPrefs) => {
    if (!isServiceReady || !notificationsServiceRef.current) return;
    await notificationsServiceRef.current.updateUserNotificationPreferences(currentUserId, newPrefs);
    setPreferences(newPrefs);
  }, [currentUserId, isServiceReady]);

  // Virtualized row renderer
  const Row = useCallback(({ index, style }) => {
    const notification = notifications[index];
    if (!notification) return null;

    const isUnread = !notification.read && !notification.sponsored;
    const isSponsored = notification.sponsored;
    const isSelected = selectedIds.has(notification.id);

    return (
      <div style={style} className="relative">
        <div
          className={`
            flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800
            hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer
            ${isUnread ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
            ${isSponsored ? 'bg-pink-50 dark:bg-pink-900/10' : ''}
            ${isSelected ? 'ring-2 ring-blue-500' : ''}
          `}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex-shrink-0 mt-1">
            <input
              type="checkbox"
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                toggleSelect(notification.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {notification.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                {notification.batchCount > 1 && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    +{notification.batchCount - 1} more
                  </p>
                )}
                {isSponsored && (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 text-xs">
                    <Sparkles className="w-3 h-3" />
                    <span>Sponsored</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(notification.createdAt?.toDate?.() || new Date(notification.createdAt), { addSuffix: true })}
                </span>
                {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                {isSponsored && notification.actionUrl && <ExternalLink className="w-3 h-3 text-gray-400" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [notifications, selectedIds, handleNotificationClick, toggleSelect]);

  // Memoize list for performance
  const memoizedList = useMemo(() => (
    <List
      height={listHeight}
      itemCount={notifications.length}
      itemSize={90}
      width="100%"
      overscanCount={5}
    >
      {Row}
    </List>
  ), [notifications.length, listHeight, Row]);

  // Offline queue processing (simple version)
  useEffect(() => {
    const processQueue = async () => {
      if (!navigator.onLine || !isServiceReady || offlineQueueRef.current.length === 0) return;
      const queue = [...offlineQueueRef.current];
      offlineQueueRef.current = [];
      for (const action of queue) {
        try {
          if (action.type === 'MARK_READ') {
            await notificationsServiceRef.current.markNotificationsAsReadBatch(action.payload.ids, action.payload.userId);
          }
          // add other actions as needed
        } catch (err) {
          console.warn('Failed to process offline action', action, err);
          offlineQueueRef.current.push(action); // re-queue
        }
      }
    };
    const interval = setInterval(processQueue, 5000);
    window.addEventListener('online', processQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', processQueue);
    };
  }, [isServiceReady]);

  // Loading states
  if (!isServiceReady && !error) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-950 min-h-screen">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationSkeleton key={i} style={{}} />
          ))}
        </div>
      </div>
    );
  }

  if (!currentUserId && isServiceReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Bell className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Please log in to see your notifications</p>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          Retry
        </button>
      </div>
    );
  }

  // Main render
  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-950 min-h-screen">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleMarkAsRead(selectedIds)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark selected read ({selectedIds.size})
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        {loading && notifications.length === 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <NotificationSkeleton key={i} style={{}} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              When you get likes, comments, or new followers, they'll appear here.
            </p>
          </div>
        ) : (
          memoizedList
        )}
      </div>

      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      <div ref={ref} className="h-1" />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        preferences={preferences}
        onUpdate={handleUpdatePreferences}
        loading={prefsLoading}
      />
    </div>
  );
};

// Wrap with ErrorBoundary
const NotificationsScreenWithErrorBoundary = (props) => (
  <ErrorBoundary>
    <NotificationsScreen {...props} />
  </ErrorBoundary>
);

export default NotificationsScreenWithErrorBoundary;