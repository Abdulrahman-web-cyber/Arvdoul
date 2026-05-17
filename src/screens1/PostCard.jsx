// src/screens/PostCard.jsx - ULTIMATE PRO MAX V15 • ENTERPRISE GRADE • PERFECTED
// 🔥 EVERY POST TYPE • REAL DATES • FOLLOW/FRIEND (NO OVERLAP) • REACTIONS ALWAYS VISIBLE
// 🏆 SWIPEABLE MEDIA • AUTO‑PAUSE • NOTIFICATIONS • BILLION‑SCALE READY

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../store/appStore';
import firestoreService from '../services/firestoreService.js';
import notificationService from '../services/notificationService.js';
import userService from '../services/userService.js';

// ==================== OPTIMISED ICON IMPORTS ====================
import {
  Heart, MessageCircle, Share2, Bookmark, MoreVertical,
  Play, Pause, ChevronLeft, ChevronRight, Smile,
  CheckCircle, BarChart2, HelpCircle, Calendar, Link as LinkIcon,
  Clock, MapPin, Eye, Video as VideoIcon, Music,
  Image as ImageIcon, FileText, Users, Gift,
  Volume2, VolumeX, Maximize2, ExternalLink,
  X, AlertCircle, Globe, Copy, Check, Send,
  Volume, Volume1, UserPlus, UserCheck, UserMinus
} from 'lucide-react';

import { FaCoins, FaHeart, FaRegHeart } from 'react-icons/fa6';

// ==================== UTILITY ====================
const cn = (...classes) => classes.filter(Boolean).join(' ');

const REACTIONS = [
  { emoji: '👍', label: 'Like', value: 'like', color: 'text-blue-500', bg: 'bg-blue-500/20' },
  { emoji: '❤️', label: 'Love', value: 'love', color: 'text-red-500', bg: 'bg-red-500/20' },
  { emoji: '😂', label: 'Haha', value: 'haha', color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  { emoji: '😮', label: 'Wow', value: 'wow', color: 'text-purple-500', bg: 'bg-purple-500/20' },
  { emoji: '😢', label: 'Sad', value: 'sad', color: 'text-indigo-500', bg: 'bg-indigo-500/20' },
  { emoji: '😡', label: 'Angry', value: 'angry', color: 'text-orange-500', bg: 'bg-orange-500/20' },
  { emoji: '🔥', label: 'Fire', value: 'fire', color: 'text-red-600', bg: 'bg-red-600/20' },
  { emoji: '🎉', label: 'Celebrate', value: 'celebrate', color: 'text-pink-500', bg: 'bg-pink-500/20' }
];

const CREATOR_LEVEL = 5;

// ==================== ROBUST DATE FORMATTERS ====================
const formatPostDate = (timestamp) => {
  if (!timestamp) return 'Just now';
  try {
    let date;
    if (timestamp?.toDate) date = timestamp.toDate();
    else if (typeof timestamp === 'string') date = new Date(timestamp);
    else if (timestamp instanceof Date) date = timestamp;
    else date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
};

/**
 * Extracts event date from various possible field names.
 * Supports: startTime, startDate, date, eventDate, start, scheduledTime
 */
const extractEventDate = (event, type = 'start') => {
  if (!event) return null;
  const possibleFields = type === 'start'
    ? ['startTime', 'startDate', 'date', 'eventDate', 'start', 'scheduledTime']
    : ['endTime', 'endDate', 'end'];
  for (const field of possibleFields) {
    if (event[field]) return event[field];
  }
  return null;
};

const formatEventDate = (eventDate) => {
  if (!eventDate) return 'Date not set';
  try {
    let date;
    if (eventDate?.toDate) date = eventDate.toDate();
    else if (typeof eventDate === 'string') date = new Date(eventDate);
    else if (eventDate instanceof Date) date = eventDate;
    else date = new Date(eventDate);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
};

// ==================== DOUBLE TAP HEART ====================
const DoubleTapHeart = React.memo(({ position }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0, rotate: -30 }}
    animate={{ scale: [0, 2.2, 1.8], opacity: [0, 1, 0], rotate: [-30, 15, -10] }}
    exit={{ scale: 0, opacity: 0 }}
    transition={{ duration: 1.2, ease: 'easeOut' }}
    className="fixed pointer-events-none z-[9999]"
    style={{ left: position.x - 48, top: position.y - 48 }}
  >
    <div className="text-8xl animate-pulse">❤️</div>
  </motion.div>
));

// ==================== REACTIONS POPUP (ALWAYS VISIBLE) ====================
const ReactionsPopup = React.memo(({ position, onSelect, theme, onClose }) => {
  const popupRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Clamp position to keep popup fully inside viewport
  const getClampedPosition = () => {
    const popupWidth = 340; // approximate width of popup
    const popupHeight = 80;  // approximate height
    let left = position.x - 130;
    let top = position.y - 100;

    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 20;
    }
    if (left < 20) left = 20;
    if (top + popupHeight > window.innerHeight) {
      top = window.innerHeight - popupHeight - 20;
    }
    if (top < 20) top = 20;
    return { left, top };
  };

  const clamped = getClampedPosition();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[998]"
      />
      <motion.div
        ref={popupRef}
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: 20 }}
        className={`fixed z-[999] ${
          theme === 'dark' ? 'bg-gray-900/95 backdrop-blur-xl' : 'bg-white/95 backdrop-blur-xl'
        } rounded-3xl shadow-2xl p-4 flex gap-3 border-2 ${
          theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'
        }`}
        style={{ left: clamped.left, top: clamped.top }}
      >
        {REACTIONS.map((reaction, idx) => (
          <motion.button
            key={reaction.value}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.4, y: -8, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { onSelect(reaction); onClose(); }}
            className={`text-3xl p-3 rounded-2xl ${reaction.bg} hover:${reaction.bg.replace('/20', '/40')} transition-all`}
            title={reaction.label}
          >
            {reaction.emoji}
          </motion.button>
        ))}
      </motion.div>
    </>
  );
});

// ==================== MEDIA GALLERY (SWIPEABLE) ====================
const MediaGallery = React.memo(({ media, type, onDoubleTap, theme, isVisible }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef(null);
  const controlsTimeout = useRef();

  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current?.pause();
    }
  }, [isVisible, isPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  // Touch swipe
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipe = 50;
  const onTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipe && currentIndex < media.length - 1) setCurrentIndex(prev => prev + 1);
    if (distance < -minSwipe && currentIndex > 0) setCurrentIndex(prev => prev - 1);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Video
  if (type === 'video' && media?.[0]) {
    return (
      <div
        className="relative bg-black rounded-2xl overflow-hidden group"
        onDoubleClick={onDoubleTap}
        onClick={showControlsTemporarily}
      >
        <video
          ref={videoRef}
          src={media[0].url}
          className="w-full h-auto max-h-[600px] object-contain cursor-pointer"
          playsInline
          poster={media[0].thumbnail}
          loop
          muted={isMuted}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={handlePlayPause} className="p-4 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 shadow-2xl">
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
          </button>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm flex items-center gap-1">
                <VideoIcon className="w-4 h-4" /> Video
              </span>
              {media[0].duration && (
                <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm">
                  {media[0].duration}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button onClick={() => window.open(media[0].url, '_blank')} className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single image
  if (media.length === 1) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden group"
        onDoubleClick={onDoubleTap}
        onClick={showControlsTemporarily}
      >
        <img
          src={media[0].url}
          alt="Post content"
          className="w-full h-auto max-h-[600px] object-contain cursor-pointer bg-gradient-to-br from-gray-900/20 to-black/20"
          loading="lazy"
          onError={(e) => { e.target.src = `https://via.placeholder.com/800x600/1f2937/ffffff?text=Image+Not+Found`; }}
        />
        <div className={`absolute top-4 right-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={() => window.open(media[0].url, '_blank')} className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm flex items-center gap-1">
            <ImageIcon className="w-4 h-4" /> Image
          </span>
        </div>
      </div>
    );
  }

  // Multiple images
  return (
    <div
      className="relative h-[500px] bg-black rounded-2xl overflow-hidden group"
      onDoubleClick={onDoubleTap}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={showControlsTemporarily}
    >
      <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {media.map((item, idx) => (
          <div key={idx} className="w-full h-full flex-shrink-0 relative">
            <img src={item.url} alt={`Post ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
            <div className={`absolute top-4 right-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <button onClick={() => window.open(item.url, '_blank')} className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {media.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/70'}`}
              />
            ))}
          </div>
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < media.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}
      <div className="absolute top-4 left-4">
        <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm flex items-center gap-1">
          <ImageIcon className="w-4 h-4" /> {currentIndex + 1} / {media.length}
        </span>
      </div>
    </div>
  );
});

// ==================== AUDIO COMPONENT ====================
const AudioComponent = React.memo(({ audio, postId, currentUser, theme, isVisible }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isVisible && isPlaying) audioRef.current.play().catch(() => {});
      else audioRef.current?.pause();
    }
  }, [isVisible, isPlaying]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => setCurrentTime(audioRef.current.currentTime);
  const handleLoadedMetadata = () => setDuration(audioRef.current.duration);
  const handleSeek = (e) => {
    const time = (e.target.value / 100) * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value) / 100;
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20' : 'bg-gradient-to-br from-green-50/50 to-emerald-50/50'} border ${theme === 'dark' ? 'border-green-700/30' : 'border-green-200/50'} shadow-lg`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 shadow-inner">
          <Music className="w-6 h-6 text-green-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold dark:text-white bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              {audio?.title || 'Audio Track'}
            </h4>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-500 text-xs font-bold border border-green-500/20">
              Audio
            </span>
          </div>
          <p className="text-sm dark:text-gray-300 mt-2">{audio?.artist || 'Unknown artist'}</p>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audio?.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs dark:text-gray-400 w-10">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={duration ? (currentTime / duration) * 100 : 0}
            onChange={handleSeek}
            className="flex-1 h-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-700 accent-green-500"
          />
          <span className="text-xs dark:text-gray-400 w-10">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-1">
              <button onClick={toggleMute} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                {isMuted ? <VolumeX className="w-4 h-4" /> : volume > 0.5 ? <Volume2 className="w-4 h-4" /> : volume > 0.1 ? <Volume1 className="w-4 h-4" /> : <Volume className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={handleVolumeChange}
                className="w-20 h-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-700 accent-green-500"
              />
            </div>
          </div>
          <button
            onClick={() => window.open(audio?.url, '_blank')}
            className="p-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

// ==================== POLL COMPONENT ====================
const PollComponent = React.memo(({ poll, postId, currentUser, theme, post }) => {
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [pollData, setPollData] = useState(() => {
    const options = poll?.options || [];
    const processedOptions = options.map((opt, idx) => {
      if (typeof opt === 'string') {
        return { id: idx, text: opt, votes: 0, percentage: 0 };
      } else if (opt && typeof opt === 'object') {
        return {
          id: idx,
          text: opt.text || opt.option || opt.name || `Option ${idx + 1}`,
          votes: typeof opt.votes === 'number' ? opt.votes : 0,
          percentage: 0
        };
      }
      return { id: idx, text: `Option ${idx + 1}`, votes: 0, percentage: 0 };
    });
    const totalVotes = processedOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    return {
      question: poll?.question || 'What do you think?',
      options: processedOptions,
      totalVotes,
      endsAt: poll?.endsAt ? new Date(poll.endsAt) : new Date(Date.now() + 86400000),
      allowMultiple: poll?.allowMultiple || false,
      isActive: true
    };
  });

  useEffect(() => {
    const total = pollData.options.reduce((sum, o) => sum + o.votes, 0);
    const withPerc = pollData.options.map(o => ({ ...o, percentage: total > 0 ? Math.round((o.votes / total) * 100) : 0 }));
    setPollData(prev => ({ ...prev, options: withPerc, totalVotes: total }));
  }, []);

  const handleVote = async (optionIndex) => {
    if (!currentUser?.uid) return toast.error('Sign in to vote');
    if (hasVoted && !pollData.allowMultiple) return toast.error('You already voted');
    try {
      const result = await firestoreService.voteOnPoll(postId, currentUser.uid, optionIndex, pollData.allowMultiple);
      if (!result.success) throw new Error('Vote failed');

      if (post?.authorId) {
        await notificationService.sendNotification({
          recipientId: post.authorId,
          type: 'poll_vote',
          postId,
          actorId: currentUser.uid,
          actorName: currentUser.displayName,
          timestamp: new Date().toISOString()
        }).catch(console.warn);
      }

      setHasVoted(true);
      setSelectedOption(optionIndex);
      const newOptions = [...pollData.options];
      newOptions[optionIndex].votes += 1;
      const newTotal = pollData.totalVotes + 1;
      const updated = newOptions.map(o => ({ ...o, percentage: Math.round((o.votes / newTotal) * 100) }));
      setPollData(prev => ({ ...prev, options: updated, totalVotes: newTotal }));
      toast.success('Vote counted! 🎉');
    } catch (error) {
      console.error('Vote failed:', error);
      toast.error(error.message);
    }
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const end = new Date(pollData.endsAt);
    const diff = end - now;
    if (diff <= 0) return 'Poll ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h left`;
    return `${Math.floor(diff / (1000 * 60))}m left`;
  };

  const isPollEnded = () => new Date() >= new Date(pollData.endsAt);

  return (
    <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-purple-900/20 to-pink-900/20' : 'bg-gradient-to-br from-purple-50/50 to-pink-50/50'} border ${theme === 'dark' ? 'border-purple-700/30' : 'border-purple-200/50'} shadow-lg`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 shadow-inner">
          <BarChart2 className="w-6 h-6 text-purple-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold dark:text-white bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              {pollData.question}
            </h4>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 text-xs font-bold border border-purple-500/20">
              Poll
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/30">
              {pollData.totalVotes} votes
            </span>
            <span className={`text-sm ${isPollEnded() ? 'text-red-500' : 'dark:text-gray-400'}`}>
              {getTimeRemaining()}
            </span>
            {hasVoted && (
              <span className="text-sm px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/30">
                ✓ Voted
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {pollData.options.map((option, index) => {
          const isSelected = hasVoted && selectedOption === index;
          const disabled = isPollEnded() || (hasVoted && !pollData.allowMultiple);
          return (
            <button
              key={index}
              onClick={() => !disabled && handleVote(index)}
              disabled={disabled}
              className={`w-full p-4 rounded-xl text-left border-2 transition-all relative overflow-hidden group ${
                isSelected
                  ? 'border-purple-500 bg-gradient-to-r from-purple-500/10 to-pink-500/10 shadow-lg'
                  : 'border-gray-300/50 dark:border-gray-700/50 hover:border-purple-500/30 hover:shadow-md'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-center mb-2 z-10 relative">
                <span className="font-medium dark:text-white flex items-center gap-2">
                  {option.text}
                  {isSelected && <CheckCircle className="w-4 h-4 text-purple-500 animate-bounce" />}
                </span>
                {(hasVoted || isPollEnded()) && (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-500">{option.percentage}%</span>
                    <span className="text-sm dark:text-gray-400">({option.votes})</span>
                  </div>
                )}
              </div>
              {(hasVoted || isPollEnded()) && (
                <div className="relative h-2 bg-gray-300/30 dark:bg-gray-700/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${option.percentage}%` }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {!hasVoted && !isPollEnded() && (
        <div className="mt-4 text-center">
          <p className="text-sm dark:text-gray-400">
            Tap an option to vote {pollData.allowMultiple && '(Multiple votes allowed)'}
          </p>
        </div>
      )}
    </div>
  );
});

// ==================== QUESTION COMPONENT ====================
const QuestionComponent = React.memo(({ question, postId, currentUser, theme, post }) => {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [answersCount, setAnswersCount] = useState(0);
  const navigate = useNavigate();

  const getQuestionText = () => {
    if (!question) return 'Ask a Question';
    if (typeof question === 'string') return question;
    if (question.text) return question.text;
    if (question.title) return question.title;
    if (question.content) return question.content;
    if (question.question) return question.question;
    return 'Ask a Question';
  };

  const getQuestionDescription = () => {
    if (!question) return '';
    if (typeof question === 'object') {
      return question.description || question.details || '';
    }
    return '';
  };

  useEffect(() => {
    const fetchAnswers = async () => {
      try {
        const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
        const firestore = await firestoreService.ensureInitialized();
        const answersRef = collection(firestore, `posts/${postId}/answers`);
        const q = query(answersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const loaded = [];
        snapshot.forEach(doc => {
          loaded.push({ id: doc.id, ...doc.data() });
        });
        setAnswers(loaded.slice(0, 2));
        setAnswersCount(loaded.length);
      } catch (err) {
        console.warn('Failed to load answers:', err);
      }
    };
    fetchAnswers();
  }, [postId]);

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !currentUser?.uid || submitting) return;
    setSubmitting(true);
    try {
      const firestore = await firestoreService.ensureInitialized();
      const { collection, addDoc, doc, updateDoc, increment } = await import('firebase/firestore');
      const answersRef = collection(firestore, `posts/${postId}/answers`);
      await addDoc(answersRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous',
        userPhoto: currentUser.photoURL || '/assets/default-profile.png',
        answer: answer.trim(),
        createdAt: new Date().toISOString(),
        upvotes: 0,
        isVerified: false
      });
      const postRef = doc(firestore, 'posts', postId);
      await updateDoc(postRef, { 'stats.answerCount': increment(1) });

      if (post?.authorId) {
        await notificationService.sendNotification({
          recipientId: post.authorId,
          type: 'question_answer',
          postId,
          actorId: currentUser.uid,
          actorName: currentUser.displayName,
          answerPreview: answer.slice(0, 60),
          timestamp: new Date().toISOString()
        }).catch(console.warn);
      }

      setAnswers(prev => [{
        id: Date.now().toString(),
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userPhoto: currentUser.photoURL,
        answer: answer.trim(),
        createdAt: new Date(),
        upvotes: 0
      }, ...prev.slice(0, 1)]);
      setAnswersCount(prev => prev + 1);
      setAnswer('');
      toast.success('Answer submitted! 🎉');
    } catch (error) {
      console.error('Submit answer failed:', error);
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-amber-900/20 to-yellow-900/20' : 'bg-gradient-to-br from-amber-50/50 to-yellow-50/50'} border ${theme === 'dark' ? 'border-amber-700/30' : 'border-amber-200/50'} shadow-lg`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 shadow-inner">
          <HelpCircle className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold dark:text-white bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
              {getQuestionText()}
            </h4>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
              Question
            </span>
          </div>
          {getQuestionDescription() && (
            <p className="text-sm dark:text-gray-300 mt-2">{getQuestionDescription()}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your answer..."
          className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-white resize-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          rows={3}
        />
        <div className="flex gap-3">
          <button
            onClick={handleSubmitAnswer}
            disabled={!answer.trim() || submitting}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Answer
              </>
            )}
          </button>
          {answersCount > 0 && (
            <button
              onClick={() => navigate(`/post/${postId}/answers`)}
              className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              View {answersCount} {answersCount === 1 ? 'Answer' : 'Answers'}
            </button>
          )}
        </div>
      </div>
      {answers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/30">
          <h5 className="font-medium dark:text-white mb-2">Recent Answers:</h5>
          <div className="space-y-2">
            {answers.map((ans) => (
              <div key={ans.id} className="p-3 rounded-lg bg-gray-100/30 dark:bg-gray-800/30">
                <p className="text-sm dark:text-gray-300 line-clamp-2">{ans.answer}</p>
                <div className="flex items-center gap-2 mt-2">
                  <img src={ans.userPhoto} alt={ans.userName} className="w-6 h-6 rounded-full" />
                  <span className="text-xs dark:text-gray-400">{ans.userName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ==================== EVENT COMPONENT (REAL DATES – NOW WORKS) ====================
const EventComponent = React.memo(({ event, theme, post, currentUser }) => {
  const [interested, setInterested] = useState(false);
  const [going, setGoing] = useState(false);

  const startDate = extractEventDate(event, 'start');
  const endDate = extractEventDate(event, 'end');

  const handleGoing = async () => {
    setGoing(!going);
    toast.success(going ? 'Removed from going' : 'You\'re going! 🎉');
    if (post?.authorId && currentUser?.uid) {
      await notificationService.sendNotification({
        recipientId: post.authorId,
        type: 'event_going',
        postId: post.id,
        actorId: currentUser.uid,
        actorName: currentUser.displayName,
        timestamp: new Date().toISOString()
      }).catch(console.warn);
    }
  };

  const handleInterest = async () => {
    setInterested(!interested);
    toast.success(interested ? 'Removed from interested' : 'Marked as interested 🌟');
    if (post?.authorId && currentUser?.uid) {
      await notificationService.sendNotification({
        recipientId: post.authorId,
        type: 'event_interest',
        postId: post.id,
        actorId: currentUser.uid,
        actorName: currentUser.displayName,
        timestamp: new Date().toISOString()
      }).catch(console.warn);
    }
  };

  return (
    <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-orange-900/20 to-red-900/20' : 'bg-gradient-to-br from-orange-50/50 to-red-50/50'} border ${theme === 'dark' ? 'border-orange-700/30' : 'border-orange-200/50'} shadow-lg`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 shadow-inner">
          <Calendar className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold dark:text-white bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              {event?.title || 'Upcoming Event'}
            </h4>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-500 text-xs font-bold border border-orange-500/20">
              Event
            </span>
          </div>
          <p className="text-sm dark:text-gray-300 mt-2">{event?.description || 'Join this amazing event!'}</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/20 dark:bg-gray-800/30 border border-gray-700/30">
          <Clock className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <div className="font-medium dark:text-white">Date & Time</div>
            <div className="text-sm dark:text-gray-300">{formatEventDate(startDate)}</div>
            {endDate && (
              <div className="text-xs dark:text-gray-400 mt-1">Ends: {formatEventDate(endDate)}</div>
            )}
          </div>
        </div>
        {event?.location && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/20 dark:bg-gray-800/30 border border-gray-700/30">
            <MapPin className="w-5 h-5 text-orange-500" />
            <div className="flex-1">
              <div className="font-medium dark:text-white">Location</div>
              <div className="text-sm dark:text-gray-300">{event.location}</div>
            </div>
          </div>
        )}
        {event?.attendees && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/20 dark:bg-gray-800/30 border border-gray-700/30">
            <Users className="w-5 h-5 text-orange-500" />
            <div className="flex-1">
              <div className="font-medium dark:text-white">Attendees</div>
              <div className="text-sm dark:text-gray-300">{event.attendees} people going</div>
            </div>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleGoing}
            className={`flex-1 py-3 rounded-xl font-medium transition-all shadow-md ${
              going
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg'
            }`}
          >
            {going ? '✓ Going' : 'Going'}
          </button>
          <button
            onClick={handleInterest}
            className={`flex-1 py-3 rounded-xl font-medium transition-all shadow-md ${
              interested
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                : 'border border-gray-300 dark:border-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {interested ? '✓ Interested' : 'Interested'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ==================== LINK COMPONENT ====================
const LinkComponent = React.memo(({ link, theme }) => {
  const [copied, setCopied] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link?.url || '');
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleVisitLink = () => {
    if (!link?.url) return;
    const isInternal = link.url.startsWith('/') || link.url.includes(window.location.hostname);
    if (!isInternal) setShowWarning(true);
    else window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const getDomain = (url) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'external site'; }
  };

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setShowWarning(false)} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative z-10 max-w-md w-full p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} shadow-2xl`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white">External Link Warning</h3>
                <p className="text-sm dark:text-gray-400">You are leaving Arvdoul</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="dark:text-gray-300 mb-3">
                This link will take you to <span className="font-bold text-blue-500">{getDomain(link?.url)}</span>, which is not operated by Arvdoul.
              </p>
              <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
                <p className="text-sm dark:text-gray-300 font-bold">⚠️ Security Tips:</p>
                <ul className="mt-2 space-y-1 text-sm dark:text-gray-400">
                  <li>• Verify the website is legitimate</li>
                  <li>• Don't enter sensitive information</li>
                  <li>• Check for HTTPS in the address bar</li>
                  <li>• Beware of phishing attempts</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { window.open(link.url, '_blank', 'noopener,noreferrer'); setShowWarning(false); }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg"
              >
                Proceed
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-700 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-900/20 to-blue-900/20' : 'bg-gradient-to-br from-indigo-50/50 to-blue-50/50'} border ${theme === 'dark' ? 'border-indigo-700/30' : 'border-indigo-200/50'} shadow-lg`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/20 to-blue-500/20 shadow-inner">
            <LinkIcon className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold dark:text-white bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">
                {link?.title || 'Check this out!'}
              </h4>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 text-indigo-500 text-xs font-bold border border-indigo-500/20">
                Link
              </span>
            </div>
            <p className="text-sm dark:text-gray-300 mt-2">{link?.description || 'An interesting link'}</p>
          </div>
        </div>
        <div className="space-y-4">
          {link?.image && (
            <div className="rounded-xl overflow-hidden border border-gray-700/30">
              <img src={link.image} alt={link.title} className="w-full h-48 object-cover" loading="lazy" />
            </div>
          )}
          <div className="p-4 rounded-xl bg-gray-800/20 dark:bg-gray-800/30 border border-gray-700/30">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-500" />
              <div className="flex-1 truncate">
                <div className="font-medium dark:text-white">Website</div>
                <div className="text-sm dark:text-gray-300 truncate">{link?.url}</div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleVisitLink}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-medium hover:shadow-lg flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Link
            </button>
            <button
              onClick={handleCopyLink}
              className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="pt-4 border-t border-gray-700/30">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Always verify the source before clicking on external links
            </p>
          </div>
        </div>
      </div>
    </>
  );
});

// ==================== MAIN POST CARD ====================
const PostCard = React.memo(({
  post,
  theme,
  currentUser,
  onComment,
  onShowOptions,
  onShowGifts,
  onReactionSelect,
  navigate
}) => {
  // ========== STATE ==========
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [followState, setFollowState] = useState('none'); // 'none', 'following', 'requested', 'friends'
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [reactionPosition, setReactionPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const lastTapRef = useRef(0);
  const postRef = useRef(null);
  const reactionsButtonRef = useRef(null);

  // ========== MEMOIZED ==========
  const isAuthor = useMemo(() => currentUser?.uid && post.authorId === currentUser.uid, [currentUser, post]);
  const isCreator = useMemo(() => (post.authorLevel || 1) >= CREATOR_LEVEL, [post.authorLevel]);
  const canFollow = useMemo(() => isCreator && !isAuthor && currentUser?.uid, [isCreator, isAuthor, currentUser]);
  const canFriend = useMemo(() => !isCreator && !isAuthor && currentUser?.uid, [isCreator, isAuthor, currentUser]);

  // ========== INIT ==========
  useEffect(() => {
    if (post.likedBy && currentUser?.uid) setIsLiked(post.likedBy.includes(currentUser.uid));
    if (post.savedBy && currentUser?.uid) setIsSaved(post.savedBy.includes(currentUser.uid));
    // TODO: fetch follow/friend status from userService (implement in your service)
  }, [post, currentUser]);

  // ========== VISIBILITY ==========
  useEffect(() => {
    if (!postRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.6 }
    );
    observer.observe(postRef.current);
    return () => observer.disconnect();
  }, []);

  // ========== HANDLERS ==========
  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 1200);
    }
    lastTapRef.current = now;
  };

  const handleLike = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to like');
    try {
      setIsLiked(!isLiked);
      await firestoreService.likePost(post.id, currentUser.uid);
      if (!isLiked) toast.success('Post liked! ❤️');
    } catch (err) {
      setIsLiked(isLiked);
      toast.error('Failed to like');
    }
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to save');
    try {
      setIsSaved(!isSaved);
      await firestoreService.savePost(post.id, currentUser.uid);
      toast.success(isSaved ? 'Removed from saved' : 'Saved to collection! 📌');
    } catch (err) {
      setIsSaved(isSaved);
      toast.error('Failed to save');
    }
  };

  const handleShare = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to share');
    try {
      await firestoreService.sharePost(post.id, currentUser.uid);
      toast.success('Post shared! 📤');
    } catch (err) {
      toast.error('Failed to share');
    }
  };

  // ----- FOLLOW (Creators) -----
  const handleFollow = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to follow');
    try {
      if (followState === 'following') {
        await userService.unfollowUser(currentUser.uid, post.authorId);
        setFollowState('none');
        toast.success(`Unfollowed ${post.authorName}`);
      } else {
        await userService.followUser(currentUser.uid, post.authorId);
        setFollowState('following');
        toast.success(`Following ${post.authorName}! 🤝`);
        await notificationService.sendNotification({
          recipientId: post.authorId,
          type: 'follow',
          actorId: currentUser.uid,
          actorName: currentUser.displayName,
          timestamp: new Date().toISOString()
        }).catch(console.warn);
      }
    } catch (err) {
      toast.error('Failed to update follow');
    }
  };

  // ----- FRIEND REQUEST (Normal users) -----
  const handleFriendRequest = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to add friend');
    try {
      if (followState === 'friends') {
        await userService.removeFriend(currentUser.uid, post.authorId);
        setFollowState('none');
        toast.success(`Removed friend ${post.authorName}`);
      } else if (followState === 'requested') {
        await userService.cancelFriendRequest(currentUser.uid, post.authorId);
        setFollowState('none');
        toast.success('Friend request cancelled');
      } else {
        await userService.sendFriendRequest(currentUser.uid, post.authorId);
        setFollowState('requested');
        toast.success(`Friend request sent to ${post.authorName} ✉️`);
        await notificationService.sendNotification({
          recipientId: post.authorId,
          type: 'friend_request',
          actorId: currentUser.uid,
          actorName: currentUser.displayName,
          timestamp: new Date().toISOString()
        }).catch(console.warn);
      }
    } catch (err) {
      toast.error('Failed to process friend request');
    }
  };

  const handleReactionSelect = async (reaction) => {
    if (!currentUser?.uid) return toast.error('Sign in to react');
    try {
      if (!isLiked) await firestoreService.likePost(post.id, currentUser.uid);
      toast.success(`Reacted with ${reaction.emoji}`);
      if (onReactionSelect) onReactionSelect(post.id, reaction);
    } catch (err) {
      toast.error('Failed to react');
    }
  };

  const handleReactionsClick = (e) => {
    if (reactionsButtonRef.current) {
      const rect = reactionsButtonRef.current.getBoundingClientRect();
      setReactionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 20 // place above button
      });
    }
    setShowReactions(!showReactions);
  };

  // ========== POST TYPE INFO ==========
  const getPostTypeInfo = () => {
    switch (post.type) {
      case 'video': return { icon: VideoIcon, color: 'from-red-500 to-orange-500', label: 'Video' };
      case 'audio': return { icon: Music, color: 'from-green-500 to-emerald-500', label: 'Audio' };
      case 'poll': return { icon: BarChart2, color: 'from-purple-500 to-pink-500', label: 'Poll' };
      case 'question': return { icon: HelpCircle, color: 'from-amber-500 to-yellow-500', label: 'Question' };
      case 'event': return { icon: Calendar, color: 'from-orange-500 to-red-500', label: 'Event' };
      case 'link': return { icon: LinkIcon, color: 'from-indigo-500 to-blue-500', label: 'Link' };
      default: return { icon: FileText, color: 'from-gray-500 to-gray-600', label: 'Post' };
    }
  };
  const postTypeInfo = getPostTypeInfo();

  // ========== RENDER ==========
  return (
    <motion.article
      ref={postRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-3xl overflow-hidden border",
        "w-full max-w-2xl mx-auto",
        "shadow-2xl hover:shadow-3xl transition-shadow duration-300",
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-900/90 to-gray-800/90 border-gray-700/50'
          : 'bg-gradient-to-br from-white to-gray-50/90 border-gray-200'
      )}
    >
      {/* ---------- HEADER – NO OVERLAP (GRID LAYOUT) ---------- */}
      <div className="p-4 border-b border-gray-700/30 dark:border-gray-700">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
          {/* Left side: profile + name/username */}
          <button
            onClick={() => navigate(`/profile/${post.authorId}`)}
            className="flex items-center gap-3 group min-w-0"
          >
            <div className="relative flex-shrink-0">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${
                isCreator ? 'from-yellow-400 to-amber-500' : 'from-gray-400 to-gray-600'
              } p-0.5 shadow-lg`}>
                <img
                  src={post.authorPhoto || '/assets/default-profile.png'}
                  alt={post.authorName}
                  className="w-full h-full rounded-full border-2 border-white dark:border-gray-900 group-hover:scale-105 transition-transform"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=random`;
                  }}
                />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 border-2 border-white dark:border-gray-900 shadow-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold dark:text-white truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  {post.authorName || 'User'}
                </h3>
                {isCreator && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-500 text-xs font-bold border border-yellow-500/30 whitespace-nowrap">
                    Creator
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="dark:text-gray-400 truncate">@{post.authorUsername || 'user'}</span>
                <span className="dark:text-gray-400">·</span>
                <span className="dark:text-gray-400 whitespace-nowrap">{formatPostDate(post.createdAt)}</span>
                {post.location && (
                  <>
                    <span className="dark:text-gray-400">·</span>
                    <span className="dark:text-gray-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{post.location}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Right side: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canFollow && (
              <button
                onClick={handleFollow}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all shadow-md whitespace-nowrap ${
                  followState === 'following'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg'
                }`}
              >
                {followState === 'following' ? 'Following' : 'Follow'}
              </button>
            )}
            {canFriend && (
              <button
                onClick={handleFriendRequest}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all shadow-md whitespace-nowrap flex items-center gap-1 ${
                  followState === 'friends'
                    ? 'bg-green-500 text-white'
                    : followState === 'requested'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg'
                }`}
              >
                {followState === 'friends' ? (
                  <>
                    <UserCheck className="w-4 h-4" /> Friends
                  </>
                ) : followState === 'requested' ? (
                  <>
                    <UserMinus className="w-4 h-4" /> Requested
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Add Friend
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => onShowOptions?.(post)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------- POST TYPE BADGE ---------- */}
      {post.type !== 'ad' && post.type !== 'text' && (
        <div className="px-4 pt-2">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${postTypeInfo.color}/10 text-${postTypeInfo.color.split('from-')[1].split('-')[0]}-500 text-xs font-bold border border-current/20`}>
            <postTypeInfo.icon className="w-3 h-3" />
            {postTypeInfo.label}
          </span>
        </div>
      )}

      {/* ---------- TEXT CONTENT ---------- */}
      {post.content && (
        <div className="p-4">
          <p className="whitespace-pre-line dark:text-gray-100 text-lg leading-relaxed font-light">
            {post.content}
          </p>
          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.hashtags.map((tag, idx) => (
                <span
                  key={idx}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- MEDIA (IMAGE/VIDEO) ---------- */}
      {post.media?.length > 0 && post.type !== 'audio' && (
        <div className="px-4 pb-4">
          <MediaGallery
            media={post.media}
            type={post.type}
            onDoubleTap={handleDoubleTap}
            theme={theme}
            isVisible={isVisible}
          />
        </div>
      )}

      {/* ---------- POST TYPE SPECIFIC ---------- */}
      {post.type === 'poll' && (
        <PollComponent poll={post.poll} postId={post.id} currentUser={currentUser} theme={theme} post={post} />
      )}
      {post.type === 'question' && (
        <QuestionComponent question={post.question} postId={post.id} currentUser={currentUser} theme={theme} post={post} />
      )}
      {post.type === 'event' && (
        <EventComponent event={post.event} theme={theme} post={post} currentUser={currentUser} />
      )}
      {post.type === 'link' && (
        <LinkComponent link={post.link} theme={theme} />
      )}
      {post.type === 'audio' && (
        <AudioComponent audio={post.media?.[0]} postId={post.id} currentUser={currentUser} theme={theme} isVisible={isVisible} />
      )}

      {/* ---------- STATS BAR ---------- */}
      <div className="px-4 py-3 border-t border-gray-700/30 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              {isLiked ? <FaHeart className="w-4 h-4 text-red-500 fill-current" /> : <FaRegHeart className="w-4 h-4" />}
              <span className="font-medium dark:text-gray-300">{(post.stats?.likes || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium dark:text-gray-300">{(post.stats?.comments || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              <span className="font-medium dark:text-gray-300">{(post.stats?.shares || 0).toLocaleString()}</span>
            </div>
            {isCreator && post.stats?.gifts > 0 && (
              <div className="flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-yellow-500" />
                <span className="font-medium dark:text-gray-300">{(post.stats?.gifts || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 dark:text-gray-400 text-sm">
            <Eye className="w-4 h-4" />
            <span>{(post.stats?.views || 0).toLocaleString()} views</span>
          </div>
        </div>
      </div>

      {/* ---------- ACTION BUTTONS ---------- */}
      <div className="grid grid-cols-5 gap-1 p-2 border-t border-gray-700/30 dark:border-gray-700">
        <div className="relative">
          <button
            ref={reactionsButtonRef}
            onClick={handleReactionsClick}
            className="w-full flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors"
          >
            <Smile className={`w-6 h-6 mb-1 transition-all duration-300 ${
              isLiked ? 'text-red-500 group-hover:scale-110' : 'group-hover:scale-110 group-hover:text-blue-500'
            }`} />
            <span className="text-xs dark:text-gray-300">React</span>
          </button>
          <AnimatePresence>
            {showReactions && (
              <ReactionsPopup
                position={reactionPosition}
                onSelect={handleReactionSelect}
                theme={theme}
                onClose={() => setShowReactions(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => onComment?.(post)}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors"
        >
          <MessageCircle className="w-6 h-6 mb-1 group-hover:scale-110 group-hover:text-blue-500 transition-all" />
          <span className="text-xs dark:text-gray-300">Comment</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors"
        >
          <Share2 className="w-6 h-6 mb-1 group-hover:scale-110 group-hover:text-green-500 transition-all" />
          <span className="text-xs dark:text-gray-300">Share</span>
        </button>

        <button
          onClick={handleSave}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors"
        >
          <Bookmark className={`w-6 h-6 mb-1 transition-all duration-300 ${
            isSaved
              ? 'fill-current text-yellow-500 group-hover:scale-110'
              : 'group-hover:scale-110 group-hover:text-yellow-500'
          }`} />
          <span className="text-xs dark:text-gray-300">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {isCreator && !isAuthor && (
          <button
            onClick={() => onShowGifts?.(post)}
            className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors"
          >
            <Gift className="w-6 h-6 mb-1 group-hover:scale-110 group-hover:text-pink-500 transition-all" />
            <span className="text-xs dark:text-gray-300">Gift</span>
          </button>
        )}
      </div>

      {/* ---------- DOUBLE TAP HEART ---------- */}
      <AnimatePresence>
        {showDoubleTapHeart && <DoubleTapHeart position={tapPosition} />}
      </AnimatePresence>
    </motion.article>
  );
});

PostCard.displayName = 'PostCard';
export default PostCard;