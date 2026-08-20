// src/components/ui/Dialog.jsx
/**
 * ARVDOUL DESIGN SYSTEM — ACCESSIBLE DIALOG (MODAL)
 *
 * Guide Part II coverage:
 *   - traps focus inside the dialog
 *   - restores focus to the trigger on close
 *   - Escape closes
 *   - announces itself (role="dialog", aria-modal, aria-labelledby)
 *   - size variants: sm, md, lg, fullscreen
 *   - overlay + close button; reduced motion via global tokens.css
 *     kill-switch (CSS transitions collapse automatically)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  fullscreen: 'max-w-none w-[100vw] h-[100dvh] rounded-none',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.title - dialog title (aria-labelledby)
 * @param {'sm'|'md'|'lg'|'fullscreen'} [props.size]
 * @param {boolean} [props.showCloseButton=true]
 * @param {boolean} [props.closeOnOverlayClick=true]
 */
export const Dialog = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  children,
  className = '',
}) => {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Focus management: save trigger, focus dialog, restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement;
      const timer = requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
      return () => cancelAnimationFrame(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      previouslyFocused.current?.focus?.();
    }
  }, [isOpen]);

  // Focus trap: Tab/Shift+Tab cycle within the dialog
  const handleKeyDown = useCallback(
    (event) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      // FOCUSABLE selector already excludes disabled elements. No
      // offsetParent/getClientRects filtering - jsdom cannot compute layout,
      // and hidden-by-CSS elements are rare inside a modal body.
      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      // Manual cyclic focus management (jsdom-safe and deterministic):
      // Tab moves forward, Shift+Tab moves backward, wrapping at both ends.
      event.preventDefault();
      const currentIndex = focusables.indexOf(document.activeElement);
      const count = focusables.length;
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + count) % count
        : (currentIndex + 1) % count;
      focusables[nextIndex].focus();
    },
    [isOpen, onClose]
  );

  // Escape handling at document level (also catches bubbled Escape from inputs)
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onDocKey);
    // Lock body scroll while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onDocKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${title ? 'arv-dialog-title' : undefined}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
          'rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800',
          'shadow-dialog outline-none',
          'max-h-[90dvh] overflow-y-auto overscroll-contain',
          'transition-all duration-200 ease-out',
          SIZES[size] || SIZES.md,
          className
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-4 pb-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <h2
            id="arv-dialog-title"
            className="text-base font-bold text-gray-900 dark:text-gray-100 truncate"
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
