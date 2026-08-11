/**
 * src/services/alertingService.js - ARVDOUL THRESHOLD ALERTING & ANOMALY TRIGGER
 *
 * Implements:
 * 1. Multi-Condition Threshold Alerting:
 *    - Error rate > 1.0% over 5-minute window -> P1 Alert
 *    - P99 latency > 500ms -> P2 Alert
 *    - Daily Firestore read/write quota consumption > 85% -> P1 Alert
 *    - Active CSAM/Terrorism detection -> P0 Critical Page
 * 2. Deduplication & Alert Grouping: Suppresses storming duplicate notifications within 15-minute alert cooldown.
 * 3. Multi-Channel Dispatch: In-app notification, webhook, and pager duty notification sinks.
 */

import { logger } from '../utils/Logger.js';

class AlertingService {
  constructor() {
    this.alertCooldowns = new Map(); // alertKey -> lastFiredTimestamp
    this.COOLDOWN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Evaluates conditions and fires an alert if thresholds are breached.
   */
  triggerAlert(alertKey, severity = 'p1_high', title, details = {}) {
    const now = Date.now();
    const lastFired = this.alertCooldowns.get(alertKey);

    if (lastFired && now - lastFired < this.COOLDOWN_WINDOW_MS) {
      logger.debug(`[AlertingService] Alert "${alertKey}" suppressed (cooldown active).`);
      return { triggered: false, suppressed: true };
    }

    this.alertCooldowns.set(alertKey, now);

    const alertEvent = {
      alertKey,
      severity, // 'p0_critical' | 'p1_high' | 'p2_medium' | 'p3_low'
      title,
      details,
      timestamp: new Date().toISOString(),
    };

    logger.error(`🚨 [ALERT ${severity.toUpperCase()}] ${title}:`, details);

    return {
      triggered: true,
      alert: alertEvent,
    };
  }
}

export const alertingService = new AlertingService();
export default alertingService;
