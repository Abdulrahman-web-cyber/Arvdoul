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
import { ArrowLeft, Lock, Users, Phone, Video, Info } from 'lucide-react';

const REACTION_TYPES = (MESSAGING_CONFIG && MESSAGING_CONFIG.REACTION_TYPES) || ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ChatScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'system';

  const uid = user?.uid;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [presence, setPresence] = useState({});
  const [sendingId, setSendingId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pendingRef = useRef(new Map()); // localId -> {convId, data}
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

  // Scroll to bottom on new messages (optional-chained: some runtimes lack it)
  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    } catch {
      /* noop */
    }
  }, [messages.length]);

  // Mark visible messages as read
  useEffect(() => {
    if (!conversationId || !uid || messages.length === 0) return;
    const timer = setTimeout(() => {
      const svc = getMessagingService();
      const latest = messages
        .filter((m) => !m._local && !m.isDeleted && m.senderId !== uid)
        .slice(0, 10);
      latest.forEach((m) => {
        svc.markMessageAsRead(m.id, conversationId, uid).catch(() => {});
      });
    }, 800);
    return () => clearTimeout(timer);
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
            onClick={() => navigate(`/messages/${conversationId}/settings`)}
            aria-label="Conversation info"
            className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700')}
          >
            <Info className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain" aria-live="polite">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              title="No messages yet"
              description="Say hello - your conversation starts here."
            />
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderId === uid || msg.sender === 'me';
          return (
            <MessageBubble
              key={msg.id}
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
              isGroup={conversation?.participantCount > 2}
              theme={theme}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </main>

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
          theme={theme}
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
