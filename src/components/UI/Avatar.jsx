// src/components/UI/Avatar.jsx
import React, { useState, memo, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl, generateDefaultAvatarSvg } from '../../utils/avatarUtils.js';

export const Avatar = memo(({
  src,
  alt = 'User avatar',
  name = 'User',
  userId = '',
  size = 'md',
  className = '',
  status,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);

  const effectiveSrc = useMemo(() => {
    if (hasError || !src || src.includes('default-profile') || src.includes('default_profile')) {
      return generateDefaultAvatarSvg(userId, name);
    }
    return getSafeAvatarUrl(src, name, userId);
  }, [src, hasError, userId, name]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-2xl',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative inline-flex shrink-0 select-none rounded-full overflow-hidden',
        sizeClasses[size] || sizeClasses.md,
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className
      )}
    >
      <img
        src={effectiveSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className="w-full h-full rounded-full object-cover"
        loading="lazy"
      />

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-arvdoul-bg',
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
            status === 'online' && 'bg-emerald-500',
            status === 'busy' && 'bg-rose-500',
            status === 'away' && 'bg-amber-500',
            status === 'offline' && 'bg-slate-500'
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;

