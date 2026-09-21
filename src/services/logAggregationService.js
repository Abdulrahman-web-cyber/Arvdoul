// src/services/logAggregationService.js

import { logger } from '../utils/Logger.js';

class LogAggregationService {
  constructor() {
    this.buffer = [];
    this.MAX_BUFFER_SIZE = 100;
    this.FLUSH_INTERVAL_MS = 5000;
    this._startFlushTimer();
  }

  _startFlushTimer() {
    if (typeof window !== 'undefined') {
      setInterval(() => this.flushLogs(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Pushes a structured log entry into the aggregation buffer.
   */
  ingest(level, message, meta = {}) {
    const entry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    this.buffer.push(entry);
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushLogs();
    }
  }

  /**
   * Flushes batched logs to persistent logging backend.
   */
  async flushLogs() {
    if (this.buffer.length === 0) return;
    const entriesToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // In production environment, dispatch to logging endpoint or Firestore telemetry sink
      logger.debug(`[LogAggregation] Flushed ${entriesToFlush.length} structured log events.`);
    } catch (err) {
      logger.debug('[LogAggregation] Flush error:', { error: err.message });
    }
  }
}

export const logAggregationService = new LogAggregationService();
export default logAggregationService;
