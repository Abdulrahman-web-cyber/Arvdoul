// src/screens/Citizenship/PassportScreen.jsx
//
// Institutional digital-nation sovereign identity artifact.
// Adheres strictly to Zero-Pill discipline, heraldic dignity, and verified state authority.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import passportService from '../../services/passportService';
import { shareProfile } from '../../utils/shareUtils';
import { generateQrDataUrl } from '../../utils/qrCodeGenerator';
import {
  ShieldCheck,
  Award,
  Crown,
  Share2,
  QrCode,
  CheckCircle,
  Copy,
  ChevronRight,
  Stamp,
  Globe,
  Sparkles,
  ExternalLink,
  Lock,
  UserCheck,
  Check,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Arvdoul Sovereign National Crest
 * Official institutional heraldry of the Arvdoul Digital Commonwealth.
 */
function ArvdoulNationalCrest({ className = 'w-16 h-16', color = 'gold' }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Arvdoul National Crest"
    >
      {/* Outer Radiating Aura */}
      <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" />
      <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
      
      {/* Sovereign Wings / Crest Frame */}
      <path
        d="M24 45C32 38 46 36 60 42C74 36 88 38 96 45C92 65 78 86 60 98C42 86 28 65 24 45Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.75"
      />

      {/* Internal Shield Ribs */}
      <path
        d="M32 48C40 42 52 41 60 45V93C45 82 35 65 32 48Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M88 48C80 42 68 41 60 45V93C75 82 85 65 88 48Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* Sovereign 8-Pointed Star of Arvdoul */}
      <path
        d="M60 22L63.5 32.5L74 34L65 41.5L68 52L60 46L52 52L55 41.5L46 34L56.5 32.5L60 22Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.75"
      />

      {/* Central Pillar of State */}
      <path d="M57 54H63V78H57V54Z" fill="currentColor" opacity="0.8" />
      <circle cx="60" cy="66" r="3" fill="currentColor" />

      {/* Sovereign Crown Above */}
      <path
        d="M44 32L48 24L60 28L72 24L76 32H44Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [activePage, setActivePage] = useState('biometric'); // 'biometric' | 'visas' | 'honors' | 'clearance'
  const [selectedStamp, setSelectedStamp] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

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

  useEffect(() => {
    if (passport?.passportUrl) {
      generateQrDataUrl(passport.passportUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#060816', light: '#ffffff' }
      })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [passport?.passportUrl]);

  const handleShare = async () => {
    if (!passport) return;
    const res = await shareProfile({
      id: passport.userId,
      username: passport.username,
      displayName: passport.displayName,
    });
    if (res.copied) {
      toast.success('Passport credential link copied');
    }
  };

  const handleCopyCitizenId = () => {
    if (!passport?.citizenId) return;
    navigator.clipboard.writeText(passport.citizenId);
    setCopiedId(true);
    toast.success('Citizen ID copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#060816] text-gray-400' : 'bg-slate-50 text-slate-600'}`}>
        <div className="text-center space-y-4">
          <ArvdoulNationalCrest className="w-16 h-16 text-amber-500/80 animate-pulse mx-auto" />
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-amber-400">Arvdoul Sovereign Registry</p>
            <p className="text-[11px] text-gray-500">Decrypting authenticated citizen credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#060816] text-gray-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="text-center space-y-4 max-w-sm">
          <ArvdoulNationalCrest className="w-12 h-12 text-gray-500 mx-auto opacity-50" />
          <h2 className="text-base font-bold">Unregistered Citizen Record</h2>
          <p className="text-xs text-gray-400">The requested credential could not be located in the Arvdoul national registry.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Return to Safety
          </button>
        </div>
      </div>
    );
  }

  const pages = [
    { id: 'biometric', label: 'Biometrics', icon: UserCheck },
    { id: 'visas', label: 'Visa Stamps', icon: Stamp, badge: passport.visaStamps?.filter(s => s.verified).length },
    { id: 'honors', label: 'Civic Honors', icon: Crown },
    { id: 'clearance', label: 'Border Clearance', icon: QrCode },
  ];

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-[#060816] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
        
        {/* Sovereign Credential Header Strip */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <ArvdoulNationalCrest className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-amber-500 dark:text-amber-400 block font-mono">
                Sovereign Digital Commonwealth
              </span>
              <p className="text-xs font-extrabold tracking-tight">ARVDOUL CITIZEN PASSPORT</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQR(true)}
              aria-label="QR Pass"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark ? 'border-slate-800 hover:bg-slate-900 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={handleShare}
              aria-label="Share Passport"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Booklet Page Switcher Strip */}
        <div className={`flex items-center justify-between p-1 rounded-2xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {pages.map((p) => {
            const Icon = p.icon;
            const isActive = activePage === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePage(p.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? (isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-slate-900 text-white shadow-sm')
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{p.label}</span>
                {p.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {p.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* PAGE 1: BIOMETRIC IDENTITY DOCUMENT                                       */}
        {/* ========================================================================= */}
        {activePage === 'biometric' && (
          <div className="space-y-4">
            <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden transition-all shadow-2xl ${
              isDark
                ? 'bg-gradient-to-b from-[#090d1e] via-[#050711] to-[#02040a] border-amber-500/30 text-slate-100'
                : 'bg-gradient-to-b from-white via-amber-50/20 to-slate-50 border-amber-600/30 text-slate-900 shadow-amber-900/5'
            }`}>
              {/* Guilloche & Security Pattern Watermark */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.06] flex items-center justify-center">
                <ArvdoulNationalCrest className="w-96 h-96 text-current" />
              </div>

              {/* Passport Header Banner */}
              <div className="flex items-start justify-between border-b border-amber-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <ArvdoulNationalCrest className="w-12 h-12 text-amber-500 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] tracking-[0.25em] uppercase font-extrabold text-amber-500 dark:text-amber-400 block">
                      Arvdoul Sovereign Nation
                    </span>
                    <h2 className="text-sm font-extrabold font-mono tracking-tight text-slate-800 dark:text-slate-200">
                      PASSEPORT DIPLOMATIQUE / BIOMETRIC PASS
                    </h2>
                    <span className="text-[10px] text-slate-400 font-mono">
                      CIVIL REGISTRY CODE • {passport.citizenId}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border inline-block ${
                    isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-600/30 bg-amber-50 text-amber-900'
                  }`}>
                    {passport.citizenTier?.tier || 'Resident'}
                  </span>
                </div>
              </div>

              {/* Identity & Portrait Layout */}
              <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Security Framed Portrait */}
                <div className="relative shrink-0">
                  <div className={`p-1.5 rounded-2xl border-2 ${
                    isDark ? 'border-amber-500/40 bg-slate-950' : 'border-amber-600/40 bg-white'
                  }`}>
                    {passport.photoURL ? (
                      <img
                        src={passport.photoURL}
                        alt={passport.displayName || 'Citizen'}
                        className="w-28 h-32 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-28 h-32 rounded-xl bg-slate-900 flex items-center justify-center text-2xl font-bold text-amber-400 font-mono">
                        {(passport.displayName || 'AR').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Hologram Shield */}
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-tr from-amber-600 to-indigo-600 text-white p-1.5 rounded-xl shadow-lg border border-black/40">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                {/* Structured Identity Fields */}
                <div className="flex-1 w-full space-y-3 text-left">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Citizen Holder Name</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{passport.displayName || 'Citizen Holder'}</span>
                      {passport.isVerified && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </h3>
                    <p className="text-xs text-amber-500 dark:text-amber-400 font-mono">
                      {passport.username ? `@${passport.username}` : 'State Resident'}
                    </p>
                  </div>

                  {/* Micro Demographic Credentials Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Diplomatic Tier</span>
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" />
                        {passport.citizenTier?.tier || 'Platform Resident'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Civic Rank</span>
                      <span className="font-bold text-indigo-400">
                        {passport.rankTitle || 'Arrival'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">National Status</span>
                      <span className="font-bold text-emerald-400">
                        Active Citizen
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Issuance Epoch</span>
                      <span className="font-bold">
                        {passport.issueDate || 'Genesis Era'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Citizen Metrics Strip */}
              <div className={`mt-6 grid grid-cols-3 gap-2.5 p-3 rounded-2xl border text-center ${
                isDark ? 'bg-black/30 border-slate-800/80' : 'bg-slate-100/60 border-slate-200'
              }`}>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Progression</span>
                  <span className="text-base font-bold text-indigo-400">Level {passport.level ?? '—'}</span>
                  <span className="text-[9px] text-slate-500 block truncate">{passport.rankTitle || 'Registered'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Active Days</span>
                  <span className="text-base font-bold text-emerald-400">{passport.activeDaysCount ?? '—'}</span>
                  <span className="text-[9px] text-slate-500 block">{passport.activeStreak != null ? `${passport.activeStreak}d streak` : 'Perpetual'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Verified Visas</span>
                  <span className="text-base font-bold text-amber-400">{passport.visaStamps?.filter(s => s.verified).length || 0}</span>
                  <span className="text-[9px] text-slate-500 block">Stamped</span>
                </div>
              </div>

              {/* Machine Readable Travel Document (MRTD) Zone */}
              <div className={`mt-6 pt-4 border-t border-amber-500/20 font-mono text-[10px] sm:text-xs leading-relaxed tracking-[0.2em] select-all overflow-x-auto ${
                isDark ? 'text-amber-400/80' : 'text-slate-800'
              }`}>
                <p className="whitespace-pre">{passport.mrtdLines?.[0] || `P<ARV${(passport.username || 'CITIZEN').toUpperCase()}<<<<<<<<<<<<<<<<<<<<<<<<<<`}</p>
                <p className="whitespace-pre">{passport.mrtdLines?.[1] || `${passport.citizenId}5ARV0001014M9912316<<<<<<<<<<<<<<02`}</p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyCitizenId}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId ? 'Citizen ID Copied' : `Copy ID: ${passport.citizenId}`}</span>
              </button>

              <button
                onClick={() => navigate(`/profile/${passport.userId}`)}
                className={`flex items-center gap-1.5 py-3 px-4 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span>Social Profile</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PAGE 2: VISA STAMPS & STATE CLEARANCES                                    */}
        {/* ========================================================================= */}
        {activePage === 'visas' && (
          <div className="space-y-4">
            <div className={`p-5 rounded-3xl border ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Stamp className="w-4 h-4 text-amber-400" />
                    <span>Official Arvdoul Visa Stamps & Attestations</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cryptographically stamped civic clearances and verified milestone seals.
                  </p>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl border ${
                  isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-600/30 bg-amber-50 text-amber-800'
                }`}>
                  {passport.visaStamps?.filter(s => s.verified).length} of {passport.visaStamps?.length} Unlocked
                </span>
              </div>

              {/* Stamps Grid with Tactile Distressed Aesthetic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {passport.visaStamps?.map((stamp) => {
                  const isVerified = stamp.verified;
                  const isSelected = selectedStamp?.id === stamp.id;

                  const colorStyles = {
                    gold: isVerified
                      ? (isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-amber-600/40 bg-amber-50/70 text-amber-900')
                      : 'border-slate-800 opacity-50',
                    emerald: isVerified
                      ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-emerald-600/40 bg-emerald-50/70 text-emerald-900')
                      : 'border-slate-800 opacity-50',
                    indigo: isVerified
                      ? (isDark ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-indigo-600/40 bg-indigo-50/70 text-indigo-900')
                      : 'border-slate-800 opacity-50',
                    amber: isVerified
                      ? (isDark ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-orange-600/40 bg-orange-50/70 text-orange-900')
                      : 'border-slate-800 opacity-50',
                    ruby: isVerified
                      ? (isDark ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-rose-600/40 bg-rose-50/70 text-rose-900')
                      : 'border-slate-800 opacity-50',
                  }[stamp.sealType || 'gold'];

                  return (
                    <div
                      key={stamp.id}
                      onClick={() => setSelectedStamp(stamp)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${colorStyles} ${
                        isSelected ? 'ring-2 ring-amber-400 scale-[1.01]' : 'hover:scale-[1.005]'
                      }`}
                    >
                      {/* Stamp Seal Ribbon */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{stamp.icon}</span>
                          <div>
                            <span className="text-[9px] font-mono uppercase tracking-wider block opacity-70">
                              {stamp.code}
                            </span>
                            <h4 className="text-xs font-black">{stamp.title}</h4>
                          </div>
                        </div>

                        {isVerified ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-current">
                            VERIFIED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            LOCKED
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] mt-2.5 opacity-80 leading-relaxed">
                        {stamp.description}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-current/20 flex items-center justify-between text-[10px] font-mono opacity-70">
                        <span>{stamp.ministry}</span>
                        <span>{stamp.issuedAt || 'Pending'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PAGE 3: CIVIC HONORS & ROYAL ELIGIBILITY                                  */}
        {/* ========================================================================= */}
        {activePage === 'honors' && (
          <div className="space-y-4">
            {/* Royal Standing Matrix */}
            <div className={`p-5 rounded-3xl border ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold">Arvdoul Peerage & Royal Standing</h3>
                    <p className="text-xs text-slate-500">
                      Constitutional eligibility for high governance and royal titles.
                    </p>
                  </div>
                </div>
                {passport.royalEligibility?.isPeerOfRealm ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500 text-amber-400 bg-amber-500/10 font-bold">
                    PEER OF THE REALM
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400">
                    COMMONWEALTH CITIZEN
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Duke Candidacy */}
                <div className={`p-4 rounded-2xl border ${
                  passport.royalEligibility?.duke?.eligible
                    ? (isDark ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-600/40 bg-amber-50')
                    : (isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50')
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Ducal Candidacy (Duke)</span>
                    <span className="text-[10px] font-mono">
                      {passport.royalEligibility?.duke?.eligible ? '✅ ELIGIBLE' : 'REQUIREMENTS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requires Level 70, 180 Active Days, 85 Reputation, and 10 Verified Achievements.
                  </p>
                  {passport.royalEligibility?.duke?.missing?.length > 0 && (
                    <div className="mt-2 text-[10px] font-mono text-amber-500/80">
                      Missing: {passport.royalEligibility.duke.missing.join(', ')}
                    </div>
                  )}
                </div>

                {/* King / Monarch Candidacy */}
                <div className={`p-4 rounded-2xl border ${
                  passport.royalEligibility?.king?.eligible
                    ? (isDark ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-600/40 bg-amber-50')
                    : (isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50')
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Royal Crown (King)</span>
                    <span className="text-[10px] font-mono">
                      {passport.royalEligibility?.king?.eligible ? '👑 SOVEREIGN' : 'REQUIREMENTS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requires Level 90, 365 Active Days, 95 Reputation, and 25 Verified Achievements.
                  </p>
                  {passport.royalEligibility?.king?.missing?.length > 0 && (
                    <div className="mt-2 text-[10px] font-mono text-amber-500/80">
                      Missing: {passport.royalEligibility.king.missing.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Standing Dimensions (Reputation, Reach, Civic Contribution) */}
            <div className={`p-5 rounded-3xl border space-y-3 ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Verified Civic Standing Dimensions</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-slate-400">Trust & Policy Standing</span>
                  <span className="font-bold text-emerald-400">
                    {passport.reputation?.available
                      ? `${passport.reputation.band} (${passport.reputation.score}/100)`
                      : 'Unavailable'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-slate-400">Ecosystem Reach & Influence</span>
                  <span className="font-bold text-purple-400">
                    {passport.influence?.available ? passport.influence.band : 'Unavailable'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-slate-400">Civic & Community Contribution</span>
                  <span className="font-bold text-teal-400">
                    {passport.contribution?.available ? passport.contribution.band : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verified Achievements & Titles */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/titles')}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs text-slate-500 block">Civic Titles</span>
                <span className="text-sm font-bold mt-0.5 block flex items-center justify-between">
                  <span>Manage Titles</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </button>

              <button
                onClick={() => navigate('/progress')}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs text-slate-500 block">State Honors</span>
                <span className="text-sm font-bold mt-0.5 block flex items-center justify-between">
                  <span>XP & Rank Roadmap</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PAGE 4: BORDER CLEARANCE & CRYPTOGRAPHIC QR                               */}
        {/* ========================================================================= */}
        {activePage === 'clearance' && (
          <div className="space-y-4">
            <div className={`p-6 sm:p-8 rounded-3xl border text-center relative overflow-hidden ${
              isDark ? 'bg-slate-900/40 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="max-w-xs mx-auto space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-emerald-400 block font-mono">
                    Border Verification Pass
                  </span>
                  <h3 className="text-lg font-black mt-1">Instant State Attestation</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Present this cryptographic pass at physical border points or for peer citizen attestation.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl border-4 border-emerald-500/30">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Citizen QR Pass for ${passport.displayName}`}
                      className="w-56 h-56 rounded-2xl object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-slate-50 rounded-2xl">
                      <QrCode className="w-20 h-20 text-slate-800" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <div className={`p-3 rounded-xl border font-mono text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Citizen Registration Hash</span>
                    <span className="font-bold text-amber-400">{passport.citizenId}</span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(passport.passportUrl);
                      toast.success('Passport link copied');
                    }}
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Verification URL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* QR Code Presentation Dialog */}
      {showQR && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            className={`max-w-sm w-full p-6 rounded-3xl border text-center shadow-2xl ${
              isDark ? 'bg-[#090d1e] border-amber-500/30 text-slate-100' : 'bg-white border-amber-600/30 text-slate-900'
            }`}
          >
            <ArvdoulNationalCrest className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h3 className="text-base font-bold">Arvdoul Sovereign QR</h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {passport.citizenId}
            </p>

            <div className="my-5 p-4 bg-white rounded-2xl inline-block shadow-lg">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`Citizen QR for ${passport.displayName}`}
                  className="w-48 h-48 rounded-xl object-contain"
                />
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(passport.passportUrl);
                  toast.success('Passport link copied');
                }}
                className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Citizen Link</span>
              </button>
              <button
                onClick={() => setShowQR(false)}
                className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
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
