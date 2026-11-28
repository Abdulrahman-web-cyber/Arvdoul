// src/app/BrandBootCanvas.jsx
// Matches the pre-React .av-boot shell in index.html so Suspense boundaries and
// auth-guard transitions never flash a blank screen before Splash or routes mount.

import { BRAND_GRADIENT, tokens } from '../design-system/tokens.js';
import { RouteProgressBar } from '../components/Navigation/RouteProgressBar.jsx';

export default function BrandBootCanvas({
  isDark = false,
  showProgress = false,
  label = 'Loading Arvdoul',
}) {
  const bg = isDark ? tokens.color.bg.dark : tokens.color.bg.light;

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center relative select-none"
      style={{ backgroundColor: bg }}
      aria-busy="true"
      aria-label={label}
    >
      {showProgress && <RouteProgressBar isAnimating={true} />}
      <div
        className="w-16 h-16 rounded-[20px] flex items-center justify-center shadow-xl"
        style={{
          background: BRAND_GRADIENT,
          boxShadow: '0 14px 36px rgba(68, 49, 247, 0.28)',
        }}
      >
        <svg viewBox="0 0 64 64" width="38" height="38" fill="none" aria-hidden="true">
          <path
            d="M32 10L51 51H42.6L32 27.6L21.4 51H13L32 10Z"
            fill="#FFFFFF"
          />
          <circle cx="32" cy="44" r="4" fill="#FFFFFF" />
        </svg>
      </div>
    </div>
  );
}
