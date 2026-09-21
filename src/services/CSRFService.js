// src/services/CSRFService.js

import { logger } from '../utils/Logger.js';

class CSRFService {
  constructor() {
    this._token = null;
    this._tokenExpiry = 0;
  }

  /**
   * Generates or retrieves an active CSRF token.
   */
  getToken() {
    const now = Date.now();
    if (!this._token || now > this._tokenExpiry) {
      const randomBytes = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomBytes);
        this._token = Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        this._token = `csrf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
      this._tokenExpiry = now + 4 * 60 * 60 * 1000; // 4 hour validity
    }
    return this._token;
  }

  /**
   * Constant-time comparison between incoming header token and stored token.
   */
  verifyToken(providedToken) {
    if (!providedToken || !this._token) return false;
    if (providedToken.length !== this._token.length) return false;

    let result = 0;
    for (let i = 0; i < this._token.length; i++) {
      result |= providedToken.charCodeAt(i) ^ this._token.charCodeAt(i);
    }
    return result === 0;
  }
}

export const csrfService = new CSRFService();
export default csrfService;
