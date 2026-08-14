/**
 * src/services/audioModerationService.js - ARVDOUL AUDIO & SPEECH SAFETY ENGINE v8.0
 *
 * Implements:
 * 1. Web Speech API Real-Time Audio Transcription: Transcribes spoken words from microphone and audio tracks.
 * 2. Toxic Speech NLP Classification: Inspects transcribed speech using text moderation engine.
 * 3. Audio Level & Screaming/Distress Frequency Analysis: Monitors decibel spikes and acoustic distress signals.
 */

import { textModerationService } from './textModerationService.js';
import { logger } from '../utils/Logger.js';

class AudioModerationService {
  constructor() {
    this.speechRecognition = null;
    this.audioContext = null;
    this.analyser = null;
    this.maxAmplitudeDb = -10; // screaming threshold in dB
    this.initSpeechRecognition();
  }

  /**
   * Initializes Web Speech API if supported in browser environment.
   */
  initSpeechRecognition() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = false;
        this.speechRecognition.lang = 'en-US';
      }
    }
  }

  /**
   * Starts real-time decibel level amplitude scanning to detect screaming/acoustic distress.
   * @param {MediaStream} stream - MediaStream from getUserMedia or WebRTC
   * @param {function} onDistressCallback - callback triggered on distress detection
   */
  monitorAudioDistress(stream, onDistressCallback) {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass || !stream) return;

      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;

      source.connect(this.analyser);
      const dataArray = new Float32Array(this.analyser.fftSize);

      const checkLevel = () => {
        if (!this.analyser) return;
        this.analyser.getFloatTimeDomainData(dataArray);

        // Compute Root Mean Square (RMS) amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -99;

        if (db > this.maxAmplitudeDb) {
          logger.warn('[AudioModeration] Screaming or severe acoustic distress spike detected:', { decibels: db });
          if (typeof onDistressCallback === 'function') {
            onDistressCallback({ type: 'screaming_or_distress', decibels: db });
          }
        }

        requestAnimationFrame(checkLevel);
      };

      checkLevel();
    } catch (err) {
      logger.error('[AudioModeration] AudioContext monitoring failed:', err);
    }
  }

  /**
   * Starts Web Speech transcription listener on a stream.
   * @param {function} onTranscriptCallback - callback triggered on speech segment transcription
   */
  startLiveTranscription(onTranscriptCallback) {
    if (!this.speechRecognition) {
      logger.warn('[AudioModeration] SpeechRecognition is not supported on this browser.');
      return;
    }

    this.speechRecognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript;
      logger.info('[AudioModeration] Speech transcribed segment:', { transcript });

      const evaluation = this.evaluateAudioTranscript(transcript);
      if (typeof onTranscriptCallback === 'function') {
        onTranscriptCallback({ transcript, evaluation });
      }
    };

    this.speechRecognition.onerror = (err) => {
      logger.error('[AudioModeration] SpeechRecognition error:', err);
    };

    try {
      this.speechRecognition.start();
    } catch (e) {
      // already started
    }
  }

  /**
   * Stops live SpeechRecognition and AudioContext listeners.
   */
  stopMonitoring() {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
      this.analyser = null;
    }
  }

  /**
   * Evaluates transcribed speech or audio stream text.
   */
  evaluateAudioTranscript(transcriptText) {
    if (!transcriptText || typeof transcriptText !== 'string') {
      return { isClean: true, score: 0, violations: [] };
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
