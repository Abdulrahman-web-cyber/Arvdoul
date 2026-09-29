/**
 * src/components/profile/ProfilePassportCard.jsx
 *
 * Institutional Passport artifact for the Profile. This is *not* a navigation
 * button: it presents the authorized `passportService` projection as a citizen
 * identity record (document number, tier, issue era, trust standing) and then
 * deep-links to the canonical Passport screen for the full record.
 *
 * Ownership: all values come from `passportService.getPassport` via
 * `profileStore.passport`. This component never derives a level, band, or tier.
 * Unknown dimensions render as an honest "unestablished" state.
 *
 * @component
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookUser, ShieldCheck, Crown, CalendarDays, ArrowRight, BadgeCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfilePassportCard = memo(({
  passport = null,
  isOwner = false,
  canView = false,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const targetUid = passport?.userId || null;

  const trustLine = useMemo(() => {
    const rep = passport?.reputation;
    if (!rep) return null;
    return typeof rep.score === 'number' ? `${rep.band} · ${rep.score}/100` : rep.band;
  }, [passport?.reputation]);

  // Fail-closed: without an authorized projection there is nothing to show.
  if (!canView || !passport || !targetUid) return null;

  const tier = passport.citizenTier;
  const openFull = () => navigate(`/passport/${targetUid}`);

  return (
    <section
      aria-label="Arvdoul digital passport"
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border shadow-sm transition-all',
        isDark
          ? 'bg-arvdoul-bg-deep border-white/10 text-white'
          : 'bg-white border-slate-200 text-slate-900',
      )}
    >
      {/* Institutional watermark - restrained, non-interactive */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 opacity-[0.06]"
      >
        <BookUser className="w-48 h-48" />
      </div>

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b pb-3 border-slate-200/70 dark:border-white/10">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
              Arvdoul Digital Nation
            </span>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              CITIZEN DOCUMENT · {passport.citizenId}
            </div>
          </div>
          <div className="text-2xl shrink-0" aria-hidden="true">
            {tier?.icon || '🏛️'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Standing
            </div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {passport.primaryTitle || passport.rankTitle || 'Unestablished'}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Citizenship
            </div>
            <div className="text-sm font-bold truncate">
              {tier?.tier || 'Unestablished'}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Trust
            </div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
              <span className="truncate">{trustLine || 'Not yet established'}</span>
            </div>
          </div>

          {passport.issueDate && (
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Issued
              </div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{passport.issueDate}</span>
              </div>
            </div>
          )}

          {passport.isVerified && (
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Verification
              </div>
              <div className="text-sm font-bold flex items-center gap-1.5 text-blue-500">
                <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Verified</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
            {tier?.description || 'The official Arvdoul identity record for this citizen.'}
          </p>
          <button
            type="button"
            onClick={openFull}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer',
              'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
            )}
            aria-label={isOwner ? 'Open your digital passport' : 'Open this citizen\'s digital passport'}
          >
            <span>Full Passport</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
});

ProfilePassportCard.displayName = 'ProfilePassportCard';

export default ProfilePassportCard;
