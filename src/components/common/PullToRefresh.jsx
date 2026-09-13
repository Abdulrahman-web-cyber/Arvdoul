import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export function PullToRefresh({
  children,
  onRefresh,
  className = '',
  threshold = 70,
  disabled = false,
}) {
  const { containerRef, pullDistance, isRefreshing, canRelease } = usePullToRefresh(
    onRefresh,
    { threshold, disabled }
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto overscroll-y-contain ${className}`}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-center transition-transform z-20"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
          opacity: pullDistance > 10 ? Math.min(1, pullDistance / 50) : 0,
        }}
        aria-hidden="true"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-md border border-purple-200 dark:border-purple-900/50">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowDown
              className="h-4 w-4 transition-transform duration-150"
              style={{
                transform: canRelease ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          )}
        </div>
      </div>

      {/* Content wrapper */}
      <div
        style={{
          transform: `translateY(${pullDistance * 0.5}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
