// src/screens/Profile/EditProfileScreen.jsx

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  ArrowLeft, 
  Camera, 
  Save, 
  X, 
  User, 
  Mail, 
  Phone,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Globe,
  Shield,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  Eye,
  Check,
  Navigation,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { VISIBILITY_SCOPES, DEFAULT_PROFILE_PRIVACY, PROFILE_CONSTRAINTS } from '../../config/profileContracts.js';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';
import AvatarUploadModal from '../../components/profile/AvatarUploadModal';

/**
 * EditProfileScreen Component
 */
export default function EditProfileScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { userProfile, updateUserProfile, userService } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    pronouns: '',
    gender: '',
    profession: '',
    education: '',
    language: 'English',
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
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [usernameAvailability, setUsernameAvailability] = useState(null); // 'checking' | 'available' | 'taken' | 'invalid' | 'current'
  const [isGeneratingUsername, setIsGeneratingUsername] = useState(false);

  // Load current profile data
  useEffect(() => {
    if (userProfile) {
      const p = userProfile.privacy || {};
      let initialUsername = userProfile.username || '';
      if (!initialUsername || initialUsername.startsWith('user_') || initialUsername === 'user' || initialUsername === 'creator') {
        const fromEmail = userProfile.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        const fromName = userProfile.displayName?.toLowerCase().replace(/[^a-z0-9._]/g, '');
        initialUsername = fromEmail || fromName || '';
      }

      setFormData({
        displayName: userProfile.displayName || '',
        username: initialUsername,
        bio: userProfile.bio || '',
        location: userProfile.location || '',
        website: userProfile.website || '',
        pronouns: userProfile.pronouns || '',
        gender: userProfile.gender || '',
        profession: userProfile.profession || '',
        education: userProfile.education || '',
        language: userProfile.language || 'English',
        isPrivate: Boolean(userProfile.isPrivate),
        links: Array.isArray(userProfile.links) ? userProfile.links : [],
        privacy: {
          profileInfo: p.profileInfo || (p.profileVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.profileVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          presence: p.presence || (p.onlinePresence === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.onlinePresence === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : p.onlinePresence === 'public' ? VISIBILITY_SCOPES.EVERYONE : VISIBILITY_SCOPES.FOLLOWERS),
          followersList: p.followersList || (p.followersVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.followersVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          activity: p.activity || (p.activityVisibility === 'private' ? VISIBILITY_SCOPES.ONLY_ME : p.activityVisibility === 'connections' ? VISIBILITY_SCOPES.CONNECTIONS : VISIBILITY_SCOPES.EVERYONE),
          economicStatus: p.economicStatus || VISIBILITY_SCOPES.ONLY_ME,
        },
      });
      setAvatarPreview(userProfile.photoURL);
    }
    // Intentionally keyed on uid only: serializing the whole profile here would
    // re-run on every profile snapshot and discard in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  // Live username availability check with debounce
  useEffect(() => {
    const raw = formData.username?.trim().toLowerCase();
    if (!raw) {
      setUsernameAvailability(null);
      return;
    }
    if (raw === userProfile?.username) {
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
  }, [formData.username, userProfile?.username, userService]);

  // Unique generated username handler using userService
  const handleGenerateUsername = useCallback(async () => {
    setIsGeneratingUsername(true);
    try {
      const base = formData.displayName || userProfile?.displayName || userProfile?.email?.split('@')[0] || 'creator';
      const cleanBase = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'creator';
      let uniqueUser = '';
      if (userService?.generateUniqueUsername) {
        uniqueUser = await userService.generateUniqueUsername(cleanBase, userProfile?.uid);
        // Ensure no leftover user_ prefix
        if (uniqueUser.startsWith('user_')) {
          uniqueUser = uniqueUser.replace(/^user_/, `${cleanBase}_`);
        }
      } else {
        const rand = Math.floor(1000 + Math.random() * 9000);
        uniqueUser = `${cleanBase}_${rand}`;
      }
      setFormData(prev => ({ ...prev, username: uniqueUser }));
      setUsernameAvailability('available');
      toast.success(`Generated: @${uniqueUser}`);
    } catch (e) {
      console.warn('Generate username err:', e);
      toast.error('Could not generate unique username');
    } finally {
      setIsGeneratingUsername(false);
    }
  }, [formData.displayName, userProfile, userService]);
  
  // Handlers
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

  const handleAddLink = useCallback(() => {
    if (formData.links.length >= 10) {
      toast.error('Maximum 10 links allowed');
      return;
    }
    const newLink = {
      id: Date.now().toString(),
      title: '',
      url: '',
      platform: 'custom',
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
  
  const handleAvatarCropped = useCallback(async (file) => {
    if (!file) return;
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    if (!userProfile?.uid) return;
    const defaultAvatar = userService?.getAvatarUrl
      ? userService.getAvatarUrl(userProfile.uid, formData.displayName || 'Creator', null)
      : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formData.displayName || 'Creator')}&backgroundColor=6366f1`;

    setAvatarFile(null);
    setAvatarPreview(defaultAvatar);
    if (userService?.updateUserProfile) {
      await userService.updateUserProfile(userProfile.uid, { photoURL: defaultAvatar });
    }
  }, [userProfile?.uid, formData.displayName, userService]);

  const handleSave = useCallback(async () => {
    if (saving) return;

    const rawUser = formData.username?.trim().toLowerCase();
    const displayName = formData.displayName?.trim() || '';
    const bio = formData.bio || '';

    const validationErrors = [];
    if (!displayName) {
      validationErrors.push('Display name cannot be empty');
    } else if (displayName.length > PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
      validationErrors.push(`Display name must be under ${PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters`);
    } else if (!PROFILE_CONSTRAINTS.DISPLAY_NAME.PATTERN.test(displayName)) {
      validationErrors.push('Display name contains unsupported characters');
    }
    if (!rawUser) {
      validationErrors.push('Username cannot be empty');
    } else if (!/^[a-z0-9._]{3,30}$/.test(rawUser)) {
      validationErrors.push('Username must be 3-30 characters (letters, numbers, dots, or underscores)');
    }
    if (bio.length > PROFILE_CONSTRAINTS.BIO.MAX_LENGTH) {
      validationErrors.push(`Bio must be under ${PROFILE_CONSTRAINTS.BIO.MAX_LENGTH} characters`);
    }
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setSaving(true);
    
    try {
      if (rawUser !== userProfile?.username && userService?.checkUsernameAvailability) {
        const check = await userService.checkUsernameAvailability(rawUser);
        if (!check.available) {
          toast.error(`@${rawUser} is already taken. Please choose another or click Auto-Generate.`);
          setSaving(false);
          return;
        }
      }

      // Upload avatar if changed
      if (avatarFile && userProfile?.uid) {
        await userService.uploadAvatar(userProfile.uid, avatarFile);
      }
      
      // Clean links
      const cleanedData = {
        ...formData,
        displayName,
        username: rawUser,
        links: (formData.links || []).filter(l => l.url && l.url.trim().length > 0),
      };
      
      // Update profile
      await updateUserProfile(cleanedData);
      
      toast.success('Profile updated successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [formData, avatarFile, updateUserProfile, navigate, userProfile?.uid, userProfile?.username, userService, saving]);
  
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);
  
  // Input field component
  const InputField = ({ icon: Icon, label, field, type = 'text', placeholder }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        {label}
      </label>
      <input
        type={type}
        value={formData[field]}
        onChange={(e) => handleInputChange(field, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl',
          'bg-gray-50 dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          'text-gray-900 dark:text-white',
          'placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
          'transition-colors'
        )}
      />
    </div>
  );
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl',
        'border-b border-gray-200/60 dark:border-gray-800/60'
      )}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleCancel}
            className={cn(
              'p-2 rounded-xl',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Profile
          </h1>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-4 py-2 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity',
              'disabled:opacity-50',
              'flex items-center gap-2'
            )}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>
      
      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 1. Avatar Photo Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Profile Photo
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Crop and customize your public identity avatar (1:1 circular)
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-[#B416DB] via-[#4B6BFF] to-[#0EA3E6] shadow-lg">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change Photo</span>
                </button>

                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                1:1 aspect ratio with interactive zoom & crop. WebP compressed.
              </p>
            </div>
          </div>
        </div>
        
        {/* 2. Basic Information Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Basic Information
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your public identity and display details
            </p>
          </div>
          
          <InputField
            icon={User}
            label="Display Name"
            field="displayName"
            placeholder="Your display name"
          />
          
          {/* Username Field with Live Checker and Auto-Generator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <span>Username</span>
              </label>

              {/* Live Status Badge */}
              <div className="flex items-center gap-2">
                {usernameAvailability === 'checking' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-500 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Checking...
                  </span>
                )}
                {usernameAvailability === 'available' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Available
                  </span>
                )}
                {usernameAvailability === 'current' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">
                    Current Handle
                  </span>
                )}
                {usernameAvailability === 'taken' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    Handle Taken
                  </span>
                )}
                {usernameAvailability === 'invalid' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    3-30 chars (letters, numbers, dots, _)
                  </span>
                )}

                {/* Auto-Generate Unique Username Button */}
                <button
                  type="button"
                  onClick={handleGenerateUsername}
                  disabled={isGeneratingUsername}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500/15 to-blue-500/15 hover:from-purple-500/25 hover:to-blue-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Generate a unique clean username without raw UID"
                >
                  <Sparkles className={cn("w-3 h-3", isGeneratingUsername && "animate-spin")} />
                  <span>{isGeneratingUsername ? 'Generating...' : 'Auto-Generate'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                @
              </span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                placeholder="your_unique_username"
                className={cn(
                  'w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-medium',
                  'bg-gray-50 dark:bg-gray-800/80',
                  'border border-gray-200 dark:border-gray-700',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                  'transition-colors'
                )}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Only letters, numbers, and underscores. This becomes your unique Arvdoul profile link.
            </p>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                Bio
              </label>
              <span className={cn(
                "text-xs font-mono",
                formData.bio.length > 500 ? "text-red-500 font-bold" : "text-gray-400"
              )}>
                {formData.bio.length} / 500
              </span>
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell others what you do, build, or share..."
              rows={3}
              maxLength={500}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl resize-none text-sm',
                'bg-gray-50 dark:bg-gray-800/80',
                'border border-gray-200 dark:border-gray-700',
                'text-gray-900 dark:text-white',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                'transition-colors'
              )}
            />
          </div>
        </div>

        {/* 3. Links Manager Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-400" />
                Profile Links
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add verified external links, portfolio, or socials (up to 10)
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={formData.links.length >= 10}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all',
                'bg-purple-600 hover:bg-purple-700 text-white shadow-sm disabled:opacity-50'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Link
            </button>
          </div>

          {formData.links.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
              No custom links added yet. Click &quot;Add Link&quot; to showcase your websites or projects.
            </div>
          ) : (
            <div className="space-y-3">
              {formData.links.map((link, idx) => (
                <div
                  key={link.id || idx}
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/40 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                      placeholder="Title (e.g. My Portfolio, Twitter, YouTube)"
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <select
                      value={link.platform || 'custom'}
                      onChange={(e) => handleUpdateLink(idx, 'platform', e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none"
                    >
                      <option value="custom">Custom</option>
                      <option value="twitter">X / Twitter</option>
                      <option value="instagram">Instagram</option>
                      <option value="youtube">YouTube</option>
                      <option value="github">GitHub</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="discord">Discord</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleTogglePrimaryLink(idx)}
                      title={link.isPrimary ? "Primary Link" : "Make Primary Link"}
                      className={cn(
                        "p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all",
                        link.isPrimary
                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                          : "text-gray-400 hover:text-amber-500"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 4. Personal Information Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Personal Information
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Location, demographics, and contact details
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  Location
                </label>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <Navigation className="w-3 h-3" />
                  <span>GPS / Select</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="City, Country"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl pr-10 text-sm',
                    'bg-gray-50 dark:bg-gray-800/80',
                    'border border-gray-200 dark:border-gray-700',
                    'text-gray-900 dark:text-white',
                    'placeholder-gray-400 dark:placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                    'transition-colors'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  title="Detect or choose location"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <InputField
              icon={Globe}
              label="Website"
              field="website"
              type="url"
              placeholder="https://example.com"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Pronouns"
              field="pronouns"
              placeholder="e.g., they/them"
            />
            
            <InputField
              label="Gender"
              field="gender"
              placeholder="Optional"
            />
          </div>
        </div>
        
        {/* 5. Professional Information Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Professional Information
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Work history, discipline, and education credentials
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              icon={Shield}
              label="Profession"
              field="profession"
              placeholder="What do you do?"
            />
            
            <InputField
              icon={Globe}
              label="Education"
              field="education"
              placeholder="Where did you study?"
            />
          </div>
        </div>
        
        {/* 6. Privacy & Permissions Card */}
        <div className="bg-white dark:bg-[#0d1527]/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm space-y-4">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              Privacy & Permissions
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Control who can interact with your profile and view your content
            </p>
          </div>
          
          <label className={cn(
            'flex items-center justify-between p-4 rounded-xl',
            'bg-gray-50 dark:bg-gray-800/60',
            'border border-gray-200 dark:border-gray-700',
            'cursor-pointer'
          )}>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                Private Account
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Only approved followers can see your posts and media
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
              className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500 cursor-pointer"
            />
          </label>

          {/* Granular Privacy Scopes */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Audience Permissions
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Profile Visibility</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Who can discover and view your profile</p>
              </div>
              <select
                value={formData.privacy.profileInfo}
                onChange={(e) => handlePrivacyChange('profileInfo', e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Online Presence</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Who can see when you are active</p>
              </div>
              <select
                value={formData.privacy.presence}
                onChange={(e) => handlePrivacyChange('presence', e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Mutual Connections</option>
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Nobody</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Followers / Following List</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Who can browse your social graph</p>
              </div>
              <select
                value={formData.privacy.followersList}
                onChange={(e) => {
                  handlePrivacyChange('followersList', e.target.value);
                  handlePrivacyChange('followingList', e.target.value);
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Achievements & Activity</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Who can view your achievements and citizenship rank</p>
              </div>
              <select
                value={formData.privacy.activity}
                onChange={(e) => {
                  handlePrivacyChange('activity', e.target.value);
                  handlePrivacyChange('achievements', e.target.value);
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
                <option value={VISIBILITY_SCOPES.FOLLOWERS}>Followers</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Connections Only</option>
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Financial Stats & Earnings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Visibility of coin balance and tipping revenue</p>
              </div>
              <select
                value={formData.privacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME}
                onChange={(e) => handlePrivacyChange('economicStatus', e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value={VISIBILITY_SCOPES.ONLY_ME}>Only Me (Private)</option>
                <option value={VISIBILITY_SCOPES.CONNECTIONS}>Mutual Connections</option>
                <option value={VISIBILITY_SCOPES.EVERYONE}>Everyone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-2.5 rounded-xl font-semibold text-sm',
              'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600',
              'text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:opacity-95 transition-all',
              'disabled:opacity-50 flex items-center gap-2 cursor-pointer'
            )}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Avatar Upload & Crop Modal */}
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
          userId={userProfile?.id || userProfile?.uid}
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
