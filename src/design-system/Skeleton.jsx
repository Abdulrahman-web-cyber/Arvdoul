/**
 * src/design-system/Skeleton.jsx
 * ARVDOUL DESIGN SYSTEM — SKELETON LOADING PLACEHOLDER
 *
 * Shape variants: text, circle, rect, card. Pulse respects
 * prefers-reduced-motion via the global tokens.css kill-switch
 * (animation-duration collapses to 0.01ms).
 */

import React from 'react';
import { cn } from '../lib/utils.js';

const SHAPES = {
  text: 'h-3.5 rounded-md',
  circle: 'rounded-full',
  rect: 'rounded-xl',
  card: 'rounded-2xl',
};

/**
 * @param {Object} props
 * @param {'text'|'circle'|'rect'|'card'} [props.shape='rect']
 * @param {string} [props.width] - tailwind width class (e.g. 'w-full', 'w-24')
 * @param {string} [props.height] - tailwind height class (overrides shape default)
 * @param {string} [props.className]
 * @param {boolean} [props.animate=true]
 */
export default function Skeleton({ shape = 'rect', width = 'w-full', height, className, animate = true }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-slate-200 dark:bg-white/10',
        animate && 'animate-pulse',
        SHAPES[shape],
        width,
        height,
        className
      )}
    />
  );
}

/**
 * A ready-made skeleton block that mirrors a feed card layout.
 * @param {Object} props - { lines, className }
 */
export function CardSkeleton({ lines = 3, className }) {
  return (
    <div className={cn('p-4 space-y-3 rounded-2xl border border-slate-200 dark:border-white/10', className)}>
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" width="w-10" height="h-10" />
        <div className="flex-1 space-y-1.5">
          <Skeleton shape="text" width="w-1/3" />
          <Skeleton shape="text" width="w-1/4" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} shape="text" width={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}
