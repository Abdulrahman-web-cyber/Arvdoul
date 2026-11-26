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
  await seedDefaultCommunityChannels(ref, uid);
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
//  authorId/authorIsPrivate), but `status: 'pending'` must be decided by the
//  community's content-approval setting, not by the caller, so it is resolved
//  here. The community's derived counters (`stats.postCount`/`activityScore`)
//  are NOT written here — `functions/communityPostCounters.js#onCommunityPostWrite`
//  is their single writer (a net-delta trigger), so a delete/unpublish also
//  decrements them (N451).
// ----------------------------------------------------------------------
exports.createCommunityPost = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCommunityPost', 60, 60000);

  const { communityId, post } = data || {};
  const { data: community } = await loadCommunity(communityId);
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
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const authorIsPrivate = userData.isPrivate === true;

  const safeHttpUrl = (val) => {
    if (typeof val !== 'string' || !val.trim()) return null;
    try {
      const u = new URL(val.trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 2048) : null;
    } catch {
      return null;
    }
  };

  const cleanMedia = Array.isArray(post?.media)
    ? post.media.slice(0, 10).map((m, idx) => {
        if (!m || typeof m !== 'object') return null;
        const url = safeHttpUrl(m.url);
        if (!url) return null;
        const thumbnail = safeHttpUrl(m.thumbnail);
        const coverUrl = safeHttpUrl(m.coverUrl);
        return {
          url,
          type: cleanText(m.type, 20) || 'image',
          name: cleanText(m.name, 140) || '',
          alt: cleanText(m.alt, 500) || '',
          order: typeof m.order === 'number' ? m.order : idx,
          ...(thumbnail ? { thumbnail } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(typeof m.duration === 'number' && Number.isFinite(m.duration) ? { duration: m.duration } : {}),
        };
      }).filter(Boolean)
    : [];

  const postType = cleanText(post?.type, 30) || 'text';
  const normalizedHashtags = Array.isArray(post?.hashtags)
    ? [...new Set(post.hashtags.map((t) => cleanText(String(t || '').replace(/^#+/, '').toLowerCase(), 50)).filter(Boolean))].slice(0, 30)
    : [];

  const postRef = db.collection('posts').doc();
  const newPost = {
    id: postRef.id,
    authorId: uid,
    authorIsPrivate,
    authorName: cleanText(post?.authorName || userData.displayName || userData.username, 120) || '',
    authorUsername: cleanText(post?.authorUsername || userData.username, 60) || '',
    authorPhoto: safeHttpUrl(post?.authorPhoto || userData.photoURL) || '',
    communityId,
    content,
    contentJSON: post?.contentJSON && typeof post.contentJSON === 'object' ? post.contentJSON : null,
    type: postType,
    media: cleanMedia,
    mediaUrl: safeHttpUrl(post?.mediaUrl) || cleanMedia[0]?.url || '',
    videoUrl: safeHttpUrl(post?.videoUrl) || cleanMedia.find((m) => m.type === 'video')?.url || '',
    thumbnailUrl: safeHttpUrl(post?.thumbnailUrl) || cleanMedia[0]?.thumbnail || cleanMedia[0]?.coverUrl || cleanMedia[0]?.url || '',
    ...(postType === 'poll' && post?.poll && {
      poll: {
        question: cleanText(post.poll.question || content, 500),
        options: Array.isArray(post.poll.options)
          ? post.poll.options.slice(0, 10).map((opt, idx) => {
              const rawText = typeof opt === 'string' ? opt : opt?.text;
              const rawId = typeof opt === 'object' && opt?.id ? opt.id : `opt_${idx}`;
              return {
                id: cleanText(rawId, 40),
                text: cleanText(rawText, 120),
                votes: 0,
              };
            }).filter((o) => o.text)
          : [],
        totalVotes: 0,
        allowMultiple: Boolean(post.poll.allowMultiple),
        closesAt: post.poll.closesAt || null,
      },
    }),
    ...(postType === 'question' && {
      question: {
        text: cleanText(post?.question?.text || post?.question?.title || content, 500),
        title: cleanText(post?.question?.title || post?.question?.text || content, 300),
        details: cleanText(post?.question?.details || '', 2000),
        bounty: Number(post?.question?.bounty) || 0,
        closed: Boolean(post?.question?.closed),
        acceptedAnswerId: post?.question?.acceptedAnswerId || null,
        answers: [],
        totalAnswers: 0,
        bestAnswerId: null,
      },
    }),
    ...(postType === 'link' && post?.link && safeHttpUrl(post.link.url) && {
      link: {
        url: safeHttpUrl(post.link.url),
        title: cleanText(post.link.title || post.link.metadata?.title, 200) || '',
        description: cleanText(post.link.description || post.link.metadata?.description, 500) || '',
        image: safeHttpUrl(post.link.image || post.link.thumbnail || post.link.metadata?.image) || '',
        domain: cleanText(post.link.domain || post.link.metadata?.domain, 120) || '',
      },
    }),
    ...(postType === 'event' && post?.event && {
      event: {
        id: cleanText(post.event.id, 80) || null,
        title: cleanText(post.event.title, 160),
        description: cleanText(post.event.description, 2000),
        date: post.event.date || null,
        endDate: post.event.endDate || null,
        location: cleanText(post.event.location, 240),
        locationData: post.event.locationData || null,
        timezone: cleanText(post.event.timezone, 80) || null,
        coverImage: safeHttpUrl(post.event.coverImage) || '',
        rsvpEnabled: post.event.rsvpEnabled !== false,
        capacity: typeof post.event.capacity === 'number' && post.event.capacity > 0 ? post.event.capacity : null,
      },
    }),
    ...(postType === 'audio' && post?.audio && safeHttpUrl(post.audio.url) && {
      audio: {
        url: safeHttpUrl(post.audio.url),
        title: cleanText(post.audio.title, 140) || 'Untitled Audio',
        artist: cleanText(post.audio.artist, 100) || '',
        genre: cleanText(post.audio.genre, 50) || '',
        duration: typeof post.audio.duration === 'number' ? post.audio.duration : 0,
        ...(safeHttpUrl(post.audio.coverUrl) ? { coverUrl: safeHttpUrl(post.audio.coverUrl) } : {}),
      },
    }),
    ...(post?.location && typeof post.location === 'object' && {
      location: {
        name: cleanText(post.location.name || post.location.label || '', 200),
        ...(typeof post.location.lat === 'number' ? { lat: post.location.lat } : {}),
        ...(typeof post.location.lng === 'number' ? { lng: post.location.lng } : {}),
      },
    }),
    visibility: 'community',
    ...(post?.identityMeta && typeof post.identityMeta === 'object' ? { identityMeta: post.identityMeta } : {}),
    ...(post?.distributionSettings && typeof post.distributionSettings === 'object'
      ? { distributionSettings: post.distributionSettings }
      : {}),
    ...(post?.engagementControls && typeof post.engagementControls === 'object'
      ? { engagementControls: post.engagementControls }
      : {}),
    ...(post?.commercialDisclosure && typeof post.commercialDisclosure === 'object'
      ? { commercialDisclosure: post.commercialDisclosure }
      : {}),
    ...(post?.partnership && typeof post.partnership === 'object'
      ? { partnership: post.partnership }
      : {}),
    ...(post?.creatorPrograms && typeof post.creatorPrograms === 'object'
      ? { creatorPrograms: post.creatorPrograms }
      : {}),
    ...(post?.safetyAccessibility && typeof post.safetyAccessibility === 'object'
      ? { safetyAccessibility: post.safetyAccessibility }
      : {}),
    ...(post?.lifecycleSettings && typeof post.lifecycleSettings === 'object'
      ? { lifecycleSettings: post.lifecycleSettings }
      : {}),
    enableComments:
      post?.engagementControls?.commentMode === 'off'
        ? false
        : (post?.enableComments !== false && post?.allowComments !== false && post?.engagementControls?.enableComments !== false),
    commentsEnabled:
      post?.engagementControls?.commentMode === 'off'
        ? false
        : (post?.enableComments !== false && post?.allowComments !== false && post?.engagementControls?.enableComments !== false),
    allowComments:
      post?.engagementControls?.commentMode === 'off'
        ? false
        : (post?.allowComments !== false && post?.enableComments !== false && post?.engagementControls?.enableComments !== false),
    enableGifts:
      post?.enableGifts !== false &&
      post?.engagementControls?.enableGifts !== false &&
      post?.creatorPrograms?.enableGiftsForPost !== false,
    allowSharing: post?.allowSharing !== false && post?.engagementControls?.enableShares !== false,
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    reactions: { like: 0, love: 0, laugh: 0, celebrate: 0, support: 0, insightful: 0 },
    hashtags: normalizedHashtags,
    mentions: Array.isArray(post?.mentions) ? post.mentions.slice(0, 30) : [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
    scheduledTime: post?.scheduledTime && !Number.isNaN(new Date(post.scheduledTime).getTime())
      ? new Date(post.scheduledTime)
      : null,
    // Canonical post shape: `expiresAt` is present (null = never expires) so the
    // client's `postReadableByViewer` get-rule never hits an absent field.
    expiresAt: post?.expiresAt && !Number.isNaN(new Date(post.expiresAt).getTime())
      ? new Date(post.expiresAt)
      : null,
    status: community.moderation?.contentApproval
      ? 'pending'
      : (post?.scheduledTime && new Date(post.scheduledTime).getTime() > Date.now() ? 'scheduled' : 'published'),
    isDeleted: false,
  };
  await postRef.set(newPost);

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

// ======================================================================
//  PART 2: STRUCTURED COMMUNITY CHANNELS, MESSAGES & MODERATION
// ======================================================================
const { awardXpSafe } = require('./xpAward');
const { logger } = require('./logger');
const { writeNotification } = require('./notificationWriter');

const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', type: 'discussion', description: 'General community discussion', isDefault: true, order: 1 },
  { id: 'announcements', name: 'announcements', type: 'announcements', description: 'Official leadership broadcasts', isDefault: true, order: 2 },
  { id: 'events', name: 'events', type: 'events', description: 'Upcoming gatherings & event updates', isDefault: true, order: 3 },
];

async function seedDefaultCommunityChannels(communityRef, creatorUid) {
  const batch = db.batch();
  for (const ch of DEFAULT_CHANNELS) {
    const chRef = communityRef.collection('channels').doc(ch.id);
    batch.set(chRef, {
      ...ch,
      communityId: communityRef.id,
      slug: ch.id,
      isLocked: false,
      slowModeSeconds: 0,
      messageCount: 0,
      createdBy: creatorUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

exports.getCommunityChannels = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getCommunityChannels', 60, 60000);

  const { communityId } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  const membership = community.members?.[uid];

  if (community.privacy === 'secret' && !membership) {
    throw httpError('permission-denied', 'This community is private.');
  }
  if (community.privacy === 'private' && !membership) {
    return { success: true, channels: [] };
  }

  let snap = await ref.collection('channels').orderBy('order', 'asc').limit(50).get();
  if (snap.empty) {
    await seedDefaultCommunityChannels(ref, community.createdBy || uid);
    snap = await ref.collection('channels').orderBy('order', 'asc').limit(50).get();
  }

  const channels = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || null,
  }));
  return { success: true, channels };
});

exports.createCommunityChannel = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createCommunityChannel', 15, 60000);

  const { communityId, name, type = 'discussion', description = '', slowModeSeconds = 0 } = data || {};
  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);

  const cleanedName = cleanText(name, 48).toLowerCase().replace(/[^a-z0-9-_ ]/g, '').trim();
  if (!cleanedName) throw httpError('invalid-argument', 'A valid channel name is required.');
  if (!['discussion', 'announcements', 'events'].includes(type)) {
    throw httpError('invalid-argument', 'type must be discussion, announcements, or events.');
  }

  const slug = cleanedName.replace(/\s+/g, '-');
  const existing = await ref.collection('channels').limit(30).get();
  if (existing.size >= 25) {
    throw httpError('failed-precondition', 'Maximum channel limit (25) reached for this community.');
  }

  const chRef = ref.collection('channels').doc();
  const channelDoc = {
    id: chRef.id,
    communityId,
    name: cleanedName,
    slug,
    type,
    description: cleanText(description, 240),
    isDefault: false,
    isLocked: false,
    slowModeSeconds: Math.min(Math.max(0, Number(slowModeSeconds) || 0), 3600),
    order: existing.size + 1,
    messageCount: 0,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await chRef.set(channelDoc);
  await writeAudit(uid, 'community_channel_created', communityId, { channelId: chRef.id, name: cleanedName, type }, 'community');
  return { success: true, channel: { ...channelDoc, createdAt: new Date().toISOString() } };
});

exports.updateCommunityChannel = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateCommunityChannel', 25, 60000);

  const { communityId, channelId, name, description, isLocked, slowModeSeconds } = data || {};
  if (!channelId) throw httpError('invalid-argument', 'channelId is required.');

  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);

  const chRef = ref.collection('channels').doc(channelId);
  const chSnap = await chRef.get();
  if (!chSnap.exists) throw httpError('not-found', 'Channel not found.');

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof name === 'string' && name.trim()) patch.name = cleanText(name, 48).toLowerCase();
  if (typeof description === 'string') patch.description = cleanText(description, 240);
  if (typeof isLocked === 'boolean') patch.isLocked = isLocked;
  if (slowModeSeconds !== undefined) patch.slowModeSeconds = Math.min(Math.max(0, Number(slowModeSeconds) || 0), 3600);

  await chRef.update(patch);
  return { success: true, channelId };
});

exports.deleteCommunityChannel = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'deleteCommunityChannel', 10, 60000);

  const { communityId, channelId } = data || {};
  if (!channelId) throw httpError('invalid-argument', 'channelId is required.');

  const { ref, data: community } = await loadCommunity(communityId);
  assertRole(community, uid, ['owner', 'admin']);

  const chRef = ref.collection('channels').doc(channelId);
  const chSnap = await chRef.get();
  if (!chSnap.exists) throw httpError('not-found', 'Channel not found.');
  if (chSnap.data().isDefault) throw httpError('failed-precondition', 'Default community channels cannot be deleted.');

  await chRef.delete();
  await writeAudit(uid, 'community_channel_deleted', communityId, { channelId }, 'community');
  return { success: true, channelId };
});

exports.getChannelMessages = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getChannelMessages', 90, 60000);

  const { communityId, channelId, limit: rawLimit = 40, beforeId = null } = data || {};
  if (!channelId) throw httpError('invalid-argument', 'channelId is required.');

  const { ref, data: community } = await loadCommunity(communityId);
  const membership = community.members?.[uid];
  if ((community.privacy === 'private' || community.privacy === 'secret') && !membership) {
    throw httpError('permission-denied', 'Membership required to read private community channels.');
  }
  if (community.moderation?.bannedUsers?.includes(uid)) {
    throw httpError('permission-denied', 'You are banned from this community.');
  }

  const pageLimit = Math.min(Math.max(1, Number(rawLimit) || 40), 50);
  let q = ref.collection('channels').doc(channelId).collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(pageLimit);

  if (beforeId && typeof beforeId === 'string') {
    const cursorSnap = await ref.collection('channels').doc(channelId).collection('messages').doc(beforeId).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const messages = snap.docs
    .filter((d) => d.data().isDeleted !== true)
    .map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
    }))
    .reverse();

  return { success: true, messages, hasMore: snap.size === pageLimit };
});

exports.sendChannelMessage = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'sendChannelMessage', 40, 60000);

  const { communityId, channelId, content = '', type = 'text', sharedContent = null } = data || {};
  if (!channelId) throw httpError('invalid-argument', 'channelId is required.');

  const { ref, data: community } = await loadCommunity(communityId);
  const role = roleOf(community, uid);
  if (!role || role === 'restricted') {
    throw httpError('permission-denied', 'Active community membership required to post.');
  }
  if (community.moderation?.bannedUsers?.includes(uid)) {
    throw httpError('permission-denied', 'You are banned from this community.');
  }

  const chRef = ref.collection('channels').doc(channelId);
  const chSnap = await chRef.get();
  if (!chSnap.exists) throw httpError('not-found', 'Channel not found.');
  const channel = chSnap.data();

  const isStaff = ['owner', 'admin', 'moderator'].includes(role);
  if (channel.type === 'announcements' && !isStaff) {
    throw httpError('permission-denied', 'Only community leaders and moderators can post in Announcements.');
  }
  if (channel.isLocked && !isStaff) {
    throw httpError('permission-denied', 'This channel is currently locked.');
  }

  const slowDelay = Number(channel.slowModeSeconds || community.moderation?.slowModeDelay || 0);
  if (slowDelay > 0 && !isStaff) {
    await checkRateLimit(uid, `ch_slow_${communityId}_${channelId}`, 1, slowDelay * 1000);
  }

  const cleanedContent = cleanText(content, 4000);
  if (!cleanedContent && !sharedContent) {
    throw httpError('invalid-argument', 'Message text or shared content is required.');
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const u = userSnap.exists ? userSnap.data() : {};
  const msgRef = chRef.collection('messages').doc();

  const msgDoc = {
    id: msgRef.id,
    communityId,
    channelId,
    senderId: uid,
    senderName: u.displayName || u.username || 'Member',
    senderPhoto: u.photoURL || null,
    senderRole: role,
    type: ['text', 'image', 'event_share', 'announcement'].includes(type) ? type : 'text',
    content: cleanedContent,
    sharedContent: sharedContent && typeof sharedContent === 'object' ? sharedContent : null,
    isPinned: false,
    isDeleted: false,
    createdAt: FieldValue.serverTimestamp(),
  };

  await msgRef.set(msgDoc);
  await chRef.update({
    messageCount: FieldValue.increment(1),
    lastMessageAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Anti-spam gated XP: only substantive contributions (>=12 chars) earn bounded daily XP
  if (cleanedContent.length >= 12) {
    await awardXpSafe(uid, 'community_channel_contribution', { source: `${communityId}:${channelId}:${msgRef.id}` });
  }

  // Broadcast announcement notifications (respecting recipient communityAnnouncements opt-out & mutes)
  if (channel.type === 'announcements') {
    const memberIds = Object.keys(community.members || {}).filter((id) => id !== uid).slice(0, 100);
    await Promise.allSettled(
      memberIds.map(async (memberId) => {
        const settingsSnap = await db.collection('user_settings').doc(memberId).get();
        const prefs = settingsSnap.exists ? settingsSnap.data()?.notificationPreferences : null;
        if (prefs?.communityAnnouncements === false) return;
        await writeNotification(memberId, {
          type: 'community_announcement',
          title: `${community.name} · #${channel.name}`,
          message: cleanedContent.slice(0, 140),
          senderId: uid,
          senderName: msgDoc.senderName,
          metadata: { communityId, channelId, messageId: msgRef.id },
        }).catch((err) => logger.warn('community announcement notif failed', { memberId, error: err.message }));
      })
    );
  }

  return {
    success: true,
    message: { ...msgDoc, createdAt: new Date().toISOString() },
  };
});

exports.moderateChannelMessage = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'moderateChannelMessage', 40, 60000);

  const { communityId, channelId, messageId, action } = data || {};
  if (!channelId || !messageId || !['pin', 'unpin', 'delete'].includes(action)) {
    throw httpError('invalid-argument', 'communityId, channelId, messageId, and action (pin|unpin|delete) required.');
  }

  const { ref, data: community } = await loadCommunity(communityId);
  const role = roleOf(community, uid);
  const isStaff = ['owner', 'admin', 'moderator'].includes(role);

  const msgRef = ref.collection('channels').doc(channelId).collection('messages').doc(messageId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) throw httpError('not-found', 'Message not found.');
  const msg = msgSnap.data();

  if (action === 'delete') {
    if (!isStaff && msg.senderId !== uid) {
      throw httpError('permission-denied', 'Only staff or the message author can delete this message.');
    }
    await msgRef.update({ isDeleted: true, deletedBy: uid, deletedAt: FieldValue.serverTimestamp() });
  } else {
    if (!isStaff) {
      throw httpError('permission-denied', 'Only community leaders and moderators can pin messages.');
    }
    await msgRef.update({ isPinned: action === 'pin', pinnedBy: uid });
  }

  if (isStaff) {
    await writeAudit(uid, `channel_message_${action}`, communityId, { channelId, messageId }, 'community');
  }
  return { success: true, messageId, action };
});

