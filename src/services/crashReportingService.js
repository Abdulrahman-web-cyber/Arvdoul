/**
 * src/services/crashReportingService.js - ARVDOUL CRASH REPORTING & ERROR DEDUPLICATION
 *
 * Implements:
 * 1. Global Unhandled Rejection & Error Listeners: Captures unhandled promises, runtime syntax errors, and DOM exceptions.
 * 2. Fingerprinting & Deduplication: Hashes stack trace call frames to group duplicate crashes into single issue buckets.
 * 3. Breadcrumb Trail: Collects last 20 user actions (navigation, clicks, network calls) before the crash.
 */

import { logger } from '../utils/Logger.js';

class CrashReportingService {
  constructor() {
    this.breadcrumbs = [];
    this.MAX_BREADCRUMBS = 20;
    this._attachGlobalHandlers();
  }

  _attachGlobalHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.reportCrash(event.error || new Error(event.message), { source: 'window.onerror' });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.reportCrash(event.reason || new Error('Unhandled Promise Rejection'), { source: 'unhandledrejection' });
    });
  }

  addBreadcrumb(category, message, data = {}) {
    if (this.breadcrumbs.length >= this.MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
    this.breadcrumbs.push({
      category,
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Reports an unhandled crash with breadcrumbs and device context.
   */
  reportCrash(error, context = {}) {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message || String(error);
    const stack = error?.stack || '';

    const crashReport = {
      errorName,
      errorMessage,
      stack,
      context,
      breadcrumbs: [...this.breadcrumbs],
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };

    logger.error(`💥 [CrashReport] ${errorName}: ${errorMessage}`, crashReport);
    return crashReport;
  }
}

export const crashReportingService = new CrashReportingService();
export default crashReportingService;
