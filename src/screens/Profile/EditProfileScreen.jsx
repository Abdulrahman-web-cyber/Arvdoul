/**
 * Production-grade Arvdoul Edit Profile Screen.
 * 
 * Specifically designed for Arvdoul:
 * - NO background/cover images (Arvdoul does not support background images).
 * - Full alignment with Arvdoul design tokens (arvdoul-gradient, arvdoul-surface, arvdoul-border).
 * - Integrated unique username generation & live availability checker via userService.
 * - Interactive Avatar Studio with 1:1 circular crop and live presence aura.
 * - Granular Privacy & Audience Governance adhering to profileContracts.js.
 * - Interactive Location Modal & Civic Coordinates.
 * 
 * @component
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  ChevronLeft, 
  Camera, 
  Save, 
  User, 
  MapPin, 
  Globe, 
  Shield, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Lock, 
  Eye, 
  Check, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link as LinkIcon,
  HelpCircle,
  Star,
  AtSign,
  Coins,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { VISIBILITY_SCOPES, DEFAULT_PROFILE_PRIVACY, PROFILE_CONSTRAINTS } from '../../config/profileContracts.js';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';
import AvatarUploadModal from '../../components/profile/AvatarUploadModal';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

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

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user, userProfile, updateUserProfile, userService } = useAuth();
  const loadStoreProfile = useProfileStore((state) => state.loadProfile);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    pronouns: '',
    profession: '',
    isPrivate: false,
    links: [],
    privacy: {
      profileInfo: DEFAULT_PROFILE_PRIVACY.profileInfo,
      presence: DEFAULT_PROFILE_PRIVACY.presence,
      followersList: DEFAULT_PROFILE_PRIVACY.followersList,
      activity: DEFAULT_PROFILE_PRIVACY.activity,
      economicStatus: DEFAULT_PROFILE_PRIVACY.economicStatus,
    },
  });

  const [saving, setSaving] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [usernameAvailability, setUsernameAvailability] = useState(null); // 'checking' | 'available' | 'taken' | 'invalid' | 'current'
  const [isGeneratingUsername, setIsGeneratingUsername] = useState(false);
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'identity' | 'coordinates' | 'links' | 'privacy'

  // Profile completeness calculation
  const completeness = useMemo(() => {
    let score = 0;
    const checks = [
      { id: 'avatar', label: 'Citizen Avatar', completed: Boolean(avatarPreview && !avatarPreview.includes('default') && !avatarPreview.includes('placeholder')), weight: 20 },
      { id: 'displayName', label: 'Display Name', completed: Boolean(formData.displayName?.trim()), weight: 20 },
      { id: 'username', label: 'Unique Handle', completed: Boolean(formData.username?.trim() && !formData.username.startsWith('user_')), weight: 20 },
      { id: 'bio', label: 'Civic Bio', completed: Boolean(formData.bio?.trim()), weight: 20 },
      { id: 'details', label: 'Coordinates or Links', completed: Boolean(formData.location?.trim() || formData.website?.trim() || formData.links?.length > 0), weight: 20 },
    ];
    checks.forEach(c => {
      if (c.completed) score += c.weight;
    });
    return { score, checks };
  }, [avatarPreview, formData.displayName, formData.username, formData.bio, formData.location, formData.website, formData.links]);

  // Effective user reference
  const currentUid = userProfile?.uid || userProfile?.id || user?.uid;

  // Initialize form data from profile
  useEffect(() => {
    if (userProfile || user) {
      const src = userProfile || user;
      const p = src.privacy || {};
      
      let initialUsername = src.username || '';
      if (!initialUsername || initialUsername.startsWith('user_') || initialUsername === 'user' || initialUsername === 'creator') {
        const fromEmail = src.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        const fromName = src.displayName?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        initialUsername = fromEmail || fromName || '';
      }

      setFormData({
        displayName: src.displayName || '',
        username: initialUsername,
        bio: src.bio || '',
        location: src.location || '',
        website: src.website || '',
        pronouns: src.pronouns || '',
        profession: src.profession || '',
        isPrivate: Boolean(src.isPrivate),
        links: Array.isArray(src.links) ? src.links : [],
        privacy: {
          profileInfo: p.profileInfo || (p.profileVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.profileVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          presence: p.presence || (p.onlinePresence === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.onlinePresence === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : p.onlinePresence === 'public' ? VISIBILITY_SCOPES.EVERYONE : VISIBILITY_SCOPES.FOLLOWERS),
          followersList: p.followersList || (p.followersVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.followersVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          activity: p.activity || (p.activityVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.activityVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          economicStatus: p.economicStatus || VISIBILITY_SCOPES.ONLY_ME,
        },
      });

      const safePhoto = getSafeAvatarUrl(src.photoURL, src.displayName, currentUid);
      setAvatarPreview(safePhoto);
    }
  }, [userProfile, user, currentUid]);

  // Live username availability check with debounce
  useEffect(() => {
    const raw = formData.username?.trim().toLowerCase();
    if (!raw) {
      setUsernameAvailability(null);
      return;
    }
    if (raw === (userProfile?.username || user?.username)) {
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
          const res = await userService.checkUsernameAvailability(raw);
          setUsernameAvailability(res?.available ? 'available' : 'taken');
        } else {
          setUsernameAvailability('available');
        }
      } catch {
        setUsernameAvailability(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.username, userProfile?.username, user?.username, userService]);

  // Unique generated username handler using userService
  const handleGenerateUsername = useCallback(async () => {
    setIsGeneratingUsername(true);
    try {
      const base = formData.displayName || userProfile?.displayName || user?.email?.split('@')[0] || 'creator';
      const cleanBase = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'creator';
      let uniqueUser = await userService.generateUniqueUsername(cleanBase, userProfile?.uid);
      
      // Ensure no leftover placeholder prefix
      if (uniqueUser.startsWith('user_')) {
        uniqueUser = uniqueUser.replace(/^user_/, `${cleanBase}_`);
      }
      setFormData(prev => ({ ...prev, username: uniqueUser }));
      setUsernameAvailability('available');
      toast.success(`Generated unique handle: @${uniqueUser}`);
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

  // Links Handlers
  const handleAddLink = useCallback(() => {
    if (formData.links.length >= 10) {
      toast.error('Maximum 10 custom links allowed');
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
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentUid) return;
    const defaultAvatar = getSafeAvatarUrl(null, formData.displayName || 'Citizen', currentUid);
    setAvatarFile(null);
    setAvatarPreview(defaultAvatar);
    if (userService?.updateUserProfile) {
      await userService.updateUserProfile(currentUid, { photoURL: defaultAvatar });
    }
    toast.success('Avatar reset to default citizen monogram');
  }, [currentUid, formData.displayName, userService]);

  // Save changes handler
  const handleSave = useCallback(async () => {
    const rawUser = formData.username?.trim().toLowerCase();
    if (!rawUser) {
      toast.error('Username cannot be empty');
      return;
    }
    if (!/^[a-z0-9._]{3,30}$/.test(rawUser)) {
      toast.error('Username must be 3-30 characters (letters, numbers, dots, or underscores)');
      return;
    }

    if (usernameAvailability === 'taken') {
      toast.error(`@${rawUser} is taken. Please choose another or click Auto-Generate.`);
      return;
    }

    setSaving(true);
    try {
      if (rawUser !== userProfile?.username && userService?.checkUsernameAvailability) {
        const check = await userService.checkUsernameAvailability(rawUser);
        if (!check.available) {
          toast.error(`@${rawUser} is already taken. Please choose another.`);
          setSaving(false);
          return;
        }
      }

      // Upload avatar if changed
      if (avatarFile && currentUid && userService?.uploadAvatar) {
        await userService.uploadAvatar(currentUid, avatarFile);
      }

      // Clean links
      const cleanedLinks = (formData.links || [])
        .filter(l => l.url && l.url.trim().length > 0)
        .map(l => ({
          ...l,
          url: l.url.trim().startsWith('http') ? l.url.trim() : `https://${l.url.trim()}`,
          title: (l.title || 'Link').trim().slice(0, 30),
        }));

      // Sanitize website
      let cleanWebsite = formData.website?.trim() || '';
      if (cleanWebsite && !cleanWebsite.startsWith('http')) {
        cleanWebsite = `https://${cleanWebsite}`;
      }

      const updates = {
        displayName: formData.displayName.trim().slice(0, PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH),
        username: rawUser,
        bio: formData.bio.trim().slice(0, PROFILE_CONSTRAINTS.BIO.MAX_LENGTH),
        location: formData.location.trim().slice(0, PROFILE_CONSTRAINTS.LOCATION.MAX_LENGTH),
        website: cleanWebsite,
        pronouns: formData.pronouns.trim().slice(0, PROFILE_CONSTRAINTS.PRONOUNS.MAX_LENGTH),
        profession: formData.profession.trim().slice(0, PROFILE_CONSTRAINTS.PROFESSION.MAX_LENGTH),
        isPrivate: Boolean(formData.isPrivate),
        links: cleanedLinks,
        privacy: formData.privacy,
      };

      if (updateUserProfile) {
        await updateUserProfile(updates);
      } else if (userService?.updateUserProfile && currentUid) {
        await userService.updateUserProfile(currentUid, updates);
      }

      // Refresh store profile
      if (currentUid && loadStoreProfile) {
        await loadStoreProfile(currentUid, currentUid);
      }

      toast.success('Profile updated successfully!');
      navigate('/profile/me');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [formData, usernameAvailability, avatarFile, currentUid, userService, updateUserProfile, loadStoreProfile, navigate, userProfile?.username]);

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className={cn(
      "min-h-screen pb-32 transition-colors duration-200 relative",
      isDark 
        ? "bg-[#03071B] text-white selection:bg-[#8B1EF3]/30" 
        : "bg-[#f0f4fa] text-slate-900 selection:bg-[#8B1EF3]/20"
    )}>
      {/* Top Ambient Optical Hairline Highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[2px] z-30"
        style={{
          background: "linear-gradient(90deg, #C82BFF 0%, #8B1EF3 34%, #4431F7 66%, #0088FF 100%)",
        }}
      />

      {/* Ambient background glow orbs */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed -top-32 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 z-0"
        style={{
          background: "radial-gradient(circle, #8B1EF3 0%, #4431F7 60%, transparent 100%)"
        }}
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed top-1/2 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15 z-0"
        style={{
          background: "radial-gradient(circle, #055BFB 0%, #4431F7 60%, transparent 100%)"
        }}
      />

      {/* Sub-Toolbar & Section Navigation Tabs (TopAppBar handles main app title and back navigation) */}
      <div className={cn(
        "sticky top-0 z-30 w-full backdrop-blur-2xl border-b transition-colors mb-2",
        isDark
          ? "bg-[#03071B]/90 border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          : "bg-white/90 border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
      )}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="font-mono text-purple-400 font-bold">@{formData.username || 'citizen'}</span>
            <span>·</span>
            <span className="text-emerald-500 font-semibold">{completeness.score}% complete</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/profile/me')}
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95",
                isDark
                  ? "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/10"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
              title="View current profile"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || usernameAvailability === 'taken'}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md shadow-purple-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)"
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
        </div>

        {/* Section Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Sections' },
            { id: 'identity', label: 'Identity & Handle' },
            { id: 'coordinates', label: 'Coordinates & Web' },
            { id: 'links', label: 'Custom Links' },
            { id: 'privacy', label: 'Privacy & Scopes' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                activeSection === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : isDark
                  ? "bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]"
                  : "bg-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 relative z-10">

        {/* Profile Completeness Card */}
        <div className={cn(
          "rounded-[22px] border p-4 sm:p-5 backdrop-blur-2xl transition-all relative overflow-hidden",
          isDark
            ? "bg-[#070D27]/80 border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
            : "bg-white/90 border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
        )}>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B1EF3]" />
              <span className="text-xs sm:text-sm font-black tracking-tight">Citizen Presence Completeness</span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400">{completeness.score}%</span>
          </div>

          <div className="relative w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08]">
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${completeness.score}%`,
                background: "linear-gradient(90deg, #8B1EF3 0%, #4431F7 50%, #00F0FF 100%)"
              }}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-3 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
            {completeness.checks.map((chk) => (
              <div 
                key={chk.id}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border",
                  chk.completed
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500 dark:text-emerald-400"
                    : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                )}
              >
                {chk.completed ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-slate-400" />}
                <span>{chk.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 1. CITIZEN AVATAR STUDIO (Arvdoul does NOT support background images) */}
        {(activeSection === 'all' || activeSection === 'identity') && (
        <>
        <section className={cn(
          "rounded-[28px] border transition-all p-5 sm:p-7 relative overflow-hidden",
          isDark
            ? "bg-[#070D27]/90 border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            
            {/* Circular Avatar Preview with Arvdoul Radiant Aura */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[3px] bg-gradient-to-tr from-[#8B1EF3] via-[#4431F7] to-[#055BFB] shadow-[0_8px_24px_rgba(139,30,243,0.35)]">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-4 ring-[#03071B] dark:ring-[#03071B] relative">
                  <img
                    src={avatarPreview}
                    alt={formData.displayName || "Avatar"}
                    className="w-full h-full object-cover"
                  />
                  <div 
                    onClick={() => setShowAvatarModal(true)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-purple-200" />
                    <span>Change</span>
                  </div>
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
                    background: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 100%)"
                  }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload / Crop Photo</span>
                </button>

                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer active:scale-95",
                      isDark 
                        ? "border-white/10 hover:bg-white/[0.05] text-slate-300" 
                        : "border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reset Avatar</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* 2. UNIQUE USERNAME & CIVIC IDENTITY */}
        <section className={cn(
          "rounded-[28px] border transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-[#070D27]/90 border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
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
                  <AtSign className="w-4 h-4 text-[#8B1EF3]" />
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

                  {/* Auto-Generate Unique Username Button */}
                  <button
                    type="button"
                    onClick={handleGenerateUsername}
                    disabled={isGeneratingUsername}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95",
                      isDark 
                        ? "bg-[#8B1EF3]/20 hover:bg-[#8B1EF3]/30 text-[#B978FF] border border-[#8B1EF3]/30" 
                        : "bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200"
                    )}
                    title="Generate a guaranteed unique username via userService"
                  >
                    <Sparkles className={cn("w-3 h-3", isGeneratingUsername && "animate-spin")} />
                    <span>Auto-Generate</span>
                  </button>
                </div>
              </div>

              {/* Input with @ prefix */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 font-mono text-sm font-bold text-[#8B1EF3] dark:text-[#B978FF] select-none pointer-events-none">
                  @
                </span>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder="your_handle"
                  maxLength={30}
                  className={cn(
                    "w-full pl-8 pr-4 py-2.5 rounded-2xl text-sm font-mono font-medium outline-none transition-all border",
                    isDark
                      ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-[#8B1EF3] focus:ring-2 focus:ring-[#8B1EF3]/20"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#8B1EF3] focus:ring-2 focus:ring-[#8B1EF3]/20"
                  )}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Letters, numbers, periods, and underscores. 3 to 30 characters.
              </p>
            </div>

            {/* Display Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>Display Name</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.displayName.length}/{PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                </span>
              </div>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Citizen Name"
                maxLength={PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                  isDark
                    ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
              />
            </div>

            {/* Bio Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Bio & Civic Manifesto
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.bio.length}/{PROFILE_CONSTRAINTS.BIO.MAX_LENGTH}
                </span>
              </div>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Introduce yourself to the Arvdoul community..."
                rows={3}
                maxLength={PROFILE_CONSTRAINTS.BIO.MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-normal outline-none transition-all border resize-none leading-relaxed",
                  isDark
                    ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                )}
              />
            </div>

            {/* Pronouns & Category/Profession Row */}
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
                        "px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                        formData.pronouns === p
                          ? "bg-purple-500/20 border-purple-500 text-purple-300 font-bold"
                          : isDark
                          ? "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.pronouns}
                  onChange={(e) => handleInputChange('pronouns', e.target.value)}
                  placeholder="e.g. they/them"
                  maxLength={PROFILE_CONSTRAINTS.PRONOUNS.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2 rounded-2xl text-xs outline-none transition-all border mt-1.5",
                    isDark
                      ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  Profession / Role
                </label>
                <input
                  type="text"
                  value={formData.profession}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  placeholder="e.g. Creator, Builder, Artist"
                  maxLength={PROFILE_CONSTRAINTS.PROFESSION.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                    isDark
                      ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  )}
                />
              </div>
            </div>

          </div>
        </section>
        </>
        )}

        {/* 3. CIVIC COORDINATES & LOCATION */}
        {(activeSection === 'all' || activeSection === 'coordinates') && (
        <section className={cn(
          "rounded-[28px] border transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-[#070D27]/90 border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
            : "bg-white/95 border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
              Civic Coordinates & Website
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Connect your digital nation passport with your geographic territory and digital flagship.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Location with Interactive Modal Trigger */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Location</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Interactive Map
                </button>
              </label>

              <div className="relative flex items-center">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="e.g. Neo Tokyo, Global, London"
                  maxLength={PROFILE_CONSTRAINTS.LOCATION.MAX_LENGTH}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                    isDark
                      ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500"
                  )}
                />
              </div>
            </div>

            {/* Official Website */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Website</span>
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://yourdomain.com"
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none transition-all border",
                  isDark
                    ? "bg-black/20 border-white/10 text-white placeholder-slate-500 focus:border-cyan-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500"
                )}
              />
            </div>

          </div>
        </section>
        )}

        {/* 4. CUSTOM SOCIAL LINKS HUB (Up to 10) */}
        {(activeSection === 'all' || activeSection === 'links') && (
        <section className={cn(
          "rounded-[28px] border transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-[#070D27]/90 border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
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
                    isDark ? "bg-black/20 border-white/10" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <select
                    value={link.platform || 'website'}
                    onChange={(e) => handleUpdateLink(idx, 'platform', e.target.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                      isDark 
                        ? "bg-slate-900 border-white/10 text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  >
                    {PLATFORM_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={link.title || ''}
                    onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                    placeholder="Link Title (e.g. My GitHub)"
                    className={cn(
                      "sm:w-44 px-3 py-1.5 rounded-xl text-xs font-medium outline-none border",
                      isDark 
                        ? "bg-black/30 border-white/10 text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  />

                  <input
                    type="text"
                    value={link.url || ''}
                    onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-xl text-xs font-mono outline-none border",
                      isDark 
                        ? "bg-black/30 border-white/10 text-white" 
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  />

                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => handleTogglePrimaryLink(idx)}
                      className={cn(
                        "p-2 rounded-xl transition-all cursor-pointer",
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
                      onClick={() => handleRemoveLink(idx)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      title="Remove Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* 5. PRIVACY & AUDIENCE GOVERNANCE */}
        {(activeSection === 'all' || activeSection === 'privacy') && (
        <section className={cn(
          "rounded-[28px] border transition-all p-5 sm:p-7 space-y-5",
          isDark
            ? "bg-[#070D27]/90 border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
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
                ? "bg-black/20 border-white/10"
                : "bg-slate-50 border-slate-200"
            )}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Lock className={cn("w-4 h-4", formData.isPrivate ? "text-[#8B1EF3]" : "text-slate-400")} />
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
                className="w-5 h-5 accent-[#8B1EF3] rounded cursor-pointer"
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
                  <div className="text-[11px] text-slate-400">Who can view your profile info</div>
                </div>
                <select
                  value={formData.privacy.profileInfo}
                  onChange={(e) => handlePrivacyChange('profileInfo', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
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
                <select
                  value={formData.privacy.presence}
                  onChange={(e) => handlePrivacyChange('presence', e.target.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Nobody</option>
                </select>
              </div>

              {/* Followers List */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Social Graph</div>
                  <div className="text-[11px] text-slate-400">Who can view your followers/following lists</div>
                </div>
                <select
                  value={formData.privacy.followersList}
                  onChange={(e) => {
                    handlePrivacyChange('followersList', e.target.value);
                    handlePrivacyChange('followingList', e.target.value);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                  <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                  <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
                </select>
              </div>

              {/* Activity & Badges */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs sm:text-sm font-semibold">Civic Standing & Badges</div>
                  <div className="text-[11px] text-slate-400">Who can view your badges and achievements</div>
                </div>
                <select
                  value={formData.privacy.activity}
                  onChange={(e) => {
                    handlePrivacyChange('activity', e.target.value);
                    handlePrivacyChange('achievements', e.target.value);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold outline-none border",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
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

                  <select
                    value={formData.privacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME}
                    onChange={(e) => handlePrivacyChange('economicStatus', e.target.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold outline-none border cursor-pointer",
                      isDark ? "bg-slate-900 border-amber-500/40 text-amber-300" : "bg-white border-amber-300 text-amber-900"
                    )}
                  >
                    <option value={VISIBILITY_SCOPES.ONLY_ME}>🔒 Only Me (Private Treasury)</option>
                    <option value={VISIBILITY_SCOPES.CONNECTIONS}>👥 Connections Only</option>
                    <option value={VISIBILITY_SCOPES.EVERYONE}>🌐 Everyone (Public Treasury)</option>
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
        )}

        {/* Bottom Save Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
              isDark ? "hover:bg-white/[0.05] text-slate-300" : "hover:bg-slate-200 text-slate-700"
            )}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || usernameAvailability === 'taken'}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-[0_4px_16px_rgba(68,49,247,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)"
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
          userId={currentUid}
          theme={theme}
          onLocationUpdated={(newLoc) => {
            setFormData(prev => ({ ...prev, location: newLoc }));
            setShowLocationModal(false);
          }}
        />
      )}
    </div>
  );
}
