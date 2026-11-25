// src/screens/CreatePost/sections/SafetyAccessibilitySection.jsx
import { useCreatePostState } from '../CreatePostContext.jsx';
import {
  AGE_RATINGS,
  INPUT_CLASS,
  REGIONAL_DISCLOSURE_STANDARDS,
  SURFACE_GLASS_CLASS,
} from '../createPostConstants.js';

export default function SafetyAccessibilitySection() {
  const { state, dispatch } = useCreatePostState();
  const safety = state.safetyAccessibility || {};

  const updateSafety = (patch) => {
    dispatch({ type: 'SET_SAFETY_ACCESSIBILITY', payload: patch });
  };

  return (
    <section
      id="composer-section-safety"
      aria-labelledby="heading-safety"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
          09
        </span>
        <div>
          <h3 id="heading-safety" className="text-sm font-semibold text-slate-900 dark:text-white">
            Compliance, Safety &amp; Accessibility
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Content warnings, age rating, regional disclosure rules, captions, and transcripts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="safety-age-rating"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Age Rating
          </label>
          <select
            id="safety-age-rating"
            value={safety.ageRating || 'all'}
            onChange={(e) => updateSafety({ ageRating: e.target.value })}
            className={INPUT_CLASS}
          >
            {AGE_RATINGS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="safety-regional-standard"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Regional Disclosure Standard
          </label>
          <select
            id="safety-regional-standard"
            value={safety.regionalStandard || 'global'}
            onChange={(e) => updateSafety({ regionalStandard: e.target.value })}
            className={INPUT_CLASS}
          >
            {REGIONAL_DISCLOSURE_STANDARDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="safety-content-warning"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Content Warning Label (optional)
          </label>
          <input
            id="safety-content-warning"
            type="text"
            value={safety.contentWarning || ''}
            onChange={(e) => updateSafety({ contentWarning: e.target.value })}
            placeholder="e.g. Flashing lights, spoilers"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label
            htmlFor="safety-language"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Primary Language
          </label>
          <input
            id="safety-language"
            type="text"
            value={safety.language || 'en'}
            onChange={(e) => updateSafety({ language: e.target.value })}
            placeholder="en"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer">
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            Sensitive media gate
          </span>
          <input
            type="checkbox"
            checked={Boolean(safety.isSensitiveMedia)}
            onChange={(e) => updateSafety({ isSensitiveMedia: e.target.checked })}
            className="w-4 h-4 accent-arvdoul-purple rounded"
          />
        </label>

        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer">
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            Original / licensed rights
          </span>
          <input
            type="checkbox"
            checked={safety.copyrightConfirmed !== false}
            onChange={(e) => updateSafety({ copyrightConfirmed: e.target.checked })}
            className="w-4 h-4 accent-arvdoul-purple rounded"
          />
        </label>

        <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer">
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            Allow auto-translation
          </span>
          <input
            type="checkbox"
            checked={safety.allowAutoTranslation !== false}
            onChange={(e) => updateSafety({ allowAutoTranslation: e.target.checked })}
            className="w-4 h-4 accent-arvdoul-purple rounded"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="safety-captions"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Closed Captions / Alt Summary
          </label>
          <textarea
            id="safety-captions"
            rows={2}
            value={safety.captionsText || ''}
            onChange={(e) => updateSafety({ captionsText: e.target.value })}
            placeholder="Describe audio or visual details for accessibility"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="safety-transcript"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Transcript (optional)
          </label>
          <textarea
            id="safety-transcript"
            rows={2}
            value={safety.transcriptText || ''}
            onChange={(e) => updateSafety({ transcriptText: e.target.value })}
            placeholder="Paste spoken dialogue or lyrics transcript"
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </section>
  );
}
