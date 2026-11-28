/**
 * Production-grade Arvdoul Edit Profile screen (single-file replacement).
 *
 * Architecture (all inside this file, per the one-file rule):
 *   EditProfileScreen   gate: authenticated UID is the only identity authority; renders loading /
 *                       unavailable states and mounts the editor keyed by UID. The key remounts
 *                       the editor on any account change, which is the centralised account reset:
 *                       every piece of form, avatar, username, settings and modal state, plus every
 *                       ref and in-flight guard, is discarded together.
 *   EditProfileEditor   composition layer (header, section nav, sections, sticky action bar).
 *   hooks               useAlive, useUsernameAvailability, useAvatarEditor, useInteractionSettings.
 *   sections            small memoised components that receive only the slices they render.
 *
 * Scope notes:
 * - No cover/background images. Circular 1:1 avatar only.
 * - Persistence goes through the existing canonical calls only (AuthContext.updateUserProfile,
 *   falling back to userService.updateUserProfile; userService.uploadAvatar; settingsService).
 * - Client checks are UX only. Username uniqueness, privacy, creator/royal entitlements and
 *   location projection must be enforced by the backend and read model (see delivery notes).
 *
 * @component
 */

import {
  Suspense, lazy, memo, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState,
} from "react";
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import {
  Camera, Save, User, MapPin, Globe, Plus, Trash2, Lock, Sparkles, RefreshCw, CheckCircle2,
  AlertCircle, Link as LinkIcon, Star, Coins, Crown, Briefcase,
  ShieldCheck, Flame, LayoutGrid, Palette, MessageSquare, Phone, Users, Gift, Sliders, UserX,
  ChevronRight, ChevronUp, ChevronDown, Copy, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore, patchCachedProfile, invalidateProfileCache } from '../../store/profileStore';
import {
  PROFILE_TYPES,
  VISIBILITY_SCOPES,
  DEFAULT_PROFILE_PRIVACY,
  PROFILE_CONSTRAINTS,
  sanitizeProfileUrl,
  validateProfileUpdate,
} from '../../config/profileContracts.js';
import { settingsService, DEFAULT_SETTINGS } from '../../services/settingsService.js';
import { isPlaceholderHandle, resolveCreatorFlag, resolveRoyalFlag } from '../../services/profileReadModel.js';
import { Dialog } from '../../components/UI/Dialog.jsx';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { BRAND_GRADIENT, brandRgba } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useAppStore } from '../../store/appStore';

// Secondary modals are only loaded when opened (keeps the editor light on low-end devices).
const ProfileLocationModal = lazy(() => import('../../components/profile/ProfileLocationModal'));
const AvatarUploadModal = lazy(() => import('../../components/profile/AvatarUploadModal'));

/* ============================================================================================
 * Static definitions
 * ========================================================================================== */

const PROFILE_TYPE_OPTIONS = [
  { id: PROFILE_TYPES.PERSONAL, label: 'Personal', hint: 'Individual citizen profile' },
  { id: PROFILE_TYPES.CREATOR, label: 'Creator', hint: 'Artists, makers & publishers' },
  { id: PROFILE_TYPES.BUSINESS, label: 'Business', hint: 'Brands & studios' },
  { id: PROFILE_TYPES.ORGANIZATION, label: 'Organization', hint: 'Institutions & nonprofits' },
  { id: PROFILE_TYPES.COMMUNITY, label: 'Community', hint: 'Clubs & collectives' },
];

const PRONOUN_PRESETS = ['they/them', 'she/her', 'he/him'];

const PLATFORM_PRESETS = [
  { id: 'website', label: 'Website' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'github', label: 'GitHub' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'discord', label: 'Discord' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'custom', label: 'Custom Link' },
];
const PLATFORM_IDS = new Set(PLATFORM_PRESETS.map((p) => p.id));
const platformLabel = (id) => (PLATFORM_PRESETS.find((p) => p.id === id) || { label: 'Link' }).label;

const CREATOR_CATEGORIES = [
  'Music & Audio', 'Visual Arts & 3D', 'Tech & Software', 'Gaming & Interactive',
  'Writing & Journalism', 'Education & Science', 'Fashion & Lifestyle',
  'Community & Civic Governance', 'Entertainment & Comedy',
];

// `ring` is used for the selected-state ring on the swatch (it was previously declared but unused).
const CREST_AURAS = [
  { id: 'gold', label: 'Solar Gold', color: 'from-amber-400 to-yellow-500', swatch: 'linear-gradient(135deg,#FBBF24,#EAB308)' },
  { id: 'purple', label: 'Imperial Purple', color: 'from-purple-500 to-indigo-600', swatch: 'linear-gradient(135deg,#A855F7,#4F46E5)' },
  { id: 'royal', label: 'Crown Sapphire', color: 'from-blue-500 to-indigo-700', swatch: 'linear-gradient(135deg,#3B82F6,#4338CA)' },
  { id: 'cyan', label: 'Astral Cyan', color: 'from-cyan-400 to-teal-500', swatch: 'linear-gradient(135deg,#22D3EE,#14B8A6)' },
  { id: 'emerald', label: 'Sovereign Emerald', color: 'from-emerald-400 to-green-600', swatch: 'linear-gradient(135deg,#34D399,#16A34A)' },
];
const CREST_IDS = new Set(CREST_AURAS.map((a) => a.id));

// Profile tab ids follow the canonical ProfileTabsBar registry ('stories' is the Vibes tab).
// Saved is owner-only and Citizenship/About are sections, so none are offered as a public default.
const DEFAULT_TAB_OPTIONS = [
  { id: 'posts', label: 'Posts' },
  { id: 'videos', label: 'Videos' },
  { id: 'reels', label: 'Reels' },
  { id: 'photos', label: 'Photos' },
  { id: 'stories', label: 'Vibes' },
  { id: 'audio', label: 'Audio' },
  { id: 'tagged', label: 'Tagged' },
];
const DEFAULT_TAB_IDS = new Set(DEFAULT_TAB_OPTIONS.map((t) => t.id));

const LOCATION_PRIVACY_OPTIONS = [
  { id: 'public', label: 'City & Country' },
  { id: 'country_only', label: 'Country Only' },
  { id: 'hidden', label: 'Hidden' },
];
const LOCATION_PRIVACY_IDS = new Set(LOCATION_PRIVACY_OPTIONS.map((o) => o.id));

// Visibility options come from the canonical VISIBILITY_SCOPES; only the label wording lives here.
const SCOPE_LABELS = {
  EVERYONE: 'Everyone', PUBLIC: 'Everyone', FOLLOWERS: 'Followers', CONNECTIONS: 'Friends',
  FRIENDS: 'Friends', ONLY_ME: 'Only me', PRIVATE: 'Only me',
};
const titleCase = (s) => String(s).toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const SCOPE_ENTRIES = Object.entries(VISIBILITY_SCOPES || {}).filter(([, v]) => typeof v === 'string');
const SCOPE_OPTIONS = SCOPE_ENTRIES.map(([key, value]) => ({ value, label: SCOPE_LABELS[key] || titleCase(key) }));
const SCOPE_VALUES = new Set(SCOPE_OPTIONS.map((o) => o.value));
const BROAD_SCOPES = new Set([VISIBILITY_SCOPES.EVERYONE, VISIBILITY_SCOPES.FOLLOWERS].filter(Boolean));
const ECONOMIC_OPTIONS = SCOPE_OPTIONS.filter((o) =>
  [VISIBILITY_SCOPES.ONLY_ME, VISIBILITY_SCOPES.CONNECTIONS, VISIBILITY_SCOPES.EVERYONE].includes(o.value));

const PRIVACY_KEYS = [
  'profileInfo', 'links', 'presence', 'creatorInfo', 'followersList', 'followingList', 'activity',
  'achievements', 'titles', 'communities', 'collections', 'economicStatus',
];
// A dedicated friends-list control is shown only when the canonical contract defines it.
const HAS_FRIENDS_LIST = Object.prototype.hasOwnProperty.call(DEFAULT_PROFILE_PRIVACY || {}, 'friendsList');

// Interaction preferences live in the canonical account settings (settingsService), not the profile doc.
const INTERACTION_FIELDS = [
  { key: 'allowDMs', label: 'Direct messages', hint: 'Who can send you new message requests', icon: MessageSquare,
    options: [['everyone', 'Everyone'], ['friends', 'Friends only'], ['none', 'Nobody']] },
  { key: 'whoCanCall', label: 'Voice & video calls', hint: 'Who can start a call with you', icon: Phone,
    options: [['everyone', 'Everyone'], ['followers', 'Followers'], ['friends', 'Friends only'], ['none', 'Nobody']] },
  { key: 'whoCanAddToGroups', label: 'Group & space invites', hint: 'Who can add you to group conversations', icon: Users,
    options: [['everyone', 'Everyone'], ['followers', 'Followers'], ['friends', 'Friends only'], ['none', 'Nobody']] },
  { key: 'whoCanSendGifts', label: 'Coin gifts & tips', hint: 'Who can send coin gifts to your treasury', icon: Gift,
    options: [['everyone', 'Everyone'], ['friends', 'Friends only'], ['none', 'Nobody']] },
];

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // local sanity limit; storage rules stay authoritative
const AVATAR_MIN_SIDE = 96;

const BOUND = (obj, fallback) => (obj && Number.isInteger(obj.MAX_LENGTH) ? obj.MAX_LENGTH : fallback);
const NAME_MAX = BOUND(PROFILE_CONSTRAINTS?.DISPLAY_NAME, 50);
const STATUS_MAX = BOUND(PROFILE_CONSTRAINTS?.STATUS, 100);
const BIO_MAX = BOUND(PROFILE_CONSTRAINTS?.BIO, 500);
const PRONOUNS_MAX = BOUND(PROFILE_CONSTRAINTS?.PRONOUNS, 30);
const PROFESSION_MAX = BOUND(PROFILE_CONSTRAINTS?.PROFESSION, 80);
const EDUCATION_MAX = BOUND(PROFILE_CONSTRAINTS?.EDUCATION, 100);
const GENDER_MAX = BOUND(PROFILE_CONSTRAINTS?.GENDER, 40);
const LOCATION_MAX = BOUND(PROFILE_CONSTRAINTS?.LOCATION, 100);
const LINK_MAX = Number.isInteger(PROFILE_CONSTRAINTS?.LINKS?.MAX_COUNT) ? PROFILE_CONSTRAINTS.LINKS.MAX_COUNT : 10;
const LINK_TITLE_MAX = Number.isInteger(PROFILE_CONSTRAINTS?.LINKS?.TITLE_MAX_LENGTH) ? PROFILE_CONSTRAINTS.LINKS.TITLE_MAX_LENGTH : 40;
const UCON = (PROFILE_CONSTRAINTS && PROFILE_CONSTRAINTS.USERNAME) || {};
const USERNAME_MIN = Number.isInteger(UCON.MIN_LENGTH) ? UCON.MIN_LENGTH : 3;
const USERNAME_MAX = Number.isInteger(UCON.MAX_LENGTH) ? UCON.MAX_LENGTH : 30;
const USERNAME_RE = new RegExp(`^[a-z0-9._]{${USERNAME_MIN},${USERNAME_MAX}}$`);
const INQUIRY_EMAIL_MAX = 100;
const TIP_MAX = 200;
const MOTTO_MAX = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORM_KEYS = [
  'displayName', 'username', 'bio', 'tagline', 'location', 'locationPrivacy', 'website', 'pronouns',
  'profession', 'education', 'gender', 'profileType', 'isPrivate', 'links', 'privacy',
  'creatorCategory', 'inquiriesEmail', 'tipMessage', 'heraldicMotto', 'crestAura',
  'showLevel', 'showReputation', 'showStreak', 'defaultTab',
];

/* ============================================================================================
 * Pure helpers (no React, no I/O)
 * ========================================================================================== */
// <pure-helpers>
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Structural equality for form values (primitives, arrays, plain objects). */
const valuesEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!valuesEqual(a[i], b[i])) return false;
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(b, k) || !valuesEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
};

/** Single-line text: NFC, control characters removed, whitespace collapsed. */
const singleLine = (v) => (typeof v === 'string'
  ? v.normalize('NFC').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
  : '');
/** Multi-line text: NFC, CRLF normalised, trailing spaces and runs of blank lines removed. */
const multiLine = (v) => (typeof v === 'string'
  ? v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[^\S\n]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  : '');

const normalizeUsername = (v) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9._]/g, '') : '');

const toSafeLevel = (v) => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : null;
};

let idCounter = 0;
const makeId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  idCounter += 1;
  return `link_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
};

/** Exactly one primary link whenever links exist (first link when none or several are flagged). */
const ensureSinglePrimary = (links) => {
  if (!links.length) return links;
  const found = links.findIndex((l) => l.isPrimary === true);
  const idx = found < 0 ? 0 : found;
  return links.map((l, i) => (l.isPrimary === (i === idx) ? l : { ...l, isPrimary: i === idx }));
};

/** Hydration is deterministic (no random ids) so remote re-syncs never look like user edits. */
const normalizeLinks = (raw) => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((item, index) => {
    if (!isPlainObject(item)) return;
    let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim()
      : (typeof item.id === 'number' && Number.isFinite(item.id) ? String(item.id) : '');
    if (!id || seen.has(id)) id = `legacy-${index}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    out.push({
      id,
      title: typeof item.title === 'string' ? item.title : '',
      url: typeof item.url === 'string' ? item.url : '',
      platform: PLATFORM_IDS.has(item.platform) ? item.platform : 'custom',
      isPrimary: item.isPrimary === true,
    });
  });
  return ensureSinglePrimary(out);
};

const removeLinkById = (links, id) => ensureSinglePrimary(links.filter((l) => l.id !== id));
const setPrimaryLink = (links, id) => links.map((l) => (l.isPrimary === (l.id === id) ? l : { ...l, isPrimary: l.id === id }));
const moveLink = (links, index, delta) => {
  const to = index + delta;
  if (index < 0 || index >= links.length || to < 0 || to >= links.length) return links;
  const next = links.slice();
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
};

const legacyScope = (v) => (v === 'private' ? VISIBILITY_SCOPES.ONLY_ME : v === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : null);
const legacyPresence = (v) => (v === 'public' ? VISIBILITY_SCOPES.EVERYONE : legacyScope(v));

/** Derive an editable form from a profile. Legacy values are migrated per property, never by
 *  borrowing one setting from a different one. */
function profileToForm(src, ctx = {}) {
  const s = isPlainObject(src) ? src : {};
  const p = isPlainObject(s.privacy) ? s.privacy : {};
  const D = DEFAULT_PROFILE_PRIVACY || {};

  const privacy = {
    ...D,
    ...p,
    profileInfo: p.profileInfo || legacyScope(p.profileVisibility) || D.profileInfo,
    presence: p.presence || legacyPresence(p.onlinePresence) || D.presence,
    followersList: p.followersList || legacyScope(p.followersVisibility) || D.followersList,
    followingList: p.followingList || legacyScope(p.followersVisibility) || D.followingList,
    activity: p.activity || legacyScope(p.activityVisibility) || D.activity,
    achievements: p.achievements || legacyScope(p.activityVisibility) || D.achievements,
    creatorInfo: p.creatorInfo || D.creatorInfo,
    // The treasury defaults to private whenever no canonical value exists.
    economicStatus: p.economicStatus || D.economicStatus || VISIBILITY_SCOPES.ONLY_ME,
  };
  PRIVACY_KEYS.forEach((key) => {
    if (privacy[key] === undefined) { delete privacy[key]; return; }
    if (!SCOPE_VALUES.has(privacy[key])) {
      if (SCOPE_VALUES.has(D[key])) privacy[key] = D[key];
      else delete privacy[key];
    }
  });
  if (!SCOPE_VALUES.has(privacy.economicStatus)) privacy.economicStatus = VISIBILITY_SCOPES.ONLY_ME;

  let username = typeof s.username === 'string' ? s.username : '';
  if (isPlaceholderHandle(username)) {
    const email = typeof (s.email || ctx.email) === 'string' ? (s.email || ctx.email) : '';
    const fromEmail = normalizeUsername(email.split('@')[0] || '');
    const fromName = normalizeUsername(typeof s.displayName === 'string' ? s.displayName : '');
    const suggestion = [fromEmail, fromName].find((c) => USERNAME_RE.test(c));
    username = suggestion || '';
  }

  return {
    displayName: typeof s.displayName === 'string' ? s.displayName : '',
    username,
    bio: typeof s.bio === 'string' ? s.bio : '',
    tagline: typeof s.tagline === 'string' ? s.tagline : '',
    location: typeof s.location === 'string' ? s.location : '',
    locationPrivacy: LOCATION_PRIVACY_IDS.has(s.locationPrivacy) ? s.locationPrivacy : 'public',
    website: typeof s.website === 'string' ? s.website : '',
    pronouns: typeof s.pronouns === 'string' ? s.pronouns : '',
    profession: typeof s.profession === 'string' ? s.profession : '',
    education: typeof s.education === 'string' ? s.education : '',
    gender: typeof s.gender === 'string' ? s.gender : '',
    profileType: Object.values(PROFILE_TYPES).includes(s.profileType) ? s.profileType : PROFILE_TYPES.PERSONAL,
    isPrivate: s.isPrivate === true,
    links: normalizeLinks(s.links),
    privacy,
    creatorCategory: typeof s.creatorCategory === 'string' ? s.creatorCategory : '',
    inquiriesEmail: typeof s.inquiriesEmail === 'string' ? s.inquiriesEmail : '',
    tipMessage: typeof s.tipMessage === 'string' ? s.tipMessage : '',
    heraldicMotto: typeof s.heraldicMotto === 'string' ? s.heraldicMotto : '',
    crestAura: CREST_IDS.has(s.crestAura) ? s.crestAura : 'gold',
    showLevel: s.showLevel !== false,
    showReputation: s.showReputation !== false,
    showStreak: s.showStreak !== false,
    defaultTab: DEFAULT_TAB_IDS.has(s.defaultTab) ? s.defaultTab : 'posts',
  };
}

/** Preview only: the country is taken to be the last comma-separated part of the stored text.
 *  Real country-only projection must be applied by the profile read model. */
const countryOf = (location) => {
  const text = singleLine(location);
  if (!text) return '';
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
};

/**
 * Normalise + pre-validate the form. Returns field errors (keyed by field id, link errors by link id)
 * and the raw update payload that is then passed through the canonical validateProfileUpdate.
 * Hidden creator/royal sections contribute no fields, and a hidden location is never overwritten.
 */
function prepareUpdates(form, opts) {
  const { creatorUnlocked, royalUnlocked } = opts;
  const errors = {};
  const linkErrors = {};

  const username = normalizeUsername(form.username);
  if (!username) errors.username = 'Username cannot be empty';
  else if (!USERNAME_RE.test(username)) {
    errors.username = `Use ${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, dots or underscores`;
  }

  const displayName = singleLine(form.displayName);
  if (!displayName) errors.displayName = 'Display name is required';

  let website = singleLine(form.website);
  if (website) {
    const safe = sanitizeProfileUrl(website);
    if (!safe) errors.website = 'Enter a valid web address (e.g. https://yourdomain.com)';
    else website = safe;
  }

  const links = [];
  (Array.isArray(form.links) ? form.links : []).forEach((l) => {
    const url = singleLine(l.url);
    const platform = PLATFORM_IDS.has(l.platform) ? l.platform : 'custom';
    if (!url) { linkErrors[l.id] = { url: 'Add a URL or remove this link' }; return; }
    const safe = sanitizeProfileUrl(url);
    if (!safe) { linkErrors[l.id] = { url: 'Enter a valid web address' }; return; }
    links.push({
      id: l.id,
      platform,
      url: safe,
      title: (singleLine(l.title) || platformLabel(platform)).slice(0, LINK_TITLE_MAX),
      isPrimary: l.isPrimary === true,
    });
  });
  if (Object.keys(linkErrors).length) errors.links = 'Fix the highlighted links or remove them.';

  const privacy = {};
  Object.entries(isPlainObject(form.privacy) ? form.privacy : {}).forEach(([k, v]) => {
    if (SCOPE_VALUES.has(v)) privacy[k] = v;
    else if (v !== undefined) errors.privacy = 'One of your audience settings has an unsupported value.';
  });

  if (!Object.values(PROFILE_TYPES).includes(form.profileType)) errors.profileType = 'Choose a valid account type';
  if (!DEFAULT_TAB_IDS.has(form.defaultTab)) errors.defaultTab = 'Choose a valid starting tab';
  if (!LOCATION_PRIVACY_IDS.has(form.locationPrivacy)) errors.location = 'Choose a valid location visibility';

  const raw = {
    displayName,
    username,
    bio: multiLine(form.bio),
    tagline: singleLine(form.tagline),
    website,
    pronouns: singleLine(form.pronouns),
    profession: singleLine(form.profession),
    education: singleLine(form.education),
    gender: singleLine(form.gender),
    profileType: form.profileType,
    isPrivate: form.isPrivate === true,
    locationPrivacy: form.locationPrivacy,
    links: ensureSinglePrimary(links),
    privacy,
    showLevel: form.showLevel === true,
    showReputation: form.showReputation === true,
    showStreak: form.showStreak === true,
    defaultTab: form.defaultTab,
  };
  // A hidden location keeps its stored text: the preference changes, the data is not destroyed.
  if (form.locationPrivacy !== 'hidden') raw.location = singleLine(form.location);

  if (creatorUnlocked) {
    const email = singleLine(form.inquiriesEmail);
    if (email && !EMAIL_RE.test(email)) errors.inquiriesEmail = 'Enter a valid business email address';
    raw.creatorCategory = singleLine(form.creatorCategory);
    raw.inquiriesEmail = email;
    raw.tipMessage = singleLine(form.tipMessage);
  }
  if (royalUnlocked) {
    if (!CREST_IDS.has(form.crestAura)) errors.crestAura = 'Choose a valid crest aura';
    raw.heraldicMotto = singleLine(form.heraldicMotto);
    raw.crestAura = form.crestAura;
  }
  return { errors, linkErrors, raw };
}

const FIELD_KEYWORDS = [
  ['displayName', ['display name', 'displayname']], ['username', ['username', 'handle']],
  ['bio', ['bio']], ['tagline', ['tagline', 'status']], ['website', ['website']],
  ['inquiriesEmail', ['email']], ['links', ['link']], ['location', ['location']],
  ['pronouns', ['pronoun']], ['profession', ['profession']], ['education', ['education']],
  ['gender', ['gender']], ['privacy', ['privacy', 'visibility', 'audience']],
  ['defaultTab', ['tab']], ['profileType', ['profile type', 'account type']],
];

/** Maps validateProfileUpdate errors to fields. Structured errors ({field|path}) are used when the
 *  contract provides them; plain strings fall back to keyword matching (contract limitation). */
function mapValidationErrors(list) {
  const out = {};
  let general = null;
  (Array.isArray(list) ? list : []).forEach((item) => {
    const message = typeof item === 'string' ? item : (isPlainObject(item) && typeof item.message === 'string' ? item.message : null);
    if (!message) return;
    const structured = isPlainObject(item) ? (item.field || item.path) : null;
    let key = typeof structured === 'string' ? structured.split('.')[0] : null;
    if (!key) {
      const lower = message.toLowerCase();
      const hit = FIELD_KEYWORDS.find(([, words]) => words.some((w) => lower.includes(w)));
      key = hit ? hit[0] : null;
    }
    if (key) { if (!out[key]) out[key] = message; } else if (!general) general = message;
  });
  return { fields: out, general };
}

const isSafeRemoteImageUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url) && !/^(blob:|data:)/i.test(url);
const pickUploadedUrl = (result) => {
  const value = typeof result === 'string' ? result : (result && (result.downloadURL || result.photoURL || result.url)) || null;
  return isSafeRemoteImageUrl(value) ? value : null;
};
// </pure-helpers>

/* ============================================================================================
 * Form reducer: one normalised baseline, per-field dirty tracking, conflict-aware remote sync
 * ========================================================================================== */
function formReducer(state, action) {
  switch (action.type) {
    case 'field':
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case 'patch':
      return { ...state, form: { ...state.form, ...action.patch } };
    case 'privacy':
      return { ...state, form: { ...state.form, privacy: { ...state.form.privacy, ...action.patch } } };
    case 'links':
      return { ...state, form: { ...state.form, links: action.update(state.form.links) } };
    case 'saved':
      return { form: action.form, baseline: action.form, conflicts: [] };
    case 'useRemote': {
      const form = { ...state.form };
      action.keys.forEach((k) => { form[k] = state.baseline[k]; });
      return { ...state, form, conflicts: state.conflicts.filter((k) => !action.keys.includes(k)) };
    }
    case 'keepMine':
      return { ...state, conflicts: [] };
    case 'remote': {
      const remote = action.form;
      const form = { ...state.form };
      const conflicts = new Set(state.conflicts);
      let changed = false;
      FORM_KEYS.forEach((key) => {
        if (valuesEqual(remote[key], state.baseline[key])) return;
        changed = true;
        const localDirty = !valuesEqual(state.form[key], state.baseline[key]);
        if (!localDirty) { form[key] = remote[key]; conflicts.delete(key); } else if (!valuesEqual(state.form[key], remote[key])) conflicts.add(key);
        else conflicts.delete(key);
      });
      if (!changed) return state;
      return { form, baseline: remote, conflicts: [...conflicts] };
    }
    default:
      return state;
  }
}

/* ============================================================================================
 * Hooks
 * ========================================================================================== */

/** True while mounted. The editor is keyed by UID, so "alive" also means "same account". */
function useAlive() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => { ref.current = false; };
  }, []);
  return ref;
}

const USERNAME_STATUS = {
  IDLE: 'idle', CURRENT: 'current', INVALID: 'invalid', CHECKING: 'checking', AVAILABLE: 'available',
  TAKEN: 'taken', ERROR: 'error', UNAVAILABLE: 'unavailable', LIMITED: 'limited',
};
const classifyUsername = (raw, current) => {
  if (!raw) return USERNAME_STATUS.IDLE;
  if (current && raw === current) return USERNAME_STATUS.CURRENT;
  if (!USERNAME_RE.test(raw)) return USERNAME_STATUS.INVALID;
  return null;
};

/**
 * One workflow for validating, checking and generating usernames. Responses are sequence-guarded,
 * results are cached briefly (so generation + the field effect never double-query), requests are
 * rate-limited client-side, and nothing is ever reported as available unless the service said so.
 */
function useUsernameAvailability({ uid, userService, value, currentUsername, alive }) {
  const [status, setStatus] = useState(() => classifyUsername(normalizeUsername(value), currentUsername) || USERNAME_STATUS.IDLE);
  const [generating, setGenerating] = useState(false);
  const seqRef = useRef(0);
  const stampsRef = useRef([]);
  const cacheRef = useRef({ value: '', status: null, at: 0 });
  const genRef = useRef({ token: 0, last: 0 });

  const check = useCallback(async (raw, options = {}) => {
    const { silent = false, force = false } = options;
    const base = classifyUsername(raw, currentUsername);
    if (base) { if (!silent) setStatus(base); return base; }
    if (typeof userService?.checkUsernameAvailability !== 'function') {
      if (!silent) setStatus(USERNAME_STATUS.UNAVAILABLE);
      return USERNAME_STATUS.UNAVAILABLE;
    }
    const cached = cacheRef.current;
    if (!force && cached.value === raw && cached.status && Date.now() - cached.at < 30000) {
      if (!silent) setStatus(cached.status);
      return cached.status;
    }
    const now = Date.now();
    stampsRef.current = stampsRef.current.filter((t) => now - t < 30000);
    if (stampsRef.current.length >= 12) {
      if (!silent) setStatus(USERNAME_STATUS.LIMITED);
      return USERNAME_STATUS.LIMITED;
    }
    stampsRef.current.push(now);
    seqRef.current += 1;
    const seq = seqRef.current;
    if (!silent) setStatus(USERNAME_STATUS.CHECKING);
    let next;
    try {
      const res = await userService.checkUsernameAvailability(raw, uid);
      next = res && typeof res.available === 'boolean'
        ? (res.available ? USERNAME_STATUS.AVAILABLE : USERNAME_STATUS.TAKEN)
        : USERNAME_STATUS.ERROR;
    } catch {
      next = USERNAME_STATUS.ERROR;
    }
    if (next === USERNAME_STATUS.AVAILABLE || next === USERNAME_STATUS.TAKEN) {
      cacheRef.current = { value: raw, status: next, at: Date.now() };
    }
    if (!silent && alive.current && seq === seqRef.current) setStatus(next);
    return next;
  }, [uid, userService, currentUsername, alive]);

  // Debounced live check; any pending response is invalidated when the value changes.
  useEffect(() => {
    const raw = normalizeUsername(value);
    const base = classifyUsername(raw, currentUsername);
    if (base) { setStatus(base); return undefined; }
    const cached = cacheRef.current;
    if (cached.value === raw && cached.status && Date.now() - cached.at < 30000) {
      setStatus(cached.status);
      return undefined;
    }
    setStatus(USERNAME_STATUS.CHECKING);
    const timer = setTimeout(() => { check(raw); }, 450);
    return () => {
      clearTimeout(timer);
      seqRef.current += 1;
    };
  }, [value, currentUsername, check]);

  /** Returns { ok, username } only for a handle the service confirmed as available. */
  const generate = useCallback(async (seed) => {
    if (typeof userService?.generateUniqueUsername !== 'function') return { ok: false, reason: 'unavailable' };
    const gen = genRef.current;
    if (Date.now() - gen.last < 1500) return { ok: false, reason: 'cooldown' };
    gen.last = Date.now();
    gen.token += 1;
    const token = gen.token;
    setGenerating(true);
    try {
      const base = normalizeUsername(seed).replace(/[._]/g, '').slice(0, 12) || 'creator';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let candidate = await userService.generateUniqueUsername(base, uid);
        candidate = typeof candidate === 'string' ? normalizeUsername(candidate) : '';
        if (candidate && isPlaceholderHandle(candidate)) {
          const suffix = candidate.replace(/^user_/, '') || Math.random().toString(36).slice(2, 7);
          candidate = normalizeUsername(`${base}_${suffix}`);
        }
        if (!USERNAME_RE.test(candidate)) continue;
        const verdict = await check(candidate, { silent: true, force: true });
        if (verdict === USERNAME_STATUS.AVAILABLE) {
          return alive.current && token === gen.token ? { ok: true, username: candidate } : { ok: false, reason: 'stale' };
        }
        if (verdict === USERNAME_STATUS.ERROR || verdict === USERNAME_STATUS.LIMITED) return { ok: false, reason: 'error' };
      }
      return { ok: false, reason: 'none' };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      if (alive.current && token === gen.token) setGenerating(false);
    }
  }, [uid, userService, check, alive]);

  return { status, generating, check, generate };
}

/**
 * Avatar lifecycle: selected -> validated (type, size, decode, square) -> previewed (object URL)
 * -> uploaded + committed by the save pipeline -> preview reconciled to the canonical URL.
 * The object URL is revoked on replace, discard, commit and unmount. A staged file remembers its
 * uploaded URL so a retry after a failed profile write never uploads the same file twice.
 */
function useAvatarEditor(alive) {
  const [staged, setStaged] = useState(null); // { file, previewUrl, uploadedUrl }
  const [state, setState] = useState({ status: 'idle', error: null });
  const urlRef = useRef(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      try { URL.revokeObjectURL(urlRef.current); } catch { /* ignore */ }
      urlRef.current = null;
    }
  }, []);
  useEffect(() => revoke, [revoke]);

  const stage = useCallback(async (file) => {
    const fail = (message) => { if (alive.current) setState({ status: 'error', error: message }); return { ok: false, error: message }; };
    if (!(typeof Blob !== 'undefined' && file instanceof Blob)) return fail('That file could not be read.');
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) return fail('Use a JPEG, PNG or WebP image.');
    if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) return fail(`Photos must be under ${Math.round(AVATAR_MAX_BYTES / 1048576)} MB.`);
    if (alive.current) setState({ status: 'validating', error: null });
    const url = URL.createObjectURL(file);
    try {
      const { width, height } = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('decode'));
        img.src = url;
      });
      if (!width || !height) throw new Error('decode');
      if (Math.abs(width - height) > 1) { URL.revokeObjectURL(url); return fail('The cropped photo must be square (1:1).'); }
      if (width < AVATAR_MIN_SIDE) { URL.revokeObjectURL(url); return fail(`Photos must be at least ${AVATAR_MIN_SIDE}px wide.`); }
    } catch {
      URL.revokeObjectURL(url);
      return fail('That image could not be decoded. Try a different photo.');
    }
    if (!alive.current) { URL.revokeObjectURL(url); return { ok: false, error: 'closed' }; }
    revoke();
    urlRef.current = url;
    setStaged({ file, previewUrl: url, uploadedUrl: null });
    setState({ status: 'staged', error: null });
    return { ok: true };
  }, [alive, revoke]);

  const discard = useCallback(() => {
    revoke();
    setStaged(null);
    setState({ status: 'idle', error: null });
  }, [revoke]);

  const markUploaded = useCallback((uploadedUrl) => {
    setStaged((s) => (s ? { ...s, uploadedUrl } : s));
  }, []);

  return { staged, state, stage, discard, markUploaded };
}

const allowedInteractionValues = (field) => new Set(field.options.map(([v]) => v));

/**
 * Independent account settings. Loading/error/retry states, per-setting pending flags and per-setting
 * request sequencing; a late initial load never overwrites a value the user already changed, and a
 * failed write rolls back to the last server-confirmed value (never to a stale closure value).
 */
function useInteractionSettings({ uid, alive }) {
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [values, setValues] = useState({});
  const [pending, setPending] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});
  const confirmedRef = useRef({});
  const touchedRef = useRef(new Set());
  const seqRef = useRef({});

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      if (typeof settingsService?.getSettings !== 'function') throw new Error('unavailable');
      const res = await settingsService.getSettings(uid);
      if (!alive.current) return;
      const priv = isPlainObject(res?.privacy) ? res.privacy : null;
      if (!priv) throw new Error('empty');
      const merged = { ...(DEFAULT_SETTINGS?.privacy || {}), ...priv };
      const next = {};
      INTERACTION_FIELDS.forEach((f) => {
        const allowed = allowedInteractionValues(f);
        confirmedRef.current[f.key] = allowed.has(merged[f.key]) ? merged[f.key] : '';
        if (!touchedRef.current.has(f.key)) next[f.key] = confirmedRef.current[f.key];
      });
      setValues((curr) => ({ ...curr, ...next }));
      setLoadState('ready');
    } catch {
      if (alive.current) setLoadState('error');
    }
  }, [uid, alive]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (key, value) => {
    const field = INTERACTION_FIELDS.find((f) => f.key === key);
    if (!field || !allowedInteractionValues(field).has(value)) return;
    if (typeof settingsService?.updateSetting !== 'function') {
      setErrors((e) => ({ ...e, [key]: 'Settings are unavailable right now.' }));
      return;
    }
    touchedRef.current.add(key);
    seqRef.current[key] = (seqRef.current[key] || 0) + 1;
    const seq = seqRef.current[key];
    setValues((curr) => ({ ...curr, [key]: value }));
    setPending((p) => ({ ...p, [key]: true }));
    setSaved((s) => ({ ...s, [key]: false }));
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      await settingsService.updateSetting(uid, `privacy.${key}`, value);
      confirmedRef.current[key] = value;
      if (alive.current && seqRef.current[key] === seq) {
        setPending((p) => ({ ...p, [key]: false }));
        setSaved((s) => ({ ...s, [key]: true }));
      }
    } catch (err) {
      if (alive.current && seqRef.current[key] === seq) {
        setValues((curr) => ({ ...curr, [key]: confirmedRef.current[key] ?? '' }));
        setPending((p) => ({ ...p, [key]: false }));
        setErrors((e) => ({ ...e, [key]: (err && err.message) || 'Could not save this preference.' }));
      }
    }
  }, [uid, alive]);

  return { loadState, values, pending, saved, errors, update, retry: load };
}

/* ============================================================================================
 * Styles: one static, `epf-` scoped sheet (React 19 resource style: hoisted and de-duplicated).
 * Theme comes only from the `theme` value in ThemeContext via data-theme on the root.
 * Glass levels: cards = premium glass (layered translucency, no blur); header/action bar = deep
 * glass (the only backdrop-filter surfaces, to stay light on low-end GPUs).
 * ========================================================================================== */
const STYLES = `
.epf-root{
  --epf-font:var(--font-inter,'Inter'),ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --epf-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  position:relative;min-height:100vh;min-height:100dvh;box-sizing:border-box;
  font-family:var(--epf-font);color:var(--epf-text);background:var(--epf-bg);
  -webkit-text-size-adjust:100%;
}
.epf-root *,.epf-root *::before,.epf-root *::after{box-sizing:border-box}
.epf-root[data-theme='dark'],.epf-theme[data-theme='dark']{
  /* Dark: tonal liquid glass. Surfaces, borders and fields sit within a few percent of the page
     tone, so there are no hard edges; contrast is reserved for text and focus. */
  --epf-bg:#03071B;--epf-text:#FFFFFF;--epf-text2:rgba(255,255,255,0.7);--epf-text3:rgba(255,255,255,0.55);
  --epf-border:rgba(255,255,255,0.05);
  --epf-card-bg:linear-gradient(158deg,rgba(150,160,255,0.075),rgba(255,255,255,0.032) 52%,rgba(110,130,255,0.05));
  --epf-card-shadow:0 22px 44px -30px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.10),inset 0 -1px 0 rgba(120,140,255,0.05),inset 0 0 30px rgba(140,130,255,0.035);
  --epf-sheen:radial-gradient(62% 90% at 6% 0%,rgba(200,43,255,0.14),transparent 62%),radial-gradient(56% 84% at 100% 100%,rgba(0,136,255,0.12),transparent 64%),radial-gradient(36% 44% at 72% 0%,rgba(255,255,255,0.055),transparent 72%),linear-gradient(115deg,transparent 38%,rgba(255,255,255,0.04) 46%,transparent 54%),linear-gradient(180deg,rgba(255,255,255,0.065),transparent 26%);
  --epf-spec:linear-gradient(90deg,transparent,rgba(235,240,255,0.32) 28%,rgba(235,240,255,0.32) 72%,transparent) center top/84% 1px no-repeat;
  --epf-rim:conic-gradient(from 200deg at 50% 50%,rgba(255,255,255,0.20),rgba(139,30,243,0.16) 24%,rgba(5,91,251,0.22) 48%,rgba(255,255,255,0.05) 68%,rgba(200,43,255,0.15) 86%,rgba(255,255,255,0.20));
  --epf-field:rgba(255,255,255,0.04);--epf-field-border:rgba(255,255,255,0.09);--epf-field-hover:rgba(255,255,255,0.065);
  --epf-accent:#8B7CFF;--epf-accent-text:#BBAEFF;--epf-accent-soft:rgba(139,124,255,0.13);--epf-accent-edge:rgba(160,150,255,0.30);
  --epf-ok:#6EE7B7;--epf-warn:#FCD34D;--epf-err:#FDA4AF;--epf-err-bg:rgba(244,63,94,0.10);--epf-warn-bg:rgba(245,158,11,0.10);--epf-ok-bg:rgba(16,185,129,0.10);
  --epf-amber:#FCD34D;--epf-amber-soft:rgba(245,158,11,0.11);--epf-amber-edge:rgba(245,158,11,0.24);
  --epf-bar-bg:linear-gradient(180deg,rgba(150,160,255,0.07),rgba(8,12,44,0.50));--epf-bar-edge:rgba(255,255,255,0.06);
  --epf-page-glow:radial-gradient(70% 38% at 85% -6%,rgba(139,30,243,0.15),transparent 70%),radial-gradient(60% 30% at 0% 40%,rgba(5,91,251,0.09),transparent 70%),radial-gradient(50% 26% at 60% 100%,rgba(200,43,255,0.06),transparent 70%);
}
.epf-root[data-theme='light'],.epf-theme[data-theme='light']{
  --epf-bg:#F6F8FC;--epf-text:#111827;--epf-text2:#4B5563;--epf-text3:#6B7280;
  --epf-border:rgba(15,23,42,0.09);
  --epf-card-bg:linear-gradient(158deg,rgba(255,255,255,0.90),rgba(255,255,255,0.70) 55%,rgba(238,243,255,0.78));
  --epf-card-shadow:0 20px 40px -28px rgba(30,41,90,0.38),0 1px 2px rgba(15,23,42,0.05),inset 0 1px 0 #FFFFFF,inset 0 -1px 0 rgba(110,130,240,0.10),inset 0 0 26px rgba(255,255,255,0.5);
  --epf-sheen:radial-gradient(62% 90% at 6% 0%,rgba(200,43,255,0.07),transparent 62%),radial-gradient(56% 84% at 100% 100%,rgba(0,136,255,0.09),transparent 64%),radial-gradient(36% 44% at 72% 0%,rgba(255,255,255,0.8),transparent 72%),linear-gradient(115deg,transparent 38%,rgba(255,255,255,0.55) 46%,transparent 54%),linear-gradient(180deg,rgba(255,255,255,0.75),transparent 28%);
  --epf-spec:linear-gradient(90deg,transparent,#FFFFFF 28%,#FFFFFF 72%,transparent) center top/86% 1px no-repeat;
  --epf-rim:conic-gradient(from 200deg at 50% 50%,#FFFFFF,rgba(139,30,243,0.22) 24%,rgba(5,91,251,0.30) 48%,rgba(255,255,255,0.75) 68%,rgba(200,43,255,0.20) 86%,#FFFFFF);
  --epf-field:rgba(255,255,255,0.92);--epf-field-border:rgba(15,23,42,0.16);--epf-field-hover:#F1F4FA;
  --epf-accent:#4431F7;--epf-accent-text:#4431F7;--epf-accent-soft:rgba(68,49,247,0.09);--epf-accent-edge:rgba(68,49,247,0.35);
  --epf-ok:#047857;--epf-warn:#92400E;--epf-err:#BE123C;--epf-err-bg:rgba(225,29,72,0.07);--epf-warn-bg:rgba(217,119,6,0.09);--epf-ok-bg:rgba(5,150,105,0.09);
  --epf-amber:#92400E;--epf-amber-soft:rgba(217,119,6,0.10);--epf-amber-edge:rgba(217,119,6,0.35);
  --epf-bar-bg:linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,248,252,0.90));--epf-bar-edge:rgba(15,23,42,0.09);
  --epf-page-glow:radial-gradient(70% 34% at 85% -6%,rgba(139,30,243,0.08),transparent 70%),radial-gradient(60% 28% at 0% 40%,rgba(5,91,251,0.06),transparent 70%);
}
.epf-root::before{content:'';position:absolute;inset:0;pointer-events:none;background:var(--epf-page-glow);z-index:0}
.epf-main{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:12px 16px 24px;display:flex;flex-direction:column;gap:16px}

.epf-theme{--epf-font:var(--font-inter,'Inter'),ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--epf-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-family:var(--epf-font);color:var(--epf-text);background:var(--epf-bg);border-radius:14px;padding:4px}
.epf-theme *{box-sizing:border-box}

/* Header + section nav */
.epf-header{display:flex;align-items:center;gap:12px}
.epf-back{flex:none;width:44px;height:44px;border-radius:14px;border:1px solid var(--epf-border);background:var(--epf-card-bg);color:var(--epf-text);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.epf-back svg{width:20px;height:20px}
.epf-title{margin:0;font-size:20px;line-height:1.2;font-weight:800;letter-spacing:-0.01em}
.epf-sub{margin:2px 0 0;font-size:13px;line-height:1.35;color:var(--epf-text2)}
.epf-head-text{flex:1;min-width:0}
.epf-nav{display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.epf-nav::-webkit-scrollbar{display:none}
.epf-nav-btn{flex:none;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--epf-border);background:var(--epf-card-bg);color:var(--epf-text2);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.epf-nav-btn:hover{color:var(--epf-text)}

/* Identity summary */
.epf-summary{display:flex;align-items:center;gap:12px}
.epf-summary-name{margin:0;font-size:15px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.epf-handle{font-family:var(--epf-mono);font-size:13px;color:var(--epf-accent-text);overflow-wrap:anywhere}

/* Card (premium liquid glass): translucent body + backdrop blur, ambient violet/blue light, a curved
   specular layer, a hairline top reflection and a conic gradient rim over a real border. */
.epf-card{position:relative;isolation:isolate;border-radius:22px;border:1px solid var(--epf-border);background:var(--epf-card-bg);box-shadow:var(--epf-card-shadow);scroll-margin-top:12px;-webkit-backdrop-filter:blur(14px) saturate(165%);backdrop-filter:blur(14px) saturate(165%)}
.epf-card::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:var(--epf-spec),var(--epf-sheen);z-index:0}
.epf-card::after{content:'';display:none;position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;z-index:2}
@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){
  .epf-card::after{display:block;padding:1px;background:var(--epf-rim);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
}
.epf-card[data-tone='amber']{border-color:var(--epf-amber-edge)}
.epf-card-inner{position:relative;z-index:1;padding:16px;display:flex;flex-direction:column;gap:16px}
.epf-card-head{display:flex;align-items:flex-start;gap:12px}
.epf-card-title{flex:1;min-width:0}
.epf-card-title h2{margin:0;font-size:16px;font-weight:800;line-height:1.25;letter-spacing:-0.005em;outline:none}
.epf-card-title p{margin:2px 0 0;font-size:13px;line-height:1.4;color:var(--epf-text2)}
.epf-icon-chip{flex:none;width:36px;height:36px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:var(--epf-accent-text);background:var(--epf-accent-soft);border:1px solid var(--epf-accent-edge)}
.epf-icon-chip[data-tone='amber']{color:var(--epf-amber);background:var(--epf-amber-soft);border-color:var(--epf-amber-edge)}
.epf-icon-chip svg{width:18px;height:18px}

/* Fields */
.epf-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.epf-label-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.epf-label{font-size:13px;font-weight:700;color:var(--epf-text)}
.epf-optional{margin-left:6px;font-size:12px;font-weight:500;color:var(--epf-text3)}
.epf-counter{font-family:var(--epf-mono);font-size:12px;color:var(--epf-text3);font-variant-numeric:tabular-nums}
.epf-input-wrap{position:relative;display:flex;align-items:center}
.epf-input-prefix{position:absolute;left:14px;font-family:var(--epf-mono);font-size:15px;font-weight:700;color:var(--epf-accent-text);pointer-events:none}
.epf-input,.epf-select,.epf-textarea{width:100%;min-height:44px;padding:10px 14px;border-radius:14px;border:1px solid var(--epf-field-border);background:var(--epf-field);color:var(--epf-text);font:inherit;font-size:15px;line-height:1.35;outline:none;transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease}
.epf-input[data-mono='true']{font-family:var(--epf-mono);font-size:14px}
.epf-input[data-prefix='true']{padding-left:32px}
.epf-textarea{resize:vertical;min-height:96px}
.epf-input::placeholder,.epf-textarea::placeholder{color:var(--epf-text3)}
.epf-input:hover,.epf-select:hover,.epf-textarea:hover{background:var(--epf-field-hover)}
.epf-input:focus-visible,.epf-select:focus-visible,.epf-textarea:focus-visible,.epf-btn:focus-visible,.epf-pill:focus-visible,.epf-toggle:focus-visible,.epf-nav-btn:focus-visible,.epf-back:focus-visible,.epf-icon-btn:focus-visible,.epf-aura:focus-visible,.epf-avatar-btn:focus-visible{outline:2px solid var(--epf-accent);outline-offset:2px}
.epf-input[aria-invalid='true'],.epf-select[aria-invalid='true'],.epf-textarea[aria-invalid='true']{border-color:var(--epf-err);background:var(--epf-err-bg)}
.epf-input:disabled,.epf-select:disabled,.epf-textarea:disabled{opacity:.6;cursor:not-allowed}
.epf-select{appearance:none;-webkit-appearance:none;padding-right:36px;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--epf-text2) 50%),linear-gradient(135deg,var(--epf-text2) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.epf-select option{color:#111827;background:#FFFFFF}
.epf-hint{margin:0;font-size:12px;line-height:1.4;color:var(--epf-text2)}
.epf-error{margin:0;display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.4;font-weight:600;color:var(--epf-err)}
.epf-error svg{width:14px;height:14px;flex:none;margin-top:1px}
.epf-grid2{display:grid;grid-template-columns:1fr;gap:16px}
@media (min-width:600px){.epf-grid2{grid-template-columns:1fr 1fr}}
.epf-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* Buttons */
.epf-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;border-radius:14px;border:1px solid var(--epf-field-border);background:var(--epf-field);color:var(--epf-text);font:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:background-color .15s ease,filter .15s ease,transform .1s ease;-webkit-tap-highlight-color:transparent}
.epf-btn svg{width:16px;height:16px;flex:none}
.epf-btn:hover{background:var(--epf-field-hover)}
.epf-btn:active{transform:scale(0.98)}
.epf-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.epf-btn[data-variant='primary']{color:#FFFFFF;border-color:transparent;background-color:#4431F7;background-image:var(--epf-grad);box-shadow:0 8px 18px -10px rgba(68,49,247,0.7),inset 0 1px 0 rgba(255,255,255,0.28)}
.epf-btn[data-variant='primary']:hover{filter:brightness(1.07);background-image:var(--epf-grad)}
.epf-btn[data-variant='ghost']{background:transparent;border-color:transparent;color:var(--epf-text2)}
.epf-btn[data-variant='danger']{color:#FFFFFF;border-color:transparent;background:#BE123C}
.epf-btn[data-variant='danger']:hover{background:#E11D48}
.epf-btn[data-size='sm']{min-height:44px;padding:0 12px;font-size:13px}
.epf-icon-btn{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid transparent;background:transparent;color:var(--epf-text2);cursor:pointer}
.epf-icon-btn:hover{background:var(--epf-field-hover);color:var(--epf-text)}
.epf-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.epf-icon-btn svg{width:18px;height:18px}
.epf-icon-btn[aria-pressed='true']{color:var(--epf-amber);background:var(--epf-amber-soft)}
.epf-icon-btn[data-danger='true']:hover{color:var(--epf-err)}

/* Pills, toggles, rows */
.epf-pills{display:flex;flex-wrap:wrap;gap:8px}
.epf-pill{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--epf-field-border);background:var(--epf-field);color:var(--epf-text2);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.epf-pill[aria-pressed='true']{color:var(--epf-text);border-color:var(--epf-accent-edge);background:var(--epf-accent-soft);box-shadow:inset 0 1px 0 rgba(255,255,255,0.12)}
.epf-type-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media (min-width:600px){.epf-type-grid{grid-template-columns:repeat(5,1fr)}}
.epf-type{min-height:64px;padding:10px 12px;border-radius:14px;border:1px solid var(--epf-field-border);background:var(--epf-field);color:var(--epf-text);text-align:left;font:inherit;cursor:pointer}
.epf-type[aria-pressed='true']{border-color:var(--epf-accent-edge);background:var(--epf-accent-soft)}
.epf-type b{display:block;font-size:13px}
.epf-type span{display:block;margin-top:2px;font-size:12px;line-height:1.3;color:var(--epf-text2)}
.epf-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.epf-setting-text{flex:1 1 200px;min-width:0}
.epf-setting-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700}
.epf-setting-title svg{width:16px;height:16px;flex:none;color:var(--epf-accent-text)}
.epf-setting .epf-select{width:auto;min-width:150px;max-width:100%}
.epf-stack{display:flex;flex-direction:column;gap:14px}
.epf-divider{height:1px;background:var(--epf-border);border:0;margin:0}
.epf-toggle{position:relative;flex:none;width:48px;height:28px;border-radius:999px;border:1px solid var(--epf-field-border);background:var(--epf-field);cursor:pointer;padding:0;transition:background-color .18s ease}
.epf-toggle::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--epf-text2);transition:transform .18s ease,background-color .18s ease}
.epf-toggle[aria-checked='true']{background:var(--epf-accent-soft);border-color:var(--epf-accent-edge)}
.epf-toggle[aria-checked='true']::after{transform:translateX(20px);background:var(--epf-accent)}
.epf-toggle:disabled{opacity:.55;cursor:not-allowed}
.epf-tap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}

/* Status, banners */
.epf-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--epf-border);font-size:12px;font-weight:700;line-height:1.2}
.epf-status svg{width:13px;height:13px;flex:none}
.epf-status[data-tone='ok']{color:var(--epf-ok);background:var(--epf-ok-bg);border-color:transparent}
.epf-status[data-tone='warn']{color:var(--epf-warn);background:var(--epf-warn-bg);border-color:transparent}
.epf-status[data-tone='err']{color:var(--epf-err);background:var(--epf-err-bg);border-color:transparent}
.epf-status[data-tone='info']{color:var(--epf-accent-text);background:var(--epf-accent-soft);border-color:transparent}
.epf-banner{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:16px;border:1px solid var(--epf-border);font-size:13px;line-height:1.45}
.epf-banner svg{width:18px;height:18px;flex:none;margin-top:1px}
.epf-banner[data-tone='err']{color:var(--epf-err);background:var(--epf-err-bg);border-color:rgba(244,63,94,0.3)}
.epf-banner[data-tone='warn']{color:var(--epf-warn);background:var(--epf-warn-bg);border-color:rgba(245,158,11,0.3)}
.epf-banner[data-tone='info']{color:var(--epf-text);background:var(--epf-accent-soft);border-color:var(--epf-accent-edge)}
.epf-banner-body{flex:1;min-width:0}
.epf-banner-body b{display:block;font-weight:700}
.epf-spin{animation:epf-spin .9s linear infinite}
@keyframes epf-spin{to{transform:rotate(360deg)}}

/* Avatar */
.epf-avatar-wrap{position:relative;flex:none;width:96px;height:96px;border-radius:50%;padding:3px;background-color:#4431F7;background-image:var(--epf-grad);box-shadow:0 10px 24px -12px var(--epf-glow)}
.epf-avatar{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#0B1234;border:3px solid var(--epf-bg);position:relative}
.epf-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.epf-avatar-btn{position:absolute;right:-2px;bottom:-2px;width:44px;height:44px;border-radius:50%;border:2px solid var(--epf-bg);background-color:#4431F7;background-image:var(--epf-grad);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.epf-avatar-btn svg{width:18px;height:18px}
.epf-avatar-block{display:flex;align-items:center;gap:16px;flex-wrap:wrap}

/* Links */
.epf-link{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;border:1px solid var(--epf-border);background:var(--epf-field)}
.epf-link[data-primary='true']{border-color:var(--epf-amber-edge)}
.epf-link-grid{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:600px){.epf-link-grid{grid-template-columns:160px 1fr}}
.epf-link-actions{display:flex;align-items:center;gap:2px;flex-wrap:wrap;justify-content:flex-end}
.epf-empty{padding:20px;border-radius:16px;border:1px dashed var(--epf-field-border);text-align:center;color:var(--epf-text2);font-size:13px}
.epf-empty svg{width:22px;height:22px;opacity:.5;margin-bottom:6px}

/* Heraldry */
.epf-aura-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media (min-width:600px){.epf-aura-grid{grid-template-columns:repeat(5,1fr)}}
.epf-aura{min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:14px;border:1px solid var(--epf-field-border);background:var(--epf-field);color:var(--epf-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.epf-aura i{width:20px;height:20px;border-radius:50%;display:block}
.epf-aura[aria-pressed='true']{border-color:var(--epf-amber-edge);background:var(--epf-amber-soft)}
.epf-aura[aria-pressed='true'] i{box-shadow:0 0 0 2px var(--epf-bg),0 0 0 4px var(--epf-amber-edge)}

/* Sticky action bar (deep glass, the single save control) */
.epf-bar{position:sticky;bottom:0;z-index:20;margin-top:8px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--epf-bar-bg);border-top:1px solid var(--epf-bar-edge);-webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%)}
.epf-bar-inner{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:12px}
.epf-bar-status{flex:1;min-width:0;font-size:13px;line-height:1.3;color:var(--epf-text2)}
.epf-bar-status b{color:var(--epf-text)}
details.epf-more summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;font-size:13px;font-weight:700;color:var(--epf-text2);list-style:none}
details.epf-more summary::-webkit-details-marker{display:none}
details.epf-more summary:focus-visible{outline:2px solid var(--epf-accent);outline-offset:2px;border-radius:8px}
details.epf-more[open] summary svg{transform:rotate(180deg)}
details.epf-more summary svg{width:16px;height:16px;transition:transform .15s ease}

.epf-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.epf-center{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;position:relative;z-index:1}

@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .epf-root[data-theme='dark'] .epf-card{background:linear-gradient(158deg,rgba(26,34,86,0.92),rgba(12,18,58,0.94))}
  .epf-root[data-theme='light'] .epf-card{background:rgba(255,255,255,0.95)}
  .epf-root[data-theme='dark'] .epf-bar{background:rgba(5,9,34,0.96)}
  .epf-root[data-theme='light'] .epf-bar{background:rgba(246,248,252,0.97)}
}
/* Lite/performance modes and reduced transparency drop the blur but keep the layered material. */
.lite-mode .epf-card,[data-lite-mode='true'] .epf-card,[data-performance='lite'] .epf-card,
.lite-mode .epf-bar,[data-lite-mode='true'] .epf-bar,[data-performance='lite'] .epf-bar{-webkit-backdrop-filter:none;backdrop-filter:none}
@media (prefers-reduced-transparency:reduce){
  .epf-card,.epf-bar{-webkit-backdrop-filter:none;backdrop-filter:none}
  .epf-root[data-theme='dark'] .epf-card{background:linear-gradient(158deg,rgba(26,34,86,0.94),rgba(12,18,58,0.96))}
  .epf-root[data-theme='light'] .epf-card{background:rgba(255,255,255,0.96)}
  .epf-root[data-theme='dark'] .epf-bar{background:rgba(5,9,34,0.97)}
  .epf-root[data-theme='light'] .epf-bar{background:rgba(246,248,252,0.98)}
}
@media (prefers-reduced-motion:reduce){
  .epf-root *,.epf-root *::before,.epf-root *::after{transition:none !important;animation-duration:0.001ms !important;animation-iteration-count:1 !important}
  .epf-btn:active{transform:none}
}
@media (forced-colors:active){
  .epf-card,.epf-input,.epf-select,.epf-textarea,.epf-btn,.epf-pill,.epf-type,.epf-aura,.epf-bar{border:1px solid CanvasText;background:Canvas;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
  .epf-card::before,.epf-card::after,.epf-root::before{display:none}
  .epf-pill[aria-pressed='true'],.epf-type[aria-pressed='true'],.epf-aura[aria-pressed='true'],.epf-toggle[aria-checked='true']{outline:2px solid Highlight}
}
`;

/* ============================================================================================
 * Presentational primitives
 * ========================================================================================== */
const ErrorText = ({ id, children }) => (children ? (
  <p id={id} className="epf-error" role="alert">
    <AlertCircle aria-hidden="true" focusable="false" />
    <span>{children}</span>
  </p>
) : null);

const Card = memo(function Card({ id, icon: Icon, title, description, tone, action, children }) {
  return (
    <section id={id} className="epf-card" data-tone={tone || 'default'} aria-labelledby={`${id}-h`}>
      <div className="epf-card-inner">
        <header className="epf-card-head">
          {Icon && (
            <span className="epf-icon-chip" data-tone={tone === 'amber' ? 'amber' : undefined} aria-hidden="true">
              <Icon focusable="false" />
            </span>
          )}
          <div className="epf-card-title">
            <h2 id={`${id}-h`} tabIndex={-1}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </div>
    </section>
  );
});

const TextField = memo(function TextField({
  id, name, label, value, onChange, error, hint, optional, maxLength, counter, type = 'text', inputMode,
  autoComplete, autoCapitalize, mono, multiline, rows = 3, prefix, disabled, placeholder, describedBy,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const described = [hintId, errId, describedBy].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name,
    value,
    disabled,
    placeholder,
    maxLength,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': described,
    autoComplete,
    autoCapitalize,
    spellCheck: mono ? false : undefined,
    onChange: (e) => onChange(name, e.target.value),
  };
  return (
    <div className="epf-field">
      <div className="epf-label-row">
        <label className="epf-label" htmlFor={id}>
          {label}
          {optional ? <span className="epf-optional">Optional</span> : null}
        </label>
        {counter && maxLength ? <span className="epf-counter" aria-hidden="true">{value.length}/{maxLength}</span> : null}
      </div>
      <div className="epf-input-wrap">
        {prefix ? <span className="epf-input-prefix" aria-hidden="true">{prefix}</span> : null}
        {multiline
          ? <textarea className="epf-textarea" rows={rows} {...common} />
          : <input className="epf-input" type={type} inputMode={inputMode} data-mono={mono ? 'true' : undefined} data-prefix={prefix ? 'true' : undefined} {...common} />}
      </div>
      {hint ? <p id={hintId} className="epf-hint">{hint}</p> : null}
      <ErrorText id={errId}>{error}</ErrorText>
    </div>
  );
});

const SelectControl = ({ id, name, label, value, options, onChange, disabled, describedBy, invalid, placeholder }) => {
  const known = options.some((o) => o.value === value);
  return (
    <select
      id={id}
      className="epf-select"
      value={known ? value : ''}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid ? 'true' : undefined}
      onChange={(e) => onChange(name, e.target.value)}
    >
      {!known ? <option value="" disabled>{placeholder || 'Not set'}</option> : null}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

/** One labelled audience/setting row: text on the left, select on the right (wraps on narrow screens). */
const SettingRow = memo(function SettingRow({
  id, name, icon: Icon, label, hint, value, options, onChange, disabled, note, statusNode, placeholder,
}) {
  const noteId = `${id}-note`;
  return (
    <div className="epf-setting">
      <div className="epf-setting-text">
        <label className="epf-setting-title" htmlFor={id}>
          {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
          <span>{label}</span>
        </label>
        {hint ? <p className="epf-hint">{hint}</p> : null}
        {note ? <p id={noteId} className="epf-hint" style={{ color: 'var(--epf-warn)' }}>{note}</p> : null}
        {statusNode}
      </div>
      <SelectControl
        id={id}
        name={name}
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        describedBy={note ? noteId : undefined}
        placeholder={placeholder}
      />
    </div>
  );
});

const Toggle = memo(function Toggle({ id, name, label, hint, checked, onChange, disabled, icon: Icon }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="epf-tap">
      <div className="epf-setting-text">
        <span className="epf-setting-title" id={`${id}-label`}>
          {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
          <span>{label}</span>
        </span>
        {hint ? <p id={hintId} className="epf-hint">{hint}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hintId}
        className="epf-toggle"
        disabled={disabled}
        onClick={() => onChange(name, !checked)}
      />
    </div>
  );
});

const USERNAME_STATUS_VIEW = {
  [USERNAME_STATUS.CHECKING]: { tone: 'info', icon: RefreshCw, spin: true, text: 'Checking availability…' },
  [USERNAME_STATUS.AVAILABLE]: { tone: 'ok', icon: CheckCircle2, text: 'Available' },
  [USERNAME_STATUS.CURRENT]: { tone: 'info', icon: CheckCircle2, text: 'Your current username' },
  [USERNAME_STATUS.TAKEN]: { tone: 'err', icon: AlertCircle, text: 'Already taken' },
  [USERNAME_STATUS.INVALID]: { tone: 'warn', icon: AlertCircle, text: `Use ${USERNAME_MIN}-${USERNAME_MAX} letters, numbers, dots or underscores` },
  [USERNAME_STATUS.ERROR]: { tone: 'warn', icon: AlertCircle, text: 'Could not verify. Try again before saving.' },
  [USERNAME_STATUS.UNAVAILABLE]: { tone: 'warn', icon: AlertCircle, text: 'Availability checking is unavailable right now' },
  [USERNAME_STATUS.LIMITED]: { tone: 'warn', icon: AlertCircle, text: 'Too many checks. Wait a moment.' },
};
const usernameStatusText = (status) => (USERNAME_STATUS_VIEW[status] ? USERNAME_STATUS_VIEW[status].text : '');

/* ============================================================================================
 * Sections (memoised; each receives only what it renders)
 * ========================================================================================== */

const IdentitySection = memo(function IdentitySection({
  baseId, avatarSrc, hasRemoteAvatar, hasStaged, avatarError, onOpenAvatar, onRemoveAvatar, removing,
  displayName, username, usernameStatus, generating, onGenerate, onCopyUsername, onChange, onUsernameChange,
  errors, hasUsernameService, canGenerate,
}) {
  const unameId = `${baseId}-username`;
  const view = USERNAME_STATUS_VIEW[usernameStatus];
  const StatusIcon = view ? view.icon : null;
  return (
    <Card
      id="epf-identity"
      icon={User}
      title="Identity & avatar"
      description="Your circular avatar, name and unique username. Arvdoul does not use cover images."
    >
      <div className="epf-avatar-block">
        <div className="epf-avatar-wrap">
          <div className="epf-avatar">
            <LazyImage src={avatarSrc} alt={displayName ? `${displayName} profile photo` : 'Profile photo'} className="w-full h-full object-cover" />
          </div>
          <button type="button" className="epf-avatar-btn" onClick={onOpenAvatar} aria-label="Change profile photo">
            <Camera aria-hidden="true" focusable="false" />
          </button>
        </div>
        <div className="epf-stack" style={{ flex: 1, minWidth: 180, gap: 10 }}>
          <p className="epf-hint" style={{ margin: 0 }}>
            {hasStaged
              ? 'New photo selected. It uploads when you save.'
              : 'Square 1:1 crop. JPEG, PNG or WebP.'}
          </p>
          <div className="epf-row">
            <button type="button" className="epf-btn" data-size="sm" onClick={onOpenAvatar}>
              <Camera aria-hidden="true" focusable="false" />
              <span>{hasStaged || hasRemoteAvatar ? 'Change photo' : 'Add photo'}</span>
            </button>
            {(hasStaged || hasRemoteAvatar) ? (
              <button type="button" className="epf-btn" data-size="sm" data-variant="ghost" onClick={onRemoveAvatar} disabled={removing}>
                <Trash2 aria-hidden="true" focusable="false" />
                <span>{removing ? 'Removing…' : hasStaged ? 'Discard selection' : 'Remove photo'}</span>
              </button>
            ) : null}
          </div>
          <ErrorText>{avatarError}</ErrorText>
        </div>
      </div>

      <hr className="epf-divider" />

      <div className="epf-field">
        <div className="epf-label-row">
          <label className="epf-label" htmlFor={unameId}>Username</label>
          <span className="epf-counter" aria-hidden="true">{username.length}/{USERNAME_MAX}</span>
        </div>
        <div className="epf-input-wrap">
          <span className="epf-input-prefix" aria-hidden="true">@</span>
          <input
            id={unameId}
            name="username"
            className="epf-input"
            data-mono="true"
            data-prefix="true"
            type="text"
            value={username}
            maxLength={USERNAME_MAX}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="your_handle"
            aria-invalid={errors.username || usernameStatus === USERNAME_STATUS.TAKEN || usernameStatus === USERNAME_STATUS.INVALID ? 'true' : undefined}
            aria-describedby={`${unameId}-status ${unameId}-hint${errors.username ? ` ${unameId}-err` : ''}`}
            onChange={(e) => onUsernameChange('username', e.target.value)}
          />
        </div>
        <div className="epf-row" style={{ justifyContent: 'space-between' }}>
          <span id={`${unameId}-status`} role="status" aria-live="polite">
            {view ? (
              <span className="epf-status" data-tone={view.tone}>
                {StatusIcon ? <StatusIcon className={view.spin ? 'epf-spin' : undefined} aria-hidden="true" focusable="false" /> : null}
                <span>{view.text}</span>
              </span>
            ) : null}
            {generating ? <span className="epf-sr">Generating a username</span> : null}
          </span>
          <span className="epf-row" style={{ gap: 4 }}>
            <button type="button" className="epf-btn" data-size="sm" onClick={onCopyUsername} disabled={!username} aria-label="Copy username">
              <Copy aria-hidden="true" focusable="false" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              className="epf-btn"
              data-size="sm"
              onClick={onGenerate}
              disabled={generating || !canGenerate}
              title={canGenerate ? 'Suggest an available username' : 'Username suggestions are unavailable'}
            >
              <Sparkles className={generating ? 'epf-spin' : undefined} aria-hidden="true" focusable="false" />
              <span>{generating ? 'Finding…' : 'Suggest'}</span>
            </button>
          </span>
        </div>
        <p id={`${unameId}-hint`} className="epf-hint">
          Letters, numbers, dots and underscores. Changing it changes how people find and mention you.
          {!hasUsernameService ? ' Availability checking is unavailable, so a new username cannot be saved right now.' : ''}
        </p>
        <ErrorText id={`${unameId}-err`}>{errors.username}</ErrorText>
      </div>

      <TextField
        id={`${baseId}-displayName`}
        name="displayName"
        label="Display name"
        value={displayName}
        onChange={onChange}
        error={errors.displayName}
        maxLength={NAME_MAX}
        counter
        autoComplete="name"
        placeholder="Citizen name"
      />
    </Card>
  );
});

const AboutSection = memo(function AboutSection({
  baseId, tagline, bio, pronouns, profession, education, gender, onChange, errors,
}) {
  const [custom, setCustom] = useState(() => pronouns !== '' && !PRONOUN_PRESETS.includes(pronouns));
  const pickPreset = (p) => { setCustom(false); onChange('pronouns', p); };
  const pickNone = () => { setCustom(false); onChange('pronouns', ''); };
  const pickCustom = () => {
    setCustom(true);
    if (PRONOUN_PRESETS.includes(pronouns)) onChange('pronouns', '');
  };
  const pronounsId = `${baseId}-pronouns`;
  return (
    <Card id="epf-about" icon={Sparkles} title="About you" description="Optional details that appear on your profile.">
      <TextField id={`${baseId}-tagline`} name="tagline" label="Tagline" optional value={tagline} onChange={onChange} error={errors.tagline}
        maxLength={STATUS_MAX} counter placeholder="Building soundscapes & open-source tools" />
      <TextField id={`${baseId}-bio`} name="bio" label="Bio" optional multiline rows={4} value={bio} onChange={onChange} error={errors.bio}
        maxLength={BIO_MAX} counter placeholder="Introduce yourself to the Arvdoul community…" />

      <div className="epf-field" role="group" aria-labelledby={`${pronounsId}-label`}>
        <span id={`${pronounsId}-label`} className="epf-label">Pronouns<span className="epf-optional">Optional</span></span>
        <div className="epf-pills">
          <button type="button" className="epf-pill" aria-pressed={!custom && pronouns === ''} onClick={pickNone}>Not shown</button>
          {PRONOUN_PRESETS.map((p) => (
            <button key={p} type="button" className="epf-pill" aria-pressed={!custom && pronouns === p} onClick={() => pickPreset(p)}>{p}</button>
          ))}
          <button type="button" className="epf-pill" aria-pressed={custom} onClick={pickCustom}>Custom</button>
        </div>
        {custom ? (
          <TextField id={pronounsId} name="pronouns" label="Custom pronouns" value={pronouns} onChange={onChange} error={errors.pronouns}
            maxLength={PRONOUNS_MAX} counter placeholder="e.g. ze/zir" />
        ) : <ErrorText>{errors.pronouns}</ErrorText>}
      </div>

      <div className="epf-grid2">
        <TextField id={`${baseId}-profession`} name="profession" label="Profession or role" optional value={profession} onChange={onChange}
          error={errors.profession} maxLength={PROFESSION_MAX} placeholder="Creator, builder, artist" />
        <TextField id={`${baseId}-education`} name="education" label="Education" optional value={education} onChange={onChange}
          error={errors.education} maxLength={EDUCATION_MAX} placeholder="Self-taught, Royal College of Art" />
      </div>
      <TextField id={`${baseId}-gender`} name="gender" label="Gender" optional value={gender} onChange={onChange} error={errors.gender}
        maxLength={GENDER_MAX} hint="Never required. Its visibility follows your Profile information audience." />
    </Card>
  );
});

const ClassificationSection = memo(function ClassificationSection({ profileType, baselineType, onChange, error }) {
  return (
    <Card id="epf-type" icon={Briefcase} title="Account classification" description="How your profile is labelled.">
      <div className="epf-type-grid" role="group" aria-label="Account classification">
        {PROFILE_TYPE_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" className="epf-type" aria-pressed={profileType === opt.id} onClick={() => onChange('profileType', opt.id)}>
            <b>{opt.label}</b>
            <span>{opt.hint}</span>
          </button>
        ))}
      </div>
      <p className="epf-hint">
        This is a label only. It does not grant creator tools, verify a business or organization, or create a community.
        Those are approved and enforced separately.
      </p>
      {profileType !== baselineType ? (
        <p className="epf-hint" role="status" style={{ color: 'var(--epf-warn)' }}>
          Changing your type does not delete existing creator, business or organization information.
        </p>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
});

const locationPreview = (location, privacy) => {
  const text = singleLine(location);
  if (privacy === 'hidden') return 'Hidden from your profile. Your saved location is kept.';
  if (!text) return 'No location set.';
  if (privacy === 'country_only') {
    const country = countryOf(text);
    return country ? `Visitors should see: ${country}` : 'No country could be identified.';
  }
  return `Visitors see: ${text}`;
};

const LocationLinksSection = memo(function LocationLinksSection({
  baseId, location, locationPrivacy, website, links, errors, linkErrors, onChange, onOpenMap,
  onAddLink, onUpdateLink, onRemoveLink, onPrimaryLink, onMoveLink, onCopyLink, isPrivate,
}) {
  const locId = `${baseId}-location`;
  const hidden = locationPrivacy === 'hidden';
  return (
    <Card id="epf-links" icon={MapPin} title="Location & links" description="Where you are and where people can find you.">
      <div className="epf-stack">
        <div className="epf-row" style={{ justifyContent: 'space-between' }}>
          <span className="epf-label">Location</span>
          <button type="button" className="epf-btn" data-size="sm" onClick={onOpenMap}>
            <MapPin aria-hidden="true" focusable="false" />
            <span>Choose on map</span>
          </button>
        </div>
        <TextField id={locId} name="location" label="Place" optional value={location} onChange={onChange} error={errors.location}
          maxLength={LOCATION_MAX} disabled={hidden} autoComplete="off"
          placeholder={hidden ? 'Hidden on your profile' : 'City, Country'}
          hint="Only this place text is saved from this screen. Use City, Country for best results." />
        <div className="epf-field">
          <label className="epf-label" htmlFor={`${locId}-vis`}>Who sees it</label>
          <select id={`${locId}-vis`} className="epf-select" value={locationPrivacy} aria-describedby={`${locId}-preview`}
            onChange={(e) => onChange('locationPrivacy', e.target.value)}>
            {LOCATION_PRIVACY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p id={`${locId}-preview`} className="epf-hint" role="status" aria-live="polite">
            {locationPreview(location, locationPrivacy)}
            {isPrivate ? ' Your private account may narrow this further.' : ''}
          </p>
        </div>
      </div>

      <hr className="epf-divider" />

      <TextField id={`${baseId}-website`} name="website" label="Website" optional type="url" inputMode="url" autoComplete="url"
        autoCapitalize="none" mono value={website} onChange={onChange} error={errors.website} placeholder="https://yourdomain.com" />

      <hr className="epf-divider" />

      <div className="epf-stack">
        <div className="epf-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="epf-label">Custom links</span>
            <p className="epf-hint" aria-live="polite">{links.length} of {LINK_MAX} used. The starred link is featured.</p>
          </div>
          <button type="button" className="epf-btn" data-size="sm" onClick={onAddLink} disabled={links.length >= LINK_MAX}>
            <Plus aria-hidden="true" focusable="false" />
            <span>Add link</span>
          </button>
        </div>

        {links.length === 0 ? (
          <div className="epf-empty">
            <LinkIcon aria-hidden="true" focusable="false" />
            <p style={{ margin: 0 }}>No links yet. Add your portfolio, channels or projects.</p>
          </div>
        ) : links.map((link, index) => {
          const lid = `${baseId}-link-${link.id}`;
          const err = linkErrors[link.id] || {};
          return (
            <div key={link.id} className="epf-link" data-primary={link.isPrimary ? 'true' : undefined} role="group" aria-label={`Link ${index + 1}`}>
              <div className="epf-link-grid">
                <div className="epf-field">
                  <label className="epf-label" htmlFor={`${lid}-platform`}>Platform</label>
                  <select id={`${lid}-platform`} className="epf-select" value={link.platform}
                    onChange={(e) => onUpdateLink(link.id, { platform: e.target.value })}>
                    {PLATFORM_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="epf-field">
                  <label className="epf-label" htmlFor={`${lid}-title`}>Label</label>
                  <input id={`${lid}-title`} className="epf-input" type="text" value={link.title} maxLength={LINK_TITLE_MAX}
                    placeholder={platformLabel(link.platform)} onChange={(e) => onUpdateLink(link.id, { title: e.target.value })} />
                </div>
              </div>
              <div className="epf-field">
                <label className="epf-label" htmlFor={`${lid}-url`}>URL</label>
                <input id={`${lid}-url`} className="epf-input" data-mono="true" type="url" inputMode="url" autoComplete="off"
                  autoCapitalize="none" spellCheck={false} value={link.url} placeholder="https://…"
                  aria-invalid={err.url ? 'true' : undefined} aria-describedby={err.url ? `${lid}-err` : undefined}
                  onChange={(e) => onUpdateLink(link.id, { url: e.target.value })} />
                <ErrorText id={`${lid}-err`}>{err.url}</ErrorText>
              </div>
              <div className="epf-link-actions">
                <button type="button" className="epf-icon-btn" aria-pressed={link.isPrimary} onClick={() => onPrimaryLink(link.id)}
                  aria-label={link.isPrimary ? `Link ${index + 1} is the featured link` : `Feature link ${index + 1}`} title={link.isPrimary ? 'Featured link' : 'Feature this link'}>
                  <Star aria-hidden="true" focusable="false" fill={link.isPrimary ? 'currentColor' : 'none'} />
                </button>
                <button type="button" className="epf-icon-btn" onClick={() => onMoveLink(index, -1)} disabled={index === 0} aria-label={`Move link ${index + 1} up`}>
                  <ChevronUp aria-hidden="true" focusable="false" />
                </button>
                <button type="button" className="epf-icon-btn" onClick={() => onMoveLink(index, 1)} disabled={index === links.length - 1} aria-label={`Move link ${index + 1} down`}>
                  <ChevronDown aria-hidden="true" focusable="false" />
                </button>
                <button type="button" className="epf-icon-btn" onClick={() => onCopyLink(link.url)} disabled={!link.url} aria-label={`Copy link ${index + 1} URL`}>
                  <Copy aria-hidden="true" focusable="false" />
                </button>
                <button type="button" className="epf-icon-btn" data-danger="true" onClick={() => onRemoveLink(link.id)} aria-label={`Remove link ${index + 1}`}>
                  <Trash2 aria-hidden="true" focusable="false" />
                </button>
              </div>
            </div>
          );
        })}
        <ErrorText>{errors.links}</ErrorText>
      </div>
    </Card>
  );
});

const CreatorSection = memo(function CreatorSection({ baseId, category, email, tip, creatorScope, onChange, onPrivacy, scopeOptions, errors }) {
  const knownCategory = !category || CREATOR_CATEGORIES.includes(category);
  const options = (knownCategory ? CREATOR_CATEGORIES : [category, ...CREATOR_CATEGORIES]).map((c) => ({ value: c, label: c }));
  return (
    <Card
      id="epf-creator"
      icon={Briefcase}
      tone="amber"
      title="Creator identity"
      description="Your creative discipline, business contact and patronage note."
      action={<span className="epf-status" data-tone="info">Active</span>}
    >
      <div className="epf-field">
        <label className="epf-label" htmlFor={`${baseId}-category`}><Palette aria-hidden="true" focusable="false" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: '-2px' }} />Primary discipline<span className="epf-optional">Optional</span></label>
        <select id={`${baseId}-category`} className="epf-select" value={category} onChange={(e) => onChange('creatorCategory', e.target.value)}>
          <option value="">Select a category</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <TextField id={`${baseId}-inquiries`} name="inquiriesEmail" label="Business contact email" optional type="email" inputMode="email"
        autoComplete="off" autoCapitalize="none" value={email} onChange={onChange} error={errors.inquiriesEmail} maxLength={INQUIRY_EMAIL_MAX}
        placeholder="mgmt@yourdomain.com" hint="Separate from your account email. It is not verified, and is shown only to the audience below." />
      <TextField id={`${baseId}-tip`} name="tipMessage" label="Patronage note" optional value={tip} onChange={onChange} maxLength={TIP_MAX} counter
        placeholder="Thanks for supporting my independent work!" />
      <SettingRow
        id={`${baseId}-creatorScope`}
        name="creatorInfo"
        icon={Users}
        label="Who sees creator details"
        hint="Discipline, business contact and patronage note"
        value={creatorScope}
        options={scopeOptions}
        onChange={onPrivacy}
      />
    </Card>
  );
});

const CivicRoyalSection = memo(function CivicRoyalSection({
  baseId, royalUnlocked, motto, aura, showLevel, showReputation, showStreak, defaultTab, onChange, onOpenTitles, errors,
}) {
  return (
    <Card id="epf-civic" icon={Crown} tone={royalUnlocked ? 'amber' : undefined} title="Royal & civic presentation"
      description="Heraldry, profile badges and your starting tab.">
      {royalUnlocked ? (
        <div className="epf-stack">
          <TextField id={`${baseId}-motto`} name="heraldicMotto" label="House creed or motto" optional value={motto} onChange={onChange}
            maxLength={MOTTO_MAX} counter placeholder="In Aetere Dignitas" />
          <div className="epf-field" role="group" aria-labelledby={`${baseId}-aura-label`}>
            <span id={`${baseId}-aura-label`} className="epf-label">Crest aura</span>
            <div className="epf-aura-grid">
              {CREST_AURAS.map((a) => (
                <button key={a.id} type="button" className="epf-aura" aria-pressed={aura === a.id} onClick={() => onChange('crestAura', a.id)}>
                  <i style={{ background: a.swatch }} aria-hidden="true" />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
            <p className="epf-hint">The aura is a cosmetic display choice. Titles and standing are earned and managed under Titles.</p>
            <ErrorText>{errors.crestAura}</ErrorText>
          </div>
        </div>
      ) : (
        <div className="epf-banner" data-tone="info">
          <Lock aria-hidden="true" focusable="false" />
          <div className="epf-banner-body">
            <b>Royal heraldry is locked</b>
            Heraldic options are unlocked by earned royal or noble standing. They cannot be chosen or self-assigned here.
          </div>
        </div>
      )}

      <hr className="epf-divider" />

      <div className="epf-stack">
        <Toggle id={`${baseId}-showLevel`} name="showLevel" icon={ShieldCheck} label="Level badge" hint="Show your level on your profile hero." checked={showLevel} onChange={onChange} />
        <Toggle id={`${baseId}-showRep`} name="showReputation" icon={Star} label="Reputation" hint="Show your reputation score." checked={showReputation} onChange={onChange} />
        <Toggle id={`${baseId}-showStreak`} name="showStreak" icon={Flame} label="Day streak" hint="Show your daily streak." checked={showStreak} onChange={onChange} />
        <p className="epf-hint">These switches only choose what to display. They never widen who is allowed to see you.</p>
      </div>

      <hr className="epf-divider" />

      <div className="epf-setting">
        <div className="epf-setting-text">
          <label className="epf-setting-title" htmlFor={`${baseId}-tab`}><LayoutGrid aria-hidden="true" focusable="false" /><span>Starting tab</span></label>
          <p className="epf-hint">The tab people see first. It is a preference, not a permission.</p>
        </div>
        <select id={`${baseId}-tab`} className="epf-select" value={DEFAULT_TAB_IDS.has(defaultTab) ? defaultTab : 'posts'}
          aria-invalid={errors.defaultTab ? 'true' : undefined} onChange={(e) => onChange('defaultTab', e.target.value)}>
          {DEFAULT_TAB_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <ErrorText>{errors.defaultTab}</ErrorText>

      <div className="epf-setting">
        <div className="epf-setting-text">
          <span className="epf-setting-title">Civic & royal title</span>
          <p className="epf-hint">Equip earned titles on your profile crest.</p>
        </div>
        <button type="button" className="epf-btn" data-size="sm" onClick={onOpenTitles}>
          <span>Manage titles</span>
          <ChevronRight aria-hidden="true" focusable="false" />
        </button>
      </div>
    </Card>
  );
});

const TREASURY_PREVIEW = (value) => {
  if (value === VISIBILITY_SCOPES.ONLY_ME) return 'Only you can see your coin balance.';
  if (value === VISIBILITY_SCOPES.CONNECTIONS) return 'Your friends can see your coin balance.';
  return 'Anyone who opens your profile can see your coin balance.';
};

const PrivacySection = memo(function PrivacySection({ baseId, isPrivate, privacy, onChange, onPrivacy, onFlag, errors }) {
  const limitedNote = (value) => (isPrivate && BROAD_SCOPES.has(value) ? 'Narrowed to approved friends while your account is private.' : null);
  const row = (key, icon, label, hint, opts = SCOPE_OPTIONS) => (
    <SettingRow
      key={key}
      id={`${baseId}-p-${key}`}
      name={key}
      icon={icon}
      label={label}
      hint={hint}
      value={privacy[key] ?? ''}
      options={opts}
      onChange={onPrivacy}
      note={limitedNote(privacy[key])}
      placeholder="Not set (default)"
    />
  );
  const economic = privacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME;
  return (
    <Card id="epf-privacy" icon={Lock} title="Privacy & audience" description="Who can see what. Private accounts always narrow these settings.">
      <Toggle id={`${baseId}-private`} name="isPrivate" icon={Lock} label="Private account"
        hint="Only approved friends can see your posts and highlights. Friend requests need your approval. Each setting below can only narrow this further, never widen it."
        checked={isPrivate} onChange={onFlag} />
      <p className="epf-hint">Follower-based audiences apply only where follower features are enabled for your account.</p>
      <hr className="epf-divider" />
      <div className="epf-stack">
        {row('profileInfo', User, 'Profile information', 'Bio, tagline, education and identity details')}
        {row('links', LinkIcon, 'Custom links', 'Your curated external links')}
        {row('presence', Globe, 'Online status', 'Who can see when you are online')}
      </div>
      <details className="epf-more">
        <summary>
          <span>More audience controls</span>
          <ChevronDown aria-hidden="true" focusable="false" />
        </summary>
        <div className="epf-stack" style={{ paddingTop: 8 }}>
          {row('followersList', Users, 'Followers list', 'Who can open your followers')}
          {row('followingList', Users, 'Following list', 'Who can open the accounts you follow')}
          {HAS_FRIENDS_LIST ? row('friendsList', Users, 'Friends list', 'Who can open your friends') : null}
          {row('activity', Flame, 'Activity', 'Who can see your activity')}
          {row('achievements', Star, 'Achievements', 'Who can see your badges and achievements')}
          {row('titles', Crown, 'Civic titles', 'Who can see your active title and noble provenance')}
          {row('communities', Users, 'Communities', 'Who can see the communities you joined')}
          {row('collections', LinkIcon, 'Collections', 'Who can see your curated collections')}
        </div>
      </details>
      <ErrorText>{errors.privacy}</ErrorText>

      <hr className="epf-divider" />

      <div className="epf-stack" style={{ gap: 10 }}>
        <div className="epf-row" style={{ gap: 10 }}>
          <span className="epf-icon-chip" data-tone="amber" aria-hidden="true"><Coins focusable="false" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="epf-label">Coin treasury card</span>
            <p className="epf-hint">Controls who can see your coin balance on your profile. Private by default.</p>
          </div>
        </div>
        <SettingRow
          id={`${baseId}-p-economicStatus`}
          name="economicStatus"
          label="Who sees my balance"
          value={economic}
          options={ECONOMIC_OPTIONS}
          onChange={onPrivacy}
          note={limitedNote(economic)}
        />
        <p className="epf-hint" role="status" aria-live="polite" style={economic === VISIBILITY_SCOPES.EVERYONE ? { color: 'var(--epf-warn)', fontWeight: 600 } : undefined}>
          {TREASURY_PREVIEW(economic)} This is a preference; your profile must apply it everywhere the balance can appear.
        </p>
      </div>
    </Card>
  );
});

const InteractionSection = memo(function InteractionSection({ baseId, settings, onOpenBlocked, onOpenSettings }) {
  const { loadState, values, pending, saved, errors, update, retry } = settings;
  const note = `${baseId}-interaction-note`;
  return (
    <Card id="epf-interaction" icon={Sliders} title="Interaction preferences"
      description="Saved instantly to your account settings. They are not part of the Save button below.">
      {loadState === 'error' ? (
        <div className="epf-banner" data-tone="warn" role="alert">
          <AlertCircle aria-hidden="true" focusable="false" />
          <div className="epf-banner-body">
            <b>Could not load your preferences</b>
            Nothing was changed.
            <div style={{ marginTop: 8 }}>
              <button type="button" className="epf-btn" data-size="sm" onClick={retry}><RefreshCw aria-hidden="true" focusable="false" /><span>Try again</span></button>
            </div>
          </div>
        </div>
      ) : null}
      {loadState === 'loading' ? <p id={note} className="epf-hint" role="status">Loading your preferences…</p> : null}
      <div className="epf-stack">
        {INTERACTION_FIELDS.map((f) => {
          const fid = `${baseId}-i-${f.key}`;
          const status = errors[f.key]
            ? <p className="epf-error" role="alert"><AlertCircle aria-hidden="true" focusable="false" /><span>{errors[f.key]}</span></p>
            : pending[f.key]
              ? <p className="epf-hint" role="status">Saving…</p>
              : saved[f.key]
                ? <p className="epf-hint" role="status" style={{ color: 'var(--epf-ok)' }}>Saved</p>
                : null;
          return (
            <SettingRow
              key={f.key}
              id={fid}
              name={f.key}
              icon={f.icon}
              label={f.label}
              hint={f.hint}
              value={values[f.key] ?? ''}
              options={f.options.map(([value, label]) => ({ value, label }))}
              onChange={update}
              disabled={loadState !== 'ready' || Boolean(pending[f.key])}
              statusNode={status}
              placeholder={loadState === 'ready' ? 'Choose…' : 'Loading…'}
            />
          );
        })}
      </div>
      <hr className="epf-divider" />
      <div className="epf-grid2">
        <button type="button" className="epf-btn" onClick={onOpenBlocked} style={{ justifyContent: 'space-between' }}>
          <span className="epf-row" style={{ gap: 8 }}><UserX aria-hidden="true" focusable="false" /><span>Blocked accounts</span></span>
          <ChevronRight aria-hidden="true" focusable="false" />
        </button>
        <button type="button" className="epf-btn" onClick={onOpenSettings} style={{ justifyContent: 'space-between' }}>
          <span className="epf-row" style={{ gap: 8 }}><Sliders aria-hidden="true" focusable="false" /><span>Account & notifications</span></span>
          <ChevronRight aria-hidden="true" focusable="false" />
        </button>
      </div>
    </Card>
  );
});

/* ============================================================================================
 * Editor (composition layer). Mounted with key={authUid}: a new account is a fresh editor.
 * ========================================================================================== */
const SECTION_NAV = [
  ['epf-identity', 'Identity'], ['epf-about', 'About'], ['epf-type', 'Type'], ['epf-links', 'Location & links'],
  ['epf-creator', 'Creator', 'creator'], ['epf-civic', 'Civic'], ['epf-privacy', 'Privacy'], ['epf-interaction', 'Interaction'],
];
const FIELD_LABELS = {
  displayName: 'display name', username: 'username', bio: 'bio', tagline: 'tagline', location: 'location',
  locationPrivacy: 'location visibility', website: 'website', pronouns: 'pronouns', profession: 'profession',
  education: 'education', gender: 'gender', profileType: 'account type', isPrivate: 'private account',
  links: 'links', privacy: 'privacy settings', creatorCategory: 'creator category', inquiriesEmail: 'business email',
  tipMessage: 'patronage note', heraldicMotto: 'house creed', crestAura: 'crest aura', showLevel: 'level badge',
  showReputation: 'reputation', showStreak: 'streak', defaultTab: 'starting tab',
};

const prefersReducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const verdictMessage = (verdict, name) => {
  if (verdict === USERNAME_STATUS.TAKEN) return `@${name} is already taken. Choose another or use Suggest.`;
  if (verdict === USERNAME_STATUS.INVALID || verdict === USERNAME_STATUS.IDLE) return `Use ${USERNAME_MIN}-${USERNAME_MAX} letters, numbers, dots or underscores.`;
  return `We could not verify @${name}. Check your connection and try saving again.`;
};

function EditProfileEditor({ authUid, profile, user, theme, navigate, updateUserProfile, userService, loadStoreProfile }) {
  const alive = useAlive();
  const baseId = useId();
  const ctx = useMemo(() => ({ email: user && typeof user.email === 'string' ? user.email : '' }), [user]);

  const [state, dispatch] = useReducer(formReducer, null, () => {
    const initial = profileToForm(profile, ctx);
    return { form: initial, baseline: initial, conflicts: [] };
  });
  const { form, baseline } = state;
  useEffect(() => { dispatch({ type: 'remote', form: profileToForm(profile, ctx) }); }, [profile, ctx]);

  const [fieldErrors, setFieldErrors] = useState({});
  const [linkErrors, setLinkErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: 'discard' | 'removeAvatar' | 'removeLink', id? }
  const [showLocation, setShowLocation] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [photoOverride, setPhotoOverride] = useState(undefined);
  const [focusRequest, setFocusRequest] = useState(null);
  const savingRef = useRef(false);
  const removingRef = useRef(false);
  const leavingRef = useRef(false);

  const userLevel = toSafeLevel(profile.level ?? (user && user.level));
  const creatorUnlocked = useMemo(() => {
    try { return Boolean(resolveCreatorFlag(profile, user || {}, userLevel)); } catch { return false; }
  }, [profile, user, userLevel]);
  const royalUnlocked = useMemo(() => {
    try { return Boolean(resolveRoyalFlag(profile)); } catch { return false; }
  }, [profile]);

  const currentUsername = typeof profile.username === 'string' ? normalizeUsername(profile.username) : '';
  const uname = useUsernameAvailability({ uid: authUid, userService, value: form.username, currentUsername, alive });
  const avatar = useAvatarEditor(alive);
  const interaction = useInteractionSettings({ uid: authUid, alive });

  const canPersist = typeof updateUserProfile === 'function' || typeof userService?.updateUserProfile === 'function';
  const hasUsernameService = typeof userService?.checkUsernameAvailability === 'function';
  const canGenerate = typeof userService?.generateUniqueUsername === 'function' && hasUsernameService;

  // Avatar source: staged object URL, else the canonical URL (override bridges the gap until context catches up).
  const remotePhoto = photoOverride !== undefined ? photoOverride : (typeof profile.photoURL === 'string' ? profile.photoURL : '');
  useEffect(() => {
    if (photoOverride !== undefined && (profile.photoURL || '') === photoOverride) setPhotoOverride(undefined);
  }, [profile.photoURL, photoOverride]);
  const hasRemoteAvatar = Boolean(remotePhoto);
  const avatarSrc = avatar.staged
    ? avatar.staged.previewUrl
    : getSafeAvatarUrl(remotePhoto || null, form.displayName || profile.displayName || null, authUid);

  // Dirty tracking is structural, per field, against the normalised baseline.
  const dirtyKeys = useMemo(() => FORM_KEYS.filter((k) => !valuesEqual(form[k], baseline[k])), [form, baseline]);
  const isDirty = dirtyKeys.length > 0 || Boolean(avatar.staged);
  const activeConflicts = state.conflicts.filter((k) => !valuesEqual(form[k], baseline[k]));

  // ---- field handlers (stable) ----
  const clearError = useCallback((key) => {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
  }, []);
  const setField = useCallback((key, value) => {
    dispatch({ type: 'field', key, value });
    clearError(key);
  }, [clearError]);
  const setUsername = useCallback((key, value) => setField(key, normalizeUsername(value)), [setField]);
  const setFlag = useCallback((key, value) => setField(key, Boolean(value)), [setField]);
  const setPrivacy = useCallback((key, value) => {
    dispatch({ type: 'privacy', patch: { [key]: value } });
    clearError('privacy');
  }, [clearError]);

  const addLink = useCallback(() => {
    if (form.links.length >= LINK_MAX) { toast.error(`You can add up to ${LINK_MAX} links.`); return; }
    dispatch({
      type: 'links',
      update: (links) => ensureSinglePrimary([...links, { id: makeId(), title: '', url: '', platform: 'website', isPrimary: links.length === 0 }]),
    });
  }, [form.links.length]);
  const updateLink = useCallback((id, patch) => {
    dispatch({ type: 'links', update: (links) => links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
    setLinkErrors((prev) => (prev[id] ? { ...prev, [id]: null } : prev));
    clearError('links');
  }, [clearError]);
  const requestRemoveLink = useCallback((id) => {
    const link = form.links.find((l) => l.id === id);
    if (link && (singleLine(link.url) || singleLine(link.title))) setDialog({ kind: 'removeLink', id });
    else dispatch({ type: 'links', update: (links) => removeLinkById(links, id) });
  }, [form.links]);
  const primaryLink = useCallback((id) => dispatch({ type: 'links', update: (links) => setPrimaryLink(links, id) }), []);
  const moveLinkBy = useCallback((index, delta) => dispatch({ type: 'links', update: (links) => moveLink(links, index, delta) }), []);

  const copyText = useCallback(async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Copy is not available here.');
    }
  }, []);
  const copyUsername = useCallback(() => copyText(`@${form.username}`, 'Username'), [copyText, form.username]);
  const copyLink = useCallback((url) => copyText(url, 'Link'), [copyText]);

  const handleGenerate = useCallback(async () => {
    const seed = form.displayName || profile.displayName || (ctx.email ? ctx.email.split('@')[0] : '') || 'creator';
    const res = await uname.generate(seed);
    if (!alive.current) return;
    if (res.ok) {
      setField('username', res.username);
      toast.success(`@${res.username} is available`);
    } else if (res.reason === 'none') {
      toast.error('No available username found. Try again or type your own.');
    } else if (res.reason === 'cooldown') {
      toast.message('Please wait a moment before suggesting again.');
    } else if (res.reason !== 'stale') {
      toast.error('Could not suggest a username right now.');
    }
  }, [form.displayName, profile.displayName, ctx.email, uname, alive, setField]);

  // ---- store synchronisation (after the authoritative write; never rolls the write back) ----
  const syncStores = useCallback(async (uid, updates) => {
    let ok = true;
    try {
      useProfileStore.setState((s) => (s.profile && (s.profile.uid === uid || s.profile.id === uid)
        ? { profile: { ...s.profile, ...updates } } : s));
    } catch { ok = false; }
    try {
      const app = useAppStore.getState().currentUser;
      if (app && (app.uid === uid || app.id === uid)) useAppStore.getState().setCurrentUser({ ...app, ...updates });
    } catch { ok = false; }
    try { patchCachedProfile(uid, updates); invalidateProfileCache(uid); } catch { ok = false; }
    try { if (typeof loadStoreProfile === 'function') await loadStoreProfile(uid, uid, { force: true }); } catch { ok = false; }
    return ok;
  }, [loadStoreProfile]);

  const warnSync = useCallback((uid, updates) => {
    toast.warning('Saved, but some views may be out of date.', {
      action: {
        label: 'Refresh',
        onClick: async () => {
          const ok = await syncStores(uid, updates);
          if (ok) toast.success('Views refreshed'); else toast.error('Still could not refresh. Reopen your profile.');
        },
      },
    });
  }, [syncStores]);

  // ---- validation display + focus ----
  const focusIdFor = useCallback((key, links) => {
    if (key === 'links') {
      const firstId = links && Object.keys(links).find((id) => links[id]);
      return firstId ? `${baseId}-link-${firstId}-url` : 'epf-links-h';
    }
    const map = {
      username: `${baseId}-username`, displayName: `${baseId}-displayName`, bio: `${baseId}-bio`, tagline: `${baseId}-tagline`,
      website: `${baseId}-website`, location: `${baseId}-location`, pronouns: `${baseId}-pronouns`, profession: `${baseId}-profession`,
      education: `${baseId}-education`, gender: `${baseId}-gender`, inquiriesEmail: `${baseId}-inquiries`, defaultTab: `${baseId}-tab`,
      privacy: 'epf-privacy-h', profileType: 'epf-type-h', crestAura: 'epf-civic-h',
    };
    return map[key] || null;
  }, [baseId]);

  const showErrors = useCallback((fields, links, general) => {
    setFieldErrors(fields || {});
    setLinkErrors(links || {});
    const entries = Object.entries(fields || {}).filter(([, v]) => v);
    const first = entries[0];
    const message = (first && first[1]) || general || 'Please correct the highlighted fields.';
    setSubmitError({ title: 'Your changes were not saved', message, count: entries.length });
    toast.error(message);
    if (first) {
      const id = focusIdFor(first[0], links);
      if (id) setFocusRequest({ id, n: Date.now() });
    }
  }, [focusIdFor]);

  useEffect(() => {
    if (!focusRequest) return;
    const el = document.getElementById(focusRequest.id);
    if (el) {
      el.focus();
      try { el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); } catch { /* ignore */ }
    }
  }, [focusRequest]);

  // ---- save ----
  const handleSave = useCallback(async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    if (savingRef.current || removingRef.current) return;
    if (!canPersist) {
      setSubmitError({ title: 'Saving is unavailable', message: 'The profile service is not available right now. Your edits are kept.' });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const { errors, linkErrors: linkErrs, raw } = prepareUpdates(form, { creatorUnlocked, royalUnlocked });
      if (Object.keys(errors).length) { showErrors(errors, linkErrs); return; }

      const validation = validateProfileUpdate(raw);
      if (!validation || !validation.valid) {
        const mapped = mapValidationErrors(validation && validation.errors);
        showErrors(mapped.fields, {}, mapped.general);
        return;
      }
      const updates = { ...validation.sanitized };

      const chosen = updates.username || raw.username;
      if (chosen !== currentUsername) {
        const verdict = await uname.check(chosen, { force: true });
        if (!alive.current) return;
        if (verdict !== USERNAME_STATUS.AVAILABLE) { showErrors({ username: verdictMessage(verdict, chosen) }); return; }
      }

      let uploadedUrl = null;
      const staged = avatar.staged;
      if (staged) {
        uploadedUrl = staged.uploadedUrl;
        if (!uploadedUrl) {
          if (typeof userService?.uploadAvatar !== 'function') throw new Error('Photo uploads are unavailable right now. Your other edits are kept.');
          const result = await userService.uploadAvatar(authUid, staged.file);
          uploadedUrl = pickUploadedUrl(result);
          if (!uploadedUrl) throw new Error('Could not confirm the uploaded photo. Please try again.');
          if (alive.current) avatar.markUploaded(uploadedUrl);
        }
        updates.photoURL = uploadedUrl;
      }
      if (!alive.current) return;

      if (typeof updateUserProfile === 'function') {
        await updateUserProfile(updates, { silent: true });
      } else {
        const { photoURL: alreadySaved, ...rest } = updates; // uploadAvatar already stored the photo
        await userService.updateUserProfile(authUid, uploadedUrl ? rest : updates);
        if (alreadySaved === undefined) { /* nothing extra */ }
      }

      // The write is committed from here on. Store/cache problems are warnings, never rollbacks.
      const synced = await syncStores(authUid, updates);
      if (!alive.current) return;
      dispatch({ type: 'saved', form: profileToForm({ ...profile, ...updates }, ctx) });
      if (uploadedUrl) { setPhotoOverride(uploadedUrl); avatar.discard(); }
      setFieldErrors({});
      setLinkErrors({});
      toast.success('Profile updated');
      if (!synced) warnSync(authUid, updates);
      leavingRef.current = true;
      navigate('/profile/me');
    } catch (error) {
      const message = (error && error.message) || 'Failed to update profile';
      if (/username/i.test(message) && /(taken|exists|already|unavailable|conflict)/i.test(message)) {
        showErrors({ username: message });
      } else {
        setSubmitError({ title: 'Your changes were not saved', message, retry: true });
        toast.error(message);
      }
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }, [form, creatorUnlocked, royalUnlocked, canPersist, currentUsername, uname, avatar, userService, updateUserProfile,
    authUid, profile, ctx, navigate, syncStores, warnSync, showErrors, alive]);

  // ---- avatar ----
  const handleAvatarCropped = useCallback(async (file) => {
    const res = await avatar.stage(file);
    if (!res.ok && res.error && res.error !== 'closed') toast.error(res.error);
    return res.ok;
  }, [avatar]);

  const requestRemoveAvatar = useCallback(() => {
    if (savingRef.current || removingRef.current) return;
    setShowAvatar(false);
    if (avatar.staged) { avatar.discard(); return; }
    if (hasRemoteAvatar) setDialog({ kind: 'removeAvatar' });
  }, [avatar, hasRemoteAvatar]);

  const confirmRemoveAvatar = useCallback(async () => {
    setDialog(null);
    if (savingRef.current || removingRef.current) return;
    if (!canPersist) { toast.error('Removing the photo is unavailable right now.'); return; }
    removingRef.current = true;
    setRemoving(true);
    try {
      if (typeof updateUserProfile === 'function') await updateUserProfile({ photoURL: '' }, { silent: true });
      else await userService.updateUserProfile(authUid, { photoURL: '' });
      const synced = await syncStores(authUid, { photoURL: '' });
      if (alive.current) {
        avatar.discard();
        setPhotoOverride('');
        toast.success('Photo removed');
        if (!synced) warnSync(authUid, { photoURL: '' });
      }
    } catch (error) {
      toast.error((error && error.message) || 'Could not remove the photo. It was not changed.');
    } finally {
      removingRef.current = false;
      if (alive.current) setRemoving(false);
    }
  }, [canPersist, updateUserProfile, userService, authUid, syncStores, warnSync, avatar, alive]);

  // ---- leaving ----
  const goBack = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    navigate(-1);
  }, [navigate]);
  const handleCancel = useCallback(() => {
    if (savingRef.current || removingRef.current) return;
    if (isDirty) { setDialog({ kind: 'discard' }); return; }
    goBack();
  }, [isDirty, goBack]);

  // Browser/tab close protection. In-app route interception needs a data-router blocker, which cannot be
  // verified from this file; Cancel/Back are guarded here.
  useEffect(() => {
    if (!isDirty || saving) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, saving]);

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const heading = document.getElementById(`${id}-h`);
    if (heading) heading.focus({ preventScroll: true });
  }, []);

  // ---- derived UI ----
  const unameBlocking = form.username !== currentUsername
    && (uname.status === USERNAME_STATUS.CHECKING || uname.status === USERNAME_STATUS.TAKEN || uname.status === USERNAME_STATUS.INVALID);
  const saveDisabled = saving || removing || !canPersist || !isDirty || unameBlocking;
  let barStatus;
  if (saving) barStatus = <b>Saving…</b>;
  else if (!canPersist) barStatus = <b>Saving is unavailable right now</b>;
  else if (unameBlocking && uname.status === USERNAME_STATUS.CHECKING) barStatus = <span>Checking <b>@{form.username}</b>…</span>;
  else if (unameBlocking) barStatus = <span>{usernameStatusText(uname.status) || 'Fix the username to save'}</span>;
  else if (isDirty) barStatus = <b>Unsaved changes</b>;
  else barStatus = <span>All changes saved</span>;

  const scopeOptionsAll = SCOPE_OPTIONS;
  const liveMessage = saving ? 'Saving profile' : submitError ? submitError.message : '';
  const displayLabel = form.displayName || profile.displayName || 'Your profile';

  return (
    <form className="epf-form" onSubmit={handleSave} noValidate aria-busy={saving ? 'true' : undefined}>
      <main className="epf-main">
        <header className="epf-header">
          <button type="button" className="epf-back" onClick={handleCancel} disabled={saving || removing} aria-label="Go back">
            <ArrowLeft aria-hidden="true" focusable="false" />
          </button>
          <div className="epf-head-text">
            <h1 className="epf-title">Edit profile</h1>
            <p className="epf-sub">Changes below apply when you save. Interaction preferences save instantly.</p>
          </div>
        </header>

        <div className="epf-summary epf-card" aria-label="Profile summary">
          <div className="epf-card-inner" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <span className="epf-avatar-wrap" style={{ width: 52, height: 52, padding: 2 }}>
              <span className="epf-avatar" style={{ display: 'block', borderWidth: 2 }}>
                <LazyImage src={avatarSrc} alt="" className="w-full h-full object-cover" />
              </span>
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="epf-summary-name">{displayLabel}</p>
              <span className="epf-handle">@{form.username || 'username'}</span>
            </div>
            {form.isPrivate ? <span className="epf-status" data-tone="info"><Lock aria-hidden="true" focusable="false" />Private</span> : null}
          </div>
        </div>

        <nav className="epf-nav" aria-label="Edit profile sections">
          {SECTION_NAV.filter(([, , gate]) => gate !== 'creator' || creatorUnlocked).map(([id, label]) => (
            <button key={id} type="button" className="epf-nav-btn" onClick={() => scrollToSection(id)}>{label}</button>
          ))}
        </nav>

        <div className="epf-sr" role="status" aria-live="polite">{liveMessage}</div>

        {submitError ? (
          <div className="epf-banner" data-tone="err" role="alert">
            <AlertCircle aria-hidden="true" focusable="false" />
            <div className="epf-banner-body">
              <b>{submitError.title}</b>
              {submitError.message}
              {submitError.retry ? (
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="epf-btn" data-size="sm" onClick={handleSave} disabled={saving}>
                    <RefreshCw aria-hidden="true" focusable="false" /><span>Try again</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeConflicts.length > 0 ? (
          <div className="epf-banner" data-tone="warn" role="alert">
            <AlertCircle aria-hidden="true" focusable="false" />
            <div className="epf-banner-body">
              <b>Your profile changed elsewhere</b>
              Newer values exist for: {activeConflicts.map((k) => FIELD_LABELS[k] || k).join(', ')}. Your unsaved edits were kept.
              <div className="epf-row" style={{ marginTop: 8 }}>
                <button type="button" className="epf-btn" data-size="sm" onClick={() => dispatch({ type: 'keepMine' })}>Keep my edits</button>
                <button type="button" className="epf-btn" data-size="sm" onClick={() => dispatch({ type: 'useRemote', keys: activeConflicts })}>Use latest</button>
              </div>
            </div>
          </div>
        ) : null}

        <fieldset disabled={saving || removing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IdentitySection
            baseId={baseId}
            avatarSrc={avatarSrc}
            hasRemoteAvatar={hasRemoteAvatar}
            hasStaged={Boolean(avatar.staged)}
            avatarError={avatar.state.status === 'error' ? avatar.state.error : null}
            onOpenAvatar={() => setShowAvatar(true)}
            onRemoveAvatar={requestRemoveAvatar}
            removing={removing}
            displayName={form.displayName}
            username={form.username}
            usernameStatus={uname.status}
            generating={uname.generating}
            onGenerate={handleGenerate}
            onCopyUsername={copyUsername}
            onChange={setField}
            onUsernameChange={setUsername}
            errors={fieldErrors}
            hasUsernameService={hasUsernameService}
            canGenerate={canGenerate}
          />
          <AboutSection
            baseId={baseId}
            tagline={form.tagline}
            bio={form.bio}
            pronouns={form.pronouns}
            profession={form.profession}
            education={form.education}
            gender={form.gender}
            onChange={setField}
            errors={fieldErrors}
          />
          <ClassificationSection profileType={form.profileType} baselineType={baseline.profileType} onChange={setField} error={fieldErrors.profileType} />
          <LocationLinksSection
            baseId={baseId}
            location={form.location}
            locationPrivacy={form.locationPrivacy}
            website={form.website}
            links={form.links}
            errors={fieldErrors}
            linkErrors={linkErrors}
            onChange={setField}
            onOpenMap={() => setShowLocation(true)}
            onAddLink={addLink}
            onUpdateLink={updateLink}
            onRemoveLink={requestRemoveLink}
            onPrimaryLink={primaryLink}
            onMoveLink={moveLinkBy}
            onCopyLink={copyLink}
            isPrivate={form.isPrivate}
          />
          {creatorUnlocked ? (
            <CreatorSection
              baseId={baseId}
              category={form.creatorCategory}
              email={form.inquiriesEmail}
              tip={form.tipMessage}
              creatorScope={form.privacy.creatorInfo ?? ''}
              onChange={setField}
              onPrivacy={setPrivacy}
              scopeOptions={scopeOptionsAll}
              errors={fieldErrors}
            />
          ) : null}
          <CivicRoyalSection
            baseId={baseId}
            royalUnlocked={royalUnlocked}
            motto={form.heraldicMotto}
            aura={form.crestAura}
            showLevel={form.showLevel}
            showReputation={form.showReputation}
            showStreak={form.showStreak}
            defaultTab={form.defaultTab}
            onChange={setField}
            onOpenTitles={() => navigate('/titles')}
            errors={fieldErrors}
          />
          <PrivacySection
            baseId={baseId}
            isPrivate={form.isPrivate}
            privacy={form.privacy}
            onChange={setField}
            onPrivacy={setPrivacy}
            onFlag={setFlag}
            errors={fieldErrors}
          />
          <InteractionSection
            baseId={baseId}
            settings={interaction}
            onOpenBlocked={() => navigate('/settings/blocked')}
            onOpenSettings={() => navigate('/settings')}
          />
        </fieldset>
      </main>

      <div className="epf-bar">
        <div className="epf-bar-inner">
          <div className="epf-bar-status" role="status" aria-live="polite">{barStatus}</div>
          <button type="button" className="epf-btn" onClick={handleCancel} disabled={saving || removing}>Cancel</button>
          <button type="submit" className="epf-btn" data-variant="primary" disabled={saveDisabled}>
            {saving ? <RefreshCw className="epf-spin" aria-hidden="true" focusable="false" /> : <Save aria-hidden="true" focusable="false" />}
            <span>{saving ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </div>

      <Suspense fallback={null}>
        {showAvatar ? (
          <AvatarUploadModal
            isOpen={showAvatar}
            onClose={() => setShowAvatar(false)}
            onUpload={handleAvatarCropped}
            onRemoveAvatar={requestRemoveAvatar}
            currentAvatarUrl={avatarSrc}
            theme={theme}
          />
        ) : null}
        {showLocation ? (
          <ProfileLocationModal
            isOpen={showLocation}
            onClose={() => setShowLocation(false)}
            currentLocation={form.location}
            currentPrivacy={form.locationPrivacy}
            userId={authUid}
            theme={theme}
            onLocationUpdated={(newLoc, newPrivacy) => {
              const loc = typeof newLoc === 'string' ? singleLine(newLoc).slice(0, LOCATION_MAX) : null;
              if (loc === null) { toast.error('That location was not valid.'); return; }
              const patch = { location: loc };
              if (LOCATION_PRIVACY_IDS.has(newPrivacy)) patch.locationPrivacy = newPrivacy;
              dispatch({ type: 'patch', patch });
              setShowLocation(false);
            }}
          />
        ) : null}
      </Suspense>

      <Dialog
        isOpen={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog && dialog.kind === 'discard' ? 'Discard unsaved changes?'
          : dialog && dialog.kind === 'removeAvatar' ? 'Remove your photo?' : 'Remove this link?'}
        size="sm"
      >
        <div className="epf-theme" data-theme={theme}>
          <div className="epf-stack" style={{ gap: 16 }}>
            <p className="epf-hint" style={{ fontSize: 14 }}>
              {dialog && dialog.kind === 'discard' ? 'Your edits to this profile will be lost.'
                : dialog && dialog.kind === 'removeAvatar' ? 'Your avatar returns to the default citizen monogram. This takes effect immediately.'
                  : 'This link and its label will be removed when you save.'}
            </p>
            <div className="epf-row" style={{ gap: 12 }}>
              <button type="button" className="epf-btn" style={{ flex: 1 }} onClick={() => setDialog(null)}>
                {dialog && dialog.kind === 'discard' ? 'Keep editing' : 'Cancel'}
              </button>
              <button
                type="button"
                className="epf-btn"
                data-variant="danger"
                style={{ flex: 1 }}
                onClick={() => {
                  const d = dialog;
                  setDialog(null);
                  if (!d) return;
                  if (d.kind === 'discard') goBack();
                  else if (d.kind === 'removeAvatar') confirmRemoveAvatar();
                  else dispatch({ type: 'links', update: (links) => removeLinkById(links, d.id) });
                }}
              >
                {dialog && dialog.kind === 'discard' ? 'Discard' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </form>
  );
}

/* ============================================================================================
 * Gate: the authenticated Firebase UID is the only identity authority.
 * ========================================================================================== */
const SAFE_GRADIENT = typeof BRAND_GRADIENT === 'string' && /gradient\(/i.test(BRAND_GRADIENT) && !/[;{}]/.test(BRAND_GRADIENT) ? BRAND_GRADIENT : undefined;

function Shell({ theme, children }) {
  const themeName = theme === 'dark' ? 'dark' : 'light';
  let glow = 'rgba(139,30,243,0.35)';
  try { glow = brandRgba(0.35) || glow; } catch { /* keep fallback */ }
  return (
    <div className="epf-root" data-theme={themeName} style={{ '--epf-grad': SAFE_GRADIENT, '--epf-glow': glow }}>
      <style href="arvdoul-edit-profile-styles" precedence="medium">{STYLES}</style>
      {children}
    </div>
  );
}

function GateStatus({ theme, kind, onBack, onRetry }) {
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (kind !== 'profile') return undefined;
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [kind, attempt]);

  const loading = kind === 'loading' || (kind === 'profile' && !timedOut);
  return (
    <Shell theme={theme}>
      <div className="epf-center">
        {loading ? (
          <div role="status" aria-live="polite" className="epf-stack" style={{ alignItems: 'center' }}>
            <RefreshCw className="epf-spin" aria-hidden="true" focusable="false" style={{ width: 28, height: 28, color: 'var(--epf-accent-text)' }} />
            <p className="epf-sub">Loading your profile…</p>
          </div>
        ) : (
          <div role="alert" className="epf-stack" style={{ alignItems: 'center', maxWidth: 360 }}>
            <AlertCircle aria-hidden="true" focusable="false" style={{ width: 28, height: 28, color: 'var(--epf-warn)' }} />
            <h1 className="epf-title" style={{ fontSize: 18 }}>
              {kind === 'signedOut' ? 'Sign in to edit your profile' : 'Your profile is unavailable'}
            </h1>
            <p className="epf-sub">
              {kind === 'signedOut' ? 'You need to be signed in to change your profile.' : 'We could not load your profile. Nothing was changed.'}
            </p>
            <div className="epf-row" style={{ justifyContent: 'center' }}>
              {kind === 'profile' ? (
                <button type="button" className="epf-btn" onClick={() => { setAttempt((n) => n + 1); onRetry(); }}>
                  <RefreshCw aria-hidden="true" focusable="false" /><span>Try again</span>
                </button>
              ) : null}
              <button type="button" className="epf-btn" onClick={onBack}>Go back</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const auth = useAuth() || {};
  const { user, userProfile, updateUserProfile, userService } = auth;
  const loadStoreProfile = useProfileStore((state) => state.loadProfile);

  const authUid = typeof user?.uid === 'string' && user.uid ? user.uid : null;
  const authLoading = ['loading', 'initializing', 'isLoading', 'authLoading'].some((k) => auth[k] === true);

  // The profile is accepted only if it belongs to the authenticated account.
  const profile = authUid && isPlainObject(userProfile)
    && [userProfile.uid, userProfile.id].every((v) => v === undefined || v === null || v === authUid)
    ? userProfile : null;

  const back = useCallback(() => navigate(-1), [navigate]);
  const retry = useCallback(() => {
    if (authUid && typeof loadStoreProfile === 'function') {
      try { Promise.resolve(loadStoreProfile(authUid, authUid, { force: true })).catch(() => {}); } catch { /* ignore */ }
    }
  }, [authUid, loadStoreProfile]);

  if (!authUid) return <GateStatus theme={theme} kind={authLoading ? 'loading' : 'signedOut'} onBack={back} onRetry={retry} />;
  if (!profile) return <GateStatus theme={theme} kind="profile" onBack={back} onRetry={retry} />;

  return (
    <Shell theme={theme}>
      <EditProfileEditor
        key={authUid}
        authUid={authUid}
        profile={profile}
        user={user}
        theme={theme}
        navigate={navigate}
        updateUserProfile={updateUserProfile}
        userService={userService}
        loadStoreProfile={loadStoreProfile}
      />
    </Shell>
  );
}
