// src/services/crashReportingService.js

import { logger } from '../utils/Logger.js';

class CrashReportingService {
  constructor() {
    this.breadcrumbs = [];
    this.MAX_BREADCRUMBS = 20;

    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    this['sentryDsn'] = env.VITE_SENTRY_DSN || null;

    this._attachGlobalHandlers();
    this.drainOfflineCrashes();
  }

  _attachGlobalHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.reportCrash(event.error || new Error(event.message), { source: 'window.onerror' });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.reportCrash(event.reason || new Error('Unhandled Promise Rejection'), { source: 'unhandledrejection' });
    });

    window.addEventListener('online', () => {
      this.drainOfflineCrashes();
    });
  }

  /**
   * Buffers crash report to localStorage if offline
   * @private
   */
  _bufferOfflineCrash(payload) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const existing = JSON.parse(localStorage.getItem('arvdoul_pending_crashes') || '[]');
      if (existing.length < 50) {
        existing.push(payload);
        localStorage.setItem('arvdoul_pending_crashes', JSON.stringify(existing));
      }
    } catch {}
  }

  /**
   * Drains buffered offline crash reports when connection is restored
   */
  async drainOfflineCrashes() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = localStorage.getItem('arvdoul_pending_crashes');
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (!Array.isArray(pending) || pending.length === 0) return;

      localStorage.removeItem('arvdoul_pending_crashes');
      logger.info(`[CrashReport] Draining ${pending.length} offline crash reports.`);

      for (const item of pending) {
        await this._dispatchToSentry(item);
      }
    } catch (err) {
      logger.warn('[CrashReport] Failed to drain offline crash reports:', err);
    }
  }

  /**
   * Sentry-compatible alias
   */
  captureException(error, context = {}) {
    return this.reportCrash(error, context);
  }

  /**
   * Sentry-compatible message logging
   */
  captureMessage(message, level = 'info') {
    this.addBreadcrumb('manual', message, { level });
    logger.info(`[SentryCapture] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Sanitizes objects and strings to remove PII (CWE-209).
   * @private
   */
  _redactPII(input) {
    if (!input) return input;
    if (typeof input === 'string') {
      return input
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
        .replace(/\+?[0-9]{1,4}[-.\s]?[0-9]{1,10}/g, '[REDACTED_PHONE]')
        .replace(/AIzaSy[a-zA-Z0-9-_]{33}/g, '[REDACTED_API_KEY]');
    }
    if (typeof input === 'object') {
      const copy = {};
      Object.entries(input).forEach(([key, val]) => {
        const safeKey = key.toLowerCase();
        if (safeKey.includes('email') || safeKey.includes('phone') || safeKey.includes('password') || safeKey.includes('key')) {
          copy[key] = '[REDACTED]';
        } else {
          copy[key] = this._redactPII(val);
        }
      });
      return copy;
    }
    return input;
  }

  addBreadcrumb(category, message, data = {}) {
    if (this.breadcrumbs.length >= this.MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
    this.breadcrumbs.push({
      category,
      message: this._redactPII(message),
      data: this._redactPII(data),
      timestamp: Date.now(),
    });
  }

  /**
   * Safe URL protocol validation for security audit constraints (CWE-918).
   * @private
   */
  _isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
  }

  /**
   * Reports an unhandled crash with breadcrumbs and device context.
   */
  async reportCrash(error, context = {}) {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message || String(error);
    const stack = error?.stack || '';

    const crashReport = {
      errorName,
      errorMessage: this._redactPII(errorMessage),
      stack,
      context: this._redactPII(context),
      breadcrumbs: [...this.breadcrumbs],
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };

    logger.error('💥 [CrashReport] ' + errorName + ': ' + errorMessage, crashReport);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._bufferOfflineCrash(crashReport);
    } else {
      await this._dispatchToSentry(crashReport);
    }

    return crashReport;
  }

  async _dispatchToSentry(crashReport) {
    const dsnVal = this['sentryDsn'];
    if (!dsnVal) return;

    try {
      const sentryUrl = dsnVal.replace(/@([^/]+)\/(\d+)/, (match, host, id) => {
        return 'https://' + host + '/api/' + id + '/store/';
      });

      if (this._isValidUrl(sentryUrl)) {
        await fetch(sentryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exception: {
              values: [{
                type: crashReport.errorName,
                value: crashReport.errorMessage,
                stacktrace: { frames: this._parseStack(crashReport.stack) }
              }]
            },
            extra: { context: crashReport.context, breadcrumbs: crashReport.breadcrumbs },
            timestamp: Date.now() / 1000
          })
        });
        logger.info('[CrashReport] Sentry ingestion call completed.');
      }
    } catch (err) {
      logger.error('[CrashReport] Sentry endpoint dispatch failed:', { error: err.message });
      this._bufferOfflineCrash(crashReport);
    }
  }

  _parseStack(stack) {
    if (!stack) return [];
    return stack.split('\n').map((line) => {
      return { function: line.trim() };
    });
  }
}

export const crashReportingService = new CrashReportingService();
export default crashReportingService;
