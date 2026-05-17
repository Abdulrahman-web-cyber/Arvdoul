// src/screens/MessagingScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import messagingService from '../services/messagesService';
import monetizationService from '../services/monetizationService';
import searchService from '../services/searchService';
import storyService from '../services/storyService';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  MessageCircle,
  Search,
  Plus,
  User,
  Gift,
  Star,
  Trash2,
  Archive,
  BellOff,
  Pin,
  Wallet,
  X,
  Check,
  ChevronLeft,
  MoreVertical,
  Users,
  Link as LinkIcon,
  Shield,
  UserMinus,
} from 'lucide-react';
import Modal from 'react-modal';

const AD_INTERVAL = 5;

export default function MessagingScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({ lastDoc: null, hasMore: true });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);

  // Load conversations
  const loadConversations = useCallback(async (refresh = false) => {
    if (!user) return;
    try {
      setLoading(true);
      const result = await messagingService.getUserConversations(user.uid, {
        limit: 20,
        startAfter: refresh ? null : pagination.lastDoc,
        cacheFirst: false,
      });
      if (result.success) {
        setConversations(prev => refresh ? result.conversations : [...prev, ...result.conversations]);
        setPagination({
          lastDoc: result.nextCursor || null,
          hasMore: result.hasMore,
        });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, pagination.lastDoc]);

  useEffect(() => {
    loadConversations(true);
  }, []);

  // Real‑time subscription
  useEffect(() => {
    if (!user) return;
    const subId = messagingService.subscribeToConversationUpdates?.(user.uid, (update) => {
      if (update.type === 'new_message' || update.type === 'conversation_updated') {
        loadConversations(true);
      }
    });
    return () => subId && messagingService.unsubscribe?.(subId);
  }, [user]);

  // Load message requests (if implemented)
  const loadRequests = useCallback(async () => {
    // Implement when you add message_requests collection
    setRequests([]);
  }, []);

  // Search users (for new chat / group)
  const handleUserSearch = async (query) => {
    if (!query.trim()) {
      setUserSearchResults([]);
      return;
    }
    try {
      const res = await searchService.searchUsers(query, { limit: 10 });
      setUserSearchResults(res.results?.users?.hits || []);
    } catch (err) {
      console.warn('User search failed', err);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => handleUserSearch(userSearch), 300);
    return () => clearTimeout(delay);
  }, [userSearch]);

  // Create group
  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error('Group name and at least one participant required');
      return;
    }
    const participants = [user.uid, ...selectedUsers];
    try {
      const result = await messagingService.createConversation(participants, { name: groupName, type: 'group' });
      if (result.success) {
        toast.success('Group created');
        setShowCreateGroup(false);
        setGroupName('');
        setSelectedUsers([]);
        navigate(`/messages/${result.conversation.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Start direct chat
  const startDirectChat = async (otherUserId) => {
    try {
      const result = await messagingService.createConversation([otherUserId]);
      if (result.success) {
        navigate(`/messages/${result.conversation.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Conversation actions
  const handlePin = async (conversationId) => {
    try {
      await messagingService.updateConversation(conversationId, { pinnedBy: user.uid });
      loadConversations(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMute = async (conversationId, muted) => {
    try {
      await messagingService.updateConversation(conversationId, { mutedBy: muted ? user.uid : null });
      loadConversations(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleArchive = async (conversationId) => {
    try {
      await messagingService.updateConversation(conversationId, { archivedBy: user.uid });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (conversationId) => {
    if (!window.confirm('Delete this conversation? This action cannot be undone.')) return;
    try {
      await messagingService.deleteConversation(conversationId, user.uid);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Conversation item
  const ConversationItem = ({ item }) => {
    const isUnread = (item.unreadCounts?.[user.uid] || 0) > 0;
    const lastMessage = item.lastMessage || {};
    const participants = item.participantDetails || [];
    const other = participants.find(p => p.uid !== user.uid) || participants[0];
    const time = item.lastActivity?.toDate ? formatDistanceToNow(item.lastActivity.toDate(), { addSuffix: true }) : '';
    const [hasStory, setHasStory] = useState(false);

    useEffect(() => {
      if (other?.uid) {
        storyService.getUserActiveStory(other.uid).then(story => setHasStory(!!story));
      }
    }, [other?.uid]);

    return (
      <div
        onClick={() => navigate(`/messages/${item.id}`)}
        className={cn(
          'flex items-center p-4 border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition group',
          isUnread && 'bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        {/* Avatar with story ring */}
        <div className="relative">
          <img
            src={other?.photoURL || '/assets/default-profile.png'}
            alt={other?.displayName}
            className={cn(
              'w-12 h-12 rounded-full object-cover',
              hasStory && 'ring-2 ring-blue-500'
            )}
          />
          {other?.online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 ml-3 min-w-0">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900 dark:text-white truncate">
              {item.type === 'group' ? item.name : (other?.displayName || other?.username || 'User')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">{time}</span>
          </div>

          <div className="flex items-center mt-1">
            <p className={cn(
              'text-sm truncate flex-1',
              isUnread ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'
            )}>
              {lastMessage.senderId === user.uid && 'You: '}
              {lastMessage.text || 'No messages yet'}
            </p>

            {isUnread && (
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 ml-2">
                {item.unreadCounts[user.uid]}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center space-x-1 ml-2" onClick={e => e.stopPropagation()}>
          {!item.pinnedBy?.includes(user.uid) && (
            <button onClick={() => handlePin(item.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
              <Pin size={16} className="text-gray-500" />
            </button>
          )}
          <button onClick={() => handleMute(item.id, !item.mutedBy?.includes(user.uid))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <BellOff size={16} className={item.mutedBy?.includes(user.uid) ? 'text-green-500' : 'text-gray-500'} />
          </button>
          <button onClick={() => handleArchive(item.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <Archive size={16} className="text-gray-500" />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>

        {/* Gift button for creators */}
        {item.type === 'direct' && other?.isCreator && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/gift/${other.uid}`); }}
            className="ml-2 p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
          >
            <Gift size={16} />
          </button>
        )}
      </div>
    );
  };

  // Ad item
  const AdItem = ({ ad }) => (
    <div
      onClick={() => handleAdClick(ad)}
      className="flex items-center p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 cursor-pointer"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <span className="text-white font-bold">Ad</span>
      </div>
      <div className="flex-1 ml-3">
        <p className="font-bold text-gray-900 dark:text-white">{ad.name}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{ad.lastMessage.text}</p>
      </div>
      <span className="bg-white/50 dark:bg-black/30 text-xs font-semibold px-2 py-1 rounded-full text-purple-600 dark:text-purple-300">
        Sponsored
      </span>
    </div>
  );

  const handleAdClick = (ad) => {
    if (ad._adData?.adId) {
      monetizationService.recordAdImpression({ adId: ad._adData.adId, userId: user.uid, placement: 'conversation_list' });
    }
    monetizationService.addCoins(user.uid, 2, 'ad_view', { adId: ad._adData?.adId });
    window.open(ad.link, '_blank');
  };

  // Load more on scroll
  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom && activeTab === 'chats' && pagination.hasMore && !loading) {
      loadConversations();
    }
  };

  // Create group modal
  const CreateGroupModal = () => (
    <Modal
      isOpen={showCreateGroup}
      onRequestClose={() => setShowCreateGroup(false)}
      className="absolute inset-0 flex items-center justify-center p-4"
      overlayClassName="fixed inset-0 bg-black/50"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Group</h2>
        <input
          type="text"
          placeholder="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-4"
        />
        <input
          type="text"
          placeholder="Search users to add"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-4"
        />
        <div className="max-h-40 overflow-y-auto mb-4">
          {userSearchResults.map(u => (
            <div key={u.objectID} className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full mr-2" />
                <span className="text-gray-900 dark:text-white">{u.displayName}</span>
              </div>
              <button
                onClick={() => setSelectedUsers(prev => prev.includes(u.objectID) ? prev.filter(id => id !== u.objectID) : [...prev, u.objectID])}
                className={cn(
                  'px-2 py-1 rounded text-sm',
                  selectedUsers.includes(u.objectID) ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
                )}
              >
                {selectedUsers.includes(u.objectID) ? 'Remove' : 'Add'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400">Cancel</button>
          <button onClick={createGroup} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="pt-12 pb-2 px-4 flex justify-between items-center bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <div className="flex space-x-3">
          <button onClick={() => navigate('/coins')} className="text-yellow-500">
            <Wallet size={24} />
          </button>
          <button onClick={() => setShowCreateGroup(true)} className="text-green-600">
            <Users size={24} />
          </button>
          <button onClick={() => navigate('/messages/new')} className="text-blue-600">
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search messages or people"
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-2 w-96 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            {searchResults.map(user => (
              <div
                key={user.objectID}
                onClick={() => startDirectChat(user.objectID)}
                className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('chats')}
          className={cn(
            'flex-1 py-3 text-center font-medium',
            activeTab === 'chats'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400'
          )}
        >
          Chats
        </button>
        <button
          onClick={() => { setActiveTab('requests'); loadRequests(); }}
          className={cn(
            'flex-1 py-3 text-center font-medium relative',
            activeTab === 'requests'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400'
          )}
        >
          Requests
          {requests.length > 0 && (
            <span className="absolute top-2 right-1/4 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {activeTab === 'chats' ? (
          conversations.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <MessageCircle size={48} className="mb-4" />
              <p>No conversations yet</p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              >
                Start a new chat or group
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem key={conv.id} item={conv} />
            ))
          )
        ) : (
          requests.map(req => (
            <div key={req.id} className="flex items-center p-4 border-b border-gray-200 dark:border-gray-800">
              <img src={req.fromUserPhotoURL} alt="" className="w-10 h-10 rounded-full" />
              <div className="flex-1 ml-3">
                <p className="font-medium text-gray-900 dark:text-white">{req.fromUserDisplayName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{req.preview}</p>
              </div>
              <div className="flex space-x-2">
                <button className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600">
                  <Check size={16} />
                </button>
                <button className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
        {loading && <div className="p-4 text-center text-gray-500">Loading...</div>}
      </div>

      <CreateGroupModal />
    </div>
  );
}