// src/components/Videos/VideoCard.jsx - ARVDOUL VIDEO CARD
// Full video player component with all playback controls

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
} from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useTheme } from '../../context/ThemeContext';
import { formatDuration, ARVDOUL_GRADIENT, SPRING_ANIMATION } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoCard - Full video player with all controls
 * Supports HLS streaming, quality selection, playback speed, PiP, and fullscreen
 */
const VideoCard = memo(({
  video,
  isActive = false,
  onLike,
  onComment,
  onShare,
  onSave,
  onReport,
  autoPlay = false,
  showControls = true,
  className = '',
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const [showControlsOverlay, setShowControlsOverlay] = useState(true);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const { theme } = useTheme();
  const {
    volume,
    speed,
    quality,
    isMuted,
    isLooping,
    isFullscreen,
    isPip,
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
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive, autoPlay]);

  // Apply volume and speed settings
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.playbackRate = speed;
      videoRef.current.loop = isLooping;
    }
  }, [volume, speed, isMuted, isLooping]);

  // Hide controls after inactivity
  useEffect(() => {
    if (!showControls) return;

    const hideControls = () => {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControlsOverlay(false);
      }, 3000);
    };

    hideControls();

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, showControlsOverlay]);

  // Event handlers
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime: ct, duration: d } = videoRef.current;
    setCurrentTime(ct);
    setDuration(d);
    setProgress((ct / d) * 100);

    // Update buffered
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered((bufferedEnd / d) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsLoading(false);
  }, []);

  const handlePlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleWaiting = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    if (!isLooping) {
      addToHistory(video?.id, duration);
    }
  }, [isLooping, addToHistory, video?.id, duration]);

  const handleDoubleTap = useCallback((e) => {
    if (!onLike) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 800);
    
    onLike();
  }, [onLike]);

  const handleVideoClick = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControlsOverlay(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControlsOverlay(false);
    }, 3000);
  }, []);

  const handleProgressClick = useCallback((e) => {
    if (!videoRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  }, [duration]);

  const handleVolumeChange = useCallback((e) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, [setVolume]);

  // Playback controls
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
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
      toast.error('Picture-in-Picture not supported');
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!video?.videoUrl) return;
    
    const link = document.createElement('a');
    link.href = video.videoUrl;
    link.download = `${video.title || 'video'}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Download started!');
  }, [video]);

  // Video source
  const videoSrc = video?.videoUrl || video?.url || '';
  const thumbnail = video?.thumbnailUrl || '';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black ${className}`}
      onClick={handleVideoClick}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={thumbnail}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        loop={isLooping}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onDoubleClick={handleDoubleTap}
      />

      {/* Loading Spinner */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Like Animation */}
      <AnimatePresence>
        {showLikeAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING_ANIMATION.like}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="w-32 h-32 text-red-500 fill-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControlsOverlay && showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"
          >
            {/* Top Gradient */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
            
            {/* Bottom Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />

            {/* Play/Pause Center Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"
            >
              <div className="p-6 rounded-full bg-white/20 backdrop-blur-md">
                {videoRef.current?.paused ? (
                  <Play className="w-16 h-16 text-white fill-white" />
                ) : (
                  <Pause className="w-16 h-16 text-white fill-white" />
                )}
              </div>
            </motion.button>

            {/* Right Action Rail */}
            <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4">
              {/* Like */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onLike?.();
                }}
                className="flex flex-col items-center gap-1 p-2"
              >
                <Heart
                  className={`w-8 h-8 transition-colors ${
                    video?.isLiked ? 'text-red-500 fill-red-500' : 'text-white'
                  }`}
                />
                <span className="text-white text-xs font-medium">
                  {video?.likes || 0}
                </span>
              </motion.button>

              {/* Comment */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onComment?.();
                }}
                className="flex flex-col items-center gap-1 p-2"
              >
                <MessageCircle className="w-8 h-8 text-white" />
                <span className="text-white text-xs font-medium">
                  {video?.commentsCount || 0}
                </span>
              </motion.button>

              {/* Share */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.();
                }}
                className="flex flex-col items-center gap-1 p-2"
              >
                <Share2 className="w-8 h-8 text-white" />
                <span className="text-white text-xs font-medium">
                  {video?.shares || 0}
                </span>
              </motion.button>

              {/* Save */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSave?.();
                }}
                className="flex flex-col items-center gap-1 p-2"
              >
                <Bookmark
                  className={`w-8 h-8 ${
                    video?.isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-white'
                  }`}
                />
              </motion.button>

              {/* More Options */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                }}
                className="p-2"
              >
                <Settings className="w-8 h-8 text-white" />
              </motion.button>
            </div>

            {/* Settings Menu */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={SPRING_ANIMATION.button}
                  className="absolute right-20 bottom-48 backdrop-blur-2xl bg-black/60 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 min-w-[180px]"
                >
                  {/* Quality */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQualityMenu(!showQualityMenu);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-white text-sm"
                  >
                    <span>Quality</span>
                    <span className="text-white/60">{quality}</span>
                  </button>

                  {/* Speed */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeedMenu(!showSpeedMenu);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-white text-sm"
                  >
                    <span>Speed</span>
                    <span className="text-white/60">{speed}x</span>
                  </button>

                  {/* Loop */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLoop();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-sm ${
                      isLooping ? 'text-purple-400' : 'text-white'
                    }`}
                  >
                    <span>Loop</span>
                    <Repeat className={`w-4 h-4 ${isLooping ? 'opacity-100' : 'opacity-50'}`} />
                  </button>

                  {/* Download */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-white text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>

                  {/* PiP */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePiP();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-white text-sm"
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                    <span>Picture in Picture</span>
                  </button>

                  {/* Report */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReport?.();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-red-400 text-sm"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quality Menu */}
            <AnimatePresence>
              {showQualityMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-20 bottom-72 backdrop-blur-2xl bg-black/60 border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[120px]"
                >
                  {['auto', '1080p', '720p', '480p', '360p', '144p'].map((q) => (
                    <button
                      key={q}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuality(q);
                        setShowQualityMenu(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-sm ${
                        quality === q
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {q === 'auto' ? 'Auto' : q}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Speed Menu */}
            <AnimatePresence>
              {showSpeedMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-20 bottom-72 backdrop-blur-2xl bg-black/60 border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[100px]"
                >
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpeed(s);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-sm ${
                        speed === s
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Creator Info */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={video?.creator?.avatar || '/assets/default-profile.png'}
                  alt={video?.creator?.name || 'Creator'}
                  className="w-10 h-10 rounded-full border-2 border-white"
                />
                <div>
                  <p className="text-white font-semibold text-sm">
                    @{video?.creator?.username || 'user'}
                  </p>
                  <p className="text-white/80 text-xs">{video?.title || ''}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-1 bg-white/30 rounded-full cursor-pointer" onClick={handleProgressClick}>
                {/* Buffered */}
                <div
                  className="absolute h-full bg-white/50 rounded-full"
                  style={{ width: `${buffered}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: ARVDOUL_GRADIENT,
                  }}
                />
                {/* Thumb */}
                <div
                  className="absolute h-3 w-3 bg-white rounded-full shadow-lg -top-1"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>

              {/* Time and Volume */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/80 text-xs">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>

                <div className="flex items-center gap-4">
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="p-1"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 accent-purple-500"
                    />
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFullscreen();
                    }}
                    className="p-1"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5 text-white" />
                    ) : (
                      <Maximize className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  onReport: PropTypes.func,
  autoPlay: PropTypes.bool,
  showControls: PropTypes.bool,
  className: PropTypes.string,
};

export default VideoCard;
