// src/components/profile/ProfileCitizenshipCard.jsx
//
// Institutional Digital Nation Citizenship Card for Profile embedding.
// Adheres to Zero-Pill discipline, heraldic dignity, and real system telemetry.

import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Crown,
  Award,
  Stamp,
  QrCode,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import passportService from '../../services/passportService';

export const ProfileCitizenshipCard = memo(function ProfileCitizenshipCard({
  userId,
  profile = {},
  isOwner = false,
  theme = 'dark',
  className = '',
}) {
  const navigate = useNavigate();
  const isDark = theme === 'dark' || theme === 'midnight';
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!userId) return;

    passportService.getPassport(userId, isOwner ? userId : null, profile)
      .then((data) => {
        if (mounted) {
          setPassport(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId, isOwner, profile]);

  if (loading) {
    return (
      <div className={cn(
        "p-6 rounded-3xl border animate-pulse",
        isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200",
        className
      )}>
        <div className="h-6 w-48 bg-slate-700/30 rounded mb-4" />
        <div className="h-20 bg-slate-700/20 rounded-2xl mb-4" />
        <div className="h-10 bg-slate-700/20 rounded-xl" />
      </div>
    );
  }

  if (!passport) {
    return null;
  }

  const unlockedStamps = passport.visaStamps?.filter((s) => s.verified) || [];

  return (
    <div className={cn(
      "rounded-3xl border relative overflow-hidden transition-all shadow-xl",
      isDark
        ? "bg-gradient-to-b from-[#090d1e] via-[#050711] to-[#02040a] border-amber-500/30 text-slate-100"
        : "bg-gradient-to-b from-white via-amber-50/20 to-slate-50 border-amber-600/30 text-slate-900",
      className
    )}>
      {/* Decorative Guilloche Border Element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header: National Sovereign Crest & Title */}
      <div className="p-5 sm:p-6 border-b border-amber-500/20 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            🛡️
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-500 dark:text-amber-400 block font-mono">
              Arvdoul Digital Commonwealth
            </span>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Sovereign Citizenship Dossier
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              ID • {passport.citizenId}
            </span>
          </div>
        </div>

        <span className={cn(
          "text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase",
          isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-600/30 bg-amber-50 text-amber-900"
        )}>
          {passport.citizenTier?.tier || 'Resident'}
        </span>
      </div>

      {/* Core Demographic & Civic Metrics */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className={cn(
            "p-3 rounded-2xl border",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
          )}>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Rank Title</span>
            <span className="font-bold text-indigo-400 mt-0.5 block truncate">
              {passport.rankTitle || 'Arrival'}
            </span>
          </div>

          <div className={cn(
            "p-3 rounded-2xl border",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
          )}>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Civic Level</span>
            <span className="font-bold text-amber-400 mt-0.5 block">
              Level {passport.level ?? '—'}
            </span>
          </div>

          <div className={cn(
            "p-3 rounded-2xl border",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
          )}>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Active Days</span>
            <span className="font-bold text-emerald-400 mt-0.5 block">
              {passport.activeDaysCount ?? '—'}
            </span>
          </div>

          <div className={cn(
            "p-3 rounded-2xl border",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
          )}>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Visa Stamps</span>
            <span className="font-bold text-purple-400 mt-0.5 block">
              {unlockedStamps.length} Verified
            </span>
          </div>
        </div>

        {/* Visa Stamps Showcase Strip */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5 text-amber-400" />
              <span>National Visa Seals ({unlockedStamps.length})</span>
            </span>
            <button
              onClick={() => navigate(isOwner ? '/passport' : `/passport/${userId}`)}
              className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-0.5 font-semibold cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {unlockedStamps.map((stamp) => (
              <div
                key={stamp.id}
                title={`${stamp.title} (${stamp.code})`}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl border shrink-0 text-left min-w-[150px]",
                  isDark ? "bg-slate-950/60 border-amber-500/20" : "bg-white border-amber-600/20"
                )}
              >
                <span className="text-xl shrink-0">{stamp.icon}</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono uppercase text-slate-400 block truncate">{stamp.code}</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{stamp.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Call to Action: Full Passport Inspection */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={() => navigate(isOwner ? '/passport' : `/passport/${userId}`)}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Sovereign Passport Booklet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => navigate('/progress')}
            className={cn(
              "w-full sm:w-auto py-3 px-4 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer",
              isDark ? "border-slate-800 hover:bg-slate-900 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
            )}
          >
            <span>Progression Track</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default ProfileCitizenshipCard;
