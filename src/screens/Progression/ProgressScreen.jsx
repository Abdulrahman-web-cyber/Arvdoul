// src/screens/Progression/ProgressScreen.jsx — ARVDOUL CITIZEN PROGRESSION ENGINE (Part 2)
// Answers: Where am I? Why am I here? What did I accomplish? What can I unlock? What comes next?

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  levelSystemService,
  getLevelInfo,
  getCitizenTier,
  getPerksForLevel,
  LEVEL_PERKS,
  LEVEL_GATES,
  getPrestigeInfo,
  XP_RULES,
} from '../../services/levelSystemService';
import {
  ArrowLeft,
  Flame,
  Award,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
  Coins,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProgressScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [levelInfo, setLevelInfo] = useState(null);
  const [activeStreak, setActiveStreak] = useState(1);
  const [activeDaysCount, setActiveDaysCount] = useState(1);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  const isDark = theme === 'dark' || theme === 'midnight';

  const loadProgression = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const info = await levelSystemService.getLevelInfo(user.uid);
      setLevelInfo(info);
      setActiveStreak(Number(user.activeStreak) || 1);
      setActiveDaysCount(Number(user.activeDaysCount) || 1);
    } catch (err) {
      toast.error('Failed to load live progression data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  const handleRefresh = async () => {
    setRefreshing(true);
    levelSystemService.invalidate(user?.uid);
    await loadProgression();
  };

  const level = levelInfo?.level || user?.level || 1;
  const citizenTier = useMemo(() => getCitizenTier(level, activeDaysCount), [level, activeDaysCount]);
  const prestige = useMemo(() => getPrestigeInfo(level), [level]);

  // Perks unlocked vs upcoming
  const unlockedPerks = useMemo(() => getPerksForLevel(level), [level]);
  const upcomingPerks = useMemo(
    () => LEVEL_PERKS.filter((p) => p.minLevel > level).slice(0, 4),
    [level]
  );

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
            <h1 className="text-lg font-bold tracking-tight">Citizen Progression</h1>
            <p className="text-xs text-gray-500">
              {citizenTier.tier} · Level {level} {prestige.isPrestige ? `· Prestige ${prestige.prestigeRoman}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh progression"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/passport')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Passport
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Where am I? & Why am I here? (Primary Progress Card) */}
        <section
          aria-labelledby="progress-overview-heading"
          className={`p-6 rounded-2xl border transition-all ${
            isDark
              ? 'bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800 shadow-xl'
              : 'bg-gradient-to-b from-white to-gray-50 border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-indigo-500">
                Current Standing
              </span>
              <h2 id="progress-overview-heading" className="text-3xl font-extrabold tracking-tight mt-1">
                Level {level}
                <span className="text-lg font-medium text-gray-500 ml-2">
                  {levelInfo?.title || citizenTier.tier}
                </span>
              </h2>
            </div>
            <div className="text-right">
              <span className="text-2xl">{citizenTier.icon}</span>
              <p className="text-xs text-gray-500 mt-1">{citizenTier.tier} Tier</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{levelInfo?.xpIntoLevel || 0} XP earned this level</span>
              <span>
                {levelInfo?.isMaxLevel ? 'Ascendant' : `${levelInfo?.xpToNext || 0} XP to Level ${level + 1}`}
              </span>
            </div>
            <div
              className={`h-3 w-full rounded-full overflow-hidden ${
                isDark ? 'bg-gray-800' : 'bg-gray-200'
              }`}
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 rounded-full"
                style={{ width: `${levelInfo?.progress || 0}%` }}
                role="progressbar"
                aria-valuenow={levelInfo?.progress || 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
              <span>Stage Progress: {levelInfo?.progress || 0}%</span>
              <span>Total XP: {(user?.experience || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Stats Triad: Active Days, Streak, Rewards */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-800/60 dark:border-gray-800">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-amber-500">
                <Flame className="w-4 h-4" />
                <span className="text-lg font-bold">{activeStreak}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Day Streak</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-lg font-bold">{activeDaysCount}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Active Days</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-purple-400">
                <Coins className="w-4 h-4" />
                <span className="text-lg font-bold">{user?.coins || 0}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Coins Balance</p>
            </div>
          </div>
        </section>

        {/* Section 2: What did I accomplish? (Next Rank & Milestone) */}
        <section aria-labelledby="milestones-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="milestones-heading" className="text-sm font-semibold tracking-wide uppercase text-gray-500">
              Stage Milestones & Unlocks
            </h3>
            <button
              onClick={() => navigate('/achievements')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center"
            >
              All Achievements <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingPerks.map((perk) => (
              <div
                key={perk.minLevel}
                className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
                  isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold truncate">{perk.title}</h4>
                    <span className="text-xs font-mono text-amber-500">Lvl {perk.minLevel}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{perk.description}</p>
                </div>
              </div>
            ))}

            {upcomingPerks.length === 0 && (
              <div className="col-span-2 p-6 text-center text-sm text-gray-500">
                You have reached Ascendant standing and unlocked all standard tier capabilities!
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Unlocked Capabilities */}
        <section aria-labelledby="unlocked-heading" className="space-y-3">
          <h3 id="unlocked-heading" className="text-sm font-semibold tracking-wide uppercase text-gray-500">
            Unlocked Platform Capabilities ({unlockedPerks.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedPerks.map((perk) => (
              <div
                key={perk.minLevel}
                className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
                  isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-200'
                }`}
              >
                <div className="text-xl shrink-0 p-1">{perk.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">{perk.title}</h4>
                    <span className="text-xs text-emerald-500 font-medium">Unlocked</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Legitimate XP Sources & Anti-Farming Transparency */}
        <section aria-labelledby="xp-rules-heading" className="space-y-3">
          <h3 id="xp-rules-heading" className="text-sm font-semibold tracking-wide uppercase text-gray-500">
            Eligible Progression Activities
          </h3>

          <div
            className={`p-5 rounded-xl border divide-y ${
              isDark ? 'bg-gray-900/50 border-gray-800 divide-gray-800' : 'bg-white border-gray-200 divide-gray-100'
            }`}
          >
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Daily Verified Presence</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.daily_login.xp} XP / day</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Original Post Publication</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.post_created.xp} XP (Cap: {XP_RULES.post_created.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Constructive Conversation Comment</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.comment_created.xp} XP (Cap: {XP_RULES.comment_created.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Genuine Community Connection</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.follow_received.xp} XP</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Creator Patronage & Gift Support</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.gift_received.xp} XP</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
