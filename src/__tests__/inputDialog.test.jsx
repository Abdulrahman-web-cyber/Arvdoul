/**
 * src/__tests__/inputDialog.test.jsx
 * Accessibility + behavior gates for the Input and Dialog primitives.
 *   - Input: label wiring, aria-invalid/describedby, validation states, loading
 *   - Dialog: role/aria-modal, Escape close, focus trap, focus restore
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Input } from '../components/ui/Input.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';

// lib/utils.js is ESM; .jsx tests are transformed to CJS, so stub it.
jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

expect.extend(toHaveNoViolations);

describe('Input primitive', () => {
  test('has no axe violations in every validation state', async () => {
    for (const validation of ['normal', 'error', 'success', 'warning']) {
      const { container } = render(
        <Input
          label="Email"
          type="email"
          validation={validation}
          error={validation === 'error' ? 'Invalid email' : undefined}
          hint={validation !== 'error' ? 'We will never share your email' : undefined}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  test('wires label to input via htmlFor/id', () => {
    render(<Input label="Username" />);
    const input = screen.getByLabelText('Username');
    expect(input.tagName).toBe('INPUT');
  });

  test('marks required inputs with aria-required', () => {
    render(<Input label="Name" required />);
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('aria-required', 'true');
  });

  test('error state sets aria-invalid and links the message', () => {
    render(<Input label="Password" error="Too short" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    const messageId = input.getAttribute('aria-describedby');
    expect(screen.getByText('Too short')).toHaveAttribute('id', messageId);
  });

  test('hint text is announced via aria-describedby', () => {
    render(<Input label="Phone" hint="Include country code" />);
    const input = screen.getByLabelText('Phone');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Include country code')).toBeInTheDocument();
  });

  test('loading disables input and sets aria-busy', () => {
    render(<Input label="Search" loading />);
    const input = screen.getByLabelText('Search');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-busy', 'true');
  });

  test('renders the correct input type per variant', () => {
    render(<Input label="Password" type="password" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  test('otp variant limits length to maxLength', () => {
    render(<Input label="Code" type="otp" maxLength={6} />);
    expect(screen.getByLabelText('Code')).toHaveAttribute('maxlength', '6');
  });
});

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
