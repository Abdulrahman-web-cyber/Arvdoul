/**
 * src/__tests__/featureFlagService.test.js
 * Real assertions for the feature flag service: fail-closed reads, override
 * precedence (override > remote > default), localStorage persistence, and
 * subscription notifications.
 */

import { jest } from '@jest/globals';
import { featureFlagService, FeatureFlagService, DEFAULT_FLAGS } from '../services/featureFlagService.js';

describe('featureFlagService', () => {
  beforeEach(() => {
    featureFlagService.resetOverrides();
    featureFlagService._remoteReady = false;
    featureFlagService._values.clear();
    featureFlagService._applyDefaults();
  });

  test('all registered flags are booleans with documented defaults', () => {
    const names = Object.keys(DEFAULT_FLAGS);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      expect(DEFAULT_FLAGS[name].type).toBe('boolean');
      expect(typeof DEFAULT_FLAGS[name].defaultValue).toBe('boolean');
      expect(DEFAULT_FLAGS[name].description.length).toBeGreaterThan(0);
    }
  });

  test('isEnabled fails closed for unknown flags', () => {
    expect(featureFlagService.isEnabled('does.not_exist')).toBe(false);
    expect(featureFlagService.getValue('does.not_exist')).toBeNull();
  });

  test('defaults apply before any remote fetch', () => {
    expect(featureFlagService.isEnabled('feed.diversity_rerank')).toBe(true);
    expect(featureFlagService.isEnabled('feed.ml_ranking')).toBe(false);
    expect(featureFlagService.isEnabled('live.recording')).toBe(false);
  });

  test('admin override beats remote and default values', () => {
    featureFlagService.setOverride('feed.ml_ranking', true);
    featureFlagService._remoteReady = true; // simulate remote applied
    expect(featureFlagService.isEnabled('feed.ml_ranking')).toBe(true);
    const entry = featureFlagService.getSnapshot()['feed.ml_ranking'];
    expect(entry.source).toBe('override');

    featureFlagService.clearOverride('feed.ml_ranking');
    expect(featureFlagService.isEnabled('feed.ml_ranking')).toBe(false);
  });

  test('overrides persist across service instances (localStorage)', () => {
    featureFlagService.setOverride('ai.streaming', true);
    const stored = localStorage.getItem('arvdoul_flag_override_ai.streaming');
    expect(stored).toBe('true');

    // A fresh instance must pick up the persisted override
    const fresh = new FeatureFlagService();
    expect(fresh.isEnabled('ai.streaming')).toBe(true);
  });

  test('resetOverrides clears all kill switches', () => {
    featureFlagService.setOverride('feed.ads', false);
    featureFlagService.setOverride('messaging.e2ee', false);
    featureFlagService.resetOverrides();
    expect(featureFlagService.isEnabled('feed.ads')).toBe(true);
    expect(featureFlagService.isEnabled('messaging.e2ee')).toBe(true);
  });

  test('onUpdate notifies subscribers on override changes and unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = featureFlagService.onUpdate(listener);
    featureFlagService.setOverride('feed.ads', false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    featureFlagService.setOverride('feed.ads', true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('getSnapshot reports source for every flag', () => {
    const snapshot = featureFlagService.getSnapshot();
    for (const name of Object.keys(DEFAULT_FLAGS)) {
      expect(snapshot[name]).toHaveProperty('value');
      expect(['default', 'remote', 'override']).toContain(snapshot[name].source);
    }
  });

  test('init never throws when Firebase is unavailable', async () => {
    // getApp() will throw in the test env (no Firebase app) -> graceful fallback
    const result = await featureFlagService.init({ minimumFetchIntervalMillis: 0 });
    expect(result).toBe(false);
    expect(featureFlagService.isRemoteReady()).toBe(false);
    // Defaults remain intact after failed remote fetch
    expect(featureFlagService.isEnabled('feed.diversity_rerank')).toBe(true);
  });
});
