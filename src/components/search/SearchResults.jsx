// src/components/search/SearchResults.jsx - ARVDOUL Search Results
import React, { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { User, Video, FileText, Image, Users, Radio, Calendar, BarChart2, HelpCircle, Hash, Music, MapPin, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn, formatCount, getResultIcon, getResultColor } from '../../lib/searchUtils';
import ProfileAvatar from '../profile/ProfileAvatar';
import EmptyState from '../UI/EmptyState';
import LoadingSpinner from '../Shared/LoadingSpinner';

/**
 * Search Results Tabs
 */
const TABS = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'people', label: 'People', icon: User },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'polls', label: 'Polls', icon: BarChart2 },
  { id: 'questions', label: 'Questions', icon: HelpCircle },
  { id: 'hashtags', label: 'Hashtags', icon: Hash },
];

/**
 * Search Results Component
 */
const SearchResults = memo(({
  results = [],
  loading = false,
  hasMore = false,
  selectedTab = 'all',
  onTabChange,
  onLoadMore,
  onResultClick,
  query = '',
}) => {
  const { isDark, glass, spring, colors } = useTheme();

  // Infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    onChange: (inView) => {
      if (inView && hasMore && !loading) {
        onLoadMore?.();
      }
    },
  });

  // Filter results by tab
  const filteredResults = useMemo(() => {
    if (selectedTab === 'all') return results;
    return results.filter((result) => {
      const type = result.type?.toLowerCase();
      return type === selectedTab || type === selectedTab.slice(0, -1);
    });
  }, [results, selectedTab]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="sticky top-0 z-10 py-2 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full',
                  'whitespace-nowrap font-medium text-sm',
                  'transition-all duration-200',
                  isSelected
                    ? 'bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#4B6BFF] text-white shadow-lg'
                    : isDark
                      ? 'bg-white/8 text-gray-300 hover:bg-white/12'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {loading && results.length === 0 ? (
        <LoadingState isDark={isDark} />
      ) : filteredResults.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description={query ? `No results for "${query}"` : "Try a different search term"}
        />
      ) : (
        <div className="space-y-3">
          {filteredResults.map((result, index) => (
            <ResultCard
              key={result.id || result.objectID || index}
              result={result}
              index={index}
              onClick={() => onResultClick?.(result)}
              isDark={isDark}
            />
          ))}

          {/* Load More Trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {loading && <LoadingSpinner size={32} color="primary" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SearchResults.displayName = 'SearchResults';

/**
 * Result Card Component
 */
const ResultCard = memo(({ result, index, onClick, isDark }) => {
  const type = result.type?.toLowerCase() || 'post';
  const gradientClass = getResultColor(type);

  // Get content based on type
  const renderContent = () => {
    switch (type) {
      case 'user':
      case 'users':
        return <UserResult result={result} isDark={isDark} />;
      case 'video':
      case 'videos':
        return <VideoResult result={result} isDark={isDark} />;
      case 'post':
      case 'posts':
        return <PostResult result={result} isDark={isDark} />;
      case 'image':
      case 'images':
        return <ImageResult result={result} isDark={isDark} />;
      default:
        return <DefaultResult result={result} isDark={isDark} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'rounded-3xl overflow-hidden',
        'backdrop-blur-2xl bg-white/8 border border-white/12',
        'shadow-[0_25px_80px_rgba(138,43,226,0.25)]',
        'hover:shadow-[0_35px_100px_rgba(138,43,226,0.35)]',
        'cursor-pointer transition-shadow duration-300'
      )}
    >
      {renderContent()}
    </motion.div>
  );
});

ResultCard.displayName = 'ResultCard';

/**
 * User Result
 */
const UserResult = memo(({ result, isDark }) => (
  <div className="flex items-center gap-4 p-4">
    <ProfileAvatar
      src={result.photoURL || result.avatar}
      name={result.displayName || result.name}
      size={56}
      isVerified={result.isVerified}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className={cn(
          'font-semibold truncate',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          {result.displayName || result.name}
        </h3>
        {result.isVerified && (
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      <p className={cn(
        'text-sm truncate',
        isDark ? 'text-gray-400' : 'text-gray-500'
      )}>
        @{result.username}
      </p>
      {result.bio && (
        <p className={cn(
          'text-sm truncate mt-1',
          isDark ? 'text-gray-400' : 'text-gray-500'
        )}>
          {result.bio}
        </p>
      )}
      <p className={cn(
        'text-xs mt-1',
        isDark ? 'text-gray-500' : 'text-gray-400'
      )}>
        {formatCount(result.followers || result.followerCount || 0)} followers
      </p>
    </div>
  </div>
));

UserResult.displayName = 'UserResult';

/**
 * Video Result
 */
const VideoResult = memo(({ result, isDark }) => (
  <div className="flex gap-4 p-4">
    <div className="relative w-32 h-24 rounded-2xl overflow-hidden flex-shrink-0">
      {result.thumbnail || result.mediaUrl ? (
        <img
          src={result.thumbnail || result.mediaUrl}
          alt={result.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className={cn(
          'w-full h-full flex items-center justify-center',
          isDark ? 'bg-white/10' : 'bg-gray-200'
        )}>
          <Video className="w-8 h-8 text-gray-500" />
        </div>
      )}
      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
        {result.duration || '0:00'}
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <h3 className={cn(
        'font-semibold line-clamp-2',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        {result.title}
      </h3>
      <p className={cn(
        'text-sm mt-1',
        isDark ? 'text-gray-400' : 'text-gray-500'
      )}>
        {result.displayName || result.authorName}
      </p>
      <div className={cn(
        'flex items-center gap-3 text-xs mt-1',
        isDark ? 'text-gray-500' : 'text-gray-400'
      )}>
        <span>{formatCount(result.views || result.viewCount || 0)} views</span>
        <span>•</span>
        <span>{formatCount(result.likes || result.likeCount || 0)} likes</span>
      </div>
    </div>
  </div>
));

VideoResult.displayName = 'VideoResult';

/**
 * Post Result
 */
const PostResult = memo(({ result, isDark }) => (
  <div className="p-4">
    <div className="flex items-center gap-3 mb-3">
      <ProfileAvatar
        src={result.authorPhotoURL || result.photoURL}
        name={result.authorName || result.displayName}
        size={40}
      />
      <div>
        <p className={cn(
          'font-semibold text-sm',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          {result.authorName || result.displayName}
        </p>
        <p className={cn(
          'text-xs',
          isDark ? 'text-gray-500' : 'text-gray-400'
        )}>
          @{result.authorUsername || result.username}
        </p>
      </div>
    </div>
    <p className={cn(
      'text-sm line-clamp-3',
      isDark ? 'text-gray-300' : 'text-gray-700'
    )}>
      {result.content || result.text || result.body}
    </p>
    {result.mediaUrl && (
      <div className="mt-3 rounded-xl overflow-hidden">
        <img src={result.mediaUrl} alt="Post media" className="w-full h-48 object-cover" />
      </div>
    )}
    <div className={cn(
      'flex items-center gap-4 text-xs mt-3',
      isDark ? 'text-gray-500' : 'text-gray-400'
    )}>
      <span>{formatCount(result.likes || result.likeCount || 0)} likes</span>
      <span>{formatCount(result.comments || result.commentCount || 0)} comments</span>
      <span>{formatCount(result.shares || result.shareCount || 0)} shares</span>
    </div>
  </div>
));

PostResult.displayName = 'PostResult';

/**
 * Image Result
 */
const ImageResult = memo(({ result, isDark }) => (
  <div className="p-4">
    {result.mediaUrl || result.imageUrl ? (
      <img
        src={result.mediaUrl || result.imageUrl}
        alt={result.title || 'Image'}
        className="w-full rounded-xl object-cover max-h-64"
      />
    ) : (
      <div className={cn(
        'w-full h-48 rounded-xl flex items-center justify-center',
        isDark ? 'bg-white/10' : 'bg-gray-200'
      )}>
        <Image className="w-12 h-12 text-gray-500" />
      </div>
    )}
    {result.title && (
      <p className={cn(
        'text-sm mt-3 font-medium',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        {result.title}
      </p>
    )}
  </div>
));

ImageResult.displayName = 'ImageResult';

/**
 * Default Result
 */
const DefaultResult = memo(({ result, isDark }) => (
  <div className="p-4">
    <h3 className={cn(
      'font-semibold',
      isDark ? 'text-white' : 'text-gray-900'
    )}>
      {result.title || result.name || result.displayName}
    </h3>
    {result.description && (
      <p className={cn(
        'text-sm mt-1 line-clamp-2',
        isDark ? 'text-gray-400' : 'text-gray-500'
      )}>
        {result.description}
      </p>
    )}
  </div>
));

DefaultResult.displayName = 'DefaultResult';

/**
 * Loading State
 */
const LoadingState = memo(({ isDark }) => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={cn(
          'rounded-3xl p-4',
          'backdrop-blur-2xl bg-white/8 border border-white/12',
          'animate-pulse'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-14 h-14 rounded-full',
            isDark ? 'bg-white/10' : 'bg-gray-200'
          )} />
          <div className="flex-1">
            <div className={cn(
              'h-4 w-32 rounded mb-2',
              isDark ? 'bg-white/10' : 'bg-gray-200'
            )} />
            <div className={cn(
              'h-3 w-24 rounded',
              isDark ? 'bg-white/5' : 'bg-gray-100'
            )} />
          </div>
        </div>
      </div>
    ))}
  </div>
));

LoadingState.displayName = 'LoadingState';

export default SearchResults;
