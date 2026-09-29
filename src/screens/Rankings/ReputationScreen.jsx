// src/screens/Rankings/ReputationScreen.jsx — ARVDOUL REPUTATION & CIVIC TRUST (Part 2)
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
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await reputationService.getReputationProfile(userId);
      setProfile(data);
    } catch (err) {
      toast.error('Failed to load reputation profile');
      setProfile(null);
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

  // Canonical dimensions only. A dimension the reputation domain has no score
  // for is reported as not yet established - never a fabricated 50/20/25.
  const rep = profile?.reputation || null;
  const inf = profile?.influence || null;
  const con = profile?.contribution || null;

  if (!rep && !inf && !con) {
    return (
      <div className={`min-h-screen pb-24 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 flex items-center space-x-3 ${
          isDark ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-200'
        }`}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Trust &amp; Standing</h1>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
          <ShieldCheck className={`w-10 h-10 mx-auto ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <h2 className="text-base font-bold">No standing recorded yet</h2>
          <p className="text-sm text-gray-500">
            This citizen has no reputation, influence or contribution standing on record.
          </p>
        </main>
      </div>
    );
  }

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
        {rep && (
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
                  {rep.band} Standing
                </h2>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">{rep.score}</span>
              <span className="text-xs text-gray-500 block">/ 100</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, rep.score))}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {rep.description || 'Grounded in civility, verified authenticity and constructive participation.'}
          </p>
        </section>
        )}

        {/* Dimension 2: Ecosystem Reach (Influence) */}
        {inf && (
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
                  Reach &amp; Authority
                </span>
                <h2 id="influence-heading" className="text-xl font-bold mt-0.5">
                  {inf.band} Influence
                </h2>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-purple-400">{inf.score}</span>
              <span className="text-xs text-gray-500 block">Score</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Measures constructive reach, engagement depth, and authentic discussion propagation across the network.
          </p>
        </section>
        )}

        {/* Dimension 3: Ecosystem Contribution */}
        {con && (
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
                  {con.band} Tier
                </h2>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-teal-400">{con.score}</span>
              <span className="text-xs text-gray-500 block">Contribution</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Synthesizes publication velocity, community moderation participation, and patronage within Arvdoul.
          </p>
        </section>
        )}
      </main>
    </div>
  );
}
