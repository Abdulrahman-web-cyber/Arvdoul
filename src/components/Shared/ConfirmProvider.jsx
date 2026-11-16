// src/components/Shared/ConfirmProvider.jsx
//
// Promise-based confirmation primitive for destructive / irreversible actions.
//
// Replaces `window.confirm`, which is a blocking native dialog: it cannot be
// styled to the Arvdoul design system, cannot be announced accessibly, and
// freezes the main thread (a defect on mobile). `useConfirm()` returns a
// function that resolves to `true` (confirmed) or `false` (cancelled), backed
// by the accessible `Dialog` primitive (focus trap, Escape, aria-modal).

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Dialog from '../UI/Dialog';
import { cn } from '../../lib/utils';

const ConfirmContext = createContext(null);

const TONE_BUTTONS = {
  danger: 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500',
  primary: 'bg-purple-600 hover:bg-purple-500 focus-visible:ring-arvdoul-purple',
};

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} title
 * @property {string} [description]
 * @property {string} [confirmText]
 * @property {string} [cancelText]
 * @property {'danger'|'primary'} [tone]
 */

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [promptRequest, setPromptRequest] = useState(null);
  const [promptValue, setPromptValue] = useState('');
  const resolverRef = useRef(null);
  const promptResolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        title: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        tone: 'danger',
        ...options,
      });
    });
  }, []);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    if (resolve) resolve(result);
  }, []);

  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      promptResolverRef.current = resolve;
      setPromptValue(options?.defaultValue ?? '');
      setPromptRequest({
        title: 'Enter a value',
        confirmText: 'Save',
        cancelText: 'Cancel',
        tone: 'primary',
        required: true,
        ...options,
      });
    });
  }, []);

  const settlePrompt = useCallback((submit) => {
    const resolve = promptResolverRef.current;
    promptResolverRef.current = null;
    setPromptRequest(null);
    if (resolve) resolve(submit ? promptValue : null);
  }, [promptValue]);

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        isOpen={Boolean(request)}
        onClose={() => settle(false)}
        title={request?.title || 'Are you sure?'}
        size="sm"
      >
        <div className="space-y-4">
          {request?.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {request.description}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => settle(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-100 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-opacity"
            >
              {request?.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 transition-opacity',
                TONE_BUTTONS[request?.tone] || TONE_BUTTONS.danger
              )}
            >
              {request?.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        isOpen={Boolean(promptRequest)}
        onClose={() => settlePrompt(false)}
        title={promptRequest?.title || 'Enter a value'}
        size="sm"
      >
        <div className="space-y-4">
          {promptRequest?.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {promptRequest.description}
            </p>
          )}
          <input
            type="text"
            value={promptValue}
            autoFocus
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (!promptRequest?.required || promptValue.trim())) settlePrompt(true);
            }}
            aria-label={promptRequest?.title || 'Value'}
            placeholder={promptRequest?.placeholder || ''}
            className="w-full px-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => settlePrompt(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-100 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-opacity"
            >
              {promptRequest?.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              disabled={Boolean(promptRequest?.required) && !promptValue.trim()}
              onClick={() => settlePrompt(true)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed',
                TONE_BUTTONS[promptRequest?.tone] || TONE_BUTTONS.primary
              )}
            >
              {promptRequest?.confirmText || 'Save'}
            </button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async `confirm(options)` that resolves true/false. Must be used
 * under `<ConfirmProvider>`. Outside the provider it returns a fail-closed
 * `false` (never a silent native dialog) so a missing provider cannot confirm
 * a destructive action by accident.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  return useCallback(
    (options) => (ctx ? ctx.confirm(options) : Promise.resolve(false)),
    [ctx]
  );
}

/**
 * Returns an async `prompt(options)` that resolves the entered string, or
 * `null` if cancelled. Fail-closed outside the provider (resolves `null`), so a
 * missing provider can never substitute an unstyled native prompt.
 */
export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  return useCallback(
    (options) => (ctx ? ctx.prompt(options) : Promise.resolve(null)),
    [ctx]
  );
}

export default ConfirmProvider;
