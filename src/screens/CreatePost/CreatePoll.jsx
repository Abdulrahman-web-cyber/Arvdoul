// src/screens/CreatePost/CreatePoll.jsx
import React, { useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import * as Icons from 'lucide-react';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from './createPostConstants.js';
import 'react-datepicker/dist/react-datepicker.css';

const DateTimePicker = lazy(() => import('react-datepicker'));

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LEN = 200;
const MAX_OPTION_LEN = 100;

const normalise = (str) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

const PollPreview = React.memo(({ question, options, allowMultiple, closesAt }) => (
  <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-arvdoul-purple">
        Poll Preview
      </p>
      {closesAt && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Closes {new Date(closesAt).toLocaleString()}
        </span>
      )}
    </div>
    <h3 className="font-semibold text-base text-slate-900 dark:text-white">
      {question || 'Your poll question'}
    </h3>
    <div className="space-y-2">
      {options.map((opt, idx) => (
        <div
          key={opt.id}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-[#03071B]/60"
        >
          {allowMultiple ? (
            <Icons.CheckSquare className="w-4 h-4 text-arvdoul-purple shrink-0" />
          ) : (
            <Icons.Circle className="w-4 h-4 text-arvdoul-purple shrink-0" />
          )}
          <span className="text-sm text-slate-800 dark:text-slate-200">
            {opt.value || `Option ${idx + 1}`}
          </span>
        </div>
      ))}
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Live vote counts appear after publishing
    </p>
  </div>
));

export default function CreatePoll() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, autoSaveStatus, lastSavedAt } = useCreatePostServices();

  const poll = state.typeData.poll;
  const pollClosesAt = state.pollClosesAt;
  const rawOptions = useMemo(() => (Array.isArray(poll.options) ? poll.options : []), [poll.options]);

  // Seed default 2 blank options once if entering a fresh poll (without dirtying draft/history)
  useEffect(() => {
    if (rawOptions.length === 0) {
      dispatch({ type: 'SEED_POLL_OPTIONS', payload: ['', ''] });
    }
  }, [rawOptions.length, dispatch]);

  const optionIdsRef = useRef([]);
  const optionsWithIds = useMemo(() => {
    const nextIds = [...optionIdsRef.current];
    while (nextIds.length < rawOptions.length) nextIds.push(uuidv4());
    if (nextIds.length > rawOptions.length) nextIds.length = rawOptions.length;
    optionIdsRef.current = nextIds;
    return rawOptions.map((val, idx) => ({ id: nextIds[idx], value: val }));
  }, [rawOptions]);

  const updateOption = useCallback(
    (id, value) => {
      const idx = optionsWithIds.findIndex((opt) => opt.id === id);
      if (idx === -1) return;
      const next = [...rawOptions];
      next[idx] = value;
      dispatch({ type: 'SET_POLL_OPTIONS', payload: next });
    },
    [rawOptions, dispatch, optionsWithIds]
  );

  const addOption = useCallback(() => {
    if (rawOptions.length >= MAX_OPTIONS) {
      toast.error(`Maximum ${MAX_OPTIONS} options allowed`);
      return;
    }
    optionIdsRef.current = [...optionIdsRef.current, uuidv4()];
    dispatch({ type: 'SET_POLL_OPTIONS', payload: [...rawOptions, ''] });
  }, [rawOptions, dispatch]);

  const removeOption = useCallback(
    (id) => {
      if (rawOptions.length <= MIN_OPTIONS) {
        toast.error('A poll must have at least 2 options');
        return;
      }
      const idx = optionsWithIds.findIndex((opt) => opt.id === id);
      if (idx === -1) return;
      optionIdsRef.current = optionIdsRef.current.filter((_, i) => i !== idx);
      dispatch({ type: 'SET_POLL_OPTIONS', payload: rawOptions.filter((_, i) => i !== idx) });
    },
    [rawOptions, dispatch, optionsWithIds]
  );

  const hasDuplicates = useMemo(() => {
    const values = rawOptions.map((o) => o.trim()).filter(Boolean);
    const normalised = values.map(normalise);
    return new Set(normalised).size !== normalised.length;
  }, [rawOptions]);

  const warnedDuplicates = useRef(false);
  useEffect(() => {
    if (hasDuplicates) {
      if (!warnedDuplicates.current) {
        warnedDuplicates.current = true;
        toast.warning('Duplicate options detected. Please make each option unique.', {
          id: 'dup-poll',
          duration: 4000,
        });
      }
    } else {
      warnedDuplicates.current = false;
      toast.dismiss('dup-poll');
    }
  }, [hasDuplicates]);

  useEffect(() => {
    const ready =
      state.content.trim().length > 0 &&
      rawOptions.filter((o) => o.trim()).length >= MIN_OPTIONS &&
      !hasDuplicates;
    dispatch({ type: 'SET_CONTENT_READY', payload: ready });
  }, [state.content, rawOptions, dispatch, hasDuplicates]);

  const handleOptionKeyDown = useCallback(
    (e, idx) => {
      if (e.key === 'Enter' && idx === rawOptions.length - 1) {
        e.preventDefault();
        addOption();
      }
    },
    [addOption, rawOptions.length]
  );

  const handleExpiryChange = (date) => {
    if (date && date <= new Date()) {
      toast.error('Expiry must be in the future');
      return;
    }
    dispatch({ type: 'SET_POLL_EXPIRY', payload: date ? date.toISOString() : null });
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const showMultipleChoice = rawOptions.length > 2;

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Create Poll
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gather community votes with clear choices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-label={previewOpen ? 'Switch to poll editor' : 'Preview poll'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {previewOpen ? <Icons.Edit3 className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
            <span>{previewOpen ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving'}
            aria-label="Save draft"
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
          >
            {autoSaveStatus === 'saving' ? (
              <LoadingSpinner size="xs" color="white" />
            ) : (
              <Icons.Save className="w-3.5 h-3.5" />
            )}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}>
        <div>
          <label
            htmlFor="poll-question-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
          >
            Question ({state.content.length}/{MAX_QUESTION_LEN})
          </label>
          <input
            id="poll-question-input"
            type="text"
            value={state.content}
            onChange={(e) => {
              if (e.target.value.length <= MAX_QUESTION_LEN) {
                dispatch({ type: 'SET_CONTENT', payload: e.target.value });
              }
            }}
            placeholder="Ask a question..."
            maxLength={MAX_QUESTION_LEN}
            className={INPUT_CLASS}
            autoFocus
            aria-label="Poll question"
          />
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            Options ({rawOptions.length}/{MAX_OPTIONS})
          </span>
          <div className="space-y-2.5">
            {optionsWithIds.map((opt, idx) => (
              <div
                key={opt.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-white/12 bg-white/95 dark:bg-[#03071B]/60 pl-3.5 pr-1.5 py-1 focus-within:ring-2 focus-within:ring-arvdoul-purple"
              >
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_OPTION_LEN) {
                      updateOption(opt.id, e.target.value);
                    }
                  }}
                  onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={MAX_OPTION_LEN}
                  className="flex-1 bg-transparent py-2 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                  aria-label={`Option ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  disabled={rawOptions.length <= MIN_OPTIONS}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Remove option ${idx + 1}`}
                  title={rawOptions.length <= MIN_OPTIONS ? 'At least 2 options required' : 'Remove option'}
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addOption}
            disabled={rawOptions.length >= MAX_OPTIONS}
            className="mt-3 min-h-[40px] px-4 py-2 text-xs font-semibold text-white rounded-xl transition-opacity flex items-center gap-1.5 disabled:opacity-45 hover:opacity-95 whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
            aria-label="Add poll option"
          >
            <Icons.Plus className="w-3.5 h-3.5" />
            <span>Add option</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-3">
          {showMultipleChoice && (
            <label className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={!!poll.allowMultiple}
                onChange={(e) =>
                  dispatch({ type: 'SET_ALLOW_MULTIPLE', payload: e.target.checked })
                }
                aria-label="Allow multiple choices"
                className="w-4 h-4 rounded text-arvdoul-purple focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              />
              <span>Allow multiple choices</span>
            </label>
          )}

          <div>
            <label
              id="poll-expiry-label"
              htmlFor="poll-expiry-picker"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5"
            >
              Poll expiry (optional)
            </label>
            <Suspense
              fallback={
                <div className="h-10 animate-pulse bg-slate-200 dark:bg-white/10 rounded-xl" />
              }
            >
              <DateTimePicker
                id="poll-expiry-picker"
                selected={pollClosesAt ? new Date(pollClosesAt) : null}
                onChange={handleExpiryChange}
                showTimeSelect
                dateFormat="Pp"
                placeholderText="Select closing date and time"
                minDate={new Date()}
                className={INPUT_CLASS}
                ariaLabelledBy="poll-expiry-label"
              />
            </Suspense>
          </div>
        </div>

        <div className="flex items-center justify-end text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {autoSaveStatus === 'saving' && (
            <span className="flex items-center gap-1.5">
              <LoadingSpinner size="xs" /> Saving draft...
            </span>
          )}
          {autoSaveStatus === 'saved' && lastSavedAt && (
            <span className="flex items-center gap-1.5">
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <PollPreview
              question={state.content}
              options={optionsWithIds}
              allowMultiple={poll.allowMultiple}
              closesAt={pollClosesAt}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}