// src/screens/Progression/PerksRewardsScreen.jsx
//
// View Perks, Level Milestone Coin Rewards, Virtual Gifts, and Prestige Benefits.
// Consumes canonical shared/levelConfig.cjs and adheres to Zero-Pill discipline.

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LEVEL_PERKS,
  LEVELS,
  GIFT_CATALOG,
  getRankTitle,
  getCitizenTier,
  getLevelInfo,
  getPrestigeInfo,
  formatCoinsAsUsd,
  XP_RULES,
} from '../../shared/levelConfig.cjs';
import {
  Sparkles,
  Gift,
  Coins,
  Crown,
  Lock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Send,
  Flame,
  Award,
  Zap,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export default function PerksRewardsScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'midnight';

  const profile = userProfile || user;
  const currentLevel = Number(profile?.level) || 1;
  const userCoins = Number(profile?.coins) || 0;
  const activeDays = Number(profile?.activeDaysCount || profile?.activeDays) || 1;
  const experience = Number(profile?.experience) || 0;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'perks' | 'coins' | 'gifts' | 'prestige'
  const [selectedGift, setSelectedGift] = useState(null);

  const citizenTier = useMemo(() => getCitizenTier(currentLevel, activeDays), [currentLevel, activeDays]);
  const prestige = useMemo(() => getPrestigeInfo(currentLevel), [currentLevel]);
  const levelInfo = useMemo(() => getLevelInfo(experience), [experience]);

  // Unlocked vs upcoming perks
  const unlockedPerks = useMemo(() => LEVEL_PERKS.filter(p => currentLevel >= p.minLevel), [currentLevel]);
  const upcomingPerks = useMemo(() => LEVEL_PERKS.filter(p => currentLevel < p.minLevel), [currentLevel]);

  // Upcoming coin reward milestones
  const upcomingCoinMilestones = useMemo(() => {
    return LEVELS.filter(l => l.level >= currentLevel && l.coinReward > 0).slice(0, 8);
  }, [currentLevel]);

  const handleSendGiftClick = (gift) => {
    setSelectedGift(gift);
    navigate(`/profile/me`);
    toast.info(`Select a friend or creator to send the ${gift.name} (${gift.coins} coins)!`);
  };

  return (
    <div className={cn(
      "min-h-screen pb-28 transition-colors duration-200 relative",
      isDark ? "bg-[#03071B] text-white" : "bg-[#f0f4fa] text-slate-900"
    )}>
      {/* Top Ambient Highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[2px] z-30"
        style={{
          background: "linear-gradient(90deg, #8B1EF3 0%, #4431F7 50%, #00F0FF 100%)",
        }}
      />

      {/* Sub-Header Toolbar */}
      <div className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-2xl transition-colors",
        isDark ? "bg-[#03071B]/90 border-white/[0.08]" : "bg-white/90 border-slate-200"
      )}>
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Perks & Rewards Suite</span>
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {userCoins} Coins ({formatCoinsAsUsd(userCoins)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/progress')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                isDark ? "border-white/10 hover:bg-white/[0.06] text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
              )}
            >
              Level Progression
            </button>
            <button
              onClick={() => navigate('/wallet')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 100%)"
              }}
            >
              Coins Treasury
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Rewards & Gifts' },
            { id: 'perks', label: `Level Perks (${unlockedPerks.length} Unlocked)` },
            { id: 'gifts', label: 'Virtual Gifts & Tips' },
            { id: 'coins', label: 'Level-Up Coin Grants' },
            { id: 'prestige', label: 'Prestige & Nobility' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                activeTab === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : isDark
                  ? "bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]"
                  : "bg-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">

        {/* Hero Card: Standing & Unlocked Capabilities Overview */}
        <section className={cn(
          "rounded-[28px] border p-6 sm:p-7 relative overflow-hidden backdrop-blur-2xl transition-all",
          isDark
            ? "bg-gradient-to-br from-[#0c142c] via-[#070D27] to-[#03071B] border-purple-500/20 shadow-[0_12px_40px_rgba(139,30,243,0.15)]"
            : "bg-gradient-to-br from-purple-50 via-white to-white border-purple-200 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{citizenTier.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">
                  {citizenTier.tier} Standing · Level {currentLevel}
                </span>
                {prestige.isPrestige && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Prestige {prestige.prestigeRoman}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {getRankTitle(currentLevel)} Rank Capabilities
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                Your sovereign citizen level unlocks platform creation powers, verified gift earnings, coin milestone bonuses, and civic governance rights.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className={cn(
                "p-3.5 rounded-2xl border text-center space-y-0.5 min-w-[110px]",
                isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="text-[10px] uppercase font-bold text-slate-400">Treasury</div>
                <div className="text-lg font-black text-amber-400 flex items-center justify-center gap-1">
                  <Coins className="w-4 h-4" />
                  <span>{userCoins}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">{formatCoinsAsUsd(userCoins)}</div>
              </div>

              <div className={cn(
                "p-3.5 rounded-2xl border text-center space-y-0.5 min-w-[110px]",
                isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="text-[10px] uppercase font-bold text-slate-400">Perks Earned</div>
                <div className="text-lg font-black text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{unlockedPerks.length}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">of {LEVEL_PERKS.length} Total</div>
              </div>
            </div>
          </div>

          {/* Progress Bar towards Next Unlock */}
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Stage Experience Progress</span>
              <span className="font-mono text-purple-400 font-bold">
                {levelInfo.isMaxLevel ? 'Ascendant' : `${levelInfo.xpToNext} XP to Level ${currentLevel + 1}`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08]">
              <div 
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${levelInfo.progress}%`,
                  background: "linear-gradient(90deg, #8B1EF3 0%, #4431F7 50%, #00F0FF 100%)"
                }}
              />
            </div>
          </div>
        </section>

        {/* 1. VIRTUAL GIFTS & TIP REWARDS SHOWCASE */}
        {(activeTab === 'all' || activeTab === 'gifts') && (
        <section className={cn(
          "rounded-[28px] border p-5 sm:p-7 space-y-5 transition-all",
          isDark ? "bg-[#070D27]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-rose-500" />
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Virtual Gifts & Creator Patronage
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Share virtual gifts with friends and creators across Arvdoul. Sending gifts awards <span className="text-purple-400 font-bold">+{XP_RULES.gift_received.xp} XP</span> to recipients and builds your civic contribution standing.
              </p>
            </div>

            <button
              onClick={() => navigate('/connections')}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                isDark ? "bg-white/[0.06] hover:bg-white/[0.1] text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Browse Friends</span>
            </button>
          </div>

          {/* Canonical 7 Virtual Gifts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {GIFT_CATALOG.map((g) => {
              const canAfford = userCoins >= g.coins;
              return (
                <div
                  key={g.id}
                  className={cn(
                    "p-3 rounded-2xl border text-center transition-all flex flex-col justify-between gap-2 relative group hover:scale-[1.02]",
                    isDark 
                      ? "bg-black/20 hover:bg-black/40 border-white/[0.06] hover:border-purple-500/40" 
                      : "bg-slate-50 hover:bg-white border-slate-200 hover:border-purple-300 shadow-xs"
                  )}
                >
                  <div className="text-3xl my-1 group-hover:scale-110 transition-transform">
                    {g.emoji}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs">{g.name}</h3>
                    <div className="flex items-center justify-center gap-1 font-mono text-[11px] font-black text-amber-400 mt-0.5">
                      <Coins className="w-3 h-3" />
                      <span>{g.coins}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatCoinsAsUsd(g.coins)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendGiftClick(g)}
                    className={cn(
                      "mt-1 py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer w-full flex items-center justify-center gap-1",
                      canAfford
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-xs"
                        : "bg-slate-300 dark:bg-white/10 text-slate-500 hover:opacity-80"
                    )}
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>Send</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* 2. LEVEL-UP COIN GRANTS & MILESTONES */}
        {(activeTab === 'all' || activeTab === 'coins') && (
        <section className={cn(
          "rounded-[28px] border p-5 sm:p-7 space-y-5 transition-all",
          isDark ? "bg-[#070D27]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Level-Up Coin Reward Ledger
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every level advanced in Arvdoul mints verified platform coins credited directly to your sovereign wallet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {upcomingCoinMilestones.map((milestone) => {
              const isPast = milestone.level < currentLevel;
              const isCurrent = milestone.level === currentLevel;
              return (
                <div
                  key={milestone.level}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2",
                    isCurrent
                      ? "bg-purple-600/15 border-purple-500/40 ring-1 ring-purple-500/30"
                      : isDark
                      ? "bg-black/20 border-white/[0.06]"
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div>
                    <div className="text-[11px] font-mono font-bold text-slate-400">
                      Level {milestone.level}
                    </div>
                    <div className="text-xs font-semibold">
                      {milestone.level % 10 === 0 ? 'Decade Milestone' : 'Level Reward'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-amber-400 flex items-center justify-end gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      <span>+{milestone.coinReward}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatCoinsAsUsd(milestone.coinReward)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* 3. PLATFORM UNLOCKED & UPCOMING PERKS */}
        {(activeTab === 'all' || activeTab === 'perks') && (
        <section className={cn(
          "rounded-[28px] border p-5 sm:p-7 space-y-5 transition-all",
          isDark ? "bg-[#070D27]/90 border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Platform Capabilities & Privilege Gates
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Functional gates that unlock real tools: live streaming, creator withdrawals, custom badges, and citizen voting.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {LEVEL_PERKS.map((perk) => {
              const isUnlocked = currentLevel >= perk.minLevel;
              return (
                <div
                  key={perk.minLevel}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex items-start gap-3.5",
                    isUnlocked
                      ? isDark
                        ? "bg-purple-950/20 border-purple-500/30 shadow-xs"
                        : "bg-purple-50/40 border-purple-200 shadow-xs"
                      : isDark
                      ? "bg-black/20 border-white/[0.06] opacity-60"
                      : "bg-slate-100 border-slate-200 opacity-60"
                  )}
                >
                  <div className="text-2xl p-1 shrink-0">
                    {perk.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-xs sm:text-sm truncate">
                        {perk.title}
                      </h3>
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                          <Lock className="w-2.5 h-2.5" />
                          Lvl {perk.minLevel}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {perk.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* 4. PRESTIGE & NOBILITY STANDING */}
        {(activeTab === 'all' || activeTab === 'prestige') && (
        <section className={cn(
          "rounded-[28px] border p-5 sm:p-7 space-y-5 transition-all relative overflow-hidden",
          isDark
            ? "bg-gradient-to-br from-[#12072B] to-[#070D27] border-purple-500/20"
            : "bg-gradient-to-br from-purple-50/70 to-white border-purple-200"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Prestige & Sovereign Nobility
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exceeding Level 100 unlocks Roman Numeral Prestige tiers (I through X), sovereign coronation eligibility, and permanent historical citizenship.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={cn(
              "p-4 rounded-2xl border text-center space-y-1.5",
              isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
            )}>
              <span className="text-2xl">⭐</span>
              <h3 className="font-bold text-xs sm:text-sm">Founding Citizen</h3>
              <p className="text-[11px] text-slate-400">Level 100 + 365 Active Days</p>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border text-center space-y-1.5",
              isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
            )}>
              <span className="text-2xl">⚜️</span>
              <h3 className="font-bold text-xs sm:text-sm">Ducal Nobility</h3>
              <p className="text-[11px] text-slate-400">Level 70 + High Reputation & Contribution</p>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border text-center space-y-1.5",
              isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
            )}>
              <span className="text-2xl">👑</span>
              <h3 className="font-bold text-xs sm:text-sm">Crown Sovereign</h3>
              <p className="text-[11px] text-slate-400">Level 90 + Impeccable Civic Provenance</p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={() => navigate('/titles')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
            >
              <span>View All Titles & Audited Provenance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
        )}

      </main>
    </div>
  );
}
