// src/screens/MessagingScreen.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import messagingService from '../services/messagesService';
import searchService from '../services/searchService';
import storyService from '../services/storyService';
import monetizationService from '../services/monetizationService';
import notificationsService from '../services/notificationsService';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useDebounce } from 'use-debounce';
import localforage from 'localforage';
import { useSwipeable } from 'react-swipeable';
import Modal from 'react-modal';

import {
  MessageCircle,
  Search,
  Plus,
  Users,
  Wallet,
  Gift,
  Phone,
  Pin,
  BellOff,
  Archive,
  Trash2,
  Check,
  X,
  Loader2,
  UserPlus,
  Sparkles,
  AlertCircle,
  Camera,
  XCircle,
} from 'lucide-react';

const AD_INTERVAL = 5;
const STORY_CACHE_KEY = 'story_status';
const STORY_CACHE_TTL = 5 * 60 * 1000;
const TYPING_INDICATOR_DURATION = 3000;

if (typeof window !== 'undefined') {
  Modal.setAppElement('#root');
}

const SkeletonItem = () => (
  <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-800 animate-pulse">
    <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full" />
    <div className="ml-3 flex-1 space-y-2">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
    </div>
  </div>
);

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
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({ lastDoc: null, hasMore: true });
  const [error, setError] = useState(null);
  const [storyCache, setStoryCache] = useState({});
  const [typingIndicators, setTypingIndicators] = useState({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedUserSearch] = useDebounce(userSearchQuery, 300);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false);

  const listContainerRef = useRef(null);
  const groupPhotoInputRef = useRef(null);

  const loadConversations = useCallback(async (refresh = false) => {
    if (!user) return;
    try {
      setError(null);
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const result = await messagingService.getUserConversations(user.uid, {
        limit: 20,
        startAfter: refresh ? null : pagination.lastDoc,
        cacheFirst: true,
      });
      if (result.success) {
        const enriched = await enrichWithStoryStatus(result.conversations);
        setConversations(prev => refresh ? enriched : [...prev, ...enriched]);
        setPagination({
          lastDoc: result.nextCursor || null,
          hasMore: result.hasMore,
        });
      } else {
        throw new Error(result.error || 'Failed to load conversations');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Network error');
      toast.error('Unable to load conversations. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, pagination.lastDoc]);

  const enrichWithStoryStatus = useCallback(async (convs) => {
    const userIds = convs.map(c => c.participants?.find(p => p !== user?.uid)).filter(Boolean);
    const freshStatus = { ...storyCache };
    const toFetch = [];
    for (const uid of userIds) {
      if (!storyCache[uid]) toFetch.push(uid);
    }
    if (toFetch.length) {
      const storyPromises = toFetch.map(async uid => {
        try {
          const hasStory = await storyService.getUserActiveStory(uid);
          return { uid, hasStory: !!hasStory };
        } catch { return { uid, hasStory: false }; }
      });
      const results = await Promise.all(storyPromises);
      results.forEach(r => { freshStatus[r.uid] = r.hasStory; });
      localforage.setItem(STORY_CACHE_KEY, { data: freshStatus, timestamp: Date.now() });
      setStoryCache(freshStatus);
    }
    return convs.map(conv => {
      const otherId = conv.participants?.find(p => p !== user?.uid);
      return { ...conv, hasStory: otherId ? (storyCache[otherId] || freshStatus[otherId]) : false };
    });
  }, [user, storyCache]);

  useEffect(() => {
    localforage.getItem(STORY_CACHE_KEY).then(cached => {
      if (cached && Date.now() - cached.timestamp < STORY_CACHE_TTL) {
        setStoryCache(cached.data);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const subId = messagingService.subscribeToConversationUpdates?.(user.uid, (update) => {
      if (update.type === 'new_message' || update.type === 'conversation_updated') {
        loadConversations(true);
      }
    });
    return () => subId && messagingService.unsubscribe?.(subId);
  }, [user, loadConversations]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [];
    conversations.forEach(conv => {
      const unsub = messagingService.subscribeToTyping(conv.id, user.uid, (typingData) => {
        setTypingIndicators(prev => ({ ...prev, [conv.id]: typingData }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(unsub => unsub());
  }, [conversations, user]);

  const loadRequests = useCallback(async () => {
    setRequests([]);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!debouncedUserSearch.trim()) {
        setUserSearchResults([]);
        return;
      }
      try {
        const res = await searchService.searchUsers(debouncedUserSearch, { limit: 10 });
        setUserSearchResults(res.results?.users?.hits || []);
      } catch { setUserSearchResults([]); }
    };
    search();
  }, [debouncedUserSearch]);

  useEffect(() => {
    const search = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchService.searchUsers(debouncedSearchQuery, { limit: 10 });
        setSearchResults(res.results?.users?.hits || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    };
    search();
  }, [debouncedSearchQuery]);

  const handleGroupPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGroupPhotoPreview(ev.target.result);
        setGroupPhoto(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error('Group name and at least one participant required');
      return;
    }
    const participants = [user.uid, ...selectedUsers];
    let photoURL = null;
    if (groupPhoto) {
      photoURL = groupPhotoPreview; // placeholder – replace with real URL after upload
    }
    try {
      const result = await messagingService.createConversation(participants, {
        name: groupName,
        type: 'group',
        photoURL,
      });
      if (result.success) {
        toast.success('Group created');
        setShowCreateGroup(false);
        setGroupName('');
        setGroupPhoto(null);
        setGroupPhotoPreview(null);
        setSelectedUsers([]);
        navigate(`/messages/${result.conversation.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startDirectChat = async (otherUserId) => {
    try {
      const result = await messagingService.createConversation([otherUserId]);
      if (result.success) navigate(`/messages/${result.conversation.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePin = useCallback(async (convId, currentPinned) => {
    const updated = conversations.map(conv =>
      conv.id === convId
        ? { ...conv, pinnedBy: currentPinned ? conv.pinnedBy?.filter(id => id !== user.uid) : [...(conv.pinnedBy || []), user.uid] }
        : conv
    );
    setConversations(updated);
    try {
      await messagingService.updateConversation(convId, { pinnedBy: user.uid });
    } catch (err) {
      toast.error(err.message);
      setConversations(conversations);
    }
  }, [conversations, user]);

  const handleMute = useCallback(async (convId, currentMuted) => {
    const updated = conversations.map(conv =>
      conv.id === convId
        ? { ...conv, mutedBy: currentMuted ? conv.mutedBy?.filter(id => id !== user.uid) : [...(conv.mutedBy || []), user.uid] }
        : conv
    );
    setConversations(updated);
    try {
      await messagingService.updateConversation(convId, { mutedBy: user.uid });
    } catch (err) {
      toast.error(err.message);
      setConversations(conversations);
    }
  }, [conversations, user]);

  const handleArchive = useCallback(async (convId) => {
    const updated = conversations.filter(conv => conv.id !== convId);
    setConversations(updated);
    try {
      await messagingService.updateConversation(convId, { archivedBy: user.uid });
    } catch (err) {
      toast.error(err.message);
      setConversations(conversations);
    }
  }, [conversations, user]);

  const handleDelete = useCallback(async (convId) => {
    if (!window.confirm('Delete this conversation? This action cannot be undone.')) return;
    const updated = conversations.filter(conv => conv.id !== convId);
    setConversations(updated);
    try {
      await messagingService.deleteConversation(convId, user.uid);
    } catch (err) {
      toast.error(err.message);
      setConversations(conversations);
    }
  }, [conversations, user]);

  const [adsCache, setAdsCache] = useState([]);
  const [adsFetching, setAdsFetching] = useState(false);

  const fetchAds = useCallback(async (count) => {
    if (adsFetching) return;
    setAdsFetching(true);
    const newAds = [];
    for (let i = 0; i < count; i++) {
      try {
        const ad = await monetizationService.getAd('conversation_list', user.uid, { position: i });
        if (ad) {
          newAds.push({
            id: ad.id || `ad_${Date.now()}_${i}`,
            isAd: true,
            name: ad.title || 'Sponsored',
            description: ad.description || ad.content || 'Earn coins – tap to learn more',
            link: ad.targetUrl || ad.link || '/ads',
            imageUrl: ad.imageUrl || ad.image || '/assets/ad-placeholder.png',
            _adData: { adId: ad.id, placement: 'conversation_list' },
          });
        } else {
          newAds.push({
            id: `ad_${Date.now()}_${i}`,
            isAd: true,
            name: 'Sponsored',
            description: 'Earn coins – tap to learn more',
            link: '/ads',
            imageUrl: '/assets/ad-placeholder.png',
            _adData: { adId: null },
          });
        }
      } catch {
        newAds.push({
          id: `ad_${Date.now()}_${i}`,
          isAd: true,
          name: 'Sponsored',
          description: 'Earn coins – tap to learn more',
          link: '/ads',
          imageUrl: '/assets/ad-placeholder.png',
          _adData: { adId: null },
        });
      }
    }
    setAdsCache(newAds);
    setAdsFetching(false);
  }, [user, adsFetching]);

  useEffect(() => {
    if (conversations.length === 0) return;
    const requiredAds = Math.ceil(conversations.length / AD_INTERVAL);
    if (adsCache.length < requiredAds) {
      fetchAds(requiredAds - adsCache.length);
    }
  }, [conversations.length, adsCache.length, fetchAds]);

  const conversationsWithAds = useMemo(() => {
    const result = [];
    let convIndex = 0, adIndex = 0;
    for (let i = 0; i < conversations.length; i++) {
      result.push(conversations[i]);
      convIndex++;
      if (convIndex % AD_INTERVAL === 0 && adIndex < adsCache.length) {
        result.push(adsCache[adIndex]);
        adIndex++;
      }
    }
    return result;
  }, [conversations, adsCache]);

  const handleAdClick = useCallback(async (ad) => {
    if (ad._adData?.adId) {
      try {
        await monetizationService.recordAdImpression({ adId: ad._adData.adId, userId: user.uid, placement: 'conversation_list' });
        await monetizationService.addCoins(user.uid, 2, 'ad_view', { adId: ad._adData.adId });
        toast.success('+2 coins earned!');
      } catch (err) { console.warn(err); }
    }
    window.open(ad.link, '_blank', 'noopener,noreferrer');
  }, [user]);

  const requestPushPermission = async () => {
    try {
      const result = await notificationsService.requestPushPermission(user.uid);
      if (result.success) {
        setPushPermissionGranted(true);
        toast.success('Notifications enabled');
      } else {
        toast.error('Permission denied');
      }
    } catch {
      toast.error('Failed to enable notifications');
    }
  };

  const handleScroll = useCallback((e) => {
    const container = e.currentTarget;
    const bottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 200;
    if (bottom && pagination.hasMore && !loading && !refreshing) {
      loadConversations();
    }
  }, [pagination.hasMore, loading, refreshing, loadConversations]);

  // ----- Render item components (same as before) -----
  const ConversationItem = React.memo(({ item, currentUserId, onPin, onMute, onArchive, onDelete, onStartCall, onSendGift }) => {
    const isUnread = (item.unreadCounts?.[currentUserId] || 0) > 0;
    const lastMessage = item.lastMessage || {};
    const participants = item.participantDetails || [];
    const other = participants.find(p => p.uid !== currentUserId) || participants[0];
    const time = item.lastActivity?.toDate ? formatDistanceToNow(item.lastActivity.toDate(), { addSuffix: true }) : '';
    const hasStory = item.hasStory;
    const typingUsers = typingIndicators[item.id] || {};
    const isTyping = Object.keys(typingUsers).some(uid => uid !== currentUserId && (Date.now() - typingUsers[uid]?.timestamp) < TYPING_INDICATOR_DURATION);

    const swipeHandlers = useSwipeable({
      onSwipedLeft: () => onArchive(item.id),
      onSwipedRight: () => onPin(item.id, item.pinnedBy?.includes(currentUserId)),
      trackMouse: true,
    });

    const longPressTimer = useRef();
    const handleTouchStart = () => {
      longPressTimer.current = setTimeout(() => {
        alert(`Options for ${other?.displayName}\nPin, Mute, Delete, etc.`);
      }, 500);
    };
    const handleTouchEnd = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    return (
      <div
        {...swipeHandlers}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => navigate(`/messages/${item.id}`)}
        className={cn(
          'flex items-center p-4 border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition group',
          isUnread && 'bg-blue-50 dark:bg-blue-900/20'
        )}
        role="button"
        tabIndex={0}
        aria-label={`Conversation with ${other?.displayName}`}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/messages/${item.id}`)}
      >
        <div className="relative">
          <img
            src={other?.photoURL || '/assets/default-profile.png'}
            alt={other?.displayName}
            className={cn('w-12 h-12 rounded-full object-cover', hasStory && 'ring-2 ring-blue-500')}
            loading="lazy"
          />
          {other?.online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
          )}
        </div>

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
              {lastMessage.senderId === currentUserId && 'You: '}
              {lastMessage.text || 'No messages yet'}
            </p>
            {isUnread && (
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 ml-2">
                {item.unreadCounts[currentUserId]}
              </span>
            )}
          </div>

          {isTyping && (
            <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
              </div>
              <span className="ml-1">Typing...</span>
            </div>
          )}
        </div>

        <div className="hidden group-hover:flex items-center space-x-1 ml-2" onClick={e => e.stopPropagation()}>
          {!item.pinnedBy?.includes(currentUserId) && (
            <button onClick={() => onPin(item.id, false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" aria-label="Pin">
              <Pin size={16} className="text-gray-500" />
            </button>
          )}
          <button onClick={() => onMute(item.id, item.mutedBy?.includes(currentUserId))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" aria-label="Mute/Unmute">
            <BellOff size={16} className={item.mutedBy?.includes(currentUserId) ? 'text-green-500' : 'text-gray-500'} />
          </button>
          <button onClick={() => onArchive(item.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" aria-label="Archive">
            <Archive size={16} className="text-gray-500" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" aria-label="Delete">
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>

        <div className="md:hidden flex items-center space-x-2 ml-2" onClick={e => e.stopPropagation()}>
          {item.type === 'direct' && (
            <>
              <button onClick={() => onStartCall?.(item.id)} className="p-1" aria-label="Call"><Phone size={18} className="text-blue-500" /></button>
              {other?.isCreator && (
                <button onClick={() => onSendGift?.(other.uid)} className="p-1" aria-label="Gift"><Gift size={18} className="text-yellow-500" /></button>
              )}
            </>
          )}
        </div>
      </div>
    );
  });

  const AdItem = ({ ad }) => (
    <div
      onClick={() => handleAdClick(ad)}
      className="flex items-center p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 cursor-pointer"
      role="button"
      tabIndex={0}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <span className="text-white font-bold">Ad</span>
      </div>
      <div className="flex-1 ml-3">
        <p className="font-bold text-gray-900 dark:text-white">{ad.name}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{ad.description}</p>
      </div>
      <span className="bg-white/50 dark:bg-black/30 text-xs font-semibold px-2 py-1 rounded-full text-purple-600 dark:text-purple-300">
        Sponsored
      </span>
    </div>
  );

  const RequestItem = ({ item }) => (
    <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-800">
      <img src={item.fromUserPhotoURL} alt="" className="w-10 h-10 rounded-full" />
      <div className="flex-1 ml-3">
        <p className="font-medium text-gray-900 dark:text-white">{item.fromUserDisplayName}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{item.preview}</p>
      </div>
      <div className="flex space-x-2">
        <button className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"><Check size={16} /></button>
        <button className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"><X size={16} /></button>
      </div>
    </div>
  );

  // ========== FIX: load conversations only when user is available ==========
  useEffect(() => {
    if (user) {
      loadConversations(true);
    }
  }, [user, loadConversations]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      <div className="pt-12 pb-2 px-4 flex justify-between items-center bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <div className="flex space-x-3">
          <button onClick={() => navigate('/coins')} className="text-yellow-500"><Wallet size={24} /></button>
          <button onClick={() => setShowCreateGroup(true)} className="text-green-600"><Users size={24} /></button>
          <button onClick={() => navigate('/messages/new')} className="text-blue-600"><Plus size={24} /></button>
        </div>
      </div>

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
          {searching && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-500" />}
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-2 w-96 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            {searchResults.map(user => (
              <div key={user.objectID} onClick={() => startDirectChat(user.objectID)} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" loading="lazy" />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => setActiveTab('chats')} className={cn('flex-1 py-3 text-center font-medium', activeTab === 'chats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400')}>Chats</button>
        <button onClick={() => { setActiveTab('requests'); loadRequests(); }} className={cn('flex-1 py-3 text-center font-medium relative', activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400')}>
          Requests
          {requests.length > 0 && <span className="absolute top-2 right-1/4 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{requests.length}</span>}
        </button>
      </div>

      <div ref={listContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {activeTab === 'chats' && (
          <>
            {loading && !refreshing && [...Array(5)].map((_, i) => <SkeletonItem key={i} />)}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <AlertCircle size={48} className="mb-4 text-red-500" />
                <p className="mb-2">{error}</p>
                <button onClick={() => loadConversations(true)} className="px-4 py-2 bg-blue-600 text-white rounded-full">Retry</button>
              </div>
            )}
            {!loading && conversationsWithAds.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <MessageCircle size={48} className="mb-4" />
                <p>No conversations yet</p>
                <button onClick={() => setShowCreateGroup(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">Start a new chat or group</button>
              </div>
            )}
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {conversationsWithAds.map(item => (
                <React.Fragment key={item.id}>
                  {item.isAd ? (
                    <AdItem ad={item} />
                  ) : (
                    <ConversationItem
                      item={item}
                      currentUserId={user?.uid}
                      onPin={handlePin}
                      onMute={handleMute}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      onStartCall={() => navigate(`/call/${item.id}`)}
                      onSendGift={() => navigate(`/gift/${item.participantDetails?.find(p => p.uid !== user.uid)?.uid}`)}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            {pagination.hasMore && !loading && (
              <div className="py-4 text-center">
                <button onClick={() => loadConversations()} className="text-blue-600 text-sm font-medium">Load more</button>
              </div>
            )}
            {refreshing && <div className="flex justify-center py-2"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}
          </>
        )}
        {activeTab === 'requests' && (
          <div>
            {requests.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <UserPlus size={48} className="mb-4" />
                <p>No pending requests</p>
              </div>
            )}
            {requests.map(req => <RequestItem key={req.id} item={req} />)}
          </div>
        )}
      </div>

      <Modal isOpen={showCreateGroup} onRequestClose={() => setShowCreateGroup(false)} className="absolute inset-0 flex items-center justify-center p-4" overlayClassName="fixed inset-0 bg-black/50" ariaHideApp={false}>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Group</h2>
          <div className="flex justify-center mb-4">
            <div className="relative w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => groupPhotoInputRef.current?.click()}>
              {groupPhotoPreview ? <img src={groupPhotoPreview} alt="Group" className="w-full h-full object-cover" /> : <Camera size={32} className="text-gray-500" />}
              <input type="file" ref={groupPhotoInputRef} accept="image/*" onChange={handleGroupPhotoChange} className="hidden" />
            </div>
            {groupPhotoPreview && (
              <button onClick={() => { setGroupPhoto(null); setGroupPhotoPreview(null); }} className="absolute ml-16 mt-16 bg-red-500 text-white rounded-full p-1" aria-label="Remove photo">
                <XCircle size={16} />
              </button>
            )}
          </div>
          <input type="text" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-4" />
          <input type="text" placeholder="Search users to add" value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-4" />
          <div className="max-h-40 overflow-y-auto mb-4">
            {userSearchResults.map(u => (
              <div key={u.objectID} className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full mr-2" loading="lazy" />
                  <span className="text-gray-900 dark:text-white">{u.displayName}</span>
                </div>
                <button onClick={() => setSelectedUsers(prev => prev.includes(u.objectID) ? prev.filter(id => id !== u.objectID) : [...prev, u.objectID])} className={cn('px-2 py-1 rounded text-sm', selectedUsers.includes(u.objectID) ? 'bg-red-500 text-white' : 'bg-blue-600 text-white')}>
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

      {!pushPermissionGranted && (
        <div className="fixed bottom-20 right-4">
          <button onClick={requestPushPermission} className="bg-blue-600 text-white p-3 rounded-full shadow-lg"><Sparkles size={20} /></button>
        </div>
      )}
    </div>
  );
}