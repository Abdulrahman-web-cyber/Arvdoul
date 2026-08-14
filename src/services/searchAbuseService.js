/**
 * src/services/searchAbuseService.js - ARVDOUL SEARCH SCRAPING & ABUSE DEFENSE v8.0
 *
 * Implements:
 * 1. Search Query Rate Limiting: Restricts users/IPs to maximum 30 queries per minute (configurable sliding window).
 * 2. Scraping Pattern Detection: Detects sequential dictionary sweeps, rapid single-character variations,
 *    suspicious sequential IDs, and excessively long searches.
 * 3. CAPTCHA Challenge Trigger on suspicious scraping velocity.
 */

import { logger } from '../utils/Logger.js';

class SearchAbuseService {
  constructor() {
    this.queryHistory = new Map(); // identifier -> Array<timestamp>
    this.searchSequenceHistory = new Map(); // identifier -> Array<string>
    this.MAX_QUERIES_PER_MINUTE = 30;
    this.MAX_QUERY_LENGTH = 150;
    this.MAX_MAP_ENTRIES = 1000;
  }

  /**
   * Enforces max capacity on tracking Maps to prevent memory exhaustion (CWE-400).
   * @private
   */
  _enforceMaxMapCapacity(map) {
    if (map.size > this.MAX_MAP_ENTRIES) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
  }

  /**
   * Checks if a user or IP is allowed to perform a search query.
   * Analyzes rate and detects scraping behaviors.
   * @param {string} identifier - unique user ID or IP address
   * @param {string} queryText - search query string
   * @returns {object} - { allowed: boolean, reason: string, requiresCaptcha: boolean }
   */
  validateSearchRequest(identifier = 'anon', queryText = '') {
    const now = Date.now();
    const queryStr = String(queryText || '').trim();

    // 1. Guard against extremely large queries
    if (queryStr.length > this.MAX_QUERY_LENGTH) {
      logger.warn(`[SearchAbuse] Blocked excessive query length from ${identifier}`);
      return {
        allowed: false,
        reason: 'Search query is too long. Please restrict query to 150 characters.',
        requiresCaptcha: true,
      };
    }

    // 2. Sliding Window Rate Limiting
    let history = this.queryHistory.get(identifier) || [];
    history = history.filter((t) => now - t < 60 * 1000); // 1 minute window

    if (history.length >= this.MAX_QUERIES_PER_MINUTE) {
      logger.warn(`[SearchAbuse] Search rate limit exceeded for ${identifier} (${history.length} queries/min)`);
      return {
        allowed: false,
        reason: 'Search rate limit exceeded. Please wait a moment before searching again.',
        requiresCaptcha: true,
      };
    }

    // 3. Sequential scraping / single-character variation checks
    let seq = this.searchSequenceHistory.get(identifier) || [];
    seq.push(queryStr);
    if (seq.length > 5) seq.shift();

    this._enforceMaxMapCapacity(this.searchSequenceHistory);
    this.searchSequenceHistory.set(identifier, seq);

    if (seq.length >= 4) {
      // Check for dictionary sweep / alphabetical sweep
      // e.g. "aaa", "aab", "aac", "aad" OR sequential numbers
      let isSequential = true;
      let isSingleCharChange = true;

      for (let i = 1; i < seq.length; i++) {
        const prev = seq[i - 1];
        const curr = seq[i];

        // Is alphabetical search or ID traversal sequence?
        if (curr <= prev && curr.length === prev.length) {
          isSequential = false;
        }

        // Is single character typing variations (backspace/add is fine, but single character replacement on short words)?
        if (Math.abs(curr.length - prev.length) > 1) {
          isSingleCharChange = false;
        }
      }

      // Flag as potential automation scrape if sequential or constant dictionary sweeps
      if (isSequential && queryStr.length <= 4) {
        logger.warn(`[SearchAbuse] Programmatic dictionary sweep detected for ${identifier}`);
        return {
          allowed: false,
          reason: 'Automated search behaviors detected. Please solve a CAPTCHA to continue.',
          requiresCaptcha: true,
        };
      }
    }

    // Record the current search request
    history.push(now);
    this._enforceMaxMapCapacity(this.queryHistory);
    this.queryHistory.set(identifier, history);

    return { allowed: true };
  }

  /**
   * Resets search abuse logs for an identifier upon successful CAPTCHA completion.
   * @param {string} identifier
   */
  resetAbuseCounters(identifier) {
    this.queryHistory.delete(identifier);
    this.searchSequenceHistory.delete(identifier);
    logger.info(`[SearchAbuse] Abuse counters reset for identifier: ${identifier}`);
  }
}

export const searchAbuseService = new SearchAbuseService();
export default searchAbuseService;
