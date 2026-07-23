// src/screens/Community/CreateCommunityScreen.jsx - ARVDOUL CREATE COMMUNITY
// ✅ Create new community with all settings
// ✅ Avatar and cover upload
// ✅ Privacy and moderation settings

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Upload, X, Globe, Lock, Shield, Users, 
  MessageCircle, Calendar, Check, Image as ImageIcon
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { getStorageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';

const CreateCommunityScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const communityService = getCommunityService();
  const storageService = getStorageService();

  // Form state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules: '',
    privacy: 'public',
    avatar: null,
    avatarPreview: '',
    cover: null,
    coverPreview: '',
    tags: [],
    tagInput: '',
    settings: {
      defaultRole: 'member',
      joinApproval: false,
      inviteOnly: false,
      discoveryEnabled: true
    },
    moderation: {
      slowMode: false,
      slowModeDelay: 0,
      contentApproval: false
    }
  });

  // Image upload refs
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Handle input change
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
  const handleImageSelect = useCallback(async (type, file) => {
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview
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

  // Handle tag input
  const handleTagKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = formData.tagInput.trim();
      if (tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
        handleChange('tags', [...formData.tags, tag]);
        handleChange('tagInput', '');
      }
    }
  }, [formData.tagInput, formData.tags, handleChange]);

  // Remove tag
  const removeTag = useCallback((tagToRemove) => {
    handleChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  }, [formData.tags, handleChange]);

  // Remove image
  const removeImage = useCallback((type) => {
    if (type === 'avatar') {
      handleChange('avatar', null);
      handleChange('avatarPreview', '');
    } else {
      handleChange('cover', null);
      handleChange('coverPreview', '');
    }
  }, [handleChange]);

  // Validation
  const validateStep = useCallback((stepNum) => {
    switch (stepNum) {
      case 1:
        if (!formData.name.trim()) {
          toast.error('Community name is required');
          return false;
        }
        if (formData.name.length < 3) {
          toast.error('Community name must be at least 3 characters');
          return false;
        }
        if (formData.name.length > 50) {
          toast.error('Community name must be less than 50 characters');
          return false;
        }
        return true;
      case 2:
        if (formData.description.length > 500) {
          toast.error('Description must be less than 500 characters');
          return false;
        }
        if (formData.rules.length > 2000) {
          toast.error('Rules must be less than 2000 characters');
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [formData]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  }, [step, validateStep]);

  // Handle previous step
  const handleBack = useCallback(() => {
    setStep(prev => prev - 1);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!user?.uid) {
      toast.error('Please sign in to create a community');
      return;
    }

    setLoading(true);

    try {
      // Upload images if selected
      let avatarUrl = '';
      let coverUrl = '';

      if (formData.avatar) {
        const avatarPath = `communities/avatars/${user.uid}/${Date.now()}`;
        avatarUrl = await storageService.uploadFile(formData.avatar, avatarPath);
      }

      if (formData.cover) {
        const coverPath = `communities/covers/${user.uid}/${Date.now()}`;
        coverUrl = await storageService.uploadFile(formData.cover, coverPath);
      }

      // Create community
      const community = await communityService.createCommunity(user.uid, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rules: formData.rules.trim(),
        privacy: formData.privacy,
        avatar: avatarUrl,
        cover: coverUrl,
        tags: formData.tags,
        settings: formData.settings,
        moderation: formData.moderation
      });

      toast.success('Community created successfully!');
      navigate(`/community/${community.id}`);
    } catch (error) {
      console.error('Failed to create community:', error);
      toast.error(error.message || 'Failed to create community');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, formData, storageService, communityService, navigate]);

  // Privacy options
  const privacyOptions = [
    {
      value: 'public',
      label: 'Public',
      description: 'Anyone can see and join this community',
      icon: Globe,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      value: 'private',
      label: 'Private',
      description: 'Anyone can see but must request to join',
      icon: Lock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    {
      value: 'secret',
      label: 'Secret',
      description: 'Only members can see and find this community',
      icon: Shield,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Create Community
            </h1>
            <div className="w-10" />
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                    ${step >= num 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
                  `}
                >
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                {num < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${step > num ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Basic Information
              </h2>

              {/* Cover Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cover Image
                </label>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className={`
                    relative h-40 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden
                    ${formData.coverPreview 
                      ? 'border-indigo-300 dark:border-indigo-700' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-600'}
                  `}
                >
                  {formData.coverPreview ? (
                    <>
                      <img
                        src={formData.coverPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage('cover');
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm">Click to upload cover image</span>
                    </div>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
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
                    onClick={() => avatarInputRef.current?.click()}
                    className={`
                      w-24 h-24 rounded-full border-2 border-dashed cursor-pointer overflow-hidden
                      ${formData.avatarPreview 
                        ? 'border-indigo-300 dark:border-indigo-700' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-600'}
                    `}
                  >
                    {formData.avatarPreview ? (
                      <img
                        src={formData.avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs">Upload</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Click to upload an avatar. Recommended size: 400x400px.
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleImageSelect('avatar', e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Community Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter community name"
                  maxLength={50}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    3-50 characters
                  </span>
                  <span className={`text-xs ${formData.name.length > 45 ? 'text-red-500' : 'text-gray-500'}`}>
                    {formData.name.length}/50
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="What is this community about?"
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-end">
                  <span className={`text-xs ${formData.description.length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
                    {formData.description.length}/500
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.tagInput}
                  onChange={(e) => handleChange('tagInput', e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a tag and press Enter"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add up to 10 tags to help people find your community
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Privacy & Settings */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Privacy & Access
              </h2>

              {/* Privacy Options */}
              <div className="space-y-3 mb-8">
                {privacyOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`
                      flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${formData.privacy === option.value
                        ? `${option.bgColor} border-${option.color.replace('text-', '')}`
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                    `}
                  >
                    <input
                      type="radio"
                      name="privacy"
                      value={option.value}
                      checked={formData.privacy === option.value}
                      onChange={(e) => handleChange('privacy', e.target.value)}
                      className="mt-1"
                    />
                    <option.icon className={`w-6 h-6 ${option.color}`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Community Settings
              </h3>

              {/* Settings */}
              <div className="space-y-4">
                {/* Join Approval */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Require Approval</p>
                      <p className="text-sm text-gray-500">Users must be approved to join</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.joinApproval}
                    onChange={(e) => handleNestedChange('settings', 'joinApproval', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {/* Invite Only */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Invite Only</p>
                      <p className="text-sm text-gray-500">Only admins can invite members</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.inviteOnly}
                    onChange={(e) => handleNestedChange('settings', 'inviteOnly', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {/* Discovery */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Show in Discovery</p>
                      <p className="text-sm text-gray-500">Allow non-members to find this community</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.settings.discoveryEnabled}
                    onChange={(e) => handleNestedChange('settings', 'discoveryEnabled', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Rules & Moderation */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Community Rules
              </h2>

              {/* Rules */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Community Rules & Guidelines
                </label>
                <textarea
                  value={formData.rules}
                  onChange={(e) => handleChange('rules', e.target.value)}
                  placeholder="Define the rules and guidelines for your community..."
                  rows={6}
                  maxLength={2000}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-end">
                  <span className={`text-xs ${formData.rules.length > 1800 ? 'text-red-500' : 'text-gray-500'}`}>
                    {formData.rules.length}/2000
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Moderation Settings
              </h3>

              {/* Moderation Settings */}
              <div className="space-y-4">
                {/* Content Approval */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Content Approval</p>
                      <p className="text-sm text-gray-500">Posts require approval before going live</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.moderation.contentApproval}
                    onChange={(e) => handleNestedChange('moderation', 'contentApproval', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {/* Slow Mode */}
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Slow Mode</p>
                      <p className="text-sm text-gray-500">Limit message frequency in chat</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.moderation.slowMode}
                    onChange={(e) => handleNestedChange('moderation', 'slowMode', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {formData.moderation.slowMode && (
                  <div className="px-4 pt-2 pb-4 bg-gray-50 dark:bg-gray-700 rounded-xl -mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Slow Mode Delay (seconds)
                    </label>
                    <select
                      value={formData.moderation.slowModeDelay}
                      onChange={(e) => handleNestedChange('moderation', 'slowModeDelay', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white"
                    >
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                  Summary
                </h4>
                <div className="space-y-1 text-sm text-indigo-700 dark:text-indigo-400">
                  <p><strong>Name:</strong> {formData.name}</p>
                  <p><strong>Privacy:</strong> {formData.privacy.charAt(0).toUpperCase() + formData.privacy.slice(1)}</p>
                  <p><strong>Tags:</strong> {formData.tags.length > 0 ? formData.tags.join(', ') : 'None'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Community'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCommunityScreen;
