// src/screens/NotificationsScreen.jsx

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { cn } from '../lib/utils';
import {
  Bell,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  Settings,
  Sparkles,
  X,
  Heart,
  MessageCircle,
  Gift,
  Users,
  AtSign,
  Eye,
  Radio,
  ChevronRight,
  ChevronDown,
  DollarSign,
  RefreshCw,
  Loader2,
  UserCheck,
} from "lucide-react";
import notificationsService from '../services/notificationsService';
import { getUserService } from '../services/userService.js';
import { socialGraphService } from '../services/socialGraphService.js';
import { pickDisplayName, resolveActorName } from '../services/profileReadModel';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import Button from '../design-system/Button.jsx';
import { Dialog } from '../components/UI/Dialog.jsx';
import { ListRowsSkeleton } from '../components/UI/SkeletonLoaders.jsx';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { LazyImage } from '../components/Shared/LazyImage';

const FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Messages', label: 'Messages', icon: MessageCircle },
  { id: 'Friends', label: 'Friends', icon: Users },
  { id: 'Mentions', label: 'Mentions', icon: AtSign },
  { id: 'Stories', label: 'Vibes', icon: Sparkles },
  { id: 'Coins', label: 'Coins', icon: DollarSign },
  { id: 'Live', label: 'Live', icon: Radio },
  { id: 'System', label: 'System', icon: Settings },
];

const NOTIFICATION_TYPE_ALIASES = {
  like: 'post_like',
  reply: 'story_reply',
  gift_received: 'coin_gift',
  coins_earned: 'coin_gift',
  coin_reward: 'coin_gift',
  live_started: 'live_stream',
};
const normalizeNotificationType = (type) => NOTIFICATION_TYPE_ALIASES[type] || type || 'system';

const SYSTEM_NOTIFICATION_TYPES = new Set([
  'system', 'system_alert', 'maintenance', 'policy_update', 'security_alert',
  'verification', 'new_feature', 'reminder', 'level_up', 'badge_earned',
  'milestone_reached', 'achievement_unlocked', 'trending',
]);

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme !== 'light';

  const [mainTab, setMainTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'network' ? 'network' : 'alerts';
  });

  const [networkTab, setNetworkTab] = useState('requests');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const [requests, setRequests] = useState([]);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [pendingFollowRequestAction, setPendingFollowRequestAction] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState(null);
  const [pendingNetworkAction, setPendingNetworkAction] = useState(null);

  const [activeFilter, setActiveFilter] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [networkActionState, setNetworkActionState] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState(null);
  const [streamNonce, setStreamNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [friendActions, setFriendActions] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    Now: true,
    Today: true,
    Yesterday: true,
    Earlier: false,
  });
  const [giftModal, setGiftModal] = useState(null);
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [requestingPush, setRequestingPush] = useState(false);
  const [dismissPushBanner, setDismissPushBanner] = useState(false);

  // Preload pending friend + follow request lists on mount so the "Network & Friends"
  // badge count is accurate before switching tabs.
  const loadPendingRequestsOnly = useCallback(async () => {
    if (!user?.uid) {
      setRequests([]);
      setFollowRequests([]);
      return;
    }
    try {
      const svc = getUserService();
      const [r, fr] = await Promise.allSettled([
        svc.getFriendRequests(user.uid, 'received'),
        typeof svc.getFollowRequests === 'function' ? svc.getFollowRequests(user.uid) : Promise.resolve({ requests: [] }),
      ]);
      if (r.status === 'fulfilled') {
        setRequests(Array.isArray(r.value) ? r.value : r.value?.requests || []);
        setRequestsLoaded(true);
      }
      if (fr.status === 'fulfilled') {
        setFollowRequests(fr.value?.requests || []);
      }
    } catch {
      // Non-fatal: full loadNetwork handles error surface on tab open.
    }
  }, [user?.uid]);

  useEffect(() => {
    loadPendingRequestsOnly();
    const onReqChange = (event) => {
      const detail = event?.detail;
      if (detail?.requestId && detail?.action) {
        setNotifications((prev) => {
          const matchedIds = prev
            .filter((n) => n.type === 'friend_request' && (n.requestId === detail.requestId || n.id === detail.requestId))
            .map((n) => n.id);
          if (matchedIds.length) {
            setFriendActions((fa) => {
              const next = { ...fa };
              matchedIds.forEach((id) => { next[id] = detail.action; });
              return next;
            });
          }
          return prev.map((n) => (
            n.requestId === detail.requestId || n.id === detail.requestId ? { ...n, unread: false } : n
          ));
        });
      }
      loadPendingRequestsOnly();
    };
    window.addEventListener('arvdoul:friend-request-changed', onReqChange);
    window.addEventListener('arvdoul:follow-request-changed', onReqChange);
    return () => {
      window.removeEventListener('arvdoul:friend-request-changed', onReqChange);
      window.removeEventListener('arvdoul:follow-request-changed', onReqChange);
    };
  }, [loadPendingRequestsOnly]);

  const loadNetwork = useCallback(async () => {
    setNetworkLoading(true);
    setNetworkError(null);
    try {
      if (!user?.uid) {
        setRecommended([]);
        setFollowers([]);
        setFollowing([]);
        setFollowStates({});
        setRequests([]);
        setFollowRequests([]);
        return;
      }

      const svc = getUserService();
      const [f, g, r, fr] = await Promise.allSettled([
        svc.getFollowers(user.uid, { limit: 50 }),
        svc.getFollowing(user.uid, { limit: 50 }),
        svc.getFriendRequests(user.uid, 'received'),
        svc.getFollowRequests(user.uid),
      ]);
      const recResult = await svc.getFriendRecommendations(user.uid, 6).catch(() => ({ success: false, recommendations: [] }));
      setRecommended(recResult.recommendations || []);
      const followerList = f.status === 'fulfilled' ? f.value.followers || [] : [];
      const followingList = g.status === 'fulfilled' ? g.value.following || [] : [];
      setFollowers(followerList);
      setFollowing(followingList);

      const stateIds = [...new Set(
        [...followerList, ...followingList].map((u) => u?.id || u?.uid).filter(Boolean)
      )];
      if (stateIds.length) {
        try {
          const states = await svc.getFollowStates(user.uid, stateIds);
          const asObject = {};
          states.forEach((v, k) => { asObject[k] = v; });
          setFollowStates(asObject);
        } catch (e) {
          console.warn('[Notifications] follow-state hydration failed', e?.message);
        }
      } else {
        setFollowStates({});
      }
      if (r.status === 'fulfilled') {
        setRequests(Array.isArray(r.value) ? r.value : r.value.requests || []);
        setRequestsLoaded(true);
      } else {
        setRequests([]);
      }

      const rawFollowRequests = fr.status === 'fulfilled' ? (fr.value?.requests || []) : [];
      setFollowRequests(rawFollowRequests);
      if (rawFollowRequests.length) {
        try {
          const profiles = await socialGraphService.hydrateProfiles(
            rawFollowRequests.map((item) => item.fromUserId),
            { viewerId: user.uid }
          );
          const byId = new Map(profiles.map((p) => [p.uid || p.id, p]));
          setFollowRequests(rawFollowRequests.map((item) => ({ ...item, fromUser: byId.get(item.fromUserId) || null })));
        } catch (err) {
          console.warn('[Notifications] follow-request profile hydration failed', err?.message);
        }
      }
    } catch (err) {
      setNetworkError(err?.message || 'Could not load your network.');
      setRecommended([]);
    } finally {
      setNetworkLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (mainTab === 'network') {
      loadNetwork();
    }
  }, [mainTab, loadNetwork]);

  useEffect(() => {
    if (networkTab === 'followRequests' && followRequests.length === 0) {
      setNetworkTab('requests');
    }
  }, [networkTab, followRequests.length]);

  const handleNetworkRequest = async (requestId, accept) => {
    if (!user?.uid || pendingNetworkAction) return;
    setPendingNetworkAction(requestId);
    try {
      const svc = getUserService();
      if (accept) {
        await svc.acceptFriendRequest(requestId, user.uid);
        toast.success('Friend request accepted');
      } else {
        await svc.declineFriendRequest(requestId, user.uid);
        toast.success('Friend request declined');
      }
      const actionLabel = accept ? 'accepted' : 'declined';
      setRequests((prev) => prev.filter((r) => (r.id || r.requestId) !== requestId));
      const matchedUnreadIds = [];
      setNotifications((prev) => {
        const matchedIds = [];
        const next = prev.map((n) => {
          const altRid = n.user?.id && user?.uid ? `${n.user.id}_${user.uid}` : null;
          if (n.requestId === requestId || n.id === requestId || altRid === requestId) {
            matchedIds.push(n.id);
            if (n.unread) matchedUnreadIds.push(n.id);
            return { ...n, unread: false };
          }
          return n;
        });
        if (matchedIds.length) {
          setFriendActions((fa) => {
            const updated = { ...fa };
            matchedIds.forEach((id) => { updated[id] = actionLabel; });
            return updated;
          });
        }
        return next;
      });
      matchedUnreadIds.forEach((nid) => {
        notificationsService.markNotificationAsRead(nid, user.uid).catch(() => {});
      });
      window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
        detail: { requestId, action: actionLabel },
      }));
      await loadNetwork();
    } catch (err) {
      const msg = err?.message || 'Could not update the friend request.';
      if (/already processed/i.test(msg)) {
        setRequests((prev) => prev.filter((r) => (r.id || r.requestId) !== requestId));
        toast.info('This friend request was already processed');
      } else {
        toast.error(msg);
      }
    } finally {
      setPendingNetworkAction(null);
    }
  };

  const handleFollowRequestAction = async (request, accept) => {
    if (!user?.uid || pendingFollowRequestAction) return;
    setPendingFollowRequestAction(request.id);
    try {
      const svc = getUserService();
      if (accept) {
        await svc.approveFollowRequest(request.id, user.uid);
        toast.success('Follow request accepted');
      } else {
        await svc.declineFollowRequest(request.id, user.uid);
        toast.info('Follow request declined');
      }
      setFollowRequests((prev) => prev.filter((r) => r.id !== request.id));
      window.dispatchEvent(new CustomEvent('arvdoul:follow-request-changed'));
    } catch (err) {
      toast.error(err?.message || 'Could not process the follow request.');
    } finally {
      setPendingFollowRequestAction(null);
    }
  };

  const handleConnectUser = async (targetUser) => {
    const targetId = targetUser.id || targetUser.uid;
    if (!targetId) return;
    if (!user?.uid) {
      navigate(`/profile/${targetId}`);
      return;
    }
    setNetworkActionState((prev) => ({ ...prev, [targetId]: 'loading' }));
    try {
      const svc = getUserService();
      await svc.sendFriendRequest(user.uid, targetId);
      setNetworkActionState((prev) => ({ ...prev, [targetId]: 'requested' }));
      toast.success(`Friend request sent to ${pickDisplayName([targetUser.displayName, targetUser.username], { fallback: 'this user' })}`);
    } catch {
      try {
        const svc = getUserService();
        const result = await svc.followUser(user.uid, targetId);
        if (result?.requested || result?.requestStatus === 'pending') {
          setNetworkActionState((prev) => ({ ...prev, [targetId]: 'requested' }));
          toast.success('Follow request sent');
        } else {
          setNetworkActionState((prev) => ({ ...prev, [targetId]: 'following' }));
          toast.success(`Now following ${pickDisplayName([targetUser.displayName, targetUser.username], { fallback: 'this user' })}`);
        }
      } catch {
        setNetworkActionState((prev) => ({ ...prev, [targetId]: 'idle' }));
        toast.error(`Could not connect with ${pickDisplayName([targetUser.displayName, targetUser.username], { fallback: 'this user' })}`);
      }
    }
  };

  const handleToggleFollow = async (targetUser, isCurrentlyFollowing) => {
    const targetId = targetUser.id || targetUser.uid;
    if (!targetId || !user?.uid) return;
    setNetworkActionState((prev) => ({ ...prev, [targetId]: 'loading' }));
    try {
      const svc = getUserService();
      if (isCurrentlyFollowing) {
        await svc.unfollowUser(user.uid, targetId);
        setFollowing((prev) => prev.filter((u) => (u.id || u.uid) !== targetId));
        setFollowStates((prev) => ({ ...prev, [targetId]: { isFollowing: false, requestStatus: null } }));
        toast.info(`Unfollowed ${pickDisplayName([targetUser.displayName, targetUser.username], { fallback: 'this user' })}`);
      } else {
        const result = await svc.followUser(user.uid, targetId);
        if (result?.requested || result?.requestStatus === 'pending') {
          setFollowStates((prev) => ({ ...prev, [targetId]: { isFollowing: false, requestStatus: 'pending' } }));
          toast.success('Follow request sent');
        } else {
          setFollowing((prev) => [...prev, targetUser]);
          setFollowStates((prev) => ({ ...prev, [targetId]: { isFollowing: true, requestStatus: null } }));
          toast.success(`Following ${pickDisplayName([targetUser.displayName, targetUser.username], { fallback: 'this user' })}`);
        }
      }
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setNetworkActionState((prev) => ({ ...prev, [targetId]: null }));
    }
  };

  const handleCancelFollowRequest = async (targetId) => {
    if (!targetId || !user?.uid) return;
    setNetworkActionState((prev) => ({ ...prev, [targetId]: 'loading' }));
    try {
      await getUserService().cancelFollowRequest(user.uid, targetId);
      setFollowStates((prev) => ({ ...prev, [targetId]: { isFollowing: false, requestStatus: null } }));
      toast.info('Follow request withdrawn');
    } catch {
      toast.error('Could not withdraw the request. Please try again.');
    } finally {
      setNetworkActionState((prev) => ({ ...prev, [targetId]: null }));
    }
  };

  const handleEnablePush = async () => {
    if (!user?.uid) {
      toast.error("Please sign in to enable push notifications");
      return;
    }
    setRequestingPush(true);
    try {
      const res = await notificationsService.requestPushPermission(user.uid);
      if (res?.success || Notification.permission === 'granted') {
        setPushStatus('granted');
        toast.success("Push notifications enabled");
      } else {
        setPushStatus(Notification.permission);
        toast.info("Push notification permission was not granted.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not enable push notifications: " + (err.message || "Unknown error"));
    } finally {
      setRequestingPush(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    let unsub;
    const formatNotification = (fn, idx) => {
      const createdAt = fn.createdAt?.toDate?.() || (fn.createdAt ? new Date(fn.createdAt) : null);
      const createdAtMs = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : 0;
      const ts = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleString()
        : (fn.timestamp ? String(fn.timestamp) : '');
      const type = normalizeNotificationType(fn.type);
      const category = type === 'message' || type === 'story_reply' ? 'Messages'
        : type?.includes('friend') ? 'Friends'
          : type === 'coin_gift' ? 'Coins'
            : type?.includes('story') ? 'Stories'
              : SYSTEM_NOTIFICATION_TYPES.has(type) ? 'System'
                : 'All';
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const timeGroup = !createdAtMs
        ? 'Earlier'
        : Date.now() - createdAtMs < 3600000
          ? 'Now'
          : createdAtMs >= startOfToday.getTime()
            ? 'Today'
            : createdAtMs >= startOfYesterday.getTime()
              ? 'Yesterday'
              : 'Earlier';
      return {
        id: fn.id || `fn-${idx}`,
        category,
        type,
        timeGroup,
        user: {
          id: fn.senderId || fn.metadata?.fromUserId || null,
          name: fn.senderName || fn.title || '',
          username: fn.senderUsername || '',
          avatar: getSafeAvatarUrl(fn.senderAvatar, fn.senderName, fn.senderId),
          verified: !!fn.senderVerified,
        },
        message: fn.body || fn.message || '',
        requestId:
          fn.metadata?.requestId ||
          ((fn.metadata?.fromUserId || fn.senderId) && user?.uid
            ? `${fn.metadata?.fromUserId || fn.senderId}_${user.uid}`
            : null),
        postId: fn.metadata?.postId || null,
        videoId: fn.metadata?.videoId || null,
        storyId: fn.metadata?.storyId || null,
        actionUrl: fn.actionUrl || fn.metadata?.actionUrl || null,
        conversationId: fn.metadata?.conversationId || null,
        amount: fn.metadata?.cost ?? fn.metadata?.amount ?? null,
        giftType: fn.metadata?.giftType || null,
        timestamp: ts,
        createdAtMs,
        unread: !fn.read,
      };
    };
    const mergeNotifications = (incoming) => {
      setNotifications((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]));
        for (const n of incoming) byId.set(n.id, { ...byId.get(n.id), ...n });
        return Array.from(byId.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      });
    };
    try {
      unsub = notificationsService.subscribeToUserNotifications(user.uid, (payload) => {
        if (payload?.type === 'error') {
          setNotificationsError(payload.error || 'Could not load notifications.');
          setNotificationsLoading(false);
          return;
        }
        const raw = Array.isArray(payload)
          ? payload
          : [...(payload?.added || []), ...(payload?.modified || [])];
        setNotificationsError(null);
        setNotificationsLoading(false);
        if (raw.length === 0) return;
        mergeNotifications(raw.map(formatNotification));
      });
    } catch (err) {
      console.warn('Notifications stream warning:', err);
      setNotificationsError(err?.message || 'Could not load notifications.');
      setNotificationsLoading(false);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.uid, streamNonce]);

  const [markingAllRead, setMarkingAllRead] = useState(false);
  const handleMarkAllRead = useCallback(async () => {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    if (user?.uid) {
      try {
        await notificationsService.markAllAsRead(user.uid);
        toast.success('All notifications marked as read');
      } catch (err) {
        console.warn(err);
        toast.error('Could not sync read state');
      } finally {
        setMarkingAllRead(false);
      }
    } else {
      setMarkingAllRead(false);
    }
  }, [markingAllRead, user?.uid]);

  const handleMarkRead = async (id) => {
    if (!user?.uid) return;
    let wasUnread = false;
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      wasUnread = n.unread;
      return { ...n, unread: false };
    }));
    if (!wasUnread) return;
    try {
      await notificationsService.markNotificationAsRead(id, user.uid);
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: true } : n)));
    }
  };

  const handleFriendRequest = async (notifId, action, targetUser, requestId) => {
    const fallbackSender = targetUser?.id || targetUser?.uid;
    const rid = requestId || (fallbackSender && user?.uid ? `${fallbackSender}_${user.uid}` : notifId);
    if (!user?.uid || friendActions[notifId]) return;
    setFriendActions((prev) => ({ ...prev, [notifId]: action }));
    try {
      const svc = getUserService();
      if (action === 'accepted') {
        await svc.acceptFriendRequest(rid, user.uid);
        toast.success(`You are now friends with ${targetUser?.name || 'this account'}`);
      } else {
        await svc.declineFriendRequest(rid, user.uid);
        toast.info(`Declined friend request from ${targetUser?.name || 'this account'}`);
      }
      setRequests((prev) => prev.filter((r) => (r.id || r.requestId) !== rid));
      window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
        detail: { requestId: rid, action },
      }));
      handleMarkRead(notifId);
    } catch (err) {
      const msg = err?.message || 'Could not update the friend request.';
      if (/already processed/i.test(msg)) {
        setRequests((prev) => prev.filter((r) => (r.id || r.requestId) !== rid));
        handleMarkRead(notifId);
        toast.info('This friend request was already processed');
      } else {
        setFriendActions((prev) => {
          const next = { ...prev };
          delete next[notifId];
          return next;
        });
        toast.error(msg);
      }
    }
  };

  const handleThankCreator = (notif) => {
    const recipientId = notif?.user?.id || notif?.user?.uid;
    if (!recipientId) {
      toast.error('Could not open a message for this creator.');
      return;
    }
    handleMarkRead(notif.id);
    navigate(`/messages/new?to=${recipientId}`);
  };

  const handleNotificationClick = (notif) => {
    if (!notif) return;
    handleMarkRead(notif.id);
    if (notif.type === 'message' || notif.type === 'group_message' || notif.type === 'story_reply') {
      navigate(notif.conversationId ? `/messages/${notif.conversationId}` : '/messages');
      return;
    }
    if (notif.actionUrl && (String(notif.actionUrl).startsWith('/sparks/') || String(notif.actionUrl).startsWith('/video/'))) {
      navigate(notif.actionUrl);
      return;
    }
    if (notif.videoId || notif.type?.includes('video') || notif.type?.includes('spark')) {
      navigate(`/sparks/${notif.postId || notif.videoId || notif.id}`);
      return;
    }
    if (notif.postId) {
      navigate(`/post/${notif.postId}`);
      return;
    }
    if (notif.type?.includes('story')) {
      navigate('/stories', notif.user?.id ? { state: { vibeUserId: notif.user.id } } : undefined);
      return;
    }
    if (notif.type === 'level_up' || notif.type === 'milestone_reached') {
      navigate(notif.actionUrl || '/progress');
      return;
    }
    if (notif.type === 'achievement_unlocked') {
      navigate(notif.actionUrl || '/achievements');
      return;
    }
    if (notif.type === 'badge_earned') {
      navigate(notif.actionUrl || '/titles');
      return;
    }
    if (notif.type === 'follow' || notif.type === 'follow_request' || notif.type === 'friend_request' || notif.type === 'friend_accepted' || notif.type === 'follow_accepted') {
      if (notif.user?.id) navigate(`/profile/${notif.user.id}`);
      return;
    }
    if (notif.type?.includes('coin') || notif.type?.includes('gift') || notif.type?.includes('withdraw') || notif.type?.includes('payment') || notif.type?.includes('subscription')) {
      navigate('/coins');
      return;
    }
    if (notif.actionUrl && String(notif.actionUrl).startsWith('/')) {
      navigate(notif.actionUrl);
    }
  };

  const pendingRequestIds = useMemo(
    () => new Set((requests || []).map((r) => r.id || r.requestId).filter(Boolean)),
    [requests]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (unreadOnly && !notif.unread) return false;
      if (activeFilter !== 'All') {
        if (activeFilter === 'Messages' && notif.category !== 'Messages' && notif.type !== 'story_reply') return false;
        if (activeFilter === 'Friends' && notif.category !== 'Friends' && notif.type !== 'friend_request') return false;
        if (activeFilter === 'Mentions' && notif.category !== 'Mentions' && notif.type !== 'mention') return false;
        if (activeFilter === 'Stories' && notif.category !== 'Stories' && !notif.type?.includes('story')) return false;
        if (activeFilter === 'Coins' && notif.category !== 'Coins' && !notif.type?.includes('coin')) return false;
        if (activeFilter === 'Live' && notif.category !== 'Live' && notif.type !== 'live_stream') return false;
        if (activeFilter === 'System' && notif.category !== 'System') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = notif.user?.name?.toLowerCase().includes(q);
        const matchesMsg = notif.message?.toLowerCase().includes(q);
        if (!matchesName && !matchesMsg) return false;
      }
      return true;
    });
  }, [notifications, activeFilter, unreadOnly, searchQuery]);

  const groupedNotifications = useMemo(() => {
    const groups = { Now: [], Today: [], Yesterday: [], Earlier: [] };
    filteredNotifications.forEach((n) => {
      const g = groups[n.timeGroup] ? n.timeGroup : 'Earlier';
      groups[g].push(n);
    });
    return groups;
  }, [filteredNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.unread).length;
  }, [notifications]);

  const totalPendingNetworkCount = requests.length + followRequests.length;

  const markAllReadRef = useRef(handleMarkAllRead);
  useEffect(() => {
    markAllReadRef.current = handleMarkAllRead;
  }, [handleMarkAllRead]);

  // Coordinate live counts, filter toggles, search, and mark-all-read with TopAppBar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('arvdoul:notifications_header_state', {
      detail: {
        unreadCount,
        pendingNetworkCount: totalPendingNetworkCount,
        mainTab,
        filterActive: showFilterDropdown || unreadOnly,
      },
    }));
  }, [unreadCount, totalPendingNetworkCount, mainTab, showFilterDropdown, unreadOnly]);

  useEffect(() => {
    const onSearchQuery = (e) => {
      setSearchQuery(typeof e?.detail === 'string' ? e.detail : '');
    };
    const onToggleFilter = () => {
      setShowFilterDropdown((v) => !v);
    };
    const onMarkAllRead = () => {
      markAllReadRef.current?.();
    };
    window.addEventListener('arvdoul:notifications_search_query', onSearchQuery);
    window.addEventListener('arvdoul:notifications_toggle_filter', onToggleFilter);
    window.addEventListener('arvdoul:notifications_mark_all_read', onMarkAllRead);
    return () => {
      window.removeEventListener('arvdoul:notifications_search_query', onSearchQuery);
      window.removeEventListener('arvdoul:notifications_toggle_filter', onToggleFilter);
      window.removeEventListener('arvdoul:notifications_mark_all_read', onMarkAllRead);
      window.dispatchEvent(new CustomEvent('arvdoul:notifications_header_state', { detail: null }));
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRequests = useMemo(() => {
    if (!normalizedQuery) return requests;
    return requests.filter((req) => {
      const u = req.sender || req.user || req;
      const hay = `${u.displayName || ''} ${u.username || ''} ${u.name || ''} ${u.bio || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [requests, normalizedQuery]);
  const filteredFollowRequests = useMemo(() => {
    if (!normalizedQuery) return followRequests;
    return followRequests.filter((req) => {
      const u = req.fromUser || req.sender || {};
      const hay = `${u.displayName || ''} ${u.username || ''} ${u.name || ''} ${u.bio || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [followRequests, normalizedQuery]);
  const filteredFollowers = useMemo(() => {
    if (!normalizedQuery) return followers;
    return followers.filter((u) => {
      const hay = `${u.displayName || ''} ${u.username || ''} ${u.bio || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [followers, normalizedQuery]);
  const filteredFollowing = useMemo(() => {
    if (!normalizedQuery) return following;
    return following.filter((u) => {
      const hay = `${u.displayName || ''} ${u.username || ''} ${u.bio || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [following, normalizedQuery]);
  const filteredRecommended = useMemo(() => {
    if (!normalizedQuery) return recommended;
    return recommended.filter((u) => {
      const hay = `${u.displayName || ''} ${u.username || ''} ${u.bio || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [recommended, normalizedQuery]);

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-slate-900"
    )}>
      {/* Navigation & Filter Bar (standalone header omitted when TopAppBar is active) */}
      <div className={cn(
        "border-b transition-colors",
        !hasTopAppBar && "sticky top-0 z-30 backdrop-blur-xl px-4 pt-3",
        hasTopAppBar && "px-3 sm:px-4 pt-2",
        isDark
          ? hasTopAppBar ? "bg-transparent border-white/[0.08]" : "bg-[#03071B]/90 border-white/[0.08]"
          : hasTopAppBar ? "bg-transparent border-slate-200/80" : "bg-[#F6F8FC]/90 border-slate-200"
      )}>
        <div className="max-w-2xl mx-auto">
          {!hasTopAppBar && (
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={cn("font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Activity &amp; Updates
                </span>
                {unreadCount > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className={cn("font-semibold tabular-nums", isDark ? "text-purple-400" : "text-purple-700")}>
                      {unreadCount} unread
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSearch((v) => !v)}
                  aria-label="Search notifications"
                  className={cn(
                    "min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                    showSearch
                      ? isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-50 text-purple-700"
                      : isDark ? "bg-white/[0.05] hover:bg-white/10 text-slate-300" : "bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowFilterDropdown((v) => !v)}
                  aria-label="Filter notifications"
                  className={cn(
                    "min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                    showFilterDropdown || unreadOnly
                      ? isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-50 text-purple-700"
                      : isDark ? "bg-white/[0.05] hover:bg-white/10 text-slate-300" : "bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                  className={cn(
                    "min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer",
                    isDark ? "bg-white/[0.05] hover:bg-white/10 text-slate-300" : "bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  aria-label="Notification settings"
                  className={cn(
                    "min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                    isDark ? "bg-white/[0.05] hover:bg-white/10 text-slate-300" : "bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Filter Dropdown Bar (Unread toggle + Quick reset) */}
          <AnimatePresence>
            {showFilterDropdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden pb-2.5"
              >
                <div className={cn(
                  "p-2 rounded-2xl border flex items-center justify-between gap-2 text-xs",
                  isDark ? "bg-[#03071B]/90 backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUnreadOnly(false)}
                      className={cn(
                        "min-h-[40px] px-3.5 rounded-xl font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                        !unreadOnly
                          ? isDark ? "bg-purple-500/20 text-purple-200" : "bg-purple-50 text-purple-700"
                          : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      All alerts
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnreadOnly(true)}
                      className={cn(
                        "min-h-[40px] px-3.5 rounded-xl font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                        unreadOnly
                          ? isDark ? "bg-purple-500/20 text-purple-200" : "bg-purple-50 text-purple-700"
                          : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Unread only
                    </button>
                  </div>
                  {(unreadOnly || activeFilter !== 'All' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnreadOnly(false);
                        setActiveFilter('All');
                        setSearchQuery('');
                      }}
                      className={cn(
                        "min-h-[40px] px-3 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer hover:underline",
                        isDark ? "text-slate-300" : "text-slate-700"
                      )}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Segmented iOS Main Tab Switcher: Alerts vs Network */}
          <div
            role="tablist"
            aria-label="Notification sections"
            className={cn(
              "p-1 rounded-2xl border flex items-center gap-1",
              isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-slate-200/60 border-slate-200/80"
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'alerts'}
              onClick={() => setMainTab('alerts')}
              className={cn(
                "relative flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer",
                mainTab === 'alerts'
                  ? isDark
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] border border-white/[0.12]"
                    : "bg-white text-slate-950 shadow-sm border border-slate-200/60"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Bell className={cn("w-4 h-4 shrink-0", mainTab === 'alerts' && "text-arvdoul-purple")} />
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums",
                  mainTab === 'alerts'
                    ? isDark ? "bg-purple-500/20 text-purple-200" : "bg-purple-50 text-purple-700"
                    : isDark ? "text-slate-500" : "text-slate-500"
                )}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'network'}
              onClick={() => setMainTab('network')}
              className={cn(
                "relative flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer",
                mainTab === 'network'
                  ? isDark
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] border border-white/[0.12]"
                    : "bg-white text-slate-950 shadow-sm border border-slate-200/60"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Users className={cn("w-4 h-4 shrink-0", mainTab === 'network' && "text-arvdoul-purple")} />
              <span>Network &amp; Friends</span>
              {totalPendingNetworkCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums",
                  isDark ? "bg-purple-500/25 text-purple-200" : "bg-purple-100 text-purple-700"
                )}>
                  {totalPendingNetworkCount}
                </span>
              )}
            </button>
          </div>

          {/* Standalone Collapsible Search Input (only when TopAppBar is absent) */}
          {!hasTopAppBar && (
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pt-3 overflow-hidden"
                >
                  <div className={cn(
                    "flex items-center gap-2 px-3.5 min-h-[44px] rounded-xl border",
                    isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08]" : "bg-white border-slate-200"
                  )}>
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      aria-label="Search in notifications..."
                      type="text"
                      placeholder="Search in notifications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm w-full outline-none py-2"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Active TopAppBar search indicator */}
          {hasTopAppBar && searchQuery.trim() && (
            <div className="pt-2.5 flex items-center justify-between text-xs">
              <span className={cn("truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                Filtering by <span className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>&ldquo;{searchQuery.trim()}&rdquo;</span>
              </span>
            </div>
          )}

          {/* Sub-Filters / Sub-Tabs */}
          {mainTab === 'alerts' ? (
            <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {FILTERS.map((f) => {
                const isActive = activeFilter === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => {
                      if (f.id === 'Friends') {
                        setMainTab('network');
                        setNetworkTab('requests');
                      } else {
                        setActiveFilter(f.id);
                      }
                    }}
                    className={cn(
                      "min-h-[44px] sm:min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer border",
                      isActive
                        ? isDark
                          ? "bg-purple-500/15 text-purple-200 border-purple-400/30"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                        : isDark
                          ? "bg-transparent text-slate-400 border-transparent hover:bg-white/[0.05] hover:text-white"
                          : "bg-transparent text-slate-600 border-transparent hover:bg-slate-200/60 hover:text-slate-900"
                    )}
                  >
                    {f.icon && <f.icon className="w-3.5 h-3.5 shrink-0" />}
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'requests', label: 'Requests', count: filteredRequests.length },
                ...(filteredFollowRequests.length > 0
                  ? [{ id: 'followRequests', label: 'Follow Requests', count: filteredFollowRequests.length }]
                  : []),
                { id: 'followers', label: 'Followers', count: filteredFollowers.length },
                { id: 'following', label: 'Following', count: filteredFollowing.length },
                { id: 'recommended', label: 'Suggested', count: filteredRecommended.length },
              ].map((nt) => {
                const isActive = networkTab === nt.id;
                return (
                  <button
                    type="button"
                    key={nt.id}
                    onClick={() => setNetworkTab(nt.id)}
                    className={cn(
                      "min-h-[44px] sm:min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer border",
                      isActive
                        ? isDark
                          ? "bg-purple-500/15 text-purple-200 border-purple-400/30"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                        : isDark
                          ? "bg-transparent text-slate-400 border-transparent hover:bg-white/[0.05] hover:text-white"
                          : "bg-transparent text-slate-600 border-transparent hover:bg-slate-200/60 hover:text-slate-900"
                    )}
                  >
                    <span>{nt.label}</span>
                    {nt.count > 0 && (
                      <span className={cn(
                        "text-[11px] font-bold tabular-nums",
                        isActive
                          ? isDark ? "text-purple-200" : "text-purple-700"
                          : isDark ? "text-slate-500" : "text-slate-400"
                      )}>
                        {nt.count}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={loadNetwork}
                disabled={networkLoading}
                title="Refresh network"
                aria-label="Refresh network"
                className={cn(
                  "min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl flex items-center justify-center transition-colors ml-auto shrink-0 cursor-pointer",
                  isDark ? "text-slate-400 hover:text-white bg-white/[0.04]" : "text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", networkLoading && "animate-spin")} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {mainTab === 'network' ? (
          <div className="space-y-4">
            {networkLoading ? (
              <ListRowsSkeleton count={6} />
            ) : networkError ? (
              <ErrorState
                title="Could not load your network"
                message={networkError}
                onRetry={loadNetwork}
              />
            ) : networkTab === 'requests' ? (
              filteredRequests.length === 0 ? (
                <EmptyState
                  title={normalizedQuery ? 'No Matching Requests' : 'No Pending Friend Requests'}
                  description={normalizedQuery ? `No friend request matched "${searchQuery}".` : "When someone sends you a friend request, you'll see them here."}
                  icon={<Users className="w-8 h-8" />}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((req) => {
                    const rawReqUser = req.peerProfile || req.sender || req.user || req;
                    const reqId = req.id || req.requestId;
                    const peerUid = req.fromUserId || rawReqUser.id || rawReqUser.uid;
                    const reqUser = {
                      ...rawReqUser,
                      id: rawReqUser.id || rawReqUser.uid || req.fromUserId,
                      displayName: rawReqUser.displayName || req.fromUserDisplayName,
                      username: rawReqUser.username || req.fromUserUsername,
                      name: rawReqUser.name || req.senderName,
                    };
                    const reqName = resolveActorName([reqUser.displayName, reqUser.username, reqUser.name], reqUser.id || reqUser.uid || reqId);
                    const reqAvatar = reqUser.photoURL || reqUser.avatar || req.fromUserPhotoURL || req.senderAvatar || null;
                    const reqHandle = reqUser.username || req.fromUserUsername || null;
                    return (
                      <div
                        key={reqId}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors",
                          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/80"
                        )}
                      >
                        <div
                          onClick={() => peerUid && navigate(`/profile/${peerUid}`)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          {reqAvatar ? (
                            <LazyImage
                              src={reqAvatar}
                              alt={reqName}
                              className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                              style={{ background: BRAND_GRADIENT }}
                            >
                              {reqName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{reqName}</p>
                            <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                              {reqHandle ? `@${reqHandle}` : (reqUser.bio || 'Wants to connect with you')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleNetworkRequest(reqId, true)}
                            disabled={pendingNetworkAction === reqId}
                            className="min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNetworkRequest(reqId, false)}
                            disabled={pendingNetworkAction === reqId}
                            className={cn(
                              "min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60",
                              isDark ? "border-white/15 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"
                            )}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : networkTab === 'followRequests' ? (
              filteredFollowRequests.length === 0 ? (
                <EmptyState
                  title={normalizedQuery ? 'No Matching Follow Requests' : 'No Follow Requests'}
                  description={normalizedQuery ? `No follow request matched "${searchQuery}".` : 'Private-account follow requests will appear here for you to approve.'}
                  icon={<UserCheck className="w-8 h-8" />}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredFollowRequests.map((req) => {
                    const reqUser = req.fromUser || req.sender || {};
                    const reqName = resolveActorName([reqUser.displayName, reqUser.username, reqUser.name], reqUser.id || reqUser.uid || req.id);
                    const reqAvatar = reqUser.photoURL || reqUser.avatar || null;
                    const busy = pendingFollowRequestAction === req.id;
                    return (
                      <div
                        key={req.id}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors",
                          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/80"
                        )}
                      >
                        <div
                          onClick={() => navigate(`/profile/${req.fromUserId || reqUser.id || reqUser.uid}`)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          {reqAvatar ? (
                            <LazyImage
                              src={reqAvatar}
                              alt={reqName}
                              className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                              style={{ background: BRAND_GRADIENT }}
                            >
                              {reqName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{reqName}</p>
                            <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                              {reqUser.bio || 'Requested to follow you'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleFollowRequestAction(req, true)}
                            disabled={busy}
                            className="min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFollowRequestAction(req, false)}
                            disabled={busy}
                            className={cn(
                              "min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60",
                              isDark ? "border-white/15 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"
                            )}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : networkTab === 'followers' ? (
              filteredFollowers.length === 0 ? (
                <EmptyState
                  title={normalizedQuery ? 'No Matching Followers' : 'No Followers Yet'}
                  description={normalizedQuery ? `No follower matched "${searchQuery}".` : 'Share great stories and posts to grow your audience on Arvdoul.'}
                  icon={<Users className="w-8 h-8" />}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredFollowers.map((fUser) => {
                    const fName = resolveActorName([fUser.displayName, fUser.username], fUser.id || fUser.uid);
                    const fId = fUser.id || fUser.uid;
                    const state = followStates[fId] || { isFollowing: false, requestStatus: null };
                    const rowStatus = networkActionState[fId];
                    const isRequested = state.requestStatus === 'pending';
                    return (
                      <div
                        key={fId}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between gap-3",
                          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/80"
                        )}
                      >
                        <div
                          onClick={() => navigate(`/profile/${fId}`)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          {fUser.photoURL ? (
                            <LazyImage
                              src={fUser.photoURL}
                              alt={fName}
                              className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                              style={{ background: BRAND_GRADIENT }}
                            >
                              {fName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{fName}</p>
                            {fUser.bio && (
                              <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>{fUser.bio}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRequested) {
                                handleCancelFollowRequest(fId);
                              } else {
                                handleToggleFollow(fUser, state.isFollowing);
                              }
                            }}
                            disabled={rowStatus === 'loading'}
                            className={cn(
                              "min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer",
                              state.isFollowing
                                ? isDark
                                  ? "bg-white/10 text-slate-200 hover:bg-white/15"
                                  : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                                : isRequested
                                  ? isDark
                                    ? "bg-white/10 text-slate-300 border border-white/15"
                                    : "bg-slate-100 text-slate-700 border border-slate-300"
                                  : "text-white"
                            )}
                            style={!state.isFollowing && !isRequested ? { background: BRAND_GRADIENT } : undefined}
                          >
                            {rowStatus === 'loading' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isRequested ? (
                              'Requested'
                            ) : state.isFollowing ? (
                              'Following'
                            ) : (
                              'Follow Back'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : networkTab === 'following' ? (
              filteredFollowing.length === 0 ? (
                <EmptyState
                  title={normalizedQuery ? 'No Matching Accounts' : 'Not Following Anyone Yet'}
                  description={normalizedQuery ? `No followed account matched "${searchQuery}".` : 'Follow creators and friends to see their latest sparks and posts.'}
                  icon={<Users className="w-8 h-8" />}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredFollowing.map((gUser) => {
                    const gId = gUser.id || gUser.uid;
                    const gName = resolveActorName([gUser.displayName, gUser.username], gId);
                    return (
                      <div
                        key={gId}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between gap-3",
                          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/80"
                        )}
                      >
                        <div
                          onClick={() => navigate(`/profile/${gId}`)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          {gUser.photoURL ? (
                            <LazyImage
                              src={gUser.photoURL}
                              alt={gName}
                              className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                              style={{ background: BRAND_GRADIENT }}
                            >
                              {gName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{gName}</p>
                            {gUser.bio && (
                              <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>{gUser.bio}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(gUser, true);
                            }}
                            disabled={networkActionState[gId] === 'loading'}
                            className={cn(
                              "min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer border",
                              isDark
                                ? "bg-white/[0.06] border-white/10 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 text-slate-200"
                                : "bg-slate-100 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700"
                            )}
                          >
                            {networkActionState[gId] === 'loading' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Following'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : filteredRecommended.length === 0 ? (
              <EmptyState
                title={normalizedQuery ? 'No Matching Suggestions' : 'No Recommendations Available'}
                description={normalizedQuery ? `No suggested person matched "${searchQuery}".` : 'Check back later for suggested creators and friends.'}
                icon={<Sparkles className="w-8 h-8" />}
              />
            ) : (
              <div className="space-y-2.5">
                {filteredRecommended.map((rUser) => {
                  const rId = rUser.id || rUser.uid;
                  const rName = resolveActorName([rUser.displayName, rUser.username], rId);
                  const actionStatus = networkActionState[rId];
                  return (
                    <div
                      key={rId}
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-center justify-between gap-3",
                        isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/80"
                      )}
                    >
                      <div
                        onClick={() => navigate(`/profile/${rId}`)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        {rUser.photoURL ? (
                          <LazyImage
                            src={rUser.photoURL}
                            alt={rName}
                            className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {rName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{rName}</p>
                          <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                            {rUser.bio || 'Suggested creator'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actionStatus === 'requested' || actionStatus === 'connected' || actionStatus === 'following') {
                            navigate(`/profile/${rId}`);
                          } else {
                            handleConnectUser(rUser);
                          }
                        }}
                        disabled={actionStatus === 'loading'}
                        className={cn(
                          "min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer",
                          actionStatus === 'requested' || actionStatus === 'connected' || actionStatus === 'following'
                            ? isDark
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "text-white"
                        )}
                        style={
                          actionStatus === 'requested' || actionStatus === 'connected' || actionStatus === 'following'
                            ? undefined
                            : { background: BRAND_GRADIENT }
                        }
                      >
                        {actionStatus === 'loading' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : actionStatus === 'requested' ? (
                          'Requested'
                        ) : actionStatus === 'following' ? (
                          'Following'
                        ) : actionStatus === 'connected' ? (
                          'Connected'
                        ) : (
                          'Connect'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Push Notification Opt-In Banner */}
            {pushStatus === 'default' && !dismissPushBanner && (
              <div className={cn(
                "p-4 rounded-2xl border flex items-center justify-between gap-3",
                isDark ? "bg-white/[0.03] backdrop-blur-2xl border-purple-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-purple-200"
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    isDark ? "bg-purple-500/15 text-purple-400" : "bg-purple-50 text-purple-700"
                  )}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={cn("text-xs sm:text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                      Enable Push Alerts
                    </h3>
                    <p className={cn("text-xs line-clamp-1", isDark ? "text-slate-400" : "text-slate-600")}>
                      Get instant alerts for messages, coin gifts, and live broadcasts.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={requestingPush}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {requestingPush ? 'Enabling…' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissPushBanner(true)}
                    className={cn(
                      "min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center cursor-pointer",
                      isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                    )}
                    title="Dismiss"
                    aria-label="Dismiss push notification banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Timeline Groupings: Now, Today, Yesterday, Earlier */}
            {['Now', 'Today', 'Yesterday', 'Earlier'].map((groupKey) => {
              const items = groupedNotifications[groupKey] || [];
              if (items.length === 0) return null;
              const isExpanded = expandedSections[groupKey];

              return (
                <section key={groupKey} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedSections((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                    className={cn(
                      "w-full min-h-[36px] flex items-center justify-between px-1 py-1 text-xs font-semibold uppercase tracking-wider cursor-pointer",
                      isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>{groupKey}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2"
                      >
                        {items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={cn(
                              "relative group rounded-2xl p-3.5 transition-colors border flex items-center justify-between gap-3 cursor-pointer",
                              item.unread
                                ? isDark
                                  ? "bg-white/[0.045] backdrop-blur-2xl border-purple-500/30 hover:border-purple-400/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                                  : "bg-white border-purple-200"
                                : isDark
                                  ? "bg-white/[0.02] backdrop-blur-2xl border-white/[0.08] hover:border-white/15"
                                  : "bg-white/80 border-slate-200/80 hover:border-slate-300"
                            )}
                          >
                            {/* Avatar with type emblem */}
                            <div className="relative shrink-0">
                              <LazyImage
                                src={item.user.avatar}
                                alt={item.user.name}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-xl object-cover border border-white/10"
                              />
                              {item.type === 'friend_request' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <Users className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {item.type === 'coin_gift' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <DollarSign className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {item.type === 'story_reply' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <MessageCircle className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {item.type === 'post_like' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <Heart className="w-2.5 h-2.5 fill-current" />
                                </div>
                              )}
                              {item.type === 'mention' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <AtSign className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {item.type === 'story_view' && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <Eye className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {(item.type === 'level_up' || item.type === 'achievement_unlocked' || item.type === 'badge_earned') && (
                                <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-arvdoul-gradient text-white flex items-center justify-center ring-2", isDark ? "ring-[#03071B]" : "ring-white")}>
                                  <Sparkles className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>

                            {/* Center Details */}
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("font-semibold text-xs sm:text-sm truncate", isDark ? "text-white" : "text-slate-900")}>
                                  {item.user.name}
                                </span>
                                {item.user.verified && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                )}
                              </div>

                              <p className={cn("text-xs mt-0.5", isDark ? "text-slate-300" : "text-slate-600")}>
                                {item.message}
                              </p>

                              <span className={cn("text-[11px] mt-1 block", isDark ? "text-slate-500" : "text-slate-400")}>
                                {item.timestamp}
                              </span>
                            </div>

                            {/* Right Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.type === 'friend_request' && (
                                <div className="flex items-center gap-1.5">
                                  {friendActions[item.id] === 'accepted' ? (
                                    <span className={cn("px-2.5 py-1.5 rounded-xl text-xs font-semibold", isDark ? "text-emerald-400 bg-emerald-500/15" : "text-emerald-700 bg-emerald-50")}>
                                      Friends
                                    </span>
                                  ) : friendActions[item.id] === 'declined' ? (
                                    <span className={cn("px-2.5 py-1.5 rounded-xl text-xs font-semibold", isDark ? "text-slate-400 bg-white/5" : "text-slate-600 bg-slate-100")}>
                                      Declined
                                    </span>
                                  ) : (requestsLoaded && item.requestId && !pendingRequestIds.has(item.requestId)) ? (
                                    <span className={cn("px-2.5 py-1.5 rounded-xl text-xs font-semibold", isDark ? "text-slate-400 bg-white/5" : "text-slate-600 bg-slate-100")}>
                                      Processed
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFriendRequest(item.id, 'accepted', item.user, item.requestId);
                                        }}
                                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                                        style={{ background: BRAND_GRADIENT }}
                                      >
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFriendRequest(item.id, 'declined', item.user, item.requestId);
                                        }}
                                        className={cn(
                                          "min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                                          isDark ? "border-white/15 hover:bg-white/10 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"
                                        )}
                                      >
                                        Decline
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              {item.type === 'mention' && item.commentQuote && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/messages');
                                  }}
                                  className={cn(
                                    "min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1 max-w-[150px] truncate transition-colors cursor-pointer",
                                    isDark ? "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-700"
                                  )}
                                >
                                  <span className="truncate">{item.commentQuote}</span>
                                  <ChevronRight className="w-3 h-3 shrink-0" />
                                </button>
                              )}

                              {item.thumbnail && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.type === 'coin_gift') setGiftModal(item);
                                    else if (item.type?.includes('story')) {
                                      navigate('/stories', item.user?.id ? { state: { vibeUserId: item.user.id } } : undefined);
                                    } else if (item.actionUrl && String(item.actionUrl).startsWith('/sparks/')) {
                                      navigate(item.actionUrl);
                                    } else if (item.videoId || item.type?.includes('video') || item.type?.includes('spark')) {
                                      navigate(`/sparks/${item.postId || item.videoId}`);
                                    } else if (item.postId) {
                                      navigate(`/post/${item.postId}`);
                                    } else {
                                      navigate('/sparks');
                                    }
                                  }}
                                  className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/10 cursor-pointer shrink-0 relative group/thumb"
                                >
                                  <LazyImage
                                    src={item.thumbnail}
                                    alt="preview"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                  />
                                  {item.type === 'coin_gift' && (
                                    <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
                                      <Gift className="w-5 h-5 text-amber-300" />
                                    </div>
                                  )}
                                </div>
                              )}

                              {item.unread && (
                                <span
                                  aria-label="Unread notification"
                                  className="w-2 h-2 rounded-full bg-purple-500 shrink-0"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}

            {!notificationsLoading && notificationsError && (
              <ErrorState
                title="Could not load notifications"
                message={notificationsError}
                onRetry={() => {
                  setNotificationsError(null);
                  setNotificationsLoading(true);
                  setStreamNonce((n) => n + 1);
                }}
              />
            )}

            {notificationsLoading && <ListRowsSkeleton count={7} />}

            {!notificationsLoading && !notificationsError && filteredNotifications.length === 0 && (
              <EmptyState
                title="No notifications found"
                description={`There are no notifications under the ${activeFilter} filter at this moment.`}
                icon={<Bell className="w-7 h-7" />}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setActiveFilter('All');
                      setUnreadOnly(false);
                      setSearchQuery('');
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            )}
          </>
        )}
      </main>

      {/* Gift Detail Dialog */}
      <Dialog
        isOpen={Boolean(giftModal)}
        onClose={() => setGiftModal(null)}
        title="Creator Coin Gift!"
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/25">
            <Gift className="w-8 h-8" aria-hidden="true" />
          </div>
          <p className={cn("text-xs mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
            {giftModal?.user?.name || 'A creator'}
            {Number.isFinite(giftModal?.amount)
              ? ` gifted you ${giftModal.amount} ARVDOUL Coins.`
              : ' sent you a Creator Coin Gift.'}
          </p>

          {Number.isFinite(giftModal?.amount) && (
            <div className="my-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center gap-3">
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                +{giftModal.amount}
              </span>
              <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-600")}>
                Coins
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGiftModal(null)}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                handleThankCreator(giftModal);
                setGiftModal(null);
              }}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
            >
              Send Thank You
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
