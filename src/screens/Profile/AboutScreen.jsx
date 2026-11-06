/**
 * Displays comprehensive profile details, citizenship standing, level perks,
 * social links, bio, and identity verification.
 * 
 * @component
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import { cn } from '../../lib/utils';
import { ArrowLeft, Edit3, Shield, Award, Sparkles, MapPin, Globe, Calendar, Link as LinkIcon, Briefcase, Mail, HeartHandshake, Palette } from 'lucide-react';
import ProfileAbout from '../../components/profile/ProfileAbout';
import { getStoredUid, getStoredUser } from '../../utils/security';
import { getRankTitle, getPerksForLevel } from '../../services/levelSystemService';
import { resolveCapabilities } from '../../services/profileCapabilityEngine.js';
import {
  pickHandle,
  deriveHandle,
  pickDisplayName,
  resolveLevelValue,
  projectProfileForViewer,
} from '../../services/profileReadModel.js';

/**
 * AboutScreen Component
 */
export default function AboutScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { user: authUser } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const { profile: storeProfile, loadProfile } = useProfileStore();

  const currentUserId = authUser?.uid || storeUser?.uid || getStoredUid();
  const targetId = userId || currentUserId;
  const isActualOwner = Boolean(currentUserId && targetId && currentUserId === targetId);

  useEffect(() => {
    if (targetId && (!storeProfile || (storeProfile.id !== targetId && storeProfile.uid !== targetId))) {
      loadProfile(targetId, currentUserId);
    }
  }, [targetId, currentUserId, storeProfile, loadProfile]);

  const effectiveProfile = useMemo(() => {
    const base = (isActualOwner ? (storeProfile || authUser || storeUser || getStoredUser()) : storeProfile) || {};
    const fallbackHandle = isActualOwner ? deriveHandle(authUser?.email) : null;
    return {
      ...base,
      id: base.id || base.uid || targetId,
      uid: base.uid || base.id || targetId,
      displayName: pickDisplayName([base.displayName, base.name], { fallback: 'Arvdoul Citizen' }),
      username: pickHandle([base.username]) || fallbackHandle || 'citizen',
      bio: base.bio || '',
      location: base.location || '',
      website: base.website || '',
      level: resolveLevelValue(base.level),
    };
  }, [storeProfile, storeUser, authUser, targetId, isActualOwner]);

  // The About screen renders the descriptive identity card (bio/location/website/
  // links), so it must honour the `profileInfo` scope. It resolves the capability
  // decision and applies the single projection — it does not re-derive privacy.
  const capabilities = useMemo(() => resolveCapabilities({
    viewer: currentUserId ? { uid: currentUserId } : null,
    target: effectiveProfile,
    relationship: { isOwner: isActualOwner },
  }), [currentUserId, effectiveProfile, isActualOwner]);

  const displayedProfile = useMemo(
    () => projectProfileForViewer(effectiveProfile, capabilities, { isOwner: isActualOwner }),
    [effectiveProfile, capabilities, isActualOwner]
  );

  const rankTitle = useMemo(() => {
    if (displayedProfile?.level == null) return null;
    try {
      return getRankTitle(displayedProfile.level);
    } catch {
      return null;
    }
  }, [displayedProfile?.level]);

  const perks = useMemo(() => {
    if (displayedProfile?.level == null) return [];
    try {
      return getPerksForLevel(displayedProfile.level) || [];
    } catch {
      return [];
    }
  }, [displayedProfile?.level]);

  const handleEdit = () => {
    navigate('/profile/edit');
  };

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark
        ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a] text-white'
        : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8] text-slate-900'
    )}>
      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 sm:py-5 space-y-4">
        {isActualOwner && (
          <div className="flex justify-end">
            <button
              onClick={handleEdit}
              className={cn(
                'px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer',
                'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-110 active:scale-95'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile Details</span>
            </button>
          </div>
        )}
        {/* Profile Card & Info — projected, so a narrowed profileInfo scope hides the card */}
        <ProfileAbout
          profile={displayedProfile}
          isOwner={isActualOwner}
          onEdit={handleEdit}
          theme={theme}
        />

        {/* Creator Suite — gated by the `creatorInfo` scope (was a dead control:
            the fields were saved and validated but rendered nowhere, and the
            business contact was world-readable in users/{uid}). The projection
            blanks the fields, so this only renders when the scope allows them. */}
        {displayedProfile?.canViewCreatorInfo === true && (displayedProfile?.creatorCategory || displayedProfile?.inquiriesEmail || displayedProfile?.tipMessage) && (
          <div className={cn(
            'p-5 rounded-2xl border space-y-4 shadow-sm',
            isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-white border-slate-200'
          )}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Creator Suite</h3>
            </div>
            <div className="space-y-2.5">
              {displayedProfile?.creatorCategory && (
                <div className="flex items-center gap-3 text-sm">
                  <Palette className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Discipline:</span>
                  <span className="text-slate-900 dark:text-white font-medium">{displayedProfile.creatorCategory}</span>
                </div>
              )}
              {displayedProfile?.inquiriesEmail && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Business contact:</span>
                  <a href={`mailto:${displayedProfile.inquiriesEmail}`} className="text-indigo-500 hover:underline truncate">
                    {displayedProfile.inquiriesEmail}
                  </a>
                </div>
              )}
              {displayedProfile?.tipMessage && (
                <div className="flex items-start gap-3 text-sm">
                  <HeartHandshake className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-300 italic">{displayedProfile.tipMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Citizenship & Standing Strip */}
        <div className={cn(
          "p-5 rounded-2xl border space-y-4 shadow-sm transition-all",
          isDark ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Citizen Standing & Privileges
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {displayedProfile?.level != null ? (
                    <>Rank: <span className="font-semibold text-purple-500">{rankTitle || '—'}</span> · Level {displayedProfile.level}</>
                  ) : (
                    <span>Standing unavailable</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/progress')}
              className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer"
            >
              View System
            </button>
          </div>

          {perks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
              {perks.slice(0, 4).map((perk, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="text-sm mt-0.5">{perk.icon || '⚡'}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">{perk.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{perk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
