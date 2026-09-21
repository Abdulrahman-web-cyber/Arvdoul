// src/services/SecureHeadersService.js

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
