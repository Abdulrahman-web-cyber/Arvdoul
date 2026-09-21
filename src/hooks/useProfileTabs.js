/**
 * src/hooks/useProfileTabs.js - ARVDOUL Profile Tabs Hook
 * 
 * Custom hook for profile tab management.
 * Provides tab state and content management.
 * 
 * @module hooks/useProfileTabs
 */

import { useCallback, useState, useMemo } from 'react';

/**
 * Default profile tabs
 */
const DEFAULT_TABS = [
  { id: 'posts', label: 'Posts', icon: 'grid' },
  { id: 'saved', label: 'Saved', icon: 'bookmark' },
  { id: 'tagged', label: 'Tagged', icon: 'tag' },
];

/**
 * Owner-only tabs
 */
const OWNER_TABS = [
  { id: 'shop', label: 'Shop', icon: 'shopping-bag' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
];

/**
 * useProfileTabs Hook
 * @param {Object} options - Configuration options
 * @param {boolean} options.isOwner - Whether viewing own profile
 * @param {boolean} options.hasAnalytics - Whether to show analytics tab
 * @param {boolean} options.hasShop - Whether to show shop tab
 * @param {Function} options.onTabChange - Callback when tab changes
 * @returns {Object} Tab state and actions
 */
export function useProfileTabs(options = {}) {
  const { 
    isOwner = false, 
    hasAnalytics = false, 
    hasShop = false,
    onTabChange,
    customTabs = null,
  } = options;
  
  const [activeTab, setActiveTab] = useState('posts');
  
  // Build tabs list
  const tabs = useMemo(() => {
    if (customTabs) return customTabs;
    
    const result = [...DEFAULT_TABS];
    
    if (isOwner && hasAnalytics) {
      result.push(OWNER_TABS.find(t => t.id === 'analytics'));
    }
    
    if (isOwner && hasShop) {
      result.push(OWNER_TABS.find(t => t.id === 'shop'));
    }
    
    return result.filter(Boolean);
  }, [isOwner, hasAnalytics, hasShop, customTabs]);
  
  // Handle tab change
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  }, [onTabChange]);
  
  // Check if tab exists
  const hasTab = useCallback((tabId) => {
    return tabs.some(t => t.id === tabId);
  }, [tabs]);
  
  // Get tab by id
  const getTab = useCallback((tabId) => {
    return tabs.find(t => t.id === tabId);
  }, [tabs]);
  
  // Get content based on active tab
  const getContent = useCallback((contentMap = {}) => {
    return contentMap[activeTab] || null;
  }, [activeTab]);
  
  return {
    // State
    activeTab,
    tabs,
    
    // Actions
    setActiveTab: handleTabChange,
    hasTab,
    getTab,
    getContent,
  };
}

export default useProfileTabs;
