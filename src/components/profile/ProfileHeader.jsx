/**
 * Arvdoul — ProfileHeader
 *
 * Compact, responsive digital identity header with refined glassmorphism.
 * No cover photos, cover banners, or cover-photo placeholders.
 *
 * Responsibilities:
 * - Profile identity, avatar, verification, and progression.
 * - Owner and visitor actions.
 * - Social metrics.
 * - Follow/unfollow with optimistic UI and rollback.
 * - Profile sharing and contextual options.
 * - Creator tipping through the existing ProfileTipModal.
 *
 * Authorization, relationship integrity, coin transactions, and profile
 * visibility must be enforced by the corresponding backend services.
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleUserRound,
  Crown,
  Edit3,
  Flame,
  Landmark,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Settings2,
  Share2,
  Shield,
  UserPlus,
  UserRoundCheck,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService } from '../../services/userService.js';
import { getCitizenTier } from '../../services/levelSystemService';

import ProfileAvatar from './ProfileAvatar';
import ProfileLevel from './ProfileLevel';
import ProfileBadges from './ProfileBadges';
import ProfileStats from './ProfileStats';
import ProfileOptionsMenu from './ProfileOptionsMenu';
import ProfileTipModal from './ProfileTipModal';

const BRAND_GRADIENT =
  'linear-gradient(115deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)';

const FOLLOW_TIMEOUT_MS = 15000;

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCount(...values) {
  for (const value of values) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0
    ) {
      return Number(value);
    }
  }

  return 0;
}

function formatCount(value) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(normalizeCount(value));
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener?.('change', update);

    return () => query.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

function HeaderIconButton({
  label,
  onClick,
  children,
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
        'border border-black/[0.055] bg-white/55 text-slate-600',
        'backdrop-blur-xl transition-colors',
        'hover:bg-white/90 hover:text-slate-950',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-violet-500 focus-visible:ring-offset-1',
        'focus-visible:ring-offset-white',
        'disabled:pointer-events-none disabled:opacity-50',
        'dark:border-white/[0.085] dark:bg-white/[0.045]',
        'dark:text-white/70 dark:hover:bg-white/[0.09]',
        'dark:hover:text-white dark:focus-visible:ring-offset-[#03071B]',
        className
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  primary = false,
  className,
  type = 'button',
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-1.5',
        'rounded-xl px-3 text-xs font-semibold',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-violet-500 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#03071B]',
        'disabled:pointer-events-none disabled:opacity-55',
        primary
          ? [
              'border border-white/10 text-white',
              'bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB]',
              'shadow-[0_3px_14px_rgba(68,49,247,0.20)]',
              'hover:brightness-110 active:brightness-95',
            ]
          : [
              'border border-black/[0.07] bg-black/[0.025]',
              'text-slate-700 hover:bg-black/[0.055]',
              'dark:border-white/[0.09] dark:bg-white/[0.035]',
              'dark:text-white/85 dark:hover:bg-white/[0.075]',
            ],
        className
      )}
    >
      {children}
    </button>
  );
}

function IdentityPill({ children, icon: Icon, tone = 'neutral', title }) {
  const tones = {
    neutral:
      'border-black/[0.065] bg-black/[0.025] text-slate-600 dark:border-white/[0.085] dark:bg-white/[0.04] dark:text-white/70',
    violet:
      'border-violet-500/20 bg-violet-500/[0.075] text-violet-700 dark:text-violet-300',
    blue:
      'border-blue-500/20 bg-blue-500/[0.075] text-blue-700 dark:text-blue-300',
    emerald:
      'border-emerald-500/20 bg-emerald-500/[0.075] text-emerald-700 dark:text-emerald-300',
    amber:
      'border-amber-500/20 bg-amber-500/[0.075] text-amber-700 dark:text-amber-300',
  };

  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border',
        'px-2 py-1 text-[10px] font-medium leading-none',
        tones[tone] || tones.neutral
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

function ProfileHeader({
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  onAvatarPress,
  onEditPress,
  onSharePress,
  onSettingsPress,
  onDashboardPress,
  onStatPress,
  onMutualFriendPress,
}) {
  const navigate = useNavigate();
  const { userProfile: currentAuthUser, user: authUser } = useAuth();

  const isDark = theme === 'dark';
  const reducedMotion = useReducedMotionPreference();

  const currentUserId = normalizeId(
    currentAuthUser?.uid ||
      currentAuthUser?.id ||
      authUser?.uid ||
      authUser?.id
  );

  const targetUserId = normalizeId(profile?.uid || profile?.id);
  const isOwnTarget =
    Boolean(currentUserId && targetUserId) &&
    currentUserId === targetUserId;

  /*
   * Do not permit visitor actions on the authenticated user's own profile
   * just because a caller passed isOwner=false.
   */
  const ownerView = Boolean(isOwner || isOwnTarget);
  const canInteractWithTarget =
    Boolean(targetUserId) && !isOwnTarget;

  const displayName =
    typeof profile?.displayName === 'string' &&
    profile.displayName.trim()
      ? profile.displayName.trim()
      : 'Citizen';

  const username =
    typeof profile?.username === 'string' &&
    profile.username.trim()
      ? profile.username.trim().replace(/^@/, '')
      : 'citizen';

  const safeLevel = normalizeCount(
    level,
    profile?.level,
    profile?.experienceLevel,
    1
  );

  const coinBalance = normalizeCount(
    profile?.coins,
    profile?.coinBalance,
    profile?.balance
  );

  const followerCountFromProfile = normalizeCount(
    profile?.followerCount,
    profile?.followersCount
  );

  const [showOptions, setShowOptions] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(
    Boolean(profile?.isFollowing || profile?.relationship?.isFollowing)
  );
  const [followerCount, setFollowerCount] = useState(
    followerCountFromProfile
  );

  const requestSequence = useRef(0);
  const followLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    setIsFollowing(
      Boolean(profile?.isFollowing || profile?.relationship?.isFollowing)
    );
    setFollowerCount(followerCountFromProfile);
  }, [
    targetUserId,
    profile?.isFollowing,
    profile?.relationship?.isFollowing,
    followerCountFromProfile,
  ]);

  useEffect(() => {
    setShowOptions(false);
    setShowTipModal(false);
  }, [targetUserId]);

  const positionLabel =
    typeof position?.label === 'string' ? position.label.trim() : '';

  const PositionIcon = useMemo(() => {
    const normalized = positionLabel.toLowerCase();

    if (
      normalized.includes('king') ||
      normalized.includes('queen') ||
      normalized.includes('royal')
    ) {
      return Crown;
    }

    if (
      normalized.includes('lord') ||
      normalized.includes('lady') ||
      normalized.includes('guardian')
    ) {
      return Shield;
    }

    return null;
  }, [positionLabel]);

  const citizenTier = useMemo(() => {
    try {
      return getCitizenTier(
        safeLevel,
        normalizeCount(profile?.activeDaysCount, profile?.activeStreak)
      );
    } catch (error) {
      console.error('Unable to resolve citizen tier:', error);
      return null;
    }
  }, [
    safeLevel,
    profile?.activeDaysCount,
    profile?.activeStreak,
  ]);

  const handleShare = useCallback(async () => {
    if (typeof onSharePress === 'function') {
      try {
        await onSharePress();
      } catch (error) {
        console.error('Profile share callback failed:', error);
        toast.error('Could not share profile');
      }
      return;
    }

    if (!targetUserId || typeof window === 'undefined') {
      toast.error('Profile link is unavailable');
      return;
    }

    const shareUrl = new URL(
      `/profile/${encodeURIComponent(targetUserId)}`,
      window.location.origin
    ).toString();

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${displayName} on Arvdoul`,
          text: `View ${displayName}'s profile on Arvdoul`,
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Profile link copied');
        return;
      }

      toast.error('Sharing is not supported by this browser');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Profile share failed:', error);
        toast.error('Could not share profile');
      }
    }
  }, [
    onSharePress,
    targetUserId,
    displayName,
  ]);

  const handleMessage = useCallback(() => {
    if (!canInteractWithTarget) return;

    if (!currentUserId) {
      toast.error('Sign in to message this user');
      return;
    }

    navigate(
      `/messages/new?to=${encodeURIComponent(targetUserId)}`
    );
  }, [canInteractWithTarget, currentUserId, navigate, targetUserId]);

  const handleFollowToggle = useCallback(async () => {
    if (followLock.current || followLoading) return;

    if (!currentUserId) {
      toast.error('Sign in to follow this user');
      return;
    }

    if (!targetUserId || !canInteractWithTarget) {
      toast.error('This profile cannot be followed');
      return;
    }

    const previousFollowing = isFollowing;
    const previousFollowerCount = followerCount;
    const nextFollowing = !previousFollowing;
    const requestId = ++requestSequence.current;

    followLock.current = true;
    setFollowLoading(true);
    setIsFollowing(nextFollowing);
    setFollowerCount(
      Math.max(
        0,
        previousFollowerCount + (nextFollowing ? 1 : -1)
      )
    );

    let timeoutId;

    try {
      const operation = nextFollowing
        ? userService.followUser(currentUserId, targetUserId)
        : userService.unfollowUser(currentUserId, targetUserId);

      /*
       * A timeout only stops waiting in the UI. It cannot cancel a backend
       * operation unless the service itself supports cancellation.
       */
      await Promise.race([
        Promise.resolve(operation),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('The follow request timed out'));
          }, FOLLOW_TIMEOUT_MS);
        }),
      ]);

      if (!mounted.current || requestSequence.current !== requestId) {
        return;
      }

      toast.success(
        nextFollowing
          ? `Following @${username}`
          : `Unfollowed @${username}`
      );
    } catch (error) {
      if (!mounted.current || requestSequence.current !== requestId) {
        return;
      }

      setIsFollowing(previousFollowing);
      setFollowerCount(previousFollowerCount);

      console.error('Follow operation failed:', error);

      toast.error(
        error?.message || 'Could not update follow status'
      );
    } finally {
      clearTimeout(timeoutId);

      if (mounted.current && requestSequence.current === requestId) {
        followLock.current = false;
        setFollowLoading(false);
      }
    }
  }, [
    currentUserId,
    targetUserId,
    canInteractWithTarget,
    followLoading,
    isFollowing,
    followerCount,
    username,
  ]);

  const handleMoreOptions = useCallback(() => {
    setShowOptions((previous) => !previous);
  }, []);

  const handleEdit = useCallback(() => {
    if (!ownerView) return;

    if (typeof onEditPress === 'function') {
      onEditPress();
      return;
    }

    navigate('/profile/edit');
  }, [ownerView, onEditPress, navigate]);

  const handleSettings = useCallback(() => {
    if (!ownerView) return;

    if (typeof onSettingsPress === 'function') {
      onSettingsPress();
      return;
    }

    navigate('/profile/settings');
  }, [ownerView, onSettingsPress, navigate]);

  const handleDashboard = useCallback(() => {
    if (!ownerView) return;

    if (typeof onDashboardPress === 'function') {
      onDashboardPress();
      return;
    }

    navigate('/profile/analytics');
  }, [ownerView, onDashboardPress, navigate]);

  const handleAvatarPress = useCallback(() => {
    if (typeof onAvatarPress === 'function') {
      onAvatarPress();
      return;
    }

    if (ownerView) {
      navigate('/profile/edit');
    }
  }, [onAvatarPress, ownerView, navigate]);

  const handleStatPress = useCallback(
    (stat) => {
      if (typeof onStatPress === 'function') {
        onStatPress(stat);
        return;
      }

      if (!targetUserId) return;

      const encodedId = encodeURIComponent(targetUserId);

      switch (stat) {
        case 'followers':
          navigate(`/profile/${encodedId}/followers`);
          break;
        case 'following':
          navigate(`/profile/${encodedId}/following`);
          break;
        case 'friends':
          navigate(`/profile/${encodedId}/friends`);
          break;
        case 'posts':
          navigate(`/profile/${encodedId}/posts`);
          break;
        case 'coins':
          if (ownerView) navigate('/coins');
          break;
        case 'reputation':
          navigate('/passport');
          break;
        default:
          break;
      }
    },
    [onStatPress, targetUserId, navigate, ownerView]
  );

  const handleTipSuccess = useCallback(
    (amount) => {
      /*
       * Do not mutate the supplied profile object. The wallet/profile store
       * or authoritative service must refresh the recipient's balance.
       */
      setShowTipModal(false);

      if (typeof amount === 'number' && amount > 0) {
        toast.success('Tip submitted successfully');
      }
    },
    []
  );

  if (!profile) {
    return (
      <article
        aria-label="Loading profile"
        aria-busy="true"
        className={cn(
          'w-full overflow-hidden rounded-2xl border p-4 backdrop-blur-2xl',
          isDark
            ? 'border-white/[0.08] bg-white/[0.035]'
            : 'border-black/[0.06] bg-white/75'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-full bg-slate-300/50 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 max-w-full animate-pulse rounded bg-slate-300/50 dark:bg-white/10" />
            <div className="h-3 w-24 max-w-full animate-pulse rounded bg-slate-300/40 dark:bg-white/[0.07]" />
            <div className="h-3 w-32 max-w-full animate-pulse rounded bg-slate-300/40 dark:bg-white/[0.07]" />
          </div>
        </div>
        <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-300/30 dark:bg-white/[0.045]" />
      </article>
    );
  }

  const activeDays = normalizeCount(
    profile.activeDaysCount,
    profile.activeStreak
  );

  const showVerified =
    profile.isVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === 'verified';

  const bio = typeof profile.bio === 'string' ? profile.bio.trim() : '';

  const showCreatorTip =
    canInteractWithTarget &&
    (profile.isCreator === true || profile.creatorEnabled === true);

  return (
    <article
      aria-label={`${displayName}'s profile`}
      className={cn(
        'relative isolate w-full min-w-0 overflow-visible rounded-2xl',
        'border backdrop-blur-2xl',
        'transition-colors duration-200',
        isDark
          ? [
              'border-white/[0.09]',
              'bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))]',
              'shadow-[0_12px_36px_rgba(0,0,0,0.20)]',
            ]
          : [
              'border-white/90',
              'bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(255,255,255,0.68))]',
              'shadow-[0_10px_32px_rgba(15,23,42,0.055)]',
            ]
      )}
    >
      {/* A fine brand-light edge; intentionally not a cover-photo region. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/65 to-transparent"
      />

      <div className="p-3.5 sm:p-4">
        {/* Identity and contextual actions */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative shrink-0">
            <ProfileAvatar
              src={profile.photoURL || profile.profilePicture || ''}
              name={displayName}
              userId={targetUserId}
              size={76}
              level={safeLevel}
              onPress={handleAvatarPress}
              isOwner={ownerView}
              theme={theme}
            />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <h1 className="max-w-full break-words text-[17px] font-bold leading-5 tracking-[-0.035em] text-slate-950 dark:text-white sm:text-[18px]">
                    {displayName}
                  </h1>

                  {showVerified && (
                    <BadgeCheck
                      aria-label="Verified account"
                      className="h-4 w-4 shrink-0 text-blue-500"
                    />
                  )}

                  {PositionIcon && positionLabel && (
                    <PositionIcon
                      aria-label={positionLabel}
                      className="h-4 w-4 shrink-0 text-amber-500"
                    />
                  )}
                </div>

                <p className="mt-1 truncate text-[12px] text-slate-500 dark:text-white/55">
                  @{username}
                </p>
              </div>

              <div className="relative flex shrink-0 items-center gap-1">
                {ownerView ? (
                  <HeaderIconButton
                    label="Profile settings"
                    onClick={handleSettings}
                  >
                    <Settings2 className="h-4 w-4" />
                  </HeaderIconButton>
                ) : (
                  <HeaderIconButton
                    label="More profile options"
                    onClick={handleMoreOptions}
                    disabled={!targetUserId}
                  >
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </HeaderIconButton>
                )}

                {showOptions && (
                  <div className="absolute right-0 top-10 z-50 min-w-0">
                    <ProfileOptionsMenu
                      profile={profile}
                      isOwner={ownerView}
                      theme={theme}
                      onClose={() => setShowOptions(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Compact identity status */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <IdentityPill icon={Crown} tone="violet">
                Level {formatCount(safeLevel)}
              </IdentityPill>

              {positionLabel && (
                <IdentityPill
                  icon={PositionIcon || Shield}
                  tone="amber"
                  title={
                    position?.position
                      ? `${positionLabel}, rank ${position.position}`
                      : positionLabel
                  }
                >
                  {positionLabel}
                  {position?.position ? ` #${position.position}` : ''}
                </IdentityPill>
              )}

              {citizenTier?.tier && (
                <IdentityPill
                  icon={Landmark}
                  tone="emerald"
                  title={citizenTier.description || citizenTier.tier}
                >
                  {citizenTier.tier}
                </IdentityPill>
              )}

              {activeDays > 0 && (
                <IdentityPill
                  icon={Flame}
                  tone="amber"
                  title={`${activeDays} active days or streak days, according to the supplied profile data`}
                >
                  {formatCount(activeDays)}d
                </IdentityPill>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <p className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-[1.65] text-slate-700 dark:text-white/75">
            {bio}
          </p>
        )}

        {/* Profile metadata; no empty placeholder rows. */}
        {(profile.location || profile.website) && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-white/50">
            {profile.location && (
              <span className="inline-flex max-w-full items-center gap-1">
                <Landmark className="h-3 w-3 shrink-0" />
                <span className="truncate">{profile.location}</span>
              </span>
            )}

            {profile.website && (
              <a
                href={(() => {
                  const raw = String(profile.website).trim();

                  try {
                    const url = new URL(
                      /^[a-z][a-z\d+.-]*:/i.test(raw)
                        ? raw
                        : `https://${raw}`
                    );

                    return ['http:', 'https:'].includes(url.protocol)
                      ? url.toString()
                      : undefined;
                  } catch {
                    return undefined;
                  }
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-blue-600 hover:underline dark:text-blue-300"
                onClick={(event) => {
                  const href = event.currentTarget.getAttribute('href');

                  if (!href) {
                    event.preventDefault();
                    toast.error('This website address is invalid');
                  }
                }}
              >
                <Share2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{profile.website}</span>
              </a>
            )}
          </div>
        )}

        {/* Owner and visitor actions */}
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          {ownerView ? (
            <>
              <ActionButton
                primary
                onClick={handleEdit}
                className="min-w-0 flex-1 sm:flex-none"
              >
                <Edit3 className="h-3.5 w-3.5 shrink-0" />
                Edit profile
              </ActionButton>

              <ActionButton
                onClick={() => navigate('/coins')}
                className="min-w-0 flex-1 sm:flex-none"
              >
                <Wallet className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="truncate">
                  {formatCount(coinBalance)} coins
                </span>
              </ActionButton>

              <HeaderIconButton
                label="Share profile"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </HeaderIconButton>
            </>
          ) : (
            <>
              <ActionButton
                primary={!isFollowing}
                onClick={handleFollowToggle}
                disabled={
                  followLoading ||
                  !canInteractWithTarget ||
                  !targetUserId
                }
                className="min-w-0 flex-1 sm:flex-none"
              >
                {followLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                  <UserRoundCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}

                {followLoading
                  ? 'Updating…'
                  : isFollowing
                    ? 'Following'
                    : 'Follow'}
              </ActionButton>

              {showCreatorTip && (
                <ActionButton
                  onClick={() => setShowTipModal(true)}
                  className="min-w-0 flex-1 sm:flex-none"
                >
                  <Wallet className="h-3.5 w-3.5 text-amber-500" />
                  Tip creator
                </ActionButton>
              )}

              <HeaderIconButton
                label="Message profile"
                onClick={handleMessage}
                disabled={!targetUserId}
              >
                <MessageCircle className="h-4 w-4" />
              </HeaderIconButton>

              <HeaderIconButton
                label="Share profile"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </HeaderIconButton>
            </>
          )}
        </div>

        {/* Compact social metrics */}
        <div className="mt-3 border-t border-black/[0.055] pt-2 dark:border-white/[0.075]">
          <ProfileStats
            posts={normalizeCount(profile.postCount, profile.postsCount)}
            followers={followerCount}
            following={normalizeCount(profile.followingCount)}
            friends={normalizeCount(profile.friendCount, profile.friendsCount)}
            likes={normalizeCount(profile.likesReceived)}
            coins={coinBalance}
            reputation={normalizeCount(
              profile.reputation,
              profile.reputationScore
            )}
            theme={theme}
            onStatPress={handleStatPress}
          />
        </div>

        {/* Optional mutual-friend affordance */}
        {typeof onMutualFriendPress === 'function' &&
          normalizeCount(profile.mutualFriendCount) > 0 && (
            <button
              type="button"
              onClick={onMutualFriendPress}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] text-slate-500 transition hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-white/55 dark:hover:text-violet-300"
            >
              <UserRoundCheck className="h-3.5 w-3.5" />
              {formatCount(profile.mutualFriendCount)} mutual connections
              <ChevronRight className="h-3 w-3" />
            </button>
          )}

        {/* Owner progression and dashboard entry point */}
        {ownerView && (
          <button
            type="button"
            onClick={handleDashboard}
            className={cn(
              'mt-3 flex w-full min-w-0 items-center gap-2.5 rounded-xl',
              'border border-violet-500/[0.14] bg-gradient-to-r',
              'from-violet-500/[0.055] via-blue-500/[0.035] to-transparent',
              'px-2.5 py-2 text-left transition-colors',
              'hover:border-violet-500/25 hover:from-violet-500/[0.09]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              reducedMotion ? '' : 'active:scale-[0.995]'
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/15 bg-violet-500/[0.08]">
              <Crown className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-slate-800 dark:text-white/90">
                Progression & creator studio
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-white/50">
                Level, performance, and creator insights
              </span>
            </span>

            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        )}
      </div>

      {showTipModal && showCreatorTip && (
        <ProfileTipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          recipient={profile}
          currentUser={currentAuthUser || authUser}
          onTipSuccess={handleTipSuccess}
        />
      )}
    </article>
  );
}

ProfileHeader.displayName = 'ProfileHeader';

export default memo(ProfileHeader);
