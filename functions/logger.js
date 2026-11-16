// functions/logger.js — the single logging surface for the Functions runtime.
//
// Every module used to call `console.*` directly (or wrap it in a local
// `log()` helper that did `console.log(JSON.stringify({ severity, ... }))`).
// `console.*` in Cloud Functions emits an untyped `textPayload`, so the
// severity lives only inside the JSON string and Cloud Logging cannot filter
// or alert on it. Routing through `functions.logger` emits a structured
// `jsonPayload` with a real `severity` field, and gives one place to swap the
// transport later.
//
// Modules must not call `console.*` directly; `functionsLoggingGuard.test.js`
// fails if any does.

const functions = require('firebase-functions');

const logger = functions.logger;

/** Map a loose severity string to a `functions.logger` method name. */
function methodFor(severity) {
  switch (String(severity || 'info').toLowerCase()) {
    case 'debug':
      return 'debug';
    case 'warn':
    case 'warning':
      return 'warn';
    case 'error':
    case 'critical':
    case 'fatal':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * Log at a given severity. `logger.log(severity, message, data)` is the
 * drop-in replacement for the per-module `log()` helpers.
 */
function log(severity, message, data = {}) {
  logger[methodFor(severity)](message, data);
}

module.exports = { logger, log };
