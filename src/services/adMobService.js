// src/services/adMobService.js
// Unified AdMob (Capacitor Android/iOS native plugin) & Google AdSense Web bridge.
// Strictly config-driven via VITE_* env vars: no hardcoded demo publisher IDs,
// no synthetic creatives, and no client-side coin minting.

import { logger } from '../utils/Logger.js';

const isBrowser = typeof window !== 'undefined';

export function getAdNetworkConfig() {
  try {
    return {
      adMobAppId: String(import.meta.env?.VITE_ADMOB_APP_ID || '').trim(),
      bannerId: String(import.meta.env?.VITE_ADMOB_BANNER_ID || '').trim(),
      interstitialId: String(import.meta.env?.VITE_ADMOB_INTERSTITIAL_ID || '').trim(),
      rewardedId: String(import.meta.env?.VITE_ADMOB_REWARDED_ID || '').trim(),
      adSenseClientId: String(import.meta.env?.VITE_ADSENSE_CLIENT_ID || '').trim(),
      adSenseSlotFeed: String(import.meta.env?.VITE_ADSENSE_SLOT_FEED || '').trim(),
      adSenseSlotSearch: String(import.meta.env?.VITE_ADSENSE_SLOT_SEARCH || '').trim(),
    };
  } catch {
    return {
      adMobAppId: '',
      bannerId: '',
      interstitialId: '',
      rewardedId: '',
      adSenseClientId: '',
      adSenseSlotFeed: '',
      adSenseSlotSearch: '',
    };
  }
}

class AdMobService {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    this._webScriptPromise = null;
  }

  _getNativePlugin() {
    if (!isBrowser) return null;
    const cap = window.Capacitor;
    if (!cap) return null;
    const isNative = typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : false;
    if (!isNative) return null;
    return cap.Plugins?.AdMob || null;
  }

  isNativeAdMobConfigured() {
    const cfg = getAdNetworkConfig();
    return Boolean(this._getNativePlugin() && (cfg.bannerId || cfg.interstitialId || cfg.rewardedId));
  }

  isWebAdSenseConfigured(placement = 'home') {
    const cfg = getAdNetworkConfig();
    if (!cfg.adSenseClientId) return false;
    const slot = this.getWebSlotId(placement);
    return Boolean(slot);
  }

  getWebSlotId(placement = 'home') {
    const cfg = getAdNetworkConfig();
    if (!cfg.adSenseClientId) return '';
    if (placement === 'search') return cfg.adSenseSlotSearch || cfg.adSenseSlotFeed || '';
    return cfg.adSenseSlotFeed || cfg.adSenseSlotSearch || '';
  }

  async initialize() {
    if (this._initialized) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const plugin = this._getNativePlugin();
      const cfg = getAdNetworkConfig();

      if (plugin) {
        try {
          if (typeof plugin.initialize === 'function') {
            await plugin.initialize({
              requestTrackingAuthorization: true,
              initializeForTesting: false,
            });
          }
          if (typeof plugin.requestConsentInfo === 'function') {
            await plugin.requestConsentInfo().catch(() => null);
          }
          this._initialized = true;
          return true;
        } catch (err) {
          logger.warn('[AdMobService] Native AdMob init skipped:', err?.message || err);
          return false;
        }
      }

      if (cfg.adSenseClientId && isBrowser) {
        await this.ensureWebAdSenseScript(cfg.adSenseClientId);
        this._initialized = true;
        return true;
      }

      return false;
    })().finally(() => {
      this._initPromise = null;
    });

    return this._initPromise;
  }

  ensureWebAdSenseScript(clientId) {
    if (!isBrowser || !clientId) return Promise.resolve(false);
    if (this._webScriptPromise) return this._webScriptPromise;

    const existing = document.querySelector('script[data-arvdoul-adsense="1"]');
    if (existing) {
      return Promise.resolve(true);
    }

    this._webScriptPromise = new Promise((resolve) => {
      try {
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.arvdoulAdsense = '1';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      } catch {
        resolve(false);
      }
    });

    return this._webScriptPromise;
  }

  async showNativeRewardedAd() {
    const plugin = this._getNativePlugin();
    const cfg = getAdNetworkConfig();
    if (!plugin || !cfg.rewardedId) {
      return { shown: false, rewarded: false, reason: 'native_rewarded_unconfigured' };
    }
    try {
      await this.initialize();
      await plugin.prepareRewardVideoAd({ adId: cfg.rewardedId });
      const rewardItem = await plugin.showRewardVideoAd();
      return {
        shown: true,
        rewarded: Boolean(rewardItem),
        rewardItem: rewardItem || null,
        adUnitId: cfg.rewardedId,
      };
    } catch (err) {
      logger.warn('[AdMobService] Native rewarded ad error:', err?.message || err);
      return { shown: false, rewarded: false, error: err?.message || 'admob_failed' };
    }
  }

  async showNativeInterstitial() {
    const plugin = this._getNativePlugin();
    const cfg = getAdNetworkConfig();
    if (!plugin || !cfg.interstitialId) {
      return { shown: false, reason: 'native_interstitial_unconfigured' };
    }
    try {
      await this.initialize();
      await plugin.prepareInterstitial({ adId: cfg.interstitialId });
      await plugin.showInterstitial();
      return { shown: true, adUnitId: cfg.interstitialId };
    } catch (err) {
      logger.warn('[AdMobService] Native interstitial ad error:', err?.message || err);
      return { shown: false, error: err?.message || 'admob_failed' };
    }
  }
}

export const adMobService = new AdMobService();
export default adMobService;
