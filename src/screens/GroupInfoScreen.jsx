// src/screens/GroupInfoScreen.jsx
// 🎯 Group information and management screen (Web version - React Router)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import messagingService from '../services/messagesService';
import useMessagingStore from '../store/messagingStore';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Plus, UserMinus, Shield, Edit2, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';

const GroupInfoScreen = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { conversations } = useMessagingStore();

  const conversation = conversations.find((c) => c.id === conversationId);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState(conversation?.name || '');
  const [description, setDescription] = useState(conversation?.description || '');
  const [participants, setParticipants] = useState(conversation?.participants || []);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (conversation) {
      setGroupName(conversation.name || '');
      setDescription(conversation.description || '');
      setParticipants(conversation.participants || []);
      const isUserAdmin = conversation.admins?.includes(user?.uid) || conversation.owner === user?.uid;
      setIsAdmin(isUserAdmin);
    }
  }, [conversation, user]);

  const handleUpdateGroupName = async () => {
    if (!isAdmin) {
      toast.error('Only admins can change group name');
      return;
    }
    try {
      setLoading(true);
      await messagingService.updateGroupInfo(
        conversationId,
        { name: groupName },
        user.uid
      );
      toast.success('Group name updated');
    } catch (error) {
      toast.error('Failed to update group name');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!isAdmin) {
      toast.error('Only admins can remove members');
      return;
    }
    if (!confirm('Remove this member from the group?')) return;

    try {
      setLoading(true);
      await messagingService.removeParticipants(
        conversationId,
        [participantId],
        user.uid
      );
      toast.success('Member removed');
      setParticipants((prev) => prev.filter((p) => p.uid !== participantId));
    } catch (error) {
      toast.error('Failed to remove member');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Leave this group? This action cannot be undone.')) return;

    try {
      setLoading(true);
      await messagingService.leaveGroup(conversationId, user.uid);
      toast.success('You left the group');
      navigate('/messages');
    } catch (error) {
      toast.error('Failed to leave group');
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
          Group Info
        </h1>
      </div>

      {/* Group details */}
      <div className="flex-1 overflow-y-auto">
        {/* Group photo and name */}
        <div className={cn(
          'p-6 border-b text-center',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          {conversation?.photoURL ? (
            <img
              src={conversation.photoURL}
              alt={groupName}
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
              {groupName?.[0]?.toUpperCase()}
            </div>
          )}
          {isAdmin ? (
            <div className="space-y-2">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={cn(
                  'w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-bold',
                  theme === 'dark'
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                )}
              />
              <button
                onClick={handleUpdateGroupName}
                disabled={loading}
                className={cn(
                  'w-full px-4 py-2 rounded-lg font-medium transition-colors',
                  'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Save Name
              </button>
            </div>
          ) : (
            <h2 className={cn(
              'text-2xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {groupName}
            </h2>
          )}
        </div>

        {/* Members section */}
        <div className={cn(
          'border-b p-4',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(
              'font-semibold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Members ({participants.length})
            </h3>
            {isAdmin && (
              <button
                onClick={() => {
                  toast.info('Add members feature coming soon');
                }}
                className={cn(
                  'p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors'
                )}
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.uid}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  {p.photoURL ? (
                    <img
                      src={p.photoURL}
                      alt={p.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {p.displayName?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {p.displayName}
                      {p.uid === user.uid && ' (You)'}
                    </div>
                    {conversation?.admins?.includes(p.uid) && (
                      <div className="text-xs text-purple-500 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Admin
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && p.uid !== user.uid && (
                  <button
                    onClick={() => handleRemoveParticipant(p.uid)}
                    disabled={loading}
                    className={cn(
                      'p-2 rounded hover:bg-red-500/20 text-red-500 hover:text-red-600 transition-colors'
                    )}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Group options */}
        <div className={cn(
          'p-4 space-y-2',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          {isAdmin && (
            <>
              <button
                onClick={() => toast.info('Coming soon')}
                className={cn(
                  'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                <Edit2 className="w-5 h-5" />
                Edit Group Info
              </button>
              <button
                onClick={() => toast.info('Coming soon')}
                className={cn(
                  'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                <LinkIcon className="w-5 h-5" />
                Create Invite Link
              </button>
            </>
          )}
          <button
            onClick={handleLeaveGroup}
            disabled={loading}
            className={cn(
              'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors text-red-500 hover:text-red-600',
              theme === 'dark'
                ? 'hover:bg-red-500/10'
                : 'hover:bg-red-100'
            )}
          >
            <Trash2 className="w-5 h-5" />
            Leave Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoScreen;