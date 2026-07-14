// src/hooks/useVideo.js - ARVDOUL VIDEO HOOK
// Custom hook for video playback, interactions, and state management

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVideoStore } from '../store/videoStore';
import videoService from '../services/videoService';
import { toast } from 'sonner';

/**
 * Custom hook for video interactions and playback
 * @param {string} videoId - Video document ID
 * @param {Object} [options] - Hook options
 * @param {boolean} [options.autoPlay=false] - Auto play video
 * @param {boolean} [options.muted=true] - Start muted
 * @param {Function} [options.onComplete] - Callback when video completes
 * @param {Function} [options.onProgress] - Callback with progress updates
 * @returns {Object} Video hook interface
 */
export const useVideo = (videoId, options = {}) => {
  const {
    autoPlay = false,
    muted = true,
    onComplete,
    onProgress,
  } = options;

  // Local state
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Video element ref
  const videoRef = useRef(null);

  // Store actions
  const {
    isPlaying,
    volume,
    speed,
    quality,
    isMuted,
    isFullscreen,
    isPip,
    isLooping,
    togglePlay,
    setVolume,
    setSpeed,
    setQuality,
    toggleMute,
    toggleFullscreen,
    togglePip,
    toggleLoop,
    addToWatchLater,
    removeFromWatchLater,
    addToHistory,
  } = useVideoStore();

  // Load video data
  useEffect(() => {
    if (!videoId) return;

    const loadVideo = async () => {
      setLoading(true);
      setError(null);

      try {
        const videoData = await videoService.getVideo(videoId);
        setVideo(videoData);
        setIsLiked(videoData?.isLiked || false);
        setIsSaved(videoData?.isSaved || false);
      } catch (err) {
        console.error('Failed to load video:', err);
        setError(err.message || 'Failed to load video');
        toast.error('Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  // Video playback controls
  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const seek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const seekRelative = useCallback((delta) => {
    if (videoRef.current) {
      videoRef.current.currentTime += delta;
    }
  }, []);

  // Playback settings
  const setPlaybackSpeed = useCallback((newSpeed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
    setSpeed(newSpeed);
  }, [setSpeed]);

  const setPlaybackVolume = useCallback((newVolume) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setVolume(newVolume);
  }, [setVolume]);

  // Like video
  const like = useCallback(async () => {
    if (!videoId) return;

    try {
      // Optimistic update
      setIsLiked((prev) => !prev);
      
      await videoService.likeVideo(videoId);
      toast.success(isLiked ? 'Removed like' : 'Liked!');
    } catch (err) {
      // Rollback on error
      setIsLiked((prev) => !prev);
      console.error('Failed to like video:', err);
      toast.error('Failed to update like');
    }
  }, [videoId, isLiked]);

  // Share video
  const share = useCallback(async () => {
    if (!video || !navigator.share) {
      // Fallback to clipboard
      const url = `${window.location.origin}/videos/${videoId}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
      return;
    }

    try {
      await navigator.share({
        title: video.title || 'Check out this video',
        text: video.description || '',
        url: `${window.location.origin}/videos/${videoId}`,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [video, videoId]);

  // Save video
  const toggleSave = useCallback(async () => {
    if (!videoId) return;

    try {
      setIsSaved((prev) => !prev);
      if (isSaved) {
        removeFromWatchLater(videoId);
        toast.success('Removed from watch later');
      } else {
        addToWatchLater(video);
        toast.success('Added to watch later');
      }
    } catch (err) {
      setIsSaved((prev) => !prev);
      console.error('Failed to save video:', err);
      toast.error('Failed to update saved status');
    }
  }, [videoId, video, isSaved, addToWatchLater, removeFromWatchLater]);

  // Report video
  const report = useCallback(async (reason) => {
    if (!videoId || !reason) return;

    try {
      await videoService.reportVideo(videoId, reason);
      toast.success('Video reported. Thank you for your feedback.');
    } catch (err) {
      console.error('Failed to report video:', err);
      toast.error('Failed to submit report');
    }
  }, [videoId]);

  // Download video
  const download = useCallback(async () => {
    if (!video) return;

    try {
      const downloadUrl = await videoService.getWatermarkedDownloadUrl(videoId);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${video.title || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started!');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download video');
    }
  }, [video, videoId]);

  // Watch later toggle
  const watchLaterToggle = useCallback(() => {
    toggleSave();
  }, [toggleSave]);

  // Fullscreen toggle
  const toggleFullscreenMode = useCallback(() => {
    if (!videoRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen?.();
    }
    toggleFullscreen();
  }, [toggleFullscreen]);

  // Picture-in-Picture toggle
  const togglePictureInPicture = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture?.();
      }
      togglePip();
    } catch (err) {
      console.error('PiP failed:', err);
    }
  }, [togglePip]);

  // Record view
  const recordView = useCallback(async (watchDuration = 0) => {
    if (!videoId) return;

    try {
      await videoService.recordVideoView(videoId, { watchDuration });
      addToHistory(videoId, watchDuration);
    } catch (err) {
      console.error('Failed to record view:', err);
    }
  }, [videoId, addToHistory]);

  // Progress tracking
  const handleProgress = useCallback((currentTime, duration) => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    onProgress?.({ currentTime, duration, progress });

    // Auto record view when 50% watched
    if (progress >= 50 && progress < 55) {
      recordView(currentTime);
    }
  }, [onProgress, recordView]);

  // Completion tracking
  const handleEnded = useCallback(() => {
    if (isLooping) {
      videoRef.current?.play();
    }
    onComplete?.();
    recordView(videoRef.current?.duration || 0);
  }, [isLooping, onComplete, recordView]);

  // Video ref setter
  const setVideoRef = useCallback((ref) => {
    videoRef.current = ref;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreenMode();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          like();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, seekRelative, toggleFullscreenMode, toggleMute, like]);

  // Return hook interface
  return useMemo(() => ({
    // Video data
    video,
    loading,
    error,
    isLiked,
    isSaved,

    // Playback state
    isPlaying,
    volume,
    speed,
    quality,
    isMuted,
    isFullscreen,
    isPip,
    isLooping,

    // Video element
    videoRef,
    setVideoRef,

    // Playback controls
    play,
    pause,
    seek,
    seekRelative,
    togglePlay,
    setPlaybackSpeed,
    setPlaybackVolume,
    setQuality,

    // Actions
    like,
    share,
    report,
    download,
    toggleSave,
    toggleFullscreen: toggleFullscreenMode,
    togglePictureInPicture,
    toggleLoop,
    toggleMute,
    watchLaterToggle,

    // Event handlers
    handleProgress,
    handleEnded,
    recordView,
  }), [
    video,
    loading,
    error,
    isLiked,
    isSaved,
    isPlaying,
    volume,
    speed,
    quality,
    isMuted,
    isFullscreen,
    isPip,
    isLooping,
    play,
    pause,
    seek,
    seekRelative,
    togglePlay,
    setPlaybackSpeed,
    setPlaybackVolume,
    setQuality,
    like,
    share,
    report,
    download,
    toggleSave,
    toggleFullscreenMode,
    togglePictureInPicture,
    toggleLoop,
    toggleMute,
    handleProgress,
    handleEnded,
    recordView,
  ]);
};

export default useVideo;
