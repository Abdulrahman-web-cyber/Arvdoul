/**
 * src/components/profile/ProfileMutualFriends.jsx - ARVDOUL Profile Mutual Friends Component
 * 
 * Shows mutual friends with avatar chips.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileMutualFriendsProps
 * @property {Array} [mutualFriends=[]] - Mutual friends list
 * @property {Function} [onFriendPress] - Friend click handler
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Users } from 'lucide-react';

/**
 * Get initials from name
 * @param {string} name - Display name
 * @returns {string} Initials
 */
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * ProfileMutualFriends Component
 * @type {React.FC<ProfileMutualFriendsProps>}
 */
const ProfileMutualFriends = memo(({
  mutualFriends = [],
  onFriendPress,
  theme = 'light',
}) => {
  // Handle friend click
  const handleFriendClick = useCallback((friend) => {
    if (onFriendPress) {
      onFriendPress(friend);
    }
  }, [onFriendPress]);
  
  // Show max 5 friends
  const visibleFriends = mutualFriends.slice(0, 5);
  const remainingCount = Math.max(0, mutualFriends.length - 5);
  
  if (mutualFriends.length === 0) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        'p-3 rounded-xl',
        theme === 'dark' 
          ? 'bg-gray-800/50 backdrop-blur-xl border border-gray-700/50' 
          : 'bg-white/80 backdrop-blur-xl border border-gray-200/50',
        'shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
      )}
      role="list"
      aria-label="Mutual friends"
    >
      <div className="flex items-center gap-3">
        {/* Avatar Stack */}
        <div className="flex items-center -space-x-2">
          {visibleFriends.map((friend, index) => (
            <button
              key={friend.id || index}
              onClick={() => handleFriendClick(friend)}
              className={cn(
                'relative w-10 h-10 rounded-full overflow-hidden',
                'ring-2 ring-white dark:ring-gray-900',
                'hover:ring-purple-500 hover:scale-110',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
              )}
              aria-label={`${friend.displayName || friend.name || 'User'}'s profile`}
              style={{ zIndex: visibleFriends.length - index }}
            >
              {friend.photoURL ? (
                <img
                  src={friend.photoURL}
                  alt={friend.displayName || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {getInitials(friend.displayName || friend.name)}
                  </span>
                </div>
              )}
            </button>
          ))}
          
          {/* Remaining count indicator */}
          {remainingCount > 0 && (
            <div 
              className={cn(
                'relative w-10 h-10 rounded-full',
                'bg-gray-200 dark:bg-gray-700',
                'flex items-center justify-center',
                'ring-2 ring-white dark:ring-gray-900'
              )}
              style={{ zIndex: 0 }}
            >
              <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>
        
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">
              {mutualFriends.length}
            </span>{' '}
            mutual friends
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
            {visibleFriends.map(f => f.displayName || f.name || 'User').join(', ')}
            {remainingCount > 0 && ` +${remainingCount} more`}
          </p>
        </div>
      </div>
    </div>
  );
});

ProfileMutualFriends.displayName = 'ProfileMutualFriends';

export default ProfileMutualFriends;
