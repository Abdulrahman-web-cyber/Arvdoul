// src/screens/ConversationList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { messagingService } from '../services/messagesService.js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  MoreVertical, 
  Pin, 
  VolumeX,
  Star,
  Crown,
  Users,
  Lock
} from 'lucide-react';

const ConversationItem = React.memo(({ 
  conversation, 
  isSelected, 
  onClick,
  currentUserId 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const unreadCount = conversation.unreadCounts?.[currentUserId] || 0;
  const isMuted = conversation.mutedBy?.includes(currentUserId);
  const isPinned = conversation.pinnedBy?.includes(currentUserId);
  const isGroup = conversation.type === 'group';
  
  const getDisplayName = () => {
    if (isGroup) {
      return conversation.name || `Group (${conversation.participantCount})`;
    }
    
    // For direct messages, we need participant details
    if (conversation.participantDetails) {
      const otherUser = conversation.participantDetails.find(p => p.uid !== currentUserId);
      return otherUser?.displayName || 'Unknown User';
    }
    
    return 'User';
  };
  
  const getAvatar = () => {
    if (isGroup) {
      return conversation.photoURL || '/assets/default-group.png';
    }
    
    if (conversation.participantDetails) {
      const otherUser = conversation.participantDetails.find(p => p.uid !== currentUserId);
      return otherUser?.photoURL || '/assets/default-profile.png';
    }
    
    return '/assets/default-profile.png';
  };
  
  const getLastMessagePreview = () => {
    if (!conversation.lastMessage) return 'Start a conversation';
    
    const senderPrefix = conversation.lastMessage.senderId === currentUserId 
      ? 'You: ' 
      : isGroup && conversation.lastMessage.senderName
        ? `${conversation.lastMessage.senderName}: `
        : '';
    
    let content = conversation.lastMessage.text || '';
    
    switch (conversation.lastMessage.type) {
      case 'image':
        content = '📷 Photo';
        break;
      case 'video':
        content = '🎬 Video';
        break;
      case 'voice':
        content = '🎤 Voice message';
        break;
      case 'gift':
        content = '🎁 Gift';
        break;
      case 'file':
        content = '📎 File';
        break;
    }
    
    return senderPrefix + (content.length > 30 ? content.substring(0, 30) + '...' : content);
  };
  
  const getLastActivityTime = () => {
    if (!conversation.lastActivity) return '';
    
    const date = conversation.lastActivity.toDate ? 
      conversation.lastActivity.toDate() : 
      new Date(conversation.lastActivity);
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };
  
  return (
    <motion.div
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={`relative p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-l-4 border-blue-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
      }`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center space-x-3">
        {/* Avatar */}
        <div className="relative">
          <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 ${
            isSelected ? 'border-blue-500' : 'border-white dark:border-gray-800'
          } shadow-lg`}>
            <img 
              src={getAvatar()} 
              alt={getDisplayName()}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Online indicator */}
          {conversation.isOnline && !isGroup && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
          )}
          
          {/* Group indicator */}
          {isGroup && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
              <Users className="w-2 h-2 text-white" />
            </div>
          )}
          
          {/* Premium indicator */}
          {conversation.isPremium && (
            <div className="absolute -top-1 -right-1">
              <Crown className="w-4 h-4 text-yellow-500" />
            </div>
          )}
        </div>
        
        {/* Conversation Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-gray-900 dark:text-white truncate flex items-center space-x-2">
              <span>{getDisplayName()}</span>
              {isMuted && <VolumeX className="w-4 h-4 text-gray-400" />}
              {isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {getLastActivityTime()}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400 truncate flex items-center space-x-2">
              <span>{getLastMessagePreview()}</span>
              
              {/* Message status */}
              {conversation.lastMessage?.senderId === currentUserId && (
                <span className="text-blue-500">
                  {conversation.lastMessage?.readBy?.length > 0 ? (
                    <CheckCheck className="w-4 h-4" />
                  ) : conversation.lastMessage?.deliveredTo?.length > 0 ? (
                    <CheckCheck className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Check className="w-4 h-4 text-gray-400" />
                  )}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Unread badge */}
              {unreadCount > 0 && (
                <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
              
              {/* Starred */}
              {conversation.isStarred && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
              
              {/* Lock icon for private chats */}
              {conversation.isPrivate && (
                <Lock className="w-3 h-3 text-gray-400" />
              )}
            </div>
          </div>
          
          {/* Typing indicator */}
          {conversation.isTyping && (
            <div className="flex items-center space-x-1 mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200" />
              <span className="text-xs text-blue-500 ml-1">typing...</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Hover actions */}
      <AnimatePresence>
        {isHovered && !isSelected && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default function ConversationList({ onSelectConversation, selectedConversationId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, groups, direct
  const [subscriptionId, setSubscriptionId] = useState(null);
  
  // Load conversations
  useEffect(() => {
    if (!user) return;
    
    const loadConversations = async () => {
      try {
        setLoading(true);
        const result = await messagingService.getUserConversations(user.uid, {
          limit: 100,
          cacheFirst: true,
          loadParticipants: true
        });
        
        if (result.success) {
          setConversations(result.conversations);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadConversations();
    
    // Subscribe to real-time updates
    const subId = messagingService.subscribeToUserConversations(user.uid, (update) => {
      if (update.type === 'CONVERSATIONS_UPDATE') {
        setConversations(update.conversations);
      }
    });
    
    setSubscriptionId(subId);
    
    return () => {
      if (subId) messagingService.unsubscribe(subId);
    };
  }, [user]);
  
  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        if (conv.type === 'group') {
          return conv.name?.toLowerCase().includes(query) ||
                 conv.description?.toLowerCase().includes(query);
        } else {
          return conv.participantDetails?.some(p => 
            p.displayName?.toLowerCase().includes(query) ||
            p.username?.toLowerCase().includes(query)
          );
        }
      });
    }
    
    // Apply type filter
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(conv => conv.unreadCounts?.[user.uid] > 0);
        break;
      case 'groups':
        filtered = filtered.filter(conv => conv.type === 'group');
        break;
      case 'direct':
        filtered = filtered.filter(conv => conv.type === 'direct');
        break;
      case 'pinned':
        filtered = filtered.filter(conv => conv.pinnedBy?.includes(user.uid));
        break;
    }
    
    // Sort by last activity
    return filtered.sort((a, b) => {
      const aTime = a.lastActivity?.toDate?.()?.getTime() || 0;
      const bTime = b.lastActivity?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
  }, [conversations, searchQuery, filter, user]);
  
  const handleCreateNewChat = () => {
    navigate('/messages/new');
  };
  
  if (loading && conversations.length === 0) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
          {['all', 'unread', 'groups', 'direct', 'pinned'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                filter === filterType
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {filteredConversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full p-8 text-center"
            >
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                {searchQuery 
                  ? 'Try a different search term or create a new conversation'
                  : 'Start messaging to connect with friends, family, and colleagues'}
              </p>
              <button
                onClick={handleCreateNewChat}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity shadow-lg font-medium"
              >
                Start New Conversation
              </button>
            </motion.div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onClick={() => onSelectConversation && onSelectConversation(conversation)}
                currentUserId={user.uid}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}