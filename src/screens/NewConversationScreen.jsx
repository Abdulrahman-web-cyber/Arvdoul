// src/screens/NewConversationScreen.jsx
// 🎯 Create new conversation screen (Web version - React Router)

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import messagingService from '../services/messagesService';
import userService from '../services/userService';
import useMessagingStore from '../store/messagingStore';
import { cn } from '../lib/utils';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { X, Search, UserPlus, Loader2, ArrowLeft } from 'lucide-react';

const NewConversationScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { loadConversations } = useMessagingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);

  // Load friends on mount
  React.useEffect(() => {
    if (!user) return;
    const loadFriends = async () => {
      try {
        setLoadingFriends(true);
        const result = await userService.getUserFriends(user.uid, { limit: 50 });
        if (result.success) {
          setFriends(result.friends || []);
        }
      } catch (error) {
        console.error('Failed to load friends:', error);
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriends();
  }, [user]);

  // Search users
  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      try {
        setSearching(true);
        const result = await userService.searchUsers(debouncedQuery, { limit: 20 });
        if (result.success) {
          setSearchResults(result.users || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const toggleUserSelection = useCallback((userToToggle) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.uid === userToToggle.uid);
      if (exists) {
        return prev.filter((u) => u.uid !== userToToggle.uid);
      } else {
        return [...prev, userToToggle];
      }
    });
  }, []);

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      setLoading(true);
      const participants = selectedUsers.map((u) => u.uid);
      
      let options = {};
      if (selectedUsers.length > 1) {
        options = {
          type: 'group',
          name: groupName || `Group with ${selectedUsers.map((u) => u.displayName).join(', ')}`,
        };
        if (groupPhoto) {
          options.photoURL = groupPhoto;
        }
      } else {
        options = { type: 'direct' };
      }

      const result = await messagingService.createConversation(participants, options);
      
      if (result.success) {
        await loadConversations(user.uid);
        toast.success('Conversation created');
        navigate(`/messages/${result.conversation.id}`);
      } else {
        toast.error('Failed to create conversation');
      }
    } catch (error) {
      toast.error('Error creating conversation');
      console.error('Creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayUsers = debouncedQuery.trim() ? searchResults : friends;
  const isGroup = selectedUsers.length > 1;

  return (
    <div className={cn(
      'flex flex-col h-full',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      {/* Header */}
      <div className={cn(
        'border-b p-4 flex items-center justify-between',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/messages')}
            className={cn(
              'p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors'
            )}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className={cn(
            'text-xl font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            New Conversation
          </h1>
        </div>
        <button
          onClick={handleCreateConversation}
          disabled={selectedUsers.length === 0 || loading}
          className={cn(
            'px-4 py-2 rounded-full font-medium transition-colors',
            selectedUsers.length > 0 && !loading
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Create'
          )}
        </button>
      </div>

      {/* Selected users chips */}
      {selectedUsers.length > 0 && (
        <div className={cn(
          'border-b p-4 flex flex-wrap gap-2',
          theme === 'dark' ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        )}>
          {selectedUsers.map((u) => (
            <div
              key={u.uid}
              className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-full',
                theme === 'dark'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-600/50'
                  : 'bg-purple-100 text-purple-900 border border-purple-300'
              )}
            >
              <span className="text-sm">{u.displayName}</span>
              <button
                onClick={() => toggleUserSelection(u)}
                className="p-0 hover:scale-110 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Group settings (if group) */}
      {isGroup && (
        <div className={cn(
          'border-b p-4 space-y-3',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className={cn(
              'w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
              theme === 'dark'
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-gray-100 text-gray-900 border border-gray-200'
            )}
          />
        </div>
      )}

      {/* Search bar */}
      <div className={cn(
        'border-b p-4',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="relative">
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
              theme === 'dark'
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'bg-gray-100 text-gray-900 border border-gray-200'
            )}
          />
        </div>
      </div>

      {/* Users list */}
      <div className="flex-1 overflow-y-auto">
        {loadingFriends && !debouncedQuery ? (
          <div className="p-4 text-center text-gray-500">
            Loading friends...
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className={cn(
              'w-12 h-12 mx-auto mb-3 opacity-50',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )} />
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {debouncedQuery ? 'No users found' : 'No friends yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
            {displayUsers.map((u) => {
              const isSelected = selectedUsers.some((su) => su.uid === u.uid);
              return (
                <button
                  key={u.uid}
                  onClick={() => toggleUserSelection(u)}
                  className={cn(
                    'w-full p-4 text-left transition-colors flex items-center gap-3',
                    isSelected
                      ? (theme === 'dark'
                        ? 'bg-purple-600/20 hover:bg-purple-600/30'
                        : 'bg-purple-100 hover:bg-purple-200')
                      : (theme === 'dark'
                        ? 'hover:bg-gray-800'
                        : 'hover:bg-gray-50')
                  )}
                >
                  <div className="relative">
                    {u.photoURL ? (
                      <img
                        src={u.photoURL}
                        alt={u.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {u.displayName?.[0]?.toUpperCase()}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-full ring-2 ring-purple-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {u.displayName}
                    </div>
                    <div className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      @{u.username || u.uid.substring(0, 8)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewConversationScreen;