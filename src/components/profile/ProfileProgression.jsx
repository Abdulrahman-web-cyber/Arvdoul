/**
 * src/components/profile/ProfileProgression.jsx - ARVDOUL Progression & Citizenship Component
 * 
 * Renders the full 100-level progression roadmap, server-authoritative active day streak ledger,
 * digital citizenship governance standing, and unlocked platform perks.
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  getLevelInfo,
  getLifetimeRewards,
  LEVEL_PERKS,
  getCitizenTier,
  LEVELS,
} from '../../services/levelSystemService.js';
import { 
  Award, 
  Flame, 
  Landmark, 
  Coins, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  Zap, 
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileProgression = memo(({
  profile,
  isOwner = false,
  theme = 'light',
}) => {
  const experience = profile?.experience || profile?.xp || 0;
  const activeStreak = profile?.activeStreak || 0;
  const activeDaysCount = profile?.activeDaysCount || (activeStreak > 0 ? activeStreak : 0);

  // Compute 100-level info
  const levelInfo = useMemo(() => {
    return getLevelInfo(experience);
  }, [experience]);

  // Compute citizen tier
  const citizenTier = useMemo(() => {
    return getCitizenTier(levelInfo.level, activeDaysCount);
  }, [levelInfo.level, activeDaysCount]);

  // Compute lifetime coin rewards
  const lifetimeCoins = useMemo(() => {
    return getLifetimeRewards(levelInfo.level);
  }, [levelInfo.level]);

  // Next streak milestone
  const nextStreakMilestone = Math.ceil((activeStreak + 1) / 7) * 7;
  const daysToStreakMilestone = Math.max(1, nextStreakMilestone - activeStreak);

  return (
    <div className="space-y-6 py-4">
      {/* Primary 100-Level Status Card */}
      <div className={cn(
        'relative overflow-hidden rounded-2xl p-6 border shadow-sm transition-all',
        theme === 'dark' 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-800' 
          : 'bg-gradient-to-br from-white via-purple-50/20 to-white border-purple-100/60'
      )}>
        {/* Glow ambient decoration */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-purple-500/20">
                {levelInfo.level}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-400 text-black shadow">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400">
                  Level {levelInfo.level} of 100
                </span>
                {levelInfo.isMaxLevel && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-black">
                    MAX LEVEL
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {levelInfo.title}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {experience.toLocaleString()} Total XP earned
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-center">
              <div className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-300">
                Lifetime Rewards
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                +{lifetimeCoins.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-semibold mb-2">
            <span className="text-gray-600 dark:text-gray-300">
              {levelInfo.isMaxLevel ? (
                'Transcendent Level Reached'
              ) : (
                `Progress to Level ${levelInfo.level + 1}`
              )}
            </span>
            <span className="text-purple-600 dark:text-purple-400">
              {levelInfo.isMaxLevel ? '100%' : `${levelInfo.progress.toFixed(1)}%`}
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 shadow-sm"
            />
          </div>

          {!levelInfo.isMaxLevel && (
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-2">
              <span>{levelInfo.xpIntoLevel.toLocaleString()} XP into level</span>
              <span>{levelInfo.xpToNext.toLocaleString()} XP needed</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid: Streak Ledger & Digital Citizenship */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Day Streak Ledger */}
        <div className={cn(
          'rounded-2xl p-5 border shadow-sm flex flex-col justify-between',
          theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-100'
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
                Active Streak Ledger
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50">
                Verified On-Chain
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-black text-gray-900 dark:text-white">
                {activeStreak}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Consecutive Days
              </span>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Total lifetime active days: <strong className="text-gray-800 dark:text-gray-200">{activeDaysCount} days</strong>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-gray-700 dark:text-gray-300">Next Streak Reward</span>
            </div>
            <span className="font-bold text-orange-600 dark:text-orange-400">
              {daysToStreakMilestone} day{daysToStreakMilestone !== 1 ? 's' : ''} left ({nextStreakMilestone}d)
            </span>
          </div>
        </div>

        {/* Digital Citizenship Standing */}
        <div className={cn(
          'rounded-2xl p-5 border shadow-sm flex flex-col justify-between',
          theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-100'
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Digital Citizenship
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                {citizenTier.tier}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {citizenTier.icon} {citizenTier.tier}
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {citizenTier.description}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Constitutional governance voting rights active</span>
          </div>
        </div>
      </div>

      {/* 100-Level Roadmap Perks Section */}
      <div className={cn(
        'rounded-2xl p-6 border shadow-sm',
        theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-100'
      )}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              100-Level Platform Perks Roadmap
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Features, tools, and civic privileges unlocked as your level advances
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {LEVEL_PERKS.map((perk) => {
            const isUnlocked = levelInfo.level >= perk.minLevel;
            return (
              <div
                key={perk.title}
                className={cn(
                  'flex items-center justify-between p-3.5 rounded-xl border transition-all',
                  isUnlocked
                    ? (theme === 'dark' 
                        ? 'bg-purple-950/20 border-purple-900/40 text-gray-200' 
                        : 'bg-purple-50/50 border-purple-100 text-gray-800')
                    : (theme === 'dark' 
                        ? 'bg-gray-800/30 border-gray-800/60 text-gray-500 opacity-60' 
                        : 'bg-gray-50/60 border-gray-200/60 text-gray-400 opacity-70')
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" role="img" aria-label={perk.title}>
                    {perk.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {perk.title}
                      </span>
                      <span className={cn(
                        'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
                        isUnlocked
                          ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      )}>
                        Level {perk.minLevel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {perk.description}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-3">
                  {isUnlocked ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
                      <Lock className="w-4 h-4" />
                      <span className="hidden sm:inline">Locked</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ProfileProgression.displayName = 'ProfileProgression';

export default ProfileProgression;
