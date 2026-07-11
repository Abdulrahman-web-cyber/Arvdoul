/**
 * src/screens/Profile/FollowingScreen.jsx - ARVDOUL Following Screen
 * 
 * Displays list of users being followed with unfollow functionality.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import FollowButton from '../../components/profile/FollowButton';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';

/**
 * FollowingScreen Component
 */
export default function FollowingScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentUser = useAppStore(state => state.currentUser);
  const { follow, unfollow, followLoading } = useProfileStore();
  
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load following
  useEffect(() => {
    const loadFollowing = async () => {
      setLoading(true);
      try {
        const userService = (await import('../../services/userService.js')).getUserService();
        const result = await userService.getFollowing(userId);
        setFollowing(result.following || result.friends || []);
      } catch (error) {
        console.error('Failed to load following:', error);
        setFollowing([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      loadFollowing();
    }
  }, [userId]);
  
  const handleFollow = useCallback((followingId) => {
    if (currentUser?.uid) {
      follow(currentUser.uid, followingId);
    }
  }, [currentUser?.uid, follow]);
  
  const handleUnfollow = useCallback((followingId) => {
    if (currentUser?.uid) {
      unfollow(currentUser.uid, followingId);
    }
  }, [currentUser?.uid, unfollow]);
  
  const filteredFollowing = following.filter(f => 
    f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800'
      )}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className={cn(
              'p-2 rounded-xl',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Following
          </h1>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl',
            'bg-gray-100 dark:bg-gray-800'
          )}>
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search following..."
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400">
              Not following anyone yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFollowing.map((user) => (
              <div
                key={user.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl',
                  'bg-white dark:bg-gray-900',
                  'border border-gray-200 dark:border-gray-800'
                )}
              >
                <button
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="flex-shrink-0"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-full overflow-hidden',
                    'bg-gradient-to-br from-purple-500 to-blue-500'
                  )}>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {(user.displayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>
                
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="text-left"
                  >
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </p>
                  </button>
                </div>
                
                <FollowButton
                  isFollowing={true}
                  loading={followLoading}
                  onUnfollow={() => handleUnfollow(user.id)}
                  theme={theme}
                  size="sm"
                  variant="outline"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
