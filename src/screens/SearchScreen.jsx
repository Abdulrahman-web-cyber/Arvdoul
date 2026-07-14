// src/screens/SearchScreen.jsx - ARVDOUL Ultimate Search System
import React, { memo, useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Users, FileText, Image, Radio, Calendar, BarChart2, 
  HelpCircle, Hash, Music, MapPin, Sparkles, Clock, X 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSearch } from '../hooks/useSearch';
import { cn } from '../lib/utils';
import SearchBar from '../components/search/SearchBar';
import SearchSuggestions from '../components/search/SearchSuggestions';
import SearchResults from '../components/search/SearchResults';
import TrendingSection from '../components/search/TrendingSection';
import CreatorCarousel from '../components/search/CreatorCarousel';
import SearchFilters from '../components/search/SearchFilters';

/**
 * Category definitions
 */
const CATEGORIES = [
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'people', label: 'People', icon: Users },
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'polls', label: 'Polls', icon: BarChart2 },
  { id: 'questions', label: 'Questions', icon: HelpCircle },
  { id: 'hashtags', label: 'Hashtags', icon: Hash },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'places', label: 'Places', icon: MapPin },
];

/**
 * Discovery cards data
 */
const DISCOVERY_ITEMS = [
  { id: 1, title: 'Trending Reels', subtitle: 'Most viewed this week', image: 'https://picsum.photos/seed/reels/360/300' },
  { id: 2, title: 'Top Creators', subtitle: 'Follow the best', image: 'https://picsum.photos/seed/creators/360/300' },
  { id: 3, title: 'New Music', subtitle: 'Fresh releases', image: 'https://picsum.photos/seed/music/360/300' },
  { id: 4, title: 'Live Events', subtitle: 'Happening now', image: 'https://picsum.photos/seed/events/360/300' },
  { id: 5, title: 'Viral Posts', subtitle: 'Most shared', image: 'https://picsum.photos/seed/viral/360/300' },
];

/**
 * Search Screen Component
 */
const SearchScreen = memo(() => {
  const navigate = useNavigate();
  const { isDark, glass, spring, colors, spacing } = useTheme();
  
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
    showSuggestions,
    search,
    loadMore,
    updateQuery,
    setFilters,
    resetFilters,
    setTab,
    clearRecent,
    removeRecent,
    handleFocus,
    handleBlur,
  } = useSearch();

  // Handle search submission
  const handleSearch = useCallback((searchQuery = query) => {
    if (searchQuery.trim()) {
      search(searchQuery);
      setHasSearched(true);
    }
  }, [query, search]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((text, isEscape) => {
    if (isEscape) {
      handleBlur();
      return;
    }
    if (text) {
      updateQuery(text);
      search(text);
      setHasSearched(true);
    }
    handleBlur();
  }, [updateQuery, search, handleBlur]);

  // Handle category click
  const handleCategoryClick = useCallback((categoryId) => {
    updateQuery(categoryId);
    setTab(categoryId);
    search(categoryId);
    setHasSearched(true);
  }, [updateQuery, setTab, search]);

  // Handle result click
  const handleResultClick = useCallback((result) => {
    switch (result.type?.toLowerCase()) {
      case 'user':
      case 'users':
        navigate(`/profile/${result.id || result.objectID}`);
        break;
      case 'video':
      case 'videos':
        navigate(`/video/${result.id || result.objectID}`);
        break;
      case 'post':
      case 'posts':
        navigate(`/post/${result.id || result.objectID}`);
        break;
      default:
        console.log('Navigate to:', result.id);
    }
  }, [navigate]);

  // Handle creator click
  const handleCreatorClick = useCallback((creator) => {
    navigate(`/profile/${creator.id || creator.uid}`);
  }, [navigate]);

  // Handle follow
  const handleFollow = useCallback((creatorId) => {
    console.log('Follow creator:', creatorId);
  }, []);

  // Show search results or home content
  const renderContent = () => {
    if (hasSearched && query.trim()) {
      return (
        <SearchResults
          results={results}
          loading={loading}
          hasMore={hasMore}
          selectedTab={selectedTab}
          onTabChange={setTab}
          onLoadMore={loadMore}
          onResultClick={handleResultClick}
          query={query}
        />
      );
    }

    // Home content
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Recent Searches */}
        {recent.length > 0 && (
          <RecentSearches
            recent={recent}
            onSelect={handleSuggestionSelect}
            onRemove={removeRecent}
            onClear={clearRecent}
            isDark={isDark}
          />
        )}

        {/* For You Section */}
        <ForYouSection isDark={isDark} />

        {/* Explore Categories */}
        <ExploreCategories
          onCategoryClick={handleCategoryClick}
          isDark={isDark}
        />

        {/* Trending Now */}
        <TrendingSection
          type="hashtags"
          title="Trending Now"
          items={trending.hashtags || []}
          isDark={isDark}
          onItemClick={(item) => handleSuggestionSelect(`#${item.hashtag || item.label}`)}
        />

        {/* Recommended Creators */}
        <CreatorCarousel
          creators={trending.creators || []}
          onFollow={handleFollow}
          onCreatorClick={handleCreatorClick}
          isDark={isDark}
        />
      </motion.div>
    );
  };

  return (
    <div 
      className={cn(
        'min-h-screen pb-24',
        isDark ? 'bg-[#050510]' : 'bg-gray-50'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Status Bar Spacer */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-4 mb-4">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'text-3xl font-bold mb-4',
            isDark ? 'text-white' : 'text-gray-900'
          )}
          style={{
            background: 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Search
        </motion.h1>

        {/* Search Bar */}
        <div className="relative">
          <SearchBar
            value={query}
            onChange={updateQuery}
            onSearch={handleSearch}
            onVoiceSearch={() => console.log('Voice search')}
            onQRScan={() => console.log('QR scan')}
            onFilters={() => setShowFilters(true)}
            isFocused={showSuggestions}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search Arvdoul..."
          />

          {/* Suggestions Dropdown */}
          <SearchSuggestions
            query={query}
            suggestions={suggestions}
            recentSearches={recent.slice(0, 5).map((q) => ({ id: q, text: q, type: 'recent' }))}
            onSelect={handleSuggestionSelect}
            onRemoveRecent={removeRecent}
            visible={showSuggestions && !hasSearched}
            loading={loading}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4">
        {renderContent()}
      </div>

      {/* Filters Modal */}
      <SearchFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={setFilters}
        filters={filters}
        onReset={resetFilters}
      />
    </div>
  );
});

SearchScreen.displayName = 'SearchScreen';

/**
 * Recent Searches Component
 */
const RecentSearches = memo(({ recent, onSelect, onRemove, onClear, isDark }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Clock className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
        <span className={cn(
          'font-semibold',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Recent Searches
        </span>
      </div>
      <button
        onClick={onClear}
        className={cn(
          'text-sm hover:underline',
          isDark ? 'text-gray-400' : 'text-gray-500'
        )}
      >
        Clear all
      </button>
    </div>
    <div className="flex flex-wrap gap-2">
      {recent.slice(0, 8).map((item) => (
        <motion.button
          key={item}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(item)}
          className={cn(
            'h-[44px] px-4 rounded-full',
            'flex items-center gap-2',
            'backdrop-blur-xl border border-white/10',
            isDark ? 'bg-white/5 text-gray-300' : 'bg-white/50 text-gray-700',
            'hover:bg-white/10 transition-colors'
          )}
        >
          <span className="text-sm">{item}</span>
          <X
            className="w-4 h-4 opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
          />
        </motion.button>
      ))}
    </div>
  </div>
));

RecentSearches.displayName = 'RecentSearches';

/**
 * For You Section
 */
const ForYouSection = memo(({ isDark }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-4">
      <Sparkles className="w-5 h-5 text-[#B416DB]" />
      <h2 className={cn(
        'text-lg font-bold',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        For You
      </h2>
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {DISCOVERY_ITEMS.map((item) => (
        <motion.div
          key={item.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'flex-shrink-0 w-[180px] h-[150px] rounded-2xl overflow-hidden',
            'shadow-lg cursor-pointer'
          )}
        >
          <div className="relative w-full h-full">
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-semibold text-sm">{item.title}</h3>
              <p className="text-white/70 text-xs">{item.subtitle}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
));

ForYouSection.displayName = 'ForYouSection';

/**
 * Explore Categories Grid
 */
const ExploreCategories = memo(({ onCategoryClick, isDark }) => (
  <div className="mb-6">
    <h2 className={cn(
      'text-lg font-bold mb-4',
      isDark ? 'text-white' : 'text-gray-900'
    )}>
      Explore Categories
    </h2>
    <div className="grid grid-cols-4 gap-3">
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        return (
          <motion.button
            key={category.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryClick(category.id)}
            className={cn(
              'flex flex-col items-center justify-center p-3',
              'rounded-2xl',
              'backdrop-blur-xl border border-white/10',
              isDark ? 'bg-white/5' : 'bg-white/50',
              'hover:bg-white/10 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-xl mb-2',
              'flex items-center justify-center',
              'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF]'
            )}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className={cn(
              'text-xs font-medium text-center',
              isDark ? 'text-gray-300' : 'text-gray-700'
            )}>
              {category.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  </div>
));

ExploreCategories.displayName = 'ExploreCategories';

export default SearchScreen;
