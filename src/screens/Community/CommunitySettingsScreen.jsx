// src/screens/Community/CommunitySettingsScreen.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Shield, Globe, Lock, Users, Trash2, Save,
  CheckCircle, AlertTriangle, UserMinus, Crown
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { getUserService } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { cn } from '../../lib/utils';

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can find and join', icon: Globe },
  { value: 'private', label: 'Private', description: 'Anyone can find, joining needs approval', icon: Lock },
  { value: 'secret', label: 'Secret', description: 'Invite only, hidden from discovery', icon: Shield },
];

const SLOW_MODE_DELAYS = [10, 30, 60, 300, 900];

const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'member', label: 'Member' },
];

const MANAGE_ROLES = ['owner', 'admin', 'moderator'];

const SectionCard = ({ title, description, children }) => (
  <section className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/70 backdrop-blur-xl p-5 sm:p-6">
    <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
    {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const Field = ({ label, value, onChange, multiline = false, maxLength, hint }) => (
  <label className="block">
    <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={maxLength}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    )}
    {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
  </label>
);

const ToggleRow = ({ label, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')}
      />
    </button>
  </div>
);

export default function CommunitySettingsScreen() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const communityService = getCommunityService();
  const uid = user?.uid;

  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState({});

  const [form, setForm] = useState({ name: '', description: '', rules: '', privacy: 'public' });

  const role = community?.members?.[uid]?.role;
  const canManage = MANAGE_ROLES.includes(role);
  const isOwner = role === 'owner';

  const load = useCallback(async () => {
    if (!communityId || !uid) return;
    setLoading(true);
    setAccessError(null);
    try {
      const data = await communityService.getCommunity(communityId);
      if (!data) {
        setAccessError('Community not found.');
        setCommunity(null);
        return;
      }
      if (!MANAGE_ROLES.includes(data.members?.[uid]?.role)) {
        setAccessError('You do not have permission to manage this community.');
        setCommunity(null);
        return;
      }
      setCommunity(data);
      setForm({
        name: data.name || '',
        description: data.description || '',
        rules: data.rules || '',
        privacy: data.privacy || 'public',
      });
    } catch (err) {
      setAccessError(err?.message || 'Failed to load community.');
    } finally {
      setLoading(false);
    }
  }, [communityId, uid, communityService]);

  useEffect(() => { load(); }, [load]);

  // Resolve display names for the member list once the community is known.
  const memberEntries = useMemo(
    () => Object.entries(community?.members || {}).map(([id, m]) => ({ id, ...m })),
    [community]
  );

  useEffect(() => {
    if (memberEntries.length === 0) return;
    let cancelled = false;
    (async () => {
      const userService = getUserService();
      const next = {};
      await Promise.all(memberEntries.slice(0, 50).map(async (m) => {
        try {
          const profile = await userService.getUserProfile(m.id);
          if (profile) next[m.id] = { displayName: profile.displayName || profile.username, avatar: profile.avatar || profile.photoURL };
        } catch { /* a missing profile must not break the list */ }
      }));
      if (!cancelled) setMemberProfiles(next);
    })();
    return () => { cancelled = true; };
  }, [memberEntries]);

  const saveBasics = useCallback(async () => {
    if (!canManage) return;
    if (!form.name.trim()) {
      toast.error('Community name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await communityService.updateCommunity(communityId, {
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        privacy: form.privacy,
      }, uid);
      toast.success('Community settings saved');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [canManage, form, communityService, communityId, uid, load]);

  const toggleSlowMode = useCallback(async (enabled, delay) => {
    try {
      if (enabled) await communityService.enableSlowMode(communityId, delay, uid);
      else await communityService.disableSlowMode(communityId, uid);
      toast.success(enabled ? 'Slow mode enabled' : 'Slow mode disabled');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to update slow mode');
    }
  }, [communityService, communityId, uid, load]);

  const toggleContentApproval = useCallback(async (enabled) => {
    try {
      if (enabled) await communityService.enableContentApproval(communityId, uid);
      else await communityService.disableContentApproval(communityId, uid);
      toast.success(enabled ? 'Content approval enabled' : 'Content approval disabled');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to update content approval');
    }
  }, [communityService, communityId, uid, load]);

  const changeRole = useCallback(async (targetId, nextRole) => {
    try {
      await communityService.assignRole(communityId, targetId, nextRole, uid);
      toast.success('Role updated');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to update role');
    }
  }, [communityService, communityId, uid, load]);

  const banMember = useCallback(async (targetId) => {
    try {
      await communityService.banUser(communityId, targetId, uid, 'Removed from settings');
      toast.success('Member removed and banned');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove member');
    }
  }, [communityService, communityId, uid, load]);

  const unbanMember = useCallback(async (targetId) => {
    try {
      await communityService.unbanUser(communityId, targetId, uid);
      toast.success('Member unbanned');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Failed to unban member');
    }
  }, [communityService, communityId, uid, load]);

  const deleteCommunity = useCallback(async () => {
    setDeleting(true);
    try {
      await communityService.deleteCommunity(communityId, uid);
      toast.success('Community deleted');
      navigate('/community', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Failed to delete community');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [communityService, communityId, uid, navigate]);

  const bannedUsers = community?.moderation?.bannedUsers || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-700 dark:text-gray-300">{accessError}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/community/${communityId}`)}
            aria-label="Back to community"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">Community Settings</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{community?.name}</p>
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5"
      >
        <SectionCard title="Basics" description="Name, description and rules are visible to members.">
          <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} maxLength={60} />
          <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline maxLength={500} />
          <Field label="Rules" value={form.rules} onChange={(v) => setForm((f) => ({ ...f, rules: v }))} multiline maxLength={2000} hint="One rule per line." />

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Privacy</p>
            <div className="space-y-2" role="radiogroup" aria-label="Community privacy">
              {PRIVACY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.privacy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm((f) => ({ ...f, privacy: opt.value }))}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <Icon className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.description}</span>
                    </span>
                    {active && <CheckCircle className="w-4 h-4 text-indigo-500 ml-auto shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={saveBasics}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </SectionCard>

        <SectionCard title="Moderation" description="Control how members can post and when content goes live.">
          <ToggleRow
            label="Slow mode"
            description="Limit how often members can post."
            checked={Boolean(community?.moderation?.slowMode)}
            onChange={(v) => toggleSlowMode(v, community?.moderation?.slowModeDelay || 30)}
          />
          {community?.moderation?.slowMode && (
            <div className="flex flex-wrap gap-2">
              {SLOW_MODE_DELAYS.map((delay) => (
                <button
                  key={delay}
                  type="button"
                  onClick={() => toggleSlowMode(true, delay)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                    community?.moderation?.slowModeDelay === delay
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {delay < 60 ? `${delay}s` : `${delay / 60}m`}
                </button>
              ))}
            </div>
          )}
          <ToggleRow
            label="Content approval"
            description="New posts require a moderator to approve them."
            checked={Boolean(community?.moderation?.contentApproval)}
            onChange={toggleContentApproval}
          />
        </SectionCard>

        <SectionCard title="Members" description={`${memberEntries.length} member${memberEntries.length === 1 ? '' : 's'}`}>
          <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
            {memberEntries.map((m) => {
              const profile = memberProfiles[m.id];
              const display = profile?.displayName || m.id;
              const isSelf = m.id === uid;
              return (
                <li key={m.id} className="py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                    {profile?.avatar ? (
                      <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {display}{isSelf ? ' (you)' : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize inline-flex items-center gap-1">
                      {(m.role === 'owner' || m.role === 'admin') && <Crown className="w-3 h-3" aria-hidden="true" />}
                      {m.role}
                    </p>
                  </div>
                  {!isSelf && m.role !== 'owner' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        aria-label={`Role for ${display}`}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs px-2 py-1.5 text-gray-800 dark:text-gray-200"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => banMember(m.id)}
                        aria-label={`Remove ${display}`}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <UserMinus className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {bannedUsers.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Banned users</p>
              <ul className="space-y-2">
                {bannedUsers.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{memberProfiles[id]?.displayName || id}</span>
                    <button
                      onClick={() => unbanMember(id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Unban
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        {isOwner && (
          <SectionCard title="Danger zone" description="Deleting a community cannot be undone.">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete community
            </button>
          </SectionCard>
        )}
      </motion.main>

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete this community?</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            All members, posts and settings for <strong>{community?.name}</strong> will be permanently removed.
          </p>
          <div className="mt-5 flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={deleteCommunity}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
