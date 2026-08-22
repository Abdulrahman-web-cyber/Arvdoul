// src/components/ui/Avatar.jsx
/**
 * ARVDOUL DESIGN SYSTEM — AVATAR PRIMITIVE
 * Guide Part II: image/initials/fallback variants, status indicators
 * (online/offline/away/busy), size variants (xs→2xl), badge overlays
 * (verified / creator), keyboard-friendly click, alt text.
 */

import React, { useState, memo, useCallback } from 'react';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-2xl',
};

const statusClasses = {
  online: 'bg-emerald-500',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
  offline: 'bg-slate-500',
};

/**
 * @param {Object} props
 * @param {string} [props.src] - image URL
 * @param {string} [props.alt='User avatar'] - image alt text
 * @param {string} [props.name='User'] - display name (initials fallback)
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'2xl'} [props.size='md']
 * @param {'online'|'offline'|'away'|'busy'} [props.status] - presence dot
 * @param {'verified'|'creator'} [props.badge] - badge overlay
 * @param {Function} [props.onClick]
 * @param {string} [props.role] - override interactive role (default button when onClick)
 */
export const Avatar = memo(({
  src,
  alt = 'User avatar',
  name = 'User',
  size = 'md',
  className = '',
  status,
  badge,
  onClick,
  role,
}) => {
  const [hasError, setHasError] = useState(false);

  const handleClick = useCallback(
    (e) => {
      if (onClick) {
        e.preventDefault();
        onClick(e);
      }
    },
    [onClick]
  );

  const initial = (name || 'U').charAt(0).toUpperCase();
  const dotSize = size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const badgeSize = size === 'xs' || size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      role={onClick ? role || 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      aria-label={onClick ? alt : undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none rounded-full',
        sizeClasses[size] || sizeClasses.md,
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        className
      )}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className="w-full h-full rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden="true"
          className="w-full h-full rounded-full bg-gradient-to-br from-arvdoul-purple to-arvdoul-blue text-white font-semibold flex items-center justify-center shadow-inner"
        >
          {initial}
        </div>
      )}

      {/* Presence status dot (bottom-right) */}
      {status && (
        <span
          aria-label={`Status: ${status}`}
          role="status"
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-arvdoul-bg',
            dotSize,
            statusClasses[status] || 'bg-slate-500'
          )}
        />
      )}

      {/* Badge overlay: verified / creator. Positioned bottom-right; when a
          status dot is also present, the badge shifts to the bottom-left so
          the two indicators never collide. */}
      {badge && (
        <span
          role="img"
          aria-label={badge === 'verified' ? 'Verified account' : 'Creator'}
          className={cn(
            'absolute flex items-center justify-center rounded-full',
            badgeSize,
            status ? '-bottom-0 -left-0' : 'bottom-0 right-0',
            badge === 'verified'
              ? 'bg-blue-500 text-white ring-2 ring-arvdoul-bg'
              : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white ring-2 ring-arvdoul-bg'
          )}
        >
          {badge === 'verified' ? (
            <BadgeCheck className="w-full h-full p-0.5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-full h-full p-0.5" aria-hidden="true" />
          )}
        </span>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;
