/**
 * src/components/profile/ProfileMediaGrid.jsx - ARVDOUL Profile Media Grid Component
 * 
 * Grid display of user's media posts.
 * 
 * @component
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Image, Video, Play, Loader2 } from 'lucide-react';

/**
 * Format number
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * ProfileMediaGrid Component
 * @param {Object} props
 */
const ProfileMediaGrid = ({
  items = [],
  onItemPress,
  onLoadMore,
  hasMore = false,
  loading = false,
  theme = 'light',
  columns = 3,
}) => {
  const observerRef = useRef(null);
  const lastItemRef = useRef(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (hasMore && onLoadMore) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            onLoadMore();
          }
        },
        { threshold: 0.1 }
      );
      
      if (lastItemRef.current) {
        observerRef.current.observe(lastItemRef.current);
      }
      
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [hasMore, onLoadMore, loading]);

  const handleItemPress = useCallback((item) => {
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);

  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className={cn(
          'w-20 h-20 rounded-full',
          'bg-gray-100 dark:bg-gray-800',
          'flex items-center justify-center mb-4'
        )}>
          <Image className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          No Posts Yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
          Share your first post with the world!
        </p>
      </div>
    );
  }

  return (
    <div className="p-0.5">
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {items.map((item, index) => {
          const isLastItem = index === items.length - 1;
          const hasVideo = item.type === 'video' || item.media?.some(m => m.type === 'video');
          const likeCount = item.likeCount || item.likes || 0;
          const commentCount = item.commentCount || item.comments || 0;
          
          return (
            <div
              key={item.id || index}
              ref={isLastItem ? lastItemRef : null}
              className={cn(
                'relative aspect-square overflow-hidden',
                'bg-gray-100 dark:bg-gray-800',
                'cursor-pointer',
                'hover:opacity-90 transition-opacity',
                'group'
              )}
              onClick={() => handleItemPress(item)}
            >
              {/* Media */}
              {item.media?.[0]?.url || item.thumbnail || item.mediaUrl ? (
                <img
                  src={item.media?.[0]?.url || item.thumbnail || item.mediaUrl}
                  alt={item.content || 'Post'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <span className="text-4xl opacity-50">
                    {item.type === 'text' ? '📝' : item.type === 'poll' ? '📊' : '📷'}
                  </span>
                </div>
              )}
              
              {/* Video Indicator */}
              {hasVideo && (
                <div className="absolute top-2 left-2">
                  <div className={cn(
                    'w-6 h-6 rounded-full',
                    'bg-black/50',
                    'flex items-center justify-center'
                  )}>
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
              )}
              
              {/* Multi-media Indicator */}
              {item.media?.length > 1 && (
                <div className="absolute top-2 right-2">
                  <div className={cn(
                    'w-6 h-6 rounded-full',
                    'bg-black/50',
                    'flex items-center justify-center'
                  )}>
                    <span className="text-white text-xs font-bold">
                      {item.media.length}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Stats Overlay */}
              <div className={cn(
                'absolute inset-0',
                'bg-gradient-to-t from-black/60 via-transparent to-transparent',
                'opacity-0 group-hover:opacity-100',
                'transition-opacity',
                'flex items-end justify-center pb-3 gap-4'
              )}>
                <span className="flex items-center gap-1 text-white text-sm font-medium">
                  <span>❤️</span>
                  {formatNumber(likeCount)}
                </span>
                <span className="flex items-center gap-1 text-white text-sm font-medium">
                  <span>💬</span>
                  {formatNumber(commentCount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      )}
      
      {/* Load More Trigger */}
      {hasMore && !loading && (
        <div ref={lastItemRef} className="h-10" />
      )}
    </div>
  );
};

export default memo(ProfileMediaGrid);
