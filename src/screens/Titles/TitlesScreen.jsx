// src/screens/Titles/TitlesScreen.jsx — ARVDOUL TITLES & PROVENANCE ENGINE (Part 2)
// Server-validated, multidimensional criteria, Zero Pay-to-Legitimacy.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import titleService from '../../services/titleService';
import { Dialog } from '../../components/ui/Dialog';
import {
  ArrowLeft,
  Crown,
  Check,
  Lock,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
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
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const [activating, setActivating] = useState(null);
  const [earnedTitles, setEarnedTitles] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [inspectingTitle, setInspectingTitle] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';

  const catalog = useMemo(() => titleService.getCatalog(), []);

  const loadTitles = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const items = await titleService.getUserTitles(user.uid);
      setEarnedTitles(Array.isArray(items) ? items : []);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load titles');
      toast.error('Failed to load titles');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTitles();
  }, [loadTitles]);

  const earnedMap = useMemo(() => {
    return new Map(earnedTitles.map((t) => [t.id || t.titleId, t]));
  }, [earnedTitles]);

  const activeTitleId = useMemo(() => {
    return user?.activeTitle?.id || (user?.primaryTitle ? user.primaryTitle.toLowerCase() : 'resident');
  }, [user]);

  const handleSetActive = async (titleId) => {
    if (activating) return;
    setActivating(titleId);
    try {
      await titleService.setActiveTitle(titleId);
      toast.success('Active title updated across your identity');
      if (refreshUser) await refreshUser();
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
      toast.success('Title claimed with full provenance!');
      await loadTitles();
      if (refreshUser) await refreshUser();
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

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 flex items-center justify-between ${
        isDark ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Titles & Standing</h1>
            <p className="text-xs text-gray-500">
              Active: {user?.primaryTitle || 'Resident'} · {earnedTitles.length} Earned
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/passport')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Passport
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className={`p-8 rounded-2xl border text-center text-sm ${
              isDark ? 'bg-gray-900/50 border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            Loading your titles…
          </div>
        )}

        {loadError && !loading && (
          <div
            role="alert"
            className={`p-5 rounded-2xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-red-950/30 border-red-900/60 text-red-200' : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span className="text-sm">{loadError}</span>
            <button
              onClick={loadTitles}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
        {/* Active Title Banner */}
        <section
          aria-labelledby="active-title-heading"
          className={`p-6 rounded-2xl border ${
            isDark ? 'bg-gradient-to-r from-gray-900 to-indigo-950/40 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                Primary Identity Title
              </span>
              <h2 id="active-title-heading" className="text-2xl font-bold tracking-tight mt-1 flex items-center space-x-2">
                <Crown className="w-6 h-6 text-amber-400" />
                <span>{user?.primaryTitle || 'Resident'}</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                This title appears beside your name across profiles, comments, and nation artifacts.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">Civic Standing</span>
              <span className="text-sm font-semibold text-emerald-400">
                {user?.isVerified ? 'Verified Citizen' : earnedTitles.length > 0 ? 'Registered Citizen' : 'Unverified'}
              </span>
            </div>
          </div>
        </section>

        {/* Domain Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {DOMAINS.map((dom) => (
            <button
              key={dom.id}
              onClick={() => setSelectedDomain(dom.id)}
              className={`text-xs px-3.5 py-2 rounded-xl shrink-0 transition-colors ${
                selectedDomain === dom.id
                  ? 'bg-indigo-600 text-white font-medium'
                  : isDark
                  ? 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {dom.label}
            </button>
          ))}
        </div>

        {/* Titles Grid */}
        <section aria-label="Titles registry" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {titlesList.map((t) => {
            const isEarned = earnedMap.has(t.id);
            const isActive = activeTitleId === t.id;
            const evalResult = titleService.checkEligibility(t.id, {
              // Only pass authoritative stats; checkEligibility applies its own
              // conservative zeros for absent values (never display defaults).
              level: user?.level ?? null,
              activeDaysCount: user?.activeDaysCount ?? null,
              contributionScore: user?.contributionScore ?? null,
              reputationScore: user?.reputationScore ?? null,
              influenceScore: user?.influenceScore ?? null,
              isCreator: Boolean(user?.isCreator),
              isFounder: Boolean(user?.isFounder),
              isPioneer: Boolean(user?.isPioneer),
            });

            return (
              <div
                key={t.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-indigo-950/20 border-indigo-600 shadow-md'
                      : 'bg-indigo-50/50 border-indigo-400 shadow-sm'
                    : isEarned
                    ? isDark
                      ? 'bg-gray-900/60 border-gray-800'
                      : 'bg-white border-gray-200'
                    : isDark
                    ? 'bg-gray-950/40 border-gray-900 opacity-60'
                    : 'bg-gray-100/60 border-gray-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{t.icon}</span>
                      <div>
                        <h3 className="text-base font-bold flex items-center space-x-1.5">
                          <span>{t.name}</span>
                          {isActive && (
                            <span className="text-[11px] font-semibold text-indigo-400">
                              (Active)
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">{t.domain} Domain</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setInspectingTitle(t)}
                      aria-label="Inspect title details"
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-200"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-3">{t.description}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-800/40 dark:border-gray-800 flex items-center justify-between">
                  {/* Status & Action */}
                  {isActive ? (
                    <span className="text-xs font-semibold text-indigo-400 flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Primary Active Title</span>
                    </span>
                  ) : isEarned ? (
                    <button
                      onClick={() => handleSetActive(t.id)}
                      disabled={activating === t.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                    >
                      {activating === t.id ? 'Setting...' : 'Set as Active'}
                    </button>
                  ) : evalResult.eligible ? (
                    <button
                      onClick={() => handleClaim(t.id)}
                      disabled={claiming === t.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      {claiming === t.id ? 'Claiming...' : 'Claim Title'}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{evalResult.reasons[0] || 'Criteria Locked'}</span>
                    </div>
                  )}

                  <span className="text-[11px] text-gray-500">
                    {isEarned ? 'Granted' : 'Audited'}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
          </>
        )}
      </main>

      {/* Title Details & Provenance Modal — canonical accessible primitives */}
      <Dialog
        isOpen={Boolean(inspectingTitle)}
        onClose={() => setInspectingTitle(null)}
        title={inspectingTitle ? inspectingTitle.name : 'Title details'}
        size="md"
      >
        {inspectingTitle && (
          <div>
            <div className="flex items-start justify-between">
              <div className="text-4xl" aria-hidden="true">{inspectingTitle.icon}</div>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 capitalize">
                {inspectingTitle.domain} Domain
              </span>
              <h3 className="text-xl font-bold mt-1">{inspectingTitle.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{inspectingTitle.description}</p>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Multidimensional Rules</span>
                <span className="font-semibold text-indigo-500 dark:text-indigo-400">Zero Pay-to-Legitimacy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Minimum Level</span>
                <span>
                  {Number.isFinite(Number(inspectingTitle.minLevel))
                    ? `Level ${Number(inspectingTitle.minLevel)}`
                    : 'No level requirement'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setInspectingTitle(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
