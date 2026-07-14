// src/components/Videos/VideoBottomSheet.jsx - ARVDOUL VIDEO BOTTOM SHEET
// Share and save options bottom sheet

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Bookmark,
  Download,
  Flag,
  Copy,
  Check,
  MessageCircle,
  Twitter,
  Facebook,
  Link as LinkIcon,
  Plus,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SPRING_ANIMATION, REPORT_REASONS } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoBottomSheet - Share/save options with multiple destinations
 */
const VideoBottomSheet = memo(({
  isOpen = false,
  onClose,
  video,
}) => {
  const { theme } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Handle copy link
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/videos/${video?.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  // Handle native share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video?.title || 'Check out this video',
          text: video?.description || '',
          url: `${window.location.origin}/videos/${video?.id}`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Handle external share
  const handleExternalShare = (platform) => {
    const url = encodeURIComponent(`${window.location.origin}/videos/${video?.id}`);
    const text = encodeURIComponent(video?.title || 'Check out this video!');
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!video?.videoUrl) {
      toast.error('Download not available');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `${video.title || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started!');
      onClose();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  // Handle save to watch later
  const handleSave = () => {
    toast.success('Added to Watch Later');
    onClose();
  };

  // Handle report
  const handleReport = () => {
    setShowReportModal(true);
  };

  const submitReport = () => {
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }
    toast.success('Report submitted. Thank you!');
    setShowReportModal(false);
    setReportReason('');
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_ANIMATION.bottomSheet}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl backdrop-blur-2xl bg-gray-900/95 border-t border-white/10 p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-lg">Share</h2>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-full bg-white/10"
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Copy Link */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                {copied ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <LinkIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="text-white/80 text-xs">
                {copied ? 'Copied!' : 'Copy Link'}
              </span>
            </motion.button>

            {/* Twitter */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('twitter')}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center">
                <Twitter className="w-6 h-6 text-[#1DA1F2]" />
              </div>
              <span className="text-white/80 text-xs">Twitter</span>
            </motion.button>

            {/* Facebook */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('facebook')}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-[#4267B2]/20 flex items-center justify-center">
                <Facebook className="w-6 h-6 text-[#4267B2]" />
              </div>
              <span className="text-white/80 text-xs">Facebook</span>
            </motion.button>

            {/* WhatsApp */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('whatsapp')}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#25D366]" />
              </div>
              <span className="text-white/80 text-xs">WhatsApp</span>
            </motion.button>
          </div>

          {/* More Options */}
          <div className="space-y-2">
            {/* Share Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
            >
              <Share2 className="w-5 h-5" />
              <span>Share to...</span>
            </motion.button>

            {/* Save to Watch Later */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Clock className="w-5 h-5 text-yellow-400" />
              <span>Save to Watch Later</span>
              <Plus className="w-5 h-5 ml-auto" />
            </motion.button>

            {/* Save to Collection */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Bookmark className="w-5 h-5 text-purple-400" />
              <span>Add to Collection</span>
              <Plus className="w-5 h-5 ml-auto" />
            </motion.button>

            {/* Download */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Download className="w-5 h-5 text-green-400" />
              <span>Download Video</span>
            </motion.button>

            {/* Report */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleReport}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-red-400 transition-colors"
            >
              <Flag className="w-5 h-5" />
              <span>Report Video</span>
            </motion.button>
          </div>

          {/* Report Modal */}
          <AnimatePresence>
            {showReportModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-t-3xl bg-gray-900/98 backdrop-blur-2xl p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Report Video
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowReportModal(false)}
                    className="p-2 rounded-full bg-white/10"
                  >
                    <X className="w-5 h-5 text-white" />
                  </motion.button>
                </div>

                <p className="text-white/60 mb-4">
                  Help us understand what's wrong with this video
                </p>

                <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                  {REPORT_REASONS.map((reason) => (
                    <motion.button
                      key={reason.value}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setReportReason(reason.value)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors ${
                        reportReason === reason.value
                          ? 'bg-purple-500/30 border border-purple-500/50 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          reportReason === reason.value
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-white/30'
                        }`}
                      >
                        {reportReason === reason.value && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span>{reason.label}</span>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitReport}
                  disabled={!reportReason}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold disabled:opacity-50"
                >
                  Submit Report
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

VideoBottomSheet.displayName = 'VideoBottomSheet';

VideoBottomSheet.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  video: PropTypes.object,
};

export default VideoBottomSheet;
