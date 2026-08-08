// src/components/search/SearchBar.jsx - ARVDOUL Premium Search Bar
// Pixel-perfect design with ARVDOUL DNA gradient and glassmorphism
import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Mic, QrCode, SlidersHorizontal, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

/**
 * ARVDOUL Design Tokens
 */
const ARVDOUL_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';

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
  const { isDark, spring, gradient } = useTheme();

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
          scale: isFocused ? 1.01 : 1,
        }}
        transition={spring.button}
        className={cn(
          'relative h-[60px] rounded-full overflow-hidden',
          'backdrop-blur-[28px] border',
          'flex items-center px-5 gap-3',
          isDark 
            ? 'bg-white/[0.08] border-white/[0.12]' 
            : 'bg-white/80 border-gray-200/50',
        )}
        style={{
          boxShadow: isFocused 
            ? `0 0 0 3px rgba(180, 22, 219, 0.3), 0 25px 80px rgba(138, 43, 226, 0.4)`
            : isDark
              ? '0 25px 80px rgba(138, 43, 226, 0.35)'
              : '0 10px 40px rgba(138, 43, 226, 0.15)',
        }}
      >
        {/* Search Icon with Gradient Background */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          'transition-all duration-300'
        )}
        style={{
          background: isFocused ? ARVDOUL_GRADIENT : 'rgba(180, 22, 219, 0.1)',
        }}
        >
          <Search 
            className={cn(
              'w-5 h-5 transition-all duration-300',
              isFocused ? 'text-white' : 'text-[#B416DB]'
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
            'text-base placeholder:text-gray-400 font-medium',
            isDark ? 'text-white' : 'text-gray-900'
          )}
        />

        {/* Clear Button */}
        {value && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClear}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full',
              'flex items-center justify-center',
              'bg-gray-500/20 hover:bg-red-500/30 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50'
            )}
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </motion.button>
        )}

        {/* Divider */}
        <div className={cn(
          'w-px h-8 flex-shrink-0',
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
            isActive={false}
          />

          {/* QR Scanner */}
          <ActionButton
            icon={QrCode}
            label="Scan QR code"
            onClick={handleQRScan}
            isDark={isDark}
            isActive={false}
          />

          {/* Filters */}
          <ActionButton
            icon={SlidersHorizontal}
            label="Search filters"
            onClick={handleFilters}
            isDark={isDark}
            isActive={isFocused}
          />
        </div>

        {/* Gradient Glow on Focus */}
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full pointer-events-none -z-10"
            style={{
              background: ARVDOUL_GRADIENT,
              filter: 'blur(20px)',
              opacity: 0.15,
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
const ActionButton = memo(({ icon: Icon, label, onClick, isDark, isActive }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={cn(
      'relative p-2 rounded-xl transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50',
      isActive
        ? 'bg-gradient-to-r from-[#B416DB]/20 to-[#4B6BFF]/20'
        : 'hover:bg-white/10'
    )}
    aria-label={label}
    title={label}
  >
    <Icon 
      className={cn(
        'w-5 h-5 transition-all duration-200',
        isActive
          ? 'text-[#B416DB]'
          : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
      )} 
    />
    {isActive && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute inset-0 rounded-xl -z-10"
        style={{
          background: ARVDOUL_GRADIENT,
          opacity: 0.2,
        }}
      />
    )}
  </motion.button>
));

ActionButton.displayName = 'ActionButton';

export default SearchBar;
