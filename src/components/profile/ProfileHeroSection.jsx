/**
 * Production-grade digital nation identity header.
 * High contrast, razor-sharp typography, immersive panoramic civic banner,
 * layered 3D avatar with live presence, and unified action controls.
 * 
 * Supports modular dual-column rendering:
 * - variant="banner": Renders the panoramic cinematic marquee banner with glass controls.
 * - variant="identity": Renders the sticky identity hub card with avatar, name, bio, CTAs, and live social stats.
 * - default: Renders the unified header for standalone screens.
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
 * 1. Panoramic Cinematic Marquee Banner
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
  return (
    <div className="relative w-full h-44 sm:h-52 md:h-60 lg:h-64 rounded-3xl overflow-hidden select-none border border-slate-200/60 dark:border-white/10 shadow-sm">
      {bannerImage ? (
        <img 
          src={bannerImage} 
          alt="Profile cover banner" 
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-[#110022] via-[#0B0F2A] to-[#00172B] relative">
          {/* Civic grid and aurora ambient lighting */}
          <div 
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}
          />
          <div 
            className="absolute -right-10 -top-10 w-96 h-96 rounded-full blur-3xl opacity-35"
            style={{ backgroundColor: levelColor }}
          />
          <div className="absolute -left-12 -bottom-12 w-80 h-80 bg-cyan-600/25 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />
        </div>
      )}

      {/* Floating Frosted Glass Navigation Bar on Banner */}
      <div className="absolute top-3.5 inset-x-3.5 sm:inset-x-5 flex items-center justify-between z-20">
        {/* Left: Back button (visitor) or Clean badge (owner) */}
        {!isOwner ? (
          <button
            type="button"
            onClick={onBack || (() => navigate(-1))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all text-xs font-semibold cursor-pointer shadow-sm active:scale-95"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/15 text-white/90 text-xs font-mono font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>@{username}</span>
          </div>
        )}

        {/* Right: Glass Quick Actions */}
        <div className="flex items-center gap-2">
          {onOpenQrCode && (
            <button
              type="button"
              onClick={onOpenQrCode}
              className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm active:scale-95"
              title="View Identity QR Code"
              aria-label="Identity QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          )}

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Share Profile Link"
              aria-label="Share Profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {isOwner ? (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Account Settings"
              aria-label="Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : (
            onOpenOptions && (
              <button
                type="button"
                onClick={onOpenOptions}
                className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Profile Options"
                aria-label="Profile Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
});

ProfileBanner.displayName = 'ProfileBanner';

/**
 * 2. Sticky Master Identity Rail Card
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
      "w-full rounded-3xl border transition-all shadow-sm relative overflow-hidden",
      isDark
        ? "bg-[#0B0F19] border-slate-800 text-white"
        : "bg-white border-slate-200 text-slate-900"
    )}>
      {/* Decorative ambient corner glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="p-5 sm:p-6 space-y-5">
        {/* Top: Avatar & Action Buttons */}
        <div className="flex items-start justify-between gap-3">
          {/* Avatar with Presence Ring */}
          <div className="relative shrink-0 group">
            <button
              type="button"
              onClick={onAvatarClick}
              className="relative block w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-transform cursor-pointer"
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-0.5">
                    <Camera className="w-4 h-4" />
                    <span>Edit</span>
                  </div>
                )}
              </div>
            </button>

            {/* Online Presence Status Dot */}
            <div 
              className={cn(
                "absolute bottom-1 right-1 w-4 h-4 rounded-full ring-3 ring-white dark:ring-[#0B0F19]",
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
              title={isOnline ? "Active now" : "Offline"} 
            />
          </div>

          {/* Quick Action Buttons for Owner / Visitor */}
          <div className="flex items-center gap-2 flex-wrap justify-end pt-1">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={onEditProfile || (() => navigate('/profile/edit'))}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/passport')}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer active:scale-95 text-amber-500",
                    isDark
                      ? "bg-slate-900/90 border-slate-700 hover:bg-slate-800"
                      : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
                  )}
                  title="View Official Digital Passport"
                >
                  <Crown className="w-4 h-4" />
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
                      "inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95",
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
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
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
                      "inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95",
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
              </>
            )}
          </div>
        </div>

        {/* Identity Information */}
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

          {/* Handle & Civic Rank (Unboxed clean text with bullet separators) */}
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={handleCopyHandle}
              className="font-mono hover:text-indigo-500 transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Click to copy handle"
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
                <span aria-hidden="true">·</span>
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
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Level {effectiveLevel}
                </span>
              </>
            )}

            {profile?.pronouns && (
              <>
                <span aria-hidden="true">·</span>
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
        <div className="pt-3 border-t border-slate-100 dark:border-white/10 grid grid-cols-4 gap-2 text-center select-none">
          {/* Creations */}
          <div className="space-y-0.5">
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

          {/* Mutuals / Trust */}
          <div 
            onClick={() => onMetricPress?.('friends')}
            className={cn(
              "space-y-0.5 transition-colors",
              onMetricPress ? "cursor-pointer hover:opacity-80" : ""
            )}
          >
            <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
              {friendsCount > 0 ? formatStatNumber(friendsCount) : (hasReputation ? `${reputationScore}` : '—')}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {friendsCount > 0 ? 'Mutuals' : 'Trust'}
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
  variant, // 'banner' | 'identity' | undefined (renders both)
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenQrScanner,
  onOpenLocationSetup,
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
  capabilities,
  analytics,
  onMetricPress,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Only a stored level is real. Never invent "Level 1"/"Citizen" for a profile
  // that has no progression data: absent data renders as unavailable.
  const explicitLevel = Number(level || profile?.level);
  const hasLevel = Number.isFinite(explicitLevel) && explicitLevel > 0;
  const effectiveLevel = hasLevel ? explicitLevel : null;

  const rankTitle = useMemo(() => {
    if (!hasLevel) return null;
    try {
      return getRankTitle(effectiveLevel);
    } catch {
      return null;
    }
  }, [hasLevel, effectiveLevel]);

  const citizenStanding = useMemo(() => {
    if (!hasLevel) return null;
    try {
      return getCitizenTier(effectiveLevel, Number(profile?.activeDaysCount) || 0);
    } catch {
      return null;
    }
  }, [hasLevel, effectiveLevel, profile?.activeDaysCount]);

  const levelColor = useMemo(() => {
    if (!hasLevel) return '#8B5CF6';
    try {
      return getLevelBandColor(effectiveLevel);
    } catch {
      return '#8B5CF6';
    }
  }, [hasLevel, effectiveLevel]);

  const rankLabel = profile?.primaryTitle || profile?.activeTitle?.name || rankTitle || citizenStanding?.tier || null;

  // Safe display strings
  const displayName = useMemo(() => {
    const raw = profile?.displayName || profile?.name;
    if (typeof raw === 'string' && raw.trim() && raw.trim() !== 'User' && raw.trim() !== 'Creator') {
      return raw.trim();
    }
    return isOwner ? 'Arvdoul Citizen' : 'Creator';
  }, [profile?.displayName, profile?.name, isOwner]);

  // Derive genuine unique username
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
  const bannerImage = profile?.bannerUrl || profile?.coverPhoto || profile?.coverURL || null;
  const isOnline = Boolean(profile?.presence?.isOnline || profile?.isOnline);

  const joinedDate = useMemo(() => {
    if (profile?.createdAt) {
      try {
        const date = profile.createdAt?.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
        if (date && !isNaN(date.getTime())) {
          return `Citizen since ${date.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
        }
      } catch {
        return '';
      }
    }
    return '';
  }, [profile?.createdAt]);

  if (variant === 'banner') {
    return (
      <ProfileBanner
        bannerImage={bannerImage}
        levelColor={levelColor}
        isOwner={isOwner}
        username={username}
        onBack={onBack}
        onOpenQrCode={onOpenQrCode}
        onShare={onShare}
        onOpenOptions={onOpenOptions}
        navigate={navigate}
      />
    );
  }

  if (variant === 'identity') {
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
  }

  // Default: Unified layout for single-column/preview usage
  return (
    <div className="w-full space-y-4">
      <ProfileBanner
        bannerImage={bannerImage}
        levelColor={levelColor}
        isOwner={isOwner}
        username={username}
        onBack={onBack}
        onOpenQrCode={onOpenQrCode}
        onShare={onShare}
        onOpenOptions={onOpenOptions}
        navigate={navigate}
      />
      <div className="-mt-16 sm:-mt-20 px-2 sm:px-4 relative z-10">
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
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
