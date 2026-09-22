/**
 * src/services/extremismDetectionService.js - ARVDOUL VIOLENT EXTREMISM & TERRORISM DETECTION v8.0
 *
 * Implements:
 * 1. Keyword & Organization Token Matchers: Detects references to verified terrorist organizations or violent groups.
 * 2. Leet-Speak De-Obfuscation: Standardizes character substitutions to prevent obfuscated recruitment.
 * 3. Law Enforcement Escalation: Flags critical instances needing automated triage and audit filing.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { alertingService } from './alertingService.js';

class ExtremismDetectionService {
  constructor() {
    // Critical extremist recruitment, propaganda, or group solicitation indicators
    this.violentExtremistTerms = [
      /\b(isis|al-qaeda|taliban|boko-haram|violent\s+insurrection|jihadist\s+strike|terrorist\s+bombing)\b/i,
      /\b(white\s+supremacy|neo-nazi|death\s+to\s+infidels|racial\s+holy\s+war|white\s+power)\b/i,
    ];
  }

  /**
   * Normalizes leet-speak and special symbol obfuscations.
   * @private
   */
  _deobfuscateText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[@4]/g, 'a')
      .replace(/[1!|]/g, 'i')
      .replace(/[0]/g, 'o')
      .replace(/[3]/g, 'e')
      .replace(/[$5]/g, 's')
      .replace(/[7]/g, 't')
      .replace(/[\s._-]+/g, ' ');
  }

  /**
   * Evaluates text for signs of violent extremism, hate group membership, or terror recruiting.
   * @param {string} text - text to inspect
   * @param {object} metadata - context metadata
   * @returns {object} - evaluation decision with flags and triage details
   */
  evaluateExtremism(text, metadata = {}) {
    if (!text || typeof text !== 'string') {
      return { isExtremistFlagged: false, score: 0 };
    }

    const normalized = this._deobfuscateText(text);
    let score = 0;
    const reasons = [];

    for (const pattern of this.violentExtremistTerms) {
      if (pattern.test(text) || pattern.test(normalized)) {
        score = 100;
        reasons.push(`Matches prohibited extremist or group recruiting pattern: ${pattern.toString()}`);
      }
    }

    const isExtremistFlagged = score >= 90;

    if (isExtremistFlagged) {
      logger.error('[ExtremismDetection] Prohibited violent extremist patterns flagged!', { score, reasons });

      // Auto-Escalate to law enforcement monitoring and file security incident
      alertingService.triggerAlert(
        `extremism_intercept_${metadata.userId || 'anon'}`,
        'P0_CRITICAL',
        'Violent extremist propaganda or recruiting match detected.',
        { userId: metadata.userId, textSnippet: text.slice(0, 100), reasons }
      );

      auditLogger.log('safety.extremism_threat_intercepted', {
        userId: metadata.userId || 'anon',
        meta: { reasons, textHash: text.length, escalatedToLawEnforcement: true }
      });
    }

    return {
      isExtremistFlagged,
      score,
      reasons,
      action: isExtremistFlagged ? 'BLOCK_AND_ESCALATE_TO_LAW_ENFORCEMENT' : 'ALLOW'
    };
  }
}

export const extremismDetectionService = new ExtremismDetectionService();
export default extremismDetectionService;
