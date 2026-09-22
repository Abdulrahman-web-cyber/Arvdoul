/**
 * src/services/SecureHeadersService.js - ARVDOUL SECURE HTTP HEADERS SERVICE
 *
 * Implements:
 * 1. Comprehensive HSTS (HTTP Strict Transport Security): 2-year max-age with preload and includeSubDomains.
 * 2. X-Content-Type-Options: nosniff to prevent MIME type confusion attacks.
 * 3. Referrer-Policy: strict-origin-when-cross-origin.
 * 4. Permissions-Policy: Restricts camera, microphone, and geolocation strictly to trusted origins.
 */

class SecureHeadersService {
  getSecurityHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-site',
    };
  }
}

export const secureHeadersService = new SecureHeadersService();
export default secureHeadersService;
