/**
 * src/utils/featureFlags.js - ARVDOUL Feature Flags
 *
 * Lightweight feature flag system for the service-layer refactoring
 * program (canary rollout). Resolution order:
 *   1. Remote config (Firestore `app_config/flags`, if db provided & cached)
 *   2. Local override (localStorage, for dev/testing)
 *   3. Built-in defaults
 *
 * Defaults are set to the current rollout state; flip a flag here to
 * disable a refactored path instantly (rollback without deploy).
 * Zero new dependencies.
 */

import { Logger } from './Logger.js';

const STORAGE_KEY = 'arvdoul_feature_flags';
const REMOTE_CACHE_TTL = 5 * 60 * 1000;

// Rollout state for refactored services (see REFACTOR_PROGRESS.md).
// ALL 13 service refactors are complete (Waves 1-3). Flags remain for
// canary/rollback of behavior-changing follow-ups.
const DEFAULT_FLAGS = {
  refactor_analytics_v2: true,
  refactor_auth_v2: true,
  refactor_comments_v2: true,
  refactor_feed_v2: true,
  refactor_firestore_v2: true,
  refactor_live_v2: true,
  refactor_messages_v2: true,
  refactor_notifications_v2: true,
  refactor_search_v2: true,
  refactor_storage_v2: true,
  refactor_story_v2: true,
  refactor_user_v2: true,
  refactor_video_v2: true,
};

function safeGetStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (err) { /* unavailable */ }
  return null;
}

class FeatureFlags {
  /**
   * @param {Object} opts
   * @param {Object} [opts.defaults=DEFAULT_FLAGS]
   * @param {Firestore|null} [opts.firestore=null] optional remote config source
   */
  constructor({ defaults = DEFAULT_FLAGS, firestore = null } = {}) {
    this.defaults = { ...defaults };
    this.firestore = firestore;
    this.logger = new Logger({ name: 'featureFlags' });
    this._overrides = this._loadOverrides();
    this._remoteCache = { data: null, fetchedAt: 0 };
  }

  _loadOverrides() {
    const storage = safeGetStorage();
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY)) || {};
    } catch (err) { return {}; }
  }

  _saveOverrides() {
    const storage = safeGetStorage();
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(this._overrides)); } catch (err) { /* ignore */ }
  }

  /** Set a local override (dev tooling / tests). */
  setOverride(name, value) {
    this._overrides[name] = value;
    this._saveOverrides();
  }

  clearOverrides() {
    this._overrides = {};
    this._saveOverrides();
  }

  /** Check a flag synchronously (defaults + overrides + cached remote). */
  isEnabled(name, userId = null) {
    if (name in this._overrides) return !!this._overrides[name];
    if (this._remoteCache.data && Date.now() - this._remoteCache.fetchedAt < REMOTE_CACHE_TTL) {
      const remote = this._remoteCache.data[name];
      if (typeof remote === 'boolean') return remote;
    }
    return !!this.defaults[name];
  }

  /**
   * Async check: fetches remote config once, then resolves like isEnabled.
   * @param {string} name
   * @param {string|null} [userId]
   * @returns {Promise<boolean>}
   */
  async isEnabledAsync(name, userId = null) {
    if (!this.firestore) return this.isEnabled(name, userId);
    if (this._remoteCache.data && Date.now() - this._remoteCache.fetchedAt < REMOTE_CACHE_TTL) {
      return this.isEnabled(name, userId);
    }
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(this.firestore, 'app_config', 'flags'));
      if (snap.exists()) {
        this._remoteCache = { data: snap.data(), fetchedAt: Date.now() };
      }
    } catch (err) {
      this.logger.debug('Remote flags unavailable, using defaults', { error: err.message });
    }
    return this.isEnabled(name, userId);
  }
}

export const featureFlags = new FeatureFlags();
export default featureFlags;
