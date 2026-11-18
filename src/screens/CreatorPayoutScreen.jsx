// src/screens/CreatorPayoutScreen.jsx

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { Banknote, DollarSign, TrendingUp, ShieldCheck, CreditCard, Sparkles, Clock, ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { getMonetizationService } from '../services/monetizationService';
import { getAnalyticsService } from '../services/analyticsService';
import { coinsToUsd, formatCoinsAsUsd, MIN_WITHDRAWAL_COINS } from '../shared/levelConfig.cjs';
import { unknownNumber } from '../lib/unknownNumber.js';

// The earnings breakdown must come from the real coin ledger, never a fixed
// ratio. Gifts/tips and ad revenue are credited with these reasons by
// functions/monetization.js; the split is a sum over actual transactions.
const GIFT_REASONS = ['gift', 'tip', 'super_thanks'];
const AD_REASONS = ['ad_reward', 'ad_share', 'ad_revenue'];
const OTHER_EARNING_REASONS = ['poll_vote_reward', 'level_up_reward', 'subscription', 'purchase', 'bonus', 'reward'];

function sumCredits(items, reasons) {
  const matched = items.filter((tx) => reasons.includes(tx.reason));
  // An amount the ledger did not carry is unknown; summing it as 0 understated
  // the earnings and rendered a measured figure. Return unknown instead.
  let total = 0;
  for (const tx of matched) {
    const amount = unknownNumber(tx.amount);
    if (amount == null) return null;
    total += amount;
  }
  return total;
}

export default function CreatorPayoutScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'midnight';

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [earnings, setEarnings] = useState({ gifts: null, ads: null, other: null });
  const [lifetimeWithdrawnCoins, setLifetimeWithdrawnCoins] = useState(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [payoutAccountId, setPayoutAccountId] = useState(null);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Request payout state
  const [requestModal, setRequestModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const monSvc = getMonetizationService();
      const anaSvc = getAnalyticsService();
      // The analytics summary is deliberately not fetched here: this screen
      // renders payout data only, and the value was never displayed (a wasted
      // unbounded read). Views/engagement live on the creator dashboard.
      const [balRes, histRes, earnRes, spendRes] = await Promise.allSettled([
        monSvc.getBalance(user.uid),
        monSvc.getTransactionHistory(user.uid, 20),
        anaSvc?.getCoinEarningHistory?.(user.uid, 200),
        anaSvc?.getCoinSpendingHistory?.(user.uid, 200),
      ]);

      if (balRes.status === 'fulfilled') {
        // `getBalance` returns null when the balance is unknown; mapping that
        // to 0 claimed an empty wallet and blocked every payout request.
        const b = balRes.value;
        const resolved = typeof b === 'number' ? b : (b?.coins ?? b?.balance ?? null);
        setBalance(resolved == null ? null : Number(resolved));
      }
      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value?.items)) {
        setPayouts(histRes.value.items.filter(tx => tx.type === 'debit' || tx.type === 'withdrawal' || tx.reason?.includes('withdraw')));
      }
      // Real earnings breakdown, summed from the coin ledger — not a fixed ratio.
      // A failed ledger read leaves the figures unknown (rendered "—"), never a
      // fabricated "0 Coins earned".
      if (earnRes.status === 'fulfilled' && Array.isArray(earnRes.value)) {
        const earned = earnRes.value;
        setEarnings({
          gifts: sumCredits(earned, GIFT_REASONS),
          ads: sumCredits(earned, AD_REASONS),
          other: sumCredits(earned, OTHER_EARNING_REASONS),
        });
      }
      // A failed spend-ledger read leaves lifetime withdrawals unknown ("—"),
      // never a fabricated "$0.00 withdrawn". A withdrawal row whose amount is
      // absent is unknown too — summing it as 0 understated the total.
      if (spendRes.status === 'fulfilled' && Array.isArray(spendRes.value)) {
        const withdrawals = spendRes.value.filter(
          (tx) => tx.reason === 'withdrawal_request' || tx.reason === 'withdrawal_completed' || tx.reason === 'withdrawal'
        );
        let total = 0;
        for (const tx of withdrawals) {
          const amount = unknownNumber(tx.amount);
          if (amount == null) { total = null; break; }
          total += amount;
        }
        setLifetimeWithdrawnCoins(total);
      }
      // payout account status (never simulated).
      try {
        const settings = await monSvc.getPayoutSettings();
        // The server marks a payout account `ready` (Stripe `payouts_enabled`)
        // once onboarding completes; anything else is not yet payable.
        setStripeConnected(settings?.status === 'ready');
        setPayoutAccountId(settings?.stripeAccountId || null);
      } catch (err) {
        console.warn('Failed to load payout settings:', err);
        setStripeConnected(false);
        setPayoutAccountId(null);
      }
    } catch (err) {
      console.warn('Failed to load creator payout data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnectStripe = async () => {
    if (!user?.uid) {
      toast.error('Sign in to connect a payout account');
      return;
    }
    setConnectingStripe(true);
    try {
      // Stripe Express onboarding via the Cloud Function
      // (functions/monetization.js createPayoutAccount). No timers, no
      // simulated success — the account is only "connected" once the server
      // reports `payouts_enabled`, so we re-read the real status afterwards
      // rather than trusting the creation response (which is returned before
      // onboarding and is not proof of a payable account).
      const returnUrl = `${window.location.origin}/creator-payout`;
      const result = await getMonetizationService().createPayoutAccount('US', returnUrl);
      if (result?.onboardingUrl) {
        // Real Stripe-hosted onboarding — send the creator there.
        window.open(result.onboardingUrl, '_blank', 'noopener');
        toast.info('Complete onboarding in the Stripe window that just opened.');
      } else if (!result?.success && !result?.accountId) {
        toast.error(result?.message || 'Could not create the payout account. Is the Cloud Function deployed?');
        return;
      } else {
        toast.info('Onboarding link unavailable — reload once onboarding completes.');
      }
      // Re-read the authoritative status; only `ready` means payable.
      try {
        const settings = await getMonetizationService().getPayoutSettings();
        const connected = settings?.status === 'ready';
        setStripeConnected(connected);
        setPayoutAccountId(settings?.stripeAccountId || null);
        if (connected) toast.success('Payout account connected');
      } catch {
        // Status stays as previously loaded; the reload will reconcile.
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to connect payout account. The Stripe Connect Cloud Function must be deployed.');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL_COINS) {
      toast.error(`Minimum payout is ${MIN_WITHDRAWAL_COINS.toLocaleString()} coins (${formatCoinsAsUsd(MIN_WITHDRAWAL_COINS)})`);
      return;
    }
    if (balance == null) {
      toast.error('Your balance is unavailable right now. Please retry in a moment.');
      return;
    }
    if (amount > balance) {
      toast.error('Withdrawal amount exceeds your current balance.');
      return;
    }
    if (!stripeConnected || !payoutAccountId) {
      toast.error('Connect a Stripe payout account before requesting a payout.');
      return;
    }

    setSubmitting(true);
    try {
      const monSvc = getMonetizationService();
      const res = await monSvc.requestWithdrawal(
        user.uid,
        amount,
        'stripe',
        { stripeAccountId: payoutAccountId }
      );
      if (res?.success) {
        toast.success('Payout request submitted. Stripe processes the transfer after review — timing depends on your bank and region.');
        setRequestModal(false);
        setWithdrawAmount('');
        loadData();
      } else {
        toast.error(res?.message || 'Payout request failed.');
      }
    } catch (err) {
      toast.error(err?.message || 'Payout request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedUsd = balance == null ? null : coinsToUsd(balance).toFixed(2);
  const eligibleForPayout = balance != null && balance >= MIN_WITHDRAWAL_COINS;
  const progressPercent = balance == null ? 0 : Math.min(100, Math.round((balance / MIN_WITHDRAWAL_COINS) * 100));

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors",
      isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-slate-900"
    )}>
      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6">
        {/* In-page utility bar (TopAppBar handles main app title and back navigation) */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
              <Banknote className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Creator Payouts</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monetization and direct revenue earnings</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className={cn(
              "min-h-[40px] px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0",
              isDark ? "border-white/[0.1] bg-[#080F2E] hover:bg-white/[0.06] text-slate-200" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Earnings Card */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-xl"
          style={{ background: BRAND_GRADIENT }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-widest text-white/80">Available Creator Balance</span>
              <div className="flex items-baseline gap-2.5 mt-1 flex-wrap">
                <h2 className="text-4xl font-extrabold tracking-tight tabular-nums">
                  {balance == null ? '—' : balance.toLocaleString()}
                </h2>
                <span className="text-base font-medium text-white/80">Coins</span>
                <span className="text-lg font-semibold text-emerald-300 ml-1 tabular-nums">≈ {estimatedUsd == null ? '—' : `$${estimatedUsd}`} USD</span>
              </div>
              <p className="text-xs text-white/80 mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Server-verified ledger · payouts reviewed before settlement</span>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRequestModal(true)}
                disabled={!eligibleForPayout}
                className={cn(
                  "min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0",
                  eligibleForPayout
                    ? "bg-white text-indigo-950 hover:bg-slate-50 active:scale-95"
                    : "bg-white/20 text-white/60 cursor-not-allowed"
                )}
              >
                <DollarSign className="w-4 h-4" />
                <span>Request Payout</span>
              </button>
            </div>
          </div>

          {/* Threshold Progress */}
          <div className="mt-6 pt-4 border-t border-white/15">
            <div className="flex justify-between text-xs font-semibold mb-1.5 tabular-nums">
              <span>Payout Threshold ({MIN_WITHDRAWAL_COINS.toLocaleString()} coins)</span>
              <span>{progressPercent}% Complete</span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/25 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Payout Method Status */}
        <div className={cn(
          "rounded-2xl border p-5 transition-colors",
          isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Payout Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stripeConnected
                    ? 'Stripe Express account connected & active'
                    : 'Connect your bank or payout account to receive direct deposits'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConnectStripe}
              disabled={connectingStripe || stripeConnected}
              className={cn(
                "min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0",
                stripeConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-white hover:opacity-95 active:scale-95"
              )}
              style={!stripeConnected ? { background: BRAND_GRADIENT } : undefined}
            >
              {connectingStripe ? 'Connecting...' : stripeConnected ? '✓ Connected' : 'Connect Stripe'}
            </button>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={cn(
            "rounded-2xl border p-4",
            isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Gifts &amp; Tips</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {earnings.gifts == null ? '—' : earnings.gifts.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Coins</span>
            </p>
          </div>

          <div className={cn(
            "rounded-2xl border p-4",
            isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Ad Revenue Share</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {earnings.ads == null ? '—' : earnings.ads.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Coins</span>
            </p>
          </div>

          <div className={cn(
            "rounded-2xl border p-4",
            isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Lifetime Withdrawn</span>
              <Clock className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {lifetimeWithdrawnCoins == null ? '—' : formatCoinsAsUsd(lifetimeWithdrawnCoins)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">USD</span>
            </p>
          </div>
        </div>

        {/* Payout History */}
        <div className={cn(
          "rounded-2xl border p-5",
          isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            Payout & Withdrawal History
          </h3>

          {payouts.length === 0 ? (
            <div className="text-center py-10">
              <Wallet className="w-10 h-10 text-arvdoul-text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No withdrawals yet</p>
              <p className="text-xs text-arvdoul-text-secondary mt-1">
                When your balance reaches {MIN_WITHDRAWAL_COINS.toLocaleString()} coins, you can request a cash payout.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {payouts.map((tx, idx) => (
                <div key={tx.id || idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{tx.reason || 'Creator Withdrawal'}</p>
                      <p className="text-xs text-arvdoul-text-secondary">
                        {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const amt = unknownNumber(tx.amount);
                      const label = amt == null ? '—' : `-$${amt.toLocaleString()}`;
                      const state = String(tx.status || tx.state || '').toLowerCase();
                      // Never assert "Completed" for a withdrawal the ledger
                      // does not mark settled; an unknown state shows no badge.
                      const badge = state === 'completed' || state === 'settled'
                        ? { text: 'Completed', cls: 'text-emerald-400 bg-emerald-500/10' }
                        : state === 'pending' || state === 'processing' || state === 'pending_review'
                          ? { text: 'Pending', cls: 'text-amber-400 bg-amber-500/10' }
                          : state === 'failed' || state === 'rejected'
                            ? { text: 'Failed', cls: 'text-red-400 bg-red-500/10' }
                            : null;
                      return (
                        <>
                          <p className="text-sm font-bold text-emerald-500">{label}</p>
                          {badge && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.text}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Payout Request Modal */}
      <AnimatePresence>
        {requestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-md rounded-arvdoul-xl border p-6 shadow-2xl",
                isDark ? "bg-arvdoul-surface border-arvdoul-border text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <h2 className="text-lg font-bold font-display mb-1">Request Creator Payout</h2>
              <p className="text-xs text-arvdoul-text-secondary mb-4">
                Withdraw coins to your connected Stripe payout account. PayPal is not supported.
              </p>

              <form onSubmit={handleRequestPayout} className="space-y-4">
                {!stripeConnected && (
                  <div className="flex items-start gap-2 rounded-arvdoul-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
                    <CreditCard className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Connect a Stripe payout account before you can withdraw.</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold block mb-1.5">
                    Amount to Withdraw (Coins)
                  </label>
                  <input aria-label="Amount to Withdraw (Coins)"
                    type="number"
                    min={MIN_WITHDRAWAL_COINS}
                    max={balance ?? undefined}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Min: ${MIN_WITHDRAWAL_COINS}`}
                    className={cn(
                      "w-full px-3.5 py-2.5 rounded-arvdoul-sm text-xs border outline-none",
                      isDark ? "bg-black/30 border-arvdoul-border text-white" : "bg-slate-50 border-slate-300"
                    )}
                  />
                  {withdrawAmount && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      Estimated payout: ${coinsToUsd(withdrawAmount).toFixed(2)} USD
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestModal(false)}
                    className={cn(
                      "flex-1 py-2.5 rounded-arvdoul-sm text-xs font-bold border",
                      isDark ? "border-arvdoul-border hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-arvdoul-sm text-xs font-bold bg-arvdoul-purple text-white hover:bg-violet-600 active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : 'Confirm Withdrawal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
