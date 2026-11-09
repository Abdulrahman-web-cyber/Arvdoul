/**
 * Custom hook for analytics management including event tracking and
 * profile analytics loading.
 * 
 * @module hooks/useAnalytics
 */

import { useCallback, useEffect } from 'react';
import { useAnalyticsStore } from '../store/analyticsStore';

/**
 * useAnalytics Hook
 * Combines event tracking with profile analytics management.
 * @param {string} userId - User ID to load analytics for
 * @returns {Object} Analytics state and actions
 */
export const useAnalytics = (userId) => {
  const {
    analytics,
    loading,
    error,
    timeframe,
    dailyStats,
    ranking,
    demographics,
    growthRate,
    loadAnalytics,
    loadDailyStats,
    loadRanking,
    loadDemographics,
    setTimeframe,
    refresh,
  } = useAnalyticsStore();

  // Event tracking: forwarded to the real in-app metrics registry so the
  // counter is observable, not just logged. Exposed as `trackEvent` (the name
  // nav surfaces destructure) and `track` for existing callers.
  const track = useCallback((event, data) => {
    try {
      import('../services/metricsService.js').then(({ metricsService }) => {
        metricsService.incrementCounter(`event_${event}`, 1);
      }).catch((err) => console.warn('[Analytics] metric increment failed', err?.message));
    } catch {
      // analytics must never break a UI interaction
    }
  }, []);

  // Load analytics when userId or timeframe changes
  useEffect(() => {
    if (userId) {
      loadAnalytics(userId, timeframe);
    }
  }, [userId, timeframe, loadAnalytics]);

  // Load daily stats
  const handleLoadDailyStats = useCallback((days = 30) => {
    if (userId) {
      loadDailyStats(userId, days);
    }
  }, [userId, loadDailyStats]);

  // Load ranking
  const handleLoadRanking = useCallback(() => {
    if (userId) {
      loadRanking(userId);
    }
  }, [userId, loadRanking]);

  // Load demographics
  const handleLoadDemographics = useCallback(() => {
    if (userId) {
      loadDemographics(userId);
    }
  }, [userId, loadDemographics]);

  // Change timeframe
  const handleSetTimeframe = useCallback((newTimeframe) => {
    setTimeframe(newTimeframe);
  }, [setTimeframe]);

  // Refresh analytics
  const handleRefresh = useCallback(() => {
    refresh(userId);
  }, [userId, refresh]);

  return {
    // Tracking
    track,
    trackEvent: track,

    // Profile Analytics State
    analytics,
    loading,
    error,
    timeframe,
    dailyStats,
    ranking,
    demographics,
    growthRate,

    // Profile Analytics Actions
    loadDailyStats: handleLoadDailyStats,
    loadRanking: handleLoadRanking,
    loadDemographics: handleLoadDemographics,
    setTimeframe: handleSetTimeframe,
    refresh: handleRefresh,
  };
};

export default useAnalytics;
