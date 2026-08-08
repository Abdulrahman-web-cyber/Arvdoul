/**
 * src/components/profile/ProfileFeatured.jsx - ARVDOUL Profile Featured Component
 * 
 * Displays featured/pinned posts in horizontal scroll.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileFeaturedProps
 * @property {Array} [items=[]] - Featured posts
 * @property {Function} [onItemPress] - Item press handler
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Pin } from 'lucide-react';

/**
 * ProfileFeatured Component
 * @type {React.FC<ProfileFeaturedProps>}
 */
const ProfileFeatured = memo(({
  items = [],
  onItemPress,
  theme = 'light',
}) => {
  const handleItemClick = useCallback((item) => {
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);
  
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div className="py-4">
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={cn(
              'relative flex-shrink-0 w-32 rounded-xl overflow-hidden',
              'bg-gray-100 dark:bg-gray-800',
              'shadow-lg hover:shadow-xl',
              'transition-all duration-200 hover:scale-105 active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-purple-500'
            )}
          >
            {item.mediaUrl ? (
              <img
                src={item.mediaUrl}
                alt={item.caption || 'Featured post'}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-4xl">{item.emoji || '📌'}</span>
              </div>
            )}
            <Pin className="absolute top-2 left-2 w-4 h-4 text-white drop-shadow-lg" />
          </button>
        ))}
      </div>
    </div>
  );
});

ProfileFeatured.displayName = 'ProfileFeatured';

export default ProfileFeatured;
