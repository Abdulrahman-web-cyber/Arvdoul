// src/screens/Rankings/ReputationScreen.jsx
//
// Multidimensional: Trust Standing, Genuine Influence, Civic Contribution.
// WCAG 2.1 AA Compliant, Zero-Pill discipline.

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Award,
  Zap,
  CheckCircle2,
  TrendingUp,
  Share2,
} from 'lucide-react';
import reputationService from '../../services/reputationService.js';
import { toast } from 'sonner';

export default function ReputationScreen() {
  const { theme, isDark } = useTheme();
  const navigate = useNavigate();
  const { userId } = useParams();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchReputation = useCallback(async () => {
    if (!userId) return;
    setLoading(false);
    try {
      const data = await reputationService.getReputationProfile(userId);
      setProfile(data);
    } catch (err) {
      toast.error('Failed to load reputation profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-black text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
            <h1 className="text-lg font-bold tracking-tight">Trust & Standing</h1>
            <p className="text-xs text-gray-500">Multidimensional Civic Standing</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/passport/${userId}`)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          View Passport
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Dimension 1: Trust Standing (Reputation) */}
        <section
          aria-labelledby="trust-heading"
          className={`p-6 rounded-2xl border ${
            isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-emerald-950/40 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                  Trust Dimension
                </span>
                <h2 id="trust-heading" className="text-xl font-bold mt-0.5">
                  {repAvailable ? `${rep.band} Standing` : 'Trust Standing unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right">
              {repAvailable ? (
                <>
                  <span className="text-2xl font-black text-emerald-400">{rep.score}</span>
                  <span className="text-xs text-gray-500 block">/ 100</span>
                </>
              ) : (
                <span className="text-2xl font-black text-gray-500">—</span>
              )}
            </div>
          </div>

          {repAvailable ? (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Current Range: {rep.min}–{rep.max}</span>
                <span>Next: {rep.nextBand || 'Maximum Trust'}</span>
              </div>
              <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, rep.score))}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-gray-500">
              No trust score is recorded for this account yet.
            </p>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Grounded in civility, verified authenticity, zero community safety violations, and peer endorsements.
          </p>
        </section>

        {/* Dimension 2: Ecosystem Reach (Influence) */}
        <section
          aria-labelledby="influence-heading"
          className={`p-6 rounded-2xl border ${
            isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-purple-950/40 text-purple-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Reach & Authority
                </span>
                <h2 id="influence-heading" className="text-xl font-bold mt-0.5">
                  {infAvailable ? `${inf.band} Influence` : 'Influence unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right">
              {infAvailable ? (
                <>
                  <span className="text-2xl font-black text-purple-400">{inf.score}</span>
                  <span className="text-xs text-gray-500 block">Score</span>
                </>
              ) : (
                <span className="text-2xl font-black text-gray-500">—</span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Measures constructive reach, engagement depth, and authentic discussion propagation across the network.
          </p>
        </section>

        {/* Dimension 3: Ecosystem Contribution */}
        <section
          aria-labelledby="contribution-heading"
          className={`p-6 rounded-2xl border ${
            isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-teal-950/40 text-teal-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                  Civic Building
                </span>
                <h2 id="contribution-heading" className="text-xl font-bold mt-0.5">
                  {conAvailable ? `${con.band} Tier` : 'Contribution unavailable'}
                </h2>
              </div>
            </div>
            <div className="text-right">
              {conAvailable ? (
                <>
                  <span className="text-2xl font-black text-teal-400">{con.score}</span>
                  <span className="text-xs text-gray-500 block">Contribution</span>
                </>
              ) : (
                <span className="text-2xl font-black text-gray-500">—</span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Synthesizes publication velocity, community moderation participation, and patronage within Arvdoul.
          </p>
        </section>
      </main>
    </div>
  );
}
