/**
 * src/__tests__/componentsEnhanced.test.jsx
 * Behavior + accessibility gates for the enhanced primitives:
 * Tabs (keyboard nav, aria), Avatar (badges, status, keyboard click),
 * Card (variants, interactive), BottomSheet (dialog semantics, Escape,
 * focus trap, focus restore).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

const { Tabs, TabsList, TabsTrigger, TabsContent } = require('../components/ui/Tabs.jsx');
const { Avatar } = require('../components/ui/Avatar.jsx');
const { Card } = require('../components/ui/Card.jsx');
const { BottomSheet } = require('../components/ui/BottomSheet.jsx');

expect.extend(toHaveNoViolations);

describe('Tabs - keyboard navigation and ARIA', () => {
  // Stateful wrapper: the standard controlled-tabs pattern (parent owns
  // `active`, child reports via onSelect) - exactly how screens use it.
  const StatefulTabs = () => {
    const [active, setActive] = React.useState(0);
    const tabs = ['Feed', 'Videos', 'Audio'];
    return (
      <Tabs>
        <TabsList>
          {tabs.map((label, i) => (
            <TabsTrigger key={label} active={active === i} onSelect={() => setActive(i)}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((label, i) => (
          <TabsContent key={label} active={active === i}>
            {label} content
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  const renderTabs = () => render(<StatefulTabs />);

  test('has no axe violations', async () => {
    const { container } = renderTabs();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('renders tablist/tab semantics with aria-selected', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  test('arrow keys move focus and selection (roving tabindex)', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
    expect(tabs[0]).toHaveFocus();

    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(tabs[2]).toHaveFocus();
    fireEvent.keyDown(tabs[2], { key: 'Home' });
    expect(tabs[0]).toHaveFocus();
  });

  test('active tab panel is visible, others hidden', () => {
    const { container } = renderTabs();
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels.length).toBe(3);
    expect(panels[0]).not.toHaveAttribute('hidden');
    expect(panels[1]).toHaveAttribute('hidden');
    expect(panels[2]).toHaveAttribute('hidden');
  });
});

describe('Avatar - badges and status', () => {
  test('has no axe violations with badge + status', async () => {
    const { container } = render(
      <Avatar name="Ada Lovelace" src="https://example.com/a.png" badge="verified" status="online" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('renders verified badge with accessible label', () => {
    render(<Avatar name="Ada" badge="verified" />);
    expect(screen.getByLabelText('Verified account')).toBeInTheDocument();
  });

  test('renders creator badge with accessible label', () => {
    render(<Avatar name="Ada" badge="creator" />);
    expect(screen.getByLabelText('Creator')).toBeInTheDocument();
  });

  test('renders status dot as role=status', () => {
    render(<Avatar name="Ada" status="away" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: away');
  });

  test('clickable avatar is keyboard operable (Enter)', () => {
    const onClick = jest.fn();
    render(<Avatar name="Ada" onClick={onClick} />);
    const avatar = screen.getByRole('button');
    fireEvent.keyDown(avatar, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(avatar, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test('falls back to initials when the image fails', () => {
    const { container } = render(
      <Avatar name="Grace Hopper" src="https://example.com/broken.png" />
    );
    // jsdom does not load images, so trigger the error handler explicitly
    const img = container.querySelector('img');
    fireEvent.error(img);
    const fallback = container.querySelector('div[aria-hidden="true"]');
    expect(fallback).not.toBeNull();
    expect(fallback.textContent).toBe('G');
  });
});

describe('Card - variants and interactivity', () => {
  test('applies variant classes', () => {
    render(<Card variant="glass">Glass</Card>);
    expect(screen.getByText('Glass')).toHaveClass('backdrop-blur-md');
    render(<Card variant="bordered">Bordered</Card>);
    expect(screen.getByText('Bordered')).toHaveClass('border-2');
    render(<Card variant="solid">Solid</Card>);
    expect(screen.getByText('Solid')).toHaveClass('shadow-sm');
  });

  test('interactive card is a keyboard-operable button', () => {
    const onClick = jest.fn();
    render(<Card interactive onClick={onClick}>Press me</Card>);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('selected state adds a ring', () => {
    render(<Card selected>Selected</Card>);
    expect(screen.getByText('Selected')).toHaveClass('ring-2');
  });
});

describe('BottomSheet - accessibility', () => {
  test('renders as a modal dialog when open', () => {
    render(
      <BottomSheet isOpen onClose={() => {}} title="Options">
        <button type="button">Delete</button>
      </BottomSheet>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  test('closes on Escape', () => {
    const onClose = jest.fn();
    render(
      <BottomSheet isOpen onClose={onClose} title="Options">
        <button type="button">Delete</button>
      </BottomSheet>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('has no axe violations', async () => {
    const { container } = render(
      <BottomSheet isOpen onClose={() => {}} title="Options">
        <button type="button">Delete</button>
      </BottomSheet>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('traps focus within the sheet', () => {
    render(
      <BottomSheet isOpen onClose={() => {}} title="Options">
        <button type="button">First</button>
        <button type="button">Second</button>
      </BottomSheet>
    );
    const dialog = screen.getByRole('dialog');
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    closeBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);
    second.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  test('restores focus to the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open sheet';
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = jest.fn();
    const { rerender } = render(
      <BottomSheet isOpen onClose={onClose} title="Options">
        <button type="button">Delete</button>
      </BottomSheet>
    );
    rerender(
      <BottomSheet isOpen={false} onClose={onClose} title="Options">
        <button type="button">Delete</button>
      </BottomSheet>
    );

    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });
});
