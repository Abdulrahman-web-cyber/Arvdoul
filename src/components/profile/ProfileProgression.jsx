/**
 * Production-grade Citizen Progression & Civic Standing showcase component.
 * Displays server-authoritative level, rank title, XP curve, daily streak,
 * and upcoming milestone rewards.
 * 
 * Never fabricates progression (renders unavailable when level is absent).
 * 
 * @component
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Flame, ChevronRight, Award, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  getLevelInfo, 
  getRankTitle, 
  getLevelBandColor,
  getLevelUpReward 
} from '../../services/levelSystemService';

const ProfileProgression = memo(({
  level = null,
  experience = 0,
  streak = 0,
  isOwner = false,
  theme = 'light',
  className = '',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const explicitLevel = Number(level);
  const hasLevel = Number.isFinite(explicitLevel) && explicitLevel > 0;
  const effectiveLevel = hasLevel ? explicitLevel : null;

  const xpInfo = useMemo(() => {
    if (!hasLevel) return null;
    try {
      return getLevelInfo(experience || 0);
    } catch {
      return null;
    }
  }, [hasLevel, experience]);

  const rankTitle = useMemo(() => {
    if (!hasLevel) return null;
    try {
      return getRankTitle(effectiveLevel);
    } catch {
      return null;
    }
  }, [hasLevel, effectiveLevel]);

  const levelColor = useMemo(() => {
    if (!hasLevel) return '#8B5CF6';
    try {
      return getLevelBandColor(effectiveLevel);
    } catch {
      return '#8B5CF6';
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

  // If standing is absent, never fabricate Level 1 (AUDIT N005 / noFabricatedData)
  if (!hasLevel) {
    if (!isOwner) return null;

    return (
      <div className={cn(
        "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm flex items-center justify-between gap-4",
        isDark
          ? "bg-[#0B0F19] border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-900",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
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
          className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
        >
          View Passport
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
      "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm relative overflow-hidden",
      isDark
        ? "bg-[#0B0F19] border-slate-800 text-white"
        : "bg-white border-slate-200 text-slate-900",
      className
    )}>
      {/* Ambient background aura */}
      <div 
        className="absolute -right-16 -top-16 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ backgroundColor: levelColor }}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Level Emblem & Rank Title */}
        <div className="flex items-center gap-3.5">
          <div 
            className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shadow-inner shrink-0 relative border border-white/20"
            style={{ 
              background: `linear-gradient(135deg, ${levelColor}22 0%, ${levelColor}44 100%)`,
              color: isDark ? '#fff' : levelColor
            }}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80 leading-none">LVL</span>
            <span className="text-lg font-black leading-none">{effectiveLevel}</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
                {rankTitle || `Citizen Tier ${effectiveLevel}`}
              </h3>
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Civic Tier {effectiveLevel}</span>
              {streak > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{streak} Day Streak</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Passport Action Link */}
        <button
          type="button"
          onClick={() => navigate('/passport')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer self-end sm:self-center"
        >
          <span>Digital Passport & Perks</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center: XP Progress Bar */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-500 dark:text-slate-400">
            {isMaxLevel ? 'Maximum Level Reached' : `${xpIntoLevel.toLocaleString()} XP earned`}
          </span>
          <span className="text-slate-700 dark:text-slate-300 font-mono">
            {isMaxLevel ? 'Apex Citizen' : `${xpToNext.toLocaleString()} XP to Level ${effectiveLevel + 1}`}
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700 relative"
            style={{
              width: `${Math.min(100, Math.max(4, progress))}%`,
              background: `linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)`
            }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </div>
        </div>

        {/* Milestone perks preview */}
        {nextReward > 0 && !isMaxLevel && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Next Level Reward: +{nextReward} Coins grant</span>
            </span>
            <span className="text-indigo-500 font-medium">{Math.round(progress)}% Complete</span>
          </div>
        )}
      </div>
    </div>
  );
});

ProfileProgression.displayName = 'ProfileProgression';

export default ProfileProgression;
