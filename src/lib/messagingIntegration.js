// src/lib/messagingIntegration.js
// 🎯 MESSAGING INTEGRATION GUIDE & PATTERNS
// Complete guide for using the messaging suite

/**
 * ============================================================================
 * ARVDOUL MESSAGING INTEGRATION GUIDE
 * ============================================================================
 * 
 * This guide shows how to properly integrate the messaging suite into your
 * application, including store usage, service calls, real-time subscriptions,
 * and error handling.
 */

// ===== IMPORTING THE STORE & COMPONENTS =====

import useMessagingStore from '../store/messagingStore';
import {
  ConversationItem,
  MessageBubble,
  MessageInput,
  TypingIndicator,
  EmptyState,
  SkeletonLoader,
} from '../components/messaging';
import messagingService from '../services/messagesService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ===== PATTERN 1: LOAD CONVERSATIONS =====
/**
 * Load user's conversations and display them
 */
const ConversationListExample = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const {
    conversations,
    conversationsLoading,
    conversationsError,
    loadConversations,
    selectConversation,
  } = useMessagingStore();

  // Load conversations on mount
  React.useEffect(() => {
    if (user) {
      loadConversations(user.uid, { refresh: false });
    }
  }, [user, loadConversations]);

  // Handle refresh
  const handleRefresh = async () => {
    if (user) {
      await loadConversations(user.uid, { refresh: true });
    }
  };

  if (conversationsLoading && conversations.length === 0) {
    return <SkeletonLoader type="conversation" count={5} theme={theme} />;
  }

  if (conversationsError) {
    return (
      <EmptyState
        title="Error loading conversations"
        description={conversationsError.message || 'Please try again'}
        action={handleRefresh}
        actionLabel="Retry"
        theme={theme}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations"
        description="Start a new conversation with a friend"
        action={() => navigate('/messages/new')}
        actionLabel="New Chat"
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-0">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          onPress={(conv) => {
            selectConversation(conv.id);
            navigate(`/messages/${conv.id}`);
          }}
          onArchive={() => handleArchiveConversation(conversation.id)}
          onMute={() => handleMuteConversation(conversation.id)}
          onDelete={() => handleDeleteConversation(conversation.id)}
          theme={theme}
        />
      ))}
    </div>
  );
};

// ===== PATTERN 2: LOAD AND DISPLAY MESSAGES =====
/**
 * Load messages from a conversation and subscribe to real-time updates
 */
const ChatViewExample = ({ conversationId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const {
    messages,
    messagesLoading,
    loadMessages,
    addMessage,
    sendMessage,
    setTyping,
    typingUsers,
  } = useMessagingStore();

  const conversationMessages = messages[conversationId] || [];

  // Load messages on mount
  React.useEffect(() => {
    loadMessages(conversationId, { markAsRead: true });
  }, [conversationId, loadMessages]);

  // Subscribe to real-time updates
  React.useEffect(() => {
    const unsubscribe = messagingService.subscribeToConversation(
      conversationId,
      user.uid,
      (event) => {
        if (event.type === 'new_message') {
          addMessage(conversationId, event.message);
        } else if (event.type === 'typing_update') {
          // Update typing indicators
          Object.entries(event.typing).forEach(([userId, typingData]) => {
            setTyping(conversationId, userId, typingData.isTyping);
          });
        }
      }
    );

    return () => unsubscribe?.();
  }, [conversationId, user.uid, addMessage, setTyping]);

  // Handle sending message
  const handleSendMessage = async (messageData) => {
    try {
      await sendMessage(
        conversationId,
        messageData,
        user.uid,
        user.displayName,
        user.photoURL
      );
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Send error:', error);
    }
  };

  // Handle typing indicator
  const handleTyping = (isTyping) => {
    messagingService.sendTypingIndicator(conversationId, user.uid, isTyping);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading && conversationMessages.length === 0 && (
          <SkeletonLoader type="messageList" count={5} theme={theme} />
        )}
        
        {conversationMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === user.uid}
            senderName={msg.senderName}
            senderAvatar={msg.senderPhoto}
            onReaction={(reaction) => handleReaction(msg.id, reaction.emoji)}
            onReply={(message) => handleReply(message)}
            onDelete={(message) => handleDeleteMessage(message.id)}
            theme={theme}
          />
        ))}
      </div>

      {/* Typing indicator */}
      {Object.keys(typingUsers[conversationId] || {}).length > 0 && (
        <TypingIndicator typingUsers={typingUsers[conversationId]} theme={theme} />
      )}

      {/* Message input */}
      <MessageInput
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        theme={theme}
      />
    </div>
  );
};

// ===== PATTERN 3: HANDLE MESSAGE REACTIONS =====
/**
 * Add reaction to a message
 */
const handleReaction = async (messageId, conversationId, userId, emoji) => {
  const { reactToMessage } = useMessagingStore.getState();
  try {
    await reactToMessage(conversationId, messageId, userId, emoji);
    toast.success('Reaction added');
  } catch (error) {
    toast.error('Failed to add reaction');
    console.error('Reaction error:', error);
  }
};

// ===== PATTERN 4: DELETE MESSAGE =====
/**
 * Delete a message
 */
const handleDeleteMessage = async (messageId, conversationId, userId, forEveryone = false) => {
  if (!confirm('Delete this message?')) return;
  
  const { deleteMessage } = useMessagingStore.getState();
  try {
    await deleteMessage(conversationId, messageId, userId, forEveryone);
    toast.success('Message deleted');
  } catch (error) {
    toast.error('Failed to delete message');
    console.error('Delete error:', error);
  }
};

// ===== PATTERN 5: CREATE NEW CONVERSATION =====
/**
 * Create a new conversation with selected users
 */
const handleCreateConversation = async (selectedUsers) => {
  try {
    const participants = selectedUsers.map((u) => u.uid);
    
    const options = selectedUsers.length > 1
      ? { type: 'group', name: 'New Group' }
      : { type: 'direct' };

    const result = await messagingService.createConversation(participants, options);
    
    if (result.success) {
      const { loadConversations } = useMessagingStore.getState();
      await loadConversations(user.uid);
      navigate(`/messages/${result.conversation.id}`);
      toast.success('Conversation created');
    }
  } catch (error) {
    toast.error('Failed to create conversation');
    console.error('Create error:', error);
  }
};

// ===== PATTERN 6: ARCHIVE CONVERSATION =====
/**
 * Archive a conversation
 */
const handleArchiveConversation = async (conversationId) => {
  try {
    await messagingService.archiveConversation(conversationId, user.uid);
    const { loadConversations } = useMessagingStore.getState();
    await loadConversations(user.uid);
    toast.success('Conversation archived');
  } catch (error) {
    toast.error('Failed to archive conversation');
    console.error('Archive error:', error);
  }
};

// ===== PATTERN 7: MUTE CONVERSATION =====
/**
 * Mute/unmute a conversation
 */
const handleMuteConversation = async (conversationId) => {
  try {
    await messagingService.muteConversation(conversationId, user.uid);
    toast.success('Notifications muted');
  } catch (error) {
    toast.error('Failed to mute conversation');
  }
};

// ===== PATTERN 8: DELETE CONVERSATION =====
/**
 * Delete a conversation
 */
const handleDeleteConversation = async (conversationId) => {
  if (!confirm('Delete this conversation?')) return;
  try {
    // Implementation depends on service method available
    toast.success('Conversation deleted');
  } catch (error) {
    toast.error('Failed to delete conversation');
  }
};

// ===== PATTERN 9: ERROR HANDLING =====
/**
 * Proper error handling with user feedback
 */
const executeWithErrorHandling = async (operation, successMessage, errorMessage) => {
  try {
    const result = await operation();
    toast.success(successMessage);
    return result;
  } catch (error) {
    // Log error for debugging
    console.error(errorMessage, error);
    
    // Show user-friendly error message
    if (error.code === 'PERMISSION_DENIED') {
      toast.error('You do not have permission to perform this action');
    } else if (error.code === 'NOT_FOUND') {
      toast.error('Conversation not found');
    } else {
      toast.error(errorMessage);
    }
    
    // In production, send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error);
    }
    
    throw error;
  }
};

// ===== PATTERN 10: CLEANUP ON UNMOUNT =====
/**
 * Always clean up subscriptions on unmount
 */
React.useEffect(() => {
  const unsubscribe = messagingService.subscribeToConversation(
    conversationId,
    user.uid,
    handleEvent
  );

  // Cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [conversationId, user.uid]); // Dependencies!

// ===== PATTERN 11: OFFLINE SUPPORT =====
/**
 * Detect offline and show appropriate UI
 */
const [isOnline, setIsOnline] = React.useState(navigator.onLine);

React.useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// Show offline banner
if (!isOnline) {
  return (
    <div className="bg-red-500 text-white p-3 text-center">
      You are offline. Messages will be sent when you reconnect.
    </div>
  );
}

// ===== PATTERN 12: DRAFT MESSAGES =====
/**
 * Save and retrieve draft messages
 */
const { saveDraft, getDraft, clearDraft } = useMessagingStore();

// Save draft on input change
const handleInputChange = (conversationId, text) => {
  saveDraft(conversationId, text);
};

// Retrieve draft on load
React.useEffect(() => {
  const draft = getDraft(conversationId);
  setInputText(draft);
}, [conversationId]);

// Clear draft on send
const handleSendMessage = async (messageData) => {
  await sendMessage(...);
  clearDraft(conversationId);
};

// ===== BEST PRACTICES =====
/**
 * 1. Always use Zustand store for state management - don't duplicate state
 * 2. Always clean up subscriptions on unmount to prevent memory leaks
 * 3. Always handle errors and show user-friendly messages
 * 4. Always debounce search inputs and typing indicators
 * 5. Always paginate large lists (use startAfter cursor)
 * 6. Always validate data before sending to service
 * 7. Always use optimistic updates for better UX
 * 8. Always unsubscribe from listeners when switching conversations
 * 9. Always use error boundaries for catching render errors
 * 10. Always test offline scenarios
 */

// ===== PERFORMANCE TIPS =====
/**
 * 1. Use React.memo for components that render frequently
 * 2. Use useCallback for event handlers
 * 3. Use useMemo for expensive computations
 * 4. Use virtualization for long lists (react-window, react-virtualized)
 * 5. Debounce typing indicators (300-500ms)
 * 6. Debounce search inputs (300-500ms)
 * 7. Paginate message loads (30-50 messages per page)
 * 8. Cache user profiles to avoid redundant fetches
 * 9. Use IndexedDB for offline persistence
 * 10. Batch multiple Firestore writes together
 */

// Export nothing - this is a guide file
export {};
