// src/screens/Citizenship/PassportScreen.jsx
//
// Institutional digital-nation sovereign identity artifact.
// Adheres strictly to Arvdoul liquid-glass DNA, Zero-Pill discipline, heraldic dignity, and verified state data.

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import passportService from '../../services/passportService';
import { shareProfile, copyToClipboard } from '../../utils/shareUtils';
import { generateQrDataUrl } from '../../utils/qrCodeGenerator';
import {
  ShieldCheck, Award, Crown, Share2, QrCode, CheckCircle, Copy, ChevronRight,
  Stamp, Lock, UserCheck, Check, RefreshCw, Download, AlertCircle, Landmark,
  Swords, Palette, ScrollText, X,
} from "lucide-react";
import { toast } from 'sonner';
import { ROYAL_ELIGIBILITY } from '../../shared/levelConfig.cjs';
import { unknownNumber } from '../../lib/unknownNumber';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { cn } from '../../lib/utils';
import { LazyImage } from '../../components/Shared/LazyImage';

const STAMP_ICONS = {
  landmark: Landmark,
  shield: ShieldCheck,
  sword: Swords,
  palette: Palette,
  scroll: ScrollText,
  crown: Crown,
};

/**
 * Arvdoul Sovereign National Crest
 * Official institutional heraldry of the Arvdoul Digital Commonwealth.
 */
function ArvdoulNationalCrest({ className = 'w-16 h-16' }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Arvdoul National Crest"
    >
      <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" />
      <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
      <path
        d="M24 45C32 38 46 36 60 42C74 36 88 38 96 45C92 65 78 86 60 98C42 86 28 65 24 45Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.75"
      />
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
      <path
        d="M60 22L63.5 32.5L74 34L65 41.5L68 52L60 46L52 52L55 41.5L46 34L56.5 32.5L60 22Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.75"
      />
      <path d="M57 54H63V78H57V54Z" fill="currentColor" opacity="0.8" />
      <circle cx="60" cy="66" r="3" fill="currentColor" />
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
  const { user, userProfile, authInitialized } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'midnight';
  const rawParam = paramUserId ? String(paramUserId).trim() : '';
  const targetUserId = (!rawParam || rawParam.toLowerCase() === 'me')
    ? (user?.uid || null)
    : rawParam.replace(/^@/, '').trim();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [passport, setPassport] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [activePage, setActivePage] = useState('identity'); // 'identity' | 'visas' | 'honors' | 'clearance'
  const [selectedStamp, setSelectedStamp] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadPassport = useCallback(async () => {
    if (!authInitialized) {
      setLoading(true);
      return;
    }
    if (!targetUserId) {
      setPassport(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      // Pass the hydrated `userProfile` (the `users/{uid}` document) as the
      // owner's cache, never the Firebase auth `user` — the auth object has no
      // level, counts or standing, so the owner's own passport would render
      // empty standing while a visitor's rendered correctly.
      const ownerMatches = Boolean(
        user?.uid &&
        userProfile &&
        (targetUserId === user.uid ||
          (userProfile.username && String(userProfile.username).replace(/^@/, '').toLowerCase() === targetUserId.toLowerCase()))
      );
      const ownerCache = ownerMatches ? userProfile : null;
      const resolvedRequestId = ownerMatches ? user.uid : targetUserId;
      const data = await passportService.getPassport(resolvedRequestId, user?.uid || null, ownerCache);
      setPassport(data);
    } catch (err) {
      setLoadError(err?.message || 'Could not load citizen passport');
    } finally {
      setLoading(false);
    }
  }, [authInitialized, targetUserId, user?.uid, userProfile]);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  useEffect(() => {
    let active = true;
    if (!passport?.passportUrl) {
      setQrDataUrl('');
      return undefined;
    }
    generateQrDataUrl(passport.passportUrl, {
      width: 360,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#060816', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((e) => {
        console.warn('Passport QR generation failed', e?.message);
      });
    return () => {
      active = false;
    };
  }, [passport?.passportUrl]);

  useEffect(() => {
    if (!showQR) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowQR(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showQR]);

  const handleShare = async () => {
    if (!passport) return;
    try {
      const res = await shareProfile({
        id: passport.userId,
        username: passport.username,
        displayName: passport.displayName,
      });
      if (res.copied) {
        toast.success('Passport credential link copied');
      }
    } catch {
      toast.error('Could not copy passport link');
    }
  };

  const handleCopyCitizenId = async () => {
    if (!passport?.citizenId) return;
    try {
      await copyToClipboard(passport.citizenId);
      setCopiedId(true);
      toast.success('Citizen ID copied');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error('Failed to copy Citizen ID');
    }
  };

  const handleCopyPassportUrl = async () => {
    if (!passport?.passportUrl) return;
    try {
      await copyToClipboard(passport.passportUrl);
      toast.success('Passport link copied');
    } catch {
      toast.error('Failed to copy passport link');
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) {
      toast.error('QR code is still rendering');
      return;
    }
    const safeId = String(passport?.username || passport?.citizenId || 'arvdoul-passport').replace(/[^a-zA-Z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.download = `${safeId}-arvdoul-passport-qr.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Passport QR saved');
  };

  const glassCard = isDark
    ? 'bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_36px_rgba(3,7,27,0.45)]'
    : 'bg-white/95 backdrop-blur-xl border-slate-200/80 shadow-[0_8px_28px_rgba(15,23,42,0.06)]';

  const glassSubCard = isDark
    ? 'bg-white/[0.03] border-white/[0.08]'
    : 'bg-slate-50/85 border-slate-200/80';

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark ? 'bg-[#03071B] text-slate-400' : 'bg-[#F6F8FC] text-slate-600'
      )}>
        <div className="text-center space-y-4">
          <ArvdoulNationalCrest className="w-16 h-16 text-amber-500/80 mx-auto animate-pulse" />
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-amber-500 dark:text-amber-400">
              Arvdoul Sovereign Registry
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Loading authenticated citizen credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <div className={cn('text-center space-y-4 max-w-sm w-full p-6 rounded-3xl border', glassCard)}>
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" aria-hidden="true" />
          <h2 className="text-base font-bold">Could Not Issue Digital Passport</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The national registry encountered an issue loading this record. Please try again.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={loadPassport}
              className="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-bold text-white cursor-pointer flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all"
              style={{ background: BRAND_GRADIENT }}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={cn(
                'min-h-[42px] px-4 py-2 rounded-2xl border text-xs font-semibold cursor-pointer transition-colors',
                isDark ? 'border-white/[0.1] hover:bg-white/[0.06] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              )}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!targetUserId) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <div className={cn('text-center space-y-4 max-w-sm w-full p-6 rounded-3xl border', glassCard)}>
          <Lock className="w-10 h-10 text-amber-500 mx-auto" aria-hidden="true" />
          <h2 className="text-base font-bold">Sign In to View Your Passport</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Access your Arvdoul sovereign citizenship record, visa seals, and border pass by signing in.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="min-h-[42px] px-5 py-2 rounded-2xl text-xs font-bold text-white cursor-pointer shadow-md hover:brightness-110 transition-all"
            style={{ background: BRAND_GRADIENT }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!passport || passport.profileFound === false) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <div className={cn('text-center space-y-4 max-w-sm w-full p-6 rounded-3xl border', glassCard)}>
          <ArvdoulNationalCrest className="w-12 h-12 text-slate-500 mx-auto opacity-60" />
          <h2 className="text-base font-bold">Unregistered Citizen Record</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The requested credential could not be located in the Arvdoul national registry.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            Return to Safety
          </button>
        </div>
      </div>
    );
  }

  const verifiedVisaCount = Array.isArray(passport.visaStamps)
    ? passport.visaStamps.filter((s) => s.verified).length
    : null;

  const pages = [
    { id: 'identity', label: 'Identity', icon: UserCheck },
    { id: 'visas', label: 'Visa Stamps', icon: Stamp, badge: verifiedVisaCount },
    { id: 'honors', label: 'Civic Honors', icon: Crown },
    { id: 'clearance', label: 'Border Clearance', icon: QrCode },
  ];

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
        {/* Sovereign Credential Header Strip */}
        <div className={cn('p-3.5 sm:p-4 rounded-3xl border flex items-center justify-between gap-3', glassCard)}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0',
              isDark ? 'bg-amber-500/10 border-amber-400/25 text-amber-400' : 'bg-amber-50 border-amber-500/25 text-amber-600'
            )}>
              <ArvdoulNationalCrest className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-amber-500 dark:text-amber-400 block font-mono truncate">
                Sovereign Digital Commonwealth
              </span>
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight truncate">
                ARVDOUL CITIZEN PASSPORT
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQR(true)}
              aria-label="QR Pass"
              className={cn(
                'min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-2xl border transition-colors cursor-pointer shrink-0',
                isDark ? 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-slate-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              )}
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share Passport"
              style={{ background: BRAND_GRADIENT }}
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Booklet Section Switcher (Liquid Glass Tab Bar matching ProfileTabsBar DNA) */}
        <div
          role="tablist"
          aria-label="Passport sections"
          className={cn(
            'p-1.5 rounded-2xl border flex items-center gap-1 overflow-x-auto no-scrollbar',
            glassCard
          )}
        >
          {pages.map((p) => {
            const Icon = p.icon;
            const isActive = activePage === p.id;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                key={p.id}
                onClick={() => setActivePage(p.id)}
                className={cn(
                  'relative flex-1 min-h-[42px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0',
                  isActive
                    ? 'text-white font-bold shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
                style={isActive ? { background: BRAND_GRADIENT } : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{p.label}</span>
                {p.badge !== null && p.badge !== undefined && (
                  <span className={cn(
                    'text-[11px] font-mono tabular-nums',
                    isActive ? 'text-white/90' : 'opacity-75'
                  )}>
                    {p.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* PAGE 1: IDENTITY DOCUMENT                                                 */}
        {/* ========================================================================= */}
        {activePage === 'identity' && (
          <div className="space-y-4">
            <div className={cn(
              'p-5 sm:p-7 rounded-3xl border relative overflow-hidden transition-all',
              glassCard,
              isDark ? 'border-amber-400/25' : 'border-amber-600/30'
            )}>
              {/* Brand Top Edge Accent */}
              <div className="absolute top-0 inset-x-0 h-1" style={{ background: BRAND_GRADIENT }} />

              {/* Subtle Security Watermark */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] flex items-center justify-center">
                <ArvdoulNationalCrest className="w-96 h-96 text-current" />
              </div>

              {/* Passport Header Banner */}
              <div className={cn(
                'relative flex items-start justify-between gap-3 border-b pb-4',
                isDark ? 'border-white/[0.08]' : 'border-slate-200'
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <ArvdoulNationalCrest className="w-11 h-11 text-amber-500 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] tracking-[0.22em] uppercase font-extrabold text-amber-500 dark:text-amber-400 block">
                      Arvdoul Sovereign Nation
                    </span>
                    <h2 className="text-xs sm:text-sm font-extrabold font-mono tracking-tight text-slate-800 dark:text-slate-100 truncate">
                      PASSEPORT DIPLOMATIQUE / CITIZEN IDENTITY
                    </h2>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      CIVIL REGISTRY CODE • {passport.citizenId}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={cn(
                    'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-xl border inline-block',
                    isDark ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : 'border-amber-600/30 bg-amber-50 text-amber-900'
                  )}>
                    {passport.citizenTier?.tier || '—'}
                  </span>
                </div>
              </div>

              {/* Identity & Portrait Layout */}
              <div className="relative mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
                {/* Security Framed Portrait */}
                <div className="relative shrink-0">
                  <div className={cn(
                    'p-1.5 rounded-2xl border',
                    isDark ? 'border-amber-400/35 bg-white/[0.03]' : 'border-amber-600/35 bg-white'
                  )}>
                    {passport.photoURL ? (
                      <LazyImage
                        src={passport.photoURL}
                        alt={passport.displayName || '—'}
                        className="w-28 h-32 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="w-28 h-32 rounded-xl flex items-center justify-center text-2xl font-bold text-white font-mono"
                        style={{ background: BRAND_GRADIENT }}
                      >
                        {(passport.displayName || 'AR').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Verification Shield */}
                  <div
                    className="absolute -bottom-2 -right-2 text-white p-1.5 rounded-xl shadow-lg border border-white/25"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>

                {/* Structured Identity Fields */}
                <div className="flex-1 w-full space-y-3 text-left min-w-0">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                      Citizen Holder Name
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span className="truncate">{passport.displayName || '—'}</span>
                      {passport.isVerified && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                      )}
                    </h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-mono truncate">
                      {passport.username ? `@${passport.username}` : '—'}
                    </p>
                  </div>

                  {/* Micro Demographic Credentials Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className={cn('p-2.5 rounded-2xl border', glassSubCard)}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                        Diplomatic Tier
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5 truncate">
                        <Crown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{passport.citizenTier?.tier || '—'}</span>
                      </span>
                    </div>

                    <div className={cn('p-2.5 rounded-2xl border', glassSubCard)}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                        Civic Rank
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                        {passport.rankTitle || '—'}
                      </span>
                    </div>

                    <div className={cn('p-2.5 rounded-2xl border', glassSubCard)}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                        National Status
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                        {passport.accountStatus
                          ? String(passport.accountStatus).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                          : '—'}
                      </span>
                    </div>

                    <div className={cn('p-2.5 rounded-2xl border', glassSubCard)}>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                        Issuance Epoch
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block truncate">
                        {passport.issueDate || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Citizen Metrics Strip */}
              <div className={cn('relative mt-6 grid grid-cols-3 gap-2.5 p-3 rounded-2xl border text-center', glassSubCard)}>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Progression</span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    Level {passport.level ?? '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                    {passport.rankTitle || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Active Days</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {passport.activeDaysCount ?? '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block tabular-nums">
                    {passport.activeStreak != null ? `${passport.activeStreak}d streak` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase">Verified Visas</span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {unknownNumber(verifiedVisaCount) ?? '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Stamped</span>
                </div>
              </div>

              {/* Citizen identity strip (stylised, not an ICAO 9303 MRZ) */}
              <div className={cn(
                'relative mt-5 pt-4 border-t font-mono text-[10px] sm:text-xs leading-relaxed tracking-[0.2em] select-all overflow-x-auto',
                isDark ? 'border-white/[0.08] text-amber-400/85' : 'border-slate-200 text-slate-700'
              )}>
                <p className="whitespace-pre">{passport.identityLines?.[0] || `ARVDOUL<${(passport.username || '').toUpperCase()}`}</p>
                <p className="whitespace-pre">{passport.identityLines?.[1] || passport.citizenId}</p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyCitizenId}
                className={cn(
                  'flex-1 min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-semibold transition-all cursor-pointer',
                  glassCard,
                  isDark ? 'hover:bg-white/[0.05] text-slate-100' : 'hover:bg-slate-50 text-slate-800'
                )}
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId ? 'Citizen ID Copied' : `Copy ID: ${passport.citizenId}`}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/profile/${passport.userId}`)}
                style={{ background: BRAND_GRADIENT }}
                className="min-h-[44px] flex items-center gap-1.5 py-3 px-4 rounded-2xl text-white text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
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
            <div className={cn('p-5 rounded-3xl border', glassCard)}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Stamp className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <span>Official Arvdoul Visa Stamps & Attestations</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Verified civic clearances and milestone seals.
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl border shrink-0',
                  isDark ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : 'border-amber-600/30 bg-amber-50 text-amber-800'
                )}>
                  {Array.isArray(passport.visaStamps)
                    ? `${passport.visaStamps.filter((s) => s.verified).length} of ${passport.visaStamps.length} Unlocked`
                    : '—'}
                </span>
              </div>

              {/* Stamps Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {passport.visaStamps?.map((stamp) => {
                  const isVerified = stamp.verified;
                  const isSelected = selectedStamp?.id === stamp.id;
                  const StampGlyph = STAMP_ICONS[stamp.iconKey] || Stamp;

                  const colorStyles = {
                    gold: isVerified
                      ? (isDark ? 'border-amber-400/35 bg-amber-500/[0.08] text-amber-200' : 'border-amber-500/40 bg-amber-50/70 text-amber-900')
                      : (isDark ? 'border-white/[0.08] bg-white/[0.02] opacity-55' : 'border-slate-200 bg-slate-50 opacity-60'),
                    emerald: isVerified
                      ? (isDark ? 'border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-200' : 'border-emerald-500/40 bg-emerald-50/70 text-emerald-900')
                      : (isDark ? 'border-white/[0.08] bg-white/[0.02] opacity-55' : 'border-slate-200 bg-slate-50 opacity-60'),
                    indigo: isVerified
                      ? (isDark ? 'border-indigo-400/35 bg-indigo-500/[0.08] text-indigo-200' : 'border-indigo-500/40 bg-indigo-50/70 text-indigo-900')
                      : (isDark ? 'border-white/[0.08] bg-white/[0.02] opacity-55' : 'border-slate-200 bg-slate-50 opacity-60'),
                    amber: isVerified
                      ? (isDark ? 'border-orange-400/35 bg-orange-500/[0.08] text-orange-200' : 'border-orange-500/40 bg-orange-50/70 text-orange-900')
                      : (isDark ? 'border-white/[0.08] bg-white/[0.02] opacity-55' : 'border-slate-200 bg-slate-50 opacity-60'),
                    ruby: isVerified
                      ? (isDark ? 'border-rose-400/35 bg-rose-500/[0.08] text-rose-200' : 'border-rose-500/40 bg-rose-50/70 text-rose-900')
                      : (isDark ? 'border-white/[0.08] bg-white/[0.02] opacity-55' : 'border-slate-200 bg-slate-50 opacity-60'),
                  }[stamp.sealType || 'gold'];

                  return (
                    <button
                      type="button"
                      key={stamp.id}
                      onClick={() => setSelectedStamp(stamp)}
                      aria-pressed={isSelected}
                      className={cn(
                        'w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden',
                        colorStyles,
                        isSelected ? 'ring-2 ring-amber-400 scale-[1.01]' : 'hover:scale-[1.005]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={cn(
                            'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0',
                            isDark ? 'border-white/[0.12] bg-white/[0.04]' : 'border-current/20 bg-white/70'
                          )}>
                            <StampGlyph className="w-4 h-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <span className="text-[9px] font-mono uppercase tracking-wider block opacity-70 truncate">
                              {stamp.code}
                            </span>
                            <h4 className="text-xs font-black truncate">{stamp.title}</h4>
                          </div>
                        </div>

                        {isVerified ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border border-current shrink-0">
                            VERIFIED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            <span>LOCKED</span>
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] mt-2.5 opacity-85 leading-relaxed">
                        {stamp.description}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-current/20 flex items-center justify-between text-[10px] font-mono opacity-75">
                        <span className="truncate">{stamp.ministry}</span>
                        <span className="shrink-0">{stamp.issuedAt || (stamp.verified ? '—' : 'Pending')}</span>
                      </div>
                    </button>
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
            <div className={cn('p-5 rounded-3xl border', glassCard)}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Crown className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">Arvdoul Peerage & Royal Standing</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Constitutional eligibility for high governance and royal titles.
                    </p>
                  </div>
                </div>
                {passport.royalEligibility?.isPeerOfRealm ? (
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-xl border border-amber-400/50 text-amber-300 bg-amber-500/10 font-bold shrink-0">
                    PEER OF THE REALM
                  </span>
                ) : (
                  <span className={cn(
                    'text-[10px] font-mono px-2.5 py-1 rounded-xl border shrink-0',
                    isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-300 text-slate-600'
                  )}>
                    COMMONWEALTH HOLDER
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Duke Candidacy */}
                <div className={cn(
                  'p-4 rounded-2xl border',
                  passport.royalEligibility?.duke?.eligible
                    ? (isDark ? 'border-amber-400/40 bg-amber-500/10' : 'border-amber-600/40 bg-amber-50')
                    : glassSubCard
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Ducal Candidacy (Duke)
                    </span>
                    <span className="text-[10px] font-mono flex items-center gap-1 font-semibold">
                      {passport.royalEligibility?.duke?.eligible ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-400">ELIGIBLE</span>
                        </>
                      ) : (
                        <span className="text-slate-400">REQUIREMENTS</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Requires Level {ROYAL_ELIGIBILITY.duke.minLevel}, {ROYAL_ELIGIBILITY.duke.minActiveDays} Active Days, {ROYAL_ELIGIBILITY.duke.minReputation} Reputation, and {ROYAL_ELIGIBILITY.duke.minAchievements} Verified Achievements.
                  </p>
                  {passport.royalEligibility?.duke?.missing?.length > 0 && (
                    <div className="mt-2 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                      Missing: {passport.royalEligibility.duke.missing.join(', ')}
                    </div>
                  )}
                </div>

                {/* King / Monarch Candidacy */}
                <div className={cn(
                  'p-4 rounded-2xl border',
                  passport.royalEligibility?.king?.eligible
                    ? (isDark ? 'border-amber-400/40 bg-amber-500/10' : 'border-amber-600/40 bg-amber-50')
                    : glassSubCard
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Royal Crown (King)
                    </span>
                    <span className="text-[10px] font-mono flex items-center gap-1 font-semibold">
                      {passport.royalEligibility?.king?.eligible ? (
                        <>
                          <Crown className="w-3 h-3 text-amber-400" aria-hidden="true" />
                          <span className="text-amber-400">SOVEREIGN</span>
                        </>
                      ) : (
                        <span className="text-slate-400">REQUIREMENTS</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Requires Level {ROYAL_ELIGIBILITY.king.minLevel}, {ROYAL_ELIGIBILITY.king.minActiveDays} Active Days, {ROYAL_ELIGIBILITY.king.minReputation} Reputation, and {ROYAL_ELIGIBILITY.king.minAchievements} Verified Achievements.
                  </p>
                  {passport.royalEligibility?.king?.missing?.length > 0 && (
                    <div className="mt-2 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                      Missing: {passport.royalEligibility.king.missing.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Standing Dimensions */}
            <div className={cn('p-5 rounded-3xl border space-y-3', glassCard)}>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Verified Civic Standing Dimensions</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className={cn('flex items-center justify-between p-3 rounded-2xl border', glassSubCard)}>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Trust & Policy Standing</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {passport.reputation?.available
                      ? `${passport.reputation.band} (${passport.reputation.score}/100)`
                      : 'Unavailable'}
                  </span>
                </div>

                <div className={cn('flex items-center justify-between p-3 rounded-2xl border', glassSubCard)}>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Ecosystem Reach & Influence</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {passport.influence?.available ? passport.influence.band : 'Unavailable'}
                  </span>
                </div>

                <div className={cn('flex items-center justify-between p-3 rounded-2xl border', glassSubCard)}>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Civic & Community Contribution</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {passport.contribution?.available ? passport.contribution.band : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verified Achievements & Titles */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate('/titles')}
                className={cn(
                  'p-4 rounded-2xl border text-left transition-colors cursor-pointer',
                  glassCard,
                  isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'
                )}
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Civic Titles</span>
                <span className="text-sm font-bold mt-0.5 flex items-center justify-between">
                  <span>Manage Titles</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/progress')}
                className={cn(
                  'p-4 rounded-2xl border text-left transition-colors cursor-pointer',
                  glassCard,
                  isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'
                )}
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 block">State Honors</span>
                <span className="text-sm font-bold mt-0.5 flex items-center justify-between">
                  <span>XP & Rank Roadmap</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PAGE 4: BORDER CLEARANCE & PUBLIC PROFILE QR                              */}
        {/* ========================================================================= */}
        {activePage === 'clearance' && (
          <div className="space-y-4">
            <div className={cn('p-6 sm:p-8 rounded-3xl border text-center relative overflow-hidden', glassCard)}>
              <div className="absolute top-0 inset-x-0 h-1" style={{ background: BRAND_GRADIENT }} />
              <div className="max-w-xs mx-auto space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-emerald-500 dark:text-emerald-400 block font-mono">
                    Border Verification Pass
                  </span>
                  <h3 className="text-lg font-black mt-1">Instant State Attestation</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Present this QR pass to share your public profile and verified milestones.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl border-2 border-white/80">
                  {qrDataUrl ? (
                    <LazyImage
                      src={qrDataUrl}
                      alt={`Citizen QR Pass for ${passport.displayName || passport.citizenId}`}
                      className="w-56 h-56 rounded-2xl object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-slate-50 rounded-2xl">
                      <QrCode className="w-20 h-20 text-slate-800" />
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-2">
                  <div className={cn('p-3 rounded-2xl border font-mono text-xs', glassSubCard)}>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                      Citizen Registration Code
                    </span>
                    <span className="font-bold text-amber-500 dark:text-amber-400">{passport.citizenId}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadQR}
                      className={cn(
                        'min-h-[42px] py-2.5 px-3 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                        isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.1] text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      )}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPassportUrl}
                      style={{ background: BRAND_GRADIENT }}
                      className="min-h-[42px] py-2.5 px-3 rounded-2xl text-white text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy URL</span>
                    </button>
                  </div>
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
          aria-label="Arvdoul Sovereign QR"
          onClick={() => setShowQR(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative max-w-sm w-full p-6 rounded-3xl border text-center shadow-2xl overflow-hidden',
              isDark
                ? 'bg-[#03071B]/90 backdrop-blur-2xl border-white/[0.12] text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="absolute top-0 inset-x-0 h-1" style={{ background: BRAND_GRADIENT }} />
            <button
              type="button"
              onClick={() => setShowQR(false)}
              aria-label="Close QR dialog"
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <ArvdoulNationalCrest className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h3 className="text-base font-bold">Arvdoul Sovereign QR</h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {passport.citizenId}
            </p>

            <div className="my-5 p-4 bg-white rounded-2xl inline-block shadow-lg">
              {qrDataUrl && (
                <LazyImage
                  src={qrDataUrl}
                  alt={`Citizen QR for ${passport.displayName || passport.citizenId}`}
                  className="w-48 h-48 rounded-xl object-contain"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className={cn(
                    'min-h-[40px] py-2.5 rounded-2xl border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                    isDark ? 'border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  )}
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassportUrl}
                  style={{ background: BRAND_GRADIENT }}
                  className="min-h-[40px] py-2.5 rounded-2xl text-white text-xs font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy Link</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className={cn(
                  'w-full min-h-[40px] py-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                  isDark ? 'border-white/[0.1] hover:bg-white/[0.06] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                )}
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
