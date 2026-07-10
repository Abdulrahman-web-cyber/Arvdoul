/**
 * src/components/profile/ProfileCoverPhoto.jsx - ARVDOUL Profile Cover Photo Component
 * 
 * Displays and manages profile cover photo.
 * 
 * @component
 */

import React, { memo, useCallback, useState } from 'react';
import { cn } from '../../lib/utils';
import { Camera, Upload } from 'lucide-react';

/**
 * ProfileCoverPhoto Component
 * @param {Object} props
 */
const ProfileCoverPhoto = ({
  coverUrl,
  onPress,
  isOwner = false,
  theme = 'light',
  height = 200,
}) => {
  const [imageError, setImageError] = useState(false);
  
  // ARVDOUL gradient placeholder
  const gradientPlaceholder = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
  
  const handleClick = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  const handleError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        'bg-gray-200 dark:bg-gray-800'
      )}
      style={{ height }}
    >
      {/* Cover Image or Gradient */}
      {coverUrl && !imageError ? (
        <img
          src={coverUrl}
          alt="Cover"
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <div
          className="w-full h-full"
          style={{ background: gradientPlaceholder }}
        />
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      
      {/* Owner Edit Button */}
      {isOwner && (
        <button
          onClick={handleClick}
          className={cn(
            'absolute bottom-3 right-3',
            'p-2 rounded-full',
            'bg-black/50 hover:bg-black/70',
            'text-white transition-colors',
            'flex items-center gap-1.5',
            'text-sm font-medium'
          )}
        >
          <Camera className="w-4 h-4" />
          <span>Edit</span>
        </button>
      )}
      
      {/* View Indicator (Non-owner) */}
      {!isOwner && (
        <button
          onClick={handleClick}
          className={cn(
            'absolute bottom-3 right-3',
            'p-2 rounded-full opacity-0 hover:opacity-100',
            'bg-black/50 transition-opacity',
            'text-white'
          )}
          aria-label="View cover photo"
        >
          <Upload className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default memo(ProfileCoverPhoto);
