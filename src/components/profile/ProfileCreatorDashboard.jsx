/**
 * src/components/profile/ProfileCreatorDashboard.jsx - ARVDOUL Creator Dashboard Component
 * 
 * Recreates the Creator Dashboard section from the uploaded designs:
 * - Header with BarChart2 icon and timeframe dropdown
 * - 5 metric cards:
 *   1. Profile Views (with sparkline curve)
 *   2. Reach (with sparkline curve)
 *   3. Engagement (with sparkline curve)
 *   4. Coins Earned (with sparkline curve)
 *   5. Top Creator Ranking ("Top 1% Among Creators" with Crown icon)
 * 
 * @component
 */

import React, { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  TrendingUp, 
  Eye, 
  Users, 
  Heart, 
  Coins, 
  Crown,
  ChevronDown,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Clean SVG Sparklines
const Sparkline = ({ color = '#a855f7', data = [0, 0] }) => {
  const safeData = Array.isArray(data) && data.length > 0 ? data : [0, 0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const width = 80;
  const height = 28;

  const points = safeData.map((val, idx) => {
    const denom = Math.max(1, safeData.length - 1);
    const x = (idx / denom) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const ProfileCreatorDashboard = memo(({
  analytics,
  ranking,
  theme = 'light',
  timeframe = '7d',
  onTimeframeChange,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  const handleSelectTimeframe = (e) => {
    const val = e.target.value;
    setSelectedTimeframe(val);
    onTimeframeChange?.(val);
  };

  const views = Number(analytics?.totalViews ?? 0);
  const reach = Number(analytics?.totalReach ?? 0);
  const engagement = Number(analytics?.totalEngagement ?? 0);
  const coins = Number(analytics?.coinsEarned ?? 0);

  const changes = analytics?.changes || {};
  const dailyStats = Array.isArray(analytics?.dailyStats) ? analytics.dailyStats : [];

  const viewsSeries = dailyStats.length > 1 ? dailyStats.map(s => Number(s.views) || 0) : [0, views];
  const reachSeries = dailyStats.length > 1 ? dailyStats.map(s => Number(s.reach) || 0) : [0, reach];
  const engagementSeries = dailyStats.length > 1 ? dailyStats.map(s => Number(s.engagement) || 0) : [0, engagement];
  const coinsSeries = dailyStats.length > 1 ? dailyStats.map(s => Number(s.coins) || 0) : [0, coins];

  const renderTrendBadge = (changeVal) => {
    if (changeVal === undefined || changeVal === null || isNaN(changeVal)) {
      return (
        <span className="text-[10px] font-medium text-slate-400">
          --
        </span>
      );
    }
    const num = Number(changeVal);
    const isPositive = num >= 0;
    const sign = isPositive ? '+' : '';
    return (
      <span className={cn(
        "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
        isPositive 
          ? "text-emerald-500 bg-emerald-500/10" 
          : "text-rose-500 bg-rose-500/10"
      )}>
        {sign}{num.toFixed(1)}%
      </span>
    );
  };

  // Rank info
  const standingPercentile = ranking?.percentile ? `Top ${ranking.percentile}%` : 'Active';
  const standingLabel = ranking?.rank ? `Rank #${ranking.rank} Global` : (ranking?.tier || 'Creator');

  return (
    <div className={cn(
      "w-full rounded-3xl p-5 sm:p-6 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/70 border-white/10 text-white"
        : "bg-white/95 border-slate-200/90 text-slate-900"
    )}>
      {/* Header with Timeframe Dropdown */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base leading-tight">
              Creator Dashboard
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Audience growth and monetization metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedTimeframe}
              onChange={handleSelectTimeframe}
              className={cn(
                "appearance-none text-xs font-semibold pl-3 pr-7 py-1.5 rounded-xl border cursor-pointer transition-all outline-none",
                isDark
                  ? "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              <option value="7d">This Week</option>
              <option value="30d">This Month</option>
              <option value="all">All Time</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          <button
            onClick={() => navigate('/profile/analytics')}
            className="p-1.5 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
            title="Detailed Analytics"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Views */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all hover:scale-[1.02]",
          isDark ? "bg-white/5 border-white/10" : "bg-slate-50/80 border-slate-200/80"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Profile Views
            </span>
            {renderTrendBadge(changes.views)}
          </div>
          <div className="text-lg font-black tracking-tight mb-2">
            {Number(views).toLocaleString()}
          </div>
          <Sparkline color="#8b5cf6" data={viewsSeries} />
        </div>

        {/* 2. Reach */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all hover:scale-[1.02]",
          isDark ? "bg-white/5 border-white/10" : "bg-slate-50/80 border-slate-200/80"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Reach
            </span>
            {renderTrendBadge(changes.reach)}
          </div>
          <div className="text-lg font-black tracking-tight mb-2">
            {Number(reach).toLocaleString()}
          </div>
          <Sparkline color="#06b6d4" data={reachSeries} />
        </div>

        {/* 3. Engagement */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all hover:scale-[1.02]",
          isDark ? "bg-white/5 border-white/10" : "bg-slate-50/80 border-slate-200/80"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Engagement
            </span>
            {renderTrendBadge(changes.engagement)}
          </div>
          <div className="text-lg font-black tracking-tight mb-2">
            {Number(engagement).toLocaleString()}
          </div>
          <Sparkline color="#ec4899" data={engagementSeries} />
        </div>

        {/* 4. Coins Earned */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all hover:scale-[1.02]",
          isDark ? "bg-white/5 border-white/10" : "bg-slate-50/80 border-slate-200/80"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Coins Earned
            </span>
            {renderTrendBadge(changes.coins)}
          </div>
          <div className="text-lg font-black tracking-tight text-amber-500 mb-2">
            🪙 {Number(coins).toLocaleString()}
          </div>
          <Sparkline color="#f59e0b" data={coinsSeries} />
        </div>

        {/* 5. Standing */}
        <div className={cn(
          "p-4 rounded-2xl border flex flex-col justify-between transition-all hover:scale-[1.02] col-span-2 sm:col-span-1",
          isDark 
            ? "bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-blue-900/30 border-purple-500/20" 
            : "bg-gradient-to-br from-purple-50 via-indigo-50/60 to-blue-50 border-purple-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              Standing
            </span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-purple-700 dark:text-purple-300">
              {standingPercentile}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Among Creators
            </div>
          </div>
          <div className="pt-2 text-[10px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <span>{standingLabel}</span>
            <TrendingUp className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileCreatorDashboard.displayName = 'ProfileCreatorDashboard';

export default ProfileCreatorDashboard;
