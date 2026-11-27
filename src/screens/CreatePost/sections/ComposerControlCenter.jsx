// src/screens/CreatePost/sections/ComposerControlCenter.jsx
import { useMemo, useState } from 'react';
import {
  Globe,
  Users,
  Lock,
  Sparkles,
  Megaphone,
  BadgeCheck,
  BarChart2,
  Calendar,
  Link as LinkIcon,
  Headphones,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { useCreatePostServices, useCreatePostState } from '../CreatePostContext.jsx';
import { COMPOSER_SECTIONS, SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { ModerationStatus, ReviewSummary } from '../ComposerPanels.jsx';
import LoadingSpinner from '../../../components/Shared/LoadingSpinner.jsx';
import { LazyImage } from '../../../components/Shared/LazyImage.jsx';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import { pickDisplayName, deriveHandle } from '../../../services/profileReadModel.js';
import { getSafeAvatarUrl } from '../../../utils/avatarUtils.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import PublishingIdentitySection from './PublishingIdentitySection.jsx';
import AudienceDistributionSection from './AudienceDistributionSection.jsx';
import EngagementCommunitySection from './EngagementCommunitySection.jsx';
import CommercialPartnershipsSection from './CommercialPartnershipsSection.jsx';
import CreatorProgramsSection from './CreatorProgramsSection.jsx';
import PromotionIntentSection from './PromotionIntentSection.jsx';
import ComposerAnalyticsSection from './ComposerAnalyticsSection.jsx';
import SafetyAccessibilitySection from './SafetyAccessibilitySection.jsx';
import SchedulingLifecycleSection from './SchedulingLifecycleSection.jsx';

function LivePostPreviewCard({ state, user }) {
  const authorName = pickDisplayName([user?.displayName, user?.name, user?.username], { fallback: 'Citizen' });
  const handle = deriveHandle(user?.username);
  const avatar = getSafeAvatarUrl(user?.photoURL, authorName, user?.uid);
  const visibility = state.visibility || 'public';
  const VisibilityIcon = visibility === 'private' ? Lock : visibility === 'connections' || visibility === 'followers' ? Users : Globe;
  const visibilityLabel =
    visibility === 'private'
      ? 'Only me'
      : visibility === 'connections'
      ? 'Connections'
      : visibility === 'followers'
      ? 'Followers'
      : 'Public';

  const mediaList = Array.isArray(state.mediaItems) ? state.mediaItems : [];
  const plainText = useMemo(() => {
    const raw = typeof state.content === 'string' ? state.content : '';
    return raw.replace(/<[^>]+>/g, '').trim();
  }, [state.content]);

  const disclosure = state.commercialSettings?.disclosureType || 'none';
  const hasPoll = state.postType === 'poll' && Array.isArray(state.typeData?.poll?.options);
  const hasEvent = state.postType === 'event' && (state.typeData?.event?.title || state.typeData?.event?.date);
  const hasLink = state.postType === 'link' && state.typeData?.link?.url;
  const hasAudio = state.postType === 'audio' && (state.typeData?.audio?.title || state.typeData?.audio?.url);

  return (
    <section
      aria-label="Live feed post preview"
      className={`${SURFACE_GLASS_CLASS} p-4 space-y-3 relative overflow-hidden`}
    >
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: BRAND_GRADIENT }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Feed Preview
        </span>
        <div className="flex items-center gap-1.5">
          {state.promotionIntent?.enabled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              <span>Ad Draft</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            <VisibilityIcon className="w-3 h-3" aria-hidden="true" />
            <span>{visibilityLabel}</span>
          </span>
        </div>
      </div>

      {/* Author Row */}
      <div className="flex items-center gap-2.5">
        <LazyImage
          src={avatar}
          alt={authorName}
          className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200/80 dark:border-white/15"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{authorName}</span>
            {user?.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {handle ? `@${handle}` : 'Arvdoul Citizen'} · {state.scheduledTime ? 'Scheduled' : 'Just now'}
          </p>
        </div>
      </div>

      {/* Commercial / Partnership Disclosure */}
      {disclosure !== 'none' && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20">
          <Megaphone className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>
            {disclosure === 'paid_partnership'
              ? `Paid partnership${state.commercialSettings?.brandPartnerName ? ` with ${state.commercialSettings.brandPartnerName}` : ''}`
              : disclosure === 'sponsored_ad'
              ? 'Sponsored post'
              : 'Promotional / Affiliate'}
          </span>
        </div>
      )}

      {/* Body text */}
      {plainText ? (
        <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 line-clamp-4 whitespace-pre-line">
          {plainText}
        </p>
      ) : null}

      {/* Media strip */}
      {mediaList.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {mediaList.slice(0, 3).map((m, idx) => {
            const thumb = m.thumbnailUrl || m.thumbnail || m.preview || m.url;
            const isVideo = m.type?.startsWith('video') || m.file?.type?.startsWith('video');
            return (
              <div
                key={m.id || idx}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-center justify-center"
              >
                {thumb ? (
                  <LazyImage src={thumb} alt={`Media ${idx + 1}`} className="w-full h-full object-cover" />
                ) : isVideo ? (
                  <Film className="w-5 h-5 text-slate-400" aria-hidden="true" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
                )}
                {idx === 2 && mediaList.length > 3 && (
                  <div className="absolute inset-0 bg-black/55 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    +{mediaList.length - 3}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Specialized post-type card preview */}
      {hasPoll && (
        <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <BarChart2 className="w-3.5 h-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
            <span className="truncate">{state.typeData.poll.question || 'Poll options'}</span>
          </div>
          {state.typeData.poll.options.filter(Boolean).slice(0, 2).map((opt, i) => (
            <div
              key={i}
              className="px-2.5 py-1 rounded-lg text-[11px] bg-white/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 truncate"
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      {hasEvent && (
        <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center gap-2 text-[11px]">
          <Calendar className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
              {state.typeData.event.title || 'Community Event'}
            </p>
            {state.typeData.event.date && (
              <p className="text-slate-500 dark:text-slate-400 truncate">
                {new Date(state.typeData.event.date).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {hasLink && (
        <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center gap-2 text-[11px]">
          <LinkIcon className="w-3.5 h-3.5 shrink-0 text-sky-500" aria-hidden="true" />
          <span className="truncate text-slate-700 dark:text-slate-200">
            {state.typeData.link.title || state.typeData.link.url}
          </span>
        </div>
      )}

      {hasAudio && (
        <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center gap-2 text-[11px]">
          <Headphones className="w-3.5 h-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="truncate text-slate-700 dark:text-slate-200">
            {state.typeData.audio.title || 'Audio Post'}
          </span>
        </div>
      )}
    </section>
  );
}

export default function ComposerControlCenter() {
  const { user, userProfile } = useAuth();
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

  const primaryActionLabel = state.editPostId
    ? 'Save Changes'
    : state.scheduledTime
    ? 'Schedule Post'
    : state.promotionIntent?.enabled
    ? 'Publish & Setup Ad'
    : 'Publish Now';

  return (
    <div className="max-w-6xl mx-auto py-5 pb-28 lg:pb-8 space-y-5">
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
          <div className="lg:hidden">
            <LivePostPreviewCard state={state} user={userProfile || user} />
          </div>
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
          <div className="hidden lg:block">
            <LivePostPreviewCard state={state} user={userProfile || user} />
          </div>
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
                  <span>{primaryActionLabel}</span>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Thumb-Zone Mobile Publish Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/80 dark:border-white/[0.1] bg-[#F6F8FC]/95 dark:bg-[#03071B]/95 backdrop-blur-2xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={saveDraft}
            className="min-h-[44px] px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => publishPost()}
            disabled={state.loading}
            className="min-h-[44px] flex-1 px-5 py-2 rounded-2xl font-bold text-white text-sm shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
          >
            {state.loading ? (
              <>
                <LoadingSpinner size="xs" color="white" />
                <span>Publishing...</span>
              </>
            ) : (
              <span>{primaryActionLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

