// src/screens/Profile/FollowersScreen.jsx

import React, { useCallback } from 'react';
import UserListScreen from './UserListScreen';

export default function FollowersScreen() {
  const loadUsers = useCallback(async (userId) => {
    const userService = (await import('../../services/userService.js')).getUserService();
    const result = await userService.getFollowers(userId);
    return result.followers || [];
  }, []);

  return (
    <UserListScreen
      title="Followers"
      searchPlaceholder="Search followers..."
      emptyText="No followers yet"
      loadUsers={loadUsers}
      showFollowButton
    />
  );
}