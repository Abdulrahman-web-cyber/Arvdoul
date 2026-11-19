/**
 * Production-grade Architectural Identity Hero for Arvdoul Profiles (Owner & Visitor).
 * Uses editorial hierarchy, self-hosted Clash Display + Inter typography, crisp hairline
 * separation, unboxed civic standing metadata, and a single-row primary/secondary CTA bar.
 *
 * @component
 */

import { memo, useMemo, useState, useCallback } from "react";
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
  BarChart2,
  ChevronLeft,
  Shield,
  ShieldCheck,
  Star,
  Lock,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickHandle, deriveHandle, pickDisplayName, resolveRoyalFlag } from '../../services/profileReadModel.js';
import { toast } from 'sonner';
import ProfileSystemRoadmapModal from './ProfileSystemRoadmapModal';
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT, brandRgba } from '../../design-system/tokens.js';

const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const getRoyalEligibility = LevelModule.getRoyalEligibility || (() => ({ eligible: false }));
const getIdentityBadge = LevelModule.getIdentityBadge || (() => null);

// Format joined date nicely. Returns null when the timestamp is absent or
// unparseable so the caller renders nothing rather than a fabricated date.
const formatJoinedDate = (createdAt) => {
  if (!createdAt) return null;
  try {
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return null;
  }
};

/**
 * 1. Legacy Banner export for compatibility
 */
export const ProfileBanner = memo(() => null);
ProfileBanner.displayName = 'ProfileBanner';

/**
 * 2. Streamlined Civic Standing & Digital Passport Panel
 */
export const ProfileLevelProgressCard = memo(({
  level = null,
  experience = null,
  isOwner = false,
  isDark = false,
  userId = null,
  showLevel = true,
  navigate,
  onOpenRoadmap,
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

  if (!showLevel && !isOwner) {
    return (
      <div
        className={cn(
          "w-full lg:w-64 shrink-0 flex flex-col justify-between gap-3 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l",
          isDark ? "border-white/[0.08] text-white" : "border-slate-200/80 text-slate-900"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            isDark ? "bg-white/[0.05] text-slate-300" : "bg-slate-100 text-slate-600"
          )}>
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold">Civic Standing</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Hidden by owner</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate?.(passportUrl)}
          className={cn(
            "w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            isDark
              ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200"
              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-arvdoul-purple" />
          <span>Digital Passport</span>
        </button>
      </div>
    );
  }

  if (!levelInfo) {
    const handleOpenCitizenship = () => (onOpenRoadmap ? onOpenRoadmap('citizenship') : navigate?.(passportUrl));
    return (
      <div
        onClick={handleOpenCitizenship}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleOpenCitizenship();
          }
        }}
        className={cn(
          "w-full lg:w-64 shrink-0 flex flex-col justify-between gap-3 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l cursor-pointer group/levelcard",
          isDark ? "border-white/[0.08] text-white" : "border-slate-200/80 text-slate-900"
        )}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            isDark ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-purple-700"
          )}>
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold">Civic Standing</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Initialize citizenship</div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate?.(passportUrl);
          }}
          className={cn(
            "w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            isDark
              ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200"
              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-arvdoul-purple" />
          <span>Digital Passport</span>
        </button>
      </div>
    );
  }

  const currentLevel = levelInfo.level;
  const currentXp = levelInfo.xpIntoLevel ?? 0;
  const isMaxLevel = Boolean(levelInfo.isMaxLevel) || levelInfo.nextLevelXp === null;
  const levelSpan = isMaxLevel ? null : levelInfo.nextLevelXp - levelInfo.currentLevelXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round(levelInfo.progress ?? 0)));

  const handleOpenLevels = () => (onOpenRoadmap ? onOpenRoadmap('levels') : navigate?.(passportUrl));

  return (
    <div
      onClick={handleOpenLevels}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleOpenLevels();
        }
      }}
      className={cn(
        "w-full lg:w-64 shrink-0 flex flex-col justify-between gap-3 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l cursor-pointer group/levelcard",
        isDark ? "border-white/[0.08] text-white" : "border-slate-200/80 text-slate-900"
      )}
      role="button"
      tabIndex={0}
      title="View Level Progression & Citizenship Roadmap"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <polygon
                points="50 3, 90 25, 90 75, 50 97, 10 75, 10 25"
                className="fill-arvdoul-purple stroke-purple-400/40"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-bold tabular-nums">
              {currentLevel}
            </span>
          </div>

          <div>
            <div className="font-display text-sm font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
              Level {currentLevel}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {isMaxLevel
                ? `${currentXp.toLocaleString()} XP · Apex`
                : `${currentXp.toLocaleString()} / ${levelSpan.toLocaleString()} XP`}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate?.(passportUrl);
          }}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer shrink-0",
            isDark
              ? "bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border-white/10"
              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          )}
          title="Open Digital Passport"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-arvdoul-purple" />
          <span>Passport</span>
        </button>
      </div>

      {/* Slim precision progress track */}
      <div className="space-y-1">
        <div className="w-full h-1.5 rounded-full bg-slate-200/90 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--arv-brand-violet) 0%, var(--arv-brand-cyan) 100%)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          <span>Citizenship Roadmap</span>
          <span>{progressPercent}%</span>
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
  level = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenLocationSetup,
  onOpenOptions,
  onAvatarClick,
  onShare,
  onEditProfile,
  onOpenQuickEdit,
  onOpenVerificationModal,
  onInsightsPress,
  onFollowToggle,
  isFollowing = false,
  requestStatus = null,
  followLoading = false,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onCancelFriendRequest,
  onOpenTipModal,
  onOpenMessages,
  capabilities,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const callsEnabled = useFeatureFlag('messaging.calls');
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState('levels');

  const handleOpenRoadmap = useCallback((tab = 'levels') => {
    setRoadmapInitialTab(tab);
    setShowRoadmapModal(true);
  }, []);

  const profileUid = profile?.id || profile?.uid || null;

  const handleStartCall = useCallback(async () => {
    if (!profileUid) return;
    try {
      const { getMessagingService } = await import('../../services/messagesService.js');
      const { conversation } = await getMessagingService().createConversation([profileUid]);
      navigate(`/call/${conversation.id}?type=audio`);
    } catch {
      toast.error('Could not start call');
    }
  }, [profileUid, navigate]);

  const displayName = pickDisplayName([profile?.displayName, profile?.name], {
    fallback: profileUid ? `user ${String(profileUid).slice(0, 6)}` : '—',
  });
  const username = pickHandle([profile?.username, profile?.handle]) || deriveHandle(displayName) || null;
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profileUid);

  const isVerified = Boolean(profile?.isVerified === true);
  const isCreator = Boolean(profile?.isCreator || profile?.creatorStatus === 'active');
  const isPremium = Boolean(profile?.isPremium || profile?.subscription);

  const creatorBadgeLabel = useMemo(
    () => getIdentityBadge(profile?.level, { isCreator })?.label || null,
    [profile?.level, isCreator],
  );

  const userLevel = typeof profile?.level === 'number' ? profile.level : (typeof level === 'number' ? level : null);
  const verificationLevelGate = LevelModule.LEVEL_GATES?.verifiedPriority ?? null;
  const isLevelEligibleForVerification = userLevel !== null && verificationLevelGate !== null && userLevel >= verificationLevelGate;
  const sovereignGate = LevelModule.LEVEL_GATES?.sovereign ?? null;

  const isDefaultAura = useMemo(() => {
    const aura = profile?.crestAura;
    if (aura === 'purple' || aura === 'royal' || aura === 'cyan' || aura === 'emerald' || aura === 'gold') return false;
    if (sovereignGate !== null && userLevel !== null && userLevel >= sovereignGate) return false;
    return true;
  }, [profile?.crestAura, userLevel, sovereignGate]);

  const crestAuraRing = useMemo(() => {
    const aura = profile?.crestAura;
    if (aura === 'purple') return 'bg-gradient-to-tr from-purple-500 via-indigo-600 to-fuchsia-500';
    if (aura === 'royal' || (sovereignGate !== null && userLevel !== null && userLevel >= sovereignGate)) {
      return 'bg-gradient-to-tr from-blue-500 via-indigo-700 to-cyan-400';
    }
    if (aura === 'cyan') return 'bg-gradient-to-tr from-cyan-400 via-teal-500 to-sky-300';
    if (aura === 'emerald') return 'bg-gradient-to-tr from-emerald-400 via-green-600 to-teal-300';
    if (aura === 'gold') return 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-300';
    return 'bg-arvdoul-gradient';
  }, [profile?.crestAura, userLevel, sovereignGate]);

  const isRoyal = useMemo(() => {
    if (resolveRoyalFlag(profile)) return true;
    const stats = {
      level: profile?.level ?? level ?? null,
      activeDays: profile?.activeDaysCount ?? profile?.activeDays ?? null,
      reputationScore: profile?.reputationScore ?? profile?.reputation ?? null,
      contributionScore: profile?.contributionScore ?? profile?.contribution ?? null,
      influenceScore: profile?.influenceScore ?? profile?.influence ?? null,
      achievements: profile?.achievements ?? null,
      policyStanding: profile?.policyStanding || profile?.accountStatus || null,
    };
    const dukeCheck = getRoyalEligibility('duke', stats);
    if (dukeCheck.eligible) return true;
    const kingCheck = getRoyalEligibility('king', stats);
    return kingCheck.eligible;
  }, [profile, level]);

  const isOnline = Boolean(profile?.presence?.status === 'online' || profile?.isOnline === true);

  const handleLabel = username || displayName;
  const handleCopyHandle = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(`@${handleLabel}`);
      setCopiedHandle(true);
      toast.success(`Copied @${handleLabel} to clipboard`);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      toast.info(`@${handleLabel}`);
    }
  }, [handleLabel]);

  const bio = (typeof profile?.bio === 'string' && profile.bio.trim())
    ? profile.bio.trim()
    : (typeof profile?.about === 'string' ? profile.about.trim() : '');
  const tagline = (typeof profile?.tagline === 'string' && profile.tagline.trim()) ? profile.tagline.trim() : '';
  const location = (typeof profile?.location === 'string' && profile.location.trim()) ? profile.location.trim() : '';
  const website = (typeof profile?.website === 'string' && profile.website.trim()) ? profile.website.trim() : '';
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;

  const secondaryBtnClass = cn(
    "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0",
    isDark
      ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-100"
      : "bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 shadow-sm"
  );

  const iconBtnClass = cn(
    "inline-flex items-center justify-center w-11 h-11 rounded-xl border transition-colors cursor-pointer shrink-0",
    isDark
      ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200"
      : "bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 shadow-sm"
  );

  return (
    <section
      aria-label="Profile identity"
      className={cn(
        "w-full pb-6 border-b transition-colors",
        isDark ? "border-white/[0.08] text-white" : "border-slate-200/80 text-slate-900"
      )}
    >
      {/* Top Utility Row (Back navigation / Refresh trigger) */}
      {(onBack || onRefresh) && (
        <div className="flex items-center justify-between gap-2 mb-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer",
                isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <span />
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh profile"
              title="Refresh profile"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-60",
                isDark
                  ? "border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      )}

      {/* Main Editorial Identity Row */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6 lg:gap-8">
        {/* Left: Portrait + Typography & Metadata */}
        <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6 min-w-0 flex-1 w-full">
          {/* Circular Portrait */}
          <div className="relative shrink-0">
            <div
              className={cn("w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full p-[3px] relative transition-transform duration-300", crestAuraRing)}
              style={isDefaultAura ? { boxShadow: `0 12px 28px ${brandRgba(isDark ? 0.28 : 0.16)}` } : undefined}
            >
              <button
                type="button"
                onClick={onAvatarClick}
                className={cn(
                  "w-full h-full rounded-full overflow-hidden ring-2 block relative cursor-pointer group",
                  isDark ? "bg-[#080F2E] ring-[#03071B]" : "bg-slate-100 ring-[#F6F8FC]"
                )}
                aria-label="Profile Avatar"
              >
                <LazyImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {isOwner && (
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>

              {/* Presence Dot */}
              <div
                className={cn(
                  "absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full ring-2",
                  isDark ? "ring-[#03071B]" : "ring-[#F6F8FC]",
                  isOnline ? "bg-emerald-500" : "bg-slate-400"
                )}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
          </div>

          {/* Identity & Editorial Details */}
          <div className="space-y-2.5 min-w-0 flex-1 w-full">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                  {displayName}
                </h1>

                {isVerified && (
                  <button
                    type="button"
                    onClick={onOpenVerificationModal}
                    title="Verified Account • Click to view credentials"
                    aria-label="Verified Account credentials"
                    className="inline-flex items-center justify-center text-arvdoul-blue shrink-0 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 fill-arvdoul-purple text-white" />
                  </button>
                )}
              </div>

              {/* Unboxed @handle + inline standing strip */}
              <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap text-xs sm:text-[13px]">
                <button
                  type="button"
                  onClick={handleCopyHandle}
                  className="group/handle inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 hover:text-arvdoul-purple dark:hover:text-purple-300 transition-colors cursor-pointer"
                  title="Click to copy handle"
                >
                  <span>@{handleLabel}</span>
                  {copiedHandle ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-50 group-hover/handle:opacity-100 transition-opacity" />
                  )}
                </button>

                {isVerified ? (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={onOpenVerificationModal}
                      className="inline-flex items-center gap-1 font-semibold text-arvdoul-purple dark:text-purple-300 hover:underline cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </button>
                  </>
                ) : isOwner ? (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={onOpenVerificationModal}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-arvdoul-purple dark:hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      {isLevelEligibleForVerification ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-arvdoul-purple" />
                          <span>Get Verified</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Level {verificationLevelGate} to Verify</span>
                        </>
                      )}
                    </button>
                  </>
                ) : null}

                {isCreator && creatorBadgeLabel && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{creatorBadgeLabel}</span>
                    </span>
                  </>
                )}

                {isPremium && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-300">
                      <Crown className="w-3.5 h-3.5" />
                      <span>Premium</span>
                    </span>
                  </>
                )}

                {isRoyal && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() => handleOpenRoadmap('royals')}
                      className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer"
                      title="View Royal Family Privileges & Standing"
                    >
                      <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Royal Family</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bio & Tagline */}
            {(bio || isOwner || tagline) && (
              <div className="space-y-1 max-w-2xl text-sm text-slate-700 dark:text-slate-200">
                {bio ? (
                  <div className="flex items-start gap-2 group/bio">
                    <p className="leading-relaxed">{bio}</p>
                    {isOwner && onOpenQuickEdit && (
                      <button
                        type="button"
                        onClick={() => onOpenQuickEdit('bio')}
                        className="text-slate-400 hover:text-arvdoul-purple opacity-70 hover:opacity-100 transition-opacity p-1 shrink-0 cursor-pointer"
                        title="Edit Bio"
                        aria-label="Edit Bio"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : isOwner ? (
                  <button
                    type="button"
                    onClick={() => (onOpenQuickEdit ? onOpenQuickEdit('bio') : (onEditProfile ? onEditProfile() : navigate('/profile/edit')))}
                    className="text-xs text-arvdoul-purple dark:text-purple-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Add a bio to your profile</span>
                  </button>
                ) : null}

                {tagline && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-snug">
                    {tagline}
                  </p>
                )}
              </div>
            )}

            {/* Coordinates: Location, Website, Joined Date */}
            {(location || website || joinedDate || isOwner) && (
              <div className="flex items-center gap-x-3.5 gap-y-1.5 flex-wrap pt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {location ? (
                  isOwner ? (
                    <button
                      type="button"
                      onClick={onOpenLocationSetup}
                      className="inline-flex items-center gap-1 hover:text-arvdoul-purple dark:hover:text-purple-300 transition-colors cursor-pointer"
                      title="Change location"
                    >
                      <MapPin className="w-3.5 h-3.5 text-arvdoul-purple" />
                      <span>{location}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{location}</span>
                    </span>
                  )
                ) : isOwner ? (
                  <button
                    type="button"
                    onClick={onOpenLocationSetup}
                    className="inline-flex items-center gap-1 text-arvdoul-purple dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Add location</span>
                  </button>
                ) : null}

                {website ? (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-arvdoul-purple dark:text-purple-400 hover:underline font-medium"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{website.replace(/^https?:\/\//, '')}</span>
                  </a>
                ) : isOwner && onOpenQuickEdit ? (
                  <button
                    type="button"
                    onClick={() => onOpenQuickEdit('website')}
                    className="inline-flex items-center gap-1 text-arvdoul-purple dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Add link</span>
                  </button>
                ) : null}

                {joinedDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{joinedDate}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Streamlined Civic Standing & Digital Passport */}
        <ProfileLevelProgressCard
          level={profile?.level ?? level ?? null}
          experience={profile?.experience ?? null}
          isOwner={isOwner}
          isDark={isDark}
          userId={profileUid}
          showLevel={profile?.showLevel !== false}
          navigate={navigate}
          onOpenRoadmap={handleOpenRoadmap}
        />
      </div>

      {/* Primary Action Strip — clear hierarchy without boxed sub-cards */}
      <div className="mt-6 flex items-center gap-2 sm:gap-2.5 flex-wrap">
        {isOwner ? (
          <>
            <button
              type="button"
              onClick={onEditProfile || (() => navigate('/profile/edit'))}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: BRAND_GRADIENT }}
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={onShare}
              className={secondaryBtnClass}
            >
              <Share2 className="w-4 h-4 text-arvdoul-purple" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={onOpenQrCode}
              className={secondaryBtnClass}
            >
              <QrCode className="w-4 h-4 text-arvdoul-purple" />
              <span>QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coins')}
              className={secondaryBtnClass}
            >
              <Coins className="w-4 h-4 text-amber-500" />
              <span>Coins</span>
            </button>

            <button
              type="button"
              onClick={onInsightsPress || (() => navigate('/profile/analytics'))}
              className={secondaryBtnClass}
            >
              <BarChart2 className="w-4 h-4 text-arvdoul-blue" />
              <span>Insights</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={iconBtnClass}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {/* Primary Follow CTA */}
            <button
              type="button"
              onClick={onFollowToggle}
              disabled={followLoading || !onFollowToggle}
              aria-disabled={followLoading || !onFollowToggle}
              title={!onFollowToggle ? 'Preview only — this is how your profile looks to others' : undefined}
              className={cn(
                "flex-1 sm:flex-none sm:min-w-[148px] min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap",
                !onFollowToggle && "opacity-60 cursor-not-allowed",
                isFollowing || requestStatus === 'pending'
                  ? (isDark
                      ? "bg-white/10 hover:bg-white/15 border border-white/15 text-white"
                      : "bg-slate-200/80 hover:bg-slate-300/80 border border-slate-300 text-slate-900")
                  : "text-white shadow-md hover:brightness-110"
              )}
              style={!(isFollowing || requestStatus === 'pending') ? { background: BRAND_GRADIENT } : undefined}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Following</span>
                </>
              ) : requestStatus === 'pending' ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Requested</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>

            {/* Message CTA */}
            <button
              type="button"
              onClick={onOpenMessages}
              disabled={!onOpenMessages}
              aria-disabled={!onOpenMessages}
              title={!onOpenMessages ? 'Preview only' : undefined}
              className={cn(
                secondaryBtnClass,
                "flex-1 sm:flex-none px-4 py-2.5",
                (!onOpenMessages || capabilities?.canMessage === false) && "opacity-60 cursor-not-allowed"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Message</span>
            </button>

            {/* Friend Request CTA */}
            {onFriendRequestToggle && (
              <button
                type="button"
                onClick={friendshipStatus === 'pending' && onCancelFriendRequest ? onCancelFriendRequest : onFriendRequestToggle}
                disabled={friendRequestLoading || friendshipStatus === 'friends'}
                className={cn(
                  "min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-[13px] border transition-colors whitespace-nowrap shrink-0",
                  friendshipStatus === 'friends'
                    ? (isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700")
                    : friendshipStatus === 'received'
                    ? "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white shadow-sm cursor-pointer"
                    : friendshipStatus === 'pending'
                    ? (isDark ? "bg-white/5 hover:bg-red-500/10 border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-300 cursor-pointer" : "bg-white hover:bg-red-50 border-slate-200 hover:border-red-200 text-slate-700 hover:text-red-600 cursor-pointer")
                    : cn(secondaryBtnClass, "py-2.5")
                )}
              >
                {friendshipStatus === 'friends' ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Friends</span>
                  </>
                ) : friendshipStatus === 'received' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Accept Request</span>
                  </>
                ) : friendshipStatus === 'pending' ? (
                  <>
                    <X className="w-4 h-4" />
                    <span>{onCancelFriendRequest ? 'Cancel Request' : 'Request Sent'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Add Friend</span>
                  </>
                )}
              </button>
            )}

            {/* Utility Icon Actions */}
            {callsEnabled && (
              <button
                type="button"
                onClick={handleStartCall}
                disabled={!onOpenMessages}
                aria-disabled={!onOpenMessages}
                className={cn(iconBtnClass, !onOpenMessages && "opacity-60 cursor-not-allowed")}
                title={onOpenMessages ? 'Audio Call' : 'Preview only'}
                aria-label="Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenTipModal}
              disabled={!onOpenTipModal}
              aria-disabled={!onOpenTipModal}
              title={onOpenTipModal ? 'Send Gift / Tip Coins' : 'Preview only'}
              className={cn(iconBtnClass, !onOpenTipModal && "opacity-60 cursor-not-allowed")}
              aria-label="Send Gift"
            >
              <Gift className="w-4 h-4 text-arvdoul-purple" />
            </button>

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                title="Share Profile"
                className={iconBtnClass}
                aria-label="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenOptions}
              disabled={!onOpenOptions}
              aria-disabled={!onOpenOptions}
              title={onOpenOptions ? 'More Options' : 'Preview only'}
              className={cn(iconBtnClass, !onOpenOptions && "opacity-60 cursor-not-allowed")}
              aria-label="More Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Interactive Level, Citizenship & Royal Family System Roadmap Modal */}
      <ProfileSystemRoadmapModal
        isOpen={showRoadmapModal}
        onClose={() => setShowRoadmapModal(false)}
        profile={profile}
        theme={theme}
        initialTab={roadmapInitialTab}
        userId={profileUid}
      />
    </section>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
