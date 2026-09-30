/**
 * src/config/badgeCatalog.js - ARVDOUL Badge Catalog (single source of truth)
 *
 * The badge *catalog* (ids, human labels, descriptions, grouping) lives here.
 * The badge *state* (earned / progress / target) is owned by `rankingService`;
 * this module only declares what the badges are, so the Profile summary, the
 * deep-navigation layer and the Badges screen cannot drift apart.
 *
 * Icons are referenced by key and resolved by the consumer, keeping this module
 * free of React/JSX so it can be imported from any layer.
 */

export const BADGE_CATEGORIES = Object.freeze({
  engagement: {
    title: 'Engagement',
    icon: 'heart',
    badges: [
      { id: 'first_like', name: 'First Like', description: 'Received your first like', icon: 'heart' },
      { id: 'like_master', name: 'Like Master', description: 'Received 1,000 likes', icon: 'heart' },
      { id: 'first_comment', name: 'First Comment', description: 'Received your first comment', icon: 'message' },
      { id: 'commentator', name: 'Commentator', description: 'Left 500 comments', icon: 'message' },
      { id: 'viral_post', name: 'Viral Post', description: 'Post reached 10,000 views', icon: 'flame' },
      { id: 'trendsetter', name: 'Trendsetter', description: '5 posts reached trending', icon: 'zap' },
    ],
  },
  community: {
    title: 'Community',
    icon: 'users',
    badges: [
      { id: 'first_follower', name: 'First Follower', description: 'Got your first follower', icon: 'users' },
      { id: 'influencer', name: 'Influencer', description: 'Reached 10,000 followers', icon: 'star' },
      { id: 'supporter', name: 'Supporter', description: 'Followed 100 creators', icon: 'heart' },
      { id: 'conversation_starter', name: 'Conversation Starter', description: 'Started 50 discussions', icon: 'message' },
    ],
  },
  content: {
    title: 'Content',
    icon: 'video',
    badges: [
      { id: 'first_post', name: 'First Post', description: 'Created your first post', icon: 'video' },
      { id: 'prolific_creator', name: 'Prolific Creator', description: 'Created 100 posts', icon: 'crown' },
      { id: 'spark_master', name: 'Spark Master', description: 'Posted 50 sparks', icon: 'zap' },
      { id: 'storyteller', name: 'Storyteller', description: 'Posted 100 stories', icon: 'video' },
    ],
  },
  special: {
    title: 'Special',
    icon: 'trophy',
    badges: [
      { id: 'verified', name: 'Verified', description: 'Account verified', icon: 'shield' },
      { id: 'founder', name: 'Founder', description: 'One of the first 1000 users', icon: 'star' },
      { id: 'premium', name: 'Premium Member', description: 'Active premium subscriber', icon: 'crown' },
      { id: 'year_one', name: 'Year One', description: 'Member for 1 year', icon: 'trophy' },
    ],
  },
});

/** Flat id -> badge definition map. */
export const BADGE_BY_ID = Object.freeze(
  Object.values(BADGE_CATEGORIES).reduce((acc, category) => {
    for (const badge of category.badges) acc[badge.id] = badge;
    return acc;
  }, {}),
);

/**
 * Resolves the badges a user has earned from a `rankingService.getUserBadges`
 * result (`{ [id]: { earned, progress, target } }`).
 *
 * Returns `[]` when the source is unavailable so callers can render an honest
 * empty state; never invents an earned badge.
 */
export function getEarnedBadges(userBadges) {
  if (!userBadges || typeof userBadges !== 'object') return [];
  return Object.entries(userBadges)
    .filter(([, state]) => state?.earned === true)
    .map(([id, state]) => ({ ...BADGE_BY_ID[id], id, ...state }))
    .filter((badge) => badge.name);
}

export default BADGE_CATEGORIES;
