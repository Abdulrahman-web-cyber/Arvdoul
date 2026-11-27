// src/components/Videos/SparkModals.jsx
//
// Shared modal host for Sparks / Reels / VideoDetail (`VideoComments`,
// `VideoBottomSheet`, and `VideoGiftModal`) so every Spark playback surface
// shares one counter-reconciliation and moderation/share sheet pipeline.

import PropTypes from 'prop-types';
import VideoComments from './VideoComments.jsx';
import VideoBottomSheet from './VideoBottomSheet.jsx';
import VideoGiftModal from './VideoGiftModal.jsx';

export default function SparkModals({
  video,
  creator,
  showComments = false,
  onCloseComments,
  showShare = false,
  onCloseShare,
  showReport = false,
  onCloseReport,
  showGift = false,
  onCloseGift,
  onAdjustCounter,
  onSaveStateChange,
  onShared,
  onNotInterested,
  onDeleted,
}) {
  const activeVideo = video || null;
  const bottomSheetOpen = Boolean((showShare || showReport) && activeVideo);
  const bottomSheetView = showReport ? 'report' : 'share';

  const handleCloseBottomSheet = () => {
    if (showReport) onCloseReport?.();
    if (showShare) onCloseShare?.();
  };

  return (
    <>
      <VideoComments
        isOpen={Boolean(showComments && activeVideo)}
        onClose={onCloseComments}
        video={activeVideo}
        onCommentAdded={() => onAdjustCounter?.(activeVideo, 'comments', 1)}
        onCommentDeleted={() => onAdjustCounter?.(activeVideo, 'comments', -1)}
      />

      <VideoBottomSheet
        isOpen={bottomSheetOpen}
        onClose={handleCloseBottomSheet}
        initialView={bottomSheetView}
        video={activeVideo}
        onSaveStateChange={(vidId, nextSaved) => onSaveStateChange?.(vidId, nextSaved, activeVideo)}
        onShared={(sharedVideo) => {
          if (onShared) onShared(sharedVideo);
          else onAdjustCounter?.(sharedVideo || activeVideo, 'shares', 1);
        }}
        onNotInterested={onNotInterested}
        onDeleted={onDeleted}
      />

      <VideoGiftModal
        isOpen={Boolean(showGift && activeVideo)}
        onClose={onCloseGift}
        creator={creator ?? activeVideo?.creator}
        video={activeVideo}
        onGiftSent={() => onAdjustCounter?.(activeVideo, 'gifts', 1)}
      />
    </>
  );
}

SparkModals.propTypes = {
  video: PropTypes.object,
  creator: PropTypes.object,
  showComments: PropTypes.bool,
  onCloseComments: PropTypes.func,
  showShare: PropTypes.bool,
  onCloseShare: PropTypes.func,
  showReport: PropTypes.bool,
  onCloseReport: PropTypes.func,
  showGift: PropTypes.bool,
  onCloseGift: PropTypes.func,
  onAdjustCounter: PropTypes.func,
  onSaveStateChange: PropTypes.func,
  onShared: PropTypes.func,
  onNotInterested: PropTypes.func,
  onDeleted: PropTypes.func,
};
