/**
 * Production-grade digital nation identity header.
 * High contrast, razor-sharp typography, immersive civic presence,
 * layered 3D avatar with live presence, and unified action controls.
 * 
 * Supports modular dual-column rendering:
 * - variant="identity": Renders the elevated top identity card containing the profile picture with avatar, name, bio, CTAs, and live social stats.
 * - variant="banner": Lightweight backwards-compatible banner.
 * - default: Renders the elevated top identity card containing the profile picture.
 * 
 * Adheres strictly to Zero-Pill discipline and anti-slop principles.
 * Never fabricates citizen standing (absent level remains null/unavailable).
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
  Loader2,
  Camera,
  Copy,
  Check,
  Sparkles,
  Users,
  Eye,
  FileText,
  HeartHandshake,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { getReputationBand } from '../../shared/levelConfig.cjs';
import { toast } from 'sonner';

// Fallbacks return "unknown" (null), never a fabricated Citizen/Level 1 standing
const getRankTitle = LevelModule.getRankTitle || (() => null);
const getCitizenTier = LevelModule.getCitizenTier || (() => null);
const getLevelBandColor = LevelModule.getLevelBandColor || (() => '#8B5CF6');

const formatStatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

/**
 * 1. Lightweight Banner for legacy or preview usage
 */
export const ProfileBanner = memo(({
  bannerImage = null,
  levelColor = '#8B5CF6',
  isOwner = false,
  username = '',
  onBack,
  onOpenQrCode,
  onShare,
  onOpenOptions,
  navigate,
}) => {
  return null;
});

ProfileBanner.displayName = 'ProfileBanner';

/**
 * 2. Master Top Card Containing Profile Picture & Full Identity Suite
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
  onInsightsPress,
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
  const repBand = hasReputation ? getReputationBand(reputationScore) : null;

  const canShowFollowers = capabilities?.canViewFollowers ?? true;
  const canShowFollowing = capabilities?.canViewFollowing ?? true;

  return (
    <div className={cn(
      "w-full rounded-3xl border transition-all shadow-md relative overflow-hidden",
      isDark
        ? "bg-[#0B0F19] border-slate-800 text-white"
        : "bg-white border-slate-200 text-slate-900"
    )}>
      {/* Decorative Top Horizon Strip with Glass Action Controls */}
      <div className="relative w-full h-24 sm:h-28 overflow-hidden bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40 border-b border-white/5">
        {/* Civic grid and aurora accent lighting */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}
        />
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Floating Quick Action Icons on Top-Right */}
        <div className="absolute top-3 right-3 sm:top-3.5 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-10">
          {isOwner ? (
            <>
              {onOpenPerspective && (
                <button
                  type="button"
                  onClick={onOpenPerspective}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="View Profile As Perspective"
                  aria-label="View Profile As"
                >
                  <Eye className="w-4 h-4 text-amber-300" />
                </button>
              )}
              {onOpenQrCode && (
                <button
                  type="button"
                  onClick={onOpenQrCode}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="View Identity QR Code"
                  aria-label="Identity QR Code"
                >
                  <QrCode className="w-4 h-4 text-purple-200" />
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Share Profile"
                  aria-label="Share Profile"
                >
                  <Share2 className="w-4 h-4 text-cyan-200" />
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/passport')}
                className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-amber-400 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Official Digital Passport"
                aria-label="Digital Passport"
              >
                <Crown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                title="Account Settings"
                aria-label="Account Settings"
              >
                <Settings className="w-4 h-4 text-slate-200" />
              </button>
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={onOpenOptions}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="More Options"
                  aria-label="More Options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Share Profile"
                  aria-label="Share Profile"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {onOpenQrCode && (
                <button
                  type="button"
                  onClick={onOpenQrCode}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Identity QR Code"
                  aria-label="Identity QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              )}
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={onOpenOptions}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/15 text-white transition-all cursor-pointer shadow-sm active:scale-95"
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

      <div className="px-5 sm:px-6 pb-6 pt-0 space-y-4">
        {/* Avatar Overlap Row with Primary Action CTA */}
        <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-2">
          {/* Layered Profile Picture (Avatar) */}
          <div className="relative shrink-0 group">
            <button
              type="button"
              onClick={onAvatarClick}
              className="relative block w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-transform cursor-pointer"
              title={isOwner ? "Change profile photo" : "View avatar"}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-4 ring-white dark:ring-[#0B0F19] relative">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Camera icon overlay for owner */}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-0.5">
                    <Camera className="w-4 h-4" />
                    <span>Edit</span>
                  </div>
                )}
              </div>
            </button>
            {/* Live Presence Status Dot */}
            <div 
              className={cn(
                "absolute bottom-1 right-1 w-4 h-4 rounded-full ring-3 ring-white dark:ring-[#0B0F19]",
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
              title={isOnline ? "Active now" : "Offline"} 
            />
          </div>

          {/* Primary Action Button (Right side of Avatar) */}
          <div className="flex items-center gap-2 pt-1">
            {isOwner ? (
              <button
                type="button"
                onClick={onEditProfile || (() => navigate('/profile/edit'))}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {friendshipStatus && friendshipStatus !== 'none' ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95",
                      friendshipStatus === 'friends'
                        ? (isDark ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-slate-100 text-slate-800 border border-slate-200")
                        : (isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-800 border border-amber-200")
                    )}
                  >
                    {friendRequestLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : friendshipStatus === 'friends' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Friends</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Requested</span>
                      </>
                    )}
                  </button>
                ) : onFriendRequestToggle && !onFollowToggle ? (
                  <button
                    type="button"
                    onClick={onFriendRequestToggle}
                    disabled={friendRequestLoading}
                    className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
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
                      "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95",
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
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
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
                    "p-2 rounded-xl border transition-all cursor-pointer active:scale-95",
                    isDark
                      ? "bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                  )}
                  title="Direct Message"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>

                {onOpenTipModal && (
                  <button
                    type="button"
                    onClick={onOpenTipModal}
                    className={cn(
                      "p-2 rounded-xl border transition-all text-amber-500 cursor-pointer active:scale-95",
                      isDark
                        ? "bg-slate-900/90 border-slate-700 hover:bg-slate-800"
                        : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
                    )}
                    title="Send Coin Tip"
                  >
                    <Coins className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Identity Information Suite */}
        <div className="space-y-1.5">
          {/* Display Name + Verified Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              {displayName}
            </h1>
            {Boolean(profile?.isVerified || profile?.verified) && (
              <BadgeCheck 
                className="w-5 h-5 text-blue-500 fill-blue-500/10 shrink-0" 
                title="Verified Citizen of Arvdoul" 
              />
            )}
          </div>

          {/* Unique Username by UserService (with instant copy feedback) */}
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={handleCopyHandle}
              className="font-mono text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              title="Click to copy unique username"
            >
              <span>@{username}</span>
              {copiedHandle ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
              )}
            </button>

            {rankLabel && (
              <>
                <span aria-hidden="true" className="opacity-40">·</span>
                <button
                  type="button"
                  onClick={() => navigate(isOwner ? '/titles' : `/passport/${profileUid}`)}
                  className="text-purple-600 dark:text-purple-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>{rankLabel}</span>
                </button>
              </>
            )}

            {hasLevel && (
              <>
                <span aria-hidden="true" className="opacity-40">·</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Level {effectiveLevel}
                </span>
              </>
            )}

            {profile?.pronouns && (
              <>
                <span aria-hidden="true" className="opacity-40">·</span>
                <span className="text-slate-400">{profile.pronouns}</span>
              </>
            )}
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 pt-1 whitespace-pre-line font-normal">
              {bio}
            </p>
          )}

          {/* Metadata Row: Location, Website, Joined Date */}
          <div className="flex items-center gap-3 flex-wrap pt-2 text-xs text-slate-500 dark:text-slate-400">
            {location ? (
              <button
                type="button"
                onClick={isOwner && onOpenLocationSetup ? onOpenLocationSetup : undefined}
                className={cn(
                  "inline-flex items-center gap-1",
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

        {/* Core Social & Civic Metrics Strip (Zero-Pill Discipline) */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-white/10 grid grid-cols-4 gap-2 text-center select-none">
          {/* Creations */}
          <div 
            onClick={() => onMetricPress?.('posts')}
            className={cn(
              "space-y-0.5 transition-colors",
              onMetricPress ? "cursor-pointer hover:opacity-80" : ""
            )}
          >
            <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
              {formatStatNumber(postsCount)}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Creations
            </div>
          </div>

          {/* Followers */}
          <div 
            onClick={() => canShowFollowers && onMetricPress?.('followers')}
            className={cn(
              "space-y-0.5 transition-colors",
              canShowFollowers && onMetricPress ? "cursor-pointer hover:opacity-80" : ""
            )}
          >
            <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
              {canShowFollowers ? formatStatNumber(followersCount) : '—'}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Followers
            </div>
          </div>

          {/* Following */}
          <div 
            onClick={() => canShowFollowing && onMetricPress?.('following')}
            className={cn(
              "space-y-0.5 transition-colors",
              canShowFollowing && onMetricPress ? "cursor-pointer hover:opacity-80" : ""
            )}
          >
            <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
              {canShowFollowing ? formatStatNumber(followingCount) : '—'}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Following
            </div>
          </div>

          {/* Reputation / Mutual Friends */}
          <div 
            onClick={() => onMetricPress?.('reputation')}
            className={cn(
              "space-y-0.5 transition-colors",
              onMetricPress ? "cursor-pointer hover:opacity-80" : ""
            )}
          >
            <div className="text-sm sm:text-base font-black tracking-tight text-purple-600 dark:text-purple-400">
              {hasReputation ? formatStatNumber(reputationScore) : (friendsCount > 0 ? formatStatNumber(friendsCount) : '—')}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {hasReputation ? (repBand?.name || 'Reputation') : 'Friends'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileIdentityCard.displayName = 'ProfileIdentityCard';

/**
 * 3. Unified ProfileHeroSection (Backwards compatible & modular)
 */
const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  variant = 'identity', // 'identity' is now default top card
  onOpenQrCode,
  onOpenQrScanner,
  onOpenLocationSetup,
  onOpenNotifications,
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
  onBack,
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

  const levelColor = useMemo(() => {
    if (!hasLevel) return '#8B5CF6';
    return getLevelBandColor(effectiveLevel);
  }, [effectiveLevel, hasLevel]);

  const displayName = useMemo(() => {
    return profile?.displayName || profile?.name || 'Citizen';
  }, [profile?.displayName, profile?.name]);

  const username = useMemo(() => {
    return (
      profile?.username ||
      'citizen'
    );
  }, [profile?.username]);

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
