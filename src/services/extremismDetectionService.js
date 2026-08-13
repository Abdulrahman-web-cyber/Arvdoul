/**
 * src/services/extremismDetectionService.js - ARVDOUL VIOLENT EXTREMISM & TERRORISM DETECTION
 *
 * Implements:
 * 1. Violent Extremism / Terrorist Propaganda Keyword Matching: Identifies known international designated terrorist organizations and extremist manifestos.
 * 2. High-Priority Law Enforcement Escalation Pipeline.
 * 3. Immediate Zero-Tolerance Content Interception.
 * 4. False Positive Double Checks.
 */

import { logger } from '../utils/Logger.js';
import { alertingService } from './alertingService.js';

class ExtremismDetectionService {
  constructor() {
    this.extremismKeywords = [
      /\b(isis|al-qaeda|boko\s+haram|al-shabaab|taliban\s+propaganda|jihadist\s+manifesto)\b/i,
      /\b(white\s+supremacist\s+manifesto|ethnic\s+cleansing|death\s+to\s+(all\s+)?(jews|blacks|muslims|christians))\b/i,
    ];

    // Exception patterns to reduce false positives (e.g. academic or news reporting references)
    this.exceptionsList = [
      /\b(scholarly\s+study|academic\s+analysis|documentary\s+on\s+terrorism|un\s+security\s+council\s+report)\b/i
    ];
  }

  evaluateExtremism(text) {
    if (!text || typeof text !== 'string') return { detected: false };

    // 1. Check exception list to prevent false positive flags (CWE-20)
    for (const exception of this.exceptionsList) {
      if (exception.test(text)) {
        logger.info('[ExtremismDetection] Content matched educational/academic exemption. Lowering severity.');
        return { detected: false, exemption: true };
      }
    }

    for (const pattern of this.extremismKeywords) {
      if (pattern.test(text)) {
        logger.error('[ExtremismDetection] Critical violent extremist threat flagged.', { matched: pattern.toString() });

        // Instantly trigger high-priority operations alert and legal escalation page
        alertingService.triggerAlert(
          `violent_extremism_${Date.now().toString(36)}`,
          'p0_critical',
          'Violent Extremism / Terrorism Propaganda Identified',
          { contentExcerpt: text.substring(0, 150), matchedPattern: pattern.toString() }
        );

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
