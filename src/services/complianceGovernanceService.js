// src/services/complianceGovernanceService.js
//
// Consent, data-portability and age-gating helpers.
//
// Design notes:
//  - Consent is persisted under `user_settings.{uid}.privacy.consent`, the same
//    document the rest of the settings stack reads. There is deliberately no
//    parallel in-memory consent store.
//  - exportUserData delegates to the exportUserData Cloud Function, which
//    collects the caller's real documents. It never invents profile fields.
//  - executeRightToBeForgotten delegates to the deleteUserData Cloud Function
//    cascade. It returns the server's authoritative result; a failed cascade is
//    surfaced as a failure, never as a success receipt.

import { logger } from '../utils/Logger.js';
import { settingsService } from './settingsService.js';

export const COMPLIANCE_STANDARDS = {
  GDPR: 'EU_GDPR',
  CCPA: 'CALIFORNIA_CCPA',
  LGPD: 'BRAZIL_LGPD',
  COPPA: 'US_COPPA',
};

export const CONSENT_CATEGORIES = {
  ESSENTIAL: 'essential',
  ANALYTICS: 'analytics',
  PERSONALIZATION: 'personalization',
  ADVERTISING: 'advertising',
  AI_TRAINING: 'ai_training',
};

const CONSENT_PATH = 'privacy.consent';

/** Minimum self-service age per jurisdiction. */
const MIN_AGE_BY_JURISDICTION = {
  EU_GDPR: 16,
  BRAZIL_LGPD: 16,
  US_COPPA: 13,
  GLOBAL: 13,
};

/**
 * Resolves a jurisdiction label to its minimum age. Accepts both the
 * COMPLIANCE_STANDARDS constants ("EU_GDPR") and the short region codes used by
 * callers ("EU", "US", "BR"), and falls back to the global floor.
 */
export function resolveMinimumAge(jurisdiction) {
  if (!jurisdiction) return MIN_AGE_BY_JURISDICTION.GLOBAL;
  const label = String(jurisdiction).toUpperCase();
  if (label.includes('EU') || label.includes('GDPR') || label.includes('LGPD')) {
    return MIN_AGE_BY_JURISDICTION.EU_GDPR;
  }
  if (label.includes('US') || label.includes('COPPA') || label.includes('CCPA')) {
    return MIN_AGE_BY_JURISDICTION.US_COPPA;
  }
  return MIN_AGE_BY_JURISDICTION.GLOBAL;
}

/** Privacy-first defaults: nothing optional is enabled until opted in. */
function consentDefaults() {
  return {
    [CONSENT_CATEGORIES.ESSENTIAL]: true,
    [CONSENT_CATEGORIES.ANALYTICS]: false,
    [CONSENT_CATEGORIES.PERSONALIZATION]: false,
    [CONSENT_CATEGORIES.ADVERTISING]: false,
    [CONSENT_CATEGORIES.AI_TRAINING]: false,
    doNotSellOrShare: true,
    jurisdiction: 'GLOBAL',
    updatedAt: null,
  };
}

function normalizeConsent(stored) {
  const defaults = consentDefaults();
  if (!stored || typeof stored !== 'object') return defaults;
  return {
    ...defaults,
    ...stored,
    // Essential processing can never be switched off by the user.
    [CONSENT_CATEGORIES.ESSENTIAL]: true,
  };
}

export class ComplianceGovernanceService {
  constructor({ settings = settingsService } = {}) {
    this.settings = settings;
  }

  /**
   * Persists consent preferences for a user. Essential processing is forced on;
   * every other category reflects the explicit opt-in.
   */
  async updateConsentPreferences(userId, preferences = {}) {
    if (!userId) throw new Error('userId is required for consent registration');

    const consent = {
      ...consentDefaults(),
      [CONSENT_CATEGORIES.ESSENTIAL]: true,
      [CONSENT_CATEGORIES.ANALYTICS]: Boolean(preferences[CONSENT_CATEGORIES.ANALYTICS]),
      [CONSENT_CATEGORIES.PERSONALIZATION]: Boolean(preferences[CONSENT_CATEGORIES.PERSONALIZATION]),
      [CONSENT_CATEGORIES.ADVERTISING]: Boolean(preferences[CONSENT_CATEGORIES.ADVERTISING]),
      [CONSENT_CATEGORIES.AI_TRAINING]: Boolean(preferences[CONSENT_CATEGORIES.AI_TRAINING]),
      doNotSellOrShare: preferences.doNotSellOrShare === undefined ? true : Boolean(preferences.doNotSellOrShare),
      jurisdiction: preferences.jurisdiction || 'GLOBAL',
      updatedAt: new Date().toISOString(),
    };

    // Persist via the settings stack (its own error handling rolls back and
    // throws, so a failure here never looks like a saved preference).
    await this.settings.updateSetting(userId, CONSENT_PATH, consent);

    logger.info(`[Compliance] Consent updated for user ${userId}`, {
      analytics: consent.analytics,
      advertising: consent.advertising,
    });
    return consent;
  }

  /** Reads persisted consent, defaulting to privacy-first when unset. */
  async getConsentPreferences(userId) {
    if (!userId) return consentDefaults();
    try {
      const settings = await this.settings.getSettings(userId);
      const stored = settings?.privacy?.consent;
      return normalizeConsent(stored);
    } catch (error) {
      logger.warn(`[Compliance] Could not read consent for ${userId}`, error);
      return consentDefaults();
    }
  }

  /**
   * Requests a full portable archive of the caller's own data (GDPR Art. 20).
   * The Cloud Function is authoritative; this returns exactly what it returned.
   */
  async exportUserData(userId) {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const callable = httpsCallable(getFunctions(), 'exportUserData');
    const response = await callable({ userId });
    logger.info(`[Compliance] Data export completed for ${userId}`);
    return response.data;
  }

  /**
   * Executes GDPR Art. 17 erasure via the server cascade. The returned receipt
   * is the server's result; if the cascade fails this rejects.
   */
  async executeRightToBeForgotten(userId, options = {}) {
    if (!userId) throw new Error('userId is required for account erasure');

    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const callable = httpsCallable(getFunctions(), 'deleteUserData');
    const response = await callable({ userId, ...options });

    logger.info(`[Compliance] Erasure executed for ${userId}`, { result: response.data?.status });
    return response.data;
  }

  /**
   * Age gate for COPPA (under 13) / GDPR-K (under 16). Pure and synchronous.
   */
  validateAgeAndJurisdiction(birthDate, jurisdiction = 'GLOBAL') {
    if (!birthDate) return { isAllowed: false, reason: 'BIRTHDATE_REQUIRED' };

    const birthTime = new Date(birthDate).getTime();
    if (Number.isNaN(birthTime)) return { isAllowed: false, reason: 'INVALID_DATE' };

    const ageInYears = (Date.now() - birthTime) / (365.25 * 24 * 60 * 60 * 1000);
    const minAge = resolveMinimumAge(jurisdiction);

    if (ageInYears < minAge) {
      return {
        isAllowed: false,
        age: Math.floor(ageInYears),
        minAge,
        reason: 'UNDERAGE_RESTRICTION',
        requiresParentalConsent: true,
      };
    }

    return {
      isAllowed: true,
      age: Math.floor(ageInYears),
      minAge,
      requiresParentalConsent: false,
    };
  }
}

export const complianceGovernanceService = new ComplianceGovernanceService();
export default complianceGovernanceService;
