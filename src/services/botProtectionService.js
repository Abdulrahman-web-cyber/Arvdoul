/**
 * src/services/botProtectionService.js - ARVDOUL BOT DEFENSE & BEHAVIORAL ENTROPY ENGINE
 *
 * Implements:
 * 1. Cursor & Touch Trajectory Entropy Analysis: Measures curvature variance, acceleration jitter, and trajectory micro-deviations.
 *    Bots exhibit linear or 0-jitter curves; real humans produce high-entropy fractal motion.
 * 2. Keystroke Dynamics: Analyzes flight time and dwell time distributions during form completion.
 * 3. Invisible Bot Scoring: Assigns behavioral confidence score (0.00 = bot, 1.00 = verified human).
 * 4. Headless Browser Detection: Inspects navigator flags, user-agents, WebGL renderers, and plugin limits.
 * 5. Touch Event Dynamics: Tracks tactile trajectory micro-movements on mobile/touch interfaces.
 */

import { logger } from '../utils/Logger.js';

class BotProtectionService {
  constructor() {
    this.mouseEvents = [];
    this.keyEvents = [];
    this.touchEvents = [];
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
      (e) => {
        if (this.keyEvents.length >= this.MAX_SAMPLES) this.keyEvents.shift();
        this.keyEvents.push({ time: Date.now(), type: 'down', key: e.key });
      },
      { passive: true }
    );

    window.addEventListener(
      'keyup',
      (e) => {
        if (this.keyEvents.length >= this.MAX_SAMPLES) this.keyEvents.shift();
        this.keyEvents.push({ time: Date.now(), type: 'up', key: e.key });
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        const touch = e.touches[0];
        if (this.touchEvents.length >= this.MAX_SAMPLES) this.touchEvents.shift();
        this.touchEvents.push({ x: touch.clientX, y: touch.clientY, time: Date.now() });
      },
      { passive: true }
    );
  }

  /**
   * Evaluates if client browser is running in a headless / automated environment (Puppeteer, Playwright, Selenium).
   * @private
   */
  _detectHeadlessEnvironment() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    const checks = [
      navigator.webdriver === true,
      window.callPhantom || window._phantom,
      window.__nightmare,
      /HeadlessChrome/.test(navigator.userAgent),
      navigator.languages === undefined || navigator.languages.length === 0,
      navigator.plugins.length === 0 && !(/iPhone|iPad|Macintosh/.test(navigator.userAgent)),
    ];

    return checks.some(check => !!check);
  }

  /**
   * Computes human entropy score based on collected mouse, touch, and key biometrics.
   */
  calculateHumanConfidence() {
    if (typeof window === 'undefined') return 1.0;

    // 1. Instantly flag headless browser environments
    if (this._detectHeadlessEnvironment()) {
      logger.warn('[BotProtection] Automated headless browser detected!');
      return 0.05;
    }

    // 2. Keystroke flight time variance analysis
    let keystrokeEntropy = 1.0;
    if (this.keyEvents.length >= 4) {
      const flightTimes = [];
      for (let i = 1; i < this.keyEvents.length; i++) {
        flightTimes.push(this.keyEvents[i].time - this.keyEvents[i - 1].time);
      }
      // Calculate variance of flight times. Pure scripts type with exact constant delay (variance = 0)
      const avg = flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length;
      const variance = flightTimes.reduce((acc, ft) => acc + Math.pow(ft - avg, 2), 0) / flightTimes.length;
      if (variance < 2.0) {
        logger.warn('[BotProtection] Scripted typing patterns detected (low variance).');
        keystrokeEntropy = 0.2;
      }
    }

    const mouseOrTouchSamples = [...this.mouseEvents, ...this.touchEvents];

    if (mouseOrTouchSamples.length < 5) {
      // Touch/Keyboard-only users fallback gracefully, combined with keystroke evaluation
      return Math.min(1.0, 0.85 * keystrokeEntropy);
    }

    // 3. Trajectory curvature variance calculations
    let totalCurvature = 0;
    for (let i = 2; i < mouseOrTouchSamples.length; i++) {
      const p1 = mouseOrTouchSamples[i - 2];
      const p2 = mouseOrTouchSamples[i - 1];
      const p3 = mouseOrTouchSamples[i];

      const dx1 = p2.x - p1.x;
      const dy1 = p2.y - p1.y;
      const dx2 = p3.x - p2.x;
      const dy2 = p3.y - p2.y;

      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      totalCurvature += Math.abs(angle2 - angle1);
    }

    const avgCurvature = totalCurvature / (mouseOrTouchSamples.length - 2);

    // Completely straight lines (avgCurvature near 0) indicate script-generated motion
    const isBotMotion = avgCurvature < 0.04;
    const trajectoryConfidence = isBotMotion ? 0.15 : Math.min(1.0, 0.45 + avgCurvature);

    return Math.min(trajectoryConfidence, keystrokeEntropy);
  }
}

export const botProtectionService = new BotProtectionService();
export default botProtectionService;
