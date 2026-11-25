// src/components/Videos/VideoBottomSheet.jsx
//
// Share, save, collection, download, not-interested, delete, and report bottom sheet

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Share2, Bookmark, Download, Flag, Check, MessageCircle,
  Twitter, Facebook, Link as LinkIcon, Plus, Clock, AlertTriangle,
  EyeOff, Trash2, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SPRING_ANIMATION, REPORT_REASONS, generateShareUrl } from '../../utils/videoUtils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { useVideoStore } from '../../store/videoStore.js';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

function triggerExternalLink(url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function triggerFileDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const VideoBottomSheet = memo(({
  isOpen = false,
  onClose,
  video,
  initialView = 'share',
  onDeleted,
  onNotInterested,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(initialView === 'report');
  const [reportReason, setReportReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);

  const canonicalId = video?.canonicalPostId || video?.id;
  const ownerId = video?.authorId || video?.userId || video?.creator?.id || null;
  const isOwner = Boolean(user?.uid && ownerId && user.uid === ownerId);

  useEffect(() => {
    if (isOpen) {
      setShowReportModal(initialView === 'report');
      setShowCollectionPicker(false);
    }
  }, [isOpen, initialView, video?.id]);

  if (!isOpen) return null;

  const surfaceBtnClass = isDark
    ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
    : 'bg-black/[0.04] hover:bg-black/[0.08] text-gray-900 border border-black/10';

  const handleCopyLink = async () => {
    const url = generateShareUrl(canonicalId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Spark link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video?.title || 'Watch this Spark on Arvdoul',
          text: video?.description || '',
          url: generateShareUrl(canonicalId),
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

  const handleExternalShare = (platform) => {
    const url = encodeURIComponent(generateShareUrl(canonicalId));
    const text = encodeURIComponent(video?.title || 'Watch this Spark on Arvdoul!');

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    };

    if (shareUrls[platform]) {
      triggerExternalLink(shareUrls[platform]);
    }
  };

  const handleDownload = async () => {
    if (!video?.id || downloading) return;
    if (video?.allowDownload === false && !isOwner) {
      toast.error('Creator disabled downloads for this Spark');
      return;
    }

    setDownloading(true);
    try {
      const { getVideoService } = await import('../../services/videoService.js');
      const res = await getVideoService().getWatermarkedDownloadUrl(video.id);
      const url = res?.url || video?.videoUrl;
      if (!url) throw new Error('Download URL unavailable');
      triggerFileDownload(url, `${(video.title || 'arvdoul-spark').replace(/[^\w-]+/g, '_')}.mp4`);
      toast.success('Download started!');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Download unavailable for this Spark');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!video?.id || saving) return;
    setSaving(true);
    const store = useVideoStore.getState();
    const wasSaved = store.isInWatchLater ? store.isInWatchLater(video.id) : false;

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
      if (wasSaved) store.addToWatchLater(video);
      else store.removeFromWatchLater(video.id);
      toast.error(err?.message || 'Could not update Watch Later. Are you signed in?');
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleNotInterested = () => {
    if (!video?.id) return;
    useVideoStore.getState().markNotInterested(video.id);
    onNotInterested?.(video.id);
    toast.success('We will show fewer Sparks like this');
    onClose();
  };

  const handleDeleteSpark = async () => {
    if (!video?.id || !isOwner || deleting) return;
    setDeleting(true);
    try {
      const { getVideoService } = await import('../../services/videoService.js');
      await getVideoService().deleteVideo(video.id);
      useVideoStore.getState().removeVideo(video.id);
      onDeleted?.(video.id);
      toast.success('Spark deleted');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not delete Spark');
    } finally {
      setDeleting(false);
    }
  };

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
    } catch {
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
        id: canonicalId,
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
        id: canonicalId,
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
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_ANIMATION.bottomSheet}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-xl rounded-t-3xl backdrop-blur-2xl p-6 border-t shadow-2xl max-h-[85vh] overflow-y-auto ${
            isDark ? 'bg-[#080F2E]/95 border-white/12' : 'bg-white/95 border-gray-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Share Spark</h2>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              aria-label="Close options"
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-700'}`} />
            </motion.button>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <div className={`w-12 h-12 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'} flex items-center justify-center`}>
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <LinkIcon className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                )}
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-700'} text-xs font-medium`}>
                {copied ? 'Copied!' : 'Copy Link'}
              </span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('twitter')}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center">
                <Twitter className="w-5 h-5 text-[#1DA1F2]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-700'} text-xs font-medium`}>X / Twitter</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('facebook')}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#4267B2]/20 flex items-center justify-center">
                <Facebook className="w-5 h-5 text-[#4267B2]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-700'} text-xs font-medium`}>Facebook</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExternalShare('whatsapp')}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
              </div>
              <span className={`${isDark ? 'text-white/80' : 'text-gray-700'} text-xs font-medium`}>WhatsApp</span>
            </motion.button>
          </div>

          {/* More Options */}
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: BRAND_GRADIENT }}
            >
              <Share2 className="w-5 h-5" />
              <span>Share to...</span>
            </motion.button>

            {canonicalId && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onClose();
                  navigate(`/sparks/${canonicalId}`);
                }}
                className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors ${surfaceBtnClass}`}
              >
                <ExternalLink className="w-5 h-5 text-blue-400" />
                <span className="font-medium">Open Full Spark View</span>
              </motion.button>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
              className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="font-medium">{saving ? 'Updating...' : 'Save to Watch Later'}</span>
              <Plus className="w-5 h-5 ml-auto opacity-70" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={openCollectionPicker}
              className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <Bookmark className="w-5 h-5 text-purple-400" />
              <span className="font-medium">Add to Collection</span>
              <Plus className="w-5 h-5 ml-auto opacity-70" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              disabled={downloading}
              className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors ${surfaceBtnClass}`}
            >
              <Download className="w-5 h-5 text-emerald-400" />
              <span className="font-medium">{downloading ? 'Preparing download...' : 'Download Spark'}</span>
            </motion.button>

            {!isOwner && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleNotInterested}
                className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors ${surfaceBtnClass}`}
              >
                <EyeOff className="w-5 h-5 text-slate-400" />
                <span className="font-medium">Not Interested</span>
              </motion.button>
            )}

            {isOwner ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleDeleteSpark}
                disabled={deleting}
                className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors text-red-400 ${
                  isDark ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/25' : 'bg-red-50 hover:bg-red-100 border border-red-200'
                }`}
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-semibold">{deleting ? 'Deleting Spark...' : 'Delete Spark'}</span>
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowReportModal(true)}
                className={`w-full flex items-center gap-4 p-4 min-h-[48px] rounded-2xl transition-colors text-red-400 ${surfaceBtnClass}`}
              >
                <Flag className="w-5 h-5" />
                <span className="font-medium">Report Spark</span>
              </motion.button>
            )}
          </div>

          {/* Report Modal */}
          <AnimatePresence>
            {showReportModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 rounded-t-3xl backdrop-blur-2xl p-6 flex flex-col ${
                  isDark ? 'bg-[#080F2E]/98' : 'bg-white/98'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-lg flex items-center gap-2`}>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    Report Spark
                  </h2>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowReportModal(false)}
                    className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                  </motion.button>
                </div>

                <p className={`${isDark ? 'text-white/65' : 'text-gray-600'} text-sm mb-4`}>
                  Help us understand what is wrong with this Spark
                </p>

                <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                  {REPORT_REASONS.map((reason) => (
                    <motion.button
                      key={reason.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setReportReason(reason.value)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors ${
                        reportReason === reason.value
                          ? 'bg-purple-500/20 border border-purple-500/50 text-white'
                          : isDark
                            ? 'bg-white/5 hover:bg-white/10 text-white/85'
                            : 'bg-black/[0.04] hover:bg-black/[0.08] text-gray-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          reportReason === reason.value
                            ? 'border-purple-500 bg-purple-500'
                            : isDark ? 'border-white/30' : 'border-gray-400'
                        }`}
                      >
                        {reportReason === reason.value && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{reason.label}</span>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={submitReport}
                  disabled={!reportReason || reporting}
                  className="w-full p-4 min-h-[48px] rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold disabled:opacity-50"
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
                className={`absolute inset-0 rounded-t-3xl backdrop-blur-2xl p-6 flex flex-col ${
                  isDark ? 'bg-[#080F2E]/98' : 'bg-white/98'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-lg flex items-center gap-2`}>
                    <Bookmark className="w-5 h-5 text-purple-400" />
                    Add to Collection
                  </h2>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCollectionPicker(false)}
                    className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                  </motion.button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    aria-label="New collection name"
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="New collection name"
                    maxLength={60}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm outline-none ${
                      isDark ? 'bg-white/10 text-white placeholder-white/40' : 'bg-black/5 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={createCollectionAndAdd}
                    disabled={!newCollectionName.trim() || collectionBusy}
                    className="px-4 py-2.5 min-h-[42px] rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    Create
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {collectionsLoading ? (
                    <p className={`text-sm text-center py-6 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Loading collections...</p>
                  ) : collections.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      No collections yet. Create one above.
                    </p>
                  ) : (
                    collections.map((col) => (
                      <motion.button
                        key={col.id}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addToCollection(col.id)}
                        disabled={collectionBusy}
                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors disabled:opacity-50 ${
                          isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-black/[0.04] hover:bg-black/10 text-gray-900'
                        }`}
                      >
                        <span className="font-medium text-sm truncate">{col.name}</span>
                        <span className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                          {unknownNumber(col.itemCount) ?? '—'}
                        </span>
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
  onDeleted: PropTypes.func,
  onNotInterested: PropTypes.func,
};

export default VideoBottomSheet;
