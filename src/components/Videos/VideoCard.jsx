// src/components/Videos/VideoCard.jsx - ARVDOUL ULTIMATE VIDEO CARD
// Immersive full-screen vertical player with interactive action rail, creator overlay, and playback controls

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Settings,
  Download,
  Bookmark,
  Flag,
  Heart,
  MessageCircle,
  Share2,
  Repeat,
  Loader2,
  Music,
  BadgeCheck,
  Plus,
  Check,
  Coins,
  Sparkles,
  Users,
} from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useTheme } from '../../context/ThemeContext';
import { formatDuration, ARVDOUL_GRADIENT, SPRING_ANIMATION, formatViewCount } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoCard - Comprehensive vertical video player with ARVDOUL futuristic design
 */
const VideoCard = memo(({
  video,
  isActive = false,
  onLike,
  onComment,
  onShare,
  onSave,
  onGift,
  onReport,
  onFollow,
  autoPlay = false,
  showControls = true,
  className = '',
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCenterIcon, setShowCenterIcon] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [likeCoords, setLikeCoords] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFollowing, setIsFollowing] = useState(video?.creator?.isFollowing || false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { theme, isDark } = useTheme();
  const {
    volume,
    speed,
    quality,
    isMuted,
    isLooping,
    isFullscreen,
    setVolume,
    setSpeed,
    setQuality,
    toggleMute,
    toggleLoop,
    toggleFullscreen,
    addToHistory,
  } = useVideoStore();

  // Auto-play when active
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive && autoPlay) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay with sound may be blocked by browser policy; retry muted
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive, autoPlay]);

  // Apply volume, speed, and loop settings
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.playbackRate = speed;
      videoRef.current.loop = isLooping;
    }
  }, [volume, speed, isMuted, isLooping]);

  // Handle Play/Pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    setShowCenterIcon(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowCenterIcon(false);
    }, 700);
  }, []);

  // Time & buffer update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime: ct, duration: d } = videoRef.current;
    setCurrentTime(ct);
    setDuration(d || 0);
    if (d > 0) {
      setProgress((ct / d) * 100);
    }

    if (videoRef.current.buffered?.length > 0 && d > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered((bufferedEnd / d) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    if (!isLooping) {
      addToHistory(video?.id, duration);
      setIsPlaying(false);
    }
  }, [isLooping, addToHistory, video?.id, duration]);

  // Double tap to like with bursting heart animation
  const handleDoubleTap = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLikeCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 900);

    if (!video?.isLiked) {
      onLike?.();
    }
  }, [onLike, video?.isLiked]);

  // Timeline scrubber click/seek
  const handleProgressClick = useCallback((e) => {
    e.stopPropagation();
    if (!videoRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  }, [duration]);

  // Fullscreen & PiP
  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current.requestFullscreen?.();
    }
    toggleFullscreen();
  }, [toggleFullscreen]);

  const handlePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture?.();
      }
    } catch (err) {
      toast.error('Picture-in-Picture not supported on this browser');
    }
  }, []);

  const handleFollowClick = (e) => {
    e.stopPropagation();
    setIsFollowing((prev) => !prev);
    onFollow?.(video?.creator);
    toast.success(isFollowing ? `Unfollowed @${video?.creator?.username}` : `Following @${video?.creator?.username}! 🎉`);
  };

  const handleDownload = useCallback(() => {
    if (!video?.videoUrl) return;
    const link = document.createElement('a');
    link.href = video.videoUrl;
    link.download = `${video.title || 'arvdoul-video'}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Download started!');
  }, [video]);

  const videoSrc = video?.videoUrl || video?.url || '';
  const thumbnail = video?.thumbnailUrl || video?.thumbnail || '';

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
      onClick={togglePlayPause}
      onDoubleClick={handleDoubleTap}
    >
      {/* Video Stream Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={thumbnail}
        className="w-full h-full object-cover sm:object-contain"
        playsInline
        muted={isMuted}
        loop={isLooping}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => { setIsLoading(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={handleEnded}
      />

      {/* Subtle Top & Bottom Cinematic Vignette Gradients */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      {/* Loading Spinner */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20"
          >
            <div className="p-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <span className="text-white/70 text-xs font-semibold">Streaming HD...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Play/Pause Pulsing Icon */}
      <AnimatePresence>
        {showCenterIcon && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="p-6 rounded-full bg-black/50 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-purple-500/30">
              {isPlaying ? (
                <Play className="w-12 h-12 text-white fill-white translate-x-0.5" />
              ) : (
                <Pause className="w-12 h-12 text-white fill-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Heart Burst Animation */}
      <AnimatePresence>
        {showLikeAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -15 }}
            animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 0], rotate: [0, 12, -8] }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="absolute pointer-events-none z-30"
            style={{
              left: likeCoords.x > 0 ? likeCoords.x - 48 : 'calc(50% - 48px)',
              top: likeCoords.y > 0 ? likeCoords.y - 48 : 'calc(50% - 48px)',
            }}
          >
            <div className="relative">
              <Heart className="w-24 h-24 text-red-500 fill-red-500 filter drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]" />
              <Sparkles className="w-8 h-8 text-yellow-300 absolute -top-2 -right-2 animate-bounce" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Floating Action Rail */}
      <aside
        className="absolute right-3 sm:right-6 bottom-24 z-30 flex flex-col items-center gap-4.5 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Creator Avatar & Follow Button */}
        <div className="relative mb-2 flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Creator Profile: @${video?.creator?.username}`);
            }}
            className="w-13 h-13 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 shadow-xl shadow-purple-500/25 ring-2 ring-white/30"
          >
            <img
              src={video?.creator?.avatar || '/assets/default-profile.png'}
              alt={video?.creator?.name || 'Creator'}
              className="w-full h-full rounded-full object-cover"
            />
          </motion.button>

          {/* Follow '+' Badge */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleFollowClick}
            className={`absolute -bottom-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all ${
              isFollowing
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
            }`}
          >
            {isFollowing ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
          </motion.button>
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.75 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onLike?.();
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all shadow-lg ${
              video?.isLiked
                ? 'bg-red-500/25 border-red-500/50 shadow-red-500/40'
                : 'bg-white/10 border-white/15 hover:bg-white/20'
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                video?.isLiked
                  ? 'text-red-500 fill-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                  : 'text-white'
              }`}
            />
          </motion.button>
          <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
            {video?.likesFormatted || formatViewCount(video?.likes || 0)}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.75 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onComment?.();
            }}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg shadow-black/30"
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </motion.button>
          <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
            {formatViewCount(video?.commentsCount || 0)}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.75 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onShare?.();
            }}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg shadow-black/30"
          >
            <Share2 className="w-6 h-6 text-white" />
          </motion.button>
          <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
            {formatViewCount(video?.shares || 0)}
          </span>
        </div>

        {/* Save / Bookmark Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.75 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onSave?.();
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all shadow-lg ${
              video?.isSaved
                ? 'bg-amber-500/25 border-amber-500/50 shadow-amber-500/30'
                : 'bg-white/10 border-white/15 hover:bg-white/20'
            }`}
          >
            <Bookmark
              className={`w-6 h-6 transition-colors ${
                video?.isSaved ? 'text-amber-400 fill-amber-400' : 'text-white'
              }`}
            />
          </motion.button>
          <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
            {formatViewCount(video?.saves || 0)}
          </span>
        </div>

        {/* Virtual Coin Gift Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.75 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onGift?.();
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 border border-white/30 flex items-center justify-center text-white shadow-xl shadow-amber-500/40 animate-pulse"
            title="Send Gift"
          >
            <Coins className="w-6 h-6 text-yellow-100" />
          </motion.button>
          <span className="text-amber-300 text-xs font-bold mt-1 drop-shadow-md tracking-tight">
            Gift
          </span>
        </div>

        {/* Settings Menu Button */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings((prev) => !prev);
            }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all shadow-md"
          >
            <Settings className="w-5 h-5" />
          </motion.button>

          {/* Settings Popover */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className="absolute right-14 bottom-0 backdrop-blur-2xl bg-[#0b1020]/95 border border-white/15 rounded-3xl p-3 flex flex-col gap-1.5 min-w-[200px] shadow-2xl z-50 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Quality */}
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  <span className="text-white/80">Quality</span>
                  <span className="text-purple-400 font-bold uppercase text-xs">{quality}</span>
                </button>

                {/* Speed */}
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  <span className="text-white/80">Speed</span>
                  <span className="text-pink-400 font-bold text-xs">{speed}x</span>
                </button>

                {/* Loop */}
                <button
                  onClick={toggleLoop}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  <span className="text-white/80">Loop</span>
                  <Repeat className={`w-4 h-4 ${isLooping ? 'text-cyan-400' : 'text-white/40'}`} />
                </button>

                {/* PiP */}
                <button
                  onClick={handlePiP}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-white/80 transition-colors"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                  <span>Picture-in-Picture</span>
                </button>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-emerald-400 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download MP4</span>
                </button>

                {/* Report */}
                <button
                  onClick={() => {
                    setShowSettings(false);
                    onReport?.();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-red-400 transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  <span>Report</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quality Submenu */}
          <AnimatePresence>
            {showQualityMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className="absolute right-64 bottom-0 backdrop-blur-2xl bg-[#0b1020]/95 border border-white/15 rounded-2xl p-2 flex flex-col gap-1 min-w-[130px] shadow-2xl z-50 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                {['auto', '4K UHD', '1080p', '720p', '480p'].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuality(q);
                      setShowQualityMenu(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                      quality === q ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/70'
                    }`}
                  >
                    {q === 'auto' ? 'Auto (1080p)' : q}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Speed Submenu */}
          <AnimatePresence>
            {showSpeedMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className="absolute right-64 bottom-0 backdrop-blur-2xl bg-[#0b1020]/95 border border-white/15 rounded-2xl p-2 flex flex-col gap-1 min-w-[110px] shadow-2xl z-50 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                      speed === s ? 'bg-pink-600 text-white' : 'hover:bg-white/10 text-white/70'
                    }`}
                  >
                    {s}x Normal
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spinning Vinyl Music Disc with Floating Notes */}
        <div className="relative mt-2">
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ duration: 4, repeat: isPlaying ? Infinity : 0, ease: 'linear' }}
            className="w-11 h-11 rounded-full bg-gradient-to-tr from-gray-950 via-gray-800 to-gray-950 border-2 border-white/40 shadow-xl flex items-center justify-center p-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Audio: ${video?.audio?.title || 'ARVDOUL Beats'}`);
            }}
          >
            <img
              src={video?.audio?.coverUrl || video?.creator?.avatar || '/assets/default-profile.png'}
              alt="Track"
              className="w-5 h-5 rounded-full object-cover"
            />
          </motion.div>

          {/* Floating Music Notes Animation */}
          {isPlaying && (
            <motion.div
              animate={{
                y: [-5, -35, -55],
                x: [0, -12, 8],
                opacity: [0, 1, 0],
                rotate: [0, -20, 20],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              className="absolute -top-3 left-0 pointer-events-none text-cyan-300 font-bold text-xs"
            >
              ♪
            </motion.div>
          )}
        </div>
      </aside>

      {/* Bottom Creator Overlay & Metadata */}
      <div
        className="absolute bottom-4 left-4 right-20 z-20 pointer-events-auto flex flex-col gap-2 max-w-xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Creator Info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-black text-base tracking-tight drop-shadow-md">
            @{video?.creator?.username || 'abdulrahman'}
          </span>

          {video?.creator?.isVerified && (
            <BadgeCheck className="w-4.5 h-4.5 text-cyan-400 fill-cyan-400/20 drop-shadow-md" />
          )}

          {!isFollowing && (
            <button
              onClick={handleFollowClick}
              className="px-3 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white hover:text-black transition-all"
            >
              Follow
            </button>
          )}
        </div>

        {/* Video Title & Caption */}
        <div className="text-white/95 text-sm font-medium drop-shadow-md leading-relaxed">
          <span>{video?.title || ''} </span>
          <span className="text-white/80">
            {isCaptionExpanded
              ? video?.description
              : video?.description?.slice(0, 80) + (video?.description?.length > 80 ? '...' : '')}
          </span>
          {video?.description?.length > 80 && (
            <button
              onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
              className="text-white font-bold ml-1 text-xs hover:underline"
            >
              {isCaptionExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>

        {/* Interactive Hashtags */}
        {video?.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 my-0.5">
            {video.hashtags.map((tag) => (
              <span
                key={tag}
                onClick={() => toast.info(`Viewing ${tag} videos`)}
                className="text-cyan-300 font-bold text-xs hover:text-cyan-200 cursor-pointer drop-shadow-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Mutual Friends Watching Pill */}
        {video?.mutualFriendsCount > 0 && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 w-fit shadow-md">
            <div className="flex -space-x-1.5 overflow-hidden">
              {video?.mutualFriends?.slice(0, 3).map((mf) => (
                <img
                  key={mf.id}
                  src={mf.avatar}
                  alt={mf.name}
                  className="w-4 h-4 rounded-full ring-1 ring-black object-cover"
                />
              ))}
            </div>
            <span className="text-white/90 text-[11px] font-semibold">
              {video.mutualFriendsCount} mutual friends watching
            </span>
          </div>
        )}

        {/* Soundtrack Info Pill with Audio Wave Visualizer */}
        <div
          onClick={() => toast.info(`Original Audio: ${video?.audio?.title || 'ARVDOUL Beats'}`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 w-fit hover:bg-black/60 transition-all cursor-pointer shadow-md"
        >
          <Music className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white/90 text-xs font-semibold truncate max-w-[220px]">
            {video?.audio?.title || 'Original Audio - ARVDOUL Beats'}
          </span>
          {/* Animated Audio Equalizer Bars */}
          <div className="flex items-end gap-0.5 h-3">
            <motion.div
              animate={{ height: isPlaying ? ['30%', '100%', '40%'] : '30%' }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
              className="w-0.5 bg-cyan-400 rounded-full"
            />
            <motion.div
              animate={{ height: isPlaying ? ['80%', '20%', '90%'] : '50%' }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
              className="w-0.5 bg-pink-400 rounded-full"
            />
            <motion.div
              animate={{ height: isPlaying ? ['40%', '90%', '20%'] : '20%' }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              className="w-0.5 bg-purple-400 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Interactive Bottom Timeline / Scrubber */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-1 pt-3 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative h-1.5 hover:h-3 transition-all bg-white/20 rounded-full cursor-pointer overflow-hidden group"
          onClick={handleProgressClick}
        >
          {/* Buffered track */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/35 rounded-full transition-all"
            style={{ width: `${buffered}%` }}
          />
          {/* Active progress */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #06b6d4 100%)',
            }}
          />
        </div>

        {/* Hover / Active Controls Bar */}
        <div className={`flex items-center justify-between mt-1 px-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0 sm:opacity-75'}`}>
          <span className="text-white/70 text-[10px] font-mono">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>

          <div className="flex items-center gap-3">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={handleFullscreen}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoCard.displayName = 'VideoCard';

VideoCard.propTypes = {
  video: PropTypes.object.isRequired,
  isActive: PropTypes.bool,
  onLike: PropTypes.func,
  onComment: PropTypes.func,
  onShare: PropTypes.func,
  onSave: PropTypes.func,
  onGift: PropTypes.func,
  onReport: PropTypes.func,
  onFollow: PropTypes.func,
  autoPlay: PropTypes.bool,
  showControls: PropTypes.bool,
  className: PropTypes.string,
};

export default VideoCard;
