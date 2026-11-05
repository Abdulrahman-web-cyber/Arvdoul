/**
 * src/__tests__/metricsService.test.js
 * Real assertions for the live client metrics collector used by messagesService,
 * rumService and useScreenView. (This replaced the coverage that the removed
 * observability/phase9 theatre tests used to claim.)
 */

import { metricsService } from '../services/metricsService.js';

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
    metricsService.setGauge('bad_gauge', NaN);
    expect(metricsService.gauges.get('memory_used')).toBe(1024);
    expect(metricsService.gauges.get('bad_gauge')).toBe(0);
  });

  test('records histograms with a bounded sample reservoir', () => {
    for (let i = 0; i < 600; i++) metricsService.recordHistogram('latency', i);
    expect(metricsService.histograms.get('latency').length).toBe(500);
  });

  test('computes percentiles on histogram samples', () => {
    for (let i = 1; i <= 100; i++) metricsService.recordHistogram('latency', i);
    const p = metricsService.getPercentiles('latency');
    // idx = min(floor(p/100 * n), n-1) over the sorted 1..100 samples
    expect(p.p50).toBe(51);
    expect(p.p95).toBe(96);
    expect(p.p99).toBe(100);
    expect(p.count).toBe(100);
  });

  test('returns zeros for unknown histograms', () => {
    expect(metricsService.getPercentiles('nope')).toEqual({ p50: 0, p90: 0, p95: 0, p99: 0, count: 0 });
  });

  test('exports Prometheus text with sanitized names', () => {
    metricsService.incrementCounter('api.requests', 3);
    metricsService.setGauge('pool.size', 7);
    metricsService.recordHistogram('latency', 12);
    const out = metricsService.getPrometheusMetrics();
    expect(out).toContain('arvdoul_apirequests 3');
    expect(out).toContain('arvdoul_poolsize 7');
    expect(out).toContain('quantile="0.95"');
    expect(out).not.toContain('api.requests');
  });
});
