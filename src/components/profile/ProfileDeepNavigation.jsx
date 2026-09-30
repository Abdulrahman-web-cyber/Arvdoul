/**
 * src/components/profile/ProfileDeepNavigation.jsx
 *
 * Canonical action / deep-navigation layer for a Profile. The Profile is a
 * summary of the Arvdoul digital nation; each entry here links to the canonical
 * deep experience that owns the domain (Progression, Achievements, Titles,
 * Rankings, Reputation, Passport, Creator, Wallet).
 *
 * No domain logic lives here. Visibility is decided per-entry by the profile
 * capability engine (fail-closed): an entry that cannot work for this viewer is
 * omitted, or rendered disabled with a truthful reason. Reputation is always
 * offered because its canonical screen is reachable for any account id.
 */
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Trophy,
  Award,
  BarChart3,
  ShieldCheck,
  BookUser,
  Sparkles,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileDeepNavigation = memo(({
  profile,
  isOwner = false,
  capabilities = null,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const targetUid = profile?.uid || profile?.id || null;
  const isCreator = Boolean(profile?.isCreator || profile?.creatorStatus === 'approved');

  const entries = useMemo(() => {
    const list = [];

    // Viewer-scoped systems. The canonical Progress / Achievements / Titles /
    // Creator-Dashboard / Wallet screens render the *signed-in* citizen's data,
    // so on someone else's profile they would be a dead or misleading link.
    // Expose them only to the owner.
    if (isOwner) {
      list.push({
        key: 'progress',
        label: 'Progress',
        hint: 'Level, XP and streak ledger',
        icon: TrendingUp,
        color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        to: '/progress',
        enabled: true,
      });
      list.push({
        key: 'achievements',
        label: 'Achievements',
        hint: 'Milestones unlocked',
        icon: Trophy,
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        to: '/achievements',
        enabled: true,
      });
      list.push({
        key: 'titles',
        label: 'Titles',
        hint: 'Earned identity titles',
        icon: Award,
        color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        to: '/titles',
        enabled: true,
      });
      list.push({
        key: 'badges',
        label: 'Badges',
        hint: 'Earned and locked badges',
        icon: ShieldCheck,
        color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        to: '/badges',
        enabled: true,
      });
    }

    // Target-scoped systems. Reputation and Passport resolve the profile's own
    // account id, so they are valid for any viewer the capability engine admits.
    list.push({
      key: 'reputation',
      label: 'Reputation',
      hint: 'Trust and standing',
      icon: ShieldCheck,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      to: targetUid ? `/reputation/${targetUid}` : '/rankings',
      enabled: Boolean(targetUid),
    });

    // Rankings is the global nation leaderboard: public and always reachable.
    list.push({
      key: 'rankings',
      label: 'Rankings',
      hint: 'Global leaderboards',
      icon: BarChart3,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      to: '/rankings',
      enabled: true,
    });

    if (targetUid && (isOwner || capabilities?.canViewIdentity === true)) {
      list.push({
        key: 'passport',
        label: 'Passport',
        hint: 'Digital-nation identity',
        icon: BookUser,
        color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        to: `/passport/${targetUid}`,
        enabled: true,
      });
    }

    if (isOwner && isCreator) {
      list.push({
        key: 'creator',
        label: 'Creator',
        hint: 'Creator profile and tools',
        icon: Sparkles,
        color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20',
        to: '/creator/dashboard',
        enabled: true,
      });
    }

    // Economy is owner-only and capability-gated (fail-closed).
    if (isOwner && capabilities?.canViewEconomicStatus === true) {
      list.push({
        key: 'wallet',
        label: 'Wallet',
        hint: 'Coins and earnings',
        icon: Wallet,
        color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        to: '/wallet',
        enabled: true,
      });
    }

    return list;
  }, [isOwner, capabilities, targetUid, isCreator]);

  if (entries.length === 0) return null;

  return (
    <section
      aria-label="Explore the full Arvdoul identity"
      className={cn(
        'w-full rounded-2xl p-4 sm:p-5 border transition-all shadow-sm',
        isDark ? 'bg-arvdoul-bg-elevated border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900',
      )}
    >
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Explore Identity
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Full Arvdoul systems
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.key}
              type="button"
              disabled={!entry.enabled}
              onClick={() => entry.enabled && navigate(entry.to)}
              aria-label={`Open ${entry.label}`}
              className={cn(
                'group flex items-center gap-3 p-3 rounded-xl border text-left transition-all min-h-[56px]',
                entry.enabled
                  ? cn(entry.color, 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer')
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border',
                entry.enabled
                  ? 'bg-white/70 dark:bg-black/20 border-white/40 dark:border-white/10'
                  : 'bg-transparent border-slate-200 dark:border-white/10',
              )}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{entry.label}</div>
                <div className="text-[10px] font-medium truncate opacity-80">{entry.hint}</div>
              </div>
              {entry.enabled && (
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
});

ProfileDeepNavigation.displayName = 'ProfileDeepNavigation';

export default ProfileDeepNavigation;
