/**
 * src/__tests__/crashReportingService.test.js
 *
 * crashReportingService is live (AppBootstrap + GlobalErrorBoundary wire it),
 * so its PII redaction, breadcrumb cap, offline buffer and Sentry dispatch must
 * be exercised for real. No part of the service is mocked: the network is the
 * only thing stubbed, and only to prove the dispatch shape.
 */

import { jest } from '@jest/globals';

const { crashReportingService } = await import('../services/crashReportingService.js');

const setOnline = (value) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });

beforeEach(() => {
  crashReportingService.breadcrumbs = [];
  localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  delete crashReportingService['sentryDsn'];
});

describe('PII redaction (CWE-209)', () => {
  test('redacts emails, phone numbers and API keys from strings', () => {
    const out = crashReportingService._redactPII(
      'user a@b.com called +15551234567 with AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456'
    );
    expect(out).toContain('[REDACTED_EMAIL]');
    expect(out).toContain('[REDACTED_PHONE]');
    expect(out).toContain('[REDACTED_API_KEY]');
    expect(out).not.toContain('a@b.com');
  });

  test('redacts sensitive object keys and recurses into the rest', () => {
    const out = crashReportingService._redactPII({
      email: 'a@b.com',
      password: 'hunter2',
      apiKey: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456',
      profile: { phone: '+15551234567', displayName: 'Ada' },
    });
    expect(out.email).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.profile.phone).toBe('[REDACTED]');
    expect(out.profile.displayName).toBe('Ada');
  });
});

describe('breadcrumbs', () => {
  test('caps the trail at 20 and keeps the newest', () => {
    for (let i = 0; i < 25; i++) {
      crashReportingService.addBreadcrumb('navigation', `route_${i}`);
    }
    expect(crashReportingService.breadcrumbs).toHaveLength(20);
    expect(crashReportingService.breadcrumbs[19].message).toBe('route_24');
  });

  test('redacts the message before storing it', () => {
    crashReportingService.addBreadcrumb('network', 'failed for a@b.com');
    expect(crashReportingService.breadcrumbs[0].message).toContain('[REDACTED_EMAIL]');
  });
});

describe('reportCrash', () => {
  test('returns a redacted report carrying the breadcrumb trail', async () => {
    crashReportingService.addBreadcrumb('click', 'tapped publish');
    const report = await crashReportingService.reportCrash(new Error('boom for a@b.com'), {
      userId: 'u1',
      email: 'a@b.com',
    });
    expect(report.errorName).toBe('Error');
    expect(report.errorMessage).toContain('[REDACTED_EMAIL]');
    expect(report.context.email).toBe('[REDACTED]');
    expect(report.context.userId).toBe('u1');
    expect(report.breadcrumbs).toHaveLength(1);
  });

  test('buffers the report to localStorage when offline', async () => {
    setOnline(false);
    await crashReportingService.reportCrash(new Error('offline boom'));
    const buffered = JSON.parse(localStorage.getItem('arvdoul_pending_crashes'));
    expect(buffered).toHaveLength(1);
    expect(buffered[0].errorName).toBe('Error');
  });
});

describe('drainOfflineCrashes', () => {
  test('flushes buffered reports and clears the buffer', async () => {
    localStorage.setItem('arvdoul_pending_crashes', JSON.stringify([{ errorName: 'Error', errorMessage: 'x' }]));
    await crashReportingService.drainOfflineCrashes();
    expect(localStorage.getItem('arvdoul_pending_crashes')).toBeNull();
  });
});

describe('Sentry dispatch', () => {
  test('no DSN means no network call (honest no-op, no mock endpoint)', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    await crashReportingService.reportCrash(new Error('boom'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('a DSN rewrites to the store endpoint and posts the exception', async () => {
    const fetchSpy = jest.fn(async () => ({ ok: true }));
    global.fetch = fetchSpy;
    crashReportingService['sentryDsn'] = 'https://key@o1.ingest.sentry.io/123';
    await crashReportingService.reportCrash(new Error('boom'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://o1.ingest.sentry.io/api/123/store/');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.exception.values[0].value).toBe('boom');
  });

  test('a non-http DSN never dispatches (SSRF guard, CWE-918)', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    crashReportingService['sentryDsn'] = 'javascript:alert(1)';
    await crashReportingService.reportCrash(new Error('boom'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('captureException', () => {
  test('aliases reportCrash', async () => {
    const report = await crashReportingService.captureException(new Error('aliased'));
    expect(report.errorMessage).toBe('aliased');
  });
});
