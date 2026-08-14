/**
 * src/services/scamDetectionService.js - ARVDOUL FINANCIAL SCAM & FRAUD DETECTION v8.0
 *
 * Implements:
 * 1. Cryptocurrency & Double-Your-Money Phishing Detection: Identifies BTC, ETH, SOL, XRP address solicitations,
 *    Telegram/Discord pump-and-dump signals, fake giveaways, and high-yield investment programs (HYIP).
 * 2. Advance-Fee & Wire Fraud Patterns: Flags impersonation of support personnel, lottery winners,
 *    demanding gift cards, and phishing for seed phrases or secret passphrases.
 * 3. Deep heuristic analysis, scoring matrix, and log triggers.
 */

import { logger } from '../utils/Logger.js';

class ScamDetectionService {
  constructor() {
    // Highly comprehensive cryptocurrency wallet address matching patterns
    this.cryptoAddresses = {
      btc: /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/i,
      eth: /\b(0x[a-fA-F0-9]{40})\b/i,
      sol: /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/,
      xrp: /\br[0-9a-zA-Z]{24,34}\b/,
    };

    // Sophisticated matching array for common financial scams, fake investment pools, and phishing indicators
    this.scamPhrases = [
      // Double your crypto / Giveaway fraud
      {
        pattern: /\b(send\s+(\d+|\w+)\s+(btc|eth|sol|crypto|coins|usd).+?and\s+get\s+(\d+|\w+)\s+(btc|eth|sol|crypto|coins|usd)?\s*back)\b/i,
        weight: 60,
        reason: 'Matches classic double-your-money giveaway scam pattern'
      },
      // HYIP & guaranteed high-yield investment returns
      {
        pattern: /\b(guaranteed\s+(returns|profit|income|yield)\s+of\s+\d+%\s+(daily|weekly|hourly|monthly))\b/i,
        weight: 55,
        reason: 'Guaranteed high-yield investment scheme or high-risk ROI claims'
      },
      // Urgency gift card schemes
      {
        pattern: /\b(claim\s+your\s+free\s+(\$|\d+)\s+gift\s+card|claim\s+free\s+rewards\s+immediately)\b/i,
        weight: 45,
        reason: 'High-probability reward phishing or gift card scheme'
      },
      // Seed phrase phishing / Security bypass solicitation
      {
        pattern: /\b(send\s+me\s+your\s+seed\s+phrase|private\s+key|password\s+for\s+verification|provide\s+secret\s+key)\b/i,
        weight: 80,
        reason: 'Critical: Private security credential or seed phrase solicitation detected'
      },
      // Impersonating support desk, urgent account suspension threats
      {
        pattern: /\b(official\s+support\s+desk|account\s+suspended\s+unless\s+you\s+pay|contact\s+security\s+agent\s+on\s+telegram)\b/i,
        weight: 50,
        reason: 'Support desk impersonation or account block extortion'
      },
      // Pump & Dump / Quick rich token signals
      {
        pattern: /\b(pump\s+and\s+dump|next\s+100x\s+gem|moon\s+shot\s+token|buy\s+now\s+before\s+listing|insider\s+trading\s+info)\b/i,
        weight: 40,
        reason: 'High-risk pump-and-dump or speculative token promotion'
      }
    ];
  }

  /**
   * Deeply analyzes input text to detect signs of financial fraud, wire schemes, or crypto scams.
   * @param {string} text - The input text content to analyze.
   * @returns {object} - { isScam: boolean, score: number, reasons: Array<string> }
   */
  evaluateScam(text) {
    if (!text || typeof text !== 'string') {
      return { isScam: false, score: 0, reasons: [] };
    }

    let score = 0;
    const reasons = [];

    // Analyze text for cryptocurrency wallet patterns
    for (const [coin, pattern] of Object.entries(this.cryptoAddresses)) {
      if (pattern.test(text)) {
        // BTC has high false positive chances if generic strings, but BC1 matches are highly specific.
        // SOL requires exact base58 character checking
        let detected = true;

        if (coin === 'sol') {
          // Verify that Sol address does not contain invalid base58 characters (0, O, I, l)
          const matched = text.match(pattern);
          if (matched) {
            const address = matched[0];
            if (/[0OIl]/.test(address)) {
              detected = false;
            }
          }
        }

        if (detected) {
          score += 35;
          reasons.push(`Contains a potential ${coin.toUpperCase()} cryptocurrency wallet address`);
        }
      }
    }

    // Check against heuristic scam patterns
    for (const phrase of this.scamPhrases) {
      if (phrase.pattern.test(text)) {
        score += phrase.weight;
        reasons.push(phrase.reason);
      }
    }

    // Constrain score between 0 and 100
    const finalScore = Math.min(100, Math.max(0, score));
    const isScam = finalScore >= 50;

    if (isScam) {
      logger.warn('[ScamDetection] Suspicious financial or security scam detected:', {
        score: finalScore,
        reasons,
        snippet: text.slice(0, 150)
      });
    }

    return {
      isScam,
      score: finalScore,
      reasons,
    };
  }
}

export const scamDetectionService = new ScamDetectionService();
export default scamDetectionService;
