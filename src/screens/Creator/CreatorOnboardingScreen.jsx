// src/screens/Creator/CreatorOnboardingScreen.jsx — ARVDOUL CREATOR ONBOARDING (Part 2)
// Gate check (Level >= 5, good standing), category selection, server submission.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import creatorService from '../../services/creatorService';
import { LEVEL_GATES } from '../../services/levelSystemService';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  Shield,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'Art & Visual Design',
  'Software & Engineering',
  'Writing & Journalism',
  'Music & Audio Production',
  'Civic Leadership & Debate',
  'Gaming & Entertainment',
  'Education & Mentorship',
  'General Creation',
];

export default function CreatorOnboardingScreen() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'midnight';
  const userLevel = Number(user?.level) || 1;
  const isEligible = userLevel >= LEVEL_GATES.creatorProfile && (!user?.policyStanding || user?.policyStanding === 'good');

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState(['']);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddLink = () => {
    if (links.length < 3) setLinks([...links, '']);
  };

  const handleLinkChange = (index, value) => {
    const updated = [...links];
    updated[index] = value;
    setLinks(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEligible) {
      toast.error(`Requires Level ${LEVEL_GATES.creatorProfile} to apply.`);
      return;
    }
    if (!bio.trim()) {
      toast.error('Please provide a brief creator summary.');
      return;
    }
    if (!agreed) {
      toast.error('Please agree to the Creator Code of Integrity.');
      return;
    }

    setSubmitting(true);
    try {
      const validLinks = links.filter((l) => l.trim().length > 0);
      await creatorService.applyForCreator({
        category,
        bio: bio.trim(),
        links: validLinks,
      });

      toast.success('Creator status approved! Welcome to the Creator Collective.');
      if (refreshUser) await refreshUser();
      navigate('/creator/dashboard');
    } catch (err) {
      toast.error(err?.message || 'Failed to submit creator application');
    } finally {
      setSubmitting(false);
    }
  };

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
            <h1 className="text-lg font-bold tracking-tight">Creator Accreditation</h1>
            <p className="text-xs text-gray-500">Official Arvdoul Creator Workspace</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Gate Eligibility Notice */}
        {!isEligible ? (
          <div className="p-6 rounded-2xl border border-amber-900/40 bg-amber-950/20 text-center space-y-3">
            <Lock className="w-8 h-8 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold">Creator Application Locked</h2>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              In accordance with Arvdoul Product Law, creator status requires authenticated platform standing.
              You must reach Level {LEVEL_GATES.creatorProfile} (Current: Level {userLevel}) before applying.
            </p>
            <button
              onClick={() => navigate('/progress')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              View Progression Requirements
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Intro Card */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <Sparkles className="w-6 h-6 text-indigo-400" />
                <div>
                  <h2 className="text-base font-bold">You Are Eligible to Create</h2>
                  <p className="text-xs text-gray-400">
                    Qualifying citizen status verified at Level {userLevel}.
                  </p>
                </div>
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Primary Creative Discipline
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition-colors ${
                      category === cat
                        ? 'border-indigo-600 bg-indigo-950/30 text-white'
                        : isDark
                        ? 'border-gray-800 bg-gray-900/40 text-gray-400 hover:border-gray-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Creator Summary Bio */}
            <div className="space-y-2">
              <label htmlFor="creator-bio" className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Creator Summary & Intent
              </label>
              <textarea
                id="creator-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="What kinds of original works will you contribute to Arvdoul?"
                className={`w-full p-3 rounded-xl border text-sm outline-none resize-none ${
                  isDark ? 'bg-gray-900 border-gray-800 text-gray-100 focus:border-indigo-500' : 'bg-white border-gray-200 text-gray-900 focus:border-indigo-500'
                }`}
              />
              <span className="text-[11px] text-gray-500 block text-right">
                {bio.length}/300
              </span>
            </div>

            {/* Portfolio Links */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  External Proof & Portfolios (Optional)
                </label>
                {links.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    + Add Link
                  </button>
                )}
              </div>

              {links.map((link, idx) => (
                <div key={idx} className={`flex items-center px-3 py-2 rounded-xl border ${
                  isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                }`}>
                  <LinkIcon className="w-4 h-4 text-gray-500 mr-2 shrink-0" />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => handleLinkChange(idx, e.target.value)}
                    className="bg-transparent text-sm w-full outline-none"
                  />
                </div>
              ))}
            </div>

            {/* Agreement */}
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/40 space-y-3">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-700 bg-black text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-gray-400 leading-relaxed">
                  I agree to uphold the Arvdoul Creator Code of Integrity. I will publish original, authentic content, respect civic members, and not engage in engagement farming or manipulation.
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating Credentials...</span>
                </>
              ) : (
                <span>Activate Creator Status</span>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
