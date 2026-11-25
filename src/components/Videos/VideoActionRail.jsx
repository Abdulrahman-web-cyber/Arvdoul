// src/components/Videos/VideoActionRail.jsx

import { memo } from "react";
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Gift,
  MoreHorizontal,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatViewCount } from "../../utils/videoUtils";
import PropTypes from 'prop-types';

/**
 * VideoActionRail - Right side action buttons
 * Floating glass design with ARVDOUL styling
 */
const VideoActionRail = memo(({
  likes = null,
  comments = null,
  shares = null,
  gifts = null,
  isLiked = false,
  isSaved = false,
  onLike,
  onComment,
  onShare,
  onSave,
  onGift,
  onMore,
  className = '',
}) => {
  const { isDark = true } = useTheme() || {};

  const circleClass = isDark
    ? 'bg-white/10 border-white/10 hover:bg-white/15'
    : 'bg-slate-100 border-slate-200 hover:bg-slate-200/80 shadow-sm';
  const iconColor = isDark ? 'text-white' : 'text-slate-800';
  const countColor = isDark ? 'text-white' : 'text-slate-800';

  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-5 ${className}`}>
      {/* Like */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        onClick={onLike}
        aria-label={isLiked ? "Unlike video" : "Like video"}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors ${
          isLiked
            ? 'bg-red-500/15 border-red-500/40'
            : circleClass
        }`}>
          <Heart
            className={`w-6 h-6 transition-all ${
              isLiked ? 'text-red-500 fill-red-500 scale-110' : iconColor
            }`}
          />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${countColor}`}>{formatViewCount(likes)}</span>
      </motion.button>

      {/* Comment */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        onClick={onComment}
        aria-label="Comment on video"
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors ${circleClass}`}>
          <MessageCircle className={`w-6 h-6 ${iconColor}`} />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${countColor}`}>{formatViewCount(comments)}</span>
      </motion.button>

      {/* Share */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        onClick={onShare}
        aria-label="Share video"
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors ${circleClass}`}>
          <Share2 className={`w-6 h-6 ${iconColor}`} />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${countColor}`}>{formatViewCount(shares)}</span>
      </motion.button>

      {/* Save */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        onClick={onSave}
        aria-label={isSaved ? 'Remove saved video' : 'Save video'}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors ${
          isSaved
            ? 'bg-amber-500/15 border-amber-500/40'
            : circleClass
        }`}>
          <Bookmark
            className={`w-6 h-6 ${
              isSaved ? 'text-amber-500 fill-amber-500' : iconColor
            }`}
          />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${countColor}`}>{isSaved ? 'Saved' : 'Save'}</span>
      </motion.button>

      {/* Gift (optional) */}
      {typeof onGift === 'function' && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.8 }}
          onClick={onGift}
          aria-label="Send coin gift"
          className="flex flex-col items-center gap-1.5 p-2"
        >
          <div className="w-12 h-12 rounded-full backdrop-blur-md border bg-amber-500/15 border-amber-500/35 hover:bg-amber-500/25 flex items-center justify-center transition-colors">
            <Gift className="w-6 h-6 text-amber-500" />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            {gifts == null ? 'Gift' : formatViewCount(gifts)}
          </span>
        </motion.button>
      )}

      {/* More */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        onClick={onMore}
        aria-label="More options"
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors ${circleClass}`}>
          <MoreHorizontal className={`w-6 h-6 ${iconColor}`} />
        </div>
        <span className={`text-xs font-semibold ${countColor}`}>More</span>
      </motion.button>
    </div>
  );
});

VideoActionRail.displayName = 'VideoActionRail';
VideoActionRail.propTypes = {
  likes: PropTypes.number,
  comments: PropTypes.number,
  shares: PropTypes.number,
  gifts: PropTypes.number,
  isLiked: PropTypes.bool,
  isSaved: PropTypes.bool,
  onLike: PropTypes.func,
  onComment: PropTypes.func,
  onShare: PropTypes.func,
  onSave: PropTypes.func,
  onGift: PropTypes.func,
  onMore: PropTypes.func,
  className: PropTypes.string,
};

export default VideoActionRail;
