/**
 * src/components/profile/ProfileMetricsGrid.jsx - ARVDOUL Unified Metrics Strip
 * 
 * Replaces noisy floating glass boxes with an authoritative, high-contrast metric strip.
 * Features crisp typography, accessible touch targets, and zero blurry visual pollution.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { getReputationBand } from '../../shared/levelConfig.cjs';

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ProfileMetricsGrid = memo(({
  isOwner = false,
  theme = 'light',
  profile,
  analytics,
  onMetricPress,
  capabilities,
}) => {
  const isDark = theme === 'dark';

  const postsCount = profile?.postCount ?? profile?.postsCount ?? profile?.posts?.length ?? 0;
  const followersCount = profile?.followerCount ?? profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const friendsCount = profile?.friendCount ?? profile?.friendsCount ?? 0;
  const coinsCount = profile?.coins ?? profile?.coinBalance ?? profile?.balance ?? 0;
  const reputationScore = Number(profile?.reputationScore ?? profile?.reputation ?? 75);
  const repBand = getReputationBand(reputationScore);

  const canShowFollowers = capabilities?.canViewFollowers ?? true;
  const canShowFollowing = capabilities?.canViewFollowing ?? true;

  const metrics = [
    {
      key: 'posts',
      label: 'Posts',
      value: formatNumber(postsCount),
      clickable: false,
    },
    {
      key: 'followers',
      label: 'Followers',
      value: canShowFollowers ? formatNumber(followersCount) : '—',
      clickable: canShowFollowers && Boolean(onMetricPress),
      subtext: canShowFollowers ? null : 'Private',
    },
    {
      key: 'following',
      label: 'Following',
      value: canShowFollowing ? formatNumber(followingCount) : '—',
      clickable: canShowFollowing && Boolean(onMetricPress),
      subtext: canShowFollowing ? null : 'Private',
    },
    {
      key: 'friends',
      label: 'Friends',
      value: formatNumber(friendsCount),
      clickable: Boolean(onMetricPress),
    },
    {
      key: 'reputation',
      label: 'Trust Standing',
      value: `${reputationScore}`,
      subtext: repBand.label,
      clickable: false,
    },
    ...(isOwner ? [{
      key: 'coins',
      label: 'Coins Balance',
      value: formatNumber(coinsCount),
      clickable: Boolean(onMetricPress),
    }] : [])
  ];

  return (
    <div className={cn(
      "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm",
      isDark
        ? "bg-[#0B0F19] border-slate-800/90 text-white"
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
