/**
 * FollowingScreen Component
 * Delegates to Unified ConnectionsScreen with 'following' tab active.
 */

import React from 'react';
import ConnectionsScreen from './ConnectionsScreen';

export default function FollowingScreen() {
  return <ConnectionsScreen initialTab="following" />;
}
