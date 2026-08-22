// src/main.jsx - ULTIMATE FIXED VERSION
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppBootstrap from './app/AppBootstrap.jsx';
import './styles/tailwind.css';

// ---------------------------------------------------------------------------
// CRITICAL POLYFILL: window.matchMedia
// Framer Motion's useReducedMotion, ThemeProvider and useMediaQuery call
// window.matchMedia unconditionally. Some embedded webviews / preview iframes
// do not implement it - which previously crashed the Intro screen into its
// error boundary ("Temporary Glitch") on every launch. The index.html inline
// script covers first paint; this covers HMR / any import-order edge case.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = function (query) {
    return {
      matches: false,
      media: query || '',
      onchange: null,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {
        return false;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// PWA SERVICE WORKER LIFECYCLE
// Production: register the SW after first paint (network-first shell + cached
// versioned assets only — see public/sw.js). Dev: never register; instead
// UNREGISTER any stale SW and purge its caches. A v1 SW that cache-first'd
// dev module URLs (/src/**) served stale modules after source rewrites, which
// broke every lazy route with "Failed to fetch dynamically imported module".
// This self-heals browsers that still have the poisoned SW installed.
// ---------------------------------------------------------------------------
function setupServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('✅ ServiceWorker registered (production)');
          // Keep the SW fresh: check for updates when the tab regains focus.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          });
        },
        (err) => console.warn('⚠️ ServiceWorker registration failed:', err)
      );
    });
  } else if (import.meta.env.DEV) {
    // Dev server: stale service workers must never control the preview.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(registrations.map((reg) => reg.unregister()));
    }).then(() => {
      if (window.caches && typeof window.caches.keys === 'function') {
        return window.caches.keys().then((keys) =>
          Promise.all(keys.map((k) => window.caches.delete(k)))
        );
      }
    }).then(() => {
      console.info('🧹 Dev mode: stale service worker unregistered, caches cleared');
    }).catch(() => {});
  }
}
setupServiceWorker();

// Initialize app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Internationalization: resolves the browser language + RTL direction.
// Non-blocking - the app renders immediately with the fallback locale and
// re-renders once i18n is ready (react-i18next handles the re-render).
import('./i18n/index.js')
  .then(({ initI18n }) => initI18n())
  .catch((err) => console.warn('⚠️ i18n init failed (fallback: English):', err.message));

// Remove the temporary loading spinner immediately when React starts rendering
const removeLoadingSpinner = () => {
  const loadingSpinner = document.querySelector('.app-loading');
  if (loadingSpinner) {
    loadingSpinner.style.transition = 'opacity 300ms ease-out';
    loadingSpinner.style.opacity = '0';
    setTimeout(() => {
      if (loadingSpinner.parentNode) {
        loadingSpinner.parentNode.removeChild(loadingSpinner);
      }
    }, 300);
  }
};

try {
  console.log('🚀 Arvdoul starting...');
  
  // Render app
  root.render(
    <React.StrictMode>
      <AppBootstrap />
    </React.StrictMode>
  );
  
  // Remove loading spinner after React renders (max 500ms)
  setTimeout(removeLoadingSpinner, 500);
  
  console.log('✅ Application rendered');
  
} catch (error) {
  console.error('❌ Fatal error:', error);
  
  // Show error screen
  rootElement.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
      color: white;
      padding: 20px;
      text-align: center;
      z-index: 99999;
    ">
      <div>
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #8b5cf6;">
          Critical Error
        </h1>
        <p style="margin-bottom: 24px; opacity: 0.8;">${error.message}</p>
        <button onclick="window.location.reload()" style="
          background: #8b5cf6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">
          Reload App
        </button>
      </div>
    </div>
  `;
}