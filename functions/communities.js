// functions/communities.js — server-authoritative community mutations.
//
// The community document stores membership as a `members` MAP keyed by uid:
//   members: { [uid]: { role, joinedAt, permissions } }
// and derived counters (`stats.memberCount`), privilege data (`members.*.role`)
// and moderation state (`moderation.bannedUsers`, slow mode, content approval)
// all live on that one document.
//
// Letting the client write it directly is not an option: a rule that lets a
// user add themselves to `members` also lets them write `role: 'owner'`. So
// every mutation is resolved here — the caller's role is read from the
// document, the patch is applied with the Admin SDK (which bypasses rules),
// and privileged actions are audited. `firestore.rules` now denies all client
// writes to `communities/{id}`; this module is the only writer.
//
// Before this module existed the client wrote the document directly and every
// call was denied, because the rule keyed on an `ownerId` field the client
// never wrote — so creating, joining and moderating a community all failed
// silently behind a generic "Insufficient permissions" toast.

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext } = require('./auth');
const { writeAudit } = require('./admin');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_COMMUNITY_READ = 200;
const COMMUNITY_ROLES = ['owner', 'admin', 'moderator', 'contributor', 'member', 'restricted'];
const MODERATION_ACTIONS = {
  ban: ['owner', 'admin', 'moderator'],
  unban: ['owner', 'admin', 'moderator'],
  slow_mode: ['owner', 'admin', 'moderator'],
  slow_mode_off: ['owner', 'admin', 'moderator'],
  content_approval_on: ['owner', 'admin'],
  content_approval_off: ['owner', 'admin'],
};

function httpError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Loads the community or throws; returns `{ ref, data }`. */
async function loadCommunity(communityId) {
  if (!communityId || typeof communityId !== 'string') {
    throw httpError('invalid-argument', 'A communityId is required.');
  }
  const ref = db.doc(`communities/${communityId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().isDeleted === true) {
    throw httpError('not-found', 'Community not found.');
  }
  return { ref, data: snap.data() };
}

function roleOf(community, uid) {
  return community.members?.[uid]?.role || null;
}

function assertRole(community, uid, allowed) {
  const role = roleOf(community, uid);
  if (!role || !allowed.includes(role)) {
    throw httpError('permission-denied', 'Insufficient permissions.');
  }
  return role;
}

// ----------------------------------------------------------------------
//  createCommunity
// ----------------------------------------------------------------------
exports.createCommunity = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCommunity', 5, 60000);

  const payload = data || {};
  const name = cleanText(payload.name, 80);
  if (!name) throw httpError('invalid-argument', 'A community name is required.');

  const settings = {
    defaultRole: 'member',
    joinApproval: payload.joinApproval === true,
    inviteOnly: payload.inviteOnly === true,
    discoveryEnabled: payload.discoveryEnabled !== false,
  };
  const privacy = ['public', 'private', 'secret'].includes(payload.privacy) ? payload.privacy : 'public';

  const ref = db.collection('communities').doc();
  const community = {
    id: ref.id,
    name,
    description: cleanText(payload.description, 1000),
    rules: cleanText(payload.rules, 4000),
    avatar: cleanText(payload.avatar, 500),
    cover: cleanText(payload.cover, 500),
    privacy,
    members: {
      [uid]: { role: 'owner', joinedAt: FieldValue.serverTimestamp(), permissions: ['all'] },
    },
    spaces: [
      { name: 'General', type: 'discussion', description: 'General discussion', isDefault: true },
      { name: 'Announcements', type: 'announcements', description: 'Official announcements', isDefault: true },
    ],
    channels: [{ name: 'general', description: 'General chat', isDefault: true }],
    stats: { memberCount: 1, postCount: 0, eventCount: 0, activityScore: 100 },
    moderation: { slowMode: false, slowModeDelay: 0, contentApproval: false, bannedUsers: [] },
    settings,
    // The directory/recommendation queries filter on the TOP-LEVEL flag, so it
    // must be written here and kept in sync with settings.discoveryEnabled.
    discoveryEnabled: settings.discoveryEnabled,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    isDeleted: false,
  };
  await ref.set(community);
  await db.doc(`users/${uid}`).set(
    { communityCount: FieldValue.increment(1), joinedCommunities: FieldValue.arrayUnion(ref.id), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { id: ref.id, ...community, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
});

// ----------------------------------------------------------------------
//  updateCommunitySettings — owner/admin edits profile + settings
// ----------------------------------------------------------------------
exports.updateCommunitySettings = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateCommunitySettings', 30, 60000);

  const { communityId, updates } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  const u = updates || {};
  if (typeof u.name === 'string') patch.name = cleanText(u.name, 80);
  if (typeof u.description === 'string') patch.description = cleanText(u.description, 1000);
  if (typeof u.rules === 'string') patch.rules = cleanText(u.rules, 4000);
  if (typeof u.avatar === 'string') patch.avatar = cleanText(u.avatar, 500);
  if (typeof u.cover === 'string') patch.cover = cleanText(u.cover, 500);
  if (['public', 'private', 'secret'].includes(u.privacy)) patch.privacy = u.privacy;
  if (u.settings && typeof u.settings === 'object') {
    const merged = { ...(community.settings || {}), ...u.settings };
    patch.settings = merged;
    if (typeof merged.discoveryEnabled === 'boolean') patch.discoveryEnabled = merged.discoveryEnabled;
  }

  await ref.update(patch);
  return { success: true };
});

// ----------------------------------------------------------------------
//  deleteCommunity — soft delete, owner only
// ----------------------------------------------------------------------
exports.deleteCommunity = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'deleteCommunity', 10, 60000);

  const { communityId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  if (community.createdBy !== uid && roleOf(community, uid) !== 'owner') {
    throw httpError('permission-denied', 'Only the owner can delete this community.');
  }

  await ref.update({ isDeleted: true, deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`users/${uid}`).set(
    { communityCount: FieldValue.increment(-1), joinedCommunities: FieldValue.arrayRemove(communityId), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { success: true };
});

// ----------------------------------------------------------------------
//  join / leave / request / approve / reject
// ----------------------------------------------------------------------
exports.joinCommunity = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'joinCommunity', 30, 60000);

  const { communityId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  if (community.members?.[uid]) return { success: true, alreadyMember: true, requiresApproval: false };
  if (community.privacy === 'secret') throw httpError('permission-denied', 'Cannot join a secret community.');
  if (community.moderation?.bannedUsers?.includes(uid)) {
    throw httpError('permission-denied', 'You are banned from this community.');
  }

  const patch = {
    [`members.${uid}`]: { role: community.settings?.defaultRole || 'member', joinedAt: FieldValue.serverTimestamp(), permissions: [] },
    updatedAt: FieldValue.serverTimestamp(),
  };
  const requiresApproval = community.settings?.joinApproval === true;
  if (requiresApproval) {
    patch[`pendingRequests.${uid}`] = { requestedAt: FieldValue.serverTimestamp(), status: 'pending' };
  } else {
    patch['stats.memberCount'] = FieldValue.increment(1);
  }

  await ref.update(patch);
  if (!requiresApproval) {
    await db.doc(`users/${uid}`).set(
      { joinedCommunities: FieldValue.arrayUnion(communityId), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  return { success: true, requiresApproval };
});

exports.requestToJoin = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'requestToJoin', 30, 60000);

  const { communityId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  if (community.members?.[uid]) throw httpError('failed-precondition', 'Already a member.');
  if (community.privacy !== 'private') throw httpError('failed-precondition', 'This community does not require approval.');

  await ref.update({
    [`pendingRequests.${uid}`]: { requestedAt: FieldValue.serverTimestamp(), status: 'pending' },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.leaveCommunity = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'leaveCommunity', 30, 60000);

  const { communityId, targetUserId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  // A target other than the caller is a KICK, which needs owner/admin. This is
  // the same entry point the "Remove member" button uses, so the check must
  // live here rather than trusting the client's `canManage`.
  const isKick = Boolean(targetUserId) && targetUserId !== uid;
  const memberId = isKick ? targetUserId : uid;
  if (isKick) assertRole(community, uid, ['owner', 'admin']);

  const membership = community.members?.[memberId];
  if (!membership) throw httpError('failed-precondition', 'Not a member.');
  if (membership.role === 'owner') {
    throw httpError('failed-precondition', 'The owner cannot be removed. Transfer ownership or delete the community.');
  }

  await ref.update({
    [`members.${memberId}`]: FieldValue.delete(),
    'stats.memberCount': FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${memberId}`).set(
    { joinedCommunities: FieldValue.arrayRemove(communityId), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  if (isKick) await writeAudit(uid, 'community_member_removed', communityId, { targetUserId: memberId }, 'community');
  return { success: true };
});

exports.approveJoinRequest = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'approveJoinRequest', 60, 60000);

  const { communityId, requesterId } = data || {};
  if (!requesterId) throw httpError('invalid-argument', 'requesterId is required.');
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);
  if (!community.pendingRequests?.[requesterId]) throw httpError('not-found', 'No pending request from that user.');

  await ref.update({
    [`members.${requesterId}`]: { role: community.settings?.defaultRole || 'member', joinedAt: FieldValue.serverTimestamp(), permissions: [] },
    [`pendingRequests.${requesterId}`]: FieldValue.delete(),
    'stats.memberCount': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${requesterId}`).set(
    { joinedCommunities: FieldValue.arrayUnion(communityId), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { success: true };
});

exports.rejectJoinRequest = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'rejectJoinRequest', 60, 60000);

  const { communityId, requesterId } = data || {};
  if (!requesterId) throw httpError('invalid-argument', 'requesterId is required.');
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);

  await ref.update({
    [`pendingRequests.${requesterId}`]: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ----------------------------------------------------------------------
//  roles & permissions
// ----------------------------------------------------------------------
exports.assignCommunityRole = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'assignCommunityRole', 60, 60000);

  const { communityId, targetUserId, role } = data || {};
  if (!targetUserId || !COMMUNITY_ROLES.includes(role)) {
    throw httpError('invalid-argument', 'targetUserId and a valid role are required.');
  }
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);
  if (!community.members?.[targetUserId]) throw httpError('not-found', 'That user is not a member.');
  if (community.members[targetUserId].role === 'owner') throw httpError('failed-precondition', 'Cannot modify the owner role.');
  // Only an owner may mint another admin/owner-level role.
  if (role === 'admin' && roleOf(community, uid) !== 'owner') {
    throw httpError('permission-denied', 'Only the owner can grant admin.');
  }

  await ref.update({ [`members.${targetUserId}.role`]: role, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(uid, 'community_role_assigned', communityId, { targetUserId, role }, 'community');
  return { success: true };
});

exports.updateMemberPermissions = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateMemberPermissions', 60, 60000);

  const { communityId, targetUserId, permissions } = data || {};
  if (!targetUserId || !Array.isArray(permissions)) {
    throw httpError('invalid-argument', 'targetUserId and permissions[] are required.');
  }
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);
  if (!community.members?.[targetUserId]) throw httpError('not-found', 'That user is not a member.');

  const cleaned = permissions.filter((p) => typeof p === 'string').slice(0, 50);
  await ref.update({ [`members.${targetUserId}.permissions`]: cleaned, updatedAt: FieldValue.serverTimestamp() });
  return { success: true };
});

// ----------------------------------------------------------------------
//  spaces
// ----------------------------------------------------------------------
exports.addCommunitySpace = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'addCommunitySpace', 30, 60000);

  const { communityId, space } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);
  const name = cleanText(space?.name, 60);
  if (!name) throw httpError('invalid-argument', 'A space name is required.');

  const newSpace = {
    id: `space_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: ['discussion', 'announcements', 'qa', 'events'].includes(space?.type) ? space.type : 'discussion',
    description: cleanText(space?.description, 300),
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
  await ref.update({ spaces: FieldValue.arrayUnion(newSpace), updatedAt: FieldValue.serverTimestamp() });
  return { success: true, space: newSpace };
});

exports.removeCommunitySpace = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'removeCommunitySpace', 30, 60000);

  const { communityId, spaceId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);
  const space = (community.spaces || []).find((s) => s.id === spaceId);
  if (!space) throw httpError('not-found', 'Space not found.');
  if (space.isDefault) throw httpError('failed-precondition', 'Cannot remove a default space.');

  await ref.update({
    spaces: (community.spaces || []).filter((s) => s.id !== spaceId),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ----------------------------------------------------------------------
//  moderation (community moderators, NOT platform admins)
// ----------------------------------------------------------------------
exports.communityModerate = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'communityModerate', 60, 60000);

  const { communityId, action, targetUserId = null, reason = '', delay = 0 } = data || {};
  const allowedRoles = MODERATION_ACTIONS[action];
  if (!allowedRoles) throw httpError('invalid-argument', `Unknown community action "${action}".`);

  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, allowedRoles);
  if ((action === 'ban' || action === 'unban') && !targetUserId) {
    throw httpError('invalid-argument', 'targetUserId is required.');
  }
  if (action === 'ban' && community.members?.[targetUserId]?.role === 'owner') {
    throw httpError('failed-precondition', 'Cannot ban the owner.');
  }

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (action === 'ban') {
    patch[`members.${targetUserId}`] = FieldValue.delete();
    patch['moderation.bannedUsers'] = FieldValue.arrayUnion(targetUserId);
    patch['stats.memberCount'] = FieldValue.increment(-1);
  } else if (action === 'unban') {
    patch['moderation.bannedUsers'] = FieldValue.arrayRemove(targetUserId);
  } else if (action === 'slow_mode') {
    patch['moderation.slowMode'] = true;
    patch['moderation.slowModeDelay'] = Math.max(1, Math.min(Number(delay) || 0, 3600));
  } else if (action === 'slow_mode_off') {
    patch['moderation.slowMode'] = false;
    patch['moderation.slowModeDelay'] = 0;
  } else if (action === 'content_approval_on') {
    patch['moderation.contentApproval'] = true;
  } else if (action === 'content_approval_off') {
    patch['moderation.contentApproval'] = false;
  }

  await ref.update(patch);
  await writeAudit(
    uid,
    `community_${action}`,
    communityId,
    { communityName: community.name || null, targetUserId: targetUserId || null, reason: cleanText(reason, 500) },
    'community'
  );
  return { success: true, communityId, action };
});

// ----------------------------------------------------------------------
//  createCommunityPost — authoritative membership + content-approval gate
//
//  The post document itself is client-creatable (the `posts` rule pins
//  authorId/authorIsPrivate), but the community's derived counters
//  (`stats.postCount`/`activityScore`) live on the now server-only community
//  document, and `status: 'pending'` must be decided by the community's
//  content-approval setting, not by the caller. Both are resolved here.
// ----------------------------------------------------------------------
exports.createCommunityPost = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCommunityPost', 60, 60000);

  const { communityId, post } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  const membership = community.members?.[uid];
  if (!membership) throw httpError('permission-denied', 'Must be a member to post.');
  if (community.moderation?.bannedUsers?.includes(uid)) {
    throw httpError('permission-denied', 'You are banned from this community.');
  }

  const content = cleanText(post?.content, 5000);
  if (!content && !(Array.isArray(post?.media) && post.media.length)) {
    throw httpError('invalid-argument', 'A post needs text or media.');
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const authorIsPrivate = userSnap.exists ? userSnap.data()?.isPrivate === true : false;

  const postRef = db.collection('posts').doc();
  const newPost = {
    id: postRef.id,
    authorId: uid,
    authorIsPrivate,
    communityId,
    content,
    type: cleanText(post?.type, 30) || 'text',
    media: Array.isArray(post?.media) ? post.media.slice(0, 10) : [],
    visibility: 'community',
    allowComments: post?.allowComments !== false,
    allowSharing: post?.allowSharing !== false,
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    reactions: { like: 0, love: 0, laugh: 0, celebrate: 0, support: 0, insightful: 0 },
    hashtags: Array.isArray(post?.hashtags) ? post.hashtags.slice(0, 30) : [],
    mentions: Array.isArray(post?.mentions) ? post.mentions.slice(0, 30) : [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
    // Canonical post shape: `expiresAt` is present (null = never expires) so the
    // client's `postReadableByViewer` get-rule never hits an absent field.
    expiresAt: null,
    status: community.moderation?.contentApproval ? 'pending' : 'published',
    isDeleted: false,
  };
  await postRef.set(newPost);
  await ref.update({
    'stats.postCount': FieldValue.increment(1),
    'stats.activityScore': FieldValue.increment(10),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, post: { ...newPost, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
});

// ----------------------------------------------------------------------
//  getMyCommunities — server-side read so a user's membership list does not
//  depend on a dynamic field-path query that Firestore rules cannot express.
// ----------------------------------------------------------------------
exports.getMyCommunities = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getMyCommunities', 60, 60000);

  const snap = await db
    .collection('communities')
    .where(`members.${uid}.role`, 'in', COMMUNITY_ROLES)
    .where('isDeleted', '==', false)
    .limit(MAX_COMMUNITY_READ)
    .get();
  return { success: true, communities: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
