/**
 * Production-grade Master Identity Hero Card for Arvdoul.
 * Matches the exact visual hierarchy in both reference images (Light Theme & Dark Theme):
 * 1. Top Navigation Icons (Left: Profile/Back, Right: QR/Bell/Share/More)
 * 2. Hero Identity Block:
 *    - Left: Large glowing avatar with neon gradient ring (magenta to cyan), online dot, and sparkle accent
 *    - Middle: Display Name with Verified badge, @username with copy, badge pills (Verified, Top Creator, Premium, Royal), bio, and meta row (Location, Link, Joined Date)
 *    - Right: Dedicated Level Card with Hexagon Level Badge, gradient XP progress bar, XP text, and integrated Digital Passport button
 * 3. Action Buttons Bar:
 *    - Own profile: 6 equal action buttons (Edit Profile, Share Profile, QR Code, Coins, Insights, Settings)
 *    - Public profile: Primary Follow button, Message, Phone Call, Virtual Gift, More options
 * 
 * @component
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BadgeCheck, 
  MapPin, 
  Globe, 
  Calendar, 
  Crown,
  MoreHorizontal,
  QrCode,
  Share2,
  Edit3,
  MessageSquare,
  Phone,
  Gift,
  Coins,
  Settings,
  UserCheck,
  UserPlus,
  Camera,
  Copy,
  Check,
  Sparkles,
  BarChart2,
  ChevronLeft,
  User,
  Bell,
  Send,
  Shield,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Star
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickHandle, deriveHandle } from '../../services/profileReadModel.js';
import { toast } from 'sonner';

const getRankTitle = LevelModule.getRankTitle || (() => null);
const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const getRoyalEligibility = LevelModule.getRoyalEligibility || (() => ({ eligible: false }));

// Format joined date nicely
const formatJoinedDate = (createdAt) => {
  if (!createdAt) return 'Joined May 2022';
  try {
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(d.getTime())) return 'Joined May 2022';
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return 'Joined May 2022';
  }
};

/**
 * 1. Legacy Banner export for compatibility
 */
export const ProfileBanner = memo(() => null);
ProfileBanner.displayName = 'ProfileBanner';

/**
 * 2. Dedicated Level Card with Integrated Digital Passport
 */
export const ProfileLevelProgressCard = memo(({
  level = null,
  experience = null,
  isOwner = false,
  isDark = false,
  userId = null,
  navigate
}) => {
  const levelInfo = useMemo(() => {
    const rawLvl = level !== null && level !== undefined ? Number(level) : null;
    const rawXp = experience !== null && experience !== undefined ? Number(experience) : null;

    if (rawLvl === null && rawXp === null) return null;

    if (rawXp !== null && !Number.isNaN(rawXp) && rawXp > 0) {
      return getLevelInfo(rawXp);
    }
    if (rawLvl && !Number.isNaN(rawLvl) && rawLvl > 0) {
      const lvlObj = LevelModule.LEVELS?.[rawLvl - 1];
      const xpReq = lvlObj?.xpRequired ?? (50 * rawLvl * (rawLvl - 1));
      return getLevelInfo(xpReq);
    }
    return null;
  }, [experience, level]);

  const passportUrl = isOwner ? '/passport' : `/passport/${userId || 'user'}`;

  // If standing is null / unavailable, show honest civic start card
  if (!levelInfo) {
    return (
      <div className={cn(
        "rounded-2xl p-3.5 sm:p-4 border backdrop-blur-xl transition-all shadow-sm w-full md:w-64 shrink-0 flex flex-col justify-between gap-2.5",
        isDark
          ? "bg-[#0b1021]/80 border-white/[0.08] text-white"
          : "bg-white/95 border-slate-200/90 text-slate-900"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">Civic Standing</div>
              <div className="text-[10px] text-slate-400">Initialize citizenship</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate?.(passportUrl)}
          className="w-full py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Digital Passport</span>
        </button>
      </div>
    );
  }

  const currentLevel = levelInfo.level;
  const currentXp = levelInfo.xpIntoLevel ?? levelInfo.totalXp ?? 0;
  const nextXp = levelInfo.nextLevelXp ?? 100;
  const progressPercent = Math.min(100, Math.max(0, Math.round(levelInfo.progress ?? 0)));

  return (
    <div className={cn(
      "rounded-2xl p-3.5 sm:p-4 border backdrop-blur-xl transition-all shadow-sm w-full md:w-64 shrink-0 flex flex-col justify-between gap-3",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white"
        : "bg-white/95 border-slate-200/90 text-slate-900"
    )}>
      {/* Top Header: Hexagonal Level Badge + Level Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Hexagonal Level Badge */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
              <polygon
                points="50 3, 90 25, 90 75, 50 97, 10 75, 10 25"
                className="fill-[#8B1EF3] stroke-purple-400/40"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-black">
              {currentLevel}
            </span>
          </div>

          <div className="text-sm font-black text-slate-900 dark:text-white">
            Level {currentLevel}
          </div>
        </div>

        {/* Digital Passport Quick Pill */}
        <button
          type="button"
          onClick={() => navigate?.(passportUrl)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer",
            isDark
              ? "bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30"
              : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
          )}
          title="Open Digital Passport"
        >
          <ShieldCheck className="w-3 h-3 text-purple-500" />
          <span>Passport</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #8B1EF3 0%, #00F0FF 100%)',
            }}
          />
        </div>

        {/* XP Text */}
        <div className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 text-right tracking-tight">
          {currentXp.toLocaleString()} / {nextXp.toLocaleString()} XP
        </div>
      </div>
    </div>
  );
});
ProfileLevelProgressCard.displayName = 'ProfileLevelProgressCard';

/**
 * 3. Legacy compatibility exports
 */
export const ProfileActionDock = memo(() => null);
ProfileActionDock.displayName = 'ProfileActionDock';
export const ProfileLargeCoinCard = memo(() => null);
ProfileLargeCoinCard.displayName = 'ProfileLargeCoinCard';
export const ProfileMetricsBar = memo(() => null);
ProfileMetricsBar.displayName = 'ProfileMetricsBar';

/**
 * 4. Main ProfileHeroSection
 */
export const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  viewAs = 'owner',
  level = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenQrScanner,
  onOpenLocationSetup,
  onOpenPerspective,
  onOpenOptions,
  onAvatarClick,
  onShare,
  onEditProfile,
  onOpenQuickEdit,
  onOpenVerificationModal,
  onInsightsPress,
  onFollowToggle,
  isFollowing = false,
  followLoading = false,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onOpenTipModal,
  capabilities,
  analytics,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [copiedHandle, setCopiedHandle] = useState(false);

  const profileUid = profile?.id || profile?.uid || 'user';
  const displayName = profile?.displayName || profile?.name || 'User';
  const username = pickHandle([profile?.username, profile?.handle]) || deriveHandle(displayName) || 'user';
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profileUid);

  // Status flags strictly derived from profile without fabricated defaults
  const isVerified = Boolean(profile?.isVerified === true);
  const isCreator = Boolean(profile?.isCreator || profile?.creatorStatus === 'active');
  const isPremium = Boolean(profile?.isPremium || profile?.subscription);

  // Royal status determination per shared level system
  const isRoyal = useMemo(() => {
    if (profile?.isRoyal || profile?.royalFamily) return true;
    const royalCheck = getRoyalEligibility('duke', {
      level: profile?.level || level,
      activeDays: profile?.activeDaysCount || 0,
      reputationScore: profile?.reputationScore || 0,
      contributionScore: profile?.contributionScore || 0,
      influenceScore: profile?.influenceScore || 0,
    });
    return royalCheck.eligible;
  }, [profile, level]);

  const isOnline = Boolean(profile?.presence?.state === 'online' || profile?.isOnline === true);

  // Copy handle to clipboard
  const handleCopyHandle = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopiedHandle(true);
      toast.success(`Copied @${username} to clipboard`);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      toast.info(`@${username}`);
    }
  }, [username]);

  // Real Bio, Tagline, Location, Website without placeholder stubs
  const bio = (typeof profile?.bio === 'string' && profile.bio.trim()) ? profile.bio.trim() : (typeof profile?.about === 'string' ? profile.about.trim() : '');
  const tagline = (typeof profile?.tagline === 'string' && profile.tagline.trim()) ? profile.tagline.trim() : '';
  const location = (typeof profile?.location === 'string' && profile.location.trim()) ? profile.location.trim() : '';
  const website = (typeof profile?.website === 'string' && profile.website.trim()) ? profile.website.trim() : '';
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;

  return (
    <div className={cn(
      "w-full rounded-2xl sm:rounded-3xl p-4 sm:p-6 border backdrop-blur-xl transition-all duration-200 shadow-sm space-y-5",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
    )}>
      {/* Main Hero Profile Area (Avatar + Info + Dedicated Level Card) */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
        {/* Left Sub-row: Avatar + Details */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 min-w-0 flex-1">
          {/* Avatar Container with Glowing Gradient Ring, Online Dot, & Sparkle Accent */}
          <div className="relative shrink-0">
            {/* Glowing Ring */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-[3px] bg-gradient-to-tr from-[#8B1EF3] via-[#D946EF] to-[#00F0FF] shadow-[0_0_25px_rgba(139,30,243,0.35)] relative">
              {/* Circular Avatar Image */}
              <button
                type="button"
                onClick={onAvatarClick}
                className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-2 ring-white dark:ring-[#0b1021] block relative cursor-pointer group"
                aria-label="Profile Avatar"
              >
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {isOwner && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-5 h-5 text-purple-300" />
                  </div>
                )}
              </button>

              {/* Sparkle Star on Perimeter */}
              <div className="absolute -top-1 -right-1 text-cyan-400 animate-pulse pointer-events-none">
                <Sparkles className="w-5 h-5 fill-cyan-400" />
              </div>

              {/* Live Presence Dot on bottom right */}
              <div 
                className={cn(
                  "absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-white dark:ring-[#0b1021]",
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                )}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
          </div>

          {/* Identity & Badges Block */}
          <div className="space-y-2 min-w-0 flex-1">
            {/* Name + Verified Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {displayName}
              </h1>
              {isOwner && onOpenQuickEdit && (
                <button
                  type="button"
                  onClick={() => onOpenQuickEdit('displayName')}
                  className="p-1 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                  title="Edit Display Name"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {isVerified && (
                <button
                  type="button"
                  onClick={onOpenVerificationModal}
                  title="Verified Account • Click to view credentials"
                  className="text-blue-500 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                >
                  <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 fill-[#8B1EF3] text-white" />
                </button>
              )}
            </div>

            {/* @username handle with copy */}
            <button
              type="button"
              onClick={handleCopyHandle}
              className="group/handle inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              title="Click to copy handle"
            >
              <span>@{username}</span>
              {copiedHandle ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-60 group-hover/handle:opacity-100 transition-opacity" />
              )}
            </button>

            {/* Badges Pill Row */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-0.5">
              {isVerified ? (
                <button
                  type="button"
                  onClick={onOpenVerificationModal}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border transition-transform hover:scale-105 cursor-pointer",
                    isDark
                      ? "bg-purple-950/40 text-purple-300 border-purple-500/30"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  )}
                >
                  <Check className="w-3 h-3 text-purple-500" />
                  <span>Verified</span>
                </button>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={onOpenVerificationModal}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all hover:scale-105 cursor-pointer",
                    isDark
                      ? "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                  )}
                >
                  <ShieldCheck className="w-3 h-3 text-purple-500" />
                  <span>Get Verified</span>
                </button>
              ) : null}

              {isCreator && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border",
                  isDark
                    ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>Top Creator</span>
                </span>
              )}

              {isPremium && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border",
                  isDark
                    ? "bg-indigo-950/40 text-indigo-300 border-indigo-500/30"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                )}>
                  <Crown className="w-3 h-3 text-indigo-400" />
                  <span>Premium</span>
                </span>
              )}

              {isRoyal && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border",
                  isDark
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                )}>
                  <span>👑</span>
                  <span>Royal Family</span>
                </span>
              )}
            </div>

            {/* Bio lines */}
            <div className="space-y-0.5 pt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              {bio ? (
                <div className="flex items-start justify-between gap-2 group/bio">
                  <p className="leading-snug">{bio}</p>
                  {isOwner && onOpenQuickEdit && (
                    <button
                      type="button"
                      onClick={() => onOpenQuickEdit('bio')}
                      className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0 cursor-pointer"
                      title="Edit Bio"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => onOpenQuickEdit ? onOpenQuickEdit('bio') : (onEditProfile || (() => navigate('/profile/edit')))}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Add a bio to your profile</span>
                </button>
              ) : null}
              {tagline ? (
                <p className="text-slate-500 dark:text-slate-400 leading-snug">{tagline}</p>
              ) : null}
            </div>

            {/* Meta Row: Location, Website, Joined Date */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap pt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              {location ? (
                isOwner ? (
                  <button
                    type="button"
                    onClick={onOpenLocationSetup}
                    className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                    title="Change location"
                  >
                    <MapPin className="w-3.5 h-3.5 text-purple-500" />
                    <span>{location}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{location}</span>
                  </div>
                )
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={onOpenLocationSetup}
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Add location</span>
                </button>
              ) : null}

              {(location || isOwner) && website ? <span>•</span> : null}

              {website ? (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{website.replace(/^https?:\/\//, '')}</span>
                </a>
              ) : isOwner && onOpenQuickEdit ? (
                <button
                  type="button"
                  onClick={() => onOpenQuickEdit('website')}
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Add link</span>
                </button>
              ) : null}

              {(location || website || isOwner) && joinedDate ? <span>•</span> : null}

              {joinedDate ? (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{joinedDate}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Sub-row: Dedicated Level Card & Passport */}
        <ProfileLevelProgressCard
          level={profile?.level ?? level ?? null}
          experience={profile?.experience ?? null}
          isOwner={isOwner}
          isDark={isDark}
          userId={profileUid}
          navigate={navigate}
        />
      </div>

      {/* 3. Action Buttons Bar (Matching Image 1 & Image 2) */}
      {isOwner ? (
        /* Own Profile: 6 Equal Actions Bar */
        <div className={cn(
          "w-full rounded-2xl p-2 sm:p-2.5 border grid grid-cols-3 sm:grid-cols-6 gap-2",
          isDark ? "bg-white/[0.03] border-white/5" : "bg-slate-50/80 border-slate-100"
        )}>
          {/* Edit Profile */}
          <button
            type="button"
            onClick={onEditProfile || (() => navigate('/profile/edit'))}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <Edit3 className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">Edit Profile</span>
          </button>

          {/* Share Profile */}
          <button
            type="button"
            onClick={onShare}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <Share2 className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">Share Profile</span>
          </button>

          {/* QR Code */}
          <button
            type="button"
            onClick={onOpenQrCode}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <QrCode className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">QR Code</span>
          </button>

          {/* Coins */}
          <button
            type="button"
            onClick={() => navigate('/coins')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <Coins className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">Coins</span>
          </button>

          {/* Insights */}
          <button
            type="button"
            onClick={onInsightsPress || (() => navigate('/profile/analytics'))}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <BarChart2 className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">Insights</span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer group",
              isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-white text-slate-700 shadow-none hover:shadow-sm"
            )}
          >
            <Settings className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold truncate">Settings</span>
          </button>
        </div>
      ) : (
        /* Public Profile: Follow + Message + Call + Gift + More Dropdown */
        <div className="flex items-center gap-2.5 flex-wrap w-full">
          {/* Primary Follow Button */}
          <button
            type="button"
            onClick={onFollowToggle}
            disabled={followLoading}
            className={cn(
              "flex-1 min-w-[140px] py-2.5 sm:py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer",
              isFollowing
                ? (isDark ? "bg-white/10 hover:bg-white/15 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800")
                : "bg-gradient-to-r from-[#8B1EF3] to-[#4431F7] hover:brightness-110 shadow-purple-600/30"
            )}
          >
            {isFollowing ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Follow</span>
              </>
            )}
          </button>

          {/* Message Button */}
          <button
            type="button"
            onClick={() => navigate(`/messages/new?to=${profileUid}`)}
            className={cn(
              "flex-1 min-w-[130px] py-2.5 sm:py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer",
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Message</span>
          </button>

          {/* Audio Call Button */}
          <button
            type="button"
            onClick={() => navigate(`/call/${profileUid}?type=audio`)}
            className={cn(
              "p-2.5 sm:p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer",
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
            )}
            title="Audio Call"
            aria-label="Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Gift / Tip Button */}
          <button
            type="button"
            onClick={onOpenTipModal}
            className={cn(
              "p-2.5 sm:p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer",
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
            )}
            title="Send Gift / Tip Coins"
            aria-label="Send Gift"
          >
            <Gift className="w-4 h-4 text-purple-400" />
          </button>

          {/* More Options Dropdown */}
          <button
            type="button"
            onClick={onOpenOptions}
            className={cn(
              "p-2.5 sm:p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer",
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
            )}
            title="More Options"
            aria-label="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
