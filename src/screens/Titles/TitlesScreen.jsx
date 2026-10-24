// src/screens/Titles/TitlesScreen.jsx
//
// Server-validated, multidimensional criteria, Zero Pay-to-Legitimacy.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import titleService from '../../services/titleService';
import {
  Crown,
  Check,
  Lock,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  X,
  Award,
  Flame,
  CheckCircle2,
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
  const { user, userProfile, refreshUser } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [activating, setActivating] = useState(null);
  const [earnedTitles, setEarnedTitles] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [inspectingTitle, setInspectingTitle] = useState(null);

  const isDark = theme === 'dark' || theme === 'midnight';
  const profile = userProfile || user;

  const catalog = useMemo(() => titleService.getCatalog(), []);

  const loadTitles = useCallback(async () => {
    const uid = profile?.uid || user?.uid;
    if (!uid) return;
    try {
      const items = await titleService.getUserTitles(uid);
      setEarnedTitles(items);
    } catch {
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
    return profile?.activeTitle?.id || (profile?.primaryTitle ? profile.primaryTitle.toLowerCase() : 'resident');
  }, [profile]);

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

  const activeTitleObj = catalog[activeTitleId] || { name: profile?.primaryTitle || 'Resident', icon: '🏛️' };

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6">
        {/* Top Summary Strip */}
        <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Titles & Provenance</span>
              {profile?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500">
              Active: {profile?.primaryTitle || activeTitleObj.name || 'Resident'} · {earnedTitles.length} Earned Titles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/perks')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
            >
              Perks & Rewards
            </button>
            <button
              onClick={() => navigate('/passport')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors cursor-pointer"
            >
              Digital Passport
            </button>
          </div>
        </div>

        {/* Active Title Banner */}
        <section
          aria-labelledby="active-title-heading"
          className={`p-6 rounded-2xl border transition-all ${
            isDark ? 'bg-gradient-to-r from-gray-900 via-indigo-950/40 to-purple-950/30 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Primary Identity Title
              </span>
              <h2 id="active-title-heading" className="text-2xl font-black tracking-tight mt-1 flex items-center space-x-2">
                <span className="text-2xl">{activeTitleObj.icon || '👑'}</span>
                <span>{profile?.primaryTitle || activeTitleObj.name || 'Resident'}</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1 max-w-md">
                This title appears beside your handle across all feeds, spaces, digital passport credentials, and citizen registry artifacts.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">Civic Standing</span>
              <span className="text-sm font-semibold text-emerald-400 flex items-center justify-end gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span>{profile?.isVerified ? 'Verified Sovereign' : 'Citizen Resident'}</span>
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
              className={`text-xs px-3.5 py-2 rounded-xl shrink-0 transition-colors cursor-pointer ${
                selectedDomain === dom.id
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
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
              level: Number(profile?.level) || 1,
              activeDaysCount: Number(profile?.activeDaysCount || profile?.activeDays) || 1,
              contributionScore: Number(profile?.contributionScore || profile?.contribution) || 25,
              reputationScore: Number(profile?.reputationScore || profile?.reputation) || 50,
              influenceScore: Number(profile?.influenceScore || profile?.influence) || 20,
              isCreator: Boolean(profile?.isCreator),
              isVerified: Boolean(profile?.isVerified || profile?.verified),
              isFounder: Boolean(profile?.isFounder),
              isPioneer: Boolean(profile?.isPioneer),
              policyStanding: profile?.policyStanding || 'good',
            });

            return (
              <div
                key={t.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-indigo-950/20 border-indigo-600 shadow-md ring-1 ring-indigo-500/40'
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
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-200 cursor-pointer"
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
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors cursor-pointer"
                    >
                      {activating === t.id ? 'Setting...' : 'Set as Active'}
                    </button>
                  ) : evalResult.eligible ? (
                    <button
                      onClick={() => handleClaim(t.id)}
                      disabled={claiming === t.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      {claiming === t.id ? 'Claiming...' : 'Claim Title'}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{evalResult.reasons[0] || 'Criteria Locked'}</span>
                    </div>
                  )}

                  <span className="text-[11px] text-gray-500 font-mono">
                    {isEarned ? 'Granted' : 'Audited'}
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className={`max-w-md w-full p-6 rounded-2xl border ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="text-4xl">{inspectingTitle.icon}</div>
              <button
                onClick={() => setInspectingTitle(null)}
                aria-label="Close dialog"
                className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 capitalize">
                {inspectingTitle.domain} Domain
              </span>
              <h3 className="text-xl font-bold mt-1">{inspectingTitle.name}</h3>
              <p className="text-sm text-gray-400 mt-2">{inspectingTitle.description}</p>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-black/20 dark:bg-black/40 border border-gray-800/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Multidimensional Rules</span>
                <span className="font-semibold text-indigo-400">Zero Pay-to-Legitimacy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Minimum Level</span>
                <span>Level {inspectingTitle.minLevel || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Provenance Status</span>
                <span className="text-emerald-400 font-mono">Audited & Cryptographically Bound</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setInspectingTitle(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
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
