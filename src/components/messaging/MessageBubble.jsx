// src/components/messaging/MessageBubble.jsx
// 🎯 Message bubble component with reactions, replies, etc.

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
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
} from 'lucide-react';
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
  theme,
  isGroup,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!message) return null;

  const { id, type, content, media, reactions, isEdited, isDeleted, _pending, _failed, createdAt } = message;

  const time = createdAt?.toDate?.() ? format(createdAt.toDate(), 'p') : '';

  const getStatusIcon = () => {
    if (_failed) return <AlertCircle className="w-3 h-3 text-red-500" />;
    if (_pending) return <Clock className="w-3 h-3 text-gray-500 animate-spin" />;
    if (isOwn) return <CheckCheck className="w-3 h-3 text-blue-500" />;
    return null;
  };

  const handleCopy = () => {
    if (type === 'text' && content) {
      navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
      setShowMenu(false);
    }
  };

  const handleReaction = (emoji) => {
    onReaction?.({ messageId: id, emoji });
    setShowReactions(false);
  };

  // Filter out deleted messages
  if (isDeleted) {
    return (
      <div className={cn('flex gap-2 mb-2', isOwn ? 'justify-end' : 'justify-start')}>
        <div className={cn(
          'max-w-xs px-3 py-2 rounded-lg text-sm italic',
          theme === 'dark'
            ? 'text-gray-500 bg-gray-800/30'
            : 'text-gray-500 bg-gray-100'
        )}>
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 mb-3 group', isOwn ? 'justify-end' : 'justify-start')}>
      {/* Avatar (for group chats, only on left side) */}
      {!isOwn && isGroup && (
        <div className="flex-shrink-0 mt-1">
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-400 text-xs text-white flex items-center justify-center font-bold">
              {senderName?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Message bubble container */}
      <div
        className="flex flex-col gap-1"
        onContextMenu={(e) => {
          e.preventDefault();
          onLongPress?.(message);
        }}
      >
        {/* Sender name (for group chats) */}
        {!isOwn && isGroup && (
          <div className={cn(
            'text-xs px-3 pt-1',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {senderName}
          </div>
        )}

        {/* Reply quote */}
        {message.replyTo && (
          <div className={cn(
            'px-3 py-1 text-xs border-l-2 ml-1',
            isOwn
              ? 'border-purple-400 text-purple-200'
              : (theme === 'dark'
                ? 'border-gray-600 text-gray-300'
                : 'border-gray-300 text-gray-600')
          )}>
            <div className="font-semibold">{message.replyTo.senderName}</div>
            <div className="truncate opacity-80">{message.replyTo.content?.substring(0, 40)}</div>
          </div>
        )}

        {/* Main message bubble */}
        <div
          className={cn(
            'relative flex items-end gap-2 group/bubble'
          )}
        >
          {/* Bubble */}
          <div
            className={cn(
              'px-4 py-2 rounded-xl max-w-xs break-words',
              isOwn
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none'
                : (theme === 'dark'
                  ? 'bg-gray-800 text-white rounded-bl-none'
                  : 'bg-gray-200 text-gray-900 rounded-bl-none'),
              message.encrypted && 'flex items-center gap-2'
            )}
          >
            {message.encrypted && (
              <Lock className="w-4 h-4 flex-shrink-0" />
            )}
            
            {type === 'text' && (
              <p className="text-sm leading-normal whitespace-pre-wrap">{content}</p>
            )}

            {type === 'image' && media?.url && (
              <img
                src={media.url}
                alt="Image"
                className="max-w-xs rounded-lg max-h-64 object-cover"
              />
            )}

            {type === 'video' && media?.url && (
              <video
                src={media.url}
                controls
                className="max-w-xs rounded-lg max-h-64"
              />
            )}

            {type === 'audio' && media?.url && (
              <audio
                src={media.url}
                controls
                className="w-64"
              />
            )}

            {type === 'file' && media && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                  📄
                </div>
                <div>
                  <div className="text-xs font-semibold">{media.name}</div>
                  <div className="text-xs opacity-75">{media.size}</div>
                </div>
              </div>
            )}

            {isEdited && (
              <span className="text-xs opacity-70 ml-1">(edited)</span>
            )}
          </div>

          {/* Status icon */}
          {isOwn && _pending && (
            <Clock className="w-4 h-4 text-gray-500 animate-spin flex-shrink-0" />
          )}
          {isOwn && _failed && (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 cursor-pointer hover:text-red-600" />
          )}

          {/* Actions menu */}
          <div className={cn(
            'opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1'
          )}>
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={cn(
                'p-1 rounded hover:bg-gray-300/50 dark:hover:bg-gray-700/50',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}
              title="React"
            >
              😊
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                'p-1 rounded hover:bg-gray-300/50 dark:hover:bg-gray-700/50',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}
              title="More"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactions || {}).length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-1 px-2',
            isOwn ? 'justify-end' : 'justify-start'
          )}>
            {Object.entries(reactions).map(([userId, emoji]) => (
              <div
                key={userId}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  theme === 'dark'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-200 text-gray-900'
                )}
              >
                {emoji}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={cn(
          'text-xs px-3',
          isOwn
            ? 'text-purple-200 text-right'
            : (theme === 'dark'
              ? 'text-gray-500'
              : 'text-gray-500')
        )}>
          {time}
        </div>
      </div>

      {/* Reactions picker */}
      {showReactions && (
        <div className={cn(
          'fixed z-50 p-2 rounded-lg shadow-lg flex gap-1 flex-wrap w-48',
          theme === 'dark'
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
        )}>
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={cn(
                'p-2 rounded hover:bg-gray-200/50 dark:hover:bg-gray-700/50 text-lg',
                'transition-colors'
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Action menu */}
      {showMenu && (
        <div className={cn(
          'fixed z-50 rounded-lg shadow-lg overflow-hidden',
          theme === 'dark'
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
        )}>
          <button
            onClick={handleCopy}
            className={cn(
              'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-700/50',
              'transition-colors'
            )}
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button
            onClick={() => {
              onReply?.(message);
              setShowMenu(false);
            }}
            className={cn(
              'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-700/50',
              'transition-colors'
            )}
          >
            <Reply className="w-4 h-4" /> Reply
          </button>
          <button
            onClick={() => {
              onForward?.(message);
              setShowMenu(false);
            }}
            className={cn(
              'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-700/50',
              'transition-colors'
            )}
          >
            <Share className="w-4 h-4" /> Forward
          </button>
          {isOwn && (
            <>
              <button
                onClick={() => {
                  onEdit?.(message);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-700/50',
                  'transition-colors'
                )}
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => {
                  onDelete?.(message);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-red-500/20 text-red-500',
                  'transition-colors'
                )}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
          {!isOwn && (
            <button
              onClick={() => {
                onReport?.(message);
                setShowMenu(false);
              }}
              className={cn(
                'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-red-500/20 text-red-500',
                'transition-colors'
              )}
            >
              <Flag className="w-4 h-4" /> Report
            </button>
          )}
        </div>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
