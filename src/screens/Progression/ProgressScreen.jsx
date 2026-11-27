// src/screens/Progression/ProgressScreen.jsx
//
// Answers: Where am I? Why am I here? What did I accomplish? What can I unlock? What comes next?

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { levelSystemService, getCitizenTier, getPerksForLevel, LEVEL_PERKS, getPrestigeInfo, XP_RULES } from "../../services/levelSystemService";
import { getMonetizationService } from "../../services/monetizationService.js";
import { getUserService } from "../../services/userService.js";
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { CitizenTierIcon, PerkIcon } from '../../components/Shared/ProgressionIcons.jsx';
import { Flame, ChevronRight, Lock, Coins, ShieldCheck, RefreshCw, Compass } from "lucide-react";
import { toast } from 'sonner';

export default function ProgressScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();

  const authProfile = userProfile || user;
  const currentUid = authProfile?.uid || user?.uid;

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [levelInfo, setLevelInfo] = useState(null);
  const [liveProfile, setLiveProfile] = useState(null);
  const [liveBalance, setLiveBalance] = useState(undefined);
  const [activeStreak, setActiveStreak] = useState(null);
  const [activeDaysCount, setActiveDaysCount] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';

  const loadProgression = useCallback(async ({ forceProfileRefresh = false } = {}) => {
    if (!currentUid) return;
    setLoadError(null);
    try {
      const requests = [
        levelSystemService.getLevelInfo(currentUid),
        getMonetizationService().getBalance(currentUid),
      ];
      if (forceProfileRefresh || authProfile?.activeDaysCount == null) {
        requests.push(getUserService().getUserProfile(currentUid, currentUid));
      }

      const [infoRes, balRes, profRes] = await Promise.allSettled(requests);

      if (infoRes.status === 'fulfilled') {
        setLevelInfo(infoRes.value);
      }
      if (balRes.status === 'fulfilled') {
        setLiveBalance(typeof balRes.value === 'number' ? balRes.value : null);
      }
      const fetchedProfile = profRes?.status === 'fulfilled' && profRes.value ? profRes.value : authProfile;
      if (profRes?.status === 'fulfilled' && profRes.value) {
        setLiveProfile(profRes.value);
      }

      if (infoRes.status === 'rejected' && balRes.status === 'rejected' && (!profRes || profRes.status === 'rejected')) {
        setLoadError('Unable to reach progression services right now.');
      }

      const streak = Number(fetchedProfile?.activeStreak);
      setActiveStreak(Number.isFinite(streak) && streak > 0 ? streak : null);
      const days = Number(fetchedProfile?.activeDaysCount ?? fetchedProfile?.activeDays);
      setActiveDaysCount(Number.isFinite(days) && days > 0 ? days : null);
    } catch {
      setLoadError('Failed to load live progression data.');
      toast.error('Failed to load live progression data');
    } finally {
      setRefreshing(false);
    }
  }, [currentUid, authProfile]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  const handleRefresh = async () => {
    setRefreshing(true);
    levelSystemService.invalidate(currentUid || user?.uid);
    await loadProgression({ forceProfileRefresh: true });
  };

  const effectiveProfile = liveProfile || authProfile;
  const hasLevel = (levelInfo?.level != null && Number.isFinite(Number(levelInfo.level)))
    || (effectiveProfile?.level != null && Number.isFinite(Number(effectiveProfile.level)));
  const level = levelInfo?.level ?? effectiveProfile?.level ?? 1;

  const experienceTotal = levelInfo?.experience ?? effectiveProfile?.experience ?? null;
  const coinsBalance = liveBalance !== undefined ? liveBalance : (effectiveProfile?.coins ?? null);

  const citizenTier = useMemo(() => getCitizenTier(level, activeDaysCount), [level, activeDaysCount]);
  const prestige = useMemo(() => getPrestigeInfo(level), [level]);

  const unlockedPerks = useMemo(() => getPerksForLevel(level), [level]);
  const upcomingPerks = useMemo(
    () => LEVEL_PERKS.filter((p) => p.minLevel > level).slice(0, 4),
    [level]
  );

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-200 ${isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'}`}>
      <main className="max-w-3xl mx-auto px-4 py-4 sm:py-5 space-y-6">
        {/* Utility Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <span className={isDark ? 'text-purple-400' : 'text-purple-700'}>
              {hasLevel ? `${citizenTier.tier} · Level ${level}` : 'Standing unavailable'}
            </span>
            {hasLevel && prestige.isPrestige && (
              <>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className={isDark ? 'text-amber-300' : 'text-amber-700'}>
                  Prestige {prestige.prestigeRoman}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh progression"
              className={`min-w-[40px] min-h-[40px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'bg-[#080F2E] border-white/[0.08] hover:bg-white/10 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/levels')}
              className={`min-h-[40px] text-xs font-semibold px-3.5 py-2 rounded-xl border whitespace-nowrap shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                isDark ? 'bg-[#080F2E] border-white/15 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Roadmap</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/perks')}
              className="min-h-[40px] text-xs font-semibold px-3.5 py-2 rounded-xl text-white transition-opacity hover:opacity-95 whitespace-nowrap shrink-0 cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
            >
              Perks &amp; Rewards
            </button>
            <button
              type="button"
              onClick={() => navigate('/passport')}
              className={`min-h-[40px] text-xs font-semibold px-3.5 py-2 rounded-xl border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isDark ? 'bg-[#080F2E] border-white/15 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
              }`}
            >
              Digital Passport
            </button>
          </div>
        </div>

        {loadError && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? 'bg-rose-500/10 border-rose-400/25 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            <span className="text-xs font-semibold">{loadError}</span>
            <button
              type="button"
              onClick={handleRefresh}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${isDark ? 'border-white/15 bg-white/10 text-white' : 'border-rose-200 bg-white text-rose-700'}`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Section 1: Primary Progress Overview */}
        <section
          aria-labelledby="progress-overview-heading"
          className={`p-6 rounded-3xl border transition-colors backdrop-blur-xl ${
            isDark
              ? 'bg-white/[0.03] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'bg-white/90 border-slate-200/80 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                Current Standing
              </span>
              <h2 id="progress-overview-heading" className="text-3xl font-bold tracking-tight mt-1 tabular-nums">
                {hasLevel ? `Level ${level}` : 'Level unavailable'}
                {hasLevel && (
                  <span className={`text-lg font-medium ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {levelInfo?.title || citizenTier.tier}
                  </span>
                )}
              </h2>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'
              }`}>
                {hasLevel ? <CitizenTierIcon tier={citizenTier.tier} className="w-5 h-5" /> : <Compass className="w-5 h-5" aria-hidden="true" />}
              </div>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {hasLevel ? `${citizenTier.tier} Tier` : 'Not yet rated'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className={`flex justify-between text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <span>{levelInfo?.xpIntoLevel != null ? `${levelInfo.xpIntoLevel} XP earned this level` : 'XP unavailable'}</span>
              <span>
                {!hasLevel
                  ? 'Progress unavailable'
                  : levelInfo?.isMaxLevel
                    ? 'Ascendant'
                    : `${unknownNumber(levelInfo?.xpToNext) ?? '—'} XP to Level ${level + 1}`}
              </span>
            </div>
            <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}>
              <div
                className="h-full transition-all duration-700 rounded-full"
                style={{
                  width: `${unknownNumber(levelInfo?.progress) ?? 0}%`,
                  background: BRAND_GRADIENT,
                }}
                role="progressbar"
                aria-valuenow={unknownNumber(levelInfo?.progress) ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className={`flex justify-between items-center text-xs pt-1 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Stage Progress: {unknownNumber(levelInfo?.progress) != null ? `${levelInfo.progress}%` : '—'}</span>
              <span>Total XP: {experienceTotal != null && Number.isFinite(Number(experienceTotal)) ? Number(experienceTotal).toLocaleString() : '—'}</span>
            </div>
          </div>

          {/* Stats Triad */}
          <div className={`grid grid-cols-3 gap-3 mt-6 pt-6 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-500 tabular-nums">
                <Flame className="w-4 h-4 shrink-0" />
                <span className="text-lg font-bold">{activeStreak ?? '—'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Day Streak</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-emerald-500 tabular-nums">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="text-lg font-bold">{activeDaysCount ?? '—'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Active Days</p>
            </div>

            <div className="text-center">
              <div className={`flex items-center justify-center gap-1.5 tabular-nums ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                <Coins className="w-4 h-4 shrink-0" />
                <span className="text-lg font-bold">
                  {coinsBalance != null && Number.isFinite(Number(coinsBalance)) ? Number(coinsBalance).toLocaleString() : '—'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Coins Balance</p>
            </div>
          </div>
        </section>

        {/* Section 2: Next Milestones */}
        <section aria-labelledby="milestones-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="milestones-heading" className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Stage Milestones &amp; Unlocks
            </h3>
            <button
              type="button"
              onClick={() => navigate('/achievements')}
              className={`min-h-[36px] text-xs font-semibold flex items-center gap-0.5 cursor-pointer hover:underline ${isDark ? 'text-purple-400' : 'text-purple-700'}`}
            >
              <span>All Achievements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingPerks.map((perk) => (
              <div
                key={`${perk.minLevel}-${perk.title}`}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  isDark ? 'bg-[#080F2E]/80 border-white/[0.08]' : 'bg-white border-slate-200/80'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-white/[0.05] text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold truncate">{perk.title}</h4>
                    <span className={`text-xs font-semibold tabular-nums shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      Lvl {perk.minLevel}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{perk.description}</p>
                </div>
              </div>
            ))}

            {upcomingPerks.length === 0 && (
              <div className={`col-span-2 p-6 rounded-2xl border text-center text-sm ${isDark ? 'bg-[#080F2E]/60 border-white/[0.08] text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                You have reached Ascendant standing and unlocked all standard tier capabilities!
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Unlocked Capabilities */}
        <section aria-labelledby="unlocked-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="unlocked-heading" className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Unlocked Capabilities ({unlockedPerks.length})
            </h3>
            <button
              type="button"
              onClick={() => navigate('/perks')}
              className={`min-h-[36px] text-xs font-semibold flex items-center gap-0.5 cursor-pointer hover:underline ${isDark ? 'text-purple-400' : 'text-purple-700'}`}
            >
              <span>All Perks &amp; Virtual Gifts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedPerks.map((perk) => (
              <div
                key={`${perk.minLevel}-${perk.title}`}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  isDark ? 'bg-[#080F2E]/70 border-white/[0.08]' : 'bg-white border-slate-200/80'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
                  <PerkIcon minLevel={perk.minLevel} title={perk.title} className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold truncate">{perk.title}</h4>
                    <span className="text-xs text-emerald-500 font-semibold shrink-0">Unlocked</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: XP Rules */}
        <section aria-labelledby="xp-rules-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="xp-rules-heading" className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Eligible Progression Activities
            </h3>
            <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
              Resets Daily 00:00 UTC
            </span>
          </div>

          <div className={`px-5 py-2 rounded-2xl border divide-y ${
            isDark ? 'bg-[#080F2E]/80 border-white/[0.08] divide-white/[0.08]' : 'bg-white border-slate-200/80 divide-slate-100'
          }`}>
            {[
              ['Daily Verified Presence', `+${XP_RULES.daily_login.xp} XP / day`],
              ['Active Streak Milestone (7d, 14d, 30d)', `+${XP_RULES.streak_milestone.xp} XP`],
              ['Original Post Publication', `+${XP_RULES.post_created.xp} XP (Cap: ${XP_RULES.post_created.dailyCap}/day)`],
              ['Story & Ephemeral Moments', `+${XP_RULES.story_created.xp} XP (Cap: ${XP_RULES.story_created.dailyCap}/day)`],
              ['Audio Studio Production', `+${XP_RULES.audio_track_created.xp} XP (Cap: ${XP_RULES.audio_track_created.dailyCap}/day)`],
              ['Constructive Conversation Comment', `+${XP_RULES.comment_created.xp} XP (Cap: ${XP_RULES.comment_created.dailyCap}/day)`],
              ['Genuine Community Connection', `+${XP_RULES.follow_received.xp} XP`],
              ['Sending Virtual Gifts to Creators', `+${XP_RULES.gift_sent.xp} XP (Cap: ${XP_RULES.gift_sent.dailyCap}/day)`],
              ['Receiving Creator Patronage & Gifts', `+${XP_RULES.gift_received.xp} XP (Cap: ${XP_RULES.gift_received.dailyCap}/day)`],
              ['Sharing Content Across the Network', `+${XP_RULES.post_shared.xp} XP (Cap: ${XP_RULES.post_shared.dailyCap}/day)`],
              ['Civic Poll & Governance Voting', `+${XP_RULES.civic_vote_cast.xp} XP`],
              ['Watching Sponsored Video Ads', `+${XP_RULES.ad_reward_claimed.xp} XP (Cap: ${XP_RULES.ad_reward_claimed.dailyCap}/day)`],
            ].map(([label, value]) => (
              <div key={label} className="py-3 flex items-center justify-between gap-3 text-xs">
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{label}</span>
                <span className="font-semibold text-emerald-500 tabular-nums whitespace-nowrap">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
