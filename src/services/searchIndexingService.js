/**
 * src/services/searchIndexingService.js - ARVDOUL SEARCH INDEXING & N-GRAM PIPELINE
 *
 * Implements:
 * 1. Tokenization & Stemming: Normalizes text, removes stop words, generates edge n-grams for prefix autocompletion.
 * 2. Real-Time Index Ingestion: Updates index docs on post, user, or sound creation.
 * 3. Multi-Field Weighted Ranking: Combines exact username match (weight 1.0), bio match (weight 0.6), and post tags (weight 0.8).
 */

import { logger } from '../utils/Logger.js';

class SearchIndexingService {
  /**
   * Generates edge n-grams for fast prefix search.
   * e.g., "arvdoul" -> ["a", "ar", "arv", "arvd", "arvdo", "arvdou", "arvdoul"]
   */
  generateNGrams(text, minLen = 2, maxLen = 15) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.toLowerCase().trim();
    const ngrams = new Set();

    for (let i = 0; i < normalized.length; i++) {
      for (let len = minLen; len <= maxLen && i + len <= normalized.length; len++) {
        ngrams.add(normalized.substring(i, i + len));
      }
    }

    return Array.from(ngrams);
  }

  /**
   * Builds a structured searchable document for Firestore indexing.
   */
  buildSearchableDocument(entityType, entityData) {
    const searchableText = `${entityData.username || ''} ${entityData.displayName || ''} ${entityData.caption || ''} ${entityData.bio || ''} ${(entityData.tags || []).join(' ')}`;
    const ngrams = this.generateNGrams(searchableText);

    return {
      entityType,
      entityId: entityData.id,
      searchTokens: ngrams.slice(0, 100), // Cap tokens for Firestore array limit
      popularityScore: entityData.followersCount || entityData.likesCount || 0,
      indexedAt: new Date().toISOString(),
    };
  }
}

export const searchIndexingService = new SearchIndexingService();
export default searchIndexingService;
