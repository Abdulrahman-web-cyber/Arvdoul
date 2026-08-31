// src/components/ui/VibeRing.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Avatar } from './Avatar';

export const VibeRing = memo(({
  src,
  name,
  size = 'md',
  hasUnseen = true,
  isLive = false,
  isOwn = false,
  onClick,
  className = '',
  avatarClassName = '',
}) => {
  const sizeMap = {
    sm: { container: 'w-12 h-12', avatar: 'sm', ring: 'p-[2px]' },
    md: { container: 'w-16 h-16', avatar: 'md', ring: 'p-[2.5px]' },
    lg: { container: 'w-20 h-20', avatar: 'lg', ring: 'p-[3px]' },
    xl: { container: 'w-24 h-24', avatar: 'xl', ring: 'p-[3.5px]' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className={cn(
        'relative inline-flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-arvdoul-blue rounded-full select-none cursor-pointer',
        currentSize.container,
        className
      )}
      aria-label={`${name ? name + "'s" : ''} Vibe Story`}
    >
      <div
        className={cn(
          'w-full h-full rounded-full flex items-center justify-center transition-all duration-300',
          currentSize.ring,
          hasUnseen
            ? 'bg-arvdoul-gradient shadow-[0_0_12px_rgba(139,30,243,0.4)]'
            : 'bg-white/15 border border-white/10'
        )}
      >
        <div className="w-full h-full rounded-full bg-arvdoul-bg p-[2px] flex items-center justify-center overflow-hidden">
          <Avatar
            src={src}
            name={name}
            size={currentSize.avatar}
            className={cn('w-full h-full object-cover', avatarClassName)}
          />
        </div>
      </div>

      {isLive && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-600 text-white shadow-md ring-1 ring-white/30">
          Live
        </span>
      )}

      {isOwn && !hasUnseen && (
        <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-arvdoul-blue text-white flex items-center justify-center text-xs font-bold ring-2 ring-arvdoul-bg shadow">
          +
        </span>
      )}
    </motion.button>
  );
});

VibeRing.displayName = 'VibeRing';

export default VibeRing;
