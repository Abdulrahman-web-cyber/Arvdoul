// src/main.jsx - ULTIMATE FIXED VERSION
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppBootstrap from './app/AppBootstrap.jsx';
import './styles/tailwind.css';

// Initialize app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

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