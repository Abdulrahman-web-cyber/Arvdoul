/**
 * FriendsScreen Component
 * Delegates to Unified ConnectionsScreen with 'friends' tab active.
 */

import React from 'react';
import ConnectionsScreen from './ConnectionsScreen';

export default function FriendsScreen() {
  return <ConnectionsScreen initialTab="friends" />;
}
