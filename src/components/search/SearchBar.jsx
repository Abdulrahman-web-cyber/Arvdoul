// src/components/search/SearchBar.jsx - ARVDOUL Premium Search Bar
import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Mic, QrCode, SlidersHorizontal, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

/**
 * Premium floating search bar with ARVDOUL design
 */
const SearchBar = memo(({
  value,
  onChange,
  onSearch,
  onVoiceSearch,
  onQRScan,
  onFilters,
  isFocused,
  onFocus,
  onBlur,
  placeholder = 'Search Arvdoul...',
  className = '',
}) => {
  const { isDark, glass, spring, gradient, colors } = useTheme();

  // Handle input change
  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  // Handle key press
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      onSearch?.(value);
    }
  }, [onSearch, value]);

  // Handle clear
  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  // Handle voice search
  const handleVoiceSearch = useCallback(() => {
    onVoiceSearch?.();
  }, [onVoiceSearch]);

  // Handle QR scan
  const handleQRScan = useCallback(() => {
    onQRScan?.();
  }, [onQRScan]);

  // Handle filters
  const handleFilters = useCallback(() => {
    onFilters?.();
  }, [onFilters]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.card}
      className={cn('relative', className)}
    >
      {/* Search Bar Container */}
      <motion.div
        animate={{
          scale: isFocused ? 1.02 : 1,
          boxShadow: isFocused
            ? '0 0 0 3px rgba(180, 22, 219, 0.3), 0 25px 80px rgba(138, 43, 226, 0.45)'
            : '0 25px 80px rgba(138, 43, 226, 0.25)',
        }}
        transition={spring.button}
        className={cn(
          'relative h-[60px] rounded-full overflow-hidden',
          'backdrop-blur-[28px] bg-white/8 border border-white/12',
          'flex items-center px-5 gap-3',
          isDark ? 'shadow-[0_25px_80px_rgba(138,43,226,0.45)]' : 'shadow-lg'
        )}
      >
        {/* Search Icon */}
        <div className="flex-shrink-0">
          <Search 
            className={cn(
              'w-6 h-6 transition-colors duration-200',
              isFocused ? 'text-[#B416DB]' : 'text-gray-400'
            )} 
          />
        </div>

        {/* Input Field */}
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          role="search"
          aria-label="Search Arvdoul"
          aria-controls="search-suggestions"
          className={cn(
            'flex-1 h-full bg-transparent outline-none',
            'text-base placeholder:text-gray-500',
            isDark ? 'text-white' : 'text-gray-900'
          )}
        />

        {/* Clear Button */}
        {value && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={handleClear}
            className={cn(
              'flex-shrink-0 p-1.5 rounded-full',
              'hover:bg-white/10 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50'
            )}
            aria-label="Clear search"
          >
            <X className="w-5 h-5 text-gray-400" />
          </motion.button>
        )}

        {/* Divider */}
        <div className={cn(
          'w-px h-8',
          isDark ? 'bg-white/20' : 'bg-gray-300/50'
        )} />

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Voice Search */}
          <ActionButton
            icon={Mic}
            label="Voice search"
            onClick={handleVoiceSearch}
            isDark={isDark}
          />

          {/* QR Scanner */}
          <ActionButton
            icon={QrCode}
            label="Scan QR code"
            onClick={handleQRScan}
            isDark={isDark}
          />

          {/* Filters */}
          <ActionButton
            icon={SlidersHorizontal}
            label="Search filters"
            onClick={handleFilters}
            isDark={isDark}
            highlight={isFocused}
          />
        </div>

        {/* Gradient Focus Ring */}
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: gradient,
              opacity: 0.1,
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
});

SearchBar.displayName = 'SearchBar';

/**
 * Action Button Component
 */
const ActionButton = memo(({ icon: Icon, label, onClick, isDark, highlight }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      'relative p-2.5 rounded-full transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50',
      highlight
        ? 'bg-gradient-to-r from-[#B416DB]/20 to-[#4B6BFF]/20'
        : 'hover:bg-white/10'
    )}
    aria-label={label}
    title={label}
  >
    <Icon 
      className={cn(
        'w-5 h-5 transition-colors duration-200',
        highlight
          ? 'text-[#B416DB]'
          : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
      )} 
    />
  </motion.button>
));

ActionButton.displayName = 'ActionButton';

export default SearchBar;
