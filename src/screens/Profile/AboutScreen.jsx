/**
 * Displays comprehensive profile details, citizenship standing, level perks,
 * social links, bio, and identity verification.
 * 
 * @component
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';
import { useProfileStore } from '../../store/profileStore';
import { cn } from '../../lib/utils';
import { ArrowLeft, Edit3, Shield, Sparkles, Mail, HeartHandshake, Palette, RefreshCw, Zap } from "lucide-react";
import ProfileAbout from '../../components/profile/ProfileAbout';
import { Skeleton } from '../../components/UI/Skeleton';
import { getRankTitle, getPerksForLevel } from '../../services/levelSystemService';
import { getUserService } from '../../services/userService.js';
import { resolveCapabilities } from '../../services/profileCapabilityEngine.js';
import {
  pickHandle,
  deriveHandle,
  pickDisplayName,
  resolveLevelValue,
  projectProfileForViewer,
} from '../../services/profileReadModel.js';

/**
 * AboutScreen Component
 */
export default function AboutScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';

  const { user: authUser, authInitialized } = useAuth();
  const { profile: storeProfile, loading: storeLoading, error: storeError, loadProfile } = useProfileStore();
  const [relationship, setRelationship] = useState(null);
  const [relationshipError, setRelationshipError] = useState(false);
  const [relationshipTargetId, setRelationshipTargetId] = useState(null);

  const currentUserId = authUser?.uid || null;
  const cleanParam = userId ? String(userId).replace(/^@/, '').trim() : '';
  const targetId = (!cleanParam || cleanParam.toLowerCase() === 'me') ? currentUserId : cleanParam;

  const storeProfileMatchesTarget = Boolean(storeProfile && targetId && (
    storeProfile.id === targetId ||
    storeProfile.uid === targetId ||
    (cleanParam && storeProfile.username?.toLowerCase() === cleanParam.toLowerCase())
  ));
  const isActualOwner = Boolean(
    currentUserId &&
    targetId &&
    (currentUserId === targetId ||
      (storeProfileMatchesTarget &&
        (storeProfile.uid === currentUserId || storeProfile.id === currentUserId)))
  );

  useEffect(() => {
    if (!authInitialized || !targetId) return;
    const currentProfile = useProfileStore.getState().profile;
    const matchesStore = currentProfile && (
      currentProfile.id === targetId ||
      currentProfile.uid === targetId ||
      currentProfile.username?.toLowerCase() === targetId.toLowerCase()
    );
    if (!matchesStore) {
      loadProfile(targetId, currentUserId);
    }
  }, [targetId, currentUserId, authInitialized, loadProfile]);

  useEffect(() => {
    let mounted = true;
    const resolvedUid = storeProfileMatchesTarget
      ? (storeProfile?.uid || storeProfile?.id)
      : (targetId === currentUserId ? currentUserId : null);
    if (!currentUserId || !resolvedUid || isActualOwner || resolvedUid === currentUserId) {
      setRelationship(null);
      setRelationshipError(false);
      setRelationshipTargetId(resolvedUid || targetId || null);
      return;
    }

    setRelationship(null);
    setRelationshipError(false);
    setRelationshipTargetId(null);
    getUserService()
      .getRelationshipState(currentUserId, resolvedUid)
      .then((rel) => {
        if (mounted) {
          setRelationship(rel);
          setRelationshipError(false);
          setRelationshipTargetId(resolvedUid);
        }
      })
      .catch(() => {
        // A missing safety graph is not an empty relationship. Withhold this
        // visitor's About surface rather than applying public defaults.
        if (mounted) {
          setRelationship(null);
          setRelationshipError(true);
          setRelationshipTargetId(resolvedUid);
        }
      });

    return () => { mounted = false; };
  }, [currentUserId, targetId, storeProfile?.uid, storeProfile?.id, storeProfile?.username, storeProfileMatchesTarget, isActualOwner]);

  const effectiveProfile = useMemo(() => {
    const ownerProfile = isActualOwner && storeProfileMatchesTarget &&
      (storeProfile?.uid === currentUserId || storeProfile?.id === currentUserId)
      ? storeProfile
      : (isActualOwner ? authUser : null);
    const base = (isActualOwner ? ownerProfile : (storeProfileMatchesTarget ? storeProfile : null)) || {};
    const fallbackHandle = isActualOwner ? deriveHandle(authUser?.email) : null;
    const resolvedId = base.id || base.uid || targetId;
    return {
      ...base,
      id: resolvedId,
      uid: base.uid || base.id || targetId,
      displayName: pickDisplayName([base.displayName, base.name], { fallback: null }) || (targetId ? `user ${String(targetId).slice(0, 6)}` : '—'),
      username: pickHandle([base.username]) || fallbackHandle || null,
      bio: base.bio || '',
      location: base.location || '',
      website: base.website || '',
      level: resolveLevelValue(base.level),
    };
  }, [storeProfile, authUser, targetId, isActualOwner, storeProfileMatchesTarget, currentUserId]);

  // The About screen renders the descriptive identity card (bio/location/website/
  // links), so it must honour the `profileInfo` scope. It resolves the capability
  // decision and applies the single projection — it does not re-derive privacy.
  const capabilities = useMemo(() => resolveCapabilities({
    viewer: currentUserId ? { uid: currentUserId } : null,
    target: effectiveProfile,
    relationship: isActualOwner ? { isOwner: true } : (relationshipTargetId === (storeProfileMatchesTarget ? (storeProfile?.uid || storeProfile?.id) : targetId) && relationship ? relationship : { isBlocked: true }),
  }), [currentUserId, effectiveProfile, isActualOwner, relationship, relationshipTargetId, storeProfileMatchesTarget, storeProfile?.uid, storeProfile?.id, targetId]);

  const displayedProfile = useMemo(
    () => projectProfileForViewer(effectiveProfile, capabilities, { isOwner: isActualOwner }),
    [effectiveProfile, capabilities, isActualOwner]
  );

  const rankTitle = useMemo(() => {
    if (displayedProfile?.level == null) return null;
    try {
      return getRankTitle(displayedProfile.level);
    } catch {
      return null;
    }
  }, [displayedProfile?.level]);

  const perks = useMemo(() => {
    if (displayedProfile?.level == null) return [];
    try {
      return getPerksForLevel(displayedProfile.level) || [];
    } catch {
      return [];
    }
  }, [displayedProfile?.level]);

  if (!authInitialized) {
    return (
      <div className={cn('min-h-[70vh] flex items-center justify-center p-4', isDark ? 'text-white' : 'text-slate-900')} role="status" aria-label="Restoring session">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const expectedRelationshipTarget = storeProfileMatchesTarget
    ? (storeProfile?.uid || storeProfile?.id)
    : targetId;
  const relationshipReady = isActualOwner || !currentUserId ||
    (relationshipTargetId === expectedRelationshipTarget && Boolean(relationship));

  if (currentUserId && !isActualOwner && !relationshipReady && !relationshipError) {
    return (
      <div className={cn('min-h-[70vh] flex items-center justify-center p-4', isDark ? 'text-white' : 'text-slate-900')}>
        <div className="w-full max-w-md space-y-3" role="status" aria-label="Verifying profile privacy">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (relationshipError) {
    return (
      <div className={cn('min-h-[70vh] flex items-center justify-center p-4', isDark ? 'text-white' : 'text-slate-900')}>
        <div className={cn('max-w-md w-full p-8 rounded-2xl border backdrop-blur-2xl text-center space-y-4', isDark ? 'bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-white border-slate-200')}>
          <Shield className="w-8 h-8 mx-auto text-amber-500" />
          <h2 className="font-display text-xl font-bold">Profile Access Could Not Be Verified</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Arvdoul could not verify this profile's privacy and safety relationship. Its details are withheld until verification succeeds.</p>
          <button type="button" onClick={() => {
            const resolvedUid = storeProfile?.uid || storeProfile?.id;
            if (!currentUserId || !resolvedUid) return;
            getUserService().getRelationshipState(currentUserId, resolvedUid)
              .then((rel) => {
                setRelationship(rel);
                setRelationshipTargetId(resolvedUid);
                setRelationshipError(false);
              })
              .catch(() => setRelationshipError(true));
          }} className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-arvdoul-gradient cursor-pointer">
            Retry verification
          </button>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate('/profile/edit');
  };

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      {/* Top Bar */}
      <header className={cn(
        hasTopAppBar
          ? 'max-w-3xl mx-auto px-4 pt-3'
          : cn('sticky top-0 z-30 border-b backdrop-blur-xl transition-colors', isDark ? 'bg-[#03071B]/90 border-white/10' : 'bg-white/90 border-slate-200')
      )}>
        <div className={cn(
          'flex items-center justify-between gap-3',
          hasTopAppBar
            ? cn('px-4 py-3 rounded-2xl border backdrop-blur-2xl', isDark ? 'bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-white/90 border-slate-200/90 shadow-xs')
            : 'max-w-3xl mx-auto px-4 h-14'
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            {!hasTopAppBar && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className={cn(
                  'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                )}
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold truncate">
                About {displayedProfile?.displayName || 'Profile'}
              </h1>
              {displayedProfile?.username && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{displayedProfile.username}
                </p>
              )}
            </div>
          </div>

          {isActualOwner && (
            <button
              type="button"
              onClick={handleEdit}
              className="min-h-[44px] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer bg-arvdoul-gradient text-white hover:opacity-95 active:scale-95 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-4">
        {storeError && (
          <div className={cn(
            "flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold",
            isDark
              ? "bg-red-500/10 border-red-500/25 text-red-300"
              : "bg-red-50 border-red-200 text-red-700"
          )}>
            <span className="truncate">{storeError}</span>
            <button
              type="button"
              onClick={() => targetId && loadProfile(targetId, currentUserId)}
              className={cn(
                "min-h-[40px] px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-white hover:bg-slate-100 text-red-700 border border-red-200"
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {storeLoading && !storeProfile ? (
          <div className={cn(
            'p-5 rounded-2xl border backdrop-blur-xl space-y-3',
            isDark ? 'bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-white border-slate-200'
          )}>
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Profile Card & Info — projected, so a narrowed profileInfo scope hides the card */}
            <ProfileAbout
              profile={displayedProfile}
              isOwner={isActualOwner}
              onEdit={handleEdit}
            />

            {/* Creator Suite — gated by the `creatorInfo` scope */}
            {displayedProfile?.canViewCreatorInfo === true && (displayedProfile?.creatorCategory || displayedProfile?.inquiriesEmail || displayedProfile?.tipMessage) && (
              <div className={cn(
                'p-5 rounded-2xl border backdrop-blur-xl space-y-4',
                isDark ? 'bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-white border-slate-200'
              )}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Creator Suite</h2>
                </div>
                <div className="space-y-2.5">
                  {displayedProfile?.creatorCategory && (
                    <div className="flex items-center gap-3 text-sm">
                      <Palette className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400">Discipline:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{displayedProfile.creatorCategory}</span>
                    </div>
                  )}
                  {displayedProfile?.inquiriesEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400">Business contact:</span>
                      <a href={`mailto:${displayedProfile.inquiriesEmail}`} className="text-purple-600 dark:text-purple-400 hover:underline truncate">
                        {displayedProfile.inquiriesEmail}
                      </a>
                    </div>
                  )}
                  {displayedProfile?.tipMessage && (
                    <div className="flex items-start gap-3 text-sm">
                      <HeartHandshake className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-300 italic">{displayedProfile.tipMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Citizenship & Standing Strip */}
            <div className={cn(
              "p-5 rounded-2xl border backdrop-blur-xl space-y-4 transition-all",
              isDark ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Citizen Standing & Privileges
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {displayedProfile?.level != null ? (
                        <>Rank: <span className="font-semibold text-purple-600 dark:text-purple-400">{rankTitle || '—'}</span> · <span className="tabular-nums">Level {displayedProfile.level}</span></>
                      ) : (
                        <span>Standing unavailable</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/progress')}
                  className="min-h-[40px] px-2.5 rounded-xl text-xs font-semibold text-arvdoul-purple dark:text-[#C896FF] hover:underline cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  View System
                </button>
              </div>

              {perks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
                  {perks.slice(0, 4).map((perk, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/8">
                      <Zap className="w-4 h-4 text-arvdoul-purple shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{perk.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{perk.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
