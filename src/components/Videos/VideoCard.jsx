// src/components/Videos/VideoCard.jsx
//
// Immersive full-screen vertical Spark player with Mux HLS adaptive playback,
// interactive action rail, creator overlay, chapters, and Liquid-Glass controls

import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Volume2, VolumeX, PictureInPicture2, Download, Bookmark,
  Flag, Heart, MessageCircle, Share2, Repeat, Maximize, Music, BadgeCheck,
  Plus, Check, Clock, Sparkles, MoreHorizontal, ChevronRight, Gift, ExternalLink,
} from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { useAuth } from '../../context/AuthContext';
import { formatDuration, formatViewCount } from '../../utils/videoUtils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import useDoubleTap from '../../hooks/useDoubleTap.js';
import useHlsVideo from '../../hooks/useHlsVideo.js';
import VideoQualitySelector from './VideoQualitySelector';
import VideoSpeedSelector from './VideoSpeedSelector';
import { toast } from 'sonner';
import PropTypes from 'prop-types';
import { LazyImage } from '../../components/Shared/LazyImage';

/**
 * VideoCard - Comprehensive vertical Spark player with ARVDOUL Liquid-Glass design
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
  followedByViewer,
  requestPending = false,
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
  const [duration, setDuration] = useState(Number(video?.duration) || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFollowing, setIsFollowing] = useState(Boolean(followedByViewer));
  const [isRequested, setIsRequested] = useState(Boolean(requestPending));
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  useEffect(() => {
    setIsFollowing(Boolean(followedByViewer));
    setIsRequested(Boolean(requestPending));
  }, [followedByViewer, requestPending]);

  const {
    volume,
    speed,
    quality,
    isMuted,
    isLooping,
    isFullscreen,
    setSpeed,
    setQuality,
    toggleMute,
    toggleLoop,
    toggleFullscreen,
    addToHistory,
  } = useVideoStore();

  const { user } = useAuth();
  const navigate = useNavigate();
  const [followBusy, setFollowBusy] = useState(false);

  const canonicalId = video?.canonicalPostId || video?.id;
  const ownerId = video?.userId || video?.authorId || video?.creator?.id || null;
  const isOwner = Boolean(user?.uid && ownerId && user.uid === ownerId);

  const hls = useHlsVideo({
    videoRef,
    video,
    signedUrlCacheKey: canonicalId,
    quality,
    enabled: Boolean(video && (isActive || !video?.muxPlaybackId)),
  });

  // Auto-play when active
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive && autoPlay && hls.src) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    } else if (!isActive) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive, autoPlay, hls.src]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.playbackRate = speed;
      videoRef.current.loop = isLooping;
    }
  }, [volume, speed, isMuted, isLooping]);

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

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime: ct, duration: d } = videoRef.current;
    setCurrentTime(ct);
    setDuration(d || Number(video?.duration) || 0);
    if (d > 0) {
      setProgress((ct / d) * 100);
    }

    if (videoRef.current.buffered?.length > 0 && d > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered((bufferedEnd / d) * 100);
    }
  }, [video?.duration]);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || Number(video?.duration) || 0);
    setIsLoading(false);
  }, [video?.duration]);

  const handleEnded = useCallback(() => {
    if (!isLooping) {
      addToHistory(video?.id, duration);
      setIsPlaying(false);
    }
  }, [isLooping, addToHistory, video?.id, duration]);

  const handleDoubleTap = useCallback((e) => {
    const rect = e.currentTarget?.getBoundingClientRect?.() || { left: 0, top: 0 };
    setLikeCoords({
      x: (e.clientX || 0) - rect.left,
      y: (e.clientY || 0) - rect.top,
    });

    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 900);

    if (!video?.isLiked) {
      onLike?.();
    }
  }, [onLike, video?.isLiked]);

  const { onClick: detectDoubleTap } = useDoubleTap(handleDoubleTap);

  const handleContainerClick = useCallback((e) => {
    if (detectDoubleTap(e)) return;
    togglePlayPause();
  }, [detectDoubleTap, togglePlayPause]);

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

  const handleChapterJump = useCallback((timeSec, e) => {
    e.stopPropagation();
    if (!videoRef.current || !Number.isFinite(Number(timeSec))) return;
    const nextTime = Math.max(0, Number(timeSec));
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (duration > 0) setProgress((nextTime / duration) * 100);
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [duration]);

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
    } catch {
      toast.error('Picture-in-Picture not supported on this browser');
    }
  }, []);

  const handleFollowClick = async (e) => {
    e.stopPropagation();
    if (!user?.uid) {
      toast.error('Sign in to follow creators');
      return;
    }
    const targetId = ownerId;
    if (!targetId) {
      toast.error('Cannot follow: creator unknown');
      return;
    }
    if (targetId === user.uid) return;
    if (followBusy) return;

    const prev = isFollowing;
    const prevRequested = isRequested;
    setFollowBusy(true);
    setIsFollowing(!prev && !prevRequested);
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      const handle = video?.creator?.username ? `@${video.creator.username}` : 'this creator';
      if (prev || prevRequested) {
        if (prevRequested) await svc.cancelFollowRequest(user.uid, targetId);
        else await svc.unfollowUser(user.uid, targetId);
        setIsRequested(false);
        toast.success(prevRequested ? 'Request withdrawn' : `Unfollowed ${handle}`);
        onFollow?.(video?.creator, { isFollowing: false, requestStatus: null });
      } else {
        const res = await svc.followUser(user.uid, targetId);
        if (res?.requested || res?.requestStatus === 'pending') {
          setIsFollowing(false);
          setIsRequested(true);
          toast.success('Follow request sent');
          onFollow?.(video?.creator, { isFollowing: false, requestStatus: 'pending' });
        } else {
          toast.success(`Following ${handle}`);
          onFollow?.(video?.creator, { isFollowing: true, requestStatus: null });
        }
      }
    } catch (err) {
      setIsFollowing(prev);
      setIsRequested(prevRequested);
      toast.error(err?.message || 'Could not update follow status');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!video?.id) return;
    if (video?.allowDownload === false && !isOwner) {
      toast.error('Creator disabled downloads for this Spark');
      return;
    }
    try {
      const { getVideoService } = await import('../../services/videoService.js');
      const res = await getVideoService().getWatermarkedDownloadUrl(video.id);
      const downloadHref = res?.url || hls.src || video?.videoUrl;
      if (!downloadHref) throw new Error('Download unavailable');
      const link = document.createElement('a');
      link.href = downloadHref;
      link.download = `${(video.title || 'arvdoul-spark').replace(/[^\w-]+/g, '_')}.mp4`;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started!');
    } catch (err) {
      toast.error(err?.message || 'Download unavailable for this Spark');
    }
  }, [video, isOwner, hls.src]);

  const thumbnail = hls.thumbnailUrl || video?.thumbnailUrl || video?.thumbnail || '';
  const chapters = Array.isArray(video?.chapters) ? video.chapters : [];

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#03071B] overflow-hidden select-none flex items-center justify-center lg:pt-16 lg:pb-4 lg:px-4 ${className}`}
      onClick={handleContainerClick}
    >
      <div className="relative w-full h-full lg:max-w-[440px] lg:aspect-[9/16] lg:max-h-full lg:rounded-3xl lg:border lg:border-white/15 lg:shadow-2xl overflow-hidden bg-black flex items-center justify-center">
        {/* Video Stream Element (bound by useHlsVideo) */}
        <video
          ref={videoRef}
          poster={thumbnail}
          preload={isActive ? 'auto' : 'metadata'}
          className="w-full h-full object-cover"
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

        {/* Owner-only Processing Status Badge */}
        {isOwner && video?.processingState && video.processingState !== 'PUBLISHED' && (
          <div className="absolute top-16 left-4 z-20 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Status: {video.processingState.replace(/_/g, ' ')}</span>
          </div>
        )}

        {/* Stream Error Retry Pill */}
        {hls.error && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              hls.refreshPlaybackUrl();
            }}
            className="absolute top-1/2 -translate-y-1/2 z-30 px-4 py-2.5 rounded-full bg-black/75 backdrop-blur-xl border border-red-400/40 text-white text-xs font-semibold cursor-pointer shadow-xl"
          >
            Stream interrupted — Tap to retry
          </div>
        )}

        {/* Ambient Buffer Indicator */}
        <AnimatePresence>
          {(isLoading || hls.isBuffering) && !hls.error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <div className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
                <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
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
              <div className="p-6 rounded-full bg-black/50 backdrop-blur-2xl border border-white/20 shadow-2xl">
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
                <Sparkles className="w-8 h-8 text-amber-300 absolute -top-2 -right-2 animate-bounce" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showControls && (
          <>
            {/* Floating Mutual Friends Chip */}
            {video?.mutualFriendsCount > 0 && Array.isArray(video?.mutualFriends) && video.mutualFriends.length > 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (ownerId) navigate(`/profile/${ownerId}/friends`);
                }}
                className="absolute top-16 sm:top-18 lg:top-4 left-3 sm:left-5 z-20 pointer-events-auto cursor-pointer flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-full bg-black/45 backdrop-blur-xl border border-white/20 shadow-lg hover:bg-black/60 transition-all group"
              >
                <div className="flex -space-x-1.5 overflow-hidden">
                  {video.mutualFriends.slice(0, 3).map((friend, i) => (
                    <LazyImage
                      key={friend?.id || friend?.uid || i}
                      src={friend?.avatar || friend?.photoURL || '/assets/default-profile.png'}
                      alt={friend?.name || friend?.displayName || 'Mutual friend'}
                      className="w-5 h-5 rounded-full ring-1.5 ring-purple-500 object-cover"
                    />
                  ))}
                </div>
                <span className="text-white text-xs font-bold tracking-tight">
                  {video.mutualFriendsCount} mutual friends
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-white/70 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {/* Right Floating Action Rail */}
            <aside
              className="absolute right-3 sm:right-4 bottom-20 z-30 flex flex-col items-center gap-3.5 sm:gap-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Creator Avatar & Follow Button */}
              <div className="relative mb-1 flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ownerId) navigate(`/profile/${ownerId}`);
                  }}
                  className="w-13 h-13 rounded-full p-0.5 shadow-xl ring-2 ring-purple-400/80"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <LazyImage
                    src={video?.creator?.avatar || video?.creator?.photoURL || '/assets/default-profile.png'}
                    alt={video?.creator?.name || video?.creator?.displayName || 'Video creator'}
                    className="w-full h-full rounded-full object-cover"
                  />
                </motion.button>

                {!isOwner && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    onClick={handleFollowClick}
                    className={`absolute -bottom-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      isFollowing
                        ? 'bg-emerald-500 text-white ring-2 ring-black'
                        : 'text-white ring-2 ring-black'
                    }`}
                    style={isFollowing ? undefined : { background: BRAND_GRADIENT }}
                    title={isFollowing ? 'Following' : (isRequested ? 'Requested' : 'Follow')}
                  >
                    {isFollowing
                      ? <Check className="w-3.5 h-3.5 stroke-[3]" />
                      : (isRequested ? <Clock className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />)}
                  </motion.button>
                )}
              </div>

              {/* Like Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike?.();
                  }}
                  aria-label="Like Spark"
                  className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all shadow-lg ${
                    video?.isLiked
                      ? 'bg-red-500/30 border-red-500/60 shadow-red-500/40'
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
                  {formatViewCount(video?.likes)}
                </span>
              </div>

              {/* Comment Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment?.();
                  }}
                  aria-label="Comments"
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg shadow-black/30"
                >
                  <MessageCircle className="w-6 h-6 text-white" />
                </motion.button>
                <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
                  {formatViewCount(video?.comments ?? video?.commentsCount)}
                </span>
              </div>

              {/* Share Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare?.();
                  }}
                  aria-label="Share Spark"
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg shadow-black/30"
                >
                  <Share2 className="w-6 h-6 text-white" />
                </motion.button>
                <span className="text-white text-xs font-bold mt-1 drop-shadow-md tracking-tight">
                  {formatViewCount(video?.shares)}
                </span>
              </div>

              {/* Save / Bookmark Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave?.();
                  }}
                  aria-label="Save Spark"
                  className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all shadow-lg ${
                    video?.isSaved
                      ? 'bg-amber-500/30 border-amber-500/60 shadow-amber-500/40'
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
                  {formatViewCount(video?.saves)}
                </span>
              </div>

              {/* Virtual Coin Gift Button */}
              <div className="flex flex-col items-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.75 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGift?.();
                  }}
                  className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center text-white shadow-xl"
                  style={{ background: BRAND_GRADIENT }}
                  title="Send Gift"
                  aria-label="Send Gift"
                >
                  <Gift className="w-6 h-6 text-white" />
                </motion.button>
                <span className="text-purple-300 text-xs font-bold mt-1 drop-shadow-md tracking-tight">
                  {formatViewCount(video?.gifts)}
                </span>
              </div>

              {/* More Options Button */}
              <div className="relative">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings((prev) => !prev);
                    setShowQualityMenu(false);
                    setShowSpeedMenu(false);
                  }}
                  className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all shadow-md"
                  title="More Options"
                  aria-label="More Options"
                >
                  <MoreHorizontal className="w-6 h-6 text-white" />
                </motion.button>

                {/* Settings Popover */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: 20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 20 }}
                      className="absolute right-14 bottom-0 backdrop-blur-2xl bg-[#080F2E]/95 border border-white/15 rounded-3xl p-3 flex flex-col gap-1.5 min-w-[210px] shadow-2xl z-50 text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowQualityMenu(!showQualityMenu);
                          setShowSpeedMenu(false);
                        }}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                      >
                        <span className="text-white/80">Quality</span>
                        <span className="text-purple-400 font-bold uppercase text-xs">{quality}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSpeedMenu(!showSpeedMenu);
                          setShowQualityMenu(false);
                        }}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                      >
                        <span className="text-white/80">Speed</span>
                        <span className="text-blue-400 font-bold text-xs">{speed}x</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleLoop}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                      >
                        <span className="text-white/80">Loop</span>
                        <Repeat className={`w-4 h-4 ${isLooping ? 'text-cyan-400' : 'text-white/40'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={handleFullscreen}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium transition-colors"
                      >
                        <span className="text-white/80">Fullscreen</span>
                        <Maximize className={`w-4 h-4 ${isFullscreen ? 'text-cyan-400' : 'text-white/40'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={handlePiP}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-white/80 transition-colors"
                      >
                        <PictureInPicture2 className="w-4 h-4" />
                        <span>Picture-in-Picture</span>
                      </button>

                      {canonicalId && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettings(false);
                            navigate(`/sparks/${canonicalId}`);
                          }}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Spark Details</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/10 text-sm font-medium text-emerald-400 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download MP4</span>
                      </button>

                      <button
                        type="button"
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

                <VideoQualitySelector
                  isOpen={showQualityMenu}
                  currentQuality={quality}
                  levels={hls.qualityLevels}
                  onSelect={(nextQ, levelIndex) => {
                    setQuality(nextQ);
                    if (typeof levelIndex === 'number') {
                      hls.setQualityLevel(levelIndex);
                    }
                  }}
                  onClose={() => setShowQualityMenu(false)}
                />

                <VideoSpeedSelector
                  isOpen={showSpeedMenu}
                  currentSpeed={speed}
                  onSelect={(s) => setSpeed(s)}
                  onClose={() => setShowSpeedMenu(false)}
                />
              </div>
            </aside>

            {/* Floating Left Creator Card */}
            <div
              className="absolute bottom-16 left-3 sm:left-4 right-20 max-w-[330px] z-20 pointer-events-auto bg-black/50 backdrop-blur-2xl border border-white/15 rounded-3xl p-3.5 shadow-2xl flex flex-col gap-2 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <LazyImage
                      src={video?.creator?.avatar || video?.creator?.photoURL || '/assets/default-profile.png'}
                      alt={video?.creator?.name || video?.creator?.displayName || 'Video creator'}
                      className="w-10 h-10 rounded-full ring-2 ring-purple-500/80 object-cover"
                    />
                    {video?.creator?.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-white font-extrabold text-sm sm:text-base tracking-tight truncate">
                        {video?.creator?.name || video?.creator?.displayName || 'Video creator'}
                      </span>
                      {video?.creator?.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-cyan-400 fill-cyan-400/20 shrink-0" />
                      )}
                    </div>
                    <span className="text-purple-300/85 text-xs font-semibold tracking-tight truncate">
                      {video?.creator?.username ? `@${video.creator.username}` : ''}
                    </span>
                  </div>
                </div>

                {!isOwner && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={handleFollowClick}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-md transition-all shrink-0 ${
                      isFollowing ? 'bg-white/20 hover:bg-white/30 text-white' : 'hover:opacity-90'
                    }`}
                    style={isFollowing ? undefined : { background: BRAND_GRADIENT }}
                  >
                    {isFollowing ? 'Following' : (isRequested ? 'Requested' : 'Follow')}
                  </motion.button>
                )}
              </div>

              {/* Spark Caption & Hashtags */}
              <div className="text-white/95 text-xs sm:text-sm font-medium leading-relaxed">
                {video?.description ? (
                  <p>
                    {isCaptionExpanded
                      ? video.description
                      : (video.description.slice(0, 75) + (video.description.length > 75 ? '...' : ''))}
                    {video.description.length > 75 && (
                      <button
                        type="button"
                        onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                        className="text-purple-300 font-bold ml-1 text-xs hover:underline"
                      >
                        {isCaptionExpanded ? 'less' : 'more'}
                      </button>
                    )}
                  </p>
                ) : null}

                {video?.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {video.hashtags.map((tag) => {
                      const clean = String(tag).startsWith('#') ? String(tag) : `#${tag}`;
                      return (
                        <span
                          key={clean}
                          onClick={() => navigate(`/search?q=${encodeURIComponent(clean.replace(/^#/, ''))}`)}
                          className="text-purple-300 hover:text-purple-200 font-bold text-xs cursor-pointer transition-colors"
                        >
                          {clean}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chapter Quick Jump Chips */}
              {chapters.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {chapters.slice(0, 5).map((ch, idx) => {
                    const sec = Number(ch?.time ?? ch?.startTime ?? 0);
                    return (
                      <button
                        key={`${sec}-${idx}`}
                        type="button"
                        onClick={(e) => handleChapterJump(sec, e)}
                        className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] text-white/90 font-medium whitespace-nowrap shrink-0"
                      >
                        {formatDuration(sec)} {ch?.title || `Ch ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Audio Track with Equalizer */}
              {video?.audio?.title ? (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                  <div
                    onClick={() => navigate(`/search?q=${encodeURIComponent(video.audio.title)}`)}
                    className="flex items-center gap-2 cursor-pointer group min-w-0"
                  >
                    <Music className="w-3.5 h-3.5 text-purple-400 group-hover:rotate-12 transition-transform" />
                    <span className="text-white/90 text-xs font-semibold truncate max-w-[200px] sm:max-w-[240px]">
                      {video.audio.title}
                    </span>
                  </div>

                  <div className="flex items-end gap-0.5 px-2 py-1 rounded-lg bg-purple-950/50 border border-purple-500/30 h-5 shrink-0">
                    <motion.div
                      animate={{ height: isPlaying ? ['25%', '100%', '40%'] : '30%' }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-1 bg-cyan-400 rounded-full"
                    />
                    <motion.div
                      animate={{ height: isPlaying ? ['85%', '20%', '95%'] : '50%' }}
                      transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                      className="w-1 bg-purple-300 rounded-full"
                    />
                    <motion.div
                      animate={{ height: isPlaying ? ['40%', '90%', '30%'] : '25%' }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                      className="w-1 bg-purple-400 rounded-full"
                    />
                    <motion.div
                      animate={{ height: isPlaying ? ['70%', '30%', '80%'] : '45%' }}
                      transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                      className="w-1 bg-indigo-400 rounded-full"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Scrubber / Timeline Bar */}
            <div
              className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-20 pointer-events-auto flex items-center gap-3 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-white/90 text-xs font-mono font-bold tabular-nums shrink-0">
                {formatDuration(currentTime)}
              </span>

              <div
                role="slider"
                aria-label="Seek video"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration) || 0}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
                className="relative flex-1 h-1.5 hover:h-2.5 transition-all bg-white/20 rounded-full cursor-pointer overflow-visible group"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full transition-all"
                  style={{ width: `${buffered}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: BRAND_GRADIENT,
                  }}
                />
                {duration > 0 && chapters.map((ch, idx) => {
                  const t = Number(ch?.time ?? ch?.startTime ?? 0);
                  if (!Number.isFinite(t) || t <= 0 || t >= duration) return null;
                  return (
                    <div
                      key={`${t}-${idx}`}
                      title={ch?.title || `Chapter ${idx + 1}`}
                      className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10 pointer-events-none"
                      style={{ left: `${(t / duration) * 100}%` }}
                    />
                  );
                })}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(168,85,247,0.9)] ring-2 ring-purple-500 transition-transform group-hover:scale-125"
                  style={{ left: `${progress}%` }}
                />
              </div>

              <span className="text-white/90 text-xs font-mono font-bold tabular-nums shrink-0">
                {formatDuration(duration)}
              </span>

              <button
                type="button"
                onClick={toggleMute}
                className="min-w-[40px] min-h-[40px] rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-all shrink-0"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
            </div>
          </>
        )}
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
  followedByViewer: PropTypes.bool,
  requestPending: PropTypes.bool,
  autoPlay: PropTypes.bool,
  showControls: PropTypes.bool,
  className: PropTypes.string,
};

export default VideoCard;
