/**
 * src/store/analyticsStore.js - ARVDOUL Analytics Store
 * 
 * Zustand store with Immer for analytics state management.
 * Manages user analytics data, timeframes, and dashboard metrics.
 * 
 * Features:
 * - User analytics loading
 * - Timeframe selection
 * - Daily stats and trends
 * - Demographics and ranking
 * 
 * @author ARVDOUL Engineering Team
 * @version 1.0.0
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { toast } from 'sonner';

// ==================== INITIAL STATE ====================
const initialState = {
  // Analytics data
  analytics: null,
  loading: false,
  error: null,
  
  // Timeframe
  timeframe: '30d',
  
  // Detailed metrics
  dailyStats: [],
  topPosts: [],
  ranking: null,
  demographics: null,
  
  // Summary metrics
  growthRate: 0,
  activeDays: 0,
  
  // Refresh
  refreshKey: 0,
};

// ==================== STORE ====================
export const useAnalyticsStore = create(
  immer((set, get) => ({
    ...initialState,
    
    // ==================== ANALYTICS ACTIONS ====================
    /**
     * Load user analytics
     * @param {string} userId - User ID
     * @param {string} timeframe - Timeframe (7d, 30d, 90d, 365d)
     */
    loadAnalytics: async (userId, timeframe) => {
      if (!userId) return;
      
      const selectedTimeframe = timeframe || get().timeframe;
      
      set((state) => {
        state.loading = true;
        state.error = null;
        state.timeframe = selectedTimeframe;
      });
      
      try {
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        
        const analytics = await analyticsService.getUserAnalytics(userId, selectedTimeframe);
        
        set((state) => {
          state.analytics = analytics;
          state.loading = false;
          state.error = null;
          state.dailyStats = analytics.dailyStats || [];
          state.topPosts = analytics.topPosts || [];
          state.ranking = analytics.ranking || null;
          state.demographics = analytics.demographics || null;
          state.growthRate = analytics.growthRate || 0;
          state.activeDays = analytics.activeDays || 0;
        });
      } catch (error) {
        console.error('❌ Load analytics failed:', error);
        set((state) => {
          state.loading = false;
          state.error = error.message || 'Failed to load analytics';
        });
        toast.error('Failed to load analytics');
      }
    },
    
    /**
     * Refresh analytics
     * @param {string} userId - User ID
     */
    refresh: async (userId) => {
      const { timeframe } = get();
      
      set((state) => {
        state.refreshKey += 1;
      });
      
      await get().loadAnalytics(userId, timeframe);
    },
    
    // ==================== DETAILED METRICS ====================
    /**
     * Load daily stats
     * @param {string} userId - User ID
     * @param {number} days - Number of days
     */
    loadDailyStats: async (userId, days) => {
      if (!userId) return;
      
      try {
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        const dailyStats = await analyticsService.getUserAnalytics(userId, `${days}d`);
        
        set((state) => {
          state.dailyStats = dailyStats.dailyStats || [];
        });
      } catch (error) {
        console.error('❌ Load daily stats failed:', error);
      }
    },
    
    /**
     * Load creator ranking
     * @param {string} userId - User ID
     */
    loadRanking: async (userId) => {
      if (!userId) return;
      
      try {
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        const ranking = await analyticsService.getCreatorRanking(userId);
        
        set((state) => {
          state.ranking = ranking;
        });
      } catch (error) {
        console.error('❌ Load ranking failed:', error);
      }
    },
    
    /**
     * Load audience demographics
     * @param {string} userId - User ID
     */
    loadDemographics: async (userId) => {
      if (!userId) return;
      
      try {
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        const demographics = await analyticsService.getAudienceDemographics(userId);
        
        set((state) => {
          state.demographics = demographics;
        });
      } catch (error) {
        console.error('❌ Load demographics failed:', error);
      }
    },
    
    // ==================== TIMEFRAME ACTIONS ====================
    /**
     * Set timeframe and reload analytics
     * @param {string} timeframe - Timeframe (7d, 30d, 90d, 365d)
     */
    setTimeframe: (timeframe) => {
      set((state) => {
        state.timeframe = timeframe;
      });
    },
    
    // ==================== RESET ACTIONS ====================
    /**
     * Clear analytics state
     */
    clear: () => {
      set((state) => {
        Object.assign(state, initialState);
      });
    },
  }))
);

// ==================== SELECTORS ====================
export const selectAnalytics = (state) => state.analytics;
export const selectLoading = (state) => state.loading;
export const selectError = (state) => state.error;
export const selectTimeframe = (state) => state.timeframe;
export const selectDailyStats = (state) => state.dailyStats;
export const selectTopPosts = (state) => state.topPosts;
export const selectRanking = (state) => state.ranking;
export const selectDemographics = (state) => state.demographics;
export const selectGrowthRate = (state) => state.growthRate;

export default useAnalyticsStore;
