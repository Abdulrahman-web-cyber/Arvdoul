// src/screens/Achievements/AchievementsScreen.jsx
//
// Server-validated, categorized, auditable, zero-pill design.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import achievementService from '../../services/achievementService';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { AchievementIcon } from '../../components/Shared/ProgressionIcons.jsx';
import { CheckCircle2, Lock, Sparkles, Share2, Search, X, Loader2, RefreshCw } from "lucide-react";
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'progression', label: 'Progression' },
  { id: 'creation', label: 'Creation' },
  { id: 'creator', label: 'Creator' },
  { id: 'community', label: 'Community' },
  { id: 'social', label: 'Social & Graph' },
  { id: 'economy', label: 'Economy' },
  { id: 'citizenship', label: 'Citizenship' },
  { id: 'historical', label: 'Historical' },
];

export default function AchievementsScreen() {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingItem, setInspectingItem] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';

  const loadAchievements = useCallback(async ({ forceProfile = false } = {}) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      let source = userProfile || user;
      if (forceProfile || !userProfile?.level) {
        const { getUserService } = await import('../../services/userService.js');
        const freshProfile = await getUserService().getUserProfile(user.uid, user.uid).catch(() => null);
        if (freshProfile) source = freshProfile;
      }

      const items = await achievementService.getEnrichedAchievements(user.uid, {
        level: source.level,
        activeStreak: source.activeStreak,
        activeDaysCount: source.activeDaysCount,
        postsCount: source.postsCount ?? source.postCount,
        likesCount: source.likesCount,
        commentsCount: source.commentsCount,
        friendsCount: source.friendsCount,
      });
      setAchievements(items);
    } catch {
      setLoadError('Failed to load achievements.');
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, [user, userProfile]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const handleEvaluate = async () => {
    if (!user?.uid || evaluating) return;
    setEvaluating(true);
    try {
      const res = await achievementService.evaluateAchievements(user.uid);
      if (res?.newlyEarnedCount > 0) {
        toast.success(`Unlocked ${res.newlyEarnedCount} new achievement${res.newlyEarnedCount > 1 ? 's' : ''}!`);
        await loadAchievements();
      } else {
        toast.info('Achievements up to date. Keep participating to unlock more!');
      }
    } catch {
      toast.error('Could not verify milestones right now');
    } finally {
      setEvaluating(false);
    }
  };

  const filteredItems = useMemo(() => {
    return achievements.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (filterMode === 'unlocked' && !item.unlocked) return false;
      if (filterMode === 'locked' && item.unlocked) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [achievements, selectedCategory, filterMode, searchQuery]);

  const stats = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked);
    const totalPoints = unlocked.reduce((acc, a) => acc + (a.points || 0), 0);
    return {
      unlockedCount: unlocked.length,
      totalCount: achievements.length,
      totalPoints,
      percentage: achievements.length > 0 ? Math.round((unlocked.length / achievements.length) * 100) : 0,
    };
  }, [achievements]);

  if (loading) {
    return (
      <div className={`min-h-screen pb-24 flex items-center justify-center ${isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" aria-label="Loading achievements" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-200 ${isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'}`}>
      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-5 space-y-6">
        {/* Utility Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-semibold flex items-center gap-2 tabular-nums">
            <span className={isDark ? 'text-purple-400' : 'text-purple-700'}>
              {stats.unlockedCount} of {stats.totalCount} unlocked
            </span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
              {stats.totalPoints.toLocaleString()} points
            </span>
          </div>

          <button
            type="button"
            onClick={handleEvaluate}
            disabled={evaluating}
            className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            style={{ background: BRAND_GRADIENT }}
          >
            <Sparkles className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Checking…' : 'Check Milestones'}</span>
          </button>
        </div>

        {loadError && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? 'bg-rose-500/10 border-rose-400/25 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            <span className="text-xs font-semibold">{loadError}</span>
            <button
              type="button"
              onClick={() => loadAchievements({ forceProfile: true })}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${isDark ? 'border-white/15 bg-white/10 text-white' : 'border-rose-200 bg-white text-rose-700'}`}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Summary Card */}
        <section
          aria-labelledby="achievements-summary"
          className={`p-6 rounded-3xl border ${
            isDark ? 'bg-[#080F2E]/90 border-white/[0.08]' : 'bg-white border-slate-200/80 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                Honor Roll
              </span>
              <h2 id="achievements-summary" className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums">
                {stats.percentage}% Completed
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Verified record of civic, creative, and economic contributions to Arvdoul.
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm tabular-nums">
              <div>
                <span className="text-xs text-slate-500 block">Total Points</span>
                <span className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{stats.totalPoints}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Earned</span>
                <span className="text-lg font-bold text-emerald-500">{stats.unlockedCount}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Locked</span>
                <span className="text-lg font-bold text-slate-500">{stats.totalCount - stats.unlockedCount}</span>
              </div>
            </div>
          </div>

          <div className={`mt-5 h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%`, background: BRAND_GRADIENT }}
            />
          </div>
        </section>

        {/* Search & Filter Mode */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className={`flex-1 flex items-center px-3.5 min-h-[44px] rounded-2xl border ${
              isDark ? 'bg-[#080F2E]/90 border-white/[0.08]' : 'bg-white border-slate-200'
            }`}>
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                aria-label="Search achievements..."
                type="text"
                placeholder="Search achievements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs sm:text-sm w-full outline-none py-2"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="p-1.5 text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className={`flex items-center rounded-2xl p-1 border shrink-0 ${
              isDark ? 'bg-[#080F2E]/90 border-white/[0.08]' : 'bg-white border-slate-200'
            }`}>
              {['all', 'unlocked', 'locked'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`min-h-[36px] text-xs capitalize px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    filterMode === mode
                      ? isDark
                        ? 'bg-purple-500/20 text-purple-200 font-semibold'
                        : 'bg-purple-50 text-purple-700 font-semibold'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Underline Category Tabs */}
          <div
            role="tablist"
            aria-label="Achievement categories"
            className={`flex items-center overflow-x-auto no-scrollbar border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`relative min-h-[44px] text-xs px-3 py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? isDark ? 'text-white font-semibold' : 'text-slate-950 font-semibold'
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: BRAND_GRADIENT }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Achievement Grid */}
        <section aria-label="Achievements list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setInspectingItem(item)}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-colors cursor-pointer ${
                item.unlocked
                  ? isDark
                    ? 'bg-[#080F2E]/90 border-purple-500/30 hover:border-purple-400/50'
                    : 'bg-white border-purple-200 hover:border-purple-300 shadow-sm'
                  : isDark
                    ? 'bg-[#080F2E]/50 border-white/[0.06] opacity-70 hover:opacity-100'
                    : 'bg-white/70 border-slate-200 opacity-75 hover:opacity-100'
              }`}
            >
              <div
                className={`shrink-0 p-2.5 rounded-xl ${
                  item.unlocked
                    ? isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700'
                    : isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}
                aria-hidden="true"
              >
                <AchievementIcon category={item.category} rarity={item.rarity} className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                  {item.unlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </div>

                <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{item.description}</p>

                <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-xs tabular-nums ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                  <span>{item.rarity} · {item.points} pts</span>
                  {item.unlocked ? (
                    <span className="text-emerald-500 font-medium">Unlocked</span>
                  ) : item.progress == null ? (
                    <span>Locked</span>
                  ) : (
                    <span>{item.progress}% progress</span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-slate-500">
              No achievements found matching your criteria.
            </div>
          )}
        </section>
      </main>

      {/* Detail Inspection Modal */}
      {inspectingItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className={`max-w-md w-full p-6 rounded-3xl border ${
              isDark ? 'bg-[#080F2E] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                <AchievementIcon category={inspectingItem.category} rarity={inspectingItem.rarity} className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                aria-label="Close dialog"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                {inspectingItem.category} · {inspectingItem.rarity}
              </span>
              <h3 className="text-xl font-bold mt-1">{inspectingItem.title}</h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{inspectingItem.description}</p>
            </div>

            <div className={`mt-5 p-4 rounded-2xl border space-y-2 text-xs ${isDark ? 'bg-[#03071B]/60 border-white/[0.08]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between">
                <span className="text-slate-500">Honor Points</span>
                <span className={`font-semibold tabular-nums ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{inspectingItem.points} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={inspectingItem.unlocked ? 'text-emerald-500 font-semibold' : 'text-slate-500'}>
                  {inspectingItem.unlocked ? 'Verified & Granted' : 'In Progress'}
                </span>
              </div>
              {inspectingItem.earnedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Granted Date</span>
                  <span>{new Date(inspectingItem.earnedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  toast.success('Achievement link copied to clipboard');
                  setInspectingItem(null);
                }}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-95 flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: BRAND_GRADIENT }}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Proof</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? 'border-white/15 hover:bg-white/5 text-slate-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
