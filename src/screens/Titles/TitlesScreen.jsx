// src/screens/Titles/TitlesScreen.jsx
//
// Server-validated, multidimensional criteria, Zero Pay-to-Legitimacy.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import titleService from '../../services/titleService';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { TitleIcon } from '../../components/Shared/ProgressionIcons.jsx';
import { cn } from '../../lib/utils';
import { Check, Lock, Info, ShieldCheck, X, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from 'sonner';

const DOMAINS = [
  { id: 'all', label: 'All Titles' },
  { id: 'civic', label: 'Civic & Ceremonial' },
  { id: 'creation', label: 'Creation' },
  { id: 'community', label: 'Community' },
  { id: 'historical', label: 'Historical' },
];

export default function TitlesScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const [activating, setActivating] = useState(null);
  const [earnedTitles, setEarnedTitles] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [inspectingTitle, setInspectingTitle] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';
  const profile = userProfile || user;

  // The active title is read from the profile document, so after a claim /
  // activation we must re-pull it. AuthContext exposes no `refreshUser`; the
  // canonical refresh is the profile store (`refreshProfile`), which the
  // users/{uid} snapshot listener is already streaming into.
  const refreshProfile = useCallback(async () => {
    const uid = profile?.uid || user?.uid;
    if (!uid) return;
    try {
      const { useProfileStore } = await import('../../store/profileStore.js');
      await useProfileStore.getState().refreshProfile(uid, uid);
    } catch (e) {
      /* best-effort refresh; the realtime listener will reconcile */
      console.warn('Title badge profile refresh failed', e?.message);
    }
  }, [profile, user]);

  const catalog = useMemo(() => titleService.getCatalog(), []);

  const loadTitles = useCallback(async () => {
    const uid = profile?.uid || user?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const items = await titleService.getUserTitles(uid);
      setEarnedTitles(items);
    } catch {
      setLoadError('Failed to load earned titles.');
      toast.error('Failed to load titles');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    loadTitles();
  }, [loadTitles]);

  const earnedMap = useMemo(() => {
    return new Map(earnedTitles.map((t) => [t.id || t.titleId, t]));
  }, [earnedTitles]);

  const activeTitleId = useMemo(() => {
    return profile?.activeTitle?.id || (profile?.primaryTitle ? profile.primaryTitle.toLowerCase() : null);
  }, [profile]);

  const handleSetActive = async (titleId) => {
    if (activating) return;
    setActivating(titleId);
    try {
      await titleService.setActiveTitle(titleId);
      toast.success('Active title updated across your identity');
      await refreshProfile();
    } catch (err) {
      toast.error(err?.message || 'Could not update active title');
    } finally {
      setActivating(null);
    }
  };

  const handleClaim = async (titleId) => {
    if (claiming) return;
    setClaiming(titleId);
    try {
      await titleService.claimTitle(titleId);
      toast.success('Title claimed!');
      await loadTitles();
      await refreshProfile();
    } catch (err) {
      toast.error(err?.message || 'Criteria not met for this title');
    } finally {
      setClaiming(null);
    }
  };

  const titlesList = useMemo(() => {
    return Object.values(catalog).filter((t) => {
      if (selectedDomain !== 'all' && t.domain !== selectedDomain) return false;
      return true;
    });
  }, [catalog, selectedDomain]);

  // The active title is only what the profile actually holds. A user with no
  // granted title renders the honest empty state rather than the Level-1
  // 'Resident' standing the platform has not yet granted them.
  const activeTitleObj = profile?.primaryTitle
    ? (catalog[activeTitleId] || { name: profile.primaryTitle, icon: null })
    : null;

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen pb-24 flex items-center justify-center',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" aria-label="Loading titles" />
      </div>
    );
  }

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6">
        {/* Top Summary Strip */}
        <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Titles &amp; Provenance</span>
              {profile?.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" aria-label="Verified" />
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              Active: {profile?.primaryTitle || activeTitleObj?.name || '—'} · {earnedTitles.length} Earned Titles
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/perks')}
              className={cn(
                'min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0',
                isDark
                  ? 'bg-[#080F2E] border-white/[0.1] text-slate-200 hover:bg-white/[0.06]'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              )}
            >
              Perks &amp; Rewards
            </button>
            <button
              type="button"
              onClick={() => navigate('/passport')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: BRAND_GRADIENT }}
            >
              Digital Passport
            </button>
          </div>
        </div>

        {loadError && (
          <div className={cn('p-4 rounded-2xl border flex items-center justify-between gap-3', isDark ? 'bg-rose-500/10 border-rose-400/25 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-700')}>
            <span className="text-xs font-semibold">{loadError}</span>
            <button
              type="button"
              onClick={loadTitles}
              className={cn('min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer', isDark ? 'border-white/15 bg-white/10 text-white' : 'border-rose-200 bg-white text-rose-700')}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Active Title Banner */}
        <section
          aria-labelledby="active-title-heading"
          className={cn(
            'p-6 rounded-2xl border transition-all backdrop-blur-xl',
            isDark
              ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_12px_32px_rgba(2,4,16,0.45)]'
              : 'bg-white/90 border-slate-200/90 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
                Primary Identity Title
              </span>
              <h2 id="active-title-heading" className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2.5 text-slate-900 dark:text-white">
                {activeTitleObj && (
                  <span className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700')}>
                    <TitleIcon titleId={activeTitleId || activeTitleObj?.id} domain={activeTitleObj?.domain} className="w-5 h-5" />
                  </span>
                )}
                <span>{profile?.primaryTitle || activeTitleObj?.name || '—'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
                This title appears beside your handle across all feeds, spaces, digital passport credentials, and citizen registry artifacts.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Civic Standing</span>
              <span className={cn(
                'text-sm font-semibold flex items-center justify-end gap-1.5 mt-0.5',
                profile?.isVerified ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
              )}>
                <ShieldCheck className="w-4 h-4" />
                <span>{profile?.isVerified ? 'Verified' : 'Unverified'}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Domain Underline Tabs */}
        <div
          role="tablist"
          aria-label="Title domains"
          className={cn(
            'flex items-center gap-1 overflow-x-auto no-scrollbar border-b',
            isDark ? 'border-white/[0.08]' : 'border-slate-200'
          )}
        >
          {DOMAINS.map((dom) => {
            const isSelected = selectedDomain === dom.id;
            return (
              <button
                key={dom.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDomain(dom.id)}
                className={cn(
                  'relative min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                  isSelected
                    ? 'text-slate-900 dark:text-white font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                {dom.label}
                {isSelected && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ background: BRAND_GRADIENT }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Titles Grid */}
        <section aria-label="Titles registry" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {titlesList.map((t) => {
            const isEarned = earnedMap.has(t.id);
            const isActive = activeTitleId === t.id;
            // Pass the real standing through un-invented. Defaulting missing
            // scores to 25/50/20 made a title look claimable when the server
            // (the authority) would reject it; absent standing must read as 0.
            const evalResult = titleService.checkEligibility(t.id, {
              level: profile?.level ?? null,
              activeDaysCount: profile?.activeDaysCount ?? profile?.activeDays ?? null,
              contributionScore: profile?.contributionScore ?? profile?.contribution ?? null,
              reputationScore: profile?.reputationScore ?? profile?.reputation ?? null,
              influenceScore: profile?.influenceScore ?? profile?.influence ?? null,
              isCreator: Boolean(profile?.isCreator),
              isVerified: Boolean(profile?.isVerified || profile?.verified),
              isFounder: Boolean(profile?.isFounder),
              isPioneer: Boolean(profile?.isPioneer),
              policyStanding: profile?.policyStanding || profile?.accountStatus || null,
            });

            return (
              <div
                key={t.id}
                className={cn(
                  'p-5 rounded-2xl border flex flex-col justify-between transition-all',
                  isActive
                    ? isDark
                      ? 'bg-[#0B143D] border-purple-500/60 shadow-md'
                      : 'bg-purple-50/60 border-purple-300 shadow-sm'
                    : isEarned
                    ? isDark
                      ? 'bg-[#080F2E] border-white/[0.08]'
                      : 'bg-white border-slate-200 shadow-sm'
                    : isDark
                    ? 'bg-[#080F2E]/50 border-white/[0.05] opacity-75'
                    : 'bg-slate-100/70 border-slate-200/80 opacity-80'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0',
                        isActive || isEarned
                          ? isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'
                          : isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                      )}>
                        <TitleIcon titleId={t.id} domain={t.domain} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{t.name}</span>
                          {isActive && (
                            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                              · Active
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{t.domain} Domain</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectingTitle(t)}
                      aria-label="Inspect title details"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">{t.description}</p>
                </div>

                <div className={cn(
                  'mt-5 pt-3 border-t flex items-center justify-between gap-2',
                  isDark ? 'border-white/[0.08]' : 'border-slate-200'
                )}>
                  {/* Status & Action */}
                  {isActive ? (
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Primary Active Title</span>
                    </span>
                  ) : isEarned ? (
                    <button
                      type="button"
                      onClick={() => handleSetActive(t.id)}
                      disabled={activating === t.id}
                      className="min-h-[36px] text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/[0.1] dark:hover:bg-white/[0.18] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      {activating === t.id ? 'Setting...' : 'Set as Active'}
                    </button>
                  ) : evalResult.eligible ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(t.id)}
                      disabled={claiming === t.id}
                      className="min-h-[36px] text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      {claiming === t.id ? 'Claiming...' : 'Claim Title'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{evalResult.reasons[0] || 'Criteria Locked'}</span>
                    </div>
                  )}

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                    {isEarned ? 'Granted' : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {/* Title Details & Provenance Modal */}
      {inspectingTitle && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectingTitle(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'max-w-md w-full p-6 rounded-3xl border shadow-2xl',
              isDark ? 'bg-[#080F2E] border-white/[0.1] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-start justify-between">
              <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center', isDark ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700')}>
                <TitleIcon titleId={inspectingTitle.id} domain={inspectingTitle.domain} className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setInspectingTitle(null)}
                aria-label="Close dialog"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 capitalize">
                {inspectingTitle.domain} Domain
              </span>
              <h3 className="text-xl font-bold mt-1">{inspectingTitle.name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{inspectingTitle.description}</p>
            </div>

            <div className={cn(
              'mt-5 p-4 rounded-2xl border space-y-2.5 text-xs',
              isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
            )}>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Multidimensional Rules</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">Zero Pay-to-Legitimacy</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Minimum Level</span>
                <span className="font-medium tabular-nums">
                  {inspectingTitle.minLevel != null ? `Level ${inspectingTitle.minLevel}` : 'No level gate'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Provenance Status</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">Granted from verified milestones</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingTitle(null)}
                className="min-h-[40px] px-5 py-2 rounded-xl text-white text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                style={{ background: BRAND_GRADIENT }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
