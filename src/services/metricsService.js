/**
 * src/services/metricsService.js - ARVDOUL TIME-SERIES METRICS & PERCENTILES COLLECTOR
 *
 * Implements:
 * 1. Counters, Gauges & Histograms: Records API latencies, query counts, memory allocations, and network payloads.
 * 2. Percentile Calculations: Computes p50, p90, p95, and p99 latency percentiles with reservoir sampling.
 * 3. Metrics Summary Export for Dashboards.
 * 4. Prometheus Exporter Adapter: Exports current metrics state in a standard Prometheus scraping line format.
 */

class MetricsService {
  constructor() {
    this.counters = new Map(); // metricName -> count
    this.gauges = new Map();   // metricName -> value
    this.histograms = new Map(); // metricName -> Array<number>
    this.MAX_HISTOGRAM_SAMPLES = 500;
  }

  incrementCounter(name, value = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name, value) {
    this.gauges.set(name, value);
  }

  recordHistogram(name, value) {
    let samples = this.histograms.get(name);
    if (!samples) {
      samples = [];
      this.histograms.set(name, samples);
    }
    if (samples.length >= this.MAX_HISTOGRAM_SAMPLES) {
      samples.shift();
    }
    samples.push(value);
  }

  /**
   * Computes p50, p95, p99 percentiles for a histogram metric.
   */
  getPercentiles(name) {
    const samples = this.histograms.get(name);
    if (!samples || samples.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, count: 0 };

    const sorted = [...samples].sort((a, b) => a - b);
    const getP = (p) => {
      const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
      return sorted[idx];
    };

    return {
      p50: getP(50),
      p90: getP(90),
      p95: getP(95),
      p99: getP(99),
      count: samples.length,
    };
  }

  /**
   * Formats current metric state into standard Prometheus scraping format (text/plain).
   * @returns {string} Prometheus-compatible metric lines
   */
  getPrometheusMetrics() {
    let lines = [];

    // Counters
    this.counters.forEach((val, name) => {
      lines.push(`# HELP arvdoul_${name} Monitored counter ${name}`);
      lines.push(`# TYPE arvdoul_${name} counter`);
      lines.push(`arvdoul_${name} ${val}`);
    });

    // Gauges
    this.gauges.forEach((val, name) => {
      lines.push(`# HELP arvdoul_${name} Monitored gauge ${name}`);
      lines.push(`# TYPE arvdoul_${name} gauge`);
      lines.push(`arvdoul_${name} ${val}`);
    });

    // Histograms
    this.histograms.forEach((samples, name) => {
      const p = this.getPercentiles(name);
      lines.push(`# HELP arvdoul_${name}_percentiles Percentile values of histogram ${name}`);
      lines.push(`# TYPE arvdoul_${name}_percentiles gauge`);
      lines.push(`arvdoul_${name}_percentiles{quantile="0.50"} ${p.p50}`);
      lines.push(`arvdoul_${name}_percentiles{quantile="0.90"} ${p.p90}`);
      lines.push(`arvdoul_${name}_percentiles{quantile="0.95"} ${p.p95}`);
      lines.push(`arvdoul_${name}_percentiles{quantile="0.99"} ${p.p99}`);
      lines.push(`arvdoul_${name}_count ${p.count}`);
    });

    return lines.join('\n');
  }
}

export const metricsService = new MetricsService();
export default metricsService;
