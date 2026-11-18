// src/screens/Progression/PerksRewardsScreen.jsx
//
// View Perks, Level Milestone Coin Rewards, Virtual Gifts, and Prestige Benefits.
// Consumes canonical shared/levelConfig.cjs and adheres to Zero-Pill discipline.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
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
  MAX_LEVEL,
  ROYAL_ELIGIBILITY,
} from '../../shared/levelConfig.cjs';
import { Gift, Coins, Crown, Lock, CheckCircle2, Send, Zap, ArrowRight, UserCheck } from "lucide-react";
import { getMonetizationService } from '../../services/monetizationService.js';
import { getUserService } from '../../services/userService.js';
import { levelSystemService } from '../../services/levelSystemService.js';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

const TABS = [
  { id: 'all', label: 'All Rewards & Gifts' },
  { id: 'perks', label: 'Level Perks' },
  { id: 'gifts', label: 'Virtual Gifts' },
  { id: 'coins', label: 'Coin Grants' },
  { id: 'prestige', label: 'Prestige' },
];

export default function PerksRewardsScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'midnight';

  const authProfile = userProfile || user;
  const uid = authProfile?.uid || user?.uid || null;

  const [liveProfile, setLiveProfile] = useState(null);
  const [liveBalance, setLiveBalance] = useState(undefined);
  const [liveLevelInfo, setLiveLevelInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [balRes, profRes, lvlRes] = await Promise.allSettled([
          getMonetizationService().getBalance(uid),
          getUserService().getUserProfile(uid, uid),
          levelSystemService.getLevelInfo(uid),
        ]);
        if (cancelled) return;
        if (balRes.status === 'fulfilled') {
          setLiveBalance(typeof balRes.value === 'number' ? balRes.value : null);
        }
        if (profRes.status === 'fulfilled' && profRes.value) {
          setLiveProfile(profRes.value);
        }
        if (lvlRes.status === 'fulfilled' && lvlRes.value) {
          setLiveLevelInfo(lvlRes.value);
        }
      } catch (err) {
        console.warn('[PerksRewards] live fetch failed:', err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const profile = liveProfile || authProfile;
  const storedLevel = liveLevelInfo?.level != null
    ? Number(liveLevelInfo.level)
    : (profile?.level != null ? Number(profile.level) : null);
  const hasStoredLevel = storedLevel != null && Number.isFinite(storedLevel);
  const currentLevel = hasStoredLevel ? storedLevel : 1;

  // An unknown balance stays null: '0 Coins ($0.00)' would claim an empty
  // treasury, and `>= g.coins` would then wrongly show 'insufficient funds'.
  const coinsRaw = liveBalance !== undefined ? liveBalance : profile?.coins;
  const userCoins = coinsRaw === null || coinsRaw === undefined || Number.isNaN(Number(coinsRaw))
    ? null
    : Number(coinsRaw);

  // An unknown active-day count is treated as the conservative floor (0), not a
  // fabricated "1 day" that bumps a citizen tier; `getCitizenTier` floors at 0.
  const activeDaysRaw = profile?.activeDaysCount ?? profile?.activeDays;
  const activeDays = Number.isFinite(Number(activeDaysRaw)) ? Number(activeDaysRaw) : 0;

  // An unwritten experience total is unknown, not 0 XP — deriving the level
  // bar from a fabricated 0 would claim progress the profile has not earned.
  const experienceRaw = liveLevelInfo?.experience ?? profile?.experience;
  const hasExperience = experienceRaw != null && Number.isFinite(Number(experienceRaw));
  const experience = hasExperience ? Number(experienceRaw) : 0;

  const citizenTier = useMemo(() => getCitizenTier(currentLevel, activeDays), [currentLevel, activeDays]);
  const prestige = useMemo(() => getPrestigeInfo(currentLevel), [currentLevel]);
  const levelInfo = useMemo(
    () => (liveLevelInfo && hasExperience ? liveLevelInfo : getLevelInfo(experience)),
    [liveLevelInfo, hasExperience, experience]
  );

  const unlockedPerks = useMemo(() => LEVEL_PERKS.filter((p) => currentLevel >= p.minLevel), [currentLevel]);
  const upcomingCoinMilestones = useMemo(() => {
    return LEVELS.filter((l) => l.level >= currentLevel && l.coinReward > 0).slice(0, 8);
  }, [currentLevel]);

  const handleSendGiftClick = (gift) => {
    toast.info(`Open a friend or creator's profile to send the ${gift.name} (${gift.coins} coins).`);
    navigate('/connections');
  };

  return (
    <div className={cn(
      "min-h-screen pb-28 transition-colors duration-200 relative",
      isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-slate-900"
    )}>
      {/* Top Hairline Accent */}
      <span
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[2px] z-30"
        style={{ background: BRAND_GRADIENT }}
      />

      {/* Sticky Utility & Tab Header */}
      <div className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-xl transition-colors",
        isDark ? "bg-[#03071B]/90 border-white/[0.08]" : "bg-[#F6F8FC]/90 border-slate-200"
      )}>
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-800")}>
              Perks &amp; Rewards
            </span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className={cn("font-semibold tabular-nums", isDark ? "text-amber-400" : "text-amber-700")}>
              {userCoins == null ? '— Coins' : `${userCoins.toLocaleString()} Coins (${formatCoinsAsUsd(userCoins)})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/progress')}
              className={cn(
                "min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                isDark ? "border-white/15 hover:bg-white/[0.06] text-slate-200" : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
              )}
            >
              Level Progression
            </button>
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
            >
              Coins Treasury
            </button>
          </div>
        </div>

        {/* Underline Filter Navigation */}
        <div
          role="tablist"
          aria-label="Perks sections"
          className="max-w-4xl mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const label = tab.id === 'perks' ? `${tab.label} (${unlockedPerks.length})` : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative min-h-[44px] px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                  active
                    ? isDark ? "text-white" : "text-slate-950"
                    : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span>{label}</span>
                {active && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: BRAND_GRADIENT }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* Hero Overview */}
        <section className={cn(
          "rounded-3xl border p-6 sm:p-7 space-y-5 transition-colors",
          isDark
            ? "bg-[#080F2E]/90 border-white/[0.08]"
            : "bg-white border-slate-200/80 shadow-sm"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-xl" aria-hidden="true">{hasStoredLevel ? citizenTier.icon : '—'}</span>
                <span className={cn("font-semibold", isDark ? "text-purple-400" : "text-purple-700")}>
                  {hasStoredLevel ? `${citizenTier.tier} Standing · Level ${currentLevel}` : 'Standing unavailable'}
                </span>
                {hasStoredLevel && prestige.isPrestige && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className={cn("font-semibold", isDark ? "text-amber-300" : "text-amber-700")}>
                      Prestige {prestige.prestigeRoman}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {hasStoredLevel ? `${getRankTitle(currentLevel)} Rank Capabilities` : 'Rank Capabilities'}
              </h1>
              <p className={cn("text-xs sm:text-sm max-w-lg", isDark ? "text-slate-400" : "text-slate-600")}>
                Your level unlocks creation tools, virtual gift sending, level-up coin grants, and civic poll participation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className={cn(
                "p-3.5 rounded-2xl border text-center space-y-0.5 min-w-[120px]",
                isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
              )}>
                <div className="text-[11px] font-medium text-slate-500">Treasury</div>
                <div className={cn("text-lg font-bold flex items-center justify-center gap-1 tabular-nums", isDark ? "text-amber-400" : "text-amber-700")}>
                  <Coins className="w-4 h-4 shrink-0" />
                  <span>{userCoins == null ? '—' : userCoins.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {userCoins == null ? 'Balance unavailable' : formatCoinsAsUsd(userCoins)}
                </div>
              </div>

              <div className={cn(
                "p-3.5 rounded-2xl border text-center space-y-0.5 min-w-[120px]",
                isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
              )}>
                <div className="text-[11px] font-medium text-slate-500">Perks Earned</div>
                <div className="text-lg font-bold text-emerald-500 flex items-center justify-center gap-1 tabular-nums">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{unlockedPerks.length}</span>
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">of {LEVEL_PERKS.length} Total</div>
              </div>
            </div>
          </div>

          {/* Stage Experience Bar */}
          <div className={cn("pt-4 border-t space-y-2", isDark ? "border-white/[0.08]" : "border-slate-200")}>
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>Stage Experience Progress</span>
              <span className={cn("font-semibold tabular-nums", isDark ? "text-purple-400" : "text-purple-700")}>
                {!hasExperience
                  ? '—'
                  : levelInfo.isMaxLevel
                    ? 'Ascendant'
                    : `${levelInfo.xpToNext} XP to Level ${levelInfo.level + 1}`}
              </span>
            </div>
            <div className={cn("w-full h-2 rounded-full overflow-hidden", isDark ? "bg-white/[0.08]" : "bg-slate-200")}>
              {hasExperience ? (
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${levelInfo.progress}%`,
                    background: BRAND_GRADIENT,
                  }}
                />
              ) : (
                <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(148,163,184,0.25)_6px,rgba(148,163,184,0.25)_12px)]" />
              )}
            </div>
          </div>
        </section>

        {/* 1. VIRTUAL GIFTS & TIP REWARDS */}
        {(activeTab === 'all' || activeTab === 'gifts') && (
          <section className={cn(
            "rounded-3xl border p-5 sm:p-7 space-y-5",
            isDark ? "bg-[#080F2E]/90 border-white/[0.08]" : "bg-white border-slate-200/80 shadow-sm"
          )}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-rose-500 shrink-0" />
                  <h2 className="text-base sm:text-lg font-bold tracking-tight">
                    Virtual Gifts &amp; Creator Patronage
                  </h2>
                </div>
                <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-600")}>
                  Share virtual gifts with friends and creators across Arvdoul. Sending gifts awards{' '}
                  <span className={cn("font-semibold", isDark ? "text-purple-400" : "text-purple-700")}>
                    +{XP_RULES.gift_received.xp} XP
                  </span>{' '}
                  to recipients.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/connections')}
                className={cn(
                  "min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer border",
                  isDark ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-white" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                )}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Browse Friends</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {GIFT_CATALOG.map((g) => {
                const canAfford = userCoins != null && userCoins >= g.coins;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "p-3 rounded-2xl border text-center transition-colors flex flex-col justify-between gap-2",
                      isDark
                        ? "bg-[#03071B]/60 hover:bg-[#03071B] border-white/[0.08]"
                        : "bg-slate-50 hover:bg-white border-slate-200"
                    )}
                  >
                    <div className="text-3xl my-1" aria-hidden="true">{g.emoji}</div>
                    <div>
                      <h3 className="font-semibold text-xs">{g.name}</h3>
                      <div className={cn("flex items-center justify-center gap-1 text-xs font-bold mt-0.5 tabular-nums", isDark ? "text-amber-400" : "text-amber-700")}>
                        <Coins className="w-3 h-3 shrink-0" />
                        <span>{g.coins}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {formatCoinsAsUsd(g.coins)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendGiftClick(g)}
                      className={cn(
                        "min-h-[36px] py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer w-full flex items-center justify-center gap-1 whitespace-nowrap",
                        canAfford
                          ? "bg-purple-600 hover:bg-purple-500 text-white"
                          : isDark
                            ? "bg-white/[0.08] text-slate-300 hover:bg-white/15"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      )}
                    >
                      <Send className="w-3 h-3 shrink-0" />
                      <span>Send</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. LEVEL-UP COIN GRANTS */}
        {(activeTab === 'all' || activeTab === 'coins') && (
          <section className={cn(
            "rounded-3xl border p-5 sm:p-7 space-y-5",
            isDark ? "bg-[#080F2E]/90 border-white/[0.08]" : "bg-white border-slate-200/80 shadow-sm"
          )}>
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500 shrink-0" />
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Level-Up Coin Reward Ledger
                </h2>
              </div>
              <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-600")}>
                Every level advanced credits platform coins to your wallet, recorded in your transaction history.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {upcomingCoinMilestones.map((milestone) => {
                const isCurrent = milestone.level === currentLevel;
                return (
                  <div
                    key={milestone.level}
                    className={cn(
                      "p-3.5 rounded-2xl border flex items-center justify-between gap-2",
                      isCurrent
                        ? isDark ? "bg-purple-500/15 border-purple-400/40" : "bg-purple-50 border-purple-300"
                        : isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-500 tabular-nums">
                        Level {milestone.level}
                      </div>
                      <div className="text-xs font-semibold">
                        {milestone.level % 10 === 0 ? 'Decade Milestone' : 'Level Reward'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={cn("text-sm font-bold flex items-center justify-end gap-1 tabular-nums", isDark ? "text-amber-400" : "text-amber-700")}>
                        <Coins className="w-3.5 h-3.5 shrink-0" />
                        <span>+{milestone.coinReward}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {formatCoinsAsUsd(milestone.coinReward)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. PLATFORM CAPABILITIES */}
        {(activeTab === 'all' || activeTab === 'perks') && (
          <section className={cn(
            "rounded-3xl border p-5 sm:p-7 space-y-5",
            isDark ? "bg-[#080F2E]/90 border-white/[0.08]" : "bg-white border-slate-200/80 shadow-sm"
          )}>
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400 shrink-0" />
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Platform Capabilities &amp; Privilege Gates
                </h2>
              </div>
              <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-600")}>
                Functional gates that unlock tools: live streaming, creator withdrawals, profile highlights, and civic poll participation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {LEVEL_PERKS.map((perk) => {
                const isUnlocked = currentLevel >= perk.minLevel;
                return (
                  <div
                    key={`${perk.minLevel}-${perk.title}`}
                    className={cn(
                      "p-4 rounded-2xl border flex items-start gap-3.5",
                      isUnlocked
                        ? isDark ? "bg-purple-500/10 border-purple-500/25" : "bg-purple-50/40 border-purple-200"
                        : isDark ? "bg-[#03071B]/50 border-white/[0.06] opacity-70" : "bg-slate-50 border-slate-200 opacity-75"
                    )}
                  >
                    <div className="text-2xl p-1 shrink-0" aria-hidden="true">
                      {perk.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-xs sm:text-sm truncate">
                          {perk.title}
                        </h3>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Unlocked</span>
                          </span>
                        ) : (
                          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums shrink-0", isDark ? "text-amber-400" : "text-amber-700")}>
                            <Lock className="w-3 h-3" />
                            <span>Lvl {perk.minLevel}</span>
                          </span>
                        )}
                      </div>

                      <p className={cn("text-xs mt-1 line-clamp-2", isDark ? "text-slate-400" : "text-slate-600")}>
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
            "rounded-3xl border p-5 sm:p-7 space-y-5",
            isDark ? "bg-[#080F2E]/90 border-white/[0.08]" : "bg-white border-slate-200/80 shadow-sm"
          )}>
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
                isDark ? "bg-purple-500/15 text-purple-400 border-purple-500/25" : "bg-purple-50 text-purple-700 border-purple-200"
              )}>
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Prestige &amp; Sovereign Nobility
                </h2>
                <p className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-600")}>
                  Exceeding Level {MAX_LEVEL} unlocks Roman Numeral Prestige tiers (I through X), computed from your level.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={cn(
                "p-4 rounded-2xl border text-center space-y-1.5",
                isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
              )}>
                <span className="text-2xl" aria-hidden="true">⭐</span>
                <h3 className="font-bold text-xs sm:text-sm">Founding Citizen</h3>
                <p className="text-xs text-slate-500">Level {MAX_LEVEL} · {ROYAL_ELIGIBILITY.king.minActiveDays} Active Days</p>
              </div>

              <div className={cn(
                "p-4 rounded-2xl border text-center space-y-1.5",
                isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
              )}>
                <span className="text-2xl" aria-hidden="true">⚜️</span>
                <h3 className="font-bold text-xs sm:text-sm">Ducal Nobility</h3>
                <p className="text-xs text-slate-500">Level {ROYAL_ELIGIBILITY.duke.minLevel} · High Reputation &amp; Contribution</p>
              </div>

              <div className={cn(
                "p-4 rounded-2xl border text-center space-y-1.5",
                isDark ? "bg-[#03071B]/60 border-white/[0.08]" : "bg-slate-50 border-slate-200"
              )}>
                <span className="text-2xl" aria-hidden="true">👑</span>
                <h3 className="font-bold text-xs sm:text-sm">Crown Sovereign</h3>
                <p className="text-xs text-slate-500">Level {ROYAL_ELIGIBILITY.king.minLevel} · Impeccable Provenance</p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => navigate('/titles')}
                className={cn(
                  "min-h-[40px] inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:underline",
                  isDark ? "text-purple-400" : "text-purple-700"
                )}
              >
                <span>View All Titles &amp; Verified Provenance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
