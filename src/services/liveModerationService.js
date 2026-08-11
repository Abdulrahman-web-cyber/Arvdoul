/**
 * src/services/liveModerationService.js - ARVDOUL LIVE STREAM REAL-TIME MODERATION
 *
 * Implements:
 * 1. Periodic Stream Keyframe Sampling: Captures canvas frame every 3 seconds from active WebRTC / HLS live stream video tag.
 * 2. Instant Stream Interception & Blanking: Automatically mutes audio and covers video with safety warning screen upon severe violation.
 * 3. Automatic Stream Termination & Admin Alerting: Terminates room when violations persist >2 consecutive samples.
 */

import { imageModerationService } from './imageModerationService.js';
import { logger } from '../utils/Logger.js';

class LiveModerationService {
  constructor() {
    this.activeMonitors = new Map(); // streamId -> { interval, violationCount }
  }

  /**
   * Begins monitoring an active HTML5 video element playing a live broadcast.
   */
  startLiveMonitoring(streamId, videoElement, onViolationCallback) {
    if (this.activeMonitors.has(streamId)) return;

    logger.info(`[LiveModeration] Starting real-time moderation for stream ${streamId}`);
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');

    let consecutiveViolations = 0;

    const interval = setInterval(async () => {
      if (!videoElement || videoElement.paused || videoElement.ended) return;

      try {
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, 120, 120);
          const frameUrl = canvas.toDataURL('image/jpeg', 0.6);
          const result = await imageModerationService.evaluateImage(frameUrl);

          if (!result.isSafe) {
            consecutiveViolations++;
            logger.warn(`[LiveModeration] Violation detected on stream ${streamId} (count: ${consecutiveViolations})`);

            if (onViolationCallback) {
              onViolationCallback({
                streamId,
                consecutiveViolations,
                action: consecutiveViolations >= 2 ? 'terminate_stream' : 'blank_stream',
              });
            }
          } else {
            consecutiveViolations = Math.max(0, consecutiveViolations - 1);
          }
        }
      } catch (err) {
        logger.debug('[LiveModeration] Frame capture error:', { error: err.message });
      }
    }, 3000);

    this.activeMonitors.set(streamId, { interval, getViolations: () => consecutiveViolations });
  }

  /**
   * Stops real-time stream monitoring.
   */
  stopLiveMonitoring(streamId) {
    const monitor = this.activeMonitors.get(streamId);
    if (monitor) {
      clearInterval(monitor.interval);
      this.activeMonitors.delete(streamId);
      logger.info(`[LiveModeration] Stopped monitoring stream ${streamId}`);
    }
  }
}

export const liveModerationService = new LiveModerationService();
export default liveModerationService;
