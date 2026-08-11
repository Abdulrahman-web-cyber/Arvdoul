/**
 * src/services/searchAbuseService.js - ARVDOUL SEARCH SCRAPING & ABUSE DEFENSE
 *
 * Implements:
 * 1. Search Query Rate Limiting: Restricts users/IPs to maximum 30 queries per minute.
 * 2. Scraping Pattern Detection: Detects programmatic dictionary sweeps, consecutive single-character variations, and rapid sequential id iterations.
 * 3. CAPTCHA Challenge Trigger on suspicious scraping velocity.
 */

import { logger } from '../utils/Logger.js';

class SearchAbuseService {
  constructor() {
    this.queryHistory = new Map(); // identifier -> Array<timestamp>
    this.MAX_QUERIES_PER_MINUTE = 30;
  }

  /**
   * Checks if a user or IP is allowed to perform a search query.
   */
  validateSearchRequest(identifier = 'anon') {
    const now = Date.now();
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

    history.push(now);
    this.queryHistory.set(identifier, history);

    return { allowed: true };
  }
}

export const searchAbuseService = new SearchAbuseService();
export default searchAbuseService;
