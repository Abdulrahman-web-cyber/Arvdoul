/**
 * src/screens/Profile/EditProfileScreen.jsx - ARVDOUL Edit Profile Screen
 * 
 * Screen for editing user profile information.
 * 
 * @component
 */

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
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { VISIBILITY_SCOPES, DEFAULT_PROFILE_PRIVACY } from '../../config/profileContracts.js';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';

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
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  
  // Load current profile data
  useEffect(() => {
    if (userProfile) {
      const p = userProfile.privacy || {};
      setFormData({
        displayName: userProfile.displayName || '',
        username: userProfile.username || '',
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
      setCoverPreview(userProfile.coverPhotoURL);
    }
  }, [userProfile]);
  
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
  
  const handleAvatarChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);
  
  const handleCoverChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);
  
  const handleSave = useCallback(async () => {
    setSaving(true);
    
    try {
      // Upload avatar if changed
      if (avatarFile) {
        await userService.uploadAvatar(userProfile.uid, avatarFile);
      }
      
      // Upload cover photo if changed (was previously discarded — fixed)
      if (coverFile) {
        await userService.uploadCoverPhoto(userProfile.uid, coverFile);
      }
      
      // Clean links
      const cleanedData = {
        ...formData,
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
  }, [formData, avatarFile, coverFile, updateUserProfile, navigate, userProfile, userService]);
  
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
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Avatar & Cover */}
        <div className="space-y-4">
          {/* Cover */}
          <div className="relative">
            <div 
              className={cn(
                'h-40 rounded-2xl overflow-hidden',
                'bg-gradient-to-r from-purple-500 to-blue-500'
              )}
            >
              {coverPreview && (
                <img
                  src={coverPreview}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <label className={cn(
              'absolute bottom-3 right-3',
              'p-2 rounded-full',
              'bg-black/50 hover:bg-black/70',
              'text-white cursor-pointer transition-colors'
            )}>
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
            </label>
          </div>
          
          {/* Avatar */}
          <div className="relative -mt-12 ml-4 z-10">
            <div className={cn(
              'w-24 h-24 rounded-full',
              'border-4 border-white dark:border-gray-900',
              'overflow-hidden bg-gray-200 dark:bg-gray-700'
            )}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
            <label className={cn(
              'absolute bottom-0 right-0',
              'p-1.5 rounded-full',
              'bg-purple-500 hover:bg-purple-600',
              'text-white cursor-pointer transition-colors'
            )}>
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Basic Information
          </h2>
          
          <InputField
            icon={User}
            label="Display Name"
            field="displayName"
            placeholder="Your display name"
          />
          
          <InputField
            icon={User}
            label="Username"
            field="username"
            placeholder="your_username"
          />
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                Bio
              </label>
              <span className={cn(
                "text-xs",
                formData.bio.length > 500 ? "text-red-500 font-bold" : "text-gray-400"
              )}>
                {formData.bio.length} / 500
              </span>
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              maxLength={500}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl resize-none',
                'bg-gray-50 dark:bg-gray-800',
                'border border-gray-200 dark:border-gray-700',
                'text-gray-900 dark:text-white',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                'transition-colors'
              )}
            />
          </div>
        </div>

        {/* Links Manager */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-400" />
                Profile Links
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add up to 10 verified external links, portfolio, or socials
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
            <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
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
        
        {/* Personal Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Personal Information
          </h2>
          
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
                    'w-full px-4 py-2.5 rounded-xl pr-10',
                    'bg-gray-50 dark:bg-gray-800',
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
        
        {/* Professional Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Professional Information
          </h2>
          
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
        
        {/* Privacy */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            Privacy & Permissions
          </h2>
          
          <label className={cn(
            'flex items-center justify-between p-4 rounded-xl',
            'bg-gray-50 dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'cursor-pointer'
          )}>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Private Account
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Only approved followers can see your posts and media
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
              className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
            />
          </label>

          {/* Granular Privacy Scopes */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-4">
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
      </div>

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
