// src/screens/Rankings/RankingsScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { 
  Trophy, 
  Crown, 
  Medal, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  Star, 
  Users, 
  Flame,
  LineChart, 
  Coins, 
  ShieldCheck, 
  Check, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { RANKING_CONFIG } from '../../services/rankingService.js';
import rankingService from '../../services/rankingService.js';
import { cn } from '../../lib/utils';

const TabButton = ({ active, onClick, children, icon: Icon, isDark }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap",
      active 
        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" 
        : isDark
        ? "bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]"
        : "bg-slate-200/70 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
    )}
  >
    {Icon && <Icon className="w-4 h-4 shrink-0" />}
    <span>{children}</span>
  </button>
);

const TimeRangeSelector = ({ value, onChange, isDark }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
    {RANKING_CONFIG.TIME_RANGES.map((range) => (
      <button
        key={range.id}
        type="button"
        onClick={() => onChange(range.id)}
        className={cn(
          "px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
          value === range.id 
            ? "bg-purple-600 text-white shadow-sm" 
            : isDark
            ? "bg-white/[0.03] text-slate-400 hover:text-white"
            : "bg-slate-100 text-slate-600 hover:text-slate-900"
        )}
        aria-label={`Show ${range.name} rankings`}
      >
        {range.name}
      </button>
    ))}
  </div>
);

const TrendIndicator = ({ trend }) => {
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-xs font-bold">
        <ArrowUp className="w-3 h-3" /> +{trend}
      </span>
    );
  } else if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 text-xs font-bold">
        <ArrowDown className="w-3 h-3" /> {trend}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-500 text-xs font-medium">
      <Minus className="w-3 h-3" /> 0
    </span>
  );
};

const TierBadge = ({ tier }) => (
  <span
    className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
    style={{ backgroundColor: tier.color || '#8B1EF3', color: '#fff' }}
    aria-label={`Tier: ${tier.name}`}
  >
    {tier.name}
  </span>
);

const UserAvatar = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  return (
    <div className={cn(
      sizeClasses[size],
      "rounded-full bg-gradient-to-tr from-[#8B1EF3] to-[#4431F7] flex items-center justify-center text-white font-black overflow-hidden shadow-sm shrink-0"
    )}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.displayName || 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        (user?.displayName || user?.username || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
};

const RankCard = ({ rank, item, isDark }) => {
  const navigate = useNavigate();
  
  const getRankBadge = (rank) => {
    switch (rank) {
      case 1: 
        return (
          <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/40 shadow-sm">
            <Crown className="w-4 h-4 fill-amber-400" />
          </div>
        );
      case 2: 
        return (
          <div className="w-8 h-8 rounded-full bg-slate-300/20 text-slate-300 flex items-center justify-center border border-slate-300/40 shadow-sm">
            <Medal className="w-4 h-4" />
          </div>
        );
      case 3: 
        return (
          <div className="w-8 h-8 rounded-full bg-amber-600/20 text-amber-500 flex items-center justify-center border border-amber-600/40 shadow-sm">
            <Medal className="w-4 h-4" />
          </div>
        );
      default: 
        return <span className="font-mono text-xs font-bold text-slate-400">#{rank}</span>;
    }
  };

  const handleClick = () => {
    if (item.userId) {
      navigate(`/profile/${item.userId}`);
    } else if (item.communityId) {
      navigate(`/community/${item.communityId}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99]",
        rank <= 3 
          ? isDark
            ? "bg-gradient-to-r from-purple-950/30 via-[#070D27] to-[#070D27] border-purple-500/30 shadow-md"
            : "bg-gradient-to-r from-purple-50 via-white to-white border-purple-200 shadow-sm"
          : isDark
          ? "bg-[#070D27]/80 hover:bg-[#070D27] border-white/[0.06] hover:border-white/10"
          : "bg-white hover:bg-slate-50 border-slate-200"
      )}
      role="listitem"
      aria-label={`Rank ${rank}: ${item.user?.displayName || item.community?.name || 'Unknown'}`}
    >
      {/* Rank Indicator */}
      <div className="w-8 text-center shrink-0 flex items-center justify-center">
        {getRankBadge(rank)}
      </div>

      {/* Avatar */}
      <UserAvatar user={item.user || item.community} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
          <span>{item.user?.displayName || item.community?.name || 'Citizen'}</span>
          {item.badge && <TierBadge tier={item.badge} />}
        </h4>
        <p className="text-slate-400 text-xs truncate font-mono">
          @{item.user?.username || item.community?.name?.toLowerCase().replace(/\s/g, '_') || 'unknown'}
        </p>
      </div>

      {/* Score & Trend */}
      <div className="text-right shrink-0">
        <div className="font-black text-sm sm:text-base text-purple-400">
          {item.score?.toLocaleString() || 0}
        </div>
        <TrendIndicator trend={item.trend} />
      </div>

      <ChevronRight className="w-4 h-4 text-slate-400 opacity-40 shrink-0" />
    </div>
  );
};

export default function RankingsScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'midnight';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('creators');
  const [activeCategory, setActiveCategory] = useState('engagement');
  const [activeTimeRange, setActiveTimeRange] = useState('month');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Fetch rankings
  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let data = [];
      
      switch (activeTab) {
        case 'creators':
          data = await rankingService.getCreatorRankings(activeCategory, activeTimeRange, offset);
          break;
        case 'wealth':
          data = await rankingService.getWealthRankings(activeCategory, activeTimeRange, offset);
          break;
        case 'reputation':
          data = await rankingService.getReputationRankings(activeCategory, activeTimeRange, offset);
          break;
        case 'communities':
          data = await rankingService.getCommunityRankings(activeCategory, activeTimeRange, offset);
          break;
        case 'rising':
          data = await rankingService.getRisingCreators(activeTimeRange, offset);
          break;
        default:
          data = [];
      }

      if (offset === 0) {
        setRankings(data);
      } else {
        setRankings((prev) => [...prev, ...data]);
      }
      
      setHasMore(data.length >= RANKING_CONFIG.PAGE_SIZE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory, activeTimeRange, offset]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  useEffect(() => {
    setOffset(0);
    setRankings([]);
  }, [activeTab, activeCategory, activeTimeRange]);

  const handleLoadMore = () => {
    setOffset((prev) => prev + RANKING_CONFIG.PAGE_SIZE);
  };

  const getCategories = () => {
    switch (activeTab) {
      case 'creators':
        return Object.values(RANKING_CONFIG.CATEGORIES.CREATORS);
      case 'wealth':
        return Object.values(RANKING_CONFIG.CATEGORIES.WEALTH);
      case 'reputation':
        return Object.values(RANKING_CONFIG.CATEGORIES.REPUTATION);
      case 'communities':
        return Object.values(RANKING_CONFIG.CATEGORIES.COMMUNITIES);
      default:
        return [];
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      engagement: LineChart,
      views: Users,
      growth: ArrowUp,
      revenue: Coins,
      net_worth: Crown,
      coins: Coins,
      earnings: Coins,
      trust: ShieldCheck,
      contributions: Star,
      moderation: ShieldCheck,
      reliability: Check,
      activity: Flame,
    };
    return icons[category] || Trophy;
  };

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors",
      isDark ? "bg-[#03071B] text-white" : "bg-[#f0f4fa] text-slate-900"
    )}>
      {/* Sub-Tabs Toolbar (TopAppBar handles main app title and back navigation) */}
      <div className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-2xl transition-colors",
        isDark ? "bg-[#03071B]/90 border-white/[0.08]" : "bg-white/90 border-slate-200"
      )}>
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          {/* Main tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <TabButton
              active={activeTab === 'creators'}
              onClick={() => setActiveTab('creators')}
              icon={Star}
              isDark={isDark}
            >
              Creators
            </TabButton>
            <TabButton
              active={activeTab === 'wealth'}
              onClick={() => setActiveTab('wealth')}
              icon={Coins}
              isDark={isDark}
            >
              Treasury
            </TabButton>
            <TabButton
              active={activeTab === 'reputation'}
              onClick={() => setActiveTab('reputation')}
              icon={ShieldCheck}
              isDark={isDark}
            >
              Reputation
            </TabButton>
            <TabButton
              active={activeTab === 'communities'}
              onClick={() => setActiveTab('communities')}
              icon={Users}
              isDark={isDark}
            >
              Communities
            </TabButton>
            <TabButton
              active={activeTab === 'rising'}
              onClick={() => setActiveTab('rising')}
              icon={Flame}
              isDark={isDark}
            >
              Rising
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/perks')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
            >
              Perks & Rewards
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Category filters */}
        {activeTab !== 'rising' && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {getCategories().map((cat) => {
              const IconComp = getCategoryIcon(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    activeCategory === cat.id 
                      ? "bg-purple-600 text-white shadow-sm" 
                      : isDark
                      ? "bg-[#070D27] text-slate-400 hover:text-white border border-white/[0.06]"
                      : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                  )}
                  aria-label={`Filter by ${cat.name}`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Time range selector */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TimeRangeSelector
            value={activeTimeRange}
            onChange={setActiveTimeRange}
            isDark={isDark}
          />
          <span className="text-[11px] font-mono text-slate-400">
            {rankings.length} Citizens Ranked
          </span>
        </div>

        {/* Loading state */}
        {loading && rankings.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs text-rose-400">{error}</p>
            <button
              type="button"
              onClick={fetchRankings}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Rankings list */}
        <div className="space-y-2.5" role="list" aria-label="Rankings list">
          {rankings.map((item) => (
            <RankCard
              key={`${item.rank}-${item.userId || item.communityId}`}
              rank={item.rank}
              item={item}
              isDark={isDark}
            />
          ))}
        </div>

        {/* Empty state */}
        {!loading && rankings.length === 0 && !error && (
          <div className="text-center py-16 space-y-3">
            <Trophy className="w-12 h-12 text-slate-500 mx-auto opacity-40" />
            <h3 className="text-sm font-bold text-slate-400">No rankings yet in this category</h3>
            <p className="text-xs text-slate-500">Live rankings update as citizens participate across Arvdoul.</p>
          </div>
        )}

        {/* Load more */}
        {hasMore && rankings.length > 0 && (
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More Citizens'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export { RANKING_CONFIG };
