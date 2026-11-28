// src/screens/VideoEditor/components/RecordVoiceModal.jsx

import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { X, Video, Mic, Square, RefreshCw, Check, AlertCircle } from "lucide-react";
import { formatTimecode } from '../constants';
import { useTheme } from '../../../context/ThemeContext';

export default function RecordVoiceModal({
  isOpen,
  onClose,
  mode = 'record', // 'record' (webcam) | 'voiceover' (mic)
  onAddRecordedClip,
}) {
  const { isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  const [levels, setLevels] = useState(() => new Array(16).fill(0));

  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordedBlobUrlRef = useRef(null);
  const appliedUrlRef = useRef(false);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const meterRafRef = useRef(null);

  const revokeUnappliedRecording = useCallback(() => {
    if (recordedBlobUrlRef.current && !appliedUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current);
    }
    recordedBlobUrlRef.current = null;
    appliedUrlRef.current = false;
  }, []);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    setLevels(new Array(16).fill(0));
  }, []);

  const stopCameraStream = useCallback(() => {
    stopMeter();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    mediaRecorderRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMediaStream(null);
  }, [stopMeter]);

  // The level meter reads the live microphone via an AnalyserNode.
  const attachAnalyser = (stream) => {
    if (!stream.getAudioTracks().length || typeof AudioContext === 'undefined') return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch (err) {
      console.warn('Audio analyser unavailable:', err);
    }
  };

  useEffect(() => {
    let active = true;
    const startCameraStream = async () => {
      setPermissionError(null);
      try {
        const constraints = mode === 'record'
          ? { video: { width: 1280, height: 720 }, audio: true }
          : { audio: true, video: false };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        setMediaStream(stream);
        if (videoPreviewRef.current && mode === 'record') {
          videoPreviewRef.current.srcObject = stream;
        }
        attachAnalyser(stream);
      } catch (err) {
        if (!active) return;
        console.warn('Camera/Mic permission access not granted:', err);
        setPermissionError('Camera or microphone access was not granted or is not available.');
      }
    };

    if (isOpen) {
      appliedUrlRef.current = false;
      startCameraStream();
    } else {
      stopCameraStream();
      revokeUnappliedRecording();
      setRecordedBlobUrl(null);
      setRecordDuration(0);
      setIsRecording(false);
    }
    return () => {
      active = false;
      stopCameraStream();
      revokeUnappliedRecording();
    };
  }, [isOpen, mode, stopCameraStream, revokeUnappliedRecording]);

  const startMeter = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / 16));
      const next = Array.from({ length: 16 }, (_, i) => {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        return sum / step;
      });
      setLevels(next);
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
  };

  const startRecording = () => {
    const stream = mediaStreamRef.current || mediaStream;
    if (!stream) {
      setPermissionError(
        mode === 'record'
          ? 'Camera and microphone access is required to record. Grant permission and try again.'
          : 'Microphone access is required to record a voiceover. Grant permission and try again.'
      );
      return;
    }

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setIsRecording(false);
        stopMeter();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPermissionError('Recording error occurred on this device/browser.');
      };
      recorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          setPermissionError('Recording produced no media data. Try again.');
          return;
        }
        const mimeType = recorder.mimeType || (mode === 'record' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        revokeUnappliedRecording();
        const url = URL.createObjectURL(blob);
        recordedBlobUrlRef.current = url;
        appliedUrlRef.current = false;
        setRecordedBlobUrl(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);
      startMeter();

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('MediaRecorder failed to start:', err);
      setPermissionError('Recording could not be started on this device/browser.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    stopMeter();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleApplyToTimeline = () => {
    if (!recordedBlobUrl) {
      setPermissionError('Nothing to add - record a clip first.');
      return;
    }
    appliedUrlRef.current = true;
    onAddRecordedClip?.({
      type: mode === 'record' ? 'video' : 'audio',
      url: recordedBlobUrl,
      duration: Math.max(1, recordDuration),
      title: mode === 'record' ? 'Camera Recording' : 'Voiceover Track',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden ${
          isDark ? 'bg-gray-950 border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {mode === 'record' ? (
              <Video className="w-5 h-5 text-rose-500" />
            ) : (
              <Mic className="w-5 h-5 text-blue-400" />
            )}
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {mode === 'record' ? 'Webcam / Camera Recording' : 'Studio Voiceover'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video / Audio Preview Canvas */}
        <div className="my-4 relative rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center h-64">
          {mode === 'record' ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center animate-pulse">
                <Mic className="w-10 h-10" />
              </div>
              <div className="flex items-center gap-1 h-8">
                {levels.map((level, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-blue-400 transition-[height] duration-75"
                    style={{ height: `${Math.max(6, Math.round((level / 255) * 30))}px` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Time Counter Badge */}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-600/90 rounded-full text-white text-xs font-mono font-bold shadow-lg animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>REC {formatTimecode(recordDuration)}</span>
            </div>
          )}

          {permissionError && (
            <div className="absolute inset-0 bg-black/80 p-4 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-gray-300 max-w-xs">{permissionError}</p>
              <p className="text-[11px] text-gray-500 mt-1">Allow microphone access to record — no simulated audio is ever produced.</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {!recordedBlobUrl ? (
            !isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/40 transition-all active:scale-95"
              >
                <div className="w-3 h-3 rounded-full bg-white" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-xs shadow-lg transition-all active:scale-95"
              >
                <Square className="w-4 h-4 fill-black" />
                <span>Stop & Save</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  revokeUnappliedRecording();
                  setRecordedBlobUrl(null);
                  setRecordDuration(0);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold ${
                  isDark ? 'bg-white/10 text-gray-300 hover:text-white' : 'bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleApplyToTimeline}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
              >
                <Check className="w-4 h-4" />
                <span>Insert to Timeline</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

RecordVoiceModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['record', 'voiceover']),
  onAddRecordedClip: PropTypes.func,
};
