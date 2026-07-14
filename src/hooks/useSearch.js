// src/hooks/useSearch.js - ARVDOUL Search Hook
import { useCallback, useEffect, useRef } from 'react';
import { useSearchStore } from '../store/searchStore';
import searchService from '../services/searchService';
import { debounce, normalizeQuery, isValidQuery, parseCategory } from '../lib/searchUtils';

export function useSearch() {
  const abortControllerRef = useRef(null);
  
  const {
    query,
    results,
    suggestions,
    trending,
    recent,
    filters,
    loading,
    hasMore,
    selectedTab,
    isSearching,
    showSuggestions,
    setQuery,
    setResults,
    appendResults,
    setSuggestions,
    setTrending,
    addRecent,
    removeRecent,
    clearRecent,
    setFilters,
    resetFilters,
    setLoading,
    setHasMore,
    setCursor,
    setSelectedTab,
    setIsSearching,
    setIsFocused,
    setShowSuggestions,
    reset,
  } = useSearchStore();

  // Debounced search for suggestions
  const debouncedSearchSuggestions = useCallback(
    debounce(async (searchQuery) => {
      if (!isValidQuery(searchQuery)) {
        setSuggestions([]);
        return;
      }

      try {
        const normalized = normalizeQuery(searchQuery);
        const response = await searchService.getSuggestions(normalized);
        
        if (response.success) {
          setSuggestions(
            response.suggestions.map((text, index) => ({
              id: `suggestion-${index}`,
              text,
              type: 'suggestion',
            }))
          );
        }
      } catch (error) {
        console.error('[useSearch] Suggestions error:', error);
        setSuggestions([]);
      }
    }, 300),
    [setSuggestions]
  );

  // Main search function
  const search = useCallback(async (searchQuery = query, options = {}) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const normalizedQuery = normalizeQuery(searchQuery);
    
    if (!isValidQuery(normalizedQuery)) {
      setResults([]);
      return;
    }

    setLoading(true);
    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const category = parseCategory(selectedTab);
      const indices = category === 'all' 
        ? ['users', 'posts', 'videos']
        : [category];

      const response = await searchService.search(normalizedQuery, {
        indices,
        hitsPerPage: 20,
        ...options,
        facetFilters: options.facetFilters || buildFacetFilters(filters),
      });

      if (response.success) {
        setResults(response.items || []);
        setHasMore(response.hasNextPage || false);
        setCursor(response.cursor || null);
        addRecent(normalizedQuery);
      } else {
        setResults([]);
        setHasMore(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[useSearch] Search error:', error);
        setResults([]);
      }
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [query, selectedTab, filters, setResults, setLoading, setIsSearching, setHasMore, setCursor, addRecent, setShowSuggestions]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      const normalizedQuery = normalizeQuery(query);
      const category = parseCategory(selectedTab);
      const indices = category === 'all' 
        ? ['users', 'posts', 'videos']
        : [category];

      const response = await searchService.search(normalizedQuery, {
        indices,
        hitsPerPage: 20,
        cursor: useSearchStore.getState().cursor,
        facetFilters: buildFacetFilters(filters),
      });

      if (response.success) {
        appendResults(response.items || []);
        setHasMore(response.hasNextPage || false);
        setCursor(response.cursor || null);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[useSearch] Load more error:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, query, selectedTab, filters, appendResults, setHasMore, setCursor, setLoading]);

  // Load trending content
  const loadTrending = useCallback(async () => {
    try {
      // Fetch trending hashtags
      const hashtagsResponse = await searchService.getFacetValues('posts', 'hashtags', '', {
        hitsPerPage: 10,
      });
      
      // Fetch trending creators
      const creatorsResponse = await searchService.search('', {
        indices: ['users'],
        hitsPerPage: 5,
        sortBy: 'followers_desc',
        facetFilters: ['isVerified:true'],
      });

      setTrending({
        hashtags: hashtagsResponse.success ? hashtagsResponse.facetValues.slice(0, 10) : [],
        creators: creatorsResponse.success ? creatorsResponse.items.slice(0, 10) : [],
      });
    } catch (error) {
      console.error('[useSearch] Load trending error:', error);
    }
  }, [setTrending]);

  // Update query and trigger suggestions
  const updateQuery = useCallback((newQuery) => {
    setQuery(newQuery);
    setShowSuggestions(newQuery.length > 0);
    debouncedSearchSuggestions(newQuery);
  }, [setQuery, setShowSuggestions, debouncedSearchSuggestions]);

  // Clear search
  const clearSearch = useCallback(() => {
    reset();
    setSuggestions([]);
  }, [reset, setSuggestions]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (query.length > 0) {
      setShowSuggestions(true);
    }
  }, [setIsFocused, query, setShowSuggestions]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  }, [setIsFocused, setShowSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load trending on mount
  useEffect(() => {
    loadTrending();
  }, []);

  return {
    // State
    query,
    results,
    suggestions,
    trending,
    recent,
    filters,
    loading,
    hasMore,
    selectedTab,
    isSearching,
    showSuggestions,
    
    // Actions
    search,
    loadMore,
    updateQuery,
    setQuery,
    setFilters,
    resetFilters,
    clearSearch,
    setTab: setSelectedTab,
    clearRecent,
    removeRecent,
    
    // Suggestions
    handleFocus,
    handleBlur,
    
    // Trending
    loadTrending,
    
    // Voice & QR placeholders
    voiceSearch: () => console.log('Voice search not implemented'),
    qrScan: () => console.log('QR scan not implemented'),
  };
}

// Build facet filters from filter state
function buildFacetFilters(filters) {
  const facetFilters = [];
  
  if (filters.contentType && filters.contentType !== 'all') {
    facetFilters.push(`type:${filters.contentType}`);
  }
  
  if (filters.verifiedOnly) {
    facetFilters.push('isVerified:true');
  }
  
  return facetFilters;
}

export default useSearch;
