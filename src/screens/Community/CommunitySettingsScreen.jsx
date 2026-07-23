// src/screens/Community/CommunitySettingsScreen.jsx - ARVDOUL COMMUNITY SETTINGS
// ✅ Edit community settings
// ✅ Manage roles and members
// ✅ Update privacy and moderation

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, Trash2, Users, Shield, Settings, 
  Image as ImageIcon, Globe, Lock, Shield as ShieldIcon
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { getStorageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';

const CommunitySettingsScreen = () => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const communityService = getCommunityService();
  const storageService = getStorageService();

  // State
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules: '',
    privacy: 'public',
    avatar: null,
    avatarPreview: '',
    cover: null,
    coverPreview: '',
    settings: {
      defaultRole: 'member',
      joinApproval: false,
      inviteOnly: false,
      discoveryEnabled: true
    }
  });

  // Load community
  const loadCommunity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await communityService.getCommunity(communityId);
      if (!data) {
        toast.error('Community not found');
        navigate('/community');
        return;
      }

      // Check permissions
      const membership = data.members?.[user?.uid];
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        toast.error('You do not have permission to edit this community');
        navigate(`/community/${communityId}`);
        return;
      }

      setCommunity(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        rules: data.rules || '',
        privacy: data.privacy || 'public',
        avatar: null,
        avatarPreview: data.avatar || '',
        cover: null,
        coverPreview: data.cover || '',
        settings: {
          defaultRole: data.settings?.defaultRole || 'member',
          joinApproval: data.settings?.joinApproval || false,
          inviteOnly: data.settings?.inviteOnly || false,
          discoveryEnabled: data.settings?.discoveryEnabled !== false
        }
      });
    } catch (error) {
      console.error('Failed to load community:', error);
      toast.error('Failed to load community settings');
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.uid, communityService, navigate]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  // Handle input change
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle nested field change
  const handleNestedChange = useCallback((parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((type, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'avatar') {
        handleChange('avatarPreview', e.target.result);
        handleChange('avatar', file);
      } else {
        handleChange('coverPreview', e.target.result);
        handleChange('cover', file);
      }
    };
    reader.readAsDataURL(file);
  }, [handleChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Upload images if changed
      let avatarUrl = community.avatar;
      let coverUrl = community.cover;

      if (formData.avatar) {
        avatarUrl = await storageService.uploadFile(
          formData.avatar, 
          `communities/avatars/${user.uid}/${Date.now()}`
        );
      }
      if (formData.cover) {
        coverUrl = await storageService.uploadFile(
          formData.cover,
          `communities/covers/${user.uid}/${Date.now()}`
        );
      }

      // Update community
      await communityService.updateCommunity(communityId, user.uid, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rules: formData.rules.trim(),
        privacy: formData.privacy,
        avatar: avatarUrl,
        cover: coverUrl,
        settings: formData.settings
      });

      toast.success('Community settings saved!');
      loadCommunity();
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [formData, user?.uid, community, communityId, communityService, storageService, loadCommunity]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this community? This action cannot be undone.')) {
      return;
    }

    try {
      await communityService.deleteCommunity(communityId, user.uid);
      toast.success('Community deleted');
      navigate('/community');
    } catch (error) {
      console.error('Failed to delete community:', error);
      toast.error(error.message || 'Failed to delete community');
    }
  }, [communityId, user?.uid, communityService, navigate]);

  // Section navigation
  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'privacy', label: 'Privacy', icon: ShieldIcon },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'danger', label: 'Danger Zone', icon: Trash2 }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/community/${communityId}`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Community Settings
                </h1>
                <p className="text-sm text-gray-500">{community?.name}</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 border border-gray-200 dark:border-gray-700 sticky top-24">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
                    ${activeSection === id
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {/* General Settings */}
            {activeSection === 'general' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                  General Settings
                </h2>

                {/* Cover Image */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cover Image
                  </label>
                  <div
                    onClick={() => document.getElementById('cover-input')?.click()}
                    className="h-40 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 cursor-pointer overflow-hidden"
                  >
                    {formData.coverPreview ? (
                      <img src={formData.coverPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <span>Click to upload cover</span>
                      </div>
                    )}
                  </div>
                  <input
                    id="cover-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect('cover', e.target.files?.[0])}
                    className="hidden"
                  />
                </div>

                {/* Avatar */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Avatar
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      onClick={() => document.getElementById('avatar-input')?.click()}
                      className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 cursor-pointer overflow-hidden"
                    >
                      {formData.avatarPreview ? (
                        <img src={formData.avatarPreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-700 text-gray-500">
                          <ImageIcon className="w-6 h-6 mb-1" />
                          <span className="text-xs">Upload</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      Click to change avatar. Recommended: 400x400px
                    </span>
                  </div>
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect('avatar', e.target.files?.[0])}
                    className="hidden"
                  />
                </div>

                {/* Name */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Community Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Rules */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Community Rules
                  </label>
                  <textarea
                    value={formData.rules}
                    onChange={(e) => handleChange('rules', e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Privacy Settings */}
            {activeSection === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                  Privacy Settings
                </h2>

                {/* Privacy Options */}
                <div className="space-y-3 mb-6">
                  {[
                    { value: 'public', label: 'Public', description: 'Anyone can see and join', icon: Globe },
                    { value: 'private', label: 'Private', description: 'Anyone can see but must request to join', icon: Lock },
                    { value: 'secret', label: 'Secret', description: 'Only members can see and find', icon: ShieldIcon }
                  ].map(({ value, label, description, icon: Icon }) => (
                    <label
                      key={value}
                      className={`
                        flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${formData.privacy === value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                      `}
                    >
                      <input
                        type="radio"
                        name="privacy"
                        value={value}
                        checked={formData.privacy === value}
                        onChange={(e) => handleChange('privacy', e.target.value)}
                        className="sr-only"
                      />
                      <Icon className={`w-6 h-6 ${formData.privacy === value ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                        <p className="text-sm text-gray-500">{description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Access Settings
                </h3>

                {/* Settings */}
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Require Approval</p>
                      <p className="text-sm text-gray-500">Users must be approved to join</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.joinApproval}
                      onChange={(e) => handleNestedChange('settings', 'joinApproval', e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Invite Only</p>
                      <p className="text-sm text-gray-500">Only admins can invite members</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.inviteOnly}
                      onChange={(e) => handleNestedChange('settings', 'inviteOnly', e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Show in Discovery</p>
                      <p className="text-sm text-gray-500">Allow non-members to find this community</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.discoveryEnabled}
                      onChange={(e) => handleNestedChange('settings', 'discoveryEnabled', e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {/* Members */}
            {activeSection === 'members' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Members ({community?.stats?.memberCount || 0})
                  </h2>
                  <button
                    onClick={() => navigate(`/community/${communityId}/members`)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Manage Members
                  </button>
                </div>

                {/* Member list preview */}
                <div className="space-y-3">
                  {Object.entries(community?.members || {}).slice(0, 5).map(([userId, data]) => (
                    <div key={userId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {data.displayName || 'User'}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">{data.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Danger Zone */}
            {activeSection === 'danger' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-red-200 dark:border-red-900"
              >
                <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  These actions are irreversible. Please proceed with caution.
                </p>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                    Delete Community
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Once you delete a community, there is no going back. All posts, members, 
                    and data will be permanently removed.
                  </p>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium"
                  >
                    Delete Community
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunitySettingsScreen;
