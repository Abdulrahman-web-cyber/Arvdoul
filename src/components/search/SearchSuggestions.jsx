// src/components/search/SearchSuggestions.jsx - ARVDOUL Search Suggestions
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, TrendingUp, User, Video, FileText, Hash, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn, highlightText, getResultColor } from '../../lib/searchUtils';

/**
 * Search Suggestions Dropdown
 */
const SearchSuggestions = memo(({
  query,
  suggestions,
  recentSearches,
  onSelect,
  onRemoveRecent,
  visible,
  loading,
}) => {
  const { isDark, glass, spring, colors } = useTheme();
  const containerRef = useRef(null);
  const selectedIndexRef = useRef(-1);

  // Reset selection when suggestions change
  useEffect(() => {
    selectedIndexRef.current = -1;
  }, [suggestions]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const totalItems = suggestions.length + recentSearches.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndexRef.current = Math.min(selectedIndexRef.current + 1, totalItems - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndexRef.current >= 0) {
          const allItems = [...recentSearches, ...suggestions];
          const item = allItems[selectedIndexRef.current];
          if (item) {
            onSelect(item.text || item);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        onSelect(null, true);
        break;
    }
  }, [suggestions, recentSearches, onSelect]);

  // Attach keyboard listener
  useEffect(() => {
    const container = containerRef.current;
    if (container && visible) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  // Get icon for suggestion type
  const getSuggestionIcon = (type) => {
    const icons = {
      suggestion: Search,
      recent: Clock,
      trending: TrendingUp,
      user: User,
      video: Video,
      post: FileText,
      hashtag: Hash,
    };
    return icons[type] || Search;
  };

  if (!visible) return null;

  const allItems = [...recentSearches, ...suggestions];
  let currentIndex = -1;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={spring.card}
      id="search-suggestions"
      role="listbox"
      aria-label="Search suggestions"
      className={cn(
        'absolute left-0 right-0 top-full mt-3 z-50',
        'rounded-3xl overflow-hidden',
        'backdrop-blur-2xl bg-white/10 border border-white/15',
        'shadow-[0_25px_80px_rgba(138,43,226,0.45)]'
      )}
    >
      {/* Recent Searches */}
      {recentSearches.length > 0 && !query && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={cn(
              'text-sm font-semibold',
              isDark ? 'text-gray-400' : 'text-gray-600'
            )}>
              Recent Searches
            </span>
          </div>
          <div className="space-y-1">
            {recentSearches.map((item, idx) => {
              currentIndex++;
              const Icon = getSuggestionIcon(item.type || 'recent');
              return (
                <SuggestionItem
                  key={item.id || item}
                  item={item}
                  Icon={Icon}
                  isSelected={selectedIndexRef.current === currentIndex}
                  onSelect={onSelect}
                  onRemove={onRemoveRecent}
                  isDark={isDark}
                  showRemove
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className={cn(
          'p-4',
          recentSearches.length > 0 && 'border-t',
          isDark ? 'border-white/10' : 'border-gray-200/50'
        )}>
          {query && (
            <div className="flex items-center gap-2 mb-3">
              <Search className={cn('w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
              <span className={cn(
                'text-sm',
                isDark ? 'text-gray-400' : 'text-gray-600'
              )}>
                Suggestions for "{query}"
              </span>
            </div>
          )}
          <div className="space-y-1">
            {suggestions.map((item, idx) => {
              currentIndex++;
              const Icon = getSuggestionIcon(item.type);
              return (
                <SuggestionItem
                  key={item.id}
                  item={item}
                  Icon={Icon}
                  query={query}
                  isSelected={selectedIndexRef.current === currentIndex}
                  onSelect={onSelect}
                  isDark={isDark}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={cn(
          'p-4 border-t',
          isDark ? 'border-white/10' : 'border-gray-200/50'
        )}>
          <div className="flex items-center justify-center py-4">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2 h-2 rounded-full bg-gradient-to-r from-[#B416DB] to-[#4B6BFF]"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && suggestions.length === 0 && query && recentSearches.length === 0 && (
        <div className={cn(
          'p-8 text-center',
          isDark ? 'text-gray-400' : 'text-gray-600'
        )}>
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No suggestions found</p>
        </div>
      )}
    </motion.div>
  );
});

SearchSuggestions.displayName = 'SearchSuggestions';

/**
 * Individual Suggestion Item
 */
const SuggestionItem = memo(({
  item,
  Icon,
  query,
  isSelected,
  onSelect,
  onRemove,
  isDark,
  showRemove,
}) => {
  const text = item.text || item;
  const gradientClass = getResultColor(item.type);

  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(text)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50',
        isSelected
          ? isDark ? 'bg-white/10' : 'bg-gray-100'
          : 'hover:bg-white/5'
      )}
      role="option"
      aria-selected={isSelected}
    >
      {/* Icon */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        'bg-gradient-to-r ' + gradientClass
      )}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Text */}
      <span className={cn(
        'flex-1 text-left text-sm truncate',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        {query ? highlightText(text, query) : text}
      </span>

      {/* Remove Button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(text);
          }}
          className={cn(
            'p-1.5 rounded-full',
            'hover:bg-white/10 transition-colors',
            isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'
          )}
          aria-label={`Remove ${text} from recent searches`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.button>
  );
});

SuggestionItem.displayName = 'SuggestionItem';

export default SearchSuggestions;
