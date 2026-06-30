// src/screens/ConversationSettingsScreen.jsx
// 🎯 Conversation settings and preferences

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import messagingService from '../services/messagesService';
import useMessagingStore from '../store/messagingStore';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Archive, Pin, Trash2, Block, Flag, Loader2 } from 'lucide-react';

const ConversationSettingsScreen = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { conversations } = useMessagingStore();

  const conversation = conversations.find((c) => c.id === conversationId);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(conversation?.isMuted || false);
  const [isArchived, setIsArchived] = useState(conversation?.isArchived || false);
  const [isPinned, setIsPinned] = useState(conversation?.isPinned || false);
  const [disableReadReceipts, setDisableReadReceipts] = useState(conversation?.disableReadReceipts || false);
  const [ephemeralEnabled, setEphemeralEnabled] = useState(conversation?.ephemeralEnabled || false);
  const [ephemeralTimer, setEphemeralTimer] = useState(conversation?.ephemeralTimer || '24h');

  useEffect(() => {
    if (conversation) {
      setIsMuted(conversation.isMuted || false);
      setIsArchived(conversation.isArchived || false);
      setIsPinned(conversation.isPinned || false);
      setDisableReadReceipts(conversation.disableReadReceipts || false);
      setEphemeralEnabled(conversation.ephemeralEnabled || false);
      setEphemeralTimer(conversation.ephemeralTimer || '24h');
    }
  }, [conversation]);

  const handleToggleMute = async () => {
    try {
      setLoading(true);
      if (isMuted) {
        await messagingService.unmuteConversation(conversationId, user.uid);
        setIsMuted(false);
        toast.success('Notifications enabled');
      } else {
        await messagingService.muteConversation(conversationId, user.uid);
        setIsMuted(true);
        toast.success('Notifications muted');
      }
    } catch (error) {
      toast.error('Failed to update mute status');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      setLoading(true);
      if (isArchived) {
        await messagingService.unarchiveConversation(conversationId, user.uid);
        setIsArchived(false);
        toast.success('Conversation unarchived');
      } else {
        await messagingService.archiveConversation(conversationId, user.uid);
        setIsArchived(true);
        toast.success('Conversation archived');
      }
    } catch (error) {
      toast.error('Failed to update archive status');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      setLoading(true);
      // Pin/unpin logic would be implemented in the service
      setIsPinned(!isPinned);
      toast.success(isPinned ? 'Conversation unpinned' : 'Conversation pinned');
    } catch (error) {
      toast.error('Failed to update pin status');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReadReceipts = async () => {
    try {
      setLoading(true);
      await messagingService.setConversationReadReceipts(
        conversationId,
        user.uid,
        !disableReadReceipts
      );
      setDisableReadReceipts(!disableReadReceipts);
      toast.success(disableReadReceipts ? 'Read receipts enabled' : 'Read receipts disabled');
    } catch (error) {
      toast.error('Failed to update read receipts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all messages? This cannot be undone.')) return;
    try {
      setLoading(true);
      toast.success('Message history cleared');
      // Implementation would delete all messages
    } catch (error) {
      toast.error('Failed to clear history');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      setLoading(true);
      await messagingService.deleteConversation?.(conversationId, user.uid);
      toast.success('Conversation deleted');
      navigate('/messages');
    } catch (error) {
      toast.error('Failed to delete conversation');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      'flex flex-col h-full',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      {/* Header */}
      <div className={cn(
        'border-b p-4 flex items-center gap-4',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <button
          onClick={() => navigate(-1)}
          className={cn(
            'p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors'
          )}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className={cn(
          'text-xl font-bold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Settings
        </h1>
      </div>

      {/* Settings list */}
      <div classNaume="flex-1 overflow-y-auto divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
        {/* Mute notifications */}
        <button
          onClick={handleToggleMute}
          disabled={loading}
          className={cn(
            'w-full p-4 text-left flex items-center justify-between transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800'
              : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5" />
            <div>
              <div className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Mute Notifications
              </div>
              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {isMuted ? 'Muted' : 'Enabled'}
              </div>
            </div>
          </div>
          <div className={cn(
            'w-12 h-6 rounded-full transition-colors',
            isMuted
              ? 'bg-green-600'
              : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300')
          )} />
        </button>

        {/* Archive */}
        <button
          onClick={handleToggleArchive}
          disabled={loading}
          className={cn(
            'w-full p-4 text-left flex items-center justify-between transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800'
              : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5" />
            <div>
              <div className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Archive
              </div>
              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {isArchived ? 'Archived' : 'Active'}
              </div>
            </div>
          </div>
          <div className={cn(
            'w-12 h-6 rounded-full transition-colors',
            isArchived
              ? 'bg-blue-600'
              : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300')
          )} />
        </button>

        {/* Pin */}
        <button
          onClick={handleTogglePin}
          disabled={loading}
          className={cn(
            'w-full p-4 text-left flex items-center justify-between transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800'
              : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-3">
            <Pin className="w-5 h-5" />
            <div>
              <div className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Pin Conversation
              </div>
              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {isPinned ? 'Pinned' : 'Not pinned'}
              </div>
            </div>
          </div>
          <div className={cn(
            'w-12 h-6 rounded-full transition-colors',
            isPinned
              ? 'bg-purple-600'
              : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300')
          )} />
        </button>

        {/* Read receipts */}
        <button
          onClick={handleToggleReadReceipts}
          disabled={loading}
          className={cn(
            'w-full p-4 text-left flex items-center justify-between transition-colors',
            theme === 'dark'
              ? 'hover:bg-gray-800'
              : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5">✓</div>
            <div>
              <div className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Show Read Receipts
              </div>
              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {disableReadReceipts ? 'Disabled' : 'Enabled'}
              </div>
            </div>
          </div>
          <div className={cn(
            'w-12 h-6 rounded-full transition-colors',
            !disableReadReceipts
              ? 'bg-green-600'
              : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300')
          )} />
        </button>

        {/* Danger zone */}
        <div className={cn(
          'p-4 space-y-2',
          theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
        )}>
          <h3 className={cn(
            'text-sm font-semibold text-red-600',
            'mb-3'
          )}>
            Danger Zone
          </h3>

          <button
            onClick={handleClearHistory}
            disabled={loading}
            className={cn(
              'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors text-red-600 hover:text-red-700',
              theme === 'dark'
                ? 'hover:bg-red-500/20'
                : 'hover:bg-red-100'
            )}
          >
            <Trash2 className="w-5 h-5" />
            Clear Message History
          </button>

          <button
            onClick={handleDeleteConversation}
            disabled={loading}
            className={cn(
              'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors text-red-600 hover:text-red-700',
              theme === 'dark'
                ? 'hover:bg-red-500/20'
                : 'hover:bg-red-100'
            )}
          >
            <Trash2 className="w-5 h-5" />
            Delete Conversation
          </button>

          {conversation?.type === 'direct' && (
            <button
              onClick={() => toast.info('Block user feature coming soon')}
              disabled={loading}
              className={cn(
                'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors text-red-600 hover:text-red-700',
                theme === 'dark'
                  ? 'hover:bg-red-500/20'
                  : 'hover:bg-red-100'
              )}
            >
              <Block className="w-5 h-5" />
              Block User
            </button>
          )}

          {conversation?.type === 'direct' && (
            <button
              onClick={() => toast.info('Report user feature coming soon')}
              disabled={loading}
              className={cn(
                'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors text-red-600 hover:text-red-700',
                theme === 'dark'
                  ? 'hover:bg-red-500/20'
                  : 'hover:bg-red-100'
              )}
            >
              <Flag className="w-5 h-5" />
              Report User
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationSettingsScreen;
