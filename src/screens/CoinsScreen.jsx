// src/screens/CoinsScreen.jsx - ARVDOUL COINS & MONETIZATION (PRODUCTION)
// Real flows only: live balance, CF-verified purchases, ad-earn rewards,
// transaction history and withdrawal requests. No demo/simulated paths.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

import {
  Coins, CreditCard, Wallet, Crown, Zap, Rocket, Star,
  CheckCircle, Shield, Gift, TrendingUp, ArrowLeft, Play,
  History, Banknote, AlertTriangle, Loader2, RefreshCw, Sparkles
} from 'lucide-react';
import PaymentModal from '../components/Shared/PaymentModal';

// Package ids MUST match the Cloud Function COIN_PACKAGES contract
// (functions/monetization.js). Prices are the USD cents charged server-side.
const COIN_PACKAGES = [
  { id: 'coins_100',  coins: 100,  price: '$0.99',  bonus: 0,   popular: false, icon: Coins,   color: 'from-amber-500 to-yellow-500' },
  { id: 'coins_500',  coins: 500,  price: '$4.99',  bonus: 50,  popular: true,  icon: Crown,   color: 'from-purple-500 to-pink-500' },
  { id: 'coins_1200', coins: 1200, price: '$9.99',  bonus: 200, popular: false, icon: Star,    color: 'from-blue-500 to-cyan-500' },
  { id: 'coins_2500', coins: 2500, price: '$19.99', bonus: 500, popular: false, icon: Rocket,  color: 'from-orange-500 to-red-500' },
  { id: 'coins_5000', coins: 5000, price: '$39.99', bonus: 1500, popular: false, icon: Zap,    color: 'from-green-500 to-emerald-500' },
];

const WITHDRAWAL_MIN_COINS = 5000;
const AD_REWARD_COINS = 2; // coins per 30s (matches functions/monetization.js AD_REWARD_PER_30S)

export default function CoinsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [monetization, setMonetization] = useState(null);

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

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
  const [subscriptions, setSubscriptions] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);

  const SUBSCRIPTION_TIERS = [
    { id: 'basic', name: 'Basic', coinsPerMonth: 500, price: '$4.99/mo', perks: ['500 coins monthly', 'Ad-free browsing', 'Priority support'] },
    { id: 'pro', name: 'Pro', coinsPerMonth: 2000, price: '$9.99/mo', popular: true, perks: ['2,000 coins monthly', 'Creator badge', 'Advanced analytics', 'Boost discounts'] },
    { id: 'premium', name: 'Premium', coinsPerMonth: 5000, price: '$19.99/mo', perks: ['5,000 coins monthly', 'Verified badge', 'Early features', 'Top support'] },
  ];

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? 'bg-gradient-to-b from-gray-900 via-gray-950 to-black' : 'bg-gradient-to-b from-blue-50 via-white to-white',
    card: isDark ? 'bg-gray-800/90' : 'bg-white/95',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const loadBalance = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      if (!monetization) setMonetization(svc);
      const bal = await svc.getBalance(user.uid);
      setBalance(typeof bal === 'number' ? bal : Number(bal?.coins ?? bal?.balance ?? 0));
    } catch (err) {
      toast.error('Could not load your coin balance.');
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.uid, monetization]);

  const loadTransactions = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const txs = await svc.getTransactionHistory(user.uid, 15);
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch (err) {
      // Non-fatal: history may be gated by rules until the P0 rules deploy.
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [user?.uid, monetization]);

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
        toast.success(`+${paymentPkg.coins + paymentPkg.bonus} coins added to your account`);
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
      } catch (err) { /* non-fatal */ }
    })();
  }, [user?.uid, monetization]);

  // ==================== AD EARNING (real getAd/watchAd flow) ====================
  const fetchAd = async () => {
    if (!user?.uid) return;
    setAdLoading(true);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const result = await svc.getAd('feed', user.uid, {});
      setAd(result?.ad || null);
      if (!result?.ad) toast.info('No ads available right now — check back soon.');
    } catch (err) {
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

  // ==================== WITHDRAWAL (real requestWithdrawal CF) ====================
  const handleWithdraw = async () => {
    if (!user?.uid || withdrawing) return;
    const amount = Number(withdrawAmount);
    if (!amount || amount < WITHDRAWAL_MIN_COINS) {
      toast.error(`Minimum withdrawal is ${WITHDRAWAL_MIN_COINS.toLocaleString()} coins.`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(withdrawEmail)) {
      toast.error('Enter a valid PayPal email.');
      return;
    }
    setWithdrawing(true);
    try {
      const svc = monetization || (await import('../services/monetizationService.js')).getMonetizationService();
      const res = await svc.requestWithdrawal(user.uid, amount, 'paypal', { email: withdrawEmail });
      if (res?.success) {
        toast.success('Withdrawal request submitted for review.');
        setWithdrawAmount('');
        setWithdrawEmail('');
        await loadBalance();
      }
    } catch (err) {
      toast.error(err?.message || 'Withdrawal request failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className={cn("min-h-screen pb-24", colors.bg)}>
      {/* Header */}
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, colors.border)}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="p-3 rounded-xl hover:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Arvdoul Coins
              </h1>
              <p className={cn("text-sm", colors.secondary)}>Premium currency for boosts, gifts & rewards</p>
            </div>

            <button
              onClick={loadBalance}
              aria-label="Refresh balance"
              className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-amber-500" />
              {balanceLoading ? (
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              ) : (
                <span className="font-bold text-amber-500">{(balance ?? 0).toLocaleString()}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl p-6 mb-8 relative overflow-hidden", colors.card, colors.border, "border")}
        >
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/10 blur-2xl" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            <div className="text-center md:text-left">
              <h2 className={cn("text-3xl font-bold mb-2", colors.text)}>Your Coin Balance</h2>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <div className="relative">
                  <Coins className="w-12 h-12 text-amber-500" />
                  <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-sm" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-amber-500">
                    {balanceLoading ? '…' : (balance ?? 0).toLocaleString()}
                  </div>
                  <p className={cn("text-lg", colors.secondary)}>Arvdoul Coins</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-xl text-center", colors.card, colors.border, "border")}>
                <div className="text-2xl font-bold text-green-500">2 / 30s</div>
                <div className={cn("text-sm", colors.secondary)}>Coins per ad</div>
              </div>
              <div className={cn("p-4 rounded-xl text-center", colors.card, colors.border, "border")}>
                <div className="text-2xl font-bold text-purple-500">{WITHDRAWAL_MIN_COINS.toLocaleString()}+</div>
                <div className={cn("text-sm", colors.secondary)}>Withdrawal minimum</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Buy Coins */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-2xl font-bold", colors.text)}>Buy Coins</h2>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Secure Payment</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {COIN_PACKAGES.map((pkg) => {
              const Icon = pkg.icon;
              const isSelected = selectedPackage === pkg.id;
              const isBuying = purchasing === pkg.id;

              return (
                <motion.div
                  key={pkg.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={cn(
                    "relative rounded-2xl p-6 cursor-pointer transition-all duration-300",
                    "border-2 backdrop-blur-sm",
                    isSelected
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-500/10 shadow-xl"
                      : colors.border,
                    colors.card,
                    "hover:shadow-lg"
                  )}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl mb-4 flex items-center justify-center mx-auto",
                      `bg-gradient-to-br ${pkg.color}`
                    )}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{pkg.coins.toLocaleString()}</div>
                    <div className={cn("text-sm mb-2", colors.secondary)}>Coins</div>
                    {pkg.bonus > 0 && (
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-500 text-sm font-bold">
                        +{pkg.bonus} Bonus
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold mb-4">{pkg.price}</div>
                    <button
                      disabled={isBuying}
                      onClick={(e) => { e.stopPropagation(); handlePurchase(pkg); }}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-60",
                        isSelected
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
                          : "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200 hover:opacity-90"
                      )}
                    >
                      {isBuying ? 'PROCESSING…' : 'BUY NOW'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-2xl font-bold", colors.text)}>Arvdoul Pro</h2>
            {currentSub && (
              <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-violet-500 text-sm font-semibold">
                {currentSub.tier} · active
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const isBuying = purchasing === tier.id;
              return (
                <motion.div
                  key={tier.id}
                  whileHover={{ scale: 1.03 }}
                  className={cn("relative rounded-2xl p-6", colors.card, colors.border, "border", tier.popular && "border-violet-500 shadow-xl")}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-bold">
                      POPULAR
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-violet-500" />
                    <h3 className={cn("text-lg font-bold", colors.text)}>{tier.name}</h3>
                  </div>
                  <div className={cn("text-3xl font-bold mb-1", colors.text)}>{tier.price}</div>
                  <ul className={cn("text-sm space-y-2 mb-6", colors.secondary)}>
                    {tier.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={isBuying || currentSub?.tier === tier.id}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition disabled:opacity-50",
                      tier.popular
                        ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                        : "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200"
                    )}
                  >
                    {currentSub?.tier === tier.id ? 'ACTIVE' : isBuying ? 'PROCESSING…' : `Subscribe · ${tier.price}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Earn via Ads (real getAd/watchAd path) */}
        <div className={cn("rounded-2xl p-6 mb-8", colors.card, colors.border, "border")}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn("text-xl font-bold flex items-center gap-2", colors.text)}>
              <Play className="w-5 h-5 text-green-500" /> Earn Coins by Watching Ads
            </h2>
            <span className={cn("text-sm", colors.secondary)}>+{AD_REWARD_COINS} coins per 30s</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={ad ? startWatchingAd : fetchAd}
              disabled={adLoading || adWatching || (adTimer > 0)}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60",
                adWatching ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-green-500 to-emerald-500"
              )}
            >
              {adLoading ? 'Loading…' : adWatching ? `Watching… ${adTimer}s` : ad ? 'Watch Now' : 'Find an Ad'}
            </button>

            {ad && !adWatching && (
              <div className={cn("flex-1 p-3 rounded-xl text-sm", colors.card, "border", colors.border)}>
                <p className={cn("font-semibold", colors.text)}>{ad.title || 'Sponsored'}</p>
                <p className={colors.secondary}>{ad.cta || 'Tap to watch a 30s ad and earn coins.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Withdraw */}
        <div className={cn("rounded-2xl p-6 mb-8", colors.card, colors.border, "border")}>
          <h2 className={cn("text-xl font-bold flex items-center gap-2 mb-4", colors.text)}>
            <Banknote className="w-5 h-5 text-purple-500" /> Withdraw Earnings
          </h2>
          <p className={cn("text-sm mb-4", colors.secondary)}>
            Request a payout (min {WITHDRAWAL_MIN_COINS.toLocaleString()} coins). Requests are reviewed and paid out via the
            secure payout pipeline.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input
              type="number"
              min={WITHDRAWAL_MIN_COINS}
              placeholder={`Amount (min ${WITHDRAWAL_MIN_COINS.toLocaleString()})`}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className={cn("px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500", colors.card, colors.border, colors.text)}
            />
            <input
              type="email"
              placeholder="PayPal email"
              value={withdrawEmail}
              onChange={(e) => setWithdrawEmail(e.target.value)}
              className={cn("px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500", colors.card, colors.border, colors.text)}
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-600 hover:to-violet-600 transition-all disabled:opacity-60"
          >
            {withdrawing ? 'SUBMITTING…' : 'REQUEST WITHDRAWAL'}
          </button>
        </div>

        {/* Transaction History (real) */}
        <div className={cn("rounded-2xl p-6", colors.card, colors.border, "border")}>
          <h2 className={cn("text-xl font-bold flex items-center gap-2 mb-4", colors.text)}>
            <History className="w-5 h-5 text-blue-500" /> Recent Transactions
          </h2>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <p className={cn("text-sm py-4", colors.secondary)}>No transactions yet — buy coins, watch ads, or send gifts to get started.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className={cn("flex items-center justify-between p-3 rounded-xl", colors.card, "border", colors.border)}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      tx.type === 'credit' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                    )}>
                      {tx.type === 'credit' ? <TrendingUp className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium capitalize", colors.text)}>{(tx.reason || tx.type || 'transaction').replace(/_/g, ' ')}</p>
                      <p className={cn("text-xs", colors.secondary)}>
                        {tx.createdAt?.toDate ? new Date(tx.createdAt.toDate()).toLocaleDateString() : new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={cn("font-bold", tx.type === 'credit' ? "text-green-500" : "text-red-500")}>
                    {tx.type === 'credit' ? '+' : '-'}{tx.amount?.toLocaleString?.() ?? tx.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className={cn("rounded-2xl p-8 mt-8", colors.card, colors.border, "border")}>
          <h2 className={cn("text-2xl font-bold mb-8 text-center", colors.text)}>What Can You Do With Coins?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Boost Posts</h3>
              <p className={colors.secondary}>Increase your reach and get more engagement on your content</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Send Gifts</h3>
              <p className={colors.secondary}>Support your favorite creators with virtual gifts</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Premium Features</h3>
              <p className={colors.secondary}>Unlock exclusive features and monetization options</p>
            </div>
          </div>
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

      {/* Bottom Bar */}
      <div className={cn("fixed bottom-0 left-0 right-0 border-t backdrop-blur-xl", colors.card, colors.border)}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className={cn("text-sm", colors.secondary)}>Secure payment • Instant delivery • 24/7 support</span>
            </div>
            <button
              onClick={() => navigate('/create-post')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold hover:from-amber-600 hover:to-yellow-600 transition-all"
            >
              Create Post with Coins
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
