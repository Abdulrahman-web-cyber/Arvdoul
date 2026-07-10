/**
 * src/hooks/useLive.js - ARVDOUL Live Streaming Hook
 * 
 * Custom hook for live streaming functionality.
 * Provides stream management, viewer tracking, and monetization.
 * 
 * @module hooks/useLive
 */

import { useCallback, useEffect, useState } from 'react';
import { getLiveService } from '../services/liveService';

/**
 * useLive Hook
 * @param {string} streamId - Stream ID for real-time features
 * @returns {Object} Live streaming state and actions
 */
export function useLive(streamId = null) {
  const [config, setConfig] = useState(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canStart, setCanStart] = useState({ canStart: false, reason: null });
  
  const liveService = getLiveService();
  
  // Initialize and get config
  useEffect(() => {
    const init = async () => {
      try {
        const liveConfig = liveService.getLiveConfig();
        setConfig(liveConfig);
      } catch (err) {
        console.error('Failed to get live config:', err);
      }
    };
    init();
  }, []);
  
  // Load stream if streamId provided
  useEffect(() => {
    const loadStream = async () => {
      if (streamId) {
        setLoading(true);
        try {
          const streamData = await liveService.getLiveStream(streamId);
          setStream(streamData);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
    };
    loadStream();
  }, [streamId]);
  
  // Check if user can start live
  const checkCanStart = useCallback(async (userId) => {
    try {
      const result = await liveService.canStartLive(userId);
      setCanStart(result);
      return result;
    } catch (err) {
      setError(err.message);
      return { canStart: false, reason: err.message };
    }
  }, []);
  
  // Start live stream
  const startLive = useCallback(async (userId, streamData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await liveService.startLiveStream(userId, streamData);
      setStream(result.stream);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // End live stream
  const endLive = useCallback(async (sid, userId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await liveService.endLiveStream(sid, userId);
      setStream(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Join stream
  const joinStream = useCallback(async (sid, viewerId) => {
    try {
      await liveService.joinLiveStream(sid, viewerId);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  
  // Leave stream
  const leaveStream = useCallback(async (sid, viewerId) => {
    try {
      await liveService.leaveLiveStream(sid, viewerId);
    } catch (err) {
      console.warn('Leave stream error:', err.message);
    }
  }, []);
  
  // Send comment
  const sendComment = useCallback(async (sid, userId, comment) => {
    try {
      return await liveService.sendLiveComment(sid, userId, comment);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Send gift
  const sendGift = useCallback(async (sid, senderId, recipientId, giftType) => {
    try {
      return await liveService.sendLiveGift(sid, senderId, recipientId, giftType);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Send tip
  const sendTip = useCallback(async (sid, senderId, amount) => {
    try {
      return await liveService.sendLiveTip(sid, senderId, amount);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Get active streams
  const getActiveStreams = useCallback(async (options = {}) => {
    try {
      return await liveService.getActiveLiveStreams(options);
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);
  
  // Get user live history
  const getUserHistory = useCallback(async (userId, options = {}) => {
    try {
      return await liveService.getLiveHistory(userId, options);
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);
  
  // Get stream analytics
  const getStreamAnalytics = useCallback(async (sid) => {
    try {
      return await liveService.getLiveAnalytics(sid);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);
  
  // Get user live analytics
  const getUserLiveAnalytics = useCallback(async (userId, days = 30) => {
    try {
      return await liveService.getUserLiveAnalytics(userId, days);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);
  
  return {
    // State
    config,
    stream,
    loading,
    error,
    canStart,
    
    // Actions
    checkCanStart,
    startLive,
    endLive,
    joinStream,
    leaveStream,
    sendComment,
    sendGift,
    sendTip,
    getActiveStreams,
    getUserHistory,
    getStreamAnalytics,
    getUserLiveAnalytics,
  };
}

export default useLive;
