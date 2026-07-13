/**
 * src/screens/Profile/ProfilePublicScreen.jsx - ARVDOUL Public Visitor Profile Screen
 *
 * Sleek, premium social interface for visitors of another creator's profile.
 * Combines:
 * - Visitor Profile Header with relevant action buttons (Follow/Unfollow, Message).
 * - Mutual friends section for shared ecosystem visibility.
 * - Public Highlights.
 * - Visitor Tabbed view of creator's public posts and assets.
 *
 * @component
 */

import React from 'react';
import { cn } from '../../lib/utils';
import {
  ProfileHeader,
  ProfileHighlights,
  ProfileMutualFriends,
  ProfileTabs,
  ProfileTabContent,
} from '../../components/profile';

export default function ProfilePublicScreen({
  profile,
  level,
  position,
  theme,
  posts,
  postsLoading,
  postsHasMore,
  highlights,
  mutualFriends,
  activeProfileTab,
  handleTabChange,
  handleAvatarPress,
  handleCoverPress,
  handleStatPress,
  handlePostPress,
  handleLoadMorePosts,
  handleHighlightPress,
  handleMutualFriendPress,
}) {
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="px-4 pt-4">
          <ProfileHeader
            profile={profile}
            isOwner={false}
            level={level || profile?.level || 1}
            position={position}
            theme={theme}
            onAvatarPress={handleAvatarPress}
            onCoverPress={handleCoverPress}
            onStatPress={handleStatPress}
            onMutualFriendPress={handleMutualFriendPress}
          />
        </div>

        {/* Mutual Friends Ecosystem Connection */}
        {mutualFriends && mutualFriends.length > 0 && (
          <div className="px-4 mt-4">
            <ProfileMutualFriends
              mutualFriends={mutualFriends}
              onFriendPress={handleMutualFriendPress}
              theme={theme}
            />
          </div>
        )}

        {/* Public Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="px-4 mt-4">
            <ProfileHighlights
              highlights={highlights}
              isOwner={false}
              onHighlightPress={handleHighlightPress}
              theme={theme}
            />
          </div>
        )}

        {/* Public Tab Navigation */}
        <div className="mt-4">
          <ProfileTabs
            activeTab={activeProfileTab}
            onTabChange={handleTabChange}
            isOwner={false}
            theme={theme}
            hasAnalytics={false}
            hasShop={false}
          />
        </div>

        {/* Tab Content display */}
        <ProfileTabContent
          activeTab={activeProfileTab}
          posts={posts}
          postsLoading={postsLoading}
          isOwner={false}
          onPostPress={handlePostPress}
          onLoadMore={handleLoadMorePosts}
          hasMore={postsHasMore}
          theme={theme}
        />
      </div>
    </div>
  );
}
