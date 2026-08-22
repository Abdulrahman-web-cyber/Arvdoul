/**
 * src/__tests__/designSystem.test.jsx
 * Accessibility + behavior gates for the design-system primitives:
 * Button (variants/sizes/loading/disabled), EmptyState, ErrorState,
 * Skeleton, and the NotFound screen. Zero axe violations required.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

import Button from '../design-system/Button.jsx';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import Skeleton, { CardSkeleton } from '../design-system/Skeleton.jsx';
import NotFoundScreen from '../screens/NotFoundScreen.jsx';

// lib/utils.js is ESM; this .jsx test is transformed to CJS, so stub it.
jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

expect.extend(toHaveNoViolations);

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        notFound: {
          title: 'Page not found',
          description: 'The link you followed may be broken.',
          goHome: 'Go Home',
        },
      },
    },
  },
});

const renderWithI18n = (ui) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('design-system Button', () => {
  test('has no axe violations in every variant', async () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'outline', 'destructive', 'success']) {
      const { container } = renderWithI18n(<Button variant={variant}>Action</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  test('renders a real button with correct semantics', () => {
    renderWithI18n(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  test('loading state disables interaction and announces progress', () => {
    renderWithI18n(<Button loading loadingLabel="Saving...">Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  test('disabled state prevents clicks', () => {
    const onClick = jest.fn();
    renderWithI18n(<Button disabled onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  test('applies size classes', () => {
    renderWithI18n(<Button size="lg">Big</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3');
  });
});

describe('design-system EmptyState', () => {
  test('has no axe violations and announces its role', async () => {
    const { container } = renderWithI18n(
      <EmptyState title="No posts yet" description="Follow someone to see their posts." />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(screen.getByRole('status')).toHaveTextContent('No posts yet');
  });
});

describe('design-system ErrorState', () => {
  test('has no axe violations and announces errors with alert role', async () => {
    const onRetry = jest.fn();
    const { container } = renderWithI18n(
      <ErrorState title="Could not load feed" message="Check your connection and try again." onRetry={onRetry} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load feed');
  });

  test('retry button triggers the handler', () => {
    const onRetry = jest.fn();
    renderWithI18n(<ErrorState title="Error" onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('design-system Skeleton', () => {
  test('has no axe violations and is hidden from assistive tech', async () => {
    const { container } = renderWithI18n(
      <div>
        <CardSkeleton />
        <Skeleton shape="circle" width="w-10" height="h-10" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('NotFoundScreen', () => {
  test('has no axe violations', async () => {
    const { container } = renderWithI18n(
      <MemoryRouter initialEntries={['/nope']}>
        <NotFoundScreen />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('links home with an accessible label', () => {
    renderWithI18n(
      <MemoryRouter initialEntries={['/nope']}>
        <NotFoundScreen />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/home');
  });
});
