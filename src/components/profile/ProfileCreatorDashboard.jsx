/**
 * Production-grade Creator Studio Dashboard.
 * Displays hairline-divided audience analytics (Profile Views, Reach,
 * Engagement, Coins Earned) with real sparklines + creator ranking standing.
 *
 * Strictly zero fabricated trends/metrics and fail-closed on missing data.
 *
 * @component
 */

import { memo, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Crown,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LEVEL_GATES } from '../../services/levelSystemService';
import { resolveCreatorFlag } from '../../services/profileReadModel.js';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { tokens, BRAND_GRADIENT } from '../../design-system/tokens.js';

const Sparkline = ({ color = 'var(--arv-brand-violet)', data = null }) => {
  const safeData = Array.isArray(data) && data.length >= 2 ? data : null;
  if (!safeData) {
    return (
      <div className="w-full max-w-[110px] h-8 flex items-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
        No trend data yet
      </div>
    );
  }
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const width = 100;
  const height = 32;

  const points = safeData.map((val, idx) => {
    const denom = Math.max(1, safeData.length - 1);
    const x = (idx / denom) * width;
    const y = height - ((val - min) / range) * (height - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastPoint = points.split(' ').pop().split(',');
  const lastX = Number(lastPoint[0]);
  const lastY = Number(lastPoint[1]);

  return (
    <svg width={width} height={height} className="overflow-visible w-full max-w-[110px] h-8">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="2.75" fill={color} />
    </svg>
  );
};

const ProfileCreatorDashboard = memo(({
  analytics,
  ranking,
  userLevel = null,
  isCreator = false,
  theme = 'light',
  timeframe = '7d',
  onTimeframeChange,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  useEffect(() => {
    setSelectedTimeframe(timeframe);
  }, [timeframe]);

  const explicitLevel = Number(userLevel);
  const hasLevel = Number.isFinite(explicitLevel) && explicitLevel > 0;
  const effectiveLevel = hasLevel ? explicitLevel : null;
  const isEligibleCreator = resolveCreatorFlag({ isCreator }, {}, effectiveLevel);

  if (!isEligibleCreator) {
    return (
      <div className={cn(
        "w-full rounded-[24px] p-5 border transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_10px_28px_rgba(0,0,0,0.10)]",
        isDark
          ? "bg-white/[0.055] border-white/[0.12] text-white"
          : "bg-white/65 border-white/90 text-slate-900 shadow-[0_10px_28px_rgba(38,56,120,0.08)]"
      )}>
        <div className="space-y-1.5 max-w-lg">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Crown className="w-3.5 h-3.5" />
            <span>Level {LEVEL_GATES.creatorProfile} Creator Milestone</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-slate-500 dark:text-slate-400">Locked</span>
          </div>
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight">
            Creator Dashboard & Growth Analytics
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reach Level {LEVEL_GATES.creatorProfile} to unlock real-time audience reach, impressions, sparklines, and creator monetization.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/progress')}
          className="min-h-[44px] px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shrink-0 cursor-pointer hover:brightness-110 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          style={{ background: BRAND_GRADIENT }}
        >
          Level Up Standing
        </button>
      </div>
    );
  }

  const handleSelectTimeframe = (e) => {
    const val = e.target.value;
    setSelectedTimeframe(val);
    onTimeframeChange?.(val);
  };

  const metric = (v) => (v == null ? null : Number(v));
  const views = metric(analytics?.totalViews);
  const reach = metric(analytics?.totalReach);
  const engagement = metric(analytics?.totalEngagement);
  const coins = metric(analytics?.coinsEarned);

  const viewsTrend = analytics?.changes?.views ?? analytics?.viewsGrowth ?? null;
  const reachTrend = analytics?.changes?.reach ?? analytics?.reachGrowth ?? null;
  const engagementTrend = analytics?.changes?.engagement ?? analytics?.engagementGrowth ?? null;
  const coinsTrend = analytics?.changes?.coins ?? analytics?.coinsGrowth ?? null;

  const dailyStats = Array.isArray(analytics?.dailyStats) ? analytics.dailyStats : [];
  const hasTrend = dailyStats.length >= 2;
  const series = (key) => {
    if (!hasTrend) return null;
    const values = dailyStats.map((d) => unknownNumber(d?.[key]));
    return values.every((v) => v !== null) ? values : null;
  };
  const viewsSeries = series('views');
  const reachSeries = series('reach');
  const engagementSeries = series('engagement');
  const coinsSeries = series('coins');

  const formatTrend = (trend) => {
    const num = unknownNumber(trend);
    if (num === null) return { text: '—', isNeutral: true };
    if (num > 0) return { text: `▲ +${num.toFixed(1)}%`, isPositive: true };
    if (num < 0) return { text: `▼ ${num.toFixed(1)}%`, isPositive: false };
    return { text: '— 0.0%', isNeutral: true };
  };

  const vTrend = formatTrend(viewsTrend);
  const rTrend = formatTrend(reachTrend);
  const eTrend = formatTrend(engagementTrend);
  const cTrend = formatTrend(coinsTrend);

  const rankLabel = ranking?.percentile
    ? `Top ${ranking.percentile}%`
    : ranking?.position || ranking?.rank
    ? `#${ranking.position || ranking.rank}`
    : ranking?.label
    ? ranking.label
    : '—';

  const timeframeLabel = selectedTimeframe === '7d' ? '7d'
    : selectedTimeframe === '30d' ? '30d'
    : selectedTimeframe === '90d' ? '90d' : '1y';

  const studioCells = [
    {
      key: 'views',
      label: `Period Views (${timeframeLabel})`,
      value: views === null ? '—' : views >= 1000 ? `${(views / 1000).toFixed(0)}K` : views,
      trend: vTrend,
      sparkColor: 'var(--arv-brand-violet)',
      sparkData: viewsSeries,
    },
    {
      key: 'reach',
      label: 'Audience Reach',
      value: reach === null ? '—' : reach >= 1000 ? `${(reach / 1000).toFixed(0)}K` : reach,
      trend: rTrend,
      sparkColor: tokens.color.brand.cyan,
      sparkData: reachSeries,
    },
    {
      key: 'engagement',
      label: 'Engagement',
      value: engagement === null ? '—' : engagement >= 1000 ? `${(engagement / 1000).toFixed(1)}K` : engagement,
      trend: eTrend,
      sparkColor: tokens.color.brand.pink,
      sparkData: engagementSeries,
    },
    {
      key: 'coins',
      label: `Coins Earned (${timeframeLabel})`,
      value: coins === null ? '—' : coins >= 1000000 ? `${(coins / 1000000).toFixed(2)}M` : coins >= 1000 ? `${(coins / 1000).toFixed(1)}K` : coins,
      trend: cTrend,
      sparkColor: tokens.color.semantic.warning,
      sparkData: coinsSeries,
    },
  ];

  return (
    <div className={cn(
      "w-full rounded-[24px] border overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.10)]",
      isDark
        ? "bg-[#080F2E]/78 border-white/[0.12] text-white"
        : "bg-white/70 border-white/90 text-slate-900 shadow-[0_10px_28px_rgba(38,56,120,0.08)]"
    )}>
      {/* Studio Header */}
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b",
        isDark ? "border-white/[0.07]" : "border-slate-100"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-arvdoul-purple shrink-0" />
          <h2 className="font-display font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
            Creator Dashboard
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/profile/analytics')}
            className={cn(
              "min-h-[38px] text-xs font-semibold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              isDark
                ? "bg-white/[0.04] hover:bg-white/[0.08] text-purple-300 border-white/10"
                : "bg-purple-50/70 hover:bg-purple-100/80 text-arvdoul-purple border-purple-200/80"
            )}
            title="Open Full Analytics Studio"
          >
            <span>Full Insights</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <select
              aria-label="Analytics timeframe"
              value={selectedTimeframe}
              onChange={handleSelectTimeframe}
              className={cn(
                "min-h-[38px] appearance-none text-xs font-semibold pl-3 pr-7 py-1.5 rounded-xl border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                isDark
                  ? "bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              <option value="7d">This Week</option>
              <option value="30d">This Month</option>
              <option value="90d">90 Days</option>
              <option value="365d">This Year</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </div>
        </div>
      </div>

      {/* Hairline-Divided Studio Metrics */}
      <div className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px",
        isDark ? "bg-white/[0.07]" : "bg-slate-200/80"
      )}>
        {studioCells.map((cell) => (
          <div
            key={cell.key}
            className={cn(
              "p-3.5 sm:p-4 flex flex-col justify-between gap-2",
              isDark ? "bg-[#080F2E]" : "bg-white"
            )}
          >
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {cell.label}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-lg sm:text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {cell.value}
                </span>
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  cell.trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : cell.trend.isNeutral ? "text-slate-400" : "text-rose-500"
                )}>
                  {cell.trend.text}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <Sparkline color={cell.sparkColor} data={cell.sparkData} />
            </div>
          </div>
        ))}

        {/* Creator Standing / Ranking Cell */}
        <button
          type="button"
          aria-label="View creator rankings"
          onClick={() => navigate('/rankings')}
          className={cn(
            "p-3.5 sm:p-4 flex flex-col items-center justify-center text-center col-span-2 sm:col-span-1 transition-colors group cursor-pointer",
            isDark
              ? "bg-[#0B1438] hover:bg-[#101C4D]"
              : "bg-slate-50/70 hover:bg-purple-50/60"
          )}
        >
          <div
            className="w-10 h-10 rounded-full p-[2px] flex items-center justify-center group-hover:scale-105 transition-transform mb-2"
            style={{ background: BRAND_GRADIENT }}
          >
            <div className={cn(
              "w-full h-full rounded-full flex items-center justify-center",
              isDark ? "bg-[#080F2E]" : "bg-white"
            )}>
              <Crown className="w-4 h-4 text-arvdoul-purple" />
            </div>
          </div>

          <div className="font-display text-sm font-bold text-arvdoul-purple dark:text-purple-300 tabular-nums">
            {rankLabel}
          </div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Among Creators
          </div>
        </button>
      </div>
    </div>
  );
});

ProfileCreatorDashboard.displayName = 'ProfileCreatorDashboard';

export default ProfileCreatorDashboard;
