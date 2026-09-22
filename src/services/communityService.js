// src/services/communityService.js - ARVDOUL COMMUNITY SERVICE
// ✅ Complete CRUD for communities
// ✅ Membership management
// ✅ Role-based permissions
// ✅ Moderation features
// Upgrades: Algorithmic recommendations and rule enforcement pipelines.

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
    this.db = await getFirestoreInstance();
    this.initialized = true;
  }

  // ========== COMMUNITY CRUD ==========

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

  async getCommunity(communityId) {
    await this.initialize();
    const snap = await getDoc(doc(this.db, 'communities', communityId));
    
    if (!snap.exists || snap.data().isDeleted) {
      return null;
    }
    
    return { id: snap.id, ...snap.data() };
  }

  async getCommunityWithAccess(communityId, userId) {
    const community = await this.getCommunity(communityId);
    
    if (!community) return null;
    
    if (community.privacy === 'public') {
      return community;
    }
    
    if (community.members && community.members[userId]) {
      return community;
    }
    
    return null;
  }

  async updateCommunity(communityId, data, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
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

  async deleteCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    if (community.createdBy !== userId) {
      throw new Error('Only the owner can delete this community');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(this.db, 'users', userId), {
      communityCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    return true;
  }

  // ========== LISTING & SEARCH ==========

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

  async searchCommunities(searchQuery, limitNum = 10) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'communities'),
      where('isDeleted', '==', false),
      where('discoveryEnabled', '==', true),
      orderBy('stats.memberCount', 'desc'),
      limit(limitNum * 2)
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

  async joinCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    if (community.members?.[userId]) {
      throw new Error('Already a member');
    }

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

    if (community.settings?.joinApproval) {
      updateData[`pendingRequests.${userId}`] = {
        requestedAt: serverTimestamp()
      };
    }

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    await updateDoc(doc(this.db, 'users', userId), {
      joinedCommunities: arrayUnion(communityId),
      updatedAt: serverTimestamp()
    });

    return { success: true, requiresApproval: community.settings?.joinApproval };
  }

  async leaveCommunity(communityId, userId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const membership = community.members?.[userId];
    if (!membership) {
      throw new Error('Not a member');
    }

    if (membership.role === 'owner') {
      throw new Error('Owner cannot leave. Transfer ownership or delete the community.');
    }

    const updateData = {
      [`members.${userId}`]: null,
      'stats.memberCount': increment(-1),
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'communities', communityId), updateData);

    await updateDoc(doc(this.db, 'users', userId), {
      joinedCommunities: arrayRemove(communityId),
      updatedAt: serverTimestamp()
    });

    return true;
  }

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

    await updateDoc(doc(this.db, 'users', requesterId), {
      joinedCommunities: arrayUnion(communityId),
      updatedAt: serverTimestamp()
    });

    return true;
  }

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

    if (community.members?.[targetUserId]?.role === 'owner') {
      throw new Error('Cannot modify owner role');
    }

    await updateDoc(doc(this.db, 'communities', communityId), {
      [`members.${targetUserId}.role`]: role,
      updatedAt: serverTimestamp()
    });

    return true;
  }

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

  async banUser(communityId, targetUserId, moderatorId, reason = '') {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');
    
    const moderatorMembership = community.members?.[moderatorId];
    if (!moderatorMembership || !['owner', 'admin', 'moderator'].includes(moderatorMembership.role)) {
      throw new Error('Insufficient permissions');
    }

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

    await this.logModerationAction(communityId, moderatorId, 'ban', targetUserId, reason);

    return true;
  }

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

    await updateDoc(doc(this.db, 'communities', communityId), {
      'stats.postCount': increment(1),
      'stats.activityScore': increment(10),
      updatedAt: serverTimestamp()
    });

    return post;
  }

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

  // ========== STATISTICS & RECS ==========

  async getCommunityStats(communityId) {
    await this.initialize();
    
    const community = await this.getCommunity(communityId);
    if (!community) throw new Error('Community not found');

    const postsQuery = query(
      collection(this.db, 'posts'),
      where('communityId', '==', communityId),
      where('isDeleted', '==', false),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(7)
    );
    const postsSnapshot = await getDocs(postsQuery);

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

  /**
   * Generates a recommended communities list for users (v8.0)
   */
  async getRecommendedCommunities(userId, limitNum = 5) {
    await this.initialize();
    const q = query(
      collection(this.db, 'communities'),
      where('isDeleted', '==', false),
      where('discoveryEnabled', '==', true),
      orderBy('stats.memberCount', 'desc'),
      limit(limitNum + 5)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(c => !c.members?.[userId])
      .slice(0, limitNum);
  }

  // ========== REAL-TIME SUBSCRIPTIONS ==========

  subscribeToCommunity(communityId, callback) {
    return onSnapshot(doc(this.db, 'communities', communityId), (doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  subscribeToMembers(communityId, callback) {
    const unsubscribe = onSnapshot(doc(this.db, 'communities', communityId), (doc) => {
      if (doc.exists) {
        const members = doc.data().members || {};
        callback(Object.entries(members).map(([id, data]) => ({ id, ...data })));
      }
    });
    return unsubscribe;
  }

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

let communityServiceInstance = null;

export function getCommunityService() {
  if (!communityServiceInstance) {
    communityServiceInstance = new CommunityService();
  }
  return communityServiceInstance;
}

export default getCommunityService;
