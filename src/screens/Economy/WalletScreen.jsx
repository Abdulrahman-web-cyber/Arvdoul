// src/screens/Economy/WalletScreen.jsx
//
// Double-entry, ledger-backed, multi-state transactions.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import walletService from '../../services/walletService';
import { getMonetizationService } from '../../services/monetizationService';
import PaymentModal from '../../components/Shared/PaymentModal';
import { Coins, ArrowUpRight, ArrowDownLeft, AlertCircle, Plus, Building, RefreshCw, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { MIN_WITHDRAWAL_COINS, coinsToUsd, formatCoinsAsUsd, COIN_PACKAGES as COIN_PACKAGES_CANONICAL, LEVEL_GATES, getCreatorCapabilities } from '../../shared/levelConfig.cjs';
import { unknownNumber } from '../../lib/unknownNumber';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { cn } from '../../lib/utils';

// Package amounts/prices come from the shared COIN_PACKAGES (the same table the
// server prices from). The server credits `coins` exactly, so no bonus is
// advertised here.
const COIN_PACKAGES = COIN_PACKAGES_CANONICAL.map((pkg, i) => ({
  id: pkg.id,
  coins: pkg.coins,
  popular: i === 1,
  price: `$${(pkg.priceUsdCents / 100).toFixed(2)}`,
}));

const MIN_WITHDRAWAL_USD = coinsToUsd(MIN_WITHDRAWAL_COINS).toFixed(2);

// The canonical gate the server enforces (`functions/monetization.js`
// requestWithdrawal). Keep both ends reading the shared table.
const WITHDRAWAL_MIN_LEVEL = LEVEL_GATES.withdrawals;

/**
 * A user may request a payout when the canonical capability helper says so
 * (verified, partner/elite creator, or level >= LEVEL_GATES.withdrawals).
 * This mirrors `functions/monetization.js` so a low-level user is told *why*
 * instead of submitting a request the server will reject.
 */
function resolveWithdrawEligibility(wallet) {
  if (!wallet) return { allowed: false, reason: 'Wallet not loaded.' };
  const capabilities = getCreatorCapabilities({
    level: wallet.level,
    isVerified: wallet.isVerified,
    isCreator: wallet.isCreator,
    creatorTier: wallet.creatorTier,
  });
  if (capabilities.canWithdraw) return { allowed: true, reason: null };
  const hasLevel = wallet.level != null && Number.isFinite(Number(wallet.level));
  return {
    allowed: false,
    reason: hasLevel
      ? `Withdrawals unlock at Level ${WITHDRAWAL_MIN_LEVEL} (you are Level ${wallet.level}).`
      : `Withdrawals unlock at Level ${WITHDRAWAL_MIN_LEVEL} (your level is not yet available).`,
  };
}

export default function WalletScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'midnight';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all | in | out
  const [paymentPkg, setPaymentPkg] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const loadWallet = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [wData, txData] = await Promise.all([
        walletService.getWalletOverview(user.uid),
        walletService.getTransactions(user.uid, 50),
      ]);
      setWallet(wData);
      setTransactions(txData);
      setLoadError(null);
    } catch (err) {
      // A failed read is *unknown*, not an empty wallet: the balance card must
      // not present "0 Coins" for a wallet that never loaded.
      setLoadError(err?.message || 'Failed to load wallet data');
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  // Real Stripe purchase: the modal hands back a PaymentMethod id which is
  // verified server-side by the purchaseCoins callable. No free-coin path.
  const confirmPurchase = useCallback(async (paymentMethodId) => {
    if (!paymentPkg || purchasing) return;
    setPurchasing(true);
    try {
      const monetizationService = getMonetizationService();
      const res = await monetizationService.purchaseCoins(paymentPkg.id, paymentMethodId);
      if (res?.success) {
        toast.success(`+${res?.coinsAdded ?? paymentPkg.coins} coins added to your wallet.`);
        setPaymentPkg(null);
        await loadWallet();
      } else if (res?.offlineQueued) {
        toast.info('Purchase queued — it will complete when you are back online.');
        setPaymentPkg(null);
      } else {
        toast.error(res?.error || 'Purchase could not be completed.');
      }
    } catch (err) {
      toast.error(err?.message || 'Purchase failed.');
    } finally {
      setPurchasing(false);
    }
  }, [paymentPkg, purchasing, loadWallet]);

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    const eligibility = resolveWithdrawEligibility(wallet);
    if (!eligibility.allowed) {
      toast.error(eligibility.reason);
      return;
    }
    const amount = Number(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL_COINS) {
      toast.error(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_COINS.toLocaleString()} coins ($${MIN_WITHDRAWAL_USD} USD).`);
      return;
    }
    if (wallet?.availableCoins == null) {
      toast.error('Your available balance could not be verified. Refresh and try again.');
      return;
    }
    if (amount > wallet.availableCoins) {
      toast.error('Insufficient available coin balance.');
      return;
    }

    setWithdrawing(true);
    try {
      await walletService.requestPayout(user.uid, amount, 'stripe_connected');
      toast.success('Withdrawal request submitted for compliance audit.');
      setWithdrawAmount('');
      await loadWallet();
    } catch (err) {
      toast.error(err?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const filteredTxs = transactions.filter((tx) => {
    // A transaction with no readable amount belongs to neither tab — it must
    // not be fabricated as 0 and bucketed into "out".
    const amount = unknownNumber(tx.amount);
    if (activeTab === 'in') return amount != null && amount > 0;
    if (activeTab === 'out') return amount != null && amount < 0;
    return true;
  });

  if (loading && !wallet) {
    return (
      <div className={cn(
        'min-h-screen pb-24 flex items-center justify-center',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" aria-label="Loading wallet" />
      </div>
    );
  }

  // A read that failed is *unknown*, never an empty wallet: show a retry state
  // instead of a "0 Coins" balance the ledger never confirmed.
  if (loadError && !wallet) {
    return (
      <div className={cn(
        'min-h-screen pb-24 flex items-center justify-center px-4',
        isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        <div role="alert" className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
          <h2 className="text-lg font-semibold">Wallet unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); loadWallet(); }}
            className="min-h-[40px] px-4 py-2 rounded-xl text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Unknown balances render as an em-dash, not a fabricated 0.
  const fmtCoins = (value) => (
    value === null || value === undefined ? '—' : Number(value).toLocaleString()
  );

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        {/* In-page utility bar (TopAppBar handles main app title and back navigation) */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Wallet Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Economic Ledger &amp; Sovereign Balance
            </p>
          </div>
          <button
            type="button"
            onClick={loadWallet}
            aria-label="Refresh wallet"
            className={cn(
              'min-h-[40px] min-w-[40px] p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0',
              isDark ? 'bg-[#080F2E] border-white/[0.1] hover:bg-white/[0.06] text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Ledger Architecture Strip */}
        <nav aria-label="Financial Ledgers" className="grid grid-cols-3 gap-2">
          <div className={cn(
            'p-3 rounded-2xl border text-left',
            isDark ? 'bg-purple-500/15 border-purple-500/40' : 'bg-purple-50 border-purple-300'
          )}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block">Active Ledger</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate mt-0.5">Virtual Coins</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/creator-payout')}
            className={cn(
              'p-3 rounded-2xl border text-left transition-colors cursor-pointer',
              isDark ? 'bg-[#080F2E] border-white/[0.08] hover:border-purple-500/40' : 'bg-white border-slate-200 hover:border-purple-300'
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Ledger 2</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate mt-0.5">Creator Earnings</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/ads/billing')}
            className={cn(
              'p-3 rounded-2xl border text-left transition-colors cursor-pointer',
              isDark ? 'bg-[#080F2E] border-white/[0.08] hover:border-purple-500/40' : 'bg-white border-slate-200 hover:border-purple-300'
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Ledger 3</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate mt-0.5">Ad Spend &amp; Billing</span>
          </button>
        </nav>

        {/* Sovereign Balance Card */}
        <section
          aria-labelledby="balance-heading"
          className={cn(
            'p-6 sm:p-8 rounded-3xl border transition-all',
            isDark
              ? 'bg-[#080F2E] border-white/[0.08] shadow-xl'
              : 'bg-white border-slate-200/90 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Available Reserve
              </span>
              <div className="flex items-baseline gap-2.5 mt-1">
                <Coins className="w-6 h-6 text-amber-500 self-center shrink-0" />
                <h2 id="balance-heading" className="text-4xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {fmtCoins(wallet?.availableCoins ?? user?.coins)}
                </h2>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Coins</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPaymentPkg(COIN_PACKAGES[1])}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0 shadow-md"
              style={{ background: BRAND_GRADIENT }}
            >
              <Plus className="w-4 h-4" />
              <span>Acquire Coins</span>
            </button>
          </div>

          {/* Sub-balances breakdown */}
          <div className={cn(
            'mt-7 pt-5 border-t grid grid-cols-3 gap-3 text-xs',
            isDark ? 'border-white/[0.08]' : 'border-slate-200'
          )}>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Pending / Held</span>
              <span className="font-semibold text-amber-500 dark:text-amber-400 mt-0.5 block tabular-nums">
                {fmtCoins(wallet?.pendingCoins)} Coins
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Lifetime Earned</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
                {fmtCoins(wallet?.totalEarned)} Coins
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block tabular-nums">
                {wallet?.totalEarned == null ? '—' : `${formatCoinsAsUsd(wallet.totalEarned)} USD`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Lifetime Spent</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block tabular-nums">
                {fmtCoins(wallet?.totalSpent)} Coins
              </span>
            </div>
          </div>
        </section>

        {/* Quick Packages */}
        <section aria-labelledby="packages-heading" className="space-y-3">
          <h3 id="packages-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Coin Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COIN_PACKAGES.map((pkg) => (
              <button
                type="button"
                key={pkg.id}
                onClick={() => setPaymentPkg(pkg)}
                className={cn(
                  'p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer',
                  isDark ? 'bg-[#080F2E] border-white/[0.08] hover:border-purple-500/60' : 'bg-white border-slate-200 hover:border-purple-400 shadow-sm'
                )}
              >
                <div>
                  <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{pkg.coins}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Coins</span>
                </div>
                <div className={cn('mt-4 pt-2 border-t flex items-center justify-between', isDark ? 'border-white/[0.08]' : 'border-slate-200')}>
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 tabular-nums">{pkg.price}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">USD</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Creator Payouts Card */}
        {wallet?.monetizationEligible && (
          <section aria-labelledby="payout-heading" className={cn(
            'p-6 rounded-2xl border',
            isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm'
          )}>
            <h3 id="payout-heading" className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Building className="w-4 h-4 text-emerald-500" />
              <span>Creator Payouts</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Convert earned creator revenue into fiat currency via Stripe Connect. Minimum threshold: {MIN_WITHDRAWAL_COINS.toLocaleString()} coins (${MIN_WITHDRAWAL_USD} USD).
            </p>

            {(() => {
              const eligibility = resolveWithdrawEligibility(wallet);
              if (!eligibility.allowed) {
                return (
                  <div className={cn(
                    'mt-4 flex items-start gap-2 p-3 rounded-xl text-xs border',
                    isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                  )}>
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{eligibility.reason}</span>
                  </div>
                );
              }
              return (
                <form onSubmit={handleWithdrawal} className="mt-4 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    aria-label="Coins to withdraw"
                    type="number"
                    min={MIN_WITHDRAWAL_COINS}
                    step="100"
                    placeholder={`Coins to withdraw (min ${MIN_WITHDRAWAL_COINS.toLocaleString()})`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className={cn(
                      'min-h-[42px] px-3.5 py-2 rounded-xl border text-xs flex-1 outline-none tabular-nums',
                      isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                  <button
                    type="submit"
                    disabled={withdrawing}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {withdrawing ? 'Submitting...' : 'Request Payout'}
                  </button>
                </form>
              );
            })()}
          </section>
        )}

        {/* Ledger Transaction History */}
        <section aria-labelledby="ledger-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id="ledger-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 tabular-nums">
              Audit Ledger ({filteredTxs.length})
            </h3>
            <div className={cn(
              'flex rounded-xl p-0.5 border',
              isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-white border-slate-200'
            )}>
              {['all', 'in', 'out'].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'min-h-[32px] text-[11px] uppercase tracking-wider px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                    activeTab === tab
                      ? isDark
                        ? 'bg-white/[0.12] text-white font-semibold'
                        : 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className={cn(
            'rounded-2xl border divide-y',
            isDark ? 'bg-[#080F2E] border-white/[0.08] divide-white/[0.06]' : 'bg-white border-slate-200 divide-slate-100 shadow-sm'
          )}>
            {filteredTxs.map((tx) => {
              // An unreadable amount renders as an explicit unavailable state
              // ('—'), never a fabricated '+0 Coins' ledger row.
              const amount = unknownNumber(tx.amount);
              const isCredit = amount != null && amount >= 0;
              return (
              <div key={tx.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'p-2 rounded-xl shrink-0',
                    isCredit ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                  )}>
                    {isCredit ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {tx.description || tx.type || 'Transaction'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={cn(
                    'font-mono font-bold block tabular-nums',
                    isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {amount == null ? '—' : `${isCredit ? '+' : ''}${amount}`} Coins
                  </span>
                  <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">{tx.status}</span>
                </div>
              </div>
              );
            })}

            {filteredTxs.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No ledger transactions recorded yet.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Payment Modal — real Stripe checkout */}
      <PaymentModal
        open={!!paymentPkg}
        title={paymentPkg ? `Buy ${paymentPkg.coins.toLocaleString()} Coins` : 'Buy Coins'}
        amountLabel={paymentPkg ? paymentPkg.price : ''}
        onConfirm={confirmPurchase}
        onClose={() => setPaymentPkg(null)}
      />
    </div>
  );
}
