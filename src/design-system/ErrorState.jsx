/**
 * src/design-system/ErrorState.jsx
 * ARVDOUL DESIGN SYSTEM — ERROR STATE
 *
 * Guide contract: human-readable, actionable, empathetic, consistent.
 * Renders role="alert" so screen readers announce the failure, and a retry
 * action when provided.
 */

import React from 'react';
import Button from './Button.jsx';

/**
 * @param {Object} props
 * @param {string} props.title - human-readable error title
 * @param {string} [props.message] - actionable explanation
 * @param {Function} [props.onRetry] - retry handler (renders a Retry button)
 * @param {string} [props.retryLabel='Retry']
 * @param {string} [props.className]
 */
export default function ErrorState({ title, message, onRetry, retryLabel = 'Retry', className = '' }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}
    >
      <div aria-hidden="true" className="mb-4 w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {message && (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{message}</p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
