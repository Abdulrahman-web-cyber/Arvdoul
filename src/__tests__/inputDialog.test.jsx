/**
 * src/__tests__/inputDialog.test.jsx
 * Accessibility + behavior gates for the Dialog primitive.
 *   - Dialog: role/aria-modal, Escape close, focus trap, focus restore
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Dialog } from '../components/ui/Dialog.jsx';

// lib/utils.js is ESM; .jsx tests are transformed to CJS, so stub it.
jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

expect.extend(toHaveNoViolations);

describe('Dialog primitive', () => {
  const renderDialog = (props = {}) => {
    const onClose = jest.fn();
    const utils = render(
      <Dialog
        isOpen
        onClose={onClose}
        title="Confirm action"
        {...props}
      >
        <p>Are you sure?</p>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </Dialog>
    );
    return { ...utils, onClose };
  };

  test('has no axe violations', async () => {
    const { container } = renderDialog();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('renders with dialog semantics and modal flag', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  test('closes on Escape', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('closes via the close button', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes on overlay click when enabled', () => {
    const { onClose } = renderDialog({ closeOnOverlayClick: true });
    // The overlay is the backdrop element - fire click on the fixed container backdrop
    const overlay = document.querySelector('.fixed.inset-0 > div[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  test('does not close on overlay click when disabled', () => {
    const { onClose } = renderDialog({ closeOnOverlayClick: false });
    const overlay = document.querySelector('.fixed.inset-0 > div[aria-hidden="true"]');
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('traps focus between the first and last focusable elements', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(cancelButton);

    confirmButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    // wraps back to the first focusable (close button)
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
  });

  test('restores focus to the trigger element on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = jest.fn();
    const { rerender } = render(
      <Dialog isOpen onClose={onClose} title="T">
        <p>Content</p>
      </Dialog>
    );
    rerender(
      <Dialog isOpen={false} onClose={onClose} title="T">
        <p>Content</p>
      </Dialog>
    );

    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });

  test('renders null when closed', () => {
    const { container } = render(
      <Dialog isOpen={false} onClose={() => {}} title="T">
        <p>Content</p>
      </Dialog>
    );
    expect(container.firstChild).toBeNull();
  });
});
