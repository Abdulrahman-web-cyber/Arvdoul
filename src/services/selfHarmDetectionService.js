/**
 * src/services/selfHarmDetectionService.js - ARVDOUL CRISIS INTERVENTION & SELF-HARM DETECTOR v8.0
 *
 * Implements:
 * 1. Suicide & Self-Harm Keyword Detection: Flags expressions of acute self-harm intent.
 * 2. Emergency Hotline Response: Injects helpful suicide prevention helpline resource info.
 * 3. Urgent Safety Triage Escalation: Fires high-priority alerts to secure support operations.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { alertingService } from './alertingService.js';

class SelfHarmDetectionService {
  constructor() {
    this.crisisHelplineMessage = 'If you or someone you know is struggling or in crisis, help is available. You are not alone. Please call or text 988 in the US/Canada, or reach out to your local emergency services.';

    this.selfHarmTerms = [
      /\b(suicide|kill\s+myself|end\s+my\s+life|slit\s+my\s+wrists|want\s+to\s+die|hang\s+myself)\b/i,
      /\b(cutting\s+myself|self-harm|swallowing\s+pills\s+to\s+die|goodbye\s+cruel\s+world|overdose)\b/i,
    ];
  }

  /**
   * Evaluates text for indications of self-harm or suicidal ideation.
   * @param {string} text - text to inspect
   * @param {object} metadata - context metadata
   * @returns {object} - decision object with safety resources
   */
  evaluateSelfHarm(text, metadata = {}) {
    if (!text || typeof text !== 'string') {
      return { isSelfHarmFlagged: false, score: 0 };
    }

    const lower = text.toLowerCase();
    let score = 0;
    const reasons = [];

    for (const pattern of this.selfHarmTerms) {
      if (pattern.test(lower)) {
        score = 95;
        reasons.push(`Matches self-harm or suicidal ideation phrase: ${pattern.toString()}`);
      }
    }

    const isSelfHarmFlagged = score >= 80;

    if (isSelfHarmFlagged) {
      logger.warn('[SelfHarmDetection] Self-harm or suicidal intent flagged. Triggering crisis intervention.', { score, reasons });

      // Automatically fire urgent safety notification to operators
      alertingService.triggerAlert(
        `self_harm_ideation_${metadata.userId || 'anon'}`,
        'P1_HIGH',
        'User ideation threat flagged. Crisis intervention recommended.',
        { userId: metadata.userId, textSnippet: text.slice(0, 100) }
      );

      auditLogger.log('safety.self_harm_ideation_detected', {
        userId: metadata.userId || 'anon',
        meta: { reasons, helplineOffered: true }
      });
    }

    return {
      isSelfHarmFlagged,
      score,
      reasons,
      recommendedResource: isSelfHarmFlagged ? this.crisisHelplineMessage : null,
      action: isSelfHarmFlagged ? 'FLAG_AND_INJECT_HELP_RESOURCES' : 'ALLOW'
    };
  }
}

export const selfHarmDetectionService = new SelfHarmDetectionService();
export default selfHarmDetectionService;
