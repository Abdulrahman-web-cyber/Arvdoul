// src/components/profile/ProfileSystemRoadmapModal.jsx
//
// Authoritative interactive modal explaining:
// 1. Level progression & perks (What you achieve/gain at each level)
// 2. Digital Citizenship & Passport requirements (Resident -> Citizen -> Statesperson -> Senator -> Chancellor -> Founder)
// 3. Royal Family benefits & eligibility (Duke/Duchess, King/Queen advantages that others don't have)
//
// Strictly grounded in src/shared/levelConfig.cjs single source of truth.

import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Crown,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Vote,
  Radio,
  Zap,
  Coins,
  ChevronRight,
  Star,
  Flame,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  LEVEL_PERKS,
  CITIZEN_TIERS,
  ROYAL_ELIGIBILITY,
  getRankTitle,
  getCitizenTier,
  getRoyalEligibility,
  getLevelInfo,
  LEVEL_GATES,
} from '../../shared/levelConfig.cjs';

export const ProfileSystemRoadmapModal = memo(function ProfileSystemRoadmapModal({
  isOpen,
  onClose,
  profile = {},
  theme = 'dark',
  initialTab = 'levels', // 'levels' | 'citizenship' | 'royals'
  userId = null,
}) {
  const navigate = useNavigate();
  const isDark = theme === 'dark' || theme === 'midnight';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Synchronize initialTab if changed on open
  React.useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  const currentLevel = typeof profile?.level === 'number' ? profile.level : 1;
  const currentXp = profile?.experience || profile?.xp || 0;
  const levelInfo = useMemo(() => getLevelInfo(currentXp), [currentXp]);
  const activeDays = Number(profile?.activeDaysCount || profile?.activeDays || 0);
  const reputation = Number(profile?.reputationScore || profile?.reputation || 0);
  const contribution = Number(profile?.contributionScore || profile?.contribution || 0);
  const influence = Number(profile?.influenceScore || profile?.influence || 0);
  const achievements = Number(
    profile?.achievementsCount !== undefined
      ? profile?.achievementsCount
      : (Array.isArray(profile?.achievements) ? profile.achievements.length : 0)
  );

  const stats = useMemo(() => ({
    level: currentLevel,
    activeDays,
    reputation,
    contribution,
    influence,
    achievements,
    policyStanding: profile?.policyStanding || 'good',
  }), [currentLevel, activeDays, reputation, contribution, influence, achievements, profile]);

  const dukeEligibility = useMemo(() => getRoyalEligibility('duke', stats), [stats]);
  const kingEligibility = useMemo(() => getRoyalEligibility('king', stats), [stats]);

  const currentCitizenTier = useMemo(() => getCitizenTier(currentLevel, activeDays), [currentLevel, activeDays]);
  const currentRankTitle = useMemo(() => getRankTitle(currentLevel), [currentLevel]);

  // Is full citizen? (Level 5 + 7 active days)
  const isFullCitizen = currentLevel >= 5 && activeDays >= 7;

  if (!isOpen) return null;

  const targetUid = profile?.uid || profile?.id || userId || '';
  const passportUrl = targetUid ? `/passport/${targetUid}` : '/profile/passport';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            "relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden z-10",
            isDark
              ? "bg-[#0a0f24] border-white/10 text-white"
              : "bg-white border-slate-200 text-slate-900"
          )}
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 shrink-0 bg-gradient-to-r from-purple-950/30 via-indigo-950/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B1EF3] to-[#055BFB] flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
                {activeTab === 'royals' ? (
                  <Crown className="w-6 h-6 text-amber-300" />
                ) : activeTab === 'citizenship' ? (
                  <ShieldCheck className="w-6 h-6 text-cyan-300" />
                ) : (
                  <Zap className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 block font-mono">
                  Arvdoul Institutional Framework
                </span>
                <h2 className="text-lg sm:text-xl font-black tracking-tight leading-snug">
                  {activeTab === 'levels' && "Level Progression & Feature Unlocks"}
                  {activeTab === 'citizenship' && "Digital Citizenship & Passport Roadmap"}
                  {activeTab === 'royals' && "Royal Family Standing & Privileges"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Segmented Tab Navigation */}
          <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('levels')}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                activeTab === 'levels'
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                  : isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Levels & Unlocks</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('citizenship')}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                activeTab === 'citizenship'
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                  : isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Citizenship & Passport</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('royals')}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                activeTab === 'royals'
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30"
                  : isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Royal Family</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
            {/* TAB 1: LEVELS & UNLOCKS */}
            {activeTab === 'levels' && (
              <div className="space-y-6">
                {/* Current Standing Hero Banner */}
                <div className={cn(
                  "p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4",
                  isDark ? "bg-white/[0.03] border-white/10" : "bg-purple-50/50 border-purple-100"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-lg">
                      {currentLevel}
                    </div>
                    <div>
                      <div className="text-xs text-purple-400 font-bold uppercase tracking-wider font-mono">Current Standing</div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        Level {currentLevel} • {currentRankTitle}
                      </div>
                      <div className="text-xs text-slate-400">
                        {currentXp.toLocaleString()} XP earned across Arvdoul
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-48 text-right space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400">Next Level</span>
                      <span className="text-cyan-400">{levelInfo.nextLevelXp ? `${levelInfo.nextLevelXp.toLocaleString()} XP` : 'Max'}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full"
                        style={{ width: `${levelInfo.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Normative Level Perks List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-wide uppercase text-slate-400 font-mono">
                    Perks & Privileges by Level
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5">
                    {LEVEL_PERKS.map((perk) => {
                      const isUnlocked = currentLevel >= perk.minLevel;
                      return (
                        <div
                          key={perk.minLevel}
                          className={cn(
                            "p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3",
                            isUnlocked
                              ? (isDark ? "bg-white/[0.04] border-purple-500/30" : "bg-white border-purple-200 shadow-sm")
                              : (isDark ? "bg-white/[0.01] border-white/5 opacity-60" : "bg-slate-50 border-slate-200 opacity-60")
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl shrink-0 mt-0.5">{perk.icon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {perk.title}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                                  isUnlocked
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                )}>
                                  Level {perk.minLevel}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                {perk.description}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 mt-1">
                            {isUnlocked ? (
                              <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-400 font-bold text-xs">
                                <Lock className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Lvl {perk.minLevel}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CITIZENSHIP & DIGITAL PASSPORT */}
            {activeTab === 'citizenship' && (
              <div className="space-y-6">
                {/* Citizenship Path Banner */}
                <div className={cn(
                  "p-5 rounded-2xl border space-y-3",
                  isFullCitizen
                    ? (isDark ? "bg-cyan-950/20 border-cyan-500/30" : "bg-cyan-50 border-cyan-200")
                    : (isDark ? "bg-amber-950/20 border-amber-500/30" : "bg-amber-50 border-amber-200")
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 block">
                        Instituted Status
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                        {currentCitizenTier?.tier || 'Platform Resident'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {currentCitizenTier?.description}
                      </p>
                    </div>

                    <span className="text-3xl shrink-0">{currentCitizenTier?.icon || '🏛️'}</span>
                  </div>

                  {/* Requirements Progress Bar */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="text-xs font-bold text-slate-300">
                      Requirement for Full Democratic Citizenship & Official Passport Stamp:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={cn(
                        "p-2.5 rounded-xl border flex items-center justify-between",
                        currentLevel >= 5
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/5 border-white/10 text-slate-400"
                      )}>
                        <span>Level 5+ Reached</span>
                        {currentLevel >= 5 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
                      </div>

                      <div className={cn(
                        "p-2.5 rounded-xl border flex items-center justify-between",
                        activeDays >= 7
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/5 border-white/10 text-slate-400"
                      )}>
                        <span>7 Active Days ({activeDays}/7)</span>
                        {activeDays >= 7 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Digital Passport Card CTA */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between gap-4",
                  isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black">Digital Nation Passport</div>
                      <div className="text-xs text-slate-400">
                        {isFullCitizen
                          ? "Official Stamp Active • Full Democratic Jurisdiction"
                          : "Resident Dossier • Reach Level 5 with 7 active days to Stamp"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(passportUrl);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-md"
                  >
                    <span>View Passport</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* All 6 Citizenship Tiers */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-wide uppercase text-slate-400 font-mono">
                    The 6 Sovereign Citizenship Tiers
                  </h3>

                  <div className="space-y-2.5">
                    {CITIZEN_TIERS.map((tier) => {
                      const isReached = currentLevel >= tier.minLevel && activeDays >= tier.minDays;
                      return (
                        <div
                          key={tier.tier}
                          className={cn(
                            "p-3.5 rounded-2xl border flex items-start justify-between gap-3",
                            isReached
                              ? (isDark ? "bg-white/[0.04] border-cyan-500/30" : "bg-white border-cyan-200 shadow-sm")
                              : (isDark ? "bg-white/[0.01] border-white/5 opacity-60" : "bg-slate-50 border-slate-200 opacity-60")
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl mt-0.5">{tier.icon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {tier.tier}
                                </span>
                                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                                  Level {tier.minLevel} • {tier.minDays} Active Days
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {tier.description}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 mt-1">
                            {isReached ? (
                              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ROYAL FAMILY STANDING */}
            {activeTab === 'royals' && (
              <div className="space-y-6">
                {/* Royal Family Philosophy Banner */}
                <div className={cn(
                  "p-5 rounded-3xl border relative overflow-hidden",
                  isDark
                    ? "bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-slate-950 border-amber-500/40 text-amber-200"
                    : "bg-gradient-to-br from-amber-50 via-purple-50 to-white border-amber-300 text-amber-900"
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block font-mono">
                        Institutional Sovereignty
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        The Arvdoul Royal Family System
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-300 max-w-lg">
                        Royal titles are not bought—they are mathematically proven and unlocked through multi-dimensional mastery across civic longevity, reputation, ecosystem contribution, influence, and community trust.
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shrink-0">
                      👑
                    </div>
                  </div>
                </div>

                {/* 1. DUKE / DUCHESS TIER */}
                <div className={cn(
                  "p-5 rounded-2xl border space-y-4",
                  dukeEligibility.eligible
                    ? "bg-purple-950/30 border-purple-500/40"
                    : "bg-white/[0.02] border-white/10"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">👑</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white">
                          Duke / Duchess of Arvdoul
                        </h4>
                        <span className="text-[11px] font-mono text-purple-400 font-bold">
                          Level 70+ • Sovereign Noble Standing
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full border",
                      dukeEligibility.eligible
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-white/5 text-slate-400 border-white/10"
                    )}>
                      {dukeEligibility.eligible ? "Eligible / Active" : "In Progress"}
                    </span>
                  </div>

                  {/* Duke Benefits */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Exclusive Duke Privileges (Benefits Others Do Not Have):
                    </div>
                    <ul className="text-xs space-y-1.5 text-slate-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span><strong>👑 Royal Crown Profile Badge</strong> with ambient violet profile aura.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span><strong>⚡ 2x XP Multiplier</strong> permanently active on all community contributions & gifts.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span><strong>🏛️ Royal Council Vote</strong> on platform-wide constitutional motions.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span><strong>💎 VIP Spaces & Lounges Access</strong> with audience broadcast rights.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Duke Checklist */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 font-mono">Eligibility Checklist:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", currentLevel >= 70 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Level 70+ ({currentLevel}/70)
                        {currentLevel >= 70 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", activeDays >= 180 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        180 Active Days ({activeDays}/180)
                        {activeDays >= 180 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", reputation >= 85 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Reputation 85+ ({reputation}/85)
                        {reputation >= 85 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", contribution >= 80 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Contribution 80+ ({contribution}/80)
                        {contribution >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", influence >= 70 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Influence 70+ ({influence}/70)
                        {influence >= 70 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", achievements >= 10 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        10 Achievements ({achievements}/10)
                        {achievements >= 10 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. KING / QUEEN TIER */}
                <div className={cn(
                  "p-5 rounded-2xl border space-y-4",
                  kingEligibility.eligible
                    ? "bg-amber-950/30 border-amber-500/40"
                    : "bg-white/[0.02] border-white/10"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">👑</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white">
                          King / Queen of Arvdoul
                        </h4>
                        <span className="text-[11px] font-mono text-amber-400 font-bold">
                          Level 90+ • Supreme Sovereign Monarch
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full border",
                      kingEligibility.eligible
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-white/5 text-slate-400 border-white/10"
                    )}>
                      {kingEligibility.eligible ? "Eligible / Monarch" : "In Progress"}
                    </span>
                  </div>

                  {/* King Benefits */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Supreme Sovereign Privileges:
                    </div>
                    <ul className="text-xs space-y-1.5 text-slate-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>👑 Golden Monarch Crown & Radiant Halo Frame</strong> on avatar across all screens.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>⚡ 3x XP Multiplier & 20% Fee Rebate</strong> on all creator coin cashouts.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>📜 Constitutional Council Veto</strong> power on platform legislative proposals.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>🛰️ Global Broadcast Alert</strong> capability directly to all network followers.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span><strong>🏛️ Permanent Sovereign Immortalization</strong> in Arvdoul Founding Archives.</span>
                      </li>
                    </ul>
                  </div>

                  {/* King Checklist */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 font-mono">Eligibility Checklist:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", currentLevel >= 90 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Level 90+ ({currentLevel}/90)
                        {currentLevel >= 90 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", activeDays >= 365 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        365 Active Days ({activeDays}/365)
                        {activeDays >= 365 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", reputation >= 95 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Reputation 95+ ({reputation}/95)
                        {reputation >= 95 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", contribution >= 90 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Contribution 90+ ({contribution}/90)
                        {contribution >= 90 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", influence >= 90 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        Influence 90+ ({influence}/90)
                        {influence >= 90 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                      <span className={cn("p-1.5 rounded border flex items-center justify-between", achievements >= 25 ? "text-emerald-400 border-emerald-500/30" : "text-slate-400 border-white/5")}>
                        25 Achievements ({achievements}/25)
                        {achievements >= 25 ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

ProfileSystemRoadmapModal.displayName = 'ProfileSystemRoadmapModal';
export default ProfileSystemRoadmapModal;
