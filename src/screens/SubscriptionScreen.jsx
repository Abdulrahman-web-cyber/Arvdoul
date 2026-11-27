// src/screens/SubscriptionScreen.jsx

import { useState, useCallback, useMemo, useEffect } from "react";
import { useConfirm } from '../components/Shared/ConfirmProvider.jsx';
import { BRAND_GRADIENT, brandCanvasBackground } from '../design-system/tokens.js';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../lib/utils';
import { getSubscriptionStatus, createSubscription, cancelSubscription } from '../services/monetizationService.js';
import { SUBSCRIPTION_TIERS } from '../shared/levelConfig.cjs';
import PaymentModal from '../components/Shared/PaymentModal';

// Ids, prices and monthly coin grants come from the shared config — the same
// table `functions/monetization.js#createSubscription` validates against.
// The feature bullets list ONLY what the server actually grants: the monthly
// coin credit (`creditSubscriptionCoins`).
const TIER_PRESENTATION = {
  basic: {
    name: 'Basic',
    description: 'For casual users who want an enhanced experience',
    popular: false,
    features: [],
  },
  pro: {
    name: 'Pro',
    description: 'For content creators who want to grow their audience',
    popular: true,
    features: [],
  },
  premium: {
    name: 'Premium',
    description: 'For professional creators and businesses',
    popular: false,
    features: [],
  },
};

const TIERS = Object.entries(SUBSCRIPTION_TIERS).map(([id, cfg]) => {
  const presentation = TIER_PRESENTATION[id] || { name: id, features: [] };
  return {
    id,
    name: presentation.name,
    description: presentation.description,
    popular: Boolean(presentation.popular),
    price: `$${(cfg.priceUsdCents / 100).toFixed(2)}`,
    period: '/month',
    features: [`${cfg.coinsPerMonth.toLocaleString()} coins monthly`, ...(presentation.features || [])],
  };
});

export default function SubscriptionScreen() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme !== 'light';
  const [loading, setLoading] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [subDetails, setSubDetails] = useState(null);
  const [showManage, setShowManage] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const status = await getSubscriptionStatus();
      const activeTier = status?.active ? (status.tier || status.subscription?.tier || null) : null;
      setCurrentSubscription(activeTier);
      setSubDetails(status?.active ? (status.subscription || null) : null);
    } catch (e) {
      console.warn('Subscription status read failed', e?.message);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const handleSubscribe = useCallback((tier) => {
    if (!user?.uid) {
      navigate('/login');
      return;
    }
    setSelectedTier(tier);
  }, [user?.uid, navigate]);

  const confirmSubscription = useCallback(async (paymentMethodId) => {
    if (!selectedTier || loading) return;
    setLoading(selectedTier.id);
    try {
      const res = await createSubscription(selectedTier.id, paymentMethodId);
      if (res?.success) {
        setCurrentSubscription(selectedTier.id);
        toast.success(`Subscribed to ${selectedTier.name}! Coins credited.`);
        setSelectedTier(null);
        await loadSubscription();
      } else {
        toast.error(res?.message || 'Subscription could not be completed.');
      }
    } catch (error) {
      toast.error(error?.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [selectedTier, loading, loadSubscription]);

  const handleCancel = useCallback(async () => {
    if (!user?.uid) return;
    const ok = await confirm({
      title: 'Cancel subscription?',
      description: 'You will keep access until the end of the billing period.',
      confirmText: 'Cancel subscription',
      tone: 'danger',
    });
    if (!ok) return;

    setLoading('cancel');
    try {
      await cancelSubscription();
      setCurrentSubscription(null);
      setSubDetails(null);
      setShowManage(false);
      toast.success('Subscription cancelled');
    } catch (error) {
      toast.error(error?.message || 'Failed to cancel subscription');
    } finally {
      setLoading(null);
    }
  }, [user?.uid, confirm]);

  const handleManage = useCallback(() => {
    setShowManage((prev) => !prev);
  }, []);

  const backgroundStyle = useMemo(() => ({
    background: brandCanvasBackground(isDark),
  }), [isDark]);

  return (
    <div
      className={cn(
        'min-h-screen pb-24 pt-4 px-4 transition-colors',
        isDark ? 'text-white' : 'text-slate-900'
      )}
      style={backgroundStyle}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className={cn(
          'text-3xl font-display font-bold mb-2',
          isDark ? 'text-white' : 'text-slate-900'
        )}>
          Choose Your Plan
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
          Monthly coin memberships backed by verified Stripe billing
        </p>
      </motion.div>

      {/* Current Subscription Badge */}
      {currentSubscription && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto mb-8"
        >
          <div className={cn(
            'p-4 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-3',
            isDark
              ? 'bg-[#080F2E]/85 border-white/10 text-white'
              : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-sm'
          )}>
            <div>
              <p className={cn('text-xs uppercase tracking-wider font-semibold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Current Plan
              </p>
              <p className={cn('font-bold text-base', isDark ? 'text-white' : 'text-slate-900')}>
                {TIERS.find((t) => t.id === currentSubscription)?.name || currentSubscription}
              </p>
              {subDetails?.currentPeriodEnd && (
                <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Renews {new Date(subDetails.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleManage}
              className="text-sky-500 hover:underline text-sm font-semibold cursor-pointer"
            >
              {showManage ? 'Close' : 'Manage'}
            </button>
          </div>
          {showManage && (
            <div className={cn(
              'mt-3 p-3.5 rounded-xl border flex items-center justify-between gap-3',
              isDark
                ? 'bg-[#080F2E]/70 border-white/10 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            )}>
              <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-600')}>
                Your plan renews automatically. Cancel anytime.
              </p>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading === 'cancel'}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-semibold border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                {loading === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-3">
        {TIERS.map((tier, index) => {
          const isCurrent = currentSubscription === tier.id;
          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={cn(
                'relative rounded-3xl p-6 backdrop-blur-xl border flex flex-col justify-between transition-all',
                tier.popular
                  ? isDark
                    ? 'border-purple-500/60 bg-[#080F2E]/90 shadow-xl'
                    : 'border-purple-500/70 bg-white shadow-lg'
                  : isDark
                    ? 'border-white/[0.08] bg-[#080F2E]/70'
                    : 'border-slate-200/90 bg-white/95 shadow-sm'
              )}
            >
              <div>
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="text-white text-[11px] font-bold tracking-wider px-3.5 py-1 rounded-full shadow-md whitespace-nowrap"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Tier Header */}
                <div className="text-center mb-5 mt-1">
                  <h3 className={cn(
                    'text-xl font-bold mb-1',
                    isDark ? 'text-white' : 'text-slate-900'
                  )}>
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={cn(
                      'text-4xl font-display font-bold tabular-nums',
                      isDark ? 'text-white' : 'text-slate-900'
                    )}>
                      {tier.price}
                    </span>
                    <span className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {tier.period}
                    </span>
                  </div>
                  <p className={cn(
                    'text-sm mt-2 leading-relaxed',
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  )}>
                    {tier.description}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <svg
                        className={cn(
                          'w-5 h-5 flex-shrink-0',
                          tier.popular ? 'text-purple-500' : 'text-sky-500'
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className={cn(
                        'text-sm',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      )}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Subscribe Button */}
              <motion.button
                type="button"
                whileHover={{ scale: isCurrent ? 1 : 1.01 }}
                whileTap={{ scale: isCurrent ? 1 : 0.98 }}
                onClick={() => handleSubscribe(tier)}
                disabled={loading === tier.id || isCurrent}
                style={!isCurrent && tier.popular ? { background: BRAND_GRADIENT } : undefined}
                className={cn(
                  'w-full min-h-[46px] py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer',
                  isCurrent
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default'
                    : tier.popular
                      ? 'text-white shadow-lg hover:brightness-110'
                      : isDark
                        ? 'bg-white/[0.08] border border-white/10 text-white hover:bg-white/[0.14]'
                        : 'bg-slate-100 border border-slate-200 text-slate-900 hover:bg-slate-200',
                  loading === tier.id && 'opacity-50 cursor-wait'
                )}
              >
                {loading === tier.id
                  ? 'Processing…'
                  : isCurrent
                    ? 'Current Plan'
                    : `Subscribe to ${tier.name}`}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* FAQ Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className={cn(
          'text-center text-sm mt-8',
          isDark ? 'text-slate-400' : 'text-slate-600'
        )}
      >
        Questions?{' '}
        <Link to="/help" className="text-sky-500 hover:underline font-medium">
          Contact Support
        </Link>
      </motion.p>

      {/* Stripe Checkout Modal */}
      <PaymentModal
        open={Boolean(selectedTier)}
        title={selectedTier ? `Subscribe to ${selectedTier.name}` : 'Subscribe'}
        amountLabel={selectedTier ? `${selectedTier.price}${selectedTier.period}` : ''}
        onConfirm={confirmSubscription}
        onClose={() => {
          if (!loading) setSelectedTier(null);
        }}
      />
    </div>
  );
}

