/**
 * src/components/profile/ProfileSocialConnections.jsx - ARVDOUL Social Connections Component
 * 
 * Recreates the 3-column Social Connections card for Public Profile view:
 * 1. Mutual friends avatar stack & details
 * 2. Shared communities & creative circles
 * 3. Bidirectional relationship status (Follows you / Mutual connection)
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkles, UserCheck, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

const ProfileSocialConnections = memo(({
  mutualFriends = [],
  profile,
  theme = 'light',
  onMutualClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const count = mutualFriends.length || profile?.mutualCount || 0;
  const friendNames = mutualFriends.slice(0, 3).map(f => f.displayName || f.name).filter(Boolean);
  const subtitle = friendNames.length > 0 
    ? `Including ${friendNames.join(', ')}` 
    : (count > 0 ? `${count} friends in common` : 'Connect to discover common friends');

  // Shared communities from profile categories or interests
  const communities = Array.isArray(profile?.communities) 
    ? profile.communities 
    : (Array.isArray(profile?.tags) 
      ? profile.tags 
      : (Array.isArray(profile?.interests) ? profile.interests : []));
  const followsYou = Boolean(profile?.followsYou || profile?.relationship?.followsViewer || profile?.isFollower);

  return (
    <div className={cn(
      "w-full rounded-2xl p-4 border backdrop-blur-xl transition-all shadow-sm",
      isDark
        ? "bg-[#0d1424]/70 border-white/10 text-white"
        : "bg-white/90 border-slate-200/90 text-slate-900"
    )}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/10">
        
        {/* Column 1: Mutual Friends */}
        <div 
          onClick={onMutualClick}
          className="flex items-center gap-3 pt-2 md:pt-0 cursor-pointer group"
        >
          {/* Avatar Pile */}
          <div className="flex -space-x-2 overflow-hidden shrink-0">
            {count > 0 && mutualFriends.length > 0 ? (
              mutualFriends.slice(0, 3).map((friend, i) => (
                <div
                  key={friend.id || friend.uid || i}
                  className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#0d1424] bg-slate-800 overflow-hidden"
                >
                  <img
                    src={getSafeAvatarUrl(friend.photoURL, friend.displayName || `Friend ${i}`, friend.id || friend.uid || i)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold flex items-center gap-1 group-hover:text-purple-500 transition-colors">
              <span>{count > 0 ? `${count} mutual friends` : 'Explore Connections'}</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Column 2: Shared Communities */}
        <div className="flex items-center gap-3 pt-3 md:pt-0 md:pl-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold">
              {communities.length > 0 ? `${communities.length} shared topics` : 'Creator Profile'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {communities.length > 0 ? communities.slice(0, 3).join(', ') : 'Creative sharing & posts'}
            </p>
          </div>
        </div>

        {/* Column 3: Relationship Status */}
        <div className="flex items-center gap-3 pt-3 md:pt-0 md:pl-4">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            followsYou
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-slate-500/10 text-slate-400"
          )}>
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold">
              {followsYou ? 'Follows you' : 'Arvdoul Creator'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {followsYou ? 'You can connect & chat directly' : 'Discover original media & sparks'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
});

ProfileSocialConnections.displayName = 'ProfileSocialConnections';

export default ProfileSocialConnections;
