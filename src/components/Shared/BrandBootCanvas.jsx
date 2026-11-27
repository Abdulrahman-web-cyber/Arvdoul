// src/components/Shared/BrandBootCanvas.jsx
//
// Pixel-identical React counterpart to index.html's `.av-boot` pre-React shell.
// Rendered by Suspense/guard boundaries while chunks or auth settle so users
// never experience a blank screen between cold paint, SplashScreen, and the
// resolved destination route.

import { useId } from 'react';
import { LOGO, WORDMARK } from './ArvdoulBrandAssets.js';
import { tokens } from '../../design-system/tokens.js';

export default function BrandBootCanvas({
  isDark = true,
  label = 'Loading Arvdoul',
  showWordmark = true,
  embedded = false,
  children = null,
}) {
  const gradId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bg = isDark ? tokens.color.bg.dark : tokens.color.bg.light;
  const fg = isDark ? '#F3F5FF' : '#0C1130';

  return (
    <div
      className={
        embedded
          ? 'relative w-full min-h-[70dvh] flex items-center justify-center overflow-hidden select-none'
          : 'fixed inset-0 z-[9990] w-full min-h-[100dvh] flex items-center justify-center overflow-hidden select-none'
      }
      style={{ backgroundColor: bg, color: fg }}
      aria-busy="true"
      aria-label={label}
    >
      {children}
      <div
        className="flex flex-col items-center w-[min(84%,360px)]"
        style={{
          gap: 'clamp(20px, 4.5dvh, 28px)',
          transform: embedded ? undefined : 'translateY(-4dvh)',
        }}
      >
        <svg
          viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`}
          aria-hidden="true"
          focusable="false"
          style={{
            display: 'block',
            width: embedded ? 'clamp(76px, 20vw, 112px)' : 'clamp(104px, 29vw, 168px)',
            height: 'auto',
            aspectRatio: '1 / 1',
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient
              id={gradId}
              gradientUnits="userSpaceOnUse"
              x1={LOGO.gradient.x1}
              y1={LOGO.gradient.y1}
              x2={LOGO.gradient.x2}
              y2={LOGO.gradient.y2}
            >
              {LOGO.gradient.stops.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
          </defs>
          <g fill="none" stroke={`url(#${gradId})`} strokeLinecap="round" strokeLinejoin="round">
            <path d={LOGO.orbit.d} strokeWidth={LOGO.orbit.width} />
            <path d={LOGO.monogram.d} strokeWidth={LOGO.monogram.width} />
            <path d={LOGO.crossbar.d} strokeWidth={LOGO.crossbar.width} />
          </g>
        </svg>

        {showWordmark && (
          <svg
            viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
            aria-hidden="true"
            focusable="false"
            style={{
              display: 'block',
              width: embedded ? 'clamp(120px, 34vw, 168px)' : 'clamp(150px, 46vw, 240px)',
              height: 'auto',
              overflow: 'visible',
            }}
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth={WORDMARK.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {WORDMARK.letters.map((letter) => (
                <g key={letter.ch + letter.x} transform={`translate(${letter.x} 0)`}>
                  {letter.paths.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
