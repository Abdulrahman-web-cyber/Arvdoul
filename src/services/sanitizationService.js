// src/services/sanitizationService.js

import DOMPurify from 'dompurify';

class SanitizationService {
  /**
   * Sanitizes rich HTML string using DOMPurify with strict allowed tags.
   */
  sanitizeHTML(dirtyHTML) {
    if (!dirtyHTML || typeof dirtyHTML !== 'string') return '';
    return DOMPurify.sanitize(dirtyHTML, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  }

  /**
   * Encodes HTML entities for plain text display.
   */
  escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validates and cleans external links.
   */
  sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('mailto:')) {
      return trimmed;
    }
    return '';
  }
}

export const sanitizationService = new SanitizationService();
export default sanitizationService;
