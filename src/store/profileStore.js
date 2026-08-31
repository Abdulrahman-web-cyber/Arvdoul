/**
 * src/store/profileStore.js - ARVDOUL Profile Store
 * 
 * Zustand store with Immer for profile state management.
 * Manages profile data, posts, follow status, and more.
 * 
 * Features:
 * - Profile loading with caching
 * - Follow/unfollow with optimistic updates
 * - Posts pagination
 * - Highlights and stories
 * - Level, balance, and position tracking
 * 
 * @author ARVDOUL Engineering Team
 * @version 1.0.0
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { toast } from 'sonner';

// ==================== INITIAL STATE ====================
const initialState = {
  // Profile data
  profile: null,
  loading: false,
  error: null,
  isOwner: false,
  
  // Follow status
  followStatus: null,
  followLoading: false,
  
  // Mutual friends
  mutualFriends: [],
  mutualFriendsLoading: false,
  
  // Posts
  posts: [],
  postsLoading: false,
  postsHasMore: true,
  postsCursor: null,
  postsError: null,
  
  // Highlights
  highlights: [],
  highlightsLoading: false,
  
  // Stories
  stories: [],
  storiesLoading: false,
  
  // Creator info
  level: null,
  levelLoading: false,
  
  // Balance
  balance: 0,
  balanceLoading: false,
  
  // Position
  position: null,
  positionLoading: false,
  
  // UI state
  activeTab: 'posts',
  refreshKey: 0,
};

// ==================== STORE ====================
export const useProfileStore = create(
  immer((set, get) => ({
    ...initialState,
    
    // ==================== PROFILE ACTIONS ====================
    /**
     * Load user profile with all related data
     * @param {string} userId - User ID to load
     * @param {string} currentUserId - Current logged in user ID
     */
    loadProfile: async (userId, currentUserId) => {
      if (!userId) return;
      
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        
        const isOwner = userId === currentUserId;
        
        // Fetch profile
        const profile = await userService.getUserProfile(userId);
        
        // Fetch follow status if not owner
        let followStatus = null;
        if (!isOwner && currentUserId) {
          try {
            followStatus = await userService.getFollowStatus(currentUserId, userId);
          } catch (e) {
            console.warn('Could not fetch follow status:', e);
          }
        }
        
        // Fetch mutual friends if not owner
        let mutualFriends = [];
        if (!isOwner && currentUserId) {
          try {
            const mutualResult = await userService.getMutualFriends(currentUserId, userId);
            mutualFriends = mutualResult?.users?.slice(0, 5) || [];
          } catch (e) {
            console.warn('Could not fetch mutual friends:', e);
          }
        }
        
        // Fetch level if not available
        let level = profile?.level || null;
        
        // Fetch balance if owner
        let balance = 0;
        if (isOwner) {
          try {
            const balanceResult = await monetizationService.getBalance(userId);
            balance = balanceResult?.coins || 0;
          } catch (e) {
            console.warn('Could not fetch balance:', e);
          }
        }
        
        // Fetch position
        let position = null;
        try {
          position = await monetizationService.getUserPosition(userId, profile?.gender);
        } catch (e) {
          console.warn('Could not fetch position:', e);
        }
        
        set((state) => {
          state.profile = profile;
          state.loading = false;
          state.error = null;
          state.isOwner = isOwner;
          state.followStatus = followStatus;
          state.mutualFriends = mutualFriends;
          state.level = level;
          state.balance = balance;
          state.position = position;
        });
        
        // Track profile view if not owner
        if (!isOwner && currentUserId) {
          analyticsService.trackProfileView(currentUserId, userId).catch(() => {});
        }
      } catch (error) {
        console.error('❌ Load profile failed:', error);
        set((state) => {
          state.loading = false;
          state.error = error.message || 'Failed to load profile';
        });
        toast.error('Failed to load profile');
      }
    },
    
    /**
     * Refresh profile data
     * @param {string} userId - User ID to refresh
     * @param {string} currentUserId - Current logged in user ID
     */
    refreshProfile: async (userId, currentUserId) => {
      set((state) => {
        state.refreshKey += 1;
      });
      await get().loadProfile(userId, currentUserId);
    },
    
    // ==================== POSTS ACTIONS ====================
    /**
     * Load user posts
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     */
    loadPosts: async (userId, options = {}) => {
      if (!userId) return;
      
      set((state) => {
        state.postsLoading = true;
        state.postsError = null;
      });
      
      try {
        const firestoreService = (await import('../services/firestoreService.js')).firestoreService;
        
        const result = await firestoreService.getPostsByUser(userId, {
          limit: options.limit || 12,
          ...options,
        });
        
        set((state) => {
          state.posts = result.posts || [];
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
        });
      } catch (error) {
        console.error('❌ Load posts failed:', error);
        set((state) => {
          state.postsLoading = false;
          state.postsError = error.message || 'Failed to load posts';
        });
      }
    },
    
    /**
     * Load more posts (pagination)
     * @param {string} userId - User ID
     */
    loadMorePosts: async (userId) => {
      const { postsCursor, postsHasMore, postsLoading } = get();
      
      if (!postsHasMore || postsLoading || !postsCursor) return;
      
      set((state) => {
        state.postsLoading = true;
      });
      
      try {
        const firestoreService = (await import('../services/firestoreService.js')).firestoreService;
        
        const result = await firestoreService.getPostsByUser(userId, {
          limit: 12,
          cursor: postsCursor,
        });
        
        set((state) => {
          state.posts = [...state.posts, ...(result.posts || [])];
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
        });
      } catch (error) {
        console.error('❌ Load more posts failed:', error);
        set((state) => {
          state.postsLoading = false;
          state.postsError = error.message || 'Failed to load more posts';
        });
      }
    },
    
    // ==================== HIGHLIGHTS ACTIONS ====================
    /**
     * Load user highlights
     * @param {string} userId - User ID
     */
    loadHighlights: async (userId) => {
      if (!userId) return;
      
      set((state) => {
        state.highlightsLoading = true;
      });
      
      try {
        const storyService = (await import('../services/storyService.js')).getStoryService();
        const highlights = await storyService.getHighlights(userId);
        
        set((state) => {
          state.highlights = highlights || [];
          state.highlightsLoading = false;
        });
      } catch (error) {
        console.error('❌ Load highlights failed:', error);
        set((state) => {
          state.highlightsLoading = false;
        });
      }
    },
    
    // ==================== STORIES ACTIONS ====================
    /**
     * Load user stories
     * @param {string} userId - User ID
     */
    loadStories: async (userId) => {
      if (!userId) return;
      
      set((state) => {
        state.storiesLoading = true;
      });
      
      try {
        const storyService = (await import('../services/storyService.js')).getStoryService();
        const storiesFeed = await storyService.getStoriesFeed({ userId });
        
        const userStories = storiesFeed?.filter(s => s.userId === userId) || [];
        
        set((state) => {
          state.stories = userStories;
          state.storiesLoading = false;
        });
      } catch (error) {
        console.error('❌ Load stories failed:', error);
        set((state) => {
          state.storiesLoading = false;
        });
      }
    },
    
    // ==================== LEVEL ACTIONS ====================
    /**
     * Load user level
     * @param {string} userId - User ID
     */
    loadLevel: async (userId) => {
      if (!userId) return;
      
      set((state) => {
        state.levelLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const levelData = await monetizationService.getUserLevel(userId);
        
        set((state) => {
          state.level = levelData?.level || 1;
          state.levelLoading = false;
        });
      } catch (error) {
        console.error('❌ Load level failed:', error);
        set((state) => {
          state.levelLoading = false;
        });
      }
    },
    
    // ==================== BALANCE ACTIONS ====================
    /**
     * Load user balance
     * @param {string} userId - User ID
     */
    loadBalance: async (userId) => {
      if (!userId) return;
      
      set((state) => {
        state.balanceLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const balanceData = await monetizationService.getBalance(userId);
        
        set((state) => {
          state.balance = balanceData?.coins || 0;
          state.balanceLoading = false;
        });
      } catch (error) {
        console.error('❌ Load balance failed:', error);
        set((state) => {
          state.balanceLoading = false;
        });
      }
    },
    
    // ==================== POSITION ACTIONS ====================
    /**
     * Load user position
     * @param {string} userId - User ID
     */
    loadPosition: async (userId) => {
      if (!userId) return;
      
      set((state) => {
        state.positionLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const positionData = await monetizationService.getUserPosition(userId);
        
        set((state) => {
          state.position = positionData;
          state.positionLoading = false;
        });
      } catch (error) {
        console.error('❌ Load position failed:', error);
        set((state) => {
          state.positionLoading = false;
        });
      }
    },
    
    // ==================== FOLLOW ACTIONS ====================
    /**
     * Load follow status
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    loadFollowStatus: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const followStatus = await userService.getFollowStatus(followerId, followingId);
        
        set((state) => {
          state.followStatus = followStatus;
        });
      } catch (error) {
        console.error('❌ Load follow status failed:', error);
      }
    },
    
    /**
     * Load mutual friends
     * @param {string} userId - Current user ID
     * @param {string} otherUserId - Other user ID
     */
    loadMutualFriends: async (userId, otherUserId) => {
      if (!userId || !otherUserId) return;
      
      set((state) => {
        state.mutualFriendsLoading = true;
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const result = await userService.getMutualFriends(userId, otherUserId);
        
        set((state) => {
          state.mutualFriends = result?.users?.slice(0, 5) || [];
          state.mutualFriendsLoading = false;
        });
      } catch (error) {
        console.error('❌ Load mutual friends failed:', error);
        set((state) => {
          state.mutualFriendsLoading = false;
        });
      }
    },
    
    /**
     * Follow a user with optimistic update
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    follow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      
      // Optimistic update
      set((state) => {
        state.followLoading = true;
        if (state.followStatus) {
          state.followStatus.isFollowing = true;
        }
        if (state.profile) {
          state.profile.followerCount = (state.profile.followerCount || 0) + 1;
        }
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.followUser(followerId, followingId);
        
        set((state) => {
          state.followLoading = false;
          state.followStatus = { ...state.followStatus, isFollowing: true };
        });
        
        toast.success('Following!');
      } catch (error) {
        console.error('❌ Follow failed:', error);
        
        // Rollback
        set((state) => {
          state.followLoading = false;
          if (state.followStatus) {
            state.followStatus.isFollowing = false;
          }
          if (state.profile) {
            state.profile.followerCount = Math.max(0, (state.profile.followerCount || 1) - 1);
          }
        });
        
        toast.error('Failed to follow user');
      }
    },
    
    /**
     * Unfollow a user with optimistic update
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    unfollow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      
      // Store previous state for rollback
      const previousFollowStatus = get().followStatus;
      const previousFollowerCount = get().profile?.followerCount || 0;
      
      // Optimistic update
      set((state) => {
        state.followLoading = true;
        if (state.followStatus) {
          state.followStatus.isFollowing = false;
        }
        if (state.profile) {
          state.profile.followerCount = Math.max(0, (state.profile.followerCount || 1) - 1);
        }
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.unfollowUser(followerId, followingId);
        
        set((state) => {
          state.followLoading = false;
          state.followStatus = { ...state.followStatus, isFollowing: false };
        });
        
        toast.success('Unfollowed');
      } catch (error) {
        console.error('❌ Unfollow failed:', error);
        
        // Rollback
        set((state) => {
          state.followLoading = false;
          state.followStatus = previousFollowStatus;
          if (state.profile) {
            state.profile.followerCount = previousFollowerCount;
          }
        });
        
        toast.error('Failed to unfollow user');
      }
    },
    
    /**
     * Update follow status directly
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     * @param {boolean} isFollowing - Follow status
     */
    updateFollowStatus: (followerId, followingId, isFollowing) => {
      set((state) => {
        state.followStatus = {
          ...state.followStatus,
          isFollowing,
        };
        if (state.profile) {
          state.profile.followerCount = isFollowing
            ? (state.profile.followerCount || 0) + 1
            : Math.max(0, (state.profile.followerCount || 1) - 1);
        }
      });
    },
    
    // ==================== UI ACTIONS ====================
    /**
     * Set active tab
     * @param {string} tab - Tab name
     */
    setActiveTab: (tab) => {
      set((state) => {
        state.activeTab = tab;
      });
    },
    
    // ==================== RESET ACTIONS ====================
    /**
     * Clear all profile state
     */
    clear: () => {
      set((state) => {
        Object.assign(state, initialState);
      });
    },
    
    /**
     * Reset store to initial state
     */
    reset: () => {
      set(() => ({ ...initialState }));
    },
  }))
);

// ==================== SELECTORS ====================
export const selectProfile = (state) => state.profile;
export const selectIsOwner = (state) => state.isOwner;
export const selectFollowStatus = (state) => state.followStatus;
export const selectPosts = (state) => state.posts;
export const selectHighlights = (state) => state.highlights;
export const selectActiveTab = (state) => state.activeTab;
export const selectLoading = (state) => state.loading;
export const selectError = (state) => state.error;

export default useProfileStore;
