/**
 * Bespoke Per-Level Architectural Numeral Emblem (Levels 1–100+).
 *
 * Every integer level renders a distinct sculpted geometric housing,
 * noble palette (independent of the Arvdoul brand gradient), and
 * precision micro-facets/pips so no two consecutive levels look identical,
 * with explicit `Lvl {n}` labeling across compact and full sizes.
 *
 * Strictly zero fabricated levels: renders null when level is absent or invalid.
 *
 * @component
 */

import { memo, useMemo } from 'react';
import { cn } from '../../lib/utils';

// Curated noble palettes by decade (0 = Lvl 1-9 ... 9 = Lvl 90-100+), intentionally
// distinct from the primary Arvdoul brand gradient.
const NOBLE_PALETTES = [
  // 1-9: Verdant Mint & Slate
  {
    light: { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', accent: '#16A34A' },
    dark: { bg: '#052E22', border: '#16A34A', text: '#A7F3D0', accent: '#34D399' },
  },
  // 10-19: Cerulean Sea
  {
    light: { bg: '#F0F9FF', border: '#7DD3FC', text: '#075985', accent: '#0284C7' },
    dark: { bg: '#072238', border: '#38BDF8', text: '#BAE6FD', accent: '#38BDF8' },
  },
  // 20-29: Cobalt Herald
  {
    light: { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', accent: '#2563EB' },
    dark: { bg: '#0D1C3D', border: '#60A5FA', text: '#DBEAFE', accent: '#60A5FA' },
  },
  // 30-39: Teal Jadeite
  {
    light: { bg: '#F0FDFA', border: '#5EEAD4', text: '#115E59', accent: '#0D9488' },
    dark: { bg: '#062626', border: '#2DD4BF', text: '#CCFBF1', accent: '#2DD4BF' },
  },
  // 40-49: Warm Amber Bronze
  {
    light: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', accent: '#B45309' },
    dark: { bg: '#2B1B05', border: '#EAB308', text: '#FDE68A', accent: '#FBBF24' },
  },
  // 50-59: Vermilion Coral
  {
    light: { bg: '#FFF1F2', border: '#FDA4AF', text: '#9F1239', accent: '#E11D48' },
    dark: { bg: '#300B16', border: '#FB7185', text: '#FECDD3', accent: '#FB7185' },
  },
  // 60-69: Orchid Magenta
  {
    light: { bg: '#FDF4FF', border: '#F0ABFC', text: '#86198F', accent: '#A21CAF' },
    dark: { bg: '#2B0933', border: '#E879F9', text: '#F5D0FE', accent: '#E879F9' },
  },
  // 70-79: Imperial Ochre
  {
    light: { bg: '#FEFCE8', border: '#FDE047', text: '#854D0E', accent: '#CA8A04' },
    dark: { bg: '#282004', border: '#FACC15', text: '#FEF08A', accent: '#FACC15' },
  },
  // 80-89: Silver Platinum
  {
    light: { bg: '#F8FAFC', border: '#CBD5E1', text: '#0F172A', accent: '#475569' },
    dark: { bg: '#131C31', border: '#94A3B8', text: '#F1F5F9', accent: '#CBD5E1' },
  },
  // 90-100: Sovereign Crown Gold
  {
    light: { bg: '#FFF7ED', border: '#FDBA74', text: '#9A3412', accent: '#EA580C' },
    dark: { bg: '#2C1504', border: '#FBBF24', text: '#FEF3C7', accent: '#EAB308' },
  },
];

// Sculpted SVG clip/polygon silhouettes per decade
function getFrameGeometry(level) {
  const decade = Math.min(9, Math.max(0, Math.floor((level - 1) / 10)));
  const unit = level % 10; // 0..9 within decade shifts internal facet/pip count & angle
  const notch = 4 + (unit % 3) * 1.5;

  switch (decade) {
    case 0: // Soft chamfered shield
      return `M ${notch} 2 L ${36 - notch} 2 L 38 ${notch + 2} L 38 30 L 20 38 L 2 30 L 2 ${notch + 2} Z`;
    case 1: // Asymmetric bevel plate
      return `M 8 2 L 34 2 L 38 8 L 38 32 L 32 38 L 6 38 L 2 32 L 2 8 Z`;
    case 2: // Heraldic crest
      return `M 4 4 Q 20 0 36 4 L 38 24 Q 20 40 2 24 Z`;
    case 3: // Cut hex
      return `M 20 1.5 L 36.5 10.5 L 36.5 29.5 L 20 38.5 L 3.5 29.5 L 3.5 10.5 Z`;
    case 4: // Precision octagon
      return `M 12 2 L 28 2 L 38 12 L 38 28 L 28 38 L 12 38 L 2 28 L 2 12 Z`;
    case 5: // Royal diamond-chamfer
      return `M 20 1.5 L 37 12 L 34 32 L 20 38.5 L 6 32 L 3 12 Z`;
    case 6: // Double-notched sovereign
      return `M 10 2 L 20 5 L 30 2 L 38 10 L 35 20 L 38 30 L 20 38.5 L 2 30 L 5 20 L 2 10 Z`;
    case 7: // Fluted dodecahedron hint
      return `M 14 2 L 26 2 L 36 9 L 38 20 L 36 31 L 26 38 L 14 38 L 4 31 L 2 20 L 4 9 Z`;
    case 8: // Architectural monolith seal
      return `M 6 2 L 34 2 L 38 6 L 38 26 L 28 38 L 12 38 L 2 26 L 2 6 Z`;
    default: // Apex 90-100 Crowned Star Seal
      return `M 20 1 L 27 5 L 36 5 L 38 14 L 35 20 L 38 28 L 28 36 L 20 39 L 12 36 L 2 28 L 5 20 L 2 14 L 4 5 L 13 5 Z`;
  }
}

const SIZE_CLASSES = {
  xs: { inlineHeight: 'h-6 px-1.5 gap-1 text-[10px]', crestBox: 'w-4 h-4', box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { inlineHeight: 'h-7 px-2 gap-1.5 text-[11.5px]', crestBox: 'w-[18px] h-[18px]', box: 'w-7 h-7', text: 'text-[11px]' },
  md: { box: 'w-11 h-11', text: 'text-[13px]' },
  lg: { box: 'w-14 h-14', text: 'text-base' },
};

const LevelNumeralBadge = memo(({
  level = null,
  theme = 'light',
  size = 'md',
  className = '',
  showPrefix = true,
  onClick,
  title,
}) => {
  const num = Number(level);
  const valid = Number.isFinite(num) && num > 0;
  const intLevel = valid ? Math.floor(num) : null;

  const visual = useMemo(() => {
    if (!intLevel) return null;
    const decade = Math.min(9, Math.max(0, Math.floor((intLevel - 1) / 10)));
    const unit = intLevel % 10;
    const paletteSet = NOBLE_PALETTES[decade];
    const palette = theme === 'dark' ? paletteSet.dark : paletteSet.light;
    const pathD = getFrameGeometry(intLevel);
    // Micro-pip coordinates vary per unit digit so each level number carries unique facet pips
    const pipCount = Math.min(4, 1 + (unit % 4));
    const pips = [];
    for (let i = 0; i < pipCount; i++) {
      const offset = (i - (pipCount - 1) / 2) * 5.2;
      pips.push({ cx: 20 + offset, cy: 33.2 });
    }
    return { palette, pathD, pips, unit };
  }, [intLevel, theme]);

  if (!intLevel || !visual) return null;

  const sizeCfg = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isCompact = size === 'xs' || size === 'sm';
  const { palette, pathD, pips } = visual;

  const svgCrest = (boxClass, strokeScaled) => (
    <svg
      viewBox="0 0 40 40"
      className={cn(boxClass, 'overflow-visible shrink-0')}
      aria-hidden="true"
    >
      <path
        d={pathD}
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth={strokeScaled}
        strokeLinejoin="round"
      />
      {intLevel >= 10 && (
        <path
          d={pathD}
          fill="none"
          stroke={palette.accent}
          strokeOpacity="0.34"
          strokeWidth="0.95"
          transform="translate(20,20) scale(0.82) translate(-20,-20)"
        />
      )}
      {pips.map((p, idx) => (
        <circle
          key={idx}
          cx={p.cx}
          cy={p.cy}
          r={isCompact ? 1.35 : 1.15}
          fill={palette.accent}
          opacity="0.9"
        />
      ))}
    </svg>
  );

  // Compact sizes render the sculpted level crest paired with crisp "Lvl {n}" lockup
  // so the number is always immediately recognizable as a user level (e.g. Lvl 1).
  const inner = isCompact && showPrefix ? (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg border shrink-0 select-none font-display font-bold leading-none tabular-nums tracking-tight',
        sizeCfg.inlineHeight,
        className
      )}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        color: palette.text,
      }}
      aria-label={`Level ${intLevel}`}
      title={title || `Civic Level ${intLevel}`}
    >
      {svgCrest(sizeCfg.crestBox, '2.4')}
      <span className="inline-flex items-baseline gap-0.5">
        <span className="text-[9.5px] font-semibold opacity-80">Lvl</span>
        <span>{intLevel}</span>
      </span>
    </span>
  ) : (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 select-none',
        sizeCfg.box,
        className
      )}
      aria-label={`Level ${intLevel}`}
      title={title || `Civic Level ${intLevel}`}
    >
      {svgCrest('w-full h-full', intLevel >= 50 ? '2' : '1.75')}

      <span
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center font-display font-extrabold leading-none tabular-nums tracking-tight',
          sizeCfg.text
        )}
        style={{ color: palette.text, paddingBottom: showPrefix ? '1px' : '2px' }}
      >
        {showPrefix && (
          <span className="text-[7.5px] font-bold tracking-wide opacity-80 leading-none mb-[1px]">
            Lvl
          </span>
        )}
        <span>{intLevel}</span>
      </span>
    </span>
  );

  if (typeof onClick === 'function') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Level ${intLevel} progression`}
        className="relative inline-flex items-center justify-center rounded-lg cursor-pointer transition-transform active:scale-95 after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
      >
        {inner}
      </button>
    );
  }

  return inner;
});

LevelNumeralBadge.displayName = 'LevelNumeralBadge';

export default LevelNumeralBadge;
