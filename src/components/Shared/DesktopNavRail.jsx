// src/components/Shared/DesktopNavRail.jsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Film,
  Video,
  MessageSquare,
  Sparkles,
  Bell,
  Search,
  Users,
  Radio,
  Trophy,
  Wand2,
  Wallet,
  User,
  Shield,
  Plus,
  Settings,
} from 'lucide-react';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import { prefetchCreatePost } from '../../utils/routePrefetcher.js';
import { useNavBadges } from '../../hooks/useNavBadges';
import { fetchAdminStatus } from '../../services/callableService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickDisplayName, pickHandle, deriveHandle } from '../../services/profileReadModel';
import { ArvdoulEmblem, ArvdoulWordmark } from './ArvdoulLogo';
import { LazyImage } from './LazyImage';
import { cn } from '../../lib/utils';

export default function DesktopNavRail() {
  const { isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const appUser = useAppStore((s) => s.currentUser);
  const storeProfile = useProfileStore((s) => s.profile);
  const badges = useNavBadges();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setIsAdmin(false);
      return undefined;
    }
    fetchAdminStatus()
      .then((res) => {
        if (!cancelled) setIsAdmin(Boolean(res?.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const navItems = [
    { label: 'Home', path: '/home', icon: Home, match: (p) => p === '/' || p === '/home' },
    { label: 'Sparks', path: '/sparks', icon: Film, match: (p) => p === '/sparks' || p.startsWith('/sparks/') || p.startsWith('/videos') || p.startsWith('/video/') },
    { label: 'Reels', path: '/reels', icon: Video, match: (p) => p.startsWith('/reels') },
    { label: 'Messages', path: '/messages', icon: MessageSquare, badge: badges.messages, match: (p) => p.startsWith('/messages') },
    { label: 'Vibes', path: '/vibes', icon: Sparkles, match: (p) => p.startsWith('/vibes') },
    { label: 'Notifications', path: '/notifications', icon: Bell, badge: badges.notifications, match: (p) => p.startsWith('/notifications') },
    { label: 'Search', path: '/search', icon: Search, match: (p) => p.startsWith('/search') },
    { label: 'Communities', path: '/community', icon: Users, badge: badges.network, match: (p) => p.startsWith('/community') },
    { label: 'Spaces', path: '/spaces', icon: Radio, match: (p) => p.startsWith('/spaces') },
    { label: 'Rankings', path: '/rankings', icon: Trophy, match: (p) => p.startsWith('/rankings') },
    { label: 'AI Studio', path: '/ai-studio', icon: Wand2, match: (p) => p.startsWith('/ai-studio') },
    { label: 'Wallet', path: '/wallet', icon: Wallet, match: (p) => p.startsWith('/wallet') || p.startsWith('/coins') },
    { label: 'Profile', path: '/profile', icon: User, match: (p) => p === '/profile' || p.startsWith('/profile/') },
  ];

  if (isAdmin) {
    navItems.push({
      label: 'Admin',
      path: '/admin',
      icon: Shield,
      match: (p) => p.startsWith('/admin'),
    });
  }

  const ownerUid = user?.uid || userProfile?.uid || appUser?.uid || null;
  const ownerProfile =
    (storeProfile && ownerUid && (storeProfile.id === ownerUid || storeProfile.uid === ownerUid) ? storeProfile : null) ||
    (userProfile && (!ownerUid || userProfile.uid === ownerUid || userProfile.id === ownerUid) ? userProfile : null) ||
    (appUser && (!ownerUid || appUser.uid === ownerUid || appUser.id === ownerUid) ? appUser : null) ||
    user;

  const displayName = pickDisplayName(
    [ownerProfile?.displayName, user?.displayName],
    { fallback: ownerUid ? `user ${String(ownerUid).slice(0, 6)}` : 'Account' }
  );
  const handle = pickHandle(
    [ownerProfile?.username, deriveHandle(user?.email)],
    { fallback: '' }
  );
  const avatarUrl = getSafeAvatarUrl(
    ownerProfile?.photoURL || user?.photoURL,
    displayName,
    ownerUid
  );

  return (
    <aside
      aria-label="Desktop navigation"
      className={cn(
        'hidden lg:flex flex-col w-[248px] shrink-0 h-full border-r select-none',
        isDark
          ? 'bg-[#03071B]/95 border-white/10 text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-900'
      )}
    >
      {/* Brand mark */}
      <div className={cn(
        'h-16 px-4 flex items-center justify-between border-b shrink-0',
        isDark ? 'border-white/10' : 'border-slate-200/80'
      )}>
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Go to Arvdoul Home"
          className="flex items-center gap-2.5 text-left rounded-xl py-1 pr-2 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
        >
          <ArvdoulEmblem size={30} showPlate />
          <ArvdoulWordmark variant={isDark ? 'gradient' : 'dark'} size="sm" />
        </button>
      </div>

      {/* Scrollable navigation list */}
      <nav aria-label="Primary navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(location.pathname);
          const count = Number(item.badge) || 0;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'w-full min-h-[40px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple',
                active
                  ? isDark
                    ? 'bg-purple-500/15 text-white border border-purple-400/25'
                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                  : isDark
                    ? 'text-slate-300 border border-transparent hover:bg-white/5 hover:text-white'
                    : 'text-slate-700 border border-transparent hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={cn(
                    'w-[18px] h-[18px] shrink-0',
                    active && (isDark ? 'text-purple-400' : 'text-purple-600')
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {count > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 min-w-[20px] text-center rounded-md text-[11px] font-bold tabular-nums shrink-0',
                    active
                      ? isDark
                        ? 'bg-purple-400/20 text-purple-200'
                        : 'bg-purple-600 text-white'
                      : 'bg-arvdoul-purple/15 text-arvdoul-purple dark:text-purple-300'
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Primary Create Post CTA + Account Footer */}
      <div className={cn(
        'p-3 border-t space-y-3 shrink-0',
        isDark ? 'border-white/10' : 'border-slate-200/80'
      )}>
        <button
          type="button"
          onClick={() => navigate('/create-post')}
          onPointerEnter={() => prefetchCreatePost()}
          onTouchStart={() => prefetchCreatePost()}
          onFocus={() => prefetchCreatePost()}
          className="w-full py-2.5 px-4 rounded-xl bg-arvdoul-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Post</span>
        </button>

        <div className={cn(
          'flex items-center justify-between gap-2 p-2 rounded-xl border',
          isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200/80'
        )}>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
          >
            <LazyImage
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/15"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{displayName}</p>
              {handle && (
                <p className={cn('text-[11px] truncate', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  @{handle}
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title="Settings"
            className={cn(
              'p-2 rounded-lg transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple',
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
            )}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
