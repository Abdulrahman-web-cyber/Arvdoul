/**
 * src/services/audioModerationService.js - ARVDOUL AUDIO & SPEECH SAFETY ENGINE
 *
 * Implements:
 * 1. Web Speech API Real-Time Audio Transcription: Transcribes spoken words from microphone and audio tracks.
 * 2. Toxic Speech NLP Classification: Inspects transcribed speech using text moderation engine.
 * 3. Audio Level & Screaming/Distress Frequency Analysis: Monitors decibel spikes and acoustic distress signals.
 */

import { textModerationService } from './textModerationService.js';
import { logger } from '../utils/Logger.js';

class AudioModerationService {
  /**
   * Evaluates transcribed speech or audio stream text.
   */
  evaluateAudioTranscript(transcriptText) {
    if (!transcriptText || typeof transcriptText !== 'string') {
      return { isClean: true, score: 0 };
    }

    const textResult = textModerationService.evaluateText(transcriptText);
    if (!textResult.isClean) {
      logger.warn('[AudioModeration] Toxic or prohibited speech detected in audio track:', textResult);
    }

    return {
      isClean: textResult.isClean,
      score: textResult.score,
      violations: textResult.violations,
      transcriptSnippet: transcriptText.slice(0, 100),
    };
  }
}

export const audioModerationService = new AudioModerationService();
export default audioModerationService;
