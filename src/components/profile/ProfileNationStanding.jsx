/**
 * src/components/profile/ProfileNationStanding.jsx - ARVDOUL Digital-Nation Standing Rail
 *
 * A single compact rail that summarises a citizen's standing inside the nation:
 * reputation band, creator rank, earned badges and active title.
 *
 * Design intent (Profile blueprint §7-§8): this is *not* another card. It is a
 * dense, dividers-only strip that sits directly under the identity header, so
 * the Profile reads as a Digital-Nation identity rather than a stack of cards.
 *
 * Every segment is sourced from its canonical domain and is omitted entirely
 * when its value is unavailable - the rail never invents a score, a rank, a
 * badge count or a title to look complete.
 *
 * @component
 */

import React, { memo, useMemo } from 'react';
import { ShieldCheck, BarChart3, Award, Crown, Landmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getRankTitle } from '../../services/levelSystemService.js';
import { getEarnedBadges } from '../../config/badgeCatalog.js';

const ProfileNationStanding = memo(({
  level = null,
  reputation = null,
  rank = null,
  badges = null,
  activeTitle = null,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  const segments = useMemo(() => {
    const list = [];

    // Reputation: canonical reputationService profile (score + band).
    const repScore = reputation?.reputation?.score ?? null;
    const repBand = reputation?.reputation?.band ?? null;
    if (repScore !== null || repBand) {
      list.push({
        key: 'reputation',
        icon: ShieldCheck,
        label: 'Reputation',
        value: repBand || (repScore !== null ? String(repScore) : null),
        sub: repBand && repScore !== null ? `${repScore}` : null,
        tone: 'text-emerald-500',
      });
    }

    // Rank: canonical rankingService creator rank document.
    const rankPosition = rank?.rank ?? rank?.position ?? null;
    if (rankPosition !== null && rankPosition !== undefined) {
      list.push({
        key: 'rank',
        icon: BarChart3,
        label: 'Creator Rank',
        value: `#${rankPosition}`,
        sub: rank?.category || null,
        tone: 'text-blue-500',
      });
    }

    // Badges: canonical rankingService badge state, counted against the catalog.
    const earned = getEarnedBadges(badges);
    if (earned.length > 0) {
      list.push({
        key: 'badges',
        icon: Award,
        label: 'Badges',
        value: String(earned.length),
        sub: 'earned',
        tone: 'text-amber-500',
      });
    }

    // Title: only when an authoritative active title exists.
    const titleName = activeTitle?.name || activeTitle?.title || null;
    if (titleName) {
      list.push({
        key: 'title',
        icon: Crown,
        label: 'Title',
        value: titleName,
        sub: null,
        tone: 'text-rose-500',
      });
    }

    return list;
  }, [reputation, rank, badges, activeTitle]);

  const levelTitle = useMemo(() => {
    const n = Number(level);
    if (level === null || level === undefined || !Number.isFinite(n)) return null;
    try {
      return getRankTitle(n);
    } catch {
      return null;
    }
  }, [level]);

  // Nothing authoritative to say yet - render nothing rather than placeholders.
  if (segments.length === 0 && !levelTitle) return null;

  return (
    <section
      aria-label="Digital nation standing"
      className={cn(
        'w-full rounded-2xl border px-4 py-3 sm:px-5 shadow-sm transition-all',
        isDark
          ? 'bg-arvdoul-bg-elevated border-slate-800/90 text-white'
          : 'bg-white border-slate-200/90 text-slate-900',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {levelTitle && (
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden="true" />
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Standing
              </span>
              <span className="text-xs font-bold truncate">{levelTitle}</span>
            </div>
          </div>
        )}

        {segments.map((segment) => {
          const Icon = segment.icon;
          return (
            <div key={segment.key} className="flex items-center gap-2 min-w-0">
              <Icon className={cn('w-4 h-4 shrink-0', segment.tone)} aria-hidden="true" />
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {segment.label}
                </span>
                <span className="text-xs font-bold truncate">
                  {segment.value}
                  {segment.sub && (
                    <span className="ml-1 text-[10px] font-medium text-slate-400">{segment.sub}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

ProfileNationStanding.displayName = 'ProfileNationStanding';

export default ProfileNationStanding;
