// src/__tests__/pwaAndMobileOptimization.test.js

import { jest } from '@jest/globals';
import {
  getDeviceCapabilities,
  isLiteModeEnabled,
  setLiteModePreference,
  getAdaptiveTuning,
} from '../utils/deviceCapabilities';
import { scheduleIdleTask, cleanMemoryCaches, optimize } from '../performance/optimizer';

describe('Phase 7: Mobile PWA, Hardware Adaptation & Low-End Optimization', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Device Capabilities & Network Heuristics', () => {
    test('returns sensible defaults when navigator capabilities are absent', () => {
      const caps = getDeviceCapabilities();
      expect(caps).toHaveProperty('cores');
      expect(caps).toHaveProperty('memoryGb');
      expect(caps).toHaveProperty('saveData');
      expect(caps).toHaveProperty('effectiveType');
      expect(caps).toHaveProperty('networkQuality');
    });

    test('classifies low-end device when memory is <= 2.5GB', () => {
      const origMemory = navigator.deviceMemory;
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2,
        configurable: true,
      });

      const caps = getDeviceCapabilities();
      expect(caps.isLowEndDevice).toBe(true);

      Object.defineProperty(navigator, 'deviceMemory', {
        value: origMemory,
        configurable: true,
      });
    });

    test('classifies low-end device when saveData is enabled', () => {
      const origConnection = navigator.connection;
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true, effectiveType: '4g' },
        configurable: true,
      });

      const caps = getDeviceCapabilities();
      expect(caps.saveData).toBe(true);
      expect(caps.isLowEndDevice).toBe(true);

      Object.defineProperty(navigator, 'connection', {
        value: origConnection,
        configurable: true,
      });
    });

    test('detects poor network quality on 2g connections', () => {
      const origConnection = navigator.connection;
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '2g' },
        configurable: true,
      });

      const caps = getDeviceCapabilities();
      expect(caps.networkQuality).toBe('poor');

      Object.defineProperty(navigator, 'connection', {
        value: origConnection,
        configurable: true,
      });
    });
  });

  describe('Lite Mode & Adaptive Tuning', () => {
    test('persists user Lite Mode preference in localStorage', () => {
      expect(isLiteModeEnabled()).toBe(false);

      setLiteModePreference(true);
      expect(isLiteModeEnabled()).toBe(true);

      setLiteModePreference(false);
      expect(isLiteModeEnabled()).toBe(false);

      setLiteModePreference(null); // clears override
      expect(localStorage.getItem('arvdoul_lite_mode_preference')).toBeNull();
    });

    test('adapts feed page size and cache limits when Lite Mode is active', () => {
      setLiteModePreference(true);
      const liteTuning = getAdaptiveTuning();
      expect(liteTuning.isLiteMode).toBe(true);
      expect(liteTuning.feedPageSize).toBeLessThan(20);
      expect(liteTuning.maxCachedVideos).toBeLessThan(4);
      expect(liteTuning.enableBackdropBlur).toBe(false);

      setLiteModePreference(false);
      const standardTuning = getAdaptiveTuning();
      expect(standardTuning.feedPageSize).toBeGreaterThanOrEqual(20);
      expect(standardTuning.enableBackdropBlur).toBe(true);
    });
  });

  describe('Performance Optimizer Engine', () => {
    test('optimize() returns unified configuration and tuning', () => {
      const opt = optimize();
      expect(opt.lazy).toBe(true);
      expect(opt.split).toBe(true);
      expect(opt).toHaveProperty('tuning');
      expect(typeof opt.scheduleIdleTask).toBe('function');
    });

    test('scheduleIdleTask executes fallback callback within timeout', (done) => {
      scheduleIdleTask((deadline) => {
        expect(deadline).toBeDefined();
        done();
      }, 50);
    });

    test('cleanMemoryCaches pauses and unloads offscreen videos', () => {
      const video = document.createElement('video');
      video.setAttribute('data-offscreen', 'true');
      video.src = 'https://example.com/video.mp4';
      video.pause = jest.fn();
      video.load = jest.fn();
      document.body.appendChild(video);

      cleanMemoryCaches();

      expect(video.pause).toHaveBeenCalled();
      expect(video.load).toHaveBeenCalled();
      expect(video.hasAttribute('src')).toBe(false);

      document.body.removeChild(video);
    });
  });
});
