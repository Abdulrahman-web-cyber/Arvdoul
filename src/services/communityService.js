// src/services/communityService.js

import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { callFunction, FUNCTIONS } from './callableService.js';

const COMMUNITIES_PER_PAGE = 20;
// Hard ceiling for any single community read; a per-user membership list is
// bounded so a user in thousands of communities cannot pull them all at once.
const MAX_COMMUNITY_READ = 200;

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

  async createCommunity(userId, data) {
    await this.initialize();
    // Creation writes the members map (privilege data) and the derived
    // counters, so it is server-authoritative.
    const community = await callFunction(FUNCTIONS.CREATE_COMMUNITY, {
      name: data?.name,
      description: data?.description,
      rules: data?.rules,
      avatar: data?.avatar,
      cover: data?.cover,
      privacy: data?.privacy,
      joinApproval: data?.settings?.joinApproval ?? data?.joinApproval,
      inviteOnly: data?.settings?.inviteOnly ?? data?.inviteOnly,
      discoveryEnabled: data?.settings?.discoveryEnabled ?? data?.discoveryEnabled,
    });
    return community;
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
    // The community document is server-write-only; the callable re-checks the
    // caller's role from the members map.
    await callFunction(FUNCTIONS.UPDATE_COMMUNITY_SETTINGS, { communityId, updates: data || {} });
    return true;
  }

  async deleteCommunity(communityId, userId) {
    await this.initialize();
    await callFunction(FUNCTIONS.DELETE_COMMUNITY, { communityId });
    return true;
  }

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

  async joinCommunity(communityId, userId) {
    await this.initialize();
    const result = await callFunction(FUNCTIONS.JOIN_COMMUNITY, { communityId });
    return { success: true, requiresApproval: result?.requiresApproval === true };
  }

  async leaveCommunity(communityId, userId) {
    await this.initialize();
    // `userId` is the member being removed. The server compares it against the
    // authenticated caller: equal means a self-leave, different means a kick
    // (which requires owner/admin, re-checked server-side).
    await callFunction(FUNCTIONS.LEAVE_COMMUNITY, { communityId, targetUserId: userId });
    return true;
  }

  async requestToJoin(communityId, userId) {
    await this.initialize();
    await callFunction(FUNCTIONS.REQUEST_TO_JOIN, { communityId });
    return true;
  }

  async approveJoinRequest(communityId, requesterId, approverId) {
    await this.initialize();
    await callFunction(FUNCTIONS.APPROVE_JOIN_REQUEST, { communityId, requesterId });
    return true;
  }

  async rejectJoinRequest(communityId, requesterId, rejecterId) {
    await this.initialize();
    await callFunction(FUNCTIONS.REJECT_JOIN_REQUEST, { communityId, requesterId });
    return true;
  }

  async assignRole(communityId, targetUserId, role, adminUserId) {
    await this.initialize();
    await callFunction(FUNCTIONS.ASSIGN_COMMUNITY_ROLE, { communityId, targetUserId, role });
    return true;
  }

  async updateMemberPermissions(communityId, targetUserId, permissions, adminUserId) {
    await this.initialize();
    await callFunction(FUNCTIONS.UPDATE_MEMBER_PERMISSIONS, { communityId, targetUserId, permissions });
    return true;
  }

  async updateCommunitySettings(communityId, adminUserId, data) {
    await this.initialize();
    await callFunction(FUNCTIONS.UPDATE_COMMUNITY_SETTINGS, { communityId, updates: data || {} });
    return true;
  }

  async getUserCommunities(userId) {
    await this.initialize();
    // Membership lives in a map field, so this is resolved server-side rather
    // than with a dynamic field-path query the rules cannot express.
    const result = await callFunction(FUNCTIONS.GET_MY_COMMUNITIES, {});
    return result?.communities || [];
  }

  async getUserManagedCommunities(userId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'communities'),
      where(`members.${userId}.role`, 'in', ['owner', 'admin', 'moderator']),
      where('isDeleted', '==', false),
      limit(MAX_COMMUNITY_READ)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async banUser(communityId, targetUserId, moderatorId, reason = '') {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'ban', targetUserId, reason });
    return true;
  }

  async unbanUser(communityId, targetUserId, moderatorId) {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'unban', targetUserId });
    return true;
  }

  async enableSlowMode(communityId, delay, moderatorId) {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'slow_mode', delay });
    return true;
  }

  async disableSlowMode(communityId, moderatorId) {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'slow_mode_off' });
    return true;
  }

  async enableContentApproval(communityId, moderatorId) {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'content_approval_on' });
    return true;
  }

  async disableContentApproval(communityId, moderatorId) {
    await this.initialize();
    await callFunction(FUNCTIONS.COMMUNITY_MODERATE, { communityId, action: 'content_approval_off' });
    return true;
  }

  async addSpace(communityId, space, userId) {
    await this.initialize();
    const result = await callFunction(FUNCTIONS.ADD_COMMUNITY_SPACE, { communityId, space });
    return result?.space;
  }

  async removeSpace(communityId, spaceId, userId) {
    await this.initialize();
    await callFunction(FUNCTIONS.REMOVE_COMMUNITY_SPACE, { communityId, spaceId });
    return true;
  }

  async createCommunityPost(communityId, userId, postData) {
    await this.initialize();
    // The post is written server-side: membership and the content-approval
    // status are decided there, and the community's postCount/activityScore
    // live on the now server-only community document.
    const result = await callFunction(FUNCTIONS.CREATE_COMMUNITY_POST, {
      communityId,
      post: postData || {},
    });
    return result?.post;
  }

  async getCommunityPosts(communityId, options = {}) {
    await this.initialize();
    
    const { page = 1, sortBy = 'recent', status = 'published' } = options;
    
    // The list rule proves a community feed only via
    // `communityId == X` + `visibility == 'community'` + `status == 'published'`
    // + `isDeleted == false`, and only when X is public or the viewer is a
    // member. 'all' cannot be expressed to the rule, so it resolves to the
    // published feed; a non-published status query is denied by the rule.
    let q = query(
      collection(this.db, 'posts'),
      where('communityId', '==', communityId),
      where('visibility', '==', 'community'),
      where('isDeleted', '==', false),
      where('status', '==', status === 'all' ? 'published' : status)
    );

    if (sortBy === 'recent') {
      q = query(q, orderBy('createdAt', 'desc'));
    } else if (sortBy === 'popular') {
      q = query(q, orderBy('stats.likes', 'desc'));
    }

    q = query(q, limit(COMMUNITIES_PER_PAGE));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Moderation actions are audited server-side by the community callables
  // (functions/communities.js -> writeAudit -> moderation_logs). There is no
  // client-writable audit path; moderation_logs is server-write-only.
  async logModerationAction(communityId, moderatorId, action, targetUserId = null, reason = '') {
    return { success: false, reason: 'server_authoritative' };
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
