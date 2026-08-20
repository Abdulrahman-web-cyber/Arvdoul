/**
 * src/i18n/index.js - ARVDOUL INTERNATIONALIZATION (i18n) BOOTSTRAP
 *
 * Initializes i18next with:
 *  - SYNCHRONOUS, FAILURE-PROOF base init at module load: `initReactI18next`
 *    is registered before any component renders, so `useTranslation()` can
 *    NEVER throw (this was the root cause of the intro "Temporary Glitch":
 *    when the async init was slow or failed - e.g. localStorage blocked in
 *    sandboxed contexts - react-i18next had no instance and crashed).
 *  - Browser language detection upgrade (navigator.language, persisted
 *    choice) via initI18n() - best-effort, never throws.
 *  - 7 bundled locales (en, es, fr, de, pt, hi, ar) with full key parity
 *  - RTL support (Arabic sets dir="rtl" on <html>)
 *  - `withLanguage` HOC for class components that must re-render on change
 *
 * Usage in function components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <button aria-label={t('nav.home')}>{t('nav.home')}</button>
 *
 * Usage in class components:
 *   import { withLanguage } from '../i18n';
 *   class Foo extends React.Component { render() { const { t } = this.props; ... } }
 *   export default withLanguage(Foo);
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import React from 'react';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', rtl: false },
  { code: 'es', label: 'Español', rtl: false },
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'de', label: 'Deutsch', rtl: false },
  { code: 'pt', label: 'Português', rtl: false },
  { code: 'hi', label: 'हिन्दी', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
];

const RESOURCES = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  hi: { translation: hi },
  ar: { translation: ar },
};

/** Applies dir/lang attributes to <html> for RTL correctness. */
export function applyLocaleDirection(lng) {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const locale = SUPPORTED_LOCALES.find((l) => lng && lng.startsWith(l.code));
    const isRtl = locale ? locale.rtl : false;
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lng || 'en');
  } catch {
    /* never break rendering for direction cosmetics */
  }
}

/**
 * SYNCHRONOUS base initialization - runs once at module load, wrapped in
 * try/catch so it can never throw. After this, `useTranslation()` and
 * `withLanguage` always have a working instance (English fallback).
 */
let baseInitialized = false;
try {
  i18n.use(initReactI18next).init({
    resources: RESOURCES,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'pt', 'hi', 'ar'],
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React escapes by default
    returnNull: false,
    react: { useSuspense: false },
  });
  baseInitialized = true;
  i18n.on('languageChanged', applyLocaleDirection);
  applyLocaleDirection(i18n.language || 'en');
} catch (err) {
  // Extremely defensive: even if the base init fails, the app must render.
  // useTranslation() will fall back to key-pass-through in the worst case.
  console.warn('[i18n] Base initialization failed (falling back to key pass-through):', err?.message);
}

/**
 * Best-effort upgrade: re-initializes with the browser language detector
 * (localStorage-persisted choice + navigator.language). Never throws.
 * Safe to call at app bootstrap without awaiting.
 * @returns {Promise<i18n>}
 */
export async function initI18n() {
  try {
    // Re-init with the detector: i18next supports re-initialization; when the
    // detector cannot read storage (sandboxed iframes, privacy modes) it
    // silently falls back to the base 'en' state instead of throwing.
    await i18n.use(LanguageDetector).init({
      resources: RESOURCES,
      fallbackLng: 'en',
      supportedLngs: ['en', 'es', 'fr', 'de', 'pt', 'hi', 'ar'],
      load: 'languageOnly',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'arvdoul_locale',
        // Fail-open when storage access is denied (e.g. sandboxed iframe).
        ignoreJSONStructure: true,
      },
      returnNull: false,
      react: { useSuspense: false },
    });
  } catch (err) {
    console.warn('[i18n] Detector upgrade failed (staying on base locale):', err?.message);
    // Ensure the base init state is intact even if the upgrade threw midway.
    try {
      if (!i18n.isInitialized) {
        i18n.use(initReactI18next).init({
          resources: RESOURCES,
          lng: 'en',
          fallbackLng: 'en',
          interpolation: { escapeValue: false },
          returnNull: false,
          react: { useSuspense: false },
        });
      }
    } catch {
      /* noop */
    }
  }

  applyLocaleDirection(i18n.language || 'en');
  return i18n;
}

export { baseInitialized };

/**
 * HOC that re-renders a class component when the language changes.
 * Injects `t` (i18next.t), `i18n` and `language` into props.
 * Defensive: never throws when i18n is unavailable.
 */
export function withLanguage(WrappedComponent) {
  return class WithLanguage extends React.Component {
    constructor(props) {
      super(props);
      this.state = { language: i18n?.language || 'en' };
    }

    componentDidMount() {
      try {
        this._unsubscribe = i18n?.on?.('languageChanged', (lng) =>
          this.setState({ language: lng })
        );
      } catch {
        /* noop */
      }
    }

    componentWillUnmount() {
      try {
        if (typeof this._unsubscribe === 'function') this._unsubscribe();
      } catch {
        /* noop */
      }
    }

    render() {
      const t = i18n?.t ? i18n.t.bind(i18n) : (key) => key;
      return React.createElement(WrappedComponent, {
        ...this.props,
        t,
        i18n,
        language: this.state.language,
      });
    }
  };
}

export default i18n;
