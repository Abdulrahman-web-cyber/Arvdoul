// src/components/messaging/MessageInput.jsx
// 🎯 Message input bar with attachments, voice recording, etc.

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  Image as ImageIcon,
  Video,
  File,
  MapPin,
  User,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';

const MessageInput = React.memo(({
  onSendMessage,
  onSendMedia,
  onStartRecording,
  onStopRecording,
  onTyping,
  conversationId,
  theme,
  disabled = false,
  placeholder = 'Message...',
  maxHeight = '120px',
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const textInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const typingTimeoutRef = useRef(null);

  // Handle typing indicator
  const handleTypingChange = (value) => {
    setText(value);
    onTyping?.(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping?.(false);
    }, 3000);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!text.trim() && attachedFiles.length === 0) return;
    if (isSending || disabled) return;

    try {
      isSending(true);
      
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          await onSendMedia?.({
            file,
            text: attachedFiles.indexOf(file) === 0 ? text : '',
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
      isSending(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle media selection
  const handleMediaSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      await onSendMedia?.({ file });
    }
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  // Start recording voice
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondata = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
        onStartRecording?.();
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

  // Stop recording voice
  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      onStopRecording?.();
    }
  };

  // Remove attached file
  const removeAttachedFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn(
      'border-t p-3 space-y-3',
      theme === 'dark'
        ? 'border-gray-800 bg-gray-900'
        : 'border-gray-200 bg-white'
    )}>
      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {attachedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className={cn(
                'relative flex-shrink-0 rounded-lg overflow-hidden',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-20 w-20 object-cover"
                />
              ) : file.type.startsWith('video/') ? (
                <video
                  src={URL.createObjectURL(file)}
                  className="h-20 w-20 object-cover"
                />
              ) : (
                <div className="h-20 w-20 flex items-center justify-center">
                  <File className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <button
                onClick={() => removeAttachedFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg',
          theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
        )}>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className={cn(
            'text-sm font-medium',
            theme === 'dark' ? 'text-red-400' : 'text-red-700'
          )}>
            Recording: {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
          </span>
          <button
            onClick={handleStopRecording}
            className="ml-auto px-3 py-1 rounded bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          disabled={disabled || isRecording || isSending}
          className={cn(
            'p-2 rounded-full transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-300 disabled:text-gray-600'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:text-gray-300'
          )}
          title="Attach media"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
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
            'flex-1 px-4 py-2 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-purple-500',
            'text-sm placeholder-gray-500 max-h-[120px]',
            theme === 'dark'
              ? 'bg-gray-800 text-white border border-gray-700'
              : 'bg-gray-100 text-gray-900 border border-gray-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          rows={1}
          style={{
            minHeight: '40px',
            maxHeight: maxHeight,
            overflowY: 'auto',
          }}
        />

        {/* Emoji button */}
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          disabled={disabled || isRecording}
          className={cn(
            'p-2 rounded-full transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-300 disabled:text-gray-600'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:text-gray-300'
          )}
          title="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Voice or Send button */}
        {text.trim() || attachedFiles.length > 0 ? (
          <button
            onClick={handleSendMessage}
            disabled={disabled || isSending}
            className={cn(
              'p-2 rounded-full transition-colors text-white',
              'bg-gradient-to-r from-purple-600 to-pink-600',
              'hover:from-purple-700 hover:to-pink-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Send message"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        ) : (
          <button
            onMouseDown={handleStartRecording}
            onMouseUp={handleStopRecording}
            onTouchStart={handleStartRecording}
            onTouchEnd={handleStopRecording}
            disabled={disabled}
            className={cn(
              'p-2 rounded-full transition-colors',
              isRecording
                ? 'bg-red-500 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Press to record"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Attachment menu */}
      {showAttachments && (
        <div className={cn(
          'flex gap-2 p-3 rounded-lg',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-700/50 transition-colors"
          >
            <ImageIcon className="w-5 h-5 text-blue-500" />
            <span className="text-xs">Photo</span>
          </button>
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-700/50 transition-colors"
          >
            <Video className="w-5 h-5 text-red-500" />
            <span className="text-xs">Video</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-700/50 transition-colors"
          >
            <File className="w-5 h-5 text-yellow-500" />
            <span className="text-xs">File</span>
          </button>
          <button
            onClick={() => {
              setShowAttachments(false);
              toast.info('Location sharing coming soon');
            }}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-700/50 transition-colors"
          >
            <MapPin className="w-5 h-5 text-green-500" />
            <span className="text-xs">Location</span>
          </button>
          <button
            onClick={() => {
              setShowAttachments(false);
              toast.info('Contact sharing coming soon');
            }}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-700/50 transition-colors"
          >
            <User className="w-5 h-5 text-purple-500" />
            <span className="text-xs">Contact</span>
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="max-h-64 overflow-y-auto">
          <EmojiPicker onEmojiClick={(e) => {
            setText((prev) => prev + e.emoji);
            setShowEmoji(false);
          }} />
        </div>
      )}

      {/* Hidden file inputs */}
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
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
