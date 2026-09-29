/**
 * src/components/profile/ProfileEconomyCard.jsx
 *
 * Owner-only economy summary. Values come exclusively from the canonical
 * `walletService.getWalletOverview` projection (via `profileStore.wallet`) and
 * the monetization position/balance projection (`profileStore.balance` /
 * `position`). Nothing here computes a financial total or defaults a missing
 * balance to zero.
 *
 * Fail-closed: renders only when the viewer is the owner AND the capability
 * engine authorizes economic status (`canViewEconomicStatus`). A missing wallet
 * projection shows an honest "unavailable" state rather than "$0".
 *
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Coins, ArrowDownRight, ArrowUpRight, Clock, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const formatCoins = (value) => {
  // Number(null) is 0, so guard explicitly: an absent value is unknown, not zero.
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString();
};

const ProfileEconomyCard = memo(({
  wallet = null,
  balance = null,
  position = null,
  isOwner = false,
  canView = false,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Fail-closed: never expose economy data outside an authorized owner view.
  if (!isOwner || !canView) return null;

  const available = formatCoins(wallet?.availableCoins ?? wallet?.coins);
  const totalEarned = formatCoins(wallet?.totalEarned);
  const totalSpent = formatCoins(wallet?.totalSpent);
  const pending = formatCoins(wallet?.pendingCoins);
  const displayBalance = formatCoins(balance);

  const hasWallet = wallet !== null && wallet !== undefined;
  const hasAnyFigure = available !== null || displayBalance !== null;

  return (
    <section
      aria-label="Your Arvdoul economy"
      className={cn(
        'w-full rounded-2xl border p-5 sm:p-6 shadow-sm transition-all',
        isDark
          ? 'bg-arvdoul-bg-elevated border-slate-800 text-white'
          : 'bg-white border-slate-200 text-slate-900',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-500" aria-hidden="true" />
          Economy
        </h3>
        {position?.title && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span aria-hidden="true">{position.emoji || '👑'}</span>
            <span>{position.title}</span>
          </span>
        )}
      </div>

      {!hasWallet && displayBalance === null ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <Clock className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Economy data unavailable</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The wallet ledger could not be read right now. Retry from the Wallet screen.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Available
            </div>
            <div className="text-lg font-black flex items-center gap-1 mt-0.5">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              {available ?? displayBalance ?? '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Earned
            </div>
            <div className="text-lg font-black flex items-center gap-1 mt-0.5 text-emerald-500">
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              {totalEarned ?? '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Spent
            </div>
            <div className="text-lg font-black flex items-center gap-1 mt-0.5 text-rose-500">
              <ArrowDownRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              {totalSpent ?? '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Pending
            </div>
            <div className="text-lg font-black flex items-center gap-1 mt-0.5 text-amber-500">
              <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
              {pending ?? '—'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
          Ledger-backed balances from the Arvdoul economy. Private to you.
        </p>
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 text-white transition-all cursor-pointer"
          aria-label="Open your wallet"
        >
          <span>Open Wallet</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
});

ProfileEconomyCard.displayName = 'ProfileEconomyCard';

export default ProfileEconomyCard;
