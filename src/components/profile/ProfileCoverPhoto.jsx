/**
 * src/components/profile/ProfileCoverPhoto.jsx - ARVDOUL Profile Cover Photo Component
 * 
 * Displays profile cover photo with gradient fallback.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileCoverPhotoProps
 * @property {string} [coverUrl] - Cover photo URL
 * @property {Function} [onPress] - Click handler
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Camera } from 'lucide-react';

/**
 * ProfileCoverPhoto Component
 * @type {React.FC<ProfileCoverPhotoProps>}
 */
const ProfileCoverPhoto = memo(({
  coverUrl,
  onPress,
  isOwner = false,
  theme = 'light',
}) => {
  const [imageError, setImageError] = useState(false);
  
  // ARVDOUL DNA Gradient
  const gradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
  
  // Handle click
  const handleClick = () => {
    if (onPress) {
      onPress();
    }
  };
  
  // Handle image error
  const handleError = () => {
    setImageError(true);
  };
  
  return (
    <div 
      className="relative h-32 overflow-hidden cursor-pointer"
      onClick={handleClick}
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onKeyDown={onPress ? (e) => e.key === 'Enter' && handleClick() : undefined}
      aria-label={isOwner ? 'Change cover photo' : 'Cover photo'}
    >
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
          style={{ background: gradient }}
        />
      )}
      
      {/* Camera overlay for owner */}
      {isOwner && (
        <div className={cn(
          'absolute inset-0 flex items-center justify-center',
          'bg-black/0 hover:bg-black/40',
          'transition-colors duration-200'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-white/90 dark:bg-gray-800/90',
            'opacity-0 hover:opacity-100 transition-opacity duration-200',
            'shadow-lg'
          )}>
            <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
      )}
    </div>
  );
});

ProfileCoverPhoto.displayName = 'ProfileCoverPhoto';

export default ProfileCoverPhoto;
