// src/components/search/SearchFilters.jsx - ARVDOUL Search Filters Modal
import React, { memo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

/**
 * Search Filters Modal Component
 */
const SearchFilters = memo(({
  visible,
  onClose,
  onApply,
  filters,
  onReset,
}) => {
  const { isDark, glass, spring, colors } = useTheme();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (visible) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [visible, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  const handleApply = useCallback(() => {
    onApply?.(filters);
    onClose?.();
  }, [filters, onApply, onClose]);

  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.bottomSheet}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'rounded-t-[32px] overflow-hidden',
              'backdrop-blur-2xl bg-white/10 border border-white/15',
              'shadow-[0_-25px_80px_rgba(138,43,226,0.45)]'
            )}
            style={{ maxHeight: '85vh' }}
          >
            {/* Header */}
            <div className={cn(
              'flex items-center justify-between p-5',
              'border-b',
              isDark ? 'border-white/10' : 'border-gray-200/50'
            )}>
              <h2 className={cn(
                'text-xl font-bold',
                isDark ? 'text-white' : 'text-gray-900'
              )}>
                Search Filters
              </h2>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  className={cn(
                    'p-2 rounded-full',
                    'hover:bg-white/10 transition-colors',
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  )}
                  aria-label="Reset filters"
                >
                  <RotateCcw className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className={cn(
                    'p-2 rounded-full',
                    'hover:bg-white/10 transition-colors',
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  )}
                  aria-label="Close filters"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div 
              className="overflow-y-auto p-5 space-y-6"
              style={{ maxHeight: 'calc(85vh - 180px)' }}
            >
              {/* Content Type */}
              <FilterSection title="Content Type" isDark={isDark}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'people', label: 'People' },
                    { value: 'posts', label: 'Posts' },
                    { value: 'videos', label: 'Videos' },
                    { value: 'images', label: 'Images' },
                    { value: 'communities', label: 'Communities' },
                    { value: 'live', label: 'Live' },
                    { value: 'events', label: 'Events' },
                    { value: 'polls', label: 'Polls' },
                    { value: 'questions', label: 'Questions' },
                    { value: 'hashtags', label: 'Hashtags' },
                  ].map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      selected={filters.contentType === option.value}
                      onClick={() => onApply?.({ ...filters, contentType: option.value })}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Date Range */}
              <FilterSection title="Date" isDark={isDark}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'any', label: 'Any Time' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'year', label: 'This Year' },
                  ].map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      selected={filters.date === option.value}
                      onClick={() => onApply?.({ ...filters, date: option.value })}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Sort By */}
              <FilterSection title="Sort By" isDark={isDark}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'relevance', label: 'Relevance' },
                    { value: 'newest', label: 'Newest' },
                    { value: 'oldest', label: 'Oldest' },
                    { value: 'popular', label: 'Most Liked' },
                    { value: 'viewed', label: 'Most Viewed' },
                    { value: 'commented', label: 'Most Comments' },
                  ].map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      selected={filters.sortBy === option.value}
                      onClick={() => onApply?.({ ...filters, sortBy: option.value })}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Verified Only */}
              <FilterSection title="User Type" isDark={isDark}>
                <div className="flex gap-3">
                  <FilterChip
                    label="All Users"
                    selected={!filters.verifiedOnly}
                    onClick={() => onApply?.({ ...filters, verifiedOnly: false })}
                    isDark={isDark}
                  />
                  <FilterChip
                    label="Verified Only"
                    selected={filters.verifiedOnly}
                    onClick={() => onApply?.({ ...filters, verifiedOnly: true })}
                    isDark={isDark}
                  />
                </div>
              </FilterSection>
            </div>

            {/* Footer */}
            <div className={cn(
              'flex gap-3 p-5',
              'border-t',
              isDark ? 'border-white/10' : 'border-gray-200/50'
            )}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                className={cn(
                  'flex-1 py-3.5 rounded-full font-semibold',
                  'backdrop-blur-md border border-white/20',
                  isDark ? 'bg-white/10 text-white' : 'bg-white/50 text-gray-900',
                  'hover:bg-white/15 transition-colors'
                )}
              >
                Reset
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApply}
                className={cn(
                  'flex-1 py-3.5 rounded-full font-semibold',
                  'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF]',
                  'text-white shadow-lg',
                  'hover:shadow-xl transition-shadow'
                )}
              >
                Apply Filters
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

SearchFilters.displayName = 'SearchFilters';

/**
 * Filter Section Component
 */
const FilterSection = memo(({ title, children, isDark }) => (
  <div>
    <h3 className={cn(
      'text-sm font-semibold mb-3',
      isDark ? 'text-gray-300' : 'text-gray-700'
    )}>
      {title}
    </h3>
    {children}
  </div>
));

FilterSection.displayName = 'FilterSection';

/**
 * Filter Chip Component
 */
const FilterChip = memo(({ label, selected, onClick, isDark }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      'h-[44px] px-5 rounded-full font-medium text-sm',
      'flex items-center gap-2',
      'transition-all duration-200',
      selected
        ? 'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF] text-white shadow-lg'
        : isDark
          ? 'backdrop-blur-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
          : 'backdrop-blur-xl border border-gray-200 bg-white/50 text-gray-700 hover:bg-white/70'
    )}
  >
    {selected && <Check className="w-4 h-4" />}
    {label}
  </motion.button>
));

FilterChip.displayName = 'FilterChip';

export default SearchFilters;
