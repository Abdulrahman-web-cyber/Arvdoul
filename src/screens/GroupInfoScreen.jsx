// src/screens/GroupInfoScreen.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getMessagingService } from '../services/messagesService';
import userService from '../services/userService';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  UserMinus,
  Shield,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  Search,
  X,
  Share2,
} from 'lucide-react';

export default function GroupInfoScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState([]);
  const [participantDetails, setParticipantDetails] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  // Load conversation details directly from service
  const loadGroupDetails = useCallback(async () => {
    if (!conversationId || !user?.uid) return;
    try {
      setLoading(true);
      const svc = getMessagingService();
      const res = await svc.getConversation(conversationId, { cacheFirst: false, refreshParticipants: true });
      if (res?.success && res.conversation) {
        const conv = res.conversation;
        setConversation(conv);
        setGroupName(conv.name || conv.title || 'Group');
        setDescription(conv.description || '');
        const pList = Array.isArray(conv.participants) ? conv.participants : [];
        setParticipants(pList);

        const isUserAdmin = Boolean(
          conv.admins?.includes(user.uid) ||
          conv.createdBy === user.uid ||
          conv.owner === user.uid
        );
        setIsAdmin(isUserAdmin);

        // Build details map from participantDetails or fetch
        const detailsMap = {};
        if (Array.isArray(conv.participantDetails)) {
          conv.participantDetails.forEach((p) => {
            if (p) {
              const pid = p.id || p.uid;
              if (pid) detailsMap[pid] = p;
            }
          });
        }

        // Fetch any missing participant profiles
        const missingIds = pList.filter((id) => !detailsMap[id]);
        if (missingIds.length > 0) {
          const profilePromises = missingIds.map((id) =>
            userService.getUserProfile(id).catch(() => null)
          );
          const profiles = await Promise.all(profilePromises);
          profiles.forEach((prof, idx) => {
            if (prof) {
              detailsMap[missingIds[idx]] = prof;
            }
          });
        }
        setParticipantDetails(detailsMap);
      } else {
        toast.error('Group conversation not found');
        navigate('/messages');
      }
    } catch (err) {
      console.error('Failed to load group details:', err);
      toast.error(err?.message || 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.uid, navigate]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  // Handle saving group info changes (admin only)
  const handleUpdateGroupInfo = async () => {
    if (!isAdmin) {
      toast.error('Only group admins can update information');
      return;
    }
    if (!groupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      const svc = getMessagingService();
      await svc.updateGroupInfo(
        conversationId,
        { name: groupName.trim(), description: description.trim() },
        user.uid
      );
      toast.success('Group information updated');
      setIsEditingInfo(false);
      setConversation((prev) => ({
        ...prev,
        name: groupName.trim(),
        description: description.trim(),
      }));
    } catch (error) {
      toast.error(error?.message || 'Failed to update group information');
    } finally {
      setSaving(false);
    }
  };

  // Generate an invite link
  const handleCreateInviteLink = async () => {
    if (!isAdmin) {
      toast.error('Only group admins can create invite links');
      return;
    }
    setCreatingInvite(true);
    try {
      const svc = getMessagingService();
      const res = await svc.createInviteLink(conversationId, user.uid);
      if (res?.link) {
        setInviteLink(res.link);
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(res.link);
          toast.success('Invite link copied to clipboard!');
        } else {
          toast.success('Invite link created');
        }
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to create invite link');
    } finally {
      setCreatingInvite(false);
    }
  };

  // Remove participant from group
  const handleRemoveParticipant = async (participantId) => {
    if (!isAdmin) {
      toast.error('Only admins can remove members');
      return;
    }
    if (participantId === user.uid) {
      handleLeaveGroup();
      return;
    }
    const memberName = participantDetails[participantId]?.displayName || 'this member';
    if (!window.confirm(`Remove ${memberName} from the group?`)) return;

    try {
      setSaving(true);
      const svc = getMessagingService();
      await svc.removeParticipants(conversationId, [participantId], user.uid);
      toast.success('Member removed');
      setParticipants((prev) => prev.filter((id) => id !== participantId));
    } catch (error) {
      toast.error(error?.message || 'Failed to remove member');
    } finally {
      setSaving(false);
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (!window.confirm('Leave this group? You will no longer receive its messages.')) return;
    try {
      setSaving(true);
      const svc = getMessagingService();
      await svc.leaveGroup(conversationId, user.uid);
      toast.success('You have left the group');
      navigate('/messages');
    } catch (error) {
      toast.error(error?.message || 'Failed to leave group');
      setSaving(false);
    }
  };

  // Search users to add
  const handleSearchUsers = async (q) => {
    setMemberQuery(q);
    const query = q.trim();
    if (query.length < 2) {
      setMemberResults([]);
      return;
    }
    setSearchingMembers(true);
    try {
      const res = await userService.searchUsers(query, { limit: 10 });
      const users = res?.users || [];
      // Filter out existing participants
      setMemberResults(users.filter((u) => {
        const uid = u.uid || u.id;
        return uid && !participants.includes(uid);
      }));
    } catch (err) {
      setMemberResults([]);
    } finally {
      setSearchingMembers(false);
    }
  };

  // Add selected user
  const handleAddMember = async (targetUser) => {
    const targetUid = targetUser.uid || targetUser.id;
    if (!targetUid || !user?.uid) return;
    setAddingMemberId(targetUid);
    try {
      const svc = getMessagingService();
      await svc.addParticipants(conversationId, [targetUid], user.uid);
      toast.success(`${targetUser.displayName || 'Member'} added to group!`);
      setParticipants((prev) => [...prev, targetUid]);
      setParticipantDetails((prev) => ({ ...prev, [targetUid]: targetUser }));
      setMemberResults((prev) => prev.filter((u) => (u.uid || u.id) !== targetUid));
    } catch (err) {
      toast.error(err?.message || 'Could not add member');
    } finally {
      setAddingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark ? 'bg-[#030614] text-white' : 'bg-slate-50 text-slate-900'
      )}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs font-semibold opacity-60">Loading group details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'min-h-screen flex flex-col font-sans transition-colors duration-200 pb-12',
      isDark ? 'bg-[#030614] text-white' : 'bg-slate-50 text-slate-900'
    )}>
      {/* Top Bar Contract: Zone 1 (Back/Title), Zone 2 (Meta), Zone 3 (Action) */}
      <header className={cn(
        'sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md transition-colors',
        isDark ? 'bg-[#030614]/85 border-white/10' : 'bg-white/85 border-slate-200'
      )}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/messages/${conversationId}`)}
            aria-label="Back to chat"
            className={cn(
              'p-2 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
              isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-slate-100 text-slate-700'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base truncate max-w-[200px] sm:max-w-xs">
              Group Info
            </h1>
            <p className={cn(
              'text-[11px] font-medium',
              isDark ? 'text-gray-400' : 'text-slate-500'
            )}>
              {participants.length} member{participants.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {isAdmin && !isEditingInfo && (
          <button
            onClick={() => setIsEditingInfo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/10 text-purple-500 hover:bg-purple-600/20 border border-purple-500/30 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        )}
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Group Hero Card */}
        <div className={cn(
          'p-6 rounded-3xl border text-center transition-all shadow-sm',
          isDark ? 'bg-[#090e29]/70 border-white/10' : 'bg-white border-slate-200'
        )}>
          {/* Group Avatar */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 shadow-[0_0_20px_rgba(168,85,247,0.35)]">
              {conversation?.photoURL ? (
                <img
                  src={conversation.photoURL}
                  alt={groupName}
                  className={cn(
                    'w-full h-full rounded-full object-cover border-2',
                    isDark ? 'border-[#090e29]' : 'border-white'
                  )}
                />
              ) : (
                <div className={cn(
                  'w-full h-full rounded-full flex items-center justify-center text-3xl font-black text-white bg-gradient-to-tr from-purple-600 to-indigo-600 border-2',
                  isDark ? 'border-[#090e29]' : 'border-white'
                )}>
                  {(groupName?.[0] || 'G').toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Edit form vs View info */}
          {isEditingInfo ? (
            <div className="space-y-4 max-w-md mx-auto text-left">
              <div>
                <label className="text-xs font-semibold opacity-70 mb-1.5 block">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  maxLength={60}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl text-sm font-semibold outline-none border transition-colors',
                    isDark
                      ? 'bg-white/5 border-white/10 text-white focus:border-purple-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-purple-500'
                  )}
                />
              </div>

              <div>
                <label className="text-xs font-semibold opacity-70 mb-1.5 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  rows={3}
                  maxLength={250}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl text-sm outline-none border transition-colors resize-none',
                    isDark
                      ? 'bg-white/5 border-white/10 text-white focus:border-purple-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-purple-500'
                  )}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(false)}
                  disabled={saving}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors',
                    isDark ? 'bg-white/10 hover:bg-white/15 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateGroupInfo}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">
                {groupName}
              </h2>
              {description ? (
                <p className={cn(
                  'text-xs max-w-md mx-auto leading-relaxed',
                  isDark ? 'text-gray-400' : 'text-slate-600'
                )}>
                  {description}
                </p>
              ) : (
                <p className="text-xs opacity-50 italic">No description set.</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions (Invite link & Share) */}
        {isAdmin && (
          <div className={cn(
            'p-4 rounded-2xl border space-y-3',
            isDark ? 'bg-[#090e29]/70 border-white/10' : 'bg-white border-slate-200'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Group Invite Link</span>
              </div>
              <button
                onClick={handleCreateInviteLink}
                disabled={creatingInvite}
                className="text-xs font-semibold text-purple-500 hover:underline flex items-center gap-1"
              >
                {creatingInvite ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>{inviteLink ? 'Regenerate link' : 'Generate link'}</span>
              </button>
            </div>

            {inviteLink && (
              <div className={cn(
                'flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs',
                isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
              )}>
                <span className="font-mono text-[11px] truncate flex-1 opacity-90">{inviteLink}</span>
                <button
                  onClick={async () => {
                    if (navigator?.clipboard?.writeText) {
                      await navigator.clipboard.writeText(inviteLink);
                      toast.success('Invite link copied!');
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-colors shrink-0"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Group Members Section */}
        <div className={cn(
          'p-5 rounded-3xl border space-y-4',
          isDark ? 'bg-[#090e29]/70 border-white/10' : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                Members
              </h3>
              <p className={cn(
                'text-[11px]',
                isDark ? 'text-gray-400' : 'text-slate-500'
              )}>
                {participants.length} member{participants.length === 1 ? '' : 's'} in this conversation
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddMembers((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          {/* Add member search drawer */}
          {showAddMembers && (
            <div className={cn(
              'p-3.5 rounded-2xl border space-y-3',
              isDark ? 'bg-white/5 border-purple-500/30' : 'bg-purple-50/50 border-purple-200'
            )}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-500">Search users to add</span>
                <button
                  onClick={() => {
                    setShowAddMembers(false);
                    setMemberQuery('');
                    setMemberResults([]);
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                >
                  <X className="w-4 h-4 opacity-60" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Type name or username..."
                  className={cn(
                    'w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none border transition-colors',
                    isDark ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-slate-200 text-slate-900 focus:border-purple-500'
                  )}
                />
              </div>

              {searchingMembers && (
                <div className="flex items-center gap-2 py-2 text-xs text-purple-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </div>
              )}

              {memberResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {memberResults.map((u) => {
                    const uid = u.uid || u.id;
                    const isAdding = addingMemberId === uid;
                    return (
                      <div
                        key={uid}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-xl border',
                          isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getSafeAvatarUrl(u.photoURL, u.displayName, uid)}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{u.displayName || u.username}</p>
                            <p className="text-[10px] opacity-60 truncate">@{u.username || uid.slice(0, 8)}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddMember(u)}
                          disabled={isAdding}
                          className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 disabled:opacity-50 transition-colors shrink-0"
                        >
                          {isAdding ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            {participants.map((pid) => {
              const info = participantDetails[pid] || {};
              const isParticipantAdmin = Boolean(
                conversation?.admins?.includes(pid) ||
                conversation?.createdBy === pid ||
                conversation?.owner === pid
              );
              const isCurrentUser = pid === user?.uid;
              const name = info.displayName || info.name || (isCurrentUser ? (user?.displayName || 'You') : 'Participant');
              const avatar = getSafeAvatarUrl(info.photoURL || info.avatar, name, pid);

              return (
                <div
                  key={pid}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-2xl border transition-colors',
                    isDark ? 'bg-white/5 border-white/5 hover:bg-white/[0.08]' : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/70'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={avatar}
                        alt={name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      {isParticipantAdmin && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px] shadow-sm">
                          ★
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">
                          {name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] opacity-60 font-medium">(You)</span>
                        )}
                        {info.isVerified && (
                          <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        {isParticipantAdmin ? (
                          <span className="text-purple-400 font-semibold flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span>Member</span>
                        )}
                        {info.username && (
                          <>
                            <span>·</span>
                            <span className="truncate">@{info.username}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin actions on member */}
                  {isAdmin && !isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(pid)}
                      disabled={saving}
                      aria-label={`Remove ${name}`}
                      className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger zone: Leave group */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLeaveGroup}
            disabled={saving}
            className={cn(
              'w-full p-4 rounded-2xl border text-center font-bold text-xs text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2',
              isDark ? 'border-red-500/20 bg-red-950/10' : 'border-red-200 bg-red-50/50'
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>Leave Group</span>
          </button>
        </div>
      </main>
    </div>
  );
}