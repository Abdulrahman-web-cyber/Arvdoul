/**
 * src/components/profile/ProfileTabs.jsx - ARVDOUL Profile Tabs Component
 * 
 * Tab navigation for profile content sections.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileTabsProps
 * @property {string} [activeTab='posts'] - Current active tab
 * @property {Function} [onTabChange] - Tab change handler
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {string} [theme='light'] - Current theme
 * @property {boolean} [hasAnalytics=false] - Show analytics tab
 * @property {boolean} [hasShop=false] - Show shop tab
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  Grid3x3, 
  Video, 
  Bookmark, 
  BarChart2,
  ShoppingBag,
  Heart,
  Image
} from 'lucide-react';

/**
 * ProfileTabs Component
 * @type {React.FC<ProfileTabsProps>}
 */
const ProfileTabs = memo(({
  activeTab = 'posts',
  onTabChange,
  isOwner = false,
  theme = 'light',
  hasAnalytics = false,
  hasShop = false,
}) => {
  // Tab definitions
  const tabs = [
    { key: 'posts', label: 'Posts', icon: Grid3x3 },
    { key: 'videos', label: 'Videos', icon: Video },
    { key: 'reels', label: 'Reels', icon: Video },
    { key: 'photos', label: 'Photos', icon: Image },
    { key: 'saved', label: 'Saved', icon: Bookmark },
    { key: 'likes', label: 'Likes', icon: Heart },
  ];
  
  // Owner-only tabs
  const ownerTabs = [
    { key: 'shop', label: 'Shop', icon: ShoppingBag },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];
  
  // Filter tabs based on ownership
  const visibleTabs = isOwner 
    ? [...tabs, ...ownerTabs.filter(t => hasShop || t.key !== 'shop', t => hasAnalytics || t.key !== 'analytics')]
    : tabs;
  
  // Handle tab click
  const handleTabClick = useCallback((tabKey) => {
    if (onTabChange) {
      onTabChange(tabKey);
    }
  }, [onTabChange]);
  
  // ARVDOUL DNA Gradient
  const activeGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  
  return (
    <nav 
      className={cn(
        'border-b border-gray-200 dark:border-gray-800',
        'overflow-x-auto scrollbar-hide'
      )}
      role="tablist"
      aria-label="Profile content tabs"
    >
      <div className={cn(
        'flex items-center gap-1 px-2 min-w-max',
        theme === 'dark' 
          ? 'bg-gray-900/80 backdrop-blur-sm' 
          : 'bg-white/80 backdrop-blur-sm'
      )}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3',
                'text-sm font-medium transition-all duration-200',
                'border-b-2 -mb-[2px]',
                isActive
                  ? 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              )}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
            >
              {isActive && (
                <div 
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                  style={{ background: activeGradient }}
                  aria-hidden="true"
                />
              )}
              <Icon 
                className={cn('w-4 h-4', isActive && 'text-purple-500')} 
                aria-hidden="true" 
              />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

ProfileTabs.displayName = 'ProfileTabs';

export default ProfileTabs;
