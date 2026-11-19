// ============================================================================
// ARVDOUL — PART 1 MESSAGING CONTRACTS & VALIDATION
// Single source of truth for Part 1 1:1 messaging bounds, attachment safety,
// URL sanitization, shared Arvdoul content references, and UID-scoped drafts.
// ============================================================================

export const MESSAGING_PART1_LIMITS = {
  TEXT_MAX_LENGTH: 5000,
  CAPTION_MAX_LENGTH: 1500,
  ATTACHMENT_MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  VOICE_MAX_SECONDS: 300, // 5 minutes
  EDIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  EDIT_HISTORY_MAX_ENTRIES: 5,
  ALLOWED_ATTACHMENT_MIME_PREFIXES: ['image/', 'video/', 'audio/'],
  ALLOWED_DOCUMENT_MIMES: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
  ],
  ALLOWED_DOCUMENT_EXTS: [
    'pdf',
    'txt',
    'csv',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'zip',
  ],
  BLOCKED_EXECUTABLE_EXTS: [
    'exe',
    'bat',
    'cmd',
    'sh',
    'msi',
    'dll',
    'com',
    'scr',
    'vbs',
    'js',
    'mjs',
    'cjs',
    'html',
    'htm',
    'svg',
    'php',
    'py',
    'rb',
    'jar',
    'apk',
    'dmg',
    'app',
  ],
  BLOCKED_MIMES: [
    'text/html',
    'image/svg+xml',
    'application/javascript',
    'text/javascript',
    'application/x-msdownload',
    'application/x-executable',
    'application/x-sh',
  ],
};

const DRAFT_KEY_PREFIX = 'arvdoul:msg_draft:';

/**
 * Validate a selected attachment before previewing or uploading.
 * Rejects executables, active HTML/SVG payloads, zero-byte files, and >25MB blobs.
 */
export function validateAttachmentFile(file) {
  if (!file || typeof file !== 'object') {
    return { valid: false, error: 'No file selected.' };
  }

  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }

  if (size > MESSAGING_PART1_LIMITS.ATTACHMENT_MAX_BYTES) {
    const mb = Math.round(MESSAGING_PART1_LIMITS.ATTACHMENT_MAX_BYTES / (1024 * 1024));
    return { valid: false, error: `File exceeds the ${mb} MB limit.` };
  }

  const name = String(file.name || '').trim();
  const extMatch = name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  const ext = extMatch ? extMatch[1] : '';
  const mime = String(file.type || '').toLowerCase().split(';')[0].trim();

  if (ext && MESSAGING_PART1_LIMITS.BLOCKED_EXECUTABLE_EXTS.includes(ext)) {
    return { valid: false, error: `Unsupported or unsafe file extension (.${ext}).` };
  }

  if (mime && MESSAGING_PART1_LIMITS.BLOCKED_MIMES.includes(mime)) {
    return { valid: false, error: 'Unsupported or unsafe file MIME type.' };
  }

  if (mime.startsWith('image/')) {
    return { valid: true, kind: 'image' };
  }
  if (mime.startsWith('video/')) {
    return { valid: true, kind: 'video' };
  }
  if (mime.startsWith('audio/')) {
    return { valid: true, kind: 'audio' };
  }

  if (
    (mime && MESSAGING_PART1_LIMITS.ALLOWED_DOCUMENT_MIMES.includes(mime)) ||
    (ext && MESSAGING_PART1_LIMITS.ALLOWED_DOCUMENT_EXTS.includes(ext))
  ) {
    return { valid: true, kind: 'file' };
  }

  // Fallback for image/video/audio picked on mobile browsers missing MIME
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif'].includes(ext)) {
    return { valid: true, kind: 'image' };
  }
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) {
    return { valid: true, kind: 'video' };
  }
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus'].includes(ext)) {
    return { valid: true, kind: 'audio' };
  }

  return {
    valid: false,
    error: 'Unsupported file format. Please choose an image, video, audio, or document.',
  };
}

/**
 * Only permit http: and https: URLs. Rejects javascript:, data:, vbscript:, file:, etc.
 */
export function sanitizeExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    if (/^www\.[^\s/$.?#].[^\s]*$/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Extract first safe external http/https URL from message text.
 */
export function extractFirstSafeUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+/i);
  if (!match) return null;
  const cleaned = match[0].replace(/[),.;!?]+$/, '');
  return sanitizeExternalUrl(cleaned);
}

/**
 * Build a normalized Arvdoul shared content reference for posts, vibes, sparks, or events.
 */
export function buildSharedContentReference(contentType, entity = {}) {
  const normalizedType = ['post', 'vibe', 'spark', 'event'].includes(contentType)
    ? contentType
    : 'post';
  const contentId = String(
    entity.id || entity.contentId || entity.postId || entity.videoId || entity.eventId || ''
  ).trim();
  if (!contentId) return null;

  return {
    contentType: normalizedType,
    contentId,
    authorId: entity.authorId || entity.ownerId || entity.creatorId || entity.userId || null,
    authorName: String(
      entity.authorName || entity.creatorName || entity.displayName || entity.username || ''
    ).slice(0, 80) || null,
    title: String(entity.title || entity.caption || entity.content || '').slice(0, 140) || null,
    thumbnailUrl:
      sanitizeExternalUrl(
        entity.thumbnailUrl || entity.coverImage || entity.mediaUrl || entity.imageUrl || entity.coverUrl || ''
      ) || null,
    eventDate: entity.date || entity.startDate || null,
    eventTimezone: entity.timezone || null,
    eventLocation: entity.location ? String(entity.location).slice(0, 120) : null,
    communityId: entity.communityId || null,
  };
}

export function resolveSharedContentRoute(sharedContent) {
  if (!sharedContent || !sharedContent.contentId) return '/home';
  const id = encodeURIComponent(sharedContent.contentId);
  switch (sharedContent.contentType) {
    case 'spark':
      return `/video/${id}`;
    case 'vibe':
      return `/stories/${id}`;
    case 'event':
      return `/event/${id}`;
    case 'post':
    default:
      return `/post/${id}`;
  }
}

/**
 * Parse an internal Arvdoul link pasted into chat into a shared content reference descriptor.
 */
export function parseArvdoulShareUrl(text) {
  const safe = extractFirstSafeUrl(text);
  if (!safe) return null;
  try {
    const parsed = new URL(safe);
    const currentOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : null;
    const isKnownHost =
      (currentOrigin && parsed.origin === currentOrigin) ||
      /(^|\.)arvdoul\.(com|app|web\.app|firebaseapp\.com)$/i.test(parsed.hostname);

    if (!isKnownHost) return null;

    const postMatch = parsed.pathname.match(/^\/(?:post|posts)\/([A-Za-z0-9_-]{4,128})\/?$/);
    if (postMatch) {
      return { contentType: 'post', contentId: postMatch[1], url: safe };
    }
    const sparkMatch = parsed.pathname.match(/^\/(?:video|videos|sparks|reels)\/([A-Za-z0-9_-]{4,128})\/?$/);
    if (sparkMatch) {
      return { contentType: 'spark', contentId: sparkMatch[1], url: safe };
    }
    const vibeMatch = parsed.pathname.match(/^\/(?:stories|vibe|vibes)\/([A-Za-z0-9_-]{4,128})\/?$/);
    if (vibeMatch) {
      return { contentType: 'vibe', contentId: vibeMatch[1], url: safe };
    }
    const eventMatch = parsed.pathname.match(/^\/(?:event|events)\/([A-Za-z0-9_-]{4,128})\/?$/);
    if (eventMatch) {
      return { contentType: 'event', contentId: eventMatch[1], url: safe };
    }
    return null;
  } catch {
    return null;
  }
}

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // storage disabled (private mode / sandbox)
  }
  return null;
}

function makeDraftKey(uid, conversationId) {
  return `${DRAFT_KEY_PREFIX}${uid}:${conversationId}`;
}

/**
 * Persist a conversation draft strictly scoped to the active UID.
 */
export function saveScopedDraft(uid, conversationId, draft) {
  const storage = getStorage();
  if (!storage || !uid || !conversationId) return false;

  const key = makeDraftKey(uid, conversationId);
  const text = typeof draft === 'string' ? draft : String(draft?.text || '');
  const replyTo = typeof draft === 'object' && draft?.replyTo
    ? {
        id: draft.replyTo.id,
        senderId: draft.replyTo.senderId || null,
        senderName: draft.replyTo.senderName || null,
        content: String(draft.replyTo.content || '').slice(0, 140),
        type: draft.replyTo.type || 'text',
      }
    : null;

  if (!text.trim() && !replyTo) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return true;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({
        text: text.slice(0, MESSAGING_PART1_LIMITS.TEXT_MAX_LENGTH),
        replyTo,
        updatedAt: Date.now(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadScopedDraft(uid, conversationId) {
  const storage = getStorage();
  if (!storage || !uid || !conversationId) return null;
  try {
    const raw = storage.getItem(makeDraftKey(uid, conversationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (!parsed.text && !parsed.replyTo)) return null;
    return {
      text: String(parsed.text || ''),
      replyTo: parsed.replyTo || null,
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    return null;
  }
}

export function clearScopedDraft(uid, conversationId) {
  const storage = getStorage();
  if (!storage || !uid || !conversationId) return false;
  try {
    storage.removeItem(makeDraftKey(uid, conversationId));
    return true;
  } catch {
    return false;
  }
}

export function listDraftConversationMap(uid) {
  const storage = getStorage();
  const map = {};
  if (!storage || !uid) return map;

  const prefix = `${DRAFT_KEY_PREFIX}${uid}:`;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) {
        const cid = k.slice(prefix.length);
        const raw = storage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.text && String(parsed.text).trim().length > 0) {
            map[cid] = {
              text: String(parsed.text).trim(),
              updatedAt: Number(parsed.updatedAt || 0),
            };
          }
        } catch {
          // ignore malformed entry
        }
      }
    }
  } catch {
    // ignore storage access errors
  }
  return map;
}

/**
 * Purge all message drafts for a specific owner UID or across all UIDs on logout.
 */
export function purgeMessageDraftsForOwner(uid = null) {
  const storage = getStorage();
  if (!storage) return 0;

  const prefix = uid ? `${DRAFT_KEY_PREFIX}${uid}:` : DRAFT_KEY_PREFIX;
  let removed = 0;
  try {
    const keysToDelete = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => {
      storage.removeItem(k);
      removed += 1;
    });
  } catch {
    // ignore
  }
  return removed;
}

// ============================================================================
// ARVDOUL — PART 2 CONTRACTS: GROUPS, COMMUNITIES/CHANNELS, CALLS & NATION
// ============================================================================

export const GROUP_ROLES = ['owner', 'admin', 'moderator', 'member'];
export const GROUP_ROLE_RANK = Object.freeze({
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
});

export const GROUP_ADD_PRIVACY_SCOPES = ['everyone', 'friends', 'followers', 'none'];
export const CALL_PRIVACY_SCOPES = ['everyone', 'friends', 'followers', 'none'];

export const DEFAULT_GROUP_SETTINGS = Object.freeze({
  whoCanSend: 'everyone',        // 'everyone' | 'moderators' | 'admins'
  whoCanInvite: 'moderators',    // 'everyone' | 'moderators' | 'admins'
  whoCanEditInfo: 'admins',      // 'everyone' | 'moderators' | 'admins'
  whoCanModerate: 'moderators',  // 'moderators' | 'admins'
  whoCanPin: 'moderators',       // 'everyone' | 'moderators' | 'admins'
  approvalRequired: false,
});

export function getGroupRoleRank(role) {
  return GROUP_ROLE_RANK[role] || 0;
}

export function getMemberGroupRole(conv, uid) {
  if (!conv || !uid) return null;
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  if (!participants.includes(uid) && conv.ownerId !== uid && conv.createdBy !== uid) {
    return null;
  }
  if (conv.ownerId === uid || conv.createdBy === uid) {
    const explicitOwner = conv.roles?.[uid];
    if (!conv.ownerId || conv.ownerId === uid) {
      return explicitOwner === 'owner' || !conv.ownerId ? 'owner' : explicitOwner;
    }
  }
  const roleFromMap = conv.roles?.[uid];
  if (roleFromMap && GROUP_ROLE_RANK[roleFromMap]) return roleFromMap;
  if (Array.isArray(conv.admins) && conv.admins.includes(uid)) return 'admin';
  if (Array.isArray(conv.moderators) && conv.moderators.includes(uid)) return 'moderator';
  return 'member';
}

export function canManageGroup(conv, uid) {
  const rank = getGroupRoleRank(getMemberGroupRole(conv, uid));
  return rank >= GROUP_ROLE_RANK.admin;
}

export function canModerateGroup(conv, uid) {
  const role = getMemberGroupRole(conv, uid);
  const rank = getGroupRoleRank(role);
  const policy = conv?.settings?.whoCanModerate || DEFAULT_GROUP_SETTINGS.whoCanModerate;
  if (policy === 'admins') return rank >= GROUP_ROLE_RANK.admin;
  return rank >= GROUP_ROLE_RANK.moderator;
}

export function canAssignGroupRole(conv, actorUid, targetRole) {
  const actorRole = getMemberGroupRole(conv, actorUid);
  if (!actorRole || !GROUP_ROLE_RANK[targetRole]) return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    return targetRole === 'moderator' || targetRole === 'member';
  }
  return false;
}

export function canPinGroupMessage(conv, uid) {
  const rank = getGroupRoleRank(getMemberGroupRole(conv, uid));
  if (rank === 0) return false;
  const policy = conv?.settings?.whoCanPin || DEFAULT_GROUP_SETTINGS.whoCanPin;
  if (policy === 'everyone') return true;
  if (policy === 'admins') return rank >= GROUP_ROLE_RANK.admin;
  return rank >= GROUP_ROLE_RANK.moderator;
}

export function canInviteToGroup(conv, uid) {
  const rank = getGroupRoleRank(getMemberGroupRole(conv, uid));
  if (rank === 0) return false;
  const policy = conv?.settings?.whoCanInvite || DEFAULT_GROUP_SETTINGS.whoCanInvite;
  if (policy === 'everyone') return true;
  if (policy === 'admins') return rank >= GROUP_ROLE_RANK.admin;
  return rank >= GROUP_ROLE_RANK.moderator;
}

export function canSendToGroup(conv, uid) {
  const rank = getGroupRoleRank(getMemberGroupRole(conv, uid));
  if (rank === 0) return false;
  if (Array.isArray(conv?.mutedMembers) && conv.mutedMembers.includes(uid) && rank < GROUP_ROLE_RANK.moderator) {
    return false;
  }
  const policy = conv?.settings?.whoCanSend || DEFAULT_GROUP_SETTINGS.whoCanSend;
  if (policy === 'admins') return rank >= GROUP_ROLE_RANK.admin;
  if (policy === 'moderators') return rank >= GROUP_ROLE_RANK.moderator;
  return true;
}

export const COMMUNITY_CHANNEL_TYPES = ['discussion', 'announcements', 'events'];

export function getCommunityMemberRole(community, uid) {
  if (!community || !uid) return null;
  if (community.ownerId === uid || community.createdBy === uid) return 'owner';
  if (Array.isArray(community.admins) && community.admins.includes(uid)) return 'admin';
  if (Array.isArray(community.moderators) && community.moderators.includes(uid)) return 'moderator';
  if (Array.isArray(community.members) && community.members.includes(uid)) return 'member';
  return null;
}

export function canManageCommunityChannel(community, uid) {
  const role = getCommunityMemberRole(community, uid);
  return role === 'owner' || role === 'admin';
}

export function canModerateChannel(community, uid) {
  const role = getCommunityMemberRole(community, uid);
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

export function canPostInChannel(community, channel, uid) {
  if (!community || !channel || !uid) return false;
  const role = getCommunityMemberRole(community, uid);
  if (!role) return false;
  if (Array.isArray(community.bannedUsers) && community.bannedUsers.includes(uid)) return false;
  if (Array.isArray(community.mutedUsers) && community.mutedUsers.includes(uid) && role === 'member') {
    return false;
  }
  if (channel.isLocked && role !== 'owner' && role !== 'admin' && role !== 'moderator') {
    return false;
  }
  if (channel.type === 'announcements') {
    return role === 'owner' || role === 'admin' || role === 'moderator';
  }
  return true;
}

export const CALL_STATES = [
  'initiated',
  'ringing',
  'accepted',
  'connecting',
  'connected',
  'reconnecting',
  'ended',
  'rejected',
  'missed',
  'cancelled',
  'failed',
  'timed_out',
];

export const CALL_TERMINAL_STATES = new Set([
  'ended',
  'rejected',
  'missed',
  'cancelled',
  'failed',
  'timed_out',
]);

export const VALID_CALL_TRANSITIONS = Object.freeze({
  initiated: ['ringing', 'cancelled', 'failed'],
  ringing: ['accepted', 'rejected', 'missed', 'cancelled', 'timed_out', 'failed', 'ended'],
  accepted: ['connecting', 'connected', 'ended', 'failed', 'cancelled'],
  connecting: ['connected', 'reconnecting', 'ended', 'failed'],
  connected: ['reconnecting', 'ended', 'failed'],
  reconnecting: ['connected', 'ended', 'failed'],
  ended: [],
  rejected: [],
  missed: [],
  cancelled: [],
  failed: [],
  timed_out: [],
});

export function isValidCallTransition(fromState, toState) {
  if (!fromState || !toState) return false;
  if (fromState === toState) return true;
  const allowed = VALID_CALL_TRANSITIONS[fromState];
  return Array.isArray(allowed) && allowed.includes(toState);
}

export const CALL_LIMITS = Object.freeze({
  MAX_GROUP_CALL_PARTICIPANTS: 6,
  RING_TIMEOUT_MS: 45000,
});

/**
 * Extract unique lowercase @usernames mentioned in message text.
 */
export function extractMentionUsernames(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.matchAll(/(?:^|\s)@([A-Za-z0-9_.]{2,32})\b/g);
  const set = new Set();
  for (const m of matches) {
    if (m[1]) set.add(m[1].toLowerCase());
  }
  return Array.from(set).slice(0, 15);
}

function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Monotonic timestamp comparison: prevents older device sync events from rewinding
 * read cursors across concurrent devices.
 */
export function mergeMonotonicTimestamp(existingVal, incomingVal) {
  const a = toEpochMs(existingVal);
  const b = toEpochMs(incomingVal);
  if (b >= a) return incomingVal ?? existingVal ?? null;
  return existingVal ?? incomingVal ?? null;
}

export function mergeReadCursorMap(existingMap = {}, incomingMap = {}) {
  const merged = { ...(existingMap || {}) };
  if (!incomingMap || typeof incomingMap !== 'object') return merged;
  for (const [uid, val] of Object.entries(incomingMap)) {
    merged[uid] = mergeMonotonicTimestamp(merged[uid], val);
  }
  return merged;
}

/**
 * Resolve verified Royal Family standing safely from a user profile doc.
 * Note: server stores `activeTitle` as `{ id, name, ... }` object, never rely on raw equality.
 */
export function getRoyalStanding(userDoc) {
  if (!userDoc || typeof userDoc !== 'object') {
    return { isRoyal: false, titleId: null, titleName: null };
  }
  const activeId =
    typeof userDoc.activeTitle === 'object' && userDoc.activeTitle !== null
      ? String(userDoc.activeTitle.id || '').toLowerCase()
      : typeof userDoc.activeTitle === 'string'
        ? userDoc.activeTitle.toLowerCase()
        : '';
  const titles = Array.isArray(userDoc.titles)
    ? userDoc.titles.map((t) =>
        typeof t === 'object' && t !== null ? String(t.id || t.titleId || '').toLowerCase() : String(t || '').toLowerCase()
      )
    : [];
  const roles = Array.isArray(userDoc.roles) ? userDoc.roles.map((r) => String(r).toLowerCase()) : [];

  const ROYAL_IDS = ['king', 'queen', 'duke', 'royal', 'sovereign'];
  if (ROYAL_IDS.includes(activeId)) {
    return {
      isRoyal: true,
      titleId: activeId,
      titleName: (typeof userDoc.activeTitle === 'object' && userDoc.activeTitle?.name) || activeId.toUpperCase(),
    };
  }
  const matchedTitle = titles.find((t) => ROYAL_IDS.includes(t));
  if (matchedTitle) {
    return { isRoyal: true, titleId: matchedTitle, titleName: matchedTitle.toUpperCase() };
  }
  const matchedRole = roles.find((r) => ROYAL_IDS.includes(r));
  if (matchedRole) {
    return { isRoyal: true, titleId: matchedRole, titleName: matchedRole.toUpperCase() };
  }
  return { isRoyal: false, titleId: null, titleName: null };
}

