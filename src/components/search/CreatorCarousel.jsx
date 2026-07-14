// src/components/search/CreatorCarousel.jsx - ARVDOUL Creator Carousel
import React, { memo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Award, Users } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn, formatCount } from '../../lib/searchUtils';
import ProfileAvatar from '../profile/ProfileAvatar';
import LoadingSpinner from '../Shared/LoadingSpinner';

/**
 * Creator Carousel Component
 */
const CreatorCarousel = memo(({
  creators = [],
  onFollow,
  onCreatorClick,
  loading = false,
  title = 'Recommended Creators',
}) => {
  const { isDark, glass, spring, colors } = useTheme();
  const scrollRef = useRef(null);

  // Scroll handlers
  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center',
            'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF]'
          )}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className={cn(
            'text-xl font-bold',
            isDark ? 'text-white' : 'text-gray-900'
          )}>
            {title}
          </h2>
        </div>

        {/* Navigation Arrows */}
        <div className="flex gap-2">
          <ArrowButton direction="left" onClick={scrollLeft} isDark={isDark} />
          <ArrowButton direction="right" onClick={scrollRight} isDark={isDark} />
        </div>
      </div>

      {/* Carousel Container */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading ? (
          <LoadingSkeleton isDark={isDark} />
        ) : creators.length === 0 ? (
          <EmptyCarousel isDark={isDark} />
        ) : (
          creators.map((creator, index) => (
            <CreatorCard
              key={creator.id || creator.uid || index}
              creator={creator}
              index={index}
              onFollow={onFollow}
              onClick={onCreatorClick}
              isDark={isDark}
            />
          ))
        )}
      </div>
    </div>
  );
});

CreatorCarousel.displayName = 'CreatorCarousel';

/**
 * Arrow Button Component
 */
const ArrowButton = memo(({ direction, onClick, isDark }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center',
      'backdrop-blur-md border border-white/20',
      isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white/70',
      'shadow-lg'
    )}
    aria-label={`Scroll ${direction}`}
  >
    <svg
      className={cn(
        'w-4 h-4',
        isDark ? 'text-white' : 'text-gray-700'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none' }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </motion.button>
));

ArrowButton.displayName = 'ArrowButton';

/**
 * Creator Card Component
 */
const CreatorCard = memo(({ creator, index, onFollow, onClick, isDark }) => {
  const handleFollow = useCallback((e) => {
    e.stopPropagation();
    onFollow?.(creator.id || creator.uid);
  }, [onFollow, creator]);

  const handleClick = useCallback(() => {
    onClick?.(creator);
  }, [onClick, creator]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={cn(
        'flex-shrink-0 w-[190px] h-[240px] rounded-3xl overflow-hidden',
        'backdrop-blur-2xl bg-white/8 border border-white/12',
        'shadow-[0_25px_80px_rgba(138,43,226,0.45)]',
        'snap-start cursor-pointer',
        'transition-shadow duration-300 hover:shadow-[0_35px_100px_rgba(138,43,226,0.55)]'
      )}
    >
      <div className="h-full flex flex-col p-4">
        {/* Avatar */}
        <div className="flex justify-center mb-3">
          <ProfileAvatar
            src={creator.photoURL || creator.avatar}
            name={creator.displayName || creator.name}
            size={72}
            isVerified={creator.isVerified}
          />
        </div>

        {/* Info */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h3 className={cn(
              'font-bold text-base truncate max-w-full',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              {creator.displayName || creator.name}
            </h3>
            {creator.isVerified && (
              <Award className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}
          </div>
          
          <p className={cn(
            'text-xs mb-2',
            isDark ? 'text-gray-400' : 'text-gray-500'
          )}>
            @{creator.username || 'username'}
          </p>
          
          <p className={cn(
            'text-xs',
            isDark ? 'text-gray-400' : 'text-gray-500'
          )}>
            {formatCount(creator.followers || creator.followerCount || 0)} followers
          </p>
        </div>

        {/* Follow Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleFollow}
          className={cn(
            'w-full py-2.5 rounded-full font-semibold text-sm',
            'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF]',
            'text-white shadow-lg',
            'hover:shadow-xl transition-shadow duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50'
          )}
        >
          {creator.isFollowing ? 'Following' : 'Follow'}
        </motion.button>
      </div>
    </motion.div>
  );
});

CreatorCard.displayName = 'CreatorCard';

/**
 * Loading Skeleton
 */
const LoadingSkeleton = memo(({ isDark }) => (
  <div className="flex gap-4">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className={cn(
          'flex-shrink-0 w-[190px] h-[240px] rounded-3xl',
          'backdrop-blur-2xl bg-white/8 border border-white/12',
          'animate-pulse'
        )}
      >
        <div className="h-full flex flex-col p-4 items-center">
          <div className={cn(
            'w-[72px] h-[72px] rounded-full mb-3',
            isDark ? 'bg-white/10' : 'bg-gray-200'
          )} />
          <div className={cn(
            'h-4 w-24 rounded mb-2',
            isDark ? 'bg-white/10' : 'bg-gray-200'
          )} />
          <div className={cn(
            'h-3 w-16 rounded mb-2',
            isDark ? 'bg-white/5' : 'bg-gray-100'
          )} />
          <div className={cn(
            'h-3 w-20 rounded mt-2',
            isDark ? 'bg-white/5' : 'bg-gray-100'
          )} />
          <div className={cn(
            'w-full h-10 rounded-full mt-auto',
            isDark ? 'bg-white/10' : 'bg-gray-200'
          )} />
        </div>
      </div>
    ))}
  </div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

/**
 * Empty State
 */
const EmptyCarousel = memo(({ isDark }) => (
  <div className={cn(
    'w-full py-12 text-center rounded-3xl',
    'backdrop-blur-2xl bg-white/8 border border-white/12'
  )}>
    <Users className={cn(
      'w-12 h-12 mx-auto mb-3',
      isDark ? 'text-gray-500' : 'text-gray-400'
    )} />
    <p className={cn(
      'text-sm',
      isDark ? 'text-gray-400' : 'text-gray-500'
    )}>
      No creators to recommend right now
    </p>
  </div>
));

EmptyCarousel.displayName = 'EmptyCarousel';

export default CreatorCarousel;
