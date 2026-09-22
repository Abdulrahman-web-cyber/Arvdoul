/**
 * src/__tests__/phase9ObservabilityAndCICD.test.js - Phase 9 Observability & CI/CD Telemetry Tests
 *
 * Validates:
 * 1. Distributed Tracing & Span Lifecycle.
 * 2. Real User Monitoring (RUM) & Core Web Vitals telemetry.
 * 3. Crash Reporting, Fingerprinting, and PII Redaction.
 * 4. Offline crash buffering & online drain.
 * 5. SLO & Error Budget calculation.
 */

import { jest } from '@jest/globals';
import { observabilityService } from '../services/observabilityService.js';
import { crashReportingService } from '../services/crashReportingService.js';

describe('Phase 9: Enterprise Observability & Crash Reporting', () => {
  beforeEach(() => {
    observabilityService.metricsRegistry.clear();
    observabilityService.activeSpans.clear();
    observabilityService.accumulatedDailyCost = 0.0;
    crashReportingService.breadcrumbs = [];
    localStorage.removeItem('arvdoul_pending_crashes');
  });

  describe('Distributed Tracing & Spans', () => {
    test('tracks span lifecycle and computes duration', () => {
      const traceId = 'trace_101';
      const spanId = observabilityService.startSpan(traceId, 'user.fetchProfile');
      expect(spanId).toBeDefined();

      const spans = observabilityService.activeSpans.get(traceId);
      expect(spans.length).toBe(1);
      expect(spans[0].name).toBe('user.fetchProfile');
      expect(spans[0].status).toBe('UNRESOLVED');

      observabilityService.endSpan(traceId, spanId);
      expect(spans[0].status).toBe('SUCCESS');
      expect(spans[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    test('records error metrics when span ends with exception', () => {
      const traceId = 'trace_102';
      const spanId = observabilityService.startSpan(traceId, 'wallet.processPayout');
      const err = new Error('Insufficient Funds');
      err.name = 'BalanceError';

      observabilityService.endSpan(traceId, spanId, err);
      const spans = observabilityService.activeSpans.get(traceId);
      expect(spans[0].status).toBe('ERROR');
      expect(spans[0].errorDetails).toBe('Insufficient Funds');
    });
  });

  describe('Crash Reporting & PII Redaction', () => {
    test('redacts emails, phone numbers, and API keys from stack & context', async () => {
      const rawError = new Error('Failed to authenticate user testuser@gmail.com with phone +1234567890');
      const context = {
        email: 'private@arvdoul.com',
        apiKey: 'AIzaSyDemoDummyKeyForTest12345678901234',
        userRole: 'creator'
      };

      const report = await crashReportingService.reportCrash(rawError, context);
      expect(report.errorMessage).not.toContain('testuser@gmail.com');
      expect(report.errorMessage).toContain('[REDACTED_EMAIL]');
      expect(report.errorMessage).toContain('[REDACTED_PHONE]');
      expect(report.context.email).toBe('[REDACTED]');
      expect(report.context.apiKey).toBe('[REDACTED]');
      expect(report.context.userRole).toBe('creator');
    });

    test('maintains bounded breadcrumb trail with FIFO eviction', () => {
      for (let i = 0; i < 25; i++) {
        crashReportingService.addBreadcrumb('navigation', `Route change to /profile/tab_${String.fromCharCode(65 + i)}`);
      }
      expect(crashReportingService.breadcrumbs.length).toBe(20);
      expect(crashReportingService.breadcrumbs[19].message).toContain('/profile/tab_Y');
    });

    test('buffers crash when offline and drains upon network restoration', async () => {
      const mockError = new Error('Offline Database Connection Timeout');
      crashReportingService._bufferOfflineCrash({
        errorName: 'TimeoutError',
        errorMessage: 'Offline Database Connection Timeout',
        timestamp: new Date().toISOString()
      });

      const buffered = JSON.parse(localStorage.getItem('arvdoul_pending_crashes') || '[]');
      expect(buffered.length).toBe(1);
      expect(buffered[0].errorName).toBe('TimeoutError');

      // Drain
      await crashReportingService.drainOfflineCrashes();
      expect(localStorage.getItem('arvdoul_pending_crashes')).toBeNull();
    });
  });

  describe('Core Web Vitals & SLO Tracking', () => {
    test('reports core web vitals into metric registry', () => {
      observabilityService.reportWebVital('LCP', 1450);
      observabilityService.reportWebVital('FID', 12);
      observabilityService.reportWebVital('CLS', 0.02);

      const lcp = observabilityService.metricsRegistry.get('rum_vital_lcp');
      expect(lcp).toBeDefined();
    });

    test('calculates SLO error budget status', () => {
      // Record some requests and errors
      observabilityService.recordMetric('api_latency_ms', 120, { api: 'feed' });
      observabilityService.recordMetric('api_latency_ms', 85, { api: 'feed' });
      observabilityService.recordMetric('error_count', 1, { api: 'feed' });

      const budget = observabilityService.getErrorBudgetStatus();
      expect(budget.slaTarget).toBe('99.90%');
      expect(budget.status).toBeDefined();
    });

    test('tracks Firestore cost control aggregation', () => {
      observabilityService.auditFirestoreCost('read', 1000);
      observabilityService.auditFirestoreCost('write', 500);

      expect(observabilityService.accumulatedDailyCost).toBeGreaterThan(0);
      expect(observabilityService.accumulatedDailyCost).toBeLessThan(observabilityService.dailyFirestoreCostLimit);
    });
  });
});
