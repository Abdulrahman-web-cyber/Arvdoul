// src/components/messaging/MessageInput.jsx

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import {
  Send,
  Paperclip,
  Mic,
  Square,
  Smile,
  Image as ImageIcon,
  Video,
  File,
  MapPin,
  User,
  X,
  Loader2,
  EyeOff,
  Gift,
  Edit3,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import GIFPicker from '../Shared/GIFPicker';
import { LazyImage } from '../../components/Shared/LazyImage';
import {
  MESSAGING_PART1_LIMITS,
  validateAttachmentFile,
  saveScopedDraft,
  loadScopedDraft,
  clearScopedDraft,
} from '../../config/messagingContracts.js';

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MessageInput = React.memo(
  ({
    conversationId = null,
    replyTo = null,
    editingMessage = null,
    onCancelEdit = null,
    uploadProgress = null,
    onCancelUpload = null,
    onSendMessage,
    onSendMedia,
    onTyping,
    onOpenGift,
    theme,
    disabled = false,
    placeholder = 'Message...',
    maxHeight = '120px',
  }) => {
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showGIFPicker, setShowGIFPicker] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordedVoice, setRecordedVoice] = useState(null); // { blob, file, previewUrl, duration }
    const [micError, setMicError] = useState(null);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [viewOnce, setViewOnce] = useState(false);
    const { user: currentUser } = useAuth();
    const uid = currentUser?.uid || null;

    const textInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaInputRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const recordingDurationRef = useRef(0);
    const mediaRecorderRef = useRef(null);
    const activeStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const typingTimeoutRef = useRef(null);
    const recordedVoiceUrlRef = useRef(null);

    const isDark = theme === 'dark';

    const clearRecordedVoice = () => {
      if (recordedVoiceUrlRef.current) {
        URL.revokeObjectURL(recordedVoiceUrlRef.current);
        recordedVoiceUrlRef.current = null;
      }
      setRecordedVoice(null);
    };

    // Hydrate UID-scoped draft when switching conversations or accounts
    useEffect(() => {
      setAttachedFiles([]);
      setViewOnce(false);
      setShowAttachments(false);
      setShowEmoji(false);
      setShowGIFPicker(false);
      setMicError(null);
      clearRecordedVoice();

      if (editingMessage) return;
      if (uid && conversationId) {
        const draft = loadScopedDraft(uid, conversationId);
        setText(draft?.text || '');
      } else {
        setText('');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId, uid]);

    // Sync inline edit mode
    useEffect(() => {
      if (editingMessage) {
        setText(editingMessage.content || '');
        setAttachedFiles([]);
        setViewOnce(false);
        clearRecordedVoice();
        setTimeout(() => textInputRef.current?.focus(), 20);
      } else if (uid && conversationId) {
        const draft = loadScopedDraft(uid, conversationId);
        setText(draft?.text || '');
      } else {
        setText('');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingMessage?.id]);

    useEffect(() => {
      const urls = attachedFiles.map((file) =>
        file.type?.startsWith('image/') || file.type?.startsWith('video/')
          ? URL.createObjectURL(file)
          : null
      );
      setPreviewUrls(urls);
      return () => {
        urls.forEach((u) => {
          if (u) URL.revokeObjectURL(u);
        });
      };
    }, [attachedFiles]);

    useEffect(
      () => () => {
        clearTimeout(typingTimeoutRef.current);
        clearInterval(recordingTimerRef.current);
        if (mediaRecorderRef.current) {
          try {
            mediaRecorderRef.current.onstop = null;
            if (mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
          } catch {
            /* noop */
          }
        }
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((t) => t.stop());
          activeStreamRef.current = null;
        }
        if (recordedVoiceUrlRef.current) {
          URL.revokeObjectURL(recordedVoiceUrlRef.current);
          recordedVoiceUrlRef.current = null;
        }
      },
      []
    );

    const handleTypingChange = (value) => {
      const clamped = value.slice(0, MESSAGING_PART1_LIMITS.TEXT_MAX_LENGTH);
      setText(clamped);
      if (!editingMessage && uid && conversationId) {
        saveScopedDraft(uid, conversationId, { text: clamped, replyTo });
      }
      onTyping?.(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 3000);
    };

    const handleSendMessage = async () => {
      if (editingMessage) {
        const trimmed = text.trim();
        if (!trimmed || isSending || disabled) return;
        try {
          setIsSending(true);
          await onSendMessage?.({
            type: 'edit_commit',
            messageId: editingMessage.id,
            content: trimmed,
          });
          setText('');
          onCancelEdit?.();
          textInputRef.current?.focus();
        } catch (error) {
          toast.error(error?.message || 'Could not save edit');
        } finally {
          setIsSending(false);
        }
        return;
      }

      if (!text.trim() && attachedFiles.length === 0) return;
      if (isSending || disabled) return;

      try {
        setIsSending(true);
        if (attachedFiles.length > 0) {
          for (let i = 0; i < attachedFiles.length; i += 1) {
            const f = attachedFiles[i];
            const isVisual = f.type?.startsWith('image/') || f.type?.startsWith('video/');
            await onSendMedia?.({
              file: f,
              text: i === 0 ? text.trim() : '',
              viewOnce: Boolean(viewOnce && isVisual),
            });
          }
        } else {
          await onSendMessage?.({ type: 'text', content: text });
        }
        setText('');
        if (uid && conversationId) {
          clearScopedDraft(uid, conversationId);
        }
        setAttachedFiles([]);
        setViewOnce(false);
        textInputRef.current?.focus();
      } catch (error) {
        toast.error(error?.message || 'Failed to send message');
        console.error('Send error:', error);
      } finally {
        setIsSending(false);
      }
    };

    const validateAndStageFiles = (incomingFiles) => {
      const accepted = [];
      for (const file of incomingFiles) {
        const check = validateAttachmentFile(file);
        if (!check.valid) {
          toast.error(check.error || `Cannot attach "${file?.name || 'file'}".`);
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length > 0) {
        setAttachedFiles((prev) => [...prev, ...accepted]);
        setShowAttachments(false);
      }
    };

    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) validateAndStageFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMediaSelect = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) validateAndStageFiles(files);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    };

    const handleStartRecording = async () => {
      if (isRecording || disabled || editingMessage) return;
      setMicError(null);
      clearRecordedVoice();

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        setMicError('Voice recording is not supported on this device or browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreamRef.current = stream;

        let mimeType = '';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }
        }

        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        recordingDurationRef.current = 0;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstart = () => {
          setIsRecording(true);
          setRecordingDuration(0);
          recordingDurationRef.current = 0;
          recordingTimerRef.current = setInterval(() => {
            recordingDurationRef.current += 1;
            const nextSec = recordingDurationRef.current;
            setRecordingDuration(nextSec);
            if (nextSec >= MESSAGING_PART1_LIMITS.VOICE_MAX_SECONDS) {
              handleStopRecording();
            }
          }, 1000);
        };

        mediaRecorder.onstop = () => {
          setIsRecording(false);
          clearInterval(recordingTimerRef.current);
          if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach((track) => track.stop());
            activeStreamRef.current = null;
          }

          const resolvedType = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: resolvedType });
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;

          if (blob.size <= 0) {
            setMicError('No audio was captured. Hold and speak closer to your microphone.');
            return;
          }

          const ext = resolvedType.includes('mp4') ? 'm4a' : 'webm';
          const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: resolvedType });
          const previewUrl = URL.createObjectURL(blob);
          recordedVoiceUrlRef.current = previewUrl;
          setRecordedVoice({
            blob,
            file: voiceFile,
            previewUrl,
            duration: Math.max(1, recordingDurationRef.current),
          });
        };

        mediaRecorder.start(250);
      } catch (error) {
        const name = error?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setMicError('Microphone access was denied. Enable microphone permissions in browser settings to record voice notes.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setMicError('No microphone found on this device.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setMicError('Microphone is busy or blocked by another app.');
        } else {
          setMicError(error?.message || 'Could not start voice recording.');
        }
        console.error('Recording error:', error);
      }
    };

    const handleStopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };

    const handleCancelRecording = () => {
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
      }
      setIsRecording(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      audioChunksRef.current = [];
    };

    const handleSendRecordedVoice = async () => {
      if (!recordedVoice?.file || isSending || disabled) return;
      try {
        setIsSending(true);
        await onSendMedia?.({
          file: recordedVoice.file,
          isVoice: true,
          durationSec: recordedVoice.duration,
        });
        clearRecordedVoice();
      } catch (error) {
        toast.error(error?.message || 'Failed to send voice note');
      } finally {
        setIsSending(false);
      }
    };

    const removeAttachedFile = (index) => {
      setAttachedFiles((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (next.length === 0) setViewOnce(false);
        return next;
      });
    };

    const hasVisualAttachment = attachedFiles.some(
      (f) => f.type?.startsWith('image/') || f.type?.startsWith('video/')
    );

    const isVoiceMode = isRecording || Boolean(recordedVoice);

    return (
      <div
        className={cn(
          'border-t px-3 py-2.5 space-y-2.5',
          isDark ? 'border-white/[0.08] bg-[#050B24]' : 'border-slate-200 bg-white'
        )}
      >
        {/* Inline Edit Banner */}
        {editingMessage && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2',
              isDark ? 'bg-[#090F2D] border-purple-500/40' : 'bg-purple-50 border-purple-200'
            )}
          >
            <Edit3 className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-purple-500 dark:text-purple-300">Editing message</p>
              <p className="text-[11px] truncate opacity-75">{editingMessage.content}</p>
            </div>
            <button
              type="button"
              onClick={() => onCancelEdit?.()}
              aria-label="Cancel editing"
              className={cn(
                'p-1.5 rounded-full transition-colors',
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
              )}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Upload Progress Bar with Cancel */}
        {uploadProgress && (
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl border',
              isDark ? 'bg-[#090F2D] border-white/10' : 'bg-slate-50 border-slate-200'
            )}
          >
            <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="truncate">{uploadProgress.fileName || 'Uploading attachment…'}</span>
                <span className="tabular-nums text-purple-400">
                  {Math.min(100, Math.max(0, Math.round((uploadProgress.percent || 0) * 100)))}%
                </span>
              </div>
              <div className={cn('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                <div
                  className="h-full bg-arvdoul-gradient transition-all duration-150"
                  style={{ width: `${Math.min(100, Math.max(4, Math.round((uploadProgress.percent || 0) * 100)))}%` }}
                />
              </div>
            </div>
            {onCancelUpload && (
              <button
                type="button"
                onClick={onCancelUpload}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  isDark ? 'text-red-300 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100'
                )}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Microphone Permission / Hardware Error Guidance */}
        {micError && (
          <div
            role="alert"
            className={cn(
              'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs',
              isDark ? 'bg-red-950/35 border-red-800/50 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
            )}
          >
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1 min-w-0 leading-snug">{micError}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleStartRecording}
                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setMicError(null)}
                aria-label="Dismiss microphone error"
                className="p-1 rounded-lg opacity-75 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Staged attachments preview */}
        {attachedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    'relative flex-shrink-0 rounded-xl overflow-hidden border',
                    isDark ? 'bg-[#090F2D] border-white/10' : 'bg-slate-100 border-slate-200'
                  )}
                >
                  {file.type?.startsWith('image/') && previewUrls[index] ? (
                    <LazyImage src={previewUrls[index]} alt={file.name} className="h-20 w-20 object-cover" />
                  ) : file.type?.startsWith('video/') && previewUrls[index] ? (
                    <video src={previewUrls[index]} className="h-20 w-20 object-cover" />
                  ) : (
                    <div className="h-20 w-20 flex flex-col items-center justify-center p-2 text-center">
                      <File className="w-6 h-6 text-purple-400 mb-1" aria-hidden="true" />
                      <span className="text-[10px] truncate max-w-full opacity-75">{file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeAttachedFile(index)}
                    className="absolute top-1 right-1 bg-black/75 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {hasVisualAttachment && (
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setViewOnce((v) => !v)}
                  aria-pressed={viewOnce}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    viewOnce
                      ? 'bg-arvdoul-gradient text-white border-transparent shadow-sm'
                      : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{viewOnce ? 'View Once (1x) enabled' : 'Send as View Once'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Voice Recording Bar (stop -> preview before send) */}
        {isRecording && (
          <div
            className={cn(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border',
              isDark ? 'bg-red-950/30 border-red-800/40' : 'bg-red-50 border-red-200'
            )}
          >
            <Mic className="w-4 h-4 text-red-500 shrink-0 animate-pulse" aria-hidden="true" />
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                isDark ? 'text-red-300' : 'text-red-700'
              )}
            >
              Recording · {formatClock(recordingDuration)} / {formatClock(MESSAGING_PART1_LIMITS.VOICE_MAX_SECONDS)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
                )}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
              >
                Stop & Preview
              </button>
            </div>
          </div>
        )}

        {/* Voice Note Preview & Confirmation Bar */}
        {!isRecording && recordedVoice && (
          <div
            className={cn(
              'flex flex-col sm:flex-row sm:items-center gap-2.5 px-3.5 py-2.5 rounded-xl border',
              isDark ? 'bg-[#090F2D] border-purple-500/35' : 'bg-purple-50/70 border-purple-200'
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <audio controls src={recordedVoice.previewUrl} className="h-9 flex-1 min-w-0" />
              <span className="text-[11px] font-semibold tabular-nums opacity-75 shrink-0">
                {formatClock(recordedVoice.duration)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={clearRecordedVoice}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
                )}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleStartRecording}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
                  isDark ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Re-record</span>
              </button>
              <button
                type="button"
                onClick={handleSendRecordedVoice}
                disabled={isSending || disabled}
                className="px-3 py-1.5 rounded-lg bg-arvdoul-gradient text-white text-xs font-semibold flex items-center gap-1 hover:brightness-105 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {/* Composer controls row */}
        <div className="flex items-end gap-1.5">
          {!editingMessage && (
            <button
              type="button"
              onClick={() => {
                setShowAttachments(!showAttachments);
                setShowEmoji(false);
                setShowGIFPicker(false);
              }}
              disabled={disabled || isVoiceMode || isSending}
              className={cn(
                'min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                showAttachments
                  ? 'bg-purple-500/15 text-purple-400'
                  : isDark
                    ? 'hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40'
                    : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-40'
              )}
              aria-label="Attach media"
              title="Attach media"
            >
              <Paperclip className="w-5 h-5" aria-hidden="true" />
            </button>
          )}

          <textarea
            aria-label={editingMessage ? 'Edit message' : 'Message'}
            dir="auto"
            maxLength={MESSAGING_PART1_LIMITS.TEXT_MAX_LENGTH}
            ref={textInputRef}
            value={text}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && editingMessage) {
                e.preventDefault();
                onCancelEdit?.();
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={editingMessage ? 'Edit your message...' : placeholder}
            disabled={disabled || isVoiceMode}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-arvdoul-purple text-sm max-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed',
              isDark
                ? 'bg-[#090F2D] text-white placeholder-slate-500 border border-white/10'
                : 'bg-slate-100 text-slate-900 placeholder-slate-400 border border-slate-200'
            )}
            rows={1}
            style={{
              minHeight: '42px',
              maxHeight,
              overflowY: 'auto',
            }}
          />

          <button
            type="button"
            onClick={() => {
              setShowEmoji(!showEmoji);
              setShowGIFPicker(false);
              setShowAttachments(false);
            }}
            disabled={disabled || isVoiceMode}
            className={cn(
              'min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
              showEmoji
                ? 'bg-arvdoul-gradient text-white'
                : isDark
                  ? 'hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-40'
            )}
            aria-label="Emoji"
            title="Emoji"
          >
            <Smile className="w-5 h-5" aria-hidden="true" />
          </button>

          {!editingMessage && (
            <button
              type="button"
              onClick={() => {
                setShowGIFPicker(!showGIFPicker);
                setShowEmoji(false);
                setShowAttachments(false);
              }}
              disabled={disabled || isVoiceMode}
              className={cn(
                'min-h-[40px] px-2.5 rounded-full transition-colors text-xs font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                showGIFPicker
                  ? 'bg-arvdoul-gradient text-white'
                  : isDark
                    ? 'hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40'
                    : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-40'
              )}
              aria-label="GIF Reactions"
              title="GIF"
            >
              GIF
            </button>
          )}

          {text.trim() || attachedFiles.length > 0 || editingMessage ? (
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={disabled || isSending || (editingMessage && !text.trim())}
              className="min-h-[40px] min-w-[40px] rounded-full transition-all text-white bg-arvdoul-gradient hover:brightness-105 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              aria-label={editingMessage ? 'Save edited message' : 'Send message'}
              title={editingMessage ? 'Save edit' : 'Send message'}
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={disabled || Boolean(recordedVoice)}
              className={cn(
                'min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-all text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-arvdoul-gradient hover:brightness-105'
              )}
              aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
              title={isRecording ? 'Stop recording' : 'Record voice message'}
            >
              {isRecording ? (
                <Square className="w-4 h-4 fill-current" aria-hidden="true" />
              ) : (
                <Mic className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Attachment sheet */}
        {showAttachments && (
          <div
            className={cn(
              'grid grid-cols-3 sm:grid-cols-6 gap-2 p-2.5 rounded-xl border',
              isDark ? 'bg-[#090F2D] border-white/10' : 'bg-slate-50 border-slate-200'
            )}
          >
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <ImageIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />
              <span>Photo</span>
            </button>
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <Video className="w-5 h-5 text-red-500" aria-hidden="true" />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <File className="w-5 h-5 text-amber-500" aria-hidden="true" />
              <span>File</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowAttachments(false);
                try {
                  if (!navigator.geolocation) {
                    toast.error('Location is not supported.');
                    return;
                  }
                  const pos = await new Promise((res, rej) =>
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
                  );
                  const { latitude, longitude } = pos.coords;
                  await onSendMessage?.({
                    type: 'location',
                    content: `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`,
                    media: null,
                    location: { latitude, longitude },
                  });
                } catch {
                  toast.error('Could not get your location.');
                }
              }}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <MapPin className="w-5 h-5 text-emerald-500" aria-hidden="true" />
              <span>Location</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowAttachments(false);
                try {
                  if (!currentUser) {
                    toast.error('Sign in to share your profile.');
                    return;
                  }
                  await onSendMessage?.({
                    type: 'contact',
                    content: `profile:${currentUser.uid}`,
                    media: null,
                  });
                } catch {
                  toast.error('Could not share contact.');
                }
              }}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <User className="w-5 h-5 text-purple-400" aria-hidden="true" />
              <span>Contact</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAttachments(false);
                setShowGIFPicker(true);
              }}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-200/70 text-slate-700'
              )}
            >
              <span className="h-5 flex items-center justify-center font-bold text-xs text-purple-400">
                GIF
              </span>
              <span>GIF</span>
            </button>
            {onOpenGift && (
              <button
                type="button"
                onClick={() => {
                  setShowAttachments(false);
                  onOpenGift();
                }}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-xs',
                  isDark ? 'hover:bg-white/10 text-amber-300' : 'hover:bg-slate-200/70 text-amber-600'
                )}
              >
                <Gift className="w-5 h-5" aria-hidden="true" />
                <span>Gift</span>
              </button>
            )}
          </div>
        )}

        {showGIFPicker && (
          <div className="mb-1 w-full max-w-sm">
            <GIFPicker
              onSelect={(url, gif) => {
                setShowGIFPicker(false);
                onSendMessage?.({
                  type: 'gif',
                  content: url,
                  media: {
                    url,
                    thumb: gif?.thumb || url,
                    name: gif?.title || 'Reaction GIF',
                  },
                });
              }}
              onClose={() => setShowGIFPicker(false)}
            />
          </div>
        )}

        {showEmoji && (
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 shadow-xl">
            <EmojiPicker
              theme={isDark ? 'dark' : 'light'}
              onEmojiClick={(e) => {
                const next = (text + e.emoji).slice(0, MESSAGING_PART1_LIMITS.TEXT_MAX_LENGTH);
                setText(next);
                if (!editingMessage && uid && conversationId) {
                  saveScopedDraft(uid, conversationId, { text: next, replyTo });
                }
                setShowEmoji(false);
              }}
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/*"
        />
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          onChange={handleMediaSelect}
          className="hidden"
          accept="image/*,video/*"
        />
      </div>
    );
  }
);

MessageInput.displayName = 'MessageInput';

export default MessageInput;

