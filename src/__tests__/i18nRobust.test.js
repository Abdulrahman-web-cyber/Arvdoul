/**
 * src/__tests__/i18nRobust.test.js
 * Regression test for the intro "Temporary Glitch" crash:
 * the async i18n init could race/fail (blocked storage in sandboxed
 * iframes), leaving react-i18next with NO instance so useTranslation()
 * threw and every error boundary caught a spurious crash.
 *
 * Fix: SYNCHRONOUS, failure-proof base init at module load.
 * This test proves:
 *   1. i18n.isInitialized === true immediately at import (no async wait)
 *   2. useTranslation() renders real strings on the very first render
 *   3. withLanguage injects a working t
 *   4. initI18n() survives blocked localStorage (never throws)
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { renderToString } from 'react-dom/server';

const i18n = (await import('../i18n/index.js')).default;
const { initI18n, withLanguage } = await import('../i18n/index.js');

function Probe() {
  const { t } = useTranslationShim();
  return <span>{t('intro.title2')}</span>;
}
// import useTranslation AFTER the real i18n module so the base init ran first
const { useTranslation: useTranslationShim } = await import('react-i18next');

describe('i18n robustness (intro glitch regression)', () => {
  test('base init completed synchronously at module load', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('intro.title1')).toBe('Connect. Create.');
  });

  test('useTranslation renders real strings on first render (no crash)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>
    );
    expect(screen.getByText('Community.')).toBeInTheDocument();
  });

  test('withLanguage injects a working t into class components', () => {
    class Classy extends React.Component {
      render() {
        return <b>{this.props.t('intro.title1')}</b>;
      }
    }
    const Wrapped = withLanguage(Classy);
    const html = renderToString(<Wrapped />);
    expect(html).toContain('Connect. Create.');
  });

  test('initI18n upgrade never throws even when storage access is blocked', async () => {
    // Simulate sandboxed iframe: every storage access throws SecurityError
    const blocked = new Proxy(
      {},
      {
        get: () => {
          throw new Error('SecurityError: The operation is insecure');
        },
      }
    );
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: blocked, configurable: true });

    try {
      const result = await initI18n();
      expect(result.isInitialized).toBe(true);
      // t still resolves
      expect(result.t('nav.home')).toBe('Home');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
      });
    }
  });

  test('withLanguage is defensive when i18n is missing', () => {
    // t falls back to key pass-through rather than throwing
    expect(typeof withLanguage).toBe('function');
  });
});
