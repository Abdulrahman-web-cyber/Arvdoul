/**
 * Production-grade Arvdoul digital nation identity card.
 * High contrast, razor-sharp typography, immersive civic presence,
 * layered 3D avatar with live presence, 3x3 unified action controls,
 * and zero-pill discipline.
 * 
 * Specifically designed for Arvdoul:
 * - NO background/cover image (Arvdoul does not support background images).
 * - Master Top Card containing the Profile Picture on top-left.
 * - Display Name placed slightly below the profile picture.
 * - Action icons organized in a crisp 3 by 3 placement to the right of the profile picture.
 * - Prominently preserves Bio, Civic Coordinates (Location, Website, Joined Date).
 * - Compact, refined card height with optimal spacing.
 * - Perfectly matches Arvdoul design tokens (arvdoul-gradient, arvdoul-surface, arvdoul-border).
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
  UserX
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickHandle, deriveHandle } from '../../services/profileReadModel.js';
import { toast } from 'sonner';

// Fallbacks return "unknown" (null), never a fabricated Citizen/Level 1 standing
const getRankTitle = LevelModule.getRankTitle || (() => null);

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
 * 2. Master Top Card Containing Profile Picture, 3x3 Action Suite & Identity
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
  const friendsCount = profile?.friendCount ?? profile?.friendsCount ?? 0;
  const rawReputation = profile?.reputationScore ?? profile?.reputation;
  const hasReputation = rawReputation !== undefined && rawReputation !== null;
  const reputationScore = hasReputation ? Number(rawReputation) : null;

  const canShowFollowers = capabilities?.canViewFollowers ?? true;
  const canShowFollowing = capabilities?.canViewFollowing ?? true;

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

      {/* Compact Interior Padding */}
      <div className="p-4 sm:p-5 space-y-3.5 relative z-10">

        {/* Top Header Row: Profile Avatar on Left, 3 by 3 Action Suite on Right */}
        <div className="flex items-start justify-between gap-3 sm:gap-5">

          {/* Left Column: Avatar + Display Name slightly below Profile Picture */}
          <div className="min-w-0 flex-1">
            
            {/* 1:1 Circular Avatar with Radiant Gradient Aura */}
            <div className="relative inline-block group shrink-0">
              <button
                type="button"
                onClick={onAvatarClick}
                className="relative block w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2.5px] bg-gradient-to-tr from-[#8B1EF3] via-[#4431F7] to-[#055BFB] shadow-[0_6px_20px_rgba(139,30,243,0.3)] hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold gap-0.5">
                      <Camera className="w-3.5 h-3.5 text-purple-200" />
                      <span>Edit</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Live Presence Status Dot */}
              <div 
                className={cn(
                  "absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#03071B] dark:ring-[#03071B]",
                  isOnline ? "bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" : "bg-slate-400"
                )}
                title={isOnline ? "Active now" : "Offline"} 
              />
            </div>

            {/* Display Name placed slightly below the profile picture */}
            <div className="pt-2 space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight truncate">
                  {displayName}
                </h1>
                {Boolean(profile?.isVerified || profile?.verified) && (
                  <BadgeCheck 
                    className="w-4 h-4 text-blue-500 fill-blue-500/10 shrink-0" 
                    title="Verified Citizen of Arvdoul" 
                  />
                )}
              </div>

              {/* Unique Username by UserService (with instant copy feedback) */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400 font-medium">
                <button
                  type="button"
                  onClick={handleCopyHandle}
                  className="font-mono text-xs font-bold text-[#8B1EF3] dark:text-[#B978FF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  title="Click to copy unique username"
                >
                  <span>@{username}</span>
                  {copiedHandle ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                  )}
                </button>

                {rankLabel && (
                  <>
                    <span aria-hidden="true" className="opacity-30">·</span>
                    <button
                      type="button"
                      onClick={() => navigate(isOwner ? '/titles' : `/passport/${profileUid}`)}
                      className="text-purple-600 dark:text-purple-400 font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer text-[11px]"
                    >
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span>{rankLabel}</span>
                    </button>
                  </>
                )}

                {hasLevel && (
                  <>
                    <span aria-hidden="true" className="opacity-30">·</span>
                    <span className="font-semibold text-indigo-500 dark:text-indigo-400 text-[11px]">
                      Lv.{effectiveLevel}
                    </span>
                  </>
                )}

                {profile?.pronouns && (
                  <>
                    <span aria-hidden="true" className="opacity-30">·</span>
                    <span className="text-slate-400 text-[11px]">{profile.pronouns}</span>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: 3 by 3 Placement of Action Icons */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 shrink-0 self-start">
            {isOwner ? (
              <>
                {/* 1. Edit Profile */}
                <button
                  type="button"
                  onClick={onEditProfile || (() => navigate('/profile/edit'))}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                      : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  )}
                  title="Edit Profile"
                  aria-label="Edit Profile"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* 2. View As Perspective */}
                <button
                  type="button"
                  onClick={onOpenPerspective}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                      : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                  )}
                  title="View Profile As Perspective"
                  aria-label="View Profile As"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* 3. Identity QR Code */}
                <button
                  type="button"
                  onClick={onOpenQrCode}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-purple-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-purple-700"
                  )}
                  title="View Identity QR Code"
                  aria-label="Identity QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                {/* 4. Share Profile */}
                <button
                  type="button"
                  onClick={onShare}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-cyan-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-cyan-700"
                  )}
                  title="Share Profile"
                  aria-label="Share Profile"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* 5. Digital Passport */}
                <button
                  type="button"
                  onClick={() => navigate('/passport')}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-amber-400"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-600"
                  )}
                  title="Digital Passport & Titles"
                  aria-label="Digital Passport"
                >
                  <Crown className="w-4 h-4" />
                </button>

                {/* 6. Coins & Wallet */}
                <button
                  type="button"
                  onClick={() => navigate('/coins')}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-yellow-400"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-yellow-600"
                  )}
                  title="Coin Wallet & Tips"
                  aria-label="Coins & Wallet"
                >
                  <Coins className="w-4 h-4" />
                </button>

                {/* 7. Location Setup */}
                <button
                  type="button"
                  onClick={onOpenLocationSetup}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-emerald-400"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-emerald-600"
                  )}
                  title="Update Civic Location"
                  aria-label="Civic Location"
                >
                  <MapPin className="w-4 h-4" />
                </button>

                {/* 8. Account Settings */}
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-slate-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                  )}
                  title="Account Settings"
                  aria-label="Account Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* 9. More Options */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOptions?.();
                  }}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-slate-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                  )}
                  title="Profile Options"
                  aria-label="Profile Options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {/* 1. Follow / Unfollow */}
                {capabilities?.canFollow !== false ? (
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    disabled={followLoading}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      isFollowing
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-gradient-to-tr from-[#8B1EF3] to-[#4431F7] text-white border-transparent"
                    )}
                    title={isFollowing ? "Following" : "Follow"}
                    aria-label={isFollowing ? "Following" : "Follow"}
                  >
                    {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </button>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                {/* 2. Direct Message */}
                <button
                  type="button"
                  onClick={onOpenMessages || (() => navigate(`/messages/new?to=${profileUid}`))}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                    isDark
                      ? "bg-white/[0.05] border-white/10 text-slate-200 hover:bg-white/[0.1]"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  )}
                  title="Direct Message"
                  aria-label="Direct Message"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>

                {/* 3. Send Tip */}
                {onOpenTipModal ? (
                  <button
                    type="button"
                    onClick={onOpenTipModal}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all text-amber-400 cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      isDark
                        ? "bg-white/[0.05] border-white/10 hover:bg-white/[0.1]"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                    )}
                    title="Send Coin Tip"
                    aria-label="Send Tip"
                  >
                    <Coins className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                {/* 4. Share Profile */}
                {onShare ? (
                  <button
                    type="button"
                    onClick={onShare}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      isDark 
                        ? "bg-white/[0.05] border-white/10 text-slate-300 hover:bg-white/[0.1]" 
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                    title="Share Profile"
                    aria-label="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                {/* 5. QR Code */}
                {onOpenQrCode ? (
                  <button
                    type="button"
                    onClick={onOpenQrCode}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      isDark 
                        ? "bg-white/[0.05] border-white/10 text-slate-300 hover:bg-white/[0.1]" 
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                    title="Identity QR Code"
                    aria-label="Identity QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                {/* 6. Digital Passport */}
                <button
                  type="button"
                  onClick={() => navigate(`/passport/${profileUid}`)}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm text-amber-400",
                    isDark 
                      ? "bg-white/[0.05] border-white/10 hover:bg-white/[0.1]" 
                      : "bg-slate-100 border-slate-200 text-amber-600 hover:bg-slate-200"
                  )}
                  title="View Digital Passport"
                  aria-label="Digital Passport"
                >
                  <Crown className="w-4 h-4" />
                </button>

                {/* 7. Friend Request */}
                {friendshipStatus ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      friendshipStatus === 'friends'
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : "border-purple-500/30 text-purple-400 bg-purple-500/10"
                    )}
                    title={friendshipStatus === 'friends' ? "Friends" : "Add Friend"}
                    aria-label="Friend Status"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                {/* 8. Block / Restrict */}
                <button
                  type="button"
                  onClick={onOpenOptions}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm text-slate-400 hover:text-rose-400",
                    isDark 
                      ? "bg-white/[0.05] border-white/10 hover:bg-white/[0.1]" 
                      : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                  )}
                  title="Block / Restrict"
                  aria-label="Block or Restrict"
                >
                  <UserX className="w-4 h-4" />
                </button>

                {/* 9. Options */}
                {onOpenOptions && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOptions?.();
                    }}
                    className={cn(
                      "w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm",
                      isDark 
                        ? "bg-white/[0.05] border-white/10 text-slate-300 hover:bg-white/[0.1]" 
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                    title="Profile Options"
                    aria-label="Profile Options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

        </div>

        {/* Bio Section - Clean & Prominently Preserved */}
        {bio ? (
          <div className="pt-1">
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

        {/* Civic Coordinates Row: Location, Website, Joined Date */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap pt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
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

        {/* Core Social & Civic Metrics Strip (Zero-Pill Discipline) */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] grid grid-cols-4 gap-2 text-center select-none">
          {/* Creations */}
          <div 
            onClick={() => onMetricPress?.('posts')}
            className={cn(
              "p-1.5 sm:p-2 rounded-2xl transition-all",
              onMetricPress ? "cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04]" : ""
            )}
          >
            <div className="text-base sm:text-lg font-black tracking-tight leading-tight">
              {formatStatNumber(postsCount)}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Creations
            </div>
          </div>

          {/* Followers */}
          <div 
            onClick={() => canShowFollowers && onMetricPress?.('followers')}
            className={cn(
              "p-1.5 sm:p-2 rounded-2xl transition-all",
              canShowFollowers && onMetricPress ? "cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04]" : "opacity-50"
            )}
          >
            <div className="text-base sm:text-lg font-black tracking-tight leading-tight">
              {canShowFollowers ? formatStatNumber(followersCount) : '—'}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Followers
            </div>
          </div>

          {/* Following */}
          <div 
            onClick={() => canShowFollowing && onMetricPress?.('following')}
            className={cn(
              "p-1.5 sm:p-2 rounded-2xl transition-all",
              canShowFollowing && onMetricPress ? "cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04]" : "opacity-50"
            )}
          >
            <div className="text-base sm:text-lg font-black tracking-tight leading-tight">
              {canShowFollowing ? formatStatNumber(followingCount) : '—'}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Following
            </div>
          </div>

          {/* Civic Standing / Reputation */}
          <div 
            onClick={() => onMetricPress?.('reputation')}
            className={cn(
              "p-1.5 sm:p-2 rounded-2xl transition-all",
              onMetricPress ? "cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04]" : ""
            )}
          >
            <div className="text-base sm:text-lg font-black tracking-tight leading-tight text-[#8B1EF3] dark:text-[#B978FF]">
              {hasReputation ? formatStatNumber(reputationScore) : (friendsCount > 0 ? formatStatNumber(friendsCount) : '—')}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
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
 * 3. Unified ProfileHeroSection
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
    return !Number.isNaN(n) && n > 0 ? n : null;  }, [level, profile?.level]);

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
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
