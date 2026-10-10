/**
 * Production-grade digital nation identity header.
 * High contrast, razor-sharp typography, immersive panoramic civic banner,
 * layered 3D avatar with live presence, and unified action controls.
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
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { toast } from 'sonner';

// Fallbacks return "unknown" (null), never a fabricated Citizen/Level 1 standing
const getRankTitle = LevelModule.getRankTitle || (() => null);
const getCitizenTier = LevelModule.getCitizenTier || (() => null);
const getLevelBandColor = LevelModule.getLevelBandColor || (() => '#8B5CF6');

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
  const [copiedHandle, setCopiedHandle] = useState(false);

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

  const handleCopyHandle = useCallback((e) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(`@${username}`);
      setCopiedHandle(true);
      toast.success(`Copied @${username} to clipboard`);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  }, [username]);

  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid);
  const bio = typeof profile?.bio === 'string' ? profile.bio.trim() : '';
  const location = typeof profile?.location === 'string' ? profile.location : (typeof profile?.city === 'string' ? profile.city : '');
  const website = typeof profile?.website === 'string' ? profile.website : (typeof profile?.link === 'string' ? profile.link : '');
  const bannerImage = profile?.bannerUrl || profile?.coverPhoto || profile?.coverURL || null;
  const isOnline = Boolean(profile?.presence?.isOnline || profile?.isOnline);

  // Format joined date
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

  const profileUid = profile?.id || profile?.uid;

  return (
    <div className="w-full space-y-3">
      {/* 1. Master Identity Card with Panoramic Civic Backdrop */}
      <div className={cn(
        "rounded-3xl border overflow-hidden transition-all shadow-sm relative",
        isDark
          ? "bg-[#0B0F19] border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-900"
      )}>
        {/* Panoramic Atmospheric Civic Banner */}
        <div className="relative w-full h-36 sm:h-48 overflow-hidden select-none">
          {bannerImage ? (
            <img 
              src={bannerImage} 
              alt="Profile cover banner" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#18002E] via-[#0B0F2A] to-[#001E33] relative">
              {/* Civic grid and aurora ambient lighting */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }}
              />
              <div 
                className="absolute -right-12 -top-12 w-64 h-64 rounded-full blur-3xl opacity-35"
                style={{ backgroundColor: levelColor }}
              />
              <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-cyan-600/25 rounded-full blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            </div>
          )}

          {/* Floating Frosted Glass Navigation Bar on Banner */}
          <div className="absolute top-3 inset-x-3 sm:inset-x-5 flex items-center justify-between z-20">
            {/* Left: Back button (visitor) or Clean badge (owner) */}
            {!isOwner ? (
              <button
                type="button"
                onClick={onBack || (() => navigate(-1))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all text-xs font-semibold cursor-pointer shadow-sm"
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
                  className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm"
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
                  className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm"
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
                  className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm"
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
                    className="p-2 rounded-xl bg-black/45 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all cursor-pointer shadow-sm"
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

        {/* Content Body: Avatar overlap, Identity typography, and Action controls */}
        <div className="px-5 sm:px-7 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Overlapping 3D Avatar */}
            <div className="relative shrink-0 z-10 group">
              <button
                type="button"
                onClick={onAvatarClick}
                className="relative block w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
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
                  "absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full ring-3 ring-white dark:ring-[#0B0F19]",
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                )}
                title={isOnline ? "Active now" : "Offline"} 
              />
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 shrink-0">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={onEditProfile || (() => navigate('/profile/edit'))}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/passport')}
                    className={cn(
                      "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer active:scale-95",
                      isDark
                        ? "bg-slate-900/90 border-slate-700 text-indigo-400 hover:bg-slate-800"
                        : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 shadow-sm"
                    )}
                    title="View Official Digital Passport"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Passport</span>
                  </button>

                  <button
                    type="button"
                    onClick={onInsightsPress || (() => navigate('/profile/analytics'))}
                    className={cn(
                      "hidden sm:inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer active:scale-95",
                      isDark
                        ? "bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800"
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
                        "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer active:scale-95",
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
                      ) : friendshipStatus === 'pending' ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Requested</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Accept Friend</span>
                        </>
                      )}
                    </button>
                  ) : onFriendRequestToggle && !onFollowToggle ? (
                    <button
                      type="button"
                      onClick={onFriendRequestToggle}
                      disabled={friendRequestLoading}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
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
                        "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer active:scale-95",
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
                      "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer active:scale-95",
                      isDark
                        ? "bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800"
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
                        "p-2 rounded-xl border transition-all text-amber-500 cursor-pointer active:scale-95",
                        isDark
                          ? "bg-slate-900/90 border-slate-700 hover:bg-slate-800"
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

          {/* Identity Typography Section */}
          <div className="space-y-2">
            {/* Display Name + Verified Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
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

            {/* Bio with line break support */}
            {bio && (
              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 pt-0.5 whitespace-pre-line max-w-2xl font-normal">
                {bio}
              </p>
            )}

            {/* Metadata row: Location, Website, Joined Date, Profession */}
            <div className="flex items-center gap-3.5 flex-wrap pt-1 text-xs text-slate-500 dark:text-slate-400">
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

              {profile?.profession && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span>·</span>
                  <span>{profile.profession}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
