// src/hooks/useEscapeClose.js
// Closes a modal/drawer when Escape is pressed (WCAG 2.2 — dialog dismissal).
// Safe in jsdom (no window listeners leak; cleanup on unmount).
import { useEffect } from 'react';

export function useEscapeClose(open, onClose, { ignoreInputs = false } = {}) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (!ignoreInputs) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        // Escape inside a text field first clears/blurs it (native behavior)
        // — only close the modal when the input is not focused.
        if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
          document.activeElement?.blur();
          return;
        }
      }
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose, ignoreInputs]);
}

export default useEscapeClose;
