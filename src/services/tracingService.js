/**
 * src/services/tracingService.js - ARVDOUL DISTRIBUTED TRACING & SPAN ENGINE
 *
 * Implements:
 * 1. OpenTelemetry Compatible Trace Context Propagation: Generates W3C `traceparent` headers (`00-<trace_id>-<span_id>-01`).
 * 2. Nested Span Timings: Measures execution latency across UI rendering, Firestore queries, and Cloud Functions.
 * 3. Trace Context Correlation: Links frontend clicks to downstream database operations.
 * 4. Jaeger/OpenTelemetry Export Adapter: Sends collected trace spans to real or mock Jaeger endpoint.
 */

import { logger } from '../utils/Logger.js';

class TracingService {
  constructor() {
    this.activeSpans = new Map(); // spanId -> { name, traceId, startTime, parentSpanId, attributes }

    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    this.jaegerEndpoint = env.VITE_JAEGER_ENDPOINT || null;
  }

  /**
   * Generates a 32-character hexadecimal trace ID.
   */
  _generateTraceId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a 16-character hexadecimal span ID.
   */
  _generateSpanId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  /**
   * Starts a new distributed trace span.
   */
  startSpan(name, parentSpanId = null, traceId = null) {
    const spanId = this._generateSpanId();
    const activeTraceId = traceId || this._generateTraceId();

    const span = {
      spanId,
      traceId: activeTraceId,
      name,
      parentSpanId,
      startTime: performance.now(),
      attributes: {},
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  /**
   * Ends a span, records duration, and dispatches to exporter.
   */
  async endSpan(spanId, status = 'OK') {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    const durationMs = performance.now() - span.startTime;
    this.activeSpans.delete(spanId);

    const endedSpan = {
      ...span,
      durationMs: durationMs.toFixed(2),
      status,
      endedAt: Date.now(),
    };

    // If Jaeger endpoint is configured, perform a direct payload dispatch
    if (this.jaegerEndpoint) {
      try {
        await fetch(this.jaegerEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            traceId: endedSpan.traceId,
            spanId: endedSpan.spanId,
            parentSpanId: endedSpan.parentSpanId,
            operationName: endedSpan.name,
            startTime: Math.round(endedSpan.startTime * 1000), // microsecs
            duration: Math.round(durationMs * 1000),
            tags: [
              { key: 'status', type: 'string', value: endedSpan.status },
              { key: 'endedAt', type: 'int64', value: endedSpan.endedAt }
            ]
          })
        });
      } catch (err) {
        logger.debug('[TracingService] Failed to export span to Jaeger:', { error: err.message });
      }
    }

    return endedSpan;
  }

  /**
   * Generates W3C traceparent header for outgoing fetch requests.
   */
  getTraceparentHeader(span) {
    if (!span) return '';
    return `00-${span.traceId}-${span.spanId}-01`;
  }
}

export const tracingService = new TracingService();
export default tracingService;
