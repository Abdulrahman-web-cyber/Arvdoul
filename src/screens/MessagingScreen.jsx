// src/screens/MessagingScreen.jsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { pickDisplayName } from '../services/profileReadModel.js';
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
} from 'lucide-react';
import { LazyImage } from '../components/Shared/LazyImage';

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: Mail },
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
  file: 'Attachment',
  gif: 'GIF',
  location: 'Location',
  contact: 'Contact',
  poll: 'Poll',
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

  return {
    id: c.id,
    isAd: false,
    name: otherName,
    type: c.type,
    avatar: getSafeAvatarUrl(
      isGroup || isChannel ? c.photoURL || other?.photoURL : other?.photoURL || other?.avatar,
      otherName,
      isGroup || isChannel ? c.id : other?.id
    ),
    verified: Boolean(other?.isVerified),
    preview: typeof lastMsg.text === 'string' ? lastMsg.text : '',
    attachmentType: lastMsg.type && lastMsg.type !== 'text' ? lastMsg.type : null,
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

  const pinnedItems = useMemo(
    () =>
      conversations
        .filter((c) => !c.isAd && c.pinned && c.category !== 'archived')
        .map((c) => ({
          id: c.id,
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) {
        setLoadingConversations(false);
        return;
      }
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
    load();
    const handleFocus = () => {
      if (document.visibilityState === 'visible') load();
    };
    const handleReadSync = () => load();
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

  const filteredConversations = useMemo(() => {
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

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 w-full h-full overflow-hidden font-sans',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F8FAFC] text-slate-900'
      )}
    >
      {/* Left Conversation List / Sidebar Pane */}
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col select-none relative pb-24 lg:pb-6 transition-colors duration-150 ${
        sidebarMode
          ? 'w-full'
          : 'w-full lg:w-[360px] lg:flex-none xl:w-[392px] lg:border-r lg:border-slate-200/80 dark:lg:border-white/[0.08]'
      }`}>
        {/* Unified Inbox Header */}
        <header
          className={cn(
            'sticky top-0 z-20 px-4 pt-3.5 pb-3 border-b backdrop-blur-xl',
            isDark ? 'bg-[#03071B]/90 border-white/[0.08]' : 'bg-[#F8FAFC]/90 border-slate-200/80'
          )}
        >
          <div className="flex items-center justify-between gap-3">
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
              className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-arvdoul-gradient text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className={sidebarMode ? 'sr-only' : 'hidden sm:inline'}>New</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="mt-3 relative">
            <div
              className={cn(
                'flex items-center gap-2 px-3 min-h-[40px] rounded-xl border transition-colors',
                isDark
                  ? 'bg-[#090F2D] border-white/10 focus-within:border-purple-500/60'
                  : 'bg-white border-slate-200 focus-within:border-purple-500/60'
              )}
            >
              <Search
                className={cn('w-4 h-4 shrink-0', isDark ? 'text-slate-400' : 'text-slate-400')}
                aria-hidden="true"
              />
              <input
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
                    'p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Filter Tabs */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5"
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
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isActive
                      ? 'bg-arvdoul-gradient text-white shadow-sm'
                      : isDark
                        ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white'
                        : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.id === 'unread' && totalUnread > 0 && (
                    <span
                      className={cn(
                        'tabular-nums text-[11px] font-bold',
                        isActive ? 'text-white/90' : isDark ? 'text-purple-300' : 'text-purple-700'
                      )}
                    >
                      {totalUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="px-3 sm:px-4 pt-3 space-y-4">
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
                      <div className="relative mb-1.5">
                        <LazyImage
                          src={item.avatar}
                          alt={item.name}
                          className="w-10 h-10 rounded-full object-cover"
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
          {messageRequests.length > 0 && (
            <section aria-label="Message requests" className="space-y-2">
              <h2
                className={cn(
                  'text-xs font-semibold px-1 tabular-nums',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                Message requests ({messageRequests.length})
              </h2>
              <div className="space-y-2">
                {messageRequests.map((req) => (
                  <div
                    key={req.id}
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between gap-3',
                      isDark ? 'bg-[#090F2D] border-purple-500/30' : 'bg-white border-purple-200'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
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
                          Wants to message you
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRequestResponse(req.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-arvdoul-gradient text-white text-xs font-semibold hover:brightness-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestResponse(req.id, false)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                          isDark
                            ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        )}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conversation List */}
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

            {filteredConversations.map((item) => {
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

              return (
                <div
                  key={item.id}
                  className={cn(
                    'relative p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 group',
                    isCurrent
                      ? isDark
                        ? 'bg-purple-500/15 border-purple-500/50'
                        : 'bg-purple-50/80 border-purple-300'
                      : isDark
                        ? 'bg-[#090F2D] border-white/[0.07] hover:border-purple-500/35 hover:bg-[#0D153C]'
                        : 'bg-white border-slate-200/90 hover:border-purple-400/70 hover:bg-slate-50/60'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${item.id}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  >
                    <div className="relative shrink-0">
                      <LazyImage
                        src={item.avatar}
                        alt={item.name}
                        className="w-11 h-11 rounded-full object-cover"
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
                          {item.attachmentType && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-purple-500 dark:text-purple-300">
                              {item.attachmentType === 'image' && <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'video' && <Video className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'audio' && <Music className="w-3.5 h-3.5" aria-hidden="true" />}
                              {item.attachmentType === 'voice' && <Mic className="w-3.5 h-3.5" aria-hidden="true" />}
                              {(item.attachmentType === 'file' ||
                                item.attachmentType === 'gif' ||
                                item.attachmentType === 'location' ||
                                item.attachmentType === 'contact' ||
                                item.attachmentType === 'poll') && (
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
                      'min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
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
                          'absolute right-2 top-12 z-40 w-44 rounded-xl border p-1 shadow-xl',
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
                    'px-4 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
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
        </div>
      </div>

      {/* Desktop Right-Pane Empty Workspace (on /messages index only) */}
      {!sidebarMode && (
        <div
          className={cn(
            'hidden lg:flex flex-1 min-w-0 flex-col items-center justify-center p-10 text-center',
            isDark ? 'bg-[#04091E]' : 'bg-white'
          )}
        >
          <div className="max-w-sm space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white shadow-sm"
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
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-arvdoul-gradient text-white text-sm font-semibold shadow-sm hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
