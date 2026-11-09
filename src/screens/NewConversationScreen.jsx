// src/screens/NewConversationScreen.jsx

import React, { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import messagingService from '../services/messagesService';
import userService from '../services/userService';
import useMessagingStore from '../store/messagingStore';
import { cn } from '../lib/utils';
import { getProfileUrl, getProfileHandle } from '../utils/shareUtils';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { X, Search, UserPlus, Loader2, ArrowLeft, Camera } from 'lucide-react';
import storageService from '../services/storageService';
import ErrorState from '../design-system/ErrorState.jsx';

const NewConversationScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { loadConversations } = useMessagingStore();

  const sharePostId = searchParams.get('sharePost');
  const shareProfileId = searchParams.get('shareProfile') || searchParams.get('profile');
  const toUserId = searchParams.get('to') || searchParams.get('userId') || searchParams.get('uid');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(Boolean(toUserId));
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [friendsError, setFriendsError] = useState(null);
  const [friendsNonce, setFriendsNonce] = useState(0);
  const [searchError, setSearchError] = useState(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef(null);

  // If a specific recipient UID was passed (e.g. from a user's profile "Message" button),
  // immediately create/retrieve the direct conversation and navigate straight to the chat.
  React.useEffect(() => {
    if (!user?.uid || !toUserId) return;
    let cancelled = false;

    const openDirectChat = async () => {
      try {
        setLoading(true);
        // Resolve profile first to make sure user exists
        await userService.getUserProfile(toUserId);
        if (cancelled) return;
        const result = await messagingService.startDirectConversation(toUserId, user.uid);
        if (result.status === 'request') {
          toast.info('Message request sent. You can chat once they accept.');
          navigate('/messages', { replace: true });
          return;
        }
        if (result.status === 'conversation' && result.conversationId) {
          const conversation = { id: result.conversationId };
          const sharePost = async () => {
            try {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              await messagingService.sendMessage(conversation.id, {
                type: 'text',
                content: `Check out this post on ARVDOUL: ${origin}/post/${sharePostId}`,
              });
            } catch (err) {
              console.warn('Post share failed:', err);
            }
          };
          const shareProfile = async () => {
            try {
              const targetProfile = await userService.getUserProfile(shareProfileId).catch(() => null);
              const targetHandle = getProfileHandle(targetProfile) || shareProfileId;
              await messagingService.sendMessage(conversation.id, {
                type: 'text',
                content: `Check out @${targetHandle}'s profile on ARVDOUL: ${getProfileUrl(targetProfile || shareProfileId)}`,
              });
            } catch (err) {
              console.warn('Profile share failed:', err);
            }
          };
          if (sharePostId) await sharePost();
          if (shareProfileId) await shareProfile();
          await loadConversations(user.uid);
          navigate(`/messages/${conversation.id}`, { replace: true });
        } else {
          toast.error('Could not start conversation');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || 'Could not start conversation');
          setLoading(false);
        }
      }
    };

    openDirectChat();
    return () => { cancelled = true; };
  }, [user?.uid, toUserId, sharePostId, loadConversations, navigate]);

  // Load friends on mount
  React.useEffect(() => {
    if (!user || toUserId) return;
    const loadFriends = async () => {
      try {
        setLoadingFriends(true);
        setFriendsError(null);
        const result = await userService.getFriends(user.uid, { limit: 50 });
        if (result.success) {
          setFriends(result.friends || []);
        } else {
          setFriendsError(result.error || 'Could not load your friends.');
        }
      } catch (error) {
        // A failed read must not render as "No friends yet".
        setFriendsError(error?.message || 'Could not load your friends.');
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriends();
  }, [user, toUserId, friendsNonce]);

  // Search users
  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      try {
        setSearching(true);
        setSearchError(null);
        const result = await userService.searchUsers(debouncedQuery, { limit: 20 });
        if (result.success) {
          setSearchResults(result.users || []);
        } else {
          setSearchError(result.error || 'Search failed.');
          setSearchResults([]);
        }
      } catch (error) {
        // "No users found" would be a lie when the query itself failed.
        setSearchError(error?.message || 'Search failed.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    search();
  }, [debouncedQuery, searchNonce]);

  const toggleUserSelection = useCallback((userToToggle) => {
    const targetId = userToToggle.uid || userToToggle.id;
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => (u.uid || u.id) === targetId);
      if (exists) {
        return prev.filter((u) => (u.uid || u.id) !== targetId);
      } else {
        return [...prev, userToToggle];
      }
    });
  }, []);

  const handleGroupPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await storageService.uploadFile(file, `group-photos/${user?.uid || 'anon'}`);
      const url = result?.downloadURL || result?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setGroupPhoto(url);
    } catch {
      toast.error('Could not upload group photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      setLoading(true);
      const participants = selectedUsers.map((u) => u.uid || u.id);
      
      // 1:1 opens through the spine so the recipient's allowDMs preference is
      // honoured: a refused DM becomes a message request instead of a hard error.
      if (selectedUsers.length === 1) {
        const direct = await messagingService.startDirectConversation(participants[0], user.uid);
        if (direct.status === 'request') {
          toast.info('Message request sent. You can chat once they accept.');
          navigate('/messages');
          return;
        }
        await loadConversations(user.uid);
        navigate(`/messages/${direct.conversationId}`);
        return;
      }

      let options = {
        type: 'group',
        name: groupName || `Group with ${selectedUsers.map((u) => u.displayName).join(', ')}`,
      };
      if (groupPhoto) {
        options.photoURL = groupPhoto;
      }

      const result = await messagingService.createConversation(participants, options);

      if (result.success) {
        // If we arrived from "Send to Friends", deliver the post as a real
        // message in the new conversation.
        if (sharePostId) {
          try {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            await messagingService.sendMessage(result.conversation.id, {
              type: 'text',
              content: `Check out this post on ARVDOUL: ${origin}/post/${sharePostId}`,
            });
            toast.success('Post sent');
          } catch (shareErr) {
            toast.error('Conversation created, but the post could not be sent');
          }
        }
        if (shareProfileId) {
          try {
            const targetProfile = await userService.getUserProfile(shareProfileId).catch(() => null);
            const targetHandle = getProfileHandle(targetProfile) || shareProfileId;
            await messagingService.sendMessage(result.conversation.id, {
              type: 'text',
              content: `Check out @${targetHandle}'s profile on ARVDOUL: ${getProfileUrl(targetProfile || shareProfileId)}`,
            });
            toast.success('Profile shared');
          } catch (shareErr) {
            toast.error('Conversation created, but profile could not be sent');
          }
        }
        await loadConversations(user.uid);
        if (!sharePostId && !shareProfileId) toast.success('Conversation created');
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

  if (loading && toUserId) {
    return (
      <div className={cn(
        'min-h-screen flex flex-col items-center justify-center p-6 text-center',
        theme === 'dark' ? 'bg-[#060816] text-white' : 'bg-gray-50 text-gray-900'
      )}>
        <Loader2 className="w-9 h-9 animate-spin text-purple-500 mb-3" />
        <h2 className="text-base font-bold">Connecting to conversation</h2>
        <p className="text-xs text-gray-400 mt-1">Opening secure chat...</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col h-full',
      theme === 'dark'
        ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
        : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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
          {selectedUsers.map((u) => {
            const uid = u.uid || u.id;
            return (
              <div
                key={uid}
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
            );
          })}
        </div>
      )}

      {/* Group settings (if group) */}
      {isGroup && (
        <div className={cn(
          'border-b p-4 space-y-3',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label="Set group photo"
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden border',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200',
                uploadingPhoto && 'opacity-60 cursor-wait'
              )}
            >
              {uploadingPhoto ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : groupPhoto ? (
                <img src={groupPhoto} alt="Group" className="w-full h-full object-cover" />
              ) : (
                <Camera className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGroupPhotoSelect}
            />
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className={cn(
                'flex-1 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
                theme === 'dark'
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'bg-gray-100 text-gray-900 border border-gray-200'
              )}
            />
          </div>
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
        {searching ? (
          <div className="p-4 text-center text-gray-500">
            Searching...
          </div>
        ) : loadingFriends && !debouncedQuery ? (
          <div className="p-4 text-center text-gray-500">
            Loading friends...
          </div>
        ) : (debouncedQuery ? searchError : friendsError) ? (
          <div className="p-4">
            <ErrorState
              title={debouncedQuery ? 'Search failed' : 'Could not load your friends'}
              message={debouncedQuery ? searchError : friendsError}
              onRetry={() => (debouncedQuery ? setSearchNonce((n) => n + 1) : setFriendsNonce((n) => n + 1))}
            />
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
              const uid = u.uid || u.id;
              const isSelected = selectedUsers.some((su) => (su.uid || su.id) === uid);
              return (
                <button
                  key={uid}
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
                      @{u.username || uid.substring(0, 8)}
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