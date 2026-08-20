/**
 * src/services/realIntegration.js - ARVDOUL EXTERNAL INTEGRATION REGISTRY
 *
 * The single source of truth for third-party provider configuration.
 * Replaces the previous placeholder export with a real, fail-loud registry:
 *
 *  - `integrationRegistry.isConfigured(name)`  - is the provider wired up?
 *  - `integrationRegistry.requireConfigured(name)` - throws a clear error when
 *    a provider is REQUIRED but unconfigured (no silent mock behavior).
 *  - `integrationRegistry.getConfig(name)` - typed env/config access.
 *
 * Providers are configured via `import.meta.env` (VITE_*) for client keys and
 * documented in `.env.example`. Server-side secrets must NEVER be prefixed
 * with VITE_ - they live in Cloud Functions env only.
 */

import { logger } from '../utils/Logger.js';

/**
 * Provider registry: name -> { envKeys, description, critical }
 * `critical: true` providers throw when used-but-unconfigured (fail closed).
 * `critical: false` providers degrade explicitly (caller decides).
 */
export const INTEGRATION_PROVIDERS = Object.freeze({
  ai_gateway: {
    envKeys: ['VITE_AI_GATEWAY_URL'],
    description: 'Server-side AI proxy (Cloud Function) - holds OpenAI keys server-side.',
    critical: false, // AI falls back to local templates
  },
  stripe: {
    envKeys: ['VITE_STRIPE_PUBLISHABLE_KEY'],
    description: 'Stripe payments (publishable key is client-safe; secret key is server-only).',
    critical: true, // coin purchases must never self-mint
  },
  algolia: {
    envKeys: ['VITE_ALGOLIA_APP_ID', 'VITE_ALGOLIA_SEARCH_KEY'],
    description: 'Algolia search (search-only key is client-safe; admin key is server-only).',
    critical: false, // Firestore fallback search exists
  },
  giphy: {
    envKeys: ['VITE_GIPHY_API_KEY'],
    description: 'GIPHY sticker/GIF search.',
    critical: false,
  },
  vector_search: {
    envKeys: ['VITE_VECTOR_API_KEY', 'VITE_VECTOR_SEARCH_ENABLED'],
    description: 'Vector search embeddings provider (Pinecone-compatible).',
    critical: false,
  },
  saml_verify: {
    envKeys: ['VITE_SAML_VERIFY_URL'],
    description: 'Server-side SAML assertion verification endpoint.',
    critical: true, // assertions are never trusted client-side
  },
  photo_dna: {
    envKeys: ['VITE_PHOTODNA_API_URL'],
    description: 'Microsoft PhotoDNA hash-database verification endpoint.',
    critical: false, // local SHA-256 pre-filter still applies
  },
  azure_content_safety: {
    envKeys: ['VITE_AZURE_CONTENT_SAFETY_ENDPOINT'],
    description: 'Azure AI Content Safety endpoint (server key via functions env).',
    critical: false,
  },
  google_vision: {
    envKeys: ['VITE_GOOGLE_CLOUD_VISION_KEY'],
    description: 'Google Cloud Vision safe-search (server-proxied in production).',
    critical: false, // client heuristics still apply
  },
  ncmec: {
    envKeys: ['VITE_NCMEC_API_URL'],
    description: 'NCMEC CyberTipline reporting endpoint.',
    critical: false, // audit log + case id are still recorded locally
  },
});

class IntegrationRegistry {
  constructor() {
    this._providers = { ...INTEGRATION_PROVIDERS };
  }

  _readEnv(key) {
    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    return env[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined);
  }

  /**
   * Returns the resolved config for a provider, or null when unconfigured.
   */
  getConfig(name) {
    const provider = this._providers[name];
    if (!provider) throw new Error(`Unknown integration provider: ${name}`);
    const config = {};
    let any = false;
    for (const key of provider.envKeys) {
      const value = this._readEnv(key);
      if (value !== undefined && value !== null && value !== '') {
        config[key] = value;
        any = true;
      }
    }
    return any ? config : null;
  }

  /** True when the provider has at least one configured env key. */
  isConfigured(name) {
    return this.getConfig(name) !== null;
  }

  /**
   * Fail-loud accessor. Throws a descriptive IntegrationNotConfiguredError
   * when the provider is unconfigured - callers must never silently mock.
   */
  requireConfigured(name) {
    if (!this.isConfigured(name)) {
      const provider = this._providers[name];
      const err = new Error(
        `INTEGRATION_NOT_CONFIGURED: "${name}" is not configured (${provider?.description ?? 'see .env.example'}). ` +
        (provider?.critical ? 'This integration is REQUIRED - refusing to degrade silently.' : 'Caller must handle the degraded path explicitly.')
      );
      err.code = 'INTEGRATION_NOT_CONFIGURED';
      err.provider = name;
      throw err;
    }
    return this.getConfig(name);
  }

  /** Registers a runtime-provided config (e.g. tests, admin UI overrides). */
  _setConfigForTest(name, config) {
    this._providers[name] = { ...this._providers[name], _testConfig: config };
  }

  getConfigForTest(name) {
    return this._providers[name]?._testConfig || null;
  }

  listProviders() {
    return Object.entries(this._providers).map(([name, p]) => ({
      name,
      description: p.description,
      critical: p.critical,
      configured: this.isConfigured(name),
    }));
  }
}

export const integrationRegistry = new IntegrationRegistry();
export default integrationRegistry;
