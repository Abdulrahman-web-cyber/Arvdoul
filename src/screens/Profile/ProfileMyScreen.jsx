/**
 * src/screens/Profile/ProfileMyScreen.jsx - ARVDOUL Dedicated Owner Profile Screen
 *
 * Elegant, luxury glassmorphic view of the user's own profile.
 * Incorporates:
 * - Profile header, avatar neon, statistics.
 * - Highlights management & creations.
 * - Creator Dashboard Overview & full analytics summaries.
 * - Profile Tabs navigation & responsive content.
 *
 * @component
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  ProfileHeader,
  ProfileHighlights,
  ProfileTabs,
  ProfileTabContent,
  CreatorDashboard,
} from '../../components/profile';

export default function ProfileMyScreen({
  profile,
  level,
  position,
  theme,
  posts,
  postsLoading,
  postsHasMore,
  highlights,
  analytics,
  ranking,
  timeframe,
  analyticsLoading,
  activeProfileTab,
  handleTabChange,
  handleAvatarPress,
  handleCoverPress,
  handleStatPress,
  handlePostPress,
  handleLoadMorePosts,
  handleHighlightPress,
  handleAddHighlight,
  handleMutualFriendPress,
  loadAnalytics,
  setTimeframe,
  viewingUserId,
}) {
  const navigate = useNavigate();

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
            isOwner={true}
            level={level || profile?.level || 1}
            position={position}
            theme={theme}
            onAvatarPress={handleAvatarPress}
            onCoverPress={handleCoverPress}
            onStatPress={handleStatPress}
            onMutualFriendPress={handleMutualFriendPress}
          />
        </div>

        {/* Creator Dashboard Overview */}
        {analytics && (
          <div className="px-4 mt-4">
            <CreatorDashboard
              analytics={analytics}
              ranking={ranking}
              theme={theme}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              loading={analyticsLoading}
              onRefresh={() => loadAnalytics(viewingUserId, timeframe)}
              onViewDetails={() => navigate('/profile/analytics')}
            />
          </div>
        )}

        {/* Story Highlights */}
        <div className="px-4 mt-4">
          <ProfileHighlights
            highlights={highlights}
            isOwner={true}
            onHighlightPress={handleHighlightPress}
            onAddHighlight={handleAddHighlight}
            theme={theme}
          />
        </div>

        {/* Tabs Selection */}
        <div className="mt-4">
          <ProfileTabs
            activeTab={activeProfileTab}
            onTabChange={handleTabChange}
            isOwner={true}
            theme={theme}
            hasAnalytics={true}
            hasShop={true}
          />
        </div>

        {/* Tab Content Display */}
        <ProfileTabContent
          activeTab={activeProfileTab}
          posts={posts}
          postsLoading={postsLoading}
          isOwner={true}
          onPostPress={handlePostPress}
          onLoadMore={handleLoadMorePosts}
          hasMore={postsHasMore}
          theme={theme}
        />
      </div>
    </div>
  );
}
