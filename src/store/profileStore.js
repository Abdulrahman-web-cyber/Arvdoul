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
import { useAppStore } from './appStore.js';
import { getStoredUser, getStoredUid } from '../utils/security.js';

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

  // Saved Posts
  savedPosts: [],
  savedLoading: false,

  // Shop Items
  shopItems: [],
  shopLoading: false,
  
  // UI state
  activeTab: 'posts',
  refreshKey: 0,
  // Monotonic request token. Every loadProfile call takes a new value and any
  // in-flight response whose token is stale is discarded, so a slow response
  // for a previous account or route cannot overwrite current state (audit N013).
  requestSeq: 0,
  // Per-loader tokens for the same guard on the secondary profile loaders
  // (posts, highlights, saved, stories, level, balance, position). Without
  // these, switching accounts while one of them is in flight lets the old
  // account's data land in the new account's store (audit §26).
  loadSeq: {},
};

// ==================== STORE ====================
export const useProfileStore = create(
  immer((set, get) => ({
    ...initialState,

    // ==================== STALE-RESPONSE GUARDS ====================
    // Take a fresh token for a named loader. Any response that resolves after a
    // newer load started (or after clear()) sees a mismatched token and is
    // discarded, so a slow account-A response can never populate account B.
    _startLoad: (key) => {
      const seq = (get().loadSeq?.[key] || 0) + 1;
      set((state) => {
        state.loadSeq[key] = seq;
      });
      return seq;
    },
    _isLoadCurrent: (key, seq) => get().loadSeq?.[key] === seq,
    
    // ==================== PROFILE ACTIONS ====================
    /**
     * Load user profile with all related data
     * @param {string} userId - User ID to load
     * @param {string} currentUserId - Current logged in user ID
     * @param {Object} [options={}] - Query options (e.g. viewAs)
     */
    loadProfile: async (userId, currentUserId, options = {}) => {
      if (!userId) return;

      const requestId = get().requestSeq + 1;
      set((state) => {
        state.requestSeq = requestId;
        state.loading = true;
        state.error = null;
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
        
        const isOwner = userId === currentUserId;
        
        // Fetch profile with requester context and viewAs projection
        const profile = await userService.getUserProfile(userId, currentUserId, options);
        
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
        
        // Resolve profile with safe fallback guarantee & real auth user linkage
        const appCurrentUser = useAppStore.getState().currentUser || getStoredUser();
        const storedUid = getStoredUid();
        const effectiveUid = currentUserId || storedUid;
        const fallbackDisplayName = isOwner
          ? (typeof appCurrentUser?.displayName === 'string' && appCurrentUser.displayName ? appCurrentUser.displayName : (typeof appCurrentUser?.name === 'string' && appCurrentUser.name ? appCurrentUser.name : (typeof appCurrentUser?.email === 'string' ? appCurrentUser.email.split('@')[0] : 'Member')))
          : 'Creator';
        const fallbackUsername = isOwner
          ? (typeof appCurrentUser?.username === 'string' && appCurrentUser.username ? appCurrentUser.username : (typeof appCurrentUser?.email === 'string' ? appCurrentUser.email.split('@')[0] : (effectiveUid ? `user_${effectiveUid.slice(0, 6)}` : 'creator')))
          : (typeof userId === 'string' && userId.startsWith('user_') ? userId : `user_${(typeof userId === 'string' ? userId : 'creator').slice(0, 7)}`);

        const resolvedProfile = profile ? {
          ...profile,
          displayName: (profile.displayName && profile.displayName !== 'User' && profile.displayName !== 'Creator')
            ? profile.displayName
            : fallbackDisplayName,
          username: (profile.username && !profile.username.startsWith('user_'))
            ? profile.username
            : fallbackUsername,
        } : {
          // No profile document was returned. Never invent standing: omit
          // coins/level/reputation and deny every viewer-gated section rather
          // than rendering fabricated values as real.
          id: userId || effectiveUid || null,
          uid: userId || effectiveUid || null,
          username: fallbackUsername,
          displayName: fallbackDisplayName,
          bio: typeof appCurrentUser?.bio === 'string' ? appCurrentUser.bio : '',
          photoURL: appCurrentUser?.photoURL || null,
          isVerified: false,
          isCreator: false,
          canViewActivity: false,
          canViewAchievements: false,
          canViewTitles: false,
          canViewFollowersList: false,
          canViewFollowingList: false,
        };

        // Drop a stale response (account switch / newer navigation) — N013.
        if (get().requestSeq !== requestId) return;

        set((state) => {
          state.profile = resolvedProfile;
          state.loading = false;
          state.error = null;
          state.isOwner = isOwner;
          state.followStatus = followStatus;
          state.mutualFriends = mutualFriends;
          state.level = resolvedProfile.level ?? level ?? null;
          state.balance = balance;
          state.position = position;
        });
        
        // Track profile view if not owner
        if (!isOwner && currentUserId) {
          analyticsService.trackProfileView(currentUserId, userId).catch(() => {});
        }
      } catch (error) {
        console.warn('Load profile handled gracefully with fallback:', error?.message);
        const storedUid = getStoredUid();
        const effectiveUid = currentUserId || storedUid;
        const isOwner = !userId || userId === effectiveUid;
        const localAuth = getStoredUser() || {};

        const rawDisplayName = localAuth.displayName || localAuth.name;
        const rawEmail = typeof localAuth.email === 'string' ? localAuth.email : '';
        const fallbackDisplayName = isOwner
          ? (typeof rawDisplayName === 'string' && rawDisplayName ? rawDisplayName : (rawEmail ? rawEmail.split('@')[0] : 'Member'))
          : 'Creator';
        const fallbackUsername = isOwner
          ? (typeof localAuth.username === 'string' && localAuth.username ? localAuth.username : (rawEmail ? rawEmail.split('@')[0] : (effectiveUid ? `user_${effectiveUid.slice(0, 6)}` : 'creator')))
          : (typeof userId === 'string' && userId.startsWith('user_') ? userId : `user_${(typeof userId === 'string' ? userId : 'creator').slice(0, 7)}`);

        const fallbackProfile = {
          // Load failed: surface a not-found state instead of inventing
          // coins/level/reputation or granting viewer-gated sections.
          id: userId || effectiveUid || null,
          uid: userId || effectiveUid || null,
          username: fallbackUsername,
          displayName: fallbackDisplayName,
          bio: typeof localAuth.bio === 'string' ? localAuth.bio : '',
          photoURL: localAuth.photoURL || null,
          isVerified: false,
          isCreator: false,
          canViewActivity: false,
          canViewAchievements: false,
          canViewTitles: false,
          canViewFollowersList: false,
          canViewFollowingList: false,
        };

        if (get().requestSeq !== requestId) return;

        set((state) => {
          state.profile = fallbackProfile;
          state.loading = false;
          state.error = error?.message || 'Profile unavailable';
          state.isOwner = isOwner;
          state.balance = null;
          state.level = null;
        });
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

    /**
     * Update user profile with optimistic state and validation
     * @param {string} userId - User ID
     * @param {Object} updates - Profile changes
     */
    updateProfile: async (userId, updates) => {
      if (!userId || !updates) return;
      const previousProfile = get().profile;

      // Optimistic update
      set((state) => {
        if (state.profile) {
          state.profile = { ...state.profile, ...updates };
        }
      });

      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.updateUserProfile(userId, updates);
        toast.success('Profile updated successfully!');
      } catch (error) {
        console.error('❌ Update profile failed, rolling back:', error);
        set((state) => {
          state.profile = previousProfile;
          state.error = error.message;
        });
        toast.error(error.message || 'Failed to update profile');
        throw error;
      }
    },

    /**
     * Upload and update user avatar
     * @param {string} userId - User ID
     * @param {File|Blob} file - Avatar file
     */
    updateAvatar: async (userId, file) => {
      if (!userId || !file) return;
      const previousPhotoURL = get().profile?.photoURL;

      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const uploadResult = await userService.uploadAvatar(userId, file);
        const newPhotoURL = uploadResult?.downloadURL || uploadResult?.photoURL || uploadResult?.url || uploadResult;

        set((state) => {
          if (state.profile && newPhotoURL) {
            state.profile.photoURL = newPhotoURL;
          }
        });
        toast.success('Avatar updated successfully!');
        return newPhotoURL;
      } catch (error) {
        console.error('❌ Update avatar failed:', error);
        set((state) => {
          if (state.profile) {
            state.profile.photoURL = previousPhotoURL;
          }
        });
        toast.error(error.message || 'Failed to upload avatar');
        throw error;
      }
    },

    // ==================== POSTS ACTIONS ====================
    /**
     * Load user posts
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     */
    loadPosts: async (userId, options = {}) => {
      if (!userId) return;
      const __seq = get()._startLoad('posts');      
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

        let userPosts = result?.posts || [];
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const localPosts = JSON.parse(localStorage.getItem('arvdoul_local_posts') || '[]');
            const localUserPosts = localPosts.filter(p => p && (p.authorId === userId || !p.authorId));
            if (localUserPosts.length > 0) {
              const existingIds = new Set(userPosts.map(p => p.id));
              for (const lp of localUserPosts) {
                if (!existingIds.has(lp.id)) {
                  userPosts.unshift(lp);
                  existingIds.add(lp.id);
                }
              }
            }
          }
        } catch {}
        
        if (!get()._isLoadCurrent('posts', __seq)) return;
        set((state) => {
          state.posts = userPosts;
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
        });
      } catch (error) {
        console.error('❌ Load posts failed:', error);
        if (!get()._isLoadCurrent('posts', __seq)) return;
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
      const __seq = get()._startLoad('highlights');      
      set((state) => {
        state.highlightsLoading = true;
      });
      
      try {
        const storyService = (await import('../services/storyService.js')).getStoryService();
        const highlights = await storyService.getHighlights(userId);
        
        if (!get()._isLoadCurrent('highlights', __seq)) return;
        set((state) => {
          state.highlights = highlights || [];
          state.highlightsLoading = false;
        });
      } catch (error) {
        console.error('❌ Load highlights failed:', error);
        if (!get()._isLoadCurrent('highlights', __seq)) return;
        set((state) => {
          state.highlightsLoading = false;
        });
      }
    },

    /**
     * Load user saved posts
     * @param {string} userId - User ID
     */
    loadSavedPosts: async (userId) => {
      if (!userId) return;
      const __seq = get()._startLoad('saved');
      set((state) => {
        state.savedLoading = true;
      });
      try {
        const { getFirestoreService } = await import('../services/firestoreService.js');
        const res = await getFirestoreService().getSavedPosts(userId);
        const posts = Array.isArray(res) ? res : res?.posts || [];
        if (!get()._isLoadCurrent('saved', __seq)) return;
        set((state) => {
          state.savedPosts = posts;
          state.savedLoading = false;
        });
      } catch (error) {
        console.error('❌ Load saved posts failed:', error);
        if (!get()._isLoadCurrent('saved', __seq)) return;
        set((state) => {
          state.savedLoading = false;
        });
      }
    },

    /**
     * Load creator shop items
     * @param {string} [userId] - Creator user ID
     */
    loadShopItems: async (userId) => {
      const __seq = get()._startLoad('shop');
      set((state) => {
        state.shopLoading = true;
      });
      try {
        const { marketplaceService } = await import('../services/marketplaceService.js');
        const items = await marketplaceService.getProducts();
        if (!get()._isLoadCurrent('shop', __seq)) return;
        set((state) => {
          state.shopItems = items || [];
          state.shopLoading = false;
        });
      } catch (error) {
        console.error('❌ Load shop items failed:', error);
        if (!get()._isLoadCurrent('shop', __seq)) return;
        set((state) => {
          state.shopLoading = false;
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
      const __seq = get()._startLoad('stories');      
      set((state) => {
        state.storiesLoading = true;
      });
      
      try {
        const storyService = (await import('../services/storyService.js')).getStoryService();
        const storiesFeed = await storyService.getStoriesFeed({ userId });
        
        const userStories = storiesFeed?.filter(s => s.userId === userId) || [];
        
        if (!get()._isLoadCurrent('stories', __seq)) return;
        set((state) => {
          state.stories = userStories;
          state.storiesLoading = false;
        });
      } catch (error) {
        console.error('❌ Load stories failed:', error);
        if (!get()._isLoadCurrent('stories', __seq)) return;
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
      const __seq = get()._startLoad('level');      
      set((state) => {
        state.levelLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const levelData = await monetizationService.getUserLevel(userId);
        
        if (!get()._isLoadCurrent('level', __seq)) return;
        set((state) => {
          state.level = levelData?.level || 1;
          state.levelLoading = false;
        });
      } catch (error) {
        console.error('❌ Load level failed:', error);
        if (!get()._isLoadCurrent('level', __seq)) return;
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
      const __seq = get()._startLoad('balance');      
      set((state) => {
        state.balanceLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const balanceData = await monetizationService.getBalance(userId);
        
        if (!get()._isLoadCurrent('balance', __seq)) return;
        set((state) => {
          state.balance = balanceData?.coins || 0;
          state.balanceLoading = false;
        });
      } catch (error) {
        console.error('❌ Load balance failed:', error);
        if (!get()._isLoadCurrent('balance', __seq)) return;
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
      const __seq = get()._startLoad('position');      
      set((state) => {
        state.positionLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const positionData = await monetizationService.getUserPosition(userId);
        
        if (!get()._isLoadCurrent('position', __seq)) return;
        set((state) => {
          state.position = positionData;
          state.positionLoading = false;
        });
      } catch (error) {
        console.error('❌ Load position failed:', error);
        if (!get()._isLoadCurrent('position', __seq)) return;
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
      // Idempotent: a double-tap while already following must not increment
      // the optimistic counter a second time (audit N012/D-4).
      if (get().followStatus?.isFollowing === true) return;

      // Snapshot before the optimistic write so rollback restores the
      // real previous state instead of a hard-coded guess (audit N012).
      const previousFollowStatus = get().followStatus;
      const previousFollowerCount = get().profile?.followerCount || 0;

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
        
        // Rollback to the captured snapshot (audit N012).
        set((state) => {
          state.followLoading = false;
          state.followStatus = previousFollowStatus;
          if (state.profile) {
            state.profile.followerCount = previousFollowerCount;
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
      // Idempotent: a double-tap while not following must not decrement the
      // optimistic counter a second time (audit N012/D-4).
      if (get().followStatus?.isFollowing === false) return;
      
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
        // Idempotent: only adjust the counter on an actual transition,
        // so repeated calls with the same state cannot double-count (N012).
        const wasFollowing = state.followStatus?.isFollowing === true;
        state.followStatus = {
          ...state.followStatus,
          isFollowing,
        };
        if (state.profile && wasFollowing !== Boolean(isFollowing)) {
          state.profile.followerCount = isFollowing
            ? (state.profile.followerCount || 0) + 1
            : Math.max(0, (state.profile.followerCount || 0) - 1);
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
        const nextSeq = (state.requestSeq || 0) + 1;
        const nextLoads = {};
        for (const k of Object.keys(state.loadSeq || {})) nextLoads[k] = (state.loadSeq[k] || 0) + 1;
        Object.assign(state, initialState);
        // Keep the bumped tokens so any in-flight load for the previous account
        // is discarded when it resolves (audit N013 / §26).
        state.requestSeq = nextSeq;
        state.loadSeq = nextLoads;
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
