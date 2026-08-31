/**
 * src/__tests__/introScreen.test.jsx
 * IntroScreen integrity gates:
 *   - NO fabricated statistics (the old "10M+ users / 99.99% uptime / 500K+
 *     communities / <50ms latency" claims must never return)
 *   - honest product pillars render
 *   - i18n strings resolve
 *   - axe: zero accessibility violations
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));
jest.mock('../components/Shared/ThemeToggle.jsx', () => () => null);
jest.mock('../i18n/index.js', () => {
  const ReactMock = require('react');
  return {
    // Identity HOC that injects `t` like the real withLanguage
    withLanguage: (Component) => (props) =>
      ReactMock.createElement(Component, { ...props, t: (key) => key }),
  };
});

const { default: IntroScreen } = require('../screens/IntroScreen.jsx');

expect.extend(toHaveNoViolations);

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        intro: {
          loading: 'Loading Arvdoul...',
          glitchTitle: 'Temporary Glitch',
          glitchText: 'The intro screen encountered an issue.',
          retry: 'Retry',
          title1: 'Connect. Create.',
          title2: 'Community.',
          tagline: 'Arvdoul is where meaningful connections happen.',
          featuresTitle: 'Everything You Need',
          features: {
            smartFeed: { title: 'Smart Feed', desc: 'AI-curated feed.' },
            privacy: { title: 'Privacy Control', desc: 'Full control.' },
            communities: { title: 'Communities', desc: 'Join communities.' },
            creation: { title: 'Creation Tools', desc: 'Create content.' },
            chat: { title: 'Real-time Chat', desc: 'Instant messaging.' },
            platform: { title: 'Multi-platform', desc: 'Everywhere.' },
          },
          pillars: {
            e2ee: { title: 'End-to-End Encrypted', desc: 'Modern cryptography.' },
            privacy: { title: 'Privacy by Design', desc: 'You control your data.' },
            creator: { title: 'Creator-First', desc: 'Monetize.' },
            realtime: { title: 'Real-Time Everything', desc: 'Live streams.' },
          },
          ctaTitle: 'Ready to Get Started?',
          ctaText: 'Join the creators.',
          createAccount: 'Create Account',
          signIn: 'Sign In',
          footnote: 'Free forever plan available',
          srWelcome: 'Welcome to Arvdoul.',
        },
      },
    },
  },
});

const renderIntro = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/']}>
        <IntroScreen />
      </MemoryRouter>
    </I18nextProvider>
  );

describe('IntroScreen - integrity', () => {
  test('renders without crashing', () => {
    renderIntro();
    // Brand name heading renders (plus logo/sr regions - hence getAll)
    expect(screen.getAllByText(/Arvdoul/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Arvdoul/i })).toBeInTheDocument();
  });

  test('contains NO fabricated statistics', () => {
    renderIntro();
    const fakeClaims = ['10M+', '99.99%', '500K', '50ms', 'millions of users'];
    for (const claim of fakeClaims) {
      expect(screen.queryByText(new RegExp(claim, 'i'))).toBeNull();
    }
  });

  test('renders honest product pillars', () => {
    renderIntro();
    expect(screen.getByText('End-to-End Encrypted')).toBeInTheDocument();
    expect(screen.getByText('Privacy by Design')).toBeInTheDocument();
    expect(screen.getByText('Creator-First')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Everything')).toBeInTheDocument();
  });

  test('renders all six feature cards from i18n', () => {
    renderIntro();
    expect(screen.getByText('Smart Feed')).toBeInTheDocument();
    expect(screen.getByText('Privacy Control')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
    expect(screen.getByText('Creation Tools')).toBeInTheDocument();
    expect(screen.getByText('Real-time Chat')).toBeInTheDocument();
    expect(screen.getByText('Multi-platform')).toBeInTheDocument();
  });

  test('navigation CTAs render', () => {
    renderIntro();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    const { container } = renderIntro();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
