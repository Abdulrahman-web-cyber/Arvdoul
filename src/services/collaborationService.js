// src/services/collaborationService.js

import { logger } from '../utils/Logger.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { callFunction, FUNCTIONS } from './callableService.js';

export const COLLABORATION_CONFIG = {
  // Hard ceiling for any single collaboration list read.
  MAX_LIST_READ: 200,
  ROLES: {
    OWNER: {
      id: 'owner',
      name: 'Owner',
      level: 100,
      permissions: ['*'],
    },
    ADMIN: {
      id: 'admin',
      name: 'Admin',
      level: 80,
      permissions: [
        'content.create',
        'content.edit',
        'content.delete',
        'content.publish',
        'content.review',
        'analytics.view',
        'analytics.export',
        'monetization.manage',
        'settings.edit',
        'team.manage',
        'team.invite',
        'team.remove',
      ],
    },
    EDITOR: {
      id: 'editor',
      name: 'Editor',
      level: 60,
      permissions: [
        'content.create',
        'content.edit',
        'content.publish',
        'analytics.view',
      ],
    },
    VIEWER: {
      id: 'viewer',
      name: 'Viewer',
      level: 20,
      permissions: [
        'content.view',
        'analytics.view',
      ],
    },
  },
  INVITE_EXPIRY_DAYS: 7,
  MAX_TEAM_SIZE: 50,
  MAX_VERSION_LOGS: 50,
  CONTENT_TYPES: ['video', 'audio', 'article', 'thumbnail'],
  REVIEW_STATES: {
    DRAFT: 'draft',
    PENDING_REVIEW: 'pending_review',
    CHANGES_REQUESTED: 'changes_requested',
    APPROVED: 'approved',
    PUBLISHED: 'published',
  },
  NOTIFICATION_TYPES: {
    INVITE: 'collaboration_invite',
    REVIEW_REQUEST: 'review_request',
    REVIEW_COMPLETE: 'review_complete',
    ROLE_CHANGED: 'role_changed',
    REMOVED: 'removed_from_team',
  },
};

export class CollaborationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CollaborationError';
    this.code = `collaboration/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class CollaborationService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.initPromise = null;
    this.locks = new Map(); // local content locks (contentId -> { userId, expiresAt })
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.firestore = await getFirestoreInstance();
        this.initialized = true;
        logger.info('[CollaborationService] Initialized successfully');
      } catch (error) {
        logger.error('[CollaborationService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  /**
   * Tries to acquire a secure lock on a content file.
   */
  acquireLock(contentId, userId, ttlMs = 30000) {
    const now = Date.now();
    const existing = this.locks.get(contentId);
    if (existing && existing.userId !== userId && existing.expiresAt > now) {
      throw new CollaborationError('content_locked', `Content file is currently locked by another editor: ${existing.userId}`);
    }
    this.locks.set(contentId, { userId, expiresAt: now + ttlMs });
    return { success: true, expiresAt: now + ttlMs };
  }

  releaseLock(contentId, userId) {
    const existing = this.locks.get(contentId);
    if (existing && existing.userId === userId) {
      this.locks.delete(contentId);
    }
    return { success: true };
  }

  hasPermission(userRole, permission) {
    const role = COLLABORATION_CONFIG.ROLES[userRole?.toUpperCase() || 'VIEWER'];
    if (!role) return false;
    
    if (role.permissions.includes('*')) return true;
    return role.permissions.includes(permission);
  }

  canManageTeam(userRole) {
    return this.hasPermission(userRole, 'team.manage') || this.hasPermission(userRole, 'team.invite');
  }

  canEditContent(userRole) {
    return this.hasPermission(userRole, 'content.edit');
  }

  canPublishContent(userRole) {
    return this.hasPermission(userRole, 'content.publish');
  }

  canReviewContent(userRole) {
    return this.hasPermission(userRole, 'content.review');
  }

  async createProject(projectData) {
    await this.ensureInitialized();
    // Server-authoritative: the project document and its team/content
    // subcollections are client-read-only (roles are privilege data).
    const result = await callFunction(FUNCTIONS.CREATE_COLLAB_PROJECT, {
      name: projectData.name,
      description: projectData.description,
      contentType: projectData.contentType,
    });
    return this.getProject(result.id);
  }

  async getProject(projectId) {
    await this.ensureInitialized();

    const projectRef = doc(this.firestore, 'collaboration_projects', projectId);
    const snap = await getDoc(projectRef);

    if (!snap.exists()) {
      throw new CollaborationError('project_not_found', 'Project not found');
    }

    return { id: snap.id, ...snap.data() };
  }

  async updateProject(projectId, updates, userId, userRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.UPDATE_COLLAB_PROJECT, { projectId, updates });
    return this.getProject(projectId);
  }

  async deleteProject(projectId, userId, userRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.DELETE_COLLAB_PROJECT, { projectId });
    return true;
  }

  async addTeamMember(projectId, userId, role, inviterId = null) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.ADD_COLLAB_TEAM_MEMBER, { projectId, userId, role });
    return this.getTeamMember(projectId, userId);
  }

  async getTeamMember(projectId, userId) {
    await this.ensureInitialized();

    const memberRef = doc(this.firestore, 'collaboration_projects', projectId, 'team', userId);
    const snap = await getDoc(memberRef);

    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }

  async getTeam(projectId, { viewerId = null } = {}) {
    await this.ensureInitialized();

    const teamRef = collection(this.firestore, 'collaboration_projects', projectId, 'team');
    const snap = await getDocs(query(teamRef, limit(COLLABORATION_CONFIG.MAX_LIST_READ)));
    const members = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (members.length === 0) return members;

    // Team documents carry only `{ userId, role, status }` — no display name or
    // avatar. Resolve real identities through the canonical batched profile
    // hydration so the roster never shows a bare uid.
    try {
      const { socialGraphService } = await import('./socialGraphService.js');
      const profiles = await socialGraphService.hydrateProfiles(
        members.map((m) => m.userId || m.id),
        { viewerId }
      );
      const byId = new Map(profiles.map((p) => [p.uid || p.id, p]));
      return members.map((m) => {
        const profile = byId.get(m.userId || m.id);
        return profile
          ? { ...m, name: profile.displayName, avatar: profile.photoURL }
          : m;
      });
    } catch (err) {
      logger.warn('[CollaborationService] team identity hydration failed', err);
      return members;
    }
  }

  async updateMemberRole(projectId, userId, newRole, adminId, adminRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.UPDATE_COLLAB_MEMBER_ROLE, { projectId, userId, newRole });
    return this.getTeamMember(projectId, userId);
  }

  async removeTeamMember(projectId, userId, adminId, adminRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.REMOVE_COLLAB_TEAM_MEMBER, { projectId, userId });
    return true;
  }

  async createInvite(projectId, email, role, inviterId) {
    await this.ensureInitialized();
    const result = await callFunction(FUNCTIONS.CREATE_COLLAB_INVITE, { projectId, email, role });
    return { id: result.inviteId, projectId, email, role, status: 'pending' };
  }

  async acceptInvite(inviteId, userId, userEmail) {
    await this.ensureInitialized();
    const result = await callFunction(FUNCTIONS.ACCEPT_COLLAB_INVITE, { inviteId });
    return this.getProject(result.projectId);
  }

  async declineInvite(inviteId, userId) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.DECLINE_COLLAB_INVITE, { inviteId });
    return true;
  }

  async getUserInvites(email) {
    await this.ensureInitialized();

    const invitesRef = collection(this.firestore, 'collaboration_invites');
    const q = query(
      invitesRef,
      where('email', '==', email),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(COLLABORATION_CONFIG.MAX_LIST_READ)
    );

    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createContentVersion(projectId, contentData, userId, userRole) {
    await this.ensureInitialized();
    const result = await callFunction(FUNCTIONS.CREATE_COLLAB_CONTENT, {
      projectId,
      content: contentData,
      notes: contentData?.notes,
    });
    return {
      id: result.versionId,
      projectId,
      content: contentData,
      createdBy: userId,
      state: COLLABORATION_CONFIG.REVIEW_STATES.DRAFT,
    };
  }

  async getContentVersions(projectId) {
    await this.ensureInitialized();

    const contentRef = collection(this.firestore, 'collaboration_projects', projectId, 'content');
    const q = query(contentRef, orderBy('createdAt', 'desc'), limit(COLLABORATION_CONFIG.MAX_LIST_READ));
    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async submitForReview(projectId, versionId, userId, userRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.SUBMIT_COLLAB_CONTENT, { projectId, versionId });
    return { id: versionId, state: COLLABORATION_CONFIG.REVIEW_STATES.PENDING_REVIEW };
  }

  async reviewContent(projectId, versionId, decision, feedback, reviewerId, reviewerRole) {
    await this.ensureInitialized();
    const result = await callFunction(FUNCTIONS.REVIEW_COLLAB_CONTENT, {
      projectId, versionId, decision, feedback,
    });
    return { id: versionId, state: result.state, feedback };
  }

  async publishContent(projectId, versionId, publisherId, publisherRole) {
    await this.ensureInitialized();
    await callFunction(FUNCTIONS.PUBLISH_COLLAB_CONTENT, { projectId, versionId });
    return { id: versionId, state: COLLABORATION_CONFIG.REVIEW_STATES.PUBLISHED };
  }

  /**
   * Real dashboard stats: loads the user's collaboration projects from
   * Firestore. Never returns fabricated sample projects — an empty array is
   * the honest state when there are no projects (or the query fails).
   *
   * @param {string|null} userId - Firestore uid of the user to scope to.
   * @returns {Promise<{initialized: boolean, projects: Array}>}
   */
  async getStats(userId = null) {
    try {
      await this.ensureInitialized();
    } catch (err) {
      logger.error('[CollaborationService] getStats init failed', err);
      return { initialized: this.initialized, projects: [] };
    }

    const projects = [];
    if (!userId) {
      // No authenticated user — honest empty dashboard.
      return { initialized: this.initialized, projects };
    }

    try {
      const projectsRef = collection(this.firestore, 'collaboration_projects');
      // No orderBy here on purpose: combined where+orderBy on different fields
      // would require a composite Firestore index. Sort client-side instead.
      const q = query(projectsRef, where('ownerId', '==', userId), limit(50));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const updatedAt = data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : null) ||
                          data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
        projects.push({
          id: docSnap.id,
          name: data.name || 'Untitled Project',
          description: data.description || '',
          status: data.status || 'draft',
          thumbnail: data.thumbnail || null,
          // Roster size is denormalized onto the project document by
          // functions/collaboration.js (addTeamMember / removeTeamMember); the
          // roster itself lives in the `team` subcollection and is loaded by
          // getTeam() on the detail screen. There is no `team`/`members` array
          // on the document, so reading those produced a fabricated 0 and a
          // permanently empty avatar row.
          memberCount: typeof data.memberCount === 'number' ? data.memberCount : null,
          updatedAt: updatedAt ? updatedAt.toISOString() : '',
          content: [],
          reviews: [],
        });
      });

      // Newest first.
      projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    } catch (err) {
      logger.error('[CollaborationService] getStats query failed', err);
    }

    return { initialized: this.initialized, projects };
  }

  destroy() {
    this.initialized = false;
    this.initPromise = null;
    logger.warn('[CollaborationService] Destroyed');
  }
}

let instance = null;
export function getCollaborationService() {
  if (!instance) instance = new CollaborationService();
  return instance;
}

export const getTeamMember = (pid, uid) => getCollaborationService().getTeamMember(pid, uid);

const collaborationService = {
  initialize: () => getCollaborationService().initialize(),
  ensureInitialized: () => getCollaborationService().ensureInitialized(),
  hasPermission: (r, p) => getCollaborationService().hasPermission(r, p),
  canManageTeam: (r) => getCollaborationService().canManageTeam(r),
  canEditContent: (r) => getCollaborationService().canEditContent(r),
  canPublishContent: (r) => getCollaborationService().canPublishContent(r),
  canReviewContent: (r) => getCollaborationService().canReviewContent(r),
  createProject: (d) => getCollaborationService().createProject(d),
  getProject: (id) => getCollaborationService().getProject(id),
  updateProject: (id, u, uid, ur) => getCollaborationService().updateProject(id, u, uid, ur),
  deleteProject: (id, uid, ur) => getCollaborationService().deleteProject(id, uid, ur),
  addTeamMember: (pid, uid, r, iid) => getCollaborationService().addTeamMember(pid, uid, r, iid),
  getTeamMember: (pid, uid) => getCollaborationService().getTeamMember(pid, uid),
  getTeam: (pid) => getCollaborationService().getTeam(pid),
  updateMemberRole: (pid, uid, nr, aid, ar) => getCollaborationService().updateMemberRole(pid, uid, nr, aid, ar),
  removeTeamMember: (pid, uid, aid, ar) => getCollaborationService().removeTeamMember(pid, uid, aid, ar),
  createInvite: (pid, e, r, iid) => getCollaborationService().createInvite(pid, e, r, iid),
  acceptInvite: (iid, uid, ue) => getCollaborationService().acceptInvite(iid, uid, ue),
  declineInvite: (iid, uid) => getCollaborationService().declineInvite(iid, uid),
  getUserInvites: (e) => getCollaborationService().getUserInvites(e),
  createContentVersion: (pid, cd, uid, ur) => getCollaborationService().createContentVersion(pid, cd, uid, ur),
  getContentVersions: (pid) => getCollaborationService().getContentVersions(pid),
  submitForReview: (pid, vid, uid, ur) => getCollaborationService().submitForReview(pid, vid, uid, ur),
  reviewContent: (pid, vid, d, f, rid, rr) => getCollaborationService().reviewContent(pid, vid, d, f, rid, rr),
  publishContent: (pid, vid, pid2, pr) => getCollaborationService().publishContent(pid, vid, pid2, pr),
  acquireLock: (cid, uid, ttl) => getCollaborationService().acquireLock(cid, uid, ttl),
  releaseLock: (cid, uid) => getCollaborationService().releaseLock(cid, uid),
  getStats: (uid) => getCollaborationService().getStats(uid),
  destroy: () => getCollaborationService().destroy(),
  getService: getCollaborationService,
};

export default collaborationService;
export { collaborationService };
