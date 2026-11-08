// src/screens/BlockedAccountsScreen.jsx
//
// Management surface for the safety graph. `blockUser`/`muteUser`/
// `restrictUser` were writable from profile menus, but nothing let a user
// REVIEW or REVERSE a block/mute — a permanent, one-way action. This screen
// lists the viewer's own blocked / muted / restricted edges (all party-readable
// per firestore.rules) and lets them be lifted.
//
// Every list read goes through socialGraphService.listConnections (bounded,
// index-backed, cursor-paged) via userService.get*Users — no ad-hoc graph scan.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, VolumeX, EyeOff, Loader2, ChevronLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import userService from '../services/userService';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { pickDisplayName, pickHandle, deriveHandle } from '../services/profileReadModel.js';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import { Skeleton } from '../components/UI/Skeleton.jsx';
import { cn } from '../lib/utils';

const TABS = [
  { id: 'blocked', label: 'Blocked', icon: ShieldOff, empty: 'You have not blocked anyone.' },
  { id: 'muted', label: 'Muted', icon: VolumeX, empty: 'You have not muted anyone.' },
  { id: 'restricted', label: 'Restricted', icon: EyeOff, empty: 'You have not restricted anyone.' },
];

const FETCHERS = {
  blocked: { list: 'getBlockedUsers', key: 'blockedUsers', remove: 'unblockUser', verb: 'unblocked' },
  muted: { list: 'getMutedUsers', key: 'mutedUsers', remove: 'unmuteUser', verb: 'unmuted' },
  restricted: { list: 'getRestrictedUsers', key: 'restrictedUsers', remove: 'unrestrictUser', verb: 'unrestricted' },
};

export default function BlockedAccountsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const uid = user?.uid;

  const [activeTab, setActiveTab] = useState('blocked');
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (tab) => {
    if (!uid) return;
    const { list, key } = FETCHERS[tab];
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await userService[list](uid);
      if (res?.success === false) {
        setState({ loading: false, error: res.error || 'Could not load this list.', items: [] });
        return;
      }
      setState({ loading: false, error: null, items: res?.[key] || [] });
    } catch (err) {
      setState({ loading: false, error: err?.message || 'Could not load this list.', items: [] });
    }
  }, [uid]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  const handleLift = async (item) => {
    const { remove, verb } = FETCHERS[activeTab];
    const targetId = item.id || item.uid;
    if (!targetId) return;
    setBusyId(targetId);
    try {
      const res = await userService[remove](uid, targetId);
      if (res?.success === false) throw new Error(res.error || 'Action failed');
      // Optimistic removal; reload reconciles with the graph spine.
      setState((s) => ({ ...s, items: s.items.filter((i) => (i.id || i.uid) !== targetId) }));
      toast.success(`Account ${verb}.`);
    } catch (err) {
      toast.error(err?.message || 'Could not update this account.');
      load(activeTab);
    } finally {
      setBusyId(null);
    }
  };

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div className={cn('min-h-screen pb-24', isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]')}>
      <header className="sticky top-0 z-10 backdrop-blur-xl border-b px-4 py-3 flex items-center gap-3 bg-white/70 dark:bg-[#03071B]/70 border-gray-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className={cn('p-2 rounded-full transition', isDark ? 'hover:bg-white/10' : 'hover:bg-black/5', text)}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className={cn('text-lg font-bold flex-1', text)}>Blocked &amp; muted accounts</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <p className={cn('text-sm mb-4', muted)}>
          Manage the accounts you have blocked, muted, or restricted. Lifting a block restores
          normal visibility for both accounts.
        </p>

        <div role="tablist" aria-label="Safety lists" className="flex gap-2 mb-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold border transition',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white border-transparent shadow'
                    : cn(isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50', text)
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className={cn('rounded-2xl border p-4', card)}>
          {state.loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading accounts">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton height={12} width="40%" />
                    <Skeleton height={10} width="25%" />
                  </div>
                </div>
              ))}
            </div>
          ) : state.error ? (
            <ErrorState
              title="Could not load this list"
              message={state.error}
              onRetry={() => load(activeTab)}
            />
          ) : state.items.length === 0 ? (
            <EmptyState
              icon={activeTabMeta.icon}
              title={activeTabMeta.empty}
              description="Accounts you act on from a profile will appear here."
            />
          ) : (
            <ul className="space-y-2.5">
              {state.items.map((item) => {
                const id = item.id || item.uid;
                const name = pickDisplayName([item.displayName, item.name], { fallback: 'Member' });
                const handle = pickHandle([item.username]) || deriveHandle(name);
                const avatar = getSafeAvatarUrl(item.photoURL, name, id);
                const busy = busyId === id;
                return (
                  <li key={id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${id}`)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <img
                        src={avatar}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                        onError={(e) => { e.target.src = getSafeAvatarUrl(null, name, id); }}
                      />
                      <div className="min-w-0">
                        <p className={cn('text-sm font-bold truncate', text)}>{name}</p>
                        {handle && <p className={cn('text-xs font-mono truncate', muted)}>@{handle}</p>}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleLift(item)}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50',
                        isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'border-gray-300 hover:bg-gray-100 text-gray-800'
                      )}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {activeTab === 'blocked' ? 'Unblock' : activeTab === 'muted' ? 'Unmute' : 'Unrestrict'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
