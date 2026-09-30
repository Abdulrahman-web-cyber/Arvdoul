/**
 * src/components/profile/ProfileIdentityBadges.jsx
 *
 * Concise, real identity-status chip row for the Profile hero area.
 *
 * Every chip is derived from a canonical source; none are invented:
 * - Verified        -> users/{uid}.isVerified (userService projection)
 * - Creator         -> creatorService creator profile / users.isCreator / creator tier
 * - Citizen tier    -> levelSystemService.getCitizenTier(level, activeDays)
 * - Active streak   -> reputationService.reputation.activeStreak
 * - Privacy state   -> users/{uid}.isPrivate (via ProfilePrivacyBadge)
 *
 * This is a summary surface. Ownership of each signal stays with its domain.
 *
 * @component
 */

import React, { memo, useMemo } from 'react';
import ProfileBadges from './ProfileBadges';
import ProfilePrivacyBadge from './ProfilePrivacyBadge';
import * as LevelModule from '../../services/levelSystemService';

const getCitizenTier = LevelModule.getCitizenTier || (() => null);

const ProfileIdentityBadges = memo(({
  profile,
  reputation = null,
  creatorProfile = null,
  level = null,
  theme = 'light',
}) => {
  const badges = useMemo(() => {
    const list = [];

    if (profile?.isVerified || profile?.verified) {
      list.push({ id: 'verified', type: 'verified', label: 'Verified' });
    }

    // A level is only used when genuinely known; the citizen-tier chip below is
    // skipped otherwise instead of assuming level 1.
    const rawLevel = level ?? profile?.level ?? null;
    const effectiveLevel = Number.isFinite(Number(rawLevel)) && Number(rawLevel) > 0 ? Number(rawLevel) : null;
    const isCreator = Boolean(
      creatorProfile ||
      profile?.isCreator ||
      profile?.creatorTier ||
      creatorProfile?.status === 'approved'
    );
    if (isCreator) {
      list.push({ id: 'creator', type: 'creator', label: 'Creator' });
    }

    // Citizenship tier is a function of level AND verified active days. When the
    // active-day count is unknown we do not assume one, and simply omit the tier
    // chip rather than invent a standing.
    const rawActiveDays = profile?.activeDaysCount ?? reputation?.activeDaysCount ?? null;
    const activeDays = Number.isFinite(Number(rawActiveDays)) ? Number(rawActiveDays) : null;
    let tier = null;
    if (activeDays !== null && effectiveLevel !== null) {
      try {
        tier = getCitizenTier(effectiveLevel, activeDays);
      } catch {
        tier = null;
      }
    }
    if (tier?.tier && tier.tier !== 'Citizen' && tier.tier !== 'Resident') {
      list.push({ id: 'citizen', type: 'citizen', label: tier.tier });
    }

    // Streak chip only when a real streak value exists.
    const rawStreak = reputation?.activeStreak ?? profile?.activeStreak ?? null;
    const streak = Number.isFinite(Number(rawStreak)) ? Number(rawStreak) : null;
    if (streak !== null && streak >= 2) {
      list.push({ id: 'streak', type: 'streak', label: `${streak}-Day Streak` });
    }

    return list;
  }, [profile?.isVerified, profile?.verified, profile?.isCreator, profile?.creatorTier, profile?.activeDaysCount, profile?.activeStreak, creatorProfile, reputation, level]);

  const isPrivate = Boolean(profile?.isPrivate);

  if (badges.length === 0 && !isPrivate) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Identity status">
      <ProfileBadges badges={badges} theme={theme} />
      <ProfilePrivacyBadge isPrivate={isPrivate} theme={theme} />
    </div>
  );
});

ProfileIdentityBadges.displayName = 'ProfileIdentityBadges';

export default ProfileIdentityBadges;
