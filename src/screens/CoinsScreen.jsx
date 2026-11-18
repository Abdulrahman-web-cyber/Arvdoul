// src/screens/CoinsScreen.jsx
//
// Real flows only: live balance, CF-verified purchases, ad-earn rewards,
// transaction history and withdrawal requests. No demo/simulated paths.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { motion } from "framer-motion";
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { unknownNumber } from '../lib/unknownNumber.js';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { MIN_WITHDRAWAL_COINS, COIN_PACKAGES as COIN_PACKAGES_CANONICAL, SUBSCRIPTION_TIERS as SUBSCRIPTION_TIERS_CANONICAL, AD_REWARD_COINS as AD_REWARD_COINS_CANONICAL } from '../shared/levelConfig.cjs';

import { Coins, Crown, Zap, Rocket, Star, CheckCircle, Shield, Gift, TrendingUp, Play, History, Banknote, Loader2, Sparkles } from "lucide-react";
import PaymentModal from '../components/Shared/PaymentModal';
import CoinStackIcon from '../components/Shared/CoinStackIcon';
import ErrorState from '../design-system/ErrorState.jsx';
// Presentation-only icon/accent, keyed by the canonical package id. Amounts and
// prices come from COIN_PACKAGES in the shared levelConfig (same table the
// server prices from), so the client can never advertise a price or coin amount
// the server will not honour.
const PACKAGE_STYLE = {
  coins_100:  { icon: Coins,  iconTone: 'bg-amber-500/15 text-amber-500 dark:text-amber-400' },
  coins_500:  { icon: Crown,  iconTone: 'bg-purple-500/15 text-purple-600 dark:text-purple-300', popular: true },
  coins_1200: { icon: Star,   iconTone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' },
  coins_2500: { icon: Rocket, iconTone: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  coins_5000: { icon: Zap,    iconTone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
};
const COIN_PACKAGES = COIN_PACKAGES_CANONICAL.map((pkg) => ({
  ...pkg,
  ...(PACKAGE_STYLE[pkg.id] || {}),
  price: `$${(pkg.priceUsdCents / 100).toFixed(2)}`,
}));

// Ad reward comes from the shared config (server AD_REWARD_PER_30S).
const AD_REWARD_COINS = AD_REWARD_COINS_CANONICAL;

export default function CoinsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [monetization, setMonetization] = useState(null);

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState(null);
  const [transactionsCursor, setTransactionsCursor] = useState(null);
  const [transactionsLoadingMore, setTransactionsLoadingMore] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState('coins_500');
  const [purchasing, setPurchasing] = useState(null); // package id in flight

  const [ad, setAd] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adWatching, setAdWatching] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const adIntervalRef = useRef(null);
  const adEligibleRef = useRef(Date.now());

  const [paymentPkg, setPaymentPkg] = useState(null); // coin package being bought
  const [subTier, setSubTier] = useState(null); // subscription tier being bought
  const [currentSub, setCurrentSub] = useState(null);

  // Amounts/prices come from the shared SUBSCRIPTION_TIERS; only names and
  // popularity are presentation. The monthly coin line is derived from the
  // tier's `coinsPerMonth` so it can never disagree with the server grant.
  // No perk bullet is listed here: the server grants ONLY the monthly coin
  // credit (functions/monetization.js#creditSubscriptionCoins) — it never reads
  // a subscription to gate ads, badges, analytics, discounts or support, so
  // advertising those perks would fabricate a capability (N422).
  const TIER_PRESENTATION = {
    basic: { name: 'Basic', perks: [] },
    pro: { name: 'Pro', popular: true, perks: [] },
    premium: { name: 'Premium', perks: [] },
  };
  const SUBSCRIPTION_TIERS = Object.entries(SUBSCRIPTION_TIERS_CANONICAL).map(([id, cfg]) => {
    const presentation = TIER_PRESENTATION[id] || { name: id, perks: [] };
    return {
      id,
      name: presentation.name,
      popular: Boolean(presentation.popular),
      perks: [`${cfg.coinsPerMonth.toLocaleString()} coins monthly`, ...(presentation.perks || [])],
      ...cfg,
      price: `$${(cfg.priceUsdCents / 100).toFixed(2)}/mo`,
    };
  });

  const isDark = theme === 'dark' || theme === 'midnight';
  const colors = {
    bg: isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]',
    card: isDark ? 'bg-[#080F2E]' : 'bg-white shadow-sm',
    border: isDark ? 'border-white/[0.08]' : 'border-slate-200/90',
    text: isDark ? 'text-white' : 'text-slate-900',
    secondary: isDark ? 'text-slate-400' : 'text-slate-600',
  };

  const loadBalance = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      if (!monetization) setMonetization(svc);
      const bal = await svc.getBalance(user.uid);
      // An unknown balance stays null (renders —); coercing it to 0 would
      // claim an empty wallet the read never confirmed.
      const value = typeof bal === 'number' ? bal : (bal?.coins ?? bal?.balance ?? null);
      setBalance(value === null ? null : Number(value));
    } catch (err) {
      toast.error('Could not load your coin balance.');
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.uid, monetization]);

  const loadTransactions = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setTransactionsLoading(true);
      setTransactionsError(null);
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const page = await svc.getTransactionHistory(user.uid, 15);
      setTransactions(Array.isArray(page?.items) ? page.items : []);
      setTransactionsCursor(page?.nextCursor ?? null);
    } catch (err) {
      // A failed history read must not render "No transactions yet" — that
      // tells the user their wallet history is empty when the read failed.
      setTransactionsError(err?.message || 'Could not load your transaction history.');
      setTransactions([]);
      setTransactionsCursor(null);
    } finally {
      setTransactionsLoading(false);
    }
  }, [user?.uid, monetization]);

  const loadMoreTransactions = useCallback(async () => {
    if (!user?.uid || !transactionsCursor || transactionsLoadingMore) return;
    setTransactionsLoadingMore(true);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const page = await svc.getTransactionHistory(user.uid, 15, transactionsCursor);
      const items = Array.isArray(page?.items) ? page.items : [];
      setTransactions((prev) => [...prev, ...items]);
      setTransactionsCursor(page?.nextCursor ?? null);
    } catch (err) {
      toast.error('Could not load more transactions.');
    } finally {
      setTransactionsLoadingMore(false);
    }
  }, [user?.uid, monetization, transactionsCursor, transactionsLoadingMore]);

  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Cleanup ad timer on unmount
  useEffect(() => () => { if (adIntervalRef.current) clearInterval(adIntervalRef.current); }, []);

  // Open the secure checkout for a coin package.
  const handlePurchase = (pkg) => {
    if (!user?.uid) { toast.info('Sign in to buy coins.'); return; }
    setPaymentPkg(pkg);
  };

  // Called by PaymentModal after Stripe creates a real PaymentMethod.
  const confirmPurchase = async (paymentMethodId) => {
    if (!paymentPkg || purchasing) return;
    setPurchasing(paymentPkg.id);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const res = await svc.purchaseCoins(paymentPkg.id, paymentMethodId);
      if (res?.success) {
        toast.success(`+${res?.coinsAdded ?? paymentPkg.coins} coins added to your account`);
        await loadBalance();
        await loadTransactions();
      } else if (res?.offlineQueued) {
        toast.info('Purchase queued — will be processed when you are back online.');
      }
    } catch (err) {
      toast.error(err?.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
      setPaymentPkg(null);
    }
  };

  // Open the secure checkout for a subscription tier.
  const handleSubscribe = (tier) => {
    if (!user?.uid) { toast.info('Sign in to subscribe.'); return; }
    setSubTier(tier);
  };

  const confirmSubscription = async (paymentMethodId) => {
    if (!subTier || purchasing) return;
    setPurchasing(subTier.id);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const res = await svc.createSubscription(subTier.id, paymentMethodId);
      if (res?.success) {
        toast.success(`Subscribed to ${subTier.name}! Coins granted.`);
        await loadBalance();
        await loadTransactions();
      }
    } catch (err) {
      toast.error(err?.message || 'Subscription failed.');
    } finally {
      setPurchasing(null);
      setSubTier(null);
    }
  };

  // Load current subscription status once.
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
        const status = await svc.getSubscriptionStatus();
        if (status?.success && status.active) setCurrentSub(status.subscription);
      } catch (err) {
        console.warn('[Coins] subscription status unavailable', err);
      }
    })();
  }, [user?.uid, monetization]);

  const fetchAd = async () => {
    if (!user?.uid) return;
    setAdLoading(true);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const result = await svc.getAd('feed', user.uid, {});
      setAd(result || null);
      if (!result) toast.info('No ads available right now — check back soon.');
    } catch (err) {
      console.warn('CoinsScreen: failed to fetch sponsored ad', err);
      setAd(null);
    } finally {
      setAdLoading(false);
    }
  };

  const startWatchingAd = () => {
    if (!ad || adWatching) return;
    setAdWatching(true);
    setAdTimer(30);
    adIntervalRef.current = setInterval(() => {
      setAdTimer((t) => {
        if (t <= 1) {
          clearInterval(adIntervalRef.current);
          adIntervalRef.current = null;
          completeAd();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const completeAd = async () => {
    if (!user?.uid || !ad) return;
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const res = await svc.watchAd('feed', ad.id, 30, {});
      if (res?.success) {
        toast.success(`+${res.coinsAdded ?? AD_REWARD_COINS} coins earned!`);
        await loadBalance();
      }
    } catch (err) {
      toast.error('Ad reward could not be granted.');
    } finally {
      setAdWatching(false);
      setAd(null);
      adEligibleRef.current = Date.now();
    }
  };


  return (
    <div className={cn("min-h-screen pb-24 transition-colors", colors.bg, colors.text)}>
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 space-y-8">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-3xl p-6 sm:p-8 relative overflow-hidden border", colors.card, colors.border)}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            <div className="text-center md:text-left">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 block mb-1">
                Treasury &amp; Balance
              </span>
              <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight mb-3", colors.text)}>Your Coin Vault</h2>
              <div className="flex items-center justify-center md:justify-start gap-4">
                <div className="relative shrink-0">
                  <CoinStackIcon size={52} />
                </div>
                <div>
                  <div className="text-4xl sm:text-5xl font-black text-amber-500 dark:text-amber-400 tracking-tight tabular-nums">
                    {balanceLoading ? '…' : balance === null ? '—' : balance.toLocaleString()}
                  </div>
                  <p className={cn("text-sm font-medium mt-0.5", colors.secondary)}>Arvdoul Golden Coins</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              <div className={cn("p-4 rounded-2xl border text-center", isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200")}>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-500 tabular-nums">{AD_REWARD_COINS} / 30s</div>
                <div className={cn("text-xs mt-0.5", colors.secondary)}>Coins per ad</div>
              </div>
              <div className={cn("p-4 rounded-2xl border text-center", isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200")}>
                <div className="text-xl sm:text-2xl font-extrabold text-purple-500 dark:text-purple-400 tabular-nums">{MIN_WITHDRAWAL_COINS.toLocaleString()}+</div>
                <div className={cn("text-xs mt-0.5", colors.secondary)}>Withdrawal minimum</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Buy Coins */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className={cn("text-xl font-extrabold tracking-tight", colors.text)}>Buy Coins</h2>
              <p className={cn("text-xs", colors.secondary)}>Server-verified Stripe checkout</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Secure Payment</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {COIN_PACKAGES.map((pkg) => {
              const Icon = pkg.icon;
              const isSelected = selectedPackage === pkg.id;
              const isBuying = purchasing === pkg.id;

              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={cn(
                    "rounded-2xl p-5 cursor-pointer transition-all border flex flex-col justify-between",
                    isSelected
                      ? "border-purple-500 shadow-lg ring-1 ring-purple-500/30"
                      : colors.border,
                    colors.card
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", pkg.iconTone)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {pkg.popular && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-extrabold tabular-nums">{pkg.coins.toLocaleString()}</div>
                    <div className={cn("text-xs mb-4", colors.secondary)}>Coins</div>
                  </div>

                  <div>
                    <div className="text-xl font-bold mb-3 tabular-nums">{pkg.price}</div>
                    <button
                      type="button"
                      disabled={isBuying}
                      onClick={(e) => { e.stopPropagation(); handlePurchase(pkg); }}
                      className={cn(
                        "w-full min-h-[42px] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap disabled:opacity-60",
                        isSelected
                          ? "text-white shadow-sm hover:opacity-95"
                          : isDark
                          ? "bg-white/[0.08] text-slate-200 hover:bg-white/[0.14]"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      )}
                      style={isSelected ? { background: BRAND_GRADIENT } : undefined}
                    >
                      {isBuying ? 'Processing…' : 'Buy Coins'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Subscriptions */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className={cn("text-xl font-extrabold tracking-tight", colors.text)}>Arvdoul Pro</h2>
              <p className={cn("text-xs", colors.secondary)}>Monthly coin allocation memberships</p>
            </div>
            {currentSub && (
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 capitalize">
                Active · {currentSub.tier}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const isBuying = purchasing === tier.id;
              return (
                <div
                  key={tier.id}
                  className={cn(
                    "rounded-2xl p-6 border flex flex-col justify-between transition-all",
                    colors.card,
                    tier.popular ? "border-purple-500/70 shadow-md" : colors.border
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <h3 className={cn("text-lg font-bold", colors.text)}>{tier.name}</h3>
                      </div>
                      {tier.popular && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className={cn("text-3xl font-extrabold mb-3 tabular-nums", colors.text)}>{tier.price}</div>
                    <ul className={cn("text-sm space-y-2 mb-6", colors.secondary)}>
                      {tier.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSubscribe(tier)}
                    disabled={isBuying || currentSub?.tier === tier.id}
                    className={cn(
                      "w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer whitespace-nowrap",
                      tier.popular
                        ? "text-white shadow-sm hover:opacity-95"
                        : isDark
                        ? "bg-white/[0.08] text-slate-200 hover:bg-white/[0.14]"
                        : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    )}
                    style={tier.popular ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {currentSub?.tier === tier.id ? 'Active' : isBuying ? 'Processing…' : `Subscribe · ${tier.price}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Earn via Ads & Withdraw Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Earn via Ads (real getAd/watchAd path) */}
          <div className={cn("rounded-2xl p-6 border flex flex-col justify-between gap-4", colors.card, colors.border)}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className={cn("text-lg font-bold flex items-center gap-2", colors.text)}>
                  <Play className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Watch Ads to Earn</span>
                </h2>
                <span className={cn("text-xs font-semibold tabular-nums", colors.secondary)}>+{AD_REWARD_COINS} coins per 30s</span>
              </div>
              {ad && !adWatching ? (
                <div className={cn("mt-3 p-3 rounded-xl text-xs border", isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200")}>
                  <p className={cn("font-semibold", colors.text)}>{ad.title || 'Sponsored'}</p>
                  <p className={colors.secondary}>{ad.cta || 'Tap to watch a 30s ad and earn coins.'}</p>
                </div>
              ) : (
                <p className={cn("text-xs", colors.secondary)}>
                  Watch a verified 30-second sponsor clip to earn +{AD_REWARD_COINS} coins directly to your ledger.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={ad ? startWatchingAd : fetchAd}
              disabled={adLoading || adWatching || (adTimer > 0)}
              className={cn(
                "w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0",
                adWatching ? "bg-amber-600" : "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              {adLoading ? 'Loading…' : adWatching ? `Watching… ${adTimer}s` : ad ? 'Watch Now' : 'Find an Ad'}
            </button>
          </div>

          {/* Withdraw */}
          <div className={cn("rounded-2xl p-6 border flex flex-col justify-between gap-4", colors.card, colors.border)}>
            <div>
              <h2 className={cn("text-lg font-bold flex items-center gap-2 mb-2", colors.text)}>
                <Banknote className="w-5 h-5 text-purple-500 shrink-0" />
                <span>Withdraw Earnings</span>
              </h2>
              <p className={cn("text-xs leading-relaxed", colors.secondary)}>
                Payouts settle to your connected Stripe account (min {MIN_WITHDRAWAL_COINS.toLocaleString()} coins).
                Connect and manage your payout account from the creator payout screen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/creator-payout')}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: BRAND_GRADIENT }}
            >
              Go to Payouts
            </button>
          </div>
        </div>

        {/* Transaction History (real) */}
        <section className={cn("rounded-2xl p-6 border", colors.card, colors.border)}>
          <h2 className={cn("text-lg font-bold flex items-center gap-2 mb-4", colors.text)}>
            <History className="w-5 h-5 text-sky-500 shrink-0" />
            <span>Recent Transactions</span>
          </h2>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : transactionsError ? (
            <div className="py-2">
              <ErrorState
                title="Could not load your transaction history"
                message={transactionsError}
                onRetry={() => loadTransactions()}
              />
            </div>
          ) : transactions.length === 0 ? (
            <p className={cn("text-sm py-4", colors.secondary)}>No transactions yet — buy coins, watch ads, or send gifts to get started.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                // An unreadable amount is shown as an explicit unavailable state,
                // never a fabricated `+undefined` / `-undefined`.
                const amount = unknownNumber(tx.amount);
                const isCredit = tx.type === 'credit';
                const sign = isCredit ? '+' : '-';
                const amountLabel = amount == null ? '—' : `${sign}${amount.toLocaleString()}`;
                return (
                <div key={tx.id} className={cn("flex items-center justify-between p-3.5 rounded-xl border", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50/70 border-slate-200/80")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      isCredit ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                    )}>
                      {isCredit ? <TrendingUp className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium capitalize truncate", colors.text)}>{(tx.reason || tx.type || 'transaction').replace(/_/g, ' ')}</p>
                      <p className={cn("text-xs tabular-nums", colors.secondary)}>
                        {tx.createdAt?.toDate ? new Date(tx.createdAt.toDate()).toLocaleDateString() : tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className={cn("font-bold tabular-nums shrink-0", isCredit ? "text-emerald-500" : "text-rose-500")}>
                    {amountLabel}
                  </div>
                </div>
                );
              })}
            </div>
          )}
          {!transactionsLoading && transactionsCursor && (
            <button
              type="button"
              onClick={loadMoreTransactions}
              disabled={transactionsLoadingMore}
              className={cn(
                "mt-3 w-full min-h-[42px] py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-60 cursor-pointer",
                colors.border, colors.secondary, "hover:opacity-80"
              )}
            >
              {transactionsLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </section>

        {/* Features */}
        <section className={cn("rounded-2xl p-6 sm:p-8 border", colors.card, colors.border)}>
          <h2 className={cn("text-lg font-extrabold mb-6 text-center", colors.text)}>What Can You Do With Coins?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 flex items-center justify-center mx-auto mb-3">
                <Rocket className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className={cn("text-base font-bold mb-1.5", colors.text)}>Boost Posts</h3>
              <p className={cn("text-xs leading-relaxed", colors.secondary)}>Increase your reach and get more engagement on your content</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className={cn("text-base font-bold mb-1.5", colors.text)}>Send Gifts</h3>
              <p className={cn("text-xs leading-relaxed", colors.secondary)}>Support your favorite creators with virtual gifts</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-6 h-6 text-sky-500" />
              </div>
              <h3 className={cn("text-base font-bold mb-1.5", colors.text)}>Marketplace &amp; Polls</h3>
              <p className={cn("text-xs leading-relaxed", colors.secondary)}>Buy creator digital goods and back your predictions in community polls</p>
            </div>
          </div>
        </section>

        {/* Trust & Verification Strip (inline, no collision with BottomNav) */}
        <div className={cn("rounded-2xl border p-4 flex flex-col sm:flex-row items-center justify-between gap-3", colors.card, colors.border)}>
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className={cn("text-xs", colors.secondary)}>
              Secure Stripe payment • Coins credited after server verification • Support tickets
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/create-post')}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            Create Post with Coins
          </button>
        </div>
      </main>

      {/* Secure checkout modals */}
      <PaymentModal
        open={!!paymentPkg}
        title="Buy Coins"
        amountLabel={paymentPkg ? paymentPkg.price : ''}
        onConfirm={confirmPurchase}
        onClose={() => setPaymentPkg(null)}
      />
      <PaymentModal
        open={!!subTier}
        title={`Subscribe to ${subTier ? subTier.name : ''}`}
        amountLabel={subTier ? subTier.price : ''}
        onConfirm={confirmSubscription}
        onClose={() => setSubTier(null)}
      />
    </div>
  );
}
