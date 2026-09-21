// src/screens/Profile/FollowingScreen.jsx

import React, { useCallback } from 'react';
import UserListScreen from './UserListScreen';

export default function FollowingScreen() {
  const loadUsers = useCallback(async (userId) => {
    const userService = (await import('../../services/userService.js')).getUserService();
    const result = await userService.getFollowing(userId);
    return result.following || result.friends || [];
  }, []);

  return (
    <UserListScreen
      title="Following"
      searchPlaceholder="Search following..."
      emptyText="Not following anyone yet"
      loadUsers={loadUsers}
      showFollowButton
    />
  );
}