/**
 * src/components/profile/ProfileHighlights.jsx - ARVDOUL Profile Highlights Component
 * 
 * Displays user's story highlights in a horizontal scrollable list.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Plus, ChevronRight } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

/**
 * ProfileHighlights Component
 * @param {Object} props
 */
const ProfileHighlights = ({
  highlights = [],
  isOwner = false,
  onHighlightPress,
  onAddHighlight,
  theme = 'light',
}) => {
  const handlePress = useCallback((highlight) => {
    if (onHighlightPress) {
      onHighlightPress(highlight);
    }
  }, [onHighlightPress]);

  const handleAdd = useCallback(() => {
    if (onAddHighlight) {
      onAddHighlight();
    }
  }, [onAddHighlight]);

  if (isOwner && highlights.length === 0) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Highlight Button */}
          <button
            onClick={handleAdd}
            className={cn(
              'flex flex-col items-center gap-1',
              'min-w-[70px]',
              'group'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-full',
              'border-2 border-dashed border-gray-300 dark:border-gray-600',
              'flex items-center justify-center',
              'group-hover:border-purple-500 transition-colors',
              'bg-gray-50 dark:bg-gray-800/50'
            )}>
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-500 transition-colors" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
              New Highlight
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Highlights */}
        {highlights.map((highlight) => (
          <button
            key={highlight.id}
            onClick={() => handlePress(highlight)}
            className={cn(
              'flex flex-col items-center gap-1',
              'min-w-[70px]',
              'group flex-shrink-0'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-full p-0.5',
              'bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500'
            )}>
              <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-900">
                {highlight.coverUrl ? (
                  <img
                    src={highlight.coverUrl}
                    alt={highlight.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <span className="text-2xl">{highlight.emoji || '📚'}</span>
                  </div>
                )}
              </div>
            </div>
            <span className={cn(
              'text-xs text-center',
              'text-gray-700 dark:text-gray-300',
              'group-hover:text-purple-600 dark:group-hover:text-purple-400',
              'transition-colors',
              'max-w-[70px] truncate'
            )}>
              {highlight.title}
            </span>
          </button>
        ))}
        
        {/* Add More (Owner) */}
        {isOwner && (
          <button
            onClick={handleAdd}
            className={cn(
              'flex flex-col items-center gap-1',
              'min-w-[70px]',
              'group flex-shrink-0'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-full',
              'border-2 border-dashed border-gray-300 dark:border-gray-600',
              'flex items-center justify-center',
              'group-hover:border-purple-500 transition-colors',
              'bg-gray-50 dark:bg-gray-800/50'
            )}>
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-500 transition-colors" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Add
            </span>
          </button>
        )}
        
        {/* View All (Non-owner) */}
        {highlights.length > 5 && (
          <button
            className={cn(
              'flex flex-col items-center gap-1',
              'min-w-[70px]',
              'group flex-shrink-0'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-full',
              'bg-gray-100 dark:bg-gray-800',
              'flex items-center justify-center',
              'group-hover:bg-gray-200 dark:group-hover:bg-gray-700',
              'transition-colors'
            )}>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
              View All
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(ProfileHighlights);
