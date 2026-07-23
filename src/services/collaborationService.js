// src/services/collaborationService.js – ARVDOUL COLLABORATION SERVICE V1
// 🤝 Content Collaboration with Roles, Permissions, Review Workflow
// ✅ Invite System • Role Management • Permission Evaluation • Review Workflow

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
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// ==================== CONFIGURATION ====================
export const COLLABORATION_CONFIG = {
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

// ==================== CUSTOM ERROR ====================
export class CollaborationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CollaborationError';
    this.code = `collaboration/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ==================== COLLABORATION SERVICE ====================
class CollaborationService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.firestore = getFirestoreInstance();
        this.initialized = true;
        console.log('[CollaborationService] Initialized successfully');
      } catch (error) {
        console.error('[CollaborationService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  // ==================== PERMISSION CHECKS ====================
  hasPermission(userRole, permission) {
    const role = COLLABORATION_CONFIG.ROLES[userRole.toUpperCase()];
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

  // ==================== PROJECT MANAGEMENT ====================
  async createProject(projectData) {
    await this.ensureInitialized();

    const projectId = uuidv4();
    const project = {
      id: projectId,
      name: projectData.name || 'Untitled Project',
      description: projectData.description || '',
      ownerId: projectData.ownerId,
      contentType: projectData.contentType || 'video',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {
        requireReview: projectData.requireReview ?? true,
        autoPublish: false,
        notifyOnChanges: true,
      },
    };

    const projectRef = doc(this.firestore, 'collaboration_projects', projectId);
    await setDoc(projectRef, project);

    // Add owner as team member
    await this.addTeamMember(projectId, projectData.ownerId, 'owner');

    return project;
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

    if (!this.hasPermission(userRole, 'settings.edit')) {
      throw new CollaborationError('permission_denied', 'You do not have permission to update this project');
    }

    const projectRef = doc(this.firestore, 'collaboration_projects', projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return this.getProject(projectId);
  }

  async deleteProject(projectId, userId, userRole) {
    await this.ensureInitialized();

    if (userRole !== 'owner') {
      throw new CollaborationError('permission_denied', 'Only the owner can delete this project');
    }

    const projectRef = doc(this.firestore, 'collaboration_projects', projectId);
    await deleteDoc(projectRef);

    // Delete all team members
    const teamRef = collection(this.firestore, 'collaboration_projects', projectId, 'team');
    const teamSnap = await getDocs(teamRef);
    const batch = this.firestore.batch();
    teamSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // Delete all content versions
    const contentRef = collection(this.firestore, 'collaboration_projects', projectId, 'content');
    const contentSnap = await getDocs(contentRef);
    const contentBatch = this.firestore.batch();
    contentSnap.docs.forEach((doc) => contentBatch.delete(doc.ref));
    await contentBatch.commit();

    return true;
  }

  // ==================== TEAM MANAGEMENT ====================
  async addTeamMember(projectId, userId, role, inviterId = null) {
    await this.ensureInitialized();

    // Check if already a member
    const existingMember = await this.getTeamMember(projectId, userId);
    if (existingMember) {
      throw new CollaborationError('already_member', 'User is already a team member');
    }

    // Check team size limit
    const team = await this.getTeam(projectId);
    if (team.length >= COLLABORATION_CONFIG.MAX_TEAM_SIZE) {
      throw new CollaborationError('team_full', 'Team has reached maximum size');
    }

    const memberRef = doc(this.firestore, 'collaboration_projects', projectId, 'team', userId);
    await setDoc(memberRef, {
      userId,
      role,
      addedAt: serverTimestamp(),
      addedBy: inviterId,
      status: 'active',
    });

    return this.getTeamMember(projectId, userId);
  }

  async getTeamMember(projectId, userId) {
    await this.ensureInitialized();

    const memberRef = doc(this.firestore, 'collaboration_projects', projectId, 'team', userId);
    const snap = await getDoc(memberRef);

    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }

  async getTeam(projectId) {
    await this.ensureInitialized();

    const teamRef = collection(this.firestore, 'collaboration_projects', projectId, 'team');
    const snap = await getDocs(teamRef);

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async updateMemberRole(projectId, userId, newRole, adminId, adminRole) {
    await this.ensureInitialized();

    if (!this.canManageTeam(adminRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to manage team members');
    }

    if (userId === adminId) {
      throw new CollaborationError('self_update', 'Cannot update your own role');
    }

    const member = await this.getTeamMember(projectId, userId);
    if (!member) {
      throw new CollaborationError('member_not_found', 'Team member not found');
    }

    if (member.role === 'owner') {
      throw new CollaborationError('owner_protected', 'Cannot change owner role');
    }

    const memberRef = doc(this.firestore, 'collaboration_projects', projectId, 'team', userId);
    await updateDoc(memberRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    return this.getTeamMember(projectId, userId);
  }

  async removeTeamMember(projectId, userId, adminId, adminRole) {
    await this.ensureInitialized();

    if (!this.canManageTeam(adminRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to remove team members');
    }

    if (userId === adminId) {
      throw new CollaborationError('self_remove', 'Cannot remove yourself from the team');
    }

    const member = await this.getTeamMember(projectId, userId);
    if (!member) {
      throw new CollaborationError('member_not_found', 'Team member not found');
    }

    if (member.role === 'owner') {
      throw new CollaborationError('owner_protected', 'Cannot remove the owner');
    }

    const memberRef = doc(this.firestore, 'collaboration_projects', projectId, 'team', userId);
    await deleteDoc(memberRef);

    return true;
  }

  // ==================== INVITE MANAGEMENT ====================
  async createInvite(projectId, email, role, inviterId) {
    await this.ensureInitialized();

    const inviteId = uuidv4();
    const invite = {
      id: inviteId,
      projectId,
      email,
      role,
      invitedBy: inviterId,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + COLLABORATION_CONFIG.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };

    const inviteRef = doc(this.firestore, 'collaboration_invites', inviteId);
    await setDoc(inviteRef, invite);

    return invite;
  }

  async acceptInvite(inviteId, userId, userEmail) {
    await this.ensureInitialized();

    const inviteRef = doc(this.firestore, 'collaboration_invites', inviteId);
    const snap = await getDoc(inviteRef);

    if (!snap.exists()) {
      throw new CollaborationError('invite_not_found', 'Invite not found');
    }

    const invite = snap.data();

    if (invite.status !== 'pending') {
      throw new CollaborationError('invite_invalid', 'Invite is no longer valid');
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new CollaborationError('invite_expired', 'Invite has expired');
    }

    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new CollaborationError('email_mismatch', 'Email does not match invite');
    }

    // Add as team member
    await this.addTeamMember(invite.projectId, userId, invite.role, invite.invitedBy);

    // Mark invite as accepted
    await updateDoc(inviteRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedBy: userId,
    });

    return this.getProject(invite.projectId);
  }

  async declineInvite(inviteId, userId) {
    await this.ensureInitialized();

    const inviteRef = doc(this.firestore, 'collaboration_invites', inviteId);
    await updateDoc(inviteRef, {
      status: 'declined',
      declinedAt: serverTimestamp(),
      declinedBy: userId,
    });

    return true;
  }

  async getUserInvites(email) {
    await this.ensureInitialized();

    const invitesRef = collection(this.firestore, 'collaboration_invites');
    const q = query(
      invitesRef,
      where('email', '==', email),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  // ==================== CONTENT VERSION MANAGEMENT ====================
  async createContentVersion(projectId, contentData, userId, userRole) {
    await this.ensureInitialized();

    if (!this.canEditContent(userRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to create content');
    }

    const versionId = uuidv4();
    const version = {
      id: versionId,
      projectId,
      content: contentData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      state: contentData.state || COLLABORATION_CONFIG.REVIEW_STATES.DRAFT,
      notes: contentData.notes || '',
    };

    const versionRef = doc(this.firestore, 'collaboration_projects', projectId, 'content', versionId);
    await setDoc(versionRef, version);

    return version;
  }

  async getContentVersions(projectId) {
    await this.ensureInitialized();

    const contentRef = collection(this.firestore, 'collaboration_projects', projectId, 'content');
    const q = query(contentRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async submitForReview(projectId, versionId, userId, userRole) {
    await this.ensureInitialized();

    if (!this.canEditContent(userRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to submit for review');
    }

    const versionRef = doc(this.firestore, 'collaboration_projects', projectId, 'content', versionId);
    await updateDoc(versionRef, {
      state: COLLABORATION_CONFIG.REVIEW_STATES.PENDING_REVIEW,
      submittedAt: serverTimestamp(),
      submittedBy: userId,
    });

    return { id: versionId, state: COLLABORATION_CONFIG.REVIEW_STATES.PENDING_REVIEW };
  }

  async reviewContent(projectId, versionId, decision, feedback, reviewerId, reviewerRole) {
    await this.ensureInitialized();

    if (!this.canReviewContent(reviewerRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to review content');
    }

    let newState;
    switch (decision) {
      case 'approve':
        newState = COLLABORATION_CONFIG.REVIEW_STATES.APPROVED;
        break;
      case 'request_changes':
        newState = COLLABORATION_CONFIG.REVIEW_STATES.CHANGES_REQUESTED;
        break;
      default:
        throw new CollaborationError('invalid_decision', 'Invalid review decision');
    }

    const versionRef = doc(this.firestore, 'collaboration_projects', projectId, 'content', versionId);
    await updateDoc(versionRef, {
      state: newState,
      reviewFeedback: feedback,
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerId,
    });

    return { id: versionId, state: newState, feedback };
  }

  async publishContent(projectId, versionId, publisherId, publisherRole) {
    await this.ensureInitialized();

    if (!this.canPublishContent(publisherRole)) {
      throw new CollaborationError('permission_denied', 'You do not have permission to publish content');
    }

    const versionRef = doc(this.firestore, 'collaboration_projects', projectId, 'content', versionId);
    await updateDoc(versionRef, {
      state: COLLABORATION_CONFIG.REVIEW_STATES.PUBLISHED,
      publishedAt: serverTimestamp(),
      publishedBy: publisherId,
    });

    return { id: versionId, state: COLLABORATION_CONFIG.REVIEW_STATES.PUBLISHED };
  }

  // ==================== SERVICE MANAGEMENT ====================
  getStats() {
    return {
      initialized: this.initialized,
    };
  }

  destroy() {
    this.initialized = false;
    this.initPromise = null;
    console.warn('[CollaborationService] Destroyed');
  }
}

// ==================== SINGLETON EXPORT ====================
let instance = null;
export function getCollaborationService() {
  if (!instance) instance = new CollaborationService();
  return instance;
}

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
  getStats: () => getCollaborationService().getStats(),
  destroy: () => getCollaborationService().destroy(),
  getService: getCollaborationService,
};

export default collaborationService;
