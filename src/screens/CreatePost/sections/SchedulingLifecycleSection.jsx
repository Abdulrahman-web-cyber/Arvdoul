// src/screens/CreatePost/sections/SchedulingLifecycleSection.jsx
import * as Icons from 'lucide-react';
import { useCreatePostState } from '../CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { SchedulingPanel } from '../ComposerPanels.jsx';

export default function SchedulingLifecycleSection() {
  const { state, dispatch } = useCreatePostState();
  const lifecycle = state.lifecycleSettings || {};
  const commercial = state.commercialSettings || {};
  const safety = state.safetyAccessibility || {};

  const updateLifecycle = (patch) => {
    dispatch({ type: 'SET_LIFECYCLE_SETTINGS', payload: patch });
  };

  const checklist = [
    {
      label: 'Content ready for selected format',
      ok: Boolean(
        (typeof state.content === 'string' && state.content.trim()) ||
          state.mediaItems?.length ||
          state.typeData?.audio?.url ||
          state.typeData?.link?.url
      ),
    },
    {
      label: 'Commercial disclosure verified',
      ok:
        commercial.disclosureType !== 'paid_partnership' ||
        Boolean(commercial.brandPartnerName || commercial.brandPartnerId),
    },
    {
      label: 'Media & copyright rights confirmed',
      ok: safety.copyrightConfirmed !== false,
    },
  ];

  return (
    <section
      id="composer-section-schedule"
      aria-labelledby="heading-schedule"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
            10
          </span>
          <div>
            <h3 id="heading-schedule" className="text-sm font-semibold text-slate-900 dark:text-white">
              Scheduling &amp; Lifecycle
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Publish timing, archival expiration, follower alerts, and readiness review
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {lifecycle.timezone || 'UTC'}
        </span>
      </div>

      <SchedulingPanel defaultOpen={Boolean(state.scheduledTime)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="lifecycle-expires-at"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Auto-Archive / Expiration Date (optional)
          </label>
          <input
            id="lifecycle-expires-at"
            type="date"
            value={lifecycle.expiresAt ? String(lifecycle.expiresAt).slice(0, 10) : ''}
            onChange={(e) =>
              updateLifecycle({
                expiresAt: e.target.value ? new Date(`${e.target.value}T23:59:59Z`).toISOString() : null,
              })
            }
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2 pt-0 sm:pt-5">
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer">
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              Notify followers on publish
            </span>
            <input
              type="checkbox"
              checked={lifecycle.notifyFollowers !== false}
              onChange={(e) => updateLifecycle({ notifyFollowers: e.target.checked })}
              className="w-4 h-4 accent-arvdoul-purple rounded"
            />
          </label>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 space-y-2">
        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
          Pre-Publish Readiness Checklist
        </span>
        <ul className="space-y-1.5 text-xs">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              {item.ok ? (
                <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
              ) : (
                <Icons.AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
              )}
              <span className={item.ok ? 'text-slate-700 dark:text-slate-200' : 'text-amber-600 dark:text-amber-300'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
