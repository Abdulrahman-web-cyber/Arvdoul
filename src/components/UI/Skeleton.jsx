// src/components/UI/Skeleton.jsx

import { cn } from '../../lib/utils';

/**
 * `height`/`width` are applied as inline styles. Callers pass numbers (a pixel
 * value) or CSS strings; without this the props were dropped and every
 * `<Skeleton height={160} />` rendered a collapsed zero-height block.
 */
export const Skeleton = ({ className, height, width, style, ...props }) => (
  <div
    className={cn('animate-pulse bg-gray-200 dark:bg-gray-800 rounded', className)}
    style={{ height, width, ...style }}
    {...props}
  />
);

export default Skeleton;
