// src/components/messaging/MessageBubble.jsx

import React, { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Copy, Reply, Share, Trash2, Edit3, Flag, Lock, MoreVertical, CheckCheck, Clock, AlertCircle, Bookmark, MapPin, ExternalLink, User, X, Play, Pause, Volume2 } from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯'];

const MessageBubble = React.memo(({
  message,
  isOwn,
  senderName,
  senderAvatar,
  onLongPress,
  onReaction,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReport,
  onSave,
  isSaved = false,
  theme,
  isGroup,
  isGroupStart = true,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);
  const longPressTimerRef = useRef(null);

  if (!message) return null;

  const { id, type, content, media, reactions, isEdited, isDeleted, _pending, _failed, createdAt } = message;

  const time = createdAt?.toDate?.()
    ? format(createdAt.toDate(), 'p')
    : (createdAt instanceof Date ? format(createdAt, 'p') : '');

  const getStatusIcon = () => {
    if (_failed) return <AlertCircle className="w-3 h-3 text-red-500" />;
    if (_pending) return <Clock className="w-3 h-3 text-gray-400 animate-spin" />;
    if (isOwn) return <CheckCheck className="w-3 h-3 text-purple-400" />;
    return null;
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
      setShowMenu(false);
    }
  };

  const handleReaction = (emoji) => {
    onReaction?.(id, emoji);
    setShowReactions(false);
  };

  // Touch handlers for mobile long-press
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMenu(true);
      onLongPress?.(message);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Toggle play/pause for voice messages
  const handleToggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(() => {
        setIsPlayingAudio(false);
      });
    }
  };

  // Filter out deleted messages
  if (isDeleted) {
    return (
      <div className={cn('flex gap-2 mb-2', isOwn ? 'justify-end' : 'justify-start')}>
        <div className={cn(
          'max-w-xs px-3.5 py-2 rounded-2xl text-xs italic',
          theme === 'dark'
            ? 'text-gray-500 bg-gray-800/40 border border-white/5'
            : 'text-gray-500 bg-gray-100 border border-gray-200'
        )}>
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-2.5 group relative',
        isOwn ? 'justify-end' : 'justify-start',
        isGroupStart ? 'mt-3' : 'mt-1'
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* Avatar (for group chats, only on left side, first message of the group) */}
      {!isOwn && isGroup && isGroupStart && (
        <div className="flex-shrink-0 mt-1">
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              className="w-7 h-7 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-[10px] text-white flex items-center justify-center font-bold">
              {(senderName?.[0] || 'U').toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Message bubble container */}
      <div
        className="flex flex-col gap-1 max-w-[85%] sm:max-w-md relative"
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
          onLongPress?.(message);
        }}
      >
        {/* Sender name (for group chats, first message of the group) */}
        {!isOwn && isGroup && isGroupStart && (
          <div className={cn(
            'text-[11px] font-bold px-3 pt-0.5',
            theme === 'dark' ? 'text-gray-400' : 'text-slate-600'
          )}>
            {senderName}
          </div>
        )}

        {/* Reply quote */}
        {message.replyTo && (
          <div className={cn(
            'px-3 py-1.5 text-xs rounded-xl border-l-2 mb-1 backdrop-blur-sm',
            isOwn
              ? 'bg-white/10 border-purple-300 text-purple-100'
              : (theme === 'dark'
                ? 'bg-white/5 border-purple-500 text-gray-300'
                : 'bg-slate-100 border-purple-500 text-slate-700')
          )}>
            <div className="font-bold text-[11px] text-purple-400">{message.replyTo.senderName || 'Reply'}</div>
            <div className="truncate opacity-80 text-[11px]">{message.replyTo.content?.substring(0, 50)}</div>
          </div>
        )}

        {/* Main message bubble row with action triggers */}
        <div className={cn('relative flex items-end gap-1.5', isOwn ? 'flex-row' : 'flex-row-reverse')}>
          {/* Quick hover action buttons */}
          <div className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 pb-1',
            showReactions || showMenu ? 'opacity-100' : ''
          )}>
            <button
              type="button"
              onClick={() => {
                setShowReactions(!showReactions);
                setShowMenu(false);
              }}
              className={cn(
                'p-1.5 rounded-full text-xs transition-colors',
                theme === 'dark' ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
              )}
              title="React"
            >
              😊
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMenu(!showMenu);
                setShowReactions(false);
              }}
              className={cn(
                'p-1.5 rounded-full transition-colors',
                theme === 'dark' ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
              )}
              title="More"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bubble content */}
          <div
            className={cn(
              'px-4 py-2.5 rounded-2xl break-words shadow-sm transition-all relative overflow-hidden',
              isOwn
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white rounded-br-sm shadow-[0_2px_12px_rgba(147,51,234,0.25)]'
                : (theme === 'dark'
                  ? 'bg-[#12182b] text-white border border-white/10 rounded-bl-sm'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-sm rounded-bl-sm'),
              message.encrypted && 'flex items-center gap-2'
            )}
          >
            {message.encrypted && (
              <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0 inline mr-1.5" />
            )}

            {/* TEXT */}
            {type === 'text' && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap select-text">{content}</p>
            )}

            {/* IMAGE */}
            {type === 'image' && media?.url && (
              <div className="space-y-1.5">
                <img
                  src={media.url}
                  alt="Shared media"
                  onClick={() => setPreviewImage(media.url)}
                  className="max-w-xs sm:max-w-sm rounded-xl max-h-72 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  loading="lazy"
                />
                {content && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{content}</p>}
              </div>
            )}

            {/* GIF */}
            {type === 'gif' && (media?.url || content) && (
              <img
                src={media?.url || content}
                alt="GIF"
                onClick={() => setPreviewImage(media?.url || content)}
                className="max-w-xs rounded-xl max-h-64 object-cover cursor-pointer"
                loading="lazy"
              />
            )}

            {/* VIDEO */}
            {type === 'video' && media?.url && (
              <div className="space-y-1.5">
                <video
                  src={media.url}
                  controls
                  className="max-w-xs sm:max-w-sm rounded-xl max-h-72"
                  preload="metadata"
                />
                {content && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{content}</p>}
              </div>
            )}

            {/* VOICE / AUDIO */}
            {(type === 'voice' || type === 'audio') && media?.url && (
              <div className="flex items-center gap-3 py-1 min-w-[200px]">
                <audio
                  ref={audioRef}
                  src={media.url}
                  preload="metadata"
                  onEnded={() => setIsPlayingAudio(false)}
                />
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-sm shrink-0',
                    isOwn
                      ? 'bg-white text-purple-700 hover:bg-white/90'
                      : 'bg-purple-600 text-white hover:bg-purple-500'
                  )}
                  aria-label={isPlayingAudio ? 'Pause voice message' : 'Play voice message'}
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 opacity-70" />
                    <span className="text-xs font-semibold">
                      {type === 'voice' ? 'Voice note' : 'Audio file'}
                    </span>
                  </div>
                  <span className="text-[10px] opacity-75">
                    {media.durationSec ? `${media.durationSec}s` : 'Audio'}
                  </span>
                </div>
              </div>
            )}

            {/* LOCATION */}
            {type === 'location' && (
              <a
                href={content || (media?.location ? `https://maps.google.com/?q=${media.location.latitude},${media.location.longitude}` : '#')}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  'block p-2 rounded-xl transition-all border group/loc',
                  isOwn
                    ? 'bg-white/10 border-white/20 hover:bg-white/15'
                    : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">Shared Location</p>
                    <p className="text-[10px] opacity-75 truncate">Open in Google Maps</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover/loc:opacity-100" />
                </div>
              </a>
            )}

            {/* CONTACT CARD */}
            {type === 'contact' && (
              <div className={cn(
                'p-2.5 rounded-xl border flex items-center gap-2.5 min-w-[200px]',
                isOwn
                  ? 'bg-white/10 border-white/20'
                  : (theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
              )}>
                <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">Contact Card</p>
                  <p className="text-[10px] opacity-75 truncate">{content || 'User Profile'}</p>
                </div>
              </div>
            )}

            {/* GENERIC FILE */}
            {type === 'file' && media && (
              <a
                href={media.url || '#'}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  'flex items-center gap-2.5 p-2 rounded-xl border transition-colors',
                  isOwn
                    ? 'bg-white/10 border-white/20 hover:bg-white/15'
                    : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                  📄
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{media.name || 'Attachment'}</div>
                  <div className="text-[10px] opacity-75">{media.size || 'File'}</div>
                </div>
              </a>
            )}

            {isEdited && (
              <span className="text-[10px] opacity-70 ml-1.5 italic">(edited)</span>
            )}
          </div>
        </div>

        {/* Reactions badges underneath bubble */}
        {reactions && Object.keys(reactions).length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-1 px-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}>
            {Object.entries(
              Object.values(reactions).reduce((acc, emoji) => {
                acc[emoji] = (acc[emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border shadow-xs transition-transform active:scale-90',
                  theme === 'dark'
                    ? 'bg-[#182038] text-white border-white/10 hover:border-purple-500/40'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-[10px] font-bold opacity-75">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp and delivery status */}
        <div className={cn(
          'flex items-center gap-1 text-[10px] px-2',
          isOwn ? 'justify-end text-purple-300/70' : 'justify-start text-gray-400'
        )}>
          <span>{time}</span>
          {getStatusIcon()}
        </div>

        {/* Reactions Picker Popover */}
        {showReactions && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowReactions(false)}
            />
            <div className={cn(
              'absolute z-50 bottom-full mb-2 p-1.5 rounded-2xl shadow-xl flex items-center gap-1 border animate-in fade-in zoom-in-95 duration-150',
              isOwn ? 'right-0' : 'left-0',
              theme === 'dark'
                ? 'bg-[#0f172a] border-white/15 shadow-black/60'
                : 'bg-white border-slate-200 shadow-slate-300/60'
            )}>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {/* More Actions Menu Popover */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className={cn(
              'absolute z-50 bottom-full mb-2 w-44 rounded-2xl shadow-xl overflow-hidden border p-1 animate-in fade-in zoom-in-95 duration-150',
              isOwn ? 'right-0' : 'left-0',
              theme === 'dark'
                ? 'bg-[#0f172a] border-white/15 text-gray-200 shadow-black/60'
                : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
            )}>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                )}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Text</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onReply?.(message);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                )}
              >
                <Reply className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onForward?.(message);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                )}
              >
                <Share className="w-3.5 h-3.5" />
                <span>Forward</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSave?.(message);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                )}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Unsave' : 'Save'}</span>
              </button>

              {isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit?.(message);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    )}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(message);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors text-red-500 hover:bg-red-500/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onReport?.(message);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 rounded-xl transition-colors text-red-500 hover:bg-red-500/15"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Full image preview modal / lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close image preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
