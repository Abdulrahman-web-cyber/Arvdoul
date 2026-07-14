// src/components/Videos/VideoCreatorInfo.jsx - VIDEO CREATOR INFO
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, UserPlus } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import PropTypes from 'prop-types';

/**
 * VideoCreatorInfo - Creator profile card with avatar, name, description
 * Floating glass design with ARVDOUL styling
 */
const VideoCreatorInfo = memo(({
  creator = {},
  title = '',
  description = '',
  isFollowing = false,
  onFollow,
  onProfileClick,
  className = '',
}) => {
  const { theme } = useTheme();

  return (
    <div className={`max-w-[70%] ${className}`}>
      {/* Creator Info */}
      <div className="flex items-center gap-3 mb-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onProfileClick}
          className="relative"
        >
          <img
            src={creator.avatar || '/assets/default-profile.png'}
            alt={creator.name || 'Creator'}
            className="w-12 h-12 rounded-full border-2 border-white object-cover"
          />
          {creator.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <BadgeCheck className="w-3 h-3 text-white" />
            </div>
          )}
        </motion.button>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            @{creator.username || 'username'}
          </p>
          {creator.name && (
            <p className="text-white/70 text-xs truncate">
              {creator.name}
            </p>
          )}
        </div>

        {!isFollowing && onFollow && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onFollow}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            Follow
          </motion.button>
        )}
      </div>

      {/* Title */}
      {title && (
        <h3 className="text-white font-bold text-base mb-1">{title}</h3>
      )}

      {/* Description */}
      {description && (
        <p className="text-white/80 text-sm line-clamp-2">{description}</p>
      )}
    </div>
  );
});

VideoCreatorInfo.displayName = 'VideoCreatorInfo';
VideoCreatorInfo.propTypes = {
  creator: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    isVerified: PropTypes.bool,
  }),
  title: PropTypes.string,
  description: PropTypes.string,
  isFollowing: PropTypes.bool,
  onFollow: PropTypes.func,
  onProfileClick: PropTypes.func,
  className: PropTypes.string,
};

export default VideoCreatorInfo;
