/**
 * src/i18n/index.js - ARVDOUL INTERNATIONALIZATION (i18n) BOOTSTRAP
 *
 * Initializes i18next with:
 *  - Browser language detection (navigator.language, persisted choice)
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

/** Applies dir/lang attributes to <html> for RTL correctness. */
export function applyLocaleDirection(lng) {
  if (typeof document === 'undefined') return;
  const locale = SUPPORTED_LOCALES.find((l) => lng.startsWith(l.code));
  const isRtl = locale ? locale.rtl : false;
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lng);
}

export async function initI18n() {
  if (i18n.isInitialized) return i18n;

  await i18n.use(LanguageDetector).use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      hi: { translation: hi },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'pt', 'hi', 'ar'],
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React escapes by default
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'arvdoul_locale',
    },
    returnNull: false,
  });

  i18n.on('languageChanged', applyLocaleDirection);
  applyLocaleDirection(i18n.language);
  return i18n;
}

/**
 * HOC that re-renders a class component when the language changes.
 * Injects `t` (i18next.t) and `i18n` into props.
 */
export function withLanguage(WrappedComponent) {
  return class WithLanguage extends React.Component {
    constructor(props) {
      super(props);
      this.state = { language: i18n.language };
    }

    componentDidMount() {
      this._unsubscribe = i18n.on('languageChanged', (lng) => this.setState({ language: lng }));
    }

    componentWillUnmount() {
      if (this._unsubscribe) this._unsubscribe();
    }

    render() {
      return React.createElement(WrappedComponent, {
        ...this.props,
        t: i18n.t.bind(i18n),
        i18n,
        language: this.state.language,
      });
    }
  };
}

export default i18n;
