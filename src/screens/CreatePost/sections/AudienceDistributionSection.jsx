// src/screens/CreatePost/sections/AudienceDistributionSection.jsx
import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useCreatePostState } from '../CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS, VISIBILITY_OPTIONS } from '../createPostConstants.js';
import { LocationPanel } from '../ComposerPanels.jsx';

const CATEGORIES = [
  'general',
  'tech',
  'creator_economy',
  'music',
  'film_video',
  'business',
  'education',
  'lifestyle',
  'sports',
  'news',
];

export default function AudienceDistributionSection() {
  const { state, dispatch } = useCreatePostState();
  const [mentionInput, setMentionInput] = useState('');
  const dist = state.distributionSettings || {};

  const toggleDist = (key) => {
    dispatch({
      type: 'SET_DISTRIBUTION_SETTINGS',
      payload: { [key]: dist[key] === false ? true : !dist[key] },
    });
  };

  const addMention = () => {
    const clean = mentionInput.trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return;
    const current = Array.isArray(dist.mentions) ? dist.mentions : [];
    if (!current.includes(clean)) {
      dispatch({
        type: 'SET_DISTRIBUTION_SETTINGS',
        payload: { mentions: [...current, clean].slice(0, 20) },
      });
    }
    setMentionInput('');
  };

  const removeMention = (m) => {
    const current = Array.isArray(dist.mentions) ? dist.mentions : [];
    dispatch({
      type: 'SET_DISTRIBUTION_SETTINGS',
      payload: { mentions: current.filter((x) => x !== m) },
    });
  };

  return (
    <section
      id="composer-section-audience"
      aria-labelledby="heading-audience"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
          03
        </span>
        <div>
          <h3 id="heading-audience" className="text-sm font-semibold text-slate-900 dark:text-white">
            Audience &amp; Distribution
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visibility, feed recommendation eligibility, sharing rights, and location
          </p>
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
          Who can see this post
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VISIBILITY_OPTIONS.map((opt) => {
            const isSelected = state.visibility === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => dispatch({ type: 'SET_VISIBILITY', payload: opt.value })}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-arvdoul-purple text-white border-arvdoul-purple shadow-sm'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[
          { key: 'allowDiscovery', label: 'Eligible for Explore & For You feeds' },
          { key: 'allowReposts', label: 'Allow reposts & quote posts' },
          { key: 'allowRemixes', label: 'Allow audio/video remixes & stitches' },
          { key: 'allowDownloads', label: 'Allow media downloads' },
        ].map((item) => {
          const checked = dist[item.key] !== false;
          return (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer"
            >
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {item.label}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleDist(item.key)}
                className="w-4 h-4 accent-arvdoul-purple rounded"
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="dist-category"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Topic / Category
          </label>
          <select
            id="dist-category"
            value={dist.category || 'general'}
            onChange={(e) =>
              dispatch({ type: 'SET_DISTRIBUTION_SETTINGS', payload: { category: e.target.value } })
            }
            className={INPUT_CLASS}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="dist-mention-input"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Mention Handles
          </label>
          <div className="flex gap-2">
            <input
              id="dist-mention-input"
              type="text"
              value={mentionInput}
              onChange={(e) => setMentionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMention();
                }
              }}
              placeholder="@username"
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={addMention}
              className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Add
            </button>
          </div>
          {Array.isArray(dist.mentions) && dist.mentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {dist.mentions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => removeMention(m)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-xs text-slate-700 dark:text-slate-200"
                >
                  <span>@{m}</span>
                  <Icons.X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <LocationPanel defaultOpen={false} />
    </section>
  );
}
