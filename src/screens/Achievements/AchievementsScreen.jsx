// src/screens/Achievements/AchievementsScreen.jsx — ARVDOUL ACHIEVEMENTS GALLERY (Part 2)
// Server-validated, categorized, auditable, zero-pill design.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import achievementService from '../../services/achievementService';
import {
  ArrowLeft,
  Award,
  Filter,
  CheckCircle2,
  Lock,
  Sparkles,
  Share2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all'); // all | unlocked | locked
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingItem, setInspectingItem] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';

  const loadAchievements = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const items = await achievementService.getEnrichedAchievements(user.uid, {
        level: user.level || 1,
        activeStreak: user.activeStreak || 1,
        activeDaysCount: user.activeDaysCount || 1,
        postsCount: user.postsCount || user.postCount || 0,
        likesCount: user.likesCount || 0,
        commentsCount: user.commentsCount || 0,
        friendsCount: user.friendsCount || 0,
      });
      setAchievements(items);
    } catch (err) {
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  // Trigger server-side evaluation
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
    } catch (err) {
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

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 flex items-center justify-between ${
        isDark ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Achievements Gallery</h1>
            <p className="text-xs text-gray-500">
              {stats.unlockedCount} of {stats.totalCount} unlocked · {stats.totalPoints} points
            </p>
          </div>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
          <span>{evaluating ? 'Checking...' : 'Check Milestones'}</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Gallery Summary Card */}
        <section
          aria-labelledby="achievements-summary"
          className={`p-6 rounded-2xl border ${
            isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                National Honor Roll
              </span>
              <h2 id="achievements-summary" className="text-2xl font-bold tracking-tight mt-0.5">
                {stats.percentage}% Completed
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Audited proof of civic, creative, and economic contributions to Arvdoul.
              </p>
            </div>

            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Total Points</span>
                <span className="text-lg font-bold text-indigo-400">{stats.totalPoints}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Earned</span>
                <span className="text-lg font-bold text-emerald-400">{stats.unlockedCount}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Locked</span>
                <span className="text-lg font-bold text-gray-500">{stats.totalCount - stats.unlockedCount}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className={`mt-5 h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </section>

        {/* Filters & Search */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className={`flex-1 flex items-center px-3 py-2 rounded-xl border ${
              isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search achievements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm w-full outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            <div className={`flex items-center rounded-xl p-1 border ${
              isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              {['all', 'unlocked', 'locked'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`text-xs capitalize px-3 py-1.5 rounded-lg transition-colors ${
                    filterMode === mode
                      ? isDark
                        ? 'bg-gray-800 text-white font-medium'
                        : 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white font-medium'
                    : isDark
                    ? 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Achievement Grid */}
        <section aria-label="Achievements list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setInspectingItem(item)}
              className={`p-4 rounded-xl border text-left flex items-start space-x-3.5 transition-all ${
                item.unlocked
                  ? isDark
                    ? 'bg-gray-900/60 border-indigo-900/40 hover:border-indigo-600'
                    : 'bg-white border-indigo-100 hover:border-indigo-300 shadow-sm'
                  : isDark
                  ? 'bg-gray-950/40 border-gray-900 opacity-60 hover:opacity-100'
                  : 'bg-gray-100/60 border-gray-200 opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`text-2xl shrink-0 p-2.5 rounded-xl ${
                  item.unlocked
                    ? isDark
                      ? 'bg-indigo-950/60'
                      : 'bg-indigo-50'
                    : isDark
                    ? 'bg-gray-900'
                    : 'bg-gray-200'
                }`}
              >
                {item.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                  {item.unlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-1" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-1" />
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>

                {/* Zero-pill unboxed metadata */}
                <div className="mt-2.5 pt-2 border-t border-gray-800/40 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{item.rarity} · {item.points} pts</span>
                  {item.unlocked ? (
                    <span className="text-emerald-500">Unlocked</span>
                  ) : (
                    <span>{item.progress}% progress</span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-gray-500">
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
            className={`max-w-md w-full p-6 rounded-2xl border ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="text-4xl">{inspectingItem.icon}</div>
              <button
                onClick={() => setInspectingItem(null)}
                aria-label="Close dialog"
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                {inspectingItem.category} · {inspectingItem.rarity}
              </span>
              <h3 className="text-xl font-bold mt-1">{inspectingItem.title}</h3>
              <p className="text-sm text-gray-400 mt-2">{inspectingItem.description}</p>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-black/20 dark:bg-black/40 border border-gray-800/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Honor Points</span>
                <span className="font-semibold text-indigo-400">{inspectingItem.points} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Audit Status</span>
                <span className={inspectingItem.unlocked ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
                  {inspectingItem.unlocked ? 'Verified & Granted' : 'In Progress'}
                </span>
              </div>
              {inspectingItem.earnedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Granted Date</span>
                  <span>{new Date(inspectingItem.earnedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => {
                  toast.success('Achievement link copied to clipboard');
                  setInspectingItem(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Proof</span>
              </button>
              <button
                onClick={() => setInspectingItem(null)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'
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
