// src/screens/ChatScreen.jsx - ARVDOUL REAL-TIME MESSAGING (PRODUCTION)
// Full conversation experience: list + thread + composer, powered by the
// hardened messagingStore (E2EE, offline queue, idempotency, cursor paging).
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { useMessagingStore } from '../store/messagingStore';
import MessageBubble from '../components/messaging/MessageBubble';
import MessageInput from '../components/messaging/MessageInput';
import ConversationItem from '../components/messaging/ConversationItem';
import { cn } from '../lib/utils';
import {
  ArrowLeft, MessageSquare, Search, WifiOff, Loader2, Users, RefreshCw
} from 'lucide-react';

export default function ChatScreen() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    conversations,
    conversationsLoading,
    conversationsError,
    loadConversations,
    messages,
    messagesLoading,
    messagesError,
    loadMessages,
    sendMessage,
    reactToMessage,
    deleteMessage,
  } = useMessagingStore();

  const [showList, setShowList] = useState(!conversationId); // mobile list vs thread
  const [searchQuery, setSearchQuery] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const threadRef = useRef(null);

  // Online/offline awareness
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load conversation list
  useEffect(() => {
    if (user?.uid) loadConversations(user.uid);
  }, [user?.uid, loadConversations]);

  // Load the active thread
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
      setShowList(false);
    }
  }, [conversationId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, conversationId]);

  const activeMessages = useMemo(
    () => (conversationId ? messages[conversationId] || [] : []),
    [messages, conversationId]
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) || null,
    [conversations, conversationId]
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const names = (c.participantDetails || []).map((p) => (p.displayName || p.username || '').toLowerCase());
      const title = (c.title || '').toLowerCase();
      return title.includes(q) || names.some((n) => n.includes(q));
    });
  }, [conversations, searchQuery]);

  const handleSend = useCallback(async (messageData) => {
    if (!user?.uid || !conversationId) return;
    try {
      await sendMessage(
        conversationId,
        messageData,
        user.uid,
        user.displayName || userProfileName(user) || 'User',
        user.photoURL || null
      );
    } catch (err) {
      toast.error(err?.message || 'Message could not be sent.');
    }
  }, [user, conversationId, sendMessage]);

  const handleSendMedia = useCallback(async ({ file }) => {
    if (!user?.uid || !conversationId) return;
    try {
      const media = { file, name: file.name, type: file.type };
      await sendMessage(conversationId, { type: 'media', media }, user.uid, user.displayName || 'User', user.photoURL || null);
    } catch (err) {
      toast.error('Media could not be sent.');
    }
  }, [user, conversationId, sendMessage]);

  const handleReaction = useCallback(async (conversationId, messageId, emoji) => {
    if (!user?.uid) return;
    try { await reactToMessage(conversationId, messageId, user.uid, emoji); } catch (err) { /* non-blocking */ }
  }, [user?.uid, reactToMessage]);

  const handleDelete = useCallback(async (messageId, forEveryone = false) => {
    if (!user?.uid || !conversationId) return;
    try { await deleteMessage(conversationId, messageId, user.uid, forEveryone); } catch (err) { toast.error('Could not delete message.'); }
  }, [user?.uid, conversationId, deleteMessage]);

  const openThread = (id) => {
    navigate(`/messages/${id}`);
  };

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
    input: isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200',
  };

  return (
    <div className={cn("h-full w-full flex overflow-hidden", colors.bg)}>
      {/* ============ CONVERSATION LIST PANE ============ */}
      <div
        className={cn(
          "w-full sm:w-80 lg:w-96 shrink-0 border-r flex-col",
          showList ? "flex" : "hidden sm:flex",
          colors.card, "border"
        )}
      >
        {/* List header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className={cn("text-xl font-bold flex items-center gap-2", colors.text)}>
              <MessageSquare className="w-5 h-5 text-violet-500" /> Messages
            </h1>
            <button
              onClick={() => loadConversations(user?.uid, { refresh: true })}
              aria-label="Refresh conversations"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <RefreshCw className="w-4 h-4 text-violet-500" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations"
              className={cn("w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500", colors.input, colors.text)}
            />
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className={cn("w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center", isDark ? "bg-gray-800" : "bg-gray-100")}>
                <MessageSquare className="w-7 h-7 text-gray-400" />
              </div>
              <p className={cn("font-medium", colors.text)}>{conversations.length === 0 ? 'No conversations yet' : 'No matches'}</p>
              <p className={cn("text-sm mt-1", colors.secondary)}>Start a new conversation from the menu.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === conversationId}
                onPress={() => openThread(conv.id)}
              />
            ))
          )}
          {conversationsError && (
            <p className={cn("text-xs text-center py-3 px-4", colors.secondary)}>{conversationsError.message || 'Could not load conversations.'}</p>
          )}
        </div>
      </div>

      {/* ============ THREAD PANE ============ */}
      <div className={cn("flex-1 flex-col min-w-0", conversationId ? "flex" : "hidden sm:flex")}>
        {!conversationId ? (
          /* No thread selected (desktop) */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={cn("w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center", isDark ? "bg-gray-800" : "bg-gray-100")}>
                <Users className="w-9 h-9 text-gray-400" />
              </div>
              <p className={cn("font-semibold", colors.text)}>Select a conversation</p>
              <p className={cn("text-sm mt-1", colors.secondary)}>Choose a chat to start messaging.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className={cn("flex items-center gap-3 px-4 py-3 border-b", colors.card, "border")}>
              <button
                onClick={() => { setShowList(true); navigate('/messages'); }}
                aria-label="Back to conversations"
                className="sm:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold truncate", colors.text)}>
                  {activeConversation?.title || (activeConversation?.participantDetails || []).map((p) => p.displayName || p.username).filter(Boolean).join(', ') || 'Conversation'}
                </p>
                <p className={cn("text-xs flex items-center gap-1", colors.secondary)}>
                  {!online && <WifiOff className="w-3 h-3 text-amber-500" />}
                  {online ? 'Online' : 'Offline — messages will sync when you reconnect'}
                </p>
              </div>
              {activeConversation?.type === 'group' && (
                <span className={cn("text-xs px-2 py-1 rounded-full", isDark ? "bg-violet-500/20 text-violet-300" : "bg-violet-100 text-violet-700")}>
                  {activeConversation.participants?.length || 0} members
                </span>
              )}
            </div>

            {/* Messages */}
            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {messagesLoading[conversationId] && activeMessages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className={cn("font-medium", colors.text)}>No messages yet</p>
                  <p className={cn("text-sm mt-1", colors.secondary)}>Say hello! 👋</p>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === user?.uid}
                    senderName={msg.senderName}
                    senderAvatar={msg.senderPhoto}
                    isGroup={activeConversation?.type === 'group'}
                    onReaction={(payload) => handleReaction(conversationId, payload.messageId, payload.emoji)}
                    onDelete={(mid) => handleDelete(mid, false)}
                    theme={theme}
                  />
                ))
              )}
              {messagesError[conversationId] && (
                <p className={cn("text-xs text-center py-2", colors.secondary)}>Could not load messages — pull to retry.</p>
              )}
            </div>

            {/* Composer */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800">
              <MessageInput
                conversationId={conversationId}
                onSendMessage={handleSend}
                onSendMedia={handleSendMedia}
                theme={theme}
                disabled={!online}
                placeholder={online ? 'Message...' : 'Offline — messages queued'}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function userProfileName(user) {
  return user?.displayName || user?.username || null;
}
