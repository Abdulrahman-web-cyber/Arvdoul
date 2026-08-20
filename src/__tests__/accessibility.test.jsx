/**
 * src/__tests__/accessibility.test.jsx
 * Automated accessibility gates (axe-core) on the shared UI primitives.
 * These tests fail CI when a change introduces a WCAG 2.1 AA violation in
 * core navigation/input components.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import BottomNav from '../components/Shared/BottomNav.jsx';
import AdvancedToggleSwitch from '../components/AdvancedToggleSwitch.jsx';
import GlobalErrorBoundary from '../app/GlobalErrorBoundary.jsx';

expect.extend(toHaveNoViolations);

// Test i18n instance (English only)
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: { loading: 'Loading...' },
        nav: {
          home: 'Home', videos: 'Videos', chat: 'Chat', create: 'Create',
          coins: 'Coins', alerts: 'Alerts', profile: 'Profile',
          openQuickMenu: 'Open quick menu', closeQuickMenu: 'Close quick menu',
        },
        crash: {
          title: 'System Crash Detected', subtitle: 'subtitle', crashId: 'Crash ID',
          errorMessage: 'Error Message', unknownError: 'Unknown error',
          stackTrace: 'Stack Trace', componentTrace: 'Component Trace',
          autoRecover: 'Auto Recover System', copied: 'Copied', copyReport: 'Copy Error Report',
          reload: 'Reload App', clearCache: 'Clear Cache & Reset', recoveryAttempts: 'Recovery Attempts',
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Minimal stubs for the ESM/context dependencies of the components under test.
// (jest.mock intercepts CJS requires, which is how .jsx tests are loaded.)
// ---------------------------------------------------------------------------
jest.mock('../i18n/index.js', () => {
  const ReactMock = require('react');
  return {
    // Identity HOC that still injects a `t` function like the real one
    withLanguage: (Component) => (props) =>
      ReactMock.createElement(Component, { ...props, t: (key) => key }),
  };
});
jest.mock('../utils/errorCodes.js', () => ({
  ERROR_CODES: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
  getPublicMessage: (e) => e,
}));
jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));
jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}));
jest.mock('../hooks/useSound.js', () => ({ useSound: () => ({ playSound: () => {} }) }));
jest.mock('../hooks/useAnalytics.js', () => ({ useAnalytics: () => ({ track: () => {} }) }));
jest.mock('../store/appStore.js', () => ({
  useAppStore: () => ({ unreadCounts: {}, currentUser: { uid: 'u1', username: 'tester' } }),
}));
jest.mock('../components/Shared/QuickAccessPanel.jsx', () => () => null);

function renderWithI18n(ui) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('accessibility - BottomNav', () => {
  test('has no axe violations', async () => {
    const { container } = renderWithI18n(
      <MemoryRouter initialEntries={['/home']}>
        <BottomNav />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('exposes navigation landmark and labeled buttons', () => {
    renderWithI18n(
      <MemoryRouter initialEntries={['/home']}>
        <BottomNav />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
    // Active tab is announced as the current page
    expect(screen.getByRole('button', { name: /home/i })).toHaveAttribute('aria-current', 'page');
  });
});

describe('accessibility - AdvancedToggleSwitch', () => {
  test('has no axe violations', async () => {
    const { container } = renderWithI18n(
      <AdvancedToggleSwitch method="phone" onToggle={() => {}} theme="dark" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('implements radiogroup semantics', () => {
    renderWithI18n(<AdvancedToggleSwitch method="google" onToggle={() => {}} theme="dark" />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });
});

describe('accessibility - GlobalErrorBoundary (crashed state)', () => {
  test('renders an alert role and focusable heading', async () => {
    const ErrorProbe = () => {
      throw new Error('kaboom');
    };
    // Suppress the expected React error log for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderWithI18n(
      <GlobalErrorBoundary>
        <ErrorProbe />
      </GlobalErrorBoundary>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('h1[tabindex="-1"]')).not.toBeNull();
    spy.mockRestore();
  });
});
