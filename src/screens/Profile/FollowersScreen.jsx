/**
 * FollowersScreen Component
 * Delegates to Unified ConnectionsScreen with 'followers' tab active.
 */

import React from 'react';
import ConnectionsScreen from './ConnectionsScreen';

export default function FollowersScreen() {
  return <ConnectionsScreen initialTab="followers" />;
}
