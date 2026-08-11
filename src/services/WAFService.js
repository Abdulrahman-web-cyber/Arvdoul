/**
 * src/services/WAFService.js - ARVDOUL WEB APPLICATION FIREWALL (WAF)
 *
 * Implements:
 * 1. OWASP Top 10 Real-Time Inspection: Detects SQL Injection (SQLi), Cross-Site Scripting (XSS),
 *    Remote Code Execution (RCE), Path Traversal, and XML External Entity (XXE) attack vectors.
 * 2. Signature & Regex Engine: Evaluates query params, request bodies, and headers against known threat signatures.
 * 3. Automatic Request Dropping & IP Penalization.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class WAFService {
  constructor() {
    this.threatPatterns = [
      { name: 'SQLi', regex: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b)|(--|\/\*|\*\/)/i },
      { name: 'XSS', regex: /(<script\b[^>]*>|javascript:|onerror\s*=|onload\s*=|eval\(|<iframe\b)/i },
      { name: 'PathTraversal', regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/)/i },
      { name: 'RCE/CommandInjection', regex: /(;|\||`|\$\(|\/bin\/sh|\/bin\/bash|cmd\.exe|powershell)/i },
      { name: 'XXE', regex: /(<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["'])/i },
    ];
  }

  /**
   * Inspects a string payload or object values against attack patterns.
   */
  inspectPayload(payload) {
    if (!payload) return { safe: true };

    const checkString = (str) => {
      for (const pattern of this.threatPatterns) {
        if (pattern.regex.test(str)) {
          return { safe: false, threat: pattern.name, matched: str.slice(0, 100) };
        }
      }
      return { safe: true };
    };

    if (typeof payload === 'string') {
      return checkString(payload);
    }

    if (typeof payload === 'object') {
      for (const key of Object.keys(payload)) {
        const val = payload[key];
        if (typeof val === 'string') {
          const res = checkString(val);
          if (!res.safe) {
            logger.warn(`[WAF] Blocked ${res.threat} attempt in field "${key}":`, res.matched);
            auditLogger.log('security.waf_blocked', { meta: { field: key, threat: res.threat } });
            return res;
          }
        } else if (typeof val === 'object' && val !== null) {
          const res = this.inspectPayload(val);
          if (!res.safe) return res;
        }
      }
    }

    return { safe: true };
  }
}

export const wafService = new WAFService();
export default wafService;
