// src/components/ui/Tabs.jsx
/**
 * ARVDOUL DESIGN SYSTEM — ACCESSIBLE TABS
 * Guide Part II: keyboard navigation (arrow keys, Home/End), roving tabindex,
 * aria-selected / role=tablist / role=tab / role=tabpanel.
 *
 * API-compatible with the previous implementation (`active` prop) so existing
 * screens keep working while gaining full a11y + keyboard support.
 * Pass the same `tabId` to a TabsTrigger + TabsContent pair to wire
 * aria-controls / aria-labelledby correctly.
 */

import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export const Tabs = ({ children, className, ...props }) => (
  <div className={cn('w-full', className)} {...props}>
    {children}
  </div>
);

export const TabsList = ({ children, className, ...props }) => (
  <div
    role="tablist"
    aria-orientation="horizontal"
    className={cn('flex space-x-2', className)}
    {...props}
  >
    {children}
  </div>
);

export const TabsTrigger = ({
  children,
  active = false,
  onSelect,
  onClick,
  disabled = false,
  tabId,
  className,
  ...rest
}) => {
  const generatedId = useId();
  const id = tabId || `arv-tab-${generatedId}`;

  const handleKeyDown = (event) => {
    const list = event.currentTarget.closest('[role="tablist"]');
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll('[role="tab"]:not([disabled])'));
    const index = tabs.indexOf(event.currentTarget);

    let nextIndex = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={tabId ? `${tabId}-panel` : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        onSelect?.(e);
        onClick?.(e);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'min-h-[44px]',
        active
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ children, active = true, tabId, className, ...rest }) => {
  const generatedId = useId();
  const id = tabId ? `${tabId}-panel` : `arv-tabpanel-${generatedId}`;
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId ? tabId : undefined}
      hidden={!active}
      tabIndex={0}
      className={cn('mt-4 outline-none', className)}
      {...rest}
    >
      {children}
    </div>
  );
};
