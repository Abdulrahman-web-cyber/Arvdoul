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
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && (icon.$$typeof || icon.render))) {
      return React.createElement(icon, { className: 'w-7 h-7', 'aria-hidden': true });
    }
    return null;
  };

  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) {
      return action;
    }
    if (typeof action === 'function' || (typeof action === 'object' && action !== null && (action.$$typeof || action.render))) {
      return React.createElement(action);
    }
    if (typeof action === 'string' || typeof action === 'number') {
      return <span>{action}</span>;
    }
    return null;
  };

  const renderedIcon = renderIcon();
  const renderedAction = renderAction();

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}
    >
      {renderedIcon && (
        <div aria-hidden="true" className="mb-4 w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
          {renderedIcon}
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
        {typeof title === 'string' || typeof title === 'number' ? title : (React.isValidElement(title) ? title : String(title || ''))}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {typeof description === 'string' || typeof description === 'number' ? description : (React.isValidElement(description) ? description : String(description || ''))}
        </p>
      )}
      {renderedAction && <div className="mt-5">{renderedAction}</div>}
    </div>
  );
}
