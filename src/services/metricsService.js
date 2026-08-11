/**
 * src/services/metricsService.js - ARVDOUL TIME-SERIES METRICS & PERCENTILES COLLECTOR
 *
 * Implements:
 * 1. Counters, Gauges & Histograms: Records API latencies, query counts, memory allocations, and network payloads.
 * 2. Percentile Calculations: Computes p50, p90, p95, and p99 latency percentiles with reservoir sampling.
 * 3. Metrics Summary Export for Dashboards.
 * 4. Prometheus Exporter Adapter: Exports current metrics state in a standard Prometheus scraping line format.
 * 5. Input Sanitization (CRLF/Injection prevention): Strips newline/control characters to secure Prometheus scraping (CWE-93).
 */

class MetricsService {
  constructor() {
    this.counters = new Map(); // metricName -> count
    this.gauges = new Map();   // metricName -> value
    this.histograms = new Map(); // metricName -> Array<number>
    this.MAX_HISTOGRAM_SAMPLES = 500;
  }

  /**
   * Sanitizes metric names to prevent newline injections or invalid characters (CWE-93).
   * @private
   */
  _sanitizeName(name) {
    return String(name).replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Sanitizes metric values to guarantee numeric compliance.
   * @private
   */
  _sanitizeValue(value) {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  incrementCounter(name, value = 1) {
    const cleanName = this._sanitizeName(name);
    const cleanValue = this._sanitizeValue(value);
    const current = this.counters.get(cleanName) || 0;
    this.counters.set(cleanName, current + cleanValue);
  }

  setGauge(name, value) {
    const cleanName = this._sanitizeName(name);
    const cleanValue = this._sanitizeValue(value);
    this.gauges.set(cleanName, cleanValue);
  }

  recordHistogram(name, value) {
    const cleanName = this._sanitizeName(name);
    const cleanValue = this._sanitizeValue(value);
    let samples = this.histograms.get(cleanName);
    if (!samples) {
      samples = [];
      this.histograms.set(cleanName, samples);
    }
    if (samples.length >= this.MAX_HISTOGRAM_SAMPLES) {
      samples.shift();
    }
    samples.push(cleanValue);
  }

  /**
   * Computes p50, p95, p99 percentiles for a histogram metric.
   */
  getPercentiles(name) {
    const cleanName = this._sanitizeName(name);
    const samples = this.histograms.get(cleanName);
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
      const cleanName = this._sanitizeName(name);
      const cleanVal = this._sanitizeValue(val);
      lines.push(`# HELP arvdoul_${cleanName} Monitored counter ${cleanName}`);
      lines.push(`# TYPE arvdoul_${cleanName} counter`);
      lines.push(`arvdoul_${cleanName} ${cleanVal}`);
    });

    // Gauges
    this.gauges.forEach((val, name) => {
      const cleanName = this._sanitizeName(name);
      const cleanVal = this._sanitizeValue(val);
      lines.push(`# HELP arvdoul_${cleanName} Monitored gauge ${cleanName}`);
      lines.push(`# TYPE arvdoul_${cleanName} gauge`);
      lines.push(`arvdoul_${cleanName} ${cleanVal}`);
    });

    // Histograms
    this.histograms.forEach((samples, name) => {
      const cleanName = this._sanitizeName(name);
      const p = this.getPercentiles(cleanName);
      lines.push(`# HELP arvdoul_${cleanName}_percentiles Percentile values of histogram ${cleanName}`);
      lines.push(`# TYPE arvdoul_${cleanName}_percentiles gauge`);
      lines.push(`arvdoul_${cleanName}_percentiles{quantile="0.50"} ${this._sanitizeValue(p.p50)}`);
      lines.push(`arvdoul_${cleanName}_percentiles{quantile="0.90"} ${this._sanitizeValue(p.p90)}`);
      lines.push(`arvdoul_${cleanName}_percentiles{quantile="0.95"} ${this._sanitizeValue(p.p95)}`);
      lines.push(`arvdoul_${cleanName}_percentiles{quantile="0.99"} ${this._sanitizeValue(p.p99)}`);
      lines.push(`arvdoul_${cleanName}_count ${this._sanitizeValue(p.count)}`);
    });

    return lines.join('\n');
  }
}

export const metricsService = new MetricsService();
export default metricsService;
