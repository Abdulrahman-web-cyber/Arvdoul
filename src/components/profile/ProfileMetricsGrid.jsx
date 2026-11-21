/**
 * Production-grade Civic Metrics Ledger.
 * Renders a unified, hairline-divided architectural ledger strip (Light & Dark theme).
 * Enforces Arvdoul progression rules:
 * - Citizens below Level 3 (non-creator) operate with Friends & core metrics (no Followers/Following tabs/cells).
 * - Level 3+ or Creator unlocks Followers & Following alongside Friends.
 * - Strictly fail-closed on capability gates and never fabricates unknown counts.
 * - Coins lives in a dedicated Treasury card when `showCoins` is false to avoid duplication.
 *
 * @component
 */

import { memo } from "react";
import { FileText, Users, UserCheck, UserPlus, Eye, Heart, Coins } from "lucide-react";
import { cn } from '../../lib/utils';
import { LEVEL_GATES } from '../../shared/levelConfig.cjs';
import { resolveCreatorFlag } from '../../services/profileReadModel.js';

const formatNumber = (num) => {
  if (num === undefined || num === null) return '—';
  const n = Number(num);
  if (Number.isNaN(n)) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : (n >= 10000000 ? 1 : 2))}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
};

const ProfileMetricsGrid = memo(({
  isOwner = false,
  theme = 'light',
  profile,
  analytics,
  onMetricPress,
  capabilities,
  showCoins = false,
}) => {
  const isDark = theme === 'dark';

  const postsCount = profile?.postCount ?? profile?.postsCount ?? profile?.posts?.length ?? null;
  const followersCount = profile?.followerCount ?? profile?.followersCount ?? null;
  const followingCount = profile?.followingCount ?? null;
  const friendsCount = profile?.friendCount ?? profile?.friendsCount ?? null;
  const coinsCount = profile?.coins ?? profile?.coinBalance ?? profile?.balance ?? null;
  const profileViews = analytics?.totalViews ?? profile?.profileViews ?? profile?.viewsCount ?? null;
  const likesCount = profile?.likesReceived ?? profile?.likesCount ?? null;

  // Fail CLOSED when the capability map is absent
  const canShowFollowers = Boolean(capabilities?.canViewFollowers);
  const canShowFollowing = Boolean(capabilities?.canViewFollowing);
  const canShowFriends = Boolean(capabilities?.canViewFriends);
  const canShowEconomic = isOwner || Boolean(capabilities?.canViewEconomicStatus);

  // Enforce Friends (< Level 3) -> Followers (Level 3+ / Creator)
  const rawLevel = profile?.level != null && Number.isFinite(Number(profile.level)) ? Number(profile.level) : null;
  const isCreator = resolveCreatorFlag(profile || {}, {}, rawLevel);
  const followersTierUnlocked = Boolean(
    isCreator || rawLevel === null || rawLevel >= LEVEL_GATES.publicFollowers
  );

  const followerGrowth = analytics?.followerGrowth ? Number(analytics.followerGrowth) : null;
  const viewsGrowth = analytics?.viewsGrowth ? Number(analytics.viewsGrowth) : null;

  const stats = [
    {
      key: 'posts',
      label: 'Posts',
      value: formatNumber(postsCount),
      icon: FileText,
      accentClass: 'text-arvdoul-purple dark:text-purple-400',
      clickable: Boolean(onMetricPress),
      trend: null,
    },
    ...(followersTierUnlocked
      ? [
          {
            key: 'followers',
            label: 'Followers',
            value: canShowFollowers ? formatNumber(followersCount) : '—',
            icon: Users,
            accentClass: 'text-arvdoul-purple dark:text-purple-400',
            clickable: canShowFollowers && Boolean(onMetricPress),
            trend: canShowFollowers && followerGrowth ? `+${followerGrowth}%` : null,
          },
          {
            key: 'following',
            label: 'Following',
            value: canShowFollowing ? formatNumber(followingCount) : '—',
            icon: UserCheck,
            accentClass: 'text-cyan-600 dark:text-cyan-400',
            clickable: canShowFollowing && Boolean(onMetricPress),
            trend: null,
          },
        ]
      : []),
    {
      key: 'friends',
      label: 'Friends',
      value: canShowFriends && friendsCount !== null ? formatNumber(friendsCount) : '—',
      icon: UserPlus,
      accentClass: 'text-arvdoul-blue dark:text-blue-400',
      clickable: canShowFriends && friendsCount !== null && Boolean(onMetricPress),
      trend: null,
    },
    {
      key: isOwner ? 'views' : 'likes',
      label: isOwner ? 'Profile Views' : 'Likes',
      value: isOwner
        ? (profileViews === null ? '—' : formatNumber(profileViews))
        : (likesCount === null ? '—' : formatNumber(likesCount)),
      icon: isOwner ? Eye : Heart,
      accentClass: isOwner ? 'text-cyan-600 dark:text-cyan-400' : 'text-rose-500 dark:text-rose-400',
      clickable: isOwner && Boolean(onMetricPress),
      trend: isOwner && viewsGrowth ? `+${viewsGrowth}%` : null,
    },
    ...(showCoins
      ? [
          {
            key: 'coins',
            label: 'Coins',
            value: canShowEconomic && coinsCount !== null ? formatNumber(coinsCount) : '—',
            icon: Coins,
            accentClass: 'text-amber-500 dark:text-amber-400',
            clickable: Boolean(onMetricPress),
            trend: null,
          },
        ]
      : []),
  ];

  const gridColsClass =
    stats.length === 3
      ? 'grid-cols-3'
      : stats.length === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : stats.length === 5
          ? 'grid-cols-2 sm:grid-cols-5'
          : 'grid-cols-3 lg:grid-cols-6';

  return (
    <div
      className={cn(
        "w-full rounded-[24px] border overflow-hidden",
        isDark
          ? "border-white/[0.12] bg-white/[0.045] shadow-[0_12px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/90 bg-white/55 shadow-[0_10px_30px_rgba(38,56,120,0.09),inset_0_1px_0_rgba(255,255,255,0.95)]"
      )}
    >
      <div className={cn("grid gap-px", gridColsClass)}>
        {stats.map((item) => {
          const Icon = item.icon;
          const isClickable = item.clickable;

          const cellClass = cn(
            "min-h-[82px] sm:min-h-[92px] px-3 sm:px-4 py-3.5 sm:py-4 transition-colors flex flex-col justify-between gap-2 text-left select-none",
            isDark
              ? "bg-[#080F2E]/72 text-white"
              : "bg-white/72 text-slate-900",
            isClickable && (
              isDark
                ? "cursor-pointer hover:bg-[#0D1742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-arvdoul-purple"
                : "cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-arvdoul-purple"
            )
          );

          const inner = (
            <>
              <div className="flex items-center justify-between gap-1.5 w-full">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {item.label}
                </span>
                <Icon className={cn("w-3.5 h-3.5 shrink-0 opacity-85", item.accentClass)} />
              </div>

              <div className="flex items-baseline justify-between gap-1.5 w-full">
                <span className="font-display text-lg sm:text-[22px] font-bold tracking-tight tabular-nums text-slate-900 dark:text-white leading-none">
                  {item.value}
                </span>
                {item.trend && (
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                    {item.trend}
                  </span>
                )}
              </div>
            </>
          );

          return isClickable ? (
            <button
              key={item.key}
              type="button"
              onClick={() => onMetricPress?.(item.key)}
              aria-label={`${item.label}: ${item.value}`}
              className={cellClass}
            >
              {inner}
            </button>
          ) : (
            <div key={item.key} className={cellClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ProfileMetricsGrid.displayName = 'ProfileMetricsGrid';

export default ProfileMetricsGrid;
