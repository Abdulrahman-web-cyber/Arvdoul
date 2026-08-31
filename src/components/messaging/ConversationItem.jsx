// src/components/messaging/ConversationItem.jsx
// 🎯 Reusable conversation list item component

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Archive,
  BellOff,
  Bell,
  Trash2,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useSwipeable } from 'react-swipeable';
import { toast } from 'sonner';

const ConversationItem = React.memo(({
  conversation,
  isSelected,
  onPress,
  onArchive,
  onMute,
  onUnmute,
  onDelete,
  theme,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { lastMessage, participants, name, photoURL, unreadCount, isMuted, isArchived } = conversation;

  // Extract display name and avatar
  const displayName = name || (participants?.length > 1
    ? `${participants[0]?.displayName || 'User'} & others`
    : participants?.[0]?.displayName || 'Unknown');

  const avatar = photoURL || (participants?.[0]?.photoURL || null);
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // Format last message preview
  const getMessagePreview = () => {
    if (!lastMessage) return 'No messages';
    const prefix = lastMessage.senderId === 'current-user' ? 'You: ' : '';
    return `${prefix}${lastMessage.content?.substring(0, 50) || '[Media]'}`;
  };

  const getTimestamp = () => {
    if (!lastMessage?.createdAt) return '';
    const date = lastMessage.createdAt.toDate?.() || new Date(lastMessage.createdAt);
    const now = new Date();
    const dayDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) return format(date, 'p');
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff < 7) return formatDistanceToNow(date, { addSuffix: false });
    return format(date, 'MMM d');
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (unreadCount > 0) {
        onMute?.();
      } else {
        setShowActions(!showActions);
      }
    },
    onSwipedRight: () => setShowActions(false),
    delta: 50,
    preventScrollOnSwipe: true,
    trackTouch: true,
  });

  const handleArchive = async () => {
    try {
      setIsLoading(true);
      await onArchive?.();
      toast.success(isArchived ? 'Conversation unarchived' : 'Conversation archived');
    } catch (error) {
      toast.error('Failed to archive conversation');
    } finally {
      setIsLoading(false);
      setShowActions(false);
    }
  };

  const handleMute = async () => {
    try {
      setIsLoading(true);
      if (isMuted) {
        await onUnmute?.();
        toast.success('Notifications enabled');
      } else {
        await onMute?.();
        toast.success('Notifications muted');
      }
    } catch (error) {
      toast.error('Failed to update mute status');
    } finally {
      setIsLoading(false);
      setShowActions(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this conversation?')) return;
    try {
      setIsLoading(true);
      await onDelete?.();
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Failed to delete conversation');
    } finally {
      setIsLoading(false);
      setShowActions(false);
    }
  };

  return (
    <div
      {...handlers}
      className={cn(
        'relative border-b transition-all duration-200',
        theme === 'dark'
          ? 'border-gray-800 hover:bg-gray-900/50'
          : 'border-gray-200 hover:bg-gray-50',
        isSelected &&
          (theme === 'dark'
            ? 'bg-gray-900/80'
            : 'bg-blue-50')
      )}
    >
      <button
        onClick={() => onPress?.(conversation)}
        className={cn(
          'w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-offset-0',
          theme === 'dark'
            ? 'focus:ring-purple-600'
            : 'focus:ring-purple-400'
        )}
        disabled={isLoading}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
            )}
            {/* Unread badge */}
            {unreadCount > 0 && (
              <div className={cn(
                'absolute -top-1 -right-1 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-white',
                'bg-red-500'
              )}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className={cn(
                'font-semibold truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {displayName}
              </h3>
              <span className={cn(
                'text-xs flex-shrink-0',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                {getTimestamp()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p className={cn(
                'text-sm truncate',
                unreadCount > 0
                  ? (theme === 'dark' ? 'text-gray-300 font-medium' : 'text-gray-700 font-medium')
                  : (theme === 'dark' ? 'text-gray-500' : 'text-gray-600')
              )}>
                {getMessagePreview()}
              </p>
              {isMuted && (
                <BellOff className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Action buttons (visible on swipe) */}
      {showActions && (
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-4 bg-red-500">
          <button
            onClick={handleMute}
            disabled={isLoading}
            className="p-2 hover:bg-red-600 rounded transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <Bell className="w-4 h-4 text-white" />
            ) : (
              <BellOff className="w-4 h-4 text-white" />
            )}
          </button>
          <button
            onClick={handleArchive}
            disabled={isLoading}
            className="p-2 hover:bg-red-600 rounded transition-colors"
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            <Archive className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="p-2 hover:bg-red-600 rounded transition-colors"
            title="Delete"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      )}
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default ConversationItem;
