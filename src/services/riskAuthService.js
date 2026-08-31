/**
 * src/services/riskAuthService.js - ARVDOUL ADAPTIVE RISK-BASED AUTHENTICATION ENGINE
 *
 * Implements:
 * 1. Adaptive Multi-Factor Evaluation: Combines device reputation, IP geolocation, session age, and operation criticality.
 * 2. Step-Up Authentication Enforcement: Mandates biometric passkey or TOTP verification before high-value actions
 *    (e.g., password change, creator payout withdrawal, API key generation, account deletion).
 * 3. Dynamic Friction Management: Delivers frictionless 0-click experience for trusted low-risk sessions while shielding sensitive actions.
 * 4. Impossible Travel Speed Audit (CWE-20): Flags logins separated by geographic impossible travel speeds.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { alertingService } from './alertingService.js';

class RiskAuthService {
  /**
   * Helper to calculate Haversine distance between two coordinates in kilometers.
   * @private
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Assesses impossible travel risk.
   */
  assessImpossibleTravelRisk(lastLogin, currentLogin) {
    if (!lastLogin || !currentLogin) return { requiresStepUp: false, score: 0 };

    const distanceKm = this._calculateDistance(
      lastLogin.lat, lastLogin.lon,
      currentLogin.lat, currentLogin.lon
    );

    const timeDiffHrs = Math.abs(currentLogin.timestamp - lastLogin.timestamp) / 3600000;
    if (timeDiffHrs === 0) return { requiresStepUp: false, score: 0 };

    const speedKph = distanceKm / timeDiffHrs;

    // Commercial aircraft flies at roughly 900 km/h. Speed > 950 km/h is impossible travel (CWE-20)
    if (speedKph > 950 && distanceKm > 100) {
      logger.error(`[RiskAuth] Impossible Travel detected! Speed: ${Math.round(speedKph)} km/h over ${Math.round(distanceKm)} km.`);

      alertingService.triggerAlert(
        'impossible_travel_' + Date.now().toString(36),
        'p1_high',
        'Impossible Travel Speed Flagged',
        { speedKph, distanceKm, lastLoginLocation: lastLogin.city, currentLoginLocation: currentLogin.city }
      );

      return {
        requiresStepUp: true,
        reason: `Geographically impossible travel detected (${Math.round(speedKph)} km/h).`,
        recommendedMethod: 'totp',
        score: 0.95
      };
    }

    return { requiresStepUp: false, score: 0.01 };
  }

  /**
   * Evaluates if a sensitive operation requires step-up authentication.
   * @param {string} operation - 'withdrawal' | 'password_change' | 'email_update' | 'delete_account' | 'admin_action'
   * @param {Object} userContext - { lastAuthTime, isBiometricEnrolled, mfaEnabled, deviceTrusted }
   */
  evaluateStepUpRequirement(operation, userContext = {}) {
    const HIGH_SENSITIVITY_OPS = ['withdrawal', 'password_change', 'email_update', 'delete_account', 'admin_action'];
    const now = Date.now();
    const lastAuthAgeMs = now - (userContext.lastAuthTime || 0);
    const MAX_RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes fresh auth window

    if (HIGH_SENSITIVITY_OPS.includes(operation)) {
      if (lastAuthAgeMs > MAX_RECENT_AUTH_WINDOW_MS) {
        logger.info(`[RiskAuth] Step-up authentication required for sensitive op "${operation}". Auth age: ${Math.round(lastAuthAgeMs / 1000)}s`);
        return {
          requiresStepUp: true,
          reason: 'Recent authentication expired for high-security action',
          recommendedMethod: userContext.isBiometricEnrolled ? 'passkey' : userContext.mfaEnabled ? 'totp' : 'password',
        };
      }
    }

    return { requiresStepUp: false };
  }

  /**
   * Records successful step-up verification.
   */
  recordStepUpVerification(userId, operation, method) {
    auditLogger.log('auth.step_up_verified', {
      userId,
      meta: { operation, method, verifiedAt: Date.now() },
    });
  }
}

export const riskAuthService = new RiskAuthService();
export default riskAuthService;
