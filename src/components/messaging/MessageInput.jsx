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
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import GIFPicker from '../Shared/GIFPicker';
import { LazyImage } from '../../components/Shared/LazyImage';

const MessageInput = React.memo(
  ({
    onSendMessage,
    onSendMedia,
    onTyping,
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
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const { user: currentUser } = useAuth();
    const textInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaInputRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const typingTimeoutRef = useRef(null);

    const isDark = theme === 'dark';

    useEffect(() => {
      const urls = attachedFiles.map((file) =>
        file.type.startsWith('image/') || file.type.startsWith('video/')
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
      },
      []
    );

    const handleTypingChange = (value) => {
      setText(value);
      onTyping?.(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 3000);
    };

    const handleSendMessage = async () => {
      if (!text.trim() && attachedFiles.length === 0) return;
      if (isSending || disabled) return;

      try {
        setIsSending(true);
        if (attachedFiles.length > 0) {
          for (let i = 0; i < attachedFiles.length; i += 1) {
            await onSendMedia?.({
              file: attachedFiles[i],
              text: i === 0 ? text.trim() : '',
            });
          }
        } else {
          await onSendMessage?.({ type: 'text', content: text });
        }
        setText('');
        setAttachedFiles([]);
        textInputRef.current?.focus();
      } catch (error) {
        toast.error('Failed to send message');
        console.error('Send error:', error);
      } finally {
        setIsSending(false);
      }
    };

    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        setAttachedFiles((prev) => [...prev, ...files]);
        setShowAttachments(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMediaSelect = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        setAttachedFiles((prev) => [...prev, ...files]);
        setShowAttachments(false);
      }
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    };

    const handleStartRecording = async () => {
      if (isRecording || disabled) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstart = () => {
          setIsRecording(true);
          setRecordingDuration(0);
          recordingTimerRef.current = setInterval(() => {
            setRecordingDuration((prev) => prev + 1);
          }, 1000);
        };

        mediaRecorder.onstop = () => {
          setIsRecording(false);
          clearInterval(recordingTimerRef.current);
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          onSendMedia?.({
            file: new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }),
            isVoice: true,
          });
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
        };

        mediaRecorder.start();
      } catch (error) {
        toast.error('Failed to access microphone');
        console.error('Recording error:', error);
      }
    };

    const handleStopRecording = () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };

    const handleCancelRecording = () => {
      if (mediaRecorderRef.current) {
        clearInterval(recordingTimerRef.current);
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        toast.info('Recording cancelled');
      }
    };

    const removeAttachedFile = (index) => {
      setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    return (
      <div
        className={cn(
          'border-t px-3 py-2.5 space-y-2.5',
          isDark ? 'border-white/[0.08] bg-[#050B24]' : 'border-slate-200 bg-white'
        )}
      >
        {/* Staged attachments preview */}
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className={cn(
                  'relative flex-shrink-0 rounded-xl overflow-hidden border',
                  isDark ? 'bg-[#090F2D] border-white/10' : 'bg-slate-100 border-slate-200'
                )}
              >
                {file.type.startsWith('image/') && previewUrls[index] ? (
                  <LazyImage src={previewUrls[index]} alt={file.name} className="h-20 w-20 object-cover" />
                ) : file.type.startsWith('video/') && previewUrls[index] ? (
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
        )}

        {/* Voice recording bar */}
        {isRecording && (
          <div
            className={cn(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border',
              isDark ? 'bg-red-950/30 border-red-800/40' : 'bg-red-50 border-red-200'
            )}
          >
            <Mic className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                isDark ? 'text-red-300' : 'text-red-700'
              )}
            >
              Recording · {Math.floor(recordingDuration / 60)}:
              {String(recordingDuration % 60).padStart(2, '0')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isDark
                    ? 'text-slate-300 hover:bg-white/10'
                    : 'text-slate-600 hover:bg-slate-200'
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Composer controls row */}
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShowAttachments(!showAttachments);
              setShowEmoji(false);
              setShowGIFPicker(false);
            }}
            disabled={disabled || isRecording || isSending}
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

          <textarea
            aria-label="Message"
            ref={textInputRef}
            value={text}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={placeholder}
            disabled={disabled || isRecording}
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
            disabled={disabled || isRecording}
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

          <button
            type="button"
            onClick={() => {
              setShowGIFPicker(!showGIFPicker);
              setShowEmoji(false);
              setShowAttachments(false);
            }}
            disabled={disabled || isRecording}
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

          {text.trim() || attachedFiles.length > 0 ? (
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={disabled || isSending}
              className="min-h-[40px] min-w-[40px] rounded-full transition-all text-white bg-arvdoul-gradient hover:brightness-105 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              aria-label="Send message"
              title="Send message"
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
              disabled={disabled}
              className={cn(
                'min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-all text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-arvdoul-gradient hover:brightness-105'
              )}
              aria-label={isRecording ? 'Stop and send voice message' : 'Record voice message'}
              title={isRecording ? 'Stop and send' : 'Record voice message'}
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
                setText((prev) => prev + e.emoji);
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
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
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
