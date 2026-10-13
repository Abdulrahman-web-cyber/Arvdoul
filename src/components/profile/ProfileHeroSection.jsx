/**
 * Production-grade Arvdoul digital nation identity card.
 * High contrast, razor-sharp typography, immersive civic presence,
 * liquid glass styling, Level Progress Card on top, 2-row liquid glass action dock,
 * verified/creator/premium badges, prominent large coin balance card,
 * and icon-grounded social metrics strip.
 * 
 * Specifically designed for Arvdoul:
 * - NO background/cover image (Arvdoul does not support background images).
 * - Level Progress Card on top of the top card (Level, progress bar, XP have, remaining XP).
 * - Full name displayed without truncation, overlap, or clipping.
 * - 9 action icons placed below names on liquid glass in 2 rows with tactile sizing.
 * - Coins icon removed from the 9 icons; replaced with Large Coin Display (public/private based on choice).
 * - Status indicators for Verified, Creator, and Premium.
 * - Specific icons for Creations (if creator) / Posts (if not), Reputation, Followers, and Following.
 * - Perfectly matches Arvdoul design tokens and anti-slop principles.
 * - Never fabricates citizen standing (absent level remains null/unavailable).
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
  MessageCircle,
  Coins,
  Settings,
  UserCheck,
  UserPlus,
  Camera,
  Copy,
  Check,
  Eye,
  UserX,
  Users,
  Sparkles,
  Layers,
  Award,
  Shield,
  ShieldCheck,
  Lock,
  ArrowRight,
  TrendingUp,
  Star,
  User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickHandle, deriveHandle } from '../../services/profileReadModel.js';
import { toast } from 'sonner';

// Fallbacks return "unknown" (null), never a fabricated Citizen/Level 1 standing
const getRankTitle = LevelModule.getRankTitle || (() => null);
const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const formatCoinsAsUsd = LevelModule.formatCoinsAsUsd || ((c) => c ? `$${(c / 100).toFixed(2)}` : '$0.00');

const formatStatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

/**
 * 1. Lightweight Banner for legacy or preview usage (no background image)
 */
export const ProfileBanner = memo(() => null);
ProfileBanner.displayName = 'ProfileBanner';

/**
 * 2. Level Progress Card on top of the top card
 * Displays: Level progress bar, number of level, XP having, and remaining XP.
 * Strictly adheres to no-fabricated-data rules (null if unrecorded).
 */
export const ProfileLevelProgressCard = memo(({
  level = null,
  experience = null,
  isOwner = false,
  isDark = false,
  navigate
}) => {
  const levelInfo = useMemo(() => {
    const rawLvl = level !== null && level !== undefined ? Number(level) : null;
    const rawXp = experience !== null && experience !== undefined ? Number(experience) : null;

    if (rawLvl === null && rawXp === null) return null;

    if (rawXp !== null && !Number.isNaN(rawXp) && rawXp > 0) {
      const derived = getLevelInfo(rawXp);
      if (rawLvl && rawLvl > derived.level) {
        const lvlObj = LevelModule.LEVELS?.[rawLvl - 1];
        if (lvlObj) return getLevelInfo(lvlObj.xpRequired);
      }
      return derived;
    }

    if (rawLvl && !Number.isNaN(rawLvl) && rawLvl > 0) {
      const lvlObj = LevelModule.LEVELS?.[rawLvl - 1];
      const xpReq = lvlObj?.xpRequired ?? (50 * rawLvl * (rawLvl - 1));
      return getLevelInfo(xpReq);
    }

    return null;
  }, [experience, level]);

  if (!levelInfo) {
    if (!isOwner) return null;
    return (
      <div className={cn(
        "w-full rounded-2xl p-3 sm:p-4 border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl",
        isDark
          ? "bg-[#03071B]/80 border-white/[0.08] text-white shadow-lg"
          : "bg-white/80 border-slate-200/90 text-slate-900 shadow-md"
      )}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-slate-400">Civic standing unrecorded</span>
          </div>
          <button
            type="button"
            onClick={() => navigate?.('/progress')}
            className="text-[11px] font-bold text-purple-500 hover:underline cursor-pointer"
          >
            Learn about civic progression →
          </button>
        </div>
      </div>
    );
  }

  const currentLevelNumber = levelInfo.level;
  const xpEarned = levelInfo.xpIntoLevel ?? levelInfo.totalXp ?? 0;
  const xpRemaining = levelInfo.xpToNext ?? 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round(levelInfo.progress ?? 0)));
  const rankTitle = levelInfo.title || getRankTitle(currentLevelNumber);

  return (
    <div className={cn(
      "w-full rounded-[22px] sm:rounded-[26px] border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl shadow-xl",
      isDark
        ? "bg-[#03071B]/90 border-white/[0.08] text-white shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]"
    )}>
      {/* Liquid specular hairline highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, #8B1EF3 0%, #4431F7 50%, #00F0FF 100%)",
        }}
      />

      <div className="p-3.5 sm:p-4 space-y-2.5 relative z-10">
        {/* Top Header: Level number, Rank Title, and Progress percent */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-[#8B1EF3] to-[#4431F7] text-white font-black text-xs shadow-md shrink-0">
              Lv.{currentLevelNumber}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-sm sm:text-base tracking-tight leading-none">
                  Level {currentLevelNumber}
                </span>
                {rankTitle && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 truncate">
                    {rankTitle}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Civic Progression & Perks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs font-black text-indigo-500 dark:text-indigo-400">
              {progressPercent}%
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={() => navigate?.('/progress')}
                className="text-[10px] font-bold text-slate-400 hover:text-purple-400 inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                title="View full progression tree"
              >
                <span>Details</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Liquid Glass Progress Bar */}
        <div className="relative w-full h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08] p-[1px]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(139,30,243,0.5)]"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #8B1EF3 0%, #4431F7 50%, #00F0FF 100%)",
            }}
          />
        </div>

        {/* XP Having and Remaining XP */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono font-bold text-purple-600 dark:text-purple-300">
              {xpEarned.toLocaleString()} XP
            </span>
            <span>earned</span>
          </span>
          <span className="inline-flex items-center gap-1">
            {levelInfo.isMaxLevel ? (
              <span className="font-bold text-amber-500">Max Civic Standing</span>
            ) : (
              <>
                <span className="font-mono font-bold text-indigo-500 dark:text-indigo-300">
                  {xpRemaining.toLocaleString()} XP
                </span>
                <span>remaining to Level {currentLevelNumber + 1}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
});

ProfileLevelProgressCard.displayName = 'ProfileLevelProgressCard';

/**
 * 3. Master Top Card Containing Profile Picture, Status Badges, 2-Row Liquid Glass Dock,
 * Large Coin Balance Card, and Icon-Driven Metrics Strip
 */
export const ProfileIdentityCard = memo(({
  profile,
  isOwner = false,
  effectiveLevel = null,
  hasLevel = false,
  rankLabel = null,
  displayName = 'Citizen',
  username = 'citizen',
  avatarUrl = '',
  bio = '',
  location = '',
  website = '',
  joinedDate = '',
  isOnline = false,
  isDark = false,
  onAvatarClick,
  onEditProfile,
  onOpenLocationSetup,
  onOpenQrCode,
  onShare,
  onOpenPerspective,
  onOpenOptions,
  isFollowing = false,
  followLoading = false,
  onFollowToggle,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onOpenTipModal,
  onOpenMessages,
  capabilities,
  onMetricPress,
  navigate,
}) => {
  const localNavigate = useNavigate();
  const nav = navigate || localNavigate;
  const [copiedHandle, setCopiedHandle] = useState(false);

  const handleCopyHandle = useCallback((e) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(`@${username}`);
      setCopiedHandle(true);
      toast.success(`Copied @${username} to clipboard`);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  }, [username]);

  const profileUid = profile?.id || profile?.uid;

  // Social Stats
  const postsCount = profile?.postCount ?? profile?.postsCount ?? profile?.posts?.length ?? 0;
  const followersCount = profile?.followerCount ?? profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const rawReputation = profile?.reputationScore ?? profile?.reputation;
  const hasReputation = rawReputation !== undefined && rawReputation !== null;
  const reputationScore = hasReputation ? Number(rawReputation) : null;

  const canShowFollowers = capabilities?.canViewFollowers ?? true;
  const canShowFollowing = capabilities?.canViewFollowing ?? true;

  // Status flags
  const isVerified = Boolean(profile?.isVerified || profile?.verified);
  const isCreator = Boolean(profile?.isCreator || profile?.creatorStatus === 'active');
  const isPremium = Boolean(profile?.isPremium || profile?.premiumTier || profile?.subscription);

  // Coins handling
  const canViewCoins = capabilities?.canViewEconomicStatus ?? (isOwner || Boolean(profile?.coins !== null && profile?.coins !== undefined));
  const rawCoins = profile?.coins ?? profile?.coinBalance;
  const coinsAmount = rawCoins !== null && rawCoins !== undefined ? Number(rawCoins) : (isOwner ? 0 : null);

  return (
    <div className={cn(
      "w-full rounded-[26px] sm:rounded-[30px] border transition-all duration-300 relative overflow-hidden",
      isDark
        ? "bg-[#03071B]/95 border-white/[0.08] text-white shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_10px_32px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl"
    )}>
      {/* Top Ambient Optical Hairline Highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, #C82BFF 0%, #8B1EF3 34%, #4431F7 66%, #0088FF 100%)",
        }}
      />

      {/* Ambient background glow orb */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-20"
        style={{
          background: "radial-gradient(circle, #8B1EF3 0%, #4431F7 60%, transparent 100%)"
        }}
      />

      {/* Interior Container */}
      <div className="p-4 sm:p-6 space-y-4 relative z-10">

        {/* 1. Profile Avatar & Full Display Name Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          {/* 1:1 Circular Avatar with Radiant Gradient Aura */}
          <div className="relative inline-block group shrink-0">
            <button
              type="button"
              onClick={onAvatarClick}
              className="relative block w-22 h-22 sm:w-26 sm:h-26 rounded-full p-[3px] bg-gradient-to-tr from-[#8B1EF3] via-[#4431F7] to-[#00F0FF] shadow-[0_12px_36px_rgba(139,30,243,0.38)] hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
              title={isOwner ? "Change profile photo" : "View avatar"}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-2 ring-[#03071B] dark:ring-[#03071B] relative">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Camera icon overlay for owner */}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                    <Camera className="w-5 h-5 text-purple-200" />
                    <span>Change</span>
                  </div>
                )}
              </div>
            </button>

            {/* Live Presence Status Dot */}
            <div 
              className={cn(
                "absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-[#03071B] dark:ring-[#03071B]",
                isOnline ? "bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" : "bg-slate-400"
              )}
              title={isOnline ? "Active now" : "Offline"} 
            />
          </div>

          {/* Full Name & Username Section (Ample room across 100% card width, zero clipping or overlapping) */}
          <div className="w-full space-y-1.5 px-2">
            {/* Full Name Display - unobstructed, bold, pristine */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight text-slate-900 dark:text-white break-words">
              {displayName}
            </h1>

            {/* Unique Username with instant copy */}
            <div className="flex items-center justify-center gap-2 flex-wrap text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={handleCopyHandle}
                className="font-mono text-xs sm:text-sm font-bold text-[#8B1EF3] dark:text-[#B978FF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                title="Click to copy unique username"
              >
                <span>@{username}</span>
                {copiedHandle ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                )}
              </button>

              {profile?.pronouns && (
                <span className="text-slate-400 text-xs">
                  · {profile.pronouns}
                </span>
              )}
            </div>

            {/* Status Badges: Verified, Creator, Premium, and Rank */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap pt-1">
              {/* 1. Verified Status */}
              <div 
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold border transition-colors select-none",
                  isVerified
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400"
                    : "bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400"
                )}
                title={isVerified ? "Verified Citizen of Arvdoul" : "Unverified Citizen"}
              >
                <BadgeCheck className={cn("w-3.5 h-3.5 shrink-0", isVerified ? "text-blue-500" : "text-slate-400")} />
                <span>{isVerified ? "Verified" : "Unverified"}</span>
              </div>

              {/* 2. Creator Status */}
              <div 
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold border transition-colors select-none",
                  isCreator
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300"
                    : "bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400"
                )}
                title={isCreator ? "Recognized Creator of Arvdoul" : "Citizen"}
              >
                {isCreator ? (
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                ) : (
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{isCreator ? "Creator" : "Citizen"}</span>
              </div>

              {/* 3. Premium Status */}
              <div 
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold border transition-colors select-none",
                  isPremium
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-300"
                    : "bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400"
                )}
                title={isPremium ? "Royal / Premium Citizen Tier" : "Standard Tier"}
              >
                {isPremium ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Star className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{isPremium ? "Royal Tier" : "Standard"}</span>
              </div>

              {/* Rank Title badge if present */}
              {rankLabel && (
                <button
                  type="button"
                  onClick={() => nav(isOwner ? '/titles' : `/passport/${profileUid}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 hover:underline cursor-pointer"
                  title="Civic Rank Title"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{rankLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. The 9 Action Buttons Dock on Liquid Glass in 2 Rows with Hierarchical Sizing */}
        <div className="relative rounded-[26px] sm:rounded-[30px] p-3 sm:p-4.5 bg-white/10 dark:bg-white/[0.04] backdrop-blur-3xl border border-white/20 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] overflow-hidden space-y-2.5">
          {/* Liquid glass specular reflection hairline */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/60 dark:via-white/30 to-transparent"
          />

          {isOwner ? (
            <>
              {/* Row 1: Primary Feature Actions (4 buttons across 5 columns: 1 Hero col-span-2 + 3 Companion col-span-1) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {/* 1. Edit Profile - Hero Primary Action (col-span-2, taller tactile height, vibrant gradient) */}
                <button
                  type="button"
                  onClick={onEditProfile || (() => nav('/profile/edit'))}
                  className="col-span-2 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 px-3 active:scale-95 shadow-md shadow-purple-500/25 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 border-purple-400/30 text-white group"
                  title="Edit Profile"
                  aria-label="Edit Profile"
                >
                  <Edit3 className="w-5 h-5 group-hover:scale-110 transition-transform text-white shrink-0" />
                  <span className="text-xs sm:text-sm font-black tracking-tight truncate">Edit Profile</span>
                </button>

                {/* 2. View As Perspective (col-span-1) */}
                <button
                  type="button"
                  onClick={onOpenPerspective}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300 group"
                  title="View Profile As Perspective"
                  aria-label="View Profile As"
                >
                  <Eye className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">View As</span>
                </button>

                {/* 3. Identity QR Code (col-span-1) */}
                <button
                  type="button"
                  onClick={onOpenQrCode}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border-fuchsia-500/30 text-fuchsia-300 group"
                  title="Identity QR Code"
                  aria-label="Identity QR Code"
                >
                  <QrCode className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">QR Code</span>
                </button>

                {/* 4. Share Profile (col-span-1) */}
                <button
                  type="button"
                  onClick={onShare}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300 group"
                  title="Share Profile"
                  aria-label="Share Profile"
                >
                  <Share2 className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">Share</span>
                </button>
              </div>

              {/* Row 2: Secondary Utility & Governance Actions (5 buttons across 5 columns: 1 col each) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {/* 5. Digital Passport */}
                <button
                  type="button"
                  onClick={() => nav('/passport')}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/30 text-indigo-300 group"
                  title="Digital Passport"
                  aria-label="Digital Passport"
                >
                  <Crown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Passport</span>
                </button>

                {/* 6. Location Setup */}
                <button
                  type="button"
                  onClick={onOpenLocationSetup}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300 group"
                  title="Civic Location"
                  aria-label="Civic Location"
                >
                  <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Location</span>
                </button>

                {/* 7. Account Settings */}
                <button
                  type="button"
                  onClick={() => nav('/settings')}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-slate-500/15 hover:bg-slate-500/25 border-slate-500/30 text-slate-300 group"
                  title="Account Settings"
                  aria-label="Account Settings"
                >
                  <Settings className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Settings</span>
                </button>

                {/* 8. Civic Titles */}
                <button
                  type="button"
                  onClick={() => nav('/titles')}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300 group"
                  title="Civic Titles & Provenance"
                  aria-label="Civic Titles"
                >
                  <Award className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Titles</span>
                </button>

                {/* 9. More Options */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptions?.();
                  }}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-white/10 hover:bg-white/20 border-white/15 text-slate-200 group"
                  title="More Options"
                  aria-label="More Options"
                >
                  <MoreHorizontal className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">More</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Visitor Row 1: Primary Feature Actions (4 buttons across 5 columns: 1 Hero col-span-2 + 3 Companion col-span-1) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {/* 1. Follow / Unfollow - Hero Primary Action (col-span-2) */}
                {capabilities?.canFollow !== false ? (
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    disabled={followLoading}
                    className={cn(
                      "col-span-2 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 px-3 active:scale-95 shadow-md",
                      isFollowing
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 border-transparent text-white shadow-purple-500/25"
                    )}
                    title={isFollowing ? "Following" : "Follow"}
                    aria-label={isFollowing ? "Following" : "Follow"}
                  >
                    {isFollowing ? <UserCheck className="w-5 h-5 shrink-0" /> : <UserPlus className="w-5 h-5 shrink-0" />}
                    <span className="text-xs sm:text-sm font-black tracking-tight truncate">
                      {isFollowing ? "Following" : "Follow"}
                    </span>
                  </button>
                ) : (
                  <div className="col-span-2 h-13 sm:h-14" />
                )}

                {/* 2. Direct Message (col-span-1) */}
                <button
                  type="button"
                  onClick={onOpenMessages || (() => nav(`/messages/new?to=${profileUid}`))}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/30 text-indigo-300"
                  title="Direct Message"
                  aria-label="Direct Message"
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">Message</span>
                </button>

                {/* 3. Share Profile (col-span-1) */}
                <button
                  type="button"
                  onClick={onShare}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300"
                  title="Share Profile"
                  aria-label="Share Profile"
                >
                  <Share2 className="w-4.5 h-4.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">Share</span>
                </button>

                {/* 4. Identity QR Code (col-span-1) */}
                <button
                  type="button"
                  onClick={onOpenQrCode}
                  className="col-span-1 h-13 sm:h-14 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border-fuchsia-500/30 text-fuchsia-300"
                  title="Identity QR Code"
                  aria-label="Identity QR Code"
                >
                  <QrCode className="w-4.5 h-4.5" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 truncate">QR Code</span>
                </button>
              </div>

              {/* Visitor Row 2: Secondary Actions (5 buttons across 5 columns: 1 col each) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {/* 5. Digital Passport */}
                <button
                  type="button"
                  onClick={() => nav(`/passport/${profileUid}`)}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/30 text-indigo-300"
                  title="Digital Passport"
                  aria-label="Digital Passport"
                >
                  <Crown className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Passport</span>
                </button>

                {/* 6. Friend Status / Add Friend */}
                {friendshipStatus ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className={cn(
                      "h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm",
                      friendshipStatus === 'friends'
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-purple-500/15 border-purple-500/30 text-purple-300"
                    )}
                    title={friendshipStatus === 'friends' ? "Friends" : "Add Friend"}
                    aria-label="Friend Status"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">
                      {friendshipStatus === 'friends' ? "Friends" : "Friend"}
                    </span>
                  </button>
                ) : (
                  <div className="h-11 sm:h-12" />
                )}

                {/* 7. Civic Location */}
                <button
                  type="button"
                  onClick={location && onOpenLocationSetup ? onOpenLocationSetup : undefined}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300"
                  title="Civic Location"
                  aria-label="Civic Location"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Location</span>
                </button>

                {/* 8. Block / Restrict */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptions?.();
                  }}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300"
                  title="Block or Restrict"
                  aria-label="Block or Restrict"
                >
                  <UserX className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">Restrict</span>
                </button>

                {/* 9. More Options */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptions?.();
                  }}
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center active:scale-95 shadow-sm bg-white/10 hover:bg-white/20 border-white/15 text-slate-200"
                  title="Profile Options"
                  aria-label="Profile Options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">More</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 3. Large Coin Balance Display (Public or Private based on user choice) */}
        <div className={cn(
          "rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-300 relative overflow-hidden backdrop-blur-3xl shadow-xl",
          isDark
            ? "bg-gradient-to-r from-amber-500/15 via-[#03071B]/95 to-purple-500/15 border-amber-500/35 shadow-[0_16px_40px_rgba(245,158,11,0.15)] text-white"
            : "bg-gradient-to-r from-amber-50/90 via-white/95 to-purple-50/90 border-amber-200 text-slate-900 shadow-[0_8px_24px_rgba(245,158,11,0.08)]"
        )}>
          {/* Liquid gold specular reflection highlight */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #F59E0B 35%, #FDE047 50%, #F59E0B 65%, transparent 100%)",
            }}
          />

          <div className="flex items-center justify-between gap-4 flex-wrap relative z-10">
            {canViewCoins && coinsAmount !== null ? (
              <>
                <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-white flex items-center justify-center shadow-xl shadow-amber-500/30 shrink-0 ring-2 ring-amber-400/40">
                    <Coins className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 sm:gap-2.5 flex-wrap">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-500 dark:text-amber-400 tracking-tight leading-none font-mono drop-shadow-sm">
                        {coinsAmount.toLocaleString()}
                      </span>
                      <span className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-200">
                        Coins
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">
                        ({formatCoinsAsUsd(coinsAmount)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        {isOwner 
                          ? (profile?.privacy?.economicStatus === 'ONLY_ME'
                              ? "🔒 Private Treasury · Confidential to you"
                              : "🌐 Public Treasury · Visible to all Arvdoul citizens")
                          : "🏛️ Citizen Treasury Balance"}
                      </p>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => nav('/profile/edit')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-400 hover:underline cursor-pointer transition-colors"
                          title="Manage Treasury Privacy in Edit Profile"
                        >
                          <span>{profile?.privacy?.economicStatus === 'ONLY_ME' ? 'Switch to Public' : 'Switch to Private'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => nav('/coins')}
                      className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/25 cursor-pointer flex items-center gap-1.5"
                    >
                      <Coins className="w-4 h-4" />
                      <span>Wallet</span>
                    </button>
                  ) : (
                    onOpenTipModal && (
                      <button
                        type="button"
                        onClick={onOpenTipModal}
                        className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/25 cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Send Tip</span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full gap-3 flex-wrap">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0 border border-slate-500/20">
                    <Lock className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200">
                      Private Treasury Balance
                    </span>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                      Treasury visibility kept confidential by citizen choice
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => nav('/coins')}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-indigo-400 hover:underline cursor-pointer"
                    >
                      Manage Wallet →
                    </button>
                  ) : (
                    onOpenTipModal && (
                      <button
                        type="button"
                        onClick={onOpenTipModal}
                        className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Send Tip</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Bio Section */}
        {bio ? (
          <div className="pt-0.5">
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line font-normal max-w-2xl">
              {bio}
            </p>
          </div>
        ) : isOwner ? (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={onEditProfile || (() => navigate('/profile/edit'))}
              className="text-xs text-slate-400 hover:text-[#8B1EF3] dark:hover:text-[#B978FF] transition-colors cursor-pointer italic"
            >
              + Add a bio to introduce yourself to Arvdoul citizens
            </button>
          </div>
        ) : null}

        {/* 5. Civic Coordinates: Location, Website, Joined Date */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs text-slate-500 dark:text-slate-400 font-medium">
          {location ? (
            <button
              type="button"
              onClick={isOwner && onOpenLocationSetup ? onOpenLocationSetup : undefined}
              className={cn(
                "inline-flex items-center gap-1.5",
                isOwner && onOpenLocationSetup && "cursor-pointer hover:underline text-indigo-600 dark:text-indigo-400"
              )}
              title={isOwner ? "Update profile location" : undefined}
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{location}</span>
            </button>
          ) : isOwner && onOpenLocationSetup ? (
            <button
              type="button"
              onClick={onOpenLocationSetup}
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Add Location</span>
            </button>
          ) : null}

          {website && (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          {joinedDate && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{joinedDate}</span>
            </span>
          )}
        </div>

        {/* 6. Core Social & Civic Metrics Strip with Dedicated Liquid Glass Tiles */}
        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center select-none">
          {/* Tile 1: Creations (if creator) / Posts (if citizen) */}
          <div 
            onClick={() => onMetricPress?.('posts')}
            className={cn(
              "p-3 sm:p-3.5 rounded-2xl transition-all border group relative overflow-hidden backdrop-blur-xl",
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-purple-500/40 text-white"
                : "bg-white/70 hover:bg-white border-slate-200/80 hover:border-purple-300 text-slate-900 shadow-sm",
              onMetricPress ? "cursor-pointer active:scale-95" : ""
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {isCreator ? (
                <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              ) : (
                <Layers className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-lg sm:text-xl font-black tracking-tight leading-tight font-mono">
                {formatStatNumber(postsCount)}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isCreator ? "Creations" : "Posts"}
            </div>
          </div>

          {/* Tile 2: Followers */}
          <div 
            onClick={() => canShowFollowers && onMetricPress?.('followers')}
            className={cn(
              "p-3 sm:p-3.5 rounded-2xl transition-all border group relative overflow-hidden backdrop-blur-xl",
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-cyan-500/40 text-white"
                : "bg-white/70 hover:bg-white border-slate-200/80 hover:border-cyan-300 text-slate-900 shadow-sm",
              canShowFollowers && onMetricPress ? "cursor-pointer active:scale-95" : "opacity-50"
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-lg sm:text-xl font-black tracking-tight leading-tight font-mono">
                {canShowFollowers ? formatStatNumber(followersCount) : '—'}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Followers
            </div>
          </div>

          {/* Tile 3: Following */}
          <div 
            onClick={() => canShowFollowing && onMetricPress?.('following')}
            className={cn(
              "p-3 sm:p-3.5 rounded-2xl transition-all border group relative overflow-hidden backdrop-blur-xl",
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-emerald-500/40 text-white"
                : "bg-white/70 hover:bg-white border-slate-200/80 hover:border-emerald-300 text-slate-900 shadow-sm",
              canShowFollowing && onMetricPress ? "cursor-pointer active:scale-95" : "opacity-50"
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <UserCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-lg sm:text-xl font-black tracking-tight leading-tight font-mono">
                {canShowFollowing ? formatStatNumber(followingCount) : '—'}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Following
            </div>
          </div>

          {/* Tile 4: Civic Standing / Reputation */}
          <div 
            onClick={() => onMetricPress?.('reputation')}
            className={cn(
              "p-3 sm:p-3.5 rounded-2xl transition-all border group relative overflow-hidden backdrop-blur-xl",
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-amber-500/40 text-white"
                : "bg-white/70 hover:bg-white border-slate-200/80 hover:border-amber-300 text-slate-900 shadow-sm",
              onMetricPress ? "cursor-pointer active:scale-95" : ""
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-lg sm:text-xl font-black tracking-tight leading-tight font-mono">
                {hasReputation ? formatStatNumber(reputationScore) : '—'}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Reputation
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

ProfileIdentityCard.displayName = 'ProfileIdentityCard';

/**
 * 4. Unified ProfileHeroSection
 * Mounts:
 *  - Top: ProfileLevelProgressCard (level progress bar, level number, XP have, remaining XP)
 *  - Master Identity Card (avatar, full name, 2-row liquid glass action dock, large coin balance, metrics)
 */
const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  theme = 'light',
  variant = 'identity',
  onOpenQrCode,
  onOpenLocationSetup,
  onOpenMessages,
  onOpenOptions,
  onOpenPerspective,
  onAvatarClick,
  onShare,
  onEditProfile,
  onInsightsPress,
  isFollowing = false,
  followLoading = false,
  onFollowToggle,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onOpenTipModal,
  capabilities,
  onMetricPress,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const effectiveLevel = useMemo(() => {
    const raw = level ?? profile?.level;
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return !Number.isNaN(n) && n > 0 ? n : null;
  }, [level, profile?.level]);

  const hasLevel = effectiveLevel !== null;

  const rankLabel = useMemo(() => {
    if (!hasLevel) return null;
    return getRankTitle(effectiveLevel);
  }, [effectiveLevel, hasLevel]);

  const displayName = useMemo(() => {
    return profile?.displayName || profile?.name || 'Citizen';
  }, [profile?.displayName, profile?.name]);

  const username = useMemo(() => {
    const candidate = pickHandle([profile?.username, profile?.handle]);
    if (candidate) return candidate;
    const fromDisplay = deriveHandle(displayName);
    if (fromDisplay) return fromDisplay;
    return 'citizen';
  }, [profile?.username, profile?.handle, displayName]);

  const avatarUrl = useMemo(() => {
    return getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid || '');
  }, [profile?.photoURL, displayName, profile?.id, profile?.uid]);

  const bio = profile?.bio || '';
  const location = profile?.location || '';
  const website = profile?.website || '';

  const joinedDate = useMemo(() => {
    if (!profile?.createdAt) return '';
    try {
      const d = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
      if (Number.isNaN(d.getTime())) return '';
      return `Joined ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    } catch {
      return '';
    }
  }, [profile?.createdAt]);

  const isOnline = Boolean(profile?.presence?.isOnline || profile?.isOnline);

  if (variant === 'banner') {
    return null;
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* 1. Level Progress Card on top of the top card */}
      <ProfileLevelProgressCard
        level={effectiveLevel}
        experience={profile?.experience ?? profile?.xp}
        isOwner={isOwner}
        isDark={isDark}
        navigate={navigate}
      />

      {/* 2. Elevated Master Identity Card */}
      <ProfileIdentityCard
        profile={profile}
        isOwner={isOwner}
        effectiveLevel={effectiveLevel}
        hasLevel={hasLevel}
        rankLabel={rankLabel}
        displayName={displayName}
        username={username}
        avatarUrl={avatarUrl}
        bio={bio}
        location={location}
        website={website}
        joinedDate={joinedDate}
        isOnline={isOnline}
        isDark={isDark}
        onAvatarClick={onAvatarClick}
        onEditProfile={onEditProfile}
        onOpenLocationSetup={onOpenLocationSetup}
        onInsightsPress={onInsightsPress}
        onOpenQrCode={onOpenQrCode}
        onShare={onShare}
        onOpenPerspective={onOpenPerspective}
        onOpenOptions={onOpenOptions}
        isFollowing={isFollowing}
        followLoading={followLoading}
        onFollowToggle={onFollowToggle}
        friendshipStatus={friendshipStatus}
        friendRequestLoading={friendRequestLoading}
        onFriendRequestToggle={onFriendRequestToggle}
        onOpenTipModal={onOpenTipModal}
        onOpenMessages={onOpenMessages}
        capabilities={capabilities}
        onMetricPress={onMetricPress}
        navigate={navigate}
      />
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
