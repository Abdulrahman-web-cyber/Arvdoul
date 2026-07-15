/**
 * FilterTool.jsx - Professional Image Filter Component
 * @description Provides comprehensive filter presets with thumbnails, favorites, and search
 * @module Shared/FilterTool
 * @requires React, framer-motion, lucide-react, prop-types
 */

import React, { useState, useCallback, useMemo, useEffect, memo, useRef } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  SlidersHorizontal,
  Grid3x3,
  RotateCw,
  Image as ImageIcon,
} from "lucide-react";

// ARVDOUL Design System
const DNA_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
const DNA_SHADOW = '0 0 20px rgba(147,51,234,0.4)';

/**
 * Filter presets with metadata
 */
const FILTERS = [
  // Basic
  { id: 'original', name: 'Original', value: 'none', category: 'basic' },
  { id: 'grayscale', name: 'Grayscale', value: 'grayscale(100%)', category: 'basic' },
  { id: 'sepia', name: 'Sepia', value: 'sepia(80%)', category: 'basic' },
  { id: 'blur', name: 'Blur', value: 'blur(4px)', category: 'basic' },
  { id: 'bright', name: 'Bright', value: 'brightness(1.5)', category: 'basic' },
  { id: 'cool', name: 'Cool', value: 'hue-rotate(90deg) saturate(1.2)', category: 'basic' },
  { id: 'warm', name: 'Warm', value: 'hue-rotate(-30deg) saturate(1.3)', category: 'basic' },
  
  // Creative
  { id: 'vintage', name: 'Vintage', value: 'sepia(60%) contrast(1.1) brightness(0.9)', category: 'creative' },
  { id: 'noir', name: 'Noir', value: 'grayscale(100%) contrast(1.3)', category: 'creative' },
  { id: 'drama', name: 'Drama', value: 'contrast(1.5) saturate(1.5)', category: 'creative' },
  { id: 'soft', name: 'Soft', value: 'blur(1px) brightness(1.1) contrast(0.9)', category: 'creative' },
  { id: 'lomo', name: 'Lomo', value: 'saturate(1.5) contrast(1.2) brightness(0.9)', category: 'creative' },
  { id: 'cinematic', name: 'Cinematic', value: 'contrast(1.25) saturate(1.2) brightness(0.9) hue-rotate(5deg)', category: 'creative' },
  { id: 'fade', name: 'Fade', value: 'contrast(0.9) brightness(1.1) saturate(0.8)', category: 'creative' },
  
  // Other
  { id: 'vibrant', name: 'Vibrant', value: 'saturate(1.8) contrast(1.1)', category: 'other' },
  { id: 'moody', name: 'Moody', value: 'contrast(1.2) saturate(0.8) brightness(0.9)', category: 'other' },
  { id: 'nature', name: 'Nature', value: 'saturate(1.3) brightness(1.05) hue-rotate(-10deg)', category: 'other' },
  { id: 'portrait', name: 'Portrait', value: 'brightness(1.05) saturate(0.9) contrast(1.05)', category: 'other' },
  { id: 'food', name: 'Food', value: 'saturate(1.4) brightness(1.1) contrast(1.05)', category: 'other' },
  { id: 'urban', name: 'Urban', value: 'contrast(1.3) brightness(0.95) saturate(1.1)', category: 'other' },
];

const FILTER_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'basic', name: 'Basic' },
  { id: 'creative', name: 'Creative' },
  { id: 'other', name: 'Other' },
];

/**
 * Filter thumbnail component
 */
const FilterThumbnail = memo(({
  filter,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
  previewImage,
  thumbnailStyle,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative group"
    >
      <button
        onClick={onSelect}
        className={`
          relative w-full aspect-square rounded-2xl overflow-hidden transition-all duration-200
          ${isActive 
            ? 'ring-2 ring-transparent ring-offset-2 ring-offset-black' 
            : 'hover:ring-2 hover:ring-white/30'
          }
        `}
        style={{
          boxShadow: isActive ? `0 0 0 2px, ${DNA_SHADOW}` : 'none',
        }}
        aria-label={`Apply ${filter.name} filter`}
        aria-pressed={isActive}
      >
        {/* Filter preview */}
        <div
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: filter.value,
            backgroundColor: '#1a1a2e',
          }}
        />
        
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Filter name */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/80'}`}>
            {filter.name}
          </span>
        </div>
        
        {/* Active indicator */}
        {isActive && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center"
          >
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
        )}
      </button>
      
      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(filter.id);
        }}
        className={`
          absolute top-2 left-2 p-1.5 rounded-full transition-all duration-200
          ${isFavorite 
            ? 'bg-yellow-500/90 text-yellow-100' 
            : 'bg-black/40 text-white/60 opacity-0 group-hover:opacity-100 hover:bg-black/60'
          }
        `}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </motion.div>
  );
});

FilterThumbnail.displayName = 'FilterThumbnail';

FilterThumbnail.propTypes = {
  filter: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  isFavorite: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onToggleFavorite: PropTypes.func.isRequired,
  previewImage: PropTypes.string,
  thumbnailStyle: PropTypes.object,
};

/**
 * Main FilterTool component
 */
const FilterTool = memo(({
  filter,
  setFilter,
  filterIntensity,
  setFilterIntensity,
  pushUndo,
  favorites: externalFavorites = [],
  setFavorites,
  previewImage,
  // Legacy props support
  brightness,
  contrast,
  saturation,
  setBrightness,
  setContrast,
  setSaturation,
  adjustments = {},
  setAdjustment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavoritesInternal] = useState(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem('arvdoul_filter_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showIntensity, setShowIntensity] = useState(false);
  
  // Use external favorites if provided, otherwise use internal state
  const activeFavorites = externalFavorites.length > 0 ? externalFavorites : favorites;
  const setActiveFavorites = setFavorites || setFavoritesInternal;
  
  // Persist favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('arvdoul_filter_favorites', JSON.stringify(favorites));
    } catch (e) {
      // Ignore storage errors
    }
  }, [favorites]);

  // Determine which filters to show based on category and search
  const filteredFilters = useMemo(() => {
    return FILTERS.filter(f => {
      const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
      const matchesSearch = searchQuery === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Filters grouped by category
  const filtersByCategory = useMemo(() => {
    const grouped = {};
    FILTER_CATEGORIES.forEach(cat => {
      grouped[cat.id] = FILTERS.filter(f => 
        cat.id === 'all' || f.category === cat.id
      );
    });
    return grouped;
  }, []);

  const handleSelect = useCallback((filterItem) => {
    setFilter(filterItem.value);
    setShowIntensity(filterItem.value !== 'none');
    pushUndo?.();
  }, [setFilter, pushUndo]);

  const handleToggleFavorite = useCallback((filterId) => {
    setActiveFavorites(prev => {
      const newFavorites = prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId];
      return newFavorites;
    });
  }, [setActiveFavorites]);

  const isFavorite = useCallback((filterId) => {
    return activeFavorites.includes(filterId);
  }, [activeFavorites]);

  // Handle legacy props (backward compatibility)
  useEffect(() => {
    // If legacy props are provided, use them
    if (setAdjustment) {
      // Already handled through adjustments prop
    }
  }, [brightness, contrast, saturation]);

  return (
    <div className="w-full space-y-4 text-white">
      {/* Search and Category */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search filters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 text-sm outline-none focus:border-purple-500 transition-colors"
            aria-label="Search filters"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTER_CATEGORIES.map((category) => {
            const count = category.id === 'all' 
              ? FILTERS.length 
              : filtersByCategory[category.id]?.length || 0;
            
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200
                  ${activeCategory === category.id
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }
                `}
              >
                {category.name}
                <span className="ml-1.5 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorites section */}
      {favorites.length > 0 && activeCategory === 'all' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              Favorites
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {FILTERS.filter(f => isFavorite(f.id)).map((filterItem) => (
              <FilterThumbnail
                key={filterItem.id}
                filter={filterItem}
                isActive={filter === filterItem.value}
                isFavorite={true}
                onSelect={() => handleSelect(filterItem)}
                onToggleFavorite={handleToggleFavorite}
                previewImage={previewImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            {FILTER_CATEGORIES.find(c => c.id === activeCategory)?.name} Filters
          </span>
          <span className="text-xs text-white/40">
            {filteredFilters.length} filters
          </span>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {filteredFilters.map((filterItem) => (
            <FilterThumbnail
              key={filterItem.id}
              filter={filterItem}
              isActive={filter === filterItem.value}
              isFavorite={isFavorite(filterItem.id)}
              onSelect={() => handleSelect(filterItem)}
              onToggleFavorite={handleToggleFavorite}
              previewImage={previewImage}
            />
          ))}
        </div>
      </div>

      {/* Intensity slider */}
      <AnimatePresence>
        {filter !== 'none' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 pt-2 border-t border-white/10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-white/60" />
                <span className="text-xs font-medium text-white/80">Intensity</span>
              </div>
              <span className="text-xs text-white/50 tabular-nums">{filterIntensity}%</span>
            </div>
            
            <div className="relative h-8 flex items-center">
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${filterIntensity}%`,
                    background: DNA_GRADIENT,
                    boxShadow: DNA_SHADOW,
                  }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={filterIntensity}
                onChange={(e) => setFilterIntensity(Number(e.target.value))}
                onPointerUp={() => pushUndo?.()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Filter intensity"
              />
              {/* Custom thumb */}
              <div
                className="absolute w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none"
                style={{
                  left: `calc(${filterIntensity}% - 8px)`,
                  boxShadow: DNA_SHADOW,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filteredFilters.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ImageIcon className="w-12 h-12 text-white/20 mb-3" />
          <p className="text-sm text-white/50">No filters found</p>
          <p className="text-xs text-white/30 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
});

FilterTool.displayName = 'FilterTool';

FilterTool.propTypes = {
  /** Current filter CSS value */
  filter: PropTypes.string.isRequired,
  /** Function to set the filter */
  setFilter: PropTypes.func.isRequired,
  /** Filter intensity (0-100) */
  filterIntensity: PropTypes.number,
  /** Function to set filter intensity */
  setFilterIntensity: PropTypes.func,
  /** Function to push current state to history */
  pushUndo: PropTypes.func,
  /** Array of favorite filter IDs (external) */
  favorites: PropTypes.arrayOf(PropTypes.string),
  /** Function to set favorites (external) */
  setFavorites: PropTypes.func,
  /** Preview image URL for thumbnails */
  previewImage: PropTypes.string,
  // Legacy props support
  brightness: PropTypes.number,
  contrast: PropTypes.number,
  saturation: PropTypes.number,
  setBrightness: PropTypes.func,
  setContrast: PropTypes.func,
  setSaturation: PropTypes.func,
  /** Object containing all adjustment values */
  adjustments: PropTypes.objectOf(PropTypes.number),
  /** Function to update a single adjustment value */
  setAdjustment: PropTypes.func,
};

export default FilterTool;