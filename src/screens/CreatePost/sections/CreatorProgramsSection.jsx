// src/screens/CreatePost/sections/CreatorProgramsSection.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCreatePostState } from '../CreatePostContext.jsx';
import { SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { resolveCreatorFlag } from '../../../services/profileReadModel.js';
import { getPayoutSettings } from '../../../services/monetizationService.js';

export default function CreatorProgramsSection() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { state, dispatch } = useCreatePostState();
  const [payoutReady, setPayoutReady] = useState(null);

  const isCreator = resolveCreatorFlag(userProfile || {}, user || {}, userProfile?.level);
  const programs = state.creatorPrograms || {};

  useEffect(() => {
    let active = true;
    if (!user?.uid) return undefined;
    getPayoutSettings()
      .then((res) => {
        if (active) setPayoutReady(res?.status === 'ready');
      })
      .catch((err) => {
        // Non-blocking: payout onboarding status falls back to unknown
        console.warn('[CreatorProgramsSection] Payout status read note:', err?.message);
        if (active) setPayoutReady(false);
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const toggleProgram = (key) => {
    dispatch({
      type: 'SET_CREATOR_PROGRAMS',
      payload: { [key]: !programs[key] },
    });
  };

  return (
    <section
      id="composer-section-programs"
      aria-labelledby="heading-programs"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
            06
          </span>
          <div>
            <h3 id="heading-programs" className="text-sm font-semibold text-slate-900 dark:text-white">
              Creator Monetization &amp; Eligibility
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Server-verified revenue eligibility separated across Arvdoul&apos;s three financial ledgers
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-semibold ${
            isCreator ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {isCreator ? 'Creator Eligible' : 'Creator Onboarding Required for Ad Share'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[
          { key: 'enableGiftsForPost', label: 'Virtual gifts & creator tips', alwaysAllowed: true },
          { key: 'enableAdRevenueShare', label: 'Creator ad-revenue share pool', alwaysAllowed: false },
          { key: 'enableAffiliateTracking', label: 'Affiliate link conversion tracking', alwaysAllowed: true },
          { key: 'enableSponsorshipAttribution', label: 'Brand sponsorship ledger attribution', alwaysAllowed: true },
        ].map((item) => {
          const disabled = !item.alwaysAllowed && !isCreator;
          const checked = item.key === 'enableGiftsForPost' ? programs[item.key] !== false : Boolean(programs[item.key]);
          return (
            <label
              key={item.key}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {item.label}
              </span>
              <input
                type="checkbox"
                disabled={disabled}
                checked={disabled ? false : checked}
                onChange={() => toggleProgram(item.key)}
                className="w-4 h-4 accent-arvdoul-purple rounded"
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-left hover:border-arvdoul-purple/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span>Virtual Coins Wallet</span>
            <Icons.Coins className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">Gifts, Tips &amp; Purchases</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/creator-payout')}
          className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-left hover:border-arvdoul-purple/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span>Creator Earnings Ledger</span>
            <Icons.Banknote className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {payoutReady ? 'Payouts Connected' : 'Manage Creator Payouts'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/ads/billing')}
          className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-left hover:border-arvdoul-purple/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span>Advertiser Billing</span>
            <Icons.CreditCard className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">Separate Ad Spend Ledger</p>
        </button>
      </div>
    </section>
  );
}
