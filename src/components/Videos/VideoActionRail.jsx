// src/components/Videos/VideoActionRail.jsx - RIGHT ACTION RAIL
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';
import { SPRING_ANIMATION, formatViewCount } from '../../utils/videoUtils';
import PropTypes from 'prop-types';

/**
 * VideoActionRail - Right side action buttons
 * Floating glass design with ARVDOUL styling
 */
const VideoActionRail = memo(({
  likes = 0,
  comments = 0,
  shares = 0,
  isLiked = false,
  isSaved = false,
  onLike,
  onComment,
  onShare,
  onSave,
  onMore,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      {/* Like */}
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={onLike}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
          <Heart
            className={`w-6 h-6 transition-all ${
              isLiked ? 'text-red-500 fill-red-500 scale-110' : 'text-white'
            }`}
          />
        </div>
        <span className="text-white text-xs font-medium">{formatViewCount(likes)}</span>
      </motion.button>

      {/* Comment */}
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={onComment}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <span className="text-white text-xs font-medium">{formatViewCount(comments)}</span>
      </motion.button>

      {/* Share */}
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={onShare}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
          <Share2 className="w-6 h-6 text-white" />
        </div>
        <span className="text-white text-xs font-medium">{formatViewCount(shares)}</span>
      </motion.button>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={onSave}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
          <Bookmark
            className={`w-6 h-6 ${
              isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-white'
            }`}
          />
        </div>
      </motion.button>

      {/* More */}
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={onMore}
        className="flex flex-col items-center gap-1.5 p-2"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
          <MoreHorizontal className="w-6 h-6 text-white" />
        </div>
      </motion.button>
    </div>
  );
});

VideoActionRail.displayName = 'VideoActionRail';
VideoActionRail.propTypes = {
  likes: PropTypes.number,
  comments: PropTypes.number,
  shares: PropTypes.number,
  isLiked: PropTypes.bool,
  isSaved: PropTypes.bool,
  onLike: PropTypes.func,
  onComment: PropTypes.func,
  onShare: PropTypes.func,
  onSave: PropTypes.func,
  onMore: PropTypes.func,
  className: PropTypes.string,
};

export default VideoActionRail;
