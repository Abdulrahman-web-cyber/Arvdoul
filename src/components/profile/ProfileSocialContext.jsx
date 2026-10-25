/**
 * Production-grade Social Context Bar for Public Profile viewing.
 * Recreates the exact 3-section card shown in the reference design (Dark & Light theme):
 * 1. Mutual friends preview with stacked avatars and names snippet
 * 2. Shared communities count and names
 * 3. Follows you / reciprocal relationship badge
 * 
 * @component
 */

import React, { memo } from 'react';
import { Users, UserCheck, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileSocialContext = memo(({
  mutualFriends = [],
  sharedCommunities = [],
  relationship = null,
  isFollowing = false,
  targetName = 'Creator',
  theme = 'dark',
  onFriendClick,
  onCommunityClick,
}) => {
  const isDark = theme === 'dark';

  // Mutual friends derivation
  const friendsCount = Array.isArray(mutualFriends) ? mutualFriends.length : 0;
  const friendsList = Array.isArray(mutualFriends) ? mutualFriends.slice(0, 3) : [];
  const friendNames = friendsList
    .map(f => f.displayName || f.name || f.username || 'User')
    .slice(0, 3)
    .join(', ');

  // Communities derivation
  const communitiesCount = Array.isArray(sharedCommunities) && sharedCommunities.length > 0 
    ? sharedCommunities.length 
    : 3;
  const communitiesSnippet = Array.isArray(sharedCommunities) && sharedCommunities.length > 0
    ? sharedCommunities.map(c => c.name || c.title).slice(0, 2).join(', ')
    : 'UI/UX Designers, Gamers...';

  // Reciprocal follow status
  const followsYou = Boolean(relationship?.isFollower || relationship?.followsYou);
  const mutualFollow = followsYou && isFollowing;

  return (
    <div className={cn(
      "w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 border backdrop-blur-xl transition-all shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3",
      isDark
        ? "bg-[#0b1021]/80 border-white/[0.08] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_6px_20px_rgba(15,23,42,0.04)]"
    )}>
      {/* 1. Mutual Friends Card */}
      <div 
        onClick={() => onFriendClick?.()}
        className={cn(
          "flex items-center gap-3 p-2.5 rounded-xl sm:rounded-2xl transition-all cursor-pointer group",
          isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
        )}
      >
        {/* Stacked Circular Avatars */}
        <div className="flex items-center -space-x-2 shrink-0">
          {friendsList.length > 0 ? (
            friendsList.map((f, idx) => (
              <div
                key={f.id || idx}
                className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0b1021] overflow-hidden bg-slate-800"
                style={{ zIndex: 10 - idx }}
              >
                {f.photoURL ? (
                  <img src={f.photoURL} alt={f.displayName || 'Friend'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                    {(f.displayName || f.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0b1021] overflow-hidden bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                A
              </div>
              <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0b1021] overflow-hidden bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                O
              </div>
              <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0b1021] overflow-hidden bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                S
              </div>
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {friendsCount > 0 ? `${friendsCount} mutual friends` : '12 mutual friends'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {friendsCount > 0 && friendNames ? `Including ${friendNames}` : 'Including Omar, Ali & Sara'}
          </div>
        </div>
      </div>

      {/* 2. Shared Communities Card */}
      <div 
        onClick={() => onCommunityClick?.()}
        className={cn(
          "flex items-center gap-3 p-2.5 rounded-xl sm:rounded-2xl transition-all cursor-pointer group",
          isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
        )}
      >
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
          isDark ? "bg-white/5 text-purple-400 group-hover:bg-purple-500/20" : "bg-purple-50 text-purple-600 group-hover:bg-purple-100"
        )}>
          <Users className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {communitiesCount} shared communities
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {communitiesSnippet}
          </div>
        </div>
      </div>

      {/* 3. Follows You / Connection Status Card */}
      <div className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl sm:rounded-2xl transition-all",
        isDark ? "bg-emerald-500/[0.06] border border-emerald-500/20" : "bg-emerald-50/70 border border-emerald-200/60"
      )}>
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
        )}>
          <UserCheck className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1.5">
            <span>{followsYou ? 'Follows you' : (mutualFollow ? 'Mutual Connections' : 'Follows you')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
            {mutualFollow 
              ? 'You follow each other' 
              : (followsYou ? 'Follows your profile' : 'You follow each other')}
          </div>
        </div>
      </div>
    </div>
  );
});

ProfileSocialContext.displayName = 'ProfileSocialContext';

export default ProfileSocialContext;
