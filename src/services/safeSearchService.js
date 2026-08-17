/**
 * src/services/safeSearchService.js - ARVDOUL SAFE SEARCH FILTERING v8.0
 *
 * Implements:
 * 1. Multi-Tier SafeSearch Levels: Strict, Moderate, Off (for age-verified adult mode).
 * 2. Query Redaction & Obfuscation: Strips adult, violent, and hate terms from query tokens before database lookup.
 * 3. Media Filtering: Filters out media flagged with sensitive / racy content tags when SafeSearch is active.
 * 4. Multi-tab synchronization and LocalStorage persistence.
 */

import { textModerationService } from './textModerationService.js';
import { logger } from '../utils/Logger.js';

class SafeSearchService {
  constructor() {
    this.safeSearchSetting = 'moderate'; // 'strict' | 'moderate' | 'off'
    this.storageKey = 'arvdoul_safesearch_setting';
    this.initSetting();
  }

  /**
   * Initializes the safe search setting from localStorage or defaults to moderate.
   */
  initSetting() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(this.storageKey);
        if (saved && ['strict', 'moderate', 'off'].includes(saved)) {
          this.safeSearchSetting = saved;
        }
      } catch (err) {
        logger.error('[SafeSearch] Failed to load setting from localStorage:', err);
      }
    }
  }

  /**
   * Updates the safe search mode and persists it to storage.
   * @param {string} mode - 'strict' | 'moderate' | 'off'
   */
  setMode(mode) {
    if (['strict', 'moderate', 'off'].includes(mode)) {
      this.safeSearchSetting = mode;
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(this.storageKey, mode);
          // Dispatch a custom event to sync with other components
          window.dispatchEvent(new CustomEvent('arvdoul_safesearch_changed', { detail: { mode } }));
        } catch (err) {
          logger.error('[SafeSearch] Failed to save setting to localStorage:', err);
        }
      }
    }
  }

  /**
   * Retrieves the current safe search mode.
   * @returns {string} - 'strict' | 'moderate' | 'off'
   */
  getMode() {
    return this.safeSearchSetting;
  }

  /**
   * Cleanses a search query string based on active safe search mode.
   * Strips out any banned/violating terms and redacts them.
   * @param {string} query
   * @returns {string}
   */
  sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    if (this.safeSearchSetting === 'off') return query.trim();

    const trimmed = query.trim();
    const moderationResult = textModerationService.evaluateText(trimmed);

    if (moderationResult.isClean) {
      return trimmed;
    }

    // Attempt token redaction: Split query into tokens and redact toxic tokens
    const words = trimmed.split(/\s+/);
    const sanitizedWords = words.map(word => {
      const evaluation = textModerationService.evaluateText(word);
      if (!evaluation.isClean) {
        return '[redacted]';
      }
      return word;
    });

    const sanitizedResult = sanitizedWords.join(' ');
    logger.warn('[SafeSearch] Query redacted:', { original: trimmed, redacted: sanitizedResult });
    return sanitizedResult;
  }

  /**
   * Filters search result items based on safe search rules.
   * @param {Array<object>} items
   * @returns {Array<object>}
   */
  filterResults(items = []) {
    if (!Array.isArray(items)) return [];
    if (this.safeSearchSetting === 'off') return items;

    return items.filter((item) => {
      if (!item) return false;

      // Strict Mode: Filter out any items with even mild sensitive flags, NSFW, or violence markers
      if (this.safeSearchSetting === 'strict') {
        const hasViolentContent = !!(item.isViolence || item.isViolent || item.hasViolence);
        const hasSensitiveContent = !!(item.isSensitive || item.sensitive || item.hasSensitiveContent);
        const hasNsfwContent = !!(item.isNsfw || item.nsfw || item.hasNsfwContent);
        const hasRacyContent = !!(item.isRacy || item.racy || item.hasRacyContent);

        return !hasViolentContent && !hasSensitiveContent && !hasNsfwContent && !hasRacyContent;
      }

      // Moderate Mode (Default): Filter out explicit NSFW items only
      const hasNsfwContent = !!(item.isNsfw || item.nsfw || item.hasNsfwContent);
      return !hasNsfwContent;
    });
  }
}

export const safeSearchService = new SafeSearchService();
export default safeSearchService;
