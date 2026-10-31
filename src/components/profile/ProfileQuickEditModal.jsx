/**
 * Quick inline edit modal for Profile screens (Display Name, Bio, Tagline, Website).
 * Adheres strictly to PROFILE_CONSTRAINTS in profileContracts.js.
 * 
 * @component
 */

import React, { memo, useState, useEffect } from 'react';
import { X, User, Edit3, Globe, AlignLeft, Sparkles, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';
import { PROFILE_CONSTRAINTS, isValidWebUrl } from '../../config/profileContracts.js';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';

export const ProfileQuickEditModal = memo(({
  isOpen,
  onClose,
  initialField = 'all', // 'displayName' | 'bio' | 'website' | 'all'
  profile = {},
  userId,
  theme = 'light',
  onProfileUpdated
}) => {
  const isDark = theme === 'dark';

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [tagline, setTagline] = useState(profile?.tagline || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.displayName || '');
      setBio(profile?.bio || '');
      setTagline(profile?.tagline || '');
      setWebsite(profile?.website || '');
      setErrors({});
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      newErrors.displayName = 'Display Name is required';
    } else if (trimmedName.length > PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
      newErrors.displayName = `Max ${PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters`;
    }

    if (bio && bio.length > PROFILE_CONSTRAINTS.BIO.MAX_LENGTH) {
      newErrors.bio = `Bio cannot exceed ${PROFILE_CONSTRAINTS.BIO.MAX_LENGTH} characters`;
    }

    if (tagline && tagline.length > PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH) {
      newErrors.tagline = `Tagline cannot exceed ${PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH} characters`;
    }

    if (website && website.trim()) {
      const trimmedUrl = website.trim();
      const withProto = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') ? trimmedUrl : `https://${trimmedUrl}`;
      if (!isValidWebUrl(withProto)) {
        newErrors.website = 'Please enter a valid website URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!validate() || isSaving) return;

    setIsSaving(true);
    const toastId = toast.loading('Saving profile changes...');

    try {
      const userService = getUserService();
      let cleanWebsite = website.trim();
      if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
        cleanWebsite = `https://${cleanWebsite}`;
      }

      const updates = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        tagline: tagline.trim(),
        website: cleanWebsite,
      };

      await userService.updateUserProfile(userId, updates);

      // Refresh stores
      useProfileStore.getState().loadProfile(userId, userId);
      const appStoreUser = useAppStore.getState().currentUser;
      if (appStoreUser && (appStoreUser.id === userId || appStoreUser.uid === userId)) {
        useAppStore.getState().setCurrentUser({
          ...appStoreUser,
          displayName: updates.displayName,
          bio: updates.bio,
          tagline: updates.tagline,
          website: updates.website,
        });
      }

      toast.success('🎉 Profile updated successfully!', { id: toastId });
      onProfileUpdated?.(updates);
      onClose();
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(err?.message || 'Failed to update profile', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={cn(
          "relative w-full max-w-lg rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
          isDark 
            ? "bg-[#0b1021] border-white/10 text-white" 
            : "bg-white border-slate-200 text-slate-900"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between shrink-0",
          isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {initialField === 'bio' ? 'Edit Bio' : initialField === 'displayName' ? 'Edit Display Name' : 'Edit Profile Details'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your public profile identity
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Display Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-500" />
                <span>Display Name</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {displayName.length}/{PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
              </span>
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
              placeholder="Your full or display name"
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition",
                errors.displayName ? "border-rose-500" : (isDark ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" : "bg-white border-slate-200 text-slate-900 focus:border-purple-600")
              )}
            />
            {errors.displayName && (
              <p className="text-[11px] text-rose-500">{errors.displayName}</p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-purple-500" />
                <span>Bio</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {bio.length}/{PROFILE_CONSTRAINTS.BIO.MAX_LENGTH}
              </span>
            </div>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, PROFILE_CONSTRAINTS.BIO.MAX_LENGTH))}
              placeholder="Tell the community about yourself, your creative passions, or what you build..."
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition resize-none",
                errors.bio ? "border-rose-500" : (isDark ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" : "bg-white border-slate-200 text-slate-900 focus:border-purple-600")
              )}
            />
            {errors.bio && (
              <p className="text-[11px] text-rose-500">{errors.bio}</p>
            )}
          </div>

          {/* Tagline / Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Tagline / Status</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {tagline.length}/{PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH}
              </span>
            </div>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH))}
              placeholder="e.g. Building audio synths & exploring Web3"
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition",
                errors.tagline ? "border-rose-500" : (isDark ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" : "bg-white border-slate-200 text-slate-900 focus:border-purple-600")
              )}
            />
          </div>

          {/* Website Link */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-500" />
                <span>Website / Link</span>
              </label>
            </div>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. yourwebsite.com or https://..."
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition",
                errors.website ? "border-rose-500" : (isDark ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" : "bg-white border-slate-200 text-slate-900 focus:border-purple-600")
              )}
            />
            {errors.website && (
              <p className="text-[11px] text-rose-500">{errors.website}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer",
                isDark 
                  ? "border-white/10 hover:bg-white/5 text-slate-300" 
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              )}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ProfileQuickEditModal.displayName = 'ProfileQuickEditModal';
export default ProfileQuickEditModal;
