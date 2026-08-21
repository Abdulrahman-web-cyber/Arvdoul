// src/screens/StoriesScreen.jsx - ARVDOUL STORIES & VIBES IMMERSIVE SCREEN
// 100% Pixel-perfect replica of Arvdoul Stories Grid & Interactive Viewer from user design specs
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Search, Camera, Calendar, Plus, CheckCircle2, Play, Volume2,
  VolumeX, Heart, Send, MessageCircle, MoreVertical, X,
  Sparkles, Star, Radio, MapPin, Music, ChevronDown, Flame,
  Share2, Bookmark, Gift, RefreshCw, Eye, ThumbsUp, Smile
} from 'lucide-react';
import { getStoryService } from '../services/storyService';
import { getMonetizationService } from '../services/monetizationService';

// High definition sample stories matching Screenshot 2
const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: null },
  { id: 'friends', label: 'Friends', icon: null },
  { id: 'following', label: 'Following', icon: null },
  { id: 'close_friends', label: 'Close Friends', icon: Star, color: 'text-green-400' },
  { id: 'live', label: 'Live', icon: Radio, color: 'text-red-500', isLive: true },
];

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😮', '😂', '💎'];

export default function StoriesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Navigation / Filter State
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Story Viewer State
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [flyingParticles, setFlyingParticles] = useState([]);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [likedStories, setLikedStories] = useState({});

  const progressIntervalRef = useRef(null);

  // Load REAL stories from storyService (Firestore-backed feed)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const feed = await getStoryService().getStoriesFeed(user?.uid || '', { cacheFirst: false, limit: 30 });
        if (cancelled) return;
        const groups = feed?.groups || [];
        const mapped = groups.map((g) => {
          const storiesArr = g.stories || [];
          const author = storiesArr[0]?.authorName || g.userId;
          const authorPhoto = storiesArr[0]?.authorPhoto || '/assets/default-profile.png';
          return {
            id: g.userId || `g-${Math.random().toString(36).slice(2, 7)}`,
            user: {
              id: g.userId,
              name: author,
              username: author.toLowerCase().replace(/\s+/g, '.'),
              avatar: authorPhoto,
              verified: false,
              category: 'Following',
              isCloseFriend: false,
              isLive: false,
            },
            timeAgo: 'Recently',
            itemsCount: storiesArr.length,
            activeItemIndex: 0,
            mediaType: storiesArr[0]?.type || 'image',
            badgeType: storiesArr[0]?.type || 'image',
            mediaUrl: storiesArr[0]?.media?.url || storiesArr[0]?.content || '',
            caption: storiesArr[0]?.content || '',
            viewsCount: String(storiesArr[0]?.stats?.views || 0),
            items: storiesArr.map((st) => ({
              id: st.id,
              url: st.media?.url || st.content || '',
              type: st.type || 'image',
              caption: st.content || '',
            })),
          };
        });
        setStories(mapped);
      } catch (err) {
        console.error('Failed to load stories:', err);
        if (!cancelled) setStories([]);
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Filter stories based on active category & search
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      // Category filter
      if (activeCategory === 'friends' && story.user.category !== 'Friends') return false;
      if (activeCategory === 'following' && story.user.category !== 'Following' && story.user.category !== 'Friends') return false;
      if (activeCategory === 'close_friends' && !story.user.isCloseFriend) return false;
      if (activeCategory === 'live' && !story.user.isLive) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          story.user.name.toLowerCase().includes(query) ||
          story.user.username.toLowerCase().includes(query) ||
          (story.caption && story.caption.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [stories, activeCategory, searchQuery]);

  // Handle opening a story in the viewer
  const handleOpenStory = (index) => {
    setActiveStoryIndex(index);
    setActiveItemIndex(0);
    setStoryProgress(0);
    setIsPaused(false);
  };

  // Close story viewer
  const handleCloseStory = () => {
    setActiveStoryIndex(null);
    setActiveItemIndex(0);
    setStoryProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  // Current story being viewed
  const currentStory = activeStoryIndex !== null ? filteredStories[activeStoryIndex] : null;
  const currentItem = currentStory?.items?.[activeItemIndex] || currentStory?.items?.[0];

  // Story playback timer
  useEffect(() => {
    if (activeStoryIndex === null || !currentStory || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const duration = (currentItem?.duration || 5) * 1000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + step >= 100) {
          // Advance to next item or next story
          if (activeItemIndex + 1 < (currentStory.items?.length || 1)) {
            setActiveItemIndex((i) => i + 1);
            return 0;
          } else if (activeStoryIndex + 1 < filteredStories.length) {
            setActiveStoryIndex((s) => s + 1);
            setActiveItemIndex(0);
            return 0;
          } else {
            handleCloseStory();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [activeStoryIndex, activeItemIndex, isPaused, currentStory, currentItem, filteredStories.length]);

  // Handle tap left/right to navigate items
  const handleStoryTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRight = x > rect.width / 2;

    if (isRight) {
      // Advance
      if (activeItemIndex + 1 < (currentStory?.items?.length || 1)) {
        setActiveItemIndex((i) => i + 1);
        setStoryProgress(0);
      } else if (activeStoryIndex + 1 < filteredStories.length) {
        setActiveStoryIndex((s) => s + 1);
        setActiveItemIndex(0);
        setStoryProgress(0);
      } else {
        handleCloseStory();
      }
    } else {
      // Previous
      if (activeItemIndex > 0) {
        setActiveItemIndex((i) => i - 1);
        setStoryProgress(0);
      } else if (activeStoryIndex > 0) {
        setActiveStoryIndex((s) => s - 1);
        const prevStory = filteredStories[activeStoryIndex - 1];
        setActiveItemIndex((prevStory?.items?.length || 1) - 1);
        setStoryProgress(0);
      }
    }
  };

  // Handle quick emoji reaction with particle explosion
  const handleSendReaction = (emoji) => {
    toast.success(`Sent ${emoji} to ${currentStory?.user?.name}`);
    const id = Date.now() + Math.random();
    setFlyingParticles((prev) => [...prev, { id, emoji, x: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFlyingParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1500);
  };

  // Handle gift coins
  const handleGiftCoin = () => {
    const monetization = getMonetizationService();
    toast.success(`Sent 250 🪙 to ${currentStory?.user?.name}!`);
    handleSendReaction('🪙');
  };

  // Handle story reply
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    toast.success(`Reply sent to ${currentStory?.user?.name}`);
    setReplyText('');
  };

  return (
    <div
      className={cn(
        'min-h-screen w-full select-none transition-colors duration-300 pb-24',
        isDark
          ? 'bg-[#03071B] text-white'
          : 'bg-[#F6F8FC] text-gray-900'
      )}
    >
      {/* ==================== TOP APP HEADER ==================== */}
      <header
        className={cn(
          'sticky top-0 z-30 px-4 pt-4 pb-3 flex items-center justify-between backdrop-blur-xl border-b transition-all',
          isDark
            ? 'bg-[#03071B]/90 border-white/5 shadow-2xl'
            : 'bg-white/90 border-gray-200/80 shadow-sm'
        )}
      >
        {/* Title with Arvdoul glow indicator underline */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Stories
            </h1>
          </div>
          {/* Subtle neon glow underline */}
          <div className="w-10 h-1 bg-gradient-to-r from-[#8B1EF3] via-[#C82BFF] to-[#055BFB] rounded-full mt-0.5" />
        </div>

        {/* Action icons: Search, Camera, Archive */}
        <div className="flex items-center gap-2.5">
          {/* Search trigger */}
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            aria-label="Search stories"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Camera trigger */}
          <button
            onClick={() => navigate('/create-story')}
            aria-label="Open story camera"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 shadow-lg',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Camera className="w-5 h-5" />
          </button>

          {/* Memories / Archive */}
          <button
            onClick={() => setIsCalendarOpen(true)}
            aria-label="Story archive"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ==================== EXPANDABLE SEARCH BAR ==================== */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2"
          >
            <div
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all',
                isDark
                  ? 'bg-white/5 border-white/10 focus-within:border-purple-500/80 shadow-inner'
                  : 'bg-white border-gray-300 focus-within:border-purple-500 shadow-sm'
              )}
            >
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search friends, stories, or moments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CATEGORY FILTER PILLS ==================== */}
      <div className="px-4 py-3.5 overflow-x-auto no-scrollbar flex items-center gap-2.5">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 active:scale-95',
                isActive
                  ? 'bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB] text-white shadow-[0_4px_15px_rgba(139,30,243,0.4)] scale-105'
                  : isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    'w-3.5 h-3.5',
                    tab.color || 'text-white',
                    tab.isLive && 'animate-pulse'
                  )}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== STORIES 3-COLUMN BENTO GRID ==================== */}
      <div className="px-4 grid grid-cols-3 gap-3 md:gap-4 max-w-5xl mx-auto">
        {/* FIRST CARD: "ADD STORY" NEON CIRCLE */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/create-story')}
          className={cn(
            'relative aspect-[3/4.5] rounded-3xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group overflow-hidden border-2 border-dashed',
            isDark
              ? 'bg-gradient-to-b from-[#0A102D] to-[#04081E] border-blue-500/40 hover:border-blue-400/80 shadow-[0_8px_30px_rgba(5,91,251,0.15)]'
              : 'bg-white border-blue-400 hover:border-blue-600 shadow-md'
          )}
        >
          {/* Animated concentric neon rings */}
          <div className="relative mb-3">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#8B1EF3] via-[#4431F7] to-[#055BFB] flex items-center justify-center shadow-[0_0_25px_rgba(139,30,243,0.6)] group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-7 h-7 text-white" />
            </div>
            {/* Pulsing ring */}
            <div className="absolute -inset-2 rounded-full border border-blue-400/30 animate-ping opacity-25 pointer-events-none" />
            <div className="absolute -inset-3.5 rounded-full border border-purple-500/20 pointer-events-none" />
          </div>

          <span className="text-xs md:text-sm font-bold tracking-tight text-center text-white">
            Add Story
          </span>
          <span className="text-[10px] text-slate-400 text-center mt-0.5">
            Share a moment
          </span>
        </motion.div>

        {/* STORY CARDS */}
        {filteredStories.map((story, index) => {
          return (
            <motion.div
              key={story.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleOpenStory(index)}
              className={cn(
                'relative aspect-[3/4.5] rounded-3xl p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-300 group overflow-hidden border shadow-lg',
                isDark
                  ? 'bg-[#0B112A] border-white/10 hover:border-purple-500/50 shadow-black/60'
                  : 'bg-white border-gray-200 hover:border-purple-500/50 shadow-sm'
              )}
            >
              {/* Background Media Thumbnail */}
              <img
                src={story.mediaUrl}
                alt={story.caption || story.user.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Gradient Vignette Overlays for readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />

              {/* TOP: User Info with Vibe Ring & Name */}
              <div className="relative z-10 flex items-start justify-between w-full">
                <div className="flex items-center gap-1.5">
                  {/* Avatar with gradient glow ring */}
                  <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-[#8B1EF3] via-[#C82BFF] to-[#055BFB] shadow-[0_0_10px_rgba(139,30,243,0.5)]">
                    <img
                      src={story.user.avatar}
                      alt={story.user.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover"
                    />
                    {story.user.isLive && (
                      <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-red-600 text-[8px] font-black rounded-md text-white border border-black shadow">
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* Name & Time */}
                  <div className="flex flex-col leading-tight">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] md:text-xs font-bold text-white truncate max-w-[65px] md:max-w-[80px]">
                        {story.user.name}
                      </span>
                      {story.user.verified && (
                        <CheckCircle2 className="w-3 h-3 text-[#055BFB] fill-[#055BFB]" />
                      )}
                    </div>
                    <span className="text-[9px] text-slate-300 font-medium">
                      {story.timeAgo}
                    </span>
                  </div>
                </div>

                {/* Top right badges: Close friends green star or Live badge */}
                {story.user.isCloseFriend && (
                  <div className="w-5 h-5 rounded-full bg-green-500/90 backdrop-blur-md flex items-center justify-center shadow-lg">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
                {story.user.isLive && (
                  <div className="px-1.5 py-0.5 rounded-md bg-red-600/90 text-[9px] font-bold text-white backdrop-blur-md flex items-center gap-1 shadow-lg">
                    <span>LIVE</span>
                  </div>
                )}
              </div>

              {/* BOTTOM: Story Type Badges & Multi-Story Dots */}
              <div className="relative z-10 flex items-center justify-between w-full pt-2">
                {/* Media badge (camera, video, music, location) */}
                <div className="w-6 h-6 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/90">
                  {story.badgeType === 'video' && <Camera className="w-3 h-3" />}
                  {story.badgeType === 'photo' && <Sparkles className="w-3 h-3" />}
                  {story.badgeType === 'music' && <Music className="w-3 h-3" />}
                  {story.badgeType === 'location' && <MapPin className="w-3 h-3 text-cyan-400" />}
                  {story.badgeType === 'live' && <Radio className="w-3 h-3 text-red-400 animate-pulse" />}
                  {story.badgeType === 'star' && <Star className="w-3 h-3 text-green-400 fill-green-400" />}
                </div>

                {/* Multi-story progress dots (e.g. 3 ...) */}
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-1 rounded-full border border-white/10">
                  {Array.from({ length: story.itemsCount || 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        i === 0
                          ? 'bg-gradient-to-r from-purple-400 to-blue-400'
                          : 'bg-white/40'
                      )}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ==================== PULL DOWN REFRESH INDICATOR ==================== */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-6 mb-2">
        <ChevronDown className="w-4 h-4 text-purple-400 animate-bounce" />
        <span>Pull down to refresh</span>
      </div>

      {/* ==================== FULLSCREEN IMMERSIVE STORY VIEWER MODAL ==================== */}
      <AnimatePresence>
        {activeStoryIndex !== null && currentStory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between overflow-hidden"
          >
            {/* Story Top Segmented Progress Bars */}
            <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4 flex gap-1.5">
              {currentStory.items?.map((item, idx) => {
                const isPast = idx < activeItemIndex;
                const isCurrent = idx === activeItemIndex;

                return (
                  <div
                    key={item.id || idx}
                    className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-white transition-all ease-linear"
                      style={{
                        width: isPast ? '100%' : isCurrent ? `${storyProgress}%` : '0%',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Story Top Navigation Bar */}
            <div className="absolute top-7 left-0 right-0 z-30 px-4 flex items-center justify-between">
              {/* Creator info */}
              <div className="flex items-center gap-2.5">
                <img
                  src={currentStory.user.avatar}
                  alt={currentStory.user.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border-2 border-purple-500 object-cover shadow-md"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white drop-shadow">
                      {currentStory.user.name}
                    </span>
                    {currentStory.user.verified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                    )}
                    <span className="text-xs text-white/70">• {currentStory.timeAgo}</span>
                  </div>
                  {currentStory.caption && (
                    <span className="text-xs text-white/90 truncate max-w-[200px] drop-shadow">
                      {currentStory.caption}
                    </span>
                  )}
                </div>
              </div>

              {/* Top Controls: Sound, Pause, Close */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleCloseStory}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Interactive Stage Area */}
            <div
              onClick={handleStoryTap}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
              className="relative w-full h-full flex items-center justify-center cursor-pointer"
            >
              <img
                src={currentItem?.url || currentStory.mediaUrl}
                alt="Story media"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />

              {/* Caption Overlay */}
              {currentItem?.caption && (
                <div className="absolute bottom-24 left-4 right-4 z-20">
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white text-sm">
                    {currentItem.caption}
                  </div>
                </div>
              )}

              {/* Flying Reactions Animation */}
              {flyingParticles.map((particle) => (
                <motion.div
                  key={particle.id}
                  initial={{ opacity: 1, y: 100, scale: 1 }}
                  animate={{ opacity: 0, y: -400, scale: 2 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="absolute bottom-20 text-4xl pointer-events-none z-40"
                  style={{ left: `${particle.x}%` }}
                >
                  {particle.emoji}
                </motion.div>
              ))}
            </div>

            {/* Bottom Action Rail: Reply Bar, Emojis, Gift */}
            <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-3">
              {/* Quick Emojis */}
              <div className="flex items-center justify-between px-2">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="text-2xl hover:scale-125 active:scale-95 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={handleGiftCoin}
                  className="px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600 text-xs font-bold text-white flex items-center gap-1 shadow-lg active:scale-95"
                >
                  <span>🪙 250</span>
                </button>
              </div>

              {/* Reply Input Form */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    placeholder={`Send reply to ${currentStory.user.name}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] flex items-center justify-center text-white disabled:opacity-40 transition-opacity shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== MEMORIES / ARCHIVE MODAL ==================== */}
      <AnimatePresence>
        {isCalendarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn(
                'w-full max-w-md rounded-3xl p-6 border shadow-2xl',
                isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold">Story Memories & Archive</h3>
                </div>
                <button
                  onClick={() => setIsCalendarOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Review your 24-hour highlights, past saved moments, and monthly memory reels.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {stories.slice(0, 3).map((st) => (
                  <div key={st.id} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                    <img src={st.mediaUrl} alt={st.caption} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 px-1 py-0.5 rounded text-white font-mono">
                      {st.timeAgo}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setIsCalendarOpen(false);
                  navigate('/profile/highlights');
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
              >
                Manage Profile Highlights
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
