// functions/collaboration.js — server-authoritative collaboration projects.
//
// A project is `collaboration_projects/{id}` (ownerId, settings) with two
// subcollections: `team/{uid}` (role, status) and `content/{versionId}`
// (draft/review/publish states). Membership and roles are privilege data, so
// the document must not be client-writable — a rule that let a user add
// themselves to `team` would let them pick `role: 'owner'`.
//
// The subcollection rule also required `authorId`/`userId` on every write,
// while the client wrote `createdBy` and team docs with neither, so creating a
// project, inviting, adding members, saving a version, submitting, reviewing
// and publishing were ALL denied. The service surfaced a generic error, so the
// collaboration screens looked functional and changed nothing.
//
// Every mutation is resolved here: the caller's role is read from the project +
// team document, the permission is checked against the server's own role table,
// and the write is applied with the Admin SDK. `firestore.rules` makes the
// project and its subcollections client-read-only.

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext } = require('./auth');
const { writeAudit } = require('./admin');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_LIST_READ = 200;
const MAX_TEAM_SIZE = 50;
const MAX_VERSION_LOGS = 50;
const INVITE_EXPIRY_DAYS = 7;
const ROLES = ['owner', 'admin', 'editor', 'viewer'];
const REVIEW_STATES = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  PUBLISHED: 'published',
};

// Mirrors COLLABORATION_CONFIG.ROLES in src/services/collaborationService.js.
// The server table is the one that matters: the client copy only drives which
// buttons render.
const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['content.create', 'content.edit', 'content.delete', 'content.publish', 'content.review',
    'analytics.view', 'analytics.export', 'monetization.manage', 'settings.edit',
    'team.manage', 'team.invite', 'team.remove'],
  editor: ['content.create', 'content.edit', 'content.publish', 'analytics.view'],
  viewer: ['content.view', 'analytics.view'],
};

function httpError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(permission);
}

async function loadProject(projectId) {
  if (!projectId || typeof projectId !== 'string') {
    throw httpError('invalid-argument', 'A projectId is required.');
  }
  const ref = db.doc(`collaboration_projects/${projectId}`);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'Project not found.');
  return { ref, data: snap.data() };
}

/** The caller's role on the project, or null. Owner is derived from ownerId. */
async function resolveRole(projectId, project, uid) {
  if (project.ownerId === uid) return 'owner';
  const memberSnap = await db.doc(`collaboration_projects/${projectId}/team/${uid}`).get();
  if (!memberSnap.exists) return null;
  const member = memberSnap.data();
  if (member.status && member.status !== 'active') return null;
  return ROLES.includes(member.role) ? member.role : null;
}

/** Loads the project and asserts the caller holds `permission`. */
async function requirePermission(projectId, uid, permission) {
  const { ref, data } = await loadProject(projectId);
  const role = await resolveRole(projectId, data, uid);
  if (!role) throw httpError('permission-denied', 'You are not a member of this project.');
  if (!hasPermission(role, permission)) {
    throw httpError('permission-denied', `Your role (${role}) cannot perform this action.`);
  }
  return { ref, data, role };
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function addTeamMember(projectId, userId, role, addedBy) {
  const teamRef = db.collection(`collaboration_projects/${projectId}/team`);
  const existing = await teamRef.doc(userId).get();
  if (existing.exists) throw httpError('already-exists', 'That user is already a team member.');
  const count = (await teamRef.limit(MAX_TEAM_SIZE + 1).get()).size;
  if (count >= MAX_TEAM_SIZE) throw httpError('failed-precondition', 'The team has reached its maximum size.');
  await teamRef.doc(userId).set({
    userId,
    role,
    status: 'active',
    addedAt: FieldValue.serverTimestamp(),
    addedBy: addedBy || null,
  });
  // Denormalized roster size on the project document so the dashboard can show a
  // real member count without fanning out one subcollection read per project.
  await db.doc(`collaboration_projects/${projectId}`).update({
    memberCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

exports.createCollaborationProject = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCollaborationProject', 10, 60000);

  const { name, description = '', contentType = 'video' } = data || {};
  const projectRef = db.collection('collaboration_projects').doc();
  const project = {
    id: projectRef.id,
    name: cleanText(name, 120) || 'Untitled Project',
    description: cleanText(description, 2000),
    ownerId: uid,
    contentType: ['video', 'audio', 'article', 'thumbnail'].includes(contentType) ? contentType : 'video',
    // The owner is the first roster entry (team/{uid} below), so the denormalized
    // count starts at 1. Kept in step by addTeamMember / removeCollaborationTeamMember.
    memberCount: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    settings: { requireReview: true, autoPublish: false, notifyOnChanges: true },
  };
  await projectRef.set(project);
  await projectRef.collection('team').doc(uid).set({
    userId: uid,
    role: 'owner',
    status: 'active',
    addedAt: FieldValue.serverTimestamp(),
    addedBy: uid,
  });
  return { id: projectRef.id };
});

exports.updateCollaborationProject = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateCollaborationProject', 30, 60000);

  const { projectId, updates } = data || {};
  const { ref } = await requirePermission(projectId, uid, 'settings.edit');
  const patch = { updatedAt: FieldValue.serverTimestamp() };
  // Whitelist: a caller may not rewrite ownerId, createdAt or unknown fields.
  if (updates && typeof updates === 'object') {
    if ('name' in updates) patch.name = cleanText(updates.name, 120);
    if ('description' in updates) patch.description = cleanText(updates.description, 2000);
    if ('contentType' in updates) patch.contentType = String(updates.contentType);
    if (updates.settings && typeof updates.settings === 'object') {
      patch.settings = {
        requireReview: updates.settings.requireReview !== false,
        autoPublish: updates.settings.autoPublish === true,
        notifyOnChanges: updates.settings.notifyOnChanges !== false,
      };
    }
  }
  await ref.update(patch);
  return { success: true };
});

exports.deleteCollaborationProject = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'deleteCollaborationProject', 10, 60000);

  const { projectId } = data || {};
  const { ref, data: project } = await loadProject(projectId);
  if (project.ownerId !== uid) throw httpError('permission-denied', 'Only the owner can delete this project.');

  for (const sub of ['team', 'content']) {
    const snap = await ref.collection(sub).limit(MAX_LIST_READ * 5).get();
    let batch = db.batch();
    let ops = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
    }
    if (ops > 0) await batch.commit();
  }
  await ref.delete();
  await writeAudit(uid, 'collaboration_project_deleted', projectId, { name: project.name }, 'collaboration');
  return { success: true };
});

exports.addCollaborationTeamMember = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'addCollaborationTeamMember', 30, 60000);

  const { projectId, userId, role } = data || {};
  await requirePermission(projectId, uid, 'team.invite');
  if (!userId || typeof userId !== 'string') throw httpError('invalid-argument', 'A userId is required.');
  if (!ROLES.includes(role) || role === 'owner') throw httpError('invalid-argument', 'A valid non-owner role is required.');
  await addTeamMember(projectId, userId, role, uid);
  return { success: true };
});

exports.updateCollaborationMemberRole = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateCollaborationMemberRole', 30, 60000);

  const { projectId, userId, newRole } = data || {};
  await requirePermission(projectId, uid, 'team.manage');
  if (userId === uid) throw httpError('failed-precondition', 'You cannot change your own role.');
  if (!ROLES.includes(newRole) || newRole === 'owner') throw httpError('invalid-argument', 'A valid non-owner role is required.');

  const memberRef = db.doc(`collaboration_projects/${projectId}/team/${userId}`);
  const snap = await memberRef.get();
  if (!snap.exists) throw httpError('not-found', 'Team member not found.');
  if (snap.data().role === 'owner') throw httpError('failed-precondition', 'The owner role cannot be changed.');
  await memberRef.update({ role: newRole, updatedAt: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.removeCollaborationTeamMember = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'removeCollaborationTeamMember', 30, 60000);

  const { projectId, userId } = data || {};
  const { data: project } = await requirePermission(projectId, uid, 'team.remove');
  if (userId === uid) throw httpError('failed-precondition', 'You cannot remove yourself.');
  if (userId === project.ownerId) throw httpError('failed-precondition', 'The owner cannot be removed.');

  const memberRef = db.doc(`collaboration_projects/${projectId}/team/${userId}`);
  const snap = await memberRef.get();
  if (!snap.exists) throw httpError('not-found', 'Team member not found.');
  if (snap.data().role === 'owner') throw httpError('failed-precondition', 'The owner cannot be removed.');
  await memberRef.delete();
  await db.doc(`collaboration_projects/${projectId}`).update({
    memberCount: FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(uid, 'collaboration_member_removed', projectId, { targetUserId: userId }, 'collaboration');
  return { success: true };
});

exports.createCollaborationInvite = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCollaborationInvite', 20, 60000);

  const { projectId, email, role } = data || {};
  await requirePermission(projectId, uid, 'team.invite');
  const cleanEmail = cleanText(email, 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw httpError('invalid-argument', 'A valid email is required.');
  if (!ROLES.includes(role) || role === 'owner') throw httpError('invalid-argument', 'A valid non-owner role is required.');

  const inviteRef = db.collection('collaboration_invites').doc();
  await inviteRef.set({
    id: inviteRef.id,
    projectId,
    email: cleanEmail,
    role,
    invitedBy: uid,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });
  return { inviteId: inviteRef.id };
});

exports.acceptCollaborationInvite = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'acceptCollaborationInvite', 20, 60000);

  const { inviteId } = data || {};
  const inviteRef = db.doc(`collaboration_invites/${inviteId}`);
  const snap = await inviteRef.get();
  if (!snap.exists) throw httpError('not-found', 'Invite not found.');
  const invite = snap.data();
  if (invite.status !== 'pending') throw httpError('failed-precondition', 'This invite is no longer valid.');

  const tokenEmail = (context.auth?.token?.email || '').toLowerCase();
  if (!tokenEmail || tokenEmail !== String(invite.email || '').toLowerCase()) {
    throw httpError('permission-denied', 'This invite was issued to a different email address.');
  }
  if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) {
    throw httpError('failed-precondition', 'This invite has expired.');
  }

  await addTeamMember(invite.projectId, uid, invite.role, invite.invitedBy);
  await inviteRef.update({
    status: 'accepted',
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: uid,
  });
  return { success: true, projectId: invite.projectId };
});

exports.declineCollaborationInvite = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'declineCollaborationInvite', 20, 60000);

  const { inviteId } = data || {};
  const inviteRef = db.doc(`collaboration_invites/${inviteId}`);
  const snap = await inviteRef.get();
  if (!snap.exists) throw httpError('not-found', 'Invite not found.');
  const invite = snap.data();
  const tokenEmail = (context.auth?.token?.email || '').toLowerCase();
  const isInvitee = tokenEmail && tokenEmail === String(invite.email || '').toLowerCase();
  if (invite.invitedBy !== uid && !isInvitee) {
    throw httpError('permission-denied', 'You cannot decline this invite.');
  }
  await inviteRef.update({
    status: 'declined',
    declinedAt: FieldValue.serverTimestamp(),
    declinedBy: uid,
  });
  return { success: true };
});

exports.createCollaborationContent = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCollaborationContent', 60, 60000);

  const { projectId, content, notes = '' } = data || {};
  const { ref } = await requirePermission(projectId, uid, 'content.create');

  const versionRef = ref.collection('content').doc();
  await versionRef.set({
    id: versionRef.id,
    projectId,
    content: content && typeof content === 'object' ? content : {},
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    state: REVIEW_STATES.DRAFT,
    notes: cleanText(notes, 2000),
    timestamp: Date.now(),
  });

  // Keep the version log bounded (oldest first).
  const versions = await ref.collection('content')
    .orderBy('createdAt', 'desc').limit(MAX_VERSION_LOGS + 20).get();
  if (versions.size > MAX_VERSION_LOGS) {
    const batch = db.batch();
    versions.docs.slice(MAX_VERSION_LOGS).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return { versionId: versionRef.id };
});

exports.submitCollaborationContentForReview = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'submitCollaborationContentForReview', 60, 60000);

  const { projectId, versionId } = data || {};
  await requirePermission(projectId, uid, 'content.edit');
  const versionRef = db.doc(`collaboration_projects/${projectId}/content/${versionId}`);
  if (!(await versionRef.get()).exists) throw httpError('not-found', 'Content version not found.');
  await versionRef.update({
    state: REVIEW_STATES.PENDING_REVIEW,
    submittedBy: uid,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.reviewCollaborationContent = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'reviewCollaborationContent', 60, 60000);

  const { projectId, versionId, decision, feedback = '' } = data || {};
  await requirePermission(projectId, uid, 'content.review');
  const state = decision === 'approve' ? REVIEW_STATES.APPROVED
    : decision === 'changes_requested' ? REVIEW_STATES.CHANGES_REQUESTED
      : REVIEW_STATES.DRAFT;
  const versionRef = db.doc(`collaboration_projects/${projectId}/content/${versionId}`);
  if (!(await versionRef.get()).exists) throw httpError('not-found', 'Content version not found.');
  await versionRef.update({
    state,
    reviewedBy: uid,
    reviewedAt: FieldValue.serverTimestamp(),
    feedback: cleanText(feedback, 2000),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true, state };
});

exports.publishCollaborationContent = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'publishCollaborationContent', 30, 60000);

  const { projectId, versionId } = data || {};
  await requirePermission(projectId, uid, 'content.publish');
  const versionRef = db.doc(`collaboration_projects/${projectId}/content/${versionId}`);
  if (!(await versionRef.get()).exists) throw httpError('not-found', 'Content version not found.');
  await versionRef.update({
    state: REVIEW_STATES.PUBLISHED,
    publishedBy: uid,
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ==================== BRAND PARTNERSHIPS & AD AUTHORIZATIONS ====================
const toIsoSafe = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

exports.createBrandPartnership = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createBrandPartnership', 20, 60000);

  const {
    creatorId,
    brandId,
    brandName,
    title,
    compensationCents = 0,
    currency = 'USD',
    deliverables = [],
    disclosureType = 'paid_partnership',
  } = data || {};

  const targetCreatorId = cleanText(creatorId || uid, 128);
  const targetBrandId = cleanText(brandId || uid, 128);
  const cleanTitle = cleanText(title || '', 200);
  if (!cleanTitle) throw httpError('invalid-argument', 'Partnership title is required.');

  const ref = db.collection('brand_partnerships').doc();
  const payload = {
    creatorId: targetCreatorId,
    brandId: targetBrandId,
    initiatedBy: uid,
    brandName: cleanText(brandName || 'Brand Partner', 160),
    title: cleanTitle,
    compensationCents: Math.max(0, Math.round(Number(compensationCents) || 0)),
    currency: String(currency || 'USD').toUpperCase().slice(0, 6),
    disclosureType: disclosureType === 'sponsored_ad' ? 'sponsored_ad' : 'paid_partnership',
    deliverables: Array.isArray(deliverables)
      ? deliverables.slice(0, 20).map((d, idx) => ({
          id: cleanText(d?.id || `del_${idx + 1}`, 64),
          label: cleanText(d?.label || String(d || 'Deliverable'), 160),
          completed: Boolean(d?.completed),
          postId: d?.postId ? cleanText(d.postId, 128) : null,
        }))
      : [],
    status: targetCreatorId === uid && targetBrandId === uid ? 'active' : 'proposed',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);
  return { success: true, partnershipId: ref.id, status: payload.status };
});

exports.respondBrandPartnership = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'respondBrandPartnership', 30, 60000);

  const { partnershipId, decision } = data || {};
  if (!partnershipId || !['accept', 'decline', 'complete', 'cancel'].includes(decision)) {
    throw httpError('invalid-argument', 'partnershipId and valid decision required.');
  }

  const ref = db.collection('brand_partnerships').doc(partnershipId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'Partnership not found.');
  const p = snap.data();
  if (p.creatorId !== uid && p.brandId !== uid) {
    throw httpError('permission-denied', 'Only partnership parties can respond.');
  }

  const statusMap = {
    accept: 'active',
    decline: 'declined',
    complete: 'completed',
    cancel: 'cancelled',
  };

  await ref.update({
    status: statusMap[decision],
    respondedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true, partnershipId, status: statusMap[decision] };
});

exports.updatePartnershipDeliverable = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updatePartnershipDeliverable', 40, 60000);

  const { partnershipId, deliverableId, completed, postId = null } = data || {};
  if (!partnershipId || !deliverableId) {
    throw httpError('invalid-argument', 'partnershipId and deliverableId are required.');
  }

  const ref = db.collection('brand_partnerships').doc(partnershipId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'Partnership not found.');
  const p = snap.data();
  if (p.creatorId !== uid && p.brandId !== uid) {
    throw httpError('permission-denied', 'Only partnership parties can update deliverables.');
  }

  const nextDeliverables = (Array.isArray(p.deliverables) ? p.deliverables : []).map((d) =>
    d.id === deliverableId
      ? {
          ...d,
          completed: completed !== undefined ? Boolean(completed) : d.completed,
          postId: postId !== undefined && postId !== null ? cleanText(postId, 128) : (d.postId || null),
        }
      : d
  );

  await ref.update({
    deliverables: nextDeliverables,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true, partnershipId, deliverables: nextDeliverables };
});

exports.listBrandPartnerships = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'listBrandPartnerships', 60, 60000);

  const [asCreatorSnap, asBrandSnap] = await Promise.all([
    db.collection('brand_partnerships').where('creatorId', '==', uid).orderBy('createdAt', 'desc').limit(30).get(),
    db.collection('brand_partnerships').where('brandId', '==', uid).orderBy('createdAt', 'desc').limit(30).get(),
  ]);

  const seen = new Map();
  for (const snap of [asCreatorSnap, asBrandSnap]) {
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      seen.set(docSnap.id, {
        id: docSnap.id,
        ...d,
        createdAt: toIsoSafe(d.createdAt),
        updatedAt: toIsoSafe(d.updatedAt),
      });
    });
  }

  return { success: true, partnerships: Array.from(seen.values()) };
});

exports.grantAdAuthorization = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'grantAdAuthorization', 20, 60000);

  const { postId, partnerId = null, partnerName = '', expiresInDays = 30 } = data || {};
  if (!postId || typeof postId !== 'string') {
    throw httpError('invalid-argument', 'postId is required to grant ad authorization.');
  }

  const postSnap = await db.collection('posts').doc(postId).get();
  if (!postSnap.exists || postSnap.data()?.isDeleted === true) {
    throw httpError('not-found', 'Post not found.');
  }
  if (postSnap.data().authorId !== uid) {
    throw httpError('permission-denied', 'Only the post author can grant ad promotion authorization.');
  }

  const days = Math.min(Math.max(Number(expiresInDays) || 30, 1), 365);
  const expiresAtIso = new Date(Date.now() + days * 86400000).toISOString();
  const authCode = `ARV-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

  const authRef = db.collection('ad_authorizations').doc();
  await authRef.set({
    creatorId: uid,
    partnerId: partnerId ? cleanText(partnerId, 128) : null,
    partnerName: cleanText(partnerName || 'Authorized Partner', 120),
    postId,
    authCode,
    status: 'active',
    expiresAt: expiresAtIso,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    authorizationId: authRef.id,
    authCode,
    postId,
    expiresAt: expiresAtIso,
    status: 'active',
  };
});

exports.revokeAdAuthorization = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'revokeAdAuthorization', 30, 60000);

  const { authorizationId } = data || {};
  if (!authorizationId) throw httpError('invalid-argument', 'authorizationId is required.');

  const ref = db.collection('ad_authorizations').doc(authorizationId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'Ad authorization not found.');
  if (snap.data().creatorId !== uid) {
    throw httpError('permission-denied', 'Only the creator can revoke this ad authorization.');
  }

  await ref.update({
    status: 'revoked',
    revokedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true, authorizationId, status: 'revoked' };
});

exports.listAdAuthorizations = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'listAdAuthorizations', 60, 60000);

  const [ownedSnap, partnerSnap] = await Promise.all([
    db.collection('ad_authorizations').where('creatorId', '==', uid).orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('ad_authorizations').where('partnerId', '==', uid).where('status', '==', 'active').limit(50).get(),
  ]);

  const byId = new Map();
  for (const snap of [ownedSnap, partnerSnap]) {
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      byId.set(docSnap.id, {
        id: docSnap.id,
        ...d,
        createdAt: toIsoSafe(d.createdAt),
        expiresAt: toIsoSafe(d.expiresAt),
      });
    });
  }

  return { success: true, authorizations: Array.from(byId.values()) };
});

exports.getPartnershipAnalytics = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getPartnershipAnalytics', 40, 60000);

  const { partnershipId } = data || {};
  if (!partnershipId) throw httpError('invalid-argument', 'partnershipId is required.');

  const pSnap = await db.collection('brand_partnerships').doc(partnershipId).get();
  if (!pSnap.exists) throw httpError('not-found', 'Partnership not found.');
  const p = pSnap.data();
  if (p.creatorId !== uid && p.brandId !== uid) {
    throw httpError('permission-denied', 'Access denied to partnership analytics.');
  }

  const postIds = (Array.isArray(p.deliverables) ? p.deliverables : [])
    .map((d) => d.postId)
    .filter(Boolean)
    .slice(0, 10);

  const posts = [];
  if (postIds.length > 0) {
    const snaps = await db.getAll(...postIds.map((id) => db.collection('posts').doc(id)));
    snaps.forEach((s) => {
      if (s.exists) {
        const pd = s.data();
        posts.push({
          postId: s.id,
          organicStats: pd.stats || {},
          paidStats: pd.paidStats || null,
        });
      }
    });
  }

  return {
    success: true,
    partnershipId,
    posts,
  };
});

