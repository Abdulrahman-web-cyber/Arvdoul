// src/components/messaging/MessageBubble.jsx

import React, { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { MESSAGING_CONFIG } from '../../services/messagesService.js';
import {
  sanitizeExternalUrl,
  extractFirstSafeUrl,
  resolveSharedContentRoute,
  MESSAGING_PART1_LIMITS,
} from '../../config/messagingContracts.js';
import {
  Copy,
  Reply,
  Share,
  Trash2,
  Edit3,
  Flag,
  Lock,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Bookmark,
  Pin,
  MapPin,
  ExternalLink,
  User,
  X,
  Play,
  Pause,
  Volume2,
  SmilePlus,
  FileText,
  EyeOff,
  RotateCcw,
  Globe,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LazyImage } from '../../components/Shared/LazyImage';

const REACTION_EMOJIS =
  (MESSAGING_CONFIG && MESSAGING_CONFIG.REACTION_TYPES) || ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function toMillis(val) {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  const parsed = new Date(val).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

const MessageBubble = React.memo(
  ({
    message,
    isOwn,
    senderName,
    senderAvatar,
    currentUid = null,
    peerLastReadAt = null,
    peerLastDeliveredAt = null,
    deletedMessageIds = null,
    onReaction,
    onReply,
    onForward,
    onEdit,
    onDelete,
    onReport,
    onSave,
    onPin,
    onRetry,
    onRemoveFailed,
    onViewHistory,
    onJumpToMessage,
    onOpenViewOnce,
    openedViewOnceIds = null,
    onNavigate,
    isSaved = false,
    isPinned = false,
    theme,
    isGroup,
    isGroupStart = true,
  }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const audioRef = useRef(null);
    const longPressTimerRef = useRef(null);

    if (!message) return null;

    const { id, type, content, media, reactions, isEdited, isDeleted, _pending, _failed, _queued, createdAt } = message;
    const isDark = theme === 'dark';

    const msgMs = toMillis(createdAt);
    const time = msgMs ? format(new Date(msgMs), 'p') : '';

    const hasOtherRead = Boolean(
      (Array.isArray(message.readBy) && message.readBy.some((u) => u !== message.senderId)) ||
      (peerLastReadAt && msgMs && msgMs <= toMillis(peerLastReadAt))
    );
    const hasOtherDelivered = Boolean(
      (Array.isArray(message.deliveredTo) && message.deliveredTo.some((u) => u !== message.senderId)) ||
      (peerLastDeliveredAt && msgMs && msgMs <= toMillis(peerLastDeliveredAt))
    );

    const canEditWithinWindow = Boolean(
      isOwn &&
      onEdit &&
      !_pending &&
      !_failed &&
      (type === 'text' || type === 'link') &&
      (!msgMs || (Date.now() - msgMs) <= MESSAGING_PART1_LIMITS.EDIT_WINDOW_MS)
    );

    const getStatusIcon = () => {
      if (_failed) return <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-label="Failed to send" />;
      if (_queued) return <Clock className="w-3.5 h-3.5 text-amber-400" aria-label="Queued offline" />;
      if (_pending) return <Clock className="w-3.5 h-3.5 text-slate-400" aria-label="Sending" />;
      if (isOwn) {
        if (hasOtherRead) return <CheckCheck className="w-3.5 h-3.5 text-blue-400" aria-label="Read" />;
        if (hasOtherDelivered) {
          return <CheckCheck className="w-3.5 h-3.5 text-slate-400" aria-label="Delivered" />;
        }
        return <Check className="w-3.5 h-3.5 text-slate-400" aria-label="Sent" />;
      }
      return null;
    };

    const handleCopy = () => {
      if (content) {
        navigator.clipboard?.writeText(content);
        toast.success('Copied to clipboard');
        setShowMenu(false);
      }
    };

    const handleReaction = (emoji) => {
      onReaction?.(id, emoji);
      setShowReactions(false);
    };

    const handleTouchStart = () => {
      longPressTimerRef.current = setTimeout(() => {
        setShowMenu(true);
      }, 500);
    };

    const handleTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleToggleAudio = () => {
      if (!audioRef.current) return;
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.playbackRate = playbackRate;
        audioRef.current
          .play()
          .then(() => setIsPlayingAudio(true))
          .catch(() => setIsPlayingAudio(false));
      }
    };

    const handleCycleSpeed = () => {
      const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
      setPlaybackRate(nextRate);
      if (audioRef.current) audioRef.current.playbackRate = nextRate;
    };

    const internalPathMatch = typeof content === 'string'
      ? content.match(/https?:\/\/[^/\s]+(\/(?:post|profile|user|vibes|stories|video|community|spaces)\/[^\s]+)/i)
      : null;
    const sharedInternalPath = internalPathMatch ? internalPathMatch[1] : null;
    const safeExternalUrl =
      sanitizeExternalUrl(message.linkPreview?.url) ||
      (type === 'link' || type === 'text' ? extractFirstSafeUrl(content) : null);

    let linkHost = null;
    if (safeExternalUrl) {
      try {
        linkHost = new URL(safeExternalUrl).hostname.replace(/^www\./, '');
      } catch {
        linkHost = null;
      }
    }

    const isReplyOriginalDeleted = Boolean(
      message.replyTo?.messageId &&
      deletedMessageIds &&
      typeof deletedMessageIds.has === 'function' &&
      deletedMessageIds.has(message.replyTo.messageId)
    );

    if (isDeleted) {
      return (
        <div className={cn('flex gap-2 mb-2', isOwn ? 'justify-end' : 'justify-start')}>
          <div
            className={cn(
              'max-w-xs px-3.5 py-2 rounded-2xl text-xs italic',
              isDark
                ? 'text-slate-400 bg-white/[0.04] border border-white/[0.08]'
                : 'text-slate-500 bg-slate-100 border border-slate-200'
            )}
          >
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
          isGroupStart ? 'mt-3.5' : 'mt-1'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {!isOwn && isGroup && isGroupStart && (
          <div className="flex-shrink-0 mt-1">
            {senderAvatar ? (
              <LazyImage
                src={senderAvatar}
                alt={senderName}
                className="w-7 h-7 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-arvdoul-gradient text-[10px] text-white flex items-center justify-center font-bold">
                {(senderName?.[0] || '?').toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div
          className="flex flex-col gap-1 max-w-[85%] sm:max-w-md relative"
          onContextMenu={(e) => {
            e.preventDefault();
            setShowMenu(true);
          }}
        >
          {!isOwn && isGroup && isGroupStart && (
            <div
              className={cn(
                'text-[11px] font-semibold px-2 pt-0.5',
                isDark ? 'text-slate-400' : 'text-slate-600'
              )}
            >
              {senderName}
            </div>
          )}

          {/* Clickable reply quote */}
          {message.replyTo && (
            <button
              type="button"
              onClick={() => message.replyTo?.messageId && onJumpToMessage?.(message.replyTo.messageId)}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs rounded-xl border mb-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isOwn
                  ? 'bg-purple-500/15 border-purple-400/30 text-purple-100'
                  : isDark
                    ? 'bg-white/[0.04] border-white/10 text-slate-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
              )}
            >
              <div className="font-semibold text-[11px] text-purple-400">
                {message.replyTo.senderName || 'Reply'}
              </div>
              <div className={cn('truncate opacity-80 text-[11px]', isReplyOriginalDeleted && 'italic opacity-65')}>
                {isReplyOriginalDeleted
                  ? 'Original message deleted'
                  : (message.replyTo.content || message.replyTo.contentPreview || '').substring(0, 80)}
              </div>
            </button>
          )}

          <div className={cn('relative flex items-end gap-1', isOwn ? 'flex-row' : 'flex-row-reverse')}>
            {/* Action triggers — visible for touch & keyboard users */}
            <div
              className={cn(
                'opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 pb-0.5',
                showReactions || showMenu ? '!opacity-100' : ''
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setShowReactions(!showReactions);
                  setShowMenu(false);
                }}
                className={cn(
                  'min-h-[34px] min-w-[34px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark
                    ? 'hover:bg-white/10 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                )}
                aria-label="React to message"
                title="React"
              >
                <SmilePlus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(!showMenu);
                  setShowReactions(false);
                }}
                className={cn(
                  'min-h-[34px] min-w-[34px] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark
                    ? 'hover:bg-white/10 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                )}
                aria-label="Message actions"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Bubble content */}
            <div
              className={cn(
                'px-3.5 py-2.5 rounded-2xl break-words transition-colors relative overflow-hidden',
                isOwn
                  ? 'bg-arvdoul-gradient text-white rounded-br-sm shadow-sm'
                  : isDark
                    ? 'bg-[#0F1733] text-white border border-white/[0.08] rounded-bl-sm'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-xs rounded-bl-sm',
                _failed && 'ring-1 ring-red-400/70',
                message.encrypted && 'flex items-center gap-2'
              )}
            >
              {message.encrypted && (
                <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0 inline mr-1" aria-hidden="true" />
              )}

              {(type === 'text' || type === 'link') && (
                <div className="space-y-1.5">
                  {content && (
                    <p dir="auto" className="text-[14px] leading-relaxed whitespace-pre-wrap select-text">
                      {content}
                    </p>
                  )}
                  {sharedInternalPath && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(sharedInternalPath)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                        isOwn
                          ? 'bg-white/15 border-white/25 text-white hover:bg-white/25'
                          : isDark
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
                            : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                      )}
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      <span>Open in Arvdoul</span>
                    </button>
                  )}
                  {safeExternalUrl && !sharedInternalPath && (
                    <a
                      href={safeExternalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-2.5 p-2 rounded-xl border transition-colors',
                        isOwn
                          ? 'bg-white/10 border-white/20 hover:bg-white/15'
                          : isDark
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">
                          {message.linkPreview?.title || linkHost || 'External link'}
                        </p>
                        <p className="text-[11px] opacity-75 truncate">{safeExternalUrl}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              {type === 'shared_content' && (() => {
                const sc = message.sharedContent || {};
                const route = resolveSharedContentRoute(sc);
                const unavailable = Boolean(message.sharedContentUnavailable || !sc.contentId);
                const kindLabel = sc.contentType === 'spark' ? 'Spark Video' : sc.contentType === 'vibe' ? 'Vibe Story' : 'Post';
                return (
                  <button
                    type="button"
                    disabled={unavailable || !onNavigate}
                    onClick={() => !unavailable && onNavigate?.(route)}
                    className={cn(
                      'w-full text-left rounded-xl border p-2.5 space-y-2 min-w-[210px] transition-colors',
                      isOwn
                        ? 'bg-white/10 border-white/20 hover:bg-white/15'
                        : isDark
                          ? 'bg-white/5 border-white/10 hover:bg-white/10'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                      unavailable && 'opacity-65 cursor-default'
                    )}
                  >
                    {sc.thumbnailUrl && !unavailable && (
                      <LazyImage
                        src={sc.thumbnailUrl}
                        alt={sc.title || kindLabel}
                        className="w-full h-32 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                          {unavailable ? 'Content unavailable' : kindLabel}
                        </p>
                        <p className="text-xs font-semibold truncate">
                          {unavailable
                            ? 'This shared item was removed or is private.'
                            : (sc.title || content || `View ${kindLabel.toLowerCase()}`)}
                        </p>
                        {sc.authorName && !unavailable && (
                          <p className="text-[11px] opacity-75 truncate">by {sc.authorName}</p>
                        )}
                      </div>
                      {!unavailable && <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0 mt-0.5" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })()}

              {type === 'view_once' && (() => {
                const isOpened = Boolean(
                  openedViewOnceIds?.[id] ||
                  (Array.isArray(message.deletedFor) && currentUid && message.deletedFor.includes(currentUid)) ||
                  (!isOwn && Array.isArray(message.readBy) && currentUid && message.readBy.includes(currentUid))
                );
                const kindLabel = (media?.mimeType?.startsWith('video/') || media?.type?.startsWith('video/') || /video/i.test(content || ''))
                  ? 'Video'
                  : 'Photo';
                return (
                  <button
                    type="button"
                    disabled={isOpened || isOwn || !media?.url || !onOpenViewOnce}
                    onClick={() => onOpenViewOnce?.(message)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all min-w-[180px]',
                      isOpened || isOwn
                        ? isOwn
                          ? 'bg-white/10 border-white/20 opacity-85 cursor-default'
                          : isDark
                            ? 'bg-white/[0.04] border-white/10 text-slate-400 cursor-default'
                            : 'bg-slate-100 border-slate-200 text-slate-500 cursor-default'
                        : isDark
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-200 hover:bg-purple-500/25'
                          : 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      isOpened || isOwn ? 'bg-white/15' : 'bg-arvdoul-gradient text-white'
                    )}>
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {isOpened
                          ? 'Opened'
                          : isOwn
                            ? `View-once ${kindLabel.toLowerCase()}`
                            : `${kindLabel} · Tap to view`}
                      </p>
                      <p className="text-[11px] opacity-75 truncate">
                        {isOpened ? 'Disappeared after viewing' : isOwn ? 'Visible once by recipient' : 'Disappears after opening'}
                      </p>
                    </div>
                  </button>
                );
              })()}

              {type === 'image' && media?.url && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewImage(media.url)}
                    aria-label="View full size image"
                    className="block rounded-xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  >
                    <LazyImage
                      src={media.url}
                      alt="Shared image"
                      className="max-w-xs sm:max-w-sm rounded-xl max-h-72 object-cover hover:opacity-95 transition-opacity"
                      loading="lazy"
                    />
                  </button>
                  {content && <p dir="auto" className="text-[14px] leading-relaxed whitespace-pre-wrap">{content}</p>}
                </div>
              )}

              {type === 'gif' && (media?.url || content) && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(media?.url || content)}
                  aria-label="View GIF"
                  className="block rounded-xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  <LazyImage
                    src={media?.url || content}
                    alt="GIF"
                    className="max-w-xs rounded-xl max-h-64 object-cover"
                    loading="lazy"
                  />
                </button>
              )}

              {type === 'video' && media?.url && (
                <div className="space-y-1.5">
                  <video
                    src={media.url}
                    controls
                    className="max-w-xs sm:max-w-sm rounded-xl max-h-72"
                    preload="metadata"
                  />
                  {content && <p dir="auto" className="text-[14px] leading-relaxed whitespace-pre-wrap">{content}</p>}
                </div>
              )}

              {(type === 'voice' || type === 'audio') && media?.url && (
                <div className="flex items-center gap-2.5 py-1 min-w-[220px]">
                  <audio
                    ref={audioRef}
                    src={media.url}
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setAudioDuration(d);
                    }}
                    onTimeUpdate={(e) => {
                      const el = e.currentTarget;
                      if (el.duration > 0) {
                        setAudioProgress(Math.min(100, (el.currentTime / el.duration) * 100));
                      }
                    }}
                    onEnded={() => {
                      setIsPlayingAudio(false);
                      setAudioProgress(0);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                      isOwn
                        ? 'bg-white text-purple-700 hover:bg-white/90'
                        : 'bg-arvdoul-gradient text-white hover:brightness-105'
                    )}
                    aria-label={isPlayingAudio ? 'Pause voice message' : 'Play voice message'}
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5 opacity-75" aria-hidden="true" />
                        {type === 'voice' ? 'Voice note' : 'Audio'}
                      </span>
                      <span className="text-[11px] opacity-80 tabular-nums">
                        {media.durationSec
                          ? `${Math.round(media.durationSec)}s`
                          : audioDuration > 0
                            ? `${Math.round(audioDuration)}s`
                            : 'Audio'}
                      </span>
                    </div>
                    <div className={cn('h-1.5 rounded-full overflow-hidden', isOwn ? 'bg-white/25' : isDark ? 'bg-white/10' : 'bg-slate-200')}>
                      <div
                        className={cn('h-full rounded-full transition-all duration-150', isOwn ? 'bg-white' : 'bg-arvdoul-gradient')}
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCycleSpeed}
                    aria-label={`Playback speed ${playbackRate}x`}
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 transition-colors',
                      isOwn ? 'bg-white/20 text-white hover:bg-white/30' : isDark ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    )}
                  >
                    {playbackRate}x
                  </button>
                </div>
              )}

              {type === 'location' && (() => {
                const safeMapUrl = sanitizeExternalUrl(
                  content ||
                  (media?.location
                    ? `https://maps.google.com/?q=${media.location.latitude},${media.location.longitude}`
                    : '')
                ) || '#';
                return (
                  <a
                    href={safeMapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      'block p-2 rounded-xl transition-colors border group/loc',
                      isOwn
                        ? 'bg-white/10 border-white/20 hover:bg-white/15'
                        : isDark
                          ? 'bg-white/5 border-white/10 hover:bg-white/10'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">Shared Location</p>
                        <p className="text-[11px] opacity-75 truncate">Open in Maps</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover/loc:opacity-100" aria-hidden="true" />
                    </div>
                  </a>
                );
              })()}

              {type === 'contact' && (() => {
                const contactUid = typeof content === 'string' && content.startsWith('profile:')
                  ? content.slice('profile:'.length).trim()
                  : null;
                return (
                  <button
                    type="button"
                    disabled={!contactUid || !onNavigate}
                    onClick={() => contactUid && onNavigate?.(`/profile/${contactUid}`)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 min-w-[200px] transition-colors',
                      isOwn
                        ? 'bg-white/10 border-white/20 hover:bg-white/15'
                        : isDark
                          ? 'bg-white/5 border-white/10 hover:bg-white/10'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">Arvdoul Profile Card</p>
                      <p className="text-[11px] opacity-75 truncate">{contactUid ? 'Tap to view profile' : content || 'User Profile'}</p>
                    </div>
                    {contactUid && <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })()}

              {type === 'file' && media && (() => {
                const safeFileUrl = sanitizeExternalUrl(media.url) || '#';
                return (
                  <a
                    href={safeFileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      'flex items-center gap-2.5 p-2 rounded-xl border transition-colors',
                      isOwn
                        ? 'bg-white/10 border-white/20 hover:bg-white/15'
                        : isDark
                          ? 'bg-white/5 border-white/10 hover:bg-white/10'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{media.name || 'Attachment'}</div>
                      <div className="text-[11px] opacity-75 tabular-nums">{media.size || 'File'}</div>
                    </div>
                  </a>
                );
              })()}

              {isEdited && (
                <button
                  type="button"
                  onClick={() => onViewHistory?.(message)}
                  className="text-[11px] opacity-75 ml-1.5 italic underline decoration-dotted hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded"
                  title="View edit history"
                >
                  (edited)
                </button>
              )}
            </div>
          </div>

          {/* Reactions */}
          {reactions && Object.keys(reactions).length > 0 && (
            <div className={cn('flex flex-wrap gap-1 px-1', isOwn ? 'justify-end' : 'justify-start')}>
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
                  aria-label={`Toggle ${emoji} reaction`}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-transform active:scale-95 tabular-nums',
                    isDark
                      ? 'bg-[#121B3A] text-white border-white/10 hover:border-purple-400/50'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-purple-400'
                  )}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[11px] font-semibold opacity-80">{count}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Timestamp, delivery status, and failed send retry/remove controls */}
          <div
            className={cn(
              'flex items-center gap-1.5 text-[11px] px-1 tabular-nums flex-wrap',
              isOwn
                ? isDark
                  ? 'justify-end text-slate-400'
                  : 'justify-end text-slate-500'
                : isDark
                  ? 'justify-start text-slate-400'
                  : 'justify-start text-slate-500'
            )}
          >
            {isPinned && <Pin className="w-3 h-3 text-purple-400 rotate-45" aria-label="Pinned" />}
            {_queued && <span className="text-amber-400 font-medium">Queued offline</span>}
            <span>{time}</span>
            {getStatusIcon()}
          </div>

          {_failed && isOwn && (
            <div className="flex items-center justify-end gap-2 px-1 text-[11px]">
              <span className="text-red-500 font-medium">{message._error || 'Not delivered'}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="inline-flex items-center gap-1 font-semibold text-purple-400 hover:text-purple-300"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Retry</span>
                </button>
              )}
              {onRemoveFailed && (
                <button
                  type="button"
                  onClick={() => onRemoveFailed(message)}
                  className="font-medium text-slate-400 hover:text-slate-200"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {/* Reactions Picker Popover */}
          {showReactions && (
            <>
              <button
                type="button"
                aria-label="Close reactions picker"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowReactions(false)}
              />
              <div
                className={cn(
                  'absolute z-50 bottom-full mb-2 p-1.5 rounded-2xl shadow-xl flex items-center gap-1 border',
                  isOwn ? 'right-0' : 'left-0',
                  isDark ? 'bg-[#0B1230] border-white/15' : 'bg-white border-slate-200'
                )}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    aria-label={`React with ${emoji}`}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:scale-110 transition-transform"
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
              <button
                type="button"
                aria-label="Close message menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowMenu(false)}
              />
              <div
                className={cn(
                  'absolute z-50 bottom-full mb-2 w-44 rounded-2xl shadow-xl overflow-hidden border p-1',
                  isOwn ? 'right-0' : 'left-0',
                  isDark
                    ? 'bg-[#0B1230] border-white/15 text-slate-200'
                    : 'bg-white border-slate-200 text-slate-800'
                )}
              >
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                    isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  )}
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onReply?.(message);
                    setShowMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                    isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  )}
                >
                  <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reply</span>
                </button>

                {type !== 'view_once' && (
                  <button
                    type="button"
                    onClick={() => {
                      onForward?.(message);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    )}
                  >
                    <Share className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Forward</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onSave?.(message);
                    setShowMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                    isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  )}
                >
                  <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSaved ? 'Unsave' : 'Save'}</span>
                </button>

                {onPin && (
                  <button
                    type="button"
                    onClick={() => {
                      onPin(message);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    )}
                  >
                    <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                )}

                {canEditWithinWindow && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit?.(message);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    )}
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                )}

                {isEdited && onViewHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewHistory(message);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors',
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit history</span>
                  </button>
                )}

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(message);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors text-red-500 hover:bg-red-500/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isOwn ? 'Delete' : 'Delete for me'}</span>
                  </button>
                )}

                {!isOwn && onReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onReport(message);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 rounded-xl transition-colors text-red-500 hover:bg-red-500/15"
                  >
                    <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Report</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Full image preview modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
              className="fixed inset-0 cursor-default"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Close image preview button"
            >
              <X className="w-6 h-6" />
            </button>
            <LazyImage
              src={previewImage}
              alt="Preview"
              className="relative z-10 max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        )}
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;

