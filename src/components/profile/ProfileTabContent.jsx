/**
 * src/components/profile/ProfileTabContent.jsx - ARVDOUL Profile Tab Content Component
 * 
 * Renders content for active profile tab with glassmorphism styling.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileTabContentProps
 * @property {string} [activeTab='posts'] - Current active tab
 * @property {Array} [posts=[]] - Posts array
 * @property {boolean} [postsLoading=false] - Posts loading state
 * @property {Array} [savedPosts=[]] - Saved posts array
 * @property {boolean} [savedLoading=false] - Saved loading state
 * @property {Array} [shopItems=[]] - Shop items array
 * @property {boolean} [shopLoading=false] - Shop loading state
 * @property {Object} [analytics=null] - Analytics data
 * @property {boolean} [analyticsLoading=false] - Analytics loading state
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {Function} [onPostPress] - Post press handler
 * @property {Function} [onLoadMore] - Load more handler
 * @property {boolean} [hasMore=true] - Has more content
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { 
  Image, 
  Video, 
  ShoppingBag, 
  Bookmark, 
  BarChart2,
  Lock,
  Loader2,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal
} from 'lucide-react';
import ProfileMediaGrid from './ProfileMediaGrid';

/**
 * Format number with K, M suffix
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * ProfileTabContent Component
 * @type {React.FC<ProfileTabContentProps>}
 */
const ProfileTabContent = memo(({
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
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading content">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }, []);

  // Render empty state
  const renderEmpty = useCallback((icon, title, subtitle, action) => {
    const IconComponent = icon;
    return (
      <div 
        className="flex flex-col items-center justify-center py-16 px-4" 
        role="status"
      >
        <div className={cn(
          'w-20 h-20 rounded-full mb-4',
          'flex items-center justify-center',
          theme === 'dark' 
            ? 'bg-gray-800/50 backdrop-blur-sm' 
            : 'bg-gray-100/80 backdrop-blur-sm'
        )}>
          <IconComponent className="w-10 h-10 text-gray-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs">
          {subtitle}
        </p>
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'mt-4 px-4 py-2 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity'
            )}
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }, [theme]);

  // Render posts grid
  const renderPosts = useCallback(() => {
    if (postsLoading && posts.length === 0) {
      return renderLoading(true);
    }
    
    if (posts.length === 0) {
      return renderEmpty(
        Image, 
        'No Posts Yet', 
        isOwner 
          ? 'Share your first post with the world!' 
          : 'This user hasn\'t posted yet.',
        isOwner ? { label: 'Create Post', onClick: () => {} } : null
      );
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
  }, [posts, postsLoading, onPostPress, onLoadMore, hasMore, theme, renderLoading, renderEmpty, isOwner]);

  // Render saved content
  const renderSaved = useCallback(() => {
    if (savedLoading && savedPosts.length === 0) {
      return renderLoading(true);
    }
    
    if (savedPosts.length === 0) {
      return renderEmpty(
        Bookmark, 
        'No Saved Posts', 
        'Save posts to view them later.'
      );
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
      return renderEmpty(
        ShoppingBag, 
        'No Shop Items', 
        isOwner ? 'Create items to sell in your shop!' : 'No items available.'
      );
    }
    
    return (
      <div className="grid grid-cols-2 gap-2 p-2">
        {shopItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPostPress?.(item)}
            className={cn(
              'relative aspect-square rounded-xl overflow-hidden',
              'bg-white dark:bg-gray-900',
              'shadow-lg hover:shadow-xl',
              'transition-all duration-200',
              'hover:scale-105 active:scale-95',
              'border border-gray-200 dark:border-gray-800'
            )}
            aria-label={`Shop item: ${item.title}`}
          >
            {item.mediaUrl && (
              <img
                src={item.mediaUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            {item.price && (
              <div className={cn(
                'absolute bottom-0 left-0 right-0 p-2',
                'bg-gradient-to-t from-black/80 to-transparent'
              )}>
                <p className="text-white text-sm font-semibold flex items-center gap-1">
                  <span className="text-yellow-400">🪙</span>
                  {item.price}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>
    );
  }, [shopItems, shopLoading, onPostPress, theme, renderLoading, renderEmpty, isOwner]);

  // Render analytics
  const renderAnalytics = useCallback(() => {
    if (!isOwner) {
      return renderEmpty(
        Lock, 
        'Analytics Private', 
        'Only the profile owner can view analytics.'
      );
    }
    
    if (analyticsLoading) {
      return renderLoading(true);
    }
    
    if (!analytics) {
      return renderEmpty(
        BarChart2, 
        'No Analytics Yet', 
        'Start creating content to see your analytics!'
      );
    }
    
    // Analytics metrics
    const metrics = [
      { 
        key: 'views', 
        label: 'Total Views', 
        value: analytics.totalViews || 0, 
        icon: Eye, 
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-500/10 border-blue-500/20'
      },
      { 
        key: 'reach', 
        label: 'Total Reach', 
        value: analytics.totalReach || 0, 
        icon: Users, 
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-500/10 border-purple-500/20'
      },
      { 
        key: 'engagement', 
        label: 'Engagement', 
        value: analytics.engagementRate?.toFixed(1) || 0, 
        suffix: '%',
        icon: Heart, 
        color: 'from-pink-500 to-red-500',
        bgColor: 'bg-pink-500/10 border-pink-500/20'
      },
      { 
        key: 'coins', 
        label: 'Coins Earned', 
        value: analytics.coinsEarned || 0, 
        icon: Coins, 
        color: 'from-yellow-500 to-orange-500',
        bgColor: 'bg-yellow-500/10 border-yellow-500/20'
      },
    ];
    
    return (
      <div className="p-4 space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.key}
                className={cn(
                  'p-4 rounded-xl',
                  'border backdrop-blur-sm',
                  metric.bgColor,
                  'shadow-lg'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    `bg-gradient-to-br ${metric.color}`
                  )}>
                    <Icon className="w-4 h-4 text-white" aria-hidden="true" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metric.suffix 
                    ? `${formatNumber(metric.value)}${metric.suffix}`
                    : formatNumber(metric.value)
                  }
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {metric.label}
                </p>
              </div>
            );
          })}
        </div>
        
        {/* Changes */}
        {analytics.changes && (
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' 
              ? 'bg-gray-800/50 border border-gray-700/50' 
              : 'bg-white/80 border border-gray-200/50',
            'shadow-lg'
          )}>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Change from Previous Period
            </h4>
            <div className="space-y-2">
              {Object.entries(analytics.changes).map(([key, change]) => {
                if (change === undefined || change === null) return null;
                const isPositive = change >= 0;
                const metric = metrics.find(m => m.key === key);
                if (!metric) return null;
                
                return (
                  <div 
                    key={key} 
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {metric.label}
                    </span>
                    <span className={cn(
                      'font-semibold',
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {isPositive ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }, [analytics, analyticsLoading, isOwner, theme, renderLoading, renderEmpty]);

  // Memoized tab content
  const tabContent = useMemo(() => {
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
  }, [activeTab, renderPosts, renderSaved, renderShop, renderAnalytics]);

  return (
    <section 
      className="mt-2"
      aria-label={`${activeTab} content`}
    >
      {tabContent}
    </section>
  );
});

ProfileTabContent.displayName = 'ProfileTabContent';

// Import icons used in analytics
import { Eye, Users, Coins } from 'lucide-react';

export default ProfileTabContent;
