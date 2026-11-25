// src/screens/Advertising/CampaignBuilderScreen.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import advertisingService from '../../services/advertisingService.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import {
  AD_OBJECTIVES,
  AD_PLACEMENTS,
  INPUT_CLASS,
  PROMOTION_KINDS,
  SURFACE_GLASS_CLASS,
} from '../CreatePost/createPostConstants.js';

export default function CampaignBuilderScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [title, setTitle] = useState(
    searchParams.get('postId') ? 'Post Promotion Campaign' : ''
  );
  const [promotionKind, setPromotionKind] = useState(
    searchParams.get('kind') || (searchParams.get('postId') ? 'post' : 'website')
  );
  const [objective, setObjective] = useState(searchParams.get('objective') || 'reach');
  const [sourcePostId, setSourcePostId] = useState(searchParams.get('postId') || '');
  const [adAuthorizationCode, setAdAuthorizationCode] = useState(
    searchParams.get('authCode') || ''
  );
  const [placements, setPlacements] = useState(['home']);
  const [budgetType, setBudgetType] = useState('daily');
  const [budgetUsd, setBudgetUsd] = useState('15');
  const [durationDays, setDurationDays] = useState('7');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Learn More');
  const [locationsText, setLocationsText] = useState('Global');
  const [interestsText, setInterestsText] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [complianceNotes, setComplianceNotes] = useState('');
  const [submitNow, setSubmitNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const togglePlacement = (id) => {
    setPlacements((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next.length > 0 ? next : ['home'];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const budgetCents = Math.max(100, Math.round(Number(budgetUsd || 0) * 100));
    if (!title.trim()) {
      toast.error('Enter a campaign title.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await advertisingService.createAdCampaign({
        title: title.trim(),
        promotionKind,
        objective,
        sourcePostId: sourcePostId.trim() || null,
        adAuthorizationCode: adAuthorizationCode.trim(),
        placements,
        budgetType,
        budgetCents,
        currency: 'USD',
        durationDays: Math.max(1, Math.min(90, Number(durationDays || 7))),
        destinationUrl: destinationUrl.trim(),
        ctaLabel: ctaLabel.trim() || 'Learn More',
        complianceNotes: complianceNotes.trim(),
        submitForReview: submitNow,
        targeting: {
          locations: locationsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          interests: interestsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          ageMin: Math.max(13, Math.min(65, Number(ageMin || 18))),
        },
      });
      toast.success(
        submitNow
          ? 'Campaign created and submitted for ad review.'
          : 'Campaign saved as draft.'
      );
      navigate(res?.campaignId ? `/ads/analytics?campaignId=${encodeURIComponent(res.campaignId)}` : '/ads');
    } catch (err) {
      toast.error(err?.message || 'Could not create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#03071B] text-slate-900 dark:text-white px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to Advertising Center"
              onClick={() => navigate('/ads')}
              className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-white/15 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Icons.ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Create Ad Campaign
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spark-preserving promotion &amp; independent campaign builder
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-4`}>
            <h2 className="text-sm font-semibold">1. Promotion Goal &amp; Format</h2>
            <div>
              <label htmlFor="camp-title" className="block text-xs font-medium mb-1">
                Campaign Name
              </label>
              <input
                id="camp-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Summer Collection Launch"
                className={INPUT_CLASS}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROMOTION_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setPromotionKind(k.id)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    promotionKind === k.id
                      ? 'border-arvdoul-purple bg-arvdoul-purple/10'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="text-xs font-semibold block">{k.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {k.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="camp-source-post" className="block text-xs font-medium mb-1">
                  Existing Post / Spark ID (optional)
                </label>
                <input
                  id="camp-source-post"
                  type="text"
                  value={sourcePostId}
                  onChange={(e) => setSourcePostId(e.target.value)}
                  placeholder="Paste post ID to preserve organic stats"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="camp-auth-code" className="block text-xs font-medium mb-1">
                  Creator Ad Authorization Code (if partner post)
                </label>
                <input
                  id="camp-auth-code"
                  type="text"
                  value={adAuthorizationCode}
                  onChange={(e) => setAdAuthorizationCode(e.target.value.toUpperCase())}
                  placeholder="ARV-XXXX-XXXX"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-4`}>
            <h2 className="text-sm font-semibold">2. Objective &amp; Placements</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AD_OBJECTIVES.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => setObjective(obj.id)}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    objective === obj.id
                      ? 'border-arvdoul-purple bg-arvdoul-purple/10'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="text-xs font-semibold block">{obj.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{obj.desc}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AD_PLACEMENTS.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => togglePlacement(pl.id)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    placements.includes(pl.id)
                      ? 'bg-arvdoul-purple text-white border-arvdoul-purple'
                      : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-4`}>
            <h2 className="text-sm font-semibold">3. Budget, Targeting &amp; Destination</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="camp-budget-type" className="block text-xs font-medium mb-1">
                  Budget Type
                </label>
                <select
                  id="camp-budget-type"
                  value={budgetType}
                  onChange={(e) => setBudgetType(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="daily">Daily</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <div>
                <label htmlFor="camp-budget-usd" className="block text-xs font-medium mb-1">
                  Budget (USD)
                </label>
                <input
                  id="camp-budget-usd"
                  type="number"
                  min="1"
                  max="50000"
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                  required
                />
              </div>
              <div>
                <label htmlFor="camp-duration" className="block text-xs font-medium mb-1">
                  Duration (Days)
                </label>
                <input
                  id="camp-duration"
                  type="number"
                  min="1"
                  max="90"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label htmlFor="camp-age-min" className="block text-xs font-medium mb-1">
                  Min Age
                </label>
                <input
                  id="camp-age-min"
                  type="number"
                  min="13"
                  max="65"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="camp-locations" className="block text-xs font-medium mb-1">
                  Target Locations (comma-separated)
                </label>
                <input
                  id="camp-locations"
                  type="text"
                  value={locationsText}
                  onChange={(e) => setLocationsText(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="camp-interests" className="block text-xs font-medium mb-1">
                  Target Interests (comma-separated)
                </label>
                <input
                  id="camp-interests"
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="Creators, Fashion, Software"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="camp-url" className="block text-xs font-medium mb-1">
                  Destination URL (optional)
                </label>
                <input
                  id="camp-url"
                  type="url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="camp-cta" className="block text-xs font-medium mb-1">
                  CTA Button Label
                </label>
                <input
                  id="camp-cta"
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label htmlFor="camp-notes" className="block text-xs font-medium mb-1">
                Review Compliance Notes (optional)
              </label>
              <input
                id="camp-notes"
                type="text"
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                placeholder="Context for ad reviewers"
                className={INPUT_CLASS}
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={submitNow}
                onChange={(e) => setSubmitNow(e.target.checked)}
                className="w-4 h-4 accent-arvdoul-purple rounded"
              />
              <span>Submit directly to Ad Policy Review after creation</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/ads')}
              className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-6 py-2 rounded-xl text-white text-sm font-semibold shadow-lg disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              {submitting ? 'Creating Campaign...' : submitNow ? 'Create & Submit Campaign' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
