/**
 * src/shared/featureFlagRegistry.cjs - ARVDOUL FEATURE FLAG REGISTRY
 *
 * The canonical, hand-edited list of every platform feature flag: name,
 * default value, type and operator-facing description. This is the ONLY place
 * a flag may be declared.
 *
 * Why a shared .cjs file: Cloud Functions package only the `functions/`
 * directory, so the client service and the server-side flag governance
 * callables cannot share a file in place. scripts/sync-shared-config.mjs
 * copies this file byte-identically into functions/, and
 * src/__tests__/sharedConfigSync.test.js fails CI if the copy drifts.
 *
 * Rules:
 *  - Registering a flag here is what makes it settable. The server rejects any
 *    name not present in this registry (fail-closed).
 *  - Never re-declare a flag name or default in a component or service.
 */

const DEFAULT_FLAGS = Object.freeze({
  'feed.ml_ranking': {
    defaultValue: false,
    type: 'boolean',
    description: 'ML-based feed ranking (Cloud Function). Off = fallback scoring.',
  },
  'feed.diversity_rerank': {
    defaultValue: true,
    type: 'boolean',
    description: 'Author/category/topic diversity enforcement on feed pages.',
  },
  'feed.ads': {
    defaultValue: true,
    type: 'boolean',
    description: 'Ad insertion in the feed (monetization).',
  },
  'messaging.e2ee': {
    defaultValue: true,
    type: 'boolean',
    description: 'End-to-end encryption for direct messages.',
  },
  'messaging.calls': {
    defaultValue: true,
    type: 'boolean',
    description: 'Voice/video calls in messaging (WebRTC).',
  },
  'live.recording': {
    defaultValue: false,
    type: 'boolean',
    description: 'Live stream recording & replay (server-side).',
  },
  'ai.studio': {
    defaultValue: true,
    type: 'boolean',
    description: 'AI Studio (captions, scripts, images).',
  },
  'ai.streaming': {
    defaultValue: false,
    type: 'boolean',
    description: 'Streaming responses for AI Studio.',
  },
  'stories.music_library': {
    defaultValue: false,
    type: 'boolean',
    description: 'Licensed music library for stories.',
  },
  'monetization.pay_per_view': {
    defaultValue: true,
    type: 'boolean',
    description: 'Pay-per-view videos.',
  },
  'admin.analytics_beta': {
    defaultValue: false,
    type: 'boolean',
    description: 'Beta analytics dashboard for creators.',
  },
  'search.vector': {
    defaultValue: false,
    type: 'boolean',
    description: 'Vector search (Pinecone) alongside Algolia.',
  },
  'moderation.auto_review': {
    defaultValue: true,
    type: 'boolean',
    description: 'Automated moderation pipeline on publish.',
  },
});

/** Flag names as a lookup set, for fail-closed validation on the server. */
const FLAG_NAMES = Object.freeze(Object.keys(DEFAULT_FLAGS));

/** @returns {boolean} whether `name` is a registered flag. */
function isKnownFlag(name) {
  return Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, name);
}

module.exports = { DEFAULT_FLAGS, FLAG_NAMES, isKnownFlag };
