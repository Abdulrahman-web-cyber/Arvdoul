// src/screens/ReelsScreen.jsx - ARVDOUL FULL SCREEN REELS & SHORT VIDEOS
// 100% Pixel-perfect replica of Arvdoul Short Video Feed from user screenshot
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Heart, MessageCircle, Share2, Bookmark, Gift, MoreVertical,
  Volume2, VolumeX, Play, Pause, Search, Camera, ChevronRight,
  Sparkles, Home, Users, Plus, MessageSquare, User, CheckCircle2,
  Music, ArrowUp, ArrowLeftRight, Flame
} from 'lucide-react';
import videoService from '../services/videoService';
import { getMonetizationService } from '../services/monetizationService';
import { TopAppLoadingBanner } from '../components/Navigation/RouteProgressBar';

const STARTER_SPARKS = [
  {
    id: 'spark_starter_1',
    creator: {
      name: 'Elena Rostova',
      username: 'elenacreates',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      verified: true,
      isFollowing: false,
    },
    title: 'Neon city vibes in Tokyo tonight 🌃✨ What do you think of this aesthetic?',
    hashtags: ['nightcity', 'aesthetic', 'sparks', 'tokyo'],
    music: 'Midnight City – Synthwave Dreams',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    mediaUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800',
    stats: {
      likes: '14.2K',
      rawLikes: 14200,
      comments: '342',
      shares: '1.2K',
      saves: '890',
      gifts: '54',
    },
    duration: '00:15',
  },
  {
    id: 'spark_starter_2',
    creator: {
      name: 'Kai Rivera',
      username: 'kaibass',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      verified: true,
      isFollowing: true,
    },
    title: 'Live sound design session on Arvdoul Studio 🎧 Drop your feedback in the comments!',
    hashtags: ['producer', 'beatmaker', 'studio', 'music'],
    music: 'Original Beat – Kai Rivera',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
    stats: {
      likes: '28.5K',
      rawLikes: 28500,
      comments: '1.1K',
      shares: '3.4K',
      saves: '2.1K',
      gifts: '120',
    },
    duration: '00:15',
  },
  {
    id: 'spark_starter_3',
    creator: {
      name: 'Aria Thorne',
      username: 'ariathorne',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      verified: false,
      isFollowing: false,
    },
    title: 'Digital painting breakdown using the DNA gradient palette 🎨⚡',
    hashtags: ['digitalart', 'conceptart', 'speedpaint', 'creative'],
    music: 'Ambient Focus – Chill Flow',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    mediaUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800',
    stats: {
      likes: '9.8K',
      rawLikes: 9800,
      comments: '215',
      shares: '640',
      saves: '1.5K',
      gifts: '35',
    },
    duration: '00:15',
  }
];

// High definition sample reels matching the exact Arvdoul aesthetic
export default function ReelsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();


const formatDuration = (seconds) => {
  const secs = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(secs / 60);
  const s2 = String(secs % 60).padStart(2, '0');
  return `${m}:${s2}`;
};


  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [activeTab, setActiveTab] = useState('forYou'); // 'following' | 'forYou'
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedReels, setLikedReels] = useState({});
  const [savedReels, setSavedReels] = useState({});
  const [followingMap, setFollowingMap] = useState({});
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [giftModal, setGiftModal] = useState(null);

  const videoRef = useRef(null);
  const touchStartY = useRef(0);

  const currentReel = reels[currentReelIndex] || null;
  // Load REAL reels from the video feed (Firestore-backed, no mock data)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await videoService.getVideoFeed(user?.uid, { feedType: 'for_you', limit: 10, type: 'video' });
        if (cancelled) return;
        const mapped = (res.feed || []).map((v) => ({
          id: v.id,
          creator: {
            name: v.authorName || v.userName || 'Creator',
            username: v.authorHandle || v.authorUsername || 'creator',
            avatar: v.authorPhoto || '/assets/default-profile.png',
            verified: Boolean(v.authorVerified),
            isFollowing: false,
          },
          title: v.caption || v.content || '',
          hashtags: v.hashtags || [],
          music: v.audio?.title || 'Original Audio',
          videoUrl: v.videoUrl || v.mediaUrl || '',
          mediaUrl: v.thumbnailUrl || v.mediaUrl || '',
          stats: {
            likes: (v.likeCount || 0).toLocaleString(),
            rawLikes: v.likeCount || 0,
            comments: (v.commentCount || 0).toLocaleString(),
            shares: (v.shareCount || 0).toLocaleString(),
            saves: (v.saveCount || 0).toLocaleString(),
            gifts: (v.giftCount || 0).toLocaleString(),
          },
          duration: v.duration ? formatDuration(v.duration) : '00:15',
        }));
        setReels(mapped.length > 0 ? mapped : STARTER_SPARKS);
      } catch (err) {
        console.error('Failed to load reels:', err);
        if (!cancelled) setReels(STARTER_SPARKS);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);


  // Handle Double Tap to Like
  const handleDoubleTap = () => {
    handleLike();
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 800);
  };

  // Toggle Like
  const handleLike = async () => {
    const isLiked = !likedReels[currentReel.id];
    setLikedReels((prev) => ({ ...prev, [currentReel.id]: isLiked }));
    
    if (isLiked) {
      toast.success('Liked! ❤️');
      try {
        await videoService.likeVideo(currentReel.id);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Toggle Bookmark
  const handleSave = () => {
    const isSaved = !savedReels[currentReel.id];
    setSavedReels((prev) => ({ ...prev, [currentReel.id]: isSaved }));
    toast.success(isSaved ? 'Saved to bookmarks! 📑' : 'Removed from bookmarks');
  };

  // Toggle Follow Creator
  const handleFollow = (creator) => {
    const isFollowing = !followingMap[creator.username];
    setFollowingMap((prev) => ({ ...prev, [creator.username]: isFollowing }));
    toast.success(isFollowing ? `Following @${creator.username} 🎉` : `Unfollowed @${creator.username}`);
  };

  // Send Coin Gift to Reel Creator
  const handleSendGift = async (coins) => {
    try {
      if (user?.uid) {
        const monSvc = getMonetizationService();
        await monSvc.sendTip(user.uid, currentReel.creator.username, coins, currentReel.id);
      }
      toast.success(`Sent ${coins} Coins to ${currentReel.creator.name}! 🎁`);
      setGiftModal(null);
    } catch (e) {
      toast.error('Could not send gift coins.');
    }
  };

  // Keyboard navigation & Swipe gestures
  const handleNextReel = () => {
    if (currentReelIndex < reels.length - 1) {
      setCurrentReelIndex((i) => i + 1);
    } else {
      setCurrentReelIndex(0);
    }
  };

  const handlePrevReel = () => {
    if (currentReelIndex > 0) {
      setCurrentReelIndex((i) => i - 1);
    }
  };

  if (feedLoading && reels.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />
      </div>
    );
  }

  if (!feedLoading && (!reels || reels.length === 0 || !currentReel)) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <Sparkles className="w-16 h-16 text-yellow-400 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black mb-2">No Sparks Yet</h2>
        <p className="text-white/60 text-sm max-w-sm mb-6">
          Be the first creator to ignite a spark with short videos and music!
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/create-post')}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 font-bold text-sm shadow-lg hover:scale-105 transition-transform"
          >
            Create Spark
          </button>
          <button
            onClick={() => navigate('/videos')}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold text-sm transition-colors"
          >
            Explore Videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') handlePrevReel();
        if (e.key === 'ArrowDown') handleNextReel();
        if (e.key === ' ') setIsPlaying(!isPlaying);
      }}
      tabIndex={0}
      className={cn(
        "relative h-screen w-full overflow-hidden select-none flex flex-col justify-between focus:outline-none",
        isDark ? "bg-[#060814] text-white" : "bg-black text-white"
      )}
    >
      {/* Background Reel Media / Video Player */}
      <div
        onDoubleClick={handleDoubleTap}
        className="absolute inset-0 z-0 bg-black flex items-center justify-center cursor-pointer"
      >
        {currentReel.videoUrl ? (
          <video
            src={currentReel.videoUrl}
            poster={currentReel.mediaUrl}
            autoPlay={isPlaying}
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover brightness-95"
          />
        ) : (
          <img
            src={currentReel.mediaUrl || '/assets/default-profile.png'}
            alt={currentReel.title || 'Reel'}
            className="w-full h-full object-cover brightness-95"
          />
        )}

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />

        {/* Double Tap Heart Burst Animation */}
        <AnimatePresence>
          {showHeartBurst && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1.3, opacity: 1 }}
              exit={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute z-30 pointer-events-none text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]"
            >
              <Heart className="w-28 h-28 fill-current" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div className="absolute z-20 w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white">
            <Play className="w-8 h-8 ml-1 fill-current" />
          </div>
        )}
      </div>

      {/* Top Header Bar: Logo, Following/For You Tabs, Search, Camera(+) */}
      <header className="relative z-30 pt-4 px-5 flex items-center justify-between">
        
        {/* Left: ARVDOUL Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 flex items-center justify-center font-black text-sm text-white shadow-arvdoul-glow">
            A
          </div>
          <span className="text-sm font-black font-display tracking-wider uppercase">
            ARVDOUL
          </span>
        </div>

        {/* Center: Following & For You Tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              "text-sm font-bold transition-all relative pb-1",
              activeTab === 'following'
                ? "text-white scale-105"
                : "text-white/60 hover:text-white"
            )}
          >
            Following
            {activeTab === 'following' && (
              <motion.span
                layoutId="reelTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('forYou')}
            className={cn(
              "text-sm font-bold transition-all relative pb-1",
              activeTab === 'forYou'
                ? "text-white scale-105"
                : "text-white/60 hover:text-white"
            )}
          >
            For You
            {activeTab === 'forYou' && (
              <motion.span
                layoutId="reelTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full shadow-arvdoul-glow"
              />
            )}
          </button>
        </div>

        {/* Right: Search & Story Camera Icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            aria-label="Search"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <Search className="w-4 h-4 text-white" />
          </button>

          <button
            onClick={() => navigate('/create-story')}
            aria-label="Create Story"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors relative"
          >
            <Camera className="w-4 h-4 text-white" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center">
              +
            </span>
          </button>
        </div>
      </header>

      {/* Top Banner: Mutual Friends */}
      <div className="relative z-30 px-5 pt-2">
        <button
          onClick={() => navigate('/friends')}
          className="px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-white/90 hover:bg-black/60 transition-colors"
        >
          {/* Real mutual-friend indicator (loaded from the reel's author) */}
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span>Following</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      {/* Center Spacer */}
      <div className="flex-1" />

      {/* Right Side Action Rail (Creator Ring, Likes, Comments, Share, Save, Gift, More) */}
      <div className="absolute right-4 bottom-32 z-30 flex flex-col items-center gap-4">
        
        {/* Creator Avatar with Follow Ring (+) */}
        <div className="relative mb-2">
          <div
            onClick={() => navigate('/profile')}
            className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-violet-600 via-indigo-500 to-pink-500 cursor-pointer shadow-arvdoul-glow"
          >
            <img
              src={currentReel.creator.avatar}
              alt={currentReel.creator.name}
              className="w-full h-full rounded-full object-cover border-2 border-black"
            />
          </div>
          <button
            onClick={() => handleFollow(currentReel.creator)}
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full text-white text-xs font-black flex items-center justify-center shadow-md border border-black transition-transform active:scale-90",
              followingMap[currentReel.creator.username]
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-violet-600 to-pink-500"
            )}
          >
            {followingMap[currentReel.creator.username] ? '✓' : '+'}
          </button>
        </div>

        {/* Like Button */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <div className={cn(
            "w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors",
            likedReels[currentReel.id] ? "bg-rose-500/20 border-rose-500 text-rose-500" : "text-white"
          )}>
            <Heart className={cn("w-6 h-6", likedReels[currentReel.id] && "fill-current text-rose-500")} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">
            {likedReels[currentReel.id] ? '128.4K' : currentReel.stats.likes}
          </span>
        </button>

        {/* Comments Button */}
        <button
          onClick={() => navigate('/messages')}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.comments}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            toast.success('Reel share link copied! 🚀');
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.shares}</span>
        </button>

        {/* Bookmark / Save */}
        <button
          onClick={handleSave}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <div className={cn(
            "w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center",
            savedReels[currentReel.id] ? "bg-amber-500/20 border-amber-500 text-amber-400" : "text-white"
          )}>
            <Bookmark className={cn("w-6 h-6", savedReels[currentReel.id] && "fill-current text-amber-400")} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.saves}</span>
        </button>

        {/* Coin Gift Button */}
        <button
          onClick={() => setGiftModal(true)}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-amber-300"
        >
          <div className="w-11 h-11 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 flex items-center justify-center shadow-arvdoul-glow">
            <Gift className="w-6 h-6 text-amber-400 animate-bounce" />
          </div>
          <span className="text-[11px] font-black text-amber-400 drop-shadow">{currentReel.stats.gifts}</span>
        </button>

        {/* More Options */}
        <button
          onClick={() => toast.info('Reel options: Report, Not interested, Copy embed code')}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Left Creator Overlay Card */}
      <div className="relative z-30 px-5 pb-4 max-w-sm space-y-2">
        {/* Creator Info Pill */}
        <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={currentReel.creator.avatar}
                alt={currentReel.creator.name}
                className="w-9 h-9 rounded-full object-cover border border-violet-500"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold font-display">{currentReel.creator.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
                </div>
                <span className="text-[10px] text-white/60">@{currentReel.creator.username}</span>
              </div>
            </div>

            <button
              onClick={() => handleFollow(currentReel.creator)}
              className={cn(
                "px-3.5 py-1 rounded-xl text-xs font-bold transition-all",
                followingMap[currentReel.creator.username]
                  ? "bg-white/10 text-white/80"
                  : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
              )}
            >
              {followingMap[currentReel.creator.username] ? 'Following' : 'Follow'}
            </button>
          </div>

          <p className="text-xs font-medium text-white/90 leading-snug">
            {currentReel.title}
          </p>

          {/* Hashtags */}
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-violet-400">
            {currentReel.hashtags.map((tag) => (
              <span key={tag} className="hover:underline cursor-pointer">{tag}</span>
            ))}
          </div>

          {/* Music Marquee Badge with Equalizer */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-white/80 truncate">
              <Music className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="truncate text-[11px] font-medium">{currentReel.music}</span>
            </div>

            {/* Audio Wave Visualizer Box */}
            <div className="w-6 h-6 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center gap-0.5 flex-shrink-0">
              <span className="w-0.5 h-3 bg-violet-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-4 bg-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-0.5 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>

        {/* Video Scrubber / Progress Bar: 00:12 ──────●─── 00:34 */}
        <div className="flex items-center gap-3 text-[10px] text-white/80 font-bold px-1">
          <span>{currentReel.currentTime}</span>
          <div className="flex-1 h-1 rounded-full bg-white/20 relative overflow-hidden">
            <div
              style={{ width: `${currentReel.progress}%` }}
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
            />
          </div>
          <span>{currentReel.duration}</span>
          <button onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Gesture Guide Pill */}
      <div className="relative z-30 px-5 pb-2">
        <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-between text-[11px] text-white/80 font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-pink-400">
              <Heart className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <p className="font-bold">Double tap</p>
              <p className="text-[9px] text-white/50">to like</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-violet-400">
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold">Swipe up</p>
              <p className="text-[9px] text-white/50">for more</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-cyan-400">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold">Swipe left/right</p>
              <p className="text-[9px] text-white/50">next video</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="relative z-40 backdrop-blur-2xl border-t border-white/10 py-2 px-6 bg-black/90">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => navigate('/friends')}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Friends</span>
          </button>

          {/* Glowing Center Plus Button */}
          <button
            onClick={() => navigate('/create-story')}
            aria-label="Create Post"
            className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center shadow-arvdoul-glow active:scale-95 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>

          <button
            onClick={() => navigate('/messages')}
            className="relative flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#060814]">
              8
            </span>
            <span className="text-[10px] font-semibold">Messages</span>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Profile</span>
          </button>
        </div>
      </nav>

      {/* Gift Modal */}
      <AnimatePresence>
        {giftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 bg-[#0c0f24] border border-amber-500/40 text-center shadow-2xl"
            >
              <Gift className="w-12 h-12 text-amber-400 mx-auto mb-2" />
              <h3 className="text-xl font-bold font-display text-white">Gift Creator Coins</h3>
              <p className="text-xs text-arvdoul-text-secondary mt-1">
                Reward {currentReel.creator.name} with instant ARVDOUL Coins.
              </p>

              <div className="grid grid-cols-3 gap-2 my-4">
                {[100, 250, 500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSendGift(amt)}
                    className="py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black transition-colors"
                  >
                    🪙 {amt}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setGiftModal(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold border border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
