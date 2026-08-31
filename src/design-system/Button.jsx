/**
 * src/design-system/Button.jsx
 * ARVDOUL DESIGN SYSTEM — BUTTON PRIMITIVE
 *
 * Exhaustive variant/state coverage:
 *   variants: primary (brand gradient), secondary, ghost, outline, destructive, success
 *   sizes:    sm, md, lg
 *   states:   loading, disabled, hover, focus-visible, active
 *   a11y:     real <button>, aria-disabled, aria-busy, focus ring, keyboard native
 * No hardcoded brand hex values - surfaces come from the design tokens.
 */

import React from 'react';
import { cn } from '../lib/utils.js';

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40',
  secondary:
    'bg-white/10 dark:bg-white/10 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/15 hover:bg-white/20 dark:hover:bg-white/20 backdrop-blur-sm',
  ghost:
    'text-slate-700 dark:text-slate-200 hover:bg-slate-900/5 dark:hover:bg-white/10',
  outline:
    'border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10',
  destructive:
    'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25',
  success:
    'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

/**
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'|'outline'|'destructive'|'success'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {string} [props.loadingLabel] - aria label for screen readers while loading
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  loadingLabel = 'Loading',
  children,
  className,
  type = 'button',
  ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-all duration-150 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"
        />
      )}
      <span className={loading ? 'sr-only' : undefined}>{children}</span>
      {loading && <span className="sr-only">{loadingLabel}</span>}
    </button>
  );
}
