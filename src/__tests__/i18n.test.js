/**
 * src/__tests__/i18n.test.js
 * Enforces translation integrity: every locale must be a strict superset of
 * the English key tree (missing keys break the UI silently), and RTL locales
 * must be flagged correctly. This test fails CI when a translator forgets a
 * key or when a new UI string is added only to en.json.
 */

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import de from '../i18n/locales/de.json';
import pt from '../i18n/locales/pt.json';
import hi from '../i18n/locales/hi.json';
import ar from '../i18n/locales/ar.json';
import { SUPPORTED_LOCALES, initI18n } from '../i18n/index.js';

const LOCALES = { en, es, fr, de, pt, hi, ar };

function flattenKeys(obj, prefix = '', out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function flattenNonEmpty(obj, prefix = '', out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenNonEmpty(value, path, out);
    } else if (typeof value === 'string' && value.trim().length > 0) {
      out.push(path);
    }
  }
  return out;
}

describe('i18n locale integrity', () => {
  const enKeys = flattenKeys(en);

  test('english key tree is non-trivial', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(30);
  });

  for (const [code, locale] of Object.entries(LOCALES)) {
    test(`${code} has every key present in en.json`, () => {
      const keys = flattenKeys(locale);
      const missing = enKeys.filter((k) => !keys.includes(k));
      expect(missing).toEqual([]);
    });

    test(`${code} has no empty placeholder values`, () => {
      const filled = flattenNonEmpty(locale);
      const keys = flattenKeys(locale);
      const empties = keys.filter((k) => !filled.includes(k));
      expect(empties).toEqual([]);
    });
  }

  test('every supported locale ships a bundle', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALES[locale.code]).toBeDefined();
    }
  });

  test('exactly one locale is RTL and it is ar', () => {
    const rtl = SUPPORTED_LOCALES.filter((l) => l.rtl);
    expect(rtl).toHaveLength(1);
    expect(rtl[0].code).toBe('ar');
  });

  test('initI18n resolves with english fallback in test env', async () => {
    const i18n = await initI18n();
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('nav.home')).toBeTruthy();
    expect(i18n.t('crash.title')).toBeTruthy();
    // Unknown keys return the key (visible bug surface) rather than crashing
    expect(typeof i18n.t('totally.missing_key')).toBe('string');
  });
});
