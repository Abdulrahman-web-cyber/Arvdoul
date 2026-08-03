/**
 * src/utils/ErrorHandler.js - ARVDOUL Error Handler
 *
 * Consistent error taxonomy and enhancement across the service layer.
 * Error code ranges (per refactoring program):
 *   1000-1999 validation, 2000-2999 auth, 3000-3999 permission,
 *   4000-4999 not found, 5000-5999 rate limit, 6000-6999 internal.
 *
 * Every surfaced error carries a correlationId so it can be traced.
 * Zero dependencies.
 */

import { getCorrelationId, Logger } from './Logger.js';

export const ERROR_RANGES = {
  VALIDATION: { start: 1000, end: 1999 },
  AUTH: { start: 2000, end: 2999 },
  PERMISSION: { start: 3000, end: 3999 },
  NOT_FOUND: { start: 4000, end: 4999 },
  RATE_LIMIT: { start: 5000, end: 5999 },
  INTERNAL: { start: 6000, end: 6999 },
};

const FIREBASE_CODE_MAP = {
  'permission-denied': 3001,
  'unauthenticated': 2001,
  'not-found': 4001,
  'already-exists': 1001,
  'invalid-argument': 1002,
  'resource-exhausted': 5001,
  'failed-precondition': 1003,
  'deadline-exceeded': 6001,
  'unavailable': 6002,
  'cancelled': 6003,
  'aborted': 1004,
  'data-loss': 6004,
};

const PUBLIC_MESSAGES = {
  1001: 'This record already exists.',
  1002: 'The request contains invalid data.',
  1003: 'The operation could not be completed in the current state.',
  2001: 'Authentication required. Please sign in.',
  3001: 'You do not have permission to perform this action.',
  4001: 'The requested item was not found.',
  5001: 'Too many requests. Please slow down and try again.',
  6001: 'The request timed out. Please try again.',
  6002: 'The service is temporarily unavailable. Please try again later.',
};

class ErrorHandler {
  constructor() {
    this.logger = new Logger({ name: 'errors' });
  }

  /**
   * Wrap an error with taxonomy code, correlationId and a safe public message.
   * @param {Error} error
   * @param {Object} opts
   * @param {string} [opts.defaultMessage='Operation failed']
   * @param {number} [opts.code] explicit code (takes precedence)
   * @returns {Error} the same error object, enhanced
   */
  enhance(error, { defaultMessage = 'Operation failed', code = null } = {}) {
    if (!error) error = new Error(defaultMessage);
    const firebaseCode = error?.code;
    const resolvedCode = code || (firebaseCode && FIREBASE_CODE_MAP[firebaseCode]) || 6000;
    error.code = error.code || String(resolvedCode);
    error.errorCode = resolvedCode;
    error.correlationId = getCorrelationId()
      || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    error.publicMessage = PUBLIC_MESSAGES[resolvedCode] || defaultMessage;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * Wrap an async function: catch, enhance, log, rethrow.
   * @param {Function} fn
   * @param {Object} opts - passed to enhance()
   * @returns {Function} wrapped async function
   */
  wrap(fn, opts = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        const enhanced = this.enhance(err, opts);
        this.logger.error(enhanced.message || opts.defaultMessage || 'Async operation failed', {
          code: enhanced.errorCode,
          correlationId: enhanced.correlationId,
        });
        throw enhanced;
      }
    };
  }

  /** Convert an error into a safe object for UI responses. */
  toPublicError(error) {
    const enhanced = this.enhance(error, {});
    return {
      ok: false,
      error: enhanced.publicMessage,
      code: enhanced.errorCode,
      correlationId: enhanced.correlationId,
    };
  }
}

export { ErrorHandler };
export const errorHandler = new ErrorHandler();
export default errorHandler;
