// src/screens/Community/CommunitySettingsScreen.jsx
//
// Full-featured Community Administration & Member Management Command Center.
// Adheres strictly to zero-pill discipline, WCAG AA, and service-layer boundary.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Shield, Users, UserPlus, UserMinus, 
  UserCheck, UserX, Settings, Lock, Globe, EyeOff,
  Search, Check, AlertTriangle, Clock, RefreshCw,
  MoreVertical, ShieldAlert, Sliders, Save, Trash2
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

const ROLE_BADGE_STYLES = {
  owner: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  admin: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  moderator: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  member: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  contributor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const TABS = [
  { id: 'members', label: 'Members & Roles', icon: Users },
  { id: 'requests', label: 'Join Requests', icon: UserPlus },
  { id: 'general', label: 'General & Privacy', icon: Settings },
  { id: 'moderation', label: 'Moderation & Safety', icon: ShieldAlert },
];

export default function CommunitySettingsScreen() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'midnight';
  const communityService = useMemo(() => getCommunityService(), []);

  // Community state
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');

  // Member management state
  const [members, setMembers] = useState([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [activeActionMemberId, setActiveActionMemberId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Join requests state
  const [pendingRequests, setPendingRequests] = useState([]);

  // Form states for general settings
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [joinApproval, setJoinApproval] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Moderation states
  const [slowModeDelay, setSlowModeDelay] = useState(0);
  const [contentApproval, setContentApproval] = useState(false);
  const [bannedUsers, setBannedUsers] = useState([]);

  // Ban confirmation modal
  const [banTargetMember, setBanTargetMember] = useState(null);
  const [banReason, setBanReason] = useState('');

  // Load Community Data
  const loadData = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await communityService.getCommunity(communityId);
      if (!data) {
        toast.error('Community not found');
        navigate('/community');
        return;
      }

      setCommunity(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setRules(data.rules || '');
      setPrivacy(data.privacy || 'public');
      setJoinApproval(Boolean(data.settings?.joinApproval));
      setSlowModeDelay(data.moderation?.slowModeDelay || 0);
      setContentApproval(Boolean(data.moderation?.contentApproval));
      setBannedUsers(data.moderation?.bannedUsers || []);

      // Extract members list
      const memberEntries = Object.entries(data.members || {}).map(([id, info]) => ({
        id,
        role: info?.role || 'member',
        joinedAt: info?.joinedAt,
        displayName: info?.displayName || info?.name || `Citizen_${id.slice(0, 5)}`,
        avatar: getSafeAvatarUrl(info?.avatar || info?.photoURL, info?.displayName || id, id),
      }));
      setMembers(memberEntries);

      // Extract pending requests
      const requestEntries = Object.entries(data.pendingRequests || {}).map(([id, info]) => ({
        id,
        requestedAt: info?.requestedAt,
        status: info?.status || 'pending',
        displayName: info?.displayName || `Citizen_${id.slice(0, 5)}`,
        avatar: getSafeAvatarUrl(info?.avatar || info?.photoURL, info?.displayName || id, id),
      }));
      setPendingRequests(requestEntries);
    } catch (err) {
      toast.error(err?.message || 'Failed to load community settings');
    } finally {
      setLoading(false);
    }
  }, [communityId, communityService, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!communityId) return;
    const unsubCommunity = communityService.subscribeToCommunity(communityId, (updated) => {
      setCommunity((prev) => ({ ...prev, ...updated }));
      if (updated.members) {
        const memberEntries = Object.entries(updated.members).map(([id, info]) => ({
          id,
          role: info?.role || 'member',
          joinedAt: info?.joinedAt,
          displayName: info?.displayName || info?.name || `Citizen_${id.slice(0, 5)}`,
          avatar: getSafeAvatarUrl(info?.avatar || info?.photoURL, info?.displayName || id, id),
        }));
        setMembers(memberEntries);
      }
    });

    const unsubRequests = communityService.subscribeToPendingRequests(communityId, (reqs) => {
      setPendingRequests(reqs);
    });

    return () => {
      if (unsubCommunity) unsubCommunity();
      if (unsubRequests) unsubRequests();
    };
  }, [communityId, communityService]);

  // Current user's role in this community
  const myRole = useMemo(() => {
    if (!user?.uid || !community?.members) return null;
    return community.members[user.uid]?.role || null;
  }, [user?.uid, community?.members]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  // Role promotion / demotion handler
  const handleAssignRole = async (targetUserId, newRole) => {
    if (!user?.uid || !canManage) return;
    setActionLoading(true);
    try {
      await communityService.assignRole(communityId, targetUserId, newRole, user.uid);
      toast.success(`Role updated to ${newRole}`);
      setActiveActionMemberId(null);
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to update member role');
    } finally {
      setActionLoading(false);
    }
  };

  // Kick member from community
  const handleKickMember = async (targetUserId) => {
    if (!user?.uid || !canManage) return;
    if (!window.confirm('Are you sure you want to remove this member from the community?')) return;
    setActionLoading(true);
    try {
      await communityService.leaveCommunity(communityId, targetUserId);
      toast.success('Member removed');
      setActiveActionMemberId(null);
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  // Ban member
  const handleBanMember = async () => {
    if (!user?.uid || !canManage || !banTargetMember) return;
    setActionLoading(true);
    try {
      await communityService.banUser(communityId, banTargetMember.id, user.uid, banReason.trim());
      toast.success(`${banTargetMember.displayName} was banned`);
      setBanTargetMember(null);
      setBanReason('');
      setActiveActionMemberId(null);
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to ban user');
    } finally {
      setActionLoading(false);
    }
  };

  // Unban user
  const handleUnbanUser = async (targetUserId) => {
    if (!user?.uid || !canManage) return;
    setActionLoading(true);
    try {
      await communityService.unbanUser(communityId, targetUserId, user.uid);
      toast.success('User unbanned');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to unban user');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve join request
  const handleApproveRequest = async (requesterId) => {
    if (!user?.uid || !canManage) return;
    try {
      await communityService.approveJoinRequest(communityId, requesterId, user.uid);
      toast.success('Request approved');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to approve request');
    }
  };

  // Reject join request
  const handleRejectRequest = async (requesterId) => {
    if (!user?.uid || !canManage) return;
    try {
      await communityService.rejectJoinRequest(communityId, requesterId, user.uid);
      toast.info('Request rejected');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to reject request');
    }
  };

  // Save General Settings
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!user?.uid || !canManage) return;
    if (!name.trim()) {
      toast.error('Community name cannot be empty');
      return;
    }
    setSavingSettings(true);
    try {
      await communityService.updateCommunitySettings(communityId, user.uid, {
        name: name.trim(),
        description: description.trim(),
        rules: rules.trim(),
        privacy,
        settings: {
          joinApproval,
        },
      });
      toast.success('Community settings saved');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Update Moderation settings
  const handleUpdateSlowMode = async (delay) => {
    if (!user?.uid || !canManage) return;
    try {
      if (delay > 0) {
        await communityService.enableSlowMode(communityId, delay, user.uid);
        toast.success(`Slow mode set to ${delay}s`);
      } else {
        await communityService.disableSlowMode(communityId, user.uid);
        toast.success('Slow mode disabled');
      }
      setSlowModeDelay(delay);
    } catch (err) {
      toast.error(err?.message || 'Failed to update slow mode');
    }
  };

  const handleToggleContentApproval = async () => {
    if (!user?.uid || !canManage) return;
    const nextState = !contentApproval;
    try {
      if (nextState) {
        await communityService.enableContentApproval(communityId, user.uid);
        toast.success('Content approval enabled');
      } else {
        await communityService.disableContentApproval(communityId, user.uid);
        toast.success('Content approval disabled');
      }
      setContentApproval(nextState);
    } catch (err) {
      toast.error(err?.message || 'Failed to update content approval');
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.displayName?.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
        m.id?.toLowerCase().includes(searchMemberQuery.toLowerCase());
      const matchesRole = selectedRoleFilter === 'all' || m.role === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchMemberQuery, selectedRoleFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading community governance center…</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors",
      isDark ? "bg-[#070B14] text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Top Header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-colors",
        isDark ? "bg-[#070B14]/85 border-white/10" : "bg-white/85 border-slate-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/community/${communityId}`)}
              className={cn(
                "p-2 rounded-xl transition cursor-pointer",
                isDark ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-200 text-slate-700"
              )}
              aria-label="Back to community"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <h1 className="text-base sm:text-lg font-bold truncate max-w-[200px] sm:max-w-md">
                  {community?.name || 'Community'} Administration
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{(community?.stats?.memberCount || members.length).toLocaleString()} members</span>
                <span>·</span>
                <span className="capitalize">{community?.privacy || 'public'}</span>
                <span>·</span>
                <span className="text-purple-400 font-semibold uppercase text-[10px]">
                  Your Role: {myRole || 'Guest'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={loadData}
            aria-label="Refresh settings"
            className={cn(
              "p-2 rounded-xl transition cursor-pointer",
              isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-200 text-slate-600"
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip adhering to Zero-Pill discipline */}
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-none border-t border-white/5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer",
                  isActive
                    ? (isDark ? "text-white" : "text-slate-900")
                    : (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800")
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-purple-500" : "opacity-70")} />
                <span>{tab.label}</span>
                {tab.id === 'requests' && pendingRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {pendingRequests.length}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!canManage && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>You are viewing this panel with member read permissions. Administrative mutations require Owner or Admin privilege.</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: MEMBERS & ROLES                                         */}
        {/* ============================================================== */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Search & Filter Controls */}
            <div className={cn(
              "p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Search members by name or ID…"
                  className={cn(
                    "w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border transition",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>

              {/* Segmented Role Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none p-1 rounded-xl bg-slate-800/40">
                {['all', 'admin', 'moderator', 'member'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRoleFilter(role)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer shrink-0",
                      selectedRoleFilter === role
                        ? (isDark ? "bg-purple-600 text-white" : "bg-white text-slate-900 shadow-sm")
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Member List */}
            <div className={cn(
              "rounded-2xl border divide-y overflow-hidden shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10 divide-white/5" : "bg-white border-slate-200 divide-slate-100"
            )}>
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const isOwner = member.role === 'owner';
                  const isSelf = member.id === user?.uid;
                  const isActionOpen = activeActionMemberId === member.id;

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "p-3.5 sm:p-4 flex items-center justify-between gap-3 transition",
                        isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={member.avatar}
                          alt={member.displayName}
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm truncate">
                              {member.displayName}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-purple-400 font-mono">(You)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider",
                              ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.member
                            )}>
                              {member.role}
                            </span>
                            <span>·</span>
                            <span className="truncate">ID: {member.id.slice(0, 8)}…</span>
                          </div>
                        </div>
                      </div>

                      {/* Administrative Action Trigger */}
                      {canManage && !isOwner && !isSelf && (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveActionMemberId(isActionOpen ? null : member.id)}
                            className={cn(
                              "p-2 rounded-xl border transition cursor-pointer",
                              isDark ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
                            )}
                            title="Member Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown Menu */}
                          {isActionOpen && (
                            <div className={cn(
                              "absolute right-0 top-11 w-48 rounded-2xl border shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95",
                              isDark ? "bg-[#0F172A] border-white/15" : "bg-white border-slate-200"
                            )}>
                              {member.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignRole(member.id, 'admin')}
                                  disabled={actionLoading}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left font-medium hover:bg-purple-600/20 hover:text-purple-300 transition text-slate-300"
                                >
                                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Make Admin</span>
                                </button>
                              )}
                              {member.role !== 'moderator' && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignRole(member.id, 'moderator')}
                                  disabled={actionLoading}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left font-medium hover:bg-cyan-600/20 hover:text-cyan-300 transition text-slate-300"
                                >
                                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Make Moderator</span>
                                </button>
                              )}
                              {member.role !== 'member' && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignRole(member.id, 'member')}
                                  disabled={actionLoading}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left font-medium hover:bg-slate-600/20 hover:text-slate-200 transition text-slate-300"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Demote to Member</span>
                                </button>
                              )}
                              <div className="h-px bg-white/10 my-1" />
                              <button
                                type="button"
                                onClick={() => handleKickMember(member.id)}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left font-medium hover:bg-red-500/20 text-red-400 transition"
                              >
                                <UserMinus className="w-3.5 h-3.5 text-red-400" />
                                <span>Remove Member</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBanTargetMember(member);
                                  setActiveActionMemberId(null);
                                }}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left font-medium hover:bg-red-600/20 text-red-400 transition"
                              >
                                <UserX className="w-3.5 h-3.5 text-red-500" />
                                <span>Ban from Community</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No members found matching &quot;{searchMemberQuery}&quot;.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: JOIN REQUESTS                                           */}
        {/* ============================================================== */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className={cn(
              "p-4 rounded-2xl border",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <h2 className="text-sm font-bold mb-1">Pending Approval Queue</h2>
              <p className="text-xs text-slate-400">
                Citizens awaiting admission into this sovereign community. Approving grants member privileges immediately.
              </p>
            </div>

            <div className={cn(
              "rounded-2xl border divide-y overflow-hidden shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10 divide-white/5" : "bg-white border-slate-200 divide-slate-100"
            )}>
              {pendingRequests.length > 0 ? (
                pendingRequests.map((req) => (
                  <div key={req.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={req.avatar}
                        alt={req.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      <div>
                        <div className="font-bold text-xs sm:text-sm">{req.displayName}</div>
                        <div className="text-[11px] text-slate-400">
                          Requested to join · ID: {req.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req.id)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-12 text-center space-y-2">
                  <UserCheck className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                  <p className="text-sm font-bold">No pending join requests</p>
                  <p className="text-xs text-slate-400">All applicant requests have been processed.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: GENERAL & PRIVACY                                       */}
        {/* ============================================================== */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div className={cn(
              "p-6 rounded-2xl border space-y-4 shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                Community Identity
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Community Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  maxLength={60}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canManage}
                  rows={3}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  maxLength={500}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Community Rules &amp; Charter</label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  disabled={!canManage}
                  rows={4}
                  placeholder="Outline civic conduct, guidelines, and policies…"
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 transition",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  maxLength={1000}
                />
              </div>
            </div>

            {/* Privacy & Access Governance */}
            <div className={cn(
              "p-6 rounded-2xl border space-y-4 shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                Privacy &amp; Access Governance
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'public', label: 'Public', icon: Globe, desc: 'Anyone can discover and join directly.' },
                  { id: 'private', label: 'Private', icon: Lock, desc: 'Discoverable, but join requires admin approval.' },
                  { id: 'secret', label: 'Secret', icon: EyeOff, desc: 'Hidden from discovery; invite only.' },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = privacy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canManage}
                      onClick={() => setPrivacy(opt.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition cursor-pointer space-y-1.5",
                        isSelected
                          ? "border-purple-500 bg-purple-500/10 text-white"
                          : (isDark ? "border-white/10 bg-slate-900/60 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700")
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Icon className={cn("w-4 h-4", isSelected ? "text-purple-400" : "text-slate-400")} />
                        <span>{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <div>
                  <div className="text-xs font-bold">Require Join Approval</div>
                  <div className="text-[11px] text-slate-400">Every new applicant must be reviewed in the queue.</div>
                </div>
                <input
                  type="checkbox"
                  checked={joinApproval}
                  onChange={(e) => setJoinApproval(e.target.checked)}
                  disabled={!canManage}
                  className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>
            </div>

            {canManage && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg transition cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving Changes…' : 'Save Community Settings'}</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MODERATION & SAFETY                                     */}
        {/* ============================================================== */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            {/* Speed & Content Controls */}
            <div className={cn(
              "p-6 rounded-2xl border space-y-5 shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                Chat &amp; Feed Moderation Settings
              </h2>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">Slow Mode (Rate Limiting)</div>
                    <div className="text-[11px] text-slate-400">Limit how frequently citizens can submit messages.</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400">
                    {slowModeDelay > 0 ? `${slowModeDelay}s Delay` : 'Disabled'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[0, 10, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      disabled={!canManage}
                      onClick={() => handleUpdateSlowMode(sec)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-semibold border transition cursor-pointer",
                        slowModeDelay === sec
                          ? "bg-purple-600 border-purple-500 text-white"
                          : (isDark ? "bg-slate-900 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")
                      )}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold">Require Content Approval</div>
                  <div className="text-[11px] text-slate-400">Posts must be reviewed by a moderator before publishing to feed.</div>
                </div>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={handleToggleContentApproval}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                    contentApproval
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  {contentApproval ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Banned Citizens Register */}
            <div className={cn(
              "p-6 rounded-2xl border space-y-4 shadow-sm",
              isDark ? "bg-[#0C1222] border-white/10" : "bg-white border-slate-200"
            )}>
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <UserX className="w-4 h-4" />
                <span>Banned Citizens Register ({bannedUsers.length})</span>
              </h2>

              {bannedUsers.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {bannedUsers.map((bannedId) => (
                    <div key={bannedId} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-white">ID: {bannedId}</div>
                        <div className="text-[11px] text-red-400">Suspended from community interactions</div>
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleUnbanUser(bannedId)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                        >
                          Revoke Ban
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3">
                  No citizens are currently banned from this community.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* BAN CONFIRMATION MODAL                                         */}
      {/* ============================================================== */}
      <AnimatePresence>
        {banTargetMember && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl",
                isDark ? "bg-[#0F172A] border-red-500/30 text-white" : "bg-white border-red-300 text-slate-900"
              )}
            >
              <div className="flex items-center gap-3 text-red-500">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-base">Ban Citizen from Community</h3>
              </div>

              <p className="text-xs text-slate-300">
                Are you sure you want to ban <strong>{banTargetMember.displayName}</strong>? They will be removed immediately and prohibited from rejoining.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Reason for ban (recorded in audit ledger)</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. Terms violation, harassment, spam…"
                  className={cn(
                    "w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-red-500",
                    isDark ? "bg-slate-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBanTargetMember(null);
                    setBanReason('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBanMember}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md transition cursor-pointer"
                >
                  {actionLoading ? 'Banning…' : 'Confirm Ban'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
