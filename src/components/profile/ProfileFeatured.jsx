/**
 * src/components/profile/ProfileFeatured.jsx - ARVDOUL Profile Featured Component
 * 
 * Displays featured content section on profile.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Star, Award, TrendingUp, ChevronRight } from 'lucide-react';

/**
 * ProfileFeatured Component
 * @param {Object} props
 */
const ProfileFeatured = ({
  featured = [],
  title = 'Featured',
  isOwner = false,
  onItemPress,
  onAddFeatured,
  theme = 'light',
}) => {
  const handlePress = useCallback((item) => {
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);

  const handleAdd = useCallback(() => {
    if (onAddFeatured) {
      onAddFeatured();
    }
  }, [onAddFeatured]);

  if (featured.length === 0 && !isOwner) {
    return null;
  }

  return (
    <div className={cn(
      'py-4',
      'border-t border-gray-100 dark:border-gray-800'
    )}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          {title}
        </h3>
        {isOwner && (
          <button
            onClick={handleAdd}
            className={cn(
              'text-sm text-purple-600 dark:text-purple-400',
              'hover:underline'
            )}
          >
            Add
          </button>
        )}
      </div>
      
      {featured.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isOwner ? 'Add featured content to showcase your best work.' : 'No featured content yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {featured.map((item) => (
            <button
              key={item.id}
              onClick={() => handlePress(item)}
              className={cn(
                'w-full p-3 rounded-xl',
                'bg-gray-50 dark:bg-gray-800/50',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors',
                'flex items-center gap-3 text-left'
              )}
            >
              {item.thumbnail && (
                <div className={cn(
                  'w-16 h-16 rounded-lg overflow-hidden flex-shrink-0',
                  'bg-gray-200 dark:bg-gray-700'
                )}>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {item.title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {item.subtitle}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {item.badge && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      'bg-yellow-100 dark:bg-yellow-900/30',
                      'text-yellow-700 dark:text-yellow-400'
                    )}>
                      {item.badge}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {item.views || 0} views
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ProfileFeatured);
