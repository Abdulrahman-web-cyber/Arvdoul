/**
 * src/services/extremismDetectionService.js - ARVDOUL VIOLENT EXTREMISM & TERRORISM DETECTION
 *
 * Implements:
 * 1. Violent Extremism / Terrorist Propaganda Keyword Matching: Identifies known international designated terrorist organizations and extremist manifestos.
 * 2. High-Priority Law Enforcement Escalation Pipeline.
 * 3. Immediate Zero-Tolerance Content Interception.
 */

import { logger } from '../utils/Logger.js';

class ExtremismDetectionService {
  constructor() {
    this.extremismKeywords = [
      /\b(isis|al-qaeda|boko\s+haram|al-shabaab|taliban\s+propaganda|jihadist\s+manifesto)\b/i,
      /\b(white\s+supremacist\s+manifesto|ethnic\s+cleansing|death\s+to\s+(all\s+)?(jews|blacks|muslims|christians))\b/i,
    ];
  }

  evaluateExtremism(text) {
    if (!text || typeof text !== 'string') return { detected: false };

    for (const pattern of this.extremismKeywords) {
      if (pattern.test(text)) {
        logger.error('[ExtremismDetection] Critical violent extremist threat flagged.', { matched: pattern.toString() });
        return {
          detected: true,
          severity: 'critical',
          category: 'violent_extremism',
          action: 'instant_block_and_escalate',
        };
      }
    }

    return { detected: false };
  }
}

export const extremismDetectionService = new ExtremismDetectionService();
export default extremismDetectionService;
