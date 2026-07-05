// src/screens/CreatePost/CreatePoll.jsx
// ARVDOUL ULTIMATE POLL CREATOR – FINAL PRODUCTION‑READY
// ✅ Design replicates CreateText (floating header, glass card, DNA gradient)
// ✅ Options as reducer‑owned strings, stable UUIDs via ref (preserved on add/remove)
// ✅ Duplicate detection blocks content readiness, warning once per session
// ✅ Poll expiry via custom DateTimePicker only (presets removed)
// ✅ Coin reward fully wired to reducer, negative values prevented
// ✅ Allow multiple choices shown only when more than 2 options
// ✅ Anonymous voting removed entirely
// ✅ Autosave with versioning, AbortController cleanup, save‑race protection
// ✅ Live preview, character counters, keyboard shortcut
// ✅ Save indicator updates every second, buttons type="button"
// ✅ Remove button placed beside the input inside the same card (no absolute)
// ✅ Slightly wider card (max‑w‑3xl), fully responsive, zero stubs

import React, {
  useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense
} from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as Icons from "lucide-react";
import LoadingSpinner from "../../components/Shared/LoadingSpinner";

const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";

// ── ARVDOUL DNA ──────────────────────────────────────────────────────
const DNA_GRADIENT_STYLE =
  "linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)";
const DNA_SHADOW = "0 0 20px rgba(147,51,234,0.4)";
const INPUT_CLASS =
  "w-full p-3 rounded-xl border text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none";

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LEN = 200;
const MAX_OPTION_LEN = 100;
const AUTO_SAVE_DEBOUNCE = 2000;

// ── HELPER: normalise option text for duplicate detection ────────────
const normalise = (str) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

// ── POLL PREVIEW (realistic feed card) ──────────────────────────────
const PollPreview = React.memo(({ question, options, allowMultiple, isDark }) => (
  <div
    className={`rounded-2xl p-4 backdrop-blur-xl border ${
      isDark ? "bg-gray-800/60 border-gray-700" : "bg-white/90 border-gray-200"
    } shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]`}
  >
    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">
      {question || "Your poll question"}
    </h3>
    <div className="space-y-2">
      {options.map((opt, idx) => (
        <div
          key={opt.id}
          className="flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-700/50"
        >
          {allowMultiple ? (
            <Icons.CheckSquare className="w-5 h-5 text-purple-500" />
          ) : (
            <Icons.Circle className="w-5 h-5 text-purple-500" />
          )}
          <span className="text-sm text-gray-800 dark:text-gray-200">
            {opt.value || `Option ${idx + 1}`}
          </span>
        </div>
      ))}
    </div>
    <p className="text-xs text-gray-500 mt-3">0 votes</p>
  </div>
));

export default function CreatePoll() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, isDark } = useCreatePostServices();

  // ── REDUCER STATE (single source of truth) ─────────────────────────
  const poll = state.typeData.poll;
  const pollClosesAt = state.pollClosesAt;
  const reward = state.pollReward ?? 0;

  // ── STABLE UUIDs FOR OPTIONS (ref‑managed) ────────────────────────
  const optionIdsRef = useRef([]);

  useEffect(() => {
    const opts = poll.options || [];
    optionIdsRef.current = opts.map(() => uuidv4());
  }, []);

  useEffect(() => {
    const currentOpts = poll.options || [];
    const currentIds = optionIdsRef.current;
    if (currentIds.length !== currentOpts.length) {
      if (currentOpts.length > currentIds.length) {
        const diff = currentOpts.length - currentIds.length;
        for (let i = 0; i < diff; i++) {
          currentIds.push(uuidv4());
        }
      } else {
        optionIdsRef.current = currentOpts.map(() => uuidv4());
      }
    }
  }, [poll.options]);

  const optionsWithIds = useMemo(() => {
    const opts = poll.options || [];
    const ids = optionIdsRef.current;
    if (ids.length !== opts.length) {
      optionIdsRef.current = opts.map(() => uuidv4());
      return opts.map((val, idx) => ({ id: optionIdsRef.current[idx], value: val }));
    }
    return opts.map((val, idx) => ({ id: ids[idx], value: val }));
  }, [poll.options]);

  // ── OPTION MANAGEMENT ────────────────────────────────────────────
  const updateOption = useCallback(
    (id, value) => {
      const idx = optionsWithIds.findIndex(opt => opt.id === id);
      if (idx === -1) return;
      const newOptions = [...(poll.options || [])];
      newOptions[idx] = value;
      dispatch({ type: "SET_POLL_OPTIONS", payload: newOptions });
    },
    [poll.options, dispatch, optionsWithIds]
  );

  const addOption = useCallback(() => {
    const current = poll.options || [];
    if (current.length >= MAX_OPTIONS) {
      toast.error(`Maximum ${MAX_OPTIONS} options allowed`);
      return;
    }
    dispatch({ type: "SET_POLL_OPTIONS", payload: [...current, ""] });
    optionIdsRef.current.push(uuidv4());
  }, [poll.options, dispatch]);

  const removeOption = useCallback(
    (id) => {
      const current = poll.options || [];
      if (current.length <= MIN_OPTIONS) {
        toast.error("A poll must have at least 2 options");
        return;
      }
      const idx = optionsWithIds.findIndex(opt => opt.id === id);
      if (idx === -1) return;
      const newOptions = current.filter((_, i) => i !== idx);
      dispatch({ type: "SET_POLL_OPTIONS", payload: newOptions });
      const ids = optionIdsRef.current;
      ids.splice(idx, 1);
    },
    [poll.options, dispatch, optionsWithIds]
  );

  // ── DUPLICATE DETECTION (blocks readiness, toast once per session) ──
  const hasDuplicates = useMemo(() => {
    const values = (poll.options || []).map(o => o.trim()).filter(Boolean);
    const normalised = values.map(normalise);
    return new Set(normalised).size !== normalised.length;
  }, [poll.options]);

  const warnedDuplicates = useRef(false);
  useEffect(() => {
    if (hasDuplicates) {
      if (!warnedDuplicates.current) {
        warnedDuplicates.current = true;
        toast.warning("Duplicate options detected. Please make each option unique.", {
          id: "dup-poll",
          duration: 4000,
        });
      }
    } else {
      warnedDuplicates.current = false;
      toast.dismiss("dup-poll");
    }
  }, [hasDuplicates]);

  // ── CONTENT READINESS (duplicates block publishing) ──────────────
  useEffect(() => {
    const ready =
      state.content.trim().length > 0 &&
      (poll.options || []).filter(o => o.trim()).length >= MIN_OPTIONS &&
      !hasDuplicates;
    dispatch({ type: "SET_CONTENT_READY", payload: ready });
  }, [state.content, poll.options, dispatch, hasDuplicates]);

  // ── AUTOSAVE (versioned, abort on unmount, save‑race protection) ──
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const lastSavedContentRef = useRef();
  const saveVersionRef = useRef(0);
  const abortRef = useRef(null);
  const activeSavesRef = useRef(0);

  const performSave = useCallback(
    async (dataSnapshot) => {
      saveVersionRef.current++;
      const version = saveVersionRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      activeSavesRef.current++;
      try {
        await saveDraft();
        if (signal.aborted || version !== saveVersionRef.current) return;
        setLastSaved(Date.now());
        lastSavedContentRef.current = dataSnapshot;
      } catch {
        if (!signal.aborted && version === saveVersionRef.current) {
          toast.error("Save failed");
        }
      } finally {
        activeSavesRef.current--;
        if (activeSavesRef.current <= 0) {
          setSaving(false);
          activeSavesRef.current = 0;
        }
      }
    },
    [saveDraft]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const pollSnapshot = useMemo(() => {
    return JSON.stringify({
      question: state.content,
      options: poll.options || [],
      allowMultiple: poll.allowMultiple,
      closesAt: pollClosesAt,
      reward,
    });
  }, [state.content, poll.options, poll.allowMultiple, pollClosesAt, reward]);

  useEffect(() => {
    if (!state.postType) return;
    if (pollSnapshot === lastSavedContentRef.current) return;
    const timer = setTimeout(() => {
      setSaving(true);
      performSave(pollSnapshot);
    }, AUTO_SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [pollSnapshot, state.postType, performSave]);

  // ── KEYBOARD SHORTCUT (Enter on last option adds new) ────────────
  const handleOptionKeyDown = useCallback(
    (e, idx) => {
      if (e.key === "Enter" && idx === (poll.options || []).length - 1) {
        e.preventDefault();
        addOption();
      }
    },
    [addOption, poll.options]
  );

  // ── POLL EXPIRY (custom DateTimePicker only) ──────────────────────
  const handleExpiryChange = (date) => {
    if (date && date <= new Date()) {
      toast.error("Expiry must be in the future");
      return;
    }
    dispatch({ type: "SET_POLL_EXPIRY", payload: date ? date.toISOString() : null });
  };

  // ── REWARD (wired to reducer) ─────────────────────────────────────
  const handleRewardChange = useCallback(
    (e) => {
      const raw = parseInt(e.target.value) || 0;
      const value = Math.max(0, Math.min(raw, 1000));
      dispatch({ type: "SET_POLL_REWARD", payload: value });
    },
    [dispatch]
  );

  // ── MANUAL SAVE ──────────────────────────────────────────────────
  const manualSave = useCallback(() => {
    if (saving) return;
    setSaving(true);
    performSave(pollSnapshot);
  }, [saving, performSave, pollSnapshot]);

  // ── LIVE SAVE TIMER ──────────────────────────────────────────────
  const [timeAgo, setTimeAgo] = useState(0);
  useEffect(() => {
    if (!lastSaved) return;
    const interval = setInterval(() => {
      setTimeAgo(Math.floor((Date.now() - lastSaved) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  // ── PREVIEW TOGGLE ───────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);

  // Allow multiple choices only when more than 2 options
  const showMultipleChoice = (poll.options || []).length > 2;

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4 sm:px-0">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="mb-6 mt-2">
        <div
          className="rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] p-4 text-center border border-white/10"
          style={{ background: DNA_GRADIENT_STYLE }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Poll Creator</h2>
          <p className="text-sm text-white/80 mt-1">ask. vote. earn.</p>
        </div>
      </div>

      {/* ── FLOATING FORM CARD (GLASSMORPHISM) ──────────────────── */}
      <div
        className={`rounded-2xl backdrop-blur-sm border shadow-2xl p-6 space-y-4 ${
          isDark
            ? "bg-black/20 border-gray-700/30 shadow-none dark:shadow-[0_12px_35px_rgba(0,0,0,0.4)]"
            : "bg-white/90 border-gray-200/50 shadow-[0_12px_35px_rgba(0,0,0,0.15)]"
        }`}
      >
        {/* Question */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Question ({state.content.length}/{MAX_QUESTION_LEN})
          </label>
          <input
            type="text"
            value={state.content}
            onChange={e => {
              if (e.target.value.length <= MAX_QUESTION_LEN) {
                dispatch({ type: "SET_CONTENT", payload: e.target.value });
              }
            }}
            placeholder="Ask a question..."
            maxLength={MAX_QUESTION_LEN}
            className={INPUT_CLASS}
            autoFocus
            aria-label="Poll question"
          />
        </div>

        {/* Options */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Options ({(poll.options || []).length}/{MAX_OPTIONS})
          </label>
          <div className="space-y-2">
            {optionsWithIds.map((opt, idx) => (
              <div
                key={opt.id}
                className="flex items-stretch gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              >
                <input
                  type="text"
                  value={opt.value}
                  onChange={e => {
                    if (e.target.value.length <= MAX_OPTION_LEN) {
                      updateOption(opt.id, e.target.value);
                    }
                  }}
                  onKeyDown={e => handleOptionKeyDown(e, idx)}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={MAX_OPTION_LEN}
                  className="flex-1 bg-transparent text-gray-900 dark:text-white outline-none"
                  aria-label={`Option ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  disabled={(poll.options || []).length <= MIN_OPTIONS}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  aria-label={`Remove option ${idx + 1}`}
                  title={(poll.options || []).length <= MIN_OPTIONS ? "At least 2 options required" : "Remove option"}
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            disabled={(poll.options || []).length >= MAX_OPTIONS}
            className="mt-2 px-3 py-1 text-xs text-white rounded-full transition flex items-center gap-1 disabled:opacity-50"
            style={{ background: DNA_GRADIENT_STYLE, boxShadow: DNA_SHADOW }}
            aria-label="Add option"
            title={(poll.options || []).length >= MAX_OPTIONS ? "Maximum 5 options" : "Add option"}
          >
            <Icons.Plus className="w-3 h-3" /> Add option
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          {/* Allow multiple choices – only visible when more than 2 options */}
          {showMultipleChoice && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={poll.allowMultiple}
                onChange={e => dispatch({ type: "SET_ALLOW_MULTIPLE", payload: e.target.checked })}
                className="accent-purple-600 w-4 h-4"
              />
              Allow multiple choices
            </label>
          )}

          {/* Poll Expiry */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Poll expiry (optional)
            </label>
            <Suspense
              fallback={
                <div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
              }
            >
              <DateTimePicker
                selected={pollClosesAt ? new Date(pollClosesAt) : null}
                onChange={handleExpiryChange}
                showTimeSelect
                dateFormat="Pp"
                placeholderText="Select date/time (optional)"
                minDate={new Date()}
                className={INPUT_CLASS}
              />
            </Suspense>
          </div>

          {/* Coin Reward */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Coin reward per voter
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={reward}
              onChange={handleRewardChange}
              className={INPUT_CLASS}
              placeholder="0 = no reward"
            />
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS & SAVE INDICATOR ─────────────────────── */}
      <div className="flex justify-center gap-3 my-4 flex-wrap">
        <button
          type="button"
          onClick={() => setPreviewOpen(!previewOpen)}
          className="px-3 py-1.5 text-xs text-white rounded-full transition flex items-center gap-1"
          style={{ background: DNA_GRADIENT_STYLE, boxShadow: DNA_SHADOW }}
          aria-label={previewOpen ? "Edit" : "Preview"}
        >
          {previewOpen ? (
            <Icons.EyeOff className="w-3 h-3" />
          ) : (
            <Icons.Eye className="w-3 h-3" />
          )}
          {previewOpen ? "Edit" : "Preview"}
        </button>
        <button
          type="button"
          onClick={manualSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs text-white rounded-full transition flex items-center gap-1 disabled:opacity-50"
          style={{ background: DNA_GRADIENT_STYLE, boxShadow: DNA_SHADOW }}
          aria-label="Save draft"
        >
          {saving ? (
            <LoadingSpinner size="xs" />
          ) : (
            <Icons.Save className="w-3 h-3" />
          )}
          Save
        </button>
      </div>

      {/* Save indicator (updates every second) */}
      <div
        className="flex justify-center items-center gap-1 text-xs mb-4"
        aria-live="polite"
      >
        {saving ? (
          <span className="text-gray-500 flex items-center gap-1">
            <LoadingSpinner size="xs" /> Saving…
          </span>
        ) : lastSaved ? (
          <span className="text-green-500 flex items-center gap-1">
            <Icons.CheckCircle className="w-3 h-3" /> Saved{" "}
            {timeAgo}s ago
          </span>
        ) : null}
      </div>

      {/* ── PREVIEW ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-4"
          >
            <PollPreview
              question={state.content}
              options={optionsWithIds}
              allowMultiple={poll.allowMultiple}
              isDark={isDark}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   REQUIRED ORCHESTRATOR EXTENSIONS (add to CreatePost.jsx)
   initialState additions:
     pollClosesAt: null,
     pollReward: 0,
   Reducer cases:
     case "SET_POLL_EXPIRY": draft.pollClosesAt = action.payload; break;
     case "SET_POLL_REWARD": draft.pollReward = action.payload; break;
   Also update publishPost to include closesAt and rewardCoins in
   postData.poll, and update firestoreService.createPost to store them.
   ──────────────────────────────────────────────────────────────────── */