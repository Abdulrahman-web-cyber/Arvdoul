/**
 * src/components/profile/ProfileMediaGrid.jsx - ARVDOUL Profile Media Grid Component
 * 
 * Grid display for profile media items with lazy loading.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileMediaGridProps
 * @property {Array} [items=[]] - Media items
 * @property {Function} [onItemPress] - Item press handler
 * @property {Function} [onLoadMore] - Load more handler
 * @property {boolean} [hasMore=false] - Has more items
 * @property {boolean} [loading=false] - Loading state
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Image, Video, Heart, MessageCircle, Loader2 } from 'lucide-react';

/**
 * ProfileMediaGrid Component
 * @type {React.FC<ProfileMediaGridProps>}
 */
const ProfileMediaGrid = memo(({
  items = [],
  onItemPress,
  onLoadMore,
  hasMore = false,
  loading = false,
  theme = 'light',
}) => {
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  
  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, onLoadMore]);
  
  // Handle item click
  const handleItemClick = useCallback((item) => {
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);
  
  // Get media type icon
  const getMediaIcon = (item) => {
    if (item.type === 'video' || item.hasVideo) {
      return <Video className="w-4 h-4" />;
    }
    return <Image className="w-4 h-4" />;
  };
  
  // Calculate grid columns
  const gridCols = 'grid-cols-3';
  
  return (
    <div className="p-1">
      <div className={cn('grid', gridCols, 'gap-1')}>
        {items.map((item, index) => (
          <button
            key={item.id || index}
            onClick={() => handleItemClick(item)}
            className={cn(
              'relative aspect-square rounded-lg overflow-hidden',
              'bg-gray-100 dark:bg-gray-800',
              'transition-all duration-200',
              'hover:scale-105 active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
            )}
            aria-label={`Post by ${item.authorName || 'user'}`}
          >
            {/* Media */}
            {item.mediaUrl ? (
              <img
                src={item.mediaUrl}
                alt={item.caption || 'Post image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : item.type === 'text' ? (
              <div className="w-full h-full flex items-center justify-center p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 text-center">
                  {item.text || item.caption || ''}
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            {/* Video indicator */}
            {(item.type === 'video' || item.hasVideo) && (
              <div className="absolute top-2 left-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center',
                  'bg-black/50 backdrop-blur-sm'
                )}>
                  <Video className="w-3 h-3 text-white" />
                </div>
              </div>
            )}
            
            {/* Stats overlay */}
            {(item.likeCount > 0 || item.commentCount > 0) && (
              <div className={cn(
                'absolute inset-x-0 bottom-0',
                'flex items-center justify-center gap-3 p-2',
                'bg-gradient-to-t from-black/70 to-transparent',
                'opacity-0 hover:opacity-100 transition-opacity'
              )}>
                <span className="flex items-center gap-1 text-white text-xs font-medium">
                  <Heart className="w-3 h-3" />
                  {item.likeCount || 0}
                </span>
                <span className="flex items-center gap-1 text-white text-xs font-medium">
                  <MessageCircle className="w-3 h-3" />
                  {item.commentCount || 0}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
      
      {/* Load more trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className="flex items-center justify-center py-4"
        >
          {loading && (
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          )}
        </div>
      )}
    </div>
  );
});

ProfileMediaGrid.displayName = 'ProfileMediaGrid';

export default ProfileMediaGrid;
