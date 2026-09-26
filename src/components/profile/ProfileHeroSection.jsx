/**
 * src/components/profile/ProfileHeroSection.jsx - ARVDOUL Master Profile Identity
 * 
 * Production-grade, zero-cover-photo digital nation identity header.
 * High contrast, razor-sharp typography, zero muddy blur, clean interactive controls.
 * Eliminates duplicate action rows and button clutter.
 * 
 * @component
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BadgeCheck, 
  MapPin, 
  Globe, 
  Calendar, 
  Crown,
  ArrowLeft,
  MoreHorizontal,
  QrCode,
  Share2,
  Edit3,
  MessageCircle,
  Coins,
  Settings,
  UserCheck,
  UserPlus,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

const getLevelInfo = LevelModule.getLevelInfo || LevelModule.levelSystemService?.getLevelInfo || (() => ({ level: 1, title: 'Citizen', progress: 0 }));
const getRankTitle = LevelModule.getRankTitle || (() => 'Citizen');
const getCitizenTier = LevelModule.getCitizenTier || (() => ({ tier: 'Citizen' }));
const LEVELS = LevelModule.LEVELS || [];

const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenQrScanner,
  onOpenOptions,
  onAvatarClick,
  onShare,
  onEditProfile,
  isFollowing = false,
  followLoading = false,
  onFollowToggle,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onOpenTipModal,
  onOpenMessages,
  onInsightsPress,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Compute real level & progression from levelSystemService
  const userExperience = useMemo(() => {
    if (profile?.experience !== undefined && profile?.experience !== null) {
      return Number(profile.experience) || 0;
    }
    if (profile?.xp !== undefined && profile?.xp !== null) {
      return Number(profile.xp) || 0;
    }
    if (profile?.level && Array.isArray(LEVELS)) {
      const idx = Math.max(0, Math.min(Number(profile.level) - 1, LEVELS.length - 1));
      return LEVELS[idx]?.minXp || 0;
    }
    return 0;
  }, [profile?.experience, profile?.xp, profile?.level]);

  const levelInfo = useMemo(() => {
    try {
      const res = getLevelInfo(userExperience);
      // Guard against mock returning Promise in tests
      if (res && typeof res.then === 'function') {
        return { level: 1, title: 'Citizen', progress: 0 };
      }
      return res || { level: 1, title: 'Citizen', progress: 0 };
    } catch {
      return { level: 1, title: 'Citizen', progress: 0 };
    }
  }, [userExperience]);

  const effectiveLevel = Number(level || profile?.level || levelInfo?.level) || 1;
  const rankTitle = useMemo(() => {
    try {
      return getRankTitle(effectiveLevel);
    } catch {
      return 'Citizen';
    }
  }, [effectiveLevel]);

  const citizenStanding = useMemo(() => {
    try {
      return getCitizenTier(effectiveLevel, Number(profile?.activeDaysCount) || 1);
    } catch {
      return { tier: 'Citizen' };
    }
  }, [effectiveLevel, profile?.activeDaysCount]);

  // Safe display strings with actual identity resolution
  const displayName = useMemo(() => {
    const raw = profile?.displayName || profile?.name;
    if (typeof raw === 'string' && raw.trim() && raw.trim() !== 'User' && raw.trim() !== 'Creator') {
      return raw.trim();
    }
    return isOwner ? 'Arvdoul Citizen' : 'Creator';
  }, [profile?.displayName, profile?.name, isOwner]);

  // Derive genuine unique username without showing raw uid or placeholder 'user'
  const username = useMemo(() => {
    try {
      const rawUser = profile?.username;
      if (typeof rawUser === 'string' && rawUser.trim() && !rawUser.startsWith('user_') && rawUser !== 'user' && rawUser !== 'creator') {
        return rawUser.trim();
      }
      const rawEmail = typeof profile?.email === 'string' ? profile.email : '';
      const rawName = typeof profile?.displayName === 'string' ? profile.displayName : (typeof profile?.name === 'string' ? profile.name : '');
      const base = (rawName || rawEmail.split('@')[0] || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 16);
      if (base && base !== 'user' && base !== 'creator') {
        return base;
      }
      return (typeof rawUser === 'string' && !rawUser.startsWith('user_')) ? rawUser : (isOwner ? 'citizen' : 'creator');
    } catch {
      return isOwner ? 'citizen' : 'creator';
    }
  }, [profile?.username, profile?.displayName, profile?.name, profile?.email, isOwner]);

  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid);
  const bio = typeof profile?.bio === 'string' ? profile.bio.trim() : '';
  const location = typeof profile?.location === 'string' ? profile.location : (typeof profile?.city === 'string' ? profile.city : '');
  const website = typeof profile?.website === 'string' ? profile.website : (typeof profile?.link === 'string' ? profile.link : '');
  
  // Format joined date
  const joinedDate = useMemo(() => {
    if (profile?.createdAt) {
      try {
        const date = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
        if (date && !isNaN(date.getTime())) {
          return `Joined ${date.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
        }
      } catch (e) {
        return '';
      }
    }
    return '';
  }, [profile?.createdAt]);

  const profileUid = profile?.id || profile?.uid;

  return (
    <div className="w-full space-y-3">
      {/* 1. Sleek Navigation Header */}
      <div className="flex items-center justify-between px-1 py-1">
        {/* Left: Back (if visitor) or Clean Citizen tag (if owner) */}
        {!isOwner ? (
          <button
            onClick={onBack || (() => navigate(-1))}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer",
              isDark
                ? "bg-[#0B0F19] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            )}
            aria-label="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-mono font-medium tracking-wide",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              @{username}
            </span>
          </div>
        )}

        {/* Right: Quick actions for top bar */}
        <div className="flex items-center gap-1.5">
          {onOpenQrCode && (
            <button
              onClick={onOpenQrCode}
              className={cn(
                "p-2 rounded-xl border transition-all cursor-pointer",
                isDark
                  ? "bg-[#0B0F19] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              )}
              title="Identity QR Code"
              aria-label="View QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className={cn(
                "p-2 rounded-xl border transition-all cursor-pointer",
                isDark
                  ? "bg-[#0B0F19] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              )}
              title="Share Profile"
              aria-label="Share Profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {isOwner ? (
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                "p-2 rounded-xl border transition-all cursor-pointer",
                isDark
                  ? "bg-[#0B0F19] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              )}
              title="Account Settings"
              aria-label="Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : (
            onOpenOptions && (
              <button
                onClick={onOpenOptions}
                className={cn(
                  "p-2 rounded-xl border transition-all cursor-pointer",
                  isDark
                    ? "bg-[#0B0F19] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                title="More Options"
                aria-label="More Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Elevated Identity Card (Sharp, Crisp, Zero Cover Photo) */}
      <div className={cn(
        "rounded-2xl p-5 sm:p-7 border transition-all shadow-sm",
        isDark
          ? "bg-[#0B0F19] border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-900"
      )}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
          
          {/* Avatar + Main Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 w-full sm:w-auto">
            
            {/* Avatar 1:1 Circle */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onAvatarClick}
                className="relative block w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2.5px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
                title={isOwner ? "Change profile photo" : "View avatar"}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-2 ring-white dark:ring-[#0B0F19]">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </button>

              {/* Clean Online Indicator */}
              <div 
                className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0B0F19]" 
                title="Active" 
              />
            </div>

            {/* Typography & Identity */}
            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Display Name + Verified Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {displayName}
                </h1>
                {Boolean(profile?.isVerified || profile?.verified) && (
                  <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/10 shrink-0" title="Verified Citizen" />
                )}
              </div>

              {/* Handle & Civic Rank (Unboxed Clean Typography with Separators) */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                <span className="font-mono">@{username}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => navigate(isOwner ? '/titles' : `/passport/${profileUid}`)}
                  className="text-purple-600 dark:text-purple-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>{profile?.primaryTitle || profile?.activeTitle?.name || rankTitle || citizenStanding.tier}</span>
                </button>
                <span aria-hidden="true">·</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  Level {effectiveLevel}
                </span>
              </div>

              {/* Bio */}
              {bio && (
                <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 pt-1 whitespace-pre-line max-w-xl">
                  {bio}
                </p>
              )}

              {/* Metadata row: Location, Website, Joined Date */}
              <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-slate-500 dark:text-slate-400">
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{location}</span>
                  </span>
                )}
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>{website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {joinedDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{joinedDate}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Unified Primary Action Bar (Only One Set of Action Controls) */}
          <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 shrink-0">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={onEditProfile || (() => navigate('/profile/edit'))}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/passport')}
                  className={cn(
                    "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer",
                    isDark
                      ? "bg-slate-900 border-slate-700 text-indigo-400 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 shadow-sm"
                  )}
                  title="View Official Digital Passport"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Passport</span>
                </button>

                <button
                  type="button"
                  onClick={onInsightsPress || (() => navigate('/profile/analytics'))}
                  className={cn(
                    "hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer",
                    isDark
                      ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                  )}
                  title="Creator Analytics Studio"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Studio</span>
                </button>
              </>
            ) : (
              <>
                {friendshipStatus && friendshipStatus !== 'none' ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className={cn(
                      "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer",
                      friendshipStatus === 'friends'
                        ? (isDark ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-slate-100 text-slate-800 border border-slate-200")
                        : (isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-800 border border-amber-200")
                    )}
                  >
                    {friendRequestLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : friendshipStatus === 'friends' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Friends</span>
                      </>
                    ) : friendshipStatus === 'pending' ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Requested</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Accept Friend</span>
                      </>
                    )}
                  </button>
                ) : onFriendRequestToggle && !onFollowToggle ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                  >
                    {friendRequestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Add Friend</span>
                  </button>
                ) : onFollowToggle ? (
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    disabled={followLoading}
                    className={cn(
                      "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer",
                      isFollowing
                        ? (isDark
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200")
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    )}
                  >
                    {followLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onOpenMessages || (() => navigate(`/messages/new?to=${profileUid}`))}
                  className={cn(
                    "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer",
                    isDark
                      ? "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                  )}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>

                {onOpenTipModal && (
                  <button
                    type="button"
                    onClick={onOpenTipModal}
                    className={cn(
                      "p-2 rounded-xl border transition-all text-amber-500 cursor-pointer",
                      isDark
                        ? "bg-slate-900 border-slate-700 hover:bg-slate-800"
                        : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
                    )}
                    title="Send Coin Gift"
                    aria-label="Send Tip"
                  >
                    <Coins className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
