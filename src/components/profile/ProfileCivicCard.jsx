/**
 * Production-grade Civic Prestige Card.
 * Displays server-authoritative level, rank tier, XP progression curve,
 * daily streak, unlocked perks, and digital passport status.
 * 
 * Styled as a holographic obsidian civic passport badge with ambient lighting.
 * Strictly adheres to AGENTS.md rules:
 * - Single source of truth: levelSystemService / shared/levelConfig.cjs
 * - Zero fabricated standing: absent level renders as unavailable/initializing,
 *   never defaulting to "Level 1" or "Citizen".
 * - Zero-pill discipline: typographic hierarchy and micro-accents.
 * 
 * @component
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, 
  Flame, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight, 
  Award,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  getLevelInfo, 
  getRankTitle, 
  getLevelBandColor,
  getLevelUpReward,
  getPerksForLevel,
  getRoyalEligibility
} from '../../services/levelSystemService';

const ProfileCivicCard = memo(({
  level = null,
  experience = 0,
  streak = 0,
  reputation = 0,
  profile = null,
  isOwner = false,
  theme = 'light',
  className = '',
  compact = false,
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

  const unlockedPerks = useMemo(() => {
    if (!hasLevel) return [];
    try {
      return getPerksForLevel(effectiveLevel) || [];
    } catch {
      return [];
    }
  }, [hasLevel, effectiveLevel]);

  const royalStatus = useMemo(() => {
    if (!hasLevel || !profile) return null;
    try {
      return getRoyalEligibility(profile);
    } catch {
      return null;
    }
  }, [hasLevel, profile]);

  // Strict invariant: absent level must NOT fabricate Citizen or Level 1
  if (!hasLevel) {
    if (!isOwner) return null;

    return (
      <div className={cn(
        "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm relative overflow-hidden",
        isDark
          ? "bg-[#0B0F19] border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-900",
        className
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                Civic Standing Initializing
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Post creations and participate in governance to unlock citizen standing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/passport')}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            Passport
          </button>
        </div>
      </div>
    );
  }

  const progress = xpInfo?.progress ?? 0;
  const xpIntoLevel = xpInfo?.xpIntoLevel ?? 0;
  const xpToNext = xpInfo?.xpToNext ?? 0;
  const isMaxLevel = xpInfo?.isMaxLevel ?? false;

  return (
    <div className={cn(
      "w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm relative overflow-hidden group",
      isDark
        ? "bg-gradient-to-br from-[#0B0F19] via-[#0E1326] to-[#0B0F19] border-slate-800/90 text-white shadow-purple-950/20"
        : "bg-gradient-to-br from-white via-slate-50 to-white border-slate-200 text-slate-900 shadow-slate-100",
      className
    )}>
      {/* Holographic atmospheric glow */}
      <div 
        className="absolute -right-10 -top-10 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-35"
        style={{ backgroundColor: levelColor }}
      />
      <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full blur-3xl opacity-15 bg-indigo-600 pointer-events-none" />

      {/* Header: Level Crest & Rank Tier */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shadow-lg shrink-0 relative border border-white/25 transition-transform duration-300 group-hover:scale-105"
            style={{ 
              background: `linear-gradient(135deg, ${levelColor}40 0%, ${levelColor}80 100%)`,
              color: '#fff'
            }}
          >
            <span className="text-[9px] font-bold tracking-wider uppercase opacity-90 leading-none">LVL</span>
            <span className="text-lg font-black leading-none drop-shadow">{effectiveLevel}</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold tracking-tight">
                {rankTitle || `Civic Tier ${effectiveLevel}`}
              </h3>
              {royalStatus?.eligible ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400" title="Royal Citizen Standing">
                  <Crown className="w-3.5 h-3.5 fill-amber-400" />
                </span>
              ) : (
                <Award className="w-3.5 h-3.5 text-purple-400" />
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>Civic Tier {effectiveLevel}</span>
              {streak > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{streak}d</span>
                  </span>
                </>
              )}
              {reputation > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-500 font-semibold">{reputation} Rep</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Digital Passport Navigation CTA */}
        <button
          type="button"
          onClick={() => navigate('/passport')}
          className="shrink-0 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors flex items-center gap-1 cursor-pointer"
          title="Open Citizen Passport Dossier"
        >
          <span>Dossier</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* XP Progression Meter */}
      <div className="mt-4 space-y-1.5 relative z-10">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-slate-500 dark:text-slate-400">
            {isMaxLevel ? 'Apex Citizen Standing' : `${xpIntoLevel.toLocaleString()} XP`}
          </span>
          <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
            {isMaxLevel ? '100%' : `${xpToNext.toLocaleString()} XP to Lvl ${effectiveLevel + 1}`}
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800/80 overflow-hidden relative p-0.5">
          <div
            className="h-full rounded-full transition-all duration-700 relative"
            style={{
              width: `${Math.min(100, Math.max(4, progress))}%`,
              background: `linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)`
            }}
          >
            <div className="absolute inset-0 bg-white/25 animate-pulse rounded-full" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            <span>Next: +{nextReward > 0 ? `${nextReward} Coins reward` : 'Prestige Honor'}</span>
          </span>
          <span className="font-semibold text-indigo-500">{Math.round(progress)}% Complete</span>
        </div>
      </div>

      {/* Unlocked Perks Preview */}
      {!compact && unlockedPerks.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-white/5 space-y-1.5 relative z-10">
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
            Active Citizen Perks
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {unlockedPerks.slice(0, 2).map((perk, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 leading-tight truncate",
                  isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                )}
                title={perk.description}
              >
                <span className="text-xs shrink-0">{perk.icon}</span>
                <span className="truncate font-medium">{perk.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

ProfileCivicCard.displayName = 'ProfileCivicCard';

export default ProfileCivicCard;
