/**
 * src/components/profile/ProfileAvatar.jsx - ARVDOUL Profile Avatar Component
 * 
 * Displays user avatar with optional level badge.
 * 
 * @component
 */

import React, { memo, useCallback, useState } from 'react';
import { cn } from '../../lib/utils';
import { Camera, BadgeCheck } from 'lucide-react';

/**
 * ProfileAvatar Component
 * @param {Object} props
 */
const ProfileAvatar = ({
  src,
  name = 'User',
  size = 96,
  level = null,
  onPress,
  isOwner = false,
  verified = false,
  theme = 'light',
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Generate initials
  const getInitials = useCallback((name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, []);
  
  // Generate gradient based on name
  const getGradient = useCallback((name) => {
    const gradients = [
      'from-purple-500 to-blue-500',
      'from-pink-500 to-rose-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-amber-500',
      'from-indigo-500 to-purple-500',
      'from-cyan-500 to-blue-500',
      'from-rose-500 to-pink-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  }, []);
  
  const handleError = useCallback(() => {
    setImageError(true);
  }, []);
  
  const handleClick = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);
  
  const initials = getInitials(name);
  const gradient = getGradient(name);
  
  // Size classes
  const borderSize = size >= 100 ? 4 : size >= 60 ? 3 : 2;
  const badgeSize = Math.max(size * 0.3, 20);
  const iconSize = Math.max(size * 0.15, 12);

  return (
    <div className="relative inline-block">
      {/* Avatar Container */}
      <button
        onClick={handleClick}
        disabled={!onPress}
        className={cn(
          'relative rounded-full overflow-hidden',
          'border-[3px] border-white dark:border-gray-900',
          'shadow-lg',
          'hover:scale-105 transition-transform',
          onPress && 'cursor-pointer'
        )}
        style={{
          width: size,
          height: size,
          minWidth: size,
        }}
      >
        {/* Image or Initials */}
        {src && !imageError ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        ) : (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              'bg-gradient-to-br',
              gradient
            )}
          >
            <span
              className="text-white font-bold"
              style={{ fontSize: size * 0.35 }}
            >
              {initials}
            </span>
          </div>
        )}
        
        {/* Verified Badge */}
        {verified && (
          <div
            className={cn(
              'absolute bottom-0 right-0',
              'bg-blue-500 rounded-full',
              'flex items-center justify-center',
              'text-white'
            )}
            style={{
              width: badgeSize * 0.5,
              height: badgeSize * 0.5,
              minWidth: 16,
              minHeight: 16,
            }}
          >
            <BadgeCheck className="w-full h-full" />
          </div>
        )}
        
        {/* Owner Edit Overlay */}
        {isOwner && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Camera className="text-white" style={{ width: iconSize, height: iconSize }} />
          </div>
        )}
      </button>
      
      {/* Level Badge */}
      {level && level > 0 && (
        <div
          className={cn(
            'absolute -bottom-1 -right-1',
            'rounded-full',
            'bg-gradient-to-br from-purple-500 to-blue-500',
            'text-white font-bold',
            'flex items-center justify-center',
            'shadow-md',
            'border-2 border-white dark:border-gray-900'
          )}
          style={{
            width: badgeSize,
            height: badgeSize,
            minWidth: 20,
            minHeight: 20,
            fontSize: Math.max(size * 0.1, 8),
          }}
        >
          {level}
        </div>
      )}
    </div>
  );
};

export default memo(ProfileAvatar);
