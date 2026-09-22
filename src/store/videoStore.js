// src/store/videoStore.js - ARVDOUL VIDEO STATE MANAGEMENT
// Zustand store for video feed, playback, and user preferences
// Optimized for TikTok-style vertical scrolling

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Video store state interface
 * @typedef {Object} VideoState
 * @property {Array} videos - List of videos in feed
 * @property {number} currentIndex - Current video index in feed
 * @property {boolean} loading - Loading state
 * @property {boolean} loadingMore - Loading more videos
 * @property {boolean} hasMore - Has more videos to load
 * @property {string|null} nextCursor - Pagination cursor
 * @property {string} feedType - Feed type: 'for_you' | 'following' | 'trending'
 * @property {boolean} isPlaying - Is video playing
 * @property {number} volume - Volume level (0-1)
 * @property {number} speed - Playback speed
 * @property {string} quality - Video quality: 'auto' | '1080p' | '720p' | '480p' | '360p' | '144p'
 * @property {boolean} isMuted - Is muted
 * @property {boolean} isFullscreen - Is fullscreen
 * @property {boolean} isPip - Is picture-in-picture
 * @property {boolean} isLooping - Is looping
 * @property {Array} watchLater - Watch later list
 * @property {Array} history - Watch history
 */

/**
 * Video store actions interface
 * @typedef {Object} VideoActions
 * @property {Function} loadVideos - Load videos for feed
 * @property {Function} loadMore - Load more videos
 * @property {Function} setCurrentIndex - Set current video index
 * @property {Function} togglePlay - Toggle play/pause
 * @property {Function} setVolume - Set volume
 * @property {Function} toggleMute - Toggle mute
 * @property {Function} setSpeed - Set playback speed
 * @property {Function} setQuality - Set video quality
 * @property {Function} toggleFullscreen - Toggle fullscreen
 * @property {Function} togglePip - Toggle picture-in-picture
 * @property {Function} toggleLoop - Toggle loop
 * @property {Function} addToWatchLater - Add video to watch later
 * @property {Function} removeFromWatchLater - Remove video from watch later
 * @property {Function} addToHistory - Add to watch history
 * @property {Function} getHistory - Get watch history
 * @property {Function} reset - Reset store
 */

const initialState = {
  // Feed state
  videos: [],
  currentIndex: 0,
  loading: false,
  loadingMore: false,
  hasMore: true,
  nextCursor: null,
  feedType: 'for_you',

  // Playback state
  isPlaying: false,
  volume: 0.8,
  speed: 1,
  quality: 'auto',
  isMuted: false,
  isFullscreen: false,
  isPip: false,
  isLooping: true,

  // User lists
  watchLater: [],
  history: [],

  // Error state
  error: null,
};

const useVideoStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // Feed actions
      setVideos: (videos) => set({ videos, error: null }),
      
      appendVideos: (newVideos) => set((state) => ({
        videos: [...state.videos, ...newVideos],
      })),

      prependVideo: (video) => set((state) => ({
        videos: [video, ...state.videos],
      })),

      removeVideo: (videoId) => set((state) => ({
        videos: state.videos.filter((v) => v.id !== videoId),
      })),

      updateVideo: (videoId, updates) => set((state) => ({
        videos: state.videos.map((v) =>
          v.id === videoId ? { ...v, ...updates } : v
        ),
      })),

      setLoading: (loading) => set({ loading }),
      
      setLoadingMore: (loadingMore) => set({ loadingMore }),
      
      setHasMore: (hasMore) => set({ hasMore }),
      
      setNextCursor: (nextCursor) => set({ nextCursor }),
      
      setFeedType: (feedType) => set({ feedType, currentIndex: 0 }),
      
      setCurrentIndex: (index) => set({ 
        currentIndex: index,
        isPlaying: true,
      }),

      // Playback actions
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      
      setVolume: (volume) => set({ 
        volume: Math.max(0, Math.min(1, volume)),
        isMuted: volume === 0,
      }),
      
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      
      setSpeed: (speed) => set({ speed }),
      
      setQuality: (quality) => set({ quality }),
      
      toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
      
      togglePip: () => set((state) => ({ isPip: !state.isPip })),
      
      toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),

      // Watch later actions
      addToWatchLater: (video) => set((state) => {
        if (state.watchLater.some((v) => v.id === video.id)) {
          return state;
        }
        return {
          watchLater: [
            { ...video, addedAt: new Date().toISOString() },
            ...state.watchLater,
          ],
        };
      }),

      removeFromWatchLater: (videoId) => set((state) => ({
        watchLater: state.watchLater.filter((v) => v.id !== videoId),
      })),

      isInWatchLater: (videoId) => get().watchLater.some((v) => v.id === videoId),

      // History actions
      addToHistory: (videoId, progress = 0) => set((state) => {
        const existingIndex = state.history.findIndex((h) => h.videoId === videoId);
        const entry = {
          videoId,
          progress,
          watchedAt: new Date().toISOString(),
        };

        if (existingIndex !== -1) {
          const updated = [...state.history];
          updated[existingIndex] = entry;
          return { history: updated };
        }

        return {
          history: [entry, ...state.history.slice(0, 99)],
        };
      }),

      updateHistoryProgress: (videoId, progress) => set((state) => ({
        history: state.history.map((h) =>
          h.videoId === videoId ? { ...h, progress, watchedAt: new Date().toISOString() } : h
        ),
      })),

      getHistory: () => get().history,

      clearHistory: () => set({ history: [] }),

      // Error handling
      setError: (error) => set({ error, loading: false, loadingMore: false }),

      clearError: () => set({ error: null }),

      // Reset
      reset: () => set({
        ...initialState,
        volume: get().volume,
        speed: get().speed,
        quality: get().quality,
        isLooping: get().isLooping,
        watchLater: get().watchLater,
      }),

      // Navigation helpers
      goToNextVideo: () => {
        const { videos, currentIndex } = get();
        if (currentIndex < videos.length - 1) {
          set({ currentIndex: currentIndex + 1, isPlaying: true });
          return true;
        }
        return false;
      },

      goToPreviousVideo: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1, isPlaying: true });
          return true;
        }
        return false;
      },

      // Current video helpers
      getCurrentVideo: () => {
        const { videos, currentIndex } = get();
        return videos[currentIndex] || null;
      },

      getVideoById: (videoId) => {
        return get().videos.find((v) => v.id === videoId) || null;
      },

      // Batch operations
      likeVideo: (videoId) => set((state) => ({
        videos: state.videos.map((v) =>
          v.id === videoId
            ? {
                ...v,
                isLiked: !v.isLiked,
                likes: v.isLiked ? v.likes - 1 : v.likes + 1,
              }
            : v
        ),
      })),

      incrementViews: (videoId) => set((state) => ({
        videos: state.videos.map((v) =>
          v.id === videoId ? { ...v, views: (v.views || 0) + 1 } : v
        ),
      })),

      // Preferences persistence
      updatePreferences: (prefs) => set((state) => ({
        volume: prefs.volume ?? state.volume,
        speed: prefs.speed ?? state.speed,
        quality: prefs.quality ?? state.quality,
        isMuted: prefs.isMuted ?? state.isMuted,
        isLooping: prefs.isLooping ?? state.isLooping,
      })),
    }),
    {
      name: 'arvdoul-video-store',
      partialize: (state) => ({
        volume: state.volume,
        speed: state.speed,
        quality: state.quality,
        isMuted: state.isMuted,
        isLooping: state.isLooping,
        feedType: state.feedType,
        watchLater: state.watchLater,
        history: state.history.slice(0, 100),
      }),
    }
  )
);

export { useVideoStore };
export default useVideoStore;
