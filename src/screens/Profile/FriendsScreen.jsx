/**
 * src/screens/Profile/FriendsScreen.jsx - ARVDOUL Friends Screen
 * 
 * Displays mutual friends list.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Search, Users, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

/**
 * FriendsScreen Component
 */
export default function FriendsScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentUser = useAppStore(state => state.currentUser);
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load friends (mutual friends between current user and viewed user)
  useEffect(() => {
    const loadFriends = async () => {
      setLoading(true);
      try {
        const userService = (await import('../../services/userService.js')).getUserService();
        if (currentUser?.uid && userId) {
          const result = await userService.getMutualFriends(currentUser.uid, userId);
          setFriends(result.mutualFriends || []);
        } else {
          setFriends([]);
        }
      } catch (error) {
        console.error('Failed to load friends:', error);
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser?.uid && userId) {
      loadFriends();
    }
  }, [currentUser?.uid, userId]);
  
  const filteredFriends = friends.filter(f => 
    f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark'
        ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
        : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20 backdrop-blur-xl',
        'bg-white/80 dark:bg-gray-900/80',
        'border-b border-gray-200/60 dark:border-gray-800/60'
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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friends
          </h1>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-2xl',
            'bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md border',
            'border-gray-200/60 dark:border-gray-700/60 shadow-sm'
          )}>
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
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
        ) : friends.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-violet-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No mutual friends yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className={cn(
                  'group flex items-center gap-3 p-4 rounded-2xl',
                  'bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl',
                  'border border-gray-200/60 dark:border-gray-800/60',
                  'shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]',
                  'hover:shadow-[0_12px_40px_rgba(139,92,246,0.15)] hover:-translate-y-0.5 transition-all duration-300'
                )}
              >
                <button
                  onClick={() => navigate(`/profile/${friend.id}`)}
                  className="flex-shrink-0"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-full overflow-hidden ring-2 ring-offset-2',
                    'ring-violet-500/40 ring-offset-transparent',
                    'bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500'
                  )}>
                    {friend.photoURL ? (
                      <img
                        src={friend.photoURL}
                        alt={friend.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {(friend.displayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>
                
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/profile/${friend.id}`)}
                    className="text-left"
                  >
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {friend.displayName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{friend.username}
                    </p>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
