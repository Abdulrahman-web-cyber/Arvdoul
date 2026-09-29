/**
 * src/store/profileStore.js - ARVDOUL Profile Store
 *
 * Canonical Profile orchestration layer (Zustand + Immer).
 *
 * Owns viewer-target Profile VIEW state and delegates every domain read/write to
 * the canonical service. It never computes domain truth:
 *   - profile document  -> userService
 *   - permissions       -> profileCapabilityEngine (fail-closed)
 *   - level/progression -> levelSystemService (+ shared levelConfig)
 *   - reputation        -> reputationService
 *   - rank / badges     -> rankingService
 *   - achievements      -> achievementService
 *   - titles            -> titleService
 *   - passport          -> passportService
 *   - creator identity  -> creatorService
 *   - economy           -> monetizationService / walletService
 *   - content           -> firestoreService / storyService
 *   - analytics         -> analyticsService
 *
 * Concurrency: every async profile load captures a request identity. A late
 * response for a previous target/request can never overwrite newer state.
 *
 * @author ARVDOUL Engineering Team
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { toast } from 'sonner';
import { resolveCapabilities } from '../services/profileCapabilityEngine.js';

// Monotonic request tokens. Used to drop stale responses across rapid target switches.
let _loadSeq = 0;
let _postSeq = 0;
let _highlightsSeq = 0;
let _savedSeq = 0;
let _friendReqSeq = 0;
let _followSeq = 0;
let _videosSeq = 0;

/**
 * Invalidate every outstanding async request. Bumping each token past the
 * current high-water mark guarantees a response captured before a purge (e.g.
 * sign-out mid-load) can never be accepted afterwards.
 */
const invalidateAllRequests = () => {
  _loadSeq += 1;
  _postSeq += 1;
  _highlightsSeq += 1;
  _savedSeq += 1;
  _friendReqSeq += 1;
  _followSeq += 1;
  _videosSeq += 1;
  return {
    _activeRequestId: _loadSeq,
    _postsRequestId: _postSeq,
    _highlightsRequestId: _highlightsSeq,
    _savedRequestId: _savedSeq,
    _friendReqRequestId: _friendReqSeq,
    _followRequestId: _followSeq,
    _videosRequestId: _videosSeq,
  };
};

// ==================== INITIAL STATE ====================
const initialState = {
  // Identity / document
  profile: null,
  loading: false,
  error: null,
  isOwner: false,

  // Relationship + capabilities (canonical, fail-closed)
  relationship: null,
  capabilities: null,

  // Follow status
  followStatus: null,
  followLoading: false,

  // Friend-request domain state (visitor surface). Distinct from follow.
  friendRequestStatus: null,   // 'none' | 'pending' | 'received' | 'friends'
  pendingFriendRequestId: null,
  friendRequestLoading: false,

  // Mutual friends
  mutualFriends: [],
  mutualFriendsLoading: false,

  // Posts
  posts: [],
  postsLoading: false,
  postsHasMore: true,
  postsCursor: null,
  postsError: null,

  // Highlights / Stories
  highlights: [],
  stories: [],
  highlightsLoading: false,
  highlightsError: null,

  // Sparks (canonical video content for this Profile)
  videos: [],
  videosLoading: false,
  videosError: null,

  // Digital-nation domain summaries
  level: null,
  balance: null,
  position: null,
  reputation: null,
  rank: null,
  achievements: [],
  titles: [],
  badges: null,
  creatorProfile: null,
  passport: null,
  wallet: null,

  // Saved Posts (owner-only surface)
  savedPosts: [],
  savedLoading: false,

  // UI state
  activeTab: 'posts',
  refreshKey: 0,

  // request identity for the last accepted profile load
  _activeRequestId: 0,
  _activeTargetId: null,
  // follow/unfollow mutation identity (latest mutation wins on reconcile)
  _followRequestId: 0,
  // per-surface request identity (stale-response protection)
  _postsRequestId: 0,
  _highlightsRequestId: 0,
  _savedRequestId: 0,
  _friendReqRequestId: 0,
  _videosRequestId: 0,
  // resolved uid for the current target (handles username -> uid resolution)
  resolvedTargetId: null,
  // last viewer:target pair whose profile view was reported to analytics, so a
  // re-render / refresh of the same view is not counted twice.
  _trackedViewKey: null,
};

// ==================== STORE ====================
export const useProfileStore = create(
  immer((set, get) => ({
    ...initialState,

    // ==================== PROFILE ACTIONS ====================
    /**
     * Load a profile plus its canonical relationship/capability context.
     *
     * @param {string} userId - target user id
     * @param {string} currentUserId - viewer uid
     * @param {Object} [options={}] - { viewAs }
     */
    loadProfile: async (userId, currentUserId, options = {}) => {
      if (!userId) return;

      const requestId = ++_loadSeq;
      const targetId = String(userId);

      set((state) => {
        state.loading = true;
        state.error = null;
        // Only reset stale identity when the target actually changes.
        if (state._activeTargetId && state._activeTargetId !== targetId) {
          state._trackedViewKey = null;
          state.profile = null;
          state.relationship = null;
          state.capabilities = null;
          state.followStatus = null;
          state.mutualFriends = [];
          state.friendRequestStatus = null;
          state.pendingFriendRequestId = null;
        }
      });

      const userService = (await import('../services/userService.js')).getUserService();

      try {
        const isOwner = targetId === String(currentUserId || '');
        const profile = await userService.getUserProfile(targetId, currentUserId, options);

        // Relationship truth (canonical). For owner we synthesize the identity state.
        let relationship = null;
        if (isOwner) {
          relationship = {
            isOwner: true,
            isFollowing: false,
            isFollower: false,
            isMutualFriend: false,
            isBlocking: false,
            isBlockedBy: false,
            isBlocked: false,
            isMuted: false,
            isRestricted: false,
          };
        } else if (currentUserId) {
          relationship = await userService
            .getRelationshipState(currentUserId, targetId)
            .catch(() => null);
        }

        const capabilities = resolveCapabilities({
          viewer: { uid: currentUserId },
          target: profile,
          relationship: relationship || {},
          viewAs: options.viewAs || null,
        });

        // Mutual friends (visitor only) - canonical shape is { mutualFriends }.
        let mutualFriends = [];
        if (!isOwner && currentUserId) {
          const mutualResult = await userService
            .getMutualFriends(currentUserId, targetId)
            .catch(() => null);
          mutualFriends = Array.isArray(mutualResult?.mutualFriends)
            ? mutualResult.mutualFriends.slice(0, 5)
            : [];
        }

        // Level is part of the profile document - never recomputed backwards.
        const level = profile?.level ?? null;

        // Balance + position (owner only) - single canonical fetch each.
        let balance = null;
        let position = null;
        if (isOwner && capabilities.canViewEconomicStatus) {
          const monetization = (await import('../services/monetizationService.js')).getMonetizationService();
          const balanceResult = await monetization.getBalance(targetId).catch(() => null);
          balance = balanceResult === null ? null : Number(balanceResult);
          position = await monetization
            .getUserPosition(targetId, profile?.gender)
            .catch(() => null);
        }

        // Drop the response if a newer request superseded this one.
        if (get()._activeRequestId > requestId) return;

        set((state) => {
          state.profile = profile || null;
          state.loading = false;
          state.error = null;
          state.isOwner = isOwner;
          state._activeRequestId = requestId;
          state._activeTargetId = targetId;
          state.relationship = relationship;
          state.capabilities = capabilities;
          state.resolvedTargetId = profile?.id || profile?.uid || targetId;
          state.followStatus = isOwner ? null : { isFollowing: Boolean(relationship?.isFollowing) };
          state.mutualFriends = mutualFriends;
          state.level = level;
          if (isOwner && capabilities.canViewEconomicStatus) {
            state.balance = balance;
            state.position = position;
          }
        });

        // Profile-view analytics: exactly once per viewer-target view, through
        // the canonical service. A refresh / re-render of the same view must not
        // double-count, and the owner viewing their own profile is never counted.
        const viewKey = `${currentUserId}:${targetId}`;
        if (!isOwner && currentUserId && get()._trackedViewKey !== viewKey) {
          set((state) => {
            state._trackedViewKey = viewKey;
          });
          const analyticsService = (await import('../services/analyticsService.js')).getAnalyticsService();
          analyticsService.trackProfileView(currentUserId, targetId).catch(() => {});
        }
      } catch (error) {
        if (get()._activeRequestId > requestId) return;
        set((state) => {
          state.loading = false;
          state.error = error?.message || 'Failed to load profile';
          state._activeRequestId = requestId;
          state._activeTargetId = targetId;
        });
      }
    },

    /**
     * True when `userId` is still the active target (or no target resolved yet).
     *
     * Domain summary loaders are often fired in parallel for the same target;
     * a slow response for a previous target must never overwrite newer state.
     */
    _isCurrentTarget: (userId) => {
      const active = get()._activeTargetId;
      return !active || active === String(userId);
    },

    /**
     * Refresh the current target.
     */
    refreshProfile: async (userId, currentUserId, options = {}) => {
      set((state) => {
        state.refreshKey += 1;
      });
      await get().loadProfile(userId, currentUserId, options);
    },

    /**
     * Persist a profile update through the canonical service (no fabrication).
     */
    updateProfile: async (userId, updates) => {
      if (!userId || !updates) return;
      const userService = (await import('../services/userService.js')).getUserService();
      await userService.updateUserProfile(userId, updates);
      await get().loadProfile(userId, userId);
    },

    /**
     * Upload avatar through the canonical service and refresh the document.
     */
    updateAvatar: async (userId, file) => {
      if (!userId || !file) return null;
      const userService = (await import('../services/userService.js')).getUserService();
      const uploadResult = await userService.uploadAvatar(userId, file);
      const newPhotoURL = uploadResult?.downloadURL || uploadResult?.photoURL || uploadResult?.url || uploadResult;
      if (newPhotoURL) {
        set((state) => {
          if (state.profile) state.profile.photoURL = newPhotoURL;
        });
      }
      return newPhotoURL;
    },

    // ==================== DIGITAL-NATION SUMMARIES ====================
    loadAchievements: async (userId) => {
      if (!userId) return;
      const svc = (await import('../services/achievementService.js')).default;
      if (typeof svc?.getUserAchievements !== 'function') return;
      const achievements = await svc.getUserAchievements(userId).catch(() => []);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.achievements = Array.isArray(achievements) ? achievements : [];
      });
    },

    loadTitles: async (userId) => {
      if (!userId) return;
      const svc = (await import('../services/titleService.js')).default;
      if (typeof svc?.getUserTitles !== 'function') return;
      const titles = await svc.getUserTitles(userId).catch(() => []);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.titles = Array.isArray(titles) ? titles : [];
      });
    },

    loadBadges: async (userId) => {
      if (!userId) return;
      const svc = (await import('../services/rankingService.js')).getRankingService();
      if (typeof svc?.getUserBadges !== 'function') return;
      const badges = await svc.getUserBadges(userId).catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.badges = badges || null;
      });
    },

    loadReputation: async (userId, fallbackData = null, options = {}) => {
      if (!userId) return;
      // Fail-closed: reputation is a trust/standing summary and is only loaded
      // when the capability engine authorizes the achievements surface.
      const isOwner = options.isOwner ?? get().isOwner;
      const capabilities = options.capabilities ?? get().capabilities;
      if (!isOwner && capabilities?.canViewAchievements !== true) return;
      const svc = (await import('../services/reputationService.js')).default;
      if (typeof svc?.getReputationProfile !== 'function') return;
      const reputation = await svc
        .getReputationProfile(userId, fallbackData)
        .catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.reputation = reputation || null;
      });
    },

    loadRank: async (userId, category = 'engagement') => {
      if (!userId) return;
      const svc = (await import('../services/rankingService.js')).getRankingService();
      if (typeof svc?.getCreatorRank !== 'function') return;
      const rank = await svc.getCreatorRank(userId, category).catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.rank = rank || null;
      });
    },

    loadCreatorProfile: async (userId) => {
      if (!userId) return;
      const svc = (await import('../services/creatorService.js')).default;
      if (typeof svc?.getCreatorProfile !== 'function') return;
      const creatorProfile = await svc.getCreatorProfile(userId).catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.creatorProfile = creatorProfile || null;
      });
    },

    loadPassport: async (userId, viewerUserId, cachedProfile = null) => {
      if (!userId) return;
      const svc = (await import('../services/passportService.js')).default;
      if (typeof svc?.getPassport !== 'function') return;
      const passport = await svc
        .getPassport(userId, viewerUserId, cachedProfile)
        .catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.passport = passport || null;
      });
    },

    loadWallet: async (userId) => {
      if (!userId) return;
      // Fail-closed: economy requires explicit authorization.
      const { isOwner, capabilities } = get();
      if (!isOwner && !capabilities?.canViewEconomicStatus) return;
      const svc = (await import('../services/walletService.js')).default;
      if (typeof svc?.getWalletOverview !== 'function') return;
      const wallet = await svc.getWalletOverview(userId).catch(() => null);
      if (!get()._isCurrentTarget(userId)) return;
      set((state) => {
        state.wallet = wallet || null;
      });
    },

    /**
     * Load the digital-nation summary surfaces for a target in one pass.
     *
     * Each domain is loaded only when the resolved capabilities authorize the
     * surface (fail-closed). Reputation is always loaded because the metrics
     * strip reports trust standing for both owner and visitor.
     *
     * @param {string} userId - target uid
     * @param {string} viewerId - viewer uid
     * @param {Object} [options]
     * @param {boolean} [options.isOwner]
     * @param {Object}  [options.capabilities]
     * @param {Object}  [options.profile] - resolved profile (for passport cache)
     */
    loadInstitutionalSummaries: async (userId, viewerId, options = {}) => {
      if (!userId) return;
      if (!get()._isCurrentTarget(userId)) return;
      const isOwner = options.isOwner ?? get().isOwner;
      const capabilities = options.capabilities || get().capabilities || {};
      const profile = options.profile || get().profile || null;

      const tasks = [
        get().loadReputation(userId, profile, { isOwner, capabilities }),
      ];

      if (isOwner || capabilities.canViewTitles) {
        tasks.push(get().loadTitles(userId));
      }
      if (isOwner || capabilities.canViewAchievements) {
        tasks.push(get().loadAchievements(userId));
      }
      if (isOwner) {
        tasks.push(get().loadBadges(userId));
        tasks.push(get().loadRank(userId));
        tasks.push(get().loadCreatorProfile(userId));
        tasks.push(get().loadPassport(userId, viewerId, profile));
        tasks.push(get().loadWallet(userId));
      } else if (capabilities.canViewProfile) {
        tasks.push(get().loadCreatorProfile(userId));
        // Earned badges are achievement-adjacent: visitor-visible only when the
        // capability engine admits the achievements surface (fail-closed).
        if (capabilities.canViewAchievements) {
          tasks.push(get().loadBadges(userId));
        }
      }

      await Promise.allSettled(tasks);
    },

    // ==================== POSTS ACTIONS ====================
    loadPosts: async (userId, options = {}) => {
      if (!userId) return;

      const targetId = String(userId);
      const requestId = ++_postSeq;
      set((state) => {
        state.postsLoading = true;
        state.postsError = null;
      });

      try {
        const firestoreService = (await import('../services/firestoreService.js')).firestoreService;
        const result = await firestoreService.getPostsByUser(targetId, {
          limit: options.limit || 12,
          ...options,
        });

        // Drop if the active target changed or a newer posts request superseded this one.
        if (get()._activeTargetId && get()._activeTargetId !== targetId) return;
        if (get()._postsRequestId > requestId) return;

        set((state) => {
          state.posts = result?.posts || [];
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
          state._postsRequestId = requestId;
        });
      } catch (error) {
        if (get()._postsRequestId > requestId) return;
        set((state) => {
          state.postsLoading = false;
          state.postsError = error.message || 'Failed to load posts';
          state._postsRequestId = requestId;
        });
      }
    },

    loadMorePosts: async (userId) => {
      const { postsCursor, postsHasMore, postsLoading } = get();
      if (!postsHasMore || postsLoading || !postsCursor) return;

      const targetId = String(userId);
      const requestId = ++_postSeq;

      set((state) => {
        state.postsLoading = true;
      });

      try {
        const firestoreService = (await import('../services/firestoreService.js')).firestoreService;
        // firestoreService.getPostsByUser expects a cursor DOC ID via `startAfter`.
        const result = await firestoreService.getPostsByUser(userId, {
          limit: 12,
          startAfter: postsCursor,
        });

        if (get()._activeTargetId && get()._activeTargetId !== targetId) return;
        if (get()._postsRequestId > requestId) return;

        set((state) => {
          const known = new Set(state.posts.map((p) => p.id));
          const next = (result?.posts || []).filter((p) => p && !known.has(p.id));
          state.posts = [...state.posts, ...next];
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
          state._postsRequestId = requestId;
        });
      } catch (error) {
        if (get()._postsRequestId > requestId) return;
        set((state) => {
          state.postsLoading = false;
          state.postsError = error.message || 'Failed to load more posts';
          state._postsRequestId = requestId;
        });
      }
    },

    // ==================== HIGHLIGHTS / STORIES ACTIONS ====================
    /**
     * Load a target's canonical Story highlights *and* active stories in one
     * coordinated pass. Both come from the canonical `storyService`; the store
     * owns the surface state so components never fetch the same Profile data
     * independently.
     */
    loadHighlights: async (userId) => {
      if (!userId) return;

      const targetId = String(userId);
      const requestId = ++_highlightsSeq;
      set((state) => {
        state.highlightsLoading = true;
        state.highlightsError = null;
      });

      try {
        const storyService = (await import('../services/storyService.js')).getStoryService();
        const [highlightRes, stories] = await Promise.all([
          storyService.getHighlights(userId).catch(() => null),
          storyService.getUserStories(userId).catch(() => []),
        ]);
        // Accept only a response that is still the active target and the newest
        // request; anything else must not overwrite newer state.
        if (get()._activeTargetId && get()._activeTargetId !== targetId) return;
        if (get()._highlightsRequestId > requestId) return;
        const highlights = Array.isArray(highlightRes)
          ? highlightRes
          : (highlightRes?.highlights || []);
        set((state) => {
          state.highlights = Array.isArray(highlights) ? highlights : [];
          state.stories = Array.isArray(stories) ? stories : [];
          state.highlightsLoading = false;
          state._highlightsRequestId = requestId;
        });
      } catch (error) {
        if (get()._highlightsRequestId > requestId) return;
        set((state) => {
          state.highlightsLoading = false;
          state.highlightsError = error?.message || 'Failed to load stories';
          state._highlightsRequestId = requestId;
        });
      }
    },

    /**
     * Load the target's canonical video content (Sparks live in the video
     * domain: `/sparks` is an alias of the video experience). No Spark data is
     * fabricated - if the canonical domain returns nothing, the tab is honestly
     * empty.
     */
    loadVideos: async (userId) => {
      if (!userId) return;

      const targetId = String(userId);
      const requestId = ++_videosSeq;
      set((state) => {
        state.videosLoading = true;
        state.videosError = null;
      });

      try {
        const videoService = (await import('../services/videoService.js')).getVideoService();
        const res = await videoService.getVideosByUser(userId, { limit: 24 });
        if (get()._activeTargetId && get()._activeTargetId !== targetId) return;
        if (get()._videosRequestId > requestId) return;
        const videos = Array.isArray(res?.videos) ? res.videos : [];
        set((state) => {
          state.videos = videos;
          state.videosLoading = false;
          state._videosRequestId = requestId;
        });
      } catch (error) {
        if (get()._videosRequestId > requestId) return;
        set((state) => {
          state.videosLoading = false;
          state.videosError = error?.message || 'Failed to load Sparks';
          state._videosRequestId = requestId;
        });
      }
    },

    loadSavedPosts: async (userId) => {
      if (!userId) return;
      const requestId = ++_savedSeq;
      set((state) => {
        state.savedLoading = true;
      });
      try {
        const { getFirestoreService } = await import('../services/firestoreService.js');
        const res = await getFirestoreService().getSavedPosts(userId);
        const posts = Array.isArray(res) ? res : res?.posts || [];
        if (get()._savedRequestId > requestId) return;
        set((state) => {
          state.savedPosts = posts;
          state.savedLoading = false;
          state._savedRequestId = requestId;
        });
      } catch (error) {
        if (get()._savedRequestId > requestId) return;
        set((state) => {
          state.savedLoading = false;
          state._savedRequestId = requestId;
        });
      }
    },

    // ==================== FRIEND-REQUEST / BLOCK ACTIONS ====================
    /**
     * Resolve the visitor's friendship state toward a target.
     *
     * The friend-request domain is a distinct canonical service
     * (userService), so the store owns the *surface* state while the service
     * owns the mutation. Reads are gated on the capability engine admitting
     * the target; owner/self targets resolve to 'none' without a query.
     *
     * @param {string} viewerId
     * @param {string} targetId
     * @param {Object} [options]
     * @param {Object} [options.relationship] - resolved relationship state
     * @param {Object} [options.capabilities]
     */
    loadFriendRequestStatus: async (viewerId, targetId, options = {}) => {
      if (!viewerId || !targetId || String(viewerId) === String(targetId)) return;
      const relationship = options.relationship ?? get().relationship;
      const capabilities = options.capabilities ?? get().capabilities;

      // Owner target: no friend-request surface.
      if (relationship?.isOwner) {
        set((state) => { state.friendRequestStatus = null; state.pendingFriendRequestId = null; });
        return;
      }
      // Fail-closed: never query the friend-request domain for a target the
      // capability engine does not admit.
      if (capabilities && capabilities.canViewProfile !== true) return;

      const requestId = ++_friendReqSeq;
      const targetKey = String(targetId);
      const userService = (await import('../services/userService.js')).getUserService();

      try {
        if (relationship?.isMutualFriend) {
          if (get()._activeTargetId && get()._activeTargetId !== targetKey) return;
          if (get()._friendReqRequestId > requestId) return;
          set((state) => {
            state.friendRequestStatus = 'friends';
            state.pendingFriendRequestId = null;
            state._friendReqRequestId = requestId;
          });
          return;
        }

        const sent = await userService
          .getFriendRequests(viewerId, 'sent')
          .catch(() => ({ requests: [] }));
        const sentReq = sent.requests?.find((r) => r.toUserId === targetKey);
        let nextStatus = 'none';
        let nextId = null;
        if (sentReq) {
          nextStatus = 'pending';
          nextId = sentReq.id;
        } else {
          const received = await userService
            .getFriendRequests(viewerId, 'received')
            .catch(() => ({ requests: [] }));
          const recReq = received.requests?.find((r) => r.fromUserId === targetKey);
          if (recReq) {
            nextStatus = 'received';
            nextId = recReq.id;
          }
        }

        if (get()._activeTargetId && get()._activeTargetId !== targetKey) return;
        if (get()._friendReqRequestId > requestId) return;
        set((state) => {
          state.friendRequestStatus = nextStatus;
          state.pendingFriendRequestId = nextId;
          state._friendReqRequestId = requestId;
        });
      } catch {
        if (get()._friendReqRequestId > requestId) return;
        set((state) => {
          state.friendRequestStatus = 'none';
          state.pendingFriendRequestId = null;
          state._friendReqRequestId = requestId;
        });
      }
    },

    /**
     * Send a friend request (canonical mutation) and reconcile surface state.
     * Returns the canonical service result for the caller's toast copy.
     */
    sendFriendRequest: async (viewerId, targetId) => {
      if (!viewerId || !targetId) return null;
      const userService = (await import('../services/userService.js')).getUserService();
      set((state) => { state.friendRequestLoading = true; });
      try {
        const res = await userService.sendFriendRequest(viewerId, targetId);
        set((state) => {
          state.friendRequestLoading = false;
          // `alreadyFriends` is authoritative server truth - never fake 'pending'.
          state.friendRequestStatus = res?.alreadyFriends ? 'friends' : 'pending';
        });
        return res;
      } catch (error) {
        set((state) => { state.friendRequestLoading = false; });
        throw error;
      }
    },

    /**
     * Accept a received friend request (canonical mutation) and reconcile.
     */
    acceptFriendRequest: async (requestId, viewerId) => {
      if (!requestId || !viewerId) return null;
      const userService = (await import('../services/userService.js')).getUserService();
      set((state) => { state.friendRequestLoading = true; });
      try {
        const res = await userService.acceptFriendRequest(requestId, viewerId);
        set((state) => {
          state.friendRequestLoading = false;
          state.friendRequestStatus = 'friends';
          state.pendingFriendRequestId = null;
        });
        return res;
      } catch (error) {
        set((state) => { state.friendRequestLoading = false; });
        throw error;
      }
    },

    /**
     * Unblock a target (canonical mutation) then refresh the relationship.
     */
    unblockUser: async (viewerId, targetId) => {
      if (!viewerId || !targetId) return null;
      const userService = (await import('../services/userService.js')).getUserService();
      const res = await userService.unblockUser(viewerId, targetId);
      await get().loadProfile(targetId, viewerId);
      return res;
    },

    // ==================== FOLLOW ACTIONS ====================
    loadFollowStatus: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      const userService = (await import('../services/userService.js')).getUserService();
      const followStatus = await userService.getFollowStatus(followerId, followingId).catch(() => null);
      set((state) => {
        state.followStatus = followStatus;
      });
    },

    loadMutualFriends: async (userId, otherUserId) => {
      if (!userId || !otherUserId) return;
      set((state) => {
        state.mutualFriendsLoading = true;
      });
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const result = await userService.getMutualFriends(userId, otherUserId);
        set((state) => {
          state.mutualFriends = Array.isArray(result?.mutualFriends)
            ? result.mutualFriends.slice(0, 5)
            : [];
          state.mutualFriendsLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.mutualFriendsLoading = false;
        });
      }
    },

    /**
     * Follow a user. Optimistic UI, then reconcile with server truth.
     */
    follow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      const targetId = String(followingId);
      const requestId = ++_followSeq;
      const previousFollowStatus = get().followStatus;
      const previousFollowerCount = get().profile?.followerCount ?? null;

      set((state) => {
        state._followRequestId = requestId;
        state.followLoading = true;
        if (state.followStatus) state.followStatus.isFollowing = true;
        if (state.profile && typeof state.profile.followerCount === 'number') {
          state.profile.followerCount = state.profile.followerCount + 1;
        }
      });

      const userService = (await import('../services/userService.js')).getUserService();
      try {
        await userService.followUser(followerId, followingId);
        // Only the newest follow mutation may reconcile; an older response must
        // never overwrite the outcome of a later follow/unfollow.
        if (get()._followRequestId !== requestId) return;
        // Reconcile with authoritative server state for the SAME target only.
        if (get()._activeTargetId === targetId) {
          const [status, fresh] = await Promise.all([
            userService.getFollowStatus(followerId, targetId).catch(() => null),
            userService.getUserProfile(targetId, followerId).catch(() => null),
          ]);
          if (get()._followRequestId !== requestId) return;
          set((state) => {
            state.followLoading = false;
            if (status) state.followStatus = status;
            else if (state.followStatus) state.followStatus.isFollowing = true;
            if (fresh) state.profile = { ...state.profile, ...fresh };
          });
        } else {
          set((state) => {
            state.followLoading = false;
          });
        }
        toast.success('Following!');
      } catch (error) {
        if (get()._followRequestId !== requestId) return;
        set((state) => {
          state.followLoading = false;
          state.followStatus = previousFollowStatus;
          if (state.profile && previousFollowerCount !== null) {
            state.profile.followerCount = previousFollowerCount;
          }
        });
        toast.error('Failed to follow user');
        throw error;
      }
    },

    /**
     * Unfollow a user. Optimistic UI, then reconcile with server truth.
     */
    unfollow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      const targetId = String(followingId);
      const requestId = ++_followSeq;
      const previousFollowStatus = get().followStatus;
      const previousFollowerCount = get().profile?.followerCount ?? null;

      set((state) => {
        state._followRequestId = requestId;
        state.followLoading = true;
        if (state.followStatus) state.followStatus.isFollowing = false;
        if (state.profile && typeof state.profile.followerCount === 'number') {
          state.profile.followerCount = Math.max(0, state.profile.followerCount - 1);
        }
      });

      const userService = (await import('../services/userService.js')).getUserService();
      try {
        await userService.unfollowUser(followerId, followingId);
        if (get()._followRequestId !== requestId) return;
        if (get()._activeTargetId === targetId) {
          const [status, fresh] = await Promise.all([
            userService.getFollowStatus(followerId, targetId).catch(() => null),
            userService.getUserProfile(targetId, followerId).catch(() => null),
          ]);
          if (get()._followRequestId !== requestId) return;
          set((state) => {
            state.followLoading = false;
            if (status) state.followStatus = status;
            else if (state.followStatus) state.followStatus.isFollowing = false;
            if (fresh) state.profile = { ...state.profile, ...fresh };
          });
        } else {
          set((state) => {
            state.followLoading = false;
          });
        }
        toast.success('Unfollowed');
      } catch (error) {
        if (get()._followRequestId !== requestId) return;
        set((state) => {
          state.followLoading = false;
          state.followStatus = previousFollowStatus;
          if (state.profile && previousFollowerCount !== null) {
            state.profile.followerCount = previousFollowerCount;
          }
        });
        toast.error('Failed to unfollow user');
        throw error;
      }
    },

    updateFollowStatus: (followerId, followingId, isFollowing) => {
      set((state) => {
        const wasFollowing = state.followStatus?.isFollowing;
        state.followStatus = {
          ...state.followStatus,
          isFollowing,
        };
        // Local mirror only: adjust the count when the flag actually changed.
        if (state.profile && typeof state.profile.followerCount === 'number' && wasFollowing !== isFollowing) {
          state.profile.followerCount = isFollowing
            ? state.profile.followerCount + 1
            : Math.max(0, state.profile.followerCount - 1);
        }
      });
    },

    // ==================== UI ACTIONS ====================
    setActiveTab: (tab) => {
      set((state) => {
        state.activeTab = tab;
      });
    },

    // ==================== RESET ACTIONS ====================
    clear: () => {
      set((state) => {
        Object.assign(state, initialState);
        // Keep outstanding-request invalidation so an in-flight response from
        // before the purge cannot repopulate the store.
        Object.assign(state, invalidateAllRequests());
      });
    },

    reset: () => {
      set(() => ({ ...initialState, ...invalidateAllRequests() }));
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
export const selectCapabilities = (state) => state.capabilities;
export const selectFriendRequestStatus = (state) => state.friendRequestStatus;
export const selectFriendRequestLoading = (state) => state.friendRequestLoading;

export default useProfileStore;
