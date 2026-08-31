// src/store/searchStore.js - ARVDOUL Search State Management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_FILTERS = {
  contentType: 'all',
  date: 'any',
  sortBy: 'relevance',
  verifiedOnly: false,
};

export const useSearchStore = create(
  persist(
    (set, get) => ({
      // Search state
      query: '',
      results: [],
      suggestions: [],
      trending: [],
      recent: [],
      filters: DEFAULT_FILTERS,
      loading: false,
      hasMore: true,
      cursor: null,
      selectedTab: 'all',

      // UI state
      isSearching: false,
      isFocused: false,
      showSuggestions: false,

      // Actions
      setQuery: (query) => set({ query }),
      
      setResults: (results) => set({ results }),
      
      appendResults: (newResults) => set((state) => ({
        results: [...state.results, ...newResults]
      })),
      
      setSuggestions: (suggestions) => set({ suggestions }),
      
      setTrending: (trending) => set({ trending }),
      
      addRecent: (query) => set((state) => {
        const filtered = state.recent.filter((q) => q !== query);
        return { recent: [query, ...filtered].slice(0, 20) };
      }),
      
      removeRecent: (query) => set((state) => ({
        recent: state.recent.filter((q) => q !== query)
      })),
      
      clearRecent: () => set({ recent: [] }),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      
      setLoading: (loading) => set({ loading }),
      
      setHasMore: (hasMore) => set({ hasMore }),
      
      setCursor: (cursor) => set({ cursor }),
      
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      
      setIsSearching: (isSearching) => set({ isSearching }),
      
      setIsFocused: (isFocused) => set({ isFocused }),
      
      setShowSuggestions: (showSuggestions) => set({ showSuggestions }),
      
      reset: () => set({
        query: '',
        results: [],
        suggestions: [],
        loading: false,
        hasMore: true,
        cursor: null,
        selectedTab: 'all',
        isSearching: false,
        showSuggestions: false,
        filters: DEFAULT_FILTERS,
      }),
    }),
    {
      name: 'arvdoul-search-store',
      partialize: (state) => ({
        recent: state.recent,
        filters: state.filters,
      }),
    }
  )
);

export default useSearchStore;
