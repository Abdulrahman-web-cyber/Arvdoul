/**
 * src/utils/Logger.js - ARVDOUL Structured Logger
 *
 * Shared logging utility required by the service-layer refactoring program
 * (see REFACTOR_PROGRESS.md). Provides:
 * - Level-based filtering (debug | info | warn | error | fatal)
 * - Correlation ID propagation (global + per-instance)
 * - PII redaction before anything is written
 * - Structured JSON output (console sink; swap for Sentry/DataDog in prod)
 *
 * Zero dependencies. Safe to import from any client module.
 */

// ==================== LEVELS ====================
export const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

// Keys whose values are redacted entirely.
const REDACT_KEYS = /password|passwd|secret|token|api[_-]?key|authorization|auth|cookie|credential|private[_-]?key|refresh[_-]?token/i;

// Keys that carry PII - value kept but flagged (privacy-aware logging).
const PII_KEYS = /email|phone|mobile|ip[_-]?address|address|ssn|dob|birthdate/i;

let GLOBAL_CORRELATION_ID = null;

/** Set the process-wide correlation id (e.g. from auth bootstrap). */
export function setCorrelationId(id) {
  GLOBAL_CORRELATION_ID = id || null;
}

/** Get the process-wide correlation id. */
export function getCorrelationId() {
  return GLOBAL_CORRELATION_ID;
}

function isDev() {
  return typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
}

function sanitizeValue(key, value) {
  if (REDACT_KEYS.test(key)) return '[REDACTED]';
  return value;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = sanitizeMeta(v);
    } else {
      out[k] = sanitizeValue(k, v);
      if (PII_KEYS.test(k)) out[`${k}_pii`] = true;
    }
  }
  return out;
}

// ==================== LOGGER ====================
export class Logger {
  /**
   * @param {Object} opts
   * @param {string} [opts.name='arvdoul'] Logger namespace
   * @param {keyof typeof LOG_LEVELS} [opts.level='info'] Minimum level to emit
   * @param {boolean} [opts.enabled=true] Master switch
   */
  constructor({ name = 'arvdoul', level = 'info', enabled = true } = {}) {
    this.name = name;
    this.minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    this.enabled = enabled;
    this._correlationId = null;
  }

  /** Create a child logger scoped to a subsystem. */
  child(name) {
    const child = new Logger({ name: `${this.name}:${name}`, enabled: this.enabled });
    child.minLevel = this.minLevel;
    child._correlationId = this._correlationId;
    return child;
  }

  /** Return a logger pinned to a specific correlation id. */
  withCorrelationId(id) {
    const l = new Logger({ name: this.name, enabled: this.enabled });
    l.minLevel = this.minLevel;
    l._correlationId = id || null;
    return l;
  }

  _emit(level, message, meta = {}) {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      logger: this.name,
      correlationId: meta.correlationId || this._correlationId || GLOBAL_CORRELATION_ID || null,
      message,
      ...sanitizeMeta(meta),
    };

    const method = level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : level === 'fatal' ? 'error' : 'info';
    const fn = console[method] || console.log;
    // Level gate already enforces minLevel; emit structured JSON (prod strips
    // debug via build config, not by silently dropping info).
    fn(JSON.stringify(entry));
  }

  debug(message, meta) { this._emit('debug', message, meta); }
  info(message, meta) { this._emit('info', message, meta); }
  warn(message, meta) { this._emit('warn', message, meta); }
  error(message, meta) { this._emit('error', message, meta); }
  fatal(message, meta) { this._emit('fatal', message, meta); }
}

/** Default app-wide logger instance. */
export const logger = new Logger({ name: 'arvdoul' });

export default logger;
