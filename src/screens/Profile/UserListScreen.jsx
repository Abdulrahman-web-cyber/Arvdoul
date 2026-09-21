// src/screens/Profile/UserListScreen.jsx
//
// Shared list screen for followers, following, and friends. All three render
// the same scaffold; the differences are the loader, copy, and whether follow
// controls appear. Relationship state comes from userService.getFollowStates
// (single source of truth) rather than being guessed per row.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import FollowButton from '../../components/profile/FollowButton';
import { useAppStore } from '../../store/appStore';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

/**
 * @param {Object} props
 * @param {string} props.title - Header text
 * @param {string} props.searchPlaceholder
 * @param {string} props.emptyText
 * @param {(userId: string) => Promise<Array>} props.loadUsers
 * @param {boolean} props.showFollowButton
 */
export default function UserListScreen({
  title,
  searchPlaceholder,
  emptyText,
  loadUsers,
  showFollowButton = false,
}) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentUser = useAppStore((state) => state.currentUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyIds, setBusyIds] = useState(() => new Set());
  const mountedRef = useRef(true);

  const targetUserId = userId || currentUser?.uid;
  const viewerId = currentUser?.uid;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadUsersRef = useRef(loadUsers);
  useEffect(() => {
    loadUsersRef.current = loadUsers;
  }, [loadUsers]);

  useEffect(() => {
    if (!targetUserId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const userService = (await import('../../services/userService.js')).getUserService();
        const list = (await loadUsersRef.current(targetUserId)) || [];
        const states = viewerId
          ? await userService.getFollowStates(
              viewerId,
              list.map((u) => u.id)
            )
          : null;

        if (cancelled || !mountedRef.current) return;

        setUsers(
          list.map((user) => {
            const state = states?.get(user.id);
            return state ? { ...user, ...state } : user;
          })
        );
      } catch (error) {
        console.error(`Failed to load ${title.toLowerCase()}:`, error);
        if (!cancelled && mountedRef.current) setUsers([]);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetUserId, viewerId, title]);

  const applyState = useCallback((id, isFollowing) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isFollowing } : u)));
  }, []);

  const withBusy = useCallback(async (id, fn) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleFollow = useCallback(
    (id) =>
      withBusy(id, async () => {
        const userService = (await import('../../services/userService.js')).getUserService();
        applyState(id, true);
        try {
          await userService.followUser(viewerId, id);
        } catch (error) {
          console.error('Follow failed:', error);
          applyState(id, false);
        }
      }),
    [viewerId, applyState, withBusy]
  );

  const handleUnfollow = useCallback(
    (id) =>
      withBusy(id, async () => {
        const userService = (await import('../../services/userService.js')).getUserService();
        applyState(id, false);
        try {
          await userService.unfollowUser(viewerId, id);
        } catch (error) {
          console.error('Unfollow failed:', error);
          applyState(id, true);
        }
      }),
    [viewerId, applyState, withBusy]
  );

  const query = searchQuery.toLowerCase();
  const filtered = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(query) ||
      u.username?.toLowerCase().includes(query)
  );

  return (
    <div
      className={cn(
        'min-h-screen pb-20',
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
      )}
    >
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => (
              <div
                key={user.id}
                className={cn(
                  'group flex items-center gap-3 p-4 rounded-2xl',
                  'bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl',
                  'border border-gray-200/60 dark:border-gray-800/60',
                  'shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]',
                  'hover:shadow-[0_12px_40px_rgba(139,92,246,0.15)] hover:-translate-y-0.5 transition-all duration-300'
                )}
              >
                <button onClick={() => navigate(`/profile/${user.id}`)} className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-offset-2 ring-violet-500/40 ring-offset-transparent bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500">
                    <img
                      src={getSafeAvatarUrl(user.photoURL, user.displayName, user.id)}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = getSafeAvatarUrl(null, user.displayName, user.id);
                      }}
                    />
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/profile/${user.id}`)} className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {user.displayName || 'Member'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </p>
                  </button>
                </div>

                {showFollowButton && user.id !== viewerId && (
                  <FollowButton
                    isFollowing={Boolean(user.isFollowing)}
                    loading={busyIds.has(user.id)}
                    onFollow={() => handleFollow(user.id)}
                    onUnfollow={() => handleUnfollow(user.id)}
                    theme={theme}
                    size="sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}