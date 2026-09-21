// src/components/profile/ProfileHeroSection.jsx

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BadgeCheck, 
  MapPin, 
  Globe, 
  Calendar, 
  Sparkles, 
  Star, 
  Award, 
  ShieldCheck, 
  Crown,
  ChevronRight,
  TrendingUp,
  ArrowLeft,
  Bell,
  Send,
  MoreHorizontal,
  QrCode,
  ScanLine,
  User,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLevelInfo, getRankTitle, getCitizenTier, getIdentityBadge, LEVEL_GATES } from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenQrScanner,
  onOpenLocationSetup,
  onOpenNotifications,
  onOpenMessages,
  onOpenOptions,
  onAvatarClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Compute real level & progression from levelSystemService
  const userExperience = profile?.experience ?? profile?.xp ?? (profile?.level ? 50 * profile.level * (profile.level - 1) : 0);
  const levelInfo = useMemo(() => {
    return getLevelInfo(userExperience);
  }, [userExperience]);

  const effectiveLevel = level || profile?.level || levelInfo.level || 1;
  const rankTitle = useMemo(() => getRankTitle(effectiveLevel), [effectiveLevel]);
  const citizenStanding = useMemo(() => getCitizenTier(effectiveLevel, profile?.activeDaysCount || 1), [effectiveLevel, profile?.activeDaysCount]);
  const identityBadge = useMemo(
    () => getIdentityBadge(effectiveLevel, {
      isCreator: Boolean(profile?.isCreator),
      activeDaysCount: profile?.activeDaysCount || 0,
    }),
    [effectiveLevel, profile?.isCreator, profile?.activeDaysCount]
  );

  // Safe avatar and display strings with actual identity resolution
  const displayName = (profile?.displayName && profile?.displayName !== 'User' && profile?.displayName !== 'Creator')
    ? profile.displayName
    : (profile?.name && profile?.name !== 'User' && profile?.name !== 'Creator')
      ? profile.name
      : (isOwner ? 'Member' : 'Creator');

  // Derive genuine unique username without showing raw uid or placeholder 'user'
  const username = useMemo(() => {
    const rawUser = profile?.username;
    if (rawUser && !rawUser.startsWith('user_') && rawUser !== 'user' && rawUser !== 'creator') {
      return rawUser;
    }
    const base = (profile?.displayName || profile?.name || profile?.email?.split('@')[0] || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 16);
    if (base && base !== 'user' && base !== 'creator') {
      return base;
    }
    return (rawUser && !rawUser.startsWith('user_')) ? rawUser : (isOwner ? 'arvdoul_member' : 'creator');
  }, [profile?.username, profile?.displayName, profile?.name, profile?.email, isOwner]);

  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid);
  const bio = profile?.bio?.trim() || '';
  const location = profile?.location || profile?.city || '';
  const website = profile?.website || profile?.link || '';
  
  // Format joined date
  const joinedDate = useMemo(() => {
    if (profile?.createdAt) {
      try {
        const date = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
        return `Joined ${date.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
      } catch (e) {
        return '';
      }
    }
    return '';
  }, [profile?.createdAt]);

  return (
    <div className="w-full space-y-4">
      {/* 1. Sub-App Top Bar (Integrated within Profile Canvas) */}
      <div className="flex items-center justify-between py-1">
        {/* Left item */}
        {isOwner ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                isDark
                  ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              )}
              title="Account Settings"
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[120px]">@{username}</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onBack || (() => navigate(-1))}
            className={cn(
              "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
              isDark
                ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            )}
            aria-label="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right action icons */}
        <div className="flex items-center gap-2">
          {isOwner ? (
            <>
              <button
                onClick={onOpenQrCode}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="View QR Code"
                title="Profile QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenQrScanner}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="Scan QR Code"
                title="Scan Another User's QR Code"
              >
                <ScanLine className="w-4 h-4 text-purple-500" />
              </button>

              <button
                onClick={onOpenNotifications || (() => navigate('/notifications'))}
                className={cn(
                  "relative p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0b1220]" />
              </button>

              <button
                onClick={onOpenOptions}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="More Options"
                title="Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenNotifications || (() => navigate('/notifications'))}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenMessages || (() => navigate(`/messages/new?to=${profile?.id || profile?.uid}`))}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="Direct Message"
                title="Direct Message"
              >
                <Send className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenOptions}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all flex items-center justify-center",
                  isDark
                    ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                )}
                aria-label="More Options"
                title="Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Hero Card (Matching uploaded designs) */}
      <div className={cn(
        "relative rounded-3xl p-5 sm:p-6 lg:p-7 border backdrop-blur-xl transition-all shadow-sm",
        isDark 
          ? "bg-[#0d1424]/80 border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.36)]" 
          : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
      )}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Identity Left / Center Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full lg:w-auto">
            
            {/* Avatar with Vibrant Gradient Ring & Sparkle */}
            <div className="relative shrink-0">
              <div 
                onClick={onAvatarClick}
                className="relative p-[3.5px] rounded-full bg-gradient-to-tr from-purple-600 via-blue-500 to-cyan-400 shadow-lg shadow-purple-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-slate-900 ring-2 ring-white dark:ring-[#0d1424]">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Sparkle badge at top-right */}
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 flex items-center justify-center shadow-md shadow-amber-500/30 text-black">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
              </div>

              {/* Online status indicator at bottom-right */}
              {profile?.presence?.isOnline && (
                <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0d1424] shadow-sm" title="Online" />
              )}
            </div>

            {/* Names & Bio details */}
            <div className="space-y-2 flex-1 min-w-0">
              {/* Display Name + Verified Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {displayName}
                </h1>
                {Boolean(profile?.isVerified || profile?.verified) && (
                  <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/10 shrink-0" aria-label="Verified" />
                )}
              </div>

              {/* Username */}
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                @{username}
              </p>

              {/* Badges Chips */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {Boolean(profile?.isVerified || profile?.verified) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                )}

                {identityBadge.kind === 'creator' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Star className="w-3 h-3 fill-amber-500/30" />
                    <span>{identityBadge.label}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Award className="w-3 h-3" />
                    <span>{identityBadge.label}</span>
                  </span>
                )}

                {Boolean(profile?.isPremium || profile?.vip) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Crown className="w-3 h-3" />
                    <span>Premium</span>
                  </span>
                )}
              </div>

              {/* Bio */}
              {bio ? (
                <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl line-clamp-2 sm:line-clamp-3">
                  {bio}
                </p>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => navigate('/profile/edit')}
                  className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                >
                  <span>+ Add a bio</span>
                </button>
              ) : null}

              {/* Meta Info: Location, Website, Joined Date */}
              <div className="flex items-center gap-4 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-1">
                {location ? (
                  <button
                    type="button"
                    onClick={isOwner ? onOpenLocationSetup : undefined}
                    className={cn(
                      "flex items-center gap-1 transition-colors text-left",
                      isOwner ? "hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer group" : "cursor-default"
                    )}
                    title={isOwner ? "Tap to change location" : "User location"}
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    <span>{location}</span>
                    {isOwner && (
                      <span className="text-[10px] text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        (edit)
                      </span>
                    )}
                  </button>
                ) : isOwner ? (
                  <button
                    type="button"
                    onClick={onOpenLocationSetup}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 font-semibold transition-all cursor-pointer"
                    title="Set Up Your Location"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>+ Set Location</span>
                  </button>
                ) : null}
                {website && (
                  <a
                    href={`https://${website.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {joinedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{joinedDate}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Level & Experience Card */}
          <div className={cn(
            "w-full lg:w-72 p-4 rounded-2xl border transition-all shrink-0",
            isDark
              ? "bg-[#131b2e]/90 border-white/10"
              : "bg-slate-50/90 border-slate-200/80"
          )}>
            <div className="flex items-center justify-between mb-2.5">
              {/* Hexagonal Level Badge */}
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-md shadow-purple-500/20">
                  {effectiveLevel}
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">
                    Level {effectiveLevel}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {rankTitle}
                  </div>
                </div>
              </div>

              {/* Rank Position Pill */}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {position?.title || (position?.position ? `#${position.position} Rank` : (profile?.profilePosition || 'Citizen'))}
              </span>
            </div>

            {/* XP Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500 dark:text-slate-400">XP Progress</span>
                <span className="text-purple-600 dark:text-purple-400">
                  {Number(levelInfo?.currentLevelXp ?? (userExperience % 1000)).toLocaleString()} / {Number(levelInfo?.nextLevelXp ?? 1000).toLocaleString()} XP
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round((levelInfo?.progress || 0) * 100)))}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
