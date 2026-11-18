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
 *  - realtime subscription: new messages, typing indicators
 *  - 1:1 counterpart presence read from `user_presence/{uid}` (N458)
 *  - send text (E2EE handled by the service)
 *  - send images/videos/files and VOICE messages (MediaRecorder -> upload ->
 *    send; the recorder bug `ondata` -> `ondataavailable` is fixed)
 *  - reactions via reactToMessage (real, toggles)
 *  - read receipts (markMessageAsRead on view, Check/CheckCheck icons)
 *  - voice playback via real <audio>, duration metadata
 *  - loading / error / empty states; optimistic send with rollback
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrompt } from '../components/Shared/ConfirmProvider.jsx';
import { useTheme } from '../context/ThemeContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { getMessagingService, MESSAGING_CONFIG } from '../services/messagesService.js';
import MessageInput from '../components/messaging/MessageInput.jsx';
import MessageBubble from '../components/messaging/MessageBubble.jsx';
import { Skeleton } from '../components/UI/Skeleton.jsx';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import { cn } from '../lib/utils';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { getLevelInfo, getRankTitle } from '../shared/levelConfig.cjs';
import {
  ArrowLeft,
  Users,
  Info,
  Search,
  Pin,
  Image as ImageIcon,
  ArrowDown,
  Bookmark,
  X,
  Reply,
  Phone,
  Video,
  Gift,
  EyeOff,
  CheckCircle2,
  User as UserIcon,
} from "lucide-react";
import { REPORT_REASONS } from '../utils/videoUtils';
import { pickDisplayName } from '../services/profileReadModel.js';
import { format, isSameDay } from "date-fns";
import { LazyImage } from '../components/Shared/LazyImage';

const REACTION_TYPES = (MESSAGING_CONFIG && MESSAGING_CONFIG.REACTION_TYPES) || ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ChatScreen() {
  const prompt = usePrompt();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';

  const uid = user?.uid;
  const routeIntent = location.state || null;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  // 1:1 counterpart presence, read from the scope-gated `user_presence/{uid}`
  // via the social-graph spine. The old Realtime-Database `status/` path this
  // screen subscribed to was never written by any code (N458), so the header's
  // "Online / Last seen" could never render.
  const [presence, setPresence] = useState(null);
  const [peerMeta, setPeerMeta] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [pinnedBannerIndex, setPinnedBannerIndex] = useState(0);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [infoTab, setInfoTab] = useState('pinned'); // pinned | media | search | saved
  const [infoPanelError, setInfoPanelError] = useState(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [savedIds, setSavedIds] = useState({});
  const [savedMessages, setSavedMessages] = useState([]);
  const [openedViewOnceIds, setOpenedViewOnceIds] = useState({});
  const [activeViewOnce, setActiveViewOnce] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardConversations, setForwardConversations] = useState([]);
  const [forwarding, setForwarding] = useState(false);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const mainRef = useRef(null);

  const messagesEndRef = useRef(null);
  const pendingRef = useRef(new Map()); // localId -> {convId, data}
  const localToServerRef = useRef(new Map()); // localId -> server messageId
  const messagesRef = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const reloadTimerRef = useRef(null);

  // Conversation load + realtime subscription
  const loadMessages = useCallback(async () => {
    if (!conversationId || !uid) return;
    try {
      const svc = getMessagingService();
      const res = await svc.getMessages(conversationId, { cacheFirst: false, limit: 60 });
      if (res.success) {
        setHasMoreOlder(Boolean(res.hasMore));
        const serverMessages = res.messages || [];
        const serverIds = new Set(serverMessages.map((m) => m.id));
        const pending = Array.from(pendingRef.current.entries())
          .filter(([localId]) => !serverIds.has(localId))
          .filter(([localId]) => !serverIds.has(localToServerRef.current.get(localId)))
          .map(([localId, p]) => ({
            id: localId,
            _local: true,
            _pending: true,
            senderId: uid,
            type: p.data.type || 'text',
            content: p.data.content,
            media: p.data.media,
            createdAt: new Date(),
          }));
        setMessages([...pending, ...serverMessages]);
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

    // Reset thread state cleanly on conversation switch (important in desktop split pane)
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setPeerMeta(null);
    setMessages([]);
    setTypingUsers({});
    setReplyTo(null);
    setShowInfoPanel(false);
    setSearchQuery('');
    setSearchResults(null);
    setPinnedMessages([]);
    setPinnedBannerIndex(0);
    setPinnedIds([]);
    setSharedMedia([]);
    setSavedIds({});
    setSavedMessages([]);
    setOpenedViewOnceIds({});
    setActiveViewOnce(null);
    setNewSinceScroll(0);
    setAtBottom(true);
    pendingRef.current.clear();
    localToServerRef.current.clear();

    (async () => {
      if (!conversationId || !uid) {
        setLoading(false);
        return;
      }
      try {
        const svc = getMessagingService();
        const conv = await svc.getConversation(conversationId, { cacheFirst: false });
        if (!cancelled) {
          if (conv.success) {
            setConversation(conv.conversation);
            if (Array.isArray(conv.conversation?.pinnedMessages)) {
              setPinnedIds(conv.conversation.pinnedMessages);
            }
          } else {
            setLoadError(conv.error || 'Conversation not found');
          }
        }

        await loadMessages();

        unsubscribe = svc.subscribeToConversation(conversationId, uid, (event) => {
          if (cancelled) return;
          if (event.type === 'conversation_updated') {
            setConversation(event.conversation);
            if (Array.isArray(event.conversation?.pinnedMessages)) {
              setPinnedIds(event.conversation.pinnedMessages);
            }
          } else if (event.type === 'typing_update') {
            setTypingUsers((prev) => ({ ...prev, ...(event.typing || {}) }));
          } else if (event.type === 'new_message') {
            // Debounced reload: getMessages decrypts E2EE content server-side.
            if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
            reloadTimerRef.current = setTimeout(() => {
              loadMessages();
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
      }).catch((e) => {
        console.warn('Reconnect message reload failed', e?.message);
      });
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
      getMessagingService().markConversationAsRead(conversationId, uid).catch((e) => {
        console.warn('[Chat] mark-as-read failed; unread badge may be stale', e?.message);
      });
    }, 600);
    return () => { if (readTimerRef.current) clearTimeout(readTimerRef.current); };
  }, [conversationId, uid, messages]);

  // Actions (all real, via messagesService)
  // The optimistic id is sent as the idempotency key, so it BECOMES the server
  // doc id. That lets the realtime subscription and the debounced reload
  // replace the bubble in place (same React key) instead of appending a second
  // copy — the "sent message appears twice" bug. On a successful send we clear
  // the pending markers but keep the local timestamp: the send result carries an
  // unresolved serverTimestamp sentinel, and the authoritative copy arrives via
  // the realtime channel a moment later. An offline-queued send stays pending
  // until the queue drains.
  const reconcileSentMessage = useCallback((localId, res) => {
    if (res?.offlineQueued) return;
    pendingRef.current.delete(localId);
    const serverId = res?.messageId || res?.message?.id || null;
    if (serverId) localToServerRef.current.set(localId, serverId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === localId
          ? { ...m, id: serverId || m.id, _local: false, _pending: false, _failed: false }
          : m
      )
    );
  }, []);

  const handleSendMessage = useCallback(
    async (data) => {
      const msgType = data?.type || 'text';
      const hasBody = Boolean(data?.content?.trim?.() || data?.media?.url || data?.location);
      if (!conversationId || !uid || !hasBody) return;
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pendingRef.current.set(localId, { conversationId, data: { ...data, type: msgType } });
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          _local: true,
          _pending: true,
          senderId: uid,
          type: msgType,
          content: data.content,
          media: data.media || null,
          replyTo: replyTo ? { senderName: replyTo.senderName, content: replyTo.content } : null,
          createdAt: new Date(),
        },
      ]);
      try {
        const payload = {
          type: msgType,
          content: data.content,
          ...(data.media ? { media: data.media } : {}),
          ...(data.location ? { location: data.location } : {}),
          ...(replyTo
            ? {
                replyTo: {
                  messageId: replyTo.id,
                  senderId: replyTo.senderId,
                  senderName: replyTo.senderName,
                  contentPreview: (replyTo.content || '').slice(0, 80),
                },
              }
            : {}),
        };
        const res = await getMessagingService().sendMessage(conversationId, payload);
        reconcileSentMessage(localId, res);
        setReplyTo(null);
      } catch (err) {
        toastError(err.message || 'Failed to send message');
        // Roll back the optimistic message so the UI never lies
        pendingRef.current.delete(localId);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      }
    },
    [conversationId, uid, reconcileSentMessage, replyTo]
  );

  const handleSendMedia = useCallback(
    async ({ file, isVoice, text: captionText, viewOnce }) => {
      if (!conversationId || !uid || !file) return;
      const isVisual = file.type?.startsWith('image/') || file.type?.startsWith('video/');
      const isViewOnce = Boolean(viewOnce && !isVoice && isVisual);
      const type = isVoice
        ? 'voice'
        : isViewOnce
          ? (MESSAGING_CONFIG?.MESSAGE_TYPES?.VIEW_ONCE || 'view_once')
          : file.type?.startsWith('image/')
            ? 'image'
            : file.type?.startsWith('video/')
              ? 'video'
              : 'file';

      const cleanCaption = captionText?.trim?.() || '';
      const content = cleanCaption || (isViewOnce
        ? (file.type?.startsWith('video/') ? 'View-once video' : 'View-once photo')
        : '');
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const mediaPayload = isViewOnce
        ? { file, mediaKind: file.type?.startsWith('video/') ? 'video' : 'image' }
        : { file };
      pendingRef.current.set(localId, {
        conversationId,
        data: { type, content, media: mediaPayload },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          _local: true,
          _pending: true,
          senderId: uid,
          type,
          content,
          media: { fileName: file.name, isVoice, mediaKind: mediaPayload.mediaKind },
          createdAt: new Date(),
        },
      ]);
      try {
        const payload = {
          type,
          ...(content ? { content } : {}),
          media: mediaPayload,
          ...(replyTo
            ? {
                replyTo: {
                  messageId: replyTo.id,
                  senderId: replyTo.senderId,
                  senderName: replyTo.senderName,
                  contentPreview: (replyTo.content || '').slice(0, 80),
                },
              }
            : {}),
        };
        const res = await getMessagingService().sendMessage(conversationId, payload);
        reconcileSentMessage(localId, res);
        if (replyTo) setReplyTo(null);
      } catch (err) {
        toastError(err.message || 'Failed to send media');
        pendingRef.current.delete(localId);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      }
    },
    [conversationId, uid, reconcileSentMessage, replyTo]
  );

  const handleOpenViewOnce = useCallback(
    async (msg) => {
      if (!msg?.id || !conversationId || !uid) return;
      setActiveViewOnce(msg);
      setOpenedViewOnceIds((prev) => ({ ...prev, [msg.id]: true }));
      try {
        await getMessagingService().viewOnceMessage?.(msg.id, conversationId, uid, {
          createdAt: msg.createdAt,
        });
      } catch {
        /* local opened state remains authoritative for this view session */
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

  // Derived UI
  const otherParticipants = useMemo(() => {
    if (!conversation || !uid) return [];
    return (conversation.participants || []).filter((p) => p !== uid);
  }, [conversation, uid]);

  const title = useMemo(() => {
    if (conversation?.title) return conversation.title;
    if (conversation?.name) return conversation.name;
    if (otherParticipants.length === 1) {
      return conversation.participantNames?.[otherParticipants[0]] || 'Conversation';
    }
    return conversation?.type === 'group' || conversation?.participantCount > 2
      ? 'Group Chat'
      : 'Conversation';
  }, [conversation, otherParticipants]);

  const headerAvatar = useMemo(() => {
    if (!conversation) return null;
    if (conversation.type === 'group' || conversation.type === 'channel') {
      return getSafeAvatarUrl(conversation.photoURL, title, conversation.id);
    }
    const peerId = otherParticipants[0];
    const peerPhoto = peerId ? conversation.participantAvatars?.[peerId] : null;
    return getSafeAvatarUrl(peerPhoto, title, peerId || conversation.id);
  }, [conversation, otherParticipants, title]);

  const typingText = useMemo(() => {
    const names = Object.entries(typingUsers)
      .filter(([, v]) => v === true || v?.isTyping)
      .map(([id]) => conversation?.participantNames?.[id] || `user ${String(id).slice(0, 6)}`);
    if (names.length === 0) return null;
    return names.length === 1 ? `${names[0]} is typing...` : 'Several people are typing...';
  }, [typingUsers, conversation]);

  // Live presence for a 1:1 chat, read from the scope-gated
  // `user_presence/{uid}` (N321). `presence` is the counterpart's
  // `{ isOnline, lastActive }` map entry, or null when unknown/denied.
  // Only meaningful when there is a single other participant, so a group
  // header keeps showing its member count.
  const presenceText = useMemo(() => {
    if (otherParticipants.length !== 1) return null;
    const p = presence;
    if (!p) return null;
    if (p.isOnline) return 'Online';
    const la = p.lastActive;
    if (la) {
      const when = la?.toDate ? la.toDate() : new Date(la);
      const mins = Math.floor((Date.now() - when.getTime()) / 60000);
      if (!Number.isFinite(mins) || mins < 0) return null;
      if (mins < 1) return 'Last seen just now';
      if (mins < 60) return `Last seen ${mins}m ago`;
      return `Last seen ${Math.floor(mins / 60)}h ago`;
    }
    return null;
  }, [presence, otherParticipants]);

  // Fetch the 1:1 counterpart's presence once per conversation. This is the
  // only place the chat header learns "Online" / "Last seen": a denied or
  // failed read leaves `presence` null and the header shows the participant
  // count instead of a fabricated status.
  useEffect(() => {
    let cancelled = false;
    const counterpart = otherParticipants.length === 1 ? otherParticipants[0] : null;
    setPresence(null);
    if (!counterpart) return () => { cancelled = true; };
    (async () => {
      try {
        const { getSocialGraphService } = await import('../services/socialGraphService.js');
        const map = await getSocialGraphService().getPresenceMap([counterpart]);
        if (!cancelled) setPresence(map.get(counterpart) || null);
      } catch (err) {
        if (!cancelled) setPresence(null);
        console.warn('ChatScreen: counterpart presence read failed', err?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [otherParticipants]);

  // Hydrate 1:1 peer standing (level, rank, verified, active Vibe) for ecosystem integration
  useEffect(() => {
    let cancelled = false;
    const peerId = otherParticipants.length === 1 ? otherParticipants[0] : null;
    if (!peerId || !uid) {
      setPeerMeta(null);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const [{ getUserProfile }, { storyService }] = await Promise.all([
          import('../services/userService.js'),
          import('../services/storyService.js'),
        ]);
        const [profileRes, storiesRes] = await Promise.allSettled([
          typeof getUserProfile === 'function' ? getUserProfile(peerId) : Promise.resolve(null),
          typeof storyService?.getStoriesFeed === 'function'
            ? storyService.getStoriesFeed(uid, { cacheFirst: true, limit: 12 })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const p = profileRes.status === 'fulfilled' ? profileRes.value : null;
        const rawXp = p?.experience ?? p?.xp;
        const derivedLevel = rawXp != null
          ? getLevelInfo(rawXp).level
          : (typeof p?.level === 'number' && p.level > 0 ? p.level : null);
        const level = derivedLevel && derivedLevel > 1 ? derivedLevel : null;
        const rank = level ? getRankTitle(level) : null;
        const groups = storiesRes.status === 'fulfilled' ? (storiesRes.value?.groups || []) : [];
        const hasVibe = groups.some(
          (g) => g?.userId === peerId && Array.isArray(g.stories) && g.stories.length > 0
        );
        setPeerMeta({
          level,
          rank,
          verified: Boolean(p?.isVerified || p?.verified),
          bio: typeof p?.bio === 'string' ? p.bio : '',
          hasVibe,
        });
      } catch {
        if (!cancelled) setPeerMeta(null);
      }
    })();
    return () => { cancelled = true; };
  }, [otherParticipants, uid]);

  // Keep unified TopAppBar chat chrome synchronized with live thread metadata
  useEffect(() => {
    if (!conversationId) return undefined;
    const isDirect = conversation?.type === 'direct' || otherParticipants.length === 1;
    const peerId = otherParticipants.length === 1 ? otherParticipants[0] : null;
    const fallbackSubtitle =
      routeIntent?.subtitle ||
      (otherParticipants.length > 0
        ? `${otherParticipants.length} participant${otherParticipants.length > 1 ? 's' : ''}`
        : '');
    window.dispatchEvent(
      new CustomEvent('arvdoul:chat_header_state', {
        detail: {
          conversationId,
          title,
          avatar: headerAvatar,
          subtitle: typingText || presenceText || fallbackSubtitle,
          isTyping: Boolean(typingText),
          isOnline: Boolean(presence?.isOnline),
          isDirect,
          peerId,
          level: peerMeta?.level || null,
          rank: peerMeta?.rank || null,
          verified: Boolean(peerMeta?.verified),
          hasVibe: Boolean(peerMeta?.hasVibe),
        },
      })
    );
  }, [
    conversationId,
    conversation,
    otherParticipants,
    title,
    headerAvatar,
    typingText,
    presenceText,
    presence,
    routeIntent?.subtitle,
    peerMeta,
  ]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent('arvdoul:chat_header_state', { detail: null }));
  }, []);

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
    } catch (err) {
      console.warn('[Chat] saved messages load failed', err);
      toastError('Could not load your saved messages.');
    }
  }, [uid, conversationId]);

  // Conversation info panel: pinned messages, shared media, search
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
      const validIds = Array.isArray(pinnedIds) ? pinnedIds : [];
      setPinnedIds(validIds);
      const localMap = new Map((messagesRef.current || []).map((m) => [m.id, m]));
      const resolvedPins = await Promise.all(
        validIds.map(async (pid) => {
          if (localMap.has(pid)) return localMap.get(pid);
          try {
            const fetched = await svc._getMessage?.(conversationId, pid);
            if (fetched) return fetched;
          } catch {
            /* noop */
          }
          return { id: pid };
        })
      );
      setPinnedMessages(resolvedPins);
      const mediaList = mediaRes.status === 'fulfilled' ? mediaRes.value?.media : [];
      setSharedMedia(Array.isArray(mediaList) ? mediaList : []);
      const failed = [];
      if (pinnedRes.status === 'rejected') failed.push('pinned messages');
      if (mediaRes.status === 'rejected') failed.push('shared media');
      if (failed.length) {
        // The panel still opens, but say which sections could not be loaded so
        // an empty section is not read as "there are none".
        console.warn('[Chat] conversation info sections failed', { conversationId, failed });
        setInfoPanelError(`Could not load ${failed.join(' or ')}.`);
      } else {
        setInfoPanelError(null);
      }
    } catch (err) {
      console.warn('[Chat] conversation info panel load failed', err);
      setInfoPanelError('Could not load conversation details.');
    }
  }, [conversationId, loadSavedState]);

  useEffect(() => {
    const onChatAction = (e) => {
      if (e?.detail?.action === 'open_info') {
        if (!e.detail.conversationId || e.detail.conversationId === conversationId) {
          openInfoPanel();
        }
      }
    };
    window.addEventListener('arvdoul:chat_action', onChatAction);
    return () => window.removeEventListener('arvdoul:chat_action', onChatAction);
  }, [conversationId, openInfoPanel]);

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
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const older = res.messages.filter((m) => !existing.has(m.id));
          return [...older, ...prev];
        });
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

  // Report a message: opens a reason dialog, then submits through the
  // reportContent callable so it reaches the moderator queue (the old direct
  // write was denied by the rules and never surfaced anywhere).
  const submitReport = useCallback(async () => {
    if (!reportTarget || !uid) return;
    if (!reportReason) { toastError('Please select a reason.'); return; }
    setSubmittingReport(true);
    try {
      await getMessagingService().reportMessage(
        reportTarget.id,
        conversationId,
        uid,
        reportReason,
        reportDetails
      );
      toastSuccess('Report submitted. Thank you for helping keep Arvdoul safe.');
      setReportTarget(null);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      toastError(err?.message || 'Could not submit report.');
    } finally {
      setSubmittingReport(false);
    }
  }, [reportTarget, uid, conversationId, reportReason, reportDetails]);

  const toggleSaveMessage = useCallback(async (msg) => {
    if (!conversationId || !uid || !msg?.id) return;
    try {
      const svc = getMessagingService();
      if (savedIds[msg.id]) {
        await svc.unsaveMessage(msg.id, uid);
        setSavedIds((p) => { const n = { ...p }; delete n[msg.id]; return n; });
        toastSuccess?.('Removed from saved');
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

  // A message's sender label is the real participant name, else the uid prefix —
  // never a generic 'User'. `senderName` on the doc may itself be null (we no
  // longer write a fabricated one), so fall through to the uid.
  const resolveSenderLabel = useCallback((msg, isOwn) => {
    if (isOwn) return 'You';
    const resolved = pickDisplayName(
      [conversation?.participantNames?.[msg.senderId], msg.senderName],
      { fallback: null },
    );
    if (resolved) return resolved;
    return msg.senderId ? `user ${String(msg.senderId).slice(0, 6)}` : '—';
  }, [conversation]);

  // Reply / Edit / Forward / Pin handlers. MessageBubble renders these menu
  // actions unconditionally, so a missing handler was a control that did
  // nothing when tapped.
  const handleReply = useCallback((msg) => {
    setReplyTo({
      id: msg.id,
      senderId: msg.senderId,
      senderName: resolveSenderLabel(msg, msg.senderId === uid),
      content: msg.content || '',
    });
  }, [uid, conversation, resolveSenderLabel]);

  const handleEdit = useCallback(async (msg) => {
    const next = await prompt({ title: 'Edit message', defaultValue: msg.content || '', confirmText: 'Save' });
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === msg.content) return;
    try {
      await getMessagingService().editMessage(msg.id, conversationId, uid, trimmed);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, content: trimmed, isEdited: true } : m)));
      toastSuccess('Message edited');
    } catch (err) {
      toastError(err?.message || 'Could not edit the message.');
    }
  }, [conversationId, uid]);

  const openForwardPicker = useCallback(async (msg) => {
    setForwardTarget(msg);
    setForwardConversations([]);
    try {
      const res = await getMessagingService().getUserConversations(uid, { limit: 50 });
      setForwardConversations(
        (res?.conversations || []).filter((c) => c.id !== conversationId && !c.isAd && c.type !== 'ad')
      );
    } catch (err) {
      toastError('Could not load your conversations.');
    }
  }, [uid, conversationId]);

  const handleForwardTo = useCallback(async (targetConversationId) => {
    if (!forwardTarget || forwarding) return;
    setForwarding(true);
    try {
      await getMessagingService().forwardMessage(conversationId, forwardTarget.id, targetConversationId, uid);
      toastSuccess('Message forwarded');
      setForwardTarget(null);
    } catch (err) {
      toastError(err?.message || 'Could not forward the message.');
    } finally {
      setForwarding(false);
    }
  }, [forwardTarget, forwarding, conversationId, uid]);

  const handleTogglePin = useCallback(async (msg) => {
    try {
      const svc = getMessagingService();
      if (pinnedIds.includes(msg.id)) {
        await svc.unpinMessage(conversationId, msg.id, uid);
        setPinnedIds((p) => p.filter((id) => id !== msg.id));
        setPinnedMessages((p) => p.filter((item) => (typeof item === 'string' ? item : item.id) !== msg.id));
        toastSuccess('Message unpinned');
      } else {
        await svc.pinMessage(conversationId, msg.id, uid);
        setPinnedIds((p) => [...p, msg.id]);
        setPinnedMessages((p) => [...p, msg]);
        toastSuccess('Message pinned');
      }
    } catch (err) {
      toastError(err?.message || 'Could not update the pin.');
    }
  }, [conversationId, uid, pinnedIds]);

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
      }).catch((e) => {
        console.warn('Message search reload failed', e?.message);
      });
      toastError('Message not in the loaded window — try searching.');
    }, 100);
  };

  // Derived render items: date separators, sender grouping (spec §49),
  // unread divider (spec §50)
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

  const activePinnedId = pinnedIds.length > 0 ? pinnedIds[pinnedBannerIndex % pinnedIds.length] : null;
  const activePinnedMsg = useMemo(() => {
    if (!activePinnedId) return null;
    const fromPins = pinnedMessages.find((p) => (typeof p === 'string' ? p : p?.id) === activePinnedId);
    if (fromPins && typeof fromPins === 'object' && (fromPins.content || fromPins.type)) return fromPins;
    return messages.find((m) => m.id === activePinnedId) || null;
  }, [activePinnedId, pinnedMessages, messages]);

  // States
  if (loading) {
    return (
      <div className={cn('min-h-[100dvh] w-full pb-24', isDark ? 'bg-[#03071B] text-white' : 'bg-[#F8FAFC] text-slate-900')}>
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-20 w-2/3 rounded-2xl" />
          <Skeleton className="h-20 w-1/2 rounded-2xl ml-auto" />
          <Skeleton className="h-20 w-2/3 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError && !conversation) {
    return (
      <div className={cn('min-h-[100dvh] w-full pb-24', isDark ? 'bg-[#03071B] text-white' : 'bg-[#F8FAFC] text-slate-900')}>
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <ErrorState title="Could not open conversation" message={loadError} onRetry={() => { setLoadError(null); setLoading(true); loadMessages().finally(() => setLoading(false)); }} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 h-full w-full', isDark ? 'bg-[#03071B] text-white' : 'bg-[#F8FAFC] text-slate-900')}>
      <div className={cn(
        'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
        isDark ? 'bg-[#04091E]' : 'bg-[#F8FAFC]'
      )}>
      {/* Standalone Header — omitted when unified TopAppBar manages chat top chrome */}
      {!hasTopAppBar && (
      <header className={cn('sticky top-0 z-20 backdrop-blur-xl border-b', isDark ? 'bg-[#050B24]/90 border-white/[0.08]' : 'bg-white/90 border-slate-200')}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/messages')}
            aria-label="Back to conversations"
            className={cn('lg:hidden min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple', isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          {headerAvatar && (
            <div
              className={cn('relative shrink-0 rounded-full', peerMeta?.hasVibe && 'p-[2px]')}
              style={peerMeta?.hasVibe ? { background: BRAND_GRADIENT } : undefined}
            >
              <LazyImage
                src={headerAvatar}
                alt={title}
                className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <h1 className="font-bold text-sm sm:text-base truncate leading-tight">{title}</h1>
              {peerMeta?.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
              )}
              {peerMeta?.level && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 shrink-0">
                  Lv.{peerMeta.level}
                </span>
              )}
            </div>
            <p className={cn('text-xs truncate', typingText ? 'text-purple-400 font-medium' : isDark ? 'text-slate-400' : 'text-slate-500')}>
              {typingText || presenceText || (routeIntent?.subtitle) || (otherParticipants.length > 0
                ? `${otherParticipants.length} participant${otherParticipants.length > 1 ? 's' : ''}`
                : '')}
            </p>
          </div>
          {conversation?.participantCount > 2 && <Users className="w-4 h-4 opacity-60 shrink-0" aria-hidden="true" />}
          {conversationId && otherParticipants.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/call/${conversationId}?type=audio`)}
                aria-label="Start voice call"
                className={cn('min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple', isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/call/${conversationId}?type=video`)}
                aria-label="Start video call"
                className={cn('min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple', isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
              >
                <Video className="w-4 h-4" aria-hidden="true" />
              </button>
              {otherParticipants.length === 1 && (
                <button
                  type="button"
                  onClick={() => navigate(`/gift/${otherParticipants[0]}`)}
                  aria-label="Send gift"
                  className={cn('min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple', isDark ? 'hover:bg-white/10 text-purple-300' : 'hover:bg-slate-100 text-purple-600')}
                >
                  <Gift className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={openInfoPanel}
            aria-label="Conversation info"
            className={cn('min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple', isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
          >
            <Info className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      )}

      {/* Pinned Message Strip */}
      {activePinnedId && (
        <div
          className={cn(
            'border-b px-3 sm:px-5 py-2 flex items-center justify-between gap-2 max-w-4xl w-full mx-auto shrink-0',
            isDark ? 'bg-[#08102D]/90 border-white/[0.08]' : 'bg-white/95 border-slate-200/80'
          )}
        >
          <button
            type="button"
            onClick={() => jumpToMessage(activePinnedId)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-lg"
          >
            <Pin className="w-3.5 h-3.5 text-purple-500 rotate-45 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-purple-500 dark:text-purple-300 truncate">
                Pinned{pinnedIds.length > 1 ? ` (${(pinnedBannerIndex % pinnedIds.length) + 1}/${pinnedIds.length})` : ''}
              </p>
              <p className={cn('text-xs truncate', isDark ? 'text-slate-300' : 'text-slate-700')}>
                {activePinnedMsg?.content || (activePinnedMsg?.type ? `(${activePinnedMsg.type} message)` : 'Jump to pinned message')}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {pinnedIds.length > 1 && (
              <button
                type="button"
                onClick={() => setPinnedBannerIndex((i) => (i + 1) % pinnedIds.length)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                  isDark ? 'bg-white/10 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                Next
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setInfoTab('pinned');
                openInfoPanel();
              }}
              aria-label="View all pinned messages"
              className={cn(
                'px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                isDark ? 'text-purple-300 hover:bg-white/10' : 'text-purple-700 hover:bg-purple-50'
              )}
            >
              All
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 overscroll-contain max-w-4xl w-full mx-auto" aria-live="polite">
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
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50 transition-colors',
                isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-200/80 hover:bg-gray-300/80 text-gray-700'
              )}
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
              currentUid={uid}
              senderName={resolveSenderLabel(msg, isOwn)}
              senderAvatar={conversation?.participantAvatars?.[msg.senderId]}
              onReaction={handleReaction}
              onDelete={async () => {
                try {
                  await getMessagingService().deleteMessage?.(msg.id, conversationId, uid);
                } catch (err) {
                  toastError(err?.message || 'Could not delete the message.');
                }
              }}
              onSave={toggleSaveMessage}
              isSaved={Boolean(savedIds[msg.id])}
              onReply={handleReply}
              onForward={openForwardPicker}
              onEdit={isOwn ? handleEdit : undefined}
              onPin={isOwn || conversation?.participantCount > 2 ? handleTogglePin : undefined}
              onJumpToMessage={jumpToMessage}
              onOpenViewOnce={handleOpenViewOnce}
              openedViewOnceIds={openedViewOnceIds}
              onNavigate={navigate}
              isPinned={pinnedIds.includes(msg.id)}
              onReport={(m) => { setReportTarget(m); setReportReason(''); setReportDetails(''); }}
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
            type="button"
            onClick={() => {
              try {
                messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
              } catch { /* noop */ }
              bottomCountRef.current = messagesRef.current?.length || 0;
              setNewSinceScroll(0);
              setAtBottom(true);
            }}
            className="sticky bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-arvdoul-gradient text-white text-xs font-bold shadow-lg hover:opacity-95 transition-opacity tabular-nums"
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
                type="button"
                onClick={() => setShowInfoPanel(false)}
                aria-label="Close details"
                className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* 1:1 Peer Identity, Standing & Ecosystem Actions */}
            {otherParticipants.length === 1 && (
              <div
                className={cn(
                  'rounded-2xl border p-3.5 mb-4 space-y-3',
                  isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn('relative shrink-0 rounded-full', peerMeta?.hasVibe && 'p-[2px]')}
                    style={peerMeta?.hasVibe ? { background: BRAND_GRADIENT } : undefined}
                  >
                    <LazyImage
                      src={headerAvatar}
                      alt={title}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-sm truncate">{title}</span>
                      {peerMeta?.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {peerMeta?.level && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-500 dark:text-purple-300">
                          Lv.{peerMeta.level}{peerMeta.rank ? ` · ${peerMeta.rank}` : ''}
                        </span>
                      )}
                      {presenceText && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {presenceText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoPanel(false);
                      navigate(`/profile/${otherParticipants[0]}`);
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors',
                      isDark ? 'border-white/15 hover:bg-white/10 text-slate-200' : 'border-slate-200 hover:bg-white text-slate-800'
                    )}
                  >
                    <UserIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>View Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoPanel(false);
                      navigate(`/gift/${otherParticipants[0]}`);
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 transition-all"
                  >
                    <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send Gift</span>
                  </button>
                </div>
              </div>
            )}

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
                    type="button"
                    onClick={() => setInfoTab(tab.id)}
                    aria-pressed={infoTab === tab.id}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
                      infoTab === tab.id
                        ? 'bg-arvdoul-gradient text-white shadow'
                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {infoPanelError && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300" role="alert">
                {infoPanelError}
              </div>
            )}

            {infoTab === 'pinned' && (
              <div className="space-y-2">
                {pinnedMessages.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No pinned messages yet</p>
                ) : (
                  pinnedMessages.map((p) => {
                    const pid = typeof p === 'string' ? p : p.id;
                    const msgObj = typeof p === 'string' ? null : p;
                    const sender = msgObj ? resolveSenderLabel(msgObj, msgObj.senderId === uid) : 'Pinned message';
                    const preview = msgObj?.content || (msgObj?.type ? `(${msgObj.type} message)` : 'Jump to message');
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => jumpToMessage(pid)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl text-xs border transition-colors',
                          isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-slate-50 border-slate-200 hover:border-purple-400'
                        )}
                      >
                        <span className="font-semibold block">{sender}</span>
                        <span className="block text-slate-500 dark:text-slate-400 mt-0.5 truncate">{preview}</span>
                      </button>
                    );
                  })
                )}
                {conversation?.type === 'group' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoPanel(false);
                      navigate(`/messages/${conversationId}/info`);
                    }}
                    className={cn(
                      'w-full mt-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors',
                      isDark ? 'border-white/15 text-slate-200 hover:bg-white/10' : 'border-slate-200 text-slate-800 hover:bg-slate-100'
                    )}
                  >
                    Group info & members
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowInfoPanel(false);
                    navigate(`/messages/${conversationId}/settings`);
                  }}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold border border-purple-500/40 text-arvdoul-purple dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                >
                  Conversation settings
                </button>
              </div>
            )}

            {infoTab === 'media' && (
              <div>
                {sharedMedia.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No shared media yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {sharedMedia.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => jumpToMessage(m.id)}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/10"
                        aria-label={`Open media message ${m.id}`}
                      >
                        {m.media?.url || m.media?.downloadUrl ? (
                          <LazyImage src={m.media.url || m.media.downloadUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
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
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No saved messages yet — long-press a message and choose Save</p>
                ) : (
                  <div className="space-y-2">
                    {savedMessages.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => jumpToMessage(m.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl text-xs border',
                          isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <span className="text-gray-500 dark:text-gray-400 block mb-0.5">
                          {resolveSenderLabel(m, m.senderId === uid)} · {m.createdAt?.toDate ? format(m.createdAt.toDate(), 'p') : ''}
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
                    type="button"
                    onClick={runSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-arvdoul-gradient text-white text-xs font-bold disabled:opacity-50"
                  >
                    {searching ? '…' : 'Search'}
                  </button>
                </div>
                {searchResults && (
                  <div className="space-y-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No results</p>
                    ) : (
                      searchResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => jumpToMessage(r.id)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl text-xs border',
                            isDark ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <span className="text-gray-500 dark:text-gray-400 block mb-0.5">
                            {resolveSenderLabel(r, r.senderId === uid)} · {r.createdAt?.toDate ? format(r.createdAt.toDate(), 'p') : ''}
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

      {/* Message report dialog — reasons mirror the shared report taxonomy */}
      {reportTarget && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Report message">
          <div
            className={cn(
              'w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 space-y-4 max-h-[85vh] overflow-y-auto',
              isDark ? 'bg-[#0f172a] border-white/10 text-gray-100' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Report message</h2>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                aria-label="Close report dialog"
                className={cn('p-2 rounded-full', isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-slate-500')}>
              Your report is confidential. Choose the reason that best applies.
            </p>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReportReason(r.value)}
                  aria-pressed={reportReason === r.value}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                    reportReason === r.value
                      ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                      : isDark ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea aria-label="Add details (optional)"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Add details (optional)"
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-arvdoul-purple/50',
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              )}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold', isDark ? 'bg-white/10' : 'bg-slate-100')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={submittingReport || !reportReason}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white disabled:opacity-50"
              >
                {submittingReport ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply banner — inset surface, no thick left accent border */}
      {replyTo && (
        <div className={cn('max-w-4xl mx-auto w-full px-3')}>
          <div className={cn(
            'flex items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2',
            isDark ? 'bg-[#090F2D] border-purple-500/30' : 'bg-purple-50/70 border-purple-200'
          )}>
            <Reply className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-purple-400">Replying to {replyTo.senderName}</p>
              <p className="text-[11px] truncate opacity-75">{replyTo.content || '(media message)'}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className={cn('p-1.5 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600')}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {typingText && !loading && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-1 text-[11px] text-purple-400">
          {typingText}
        </div>
      )}

      {/* Input */}
      <div className="max-w-4xl mx-auto w-full">
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          onTyping={handleTyping}
          onOpenGift={otherParticipants.length === 1 ? () => navigate(`/gift/${otherParticipants[0]}`) : undefined}
          theme={isDark ? 'dark' : 'light'}
          disabled={!conversation}
        />
      </div>

      {/* View-once ephemeral media modal */}
      {activeViewOnce && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="View once media"
        >
          <div className="w-full max-w-2xl flex items-center justify-between mb-3 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <EyeOff className="w-4 h-4" aria-hidden="true" />
              <span>View-once media · Closes permanently after viewing</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveViewOnce(null)}
              aria-label="Close view once media"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="max-w-2xl max-h-[80vh] w-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
            {(activeViewOnce.media?.mediaKind === 'video' || activeViewOnce.media?.mimeType?.startsWith('video/')) ? (
              <video
                src={activeViewOnce.media?.url || activeViewOnce.media?.downloadUrl}
                controls
                autoPlay
                className="max-w-full max-h-[75vh] object-contain"
              />
            ) : (
              <LazyImage
                src={activeViewOnce.media?.url || activeViewOnce.media?.downloadUrl}
                alt={activeViewOnce.content || 'View-once photo'}
                className="max-w-full max-h-[75vh] object-contain"
              />
            )}
          </div>
          {activeViewOnce.content && (
            <p className="mt-3 text-sm text-white/90 text-center max-w-lg">
              {activeViewOnce.content}
            </p>
          )}
        </div>
      )}

      {/* Forward picker */}
      {forwardTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !forwarding && setForwardTarget(null)}>
          <div
            className={cn('w-full sm:max-w-md max-h-[70vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col', isDark ? 'bg-[#0B0F17] border border-white/10' : 'bg-white border border-gray-200')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn('flex items-center justify-between px-4 py-3 border-b', isDark ? 'border-white/10' : 'border-gray-200')}>
              <h3 className="font-bold text-sm">Forward to</h3>
              <button type="button" onClick={() => setForwardTarget(null)} aria-label="Close" className={cn('p-1.5 rounded-full', isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100')}>
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {forwardConversations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No other conversations to forward to.</p>
              ) : (
                forwardConversations.map((c) => {
                  const other = (c.participantDetails || []).find((p) => p.id !== uid);
                  const name = c.title || other?.displayName || other?.name || 'Conversation';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={forwarding}
                      onClick={() => handleForwardTo(c.id)}
                      className={cn('w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors', isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100')}
                    >
                      <div className="w-9 h-9 rounded-full bg-arvdoul-gradient flex items-center justify-center text-white text-xs font-bold">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/** Tiny local toast helper (avoids importing sonner at module top for tree-shaking). */
function toastError(message) {
  // Deferred import keeps the initial bundle lean.
  import('sonner').then(({ toast }) => toast.error(message)).catch(() => {});
}

function toastSuccess(message) {
  import('sonner').then(({ toast }) => toast.success(message)).catch(() => {});
}
