/**
 * Production-grade Arvdoul Edit Profile Screen.
 * 
 * Specifically designed for Arvdoul:
 * - NO background/cover images (Arvdoul does not support background images).
 * - Full alignment with Arvdoul design tokens (arvdoul-gradient, arvdoul-surface, arvdoul-border).
 * - Progressive sections based on Level, Creator status, and Royal Standing:
 *     - Creator Suite (Category, Inquiries Email, Patronage Tip Note)
 *     - Royal & Nobility Heraldic Settings (House Creed, Insignia/Crest Aura)
 *     - Civic Display Preferences (Level badge, Reputation score, Streak, Default tab)
 * - Robust protection against background snapshot resets during live typing.
 * - Integrated unique username generation & live availability checker via userService.
 * - Interactive Avatar Studio with 1:1 circular crop.
 * - Granular Privacy & Audience Governance adhering to profileContracts.js.
 * - Interactive Location Modal & Civic Coordinates.
 * 
 * @component
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  Camera, 
  Save, 
  User, 
  MapPin, 
  Globe, 
  Plus, 
  Trash2, 
  Lock, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link as LinkIcon,
  Star,
  AtSign,
  Coins,
  Crown,
  Briefcase,
  Mail,
  HeartHandshake,
  ShieldCheck,
  Flame,
  LayoutGrid,
  Palette,
  MessageSquare,
  Phone,
  Users,
  Gift,
  Sliders,
  UserX,
  ChevronRight
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
  validateProfileUpdate 
} from '../../config/profileContracts.js';
import { settingsService, DEFAULT_SETTINGS } from '../../services/settingsService.js';
import { isPlaceholderHandle, resolveCreatorFlag, resolveRoyalFlag } from '../../services/profileReadModel.js';
import { LEVEL_GATES } from "../../shared/levelConfig.cjs";
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';
import AvatarUploadModal from '../../components/profile/AvatarUploadModal';
import { Dialog } from '../../components/UI/Dialog.jsx';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { BRAND_GRADIENT, brandRgba, tokens } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useAppStore } from '../../store/appStore';

const PROFILE_TYPE_OPTIONS = [
  { id: PROFILE_TYPES.PERSONAL, label: 'Personal', hint: 'Individual citizen profile' },
  { id: PROFILE_TYPES.CREATOR, label: 'Creator', hint: 'Artists, makers & publishers' },
  { id: PROFILE_TYPES.BUSINESS, label: 'Business', hint: 'Brands & studios' },
  { id: PROFILE_TYPES.ORGANIZATION, label: 'Organization', hint: 'Institutions & nonprofits' },
  { id: PROFILE_TYPES.COMMUNITY, label: 'Community', hint: 'Clubs & collectives' },
];

const PRONOUN_PRESETS = ['they/them', 'she/her', 'he/him', 'other'];

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

const CREATOR_CATEGORIES = [
  'Music & Audio',
  'Visual Arts & 3D',
  'Tech & Software',
  'Gaming & Interactive',
  'Writing & Journalism',
  'Education & Science',
  'Fashion & Lifestyle',
  'Community & Civic Governance',
  'Entertainment & Comedy',
];

const CREST_AURAS = [
  { id: 'gold', label: 'Solar Gold', color: 'from-amber-400 to-yellow-500', ring: 'ring-amber-400' },
  { id: 'purple', label: 'Imperial Purple', color: 'from-purple-500 to-indigo-600', ring: 'ring-purple-400' },
  { id: 'royal', label: 'Crown Sapphire', color: 'from-blue-500 to-indigo-700', ring: 'ring-blue-400' },
  { id: 'cyan', label: 'Astral Cyan', color: 'from-cyan-400 to-teal-500', ring: 'ring-cyan-400' },
  { id: 'emerald', label: 'Sovereign Emerald', color: 'from-emerald-400 to-green-600', ring: 'ring-emerald-400' },
];

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user, userProfile, updateUserProfile, userService } = useAuth();
  const loadStoreProfile = useProfileStore((state) => state.loadProfile);

  // Effective user reference
  const currentUid = userProfile?.uid || userProfile?.id || user?.uid;
  const rawLevel = userProfile?.level ?? user?.level;
  const userLevel = rawLevel != null ? Number(rawLevel) : null;

  // Progressive unlock flags. Creator standing comes from the canonical read
  // model (explicit flags first, then the level gate) so this form cannot drift
  // from the profile surfaces.
  const isCreatorAccount = resolveCreatorFlag(userProfile || {}, user || {}, userLevel);

  const isRoyalOrNoble = Boolean(
    resolveRoyalFlag(userProfile) ||
    (userLevel != null && userLevel >= LEVEL_GATES.sovereign)
  );

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    tagline: '',
    location: '',
    locationPrivacy: 'public',
    website: '',
    pronouns: '',
    profession: '',
    education: '',
    gender: '',
    profileType: PROFILE_TYPES.PERSONAL,
    isPrivate: false,
    links: [],
    privacy: {
      ...DEFAULT_PROFILE_PRIVACY,
    },
    // Creator Suite
    creatorCategory: '',
    inquiriesEmail: '',
    tipMessage: '',
    // Royal / Nobility Heraldry
    heraldicMotto: '',
    crestAura: 'gold',
    // Civic display preferences
    showLevel: true,
    showReputation: true,
    showStreak: true,
    defaultTab: 'posts',
  });
  const [interactionSettings, setInteractionSettings] = useState(() => ({ ...DEFAULT_SETTINGS.privacy }));
  const [savingInteractionKey, setSavingInteractionKey] = useState(null);

  const [saving, setSaving] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [usernameAvailability, setUsernameAvailability] = useState(null);
  const [isGeneratingUsername, setIsGeneratingUsername] = useState(false);

  // Prevent background snapshot pulses from wiping unsaved edits & track dirty state
  const initializedUidRef = useRef(null);
  const initializedFromProfileRef = useRef(false);
  const initialSnapshotRef = useRef(null);
  const avatarObjectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
        avatarObjectUrlRef.current = null;
      }
    };
  }, []);

  const isDirty = useMemo(() => {
    if (avatarFile) return true;
    if (!initialSnapshotRef.current) return false;
    try {
      return JSON.stringify(formData) !== initialSnapshotRef.current;
    } catch {
      return false;
    }
  }, [formData, avatarFile]);

  // Initialize form data once per distinct account, and upgrade once if initial pass only had sparse Firebase Auth user before Firestore userProfile resolved
  useEffect(() => {
    if (!(userProfile || user) || !currentUid) return;
    const isNewAccount = initializedUidRef.current !== currentUid;
    const profileJustResolved = Boolean(userProfile) && !initializedFromProfileRef.current && !isDirty;
    if (!isNewAccount && !profileJustResolved) return;

    initializedUidRef.current = currentUid;
    if (userProfile) {
      initializedFromProfileRef.current = true;
    } else if (isNewAccount) {
      initializedFromProfileRef.current = false;
    }
    const src = userProfile || user;
      const p = src.privacy || {};
      
      let initialUsername = src.username || '';
      if (isPlaceholderHandle(initialUsername)) {
        const fromEmail = src.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        const fromName = src.displayName?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        initialUsername = fromEmail || fromName || '';
      }

      const hydratedForm = {
        displayName: src.displayName || '',
        username: initialUsername,
        bio: src.bio || '',
        tagline: src.tagline || '',
        location: src.location || '',
        locationPrivacy: src.locationPrivacy || 'public',
        website: src.website || '',
        pronouns: src.pronouns || '',
        profession: src.profession || '',
        education: src.education || '',
        gender: src.gender || '',
        profileType: Object.values(PROFILE_TYPES).includes(src.profileType) ? src.profileType : PROFILE_TYPES.PERSONAL,
        isPrivate: Boolean(src.isPrivate),
        links: Array.isArray(src.links) ? src.links : [],
        privacy: {
          ...DEFAULT_PROFILE_PRIVACY,
          ...p,
          profileInfo: p.profileInfo || (p.profileVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.profileVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : DEFAULT_PROFILE_PRIVACY.profileInfo),
          creatorInfo: p.creatorInfo || DEFAULT_PROFILE_PRIVACY.creatorInfo,
          presence: p.presence || (p.onlinePresence === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.onlinePresence === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : p.onlinePresence === 'public' ? VISIBILITY_SCOPES.EVERYONE : DEFAULT_PROFILE_PRIVACY.presence),
          followersList: p.followersList || (p.followersVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.followersVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : DEFAULT_PROFILE_PRIVACY.followersList),
          followingList: p.followingList || p.followersList || (p.followersVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.followersVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : DEFAULT_PROFILE_PRIVACY.followingList),
          activity: p.activity || (p.activityVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.activityVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : DEFAULT_PROFILE_PRIVACY.activity),
          achievements: p.achievements || p.activity || (p.activityVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.activityVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : DEFAULT_PROFILE_PRIVACY.achievements),
          economicStatus: p.economicStatus || DEFAULT_PROFILE_PRIVACY.economicStatus,
        },
        creatorCategory: src.creatorCategory || '',
        inquiriesEmail: src.inquiriesEmail || '',
        tipMessage: src.tipMessage || '',
        heraldicMotto: src.heraldicMotto || '',
        crestAura: src.crestAura || 'gold',
        showLevel: src.showLevel !== false,
        showReputation: src.showReputation !== false,
        showStreak: src.showStreak !== false,
        defaultTab: src.defaultTab || 'posts',
      };

      setFormData(hydratedForm);
      try {
        initialSnapshotRef.current = JSON.stringify(hydratedForm);
      } catch {
        initialSnapshotRef.current = null;
      }

    if (!avatarFile) {
      const safePhoto = getSafeAvatarUrl(src.photoURL, src.displayName, currentUid);
      setAvatarPreview(safePhoto);
    }
  }, [userProfile, user, currentUid, isDirty, avatarFile]);

  // Hydrate persisted interaction settings from canonical settingsService
  useEffect(() => {
    if (!currentUid) return;
    let active = true;
    settingsService.getSettings(currentUid)
      .then((res) => {
        if (active && res?.privacy) {
          setInteractionSettings({ ...DEFAULT_SETTINGS.privacy, ...res.privacy });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [currentUid]);

  const handleInteractionSettingChange = useCallback(async (key, value) => {
    if (!currentUid) return;
    const prev = interactionSettings[key];
    setInteractionSettings((curr) => ({ ...curr, [key]: value }));
    setSavingInteractionKey(key);
    try {
      await settingsService.updateSetting(currentUid, `privacy.${key}`, value);
      toast.success('Interaction preference saved');
    } catch (err) {
      setInteractionSettings((curr) => ({ ...curr, [key]: prev }));
      toast.error(err?.message || 'Could not update setting');
    } finally {
      setSavingInteractionKey((curr) => (curr === key ? null : curr));
    }
  }, [currentUid, interactionSettings]);

  // Live username availability check with debounce
  useEffect(() => {
    const raw = formData.username?.trim().toLowerCase();
    if (!raw) {
      setUsernameAvailability(null);
      return;
    }
    const existingUsername = (userProfile?.username || user?.username || '').trim().toLowerCase();
    if (existingUsername && raw === existingUsername) {
      setUsernameAvailability('current');
      return;
    }
    if (!/^[a-z0-9._]{3,30}$/.test(raw)) {
      setUsernameAvailability('invalid');
      return;
    }
    setUsernameAvailability('checking');
    const timer = setTimeout(async () => {
      try {
        if (userService?.checkUsernameAvailability) {
          const res = await userService.checkUsernameAvailability(raw, currentUid);
          setUsernameAvailability(res?.available ? 'available' : 'taken');
        } else {
          // The check could not run — never claim the handle is available.
          setUsernameAvailability('error');
        }
      } catch {
        // A failed availability check must not silently read as "no problem".
        setUsernameAvailability('error');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.username, userProfile?.username, user?.username, currentUid, userService]);

  // Unique generated username handler using userService
  const handleGenerateUsername = useCallback(async () => {
    setIsGeneratingUsername(true);
    try {
      const base = formData.displayName || userProfile?.displayName || user?.email?.split('@')[0] || 'creator';
      const cleanBase = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'creator';
      let uniqueUser = await userService.generateUniqueUsername(cleanBase, userProfile?.uid);
      
      if (isPlaceholderHandle(uniqueUser)) {
        const suffix = uniqueUser.replace(/^user_/, '') || Math.random().toString(36).slice(2, 7);
        uniqueUser = `${cleanBase}_${suffix}`;
      }
      setFormData(prev => ({ ...prev, username: uniqueUser }));
      // `generateUniqueUsername` may fall back to a time/random-suffixed handle
      // without re-querying availability, so verify before claiming it is free.
      setUsernameAvailability('checking');
      try {
        const res = await userService.checkUsernameAvailability(uniqueUser);
        setUsernameAvailability(res?.available ? 'available' : 'taken');
      } catch {
        setUsernameAvailability('error');
      }
      toast.success(`Generated handle: @${uniqueUser}`);
    } catch (e) {
      console.warn('Generate username err:', e);
      toast.error('Could not generate unique username');
    } finally {
      setIsGeneratingUsername(false);
    }
  }, [formData.displayName, userProfile, user, currentUid, userService]);

  // Input Handlers
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => (prev[field] ? { ...prev, [field]: null } : prev));
  }, []);

  const handlePrivacyChange = useCallback((key, value) => {
    setFormData(prev => ({
      ...prev,
      privacy: {
        ...(prev.privacy || {}),
        [key]: value,
      },
    }));
  }, []);

  const handlePrivacyBatchChange = useCallback((patch) => {
    setFormData(prev => ({
      ...prev,
      privacy: {
        ...(prev.privacy || {}),
        ...patch,
      },
    }));
  }, []);

  // Links Handlers
  const handleAddLink = useCallback(() => {
    if (formData.links.length >= PROFILE_CONSTRAINTS.LINKS.MAX_COUNT) {
      toast.error(`Maximum ${PROFILE_CONSTRAINTS.LINKS.MAX_COUNT} custom links allowed`);
      return;
    }
    const newLink = {
      id: Date.now().toString(),
      title: '',
      url: '',
      platform: 'website',
      isPrimary: formData.links.length === 0,
    };
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, newLink],
    }));
  }, [formData.links]);

  const handleUpdateLink = useCallback((index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.links];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, links: updated };
    });
    setFieldErrors(prev => (prev.links ? { ...prev, links: null } : prev));
  }, []);

  const handleRemoveLink = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  }, []);

  const handleTogglePrimaryLink = useCallback((index) => {
    setFormData(prev => {
      const updated = prev.links.map((link, i) => ({
        ...link,
        isPrimary: i === index,
      }));
      return { ...prev, links: updated };
    });
  }, []);

  // Avatar Handlers
  const handleAvatarCropped = useCallback(async (file) => {
    if (!file) return;
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;
    setAvatarPreview(objectUrl);
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentUid || removingAvatar) return;
    setRemovingAvatar(true);
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
    const prevPreview = avatarPreview;
    const defaultAvatar = getSafeAvatarUrl(null, formData.displayName || null, currentUid);
    setAvatarFile(null);
    setAvatarPreview(defaultAvatar);
    try {
      if (updateUserProfile) {
        await updateUserProfile({ photoURL: '' }, { silent: true });
      } else if (userService?.updateUserProfile) {
        await userService.updateUserProfile(currentUid, { photoURL: '' });
      }
      useProfileStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, photoURL: '' } : s.profile,
      }));
      patchCachedProfile(currentUid, { photoURL: '' });
      invalidateProfileCache(currentUid);
      const appUser = useAppStore.getState().currentUser;
      if (appUser && (appUser.uid === currentUid || appUser.id === currentUid)) {
        useAppStore.getState().setCurrentUser({ ...appUser, photoURL: '' });
      }
      if (loadStoreProfile) {
        await loadStoreProfile(currentUid, currentUid, { force: true }).catch(() => {});
      }
      toast.success('Avatar reset to default citizen monogram');
    } catch (err) {
      setAvatarPreview(prevPreview);
      toast.error(err?.message || 'Could not reset avatar');
    } finally {
      setRemovingAvatar(false);
    }
  }, [currentUid, removingAvatar, avatarPreview, formData.displayName, updateUserProfile, userService, loadStoreProfile]);

  // Save changes handler
  const handleSave = useCallback(async () => {
    const nextErrors = {};
    const rawUser = formData.username?.trim().toLowerCase();
    if (!rawUser) {
      nextErrors.username = 'Username cannot be empty';
    } else if (!/^[a-z0-9._]{3,30}$/.test(rawUser)) {
      nextErrors.username = 'Username must be 3-30 characters (letters, numbers, dots, or underscores)';
    } else if (usernameAvailability === 'taken') {
      nextErrors.username = `@${rawUser} is taken. Choose another or click Auto-Generate.`;
    }

    if (!formData.displayName?.trim()) {
      nextErrors.displayName = 'Display name is required';
    }

    let cleanWebsite = formData.website?.trim() || '';
    if (cleanWebsite) {
      const sanitizedSite = sanitizeProfileUrl(cleanWebsite);
      if (!sanitizedSite) {
        nextErrors.website = 'Enter a valid web address (e.g. https://yourdomain.com)';
      } else {
        cleanWebsite = sanitizedSite;
      }
    }

    if (formData.inquiriesEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.inquiriesEmail.trim())) {
      nextErrors.inquiriesEmail = 'Enter a valid business email address';
    }

    const cleanedLinks = [];
    for (const l of formData.links || []) {
      const rawUrl = l.url?.trim();
      if (!rawUrl) continue;
      const safeLinkUrl = sanitizeProfileUrl(rawUrl);
      if (!safeLinkUrl) {
        nextErrors.links = `Invalid URL in Custom Links: "${rawUrl}"`;
        break;
      }
      cleanedLinks.push({
        ...l,
        url: safeLinkUrl,
        title: (l.title || 'Link').trim().slice(0, PROFILE_CONSTRAINTS.LINKS.TITLE_MAX_LENGTH),
      });
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstErr = Object.values(nextErrors)[0];
      toast.error(firstErr);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const currentUsername = (userProfile?.username || user?.username || '').trim().toLowerCase();
      if (rawUser !== currentUsername && userService?.checkUsernameAvailability) {
        const check = await userService.checkUsernameAvailability(rawUser, currentUid);
        if (!check.available) {
          setFieldErrors({ username: `@${rawUser} is already taken.` });
          toast.error(`@${rawUser} is already taken. Please choose another.`);
          setSaving(false);
          return;
        }
      }

      const rawUpdates = {
        displayName: formData.displayName?.trim() || '',
        username: rawUser,
        bio: formData.bio?.trim() || '',
        tagline: formData.tagline?.trim() || '',
        location: formData.locationPrivacy === 'hidden' ? '' : (formData.location?.trim() || ''),
        locationPrivacy: formData.locationPrivacy || 'public',
        website: cleanWebsite,
        pronouns: formData.pronouns?.trim() || '',
        profession: formData.profession?.trim() || '',
        education: formData.education?.trim() || '',
        gender: formData.gender?.trim() || '',
        profileType: Object.values(PROFILE_TYPES).includes(formData.profileType) ? formData.profileType : PROFILE_TYPES.PERSONAL,
        isPrivate: Boolean(formData.isPrivate),
        links: cleanedLinks,
        privacy: formData.privacy,
        // Progressive Settings
        creatorCategory: formData.creatorCategory?.trim() || '',
        inquiriesEmail: formData.inquiriesEmail?.trim() || '',
        tipMessage: formData.tipMessage?.trim() || '',
        heraldicMotto: formData.heraldicMotto?.trim() || '',
        crestAura: formData.crestAura || 'gold',
        showLevel: Boolean(formData.showLevel),
        showReputation: Boolean(formData.showReputation),
        showStreak: Boolean(formData.showStreak),
        defaultTab: formData.defaultTab || 'posts',
      };

      // Canonical validation via profileContracts
      const validation = validateProfileUpdate(rawUpdates);
      if (!validation.valid) {
        const mappedErrors = {};
        for (const msg of validation.errors || []) {
          const lower = String(msg).toLowerCase();
          if (lower.includes('display name')) mappedErrors.displayName = msg;
          else if (lower.includes('username')) mappedErrors.username = msg;
          else if (lower.includes('bio')) mappedErrors.bio = msg;
          else if (lower.includes('website') || lower.includes('url')) mappedErrors.website = msg;
          else if (lower.includes('email')) mappedErrors.inquiriesEmail = msg;
          else if (lower.includes('link')) mappedErrors.links = msg;
          else if (lower.includes('location')) mappedErrors.location = msg;
        }
        if (Object.keys(mappedErrors).length > 0) setFieldErrors(mappedErrors);
        toast.error(validation.errors?.[0] || 'Please correct the invalid fields.');
        setSaving(false);
        return;
      }

      const sanitizedUpdates = { ...validation.sanitized };

      // Upload avatar first if changed and capture canonical URL
      let uploadedAvatarUrl = null;
      if (avatarFile && currentUid && userService?.uploadAvatar) {
        const uploadResult = await userService.uploadAvatar(currentUid, avatarFile);
        uploadedAvatarUrl =
          typeof uploadResult === 'string'
            ? uploadResult
            : (uploadResult?.downloadURL || uploadResult?.photoURL || uploadResult?.url || null);
        if (!uploadedAvatarUrl) {
          throw new Error('Could not confirm uploaded avatar URL. Please try again.');
        }
        sanitizedUpdates.photoURL = uploadedAvatarUrl;
      }

      // Immediate optimistic save: snapshot previous state for rollback
      const previousStoreProfile = useProfileStore.getState().profile;
      useProfileStore.setState((state) => ({
        profile: {
          ...(state.profile || {}),
          ...sanitizedUpdates,
        },
      }));

      // Authoritative backend sync (avoid duplicate Firestore photoURL rewrite if
      // uploadAvatar already saved it directly to users/{uid}; AuthContext updateUserProfile
      // still receives the full payload when available to update auth.currentUser).
      const firestoreUpdates = uploadedAvatarUrl && !updateUserProfile
        ? (() => {
            const { photoURL: _alreadySaved, ...rest } = sanitizedUpdates;
            return rest;
          })()
        : sanitizedUpdates;

      try {
        if (updateUserProfile) {
          await updateUserProfile(sanitizedUpdates, { silent: true });
        } else if (userService?.updateUserProfile && currentUid && Object.keys(firestoreUpdates).length > 0) {
          await userService.updateUserProfile(currentUid, firestoreUpdates);
        }

        const appUser = useAppStore.getState().currentUser;
        if (appUser && (appUser.uid === currentUid || appUser.id === currentUid)) {
          useAppStore.getState().setCurrentUser({ ...appUser, ...sanitizedUpdates });
        }

        if (currentUid) {
          patchCachedProfile(currentUid, sanitizedUpdates);
        }

        // Force fresh store sync so returning to /profile/me reflects every edit immediately
        if (currentUid && loadStoreProfile) {
          try {
            await loadStoreProfile(currentUid, currentUid, { force: true });
          } catch (syncErr) {
            console.warn('Post-save store refresh skipped:', syncErr?.message);
          }
        }

        try {
          initialSnapshotRef.current = JSON.stringify({
            ...formData,
            location: sanitizedUpdates.location ?? formData.location,
            links: cleanedLinks,
            website: cleanWebsite,
          });
        } catch {
          /* ignore */
        }
        setAvatarFile(null);
        toast.success('Profile updated successfully');
        navigate('/profile/me');
      } catch (backendError) {
        useProfileStore.setState({ profile: previousStoreProfile });
        throw backendError;
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [formData, usernameAvailability, avatarFile, currentUid, userService, updateUserProfile, loadStoreProfile, navigate, userProfile?.username, user?.username]);

  const handleCancel = useCallback(() => {
    if (isDirty && !saving) {
      setShowUnsavedDialog(true);
      return;
    }
    navigate(-1);
  }, [isDirty, saving, navigate]);

  return (
    <div className={cn(
      "min-h-screen pb-32 transition-colors duration-200 relative",
      isDark 
        ? "bg-[#03071B] text-white selection:bg-arvdoul-purple/30" 
        : "bg-[#F6F8FC] text-slate-900 selection:bg-arvdoul-purple/20"
    )}>
      {/* Top Ambient Optical Hairline Highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[2px] z-30"
        style={{
          background: `linear-gradient(90deg, ${tokens.color.brand.pink} 0%, ${tokens.color.brand.violet} 34%, ${tokens.color.brand.indigo} 66%, ${tokens.color.brand.cyan} 100%)`,
        }}
      />

      {/* Ambient background glow orbs */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed -top-32 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 z-0"
        style={{
          background: `radial-gradient(circle, ${tokens.color.brand.violet} 0%, ${tokens.color.brand.indigo} 60%, transparent 100%)`
        }}
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed top-1/2 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15 z-0"
        style={{
          background: `radial-gradient(circle, ${tokens.color.brand.blue} 0%, ${tokens.color.brand.indigo} 60%, transparent 100%)`
        }}
      />

      {/* Main Content Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-6 relative z-10">

        {/* Clean Top Save Action Row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight">Edit Profile</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update your profile details, links, and privacy preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || usernameAvailability === 'taken'}
            aria-label="Save Profile Changes"
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md shadow-purple-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple shrink-0"
            style={{
              background: BRAND_GRADIENT
            }}
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save</span>
          </button>
        </div>

        {/* 1. CITIZEN AVATAR STUDIO (Arvdoul does NOT support background images) */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 relative overflow-hidden",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            
            {/* Circular Avatar Preview with Arvdoul Radiant Aura */}
            <div className="relative group shrink-0">
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[3px] bg-gradient-to-tr from-arvdoul-purple via-arvdoul-indigo to-arvdoul-blue"
                style={{ boxShadow: `0 8px 24px ${brandRgba(0.35)}` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-4 ring-white dark:ring-[#03071B] relative">
                  <LazyImage
                    src={avatarPreview}
                    alt={formData.displayName || "Avatar"}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    aria-label="Change profile photo"
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-purple-200" />
                    <span>Change</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Avatar Details & Controls */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  Citizen Avatar
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Arvdoul uses a unified circular avatar for your citizen presence across all feeds, spaces, and passport credentials. Background cover images are not supported.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-white shadow-md shadow-purple-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${tokens.color.brand.violet} 0%, ${tokens.color.brand.indigo} 100%)`
                  }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload / Crop Photo</span>
                </button>

                {avatarPreview && (
                  <button
                    type="button"
                    disabled={removingAvatar}
                    onClick={handleRemoveAvatar}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 disabled:opacity-50",
                      isDark 
                        ? "border-white/10 hover:bg-white/[0.05] text-slate-300" 
                        : "border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>{removingAvatar ? 'Resetting...' : 'Reset Avatar'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* 2. UNIQUE USERNAME & CIVIC IDENTITY */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
              Civic Identity & Unique Handle
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your unique Arvdoul username powers your profile URL, mentions, payments, and citizen registry.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Unique Username Field with Live Availability Status & Auto-Generator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <AtSign className="w-4 h-4 text-arvdoul-purple" />
                  <span>Unique Username</span>
                </label>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {usernameAvailability === 'checking' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking...
                    </span>
                  )}
                  {usernameAvailability === 'available' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Available
                    </span>
                  )}
                  {usernameAvailability === 'current' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-500/10 px-2.5 py-0.5 rounded-full border border-slate-500/20">
                      Current Handle
                    </span>
                  )}
                  {usernameAvailability === 'taken' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      <AlertCircle className="w-3 h-3" />
                      Handle Taken
                    </span>
                  )}
                  {usernameAvailability === 'invalid' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      3-30 alphanumeric characters
                    </span>
                  )}
                  {usernameAvailability === 'error' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      Could not verify — we'll re-check on save
                    </span>
                  )}

                  {/* Auto-Generate Unique Username Button */}
                  <button
                    type="button"
                    onClick={handleGenerateUsername}
                    disabled={isGeneratingUsername}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95",
                      isDark 
                        ? "bg-arvdoul-purple/20 hover:bg-arvdoul-purple/30 text-[#B978FF] border border-arvdoul-purple/30" 
                        : "bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200"
                    )}
                    title="Suggest an available username"
                  >
                    <Sparkles className={cn("w-3 h-3", isGeneratingUsername && "animate-spin")} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
              </div>

              {/* Input with @ prefix */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 font-mono text-sm font-bold text-arvdoul-purple dark:text-[#B978FF] select-none pointer-events-none">
                  @
                </span>
                <input aria-label="Unique Username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder="your_handle"
                  maxLength={30}
                  className={cn(
                    "w-full pl-8 pr-4 py-2.5 rounded-2xl text-sm font-mono font-medium outline-none transition-all border",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple focus:ring-2 focus:ring-arvdoul-purple/20"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple focus:ring-2 focus:ring-arvdoul-purple/20"
                  )}
                />
              </div>
              {/* Display Name error + input check */}
              {fieldErrors.username && (
                <p className="text-xs text-rose-500 font-medium">{fieldErrors.username}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Letters, numbers, periods, and underscores. 3 to 30 characters.
              </p>
            </div>

            {/* Display Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-arvdoul-purple" />
                  <span>Display Name</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.displayName.length}/{PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                </span>
              </div>
              <input aria-label="Display Name"
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Citizen Name"
                maxLength={PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  fieldErrors.displayName
                    ? "border-rose-500 bg-rose-500/5"
                    : isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                )}
              />
              {fieldErrors.displayName && (
                <p className="text-xs text-rose-500 font-medium">{fieldErrors.displayName}</p>
              )}
            </div>

            {/* Tagline / Subtitle Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-arvdoul-purple" />
                  <span>Tagline / Status</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.tagline.length}/{PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH}
                </span>
              </div>
              <input aria-label="Tagline / Status"
                type="text"
                value={formData.tagline}
                onChange={(e) => handleInputChange('tagline', e.target.value)}
                placeholder="e.g. Building soundscapes & open-source tools"
                maxLength={PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                )}
              />
            </div>

            {/* Bio Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Bio &amp; Civic Manifesto
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.bio.length}/{PROFILE_CONSTRAINTS.BIO.MAX_LENGTH}
                </span>
              </div>
              <textarea aria-label="Introduce yourself to the Arvdoul community..."
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Introduce yourself to the Arvdoul community..."
                rows={3}
                maxLength={PROFILE_CONSTRAINTS.BIO.MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-normal outline-none transition-all border resize-none leading-relaxed focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                )}
              />
            </div>

            {/* Pronouns & Profession Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Pronouns
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRONOUN_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleInputChange('pronouns', p === 'other' ? '' : p)}
                      className={cn(
                        "min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        formData.pronouns === p
                          ? "bg-arvdoul-purple/20 border-arvdoul-purple text-arvdoul-purple dark:text-purple-300 font-bold"
                          : isDark
                          ? "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input aria-label="Pronouns"
                  type="text"
                  value={formData.pronouns}
                  onChange={(e) => handleInputChange('pronouns', e.target.value)}
                  placeholder="e.g. they/them"
                  maxLength={PROFILE_CONSTRAINTS.PRONOUNS.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2 min-h-[44px] rounded-2xl text-xs outline-none transition-all border mt-1.5 focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Profession / Role
                </label>
                <input aria-label="Profession / Role"
                  type="text"
                  value={formData.profession}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  placeholder="e.g. Creator, Builder, Artist"
                  maxLength={PROFILE_CONSTRAINTS.PROFESSION.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                  )}
                />
              </div>
            </div>

            {/* Education & Gender Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Education
                </label>
                <input aria-label="Education"
                  type="text"
                  value={formData.education}
                  onChange={(e) => handleInputChange('education', e.target.value)}
                  placeholder="e.g. Royal College of Art, Self-taught"
                  maxLength={PROFILE_CONSTRAINTS.EDUCATION.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Gender Identity
                </label>
                <input aria-label="Gender Identity"
                  type="text"
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  placeholder="Optional"
                  maxLength={PROFILE_CONSTRAINTS.GENDER.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-arvdoul-purple"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-arvdoul-purple"
                  )}
                />
              </div>
            </div>

            {/* Profile Classification Selector */}
            <div className="space-y-2 pt-1">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-arvdoul-purple" />
                <span>Account Classification</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PROFILE_TYPE_OPTIONS.map((opt) => {
                  const selected = formData.profileType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleInputChange('profileType', opt.id)}
                      aria-pressed={selected}
                      className={cn(
                        "p-2.5 rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        selected
                          ? isDark
                            ? "bg-arvdoul-purple/20 border-arvdoul-purple text-white shadow-sm"
                            : "bg-purple-50 border-purple-400 text-purple-950 shadow-sm"
                          : isDark
                            ? "bg-white/[0.04] border-white/[0.09] text-slate-300 hover:bg-white/[0.04]"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        {/* 3. CIVIC COORDINATES & LOCATION */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
              Civic Coordinates &amp; Website
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Connect your digital nation passport with your geographic territory and digital flagship.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Location with Interactive Modal Trigger & Location Privacy */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Location</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="min-h-[32px] px-2 text-xs text-arvdoul-purple dark:text-[#C896FF] hover:underline cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  Interactive Map
                </button>
              </label>

              <div className="relative flex items-center">
                <input aria-label="Location"
                  type="text"
                  value={formData.location}
                  disabled={formData.locationPrivacy === 'hidden'}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder={formData.locationPrivacy === 'hidden' ? 'Hidden on your profile' : 'e.g. Neo Tokyo, Global, London'}
                  maxLength={PROFILE_CONSTRAINTS.LOCATION.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-60 disabled:cursor-not-allowed",
                    isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500"
                  )}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Location Privacy</span>
                <select
                  aria-label="Location Privacy"
                  value={formData.locationPrivacy || 'public'}
                  onChange={(e) => handleInputChange('locationPrivacy', e.target.value)}
                  className={cn(
                    "px-2.5 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value="public">City &amp; Country</option>
                  <option value="country_only">Country Only</option>
                  <option value="hidden">Keep Hidden</option>
                </select>
              </div>
              {formData.locationPrivacy === 'hidden' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Location is hidden from your profile while Keep Hidden is selected.
                </p>
              )}
              {fieldErrors.location && (
                <p className="text-xs text-rose-500 font-medium">{fieldErrors.location}</p>
              )}
            </div>

            {/* Official Website */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Website</span>
              </label>
              <input aria-label="Website"
                type="text"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://yourdomain.com"
                className={cn(
                  "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  fieldErrors.website
                    ? "border-rose-500 bg-rose-500/5"
                    : isDark
                      ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-cyan-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500"
                )}
              />
              {fieldErrors.website && (
                <p className="text-xs text-rose-500 font-medium">{fieldErrors.website}</p>
              )}
            </div>

          </div>
        </section>

        {/* 4. CUSTOM SOCIAL LINKS HUB (Up to 10) */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                Custom Links Hub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Curate up to 10 links for your personal ecosystem.
              </p>
            </div>
            {formData.links.length < 10 && (
              <button
                type="button"
                onClick={handleAddLink}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95",
                  isDark 
                    ? "bg-white/10 hover:bg-white/15 text-white border border-white/10" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Link</span>
              </button>
            )}
          </div>

          {formData.links.length === 0 ? (
            <div className={cn(
              "p-6 rounded-2xl border border-dashed text-center space-y-2",
              isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"
            )}>
              <LinkIcon className="w-6 h-6 mx-auto opacity-40" />
              <p className="text-xs">No links added yet. Add your portfolio, channels, or projects.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formData.links.map((link, idx) => (
                <div 
                  key={link.id || idx}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-3",
                    isDark ? "bg-white/[0.04] border-white/[0.09]" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <select aria-label="Link Platform"
                    value={link.platform || 'website'}
                    onChange={(e) => handleUpdateLink(idx, 'platform', e.target.value)}
                    className={cn(
                      "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      isDark 
                        ? "bg-[#03071B]/90 border-white/[0.10] text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  >
                    {PLATFORM_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  <input aria-label="Link Title (e.g. My Portfolio)"
                    type="text"
                    value={link.title || ''}
                    onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                    maxLength={PROFILE_CONSTRAINTS.LINKS.TITLE_MAX_LENGTH}
                    placeholder="Link Title (e.g. My Portfolio)"
                    className={cn(
                      "sm:w-44 px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-medium outline-none border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      isDark 
                        ? "bg-black/30 border-white/10 text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  />

                  <input aria-label="Link URL"
                    type="text"
                    value={link.url || ''}
                    onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className={cn(
                      "flex-1 px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-mono outline-none border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      isDark 
                        ? "bg-black/30 border-white/10 text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  />

                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      aria-label={link.isPrimary ? "Primary Link" : "Make Primary"}
                      onClick={() => handleTogglePrimaryLink(idx)}
                      className={cn(
                        "min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        link.isPrimary 
                          ? "text-amber-400 bg-amber-400/10" 
                          : "text-slate-400 hover:text-amber-400"
                      )}
                      title={link.isPrimary ? "Primary Link" : "Make Primary"}
                    >
                      <Star className="w-3.5 h-3.5" fill={link.isPrimary ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove Link"
                      onClick={() => handleRemoveLink(idx)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                      title="Remove Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {fieldErrors.links && (
                <p className="text-xs text-rose-500 font-medium">{fieldErrors.links}</p>
              )}
            </div>
          )}
        </section>

        {/* 5. CREATOR SUITE SETTINGS (gated by the canonical resolveCreatorFlag) */}
        {isCreatorAccount && (
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5 relative overflow-hidden",
          isDark
            ? "bg-white/[0.03] border-amber-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-gradient-to-br from-amber-50/50 to-white border-amber-200 shadow-[0_8px_30px_rgba(245,158,11,0.06)]"
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug flex items-center gap-2">
                  <span>Creator Suite & Patronage</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Unlocked
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure your creative craft classification, collaboration pipeline, and tip jar message.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Creator Category */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>Primary Creator Discipline</span>
                </label>
                <select aria-label="Primary Creator Discipline"
                  value={formData.creatorCategory}
                  onChange={(e) => handleInputChange('creatorCategory', e.target.value)}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                    isDark 
                      ? "bg-[#03071B]/90 border-white/[0.10] text-white focus:border-amber-400" 
                      : "bg-white border-slate-200 text-slate-800 focus:border-amber-400"
                  )}
                >
                  <option value="">Select Creative Category...</option>
                  {CREATOR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Inquiries Email */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Business / Inquiries Contact</span>
                </label>
                <input aria-label="Business / Inquiries Contact"
                  type="email"
                  value={formData.inquiriesEmail}
                  onChange={(e) => handleInputChange('inquiriesEmail', e.target.value)}
                  placeholder="creator.mgmt@domain.com"
                  maxLength={100}
                  className={cn(
                    "w-full px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium outline-none transition-all border focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    fieldErrors.inquiriesEmail
                      ? "border-rose-500 bg-rose-500/5"
                      : isDark
                        ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-amber-400"
                        : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-400"
                  )}
                />
                {fieldErrors.inquiriesEmail && (
                  <p className="text-xs text-rose-500 font-medium">{fieldErrors.inquiriesEmail}</p>
                )}
              </div>
            </div>

            {/* Custom Tip Jar Message */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-rose-400" />
                <span>Patronage Tip Note</span>
              </label>
              <input aria-label="Patronage Tip Note"
                type="text"
                value={formData.tipMessage}
                onChange={(e) => handleInputChange('tipMessage', e.target.value)}
                placeholder="e.g. Thanks for supporting my independent audio creations and video stories!"
                maxLength={200}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-rose-400"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-rose-400"
                )}
              />
            </div>

            {/* Creator Suite visibility (the `creatorInfo` scope) */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div>
                <div className="text-xs sm:text-sm font-semibold">Creator Suite Visibility</div>
                <div className="text-[11px] text-slate-400">Who can see your discipline, business contact and patronage note</div>
              </div>
              <select aria-label="Creator Suite Visibility"
                value={formData.privacy.creatorInfo || VISIBILITY_SCOPES.EVERYONE}
                onChange={(e) => handlePrivacyChange('creatorInfo', e.target.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
              </select>
            </div>
          </div>
        </section>
        )}

        {/* 6. ROYAL & NOBILITY HERALDIC SETTINGS (gated by isRoyalOrNoble / LEVEL_GATES.sovereign) */}
        {isRoyalOrNoble && (
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5 relative overflow-hidden",
          isDark
            ? "bg-white/[0.03] border-purple-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-gradient-to-br from-purple-50/50 to-white border-purple-200 shadow-[0_8px_30px_rgba(168,85,247,0.08)]"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug flex items-center gap-2">
                <span>Royal House & Heraldry</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Noble Order
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ceremonial attributes unlocked through proven civic standing and nobility status.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Heraldic Creed / Motto */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                House Creed / Heraldic Motto
              </label>
              <input aria-label="e.g. In Aetere Dignitas · Building with honor across Arvdoul"
                type="text"
                value={formData.heraldicMotto}
                onChange={(e) => handleInputChange('heraldicMotto', e.target.value)}
                placeholder="e.g. In Aetere Dignitas · Building with honor across Arvdoul"
                maxLength={120}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-white placeholder-slate-500 focus:border-purple-400"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-400"
                )}
              />
            </div>

            {/* Insignia Aura Selector */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                Insignia & Crest Radiance
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {CREST_AURAS.map((aura) => (
                  <button
                    key={aura.id}
                    type="button"
                    onClick={() => handleInputChange('crestAura', aura.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5",
                      formData.crestAura === aura.id
                        ? "bg-purple-500/20 border-purple-500 shadow-md ring-2 ring-purple-500/40"
                        : isDark
                        ? "bg-white/[0.04] border-white/[0.09] hover:bg-white/[0.04]"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded-full bg-gradient-to-tr shadow-sm", aura.color)} />
                    <span className="text-[11px] font-bold">{aura.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* 7. CIVIC PRESENTATION & DISPLAY TOGGLES */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                Civic Standing & Showcase Preferences
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure which civic badges appear on your public hero card and choose your starting profile tab.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Show Level Toggle */}
              <label className={cn(
                "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                formData.showLevel 
                  ? (isDark ? "bg-purple-900/20 border-purple-500/40" : "bg-purple-50 border-purple-200") 
                  : (isDark ? "bg-white/[0.04] border-white/[0.09]" : "bg-slate-50 border-slate-200")
              )}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold">Level Badge</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showLevel}
                  onChange={(e) => handleInputChange('showLevel', e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </label>

              {/* Show Reputation Toggle */}
              <label className={cn(
                "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                formData.showReputation 
                  ? (isDark ? "bg-emerald-900/20 border-emerald-500/40" : "bg-emerald-50 border-emerald-200") 
                  : (isDark ? "bg-white/[0.04] border-white/[0.09]" : "bg-slate-50 border-slate-200")
              )}>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold">Reputation Score</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showReputation}
                  onChange={(e) => handleInputChange('showReputation', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </label>

              {/* Show Streak Toggle */}
              <label className={cn(
                "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                formData.showStreak 
                  ? (isDark ? "bg-amber-900/20 border-amber-500/40" : "bg-amber-50 border-amber-200") 
                  : (isDark ? "bg-white/[0.04] border-white/[0.09]" : "bg-slate-50 border-slate-200")
              )}>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold">Day Streak</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showStreak}
                  onChange={(e) => handleInputChange('showStreak', e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Default Profile Tab */}
            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs sm:text-sm font-semibold">Default Starting Tab</div>
                <div className="text-[11px] text-slate-400">The tab visitors see first when opening your profile</div>
              </div>
              <select aria-label="Default Starting Tab"
                value={formData.defaultTab}
                onChange={(e) => handleInputChange('defaultTab', e.target.value)}
                className={cn(
                  "px-3.5 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value="posts">Posts &amp; Sparks</option>
                <option value="videos">Videos</option>
                <option value="reels">Reels &amp; Clips</option>
                <option value="photos">Photos</option>
                <option value="stories">Vibes</option>
                <option value="audio">Audio Tracks</option>
                <option value="tagged">Tagged</option>
              </select>
            </div>

            {/* Active Civic / Royal Title Manager Shortcut */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs sm:text-sm font-semibold">Civic &amp; Royal Title</div>
                <div className="text-[11px] text-slate-400">Equip earned heraldic or civic titles on your hero crest</div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/titles')}
                className={cn(
                  "min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark ? "bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25" : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                )}
              >
                Manage Titles
              </button>
            </div>
          </div>
        </section>

        {/* 8. PRIVACY & AUDIENCE GOVERNANCE */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
              Privacy & Audience Permissions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control which sections of your profile are visible to the public, mutual connections, or kept private.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Master Private Account Switch */}
            <label className={cn(
              "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
              formData.isPrivate
                ? isDark 
                  ? "bg-purple-900/20 border-purple-500/40" 
                  : "bg-purple-50 border-purple-200"
                : isDark
                ? "bg-white/[0.04] border-white/[0.09]"
                : "bg-slate-50 border-slate-200"
            )}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Lock className={cn("w-4 h-4", formData.isPrivate ? "text-arvdoul-purple" : "text-slate-400")} />
                  <span className="text-sm font-bold">Private Account</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  When enabled, only approved connections can view your feed creations and highlights.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.isPrivate}
                onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
                className="w-5 h-5 accent-arvdoul-purple rounded cursor-pointer"
              />
            </label>

            {/* Granular Scope Selectors */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Audience Scopes
              </h3>

              {/* Profile Discovery */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Profile Discovery</div>
                  <div className="text-[11px] text-slate-400">Who can view your bio, tagline, education, and identity details</div>
                </div>
                <select aria-label="Who can view your profile info"
                  value={formData.privacy.profileInfo}
                  onChange={(e) => handlePrivacyChange('profileInfo', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Custom Links */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Custom Links</div>
                  <div className="text-[11px] text-slate-400">Who can see your curated external links</div>
                </div>
                <select aria-label="Custom Links visibility"
                  value={formData.privacy.links || VISIBILITY_SCOPES.EVERYONE}
                  onChange={(e) => handlePrivacyChange('links', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Presence */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Live Presence</div>
                  <div className="text-[11px] text-slate-400">Who can see when you are online</div>
                </div>
                <select aria-label="Who can see when you are online"
                  value={formData.privacy.presence}
                  onChange={(e) => handlePrivacyChange('presence', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Nobody</option>
                </select>
              </div>

              {/* Followers & Following Graph */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Social Graph</div>
                  <div className="text-[11px] text-slate-400">Who can view your followers/following lists</div>
                </div>
                <select aria-label="Social Graph"
                  value={formData.privacy.followersList}
                  onChange={(e) => handlePrivacyBatchChange({
                    followersList: e.target.value,
                    followingList: e.target.value,
                  })}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Activity & Achievements */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Civic Standing &amp; Badges</div>
                  <div className="text-[11px] text-slate-400">Who can view your badges and achievements</div>
                </div>
                <select aria-label="Civic Standing & Badges"
                  value={formData.privacy.activity}
                  onChange={(e) => handlePrivacyBatchChange({
                    activity: e.target.value,
                    achievements: e.target.value,
                  })}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Civic Titles */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Civic Titles</div>
                  <div className="text-[11px] text-slate-400">Who can see your active title and noble provenance</div>
                </div>
                <select aria-label="Civic Titles visibility"
                  value={formData.privacy.titles || VISIBILITY_SCOPES.EVERYONE}
                  onChange={(e) => handlePrivacyChange('titles', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Communities & Collections */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Communities &amp; Collections</div>
                  <div className="text-[11px] text-slate-400">Who can view your joined communities and curated collections</div>
                </div>
                <select aria-label="Communities & Collections visibility"
                  value={formData.privacy.communities || VISIBILITY_SCOPES.EVERYONE}
                  onChange={(e) => handlePrivacyBatchChange({
                    communities: e.target.value,
                    collections: e.target.value,
                  })}
                  className={cn(
                    "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Large Coin Treasury Privacy Card */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-3 transition-all",
                isDark ? "bg-amber-500/[0.06] border-amber-500/25" : "bg-amber-50/70 border-amber-200"
              )}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-md shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Large Coin Treasury Card Display
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Controls whether your total Arvdoul coin treasury is proudly showcased as a large balance card on your profile, or kept strictly confidential to you.
                      </div>
                    </div>
                  </div>

                  <select aria-label="Large Coin Treasury Card Display"
                    value={formData.privacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME}
                    onChange={(e) => handlePrivacyChange('economicStatus', e.target.value)}
                    className={cn(
                      "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-bold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      isDark ? "bg-slate-900 border-amber-500/40 text-amber-300" : "bg-white border-amber-300 text-amber-900"
                    )}
                  >
                    <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me (Private Treasury)</option>
                    <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                    <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone (Public Showcase)</option>
                  </select>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-1 border-t border-amber-500/10 flex-wrap">
                  <span className="font-semibold text-amber-500">Live Profile State:</span>
                  <span>
                    {(formData.privacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME) === VISIBILITY_SCOPES.ONLY_ME
                      ? "Visitors see a confidential private treasury badge with a Send Tip button."
                      : (formData.privacy.economicStatus === VISIBILITY_SCOPES.CONNECTIONS
                          ? "Only mutual connections see your actual coin count; others see confidential private badge."
                          : "Actual coin balance and USD value are publicly showcased on your profile.")}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* 9. INTERACTION, MESSAGING & SAFETY SETTINGS */}
        <section className={cn(
          "rounded-[28px] border backdrop-blur-xl transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                Interaction &amp; Safety Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Syncs directly with your account settings across messaging, calls, groups, and gifting.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            {/* Direct Messages */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Direct Messages</div>
                  <div className="text-[11px] text-slate-400">Who can send you new message requests</div>
                </div>
              </div>
              <select
                aria-label="Direct Messages permission"
                value={interactionSettings.allowDMs || 'everyone'}
                disabled={savingInteractionKey === 'allowDMs'}
                onChange={(e) => handleInteractionSettingChange('allowDMs', e.target.value)}
                className={cn(
                  "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-60",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value="everyone">Everyone</option>
                <option value="friends">Friends Only</option>
                <option value="none">Nobody</option>
              </select>
            </div>

            {/* Voice & Video Calls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Voice &amp; Video Calls</div>
                  <div className="text-[11px] text-slate-400">Who can initiate a call with you</div>
                </div>
              </div>
              <select
                aria-label="Voice and Video Calls permission"
                value={interactionSettings.whoCanCall || 'everyone'}
                disabled={savingInteractionKey === 'whoCanCall'}
                onChange={(e) => handleInteractionSettingChange('whoCanCall', e.target.value)}
                className={cn(
                  "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-60",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers</option>
                <option value="friends">Friends Only</option>
                <option value="none">Nobody</option>
              </select>
            </div>

            {/* Group Invitations */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Group &amp; Space Invites</div>
                  <div className="text-[11px] text-slate-400">Who can add you to group conversations</div>
                </div>
              </div>
              <select
                aria-label="Group and Space Invites permission"
                value={interactionSettings.whoCanAddToGroups || 'everyone'}
                disabled={savingInteractionKey === 'whoCanAddToGroups'}
                onChange={(e) => handleInteractionSettingChange('whoCanAddToGroups', e.target.value)}
                className={cn(
                  "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-60",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers</option>
                <option value="friends">Friends Only</option>
                <option value="none">Nobody</option>
              </select>
            </div>

            {/* Coin Gifts & Patronage */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Coin Gifts &amp; Tips</div>
                  <div className="text-[11px] text-slate-400">Who can send coin gifts to your treasury</div>
                </div>
              </div>
              <select
                aria-label="Coin Gifts permission"
                value={interactionSettings.whoCanSendGifts || 'everyone'}
                disabled={savingInteractionKey === 'whoCanSendGifts'}
                onChange={(e) => handleInteractionSettingChange('whoCanSendGifts', e.target.value)}
                className={cn(
                  "px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold outline-none border cursor-pointer focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-60",
                  isDark ? "bg-[#03071B]/90 border-white/[0.10] text-white" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <option value="everyone">Everyone</option>
                <option value="friends">Friends Only</option>
                <option value="none">Nobody</option>
              </select>
            </div>

            {/* Shortcuts to Blocked Accounts & Full Settings */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/settings/blocked')}
                className={cn(
                  "min-h-[44px] px-4 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-slate-200 hover:bg-white/[0.05]"
                    : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                )}
              >
                <span className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Manage Blocked Accounts</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/settings')}
                className={cn(
                  "min-h-[44px] px-4 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark
                    ? "bg-white/[0.04] border-white/[0.09] text-slate-200 hover:bg-white/[0.05]"
                    : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                )}
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-arvdoul-purple" />
                  <span>Full Account &amp; Notification Settings</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </section>

        {/* Bottom Save Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              "min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              isDark ? "hover:bg-white/[0.05] text-slate-300" : "hover:bg-slate-200 text-slate-700"
            )}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || usernameAvailability === 'taken'}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-[0_4px_16px_rgba(68,49,247,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            style={{
              background: BRAND_GRADIENT
            }}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Changes</span>
          </button>
        </div>

      </main>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <AvatarUploadModal
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          onUpload={handleAvatarCropped}
          onRemoveAvatar={handleRemoveAvatar}
          currentAvatarUrl={avatarPreview}
          theme={theme}
        />
      )}

      {/* Interactive Location Setup Modal */}
      {showLocationModal && (
        <ProfileLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          currentLocation={formData.location}
          currentPrivacy={formData.locationPrivacy}
          userId={currentUid}
          theme={theme}
          onLocationUpdated={(newLoc, newPrivacy) => {
            setFormData(prev => ({
              ...prev,
              location: newLoc,
              ...(newPrivacy ? { locationPrivacy: newPrivacy } : {}),
            }));
            setShowLocationModal(false);
          }}
        />
      )}

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        isOpen={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        title="Discard unsaved changes?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You have unsaved changes to your profile. Leaving now will discard them.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowUnsavedDialog(false)}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnsavedDialog(false);
                navigate(-1);
              }}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
