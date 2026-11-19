// src/config/vibeContracts.js
//
// Single source of truth for Arvdoul Vibes (Part 1 Core Experience) contracts,
// validation rules, audience options, playback duration math, and upload states.

import { BRAND_GRADIENT } from '../design-system/tokens.js';

export const VIBE_TYPES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
  TEXT: 'text',
  AUDIO: 'audio',
  EVENT: 'event',
});

export const VIBE_AUDIENCES = Object.freeze({
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  CONNECTIONS: 'connections',
  CLOSE_CIRCLE: 'close_circle',
  SELECTED: 'selected',
  PRIVATE: 'private',
});

export const VIBE_AUDIENCE_OPTIONS = Object.freeze([
  {
    id: VIBE_AUDIENCES.PUBLIC,
    label: 'Public',
    shortLabel: 'Public',
    description: 'Anyone on Arvdoul can view this Vibe (excluding blocked accounts).',
    requiresSelection: false,
  },
  {
    id: VIBE_AUDIENCES.FOLLOWERS,
    label: 'Followers',
    shortLabel: 'Followers',
    description: 'Visible only to approved followers and you.',
    requiresSelection: false,
  },
  {
    id: VIBE_AUDIENCES.CONNECTIONS,
    label: 'Connections',
    shortLabel: 'Connections',
    description: 'Mutual followers who follow you back.',
    requiresSelection: false,
  },
  {
    id: VIBE_AUDIENCES.CLOSE_CIRCLE,
    label: 'Close Circle',
    shortLabel: 'Close Circle',
    description: 'People in your curated Close Circle list.',
    requiresSelection: false,
  },
  {
    id: VIBE_AUDIENCES.SELECTED,
    label: 'Selected Users',
    shortLabel: 'Selected',
    description: 'Only the specific people you choose.',
    requiresSelection: true,
  },
  {
    id: VIBE_AUDIENCES.PRIVATE,
    label: 'Only Me',
    shortLabel: 'Private',
    description: 'Private Vibe visible solely to your account.',
    requiresSelection: false,
  },
]);

export const VIBE_UPLOAD_STATES = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const VIBE_LIMITS = Object.freeze({
  EXPIRY_HOURS: 24,
  EXPIRY_MS: 24 * 60 * 60 * 1000,
  IMAGE_MAX_BYTES: 10 * 1024 * 1024, // 10 MB
  VIDEO_MAX_BYTES: 100 * 1024 * 1024, // 100 MB
  AUDIO_MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  VIDEO_MAX_DURATION_SEC: 60,
  VIDEO_MIN_TRIM_SEC: 1,
  IMAGE_DEFAULT_DURATION_SEC: 5,
  TEXT_MIN_DURATION_SEC: 4,
  TEXT_MAX_DURATION_SEC: 10,
  TEXT_MAX_LENGTH: 500,
  OVERLAY_TEXT_MAX_LENGTH: 140,
  MAX_TEXT_OVERLAYS: 10,
  MAX_DRAWING_PATHS: 120,
  MAX_DRAWING_POINTS_PER_PATH: 600,
  MAX_SELECTED_USERS: 100,
  SAFE_MIN: 0.08,
  SAFE_MAX: 0.92,
});

export const VIBE_ALLOWED_IMAGE_TYPES = Object.freeze([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);

export const VIBE_ALLOWED_VIDEO_TYPES = Object.freeze([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

export const VIBE_TEXT_BACKGROUNDS = Object.freeze([
  {
    id: 'arvdoul-signature',
    label: 'Arvdoul Signal',
    background: BRAND_GRADIENT,
    textColor: '#FFFFFF',
  },
  {
    id: 'midnight-slate',
    label: 'Obsidian Ink',
    background: 'linear-gradient(155deg, #0B1026 0%, #161F42 100%)',
    textColor: '#F8FAFC',
  },
  {
    id: 'aurora-emerald',
    label: 'Emerald Pulse',
    background: 'linear-gradient(155deg, #064E3B 0%, #0F766E 55%, #0284C7 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'ember-sunset',
    label: 'Solar Dusk',
    background: 'linear-gradient(155deg, #9A3412 0%, #EA580C 52%, #CA8A04 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'crimson-velvet',
    label: 'Velvet Rose',
    background: 'linear-gradient(155deg, #881337 0%, #BE123C 55%, #E11D48 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'paper-daylight',
    label: 'Ivory Paper',
    background: 'linear-gradient(155deg, #F8FAFC 0%, #E2E8F0 100%)',
    textColor: '#0F172A',
  },
]);

export const VIBE_FONT_OPTIONS = Object.freeze([
  { id: 'display', label: 'Display', css: '"Clash Display", "Inter", system-ui, sans-serif' },
  { id: 'sans', label: 'Clean', css: '"Inter", system-ui, -apple-system, sans-serif' },
  { id: 'serif', label: 'Editorial', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', css: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
]);

export const VIBE_COLOR_PALETTE = Object.freeze([
  '#FFFFFF',
  '#0F172A',
  '#FACC15',
  '#38BDF8',
  '#34D399',
  '#FB7185',
  '#F97316',
  '#A5B4FC',
]);

export function getVibeFontCss(fontId) {
  const found = VIBE_FONT_OPTIONS.find((f) => f.id === fontId);
  return found ? found.css : VIBE_FONT_OPTIONS[0].css;
}

export function getAudienceMeta(audienceId) {
  return VIBE_AUDIENCE_OPTIONS.find((opt) => opt.id === audienceId) || VIBE_AUDIENCE_OPTIONS[0];
}

export function isValidAudience(audience) {
  return Object.values(VIBE_AUDIENCES).includes(audience);
}

export function validateVibeMedia(file, { durationSec = null } = {}) {
  if (!file) {
    return { valid: false, kind: null, error: 'Please select a photo or video file.' };
  }
  const mime = String(file.type || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, kind: null, error: 'Unsupported media format. Choose a photo or video.' };
  }

  if (isImage) {
    if (mime && VIBE_ALLOWED_IMAGE_TYPES.length && !VIBE_ALLOWED_IMAGE_TYPES.includes(mime)) {
      return { valid: false, kind: 'image', error: `Unsupported image type (${mime}). Use JPEG, PNG, WebP, or HEIC.` };
    }
    if (typeof file.size === 'number' && file.size > VIBE_LIMITS.IMAGE_MAX_BYTES) {
      return { valid: false, kind: 'image', error: 'Image must be 10 MB or smaller.' };
    }
    return { valid: true, kind: 'image', error: null };
  }

  if (mime && VIBE_ALLOWED_VIDEO_TYPES.length && !VIBE_ALLOWED_VIDEO_TYPES.includes(mime)) {
    return { valid: false, kind: 'video', error: `Unsupported video format (${mime}). Use MP4, WebM, or MOV.` };
  }
  if (typeof file.size === 'number' && file.size > VIBE_LIMITS.VIDEO_MAX_BYTES) {
    return { valid: false, kind: 'video', error: 'Video must be 100 MB or smaller.' };
  }
  if (typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec <= 0) {
    return { valid: false, kind: 'video', error: 'Video duration could not be read.' };
  }
  return { valid: true, kind: 'video', error: null };
}

export function validateVibeText(content) {
  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    return { valid: false, trimmed: '', error: 'Write something before publishing your text Vibe.' };
  }
  if (trimmed.length > VIBE_LIMITS.TEXT_MAX_LENGTH) {
    return {
      valid: false,
      trimmed: trimmed.slice(0, VIBE_LIMITS.TEXT_MAX_LENGTH),
      error: `Text Vibes can be up to ${VIBE_LIMITS.TEXT_MAX_LENGTH} characters.`,
    };
  }
  return { valid: true, trimmed, error: null };
}

export function validateAudienceSelection(audience, selectedUserIds = []) {
  const normalizedAudience = isValidAudience(audience) ? audience : null;
  if (!normalizedAudience) {
    return { valid: false, audience: null, selectedUserIds: [], error: 'Choose a valid audience.' };
  }
  const uniqueSelected = Array.isArray(selectedUserIds)
    ? [...new Set(selectedUserIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, VIBE_LIMITS.MAX_SELECTED_USERS)
    : [];
  if (normalizedAudience === VIBE_AUDIENCES.SELECTED && uniqueSelected.length === 0) {
    return {
      valid: false,
      audience: normalizedAudience,
      selectedUserIds: [],
      error: 'Select at least one user for a Selected Users Vibe.',
    };
  }
  return {
    valid: true,
    audience: normalizedAudience,
    selectedUserIds: normalizedAudience === VIBE_AUDIENCES.SELECTED ? uniqueSelected : [],
    error: null,
  };
}

export function clampOverlayPosition(x, y) {
  const clamp = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 0.5;
    return Math.min(VIBE_LIMITS.SAFE_MAX, Math.max(VIBE_LIMITS.SAFE_MIN, num));
  };
  return { x: clamp(x), y: clamp(y) };
}

export function sanitizeTextOverlays(overlays = []) {
  if (!Array.isArray(overlays)) return [];
  return overlays
    .slice(0, VIBE_LIMITS.MAX_TEXT_OVERLAYS)
    .map((item, index) => {
      const text = String(item?.text || '').trim().slice(0, VIBE_LIMITS.OVERLAY_TEXT_MAX_LENGTH);
      if (!text) return null;
      const pos = clampOverlayPosition(item?.x ?? 0.5, item?.y ?? 0.5);
      const scaleNum = Number(item?.scale);
      const scale = Number.isFinite(scaleNum) ? Math.min(2.2, Math.max(0.6, scaleNum)) : 1;
      const rotationNum = Number(item?.rotation);
      const rotation = Number.isFinite(rotationNum) ? Math.max(-180, Math.min(180, rotationNum)) : 0;
      return {
        id: String(item?.id || `overlay_${index}`),
        text,
        x: pos.x,
        y: pos.y,
        color: typeof item?.color === 'string' && item.color ? item.color : '#FFFFFF',
        bgStyle: ['none', 'pill', 'solid'].includes(item?.bgStyle) ? item.bgStyle : 'pill',
        font: VIBE_FONT_OPTIONS.some((f) => f.id === item?.font) ? item.font : 'sans',
        align: ['left', 'center', 'right'].includes(item?.align) ? item.align : 'center',
        scale,
        rotation,
      };
    })
    .filter(Boolean);
}

export function sanitizeDrawingPaths(paths = []) {
  if (!Array.isArray(paths)) return [];
  return paths
    .slice(0, VIBE_LIMITS.MAX_DRAWING_PATHS)
    .map((stroke, idx) => {
      const rawPoints = Array.isArray(stroke?.points) ? stroke.points : [];
      const points = rawPoints
        .slice(0, VIBE_LIMITS.MAX_DRAWING_POINTS_PER_PATH)
        .map((pt) => {
          const x = Number(pt?.x);
          const y = Number(pt?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return {
            x: Math.min(1, Math.max(0, Math.round(x * 10000) / 10000)),
            y: Math.min(1, Math.max(0, Math.round(y * 10000) / 10000)),
          };
        })
        .filter(Boolean);
      if (points.length === 0) return null;
      const widthNum = Number(stroke?.size ?? stroke?.width);
      return {
        id: String(stroke?.id || `stroke_${idx}`),
        color: typeof stroke?.color === 'string' && stroke.color ? stroke.color : '#FFFFFF',
        size: Number.isFinite(widthNum) ? Math.min(28, Math.max(2, widthNum)) : 5,
        mode: stroke?.mode === 'eraser' ? 'eraser' : 'draw',
        points,
      };
    })
    .filter(Boolean);
}

export function calculateVibeDuration(vibe = {}) {
  const type = String(vibe?.type || '').toLowerCase();
  if (type === VIBE_TYPES.VIDEO || vibe?.media?.type === 'video' || vibe?.mediaType === 'video') {
    const start = Math.max(0, Number(vibe?.mediaEdits?.trimStart ?? vibe?.trimStart ?? 0) || 0);
    const rawDuration = Number(vibe?.media?.duration ?? vibe?.duration ?? 0);
    const end = Number(vibe?.mediaEdits?.trimEnd ?? vibe?.trimEnd ?? rawDuration);
    if (Number.isFinite(end) && end > start) {
      return Math.min(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC, Math.max(VIBE_LIMITS.VIDEO_MIN_TRIM_SEC, end - start));
    }
    if (Number.isFinite(rawDuration) && rawDuration > 0) {
      return Math.min(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC, Math.max(VIBE_LIMITS.VIDEO_MIN_TRIM_SEC, rawDuration));
    }
    return 15;
  }
  if (type === VIBE_TYPES.TEXT) {
    const text = String(vibe?.content || '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const computed = Math.ceil(words / 2.8 + 2.5);
    return Math.min(VIBE_LIMITS.TEXT_MAX_DURATION_SEC, Math.max(VIBE_LIMITS.TEXT_MIN_DURATION_SEC, computed));
  }
  const explicit = Number(vibe?.duration);
  if (Number.isFinite(explicit) && explicit >= 3 && explicit <= 30) {
    return explicit;
  }
  return VIBE_LIMITS.IMAGE_DEFAULT_DURATION_SEC;
}

export function resolveVibeExpiryMs(vibe) {
  if (!vibe || !vibe.expiresAt) return null;
  const raw = vibe.expiresAt;
  if (typeof raw?.toDate === 'function') {
    const ms = raw.toDate().getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    return raw.seconds * 1000;
  }
  const ms = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function isVibeExpired(vibe, nowMs = Date.now()) {
  if (!vibe) return true;
  if (vibe.status === 'expired' || vibe.status === 'removed' || vibe.isDeleted === true) {
    return true;
  }
  const expMs = resolveVibeExpiryMs(vibe);
  if (expMs === null) return false;
  return expMs <= nowMs;
}

export function createVibeIdempotencyKey(userId = 'anon') {
  const rand =
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `vibe_${String(userId || 'anon').slice(0, 12)}_${rand}`;
}

export const VIBE_REACTIONS = Object.freeze([
  Object.freeze({ key: 'like', label: 'Like', iconName: 'ThumbsUp', tone: 'blue' }),
  Object.freeze({ key: 'love', label: 'Love', iconName: 'Heart', tone: 'rose' }),
  Object.freeze({ key: 'laugh', label: 'Laugh', iconName: 'Laugh', tone: 'amber' }),
  Object.freeze({ key: 'celebrate', label: 'Celebrate', iconName: 'PartyPopper', tone: 'purple' }),
  Object.freeze({ key: 'wow', label: 'Wow', iconName: 'Sparkles', tone: 'cyan' }),
  Object.freeze({ key: 'support', label: 'Support', iconName: 'HandHeart', tone: 'emerald' }),
  Object.freeze({ key: 'sad', label: 'Sad', iconName: 'Frown', tone: 'slate' }),
]);

export const VIBE_REACTION_KEYS = Object.freeze(VIBE_REACTIONS.map((item) => item.key));

export const VIBE_LEGACY_REACTION_MAP = Object.freeze({
  '👍': 'like',
  '❤️': 'love',
  '♥': 'love',
  '💖': 'love',
  '😂': 'laugh',
  '🤣': 'laugh',
  '👏': 'celebrate',
  '🔥': 'celebrate',
  '🎉': 'celebrate',
  '😮': 'wow',
  '🤩': 'wow',
  '🤝': 'support',
  '💎': 'support',
  '😢': 'sad',
  '😭': 'sad',
});

export function normalizeVibeReactionKey(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (VIBE_REACTION_KEYS.includes(lower)) return lower;
  return VIBE_LEGACY_REACTION_MAP[trimmed] || null;
}

export const VIBE_POLICY_SCOPES = Object.freeze({
  EVERYONE: 'everyone',
  FOLLOWERS: 'followers',
  CONNECTIONS: 'connections',
  CLOSE_CIRCLE: 'close_circle',
  NOBODY: 'nobody',
});

export const VIBE_POLICY_SCOPE_OPTIONS = Object.freeze([
  Object.freeze({ id: VIBE_POLICY_SCOPES.EVERYONE, label: 'Everyone who can view', shortLabel: 'Everyone' }),
  Object.freeze({ id: VIBE_POLICY_SCOPES.FOLLOWERS, label: 'Followers', shortLabel: 'Followers' }),
  Object.freeze({ id: VIBE_POLICY_SCOPES.CONNECTIONS, label: 'Mutual Connections', shortLabel: 'Connections' }),
  Object.freeze({ id: VIBE_POLICY_SCOPES.CLOSE_CIRCLE, label: 'Close Circle', shortLabel: 'Close Circle' }),
  Object.freeze({ id: VIBE_POLICY_SCOPES.NOBODY, label: 'Off (Nobody)', shortLabel: 'Nobody' }),
]);

export const VIBE_DEFAULT_SETTINGS = Object.freeze({
  autoArchive: true,
  whoCanReact: VIBE_POLICY_SCOPES.EVERYONE,
  whoCanReply: VIBE_POLICY_SCOPES.EVERYONE,
  whoCanShare: VIBE_POLICY_SCOPES.FOLLOWERS,
  whoCanSendGifts: VIBE_POLICY_SCOPES.EVERYONE,
  showReactionDetails: true,
  showViewingActivity: true,
  vibeNotifications: true,
  giftNotifications: true,
});

export const VIBE_MESSAGE_ATTACHMENT_TYPE = 'vibe';

export const VIBE_MILESTONE_THRESHOLDS = Object.freeze([25, 100, 500, 1000]);

export const VIBE_REPORT_REASONS = Object.freeze([
  Object.freeze({ id: 'harassment', label: 'Harassment or bullying' }),
  Object.freeze({ id: 'spam', label: 'Spam or misleading promotion' }),
  Object.freeze({ id: 'hate_speech', label: 'Hate speech or abusive content' }),
  Object.freeze({ id: 'nudity', label: 'Explicit or inappropriate media' }),
  Object.freeze({ id: 'violence', label: 'Violence or dangerous behavior' }),
  Object.freeze({ id: 'misinformation', label: 'Harmful misinformation' }),
  Object.freeze({ id: 'scam', label: 'Scam or impersonation' }),
  Object.freeze({ id: 'other', label: 'Other safety concern' }),
]);

export function buildVibeDeepLink(vibeId) {
  const cleanId = String(vibeId || '').trim();
  if (!cleanId) return '/stories';
  return `/stories?vibeId=${encodeURIComponent(cleanId)}`;
}

export function buildVibeShareAttachment(vibe = {}, creator = null) {
  const vibeId = vibe?.id || vibe?.storyId || '';
  const ownerId = vibe?.userId || vibe?.ownerId || creator?.uid || creator?.id || null;
  const ownerName =
    creator?.displayName ||
    creator?.username ||
    vibe?.user?.displayName ||
    vibe?.userName ||
    null;
  const ownerPhoto =
    creator?.photoURL ||
    vibe?.user?.photoURL ||
    vibe?.userPhoto ||
    null;
  const mediaType = vibe?.type || (vibe?.media?.type?.startsWith?.('video/') ? 'video' : 'image');
  const thumbnailUrl = vibe?.media?.coverUrl || vibe?.media?.url || null;
  const previewText = typeof vibe?.content === 'string' && vibe.content.trim()
    ? vibe.content.trim().slice(0, 140)
    : null;
  const expiresAtMs = resolveVibeExpiryMs(vibe);
  return {
    type: VIBE_MESSAGE_ATTACHMENT_TYPE,
    vibeId,
    ownerId,
    ownerName,
    ownerPhoto,
    mediaType,
    thumbnailUrl,
    previewText,
    backgroundColor: vibe?.backgroundColor || null,
    expiresAtMs,
    deepLink: buildVibeDeepLink(vibeId),
  };
}

export function computeVibeNavigationTarget(groups = [], creatorIndex = 0, itemIndex = 0, direction = 'next') {
  const currentGroup = groups[creatorIndex];
  if (!currentGroup || !Array.isArray(currentGroup.stories) || currentGroup.stories.length === 0) {
    return { action: 'close', creatorIndex: 0, itemIndex: 0 };
  }

  if (direction === 'next') {
    if (itemIndex + 1 < currentGroup.stories.length) {
      return { action: 'slide', creatorIndex, itemIndex: itemIndex + 1 };
    }
    if (creatorIndex + 1 < groups.length) {
      return { action: 'creator', creatorIndex: creatorIndex + 1, itemIndex: 0 };
    }
    return { action: 'close', creatorIndex, itemIndex };
  }

  // previous
  if (itemIndex > 0) {
    return { action: 'slide', creatorIndex, itemIndex: itemIndex - 1 };
  }
  if (creatorIndex > 0) {
    const prevGroup = groups[creatorIndex - 1];
    const lastIdx = Math.max(0, (prevGroup?.stories?.length || 1) - 1);
    return { action: 'creator', creatorIndex: creatorIndex - 1, itemIndex: lastIdx };
  }
  return { action: 'restart', creatorIndex: 0, itemIndex: 0 };
}

export default {
  VIBE_TYPES,
  VIBE_AUDIENCES,
  VIBE_AUDIENCE_OPTIONS,
  VIBE_UPLOAD_STATES,
  VIBE_LIMITS,
  VIBE_TEXT_BACKGROUNDS,
  VIBE_FONT_OPTIONS,
  VIBE_COLOR_PALETTE,
  VIBE_REACTIONS,
  VIBE_REACTION_KEYS,
  VIBE_LEGACY_REACTION_MAP,
  VIBE_POLICY_SCOPES,
  VIBE_POLICY_SCOPE_OPTIONS,
  VIBE_DEFAULT_SETTINGS,
  VIBE_MESSAGE_ATTACHMENT_TYPE,
  VIBE_MILESTONE_THRESHOLDS,
  VIBE_REPORT_REASONS,
  getVibeFontCss,
  getAudienceMeta,
  isValidAudience,
  validateVibeMedia,
  validateVibeText,
  validateAudienceSelection,
  clampOverlayPosition,
  sanitizeTextOverlays,
  sanitizeDrawingPaths,
  calculateVibeDuration,
  resolveVibeExpiryMs,
  isVibeExpired,
  createVibeIdempotencyKey,
  normalizeVibeReactionKey,
  buildVibeDeepLink,
  buildVibeShareAttachment,
  computeVibeNavigationTarget,
};
