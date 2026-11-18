// src/screens/Rankings/ReputationScreen.jsx
//
// Multidimensional: Trust Standing, Genuine Influence, Civic Contribution.
// WCAG 2.1 AA Compliant, Zero-Pill discipline.

import { useState, useEffect, useCallback } from "react";
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Award,
  Zap,
} from 'lucide-react';
import reputationService from '../../services/reputationService.js';
import { getStoredUid } from '../../utils/security.js';
import { ListRowsSkeleton } from '../../components/UI/SkeletonLoaders';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export default function ReputationScreen() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams();

  const targetUserId = userId || user?.uid || getStoredUid();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchReputation = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await reputationService.getReputationProfile(targetUserId);
      setProfile(data);
    } catch {
      toast.error('Failed to load reputation profile');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen p-4',
        isDark ? 'bg-[#03071B] text-slate-400' : 'bg-[#F6F8FC] text-slate-600'
      )}>
        <div className="max-w-2xl mx-auto pt-4">
          <ListRowsSkeleton count={3} />
        </div>
      </div>
    );
  }

  // Real values only; when a dimension is not stored, show an explicit
  // unavailable state instead of a fabricated baseline.
  const rep = profile?.reputation || { score: null, band: null, available: false };
  const inf = profile?.influence || { score: null, band: null, available: false };
  const con = profile?.contribution || { score: null, band: null, available: false };
  const repAvailable = rep.available !== false && rep.score !== null;
  const infAvailable = inf.available !== false && inf.score !== null;
  const conAvailable = con.available !== false && con.score !== null;

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between pb-1 gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Trust &amp; Standing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multidimensional Civic Standing
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(targetUserId ? `/passport/${targetUserId}` : '/passport')}
            className="min-h-[40px] text-xs font-bold px-4 py-2 rounded-xl text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            Digital Passport
          </button>
        </div>

        {/* Dimension 1: Trust Standing (Reputation) */}
        <section
          aria-labelledby="trust-heading"
          className={cn(
            'p-6 rounded-2xl border transition-colors',
            isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'p-3 rounded-xl shrink-0',
                isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              )}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Trust Dimension
                </span>
                <h2 id="trust-heading" className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white truncate">
                  {repAvailable ? `${rep.band} Standing` : 'Trust Standing unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right shrink-0">
              {repAvailable ? (
                <>
                  <span className="text-2xl font-black text-emerald-500 dark:text-emerald-400 tabular-nums">{rep.score}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block tabular-nums">/ 100</span>
                </>
              ) : (
                <span className="text-2xl font-black text-slate-400 dark:text-slate-500">—</span>
              )}
            </div>
          </div>

          {repAvailable ? (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>Current Range: {rep.min}–{rep.max}</span>
                <span>Next: {rep.nextBand || 'Maximum Trust'}</span>
              </div>
              <div className={cn('h-2.5 w-full rounded-full overflow-hidden', isDark ? 'bg-white/[0.08]' : 'bg-slate-200')}>
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, rep.score))}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
              No trust score is recorded for this account yet.
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Grounded in civility, verified authenticity, zero community safety violations, and peer endorsements.
          </p>
        </section>

        {/* Dimension 2: Ecosystem Reach (Influence) */}
        <section
          aria-labelledby="influence-heading"
          className={cn(
            'p-6 rounded-2xl border transition-colors',
            isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'p-3 rounded-xl shrink-0',
                isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'
              )}>
                <Zap className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Reach &amp; Authority
                </span>
                <h2 id="influence-heading" className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white truncate">
                  {infAvailable ? `${inf.band} Influence` : 'Influence unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right shrink-0">
              {infAvailable ? (
                <>
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">{inf.score}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Score</span>
                </>
              ) : (
                <span className="text-2xl font-black text-slate-400 dark:text-slate-500">—</span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Measures constructive reach, engagement depth, and authentic discussion propagation across the network.
          </p>
        </section>

        {/* Dimension 3: Ecosystem Contribution */}
        <section
          aria-labelledby="contribution-heading"
          className={cn(
            'p-6 rounded-2xl border transition-colors',
            isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'p-3 rounded-xl shrink-0',
                isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'
              )}>
                <Award className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Civic Building
                </span>
                <h2 id="contribution-heading" className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white truncate">
                  {conAvailable ? `${con.band} Tier` : 'Contribution unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right shrink-0">
              {conAvailable ? (
                <>
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">{con.score}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Contribution</span>
                </>
              ) : (
                <span className="text-2xl font-black text-slate-400 dark:text-slate-500">—</span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Synthesizes publication velocity, community moderation participation, and patronage within Arvdoul.
          </p>
        </section>
      </main>
    </div>
  );
}
