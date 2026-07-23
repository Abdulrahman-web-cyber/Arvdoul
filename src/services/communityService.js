// src/services/communityService.js - ARVDOUL COMMUNITY SERVICE
// ✅ Complete CRUD for communities
// ✅ Membership management
// ✅ Role-based permissions
// ✅ Moderation features

import { getFirestoreInstance } from '../firebase/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';

const COMMUNITIES_PER_PAGE = 20;

class CommunityService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.db = getFirestoreInstance();
    this.initialized = true;
  }

  // ========== COMMUNITY CRUD ==========

  /**
   * Create a new community
   * @param {string} userId - Creator's user ID
   * @param {Object} data - Community data
   * @returns {Promise<Object>} Created community
   */
  async createCommunity(userId, data) {
    await this.initialize();
    
    const communityId = doc(collection(this.db, 'communities')).id;
    const communityData = {
      id: communityId,
      name: data.name,
      description: data.description || '',
      rules: data.rules || '',
      avatar: data.avatar || '',
      cover: data.cover || '',
      privacy: data.privacy || 'public', // public, private, secret
      members: {
        [userId]: {
          role: 'owner',
          joinedAt: serverTimestamp(),
          permissions: ['all']
        }
      },
      spaces: [
        { name: 'General', type: 'discussion', description: 'General discussion', isDefault: true },
        { name: 'Announcements', type: 'announcements', description: 'Official announcements', isDefault: true }
      ],
      channels: [
        { name: 'general', description: 'General chat', isDefault: true }
      ],
      stats: {
        memberCount: 1,
        postCount: 0,
        eventCount: 0,
        activityScore: 100
      },
      moderation: {
        slowMode: false,
        slowModeDelay: 0,
        contentApproval: false,
        bannedUsers: []
      },
      settings: {
        defaultRole: 'member',
        joinApproval: false,
        inviteOnly: false,
        discoveryEnabled: true
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      isDeleted: false
    };

    await setDoc(doc(this.db, 'communities', communityId), communityData);
    
    // Update user's community count
    await updateDoc(doc(this.db, 'users', userId), {
      communityCount: increment(1),
      updatedAt: serverTimestamp()
    });

    return { id: communityId, ...communityData };
  }

  /**
   * Get a community by ID
   * @param {string} communityId - Community ID
   * @returns {Promise<Object|null>} Community data or null
   */
  async getCommunity(communityId) {
    await this.initialize();
    const snap = await getDoc(doc(this.db, 'communities', communityId));
    
    if (!snap.exists || snap.data().isDeleted) {
      return null;
    }
    
    return { id: snap.id, ...snap.data() };
  }

  /**
   * Get community with access check
   * @param {string} communityId - Community ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Community data or null
   */
  async getCommunityWithAccess(communityId, userId) {
    const community = await this.getCommunity(communityId);
    
    if (!community) return null;
    
    // Public communities are accessible to all
    if (community.privacy === 'public') {
      return community;
    }
    
    // Private/Secret communities require membership
    if (community.members && community.members[userId]) {
      return community;
    }
    
    return null;
  }

  /**
   * Update a community
   * @param {string} communityId - Community ID
   * @param {Object} data - Update data
   * @param {string} userId - User making the update
   * @returns {Promise<boolean>} Success status
   */
  async updateCommunity(communityId, data, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    // Check permissions
    const membership = community.members?.[userId];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    const allowedFields = ['name', 'description', 'rules', 'avatar', 'cover', 'privacy', 'settings'];
    const updateData = { updatedAt: serverTimestamp() };
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    await updateDoc(doc(this.db, 'communities', communityId), updateData);
    return true;
  }

  /**
   * Delete a community (soft delete)
   * @param {string} communityId - Community ID
   * @param {string} userId - User making the deletion
   * @returns {Promise<boolean>} Success status
   */
  async deleteCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    // Only owner can delete
    if (community.createdBy !== userId) {
      throw new Error('Only the owner can delete this community');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update creator's count
    await updateDoc(doc(this.db, 'users', userId), {
      communityCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    return true;
  }

  // ========== LISTING & SEARCH ==========

  /**
   * List public communities
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of communities
   */
  async listCommunities(options = {}) {
    await this.initialize();
    
    const {
      page = 1,
      sortBy = 'popular',
      filter = 'all',
      searchQuery = '',
      category = null
    } = options;

    let q = collection(this.db, 'communities');
    const constraints = [
      where('isDeleted', '==', false),
      where('discoveryEnabled', '==', true)
    ];

    if (filter !== 'all') {
      constraints.push(where('privacy', '==', filter));
    }

    if (sortBy === 'popular') {
      constraints.push(orderBy('stats.memberCount', 'desc'));
    } else if (sortBy === 'newest') {
      constraints.push(orderBy('createdAt', 'desc'));
    } else if (sortBy === 'active') {
      constraints.push(orderBy('stats.activityScore', 'desc'));
    }

    constraints.push(limit(COMMUNITIES_PER_PAGE));

    if (page > 1) {
      const startAfter = (page - 1) * COMMUNITIES_PER_PAGE;
      constraints.push(startAfter);
    }

    const querySnapshot = await getDocs(query(q, ...constraints));
    
    let communities = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Client-side search filter if needed
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      communities = communities.filter(c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return {
      communities,
      hasMore: communities.length === COMMUNITIES_PER_PAGE,
      page
    };
  }

  /**
   * Search communities
   * @param {string} searchQuery - Search query
   * @param {number} limitNum - Max results
   * @returns {Promise<Array>} Matching communities
   */
  async searchCommunities(searchQuery, limitNum = 10) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'communities'),
      where('isDeleted', '==', false),
      where('discoveryEnabled', '==', true),
      orderBy('stats.memberCount', 'desc'),
      limit(limitNum * 2) // Fetch more for filtering
    );

    const snapshot = await getDocs(q);
    const lowerQuery = searchQuery.toLowerCase();
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limitNum);
  }

  // ========== MEMBERSHIP MANAGEMENT ==========

  /**
   * Join a community
   * @param {string} communityId - Community ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated community
   */
  async joinCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    // Check if already a member
    if (community.members?.[userId]) {
      throw new Error('Already a member');
    }

    // Check privacy
    if (community.privacy === 'secret') {
      throw new Error('Cannot join secret community');
    }

    const updateData = {
      [`members.${userId}`]: {
        role: community.settings?.defaultRole || 'member',
        joinedAt: serverTimestamp(),
        permissions: []
      },
      'stats.memberCount': increment(1),
      updatedAt: serverTimestamp()
    };

    // If join approval is required, mark as pending
    if (community.settings?.joinApproval) {
      updateData[`pendingRequests.${userId}`] = {
        requestedAt: serverTimestamp()
      };
    }

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    // Update user's joined communities
    await updateDoc(doc(this.db, 'users', userId), {
      joinedCommunities: arrayUnion(communityId),
      updatedAt: serverTimestamp()
    });

    return { success: true, requiresApproval: community.settings?.joinApproval };
  }

  /**
   * Leave a community
   * @param {string} communityId - Community ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async leaveCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[userId];
    if (!membership) {
      throw new Error('Not a member');
    }

    // Owner cannot leave (must delete or transfer ownership)
    if (membership.role === 'owner') {
      throw new Error('Owner cannot leave. Transfer ownership or delete the community.');
    }

    const updateData = {
      [`members.${userId}`]: null,
      'stats.memberCount': increment(-1),
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    // Update user's joined communities
    await updateDoc(doc(this.db, 'users', userId), {
      joinedCommunities: arrayRemove(communityId),
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Request to join a community (for private communities)
   * @param {string} communityId - Community ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async requestToJoin(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    if (community.privacy !== 'private') {
      throw new Error('This community does not require approval');
    }

    if (community.members?.[userId]) {
      throw new Error('Already a member');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      [`pendingRequests.${userId}`]: {
        requestedAt: serverTimestamp(),
        status: 'pending'
      },
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Approve a join request
   * @param {string} communityId - Community ID
   * @param {string} requesterId - User who requested
   * @param {string} approverId - User approving
   * @returns {Promise<boolean>} Success status
   */
  async approveJoinRequest(communityId, requesterId, approverId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[approverId];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    const updateData = {
      [`members.${requesterId}`]: {
        role: community.settings?.defaultRole || 'member',
        joinedAt: serverTimestamp(),
        permissions: []
      },
      [`pendingRequests.${requesterId}`]: null,
      'stats.memberCount': increment(1),
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    // Update requester's joined communities
    await updateDoc(doc(this.db, 'users', requesterId), {
      joinedCommunities: arrayUnion(communityId),
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Reject a join request
   * @param {string} communityId - Community ID
   * @param {string} requesterId - User who requested
   * @param {string} rejecterId - User rejecting
   * @returns {Promise<boolean>} Success status
   */
  async rejectJoinRequest(communityId, requesterId, rejecterId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[rejecterId];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      [`pendingRequests.${requesterId}`]: null,
      updatedAt: serverTimestamp()
    });

    return true;
  }

  // ========== ROLE MANAGEMENT ==========

  /**
   * Assign a role to a member
   * @param {string} communityId - Community ID
   * @param {string} targetUserId - User to update
   * @param {string} role - New role
   * @param {string} adminUserId - Admin performing the action
   * @returns {Promise<boolean>} Success status
   */
  async assignRole(communityId, targetUserId, role, adminUserId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const adminMembership = community.members?.[adminUserId];
    if (!adminMembership || !['owner', 'admin'].includes(adminMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    const validRoles = ['owner', 'admin', 'moderator', 'contributor', 'member', 'restricted'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    // Cannot modify owner's role
    if (community.members?.[targetUserId]?.role === 'owner') {
      throw new Error('Cannot modify owner role');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      [`members.${targetUserId}.role`]: role,
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Update member permissions
   * @param {string} communityId - Community ID
   * @param {string} targetUserId - User to update
   * @param {Array} permissions - New permissions
   * @param {string} adminUserId - Admin performing the action
   * @returns {Promise<boolean>} Success status
   */
  async updateMemberPermissions(communityId, targetUserId, permissions, adminUserId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const adminMembership = community.members?.[adminUserId];
    if (!adminMembership || !['owner', 'admin'].includes(adminMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      [`members.${targetUserId}.permissions`]: permissions,
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Get user's communities
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of communities
   */
  async getUserCommunities(userId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'communities'),
      where(`members.${userId}.role`, 'in', ['owner', 'admin', 'moderator', 'contributor', 'member']),
      where('isDeleted', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get user's managed communities (where they have elevated roles)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of communities
   */
  async getUserManagedCommunities(userId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'communities'),
      where(`members.${userId}.role`, 'in', ['owner', 'admin', 'moderator']),
      where('isDeleted', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== MODERATION ==========

  /**
   * Ban a user from community
   * @param {string} communityId - Community ID
   * @param {string} targetUserId - User to ban
   * @param {string} moderatorId - Moderator performing the action
   * @param {string} reason - Ban reason
   * @returns {Promise<boolean>} Success status
   */
  async banUser(communityId, targetUserId, moderatorId, reason = '') {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin', 'moderator'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    // Cannot ban owner
    if (community.members?.[targetUserId]?.role === 'owner') {
      throw new Error('Cannot ban the owner');
    }

    const updateData = {
      [`members.${targetUserId}`]: null,
      moderation: {
        ...community.moderation,
        bannedUsers: arrayUnion(targetUserId)
      },
      'stats.memberCount': increment(-1),
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    // Log moderation action
    await this.logModerationAction(communityId, moderatorId, 'ban', targetUserId, reason);

    return true;
  }

  /**
   * Unban a user from community
   * @param {string} communityId - Community ID
   * @param {string} targetUserId - User to unban
   * @param {string} moderatorId - Moderator performing the action
   * @returns {Promise<boolean>} Success status
   */
  async unbanUser(communityId, targetUserId, moderatorId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin', 'moderator'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      moderation: {
        ...community.moderation,
        bannedUsers: arrayRemove(targetUserId)
      },
      updatedAt: serverTimestamp()
    });

    await this.logModerationAction(communityId, moderatorId, 'unban', targetUserId);

    return true;
  }

  /**
   * Enable slow mode
   * @param {string} communityId - Community ID
   * @param {number} delay - Delay in seconds
   * @param {string} moderatorId - Moderator performing the action
   * @returns {Promise<boolean>} Success status
   */
  async enableSlowMode(communityId, delay, moderatorId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin', 'moderator'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      moderation: {
        ...community.moderation,
        slowMode: true,
        slowModeDelay: delay
      },
      updatedAt: serverTimestamp()
    });

    await this.logModerationAction(communityId, moderatorId, 'slow_mode', null, `Enabled slow mode: ${delay}s`);

    return true;
  }

  /**
   * Disable slow mode
   * @param {string} communityId - Community ID
   * @param {string} moderatorId - Moderator performing the action
   * @returns {Promise<boolean>} Success status
   */
  async disableSlowMode(communityId, moderatorId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin', 'moderator'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      moderation: {
        ...community.moderation,
        slowMode: false,
        slowModeDelay: 0
      },
      updatedAt: serverTimestamp()
    });

    await this.logModerationAction(communityId, moderatorId, 'slow_mode_off', null, 'Disabled slow mode');

    return true;
  }

  /**
   * Enable content approval requirement
   * @param {string} communityId - Community ID
   * @param {string} moderatorId - Moderator performing the action
   * @returns {Promise<boolean>} Success status
   */
  async enableContentApproval(communityId, moderatorId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      moderation: {
        ...community.moderation,
        contentApproval: true
      },
      updatedAt: serverTimestamp()
    });

    await this.logModerationAction(communityId, moderatorId, 'content_approval_on', null, 'Enabled content approval');

    return true;
  }

  /**
   * Disable content approval requirement
   * @param {string} communityId - Community ID
   * @param {string} moderatorId - Moderator performing the action
   * @returns {Promise<boolean>} Success status
   */
  async disableContentApproval(communityId, moderatorId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      moderation: {
        ...community.moderation,
        contentApproval: false
      },
      updatedAt: serverTimestamp()
    });

    await this.logModerationAction(communityId, moderatorId, 'content_approval_off', null, 'Disabled content approval');

    return true;
  }

  // ========== SPACES & CHANNELS ==========

  /**
   * Add a space to community
   * @param {string} communityId - Community ID
   * @param {Object} space - Space data
   * @param {string} userId - User performing the action
   * @returns {Promise<boolean>} Success status
   */
  async addSpace(communityId, space, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[userId];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    const spaceId = `space_${Date.now()}`;
    const newSpace = {
      id: spaceId,
      ...space,
      isDefault: false,
      createdAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'communities', communityId), {
      spaces: arrayUnion(newSpace),
      updatedAt: serverTimestamp()
    });

    return { ...newSpace, spaceId };
  }

  /**
   * Remove a space from community
   * @param {string} communityId - Community ID
   * @param {string} spaceId - Space ID
   * @param {string} userId - User performing the action
   * @returns {Promise<boolean>} Success status
   */
  async removeSpace(communityId, spaceId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[userId];
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    const space = community.spaces?.find(s => s.id === spaceId);
    if (space?.isDefault) {
      throw new Error('Cannot remove default spaces');
    }

    const updatedSpaces = community.spaces?.filter(s => s.id !== spaceId) || [];
    
    await updateDoc(doc(this.db, 'communities', communityId), {
      spaces: updatedSpaces,
      updatedAt: serverTimestamp()
    });

    return true;
  }

  // ========== COMMUNITY POSTS ==========

  /**
   * Create a post in community
   * @param {string} communityId - Community ID
   * @param {string} userId - Author user ID
   * @param {Object} postData - Post data
   * @returns {Promise<Object>} Created post
   */
  async createCommunityPost(communityId, userId, postData) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[userId];
    if (!membership) {
      throw new Error('Must be a member to post');
    }

    const postId = doc(collection(this.db, 'posts')).id;
    const post = {
      id: postId,
      authorId: userId,
      communityId,
      content: postData.content,
      type: postData.type || 'text',
      media: postData.media || [],
      visibility: 'community',
      allowComments: postData.allowComments !== false,
      allowSharing: postData.allowSharing !== false,
      stats: {
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        views: 0
      },
      reactions: {
        like: 0,
        love: 0,
        laugh: 0,
        celebrate: 0,
        support: 0,
        insightful: 0
      },
      hashtags: postData.hashtags || [],
      mentions: postData.mentions || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      publishedAt: serverTimestamp(),
      status: community.moderation?.contentApproval ? 'pending' : 'published',
      isDeleted: false
    };

    await setDoc(doc(this.db, 'posts', postId), post);

    // Update community stats
    await updateDoc(doc(this.db, 'communities', communityId), {
      'stats.postCount': increment(1),
      'stats.activityScore': increment(10),
      updatedAt: serverTimestamp()
    });

    return post;
  }

  /**
   * Get community posts
   * @param {string} communityId - Community ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of posts
   */
  async getCommunityPosts(communityId, options = {}) {
    await this.initialize();
    
    const { page = 1, sortBy = 'recent', status = 'published' } = options;
    
    let q = query(
      collection(this.db, 'posts'),
      where('communityId', '==', communityId),
      where('isDeleted', '==', false)
    );

    if (status !== 'all') {
      q = query(q, where('status', '==', status));
    }

    if (sortBy === 'recent') {
      q = query(q, orderBy('createdAt', 'desc'));
    } else if (sortBy === 'popular') {
      q = query(q, orderBy('stats.likes', 'desc'));
    }

    q = query(q, limit(COMMUNITIES_PER_PAGE));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== MODERATION LOGGING ==========

  /**
   * Log a moderation action
   * @param {string} communityId - Community ID
   * @param {string} moderatorId - Moderator user ID
   * @param {string} action - Action type
   * @param {string} targetUserId - Target user ID (optional)
   * @param {string} reason - Reason for action (optional)
   * @returns {Promise<void>}
   */
  async logModerationAction(communityId, moderatorId, action, targetUserId = null, reason = '') {
    await this.initialize();
    
    const logId = doc(collection(this.db, 'moderation_logs')).id;
    await setDoc(doc(this.db, 'moderation_logs', logId), {
      communityId,
      moderatorId,
      action,
      targetUserId,
      reason,
      createdAt: serverTimestamp()
    });
  }

  /**
   * Get moderation logs for community
   * @param {string} communityId - Community ID
   * @param {number} limitNum - Max results
   * @returns {Promise<Array>} List of moderation actions
   */
  async getModerationLogs(communityId, limitNum = 50) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'moderation_logs'),
      where('communityId', '==', communityId),
      orderBy('createdAt', 'desc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== STATISTICS ==========

  /**
   * Get community statistics
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} Statistics
   */
  async getCommunityStats(communityId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');

    // Get recent activity
    const postsQuery = query(
      collection(this.db, 'posts'),
      where('communityId', '==', communityId),
      where('isDeleted', '==', false),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(7)
    );
    const postsSnapshot = await getDocs(postsQuery);

    // Calculate engagement
    let totalEngagement = 0;
    postsSnapshot.docs.forEach(doc => {
      const stats = doc.data().stats || {};
      totalEngagement += (stats.likes || 0) + (stats.comments || 0) * 2 + (stats.shares || 0) * 3;
    });

    return {
      memberCount: community.stats?.memberCount || 0,
      postCount: community.stats?.postCount || 0,
      eventCount: community.stats?.eventCount || 0,
      activityScore: community.stats?.activityScore || 0,
      recentPosts: postsSnapshot.size,
      weeklyEngagement: totalEngagement,
      activeMembers: Object.keys(community.members || {}).length
    };
  }

  // ========== REAL-TIME SUBSCRIPTIONS ==========

  /**
   * Subscribe to community updates
   * @param {string} communityId - Community ID
   * @param {Function} callback - Update callback
   * @returns {Function} Unsubscribe function
   */
  subscribeToCommunity(communityId, callback) {
    return onSnapshot(doc(this.db, 'communities', communityId), (doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  /**
   * Subscribe to community members
   * @param {string} communityId - Community ID
   * @param {Function} callback - Update callback
   * @returns {Function} Unsubscribe function
   */
  subscribeToMembers(communityId, callback) {
    const unsubscribe = onSnapshot(doc(this.db, 'communities', communityId), (doc) => {
      if (doc.exists) {
        const members = doc.data().members || {};
        callback(Object.entries(members).map(([id, data]) => ({ id, ...data })));
      }
    });
    return unsubscribe;
  }

  /**
   * Subscribe to pending join requests
   * @param {string} communityId - Community ID
   * @param {Function} callback - Update callback
   * @returns {Function} Unsubscribe function
   */
  subscribeToPendingRequests(communityId, callback) {
    const unsubscribe = onSnapshot(doc(this.db, 'communities', communityId), (doc) => {
      if (doc.exists) {
        const requests = doc.data().pendingRequests || {};
        callback(Object.entries(requests).map(([id, data]) => ({ id, ...data })));
      }
    });
    return unsubscribe;
  }
}

// Singleton instance
let communityServiceInstance = null;

export function getCommunityService() {
  if (!communityServiceInstance) {
    communityServiceInstance = new CommunityService();
  }
  return communityServiceInstance;
}

export default getCommunityService;
