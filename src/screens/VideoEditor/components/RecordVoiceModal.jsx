// src/screens/VideoEditor/components/RecordVoiceModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  X, Video, Mic, Square, Play, RefreshCw, Check, Camera,
  Volume2, AlertCircle
} from 'lucide-react';
import { formatTimecode } from '../constants';

export default function RecordVoiceModal({
  isOpen,
  onClose,
  mode = 'record', // 'record' (webcam) | 'voiceover' (mic)
  onAddRecordedClip,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (isOpen) {
      startCameraStream();
    } else {
      stopCameraStream();
      setRecordedBlobUrl(null);
      setRecordDuration(0);
      setIsRecording(false);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, mode]);

  const startCameraStream = async () => {
    setPermissionError(null);
    try {
      const constraints = mode === 'record'
        ? { video: { width: 1280, height: 720 }, audio: true }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);
      if (videoPreviewRef.current && mode === 'record') {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera/Mic permission access not granted:', err);
      setPermissionError('Camera or microphone access was not granted or is not available.');
    }
  };

  const stopCameraStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
  };

  const startRecording = () => {
    if (!mediaStream) {
      // No fabricated recordings: without a granted camera/mic stream there is
      // nothing real to record. Surface the permission state instead.
      setPermissionError(
        mode === 'record'
          ? 'Camera and microphone access is required to record. Grant permission and try again.'
          : 'Microphone access is required to record a voiceover. Grant permission and try again.'
      );
      return;
    }

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(mediaStream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          setPermissionError('Recording produced no audio data. Try again.');
          return;
        }
        const mimeType = mode === 'record' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

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
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // No recorder/no data => recordedBlobUrl stays null (nothing fabricated).
  };

  const handleApplyToTimeline = () => {
    if (!recordedBlobUrl) {
      setPermissionError('Nothing to add - record a clip first.');
      return;
    }
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
        className="w-full max-w-lg rounded-3xl bg-gray-950 border border-white/15 shadow-2xl p-6 relative overflow-hidden"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            {mode === 'record' ? (
              <Video className="w-5 h-5 text-rose-500" />
            ) : (
              <Mic className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="text-base font-bold text-white">
              {mode === 'record' ? 'Webcam / Camera Recording' : 'Studio Voiceover'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
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
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full bg-blue-400 ${isRecording ? 'animate-bounce' : 'h-2 opacity-30'}`}
                    style={{
                      height: isRecording ? `${Math.floor(Math.random() * 24) + 6}px` : '6px',
                      animationDelay: `${i * 0.05}s`
                    }}
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
              <p className="text-[11px] text-gray-500 mt-1">Using high-fidelity simulator mode.</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {!recordedBlobUrl ? (
            !isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/40 transition-all active:scale-95"
              >
                <div className="w-3 h-3 rounded-full bg-white" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
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
                onClick={() => {
                  setRecordedBlobUrl(null);
                  setRecordDuration(0);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 text-gray-300 hover:text-white text-xs font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
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
