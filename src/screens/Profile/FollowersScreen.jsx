/**
 * FollowersScreen Component
 * Delegates to Unified ConnectionsScreen with 'followers' tab active.
 */

import ConnectionsScreen from './ConnectionsScreen';

export default function FollowersScreen() {
  return <ConnectionsScreen initialTab="followers" />;
}
