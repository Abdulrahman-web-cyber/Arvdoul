/**
 * src/components/profile/ProfileTabContent.jsx - ARVDOUL Profile Tab Content Component
 * 
 * Renders content for active profile tab.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  Image, 
  Video, 
  ShoppingBag, 
  Bookmark, 
  BarChart2,
  Lock,
  Loader2
} from 'lucide-react';
import ProfileMediaGrid from './ProfileMediaGrid';

/**
 * ProfileTabContent Component
 * @param {Object} props
 */
const ProfileTabContent = ({
  activeTab = 'posts',
  posts = [],
  postsLoading = false,
  savedPosts = [],
  savedLoading = false,
  shopItems = [],
  shopLoading = false,
  analytics = null,
  analyticsLoading = false,
  isOwner = false,
  onPostPress,
  onLoadMore,
  hasMore = true,
  theme = 'light',
}) => {
  // Render loading state
  const renderLoading = useCallback((loading) => {
    if (!loading) return null;
    
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }, []);

  // Render empty state
  const renderEmpty = useCallback((icon: Icon, title: string, subtitle: string) => {
    const IconComponent = icon;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className={cn(
          'w-16 h-16 rounded-full',
          'bg-gray-100 dark:bg-gray-800',
          'flex items-center justify-center mb-4'
        )}>
          <IconComponent className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
          {subtitle}
        </p>
      </div>
    );
  }, []);

  // Render posts grid
  const renderPosts = useCallback(() => {
    if (postsLoading && posts.length === 0) {
      return renderLoading(true);
    }
    
    if (posts.length === 0) {
      return renderEmpty(Image, 'No Posts Yet', 'Share your first post with the world!');
    }
    
    return (
      <ProfileMediaGrid
        items={posts}
        onItemPress={onPostPress}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        loading={postsLoading}
        theme={theme}
      />
    );
  }, [posts, postsLoading, onPostPress, onLoadMore, hasMore, theme, renderLoading, renderEmpty]);

  // Render saved content
  const renderSaved = useCallback(() => {
    if (savedLoading && savedPosts.length === 0) {
      return renderLoading(true);
    }
    
    if (savedPosts.length === 0) {
      return renderEmpty(Bookmark, 'No Saved Posts', 'Save posts to view them later.');
    }
    
    return (
      <ProfileMediaGrid
        items={savedPosts}
        onItemPress={onPostPress}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        loading={savedLoading}
        theme={theme}
      />
    );
  }, [savedPosts, savedLoading, onPostPress, onLoadMore, hasMore, theme, renderLoading, renderEmpty]);

  // Render shop
  const renderShop = useCallback(() => {
    if (shopLoading && shopItems.length === 0) {
      return renderLoading(true);
    }
    
    if (shopItems.length === 0) {
      return renderEmpty(ShoppingBag, 'No Shop Items', 'Create items to sell in your shop!');
    }
    
    return (
      <div className="grid grid-cols-2 gap-2 p-2">
        {shopItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPostPress?.(item)}
            className={cn(
              'relative aspect-square rounded-lg overflow-hidden',
              'bg-gray-100 dark:bg-gray-800'
            )}
          >
            {item.mediaUrl && (
              <img
                src={item.mediaUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            )}
            {item.price && (
              <div className={cn(
                'absolute bottom-0 left-0 right-0 p-2',
                'bg-gradient-to-t from-black/70 to-transparent'
              )}>
                <p className="text-white text-sm font-semibold">
                  {item.price} coins
                </p>
              </div>
            )}
          </button>
        ))}
      </div>
    );
  }, [shopItems, shopLoading, onPostPress, theme, renderLoading, renderEmpty]);

  // Render analytics
  const renderAnalytics = useCallback(() => {
    if (!isOwner) {
      return renderEmpty(Lock, 'Analytics Private', 'Only the profile owner can view analytics.');
    }
    
    if (analyticsLoading) {
      return renderLoading(true);
    }
    
    if (!analytics) {
      return renderEmpty(BarChart2, 'No Analytics Yet', 'Start creating content to see your analytics!');
    }
    
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            'p-4 rounded-xl',
            'bg-gradient-to-br from-purple-500/10 to-blue-500/10',
            'border border-purple-500/20'
          )}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Views</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {analytics.totalViews?.toLocaleString() || 0}
            </p>
          </div>
          <div className={cn(
            'p-4 rounded-xl',
            'bg-gradient-to-br from-green-500/10 to-cyan-500/10',
            'border border-green-500/20'
          )}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Engagement</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {analytics.engagementRate?.toFixed(1) || 0}%
            </p>
          </div>
        </div>
      </div>
    );
  }, [analytics, analyticsLoading, isOwner, theme, renderLoading, renderEmpty]);

  // Render based on active tab
  switch (activeTab) {
    case 'posts':
      return renderPosts();
    case 'saved':
      return renderSaved();
    case 'shop':
      return renderShop();
    case 'analytics':
      return renderAnalytics();
    default:
      return renderPosts();
  }
};

export default memo(ProfileTabContent);
