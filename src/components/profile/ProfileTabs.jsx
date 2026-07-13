/**
 * src/components/profile/ProfileTabs.jsx - ARVDOUL Profile Tabs Component
 * 
 * Tab navigation for profile content sections.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  Grid3X3, 
  ShoppingBag, 
  Bookmark, 
  Heart, 
  BarChart2,
  Info,
  Lock,
  Star,
  Tag
} from 'lucide-react';

/**
 * Default tabs configuration
 */
const DEFAULT_TABS = [
  { id: 'posts', label: 'Posts', icon: Grid3X3 },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'tagged', label: 'Tagged', icon: Tag || (() => <Heart className="w-4 h-4" />) },
];

/**
 * Owner-only tabs
 */
const OWNER_TABS = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
];

/**
 * ProfileTabs Component
 * @param {Object} props
 */
const ProfileTabs = ({
  activeTab = 'posts',
  onTabChange,
  isOwner = false,
  theme = 'light',
  tabs: customTabs = null,
  hasAnalytics = false,
  hasShop = false,
}) => {
  const tabs = customTabs || DEFAULT_TABS;
  
  // Add owner tabs if applicable
  const allTabs = [
    ...tabs,
    ...(isOwner && hasAnalytics ? OWNER_TABS.filter(t => t.id === 'analytics') : []),
    ...(isOwner && hasShop ? OWNER_TABS.filter(t => t.id === 'shop') : []),
  ];

  const handleTabClick = useCallback((tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  }, [onTabChange]);

  return (
    <div className={cn(
      'border-b border-gray-200 dark:border-gray-700',
      'sticky top-0 z-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      <div className="flex items-center justify-around">
        {allTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'flex-1 py-3 px-2',
                'flex items-center justify-center gap-1.5',
                'text-sm font-medium',
                'border-b-2 -mb-px',
                'transition-colors relative',
                isActive
                  ? 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              )}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className={cn('w-4 h-4', isActive && 'text-purple-600 dark:text-purple-400')} />
              <span>{tab.label}</span>
              
              {/* Active indicator */}
              {isActive && (
                <div className={cn(
                  'absolute bottom-0 left-1/2 -translate-x-1/2',
                  'w-12 h-0.5 rounded-full',
                  'bg-gradient-to-r from-purple-500 to-blue-500'
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default memo(ProfileTabs);
