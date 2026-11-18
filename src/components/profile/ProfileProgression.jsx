/**
 * Production-grade Citizen Progression & Civic Standing strip component.
 * Displays server-authoritative rank title, XP progress, daily streak,
 * reputation, and upcoming milestone reward cleanly on a single hairline bar.
 *
 * Never fabricates progression (renders unavailable when level is absent).
 *
 * @component
 */

import { memo, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Crown, Flame, ChevronRight, Award, Sparkles } from "lucide-react";
import { cn } from '../../lib/utils';
import { tokens } from '../../design-system/tokens.js';
import {
  getLevelInfo,
  getRankTitle,
  getLevelBandColor,
  getLevelUpReward,
} from '../../services/levelSystemService';

const ProfileProgression = memo(({
  level = null,
  experience = null,
  streak = 0,
  reputation = null,
  showLevel = true,
  showReputation = true,
  showStreak = true,
  isOwner = false,
  theme = 'light',
  className = '',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const explicitLevel = Number(level);
  const hasLevel = Number.isFinite(explicitLevel) && explicitLevel > 0;
  const effectiveLevel = hasLevel ? explicitLevel : null;

  const hasReputation = reputation !== null && reputation !== undefined && Number.isFinite(Number(reputation));
  const safeReputation = hasReputation ? Number(reputation) : null;

  const hasExperience = experience !== null && experience !== undefined && Number.isFinite(Number(experience));

  const xpInfo = useMemo(() => {
    if (!hasLevel || !hasExperience) return null;
    try {
      return getLevelInfo(Number(experience));
    } catch {
      return null;
    }
  }, [hasLevel, hasExperience, experience]);

  const rankTitle = useMemo(() => {
    if (!hasLevel) return null;
    try {
      return getRankTitle(effectiveLevel);
    } catch {
      return null;
    }
  }, [hasLevel, effectiveLevel]);

  const levelColor = useMemo(() => {
    if (!hasLevel) return tokens.color.brand.violet;
    try {
      return getLevelBandColor(effectiveLevel);
    } catch {
      return tokens.color.brand.violet;
    }
  }, [hasLevel, effectiveLevel]);

  const nextReward = useMemo(() => {
    if (!hasLevel) return 0;
    try {
      return getLevelUpReward(effectiveLevel, effectiveLevel + 1);
    } catch {
      return 0;
    }
  }, [hasLevel, effectiveLevel]);

  if (!hasLevel) {
    if (!isOwner) return null;

    return (
      <div className={cn(
        "w-full rounded-2xl px-4 sm:px-5 py-3.5 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        isDark
          ? "bg-[#080F2E]/85 border-white/[0.08] text-white"
          : "bg-white border-slate-200/90 text-slate-900 shadow-sm",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Civic Standing Initializing
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete your profile and post your first vibe to activate citizenship progression.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/passport')}
          className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors cursor-pointer self-start sm:self-center"
        >
          <span>View Passport</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const progress = xpInfo?.progress ?? 0;
  const xpIntoLevel = xpInfo?.xpIntoLevel ?? 0;
  const xpToNext = xpInfo?.xpToNext ?? 0;
  const isMaxLevel = xpInfo?.isMaxLevel ?? false;

  return (
    <div className={cn(
      "w-full rounded-2xl px-4 sm:px-5 py-3.5 border transition-colors",
      isDark
        ? "bg-[#080F2E]/85 border-white/[0.08] text-white"
        : "bg-white border-slate-200/90 text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.03)]",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border"
            style={{
              background: `${levelColor}18`,
              borderColor: `${levelColor}38`,
              color: isDark ? '#fff' : levelColor,
            }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-75 leading-none">LVL</span>
            <span className="font-display text-sm font-bold leading-tight tabular-nums">{effectiveLevel}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-sm sm:text-base font-bold tracking-tight truncate">
                {rankTitle || `Citizen Tier ${effectiveLevel}`}
              </h3>
              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
              {showLevel && <span className="tabular-nums">Civic Tier {effectiveLevel}</span>}
              {showReputation && safeReputation !== null && (
                <>
                  {showLevel && <span aria-hidden="true">·</span>}
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    <Award className="w-3.5 h-3.5" />
                    <span>{safeReputation} Reputation</span>
                  </span>
                </>
              )}
              {showStreak && streak > 0 && (
                <>
                  {(showLevel || (showReputation && safeReputation !== null)) && <span aria-hidden="true">·</span>}
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{streak} Day Streak</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/passport')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-arvdoul-purple dark:text-purple-300 hover:underline cursor-pointer self-start sm:self-center shrink-0 whitespace-nowrap"
        >
          <span>Digital Passport & Perks</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {xpInfo && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">
              {isMaxLevel ? 'Maximum Level Reached' : `${xpIntoLevel.toLocaleString()} XP earned`}
            </span>
            <span className="text-slate-700 dark:text-slate-300">
              {isMaxLevel ? 'Apex Citizen' : `${xpToNext.toLocaleString()} XP to Level ${effectiveLevel + 1}`}
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-200/90 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(4, progress))}%`,
                background: 'linear-gradient(90deg, var(--arv-brand-indigo) 0%, var(--arv-brand-violet) 55%, var(--arv-brand-pink) 100%)',
              }}
            />
          </div>

          {nextReward > 0 && !isMaxLevel && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Next Level Reward: +{nextReward} Coins grant</span>
              </span>
              <span className="font-semibold text-arvdoul-purple dark:text-purple-300">{Math.round(progress)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ProfileProgression.displayName = 'ProfileProgression';

export default ProfileProgression;
