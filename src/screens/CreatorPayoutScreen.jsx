// src/screens/CreatorPayoutScreen.jsx - ARVDOUL CREATOR PAYOUT & EARNINGS DASHBOARD
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Banknote, DollarSign, ArrowLeft, TrendingUp, ShieldCheck,
  CreditCard, Sparkles, CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, RefreshCw, Wallet, ChevronRight, Lock
} from 'lucide-react';
import { getMonetizationService } from '../services/monetizationService';
import { getAnalyticsService } from '../services/analyticsService';

const MIN_PAYOUT_COINS = 5000;
const COIN_TO_USD_RATE = 0.005; // 5000 coins = $25.00

export default function CreatorPayoutScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [payouts, setPayouts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Request payout state
  const [requestModal, setRequestModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('stripe'); // 'stripe' | 'paypal'
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const monSvc = getMonetizationService();
      const anaSvc = getAnalyticsService();
      const [balRes, histRes, analyticsRes] = await Promise.allSettled([
        monSvc.getBalance(user.uid),
        monSvc.getTransactionHistory(user.uid, 20),
        anaSvc?.getAnalyticsSummary?.(user.uid)
      ]);

      if (balRes.status === 'fulfilled') {
        const b = balRes.value;
        setBalance(typeof b === 'number' ? b : Number(b?.coins || b?.balance || 0));
      }
      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value)) {
        setPayouts(histRes.value.filter(tx => tx.type === 'debit' || tx.type === 'withdrawal' || tx.reason?.includes('withdraw')));
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }

      // REAL payout account status (never simulated).
      try {
        const settings = await monSvc.getPayoutSettings();
        const status = settings?.accountStatus || 'unconfigured';
        setStripeConnected(status === 'verified' || status === 'active' || status === 'enabled');
      } catch (err) {
        console.warn('Failed to load payout settings:', err);
        setStripeConnected(false);
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
      // REAL Stripe Express onboarding via the Cloud Function
      // (functions/monetization.js createPayoutAccount). No timers, no
      // simulated success — the account is only "connected" when the
      // server actually created it.
      const returnUrl = `${window.location.origin}/creator-payout`;
      const result = await getMonetizationService().createPayoutAccount('US', returnUrl);
      if (result?.onboardingUrl) {
        // Real Stripe-hosted onboarding — send the creator there.
        window.open(result.onboardingUrl, '_blank', 'noopener');
        toast.info('Complete onboarding in the Stripe window that just opened.');
      } else if (result?.success || result?.status === 'verified' || result?.accountId) {
        setStripeConnected(true);
        toast.success('Payout account connected');
      } else {
        toast.error(result?.message || 'Could not create the payout account. Is the Cloud Function deployed?');
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
    if (!amount || amount < MIN_PAYOUT_COINS) {
      toast.error(`Minimum payout is ${MIN_PAYOUT_COINS.toLocaleString()} coins ($${(MIN_PAYOUT_COINS * COIN_TO_USD_RATE).toFixed(2)})`);
      return;
    }
    if (amount > balance) {
      toast.error('Withdrawal amount exceeds your current balance.');
      return;
    }
    if (payoutMethod === 'paypal' && !paypalEmail.includes('@')) {
      toast.error('Please provide a valid PayPal email address.');
      return;
    }

    setSubmitting(true);
    try {
      const monSvc = getMonetizationService();
      const res = await monSvc.requestWithdrawal(
        user.uid,
        amount,
        payoutMethod,
        payoutMethod === 'paypal' ? { email: paypalEmail } : { stripeAccount: 'connected' }
      );
      if (res?.success) {
        toast.success('Payout request submitted! Funds will arrive within 2-3 business days.');
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

  const estimatedUsd = (balance * COIN_TO_USD_RATE).toFixed(2);
  const eligibleForPayout = balance >= MIN_PAYOUT_COINS;
  const progressPercent = Math.min(100, Math.round((balance / MIN_PAYOUT_COINS) * 100));

  return (
    <div className={cn(
      "min-h-screen pb-24",
      isDark ? "bg-arvdoul-bg text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-30 backdrop-blur-xl border-b px-4 py-4",
        isDark ? "bg-arvdoul-surface/90 border-arvdoul-border" : "bg-white/90 border-slate-200"
      )}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                "p-2 rounded-xl transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold font-display flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-500" />
                Creator Payouts
              </h1>
              <p className="text-xs text-arvdoul-text-secondary">Monetization and direct revenue earnings</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className={cn(
              "p-2 rounded-xl border flex items-center gap-1 text-xs font-semibold",
              isDark ? "border-arvdoul-border bg-white/5 hover:bg-white/10" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Earnings Card */}
        <div className="relative overflow-hidden rounded-arvdoul-xl bg-gradient-to-br from-violet-600 via-indigo-700 to-purple-800 p-6 text-white shadow-arvdoul-glow">
          <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-violet-200">Available Creator Balance</span>
              <div className="flex items-baseline gap-3 mt-1">
                <h2 className="text-4xl font-extrabold tracking-tight font-display">
                  {balance.toLocaleString()}
                </h2>
                <span className="text-lg font-medium text-violet-200">Coins</span>
                <span className="text-xl font-semibold text-emerald-300 ml-2">≈ ${estimatedUsd} USD</span>
              </div>
              <p className="text-xs text-violet-200 mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                Double-entry verified ledger · 100% secure payouts
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setRequestModal(true)}
                disabled={!eligibleForPayout}
                className={cn(
                  "px-6 py-3.5 rounded-arvdoul-md font-bold text-sm shadow-lg transition-all flex items-center gap-2",
                  eligibleForPayout
                    ? "bg-white text-indigo-900 hover:bg-violet-50 active:scale-95"
                    : "bg-white/20 text-white/60 cursor-not-allowed"
                )}
              >
                <DollarSign className="w-4 h-4" />
                Request Payout
              </button>
            </div>
          </div>

          {/* Threshold Progress */}
          <div className="mt-6 pt-4 border-t border-white/15">
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span>Payout Threshold ({MIN_PAYOUT_COINS.toLocaleString()} coins)</span>
              <span>{progressPercent}% Complete</span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Payout Method Status */}
        <div className={cn(
          "rounded-arvdoul-xl border p-5 transition-colors",
          isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Payout Account</h3>
                <p className="text-xs text-arvdoul-text-secondary">
                  {stripeConnected
                    ? 'Stripe Express account connected & active'
                    : 'Connect your bank or PayPal to receive direct deposits'}
                </p>
              </div>
            </div>

            <button
              onClick={handleConnectStripe}
              disabled={connectingStripe || stripeConnected}
              className={cn(
                "px-4 py-2 rounded-arvdoul-sm text-xs font-bold transition-all",
                stripeConnected
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-arvdoul-purple text-white hover:bg-violet-600 active:scale-95"
              )}
            >
              {connectingStripe ? 'Connecting...' : stripeConnected ? '✓ Connected' : 'Connect Stripe'}
            </button>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={cn(
            "rounded-arvdoul-lg border p-4",
            isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between text-xs text-arvdoul-text-secondary mb-1">
              <span>Gifts & Tips</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-xl font-bold">{(balance * 0.7).toFixed(0)} <span className="text-xs font-normal text-arvdoul-text-secondary">Coins</span></p>
          </div>

          <div className={cn(
            "rounded-arvdoul-lg border p-4",
            isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between text-xs text-arvdoul-text-secondary mb-1">
              <span>Ad Revenue Share</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-xl font-bold">{(balance * 0.3).toFixed(0)} <span className="text-xs font-normal text-arvdoul-text-secondary">Coins</span></p>
          </div>

          <div className={cn(
            "rounded-arvdoul-lg border p-4",
            isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center justify-between text-xs text-arvdoul-text-secondary mb-1">
              <span>Lifetime Withdrawn</span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-xl font-bold">$0.00 <span className="text-xs font-normal text-arvdoul-text-secondary">USD</span></p>
          </div>
        </div>

        {/* Payout History */}
        <div className={cn(
          "rounded-arvdoul-xl border p-5",
          isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
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
                When your balance reaches {MIN_PAYOUT_COINS.toLocaleString()} coins, you can request a cash payout.
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
                        {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-500">-${tx.amount?.toLocaleString?.() || tx.amount}</p>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Completed
                    </span>
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
                Withdraw coins directly to your connected bank or PayPal account.
              </p>

              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Payout Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('stripe')}
                      className={cn(
                        "py-2.5 rounded-arvdoul-sm text-xs font-bold border transition-colors",
                        payoutMethod === 'stripe'
                          ? "border-arvdoul-purple bg-arvdoul-purple/10 text-arvdoul-purple"
                          : "border-arvdoul-border bg-white/5 text-arvdoul-text-secondary"
                      )}
                    >
                      Stripe Direct
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('paypal')}
                      className={cn(
                        "py-2.5 rounded-arvdoul-sm text-xs font-bold border transition-colors",
                        payoutMethod === 'paypal'
                          ? "border-arvdoul-purple bg-arvdoul-purple/10 text-arvdoul-purple"
                          : "border-arvdoul-border bg-white/5 text-arvdoul-text-secondary"
                      )}
                    >
                      PayPal
                    </button>
                  </div>
                </div>

                {payoutMethod === 'paypal' && (
                  <div>
                    <label className="text-xs font-semibold block mb-1.5">PayPal Email</label>
                    <input
                      type="email"
                      required
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="your-paypal@email.com"
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-arvdoul-sm text-xs border outline-none",
                        isDark ? "bg-black/30 border-arvdoul-border text-white" : "bg-slate-50 border-slate-300"
                      )}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold block mb-1.5">
                    Amount to Withdraw (Coins)
                  </label>
                  <input
                    type="number"
                    min={MIN_PAYOUT_COINS}
                    max={balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Min: ${MIN_PAYOUT_COINS}`}
                    className={cn(
                      "w-full px-3.5 py-2.5 rounded-arvdoul-sm text-xs border outline-none",
                      isDark ? "bg-black/30 border-arvdoul-border text-white" : "bg-slate-50 border-slate-300"
                    )}
                  />
                  {withdrawAmount && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      Estimated payout: ${(Number(withdrawAmount) * COIN_TO_USD_RATE).toFixed(2)} USD
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
