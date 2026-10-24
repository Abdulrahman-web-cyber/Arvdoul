/**
 * FollowingScreen Component
 * Delegates to Unified ConnectionsScreen with 'following' tab active.
 */

import React from 'react';
import ConnectionsScreen from './ConnectionsScreen';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';

export default function FollowingScreen() {
  const { user: authUser } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const currentUser = authUser || storeUser;

  return <ConnectionsScreen initialTab="following" currentUser={currentUser} />;
}
