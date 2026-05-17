// src/services/searchService.js
// =================================================================================
// 🔍 ARVDOUL ULTIMATE SEARCH ENGINE – PRODUCTION READY
// 🌟 Surpasses Facebook, Instagram, and Messenger in search capabilities
// 🚀 Algolia-powered • Personalization • Analytics • Sponsored results
// 🌍 Geolocation • Synonyms • Typo tolerance • Real‑time sync via Cloud Functions
// =================================================================================

import algoliasearch from 'algoliasearch';
import { createInsightsClient } from 'search-insights';
import { getMonetizationService } from './monetizationService.js';

// ========================= CONFIGURATION =========================
const SEARCH_CONFIG = {
  // Algolia credentials (must be set in .env)
  ALGOLIA_APP_ID: process.env.REACT_APP_ALGOLIA_APP_ID,
  ALGOLIA_SEARCH_KEY: process.env.REACT_APP_ALGOLIA_SEARCH_KEY,

  // Base index names (these must exist in Algolia)
  BASE_INDICES: {
    USERS: 'users',
    POSTS: 'posts',
    VIDEOS: 'videos',
    STORIES: 'stories',
    REELS: 'reels',
  },

  // Replica indices for sorting (configured in Algolia dashboard)
  SORT_REPLICAS: {
    users: {
      relevance: 'users',
      newest: 'users_date_desc',
      followers_desc: 'users_followers_desc',
    },
    posts: {
      relevance: 'posts',
      newest: 'posts_date_desc',
      popular: 'posts_likes_desc',
    },
    videos: {
      relevance: 'videos',
      newest: 'videos_date_desc',
      most_viewed: 'videos_views_desc',
    },
    stories: {
      relevance: 'stories',
      newest: 'stories_date_desc',
      most_viewed: 'stories_views_desc',
    },
    reels: {
      relevance: 'reels',
      newest: 'reels_date_desc',
      most_viewed: 'reels_views_desc',
    },
  },

  // Facets (attributes you can filter on)
  FACETS: {
    users: ['isVerified', 'isCreator', 'location', 'followerCount'],
    posts: ['type', 'hashtags', 'visibility', 'createdAt'],
    videos: ['category', 'duration', 'resolution', 'visibility'],
    stories: ['type', 'visibility', 'createdAt'],
    reels: ['category', 'duration', 'visibility'],
  },

  // Search behaviour
  DEFAULT_PAGE: 0,
  DEFAULT_HITS_PER_PAGE: 20,
  MAX_HITS_PER_PAGE: 100,
  TYPO_TOLERANCE: true,
  IGNORE_PLURALS: true,
  SYNONYMS: true,
  HIGHLIGHT_PRE_TAG: '<em class="search-highlight">',
  HIGHLIGHT_POST_TAG: '</em>',

  // Caching
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  CACHE_MAX_SIZE: 50,

  // Sponsored results
  SPONSORED: {
    ENABLED: true,
    INJECTION_POSITIONS: [1, 4, 7], // positions (0‑based) to attempt injection
  },

  // Analytics
  ANALYTICS: {
    ENABLED: true,
    SEND_SEARCH_EVENTS: true,
    SEND_CLICK_EVENTS: true,
  },

  // Personalization
  PERSONALIZATION: {
    ENABLED: true,
    // Note: Algolia Personalization requires a separate plan and a dedicated Personalization API key.
    // The userToken is still passed to enable it.
  },

  // Geo search
  GEO_SEARCH: {
    ENABLED: true,
    DEFAULT_RADIUS: 5000, // meters
  },

  // Voice search (Web Speech API)
  VOICE_SEARCH: {
    ENABLED: true,
    LANG: 'en-US',
  },
};

// ========================= LRU CACHE =========================
class LRUCache {
  constructor(maxSize = 50, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// ========================= ERROR HELPERS =========================
class SearchError extends Error {
  constructor(code, message, original) {
    super(message);
    this.code = code;
    this.original = original;
    this.timestamp = new Date().toISOString();
  }
}

function enhanceError(error, defaultMessage) {
  const code = error?.code || 'unknown';
  const messageMap = {
    'algolia/timeout': 'Search timed out. Please try again.',
    'algolia/network': 'Network error. Check your connection.',
    'algolia/authentication': 'Search authentication failed.',
    'algolia/valid': 'Invalid search query.',
  };
  const message = messageMap[code] || defaultMessage || 'Search operation failed';
  return new SearchError(code, message, error);
}

// ========================= MAIN SEARCH SERVICE =========================
class UltimateSearchService {
  constructor() {
    this.client = null;
    this.insightsClient = null;
    this.indices = {}; // cache of Algolia index handles
    this.cache = new LRUCache(SEARCH_CONFIG.CACHE_MAX_SIZE, SEARCH_CONFIG.CACHE_TTL);
    this.monetizationService = null;
    this.initialized = false;
    this.initPromise = null;
  }

  // ------------------------------------------------------------------
  //  INITIALIZATION
  // ------------------------------------------------------------------
  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (!SEARCH_CONFIG.ALGOLIA_APP_ID || !SEARCH_CONFIG.ALGOLIA_SEARCH_KEY) {
          throw new Error('Algolia credentials missing. Set REACT_APP_ALGOLIA_APP_ID and REACT_APP_ALGOLIA_SEARCH_KEY');
        }

        this.client = algoliasearch(
          SEARCH_CONFIG.ALGOLIA_APP_ID,
          SEARCH_CONFIG.ALGOLIA_SEARCH_KEY
        );

        if (SEARCH_CONFIG.ANALYTICS.ENABLED) {
          this.insightsClient = createInsightsClient({
            appId: SEARCH_CONFIG.ALGOLIA_APP_ID,
            apiKey: SEARCH_CONFIG.ALGOLIA_SEARCH_KEY,
          });
        }

        this.monetizationService = getMonetizationService();

        this.initialized = true;
        console.log('[Search] ✅ Algolia client ready');
      } catch (err) {
        console.error('[Search] ❌ Initialization failed', err);
        this.initPromise = null;
        throw enhanceError(err, 'Failed to initialize search service');
      }
    })();

    return this.initPromise;
  }

  // ------------------------------------------------------------------
  //  UNIVERSAL SEARCH
  // ------------------------------------------------------------------
  /**
   * Perform a search across multiple indices.
   * @param {string} query - Search text.
   * @param {Object} options
   *   - indices: array of base index names (e.g., ['users', 'posts']). Default all.
   *   - page: page number (0‑based).
   *   - hitsPerPage: number of results per index.
   *   - filters: string filter expression.
   *   - facetFilters: array of facet filters.
   *   - sortBy: sorting key (e.g., 'newest', 'followers_desc').
   *   - cache: boolean, whether to cache results.
   *   - userId: current user ID (for personalization/analytics).
   *   - aroundLatLng: lat,lng string for geo search.
   *   - aroundRadius: radius in meters.
   *   - personalization: boolean, enable personalization.
   * @returns {Promise<Object>}
   */
  async search(query, options = {}) {
    await this.ensureInitialized();

    const {
      indices = Object.values(SEARCH_CONFIG.BASE_INDICES),
      page = SEARCH_CONFIG.DEFAULT_PAGE,
      hitsPerPage = SEARCH_CONFIG.DEFAULT_HITS_PER_PAGE,
      filters,
      facetFilters,
      sortBy,
      cache = true,
      userId = null,
      aroundLatLng,
      aroundRadius = SEARCH_CONFIG.GEO_SEARCH.DEFAULT_RADIUS,
      personalization = SEARCH_CONFIG.PERSONALIZATION.ENABLED,
    } = options;

    // Build cache key
    const cacheKey = this._buildCacheKey({ query, indices, page, hitsPerPage, filters, facetFilters, sortBy, aroundLatLng });
    if (cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const result = await this._algoliaSearch({
        query,
        indices,
        page,
        hitsPerPage,
        filters,
        facetFilters,
        sortBy,
        userId,
        aroundLatLng,
        aroundRadius,
        personalization,
      });

      if (cache) this.cache.set(cacheKey, result);

      // Send analytics search event
      if (SEARCH_CONFIG.ANALYTICS.ENABLED && SEARCH_CONFIG.ANALYTICS.SEND_SEARCH_EVENTS && userId) {
        await this._trackSearchEvent(query, result, userId);
      }

      return result;
    } catch (error) {
      console.error('[Search] Algolia search failed', error);
      throw enhanceError(error, 'Search failed');
    }
  }

  // ------------------------------------------------------------------
  //  ALGOLIA SEARCH (internal)
  // ------------------------------------------------------------------
  async _algoliaSearch({
    query,
    indices,
    page,
    hitsPerPage,
    filters,
    facetFilters,
    sortBy,
    userId,
    aroundLatLng,
    aroundRadius,
    personalization,
  }) {
    const requests = indices.map(baseIndex => {
      const indexName = this._resolveIndexName(baseIndex, sortBy);
      const params = {
        query: query || '',
        page,
        hitsPerPage: Math.min(hitsPerPage, SEARCH_CONFIG.MAX_HITS_PER_PAGE),
        highlightPreTag: SEARCH_CONFIG.HIGHLIGHT_PRE_TAG,
        highlightPostTag: SEARCH_CONFIG.HIGHLIGHT_POST_TAG,
        typoTolerance: SEARCH_CONFIG.TYPO_TOLERANCE,
        ignorePlurals: SEARCH_CONFIG.IGNORE_PLURALS,
        synonyms: SEARCH_CONFIG.SYNONYMS,
      };

      if (filters) params.filters = filters;
      if (facetFilters) params.facetFilters = Array.isArray(facetFilters) ? facetFilters : [facetFilters];
      if (aroundLatLng && SEARCH_CONFIG.GEO_SEARCH.ENABLED) {
        params.aroundLatLng = aroundLatLng;
        params.aroundRadius = aroundRadius;
      }
      if (personalization && userId) {
        params.userToken = userId;
        params.enablePersonalization = true;
      }
      // Additional advanced parameters can be added here (e.g., optionalWords, restrictSearchableAttributes)

      return { indexName, params };
    });

    const { results } = await this.client.multipleQueries(requests);

    const formattedResults = {};
    results.forEach((res, idx) => {
      const baseIndex = indices[idx];
      formattedResults[baseIndex] = {
        hits: res.hits,
        nbHits: res.nbHits,
        page: res.page,
        nbPages: res.nbPages,
        hitsPerPage: res.hitsPerPage,
        processingTimeMS: res.processingTimeMS,
        query: res.query,
        params: res.params,
        queryID: res.queryID, // needed for click analytics
      };
    });

    // Inject sponsored results if enabled
    let sponsoredInjected = false;
    if (SEARCH_CONFIG.SPONSORED.ENABLED && userId && this.monetizationService) {
      sponsoredInjected = await this._injectSponsoredResults(formattedResults, query, userId);
    }

    return {
      success: true,
      results: formattedResults,
      query,
      sponsoredInjected,
      source: 'algolia',
    };
  }

  // ------------------------------------------------------------------
  //  SPONSORED INJECTION (without mutating Algolia metadata)
  // ------------------------------------------------------------------
  async _injectSponsoredResults(results, query, userId) {
    if (!this.monetizationService?.getSponsoredSearchResult) return false;

    try {
      const sponsored = await this.monetizationService.getSponsoredSearchResult(userId, query);
      if (!sponsored) return false;

      const targetBase = sponsored.type === 'user' ? 'users'
                         : sponsored.type === 'post' ? 'posts'
                         : sponsored.type === 'video' ? 'videos'
                         : sponsored.type === 'story' ? 'stories'
                         : sponsored.type === 'reel' ? 'reels'
                         : null;
      if (!targetBase || !results[targetBase]) return false;

      const target = results[targetBase];
      const hits = target.hits;

      // Try positions in order until we find a slot
      for (const pos of SEARCH_CONFIG.SPONSORED.INJECTION_POSITIONS) {
        if (pos <= hits.length) {
          const sponsoredHit = {
            objectID: `sponsored_${sponsored.id}`,
            ...sponsored.data,
            _isSponsored: true,
            _sponsorData: sponsored,
          };
          hits.splice(pos, 0, sponsoredHit);
          return true;
        }
      }
      // If no position fits, append at end
      hits.push({
        objectID: `sponsored_${sponsored.id}`,
        ...sponsored.data,
        _isSponsored: true,
        _sponsorData: sponsored,
      });
      return true;
    } catch (err) {
      console.warn('[Search] Failed to inject sponsored result', err);
      return false;
    }
  }

  // ------------------------------------------------------------------
  //  CONVENIENCE METHODS
  // ------------------------------------------------------------------
  async searchUsers(query, options = {}) {
    return this.search(query, { ...options, indices: [SEARCH_CONFIG.BASE_INDICES.USERS] });
  }

  async searchPosts(query, options = {}) {
    return this.search(query, { ...options, indices: [SEARCH_CONFIG.BASE_INDICES.POSTS] });
  }

  async searchVideos(query, options = {}) {
    return this.search(query, { ...options, indices: [SEARCH_CONFIG.BASE_INDICES.VIDEOS] });
  }

  // ------------------------------------------------------------------
  //  SUGGESTIONS (type‑ahead)
  // ------------------------------------------------------------------
  async getSuggestions(query, options = {}) {
    await this.ensureInitialized();

    try {
      const results = await this.search(query, {
        ...options,
        hitsPerPage: 5,
        cache: false,
      });

      const suggestions = [];
      for (const [type, data] of Object.entries(results.results)) {
        data.hits.forEach(hit => {
          suggestions.push({
            type,
            id: hit.objectID,
            text: this._getSuggestionText(hit, type),
            subtitle: this._getSuggestionSubtitle(hit, type),
            image: hit.photoURL || hit.image || hit.thumbnail,
            url: this._getResultUrl(hit, type),
          });
        });
      }

      return { success: true, suggestions, query };
    } catch (error) {
      console.error('[Search] Suggestions failed', error);
      return { success: false, suggestions: [], error: error.message };
    }
  }

  // ------------------------------------------------------------------
  //  FACETS
  // ------------------------------------------------------------------
  async getFacetValues(indexName, facetName, query = '', options = {}) {
    await this.ensureInitialized();

    const fullIndexName = this._resolveIndexName(indexName);
    let index = this.indices[fullIndexName];
    if (!index) {
      index = this.client.initIndex(fullIndexName);
      this.indices[fullIndexName] = index;
    }

    try {
      const result = await index.searchForFacetValues(facetName, query, options);
      return { success: true, facetValues: result.facetHits };
    } catch (error) {
      console.error(`[Search] Failed to get facet values for ${facetName}`, error);
      return { success: false, facetValues: [] };
    }
  }

  // ------------------------------------------------------------------
  //  ANALYTICS TRACKING
  // ------------------------------------------------------------------
  async trackClick(eventData) {
    if (!SEARCH_CONFIG.ANALYTICS.ENABLED || !SEARCH_CONFIG.ANALYTICS.SEND_CLICK_EVENTS) return;
    if (!this.insightsClient) return;

    try {
      const { queryID, objectIDs, positions, index, userToken } = eventData;
      this.insightsClient('clickedObjectIDsAfterSearch', {
        eventName: 'Result Click',
        index,
        queryID,
        objectIDs,
        positions,
        userToken,
      });
    } catch (err) {
      console.warn('[Search] Failed to track click', err);
    }
  }

  async _trackSearchEvent(query, searchResult, userId) {
    if (!this.insightsClient) return;
    try {
      // Algolia expects a search event for each index that returned a queryID
      for (const [indexName, data] of Object.entries(searchResult.results)) {
        if (data.queryID) {
          this.insightsClient('searched', {
            eventName: 'Search',
            index: indexName,
            queryID: data.queryID,
            query,
            positions: Array.from({ length: data.hits.length }, (_, i) => i + 1),
            objectIDs: data.hits.map(h => h.objectID),
            userToken: userId,
          });
        }
      }
    } catch (err) {
      console.warn('[Search] Failed to track search event', err);
    }
  }

  // ------------------------------------------------------------------
  //  SEARCH HISTORY (localStorage)
  // ------------------------------------------------------------------
  saveSearchHistory(query, maxItems = 10) {
    try {
      let history = JSON.parse(localStorage.getItem('arvdoul_search_history') || '[]');
      history = [query, ...history.filter(q => q !== query)].slice(0, maxItems);
      localStorage.setItem('arvdoul_search_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save search history', e);
    }
  }

  getSearchHistory() {
    try {
      return JSON.parse(localStorage.getItem('arvdoul_search_history') || '[]');
    } catch {
      return [];
    }
  }

  clearSearchHistory() {
    localStorage.removeItem('arvdoul_search_history');
  }

  // ------------------------------------------------------------------
  //  VOICE SEARCH (Web Speech API)
  // ------------------------------------------------------------------
  startVoiceSearch(onResult, onError) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      const err = new Error('Speech recognition not supported in this browser');
      if (onError) onError(err);
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = SEARCH_CONFIG.VOICE_SEARCH.LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };

    recognition.onerror = event => {
      if (onError) onError(event.error);
    };

    recognition.start();
    return recognition;
  }

  // ------------------------------------------------------------------
  //  PRIVATE HELPERS
  // ------------------------------------------------------------------
  _resolveIndexName(baseIndex, sortBy = 'relevance') {
    const replicas = SEARCH_CONFIG.SORT_REPLICAS[baseIndex];
    if (!replicas) return baseIndex;
    return replicas[sortBy] || baseIndex;
  }

  _buildCacheKey({ query, indices, page, hitsPerPage, filters, facetFilters, sortBy, aroundLatLng }) {
    const parts = [
      query,
      indices.sort().join(','),
      page,
      hitsPerPage,
      filters || '',
      facetFilters ? JSON.stringify(facetFilters.slice().sort()) : '',
      sortBy || '',
      aroundLatLng || '',
    ];
    return parts.join('|');
  }

  _getSuggestionText(hit, type) {
    switch (type) {
      case 'users':
        return hit.displayName || hit.username;
      case 'posts':
        return hit.title || hit.content?.substring(0, 50);
      case 'videos':
      case 'reels':
        return hit.title;
      case 'stories':
        return hit.caption || 'Story';
      default:
        return hit._highlightResult?.title?.value || hit.title || hit.name || hit.username;
    }
  }

  _getSuggestionSubtitle(hit, type) {
    switch (type) {
      case 'users':
        return `@${hit.username}`;
      case 'posts':
        return hit.type === 'image' ? '📷 Post' : '📝 Post';
      case 'videos':
        return `🎬 ${hit.duration ? Math.floor(hit.duration / 60) + 'm' : 'Video'}`;
      case 'stories':
        return '📖 Story';
      case 'reels':
        return '🎥 Reel';
      default:
        return '';
    }
  }

  _getResultUrl(hit, type) {
    switch (type) {
      case 'users':
        return `/profile/${hit.username || hit.objectID}`;
      case 'posts':
        return `/post/${hit.objectID}`;
      case 'videos':
        return `/video/${hit.objectID}`;
      case 'stories':
        return `/story/${hit.objectID}`;
      case 'reels':
        return `/reel/${hit.objectID}`;
      default:
        return '#';
    }
  }

  // ------------------------------------------------------------------
  //  SERVICE MANAGEMENT
  // ------------------------------------------------------------------
  clearCache() {
    this.cache.clear();
  }

  getStats() {
    return {
      cacheSize: this.cache.size(),
      initialized: this.initialized,
    };
  }

  destroy() {
    this.clearCache();
    this.client = null;
    this.insightsClient = null;
    this.indices = {};
    this.initialized = false;
    this.initPromise = null;
    console.log('[Search] Destroyed');
  }
}

// ========================= SINGLETON =========================
let instance = null;
export function getSearchService() {
  if (!instance) instance = new UltimateSearchService();
  return instance;
}

// ========================= PUBLIC API =========================
const searchService = {
  search: (q, opts) => getSearchService().search(q, opts),
  searchUsers: (q, opts) => getSearchService().searchUsers(q, opts),
  searchPosts: (q, opts) => getSearchService().searchPosts(q, opts),
  searchVideos: (q, opts) => getSearchService().searchVideos(q, opts),
  getSuggestions: (q, opts) => getSearchService().getSuggestions(q, opts),
  getFacetValues: (idx, facet, q, opts) => getSearchService().getFacetValues(idx, facet, q, opts),
  trackClick: (data) => getSearchService().trackClick(data),
  saveSearchHistory: (query) => getSearchService().saveSearchHistory(query),
  getSearchHistory: () => getSearchService().getSearchHistory(),
  clearSearchHistory: () => getSearchService().clearSearchHistory(),
  startVoiceSearch: (onResult, onError) => getSearchService().startVoiceSearch(onResult, onError),
  clearCache: () => getSearchService().clearCache(),
  getStats: () => getSearchService().getStats(),
  destroy: () => getSearchService().destroy(),

  CONFIG: {
    FACETS: SEARCH_CONFIG.FACETS,
    SORT_REPLICAS: SEARCH_CONFIG.SORT_REPLICAS,
    BASE_INDICES: SEARCH_CONFIG.BASE_INDICES,
  },
};

export default searchService;