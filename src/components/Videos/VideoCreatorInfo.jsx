// src/components/Videos/VideoCreatorInfo.jsx

import { memo } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Clock, UserPlus } from 'lucide-react';
import PropTypes from 'prop-types';
import { useTheme } from '../../context/ThemeContext';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { resolveActorName } from '../../services/profileReadModel.js';

/**
 * VideoCreatorInfo - Creator profile card with avatar, name, description
 * Floating glass design with ARVDOUL styling
 */
const VideoCreatorInfo = memo(({
  creator = {},
  title = '',
  description = '',
  isFollowing = false,
  requested = false,
  followBusy = false,
  onFollow,
  onProfileClick,
  className = '',
}) => {
  const { isDark = true } = useTheme() || {};

  return (
    <div className={`max-w-[75%] ${className}`}>
      {/* Creator Info */}
      <div className="flex items-center gap-3 mb-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onProfileClick}
          className="relative shrink-0"
        >
          <LazyImage
            src={creator.avatar || '/assets/default-profile.png'}
            alt={creator.name || creator.username || ''}
            className={`w-12 h-12 rounded-full border-2 object-cover ${
              isDark ? 'border-white/80' : 'border-slate-200 shadow-sm'
            }`}
          />
          {creator.isVerified && (
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ${
                isDark ? 'ring-[#03071B]' : 'ring-[#F6F8FC]'
              }`}
              style={{ background: BRAND_GRADIENT }}
            >
              <BadgeCheck className="w-3 h-3 text-white" />
            </div>
          )}
        </motion.button>

        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {creator.username ? `@${creator.username}` : resolveActorName([creator.name], creator.id)}
          </p>
          {creator.username && creator.name && (
            <p className={`text-xs truncate ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
              {creator.name}
            </p>
          )}
        </div>

        {!isFollowing && onFollow && (
          <motion.button
            type="button"
            whileTap={requested ? {} : { scale: 0.95 }}
            onClick={requested ? undefined : onFollow}
            disabled={requested || followBusy}
            className={`px-4 py-1.5 min-h-[36px] rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 ${
              requested
                ? isDark
                  ? 'bg-white/15 text-white/80'
                  : 'bg-slate-200 text-slate-700'
                : 'text-white shadow-lg'
            }`}
            style={requested ? undefined : { background: BRAND_GRADIENT }}
          >
            {requested ? (
              <>
                <Clock className="w-3.5 h-3.5" />
                Requested
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Follow
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Title */}
      {title && (
        <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white drop-shadow-sm' : 'text-slate-950'}`}>{title}</h3>
      )}

      {/* Description */}
      {description && (
        <p className={`text-sm line-clamp-2 ${isDark ? 'text-white/85 drop-shadow-sm' : 'text-slate-700'}`}>{description}</p>
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
  requested: PropTypes.bool,
  followBusy: PropTypes.bool,
  onFollow: PropTypes.func,
  onProfileClick: PropTypes.func,
  className: PropTypes.string,
};

export default VideoCreatorInfo;
