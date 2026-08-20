/**
 * src/design-system/EmptyState.jsx
 * ARVDOUL DESIGN SYSTEM — EMPTY STATE
 *
 * The guide's empty-state contract: explain, guide, inspire, enable.
 * i18n-ready: pass translated strings as props (or defaults for dev).
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.title - why it's empty
 * @param {string} [props.description] - what to do next
 * @param {React.ReactNode} [props.icon] - optional icon node
 * @param {React.ReactNode} [props.action] - primary action (e.g. <Button>)
 * @param {string} [props.className]
 */
export default function EmptyState({ title, description, icon, action, className = '' }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}
    >
      {icon && (
        <div aria-hidden="true" className="mb-4 w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
