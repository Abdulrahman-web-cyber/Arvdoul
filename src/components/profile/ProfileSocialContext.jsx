/**
 * Production-grade Social Context Bar for Public Profile viewing.
 * Renders mutual friends, shared communities, and reciprocal connection status
 * in a single clean hairline-divided strip (zero nested cards or decorative dots).
 *
 * Strictly fail-closed on capability gates.
 *
 * @component
 */

import { memo } from "react";
import { Users, UserCheck } from "lucide-react";
import { cn } from '../../lib/utils';
import { LazyImage } from '../../components/Shared/LazyImage';

const ProfileSocialContext = memo(({
  mutualFriends = [],
  mutualFriendsResolved = false,
  sharedCommunities = [],
  relationship = null,
  isFollowing = false,
  targetName = null,
  theme = 'dark',
  capabilities = null,
  onFriendClick,
}) => {
  const isDark = theme === 'dark';

  const communitiesCount = Array.isArray(sharedCommunities) ? sharedCommunities.length : 0;
  const canShowFriends = capabilities?.canViewFriends === true;
  const friendsResolved = mutualFriendsResolved === true;
  const showFriends = canShowFriends && friendsResolved;
  const canShowCommunities = capabilities?.canViewCommunities === true && communitiesCount > 0;
  const canShowRelationship = Boolean(relationship) || isFollowing;

  if (!showFriends && !canShowCommunities && !canShowRelationship) {
    return null;
  }

  const friendsCount = Array.isArray(mutualFriends) ? mutualFriends.length : 0;
  const friendsList = Array.isArray(mutualFriends) ? mutualFriends.slice(0, 3) : [];
  const friendNames = friendsList
    .map(f => f.displayName || f.name || f.username || '')
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  const communitiesSnippet = sharedCommunities
    .map(c => c.name || c.title || '')
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  const followsYou = Boolean(relationship?.isFollower || relationship?.followsYou);
  const mutualFollow = followsYou && isFollowing;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border backdrop-blur-xl overflow-hidden",
        isDark
          ? "border-white/[0.08] bg-[#0B1234]/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-slate-200/90 bg-slate-200/75 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px">
        {showFriends && (
          <button
            type="button"
            onClick={() => onFriendClick?.()}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer group text-left w-full",
              isDark ? "bg-[#0B1234]/42 hover:bg-[#101A4A]/52" : "bg-white hover:bg-slate-50"
            )}
          >
            <div className="flex items-center -space-x-2 shrink-0">
              {friendsList.length > 0 ? (
                friendsList.map((f, idx) => (
                  <div
                    key={f.id || f.uid || idx}
                    className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#0B1234] overflow-hidden bg-slate-800"
                    style={{ zIndex: 10 - idx }}
                  >
                    {f.photoURL ? (
                      <LazyImage src={f.photoURL} alt={f.displayName || 'Friend'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-arvdoul-gradient flex items-center justify-center text-white text-[10px] font-bold">
                        {(f.displayName || f.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#0B1234] bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold truncate group-hover:text-arvdoul-purple dark:group-hover:text-purple-300 transition-colors tabular-nums">
                {friendsCount > 0
                  ? `${friendsCount} mutual ${friendsCount === 1 ? 'friend' : 'friends'}`
                  : 'No mutual friends'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {friendsCount > 0 && friendNames
                  ? `Including ${friendNames}${friendsCount > 2 ? ` & ${friendsCount - 2} more` : ''}`
                  : 'Connect through common creators'}
              </div>
            </div>
          </button>
        )}

        {canShowCommunities && (
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              isDark ? "bg-[#0B1234]/42" : "bg-white"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
              isDark ? "bg-white/[0.06] text-purple-300" : "bg-purple-50 text-arvdoul-purple"
            )}>
              <Users className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">
                {communitiesCount} shared {communitiesCount === 1 ? 'community' : 'communities'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {communitiesSnippet}
              </div>
            </div>
          </div>
        )}

        {canShowRelationship && (
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              isDark ? "bg-[#0B1234]/42" : "bg-white",
              (!showFriends || !canShowCommunities) && "md:col-span-1"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
              mutualFollow || followsYou
                ? (isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600")
                : isFollowing
                ? (isDark ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-arvdoul-purple")
                : (isDark ? "bg-white/[0.06] text-slate-400" : "bg-slate-100 text-slate-500")
            )}>
              <UserCheck className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0">
              <div className={cn(
                "text-xs font-semibold truncate",
                mutualFollow || followsYou
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isFollowing
                  ? "text-arvdoul-purple dark:text-purple-300"
                  : "text-slate-700 dark:text-slate-200"
              )}>
                {mutualFollow
                  ? 'Mutual Connection'
                  : followsYou
                  ? 'Follows You'
                  : isFollowing
                  ? 'Following'
                  : 'Not Connected'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {mutualFollow
                  ? 'You follow each other'
                  : followsYou
                  ? 'Follows your profile'
                  : isFollowing
                  ? `You follow ${targetName || 'this profile'}`
                  : 'Follow to connect'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ProfileSocialContext.displayName = 'ProfileSocialContext';

export default ProfileSocialContext;
