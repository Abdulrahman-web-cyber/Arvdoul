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
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(null);

  useEffect(() => {
    if (conversation) {
      setGroupName(conversation.name || '');
      setDescription(conversation.description || '');
      setParticipants(conversation.participants || []);
      const isUserAdmin = conversation.admins?.includes(user?.uid) || conversation.owner === user?.uid;
      setIsAdmin(isUserAdmin);
    }
  }, [conversation, user]);

  const handleUpdateGroupInfo = async () => {
    if (!isAdmin) {
      toast.error('Only admins can change group information');
      return;
    }
    try {
      setLoading(true);
      await messagingService.updateGroupInfo(
        conversationId,
        { name: groupName, description },
        user.uid
      );
      toast.success('Group information updated');
      setIsEditingInfo(false);
    } catch (error) {
      toast.error('Failed to update group information');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInviteLink = async () => {
    if (!isAdmin) {
      toast.error('Only admins can create invite links');
      return;
    }
    setCreatingInvite(true);
    try {
      const res = await messagingService.createInviteLink(conversationId, user.uid);
      if (res?.link) {
        setInviteLink(res.link);
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(res.link);
          toast.success('Invite link created & copied to clipboard!');
        } else {
          toast.success(`Invite link created: ${res.link}`);
        }
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to create invite link');
      console.error('Error creating invite link:', error);
    } finally {
      setCreatingInvite(false);
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
      theme === 'dark'
        ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
        : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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
          {isAdmin && isEditingInfo ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group Name"
                  className={cn(
                    'w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold',
                    theme === 'dark'
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                  )}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Group Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a group description..."
                  rows={2}
                  className={cn(
                    'w-full px-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
                    theme === 'dark'
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                  )}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingInfo(false)}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateGroupInfo}
                  disabled={loading}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                  )}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h2 className={cn(
                'text-2xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {groupName}
              </h2>
              {description && (
                <p className={cn(
                  'text-sm max-w-sm mx-auto',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {description}
                </p>
              )}
            </div>
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
                onClick={() => setShowAddMembers((v) => !v)}
                aria-label="Add members"
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
                onClick={() => setIsEditingInfo(true)}
                className={cn(
                  'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                <Edit2 className="w-5 h-5 text-purple-500" />
                Edit Group Info
              </button>
              <button
                onClick={handleCreateInviteLink}
                disabled={creatingInvite}
                className={cn(
                  'w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                {creatingInvite ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" /> : <LinkIcon className="w-5 h-5 text-purple-500" />}
                <span>{creatingInvite ? 'Generating invite link...' : 'Create Invite Link'}</span>
              </button>
              {inviteLink && (
                <div className={cn(
                  'p-3 rounded-lg flex items-center justify-between gap-2 text-xs',
                  theme === 'dark' ? 'bg-purple-950/40 border border-purple-800/60 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-800'
                )}>
                  <span className="truncate flex-1 font-mono">{inviteLink}</span>
                  <button
                    onClick={async () => {
                      if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(inviteLink);
                        toast.success('Copied to clipboard!');
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-purple-600 text-white font-semibold hover:bg-purple-700 whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              )}
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
      {/* Add members panel */}
      {showAddMembers && (
        <div className="mt-4 space-y-3">
          <input
            value={memberQuery}
            onChange={async (e) => {
              setMemberQuery(e.target.value);
              const q = e.target.value.trim();
              if (q.length < 2) { setMemberResults([]); return; }
              setSearchingMembers(true);
              try {
                const { getUserService } = await import('../services/userService.js');
                const res = await getUserService().searchUsers(q, { limit: 8 });
                const users = res?.users || res || [];
                setMemberResults(users.filter((u) => u.id && !participants.some((p) => p.id === u.id || p === u.id)));
              } catch (err) { setMemberResults([]); }
              finally { setSearchingMembers(false); }
            }}
            placeholder="Search users to add…"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none"
          />
          {searchingMembers && <p className="text-xs opacity-60">Searching…</p>}
          <div className="space-y-2">
            {memberResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-100/50 dark:bg-gray-800/50">
                <span className="text-sm font-medium truncate">{u.displayName || u.username || u.id}</span>
                <button
                  onClick={async () => {
                    setAddingMember(u.id);
                    try {
                      const messaging = await import('../services/messagesService.js');
                      const svc = messaging.getMessagingService ? messaging.getMessagingService() : messaging.default;
                      if (!conversationId) throw new Error('Conversation context missing');
                      await svc.addParticipants(conversationId, [u.id], user?.uid);
                      toast.success('Member added!');
                      setMemberResults((r) => r.filter((x) => x.id !== u.id));
                    } catch (err) {
                      toast.error(err?.message || 'Could not add member.');
                    } finally {
                      setAddingMember(null);
                    }
                  }}
                  disabled={addingMember === u.id}
                  className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {addingMember === u.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupInfoScreen;