// src/screens/SubscriptionScreen.jsx - ARVDOUL SUBSCRIPTION TIERS
// Per Constitution v5.0 - Premium/Creator/Enterprise tiers
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../lib/utils';

const TIERS = [
  {
    id: 'premium',
    name: 'Premium',
    price: '$4.99',
    period: '/month',
    description: 'For casual users who want an enhanced experience',
    features: [
      'Ad-free browsing',
      '500 coins monthly',
      'Priority support',
      'Enhanced privacy controls',
      'Custom profile themes',
    ],
    popular: false,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$9.99',
    period: '/month',
    description: 'For content creators who want to grow their audience',
    features: [
      'Everything in Premium',
      '2,000 coins monthly',
      'Creator badge',
      'Advanced analytics',
      'Boost discounts (20%)',
      'Early access to features',
      'Verified badge option',
    ],
    popular: true,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$24.99',
    period: '/month',
    description: 'For professional creators and businesses',
    features: [
      'Everything in Creator',
      '10,000 coins monthly',
      'Priority payouts',
      'Dedicated support',
      'Custom branding',
      'API access',
      'White-label options',
      'Team management (up to 10)',
    ],
    popular: false,
    color: 'from-orange-500 to-red-500',
  },
];

export default function SubscriptionScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);

  const handleSubscribe = useCallback(async (tier) => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    setLoading(tier.id);
    try {
      // In production, this would call monetizationService.createSubscription()
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentSubscription(tier.id);
      toast.success(`Subscribed to ${tier.name}!`);
    } catch (error) {
      toast.error('Subscription failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [user, navigate]);

  const handleManage = useCallback(() => {
    toast.info('Managing subscription...');
  }, []);

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  return (
    <div 
      className="min-h-screen pb-20 pt-4 px-4"
      style={backgroundStyle}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className={cn(
          "text-3xl font-display font-bold mb-2",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Choose Your Plan
        </h1>
        <p className={isDark ? "text-arvdoul-text-secondary" : "text-gray-600"}>
          Unlock the full power of Arvdoul
        </p>
      </motion.div>

      {/* Current Subscription Badge */}
      {currentSubscription && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto mb-6"
        >
          <div className={cn(
            "p-4 rounded-arvdoul-lg",
            "bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border",
            "flex items-center justify-between"
          )}>
            <div>
              <p className="text-sm text-arvdoul-text-secondary">Current Plan</p>
              <p className="text-white font-semibold">
                {TIERS.find(t => t.id === currentSubscription)?.name}
              </p>
            </div>
            <button
              onClick={handleManage}
              className="text-arvdoul-blue text-sm hover:underline"
            >
              Manage
            </button>
          </div>
        </motion.div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-3">
        {TIERS.map((tier, index) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "relative rounded-arvdoul-xl p-6",
              "backdrop-blur-xl border",
              tier.popular 
                ? "border-arvdoul-purple bg-arvdoul-surface" 
                : "border-arvdoul-border bg-arvdoul-surface/50",
              isDark ? "bg-arvdoul-surface/50" : "bg-white/85"
            )}
          >
            {/* Popular Badge */}
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-arvdoul-gradient text-white text-xs font-semibold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}

            {/* Tier Header */}
            <div className="text-center mb-4">
              <h3 className={cn(
                "text-xl font-bold mb-1",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {tier.name}
              </h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className={cn(
                  "text-4xl font-display font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {tier.price}
                </span>
                <span className="text-arvdoul-text-secondary text-sm">
                  {tier.period}
                </span>
              </div>
              <p className={cn(
                "text-sm mt-2",
                isDark ? "text-arvdoul-text-secondary" : "text-gray-500"
              )}>
                {tier.description}
              </p>
            </div>

            {/* Features List */}
            <ul className="space-y-3 mb-6">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg 
                    className={cn(
                      "w-5 h-5 flex-shrink-0",
                      tier.popular ? "text-arvdoul-purple" : "text-arvdoul-blue"
                    )} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className={cn(
                    "text-sm",
                    isDark ? "text-arvdoul-text-secondary" : "text-gray-600"
                  )}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* Subscribe Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSubscribe(tier)}
              disabled={loading === tier.id || currentSubscription === tier.id}
              className={cn(
                "w-full py-3 px-4 rounded-arvdoul-md font-semibold",
                "transition-all duration-300",
                currentSubscription === tier.id
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : tier.popular
                    ? "bg-arvdoul-gradient text-white shadow-arvdoul-button"
                    : isDark
                      ? "bg-arvdoul-surface border border-arvdoul-border text-white hover:border-arvdoul-purple/50"
                      : "bg-gray-100 border border-gray-200 text-gray-900 hover:bg-gray-200",
                (loading === tier.id) && "opacity-50 cursor-wait"
              )}
            >
              {loading === tier.id ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : currentSubscription === tier.id ? (
                'Current Plan'
              ) : (
                `Subscribe to ${tier.name}`
              )}
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* FAQ Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={cn(
          "text-center text-sm mt-8",
          isDark ? "text-arvdoul-text-secondary" : "text-gray-500"
        )}
      >
        Questions?{' '}
        <a href="#" className="text-arvdoul-blue hover:underline">
          Contact Support
        </a>
      </motion.p>
    </div>
  );
}
