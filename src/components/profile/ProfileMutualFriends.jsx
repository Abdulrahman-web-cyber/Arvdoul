/**
 * Shows mutual friends and social context bar (3-section card).
 * Fully aligned with Image 2 design.
 * 
 * @component
 */

import React, { memo } from 'react';
import ProfileSocialContext from './ProfileSocialContext';

const ProfileMutualFriends = memo(({
  mutualFriends = [],
  sharedCommunities = [],
  relationship = null,
  isFollowing = false,
  targetName = 'Creator',
  theme = 'light',
  onFriendPress,
  onCommunityClick,
}) => {
  return (
    <ProfileSocialContext
      mutualFriends={mutualFriends}
      sharedCommunities={sharedCommunities}
      relationship={relationship}
      isFollowing={isFollowing}
      targetName={targetName}
      theme={theme}
      onFriendClick={onFriendPress}
      onCommunityClick={onCommunityClick}
    />
  );
});

ProfileMutualFriends.displayName = 'ProfileMutualFriends';

export default ProfileMutualFriends;
