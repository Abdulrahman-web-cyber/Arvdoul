// src/screens/CreatePost/ComposerPanels.jsx
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCreatePostServices, useCreatePostState } from './CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS, VISIBILITY_OPTIONS } from './createPostConstants.js';
import { useLocationSearch } from './useLocationSearch.js';
import { pickDisplayName, deriveHandle } from '../../services/profileReadModel.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

const DateTimePicker = lazy(() => import('react-datepicker'));

export function Modal({ children, onClose, labelledBy }) {
  const ref = useRef(null);
  const { prefersReducedMotion } = useCreatePostServices();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    if (ref.current) ref.current.focus();
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === modal) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener('keydown', trap);
    return () => modal.removeEventListener('keydown', trap);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={prefersReducedMotion ? {} : { scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={prefersReducedMotion ? {} : { scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-3xl p-6 border bg-white/95 dark:bg-[#080F2E]/95 border-slate-200 dark:border-white/15 shadow-2xl focus:outline-none text-slate-900 dark:text-white"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function Panel({ icon: Icon, title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { prefersReducedMotion } = useCreatePostServices();
  return (
    <details
      className={`${SURFACE_GLASS_CLASS} overflow-hidden`}
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="flex items-center gap-3 px-4 py-3.5 min-h-[48px] cursor-pointer list-none hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors">
        <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="font-semibold text-sm text-slate-900 dark:text-white">{title}</span>
        <Icons.ChevronDown
          aria-hidden="true"
          className={`ml-auto w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </summary>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </details>
  );
}

export function VisibilityPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  return (
    <Panel icon={Icons.Eye} title="Audience Visibility" defaultOpen={defaultOpen}>
      <select
        aria-label="Post visibility"
        value={state.visibility}
        onChange={(e) => dispatch({ type: 'SET_VISIBILITY', payload: e.target.value })}
        className={INPUT_CLASS}
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Panel>
  );
}

export function LocationPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const [query, setQuery] = useState(state.location || '');
  const { suggestions, loading, error, open, setOpen } = useLocationSearch(query);

  useEffect(() => {
    setQuery(state.location || '');
  }, [state.location]);

  return (
    <Panel icon={Icons.MapPin} title="Location" defaultOpen={defaultOpen}>
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            aria-label="Add location"
            type="text"
            placeholder="Search a city, venue, or landmark..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            className={INPUT_CLASS}
          />
          {state.location && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                dispatch({ type: 'SET_LOCATION', payload: null });
              }}
              aria-label="Clear location"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/12 text-slate-500 hover:text-rose-500 transition-colors"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
        </div>
        {loading && (
          <p className="mt-1.5 text-xs text-slate-400">Searching places...</p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-rose-500">{error}</p>
        )}
        {open && suggestions.length > 0 && (
          <div className="mt-2 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-[#080F2E] shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {suggestions.map((item, i) => (
              <button
                key={`${item.lat}-${item.lon}-${i}`}
                type="button"
                onMouseDown={() => {
                  dispatch({ type: 'SET_LOCATION', payload: item.displayName });
                  setQuery(item.displayName);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                {item.displayName}
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function SchedulingPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const [showPicker, setShowPicker] = useState(Boolean(state.scheduledTime));
  const isInvalidPast = Boolean(
    state.scheduledTime && new Date(state.scheduledTime).getTime() <= Date.now()
  );

  return (
    <Panel icon={Icons.Clock} title="Publish Schedule" defaultOpen={defaultOpen}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-arvdoul-purple bg-arvdoul-purple/10 hover:bg-arvdoul-purple/15 transition-colors whitespace-nowrap"
        >
          {showPicker ? 'Hide scheduler' : 'Schedule date & time'}
        </button>
        {state.scheduledTime && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_SCHEDULED_TIME', payload: null });
              setShowPicker(false);
            }}
            className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-500 transition-colors"
          >
            Publish now instead
          </button>
        )}
      </div>
      {showPicker && (
        <Suspense fallback={<div className="h-10 animate-pulse bg-slate-200 dark:bg-white/10 rounded-xl" />}>
          <DateTimePicker
            selected={state.scheduledTime ? new Date(state.scheduledTime) : null}
            onChange={(date) =>
              dispatch({ type: 'SET_SCHEDULED_TIME', payload: date ? date.toISOString() : null })
            }
            showTimeSelect
            minDate={new Date()}
            dateFormat="Pp"
            placeholderText="Select date and time"
            className={INPUT_CLASS}
            aria-label="Scheduled publish date and time"
          />
        </Suspense>
      )}
      {state.scheduledTime && (
        <p className={`text-xs ${isInvalidPast ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
          {isInvalidPast
            ? 'Please choose a future date and time.'
            : `Publishes automatically at ${new Date(state.scheduledTime).toLocaleString()}.`}
        </p>
      )}
    </Panel>
  );
}

export function InsightsPanel({ defaultOpen = false }) {
  const { state } = useCreatePostState();
  const { getPredictions } = useCreatePostServices();
  return (
    <Panel icon={Icons.TrendingUp} title="Post Forecast" defaultOpen={defaultOpen}>
      {!state.insights ? (
        <button
          type="button"
          onClick={getPredictions}
          className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl text-white flex items-center gap-2 hover:opacity-95 transition-opacity"
          style={{ background: BRAND_GRADIENT }}
        >
          <Icons.BarChart2 className="w-4 h-4" />
          <span>Estimate performance</span>
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.05]">
              <span className="text-slate-500 dark:text-slate-400 block">Reach</span>
              <span className="font-semibold text-slate-900 dark:text-white">{state.insights.reach}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.05]">
              <span className="text-slate-500 dark:text-slate-400 block">Engagement</span>
              <span className="font-semibold text-slate-900 dark:text-white">{state.insights.engagement}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.05]">
              <span className="text-slate-500 dark:text-slate-400 block">Viral Score</span>
              <span className="font-semibold text-slate-900 dark:text-white">{state.insights.viralScore}%</span>
            </div>
          </div>
          {state.insights.suggestedWindow && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-500 dark:text-slate-400">Suggested window: </span>
              {state.insights.suggestedWindow}
            </div>
          )}
          {Array.isArray(state.insights.factors) && state.insights.factors.length > 0 && (
            <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-0.5">
              {state.insights.factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Heuristic estimates from your draft — not a guarantee of performance.
          </p>
        </div>
      )}
    </Panel>
  );
}

export function ModerationStatus({ defaultOpen = false }) {
  const { state } = useCreatePostState();
  return (
    <Panel icon={Icons.Shield} title="Safety Screening" defaultOpen={defaultOpen}>
      {state.moderationStatus ? (
        state.moderationStatus.unknown ? (
          <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
            <Icons.AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Moderation check unavailable — content was not screened.</span>
          </div>
        ) : state.moderationStatus.approved ? (
          <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            <Icons.CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Content passed moderation
              {state.moderationStatus.needsReview && ' (flagged for review)'}
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
            <Icons.ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Content flagged: {(state.moderationStatus.flags || []).join(', ') || 'Needs review'}
            </span>
          </div>
        )
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your post will be screened automatically as you compose.
        </p>
      )}
    </Panel>
  );
}

export function PostPreview() {
  const { state } = useCreatePostState();
  const { user } = useAuth();

  const authorName = pickDisplayName([user?.displayName, user?.username], { fallback: 'You' });
  const authorUsername = deriveHandle(user?.username) || deriveHandle(user?.email) || '';
  const authorPhoto = user?.photoURL || '';

  const mediaPreviews = useMemo(() => {
    if (!state.mediaItems?.length || state.postType === 'audio') return null;
    const previews = state.mediaItems.slice(0, 4);
    return (
      <div
        className={`grid gap-2 mt-3 rounded-xl overflow-hidden ${
          previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        {previews.map((m, i) => (
          <div
            key={m.id || i}
            className="relative aspect-video bg-slate-100 dark:bg-[#03071B] rounded-xl overflow-hidden border border-slate-200/40 dark:border-white/10"
          >
            {m.type === 'video' ? (
              m.thumbnailUrl || m.thumbnail ? (
                <div className="relative w-full h-full">
                  <LazyImage
                    src={m.thumbnailUrl || m.thumbnail}
                    alt={m.alt || m.name || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Icons.Play className="w-8 h-8 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#03071B] text-white">
                  <Icons.Play className="w-8 h-8 opacity-80" />
                </div>
              )
            ) : (
              <LazyImage
                src={m.preview || m.url}
                alt={m.alt || m.name || 'Post media preview'}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        ))}
      </div>
    );
  }, [state.mediaItems, state.postType]);

  return (
    <div className="rounded-2xl border p-4 sm:p-5 space-y-3 bg-white dark:bg-[#03071B]/60 border-slate-200/80 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {authorPhoto ? (
            <LazyImage
              src={authorPhoto}
              alt={authorName}
              className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: BRAND_GRADIENT }}
            >
              {authorName[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
              <span className="truncate">{authorName}</span>
              {authorUsername && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate">
                  @{authorUsername}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="capitalize">{state.postType}</span>
              <span aria-hidden="true">·</span>
              <span>Preview</span>
              {state.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[160px]">{state.location}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {state.content ? (
        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {state.content}
        </p>
      ) : (
        <p className="text-sm text-slate-400 italic">No caption text provided</p>
      )}

      {mediaPreviews}

      {state.postType === 'audio' && (state.typeData?.audio?.previewUrl || state.typeData?.audio?.url) && (
        <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center gap-3">
          {state.typeData.audio.coverUrl ? (
            <LazyImage
              src={state.typeData.audio.coverUrl}
              alt={state.typeData.audio.title || 'Audio cover'}
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-arvdoul-purple/15 text-arvdoul-purple flex items-center justify-center shrink-0">
              <Icons.Music className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {state.typeData.audio.title || 'Untitled Audio'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {state.typeData.audio.artist || 'Creator mix'}
              {state.typeData.audio.genre ? ` · ${state.typeData.audio.genre}` : ''}
            </p>
          </div>
        </div>
      )}

      {state.postType === 'poll' && state.typeData?.poll?.options?.length > 0 && (
        <div className="space-y-2 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10">
          {state.typeData.poll.options
            .filter((o) => o && o.trim())
            .map((opt, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-[#080F2E]"
              >
                {opt}
              </div>
            ))}
          {state.pollClosesAt && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Closes {new Date(state.pollClosesAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {state.postType === 'event' && state.typeData?.event && (
        <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            <Icons.Calendar className="w-5 h-5" />
          </div>
          <div className="text-xs min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">
              {state.typeData.event.location || 'Online Event'}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {state.typeData.event.date
                ? new Date(state.typeData.event.date).toLocaleString()
                : 'Date not set'}
            </p>
          </div>
        </div>
      )}

      {state.postType === 'link' && state.typeData?.link?.url && (
        <a
          href={state.typeData.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-xs text-arvdoul-purple hover:underline"
        >
          <Icons.Link2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{state.typeData.link.title || state.typeData.link.url}</span>
        </a>
      )}

      {state.commercialSettings?.disclosureType && state.commercialSettings.disclosureType !== 'none' && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
            <Icons.Megaphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {state.commercialSettings.disclosureType === 'own_promotion' && 'Promotional content'}
              {state.commercialSettings.disclosureType === 'paid_partnership' &&
                `Paid partnership${state.commercialSettings.brandPartnerName ? ` with ${state.commercialSettings.brandPartnerName}` : ''}`}
              {state.commercialSettings.disclosureType === 'sponsored_ad' && 'Sponsored'}
            </span>
          </div>
          {state.commercialSettings.promoCode && (
            <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Code: {state.commercialSettings.promoCode}
            </span>
          )}
        </div>
      )}

      {(state.commercialSettings?.affiliateUrl || state.commercialSettings?.productTag) && (
        <div className="p-2.5 rounded-xl bg-slate-100/75 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-700 dark:text-slate-200 truncate">
            {state.commercialSettings.productTag || state.commercialSettings.affiliateLabel || 'Featured product or link'}
          </span>
          {state.commercialSettings.affiliateUrl && (
            <span className="text-arvdoul-purple font-semibold shrink-0">
              {state.commercialSettings.ctaLabel || 'Learn More'}
            </span>
          )}
        </div>
      )}

      {state.hashtags?.length > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
          {state.hashtags.map((tag) => (
            <span key={tag}>#{tag.replace(/^#/, '')}</span>
          ))}
        </div>
      )}

      <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Preview — engagement appears after publishing</span>
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
          <Icons.Eye className="w-3.5 h-3.5" aria-hidden="true" />
          {VISIBILITY_OPTIONS.find((o) => o.value === state.visibility)?.label || 'Public'}
        </span>
      </div>
    </div>
  );
}

export function ReviewSummary() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, saveAsTemplate } = useCreatePostServices();

  return (
    <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center shrink-0">
            <Icons.CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Review and Finalize
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify how your post appears before publishing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveDraft}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Icons.Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            onClick={saveAsTemplate}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-arvdoul-purple/30 text-xs font-semibold text-arvdoul-purple hover:bg-arvdoul-purple/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Icons.LayoutTemplate className="w-3.5 h-3.5" />
            <span>Save Template</span>
          </button>
        </div>
      </div>

      <PostPreview />

      <div className="grid grid-cols-3 gap-2.5 text-xs tabular-nums">
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Visibility</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {VISIBILITY_OPTIONS.find((o) => o.value === state.visibility)?.label || 'Public'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Media</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {state.mediaItems.length} attached
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Schedule</span>
          <span className="font-semibold text-slate-900 dark:text-white truncate block">
            {state.scheduledTime ? new Date(state.scheduledTime).toLocaleDateString() : 'Immediate'}
          </span>
        </div>
      </div>

      {state.error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{state.error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-rose-500/15"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
