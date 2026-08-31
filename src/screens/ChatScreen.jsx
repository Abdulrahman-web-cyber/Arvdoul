// src/screens/ChatScreen.jsx
/**
 * ARVDOUL CHAT SCREEN — REAL MESSAGING (no simulation)
 *
 * Previously this screen rendered hardcoded mock messages ("Hey! How are you
 * doing?", Unsplash media, a simulated "Isabella" auto-responder, a fake
 * voice-note player). This rebuild is wired end-to-end to the real
 * messagesService:
 *
 *  - conversation loaded by :conversationId (title, participants, type)
 *  - realtime subscription: new messages, typing indicators, presence
 *  - send text (E2EE handled by the service)
 *  - send images/videos/files and VOICE messages (MediaRecorder -> upload ->
 *    send; the recorder bug `ondata` -> `ondataavailable` is fixed)
 *  - reactions via reactToMessage (real, toggles)
 *  - read receipts (markMessageAsRead on view, Check/CheckCheck icons)
 *  - voice playback via real <audio>, duration metadata
 *  - loading / error / empty states; optimistic send with rollback
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getMessagingService, MESSAGING_CONFIG } from '../services/messagesService.js';
import MessageInput from '../components/messaging/MessageInput.jsx';
import MessageBubble from '../components/messaging/MessageBubble.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import { cn } from '../lib/utils';
import { ArrowLeft, Lock, Users, Phone, Video, Info, Search, Pin, Image as ImageIcon, ArrowDown, Bookmark } from 'lucide-react';
import { format, isSameDay, isSameMinute } from 'date-fns';

const REACTION_TYPES = (MESSAGING_CONFIG && MESSAGING_CONFIG.REACTION_TYPES) || ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ChatScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const uid = user?.uid;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [presence, setPresence] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [infoTab, setInfoTab] = useState('pinned'); // pinned | media | search | saved
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [savedIds, setSavedIds] = useState({});
  const [savedMessages, setSavedMessages] = useState([]);
  const mainRef = useRef(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pendingRef = useRef(new Map()); // localId -> {convId, data}
  const messagesRef = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const reloadTimerRef = useRef(null);

  // ------------------------------------------------------------------
  // Conversation load + realtime subscription
  // ------------------------------------------------------------------
  const loadMessages = useCallback(async () => {
    if (!conversationId || !uid) return;
    try {
      const svc = getMessagingService();
      const res = await svc.getMessages(conversationId, { cacheFirst: false, limit: 60 });
      if (res.success) {
        setHasMoreOlder(Boolean(res.hasMore));
        // Merge pending optimistic messages (they'll be replaced once the
        // server copy arrives via the realtime channel).
        const pending = Array.from(pendingRef.current.values()).map((p) => ({
          id: p.localId,
          _local: true,
          _pending: true,
          senderId: uid,
          type: p.data.type || 'text',
          content: p.data.content,
          media: p.data.media,
          createdAt: new Date(),
        }));
        setMessages([...pending, ...res.messages]);
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId, uid]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      if (!conversationId || !uid) return;
      try {
        const svc = getMessagingService();
        const conv = await svc.getConversation(conversationId, { cacheFirst: false });
        if (!cancelled) {
          if (conv.success) setConversation(conv.conversation);
          else setLoadError(conv.error || 'Conversation not found');
        }

        await loadMessages();

        unsubscribe = svc.subscribeToConversation(conversationId, uid, (event) => {
          if (cancelled) return;
          if (event.type === 'conversation_updated') {
            setConversation(event.conversation);
          } else if (event.type === 'typing_update') {
            setTypingUsers((prev) => ({ ...prev, ...(event.typing || {}) }));
          } else if (event.type === 'presence_update') {
            setPresence((prev) => ({ ...prev, [event.userId]: event.presence }));
          } else if (event.type === 'new_message') {
            // Debounced reload: getMessages decrypts E2EE content server-side.
            if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
            reloadTimerRef.current = setTimeout(() => {
              loadMessages();
              // Drop any pending optimistic message that was just confirmed
              const incomingId = event.message?.id;
              if (incomingId && pendingRef.current.has(incomingId)) {
                pendingRef.current.delete(incomingId);
              }
            }, 300);
          }
        });
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to open conversation');
      }
    })();

    return () => {
      cancelled = true;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    };
  }, [conversationId, uid, loadMessages]);

  // Scroll to bottom ONLY when the user is already at the bottom; otherwise
  // count the new messages and show a jump-to-latest pill (spec §51).
  useEffect(() => {
    if (!atBottom) return;
    try {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    } catch {
      /* noop */
    }
    setNewSinceScroll(0);
  }, [messages.length, atBottom]);

  const bottomCountRef = useRef(0);
  const handleScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nowAtBottom = distanceFromBottom < 120;
    setAtBottom(nowAtBottom);
    if (nowAtBottom) {
      bottomCountRef.current = messagesRef.current?.length || 0;
      setNewSinceScroll(0);
    }
  }, []);

  // Count messages arriving while scrolled up (spec §51 jump-to-latest).
  useEffect(() => {
    if (!atBottom) {
      const total = messages.length;
      const newCount = Math.max(0, total - bottomCountRef.current);
      if (newCount > 0) setNewSinceScroll(newCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Reconnect: when the browser comes back online, drop stale optimistic
  // messages (the real ones arrive via the realtime subscription) and reload.
  useEffect(() => {
    const goOnline = () => {
      pendingRef.current.clear();
      setMessages((prev) => prev.filter((m) => !m._local || m._failed));
      getMessagingService().getMessages(conversationId, { limit: 50 }).then((res) => {
        if (res?.success) setMessages(res.messages || []);
      }).catch(() => {});
    };
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, [conversationId]);

  // Conversation-level read position (spec §17): ONE debounced write marks
  // everything up to the latest message as read — never N per-message writes.
  const readTimerRef = useRef(null);
  useEffect(() => {
    if (!conversationId || !uid || messages.length === 0) return;
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(() => {
      getMessagingService().markConversationAsRead(conversationId, uid).catch(() => {});
    }, 600);
    return () => { if (readTimerRef.current) clearTimeout(readTimerRef.current); };
  }, [conversationId, uid, messages]);

  // ------------------------------------------------------------------
  // Actions (all real, via messagesService)
  // ------------------------------------------------------------------
  const handleSendMessage = useCallback(
    async (data) => {
      if (!conversationId || !uid || !data?.content?.trim()) return;
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pendingRef.current.set(localId, { conversationId, data });
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          _local: true,
          _pending: true,
          senderId: uid,
          type: 'text',
          content: data.content,
          createdAt: new Date(),
        },
      ]);
      setSendingId(localId);
      try {
        await getMessagingService().sendMessage(conversationId, { type: 'text', content: data.content });
      } catch (err) {
        toastError(err.message || 'Failed to send message');
        // Roll back the optimistic message so the UI never lies
        pendingRef.current.delete(localId);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      } finally {
        setSendingId(null);
      }
    },
    [conversationId, uid]
  );

  const handleSendMedia = useCallback(
    async ({ file, isVoice }) => {
      if (!conversationId || !uid || !file) return;
      const type = isVoice
        ? 'voice'
        : file.type?.startsWith('image/')
          ? 'image'
          : file.type?.startsWith('video/')
            ? 'video'
            : 'file';

      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pendingRef.current.set(localId, { conversationId, data: { type, media: { file } } });
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          _local: true,
          _pending: true,
          senderId: uid,
          type,
          media: { fileName: file.name, isVoice },
          createdAt: new Date(),
        },
      ]);
      setSendingId(localId);
      try {
        // The service uploads the file and builds the media message.
        await getMessagingService().sendMessage(conversationId, { type, media: { file } });
      } catch (err) {
        toastError(err.message || 'Failed to send media');
        pendingRef.current.delete(localId);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      } finally {
        setSendingId(null);
      }
    },
    [conversationId, uid]
  );

  const handleReaction = useCallback(
    async (messageId, reaction) => {
      if (!conversationId || !uid) return;
      try {
        await getMessagingService().reactToMessage(conversationId, messageId, uid, reaction);
      } catch (err) {
        toastError(err.message || 'Failed to react');
      }
    },
    [conversationId, uid]
  );

  const handleTyping = useCallback(() => {
    if (!conversationId || !uid) return;
    try {
      getMessagingService().sendTypingIndicator?.(conversationId, uid).catch?.(() => {});
    } catch {
      /* typing is best-effort */
    }
  }, [conversationId, uid]);

  // ------------------------------------------------------------------
  // Derived UI
  // ------------------------------------------------------------------
  const otherParticipants = useMemo(() => {
    if (!conversation || !uid) return [];
    return (conversation.participants || []).filter((p) => p !== uid);
  }, [conversation, uid]);

  const title = useMemo(() => {
    if (conversation?.title) return conversation.title;
    if (otherParticipants.length === 1) {
      return conversation.participantNames?.[otherParticipants[0]] || 'Conversation';
    }
    return conversation?.type === 'group' || conversation?.participantCount > 2
      ? 'Group Chat'
      : 'Conversation';
  }, [conversation, otherParticipants]);

  const typingText = useMemo(() => {
    const names = Object.entries(typingUsers)
      .filter(([, v]) => v === true || v?.isTyping)
      .map(([id]) => conversation?.participantNames?.[id] || 'Someone');
    if (names.length === 0) return null;
    return names.length === 1 ? `${names[0]} is typing...` : 'Several people are typing...';
  }, [typingUsers, conversation]);

  // ------------------------------------------------------------------
  // Conversation info panel: pinned messages, shared media, search
  // ------------------------------------------------------------------
  const openInfoPanel = useCallback(async () => {
    setShowInfoPanel(true);
    loadSavedState();
    try {
      const svc = getMessagingService();
      const [pinnedRes, mediaRes] = await Promise.allSettled([
        svc.getPinnedMessages(conversationId),
        svc.getConversationMedia(conversationId, { limit: 30 }),
      ]);
      const pinnedIds = pinnedRes.status === 'fulfilled' ? pinnedRes.value?.pinnedMessageIds : [];
      setPinnedMessages(Array.isArray(pinnedIds) ? pinnedIds : []);
      const mediaList = mediaRes.status === 'fulfilled' ? mediaRes.value?.media : [];
      setSharedMedia(Array.isArray(mediaList) ? mediaList : []);
    } catch { /* panel still opens with empty states */ }
  }, [conversationId]);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const res = await getMessagingService().searchMessagesAlgolia(conversationId, q, { limit: 20 });
      setSearchResults(res?.results || []);
    } catch (err) {
      setSearchResults(null);
      toastError(err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [conversationId, searchQuery, searching]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !uid || loadingOlder) return;
    const oldest = messagesRef.current
      .filter((m) => !m._local)
      .sort((a, b) => (a.createdAt?.toDate?.() || new Date(a.createdAt)) - (b.createdAt?.toDate?.() || new Date(b.createdAt)))[0];
    if (!oldest) return;
    const startAfter = oldest.createdAt?.toDate ? oldest.createdAt.toDate().toISOString() : String(oldest.createdAt);
    setLoadingOlder(true);
    try {
      const svc = getMessagingService();
      const res = await svc.getMessages(conversationId, { cacheFirst: false, limit: 30, startAfter });
      if (res?.success && res.messages.length > 0) {
        // Preserve visual position: remember scroll height before inserting.
        const el = mainRef.current;
        const prevHeight = el ? el.scrollHeight : 0;
        setMessages((prev) => [...res.messages, ...prev]);
        setHasMoreOlder(Boolean(res.hasMore));
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop;
        });
      } else {
        setHasMoreOlder(false);
      }
    } catch (err) {
      toastError(err?.message || 'Could not load older messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, uid, loadingOlder]);

  const toggleSaveMessage = useCallback(async (msg) => {
    if (!conversationId || !uid || !msg?.id) return;
    try {
      const svc = getMessagingService();
      if (savedIds[msg.id]) {
        await svc.unsaveMessage(msg.id, uid);
        setSavedIds((p) => { const n = { ...p }; delete n[msg.id]; return n; });
        toastError?.('Removed from saved');
      } else {
        await svc.saveMessage(conversationId, msg.id, uid);
        setSavedIds((p) => ({ ...p, [msg.id]: true }));
      }
      // Refresh the saved list in the panel.
      const res = await svc.getSavedMessages(uid, { limit: 50 });
      if (res?.success) setSavedMessages(res.messages || []);
    } catch (err) {
      toastError(err?.message || 'Could not update saved messages');
    }
  }, [conversationId, uid, savedIds]);

  // Load this conversation's saved-message ids when the panel opens.
  const loadSavedState = useCallback(async () => {
    if (!uid) return;
    try {
      const svc = getMessagingService();
      const res = await svc.getSavedMessages(uid, { limit: 200 });
      if (res?.success) {
        const list = res.messages || [];
        setSavedMessages(list);
        const ids = {};
        list.forEach((m) => { if (m.conversationId === conversationId) ids[m.id] = true; });
        setSavedIds(ids);
      }
    } catch { /* panel still opens */ }
  }, [uid, conversationId]);

  const jumpToMessage = (messageId) => {
    setShowInfoPanel(false);
    // If the message is in the loaded window, scroll to it; otherwise load
    // surrounding context via the service (spec §24/32).
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-purple-400', 'rounded-xl');
        setTimeout(() => el.classList.remove('ring-2', 'ring-purple-400', 'rounded-xl'), 2500);
        return;
      }
      // Not in the loaded window — reload the latest batch (it may contain
      // the message) and try again; otherwise the user can search for it.
      getMessagingService().getMessages(conversationId, { limit: 50 }).then((res) => {
        if (res?.success) setMessages(res.messages || []);
      }).catch(() => {});
      toastError('Message not in the loaded window — try searching.');
    }, 100);
  };

  // ------------------------------------------------------------------
  // Derived render items: date separators, sender grouping (spec §49),
  // unread divider (spec §50)
  // ------------------------------------------------------------------
  const renderItems = useMemo(() => {
    const items = [];
    let lastDateKey = null;
    let lastSender = null;
    let lastTime = null;
    const lastReadAt = conversation?.lastRead?.[uid]
      ? (conversation.lastRead[uid].toDate ? conversation.lastRead[uid].toDate() : new Date(conversation.lastRead[uid]))
      : null;
    let insertedUnreadDivider = false;

    messages.forEach((msg) => {
      const ts = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt));
      const dateKey = ts instanceof Date && !Number.isNaN(ts.getTime()) ? format(ts, 'yyyy-MM-dd') : null;

      // Date separator on day change.
      if (dateKey && dateKey !== lastDateKey) {
        items.push({ kind: 'date', date: dateKey, label: isSameDay(ts, new Date()) ? 'Today' : format(ts, 'MMM d, yyyy') });
        lastDateKey = dateKey;
        lastSender = null;
        lastTime = null;
      }

      // Unread divider: first incoming message after the user's last read.
      if (!insertedUnreadDivider && lastReadAt && !msg._local && !msg.isDeleted && msg.senderId !== uid) {
        if (ts instanceof Date && !Number.isNaN(ts.getTime()) && ts > lastReadAt) {
          items.push({ kind: 'unread' });
          insertedUnreadDivider = true;
        }
      }

      // Grouping: same sender within 5 minutes = one visual group.
      const groupStart = !(msg.senderId === lastSender && lastTime && ts instanceof Date && !Number.isNaN(ts.getTime()) && (ts - lastTime) < 5 * 60 * 1000);
      items.push({ kind: 'message', message: msg, groupStart });
      lastSender = msg.senderId;
      lastTime = ts;
    });

    return items;
  }, [messages, conversation, uid]);

  // ------------------------------------------------------------------
  // States
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className={cn('min-h-screen pb-24', isDark ? 'bg-[#0B0F17] text-white' : 'bg-gray-50 text-gray-900')}>
        <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-24 w-2/3 rounded-2xl" />
          <Skeleton className="h-24 w-1/2 rounded-2xl ml-auto" />
          <Skeleton className="h-24 w-2/3 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError && !conversation) {
    return (
      <div className={cn('min-h-screen pb-24', isDark ? 'bg-[#0B0F17] text-white' : 'bg-gray-50 text-gray-900')}>
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <ErrorState title="Could not open conversation" message={loadError} onRetry={() => { setLoadError(null); setLoading(true); loadMessages().finally(() => setLoading(false)); }} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-screen', isDark ? 'bg-[#0B0F17] text-white' : 'bg-gray-50 text-gray-900')}>
      {/* Header */}
      <header className={cn('sticky top-0 z-20 backdrop-blur-xl border-b', isDark ? 'bg-[#0B0F17]/85 border-white/10' : 'bg-white/85 border-gray-200')}>
        <div className="max-w-3xl mx-auto px-3 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/messages')}
            aria-label="Back to conversations"
            className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700')}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">{title}</h1>
            <p className="text-[11px] opacity-60 truncate">
              {typingText || (otherParticipants.length > 0
                ? `${otherParticipants.length} participant${otherParticipants.length > 1 ? 's' : ''}`
                : '')}
            </p>
          </div>
          {conversation?.type === 'direct' && (
            <Lock className="w-4 h-4 text-emerald-400" aria-label="End-to-end encrypted" />
          )}
          {conversation?.participantCount > 2 && <Users className="w-4 h-4 opacity-60" aria-hidden="true" />}
          <button
            onClick={openInfoPanel}
            aria-label="Conversation info"
            className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700')}
          >
            <Info className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-4 overscroll-contain" aria-live="polite">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              title="No messages yet"
              description="Say hello - your conversation starts here."
            />
          </div>
        )}

        {/* Load earlier messages (spec §15 pagination) */}
        {hasMoreOlder && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold text-arvdoul-text-secondary disabled:opacity-50 transition-colors"
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {renderItems.map((item) => {
          if (item.kind === 'date') {
            return (
              <div key={`date-${item.date}`} className="flex items-center justify-center my-4" role="separator">
                <span className={cn(
                  'text-[10px] uppercase tracking-wider px-3 py-1 rounded-full',
                  isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-200/70 text-gray-500'
                )}>
                  {item.label}
                </span>
              </div>
            );
          }
          if (item.kind === 'unread') {
            return (
              <div key="unread-divider" className="flex items-center gap-3 my-4" role="separator">
                <div className="flex-1 h-px bg-purple-500/40" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-2">
                  New messages
                </span>
                <div className="flex-1 h-px bg-purple-500/40" />
              </div>
            );
          }
          const msg = item.message;
          const isOwn = msg.senderId === uid || msg.sender === 'me';
          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
            <MessageBubble
              key={`${msg.id}-bubble`}
              message={msg}
              isOwn={isOwn}
              senderName={conversation?.participantNames?.[msg.senderId] || (isOwn ? 'You' : 'User')}
              senderAvatar={conversation?.participantAvatars?.[msg.senderId]}
              onReaction={handleReaction}
              onDelete={async () => {
                try {
                  await getMessagingService().deleteMessage?.(msg.id, conversationId, uid);
                } catch {
                  /* best-effort */
                }
              }}
              onSave={toggleSaveMessage}
              isSaved={Boolean(savedIds[msg.id])}
              isGroup={conversation?.participantCount > 2}
              isGroupStart={item.groupStart}
              theme={isDark ? 'dark' : 'light'}
            />
            </div>
          );
        })}

        {/* Jump-to-latest pill (spec §51) */}
        {!atBottom && newSinceScroll > 0 && (
          <button
            onClick={() => {
              try {
                messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
              } catch { /* noop */ }
              bottomCountRef.current = messagesRef.current?.length || 0;
              setNewSinceScroll(0);
              setAtBottom(true);
            }}
            className="sticky bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg shadow-purple-600/40 hover:bg-purple-500 transition-colors"
            aria-label={`Jump to ${newSinceScroll} new message${newSinceScroll > 1 ? 's' : ''}`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {newSinceScroll} new
          </button>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Conversation info panel: pinned / media / search */}
      {showInfoPanel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowInfoPanel(false)}>
          <div
            className={cn(
              'w-full max-w-sm h-full overflow-y-auto p-4 border-l',
              isDark ? 'bg-[#0B0F17] border-white/10' : 'bg-white border-gray-200'
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Conversation details"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Conversation details</h2>
              <button
                onClick={() => setShowInfoPanel(false)}
                aria-label="Close details"
                className={cn('p-2 rounded-full', isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100')}
              >
                <Info className="w-4 h-4 opacity-60" aria-hidden="true" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
              {[
                { id: 'pinned', label: 'Pinned', icon: Pin },
                { id: 'media', label: 'Media', icon: ImageIcon },
                { id: 'saved', label: 'Saved', icon: Bookmark },
                { id: 'search', label: 'Search', icon: Search },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setInfoTab(tab.id)}
                    aria-pressed={infoTab === tab.id}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
                      infoTab === tab.id
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {infoTab === 'pinned' && (
              <div className="space-y-2">
                {pinnedMessages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No pinned messages yet</p>
                ) : (
                  pinnedMessages.map((pid) => (
                    <button
                      key={pid}
                      onClick={() => jumpToMessage(pid)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl text-xs border',
                        isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200 hover:border-purple-400'
                      )}
                    >
                      <span className="font-semibold">Pinned message</span>
                      <span className="block text-gray-400 mt-0.5 truncate">{pid}</span>
                    </button>
                  ))
                )}
                <button
                  onClick={() => navigate(`/messages/${conversationId}/settings`)}
                  className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors"
                >
                  Conversation settings
                </button>
              </div>
            )}

            {infoTab === 'media' && (
              <div>
                {sharedMedia.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No shared media yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {sharedMedia.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => jumpToMessage(m.id)}
                        className="aspect-square rounded-xl overflow-hidden border border-white/10"
                        aria-label={`Open media message ${m.id}`}
                      >
                        {m.media?.url || m.media?.downloadUrl ? (
                          <img src={m.media.url || m.media.downloadUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-purple-600/30 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-purple-300" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {infoTab === 'saved' && (
              <div>
                {savedMessages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No saved messages yet — long-press a message and choose Save</p>
                ) : (
                  <div className="space-y-2">
                    {savedMessages.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => jumpToMessage(m.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl text-xs border',
                          isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <span className="text-gray-400 block mb-0.5">
                          {m.senderName || 'User'} · {m.createdAt?.toDate ? format(m.createdAt.toDate(), 'p') : ''}
                        </span>
                        <span className="line-clamp-2">{m.content || '(media message)'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {infoTab === 'search' && (
              <div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder="Search this conversation…"
                    aria-label="Search messages"
                    className={cn(
                      'flex-1 px-3 py-2.5 rounded-xl text-sm outline-none border',
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    )}
                  />
                  <button
                    onClick={runSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {searching ? '…' : 'Search'}
                  </button>
                </div>
                {searchResults && (
                  <div className="space-y-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No results</p>
                    ) : (
                      searchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => jumpToMessage(r.id)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl text-xs border',
                            isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <span className="text-gray-400 block mb-0.5">
                            {r.senderName || 'User'} · {r.createdAt?.toDate ? format(r.createdAt.toDate(), 'p') : ''}
                          </span>
                          <span className="line-clamp-2">{r.content || '(media message)'}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {typingText && !loading && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-1 text-[11px] text-purple-400">
          {typingText}
        </div>
      )}

      {/* Input */}
      <div className="max-w-3xl mx-auto w-full">
        <MessageInput
          ref={inputRef}
          conversationId={conversationId}
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          onTyping={handleTyping}
          theme={isDark ? 'dark' : 'light'}
          disabled={!conversation}
        />
      </div>
    </div>
  );
}

/** Tiny local toast helper (avoids importing sonner at module top for tree-shaking). */
function toastError(message) {
  // Deferred import keeps the initial bundle lean.
  import('sonner').then(({ toast }) => toast.error(message)).catch(() => {});
}
