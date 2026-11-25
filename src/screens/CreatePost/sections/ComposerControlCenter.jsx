// src/screens/CreatePost/sections/ComposerControlCenter.jsx
import { useState } from 'react';
import { useCreatePostServices, useCreatePostState } from '../CreatePostContext.jsx';
import { COMPOSER_SECTIONS, SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { ModerationStatus, ReviewSummary } from '../ComposerPanels.jsx';
import LoadingSpinner from '../../../components/Shared/LoadingSpinner.jsx';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import PublishingIdentitySection from './PublishingIdentitySection.jsx';
import AudienceDistributionSection from './AudienceDistributionSection.jsx';
import EngagementCommunitySection from './EngagementCommunitySection.jsx';
import CommercialPartnershipsSection from './CommercialPartnershipsSection.jsx';
import CreatorProgramsSection from './CreatorProgramsSection.jsx';
import PromotionIntentSection from './PromotionIntentSection.jsx';
import ComposerAnalyticsSection from './ComposerAnalyticsSection.jsx';
import SafetyAccessibilitySection from './SafetyAccessibilitySection.jsx';
import SchedulingLifecycleSection from './SchedulingLifecycleSection.jsx';

export default function ComposerControlCenter() {
  const { state, dispatch } = useCreatePostState();
  const { publishPost, saveDraft } = useCreatePostServices();
  const [activeKey, setActiveKey] = useState('identity');

  const jumpToSection = (key) => {
    setActiveKey(key);
    if (key === 'content') {
      dispatch({ type: 'SET_STEP', payload: 2 });
      return;
    }
    const el = document.getElementById(`composer-section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-5 space-y-5">
      {/* Sticky 01..10 Jump Navigation */}
      <nav
        aria-label="Composer control center sections"
        className="sticky top-[57px] z-10 -mx-1 px-2 py-2 rounded-2xl bg-[#F6F8FC]/90 dark:bg-[#03071B]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 overflow-x-auto"
      >
        <div className="flex items-center gap-1.5 min-w-max">
          {COMPOSER_SECTIONS.map((sec) => {
            const isActive = activeKey === sec.key;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => jumpToSection(sec.key)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
                }`}
                style={isActive ? { background: BRAND_GRADIENT } : undefined}
              >
                {sec.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <PublishingIdentitySection />
          <AudienceDistributionSection />
          <EngagementCommunitySection />
          <CommercialPartnershipsSection />
          <CreatorProgramsSection />
          <PromotionIntentSection />
          <ComposerAnalyticsSection />
          <SafetyAccessibilitySection />
          <SchedulingLifecycleSection />
        </div>

        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-[122px]">
          <ReviewSummary />
          <ModerationStatus defaultOpen={false} />

          <div className={`${SURFACE_GLASS_CLASS} p-4 space-y-3`}>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {state.scheduledTime ? 'Ready to schedule' : 'Ready to publish'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {state.promotionIntent?.enabled && !state.scheduledTime
                  ? 'Publishes your post and drafts the linked Advertising Center campaign.'
                  : state.scheduledTime
                  ? `Scheduled for ${new Date(state.scheduledTime).toLocaleString()}`
                  : 'Published posts appear immediately for your selected audience.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveDraft}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => publishPost()}
                disabled={state.loading}
                className="min-h-[44px] flex-1 px-5 py-2 rounded-xl font-semibold text-white text-sm shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                style={{ background: BRAND_GRADIENT }}
              >
                {state.loading ? (
                  <>
                    <LoadingSpinner size="xs" color="white" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <span>
                    {state.editPostId
                      ? 'Save Changes'
                      : state.scheduledTime
                      ? 'Schedule Post'
                      : state.promotionIntent?.enabled
                      ? 'Publish & Setup Ad'
                      : 'Publish Now'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
