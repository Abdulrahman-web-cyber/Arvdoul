// src/components/Videos/VideoBottomSheet.jsx
//
// Share and save options bottom sheet

import React, { useState, useEffect, memo } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { SPRING_ANIMATION, REPORT_REASONS, generateShareUrl } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoBottomSheet - Share/save options with multiple destinations
 */
const VideoBottomSheet = memo(({
  isOpen = false,
  onClose,
  video,
  initialView = 'share',
}) => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(initialView === 'report');
  const [reportReason, setReportReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);

  // Report opened directly from the feed (VideoCard → onReport) should land on
  // the report step, not the share step.
  useEffect(() => {
    if (isOpen && initialView === 'report') setShowReportModal(true);
  }, [isOpen, initialView, video?.id]);

  if (!isOpen) return null;

  // Handle copy link
  const handleCopyLink = async () => {
    const url = generateShareUrl(video?.id);
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
          url: generateShareUrl(video?.id),
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
    const url = encodeURIComponent(generateShareUrl(video?.id));
    const text = encodeURIComponent(video?.title || 'Check out this video!');
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'noopener,noreferrer,width=600,height=400');
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

  // Handle save to watch later — persistence: optimistic local store +
  // server-side saved_videos record (best-effort with rollback on failure).
  const handleSave = async () => {
    if (!video?.id || saving) return;
    setSaving(true);
    const { useVideoStore } = await import('../../store/videoStore.js');
    const store = useVideoStore.getState();
    const wasSaved = store.isInWatchLater ? store.isInWatchLater(video.id) : false;

    // Optimistic local update (Zustand persist → localStorage).
    if (wasSaved) store.removeFromWatchLater(video.id);
    else store.addToWatchLater(video);

    try {
      const { getVideoService } = await import('../../services/videoService.js');
      const service = getVideoService();
      if (wasSaved) {
        await service.unsaveVideo(video.id, user?.uid || '');
      } else {
        await service.saveVideo(video.id, user?.uid || '');
      }
      toast.success(wasSaved ? 'Removed from Watch Later' : 'Added to Watch Later');
    } catch (err) {
      // Rollback local state on server failure.
      if (wasSaved) store.addToWatchLater(video);
      else store.removeFromWatchLater(video.id);
      toast.error(err?.message || 'Could not update Watch Later. Are you signed in?');
    } finally {
      setSaving(false);
      onClose();
    }
  };

  // Handle report modal open
  const handleReport = () => {
    setShowReportModal(true);
  };

  // Add to a real collection: load the user's collections, allow creating one,
  // then persist the video as a collection item via collectionsService.
  const openCollectionPicker = async () => {
    if (!user?.uid) {
      toast.error('Sign in to save to a collection');
      return;
    }
    setShowCollectionPicker(true);
    setCollectionsLoading(true);
    try {
      const { getCollectionsService } = await import('../../services/collectionsService.js');
      const res = await getCollectionsService().getCollections(user.uid);
      setCollections(res?.collections || []);
    } catch (err) {
      toast.error('Could not load your collections');
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const addToCollection = async (collectionId) => {
    if (!user?.uid || !video?.id || collectionBusy) return;
    setCollectionBusy(true);
    try {
      const { getCollectionsService } = await import('../../services/collectionsService.js');
      await getCollectionsService().addToCollection(user.uid, collectionId, {
        id: video.id,
        title: video.title || video.caption || '',
        videoUrl: video.videoUrl || video.url || '',
        thumbnail: video.thumbnailUrl || video.thumbnail || '',
        type: 'video',
      });
      toast.success('Added to collection');
      setShowCollectionPicker(false);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not add to collection');
    } finally {
      setCollectionBusy(false);
    }
  };

  const createCollectionAndAdd = async () => {
    const name = newCollectionName.trim();
    if (!name || !user?.uid || collectionBusy) return;
    setCollectionBusy(true);
    try {
      const { getCollectionsService } = await import('../../services/collectionsService.js');
      const svc = getCollectionsService();
      const created = await svc.createCollection(user.uid, { name });
      if (!created?.collectionId) throw new Error('Collection could not be created');
      await svc.addToCollection(user.uid, created.collectionId, {
        id: video.id,
        title: video.title || video.caption || '',
        videoUrl: video.videoUrl || video.url || '',
        thumbnail: video.thumbnailUrl || video.thumbnail || '',
        type: 'video',
      });
      toast.success(`Added to “${name}”`);
      setNewCollectionName('');
      setShowCollectionPicker(false);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not create collection');
    } finally {
      setCollectionBusy(false);
    }
  };

  // Handle report — submission to the reportVideo Cloud Function.
  const submitReport = async () => {
    if (!video?.id) return;
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }
    if (reporting) return;
    setReporting(true);
    try {
      const { getVideoService } = await import('../../services/videoService.js');
      await getVideoService().reportVideo(video.id, reportReason);
      toast.success('Report submitted. Our moderation team will review it.');
      setShowReportModal(false);
      setReportReason('');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Report failed to submit. Please try again.');
    } finally {
      setReporting(false);
    }
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
          className={`absolute bottom-0 left-0 right-0 rounded-t-3xl backdrop-blur-2xl p-6 border-t ${isDark ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-gray-200'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Share</h2>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={`p-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-700'}`} />
            </motion.button>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Copy Link */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} transition-colors`}
            >
              <div className={`w-14 h-14 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'} flex items-center justify-center`}>
                {copied ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <LinkIcon className={`w-6 h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                )}
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-600'} text-xs`}>
                {copied ? 'Copied!' : 'Copy Link'}
              </span>
            </motion.button>

            {/* Twitter */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('twitter')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} transition-colors`}
            >
              <div className="w-14 h-14 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center">
                <Twitter className="w-6 h-6 text-[#1DA1F2]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-600'} text-xs`}>Twitter</span>
            </motion.button>

            {/* Facebook */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('facebook')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} transition-colors`}
            >
              <div className="w-14 h-14 rounded-full bg-[#4267B2]/20 flex items-center justify-center">
                <Facebook className="w-6 h-6 text-[#4267B2]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-600'} text-xs`}>Facebook</span>
            </motion.button>

            {/* WhatsApp */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('whatsapp')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} transition-colors`}
            >
              <div className="w-14 h-14 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#25D366]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-600'} text-xs`}>WhatsApp</span>
            </motion.button>
          </div>

          {/* More Options */}
          <div className="space-y-2">
            {/* Share Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 ${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}
            >
              <Share2 className="w-5 h-5" />
              <span>Share to...</span>
            </motion.button>

            {/* Save to Watch Later */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} text-white transition-colors`}
            >
              <Clock className="w-5 h-5 text-yellow-400" />
              <span>Save to Watch Later</span>
              <Plus className="w-5 h-5 ml-auto" />
            </motion.button>

            {/* Save to Collection */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={openCollectionPicker}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} text-white transition-colors`}
            >
              <Bookmark className="w-5 h-5 text-purple-400" />
              <span>Add to Collection</span>
              <Plus className="w-5 h-5 ml-auto" />
            </motion.button>

            {/* Download */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} text-white transition-colors`}
            >
              <Download className="w-5 h-5 text-green-400" />
              <span>Download Video</span>
            </motion.button>

            {/* Report */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleReport}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/5'} text-red-400 transition-colors`}
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
                  <h2 className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-lg flex items-center gap-2`}>
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Report Video
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowReportModal(false)}
                    className={`p-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                  </motion.button>
                </div>

                <p className={`${isDark ? 'text-white/60' : 'text-gray-500'} mb-4`}>
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
                          <Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                        )}
                      </div>
                      <span>{reason.label}</span>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitReport}
                  disabled={!reportReason || reporting}
                  className={`w-full p-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 ${isDark ? 'text-white' : 'text-gray-900'} font-semibold disabled:opacity-50`}
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collection Picker Modal */}
          <AnimatePresence>
            {showCollectionPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-t-3xl bg-gray-900/98 backdrop-blur-2xl p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-lg flex items-center gap-2`}>
                    <Bookmark className="w-5 h-5 text-purple-400" />
                    Add to Collection
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCollectionPicker(false)}
                    className={`p-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                  </motion.button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="New collection name"
                    maxLength={60}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm outline-none ${isDark ? 'bg-white/10 text-white placeholder-white/40' : 'bg-black/5 text-gray-900 placeholder-gray-400'}`}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={createCollectionAndAdd}
                    disabled={!newCollectionName.trim() || collectionBusy}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Create
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {collectionsLoading ? (
                    <p className={`text-sm text-center py-6 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Loading collections…</p>
                  ) : collections.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      No collections yet. Create one above.
                    </p>
                  ) : (
                    collections.map((col) => (
                      <motion.button
                        key={col.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addToCollection(col.id)}
                        disabled={collectionBusy}
                        className={`w-full flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-black/[0.03] hover:bg-black/5 text-gray-900'} transition-colors disabled:opacity-50`}
                      >
                        <span className="font-medium text-sm truncate">{col.name}</span>
                        <span className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{col.itemCount || 0}</span>
                      </motion.button>
                    ))
                  )}
                </div>
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
  initialView: PropTypes.oneOf(['share', 'report']),
};

export default VideoBottomSheet;
