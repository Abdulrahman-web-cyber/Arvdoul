// src/screens/SearchScreen.jsx

import { memo, useCallback, useState, useEffect } from "react";
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Users, FileText, Image, Radio, Calendar, BarChart2, 
  HelpCircle, Hash, Music, MapPin, Sparkles, Clock, X, Search, SlidersHorizontal, Mic,
  Film, Flame, MessageSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { getUserService } from '../services/userService';
import { toast } from 'sonner';
import { useSearch } from '../hooks/useSearch';
import { cn } from '../lib/utils';
import SearchSuggestions from '../components/search/SearchSuggestions';
import SearchResults from '../components/search/SearchResults';
import TrendingSection from '../components/search/TrendingSection';
import CreatorCarousel from '../components/search/CreatorCarousel';
import SearchFilters from '../components/search/SearchFilters';
import SponsoredPostCard from '../components/Ads/SponsoredPostCard';
import { BRAND_GRADIENT, tokens, brandRgba} from '../design-system/tokens.js';

/**
 * ARVDOUL Design Tokens — the brand gradient comes from the design system so
 * this screen cannot drift from the canonical value (N104).
 */
const ARVDOUL_GRADIENT = BRAND_GRADIENT;

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
// Discovery shortcuts. These are navigation entries into real search tabs /
// routes — not a ranking claim: no trending score is computed for them, so the
// copy describes the destination rather than asserting "most viewed/shared".
const DISCOVERY_ITEMS = [
  { id: 'reels', title: 'Reels', subtitle: 'Short-form video', key: 'videos' },
  { id: 'creators', title: 'Creators', subtitle: 'Find people to follow', key: 'people' },
  { id: 'posts', title: 'Posts', subtitle: 'Browse public posts', key: 'posts' },
  { id: 'communities', title: 'Communities', subtitle: 'Join a community', key: 'communities' },
];

/**
 * Search Screen Component - Pixel Perfect ARVDOUL Design
 */
const SearchScreen = memo(() => {
  const navigate = useNavigate();
  const { isDark, spring } = useTheme();
  const { user } = useAuth();
  const { hasTopAppBar } = useLayoutChrome();
  
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const {
    query,
    results,
    suggestions,
    trending,
    setTrending,
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
    voiceSearch,
  } = useSearch();

  // Listen for search events from unified TopAppBar
  useEffect(() => {
    const handleQueryChange = (e) => {
      const newQ = e.detail ?? '';
      updateQuery(newQ);
      if (newQ && newQ.trim()) {
        search(newQ);
        setHasSearched(true);
      } else {
        setHasSearched(false);
      }
    };

    const handleSearchSubmit = (e) => {
      const q = e.detail || query;
      if (q && q.trim()) {
        search(q);
        setHasSearched(true);
      }
    };

    const handleToggleFilters = () => {
      setShowFilters((prev) => !prev);
    };

    window.addEventListener('arvdoul:search_query', handleQueryChange);
    window.addEventListener('arvdoul:search_submit', handleSearchSubmit);
    window.addEventListener('arvdoul:toggle_search_filters', handleToggleFilters);

    return () => {
      window.removeEventListener('arvdoul:search_query', handleQueryChange);
      window.removeEventListener('arvdoul:search_submit', handleSearchSubmit);
      window.removeEventListener('arvdoul:toggle_search_filters', handleToggleFilters);
    };
  }, [updateQuery, search, query]);

  // Resolve the viewer's real follow state for the trending creators. The
  // search index does not carry a per-viewer `isFollowing` flag, so a card that
  // read `creator.isFollowing` always showed "Follow" for a creator the viewer
  // already followed (and tapping it then called followUser again). Batched
  // per-pair edge read, never a scan of the viewer's follow graph.
  const trendingCreatorIds = Array.isArray(trending?.creators)
    ? trending.creators.map((c) => c.id || c.uid).filter(Boolean).join(',')
    : '';
  useEffect(() => {
    if (!user?.uid || !trendingCreatorIds) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const ids = trendingCreatorIds.split(',');
        const states = await getUserService().getFollowStates(user.uid, ids);
        if (cancelled) return;
        setTrending((prev) => {
          if (!prev || !Array.isArray(prev.creators)) return prev;
          return {
            ...prev,
            creators: prev.creators.map((c) => {
              const state = states.get(c.id || c.uid);
              return {
                ...c,
                isFollowing: Boolean(state?.isFollowing),
                requestStatus: state?.requestStatus ?? null,
              };
            }),
          };
        });
      } catch (err) {
        console.warn('[SearchScreen] follow-state hydration failed', err?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, trendingCreatorIds, setTrending]);

  // Handle search submission
  const handleSearch = useCallback((searchQuery = query) => {
    if (searchQuery.trim()) {
      search(searchQuery);
      setHasSearched(true);
      window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: searchQuery }));
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
      window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: text }));
    }
    handleBlur();
  }, [updateQuery, search, handleBlur]);

  // Handle category click
  const handleCategoryClick = useCallback((categoryId) => {
    updateQuery(categoryId);
    setTab(categoryId);
    search(categoryId);
    setHasSearched(true);
    window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: categoryId }));
  }, [updateQuery, setTab, search]);

  // Voice search — real Web Speech API through the hook; the transcript fills
  // the query and runs a search. A browser without support gets an honest error
  // rather than a control that silently does nothing.
  const handleVoiceSearch = useCallback(async () => {
    if (isListening) return;
    setIsListening(true);
    try {
      const transcript = await voiceSearch();
      const text = String(transcript || '').trim();
      if (text) {
        updateQuery(text);
        search(text);
        setHasSearched(true);
        window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: text }));
      }
    } catch (err) {
      toast.error(err?.message || 'Voice search is unavailable.');
    } finally {
      setIsListening(false);
    }
  }, [isListening, voiceSearch, updateQuery, search]);

  // Handle result click
  const handleResultClick = useCallback((result) => {
    const targetId = result.canonicalPostId || result.id || result.objectID;
    switch (result.type?.toLowerCase()) {
      case 'user':
      case 'users':
        navigate(`/profile/${result.id || result.objectID}`);
        break;
      case 'video':
      case 'videos':
      case 'spark':
      case 'sparks':
      case 'reel':
      case 'reels':
        navigate(`/sparks/${targetId}`);
        break;
      case 'post':
      case 'posts':
        navigate(`/post/${result.id || result.objectID}`);
        break;
      default:
        // Unknown result types have no route; nothing to navigate to.
        break;
    }
  }, [navigate]);

  // Handle creator click
  const handleCreatorClick = useCallback((creator) => {
    navigate(`/profile/${creator.id || creator.uid}`);
  }, [navigate]);

  // Handle follow — the CreatorCarousel button emitted to a console.log no-op,
  // so "Follow" on a recommended creator did nothing. Route it to the canonical
  // follow service (the same one Reels/PostCard use) and reflect the new state
  // in the carousel, rolling back on failure.
  const handleFollow = useCallback(async (creatorId) => {
    if (!user?.uid) {
      toast.error('Sign in to follow creators');
      return;
    }
    if (!creatorId || creatorId === user.uid) return;
    const creators = Array.isArray(trending?.creators) ? trending.creators : [];
    const target = creators.find((c) => (c.id || c.uid) === creatorId);
    const wasFollowing = Boolean(target?.isFollowing);
    const wasRequested = Boolean(target?.requestStatus === 'pending');
    const applyState = (following, requestStatus = null) => {
      if (!trending || !Array.isArray(trending.creators)) return;
      setTrending({
        ...trending,
        creators: trending.creators.map((c) => ((c.id || c.uid) === creatorId
          ? { ...c, isFollowing: following, requestStatus }
          : c)),
      });
    };
    // Optimistic: a private target becomes a *pending request*, not a follow.
    applyState(!wasFollowing && !wasRequested, null);
    try {
      if (wasFollowing || wasRequested) {
        if (wasRequested) await getUserService().cancelFollowRequest(user.uid, creatorId);
        else await getUserService().unfollowUser(user.uid, creatorId);
        applyState(false, null);
        toast.success(wasRequested ? 'Request withdrawn' : 'Unfollowed');
      } else {
        const res = await getUserService().followUser(user.uid, creatorId);
        // A private account yields `{requested:true}` and creates no edge; show
        // "Requested" rather than claiming a completed follow.
        if (res?.requested || res?.requestStatus === 'pending') {
          applyState(false, 'pending');
          toast.success('Follow request sent');
        } else {
          applyState(true, null);
          toast.success('Following');
        }
      }
    } catch (err) {
      applyState(wasFollowing, wasRequested ? 'pending' : null);
      toast.error(err?.message || 'Could not update follow');
    }
  }, [user?.uid, trending, setTrending]);

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
        <ForYouSection isDark={isDark} onSelect={handleCategoryClick} />

        {/* Explore Categories */}
        <ExploreCategories
          onCategoryClick={handleCategoryClick}
          isDark={isDark}
        />

        {/* Sponsored Spotlight & Monetization */}
        <div className="my-3">
          <SponsoredPostCard placement="search" />
        </div>

        {/* Trending Now */}
        <TrendingSection
          type="hashtags"
          title="Trending Now"
          items={Array.isArray(trending) ? trending : (trending?.hashtags || [])}
          onItemClick={(item) => handleSuggestionSelect(`#${item.hashtag || item.label}`)}
        />

        {/* Recommended Creators */}
        <CreatorCarousel
          creators={Array.isArray(trending?.creators) ? trending.creators : []}
          onFollow={handleFollow}
          onCreatorClick={handleCreatorClick}
        />

        {/* Bottom Spacer for Navigation */}
        <div className="h-8" />
      </motion.div>
    );
  };

  return (
    <div 
      className={cn(
        'min-h-screen',
        isDark 
          ? 'bg-[#03071B] text-white' 
          : 'bg-[#F6F8FC] text-slate-900'
      )}
    >
      {/* Search Header Bar with Input (only when TopAppBar absent) & Category Pills */}
      <div className="px-4 pt-2 pb-3 space-y-3">
        {/* In-Page Quick Search Input (hidden when TopAppBar owns global search) + Voice & Filters */}
        <div className={cn('relative flex items-center gap-2', hasTopAppBar && 'justify-end')}>
          {!hasTopAppBar && (
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                aria-label="Search people, tags, videos, and posts..."
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  updateQuery(val);
                  window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: val }));
                  if (!val.trim()) setHasSearched(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Search people, tags, videos, and posts..."
                className={cn(
                  'w-full pl-10 pr-9 py-2.5 rounded-2xl text-sm font-medium transition-all outline-none',
                  isDark
                    ? 'bg-white/[0.06] border border-white/10 text-white placeholder-slate-400 focus:bg-white/[0.10] focus:border-purple-500/50'
                    : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm focus:border-purple-500'
                )}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    updateQuery('');
                    setHasSearched(false);
                    window.dispatchEvent(new CustomEvent('arvdoul:set_search_query', { detail: '' }));
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleVoiceSearch}
            disabled={isListening}
            className={cn(
              'min-h-[44px] min-w-[44px] px-3 rounded-2xl border transition-all flex items-center gap-1.5 justify-center shrink-0 cursor-pointer',
              isListening
                ? 'bg-purple-600 text-white border-purple-500 animate-pulse'
                : isDark
                ? 'bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.10]'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50'
            )}
            title={isListening ? 'Listening…' : 'Voice search'}
            aria-label="Search by voice"
          >
            <Mic className="w-4 h-4" />
            {hasTopAppBar && <span className="text-xs font-semibold hidden sm:inline">Voice</span>}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={cn(
              'min-h-[44px] min-w-[44px] px-3 rounded-2xl border transition-all flex items-center gap-1.5 justify-center shrink-0 cursor-pointer',
              showFilters
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/25'
                : isDark
                ? 'bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.10]'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50'
            )}
            title="Search Filters"
            aria-label="Search Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasTopAppBar && <span className="text-xs font-semibold hidden sm:inline">Filters</span>}
          </button>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                  isSelected
                    ? "bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue text-white shadow-md shadow-purple-500/25"
                    : isDark
                    ? "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
                    : "bg-black/[0.05] text-gray-700 hover:bg-black/[0.09] hover:text-gray-900"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Suggestions Dropdown */}
        {query && !hasSearched && (
          <div className="relative mt-2">
            <SearchSuggestions
              query={query}
              suggestions={suggestions}
              recentSearches={(recent || []).slice(0, 5).map((q) => ({ id: q, text: q, type: 'recent' }))}
              onSelect={handleSuggestionSelect}
              onRemoveRecent={removeRecent}
              visible={true}
              loading={loading}
            />
          </div>
        )}
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
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-6"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center',
          'bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue'
        )}>
          <Clock className="w-4 h-4 text-white" />
        </div>
        <span className={cn(
          'font-bold text-sm',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Recent Searches
        </span>
      </div>
      <button
        onClick={onClear}
        className={cn(
          'text-xs font-medium px-3 py-1.5 rounded-full',
          'bg-gradient-to-r from-arvdoul-purple/10 to-arvdoul-blue/10',
          'hover:from-arvdoul-purple/20 hover:to-arvdoul-blue/20',
          isDark ? 'text-arvdoul-purple' : 'text-arvdoul-indigo',
          'transition-all duration-200'
        )}
      >
        Clear all
      </button>
    </div>
    <div className="flex flex-wrap gap-2">
      {recent.slice(0, 8).map((item, index) => (
        <motion.button
          key={item}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(item)}
          className={cn(
            'h-[40px] px-4 rounded-full',
            'flex items-center gap-2',
            'backdrop-blur-xl border border-white/10',
            'shadow-lg',
            isDark 
              ? 'bg-white/5 text-gray-200 hover:bg-white/10' 
              : 'bg-white/70 text-gray-700 hover:bg-white/90',
            'transition-all duration-200'
          )}
          style={{
            boxShadow: isDark 
              ? '0 4px 15px rgba(0, 0, 0, 0.3)' 
              : '0 4px 15px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-medium">{item}</span>
          <X
            className="w-3.5 h-3.5 text-gray-500 hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
          />
        </motion.button>
      ))}
    </div>
  </motion.div>
));

RecentSearches.displayName = 'RecentSearches';

/**
 * For You Section
 */
const ForYouSection = memo(({ isDark, onSelect }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-6"
  >
    <div className="flex items-center gap-2 mb-4">
      <Sparkles className="w-5 h-5" style={{ color: tokens.color.brand.violet }} />
      <h2 className={cn(
        'text-lg font-bold',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        For You
      </h2>
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {DISCOVERY_ITEMS.map((item, index) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={() => onSelect?.(item.key)}
          aria-label={`${item.title} — ${item.subtitle}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex-shrink-0 w-[180px] h-[150px] rounded-2xl overflow-hidden text-left',
            'cursor-pointer relative group'
          )}
          style={{
            boxShadow: `0 10px 40px ${brandRgba(0.3)}`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-300 group-hover:scale-110",
              item.key === 'people' && "bg-gradient-to-br from-cyan-600/85 to-blue-700/85",
              item.key === 'posts' && "bg-gradient-to-br from-amber-600/85 to-orange-600/85",
              item.key === 'communities' && "bg-gradient-to-br from-emerald-600/85 to-teal-700/85"
            )}
            style={item.key === 'videos' ? { background: ARVDOUL_GRADIENT } : undefined}
          />
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
              {item.key === 'videos' ? (
                <Film className="w-6 h-6" aria-hidden="true" />
              ) : item.key === 'people' ? (
                <Users className="w-6 h-6" aria-hidden="true" />
              ) : item.key === 'posts' ? (
                <Flame className="w-6 h-6" aria-hidden="true" />
              ) : (
                <MessageSquare className="w-6 h-6" aria-hidden="true" />
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
            <h3 className="text-white font-bold text-sm">{item.title}</h3>
            <p className="text-white/70 text-xs mt-0.5">{item.subtitle}</p>
          </div>
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-arvdoul-purple/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
        </motion.button>
      ))}
    </div>
  </motion.div>
));

ForYouSection.displayName = 'ForYouSection';

/**
 * Explore Categories Grid
 */
const ExploreCategories = memo(({ onCategoryClick, isDark }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-6"
  >
    <h2 className={cn(
      'text-lg font-bold mb-4',
      isDark ? 'text-white' : 'text-gray-900'
    )}>
      Explore Categories
    </h2>
    <div className="grid grid-cols-4 gap-3">
      {CATEGORIES.map((category, index) => {
        const Icon = category.icon;
        return (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onCategoryClick(category.id)}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-2xl',
              'backdrop-blur-xl border border-white/10',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-arvdoul-purple/50',
              isDark 
                ? 'bg-white/5 hover:bg-white/10' 
                : 'bg-white/50 hover:bg-white/70',
            )}
            style={{
              boxShadow: isDark 
                ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
                : '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className={cn(
              'w-11 h-11 rounded-xl mb-2 flex items-center justify-center',
              'shadow-lg'
            )}
            style={{ background: ARVDOUL_GRADIENT }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className={cn(
              'text-[11px] font-semibold text-center leading-tight',
              isDark ? 'text-gray-200' : 'text-gray-700'
            )}>
              {category.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  </motion.div>
));

ExploreCategories.displayName = 'ExploreCategories';

export default SearchScreen;
