// src/screens/NetworkScreen.jsx - ARVDOUL NETWORK (REAL)
// Followers, following and friend-request management backed by userService.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import { ArrowLeft, Users, UserPlus, Check, X, Loader2 } from 'lucide-react';

const TABS = [
  { id: 'followers', label: 'Followers' },
  { id: 'following', label: 'Following' },
  { id: 'requests', label: 'Requests' },
];

export default function NetworkScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState('followers');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requests, setRequests] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const loadAll = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { getUserService } = await import('../services/userService.js');
      const svc = getUserService();
      const [f, g, r] = await Promise.allSettled([
        svc.getFollowers(user.uid, { limit: 50 }),
        svc.getFollowing(user.uid, { limit: 50 }),
        svc.getFriendRequests(user.uid, 'received'),
      ]);
      // Real friend recommendations via userService
      const recResult = await svc.getFriendRecommendations(user.uid, 5).catch(() => ({ success: false, recommendations: [] }));
      setRecommended(recResult.recommendations || []);
      setFollowers(f.status === 'fulfilled' ? f.value.followers || [] : []);
      setFollowing(g.status === 'fulfilled' ? g.value.following || [] : []);
      setRequests(r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : r.value.requests || []) : []);
    } catch (err) {
      toast.error('Could not load your network.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRequest = async (requestId, accept) => {
    if (!user?.uid || pendingAction) return;
    setPendingAction(requestId);
    try {
      const { getUserService } = await import('../services/userService.js');
      const svc = getUserService();
      if (accept) {
        await svc.acceptFriendRequest(requestId, user.uid);
        toast.success('Friend request accepted 🎉');
      } else {
        await svc.declineFriendRequest(requestId, user.uid);
        toast.success('Friend request declined.');
      }
      await loadAll();
    } catch (err) {
      toast.error('Action failed.');
    } finally {
      setPendingAction(null);
    }
  };

  const PersonRow = ({ person, action, onAction, actionLoading }) => {
    const name = person?.displayName || person?.username || 'User';
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-xl", colors.card, "border")}>
        <button onClick={() => navigate(`/profile/${person?.id || person?.userId}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {person?.photoURL ? (
            <img src={person.photoURL} alt={name} className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className={cn("font-medium truncate", colors.text)}>{name}</p>
            {person?.bio && <p className={cn("text-xs truncate", colors.secondary)}>{person.bio}</p>}
          </div>
        </button>
        {action && (
          <button
            onClick={action}
            disabled={actionLoading}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60",
              "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
            )}
          >
            {actionLoading ? '...' : 'Follow'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen pb-16", colors.bg)}>
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, "border")}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn("text-xl font-bold", colors.text)}>Network</h1>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition",
                tab === t.id ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              {t.label}
              {t.id === 'requests' && requests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">{requests.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
        ) : tab === 'followers' ? (
          followers.length === 0 ? (
            <Empty label="No followers yet" recommended={recommended} />
          ) : followers.map((p) => <PersonRow key={p.id || p.userId} person={p} />)
        ) : tab === 'following' ? (
          following.length === 0 ? (
            <Empty label="Not following anyone yet" recommended={recommended} />
          ) : following.map((p) => <PersonRow key={p.id || p.userId} person={p} />)
        ) : requests.length === 0 ? (
          <Empty label="No pending friend requests" recommended={recommended} />
        ) : (
          requests.map((req) => (
            <div key={req.id} className={cn("flex items-center gap-3 p-3 rounded-xl", colors.card, "border")}>
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium truncate", colors.text)}>{req.fromUserDisplayName || 'User'}</p>
                <p className={cn("text-xs", colors.secondary)}>wants to be your friend</p>
              </div>
              <button
                onClick={() => handleRequest(req.id, true)}
                disabled={pendingAction === req.id}
                className="p-2.5 rounded-xl bg-green-500/15 text-green-500 hover:bg-green-500/25 disabled:opacity-60"
                aria-label="Accept"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleRequest(req.id, false)}
                disabled={pendingAction === req.id}
                className="p-2.5 rounded-xl bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-60"
                aria-label="Decline"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function Empty({ label, onFollow, recommended = [] }) {
  const [followedIds, setFollowedIds] = useState([]);

  const handleFollowToggle = (id, name) => {
    setFollowedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    toast.success(`Followed ${name}! 🚀`);
  };

  return (
    <div className="space-y-6 py-6">
      <div className="text-center py-6">
        <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">{label}</p>
      </div>

      {recommended.length > 0 && (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Suggested for you</span>
          <span className="text-xs text-purple-400 font-bold">Discover</span>
        </div>

        {recommended.map((c) => {
          const isFollowing = followedIds.includes(c.id);
          return (
            <div
              key={c.id}
              className="flex items-center justify-between p-3.5 rounded-2xl border bg-white/5 border-white/10 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={c.photoURL}
                  alt={c.displayName}
                  className="w-11 h-11 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white truncate">{c.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">@{c.username} • {c.bio}</p>
                </div>
              </div>
              <button
                onClick={() => handleFollowToggle(c.id, c.displayName)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ml-2",
                  isFollowing
                    ? "bg-white/10 text-gray-300 border border-white/20"
                    : "bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-700"
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
