/**
 * src/components/profile/ProfileProgression.jsx - ARVDOUL Progression & Citizenship
 *
 * Renders the canonical 100-level progression roadmap, the server-authoritative
 * active-day streak ledger, digital-citizenship standing, and unlocked perks.
 *
 * Every value comes from the shared level configuration (`levelSystemService`).
 * Progression is a digital-nation standing surface: for a visitor it is only
 * rendered when the capability engine permits it (`canViewProgression`), never
 * because the data happens to be on the profile document.
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  getLevelInfo,
  getLifetimeRewards,
  LEVEL_PERKS,
  getCitizenTier,
} from '../../services/levelSystemService.js';
import {
  Award,
  Flame,
  Landmark,
  Coins,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileProgression = memo(({
  profile,
  isOwner = false,
  // Fail-closed: progression is a standing surface and is hidden unless the
  // caller has explicitly confirmed the viewer may see it.
  canViewProgression = false,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  const experience = Number.isFinite(Number(profile?.experience))
    ? Number(profile.experience)
    : null;
  const activeStreak = Number.isFinite(Number(profile?.activeStreak))
    ? Number(profile.activeStreak)
    : null;
  const activeDaysCount = Number.isFinite(Number(profile?.activeDaysCount))
    ? Number(profile.activeDaysCount)
    : activeStreak;

  const levelInfo = useMemo(
    () => (experience === null ? null : getLevelInfo(experience)),
    [experience],
  );

  // Citizenship standing requires BOTH a known level and a known active-day
  // count; unknown days means the standing is unavailable, not "0 days".
  const citizenTier = useMemo(() => {
    if (!levelInfo || activeDaysCount === null) return null;
    return getCitizenTier(levelInfo.level, activeDaysCount);
  }, [levelInfo, activeDaysCount]);

  const lifetimeCoins = useMemo(
    () => (levelInfo ? getLifetimeRewards(levelInfo.level) : null),
    [levelInfo],
  );

  // Visitor view of a private progression surface: honesty over invention.
  if (!isOwner && !canViewProgression) {
    return (
      <div className={cn(
        'rounded-2xl p-6 border shadow-sm flex items-center gap-3',
        isDark ? 'bg-arvdoul-bg-elevated/70 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600',
      )}>
        <Lock className="w-5 h-5 flex-shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-semibold">Progression is private</p>
          <p className="text-xs text-slate-400">This citizen has chosen not to share their Arvdoul standing.</p>
        </div>
      </div>
    );
  }

  const nextStreakMilestone = activeStreak === null ? null : Math.ceil((activeStreak + 1) / 7) * 7;
  const daysToStreakMilestone = activeStreak === null ? null : Math.max(1, nextStreakMilestone - activeStreak);

  return (
    <div className="space-y-6 py-4">
      {/* Primary 100-Level Status Card */}
      <div className={cn(
        'relative overflow-hidden rounded-2xl p-6 border shadow-sm transition-all',
        isDark
          ? 'bg-gradient-to-br from-arvdoul-bg-elevated via-arvdoul-bg-deep to-arvdoul-bg-elevated border-white/10'
          : 'bg-gradient-to-br from-white via-arvdoul-bg-light to-white border-slate-200',
      )}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-arvdoul-purple/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-arvdoul-gradient flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-arvdoul-purple/20">
                {levelInfo ? levelInfo.level : '—'}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-400 text-black shadow">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-arvdoul-purple">
                  {levelInfo ? `Level ${levelInfo.level} of 100` : 'Level unavailable'}
                </span>
                {levelInfo?.isMaxLevel && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-black">
                    MAX LEVEL
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {levelInfo ? levelInfo.title : 'Standing unavailable'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {experience === null ? 'XP unavailable' : `${experience.toLocaleString()} Total XP earned`}
              </p>
            </div>
          </div>

          {lifetimeCoins !== null && (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-arvdoul-purple/10 border border-arvdoul-purple/20 text-center">
                <div className="text-[10px] uppercase font-bold text-arvdoul-purple">
                  Lifetime Rewards
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  +{lifetimeCoins.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {levelInfo && (
          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className="text-slate-600 dark:text-slate-300">
                {levelInfo.isMaxLevel ? 'Transcendent Level Reached' : `Progress to Level ${levelInfo.level + 1}`}
              </span>
              <span className="text-arvdoul-purple">
                {levelInfo.isMaxLevel ? '100%' : `${levelInfo.progress.toFixed(1)}%`}
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelInfo.progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-arvdoul-gradient shadow-sm"
              />
            </div>

            {!levelInfo.isMaxLevel && (
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
                <span>{levelInfo.xpIntoLevel.toLocaleString()} XP into level</span>
                <span>{levelInfo.xpToNext.toLocaleString()} XP needed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column Grid: Streak Ledger & Digital Citizenship */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(
          'rounded-2xl p-5 border shadow-sm flex flex-col justify-between',
          isDark ? 'bg-arvdoul-bg-elevated/80 border-white/10' : 'bg-white border-slate-200',
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-500">
                <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
                Active Streak Ledger
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                Active Days
              </span>
            </div>

            {activeStreak === null ? (
              <p className="text-sm text-slate-400 py-2">Streak data unavailable</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{activeStreak}</span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Consecutive Days</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Total lifetime active days:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{activeDaysCount} days</strong>
                </p>
              </>
            )}
          </div>

          {daysToStreakMilestone !== null && (
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span className="text-slate-700 dark:text-slate-300">Next Streak Reward</span>
              </div>
              <span className="font-bold text-orange-500">
                {daysToStreakMilestone} day{daysToStreakMilestone !== 1 ? 's' : ''} left ({nextStreakMilestone}d)
              </span>
            </div>
          )}
        </div>

        <div className={cn(
          'rounded-2xl p-5 border shadow-sm flex flex-col justify-between',
          isDark ? 'bg-arvdoul-bg-elevated/80 border-white/10' : 'bg-white border-slate-200',
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500">
                <Landmark className="w-4 h-4 text-emerald-500" />
                Digital Citizenship
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {citizenTier ? citizenTier.tier : '—'}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {citizenTier ? `${citizenTier.icon} ${citizenTier.tier}` : 'Standing unavailable'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {citizenTier ? citizenTier.description : 'Citizenship standing requires level and active-day data.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Governance voting rights activate at the Citizen tier (Level 5)</span>
          </div>
        </div>
      </div>

      {/* Perks Roadmap */}
      <div className={cn(
        'rounded-2xl p-6 border shadow-sm',
        isDark ? 'bg-arvdoul-bg-elevated/80 border-white/10' : 'bg-white border-slate-200',
      )}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-arvdoul-purple" />
              100-Level Platform Perks Roadmap
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Features, tools, and civic privileges unlocked as the level advances
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {LEVEL_PERKS.map((perk) => {
            const isUnlocked = Boolean(levelInfo) && levelInfo.level >= perk.minLevel;
            return (
              <div
                key={perk.title}
                className={cn(
                  'flex items-center justify-between p-3.5 rounded-xl border transition-all',
                  isUnlocked
                    ? (isDark
                        ? 'bg-arvdoul-purple/10 border-arvdoul-purple/20 text-slate-200'
                        : 'bg-arvdoul-purple/5 border-arvdoul-purple/20 text-slate-800')
                    : (isDark
                        ? 'bg-white/5 border-white/10 text-slate-500 opacity-70'
                        : 'bg-slate-50 border-slate-200 text-slate-400 opacity-80'),
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" role="img" aria-label={perk.title}>{perk.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{perk.title}</span>
                      <span className={cn(
                        'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
                        isUnlocked
                          ? 'bg-arvdoul-purple/15 text-arvdoul-purple'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400',
                      )}>
                        Level {perk.minLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{perk.description}</p>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-3">
                  {isUnlocked ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
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
