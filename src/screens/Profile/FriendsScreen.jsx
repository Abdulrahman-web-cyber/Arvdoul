// src/screens/Profile/FriendsScreen.jsx
//
// Viewing someone else: mutual friends between the viewer and that user.
// Viewing yourself: the accounts you follow. The empty message reflects the
// branch, which previously said "No mutual friends yet" in both cases.

import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import UserListScreen from './UserListScreen';
import { useAppStore } from '../../store/appStore';

export default function FriendsScreen() {
  const { userId } = useParams();
  const currentUser = useAppStore((state) => state.currentUser);

  const isMutualView = Boolean(userId && currentUser?.uid && userId !== currentUser.uid);

  const loadUsers = useCallback(
    async (targetId) => {
      const userService = (await import('../../services/userService.js')).getUserService();
      if (isMutualView) {
        const result = await userService.getMutualFriends(currentUser.uid, userId);
        return result?.mutualFriends || [];
      }
      const result = await userService.getFriends(targetId);
      return result?.friends || [];
    },
    [isMutualView, currentUser?.uid, userId]
  );

  return (
    <UserListScreen
      title={isMutualView ? 'Mutual Friends' : 'Friends'}
      searchPlaceholder={isMutualView ? 'Search mutual friends...' : 'Search friends...'}
      emptyText={isMutualView ? 'No mutual friends yet' : 'Not following anyone yet'}
      loadUsers={loadUsers}
    />
  );
}