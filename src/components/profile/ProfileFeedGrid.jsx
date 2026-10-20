// src/components/profile/ProfileFeedGrid.jsx

import React, { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, 
  MessageCircle, 
  Play, 
  Pause,
  Film, 
  Image as ImageIcon, 
  Bookmark, 
  Share2, 
  Sparkles, 
  Layers, 
  MapPin, 
  Globe, 
  Calendar, 
  MoreHorizontal, 
  Coins, 
  ShieldCheck, 
  Check,
  Music,
  Tag,
  Volume2,
  Sliders,
  ExternalLink,
  Plus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPerksForLevel } from '../../services/levelSystemService';
import { toast } from 'sonner';
import ProfileCitizenshipCard from './ProfileCitizenshipCard';

const ProfileFeedGrid = memo(({
  posts = [],
  savedPosts = [],
  activeTab = 'posts',
  viewMode = 'grid',
  loading = false,
  theme = 'light',
  profile,
  onPostClick,
  onOpenTipModal,
  isOwner = false,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [likedPosts, setLikedPosts] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const [playingAudioId, setPlayingAudioId] = useState(null);

  const handleQuickLike = (e, postId) => {
    e.stopPropagation();
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handleQuickBookmark = (e, postId) => {
    e.stopPropagation();
    setSavedMap(prev => {
      const isNowSaved = !prev[postId];
      toast.success(isNowSaved ? 'Post bookmarked' : 'Post removed from saved');
      return { ...prev, [postId]: isNowSaved };
    });
  };

  const handleQuickShare = (e, post) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: post.title || 'Arvdoul Post',
        text: post.content || post.caption || '',
        url: `${window.location.origin}/post/${post.id}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast.success('Post link copied to clipboard');
    }
  };

  const handleToggleAudio = useCallback((e, trackId) => {
    e.stopPropagation();
    setPlayingAudioId(prev => (prev === trackId ? null : trackId));
  }, []);

  // Handle 'citizenship' tab
  if (activeTab === 'citizenship') {
    return (
      <div className="w-full py-1">
        <ProfileCitizenshipCard
          userId={profile?.id || profile?.userId}
          profile={profile}
          isOwner={isOwner}
          theme={theme}
        />
      </div>
    );
  }

  // Handle 'about' tab
  if (activeTab === 'about') {
    const hasLevel = profile?.level != null && Number(profile.level) > 0;
    const perks = hasLevel ? (getPerksForLevel(profile.level) || []) : [];
    return (
      <div className={cn(
        "w-full rounded-2xl p-5 sm:p-7 border transition-all shadow-sm space-y-6",
        isDark ? "bg-[#0B0F19] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
      )}>
        <div>
          <h3 className="text-base font-bold mb-2">About Citizen</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {profile?.bio || 'No bio written yet.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-slate-200 dark:border-white/10">
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Citizen Dossier
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Location: {profile?.location || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Website:{' '}
                  {profile?.website ? (
                    <a
                      href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-500 hover:underline"
                    >
                      {profile.website}
                    </a>
                  ) : (
                    'Not specified'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Citizen Since:{' '}
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
                    : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              {hasLevel ? `Unlocked Perks (Tier ${profile.level})` : 'Civic Perks'}
            </h4>
            {perks.length > 0 ? (
              <div className="space-y-2">
                {perks.slice(0, 4).map((perk, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-base shrink-0">{perk.icon}</span>
                    <div>
                      <span className="font-semibold">{perk.title}</span>
                      <span className="text-slate-400 text-[11px] block">{perk.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Civic privileges become active as progression tiers are achieved.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter items by active tab
  let displayItems = posts;
  if (activeTab === 'saved') {
    displayItems = savedPosts;
  } else if (activeTab === 'reels') {
    displayItems = displayItems.filter(p => 
      p.type === 'reel' || 
      p.type === 'spark' || 
      p.isReel || 
      p.isSpark ||
      (p.type === 'video' && (p.aspectRatio === '9:16' || p.isVertical))
    );
  } else if (activeTab === 'audio') {
    displayItems = displayItems.filter(p => 
      p.type === 'audio' || 
      p.type === 'track' || 
      p.type === 'music' || 
      Boolean(p.audioURL || p.audioUrl || p.waveform || p.bpm || p.soundUrl || p.genre)
    );
  } else if (activeTab === 'tagged') {
    const targetUid = profile?.uid || profile?.id;
    const targetUsername = (profile?.username || '').toLowerCase();
    displayItems = displayItems.filter(p => 
      (Array.isArray(p.taggedUsers) && (p.taggedUsers.includes(targetUid) || p.taggedUsers.includes(targetUsername))) ||
      (Array.isArray(p.tags) && p.tags.includes(targetUsername)) ||
      (p.content && targetUsername && p.content.toLowerCase().includes(`@${targetUsername}`)) ||
      p.type === 'tagged'
    );
  } else if (activeTab === 'posts') {
    // Standard posts: exclude dedicated audio tracks to keep categories sharp
    displayItems = displayItems.filter(p => p.type !== 'audio' && p.type !== 'track');
  }

  // Empty state handling with tailored actions
  if (displayItems.length === 0) {
    const emptyStates = {
      posts: {
        icon: Layers,
        title: 'No Posts Published Yet',
        desc: 'Thoughts, visual creations, and updates will appear here once published.',
        cta: isOwner ? 'Create Post' : null,
        action: () => navigate('/home'),
      },
      reels: {
        icon: Film,
        title: 'No Reels Shared Yet',
        desc: 'Vertical 9:16 video reels and short clips will be featured here.',
        cta: isOwner ? 'Explore Reels' : null,
        action: () => navigate('/reels'),
      },
      audio: {
        icon: Music,
        title: 'No Audio Studio Tracks Yet',
        desc: 'Mastered music tracks and sound recordings created in Audio Studio appear here.',
        cta: isOwner ? 'Launch Audio Studio' : null,
        action: () => navigate('/audio-editor'),
      },
      saved: {
        icon: Bookmark,
        title: 'No Saved Bookmarks Yet',
        desc: 'Posts, reels, and audio tracks you bookmark will be stored here privately.',
        cta: isOwner ? 'Discover Feed' : null,
        action: () => navigate('/home'),
      },
      tagged: {
        icon: Tag,
        title: 'No Tagged Creations',
        desc: 'Posts and reels where this citizen is mentioned will be curated here.',
        cta: null,
        action: null,
      },
    };

    const currentEmpty = emptyStates[activeTab] || emptyStates.posts;
    const EmptyIcon = currentEmpty.icon;

    return (
      <div className={cn(
        "py-16 px-4 text-center rounded-2xl border space-y-4 my-2 w-full",
        isDark ? "bg-[#0B0F19]/60 border-slate-800/80 text-white" : "bg-white/60 border-slate-200/80 text-slate-900"
      )}>
        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
          <EmptyIcon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold">{currentEmpty.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {currentEmpty.desc}
          </p>
        </div>
        {currentEmpty.cta && (
          <div className="pt-2">
            <button
              type="button"
              onClick={currentEmpty.action}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#8B1EF3] to-[#4431F7] text-white shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            >
              <span>{currentEmpty.cta}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------- */
  /* TAB: AUDIO TRACKS VIEW                               */
  /* ---------------------------------------------------- */
  if (activeTab === 'audio') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
        {displayItems.map((item, idx) => {
          const isPlaying = playingAudioId === item.id;
          const trackTitle = item.title || item.name || 'Untitled Audio Track';
          const duration = item.duration || '2:45';
          const bpm = item.bpm || 120;
          const genre = item.genre || 'Electronic';

          return (
            <div
              key={item.id || idx}
              onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
              className={cn(
                "rounded-2xl p-4 border transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 shadow-sm",
                isDark 
                  ? "bg-[#0B0F19] border-slate-800 hover:border-indigo-500/50 hover:bg-[#0E1426]" 
                  : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Play Button & Vinyl Disc */}
                <button
                  type="button"
                  onClick={(e) => handleToggleAudio(e, item.id)}
                  aria-label={isPlaying ? "Pause track" : "Play track"}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all",
                    isPlaying
                      ? "bg-gradient-to-tr from-pink-500 to-indigo-600 text-white animate-pulse"
                      : "bg-indigo-600 text-white group-hover:scale-105"
                  )}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>

                {/* Track Details */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                    {trackTitle}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{genre}</span>
                    <span>·</span>
                    <span>{bpm} BPM</span>
                    <span>·</span>
                    <span>{duration}</span>
                  </div>
                </div>

                {/* Open in Audio Studio Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/audio-editor', { state: { trackId: item.id, title: trackTitle } });
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Open in Audio Studio"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>

              {/* Animated Waveform Visualization */}
              <div className="flex items-end gap-1 h-8 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden">
                {[40, 65, 85, 30, 95, 70, 50, 80, 45, 90, 60, 35, 75, 100, 55, 80, 45, 60, 75, 90, 40].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex-1 rounded-full transition-all duration-300",
                      isPlaying
                        ? "bg-gradient-to-t from-indigo-500 to-pink-500 animate-pulse"
                        : (isDark ? "bg-slate-700" : "bg-slate-300")
                    )}
                    style={{
                      height: isPlaying ? `${Math.max(20, (h * ((i % 3) + 1)) % 100)}%` : `${h * 0.6}%`,
                    }}
                  />
                ))}
              </div>

              {/* Track Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleQuickLike(e, item.id)}
                    className={cn(
                      "flex items-center gap-1 hover:text-rose-500 transition-colors",
                      likedPosts[item.id] && "text-rose-500"
                    )}
                  >
                    <Heart className={cn("w-3.5 h-3.5", likedPosts[item.id] && "fill-rose-500")} />
                    <span>{(item.likes || 0) + (likedPosts[item.id] ? 1 : 0)}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{item.comments || 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleQuickBookmark(e, item.id)}
                    className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Bookmark className={cn("w-3.5 h-3.5", savedMap[item.id] && "fill-indigo-500 text-indigo-500")} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleQuickShare(e, item)}
                    className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 1: GRID VIEW                                    */
  /* ---------------------------------------------------- */
  if (viewMode === 'grid') {
    const isReelsTab = activeTab === 'reels';

    return (
      <div className={cn(
        "grid gap-2.5 sm:gap-3.5 w-full",
        isReelsTab 
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" 
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
      )}>
        {displayItems.map((item, idx) => {
          const isVid = item.type === 'video' || item.type === 'reel' || Boolean(item.duration);
          const isReel = isReelsTab || item.type === 'reel';
          const mediaUrl = item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image;

          return (
            <div
              key={item.id || idx}
              onClick={() => onPostClick?.(item) || (isReel ? navigate(`/reels?reelId=${item.id}`) : navigate(`/post/${item.id}`))}
              className={cn(
                "group relative rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-sm bg-slate-900 transition-all hover:scale-[1.02]",
                isReel ? "aspect-[9/16]" : "aspect-square"
              )}
            >
              {mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={item.title || item.caption || item.text || 'Media item'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-purple-900/40 via-indigo-950/40 to-slate-900 border border-white/5">
                  <span className="text-[11px] font-semibold text-slate-200 line-clamp-4 leading-relaxed">
                    {item.content || item.caption || item.text || item.title || 'Post'}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="capitalize">{item.type || 'post'}</span>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                </div>
              )}

              {isVid && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold">
                  {isReel ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                  <span>{item.duration || '1:15'}</span>
                </div>
              )}

              {/* Tag indicator on tagged tab */}
              {activeTab === 'tagged' && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-indigo-600/80 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold">
                  <Tag className="w-3 h-3" />
                  <span>Tagged</span>
                </div>
              )}

              {/* Hover Overlay with Stats */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Heart className="w-4 h-4 fill-white text-white" />
                  <span>{(item.likes || item.likesCount || 0) + (likedPosts[item.id] ? 1 : 0)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <MessageCircle className="w-4 h-4 fill-white text-white" />
                  <span>{item.comments || item.commentsCount || 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 2: MASONRY VIEW                                 */
  /* ---------------------------------------------------- */
  if (viewMode === 'masonry') {
    return (
      <div className="columns-1 sm:columns-2 lg:columns-2 xl:columns-3 gap-4 space-y-4 w-full">
        {displayItems.map((item, idx) => {
          const isVid = item.type === 'video' || item.type === 'reel';
          const mediaUrl = item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image;
          const isLiked = Boolean(likedPosts[item.id]);

          return (
            <div
              key={item.id || idx}
              onClick={() => onPostClick?.(item) || (item.type === 'reel' ? navigate(`/reels?reelId=${item.id}`) : navigate(`/post/${item.id}`))}
              className={cn(
                "break-inside-avoid rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 hover:shadow-lg group",
                isDark ? "bg-[#0B0F19] border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              {mediaUrl && (
                <div className="relative overflow-hidden bg-slate-900">
                  <img
                    src={mediaUrl}
                    alt={item.title || item.caption || item.text || 'Media'}
                    className="w-full object-cover max-h-96 group-hover:scale-102 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {isVid && (
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold">
                      <Play className="w-3 h-3 fill-white" />
                      <span>{item.duration || 'Video'}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3.5 space-y-2.5">
                {(item.content || item.caption || item.text) && (
                  <p className={cn(
                    "text-xs leading-relaxed line-clamp-3",
                    isDark ? "text-slate-200" : "text-slate-800"
                  )}>
                    {item.content || item.caption || item.text}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleQuickLike(e, item.id)}
                      className={cn(
                        "flex items-center gap-1 hover:text-rose-500 transition-colors",
                        isLiked && "text-rose-500"
                      )}
                    >
                      <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-rose-500")} />
                      <span>{(item.likes || item.likesCount || 0) + (isLiked ? 1 : 0)}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{item.comments || item.commentsCount || 0}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleQuickShare(e, item)}
                    className="p-1 rounded hover:bg-slate-500/10 transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 3: FULL FEED VIEW                               */
  /* ---------------------------------------------------- */
  return (
    <div className="space-y-5 w-full">
      {displayItems.map((item, idx) => {
        const isVid = item.type === 'video' || item.type === 'reel';
        const mediaUrl = item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image;
        const isLiked = Boolean(likedPosts[item.id]);
        const authorName = profile?.displayName || item.authorName || 'Citizen';
        const authorAvatar = profile?.photoURL || item.authorAvatar;
        const handle = profile?.username ? `@${profile.username}` : '';

        return (
          <div
            key={item.id || idx}
            onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
            className={cn(
              "rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer",
              isDark ? "bg-[#0B0F19] border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
            )}
          >
            {/* Header: Author Info */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/10 shrink-0">
                  {authorAvatar ? (
                    <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-sm text-purple-400">
                      {authorName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {authorName}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{handle}</span>
                    {item.createdAt && (
                      <>
                        <span>·</span>
                        <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {profile?.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                )}
              </div>
            </div>

            {/* Post Text Caption */}
            {(item.content || item.caption || item.text) && (
              <div className="px-4 pb-3">
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {item.content || item.caption || item.text}
                </p>
              </div>
            )}

            {/* Media Body */}
            {mediaUrl && (
              <div className="relative w-full bg-black max-h-[520px] overflow-hidden flex items-center justify-center">
                <img
                  src={mediaUrl}
                  alt={item.title || 'Post media'}
                  className="w-full max-h-[520px] object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {isVid && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-lg">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Actions */}
            <div className="p-4 flex items-center justify-between border-t border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={(e) => handleQuickLike(e, item.id)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold hover:text-rose-500 transition-colors",
                    isLiked && "text-rose-500"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isLiked && "fill-rose-500")} />
                  <span>{(item.likes || item.likesCount || 0) + (isLiked ? 1 : 0)}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <MessageCircle className="w-4 h-4" />
                  <span>{item.comments || item.commentsCount || 0}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {onOpenTipModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTipModal();
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                    title="Tip creator"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Tip</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => handleQuickBookmark(e, item.id)}
                  className={cn(
                    "p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors",
                    savedMap[item.id] ? "text-indigo-500" : "text-slate-400"
                  )}
                  title={savedMap[item.id] ? "Remove from saved" : "Bookmark post"}
                >
                  <Bookmark className={cn("w-4 h-4", savedMap[item.id] && "fill-indigo-500")} />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleQuickShare(e, item)}
                  className="p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors"
                  title="Share post"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

ProfileFeedGrid.displayName = 'ProfileFeedGrid';

export default ProfileFeedGrid;
