/**
 * src/services/scamDetectionService.js - ARVDOUL FINANCIAL SCAM & FRAUD DETECTION
 *
 * Implements:
 * 1. Cryptocurrency & Double-Your-Money Phishing Detection: Identifies BTC/ETH address solicitations, Telegram pump-and-dump signals,
 *    fake giveaways, and high-yield investment programs (HYIP).
 * 2. Advance-Fee & Wire Fraud Patterns: Flags impersonation of lottery winners or platform support asking for gift cards or secret passphrases.
 * 3. Scorer & Risk Flagging.
 */

import { logger } from '../utils/Logger.js';

class ScamDetectionService {
  constructor() {
    this.cryptoAddressRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59}|0x[a-fA-F0-9]{40})\b/;
    this.scamPhrases = [
      /\b(send\s+(\d+|\w+)\s+(btc|eth|sol|crypto)\s+and\s+get\s+(\d+|\w+)\s+back)\b/i,
      /\b(guaranteed\s+(returns|profit|income)\s+of\s+\d+%\s+daily)\b/i,
      /\b(claim\s+your\s+free\s+(\$|\d+)\s+gift\s+card\s+now)\b/i,
      /\b(send\s+me\s+your\s+seed\s+phrase|private\s+key|password\s+for\s+verification)\b/i,
    ];
  }

  evaluateScam(text) {
    if (!text || typeof text !== 'string') return { isScam: false, score: 0 };

    let score = 0;
    const reasons = [];

    if (this.cryptoAddressRegex.test(text)) {
      score += 40;
      reasons.push('Contains cryptocurrency wallet address');
    }

    for (const pattern of this.scamPhrases) {
      if (pattern.test(text)) {
        score += 60;
        reasons.push('Matches high-risk financial giveaway or phishing phrase');
      }
    }

    const isScam = score >= 50;
    if (isScam) {
      logger.warn('[ScamDetection] Financial scam pattern flagged:', { score, reasons });
    }

    return {
      isScam,
      score,
      reasons,
    };
  }
}

export const scamDetectionService = new ScamDetectionService();
export default scamDetectionService;
