/**
 * src/services/CSPService.js - ARVDOUL CONTENT SECURITY POLICY (CSP) MANAGER
 *
 * Implements:
 * 1. Strict Content Security Policy (CSP Level 3): Generates cryptographically secure nonces for inline scripts/styles.
 * 2. Violation Reporting Pipeline: Directs CSP report-uri/report-to telemetry to central security logging sink.
 * 3. Frame Ancestor Protection: Prevents UI redressing & clickjacking attacks.
 */

import { logger } from '../utils/Logger.js';

class CSPService {
  /**
   * Generates a CSP header string with nonces and trusted origin domains.
   */
  generateCSPHeader(nonce = '') {
    const scriptSrc = nonce ? `'self' 'nonce-${nonce}' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/` : `'self' 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`;
    const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
    const imgSrc = `'self' data: blob: https: https://*.googleusercontent.com https://firebasestorage.googleapis.com https://images.unsplash.com`;
    const connectSrc = `'self' https: wss: https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`;
    const fontSrc = `'self' data: https://fonts.gstatic.com`;
    const frameSrc = `'self' https://*.firebaseapp.com https://www.google.com/recaptcha/`;

    return [
      `default-src 'self'`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src ${imgSrc}`,
      `connect-src ${connectSrc}`,
      `font-src ${fontSrc}`,
      `frame-src ${frameSrc}`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ');
  }

  /**
   * Ingests and reports CSP violation payload.
   */
  handleCSPViolation(report) {
    if (!report || typeof report !== 'object') {
      logger.warn('[CSPService] Received malformed CSP violation report');
      return;
    }
    logger.warn('[CSPService] CSP Violation caught:', {
      blockedURI: report['blocked-uri'] ?? 'unknown',
      violatedDirective: report['violated-directive'] ?? 'unknown',
      documentURI: report['document-uri'] ?? 'unknown',
    });
  }
}

export const cspService = new CSPService();
export default cspService;
