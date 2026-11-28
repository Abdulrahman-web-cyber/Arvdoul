// src/screens/MessagingScreen.jsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { cn } from '../lib/utils';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { pickDisplayName } from '../services/profileReadModel.js';
import { getLevelInfo, getRankTitle } from '../shared/levelConfig.cjs';
import ErrorState from '../design-system/ErrorState.jsx';
import {
  Search,
  Plus,
  Pin,
  Bell,
  BellOff,
  CheckCircle2,
  Users,
  User,
  Radio,
  Archive,
  ArchiveRestore,
  Inbox,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Settings,
  X,
  Image as ImageIcon,
  Video,
  Music,
  Mic,
  Paperclip,
  Loader2,
  EyeOff,
  Gift,
  Sparkles,
  UserPlus,
  Check,
  CheckCheck,
  Ban,
  Link2,
} from 'lucide-react';
import { LazyImage } from '../components/Shared/LazyImage';
import { listDraftConversationMap } from '../config/messagingContracts.js';

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: Mail },
  { id: 'requests', label: 'Requests', icon: UserPlus },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'archived', label: 'Archived', icon: Archive },
];

const ATTACHMENT_LABEL = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  voice: 'Voice note',
  view_once: 'View-once',
  file: 'Attachment',
  gif: 'GIF',
  location: 'Location',
  contact: 'Contact',
  poll: 'Poll',
  link: 'Link',
  shared_content: 'Shared',
  vibe: 'Vibe',
  vibe_reply: 'Vibe reply',
  vibe_share: 'Shared Vibe',
};

function mapServiceConversation(c, uid) {
  const isAd = Boolean(c.isAd || c.type === 'ad');
  if (isAd) {
    const adAuthor = c.participantDetails?.[0];
    return {
      id: c.id,
      isAd: true,
      name: c.name || adAuthor?.displayName || 'Sponsored',
      type: 'ad',
      avatar: c.photoURL || adAuthor?.photoURL || '/assets/sponsored-default.png',
      verified: false,
      preview: typeof c.lastMessage?.text === 'string' ? c.lastMessage.text : '',
      attachmentType: null,
      time: '',
      unread: Number(c.unreadCount) || 0,
      muted: false,
      pinned: false,
      category: 'personal',
      activeDot: false,
      participantCount: 0,
    };
  }

  const other = (c.participantDetails || []).find((p) => p.id !== uid);
  const lastMsg = c.lastMessage || {};
  const isGroup = c.type === 'group';
  const isChannel = c.type === 'channel';
  const otherName =
    c.title ||
    c.name ||
    other?.displayName ||
    (isGroup
      ? 'Group chat'
      : isChannel
        ? 'Channel'
        : other?.id
          ? `user ${String(other.id).slice(0, 6)}`
          : 'Direct message');

  const rawTime = c.lastActivity?.toDate
    ? c.lastActivity.toDate()
    : c.lastActivity
      ? new Date(c.lastActivity)
      : null;

  const rawXp = other?.experience ?? other?.xp;
  const derivedLevel = rawXp != null
    ? getLevelInfo(rawXp).level
    : (typeof other?.level === 'number' && other.level > 0 ? other.level : null);
  const peerLevel = derivedLevel && derivedLevel > 1 ? derivedLevel : null;
  const peerRank = peerLevel ? getRankTitle(peerLevel) : null;
  const peerId = !isGroup && !isChannel
    ? (other?.id || other?.uid || (c.participants || []).find((p) => p !== uid) || null)
    : null;

  const lastRawMs = rawTime && !Number.isNaN(rawTime.getTime()) ? rawTime.getTime() : 0;
  const isOwnLastMessage = Boolean(uid && lastMsg.senderId && lastMsg.senderId === uid);
  const toMillis = (v) => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v?.seconds === 'number') return v.seconds * 1000;
    const d = new Date(v).getTime();
    return Number.isNaN(d) ? 0 : d;
  };
  let lastMessageRead = false;
  let lastMessageDelivered = false;
  if (isOwnLastMessage && c.lastRead && typeof c.lastRead === 'object') {
    for (const [participantId, ts] of Object.entries(c.lastRead)) {
      if (participantId !== uid && toMillis(ts) >= lastRawMs && lastRawMs > 0) {
        lastMessageRead = true;
        break;
      }
    }
  }
  if (isOwnLastMessage && !lastMessageRead && c.lastDelivered && typeof c.lastDelivered === 'object') {
    for (const [participantId, ts] of Object.entries(c.lastDelivered)) {
      if (participantId !== uid && toMillis(ts) >= lastRawMs && lastRawMs > 0) {
        lastMessageDelivered = true;
        break;
      }
    }
  }

  return {
    id: c.id,
    isAd: false,
    peerId,
    peerLevel,
    peerRank,
    name: otherName,
    type: c.type,
    avatar: getSafeAvatarUrl(
      isGroup || isChannel ? c.photoURL || other?.photoURL : other?.photoURL || other?.avatar,
      otherName,
      isGroup || isChannel ? c.id : other?.id
    ),
    verified: Boolean(other?.isVerified),
    preview: typeof lastMsg.text === 'string' ? lastMsg.text : '',
    attachmentType:
      lastMsg.attachment?.type === 'vibe'
        ? (lastMsg.metadata?.type === 'vibe_reply' ? 'vibe_reply' : 'vibe')
        : (lastMsg.type && lastMsg.type !== 'text' ? lastMsg.type : null),
    isOwnLastMessage,
    lastMessageRead,
    lastMessageDelivered,
    time:
      rawTime && !Number.isNaN(rawTime.getTime())
        ? rawTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    unread: Number(c.unreadCount) || 0,
    muted: Boolean(c.mutedBy?.includes(uid)),
    pinned: Boolean(c.pinnedBy?.includes(uid)),
    category: c.archivedBy?.includes(uid)
      ? 'archived'
      : (c.type === 'group' ? 'groups' : c.type === 'channel' ? 'channels' : 'personal'),
    activeDot: Boolean(c.presenceOnline),
    participantCount: c.participantCount || c.participants?.length || 2,
  };
}

export default function MessagingScreen({ sidebarMode = false, activeConversationId = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const searchInputRef = useRef(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState(null);
  const [conversationsNonce, setConversationsNonce] = useState(0);
  const [messageRequests, setMessageRequests] = useState([]);
  const [activeVibeCreators, setActiveVibeCreators] = useState([]);

  const vibeAuthorIds = useMemo(
    () => new Set(activeVibeCreators.map((v) => v.userId)),
    [activeVibeCreators]
  );

  const pinnedItems = useMemo(
    () =>
      conversations
        .filter((c) => !c.isAd && c.pinned && c.category !== 'archived')
        .map((c) => ({
          id: c.id,
          peerId: c.peerId || null,
          name: c.name,
          avatar: c.avatar,
          unread: c.unread || 0,
          verified: Boolean(c.verified),
        })),
    [conversations]
  );

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (!c.isAd && c.category !== 'archived' ? c.unread : 0), 0),
    [conversations]
  );

  const lastInboxLoadRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const load = async (force = false) => {
      if (!user?.uid) {
        setLoadingConversations(false);
        return;
      }
      const now = Date.now();
      if (!force && lastInboxLoadRef.current > 0 && now - lastInboxLoadRef.current < 30000) {
        return;
      }
      lastInboxLoadRef.current = now;
      try {
        setLoadingConversations(true);
        setConversationsError(null);
        const { getMessagingService } = await import('../services/messagesService.js');
        const res = await getMessagingService().getUserConversations(user.uid, { cacheFirst: false, limit: 50 });
        if (cancelled) return;
        const mapped = (res.conversations || []).map((c) => mapServiceConversation(c, user.uid));
        setConversations(mapped);
        setHasMore(Boolean(res.hasMore && res.nextCursor));
        setNextCursor(res.nextCursor || null);
      } catch (err) {
        if (!cancelled) {
          setConversationsError(err?.message || 'Could not load your conversations.');
          setConversations([]);
        }
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    };
    load(true);
    const handleFocus = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    const handleReadSync = () => load(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('arvdoul:messages-read', handleReadSync);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('arvdoul:messages-read', handleReadSync);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.uid, conversationsNonce]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;
    const loadRequests = async () => {
      try {
        const { getMessagingService } = await import('../services/messagesService.js');
        const res = await getMessagingService().getMessageRequests(user.uid, { limit: 20 });
        if (!cancelled) setMessageRequests(res?.requests || []);
      } catch (err) {
        console.warn('Failed to load message requests:', err);
        if (!cancelled) setMessageRequests([]);
      }
    };
    loadRequests();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleLoadMore = useCallback(async () => {
    if (!user?.uid || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { getMessagingService } = await import('../services/messagesService.js');
      const res = await getMessagingService().getUserConversations(user.uid, {
        cacheFirst: false,
        limit: 50,
        startAfter: nextCursor,
      });
      const incoming = (res.conversations || []).map((c) => mapServiceConversation(c, user.uid));
      setConversations((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const item of incoming) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setHasMore(Boolean(res.hasMore && res.nextCursor));
      setNextCursor(res.nextCursor || null);
    } catch (err) {
      toast.error(err?.message || 'Could not load more conversations');
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, nextCursor, loadingMore]);

  const handleTogglePin = useCallback(
    async (conversationId, currentlyPinned) => {
      if (!user?.uid) return;
      setOpenMenuId(null);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, pinned: !currentlyPinned } : c))
      );
      try {
        const { getMessagingService } = await import('../services/messagesService.js');
        if (currentlyPinned) await getMessagingService().unpinConversation(conversationId, user.uid);
        else await getMessagingService().pinConversation(conversationId, user.uid);
        toast.success(currentlyPinned ? 'Conversation unpinned' : 'Conversation pinned');
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, pinned: currentlyPinned } : c))
        );
        toast.error(err?.message || 'Could not update pin');
      }
    },
    [user?.uid]
  );

  const handleToggleMute = useCallback(
    async (conversationId, currentlyMuted) => {
      if (!user?.uid) return;
      setOpenMenuId(null);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, muted: !currentlyMuted } : c))
      );
      try {
        const { getMessagingService } = await import('../services/messagesService.js');
        if (currentlyMuted) await getMessagingService().unmuteConversation(conversationId, user.uid);
        else await getMessagingService().muteConversation(conversationId, user.uid);
        toast.success(currentlyMuted ? 'Notifications unmuted' : 'Notifications muted');
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, muted: currentlyMuted } : c))
        );
        toast.error(err?.message || 'Could not update mute setting');
      }
    },
    [user?.uid]
  );

  const handleToggleArchive = useCallback(
    async (conversationId, currentlyArchived, originalType) => {
      if (!user?.uid) return;
      setOpenMenuId(null);
      const nextCategory = currentlyArchived
        ? originalType === 'group'
          ? 'groups'
          : originalType === 'channel'
            ? 'channels'
            : 'personal'
        : 'archived';
      const prevCategory = currentlyArchived
        ? 'archived'
        : originalType === 'group'
          ? 'groups'
          : originalType === 'channel'
            ? 'channels'
            : 'personal';

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, category: nextCategory } : c))
      );
      try {
        const { getMessagingService } = await import('../services/messagesService.js');
        if (currentlyArchived) await getMessagingService().unarchiveConversation(conversationId, user.uid);
        else await getMessagingService().archiveConversation(conversationId, user.uid);
        toast.success(currentlyArchived ? 'Moved back to inbox' : 'Conversation archived');
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, category: prevCategory } : c))
        );
        toast.error(err?.message || 'Could not update archive state');
      }
    },
    [user?.uid]
  );

  const handleRequestResponse = useCallback(
    async (requestId, accept) => {
      if (!user?.uid) return;
      try {
        const { getMessagingService } = await import('../services/messagesService.js');
        const res = await getMessagingService().respondToMessageRequest(requestId, user.uid, accept);
        setMessageRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (res?.success && res.accepted && res.conversationId) {
          toast.success('Request accepted');
          navigate(`/messages/${res.conversationId}`);
        } else {
          toast.info('Request declined');
        }
      } catch (err) {
        toast.error(err?.message || 'Could not respond to request');
      }
    },
    [user?.uid, navigate]
  );

  const handleBlockRequester = useCallback(
    async (req) => {
      if (!user?.uid || !req?.senderId) return;
      try {
        const [{ getUserService }, { getMessagingService }] = await Promise.all([
          import('../services/userService.js'),
          import('../services/messagesService.js'),
        ]);
        await getUserService().blockUser(user.uid, req.senderId);
        await getMessagingService().respondToMessageRequest(req.id, user.uid, false).catch(() => {});
        setMessageRequests((prev) => prev.filter((r) => r.id !== req.id));
        toast.success('Sender blocked and request removed');
      } catch (err) {
        toast.error(err?.message || 'Could not block sender');
      }
    },
    [user?.uid]
  );

  const draftMap = useMemo(
    () => (user?.uid ? listDraftConversationMap(user.uid) : {}),
    [user?.uid, conversations]
  );

  const filteredConversations = useMemo(() => {
    if (activeFilter === 'requests') return [];
    const filtered = conversations.filter((item) => {
      if (item.isAd) {
        return activeFilter === 'all' && !searchQuery.trim() && !pinnedOnly;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPreview = item.preview?.toLowerCase().includes(q);
        if (!matchesName && !matchesPreview) return false;
      }
      if (pinnedOnly && !item.pinned) return false;
      if (activeFilter === 'unread') return item.unread > 0 && item.category !== 'archived';
      if (activeFilter === 'groups') return item.category === 'groups';
      if (activeFilter === 'personal') return item.category === 'personal';
      if (activeFilter === 'channels') return item.category === 'channels';
      if (activeFilter === 'archived') return item.category === 'archived';
      if (activeFilter === 'all') return item.category !== 'archived';
      return true;
    });

    return filtered.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [conversations, searchQuery, activeFilter, pinnedOnly]);

  const activeThreadCount = useMemo(
    () => conversations.filter((c) => !c.isAd && c.category !== 'archived').length,
    [conversations]
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('arvdoul:inbox_header_state', {
        detail: { totalUnread, activeCount: activeThreadCount },
      })
    );
  }, [totalUnread, activeThreadCount]);

  useEffect(() => {
    const onFocusSearch = () => {
      const el = searchInputRef.current || document.getElementById('message-search-input');
      if (el) {
        el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        el.focus?.();
      }
    };
    const onInboxSearchQuery = (e) => {
      if (!sidebarMode) {
        setSearchQuery(typeof e?.detail === 'string' ? e.detail : '');
      }
    };
    window.addEventListener('arvdoul:focus_inbox_search', onFocusSearch);
    window.addEventListener('arvdoul:inbox_search_query', onInboxSearchQuery);
    return () => {
      window.removeEventListener('arvdoul:focus_inbox_search', onFocusSearch);
      window.removeEventListener('arvdoul:inbox_search_query', onInboxSearchQuery);
    };
  }, [sidebarMode]);

  useEffect(() => {
    if (!user?.uid || sidebarMode) {
      setActiveVibeCreators([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ storyService }, { getSocialGraphService }] = await Promise.all([
          import('../services/storyService.js'),
          import('../services/socialGraphService.js'),
        ]);
        const res = await storyService.getStoriesFeed(user.uid, { cacheFirst: true, limit: 12 });
        if (cancelled) return;
        const groups = (res?.groups || []).filter(
          (g) => g?.userId && Array.isArray(g.stories) && g.stories.length > 0 && !g.stories.every((s) => s.isAd || s.type === 'ad')
        );
        if (groups.length === 0) {
          setActiveVibeCreators([]);
          return;
        }
        const ids = groups.map((g) => g.userId);
        const hydratedList = await getSocialGraphService().hydrateProfiles(ids).catch(() => []);
        const profilesMap = new Map((Array.isArray(hydratedList) ? hydratedList : []).map((p) => [p?.uid || p?.id, p]));
        if (cancelled) return;
        const items = groups.map((g) => {
          const p = profilesMap.get(g.userId) || {};
          const name = pickDisplayName([p.displayName, p.name, g.stories[0]?.authorName], {
            fallback: `user ${String(g.userId).slice(0, 6)}`,
          });
          return {
            userId: g.userId,
            name,
            avatar: getSafeAvatarUrl(p.photoURL || g.stories[0]?.authorPhoto, name, g.userId),
            hasUnseen: g.stories.some((s) => !s.seen),
            count: g.stories.length,
          };
        });
        setActiveVibeCreators(items);
      } catch (err) {
        console.warn('Failed to load active vibes in inbox:', err?.message || err);
        if (!cancelled) setActiveVibeCreators([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, sidebarMode]);

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 w-full h-full overflow-hidden font-sans',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
      )}
    >
      {/* Left Conversation List / Sidebar Pane */}
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col select-none relative pb-24 lg:pb-6 transition-colors duration-150 ${
        sidebarMode
          ? 'w-full'
          : 'w-full lg:w-[360px] lg:flex-none xl:w-[392px] lg:border-r lg:border-slate-200/80 dark:lg:border-white/[0.08]'
      }`}>
        {/* Unified Inbox Header — title bar & search bar omitted when TopAppBar owns top chrome */}
        <header
          className={cn(
            'sticky top-0 z-20 px-4 border-b backdrop-blur-2xl',
            hasTopAppBar && !sidebarMode ? 'pt-2 pb-2.5' : 'pt-3 pb-3',
            isDark ? 'bg-[#03071B]/90 border-white/[0.08]' : 'bg-[#F6F8FC]/90 border-slate-200/80'
          )}
        >
          {!hasTopAppBar && (
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  aria-label="Open my profile"
                  onClick={() => navigate('/profile')}
                  className="relative shrink-0 rounded-full p-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <LazyImage
                    src={getSafeAvatarUrl(user?.photoURL, user?.displayName, user?.uid)}
                    alt="My Profile"
                    className={cn(
                      'w-9 h-9 rounded-full object-cover border-2',
                      isDark ? 'border-[#03071B]' : 'border-white'
                    )}
                  />
                </button>

                <div className="min-w-0">
                  <h1 className="font-bold text-lg tracking-tight leading-tight truncate">
                    Messages
                  </h1>
                  <p
                    className={cn(
                      'text-xs tabular-nums truncate',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )}
                  >
                    {totalUnread > 0
                      ? `${totalUnread} unread`
                      : `${activeThreadCount} conversation${activeThreadCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="New message"
                onClick={() => navigate('/messages/new')}
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-2xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
          )}

          {hasTopAppBar && sidebarMode && (
            <div className="flex items-center justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-black tracking-tight truncate">Chats</h2>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums',
                    totalUnread > 0
                      ? 'bg-arvdoul-purple/20 text-purple-300'
                      : isDark
                        ? 'bg-white/[0.06] text-slate-400'
                        : 'bg-slate-200/80 text-slate-600'
                  )}
                >
                  {totalUnread > 0 ? `${totalUnread} unread` : activeThreadCount}
                </span>
              </div>
              <button
                type="button"
                aria-label="New message"
                onClick={() => navigate('/messages/new')}
                className="min-h-[40px] min-w-[40px] px-3 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">New conversation</span>
              </button>
            </div>
          )}

          {/* Search Input (shown in split-pane sidebar or standalone mode; TopAppBar owns top-level inbox search) */}
          {(!hasTopAppBar || sidebarMode) && (
          <div className="relative">
            <div
              className={cn(
                'flex items-center gap-2 px-3 min-h-[44px] rounded-2xl border transition-colors',
                isDark
                  ? 'bg-[#090F2D] border-white/10 focus-within:border-arvdoul-purple/70'
                  : 'bg-white border-slate-200/90 focus-within:border-arvdoul-purple/70'
              )}
            >
              <Search
                className={cn('w-4 h-4 shrink-0', isDark ? 'text-slate-400' : 'text-slate-400')}
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                aria-label="Search messages, people, groups..."
                id="message-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className={cn(
                  'flex-1 bg-transparent text-sm focus:outline-none min-w-0',
                  isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className={cn(
                    'min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          )}

          {/* Interactive Filter Tabs */}
          <div
            className={cn(
              'flex items-center gap-1.5 overflow-x-auto no-scrollbar',
              (!hasTopAppBar || sidebarMode) ? 'pt-2.5' : 'pt-0.5'
            )}
            role="tablist"
            aria-label="Filter conversations"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    'min-h-[40px] sm:min-h-[36px] px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isActive
                      ? 'text-white border-transparent shadow-sm'
                      : isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                  style={isActive ? { background: BRAND_GRADIENT } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.id === 'unread' && totalUnread > 0 && (
                    <span
                      className={cn(
                        'tabular-nums text-[11px] font-bold',
                        isActive ? 'text-white/95' : isDark ? 'text-purple-300' : 'text-purple-700'
                      )}
                    >
                      {totalUnread}
                    </span>
                  )}
                  {tab.id === 'requests' && messageRequests.length > 0 && (
                    <span
                      className={cn(
                        'tabular-nums text-[11px] font-bold',
                        isActive ? 'text-white/95' : isDark ? 'text-purple-300' : 'text-purple-700'
                      )}
                    >
                      {messageRequests.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="px-3 sm:px-4 pt-3 space-y-4">
          {/* Active Vibes Strip — connected to live Stories/Vibes */}
          {!sidebarMode && user?.uid && (
            <section aria-label="Active vibes">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
                  <span>Vibes</span>
                </div>
                {activeVibeCreators.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/vibes')}
                    className={cn(
                      'text-xs font-medium rounded px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                      isDark ? 'text-purple-300 hover:text-white' : 'text-purple-600 hover:text-purple-800'
                    )}
                  >
                    Open Vibes
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => navigate('/create-story')}
                  className="w-16 shrink-0 flex flex-col items-center text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl py-0.5"
                >
                  <div className="relative mb-1">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full p-[2px] border border-dashed',
                        isDark ? 'border-purple-400/50 bg-[#090F2D]' : 'border-purple-400/60 bg-white'
                      )}
                    >
                      <LazyImage
                        src={getSafeAvatarUrl(user?.photoURL, user?.displayName, user?.uid)}
                        alt="Your Vibe"
                        className="w-full h-full rounded-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-arvdoul-gradient text-white flex items-center justify-center border-2 shadow-sm',
                        isDark ? 'border-[#03071B]' : 'border-[#F8FAFC]'
                      )}
                      aria-hidden="true"
                    >
                      <Plus className="w-3 h-3" />
                    </span>
                  </div>
                  <span className="text-[11px] font-medium truncate max-w-full">Your Vibe</span>
                </button>

                {activeVibeCreators.map((creator) => (
                  <button
                    key={creator.userId}
                    type="button"
                    onClick={() => navigate('/vibes', { state: { vibeUserId: creator.userId } })}
                    className="w-16 shrink-0 flex flex-col items-center text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl py-0.5"
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full p-[2px] mb-1 transition-transform group-hover:scale-105',
                        !creator.hasUnseen && (isDark ? 'bg-white/20' : 'bg-slate-300')
                      )}
                      style={creator.hasUnseen ? { background: BRAND_GRADIENT } : undefined}
                    >
                      <LazyImage
                        src={creator.avatar}
                        alt={creator.name}
                        className={cn(
                          'w-full h-full rounded-full object-cover border-2',
                          isDark ? 'border-[#03071B]' : 'border-[#F8FAFC]'
                        )}
                      />
                    </div>
                    <span className="text-[11px] font-medium truncate max-w-full">{creator.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* True Pinned Strip */}
          {pinnedItems.length > 0 && (
            <section aria-label="Pinned conversations">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Pin className="w-3.5 h-3.5 rotate-45 text-purple-500" aria-hidden="true" />
                  <span>Pinned</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{pinnedItems.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPinnedOnly((v) => !v)}
                  className={cn(
                    'text-xs font-medium transition-colors rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    pinnedOnly
                      ? 'text-purple-500 font-semibold'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {pinnedOnly ? 'Show all' : 'Filter pinned'}
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {pinnedItems.map((item) => {
                  const isCurrent = activeConversationId === item.id;
                  const hasActiveVibe = Boolean(item.peerId && vibeAuthorIds.has(item.peerId));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/messages/${item.id}`)}
                      className={cn(
                        'w-20 shrink-0 p-2 rounded-xl border transition-colors flex flex-col items-center text-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                        isCurrent
                          ? isDark
                            ? 'bg-purple-500/15 border-purple-500/50'
                            : 'bg-purple-50 border-purple-300'
                          : isDark
                            ? 'bg-[#090F2D] border-white/[0.08] hover:border-purple-500/40'
                            : 'bg-white border-slate-200 hover:border-purple-400'
                      )}
                    >
                      <div
                        className={cn('relative mb-1.5 rounded-full', hasActiveVibe && 'p-[2px]')}
                        style={hasActiveVibe ? { background: BRAND_GRADIENT } : undefined}
                      >
                        <LazyImage
                          src={item.avatar}
                          alt={item.name}
                          className={cn(
                            'w-10 h-10 rounded-full object-cover',
                            hasActiveVibe && (isDark ? 'border-2 border-[#090F2D]' : 'border-2 border-white')
                          )}
                        />
                        {item.unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-arvdoul-gradient text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                            {item.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 max-w-full">
                        <p className="text-[11px] font-semibold truncate">{item.name}</p>
                        {item.verified && (
                          <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pending Message Requests */}
          {activeFilter !== 'requests' && messageRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('requests')}
              className={cn(
                'w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isDark
                  ? 'bg-[#090F2D] border-purple-500/30 hover:border-purple-400/50'
                  : 'bg-white border-purple-200 hover:border-purple-400'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserPlus className="w-4 h-4 text-purple-500 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {messageRequests.length} pending message request{messageRequests.length === 1 ? '' : 's'}
                  </p>
                  <p className={cn('text-[11px] truncate', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Review senders before adding them to your inbox
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-purple-500 dark:text-purple-300 shrink-0">
                Open
              </span>
            </button>
          )}

          {activeFilter === 'requests' && (
            <section aria-label="Message requests" className="space-y-2">
              <h2
                className={cn(
                  'text-xs font-semibold px-1 tabular-nums',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Message requests ({messageRequests.length})
              </h2>
              {messageRequests.length === 0 ? (
                <div className={cn('text-center py-12 px-4 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  <UserPlus className="w-8 h-8 mx-auto mb-2.5 opacity-40" aria-hidden="true" />
                  <p>No pending message requests.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messageRequests.map((req) => (
                    <div
                      key={req.id}
                      className={cn(
                        'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isDark ? 'bg-[#090F2D] border-purple-500/30' : 'bg-white border-purple-200'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => req.senderId && navigate(`/profile/${req.senderId}`)}
                        className="flex items-center gap-2.5 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                      >
                        {req.senderAvatar ? (
                          <LazyImage
                            src={req.senderAvatar}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-arvdoul-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {pickDisplayName([req.senderName], {
                              fallback: req.senderId ? String(req.senderId).slice(0, 2).toUpperCase() : '—',
                            })
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {pickDisplayName([req.senderName], {
                              fallback: req.senderId ? `user ${String(req.senderId).slice(0, 6)}` : '—',
                            })}
                          </p>
                          <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                            Wants to message you · Tap to view profile
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRequestResponse(req.id, true)}
                          className="min-h-[40px] px-3.5 rounded-xl text-white text-xs font-bold hover:brightness-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                          style={{ background: BRAND_GRADIENT }}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestResponse(req.id, false)}
                          className={cn(
                            'min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                            isDark
                              ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          )}
                        >
                          Decline
                        </button>
                        {req.senderId && (
                          <button
                            type="button"
                            onClick={() => handleBlockRequester(req)}
                            aria-label="Block requester"
                            title="Block user"
                            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                          >
                            <Ban className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Conversation List */}
          {activeFilter !== 'requests' && (
          <section aria-label="Conversations" className="space-y-1.5">
            {loadingConversations && filteredConversations.length === 0 && (
              <div className="space-y-2" role="status" aria-label="Loading conversations">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 rounded-xl border flex items-center gap-3',
                      isDark ? 'bg-[#090F2D] border-white/[0.06]' : 'bg-white border-slate-200/80'
                    )}
                  >
                    <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse shimmer shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-white/10 rounded w-1/3 animate-pulse shimmer" />
                      <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-2/3 animate-pulse shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingConversations && conversationsError && (
              <ErrorState
                title="Could not load your conversations"
                message={conversationsError}
                onRetry={() => setConversationsNonce((n) => n + 1)}
              />
            )}

            {!loadingConversations && !conversationsError && filteredConversations.length === 0 && (
              <div className={cn('text-center py-12 px-4 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                <MessageSquare className="w-8 h-8 mx-auto mb-2.5 opacity-40" aria-hidden="true" />
                <p>
                  {conversations.length === 0
                    ? 'No conversations yet — start one with the + button.'
                    : searchQuery.trim()
                      ? `No conversations match “${searchQuery.trim()}”.`
                      : 'No conversations in this view.'}
                </p>
              </div>
            )}

            {filteredConversations.map((item, rowIdx) => {
              if (item.isAd) {
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-3 rounded-xl border flex items-center gap-3',
                      isDark ? 'bg-[#090F2D]/60 border-white/[0.06]' : 'bg-white border-slate-200/80'
                    )}
                  >
                    <LazyImage
                      src={item.avatar}
                      alt={item.name}
                      className="w-11 h-11 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <span className={cn('text-[11px] shrink-0', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          Sponsored
                        </span>
                      </div>
                      {item.preview && (
                        <p className={cn('text-xs truncate mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          {item.preview}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              const isCurrent = activeConversationId === item.id;
              const isMenuOpen = openMenuId === item.id;
              const hasActiveVibe = Boolean(item.peerId && vibeAuthorIds.has(item.peerId));

              return (
                <div
                  key={item.id}
                  className={cn(
                    'relative p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 group',
                    isCurrent
                      ? isDark
                        ? 'bg-arvdoul-purple/15 border-arvdoul-purple/50 shadow-sm'
                        : 'bg-arvdoul-purple/[0.07] border-arvdoul-purple/40 shadow-sm'
                      : isDark
                        ? 'bg-[#090F2D]/90 border-white/[0.08] hover:border-arvdoul-purple/40 hover:bg-[#0D153C]'
                        : 'bg-white border-slate-200/90 hover:border-arvdoul-purple/40 hover:bg-slate-50/70'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${item.id}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  >
                    <div
                      className={cn('relative shrink-0 rounded-full', hasActiveVibe && 'p-[2px]')}
                      style={hasActiveVibe ? { background: BRAND_GRADIENT } : undefined}
                    >
                      <LazyImage
                        src={item.avatar}
                        alt={item.name}
                        className={cn(
                          'w-11 h-11 rounded-full object-cover',
                          hasActiveVibe && (isDark ? 'border-2 border-[#090F2D]' : 'border-2 border-white')
                        )}
                      />
                      {item.type === 'direct' && item.activeDot && (
                        <span
                          className={cn(
                            'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2',
                            isDark ? 'border-[#090F2D]' : 'border-white'
                          )}
                          aria-label="Online"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <h3
                            className={cn(
                              'text-sm truncate',
                              item.unread > 0 ? 'font-bold' : 'font-semibold',
                              isDark ? 'text-white' : 'text-slate-900'
                            )}
                          >
                            {item.name}
                          </h3>
                          {item.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
                          )}
                          {item.peerLevel && (
                            <span
                              title={item.peerRank ? `Level ${item.peerLevel} · ${item.peerRank}` : `Level ${item.peerLevel}`}
                              className="text-[11px] font-semibold text-purple-400 tabular-nums shrink-0"
                            >
                              · Lv.{item.peerLevel}
                            </span>
                          )}
                          {item.pinned && (
                            <Pin className="w-3 h-3 text-purple-400 rotate-45 shrink-0" aria-label="Pinned" />
                          )}
                          {item.muted && (
                            <BellOff className="w-3 h-3 text-slate-400 shrink-0" aria-label="Muted" />
                          )}
                        </div>

                        {item.time && (
                          <span
                            className={cn(
                              'text-[11px] font-medium tabular-nums shrink-0',
                              item.unread > 0
                                ? 'text-purple-500 dark:text-purple-300 font-semibold'
                                : isDark
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
                            )}
                          >
                            {item.time}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        {draftMap[item.id]?.text ? (
                          <div className="flex items-center gap-1 text-xs min-w-0 flex-1">
                            <span className="font-semibold text-amber-500 shrink-0">Draft:</span>
                            <p className={cn('truncate italic', isDark ? 'text-slate-300' : 'text-slate-600')}>
                              {draftMap[item.id].text}
                            </p>
                          </div>
                        ) : (
                        <div
                          className={cn(
                            'flex items-center gap-1.5 text-xs min-w-0 flex-1',
                            item.unread > 0
                              ? isDark
                                ? 'text-slate-200 font-medium'
                                : 'text-slate-800 font-medium'
                              : isDark
                                ? 'text-slate-400'
                                : 'text-slate-500'
                          )}
                        >
                          {item.isOwnLastMessage && (item.preview || item.attachmentType) && (
                            <span className="shrink-0" aria-label={item.lastMessageRead ? 'Read' : item.lastMessageDelivered ? 'Delivered' : 'Sent'}>
                              {item.lastMessageRead ? (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
                              ) : item.lastMessageDelivered ? (
                                <CheckCheck className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              )}
                            </span>
                          )}
                          {item.attachmentType && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-purple-500 dark:text-purple-300">
                              {item.attachmentType === 'image' && <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'video' && <Video className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'audio' && <Music className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'voice' && <Mic className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'view_once' && <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'link' && <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
                              {(item.attachmentType === 'vibe' ||
                                item.attachmentType === 'vibe_reply' ||
                                item.attachmentType === 'vibe_share') && (
                                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                              {(item.attachmentType === 'file' ||
                                item.attachmentType === 'gif' ||
                                item.attachmentType === 'location' ||
                                item.attachmentType === 'contact' ||
                                item.attachmentType === 'poll' ||
                                item.attachmentType === 'shared_content') && (
                                <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                              <span>{ATTACHMENT_LABEL[item.attachmentType] || item.attachmentType}</span>
                              {item.preview && <span aria-hidden="true">·</span>}
                            </span>
                          )}
                          <p className="truncate">
                            {item.preview || (item.attachmentType ? '' : 'No messages yet')}
                          </p>
                        </div>
                        )}

                        {item.unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-arvdoul-gradient text-white text-[11px] font-bold flex items-center justify-center tabular-nums shrink-0">
                            {item.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Row Actions Menu Trigger (Sibling, Never Nested) */}
                  <button
                    type="button"
                    aria-label={`Options for ${item.name}`}
                    aria-expanded={isMenuOpen}
                    onClick={() => setOpenMenuId(isMenuOpen ? null : item.id)}
                    className={cn(
                      'min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                      isDark
                        ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                        : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-900'
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close options menu"
                        onClick={() => setOpenMenuId(null)}
                        className="fixed inset-0 z-30 cursor-default"
                      />
                      <div
                        role="menu"
                        className={cn(
                          'absolute right-2 z-40 w-44 rounded-xl border p-1 shadow-xl',
                          rowIdx >= filteredConversations.length - 2 && filteredConversations.length > 2
                            ? 'bottom-12'
                            : 'top-12',
                          isDark
                            ? 'bg-[#0B1230] border-white/15 text-slate-200'
                            : 'bg-white border-slate-200 text-slate-800'
                        )}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleTogglePin(item.id, item.pinned)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors',
                            isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}
                        >
                          <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{item.pinned ? 'Unpin' : 'Pin'}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleToggleMute(item.id, item.muted)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors',
                            isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}
                        >
                          {item.muted ? (
                            <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <BellOff className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{item.muted ? 'Unmute' : 'Mute'}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            handleToggleArchive(item.id, item.category === 'archived', item.type)
                          }
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors',
                            isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}
                        >
                          {item.category === 'archived' ? (
                            <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{item.category === 'archived' ? 'Unarchive' : 'Archive'}</span>
                        </button>

                        {item.type === 'direct' && item.peerId && (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                navigate(`/profile/${item.peerId}`);
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors',
                                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                              )}
                            >
                              <User className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>View profile</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                navigate(`/gift/${item.peerId}`);
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors text-purple-500 dark:text-purple-300',
                                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                              )}
                            >
                              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Send gift</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/messages/${item.id}/settings`);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors',
                            isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}
                        >
                          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Settings</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {hasMore && !loadingConversations && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={cn(
                    'min-h-[42px] px-5 rounded-2xl text-xs font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isDark
                      ? 'bg-[#090F2D] border-white/10 text-slate-300 hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>{loadingMore ? 'Loading more…' : 'Load more conversations'}</span>
                </button>
              </div>
            )}
          </section>
          )}
        </div>
      </div>

      {/* Desktop Right-Pane Empty Workspace (on /messages index only) */}
      {!sidebarMode && (
        <div
          className={cn(
            'hidden lg:flex flex-1 min-w-0 flex-col items-center justify-center p-10 text-center',
            isDark ? 'bg-[#04091E]/75' : 'bg-white/80'
          )}
        >
          <div className={cn(
            'max-w-sm rounded-3xl border p-8 space-y-4 backdrop-blur-xl',
            isDark ? 'bg-[#090F2D]/70 border-white/[0.08]' : 'bg-white border-slate-200/80 shadow-sm'
          )}>
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ background: BRAND_GRADIENT }}
            >
              <MessageSquare className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Select a conversation</h2>
            <p className={cn('text-sm leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Choose an existing direct message, group, or channel from your inbox, or start a new conversation.
            </p>
            <button
              type="button"
              onClick={() => navigate('/messages/new')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 rounded-2xl text-white text-sm font-bold shadow-sm hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              style={{ background: BRAND_GRADIENT }}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Conversation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
