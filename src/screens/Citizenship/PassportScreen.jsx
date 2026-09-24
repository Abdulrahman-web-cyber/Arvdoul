// src/screens/Citizenship/PassportScreen.jsx — ARVDOUL DIGITAL PASSPORT (Part 2)
// Institutional digital-nation identity artifact. Zero-pill, high dignity.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import passportService from '../../services/passportService';
import { shareProfile, getProfileUrl } from '../../utils/shareUtils';
import {
  ArrowLeft,
  ShieldCheck,
  Award,
  Crown,
  Share2,
  QrCode,
  Flame,
  CheckCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PassportScreen() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'midnight';
  const targetUserId = paramUserId || user?.uid;

  const [loading, setLoading] = useState(true);
  const [passport, setPassport] = useState(null);
  const [showQR, setShowQR] = useState(false);

  const loadPassport = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const data = await passportService.getPassport(targetUserId, user?.uid, targetUserId === user?.uid ? user : null);
      setPassport(data);
    } catch (err) {
      toast.error('Could not issue digital passport');
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user]);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  const handleShare = async () => {
    if (!passport) return;
    const res = await shareProfile({
      id: passport.userId,
      username: passport.username,
      displayName: passport.displayName,
    });
    if (res.copied) {
      toast.success('Passport link copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-black text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest">Validating Citizen Credentials...</p>
        </div>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400">Passport record could not be located in the national registry.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
          >
            Go Back
          </button>
        </div>
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
            <h1 className="text-lg font-bold tracking-tight">Digital Passport</h1>
            <p className="text-xs text-gray-500">{passport.citizenId}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQR(true)}
            aria-label="Show QR credentials"
            className={`p-2 rounded-lg border transition-colors ${
              isDark ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            aria-label="Share passport"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* The Institutional Passport Artifact */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden transition-all shadow-2xl ${
            isDark
              ? 'bg-gradient-to-b from-gray-900 via-gray-950 to-black border-indigo-900/40 text-gray-100'
              : 'bg-gradient-to-b from-white via-indigo-50/20 to-white border-indigo-200 text-gray-900'
          }`}
        >
          {/* Passport Watermark Header */}
          <div className="flex items-center justify-between border-b border-indigo-900/30 pb-4">
            <div>
              <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-indigo-400 block">
                ARVDOUL DIGITAL NATION
              </span>
              <span className="text-xs font-mono text-gray-500">
                CITIZEN DOCUMENT · {passport.citizenId}
              </span>
            </div>
            <div className="text-2xl">{passport.citizenTier.icon}</div>
          </div>

          {/* Citizen Identity Section */}
          <div className="mt-6 flex items-start space-x-4">
            <div className="relative">
              {passport.photoURL ? (
                <img
                  src={passport.photoURL}
                  alt={passport.displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/40"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-950 flex items-center justify-center text-xl font-bold text-indigo-300 border-2 border-indigo-500/40">
                  {passport.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              {passport.isVerified && (
                <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-white p-1 rounded-full border border-black">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <h2 className="text-xl font-extrabold truncate">{passport.displayName}</h2>
              </div>
              <p className="text-xs text-gray-400 font-mono">@{passport.username}</p>

              {/* Zero-pill metadata */}
              <div className="mt-2 text-xs text-indigo-400 font-medium flex items-center space-x-1.5">
                <Crown className="w-3.5 h-3.5" />
                <span>{passport.primaryTitle}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">{passport.citizenTier.tier}</span>
              </div>
            </div>
          </div>

          {/* Citizen Metrics Grid */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-black/20 dark:bg-black/40 border border-indigo-900/20 text-center">
            <div>
              <span className="text-xs text-gray-500 block">Level</span>
              <span className="text-lg font-bold text-indigo-400">{passport.level}</span>
              <span className="text-[10px] text-gray-500 block truncate">{passport.rankTitle}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Active Days</span>
              <span className="text-lg font-bold text-emerald-400">{passport.activeDaysCount}</span>
              <span className="text-[10px] text-gray-500 block">{passport.activeStreak} streak</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Issued</span>
              <span className="text-sm font-semibold mt-1 block">{passport.issueDate}</span>
              <span className="text-[10px] text-gray-500 block">National Era</span>
            </div>
          </div>

          {/* Institutional Trust Standing & Bands */}
          <div className="mt-5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 dark:bg-black/30 border border-gray-800/40">
              <span className="text-gray-400">Trust Standing</span>
              <span className="font-semibold text-emerald-400">
                {passport.reputation.band} ({passport.reputation.score}/100)
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 dark:bg-black/30 border border-gray-800/40">
              <span className="text-gray-400">Ecosystem Reach</span>
              <span className="font-semibold text-purple-400">
                {passport.influence.band}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 dark:bg-black/30 border border-gray-800/40">
              <span className="text-gray-400">Civic Contribution</span>
              <span className="font-semibold text-teal-400">
                {passport.contribution.band}
              </span>
            </div>
          </div>

          {/* Verified Achievements Preview */}
          <div className="mt-6 pt-5 border-t border-indigo-900/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Verified Milestones ({passport.achievements.length})
              </span>
              <button
                onClick={() => navigate('/achievements')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center"
              >
                Gallery <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {passport.achievements.slice(0, 6).map((ach) => (
                <div
                  key={ach.id}
                  title={`${ach.title} (${ach.points} pts)`}
                  className="w-10 h-10 rounded-xl bg-black/30 dark:bg-black/50 border border-indigo-900/40 flex items-center justify-center text-lg shrink-0"
                >
                  {ach.icon}
                </div>
              ))}
              {passport.achievements.length === 0 && (
                <span className="text-xs text-gray-500 italic">No public achievements verified yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Direct Links */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/progress')}
            className={`p-4 rounded-2xl border text-left transition-colors ${
              isDark ? 'bg-gray-900/60 border-gray-800 hover:bg-gray-900' : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="text-xs text-gray-500 block">Progression</span>
            <span className="text-sm font-bold mt-0.5 block">Level & XP Track</span>
          </button>

          <button
            onClick={() => navigate('/titles')}
            className={`p-4 rounded-2xl border text-left transition-colors ${
              isDark ? 'bg-gray-900/60 border-gray-800 hover:bg-gray-900' : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="text-xs text-gray-500 block">Civic Honors</span>
            <span className="text-sm font-bold mt-0.5 block">Titles & Standing</span>
          </button>
        </div>
      </main>

      {/* QR Code Presentation Dialog */}
      {showQR && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className={`max-w-sm w-full p-6 rounded-3xl border text-center ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <h3 className="text-base font-bold">Arvdoul Citizen QR</h3>
            <p className="text-xs text-gray-500 mt-1">
              Scan with camera to inspect verified credentials.
            </p>

            <div className="my-6 p-4 bg-white rounded-2xl inline-block shadow-lg">
              {/* Fallback SVG QR pattern representing the unique citizen URL */}
              <div className="w-48 h-48 flex items-center justify-center border-4 border-indigo-600 rounded-xl bg-gray-50 p-2">
                <div className="text-center text-xs text-gray-800 font-mono break-all p-2">
                  <QrCode className="w-20 h-20 mx-auto text-indigo-900 mb-2" />
                  <span>{passport.citizenId}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(passport.passportUrl);
                  toast.success('Passport link copied');
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Citizen Link</span>
              </button>
              <button
                onClick={() => setShowQR(false)}
                className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  isDark ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
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
