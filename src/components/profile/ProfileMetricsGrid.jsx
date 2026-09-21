// src/components/profile/ProfileMetricsGrid.jsx

import React, { memo } from 'react';
import { 
  Grid3x3, 
  Users, 
  UserCheck, 
  UserPlus, 
  Eye, 
  Coins, 
  Heart,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
}) => {
  const isDark = theme === 'dark';

  const postsCount = profile?.postCount ?? profile?.postsCount ?? profile?.posts?.length ?? 0;
  const followersCount = profile?.followerCount ?? profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const friendsCount = profile?.friendCount ?? profile?.friendsCount ?? 0;
  const likesCount = profile?.likesReceived ?? profile?.likesCount ?? 0;
  const coinsCount = profile?.coins ?? profile?.coinBalance ?? profile?.balance ?? 0;
  const profileViews = analytics?.totalViews ?? profile?.viewsCount ?? profile?.profileViews ?? 0;

  const followersTrend = analytics?.changes?.reach && Number(analytics.changes.reach) !== 0
    ? `${Number(analytics.changes.reach) > 0 ? '+' : ''}${Number(analytics.changes.reach).toFixed(1)}%`
    : null;

  const viewsTrend = analytics?.changes?.views && Number(analytics.changes.views) !== 0
    ? `${Number(analytics.changes.views) > 0 ? '+' : ''}${Number(analytics.changes.views).toFixed(1)}%`
    : null;

  const cards = isOwner
    ? [
        {
          key: 'posts',
          label: 'Posts',
          value: formatNumber(postsCount),
          icon: Grid3x3,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
          trend: null
        },
        {
          key: 'friends',
          label: 'Friends',
          value: formatNumber(friendsCount),
          icon: Users,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          trend: null
        },
        {
          key: 'followers',
          label: 'Followers',
          value: formatNumber(followersCount),
          icon: UserCheck,
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-500/10',
          trend: followersTrend
        },
        {
          key: 'following',
          label: 'Following',
          value: formatNumber(followingCount),
          icon: UserPlus,
          color: 'text-sky-500',
          bgColor: 'bg-sky-500/10',
          trend: null
        },
        {
          key: 'views',
          label: 'Profile Views',
          value: formatNumber(profileViews),
          icon: Eye,
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/10',
          trend: viewsTrend
        },
        {
          key: 'coins',
          label: 'Coins',
          value: formatNumber(coinsCount),
          icon: Coins,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          trend: null
        }
      ]
    : [
        {
          key: 'posts',
          label: 'Posts',
          value: formatNumber(postsCount),
          icon: Grid3x3,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10'
        },
        {
          key: 'followers',
          label: 'Followers',
          value: formatNumber(followersCount),
          icon: UserCheck,
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-500/10'
        },
        {
          key: 'following',
          label: 'Following',
          value: formatNumber(followingCount),
          icon: UserPlus,
          color: 'text-sky-500',
          bgColor: 'bg-sky-500/10'
        },
        {
          key: 'friends',
          label: 'Friends',
          value: formatNumber(friendsCount),
          icon: Users,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10'
        },
        {
          key: 'likes',
          label: 'Likes',
          value: formatNumber(likesCount),
          icon: Heart,
          color: 'text-rose-500',
          bgColor: 'bg-rose-500/10'
        },
        {
          key: 'coins',
          label: 'Coins',
          value: formatNumber(coinsCount),
          icon: Coins,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10'
        }
      ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              onClick={() => onMetricPress?.(card.key)}
              className={cn(
                "p-3.5 sm:p-4 rounded-2xl border backdrop-blur-xl transition-all hover:scale-[1.02] cursor-pointer shadow-sm group",
                isDark
                  ? "bg-[#0d1424]/70 border-white/10 hover:border-purple-500/30 text-white"
                  : "bg-white/95 border-slate-200/90 hover:border-purple-500/30 text-slate-900"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl shrink-0", card.bgColor)}>
                  <Icon className={cn("w-4 h-4", card.color)} />
                </div>
                {card.trend && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    <TrendingUp className="w-2.5 h-2.5" />
                    {card.trend}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="text-base sm:text-lg font-black tracking-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {card.value}
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

ProfileMetricsGrid.displayName = 'ProfileMetricsGrid';

export default ProfileMetricsGrid;
