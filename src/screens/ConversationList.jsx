// src/screens/ConversationList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { messagingService } from '../services/messagesService.js';
import { Search, Plus, MoreVertical, CheckCheck, Clock } from 'lucide-react';

export default function ConversationList({ onSelectConversation, selectedConversationId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subscriptionId, setSubscriptionId] = useState(null);
  
  // Load conversations
  useEffect(() => {
    if (!user) return;
    
    const loadConversations = async () => {
      try {
        setLoading(true);
        const result = await messagingService.getUserConversations(user.uid, {
          limit: 50,
          cacheFirst: true
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
      if (update.type === 'conversations_update') {
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
    if (!searchQuery) return conversations;
    
    return conversations.filter(conv => {
      if (conv.type === 'direct') {
        // For direct messages, we'd need participant details
        return conv.lastMessage?.text?.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             conv.description?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);
  
  const handleCreateNewChat = () => {
    navigate('/messages/new');
  };
  
  if (loading && conversations.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
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
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chats</h2>
          <button
            onClick={handleCreateNewChat}
            className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No conversations found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery ? 'Try a different search term' : 'Start a new conversation to get started'}
            </p>
            <button
              onClick={handleCreateNewChat}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              New Chat
            </button>
          </div>
        ) : (
          filteredConversations.map(conversation => {
            const unreadCount = conversation.unreadCounts?.[user.uid] || 0;
            
            return (
              <div
                key={conversation.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                  selectedConversationId === conversation.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10'
                    : ''
                }`}
                onClick={() => onSelectConversation && onSelectConversation(conversation)}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {conversation.type === 'group' 
                        ? 'G'
                        : conversation.name?.charAt(0) || 'U'}
                    </div>
                    {conversation.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                    )}
                  </div>
                  
                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {conversation.type === 'group' 
                          ? conversation.name || `Group (${conversation.participantCount})`
                          : conversation.name || 'User'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {conversation.lastActivity?.toDate?.()?.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        }) || ''}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conversation.lastMessage?.text || 'No messages yet'}
                      </div>
                      
                      {unreadCount > 0 && (
                        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}