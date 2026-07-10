/**
 * src/components/profile/ProfileMutualFriends.jsx - ARVDOUL Profile Mutual Friends Component
 * 
 * Displays mutual friends between users.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Users, ChevronRight } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

/**
 * ProfileMutualFriends Component
 * @param {Object} props
 */
const ProfileMutualFriends = ({
  mutualFriends = [],
  loading = false,
  onFriendPress,
  onViewAll,
  theme = 'light',
  maxVisible = 5,
}) => {
  const navigate = useNavigate();
  
  const handleFriendPress = useCallback((friend) => {
    if (onFriendPress) {
      onFriendPress(friend);
    } else if (friend.id) {
      navigate(`/profile/${friend.id}`);
    }
  }, [onFriendPress, navigate]);

  const handleViewAll = useCallback(() => {
    if (onViewAll) {
      onViewAll();
    }
  }, [onViewAll]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Users className="w-4 h-4 text-gray-400" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (mutualFriends.length === 0) {
    return null;
  }

  const visibleFriends = mutualFriends.slice(0, maxVisible);

  return (
    <div className={cn(
      'flex items-center gap-2 py-3',
      'border-t border-gray-100 dark:border-gray-800'
    )}>
      <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
      
      <div className="flex items-center gap-1">
        {visibleFriends.map((friend, index) => (
          <button
            key={friend.id || index}
            onClick={() => handleFriendPress(friend)}
            className="relative -ml-2 first:ml-0"
          >
            <div className={cn(
              'w-8 h-8 rounded-full border-2 border-white dark:border-gray-900',
              'overflow-hidden',
              'hover:scale-110 transition-transform'
            )}>
              {friend.photoURL ? (
                <img
                  src={friend.photoURL}
                  alt={friend.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {(friend.displayName || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      
      <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
        {mutualFriends.length === 1
          ? `${mutualFriends[0].displayName || 'Someone'} is also followed`
          : `${mutualFriends.length} mutual friends`}
      </span>
      
      {mutualFriends.length > maxVisible && (
        <button
          onClick={handleViewAll}
          className={cn(
            'ml-auto text-sm font-medium',
            'text-purple-600 dark:text-purple-400',
            'hover:underline flex items-center gap-1'
          )}
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default memo(ProfileMutualFriends);
