/**
 * src/services/securityHeadersService.js - ARVDOUL SYSTEM-WIDE SECURITY HEADERS SERVICE
 *
 * Configures robust application-security constraints. Offers pre-computed header mappings
 * representing CSP (Content Security Policy), CSRF (Anti-CSRF Tokens), HSTS, and XSS protectors
 * to guarantee extreme security for all gateway routers.
 */

export class SecurityHeadersService {
  /**
   * Generates standard robust security response headers (Pillar 43-45)
   */
  getSecurityHeaders(cspNonce = '') {
    return {
      'Content-Security-Policy': this._generateCSP(cspNonce),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    };
  }

  /**
   * Secure Anti-CSRF Token Generation (Pillar 44)
   */
  generateCSRFToken() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(24);
      crypto.getRandomValues(array);
      return btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, '');
    }
    return `csrf_${Math.random().toString(36).substr(2, 12)}_${Date.now()}`;
  }

  _generateCSP(nonce) {
    const nonceDirective = nonce ? `'nonce-${nonce}'` : '';

    return [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://apis.google.com https://js.stripe.com ${nonceDirective}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://picsum.photos https://images.unsplash.com",
      "connect-src 'self' https://*.googleapis.com wss://*.firebase_database_id.firebaseio.com https://api.openai.com https://api.stripe.com wss://signaling.arvdoul.com",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' blob: data: https://firebasestorage.googleapis.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
  }
}

export const securityHeadersService = new SecurityHeadersService();
export default securityHeadersService;
