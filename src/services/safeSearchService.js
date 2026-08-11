/**
 * src/services/safeSearchService.js - ARVDOUL SAFE SEARCH FILTERING
 *
 * Implements:
 * 1. Multi-Tier SafeSearch Levels: Strict, Moderate, Off (for age-verified adult mode).
 * 2. Query Redaction & Obfuscation: Strips adult, violent, and hate terms from query tokens before database lookup.
 * 3. Media Filtering: Filters out media flagged with sensitive / racy content tags when SafeSearch is active.
 */

import { textModerationService } from './textModerationService.js';

class SafeSearchService {
  constructor() {
    this.safeSearchSetting = 'moderate'; // 'strict' | 'moderate' | 'off'
  }

  setMode(mode) {
    if (['strict', 'moderate', 'off'].includes(mode)) {
      this.safeSearchSetting = mode;
    }
  }

  /**
   * Cleanses a search query string based on active safe search mode.
   */
  sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    if (this.safeSearchSetting === 'off') return query.trim();

    const textResult = textModerationService.evaluateText(query);
    if (!textResult.isClean) {
      return textResult.sanitized;
    }

    return query.trim();
  }

  /**
   * Filters search result items based on safe search rules.
   */
  filterResults(items = []) {
    if (this.safeSearchSetting === 'off') return items;

    return items.filter((item) => {
      if (this.safeSearchSetting === 'strict') {
        return !item.isSensitive && !item.isNsfw && !item.isViolence;
      }
      // Moderate: filter explicit NSFW only
      return !item.isNsfw;
    });
  }
}

export const safeSearchService = new SafeSearchService();
export default safeSearchService;
