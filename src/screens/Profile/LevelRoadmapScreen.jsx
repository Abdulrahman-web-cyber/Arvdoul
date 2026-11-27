// src/screens/Profile/LevelRoadmapScreen.jsx
//
// Full-screen Arvdoul Level, Digital Citizenship & Royal Family Standing screen.
// Grounded strictly in src/shared/levelConfig.cjs and projected viewer capabilities.

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap,
  ShieldCheck,
  Crown,
  Landmark,
  CheckCircle2,
  Lock,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';
import { useProfileStore } from '../../store/profileStore';
import { getUserService } from '../../services/userService.js';
import { BRAND_GRADIENT, brandHexRgba, tokens } from '../../design-system/tokens.js';
import { CitizenTierIcon, PerkIcon } from '../../components/Shared/ProgressionIcons.jsx';
import {
  LEVEL_PERKS,
  CITIZEN_TIERS,
  ROYAL_ELIGIBILITY,
  getRankTitle,
  getCitizenTier,
  getRoyalEligibility,
  getLevelInfo,
} from '../../shared/levelConfig.cjs';

const VALID_TABS = new Set(['levels', 'citizenship', 'royals']);

const normalizeTab = (raw) => (VALID_TABS.has(raw) ? raw : 'levels');

const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const RoyalEligibilityChecklist = memo(function RoyalEligibilityChecklist({
  rule,
  level,
  activeDays,
  reputation,
  contribution,
  influence,
  achievements,
  isDark,
}) {
  const rows = [
    { label: `Level ${rule.minLevel}+`, current: level, target: rule.minLevel },
    { label: `${rule.minActiveDays} Active Days`, current: activeDays, target: rule.minActiveDays },
    { label: `Reputation ${rule.minReputation}+`, current: reputation, target: rule.minReputation },
    { label: `Contribution ${rule.minContribution}+`, current: contribution, target: rule.minContribution },
    { label: `Influence ${rule.minInfluence}+`, current: influence, target: rule.minInfluence },
    { label: `${rule.minAchievements} Achievements`, current: achievements, target: rule.minAchievements },
  ];

  return (
    <div className={cn('pt-3 border-t space-y-2', isDark ? 'border-white/[0.08]' : 'border-slate-200/80')}>
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-600')}>
        Eligibility Checklist
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {rows.map((row) => {
          const known = row.current != null && !Number.isNaN(row.current);
          const met = known && row.current >= row.target;
          return (
            <div
              key={row.label}
              className={cn(
                'px-3 py-2 rounded-xl border flex items-center justify-between gap-2 tabular-nums backdrop-blur-md',
                met
                  ? isDark
                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isDark
                    ? 'bg-white/[0.02] border-white/[0.08] text-slate-300'
                    : 'bg-white/80 border-slate-200 text-slate-600'
              )}
            >
              <span className="truncate font-medium">{row.label}</span>
              <span className="inline-flex items-center gap-1.5 shrink-0 font-bold">
                <span>
                  {known ? row.current : '—'}/{row.target}
                </span>
                {met ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5 opacity-75" aria-hidden="true" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function LevelRoadmapScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme } = useTheme();
  const { user: authUser } = useAuth();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark' || theme === 'midnight';

  const storeProfile = useProfileStore((s) => s.profile);

  const requestedTab = normalizeTab(searchParams.get('tab'));
  const requestedUserId = searchParams.get('userId') || null;
  const currentUid = authUser?.uid || null;
  const targetUid = requestedUserId || currentUid || null;
  const isOwner = Boolean(currentUid && (!targetUid || targetUid === currentUid));

  const [activeTab, setActiveTab] = useState(requestedTab);
  const [remoteProfile, setRemoteProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleTabSelect = useCallback((nextTab) => {
    const clean = normalizeTab(nextTab);
    setActiveTab(clean);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', clean);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchTargetProfile = useCallback(async () => {
    if (!targetUid) return;
    if (isOwner && storeProfile && (storeProfile.uid === targetUid || storeProfile.id === targetUid)) {
      setRemoteProfile(storeProfile);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getUserService().getUserProfile(targetUid, currentUid);
      setRemoteProfile(profile || null);
    } catch (err) {
      setLoadError(err?.message || 'Unable to load civic standing');
    } finally {
      setLoading(false);
    }
  }, [targetUid, currentUid, isOwner, storeProfile]);

  useEffect(() => {
    fetchTargetProfile();
  }, [fetchTargetProfile]);

  const profile = useMemo(() => {
    if (isOwner) {
      if (storeProfile && (storeProfile.uid === currentUid || storeProfile.id === currentUid)) {
        return storeProfile;
      }
      return remoteProfile || authUser || {};
    }
    return remoteProfile || {};
  }, [isOwner, storeProfile, currentUid, remoteProfile, authUser]);

  const rawLvl = profile?.level;
  const currentLevel =
    rawLvl !== null && rawLvl !== undefined && !Number.isNaN(Number(rawLvl)) && Number(rawLvl) > 0
      ? Math.floor(Number(rawLvl))
      : null;

  const rawXp = profile?.experience ?? profile?.xp;
  const hasXp = rawXp !== null && rawXp !== undefined && !Number.isNaN(Number(rawXp));
  const currentXp = hasXp ? Number(rawXp) : null;

  const levelInfo = useMemo(
    () => (hasXp ? getLevelInfo(currentXp) : { level: currentLevel, progress: null, nextLevelXp: null, currentLevelXp: null, xpIntoLevel: null }),
    [hasXp, currentXp, currentLevel]
  );

  const activeDays = numOrNull(profile?.activeDaysCount ?? profile?.activeDays);
  const reputation = numOrNull(profile?.reputationScore ?? profile?.reputation);
  const contribution = numOrNull(profile?.contributionScore ?? profile?.contribution);
  const influence = numOrNull(profile?.influenceScore ?? profile?.influence);
  const achievements = profile?.achievementsCount !== undefined
    ? numOrNull(profile?.achievementsCount)
    : (Array.isArray(profile?.achievements) ? profile.achievements.length : null);

  const stats = useMemo(() => ({
    level: currentLevel,
    activeDays,
    reputation,
    contribution,
    influence,
    achievements,
    policyStanding: profile?.policyStanding || profile?.accountStatus || null,
  }), [currentLevel, activeDays, reputation, contribution, influence, achievements, profile]);

  const dukeEligibility = useMemo(() => getRoyalEligibility('duke', stats), [stats]);
  const kingEligibility = useMemo(() => getRoyalEligibility('king', stats), [stats]);

  const currentCitizenTier = useMemo(
    () => (currentLevel !== null ? getCitizenTier(currentLevel, activeDays) : null),
    [currentLevel, activeDays]
  );
  const currentRankTitle = useMemo(
    () => (currentLevel !== null ? getRankTitle(currentLevel) : null),
    [currentLevel]
  );

  const citizenCriteria = useMemo(() => {
    const tier = CITIZEN_TIERS.find((t) => t.tier === 'Citizen') || {};
    return { minLevel: tier.minLevel ?? null, minDays: tier.minDays ?? null };
  }, []);

  const meetsLevelRequirement = currentLevel !== null && citizenCriteria.minLevel !== null && currentLevel >= citizenCriteria.minLevel;
  const meetsDaysRequirement = activeDays !== null && citizenCriteria.minDays !== null && activeDays >= citizenCriteria.minDays;
  const isFullCitizen = meetsLevelRequirement && meetsDaysRequirement;

  const passportUrl = isOwner ? '/passport' : (targetUid ? `/passport/${encodeURIComponent(targetUid)}` : '/passport');
  const progressPct = unknownNumber(levelInfo?.progress);

  const glassCard = isDark
    ? 'bg-white/[0.025] border-white/[0.08] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_12px_28px_-16px_rgba(0,0,0,0.5)]'
    : 'bg-white/85 border-slate-200/80 backdrop-blur-xl shadow-[0_8px_24px_-14px_rgba(30,41,90,0.16),inset_0_1px_0_rgba(255,255,255,0.95)]';

  const tabs = [
    { id: 'levels', label: 'Levels & Unlocks', icon: Zap },
    { id: 'citizenship', label: 'Citizenship', icon: ShieldCheck },
    { id: 'royals', label: 'Royal Family', icon: Crown },
  ];

  return (
    <div
      className={cn(
        'min-h-screen w-full transition-colors pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
      )}
    >
      {/* Subtle Ambient Aura */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-24 left-1/4 w-[380px] h-[380px] rounded-full blur-[120px]"
          style={{ backgroundColor: brandHexRgba(tokens.color.brand.violet, isDark ? 0.12 : 0.08) }}
        />
        <div
          className="absolute top-1/3 right-1/5 w-[340px] h-[340px] rounded-full blur-[120px]"
          style={{ backgroundColor: brandHexRgba(tokens.color.brand.blue, isDark ? 0.12 : 0.08) }}
        />
      </div>

      {/* Inline Fallback Header when TopAppBar is hidden */}
      {!hasTopAppBar && (
        <header
          className={cn(
            'sticky top-0 z-30 border-b backdrop-blur-2xl',
            isDark ? 'bg-[#03071B]/80 border-white/[0.08]' : 'bg-[#F6F8FC]/85 border-slate-200/80'
          )}
        >
          <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className={cn(
                'inline-flex items-center gap-1.5 min-h-[44px] px-2.5 -ml-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-200/60'
              )}
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              <span>Back</span>
            </button>
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
              Level &amp; Citizenship
            </h1>
            <div className="w-16" aria-hidden="true" />
          </div>
        </header>
      )}

      <main className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5 space-y-4 sm:space-y-5">
        {/* Segmented Liquid Glass Tab Switcher */}
        <div
          role="tablist"
          aria-label="Standing sections"
          className={cn('p-1.5 rounded-2xl border flex items-center gap-1.5', glassCard)}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleTabSelect(tab.id)}
                style={isSelected && tab.id !== 'royals' ? { background: BRAND_GRADIENT } : undefined}
                className={cn(
                  'flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isSelected
                    ? tab.id === 'royals'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_8px_20px_-8px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.45)]'
                      : 'text-white shadow-[0_10px_22px_-10px_rgba(68,49,247,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]'
                    : isDark
                      ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error notice with retry */}
        {loadError && (
          <div className={cn('p-4 rounded-2xl border flex items-center justify-between gap-3', glassCard)}>
            <span className={cn('text-xs font-semibold', isDark ? 'text-rose-300' : 'text-rose-600')}>
              {loadError}
            </span>
            <button
              type="button"
              onClick={fetchTargetProfile}
              className={cn(
                'inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isDark ? 'bg-white/[0.06] border-white/[0.12] text-white hover:bg-white/[0.10]' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Three Identity Pillars Overview */}
        <section className={cn('p-4 sm:p-5 rounded-2xl border space-y-3', glassCard)} aria-label="Arvdoul identity pillars">
          <div className={cn('text-[10px] font-extrabold uppercase tracking-widest', isDark ? 'text-slate-400' : 'text-slate-500')}>
            The Three Pillars of Arvdoul Identity
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className={cn('p-3 rounded-xl border space-y-1', isDark ? 'bg-white/[0.025] border-cyan-400/20' : 'bg-cyan-50/70 border-cyan-200')}>
              <div className={cn('font-bold flex items-center gap-1.5 text-xs', isDark ? 'text-cyan-300' : 'text-cyan-700')}>
                <Landmark className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>1. Citizen</span>
              </div>
              <p className={cn('text-[11px] leading-snug', isDark ? 'text-slate-300' : 'text-slate-600')}>
                Belonging, membership, and civic participation across Arvdoul.
              </p>
            </div>
            <div className={cn('p-3 rounded-xl border space-y-1', isDark ? 'bg-white/[0.025] border-purple-400/20' : 'bg-purple-50/70 border-purple-200')}>
              <div className={cn('font-bold flex items-center gap-1.5 text-xs', isDark ? 'text-purple-300' : 'text-purple-700')}>
                <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>2. Level</span>
              </div>
              <p className={cn('text-[11px] leading-snug', isDark ? 'text-slate-300' : 'text-slate-600')}>
                XP earned through real actions, milestones, and platform progression.
              </p>
            </div>
            <div className={cn('p-3 rounded-xl border space-y-1', isDark ? 'bg-white/[0.025] border-amber-400/20' : 'bg-amber-50/70 border-amber-200')}>
              <div className={cn('font-bold flex items-center gap-1.5 text-xs', isDark ? 'text-amber-300' : 'text-amber-700')}>
                <Crown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>3. Royal Family</span>
              </div>
              <p className={cn('text-[11px] leading-snug', isDark ? 'text-slate-300' : 'text-slate-600')}>
                Distinguished institution of civic honor, longevity, and leadership.
              </p>
            </div>
          </div>
        </section>

        {/* TAB 1: LEVELS & UNLOCKS */}
        {activeTab === 'levels' && (
          <div className="space-y-5">
            {/* Current Standing Summary */}
            <section className={cn('p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4', glassCard)}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(68,49,247,0.7)]"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {loading && currentLevel === null ? '…' : (currentLevel !== null ? currentLevel : '—')}
                </div>
                <div className="min-w-0">
                  <div className={cn('text-[10px] font-bold uppercase tracking-widest', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Current Standing
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                    {currentLevel !== null
                      ? `Level ${currentLevel}${currentRankTitle ? ` • ${currentRankTitle}` : ''}`
                      : 'Standing unavailable'}
                  </h2>
                  <div className={cn('text-xs tabular-nums', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    {currentXp == null ? 'XP not recorded' : `${currentXp.toLocaleString()} XP earned across Arvdoul`}
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-52 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Next Level</span>
                  <span className={isDark ? 'text-cyan-300' : 'text-arvdoul-blue'}>
                    {progressPct === null
                      ? '—'
                      : levelInfo?.nextLevelXp
                        ? `${levelInfo.nextLevelXp.toLocaleString()} XP`
                        : 'Max'}
                  </span>
                </div>
                <div className={cn('w-full h-2 rounded-full overflow-hidden', isDark ? 'bg-white/[0.08]' : 'bg-slate-200/80')}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct ?? 0}%`,
                      background: BRAND_GRADIENT,
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Quick Links to Deep Progression & Perks */}
            {isOwner && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/progress')}
                  className={cn(
                    'p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    glassCard,
                    isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-white'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isDark ? 'bg-white/[0.06] text-purple-300' : 'bg-purple-50 text-arvdoul-purple')}>
                      <Zap className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">XP Progression</div>
                      <div className={cn('text-xs truncate', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        Track streaks, tasks, and XP history
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/perks')}
                  className={cn(
                    'p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    glassCard,
                    isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-white'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isDark ? 'bg-white/[0.06] text-cyan-300' : 'bg-cyan-50 text-arvdoul-blue')}>
                      <Sparkles className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Perks &amp; Rewards</div>
                      <div className={cn('text-xs truncate', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        Claim level-up coin rewards &amp; privileges
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Perks by Level */}
            <section className="space-y-3">
              <h3 className={cn('text-xs font-extrabold uppercase tracking-widest px-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Perks &amp; Privileges by Level
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {LEVEL_PERKS.map((perk) => {
                  const isUnlocked = currentLevel !== null && currentLevel >= perk.minLevel;
                  return (
                    <div
                      key={`${perk.minLevel}-${perk.title}`}
                      className={cn(
                        'p-4 rounded-2xl border transition-all flex items-start justify-between gap-3',
                        glassCard,
                        isUnlocked
                          ? (isDark ? 'border-purple-400/25' : 'border-purple-200')
                          : 'opacity-70'
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                          isUnlocked
                            ? isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'
                            : isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        )}>
                          <PerkIcon minLevel={perk.minLevel} title={perk.title} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm">{perk.title}</span>
                            <span
                              className={cn(
                                'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                                isUnlocked
                                  ? isDark
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-400/35'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                  : isDark
                                    ? 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                              )}
                            >
                              Level {perk.minLevel}
                            </span>
                          </div>
                          <p className={cn('text-xs mt-1 leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
                            {perk.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 mt-0.5">
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Active</span>
                          </span>
                        ) : (
                          <span className={cn('inline-flex items-center gap-1 font-bold text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Lvl {perk.minLevel}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CITIZENSHIP & PASSPORT */}
        {activeTab === 'citizenship' && (
          <div className="space-y-5">
            <section className={cn('p-5 rounded-2xl border space-y-4', glassCard)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest block', isDark ? 'text-cyan-300' : 'text-cyan-700')}>
                    Citizenship — Who You Are
                  </span>
                  <h2 className="text-base sm:text-lg font-black mt-0.5">
                    {currentCitizenTier?.tier || '—'}
                  </h2>
                  <p className={cn('text-xs mt-1 leading-relaxed max-w-2xl', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    Every registered member of Arvdoul belongs to the community. Citizenship represents identity, belonging, and democratic participation.
                  </p>
                </div>
                {currentCitizenTier && (
                  <div className={cn(
                    'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0',
                    isDark ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                  )}>
                    <CitizenTierIcon tier={currentCitizenTier.tier} className="w-5 h-5" />
                  </div>
                )}
              </div>

              <div className={cn('pt-3 border-t space-y-2.5', isDark ? 'border-white/[0.08]' : 'border-slate-200/80')}>
                <div className={cn('text-xs font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
                  Requirement for Full Democratic Citizenship &amp; Official Passport Stamp:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between',
                      meetsLevelRequirement
                        ? isDark
                          ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : isDark
                          ? 'bg-white/[0.02] border-white/[0.08] text-slate-300'
                          : 'bg-white border-slate-200 text-slate-600'
                    )}
                  >
                    <span className="font-semibold">Level {citizenCriteria.minLevel ?? '—'}+ Reached</span>
                    {meetsLevelRequirement ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5 opacity-75" aria-hidden="true" />}
                  </div>
                  <div
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between tabular-nums',
                      meetsDaysRequirement
                        ? isDark
                          ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : isDark
                          ? 'bg-white/[0.02] border-white/[0.08] text-slate-300'
                          : 'bg-white border-slate-200 text-slate-600'
                    )}
                  >
                    <span className="font-semibold">
                      {citizenCriteria.minDays ?? '—'} Active Days ({activeDays ?? '—'}/{citizenCriteria.minDays ?? '—'})
                    </span>
                    {meetsDaysRequirement ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5 opacity-75" aria-hidden="true" />}
                  </div>
                </div>
              </div>
            </section>

            {/* Digital Passport CTA */}
            <section className={cn('p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4', glassCard)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', isDark ? 'bg-white/[0.06] text-cyan-300' : 'bg-purple-50 text-arvdoul-purple')}>
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black">Digital Nation Passport</div>
                  <div className={cn('text-xs truncate', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    {isFullCitizen
                      ? 'Official Stamp Active • Full Democratic Jurisdiction'
                      : citizenCriteria.minLevel && citizenCriteria.minDays
                        ? `Resident Dossier • Reach Level ${citizenCriteria.minLevel} with ${citizenCriteria.minDays} active days to stamp`
                        : 'Resident Dossier'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(passportUrl)}
                style={{ background: BRAND_GRADIENT }}
                className="min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-[0_10px_22px_-10px_rgba(68,49,247,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <span>View Passport</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </section>

            {/* All 6 Tiers */}
            <section className="space-y-3">
              <h3 className={cn('text-xs font-extrabold uppercase tracking-widest px-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                The 6 Sovereign Citizenship Tiers
              </h3>
              <div className="space-y-2.5">
                {CITIZEN_TIERS.map((tier) => {
                  const isReached =
                    currentLevel !== null &&
                    activeDays !== null &&
                    currentLevel >= tier.minLevel &&
                    activeDays >= tier.minDays;
                  return (
                    <div
                      key={tier.tier}
                      className={cn(
                        'p-4 rounded-2xl border flex items-start justify-between gap-3',
                        glassCard,
                        isReached ? (isDark ? 'border-cyan-400/25' : 'border-cyan-200') : 'opacity-70'
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                          isReached
                            ? isDark ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                            : isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        )}>
                          <CitizenTierIcon tier={tier.tier} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm">{tier.tier}</span>
                            <span className={cn('text-[10px] font-mono font-bold', isDark ? 'text-cyan-300' : 'text-cyan-700')}>
                              Level {tier.minLevel} • {tier.minDays} Active Days
                            </span>
                          </div>
                          <p className={cn('text-xs mt-1 leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
                            {tier.description}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 mt-1">
                        {isReached ? (
                          <CheckCircle2 className={cn('w-4 h-4', isDark ? 'text-cyan-300' : 'text-cyan-600')} aria-hidden="true" />
                        ) : (
                          <Lock className={cn('w-3.5 h-3.5', isDark ? 'text-slate-500' : 'text-slate-400')} aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: ROYAL FAMILY */}
        {activeTab === 'royals' && (
          <div className="space-y-5">
            <section className={cn('p-5 rounded-3xl border flex items-start justify-between gap-4', glassCard, isDark ? 'border-amber-400/25' : 'border-amber-300/80')}>
              <div className="space-y-1.5">
                <span className={cn('text-[10px] uppercase font-bold tracking-widest block font-mono', isDark ? 'text-amber-300' : 'text-amber-700')}>
                  Institutional Sovereignty
                </span>
                <h2 className="text-base sm:text-lg font-black">The Arvdoul Royal Family System</h2>
                <p className={cn('text-xs leading-relaxed max-w-2xl', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  Royal titles are earned through multi-dimensional mastery across civic longevity, reputation, ecosystem contribution, influence, and verified community trust.
                </p>
              </div>
              <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0', isDark ? 'bg-amber-500/15 border-amber-400/35 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-600')}>
                <Crown className="w-6 h-6" aria-hidden="true" />
              </div>
            </section>

            {/* Duke / Duchess */}
            <section className={cn('p-5 rounded-2xl border space-y-4', glassCard, dukeEligibility.eligible && (isDark ? 'border-purple-400/35' : 'border-purple-300'))}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700')}>
                    <Crown className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">Duke / Duchess of Arvdoul</h3>
                    <span className={cn('text-[11px] font-mono font-bold', isDark ? 'text-purple-300' : 'text-purple-700')}>
                      Level {ROYAL_ELIGIBILITY.duke.minLevel}+ • Sovereign Noble Standing
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs font-bold px-3 py-1 rounded-full border',
                    dukeEligibility.eligible
                      ? isDark
                        ? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
                        : 'bg-purple-100 text-purple-800 border-purple-300'
                      : isDark
                        ? 'bg-white/[0.04] text-slate-300 border-white/[0.10]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  {dukeEligibility.eligible ? 'Eligible / Active' : 'In Progress'}
                </span>
              </div>

              <ul className={cn('text-xs space-y-1.5', isDark ? 'text-slate-300' : 'text-slate-600')}>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
                  <span><strong>Royal Family badge</strong> presented on your profile identity header.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
                  <span><strong>Duke / Duchess title</strong> displayed across civic surfaces.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
                  <span><strong>Royal standing</strong> recorded on your official Digital Passport.</span>
                </li>
              </ul>

              <RoyalEligibilityChecklist
                rule={ROYAL_ELIGIBILITY.duke}
                level={currentLevel}
                activeDays={activeDays}
                reputation={reputation}
                contribution={contribution}
                influence={influence}
                achievements={achievements}
                isDark={isDark}
              />
            </section>

            {/* King / Queen */}
            <section className={cn('p-5 rounded-2xl border space-y-4', glassCard, kingEligibility.eligible && (isDark ? 'border-amber-400/35' : 'border-amber-300'))}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700')}>
                    <Crown className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">King / Queen of Arvdoul</h3>
                    <span className={cn('text-[11px] font-mono font-bold', isDark ? 'text-amber-300' : 'text-amber-700')}>
                      Level {ROYAL_ELIGIBILITY.king.minLevel}+ • Supreme Sovereign Monarch
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs font-bold px-3 py-1 rounded-full border',
                    kingEligibility.eligible
                      ? isDark
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                      : isDark
                        ? 'bg-white/[0.04] text-slate-300 border-white/[0.10]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  {kingEligibility.eligible ? 'Eligible / Monarch' : 'In Progress'}
                </span>
              </div>

              <ul className={cn('text-xs space-y-1.5', isDark ? 'text-slate-300' : 'text-slate-600')}>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span><strong>King / Queen title</strong> presented on your profile across the platform.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span><strong>Supreme Sovereign standing</strong> recorded in your Digital Passport.</span>
                </li>
              </ul>

              <RoyalEligibilityChecklist
                rule={ROYAL_ELIGIBILITY.king}
                level={currentLevel}
                activeDays={activeDays}
                reputation={reputation}
                contribution={contribution}
                influence={influence}
                achievements={achievements}
                isDark={isDark}
              />
            </section>

            {isOwner && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/titles')}
                  style={{ background: BRAND_GRADIENT }}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-[0_10px_22px_-10px_rgba(68,49,247,0.7)] hover:brightness-110 transition-all"
                >
                  <Crown className="w-4 h-4" aria-hidden="true" />
                  <span>Claim &amp; Manage Royal Titles</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
