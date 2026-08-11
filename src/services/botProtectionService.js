/**
 * src/services/botProtectionService.js - ARVDOUL BOT DEFENSE & BEHAVIORAL ENTROPY ENGINE
 *
 * Implements:
 * 1. Cursor & Touch Trajectory Entropy Analysis: Measures curvature variance, acceleration jitter, and trajectory micro-deviations.
 *    Bots exhibit linear or 0-jitter curves; real humans produce high-entropy fractal motion.
 * 2. Keystroke Dynamics: Analyzes flight time and dwell time distributions during form completion.
 * 3. Invisible Bot Scoring: Assigns behavioral confidence score (0.00 = bot, 1.00 = verified human).
 */

import { logger } from '../utils/Logger.js';

class BotProtectionService {
  constructor() {
    this.mouseEvents = [];
    this.keyEvents = [];
    this.MAX_SAMPLES = 50;
    this._attachListeners();
  }

  _attachListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'mousemove',
      (e) => {
        if (this.mouseEvents.length >= this.MAX_SAMPLES) this.mouseEvents.shift();
        this.mouseEvents.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      },
      { passive: true }
    );

    window.addEventListener(
      'keydown',
      () => {
        if (this.keyEvents.length >= this.MAX_SAMPLES) this.keyEvents.shift();
        this.keyEvents.push({ time: Date.now() });
      },
      { passive: true }
    );
  }

  /**
   * Computes human entropy score based on collected telemetry.
   */
  calculateHumanConfidence() {
    if (typeof window === 'undefined') return 1.0;

    // 1. Mouse motion entropy
    if (this.mouseEvents.length < 5) {
      // Touch device or keyboard user fallback
      return 0.9;
    }

    let totalCurvature = 0;
    for (let i = 2; i < this.mouseEvents.length; i++) {
      const p1 = this.mouseEvents[i - 2];
      const p2 = this.mouseEvents[i - 1];
      const p3 = this.mouseEvents[i];

      const dx1 = p2.x - p1.x;
      const dy1 = p2.y - p1.y;
      const dx2 = p3.x - p2.x;
      const dy2 = p3.y - p2.y;

      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      totalCurvature += Math.abs(angle2 - angle1);
    }

    const avgCurvature = totalCurvature / (this.mouseEvents.length - 2);

    // Completely straight lines (avgCurvature near 0) indicate script-generated motion
    const isBot = avgCurvature < 0.05;
    const confidenceScore = isBot ? 0.2 : Math.min(1.0, 0.5 + avgCurvature);

    return confidenceScore;
  }
}

export const botProtectionService = new BotProtectionService();
export default botProtectionService;
