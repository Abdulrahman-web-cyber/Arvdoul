/**
 * Arvdoul — ProfileStats Component
 *
 * Compact, responsive social and civic statistics bar.
 * Adheres strictly to Zero-Pill discipline (rounded-xl/rounded-2xl) and light/dark theme tokens.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  FileText,
  Users,
  UserCheck,
  HeartHandshake,
  Heart,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getReputationBand } from '../../shared/levelConfig.cjs';

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ProfileStats = memo(({
  posts = 0,
  followers = 0,
  following = 0,
  friends = 0,
  likes = 0,
  coins = null,
  reputation = null,
  theme = 'light',
  onStatPress,
  className = '',
}) => {
  const isDark = theme === 'dark';

  const stats = [
    {
      key: 'posts',
      label: 'Posts',
      value: formatNumber(posts),
      icon: FileText,
      accent: 'text-violet-500',
    },
    {
      key: 'followers',
      label: 'Followers',
      value: formatNumber(followers),
      icon: Users,
      accent: 'text-cyan-500',
    },
    {
      key: 'following',
      label: 'Following',
      value: formatNumber(following),
      icon: UserCheck,
      accent: 'text-blue-500',
    },
    {
      key: 'friends',
      label: 'Friends',
      value: formatNumber(friends),
      icon: HeartHandshake,
      accent: 'text-indigo-500',
    },
  ];

  if (likes > 0) {
    stats.push({
      key: 'likes',
      label: 'Likes',
      value: formatNumber(likes),
      icon: Heart,
      accent: 'text-rose-500',
    });
  }

  // Display coins only when non-null (owner view)
  if (coins !== null && coins !== undefined) {
    stats.push({
      key: 'coins',
      label: 'Coins',
      value: formatNumber(coins),
      icon: Coins,
      accent: 'text-amber-500',
    });
  }

  // Display reputation if available
  if (reputation !== null && reputation !== undefined) {
    const repScore = Number(reputation);
    const band = getReputationBand(repScore);
    stats.push({
      key: 'reputation',
      label: band?.title || 'Standing',
      value: formatNumber(repScore),
      icon: ShieldCheck,
      accent: 'text-emerald-500',
    });
  }

  return (
    <div
      role="region"
      aria-label="Profile metrics"
      className={cn(
        'grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 gap-2 w-full',
        className
      )}
    >
      {stats.map((item) => {
        const Icon = item.icon;
        const clickable = typeof onStatPress === 'function';

        return (
          <button
            key={item.key}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onStatPress(item.key)}
            className={cn(
              'flex flex-col items-center justify-center py-2 px-1.5 rounded-xl transition-all duration-150 text-center select-none',
              clickable
                ? isDark
                  ? 'hover:bg-white/[0.06] active:scale-[0.98] cursor-pointer'
                  : 'hover:bg-black/[0.04] active:scale-[0.98] cursor-pointer'
                : 'cursor-default',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'
            )}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <Icon className={cn('w-3.5 h-3.5', item.accent)} />
              <span className={cn(
                'text-sm font-bold tracking-tight',
                isDark ? 'text-white' : 'text-slate-900'
              )}>
                {item.value}
              </span>
            </div>
            <span className={cn(
              'text-[11px] font-medium leading-none',
              isDark ? 'text-white/50' : 'text-slate-500'
            )}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});

ProfileStats.displayName = 'ProfileStats';

ProfileStats.propTypes = {
  posts: PropTypes.number,
  followers: PropTypes.number,
  following: PropTypes.number,
  friends: PropTypes.number,
  likes: PropTypes.number,
  coins: PropTypes.number,
  reputation: PropTypes.number,
  theme: PropTypes.string,
  onStatPress: PropTypes.func,
  className: PropTypes.string,
};

export default ProfileStats;
