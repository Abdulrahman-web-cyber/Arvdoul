// src/screens/CreatePost/sections/PromotionIntentSection.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useCreatePostState } from '../CreatePostContext.jsx';
import {
  AD_OBJECTIVES,
  AD_PLACEMENTS,
  INPUT_CLASS,
  PROMOTION_KINDS,
  SURFACE_GLASS_CLASS,
} from '../createPostConstants.js';

export default function PromotionIntentSection() {
  const navigate = useNavigate();
  const { state, dispatch } = useCreatePostState();
  const [locationInput, setLocationInput] = useState('');
  const [interestInput, setInterestInput] = useState('');

  const promo = state.promotionIntent || {};
  const enabled = Boolean(promo.enabled);
  const placements = Array.isArray(promo.placements) ? promo.placements : ['home'];
  const locations = Array.isArray(promo.targetLocations) ? promo.targetLocations : [];
  const interests = Array.isArray(promo.targetInterests) ? promo.targetInterests : [];

  const updatePromo = (patch) => {
    dispatch({ type: 'SET_PROMOTION_INTENT', payload: patch });
  };

  const togglePlacement = (id) => {
    const exists = placements.includes(id);
    const next = exists
      ? placements.filter((p) => p !== id)
      : [...placements, id];
    updatePromo({ placements: next.length > 0 ? next : ['home'] });
  };

  const addTag = (field, rawValue, reset) => {
    const val = rawValue.trim();
    if (!val) return;
    const current = Array.isArray(promo[field]) ? promo[field] : [];
    if (!current.includes(val)) {
      updatePromo({ [field]: [...current, val].slice(0, 20) });
    }
    reset('');
  };

  const removeTag = (field, val) => {
    const current = Array.isArray(promo[field]) ? promo[field] : [];
    updatePromo({ [field]: current.filter((x) => x !== val) });
  };

  const dailyUsd = ((Number(promo.dailyBudgetCents || 1000)) / 100).toFixed(2);
  const totalEstimatedUsd = (
    ((Number(promo.dailyBudgetCents || 1000)) * Math.max(1, Number(promo.durationDays || 7))) /
    100
  ).toFixed(2);

  return (
    <section
      id="composer-section-promotion"
      aria-labelledby="heading-promotion"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
            07
          </span>
          <div>
            <h3 id="heading-promotion" className="text-sm font-semibold text-slate-900 dark:text-white">
              Promotion &amp; Ad Campaign Setup
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Spark-style promotion that preserves your original post and organic engagement
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/ads/create')}
          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-arvdoul-purple/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Icons.ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Ads Center</span>
        </button>
      </div>

      <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] cursor-pointer">
        <div>
          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
            Create an Ad Campaign when this post publishes
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Billed strictly from your separate Advertiser Account in the Advertising Center (never Virtual Coins).
          </span>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => updatePromo({ enabled: e.target.checked })}
          className="w-4 h-4 accent-arvdoul-purple rounded shrink-0"
        />
      </label>

      {enabled && (
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-arvdoul-purple/8 border border-arvdoul-purple/25 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
            <Icons.Layers className="w-4 h-4 text-arvdoul-purple shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Original post preservation active: Likes, comments, shares, and saves from paid delivery stay attributed directly to your published post without creating duplicates.
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Promotion Type
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROMOTION_KINDS.map((k) => {
                const active = (promo.promotionKind || 'post') === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => updatePromo({ promotionKind: k.id })}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-arvdoul-purple bg-arvdoul-purple/10'
                        : 'border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                      {k.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {k.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Campaign Objective
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AD_OBJECTIVES.map((obj) => {
                const active = (promo.objective || 'reach') === obj.id;
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => updatePromo({ objective: obj.id })}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-arvdoul-purple bg-arvdoul-purple/10'
                        : 'border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                      {obj.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {obj.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Eligible Placements
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AD_PLACEMENTS.map((pl) => {
                const active = placements.includes(pl.id);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => togglePlacement(pl.id)}
                    className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-arvdoul-purple text-white border-arvdoul-purple'
                        : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {pl.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="promo-daily-budget"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Daily Budget (USD)
              </label>
              <input
                id="promo-daily-budget"
                type="number"
                min="1"
                max="10000"
                step="1"
                value={Math.max(1, Math.round((promo.dailyBudgetCents || 1000) / 100))}
                onChange={(e) => {
                  const dollars = Math.max(1, Math.min(10000, Number(e.target.value) || 1));
                  updatePromo({ dailyBudgetCents: dollars * 100 });
                }}
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>

            <div>
              <label
                htmlFor="promo-duration-days"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Duration (Days)
              </label>
              <input
                id="promo-duration-days"
                type="number"
                min="1"
                max="90"
                value={promo.durationDays || 7}
                onChange={(e) =>
                  updatePromo({ durationDays: Math.max(1, Math.min(90, Number(e.target.value) || 1)) })
                }
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>

            <div>
              <label
                htmlFor="promo-min-age"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Minimum Target Age
              </label>
              <input
                id="promo-min-age"
                type="number"
                min="13"
                max="65"
                value={promo.targetAgeMin || 18}
                onChange={(e) =>
                  updatePromo({ targetAgeMin: Math.max(13, Math.min(65, Number(e.target.value) || 18)) })
                }
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="promo-location-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Target Locations
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-location-input"
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag('targetLocations', locationInput, setLocationInput);
                    }
                  }}
                  placeholder="e.g. Lagos, London, Global"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => addTag('targetLocations', locationInput, setLocationInput)}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Add
                </button>
              </div>
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => removeTag('targetLocations', loc)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <span>{loc}</span>
                      <Icons.X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="promo-interest-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Target Interests
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-interest-input"
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag('targetInterests', interestInput, setInterestInput);
                    }
                  }}
                  placeholder="e.g. Music, Creators, Tech"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => addTag('targetInterests', interestInput, setInterestInput)}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Add
                </button>
              </div>
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {interests.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => removeTag('targetInterests', item)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <span>{item}</span>
                      <Icons.X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="promo-compliance-notes"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Ad Review Notes (optional)
            </label>
            <input
              id="promo-compliance-notes"
              type="text"
              value={promo.complianceNotes || ''}
              onChange={(e) => updatePromo({ complianceNotes: e.target.value })}
              placeholder="Provide context for ad policy reviewers"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 text-xs tabular-nums">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Planned Campaign Budget: </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                ${dailyUsd}/day · ${totalEstimatedUsd} over {promo.durationDays || 7} days
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(promo.submitForReview)}
                onChange={(e) => updatePromo({ submitForReview: e.target.checked })}
                className="w-4 h-4 accent-arvdoul-purple rounded"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Submit immediately for ad review
              </span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
