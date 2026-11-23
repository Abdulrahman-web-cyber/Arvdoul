/**
 * Quick inline edit modal for Profile screens (Display Name, Bio, Tagline, Website).
 * Adheres strictly to PROFILE_CONSTRAINTS in profileContracts.js.
 * 
 * @component
 */

import { memo, useState, useEffect, useRef } from "react";
import { X, User, Edit3, Globe, AlignLeft, Sparkles, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';
import { PROFILE_CONSTRAINTS, isValidWebUrl } from '../../config/profileContracts.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
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

  const displayNameRef = useRef(null);
  const bioRef = useRef(null);
  const websiteRef = useRef(null);
  const initialFieldRef = useRef(initialField);
  initialFieldRef.current = initialField;

  // Keyed on `isOpen` and the target id — never the whole profile object. A
  // realtime snapshot replaces the object identity mid-edit, and an effect
  // keyed on `profile` would then wipe the user's in-progress typing
  // (AGENTS.md convention).
  const profileId = profile?.uid || profile?.id || userId || null;
  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.displayName || '');
      setBio(profile?.bio || '');
      setTagline(profile?.tagline || '');
      setWebsite(profile?.website || '');
      setErrors({});
      const targetField = initialFieldRef.current;
      const timer = setTimeout(() => {
        if (targetField === 'bio') bioRef.current?.focus();
        else if (targetField === 'website') websiteRef.current?.focus();
        else if (targetField === 'displayName') displayNameRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, profileId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const singleField =
    initialField === 'bio' || initialField === 'displayName' || initialField === 'website'
      ? initialField
      : null;
  const showDisplayName = !singleField || singleField === 'displayName';
  const showBio = !singleField || singleField === 'bio';
  const showTagline = !singleField;
  const showWebsite = !singleField || singleField === 'website';

  const validate = () => {
    const newErrors = {};
    if (showDisplayName) {
      const trimmedName = displayName.trim();
      if (!trimmedName) {
        newErrors.displayName = 'Display Name is required';
      } else if (trimmedName.length > PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
        newErrors.displayName = `Max ${PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters`;
      }
    }

    if (showBio && bio && bio.length > PROFILE_CONSTRAINTS.BIO.MAX_LENGTH) {
      newErrors.bio = `Bio cannot exceed ${PROFILE_CONSTRAINTS.BIO.MAX_LENGTH} characters`;
    }

    if (showTagline && tagline && tagline.length > PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH) {
      newErrors.tagline = `Tagline cannot exceed ${PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH} characters`;
    }

    if (showWebsite && website && website.trim()) {
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
    const toastId = toast.loading(singleField === 'bio' ? 'Saving bio...' : 'Saving profile changes...');

    try {
      const userService = getUserService();
      const updates = {};
      if (showDisplayName) updates.displayName = displayName.trim();
      if (showBio) updates.bio = bio.trim();
      if (showTagline) updates.tagline = tagline.trim();
      if (showWebsite) {
        let cleanWebsite = website.trim();
        if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
          cleanWebsite = `https://${cleanWebsite}`;
        }
        updates.website = cleanWebsite;
      }

      await userService.updateUserProfile(userId, updates);

      // Refresh stores immediately
      useProfileStore.setState((state) => {
        if (state.profile && (state.profile.uid === userId || state.profile.id === userId)) {
          return { profile: { ...state.profile, ...updates } };
        }
        return state;
      });
      useProfileStore.getState().loadProfile(userId, userId);
      const appStoreUser = useAppStore.getState().currentUser;
      if (appStoreUser && (appStoreUser.id === userId || appStoreUser.uid === userId)) {
        useAppStore.getState().setCurrentUser({
          ...appStoreUser,
          ...updates,
        });
      }

      toast.success(singleField === 'bio' ? 'Bio updated' : 'Profile updated successfully', { id: toastId });
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => !isSaving && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialField === 'bio' ? 'Edit Bio' : initialField === 'displayName' ? 'Edit Display Name' : initialField === 'website' ? 'Edit Website' : 'Edit Profile Details'}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-lg rounded-2xl sm:rounded-3xl border overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-2xl",
          isDark
            ? "bg-[#0B1234]/70 border-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_42px_-18px_rgba(0,0,0,0.62)]"
            : "bg-white/95 border-slate-200/80 text-slate-900 shadow-2xl"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between shrink-0",
          isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {initialField === 'bio' ? 'Edit Bio' : initialField === 'displayName' ? 'Edit Display Name' : initialField === 'website' ? 'Edit Website' : 'Edit Profile Details'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {singleField === 'bio' ? 'Tell people who you are on Arvdoul' : 'Update your public profile identity'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Display Name */}
          {showDisplayName && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-arvdoul-purple" />
                  <span>Display Name</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {displayName.length}/{PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                </span>
              </div>
              <input
                ref={displayNameRef}
                aria-label="Display Name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH}
                placeholder="Your full or display name"
                className={cn(
                  "w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm border outline-none transition focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  errors.displayName ? "border-rose-500" : (isDark ? "bg-[#0B1234]/45 border-white/[0.10] text-white focus:border-arvdoul-purple" : "bg-white border-slate-200 text-slate-900 focus:border-arvdoul-purple")
                )}
              />
              {errors.displayName && (
                <p className="text-[11px] text-rose-500">{errors.displayName}</p>
              )}
            </div>
          )}

          {/* Bio */}
          {showBio && (
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
                ref={bioRef}
                aria-label="Bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, PROFILE_CONSTRAINTS.BIO.MAX_LENGTH))}
                placeholder="Tell the community about yourself, your creative passions, or what you build..."
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition resize-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  errors.bio ? "border-rose-500" : (isDark ? "bg-[#0B1234]/45 border-white/[0.10] text-white focus:border-arvdoul-purple" : "bg-white border-slate-200 text-slate-900 focus:border-arvdoul-purple")
                )}
              />
              {errors.bio && (
                <p className="text-[11px] text-rose-500">{errors.bio}</p>
              )}
            </div>
          )}

          {/* Tagline / Subtitle */}
          {showTagline && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-arvdoul-purple" />
                  <span>Tagline / Status</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {tagline.length}/{PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH}
                </span>
              </div>
              <input aria-label="Tagline / Status"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH))}
                placeholder="e.g. Building audio synths & exploring Web3"
                className={cn(
                  "w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm border outline-none transition focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  errors.tagline ? "border-rose-500" : (isDark ? "bg-[#0B1234]/45 border-white/[0.10] text-white focus:border-arvdoul-purple" : "bg-white border-slate-200 text-slate-900 focus:border-arvdoul-purple")
                )}
              />
            </div>
          )}

          {/* Website Link */}
          {showWebsite && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-arvdoul-purple" />
                  <span>Website / Link</span>
                </label>
              </div>
              <input
                ref={websiteRef}
                aria-label="Website / Link"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. yourwebsite.com or https://..."
                className={cn(
                  "w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm border outline-none transition focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  errors.website ? "border-rose-500" : (isDark ? "bg-[#0B1234]/45 border-white/[0.10] text-white focus:border-arvdoul-purple" : "bg-white border-slate-200 text-slate-900 focus:border-arvdoul-purple")
                )}
              />
              {errors.website && (
                <p className="text-[11px] text-rose-500">{errors.website}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                "flex-1 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                isDark 
                  ? "border-white/[0.10] hover:bg-white/[0.06] text-slate-300" 
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              )}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              style={{ background: BRAND_GRADIENT }}
              className="flex-1 py-2.5 min-h-[44px] rounded-xl hover:opacity-95 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
