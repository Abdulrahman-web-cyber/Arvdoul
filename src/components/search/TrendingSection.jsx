// src/components/search/TrendingSection.jsx - ARVDOUL Trending Section
import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Hash, Users, Eye, MessageCircle, Award } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn, formatCount } from '../../lib/searchUtils';
import ProfileAvatar from '../profile/ProfileAvatar';

/**
 * Trending Section Component
 */
const TrendingSection = memo(({
  type = 'hashtags',
  title = 'Trending Now',
  items = [],
  loading = false,
  onItemClick,
}) => {
  const { isDark, glass, spring, colors } = useTheme();

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'hashtags': return Hash;
      case 'creators': return Users;
      case 'videos': return Eye;
      case 'posts': return MessageCircle;
      default: return TrendingUp;
    }
  };

  const Icon = getIcon();

  return (
    <div className="mb-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          'w-10 h-10 rounded-2xl flex items-center justify-center',
          'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF]'
        )}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h2 className={cn(
          'text-xl font-bold',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          {title}
        </h2>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={spring.card}
        className={cn(
          'rounded-3xl overflow-hidden',
          'backdrop-blur-2xl bg-white/8 border border-white/12',
          'shadow-[0_25px_80px_rgba(138,43,226,0.45)]'
        )}
      >
        {loading ? (
          <LoadingSkeleton type={type} isDark={isDark} />
        ) : items.length === 0 ? (
          <EmptyTrend isDark={isDark} type={type} />
        ) : (
          <div className="divide-y divide-white/10">
            {items.map((item, index) => (
              <TrendingItem
                key={item.id || index}
                item={item}
                index={index}
                type={type}
                onClick={() => onItemClick?.(item)}
                isDark={isDark}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
});

TrendingSection.displayName = 'TrendingSection';

/**
 * Individual Trending Item
 */
const TrendingItem = memo(({ item, index, type, onClick, isDark }) => {
  const isTopThree = index < 3;

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 p-4',
        'transition-colors duration-150',
        'hover:bg-white/5',
        'focus:outline-none focus:ring-2 focus:ring-[#B416DB]/50'
      )}
    >
      {/* Rank Number */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        'font-bold text-sm',
        isTopThree
          ? 'bg-gradient-to-r from-[#B416DB] to-[#4B6BFF] text-white'
          : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'
      )}>
        {index + 1}
      </div>

      {/* Content */}
      {type === 'creators' ? (
        <CreatorContent item={item} isDark={isDark} />
      ) : type === 'hashtags' ? (
        <HashtagContent item={item} isDark={isDark} />
      ) : (
        <DefaultContent item={item} type={type} isDark={isDark} />
      )}

      {/* Arrow */}
      <svg
        className={cn(
          'w-5 h-5 ml-auto flex-shrink-0',
          isDark ? 'text-gray-500' : 'text-gray-400'
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </motion.button>
  );
});

TrendingItem.displayName = 'TrendingItem';

/**
 * Creator Content
 */
const CreatorContent = memo(({ item, isDark }) => (
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <ProfileAvatar
      src={item.photoURL || item.avatar}
      name={item.displayName || item.name}
      size={48}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-semibold truncate',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          {item.displayName || item.name}
        </span>
        {item.isVerified && (
          <Award className="w-4 h-4 text-blue-400 flex-shrink-0" />
        )}
      </div>
      <div className={cn(
        'flex items-center gap-2 text-xs',
        isDark ? 'text-gray-400' : 'text-gray-500'
      )}>
        <span>@{item.username}</span>
        <span>•</span>
        <span>{formatCount(item.followers || item.followerCount || 0)} followers</span>
      </div>
    </div>
  </div>
));

CreatorContent.displayName = 'CreatorContent';

/**
 * Hashtag Content
 */
const HashtagContent = memo(({ item, isDark }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <Hash className={cn(
        'w-4 h-4',
        'bg-gradient-to-r from-[#B416DB] to-[#4B6BFF] bg-clip-text text-transparent'
      )} />
      <span className={cn(
        'font-semibold',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        #{item.hashtag || item.label || item.name}
      </span>
    </div>
    <div className={cn(
      'text-xs mt-0.5',
      isDark ? 'text-gray-400' : 'text-gray-500'
    )}>
      {formatCount(item.count || item.postCount || 0)} posts
    </div>
  </div>
));

HashtagContent.displayName = 'HashtagContent';

/**
 * Default Content
 */
const DefaultContent = memo(({ item, type, isDark }) => (
  <div className="flex-1 min-w-0">
    <div className={cn(
      'font-semibold truncate',
      isDark ? 'text-white' : 'text-gray-900'
    )}>
      {item.title || item.name}
    </div>
    <div className={cn(
      'text-xs mt-0.5 flex items-center gap-2',
      isDark ? 'text-gray-400' : 'text-gray-500'
    )}>
      {type === 'videos' && (
        <>
          <Eye className="w-3 h-3" />
          <span>{formatCount(item.views || item.viewCount || 0)} views</span>
        </>
      )}
      {type === 'posts' && (
        <>
          <MessageCircle className="w-3 h-3" />
          <span>{formatCount(item.comments || item.commentCount || 0)} comments</span>
        </>
      )}
    </div>
  </div>
));

DefaultContent.displayName = 'DefaultContent';

/**
 * Loading Skeleton
 */
const LoadingSkeleton = memo(({ type, isDark }) => (
  <div className="p-4 space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <div className={cn(
          'w-8 h-8 rounded-full',
          isDark ? 'bg-white/10' : 'bg-gray-200'
        )} />
        {type === 'creators' ? (
          <>
            <div className={cn(
              'w-12 h-12 rounded-full',
              isDark ? 'bg-white/10' : 'bg-gray-200'
            )} />
            <div className="flex-1">
              <div className={cn(
                'h-4 w-32 rounded',
                isDark ? 'bg-white/10' : 'bg-gray-200'
              )} />
              <div className={cn(
                'h-3 w-24 rounded mt-2',
                isDark ? 'bg-white/5' : 'bg-gray-100'
              )} />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <div className={cn(
              'h-4 w-40 rounded',
              isDark ? 'bg-white/10' : 'bg-gray-200'
            )} />
            <div className={cn(
              'h-3 w-24 rounded mt-2',
              isDark ? 'bg-white/5' : 'bg-gray-100'
            )} />
          </div>
        )}
      </div>
    ))}
  </div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

/**
 * Empty Trend State
 */
const EmptyTrend = memo(({ isDark, type }) => (
  <div className={cn(
    'p-8 text-center',
    isDark ? 'text-gray-400' : 'text-gray-500'
  )}>
    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p className="text-sm">No trending {type} right now</p>
  </div>
));

EmptyTrend.displayName = 'EmptyTrend';

export default TrendingSection;
