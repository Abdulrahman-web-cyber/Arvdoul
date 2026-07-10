/**
 * src/hooks/useCreatorDashboard.js - ARVDOUL Creator Dashboard Hook
 * 
 * Custom hook for creator dashboard management.
 * Provides analytics loading, timeframe selection, and data export.
 * 
 * @module hooks/useCreatorDashboard
 */

import { useCallback, useEffect, useState } from 'react';
import { useAnalyticsStore } from '../store/analyticsStore';

/**
 * useCreatorDashboard Hook
 * @param {string} userId - User ID for dashboard
 * @returns {Object} Dashboard state and actions
 */
export function useCreatorDashboard(userId) {
  const {
    analytics,
    loading,
    error,
    timeframe,
    dailyStats,
    topPosts,
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
  
  const [exporting, setExporting] = useState(false);
  
  // Load dashboard data
  useEffect(() => {
    if (userId) {
      loadAnalytics(userId, timeframe);
    }
  }, [userId, timeframe]);
  
  // Load detailed metrics
  const loadDashboard = useCallback(async (days = 30) => {
    if (!userId) return;
    
    await loadAnalytics(userId, `${days}d`);
    await loadDailyStats(userId, days);
    await loadRanking(userId);
    await loadDemographics(userId);
  }, [userId, loadAnalytics, loadDailyStats, loadRanking, loadDemographics]);
  
  // Refresh dashboard
  const handleRefresh = useCallback(() => {
    refresh(userId);
  }, [userId, refresh]);
  
  // Change timeframe
  const handleSetTimeframe = useCallback((tf) => {
    setTimeframe(tf);
  }, [setTimeframe]);
  
  // Export data
  const exportData = useCallback(async (format = 'json') => {
    if (!analytics) return null;
    
    setExporting(true);
    
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        userId,
        timeframe,
        summary: {
          totalViews: analytics.totalViews,
          totalReach: analytics.totalReach,
          totalEngagement: analytics.totalEngagement,
          coinsEarned: analytics.coinsEarned,
          growthRate: analytics.growthRate,
          activeDays: analytics.activeDays,
        },
        dailyStats,
        topPosts,
        ranking,
        demographics,
      };
      
      if (format === 'json') {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportName = `creator_dashboard_${userId}_${timeframe}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.click();
        
        return data;
      } else if (format === 'csv') {
        // Convert to CSV
        const headers = ['Date', 'Views', 'Reach', 'Engagement', 'Coins'];
        const rows = dailyStats.map(stat => [
          stat.date,
          stat.views || 0,
          stat.reach || 0,
          stat.engagement || 0,
          stat.coins || 0,
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(',')),
        ].join('\n');
        
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const exportName = `creator_dashboard_${userId}_${timeframe}.csv`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.click();
        
        return data;
      }
      
      return null;
    } finally {
      setExporting(false);
    }
  }, [analytics, userId, timeframe, dailyStats, topPosts, ranking, demographics]);
  
  // Get metrics summary
  const getMetricsSummary = useCallback(() => {
    if (!analytics) return null;
    
    return {
      views: analytics.totalViews || 0,
      reach: analytics.totalReach || 0,
      engagement: analytics.totalEngagement || 0,
      coins: analytics.coinsEarned || 0,
      growthRate: growthRate || 0,
      activeDays: analytics.activeDays || 0,
      changes: analytics.changes || {},
    };
  }, [analytics, growthRate]);
  
  return {
    // State
    analytics,
    loading,
    error,
    timeframe,
    dailyStats,
    topPosts,
    ranking,
    demographics,
    growthRate,
    exporting,
    
    // Actions
    loadDashboard,
    refresh: handleRefresh,
    setTimeframe: handleSetTimeframe,
    exportData,
    getMetricsSummary,
  };
}

export default useCreatorDashboard;
