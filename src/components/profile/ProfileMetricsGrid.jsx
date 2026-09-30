/**
 * src/components/profile/ProfileMetricsGrid.jsx - ARVDOUL Unified Metrics Strip
 *
 * Authoritative metric strip for a Profile. Every value is supplied by the
 * canonical domain owner; nothing is fabricated here.
 *
 * - follower/following/friends/posts counts come from `userService` (via the
 *   profile store), gated by `profileCapabilityEngine` capabilities.
 * - reputation comes from `reputationService` (via the profile store).
 * - coins come from `monetizationService` (owner only, gated).
 * When a value is not available it is shown honestly (`—` / omitted), never
 * replaced by an invented number.
 *
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

const formatNumber = (num) => {
  if (num === undefined || num === null) return null;
  const n = Number(num);
  if (Number.isNaN(n)) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ProfileMetricsGrid = memo(({
  isOwner = false,
  theme = 'light',
  profile,
  reputation,     // canonical reputation profile from reputationService
  balance,        // canonical coin balance from monetizationService (owner only)
  onMetricPress,
  capabilities,
}) => {
  const isDark = theme === 'dark';

  const postsCount = profile?.postCount ?? profile?.postsCount ?? null;
  const followersCount = profile?.followerCount ?? profile?.followersCount ?? null;
  const followingCount = profile?.followingCount ?? null;
  const friendsCount = profile?.friendCount ?? profile?.friendsCount ?? null;

  // Fail-closed: only explicit `true` capabilities allow these surfaces.
  const canShowFollowers = capabilities?.canViewFollowers === true;
  const canShowFollowing = capabilities?.canViewFollowing === true;
  // Post volume is content-adjacent; hidden when the viewer cannot see content.
  const canShowPosts = isOwner || capabilities?.canViewContent === true;
  const canShowEconomic = isOwner && capabilities?.canViewEconomicStatus === true;

  // Canonical reputation band. No fabricated numeric default.
  const reputationScore = reputation?.reputation?.score ?? null;
  const reputationBand = reputation?.reputation?.band ?? null;

  const coinsValue = balance === null || balance === undefined ? null : formatNumber(balance);

  const metrics = [
    {
      key: 'posts',
      label: 'Posts',
      value: canShowPosts ? (formatNumber(postsCount) ?? '—') : '—',
      clickable: false,
      subtext: canShowPosts ? null : 'Private',
    },
    {
      key: 'followers',
      label: 'Followers',
      value: canShowFollowers ? (formatNumber(followersCount) ?? '—') : '—',
      clickable: canShowFollowers && Boolean(onMetricPress),
      subtext: canShowFollowers ? null : 'Private',
    },
    {
      key: 'following',
      label: 'Following',
      value: canShowFollowing ? (formatNumber(followingCount) ?? '—') : '—',
      clickable: canShowFollowing && Boolean(onMetricPress),
      subtext: canShowFollowing ? null : 'Private',
    },
    {
      key: 'friends',
      label: 'Friends',
      value: formatNumber(friendsCount) ?? '—',
      clickable: Boolean(onMetricPress),
    },
    {
      key: 'reputation',
      label: 'Trust Standing',
      value: reputationScore !== null ? String(reputationScore) : '—',
      subtext: reputationBand,
      clickable: false,
    },
    ...(canShowEconomic ? [{
      key: 'coins',
      label: 'Coins Balance',
      value: coinsValue ?? '—',
      clickable: Boolean(onMetricPress),
    }] : [])
  ];

  return (
    <div className={cn(
      "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm",
      isDark
        ? "bg-arvdoul-bg-elevated border-slate-800/90 text-white"
        : "bg-white border-slate-200/90 text-slate-900"
    )}>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800/70">
        {metrics.map((item, idx) => {
          const content = (
            <div className={cn(
              "flex flex-col items-center justify-center text-center px-2 py-1.5 transition-colors",
              item.clickable && "cursor-pointer group hover:opacity-85"
            )}>
              <span className={cn(
                "text-lg sm:text-xl font-extrabold tracking-tight",
                item.clickable && "group-hover:text-indigo-400 transition-colors",
                isDark ? "text-white" : "text-slate-900"
              )}>
                {item.value}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                {item.label}
              </span>
              {item.subtext && (
                <span className="text-[10px] font-medium text-emerald-500 mt-0.5">
                  {item.subtext}
                </span>
              )}
            </div>
          );

          if (item.clickable) {
            return (
              <button
                type="button"
                key={item.key || idx}
                onClick={() => onMetricPress?.(item.key)}
                className="w-full text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg"
              >
                {content}
              </button>
            );
          }

          return (
            <div key={item.key || idx} className="w-full">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ProfileMetricsGrid.displayName = 'ProfileMetricsGrid';

export default ProfileMetricsGrid;
