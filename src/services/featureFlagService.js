/**
 * src/services/featureFlagService.js - ARVDOUL FEATURE FLAG SERVICE
 *
 * Production-grade feature flags with:
 *  1. STATIC DEFAULTS - a typed, versioned baseline that works offline and
 *     before Firebase Remote Config resolves (zero-latency reads).
 *  2. FIREBASE REMOTE CONFIG - dynamic overlay when available; the service
 *     degrades gracefully when Remote Config is unavailable (no Firebase
 *     config, blocked network, test environment).
 *  3. KILL SWITCHES - admin overrides persisted to localStorage that take
 *     precedence over everything. This is the emergency rollback lever:
 *     `featureFlagService.setOverride('new_feed_ranking', false)` disables a
 *     flag instantly for this client without a deploy.
 *  4. SUBSCRIPTIONS - React components can react to flag changes at runtime
 *     (see src/hooks/useFeatureFlag.js).
 *
 * Naming convention: `scope.feature` (e.g. `feed.ml_ranking`, `messaging.e2ee`).
 * Every flag MUST be registered in DEFAULT_FLAGS before use - unregistered
 * names fail closed (return `false` / `null`) and log a warning.
 */

import { logger } from '../utils/Logger.js';

/**
 * Static baseline flag registry. Treat this as the contract for all flags:
 * keep it sorted, versioned, and documented. `description` helps the admin UI
 * and on-call engineers; it is never shipped in payloads.
 */
export const DEFAULT_FLAGS = Object.freeze({
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

const OVERRIDE_PREFIX = 'arvdoul_flag_override_';

class FeatureFlagService {
  constructor() {
    this._values = new Map();
    this._overrides = new Map();
    this._listeners = new Set();
    this._remoteReady = false;
    this._appliedDefaults = false;
    this._initPromise = null;

    this._applyDefaults();
    this._loadOverrides();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  _applyDefaults() {
    for (const [name, def] of Object.entries(DEFAULT_FLAGS)) {
      this._values.set(name, def.defaultValue);
    }
    this._appliedDefaults = true;
  }

  _loadOverrides() {
    if (typeof localStorage === 'undefined') return;
    try {
      for (const name of Object.keys(DEFAULT_FLAGS)) {
        const raw = localStorage.getItem(`${OVERRIDE_PREFIX}${name}`);
        if (raw === null) continue;
        const def = DEFAULT_FLAGS[name];
        this._overrides.set(name, def.type === 'boolean' ? raw === 'true' : raw);
      }
    } catch (err) {
      logger.warn('[FeatureFlags] Could not load overrides from localStorage', { error: err.message });
    }
  }

  _persistOverride(name, value) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`${OVERRIDE_PREFIX}${name}`, String(value));
    } catch (err) {
      logger.warn('[FeatureFlags] Could not persist override', { error: err.message });
    }
  }

  _emit() {
    for (const listener of this._listeners) {
      try {
        listener(this.getSnapshot());
      } catch (err) {
        logger.error('[FeatureFlags] Listener failed', { error: err.message });
      }
    }
  }

  _coerce(name, value) {
    const def = DEFAULT_FLAGS[name];
    if (!def) return null;
    if (def.type === 'boolean') return value === true || value === 'true' || value === 1 || value === '1';
    if (def.type === 'number') {
      const n = Number(value);
      return Number.isFinite(n) ? n : def.defaultValue;
    }
    return String(value);
  }

  _checkRegistered(name) {
    if (!DEFAULT_FLAGS[name]) {
      logger.warn(`[FeatureFlags] Unknown flag "${name}" - failing closed. Register it in DEFAULT_FLAGS.`);
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Fetches and applies Firebase Remote Config (idempotent, never throws).
   * Safe to call at app bootstrap without awaiting.
   * @returns {Promise<boolean>} true when Remote Config was applied
   */
  async init({ minimumFetchIntervalMillis = 3600000 } = {}) {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initRemoteConfig(minimumFetchIntervalMillis);
    return this._initPromise;
  }

  async _initRemoteConfig(minimumFetchIntervalMillis) {
    try {
      const [{ getRemoteConfig, getAll }, { getApp }] = await Promise.all([
        import('firebase/remote-config'),
        import('firebase/app'),
      ]);
      const app = getApp(); // throws when Firebase was never initialized
      const remoteConfig = getRemoteConfig(app);
      remoteConfig.settings = { ...remoteConfig.settings, minimumFetchIntervalMillis };
      await remoteConfig.fetchAndActivate();

      const all = getAll(remoteConfig);
      for (const [name, def] of Object.entries(DEFAULT_FLAGS)) {
        const rcValue = all[name];
        if (!rcValue || rcValue.asString() === '') continue;
        this._values.set(name, this._coerce(name, rcValue.asString()));
      }
      this._remoteReady = true;
      logger.info('[FeatureFlags] Remote Config applied', { flags: this._values.size });
      this._emit();
      return true;
    } catch (err) {
      logger.warn('[FeatureFlags] Remote Config unavailable - using static defaults', {
        error: err.message,
      });
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** Fail-closed boolean read. */
  isEnabled(name) {
    if (!this._checkRegistered(name)) return false;
    const value = this.getRaw(name);
    return value === true || value === 'true';
  }

  /** Typed read respecting overrides > remote config > defaults. */
  getRaw(name) {
    if (this._overrides.has(name)) return this._overrides.get(name);
    return this._values.get(name);
  }

  getValue(name) {
    if (!this._checkRegistered(name)) return null;
    return this.getRaw(name);
  }

  getString(name) {
    const v = this.getValue(name);
    return v === null || v === undefined ? null : String(v);
  }

  getNumber(name) {
    const v = this.getValue(name);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** Returns `true` when Remote Config is active (overrides still win). */
  isRemoteReady() {
    return this._remoteReady;
  }

  /**
   * Snapshot of all flags: `{ name: { value, source } }`.
   * `source` is 'override' | 'remote' | 'default' - useful for admin UI.
   */
  getSnapshot() {
    const out = {};
    for (const name of Object.keys(DEFAULT_FLAGS)) {
      let source = 'default';
      if (this._overrides.has(name)) source = 'override';
      else if (this._remoteReady) source = 'remote';
      out[name] = { value: this.getRaw(name), source, type: DEFAULT_FLAGS[name].type };
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Overrides (kill switches / admin UI)
  // -------------------------------------------------------------------------

  /** Sets an admin override (persisted). Pass `null` to clear. */
  setOverride(name, value) {
    if (!this._checkRegistered(name)) return false;
    if (value === null || value === undefined) {
      this._overrides.delete(name);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(`${OVERRIDE_PREFIX}${name}`);
        } catch (err) {
          logger.warn('[FeatureFlags] Could not remove override', { error: err.message });
        }
      }
    } else {
      this._overrides.set(name, this._coerce(name, value));
      this._persistOverride(name, this._overrides.get(name));
    }
    this._emit();
    return true;
  }

  clearOverride(name) {
    return this.setOverride(name, null);
  }

  resetOverrides() {
    this._overrides.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        for (const name of Object.keys(DEFAULT_FLAGS)) {
          localStorage.removeItem(`${OVERRIDE_PREFIX}${name}`);
        }
      } catch (err) {
        logger.warn('[FeatureFlags] Could not reset overrides', { error: err.message });
      }
    }
    this._emit();
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  /** @returns {() => void} unsubscribe */
  onUpdate(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }
}

export { FeatureFlagService };
export const featureFlagService = new FeatureFlagService();
export default featureFlagService;
