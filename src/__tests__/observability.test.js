/**
 * src/__tests__/observability.test.js
 * Real assertions for the observability layer: metrics collection with
 * Prometheus export, spans/tracing, SLO/error-budget math, cost accounting,
 * RUM vitals evaluation and route timing.
 */

import { jest } from '@jest/globals';
import { metricsService } from '../services/metricsService.js';
import { observabilityService } from '../services/observabilityService.js';
import { rumService } from '../services/rumService.js';
import { tracingService } from '../services/tracingService.js';

describe('metricsService', () => {
  beforeEach(() => {
    metricsService.counters.clear();
    metricsService.gauges.clear();
    metricsService.histograms.clear();
  });

  test('increments counters and sanitizes names', () => {
    metricsService.incrementCounter('api.requests', 3);
    metricsService.incrementCounter('api.requests', 2);
    expect(metricsService.counters.get('apirequests')).toBe(5);
  });

  test('sets gauges and coerces NaN to zero', () => {
    metricsService.setGauge('memory_used', 1024);
    expect(metricsService.gauges.get('memory_used')).toBe(1024);
    metricsService.setGauge('bad_gauge', NaN);
    expect(metricsService.gauges.get('bad_gauge')).toBe(0);
  });

  test('records histograms with a bounded sample reservoir', () => {
    for (let i = 0; i < 600; i++) metricsService.recordHistogram('latency', i);
    const samples = metricsService.histograms.get('latency');
    expect(samples.length).toBeLessThanOrEqual(metricsService.MAX_HISTOGRAM_SAMPLES);
  });

  test('computes percentiles on histogram samples', () => {
    for (let i = 1; i <= 100; i++) metricsService.recordHistogram('latency', i);
    const p = metricsService.getPercentiles('latency');
    expect(p.count).toBe(100);
    expect(p.p50).toBeGreaterThanOrEqual(50);
    expect(p.p95).toBeGreaterThanOrEqual(95);
    expect(p.p99).toBe(100);
  });

  test('returns zeros for unknown histograms', () => {
    const p = metricsService.getPercentiles('nope');
    expect(p).toEqual({ p50: 0, p90: 0, p95: 0, p99: 0, count: 0 });
  });

  test('exports Prometheus text format with sanitized names', () => {
    metricsService.incrementCounter('http.requests', 10);
    metricsService.setGauge('active_users', 42);
    metricsService.recordHistogram('api.latency', 120);
    const text = metricsService.getPrometheusMetrics();

    expect(text).toContain('# TYPE arvdoul_httprequests counter');
    expect(text).toContain('arvdoul_httprequests 10');
    expect(text).toContain('# TYPE arvdoul_active_users gauge');
    expect(text).toContain('arvdoul_active_users 42');
    expect(text).toContain('quantile="0.99"');
    // No metric NAME may contain dots or control characters (CWE-93):
    // the token before `{`/space is the sanitized name.
    for (const line of text.split('\n')) {
      if (!line.startsWith('arvdoul_')) continue;
      const nameToken = line.replace(/\{.*/, '').split(' ')[0];
      expect(nameToken).toMatch(/^arvdoul_[a-zA-Z0-9_]+$/);
    }
  });
});

describe('observabilityService', () => {
  beforeEach(() => {
    observabilityService.metricsRegistry.clear();
    observabilityService.activeSpans.clear();
    observabilityService.accumulatedDailyCost = 0;
  });

  test('records counters and gauges by dimension', () => {
    observabilityService.recordMetric('error_count', 1, { api: 'auth' });
    observabilityService.recordMetric('error_count', 1, { api: 'auth' });
    observabilityService.recordMetric('api_latency_ms', 50, { api: 'feed' });
    const errors = observabilityService.metricsRegistry.get('error_count');
    expect(errors.get(JSON.stringify({ api: 'auth' }))).toBe(2);
  });

  test('startSpan/endSpan records duration and latency metric', () => {
    const traceId = `trace_${Date.now()}`;
    const spanId = observabilityService.startSpan(traceId, 'get_feed');
    observabilityService.endSpan(traceId, spanId);
    const spans = observabilityService.activeSpans.get(traceId);
    expect(spans[0].status).toBe('SUCCESS');
    expect(spans[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(observabilityService.metricsRegistry.has('api_latency_ms')).toBe(true);
  });

  test('endSpan marks errors and records error metric', () => {
    const traceId = 'trace_err';
    const spanId = observabilityService.startSpan(traceId, 'get_user');
    observabilityService.endSpan(traceId, spanId, new Error('boom'));
    const spans = observabilityService.activeSpans.get(traceId);
    expect(spans[0].status).toBe('ERROR');
    expect(spans[0].errorDetails).toBe('boom');
    expect(observabilityService.metricsRegistry.has('error_count')).toBe(true);
  });

  test('endSpan tolerates unknown spans', () => {
    expect(() => observabilityService.endSpan('nope', 'nope')).not.toThrow();
  });

  test('auditFirestoreCost accumulates and meters reads/writes', () => {
    observabilityService.auditFirestoreCost('read', 100000);
    observabilityService.auditFirestoreCost('write', 100000);
    expect(observabilityService.accumulatedDailyCost).toBeCloseTo(0.06 + 0.18, 6);
    expect(observabilityService.metricsRegistry.has('gcp_daily_accumulated_cost_dollars')).toBe(true);
  });

  test('getErrorBudgetStatus reports healthy with no errors', () => {
    const status = observabilityService.getErrorBudgetStatus();
    expect(status.status).toBe('HEALTHY');
    expect(status.slaTarget).toBe('99.90%');
  });

  test('getErrorBudgetStatus reports breached with 100% errors', () => {
    for (let i = 0; i < 10; i++) observabilityService.recordMetric('error_count', 1, { api: 'x' });
    observabilityService.recordMetric('api_latency_ms', 10, { api: 'x' });
    const status = observabilityService.getErrorBudgetStatus();
    expect(status.status).toBe('BREACHED_ALARM');
  });
});

describe('rumService', () => {
  beforeEach(() => {
    rumService.metrics = { lcp: null, cls: 0, inp: null, ttfb: null, longTasks: 0 };
    rumService.routeTimings.clear();
    rumService._attached = false;
  });

  test('evaluates vitals against good/poor thresholds', () => {
    rumService.metrics.lcp = 1200; // good
    rumService.metrics.cls = 0.05; // good
    rumService.metrics.inp = 350; // needs improvement
    rumService.metrics.ttfb = 5000; // poor
    const ev = rumService.evaluateVitals();
    expect(ev.lcp).toBe('good');
    expect(ev.cls).toBe('good');
    expect(ev.inp).toBe('needs_improvement');
    expect(ev.ttfb).toBe('poor');
  });

  test('reports missing vitals as missing', () => {
    const ev = rumService.evaluateVitals();
    expect(ev.lcp).toBe('missing');
  });

  test('tracks route timings with start/end pairing', () => {
    const spy = jest.spyOn(performance, 'now')
      .mockReturnValueOnce(1000) // startRouteTiming
      .mockReturnValueOnce(1450); // endRouteTiming
    rumService.startRouteTiming('home');
    const ms = rumService.endRouteTiming('home');
    expect(ms).toBe(450);
    const stat = rumService.getRouteTiming('home');
    expect(stat.count).toBe(1);
    expect(stat.totalMs).toBe(450);
    expect(stat.lastMs).toBe(450);
    spy.mockRestore();
  });

  test('endRouteTiming without matching start returns null', () => {
    rumService.startRouteTiming('home');
    expect(rumService.endRouteTiming('profile')).toBeNull();
  });

  test('attachToMetrics forwards vitals to metricsService', async () => {
    rumService.metrics.lcp = 900;
    rumService.metrics.cls = 0.03;
    rumService.attachToMetrics();
    // Give the lazy import a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(metricsService.gauges.get('rum_lcp')).toBe(900);
    expect(metricsService.gauges.get('rum_cls')).toBe(0.03);
    // Idempotent
    rumService.attachToMetrics();
  });
});

describe('tracingService', () => {
  test('exports a service with span primitives', () => {
    expect(typeof tracingService.startSpan).toBe('function');
    expect(typeof tracingService.endSpan).toBe('function');
    expect(typeof tracingService.getTraceparentHeader).toBe('function');
  });

  test('starts and completes a trace span', async () => {
    const span = tracingService.startSpan('test_op');
    expect(span).toHaveProperty('spanId');
    expect(span).toHaveProperty('traceId');
    expect(span).toHaveProperty('name', 'test_op');

    const ended = await tracingService.endSpan(span.spanId, 'OK');
    expect(ended).toHaveProperty('durationMs');
    expect(ended.status).toBe('OK');
    // Ended spans are removed from the active set
    expect(tracingService.activeSpans.has(span.spanId)).toBe(false);
  });

  test('endSpan returns null for unknown spans', async () => {
    expect(await tracingService.endSpan('missing-span')).toBeNull();
  });

  test('builds a W3C traceparent header', () => {
    const span = tracingService.startSpan('op');
    const header = tracingService.getTraceparentHeader(span);
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(tracingService.getTraceparentHeader(null)).toBe('');
  });
});
