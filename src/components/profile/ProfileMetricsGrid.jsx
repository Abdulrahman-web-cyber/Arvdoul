/**
 * Production-grade Civic Metrics Hub.
 * Renders an authoritative, balanced grid of civic standing and social metrics.
 * Designed specifically for sticky rails and responsive dashboards with zero clutter.
 * 
 * @component
 */

import React, { memo } from 'react';
import { 
  FileText, 
  Users, 
  UserCheck, 
  HeartHandshake, 
  ShieldCheck, 
  Coins,
  ChevronRight
} from 'lucide-react';
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

  // Trust Standing is server-authoritative. When the profile has no reputation
  // value render an explicit unavailable state instead of inventing a default.
  const rawReputation = profile?.reputationScore ?? profile?.reputation;
  const hasReputation = rawReputation !== undefined && rawReputation !== null;
  const reputationScore = hasReputation ? Number(rawReputation) : null;
  const repBand = hasReputation ? getReputationBand(reputationScore) : null;

  const canShowFollowers = capabilities?.canViewFollowers ?? true;
  const canShowFollowing = capabilities?.canViewFollowing ?? true;

  const metrics = [
    {
      key: 'posts',
      label: 'Creations',
      value: formatNumber(postsCount),
      icon: FileText,
      iconColor: 'text-indigo-400',
      clickable: false,
    },
    {
      key: 'followers',
      label: 'Followers',
      value: canShowFollowers ? formatNumber(followersCount) : '—',
      icon: Users,
      iconColor: 'text-purple-400',
      clickable: canShowFollowers && Boolean(onMetricPress),
      subtext: canShowFollowers ? null : 'Private',
    },
    {
      key: 'following',
      label: 'Following',
      value: canShowFollowing ? formatNumber(followingCount) : '—',
      icon: UserCheck,
      iconColor: 'text-blue-400',
      clickable: canShowFollowing && Boolean(onMetricPress),
      subtext: canShowFollowing ? null : 'Private',
    },
    {
      key: 'friends',
      label: 'Mutuals',
      value: formatNumber(friendsCount),
      icon: HeartHandshake,
      iconColor: 'text-pink-400',
      clickable: Boolean(onMetricPress),
    },
    {
      key: 'reputation',
      label: 'Trust Score',
      value: hasReputation ? `${reputationScore}` : '—',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      subtext: repBand?.label,
      clickable: false,
    },
    ...(isOwner ? [{
      key: 'coins',
      label: 'Coins Ledger',
      value: formatNumber(coinsCount),
      icon: Coins,
      iconColor: 'text-amber-400',
      clickable: Boolean(onMetricPress),
    }] : [])
  ];

  return (
    <div className={cn(
      "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm",
      isDark
        ? "bg-[#0B0F19] border-slate-800/90 text-white shadow-slate-950/40"
        : "bg-white border-slate-200/90 text-slate-900 shadow-slate-100"
    )}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
          Civic Ledger Metrics
        </h4>
        <span className="text-[10px] font-mono text-slate-500">
          {metrics.length} Recorded
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {metrics.map((item, idx) => {
          const Icon = item.icon;
          const isInteractive = item.clickable;

          const content = (
            <div className={cn(
              "w-full rounded-xl p-3 border transition-all flex flex-col justify-between text-left group/card relative overflow-hidden",
              isDark
                ? "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                : "bg-slate-50 border-slate-200/80 hover:border-slate-300",
              isInteractive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            )}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn("p-1 rounded-lg bg-black/10 dark:bg-white/5", item.iconColor)}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {isInteractive && (
                  <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                )}
              </div>

              <div>
                <div className={cn(
                  "text-base sm:text-lg font-black tracking-tight",
                  isInteractive && "group-hover/card:text-indigo-500 transition-colors",
                  isDark ? "text-white" : "text-slate-900"
                )}>
                  {item.value}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {item.label}
                </div>
                {item.subtext && (
                  <div className="text-[10px] font-medium text-emerald-500 truncate pt-0.5">
                    {item.subtext}
                  </div>
                )}
              </div>
            </div>
          );

          if (isInteractive) {
            return (
              <button
                type="button"
                key={item.key || idx}
                onClick={() => onMetricPress?.(item.key)}
                className="w-full text-left focus:outline-none rounded-xl"
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
