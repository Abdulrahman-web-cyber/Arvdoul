// src/screens/LiveScreen.jsx - ARVDOUL WORLD-CLASS LIVE SCREEN
// Live streaming with camera, chat, and gifts
// Surpasses TikTok, Instagram, YouTube with futuristic live streaming

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Gift,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  X,
  Send,
  Phone,
  PhoneOff,
  Settings,
  Camera,
  Eye,
  DollarSign,
  Crown,
  Diamond,
  Rocket,
  Star,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatDuration, formatViewCount } from '../utils/videoUtils';
import { toast } from 'sonner';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import GlassCard from '../components/UI/GlassCard';
import GlassButton from '../components/UI/GlassButton';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';

/**
 * LiveScreen - Live streaming interface
 * Supports: start live, watch live, chat, gifts, analytics
 * World-class UI with ARVDOUL DNA design system
 */
const LiveScreen = () => {
  const { theme, isDark, gradient, glass, spring, colors } = useTheme();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [showStartOptions, setShowStartOptions] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [viewers, setViewers] = useState(0);
  const [gifts, setGifts] = useState([]);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState('discover');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);

  // Start streaming
  const handleStartLive = async () => {
    if (!liveTitle.trim()) {
      toast.error('Please enter a title for your stream');
      return;
    }

    try {
      // Request camera/mic permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setIsStreaming(true);
      toast.success('You are now live!');
      
      // Simulate viewers
      const interval = setInterval(() => {
        setViewers((v) => Math.min(v + Math.floor(Math.random() * 5), 500));
      }, 2000);

      // Duration timer
      const timer = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Store cleanup
      return () => {
        clearInterval(interval);
        clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
      };
    } catch (err) {
      console.error('Failed to start live:', err);
      toast.error('Failed to access camera/microphone');
    }
  };

  // Stop streaming
  const handleStopLive = () => {
    setIsStreaming(false);
    setLiveTitle('');
    setViewers(0);
    setDuration(0);
    toast.success('Stream ended');
  };

  // Watch mode
  const handleWatchLive = (streamerId) => {
    setIsWatching(true);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            Live
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {['discover', 'following', 'trending'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-red-500'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4">
        {/* Start Live Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowStartOptions(true)}
          className="w-full p-6 rounded-3xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 flex items-center gap-4 mb-6"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
            <Video className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-lg font-bold text-white">Go Live</h3>
            <p className="text-white/60 text-sm">Start streaming to your audience</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MoreHorizontal className="w-5 h-5 text-white/60" />
          </div>
        </motion.button>

        {/* Live Streams Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Live Now</h2>
          
          {/* Demo Live Stream */}
          <LiveStreamCard
            streamer={{
              name: 'Gaming Pro',
              username: 'gamingpro',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
              isVerified: true,
            }}
            title="Epic Gaming Session - Level 50 Boss Fight!"
            viewers={1243}
            thumbnail="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400"
            onWatch={() => handleWatchLive('gamingpro')}
          />

          <LiveStreamCard
            streamer={{
              name: 'Music Channel',
              username: 'musicchannel',
              avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100',
              isVerified: true,
            }}
            title="Live Acoustic Performance 🎸"
            viewers={856}
            thumbnail="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400"
            onWatch={() => handleWatchLive('musicchannel')}
          />

          <LiveStreamCard
            streamer={{
              name: 'Fitness Coach',
              username: 'fitnesscoach',
              avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100',
              isVerified: false,
            }}
            title="Morning Workout - Full Body Training"
            viewers={432}
            thumbnail="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400"
            onWatch={() => handleWatchLive('fitnesscoach')}
          />
        </div>
      </div>

      {/* Start Live Modal */}
      <AnimatePresence>
        {showStartOptions && (
          <StartLiveModal
            title={liveTitle}
            onTitleChange={setLiveTitle}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            onStart={handleStartLive}
            onClose={() => setShowStartOptions(false)}
          />
        )}
      </AnimatePresence>

      {/* Active Stream View */}
      <AnimatePresence>
        {isStreaming && (
          <StreamingView
            title={liveTitle}
            viewers={viewers}
            duration={duration}
            onEnd={handleStopLive}
          />
        )}
      </AnimatePresence>

      {/* Watch Stream View */}
      <AnimatePresence>
        {isWatching && (
          <WatchStreamView
            onClose={() => setIsWatching(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * LiveStreamCard - Preview card for a live stream
 */
const LiveStreamCard = memo(({ streamer, title, viewers, thumbnail, onWatch }) => {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onWatch}
      className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video"
    >
      <img
        src={thumbnail}
        alt={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      {/* Live Badge */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE
      </div>

      {/* Viewers */}
      <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 text-white text-xs flex items-center gap-1">
        <Eye className="w-3 h-3" />
        {formatViewCount(viewers)}
      </div>

      {/* Streamer Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-center gap-3">
          <img
            src={streamer.avatar}
            alt={streamer.name}
            className="w-10 h-10 rounded-full border-2 border-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              @{streamer.username}
            </p>
            <p className="text-white/80 text-xs truncate">{title}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/**
 * StartLiveModal - Modal for starting a live stream
 */
const StartLiveModal = ({ title, onTitleChange, visibility, onVisibilityChange, onStart, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING_ANIMATION.bottomSheet}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl backdrop-blur-2xl bg-gray-900/95 border-t border-white/10 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Go Live</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 block">Stream Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="What are you streaming about?"
            className="w-full bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            maxLength={100}
          />
        </div>

        {/* Visibility */}
        <div className="mb-6">
          <label className="text-white/60 text-sm mb-2 block">Who can watch</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'public', label: 'Public', desc: 'Anyone can watch' },
              { value: 'followers', label: 'Followers', desc: 'Only followers' },
            ].map((option) => (
              <motion.button
                key={option.value}
                whileTap={{ scale: 0.98 }}
                onClick={() => onVisibilityChange(option.value)}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  visibility === option.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <p className="text-white font-medium">{option.label}</p>
                <p className="text-white/50 text-xs">{option.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-2"
        >
          <Video className="w-5 h-5" />
          Start Live Stream
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

/**
 * StreamingView - Your active stream
 */
const StreamingView = ({ title, viewers, duration, onEnd }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Get camera stream
  useEffect(() => {
    const getStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Failed to get camera:', err);
      }
    };
    getStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
            <div className="px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {formatViewCount(viewers)}
            </div>
            <div className="px-3 py-1 rounded-full bg-black/50 text-white text-sm">
              {formatDuration(duration)}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="absolute top-16 left-4 right-4">
          <h1 className="text-white font-bold text-lg">{title}</h1>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-8 left-0 right-0 p-4">
          <div className="flex items-center justify-center gap-6">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center"
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleCamera}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center"
            >
              {isCameraOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onEnd}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * WatchStreamView - Watch a live stream
 */
const WatchStreamView = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, user: 'Sarah', text: 'This is amazing! 🔥', time: '2:30' },
    { id: 2, user: 'Alex', text: 'Love this stream!', time: '2:28' },
    { id: 3, user: 'Jordan', text: 'Can you do a tutorial?', time: '2:25' },
  ]);
  const [giftAnimation, setGiftAnimation] = useState(null);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages([...messages, {
      id: Date.now(),
      user: 'You',
      text: message,
      time: 'now',
    }]);
    setMessage('');
  };

  const sendGift = (gift) => {
    setGiftAnimation(gift);
    setTimeout(() => setGiftAnimation(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Video */}
      <div className="flex-1 relative">
        <img
          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800"
          alt="Live stream"
          className="w-full h-full object-cover"
        />

        {/* Live Badge */}
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer Count */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-1">
          <Eye className="w-4 h-4" />
          1.2K
        </div>

        {/* Streamer Info */}
        <div className="absolute bottom-20 left-4 right-20">
          <div className="flex items-center gap-3 p-3 rounded-2xl backdrop-blur-xl bg-black/40 border border-white/10">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
              alt="Streamer"
              className="w-10 h-10 rounded-full border-2 border-white"
            />
            <div>
              <p className="text-white font-semibold text-sm">@gamingpro</p>
              <p className="text-white/60 text-xs">Epic Gaming Session - Level 50 Boss Fight!</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="ml-auto px-4 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-semibold"
            >
              Follow
            </motion.button>
          </div>
        </div>

        {/* Gift Animation */}
        <AnimatePresence>
          {giftAnimation && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="text-6xl">{giftAnimation.icon}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat */}
      <div className="h-64 bg-gray-900 border-t border-white/10 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <span className="text-purple-400 font-semibold text-sm">{msg.user}:</span>
              <span className="text-white/80 text-sm">{msg.text}</span>
            </div>
          ))}
        </div>

        {/* Gift Buttons */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-white/10">
          {[
            { icon: '❤️', name: 'Heart', value: 1 },
            { icon: '🌹', name: 'Rose', value: 5 },
            { icon: '🎁', name: 'Gift', value: 10 },
            { icon: '🚀', name: 'Rocket', value: 50 },
          ].map((gift) => (
            <motion.button
              key={gift.name}
              whileTap={{ scale: 0.9 }}
              onClick={() => sendGift(gift)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-sm"
            >
              <span>{gift.icon}</span>
              <span className="text-white">{gift.value}</span>
            </motion.button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 p-4 border-t border-white/10">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something..."
            className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2 focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={sendMessage}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center"
          >
            <Send className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Close Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-4 left-1/2 -translate-x-1/2 p-3 rounded-full bg-black/50 backdrop-blur-md border border-white/20"
      >
        <X className="w-6 h-6 text-white" />
      </motion.button>
    </motion.div>
  );
};

export default LiveScreen;
