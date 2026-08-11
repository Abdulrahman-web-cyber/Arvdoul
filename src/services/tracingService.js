/**
 * src/services/tracingService.js - ARVDOUL DISTRIBUTED TRACING & SPAN ENGINE
 *
 * Implements:
 * 1. OpenTelemetry Compatible Trace Context Propagation: Generates W3C `traceparent` headers (`00-<trace_id>-<span_id>-01`).
 * 2. Nested Span Timings: Measures execution latency across UI rendering, Firestore queries, and Cloud Functions.
 * 3. Trace Context Correlation: Links frontend clicks to downstream database operations.
 */

class TracingService {
  constructor() {
    this.activeSpans = new Map(); // spanId -> { name, traceId, startTime, parentSpanId, attributes }
  }

  /**
   * Generates a 32-character hexadecimal trace ID.
   */
  _generateTraceId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a 16-character hexadecimal span ID.
   */
  _generateSpanId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
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
   * Ends a span and records duration.
   */
  endSpan(spanId, status = 'OK') {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    const durationMs = performance.now() - span.startTime;
    this.activeSpans.delete(spanId);

    return {
      ...span,
      durationMs: durationMs.toFixed(2),
      status,
      endedAt: Date.now(),
    };
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
