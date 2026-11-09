// src/screens/Progression/ProgressScreen.jsx
//
// Answers: Where am I? Why am I here? What did I accomplish? What can I unlock? What comes next?

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { levelSystemService, getCitizenTier, getPerksForLevel, LEVEL_PERKS, getPrestigeInfo, XP_RULES } from "../../services/levelSystemService";
import { Flame, ChevronRight, Lock, Coins, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from 'sonner';

export default function ProgressScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();

  const profile = userProfile || user;
  const currentUid = profile?.uid || user?.uid;

  const [refreshing, setRefreshing] = useState(false);
  const [levelInfo, setLevelInfo] = useState(null);
  // Unknown streak/active-days render as unavailable, never as a fabricated
  // "1 day" (a new account that has never been active is not on a 1-day streak).
  const [activeStreak, setActiveStreak] = useState(null);
  const [activeDaysCount, setActiveDaysCount] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';

  const loadProgression = useCallback(async () => {
    if (!currentUid) return;
    try {
      const info = await levelSystemService.getLevelInfo(currentUid);
      setLevelInfo(info);
      const streak = Number(profile?.activeStreak);
      setActiveStreak(Number.isFinite(streak) && streak > 0 ? streak : null);
      const days = Number(profile?.activeDaysCount);
      setActiveDaysCount(Number.isFinite(days) && days > 0 ? days : null);
    } catch {
      toast.error('Failed to load live progression data');
    } finally {
      setRefreshing(false);
    }
  }, [currentUid, profile]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  const handleRefresh = async () => {
    setRefreshing(true);
    levelSystemService.invalidate(user?.uid);
    await loadProgression();
  };

  // A missing stored level renders as unavailable, never as a plausible-but-false
  // "Level 1". `level` is still floored to 1 for gate math (perk/tier lookup),
  // but `hasLevel` decides what the standing badge claims.
  const hasLevel = (levelInfo?.level != null && Number.isFinite(Number(levelInfo.level)))
    || (user?.level != null && Number.isFinite(Number(user.level)));
  const level = levelInfo?.level ?? user?.level ?? 1;
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
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        {/* In-page utility bar (TopAppBar handles main app title and back navigation) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              {hasLevel ? `${citizenTier.tier} · Level ${level}` : 'Standing unavailable'}
              {hasLevel && prestige.isPrestige ? ` · Prestige ${prestige.prestigeRoman}` : ''}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh progression"
              className={`p-2 rounded-xl transition-colors ${
                isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/perks')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer shadow-sm"
            >
              Perks & Rewards
            </button>
            <button
              onClick={() => navigate('/passport')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              Digital Passport
            </button>
          </div>
        </div>
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
                {hasLevel ? `Level ${level}` : 'Level unavailable'}
                {hasLevel && (
                  <span className="text-lg font-medium text-gray-500 ml-2">
                    {levelInfo?.title || citizenTier.tier}
                  </span>
                )}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-2xl">{hasLevel ? citizenTier.icon : '—'}</span>
              <p className="text-xs text-gray-500 mt-1">{hasLevel ? `${citizenTier.tier} Tier` : 'Not yet rated'}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{levelInfo?.xpIntoLevel != null ? `${levelInfo.xpIntoLevel} XP earned this level` : 'XP unavailable'}</span>
              <span>
                {!hasLevel
                  ? 'Progress unavailable'
                  : levelInfo?.isMaxLevel
                    ? 'Ascendant'
                    : `${unknownNumber(levelInfo?.xpToNext) ?? '—'} XP to Level ${level + 1}`}
              </span>
            </div>
            <div
              className={`h-3 w-full rounded-full overflow-hidden ${
                isDark ? 'bg-gray-800' : 'bg-gray-200'
              }`}
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 rounded-full"
                style={{ width: `${unknownNumber(levelInfo?.progress) ?? 0}%` }}
                role="progressbar"
                aria-valuenow={unknownNumber(levelInfo?.progress) ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
              <span>Stage Progress: {unknownNumber(levelInfo?.progress) != null ? `${levelInfo.progress}%` : '—'}</span>
              <span>Total XP: {user?.experience != null ? Number(user.experience).toLocaleString() : '—'}</span>
            </div>
          </div>

          {/* Stats Triad: Active Days, Streak, Rewards */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-800/60 dark:border-gray-800">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-amber-500">
                <Flame className="w-4 h-4" />
                <span className="text-lg font-bold">{activeStreak ?? '—'}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Day Streak</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-lg font-bold">{activeDaysCount ?? '—'}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Active Days</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-purple-400">
                <Coins className="w-4 h-4" />
                <span className="text-lg font-bold">{user?.coins != null ? Number(user.coins).toLocaleString() : '—'}</span>
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
          <div className="flex items-center justify-between">
            <h3 id="unlocked-heading" className="text-sm font-semibold tracking-wide uppercase text-gray-500">
              Unlocked Platform Capabilities ({unlockedPerks.length})
            </h3>
            <button
              onClick={() => navigate('/perks')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>All Perks & Virtual Gifts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

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
          <div className="flex items-center justify-between">
            <h3 id="xp-rules-heading" className="text-sm font-semibold tracking-wide uppercase text-gray-500">
              Eligible Progression Activities
            </h3>
            <span className="text-[11px] font-bold text-purple-400">XP Resets Daily 00:00 UTC</span>
          </div>

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
              <span className="text-gray-400">Active Streak Milestone (7d, 14d, 30d)</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.streak_milestone.xp} XP</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Original Post Publication</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.post_created.xp} XP (Cap: {XP_RULES.post_created.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Story & Ephemeral Moments</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.story_created.xp} XP (Cap: {XP_RULES.story_created.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Audio Studio Production</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.audio_track_created.xp} XP (Cap: {XP_RULES.audio_track_created.dailyCap}/day)</span>
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
              <span className="text-gray-400">Sending Virtual Gifts to Creators</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.gift_sent.xp} XP (Cap: {XP_RULES.gift_sent.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Receiving Creator Patronage & Gifts</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.gift_received.xp} XP (Cap: {XP_RULES.gift_received.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Sharing Great Content Across the Network</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.post_shared.xp} XP (Cap: {XP_RULES.post_shared.dailyCap}/day)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Civic Poll & Governance Voting</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.civic_vote_cast.xp} XP</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">Watching Sponsored Video Ads</span>
              <span className="font-semibold text-emerald-400">+{XP_RULES.ad_reward_claimed.xp} XP (Cap: {XP_RULES.ad_reward_claimed.dailyCap}/day)</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
