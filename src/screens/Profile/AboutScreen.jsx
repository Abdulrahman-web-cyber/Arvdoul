/**
 * src/screens/Profile/AboutScreen.jsx - ARVDOUL About Screen
 * 
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
import { ArrowLeft, Edit3, Shield, Award, Sparkles, MapPin, Globe, Calendar, Link as LinkIcon } from 'lucide-react';
import ProfileAbout from '../../components/profile/ProfileAbout';
import { getStoredUid, getStoredUser } from '../../utils/security';
import { getLevelInfo, getRankTitle, getPerksForLevel } from '../../services/levelSystemService';

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
  const { profile: storeProfile, loadProfile, loading } = useProfileStore();

  const currentUserId = authUser?.uid || storeUser?.uid || getStoredUid();
  const targetId = userId || currentUserId;
  const isActualOwner = Boolean(currentUserId && targetId && currentUserId === targetId);

  useEffect(() => {
    if (targetId && (!storeProfile || (storeProfile.id !== targetId && storeProfile.uid !== targetId))) {
      loadProfile(targetId, currentUserId);
    }
  }, [targetId, currentUserId, storeProfile, loadProfile]);

  const effectiveProfile = useMemo(() => {
    const base = (isActualOwner ? (storeProfile || storeUser || authUser || getStoredUser()) : storeProfile) || {};
    return {
      ...base,
      id: base.id || base.uid || targetId,
      uid: base.uid || base.id || targetId,
      displayName: base.displayName || base.name || 'Arvdoul Citizen',
      username: base.username || (isActualOwner ? authUser?.email?.split('@')[0] : 'citizen'),
      bio: base.bio || '',
      location: base.location || '',
      website: base.website || '',
      level: Number(base.level || 1),
    };
  }, [storeProfile, storeUser, authUser, targetId, isActualOwner]);

  const levelInfo = useMemo(() => {
    try {
      return getLevelInfo(Number(effectiveProfile?.experience || effectiveProfile?.xp || 0));
    } catch {
      return { level: effectiveProfile?.level || 1, title: 'Citizen' };
    }
  }, [effectiveProfile]);

  const rankTitle = useMemo(() => {
    try {
      return getRankTitle(effectiveProfile?.level || 1);
    } catch {
      return 'Citizen';
    }
  }, [effectiveProfile?.level]);

  const perks = useMemo(() => {
    try {
      return getPerksForLevel(effectiveProfile?.level || 1) || [];
    } catch {
      return [];
    }
  }, [effectiveProfile?.level]);

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
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20 backdrop-blur-xl border-b transition-colors',
        isDark
          ? 'bg-[#060816]/90 border-slate-800'
          : 'bg-white/90 border-slate-200 shadow-sm'
      )}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                isDark ? 'bg-[#0d1424] border-slate-800 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
              )}
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              About Profile
            </h1>
          </div>

          {isActualOwner && (
            <button
              onClick={handleEdit}
              className={cn(
                'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm',
                'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Profile Card & Info */}
        <ProfileAbout
          profile={effectiveProfile}
          isOwner={isActualOwner}
          onEdit={handleEdit}
          theme={theme}
        />

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
                  Rank: <span className="font-semibold text-purple-500">{rankTitle}</span> · Level {effectiveProfile.level}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/progression')}
              className="text-xs font-bold text-indigo-500 hover:underline"
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
