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
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

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
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  
  // Load current profile data
  useEffect(() => {
    if (userProfile) {
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
        isPrivate: userProfile.isPrivate || false,
      });
      setAvatarPreview(userProfile.photoURL);
      setCoverPreview(userProfile.coverPhotoURL);
    }
  }, [userProfile]);
  
  // Handlers
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      
      // Update profile
      await updateUserProfile(formData);
      
      toast.success('Profile updated successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [formData, avatarFile, updateUserProfile, navigate, userProfile, userService]);
  
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
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800'
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" />
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
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
        
        {/* Personal Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Personal Information
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <InputField
              icon={MapPin}
              label="Location"
              field="location"
              placeholder="City, Country"
            />
            
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Privacy
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
                Only approved followers can see your posts
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
              className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
