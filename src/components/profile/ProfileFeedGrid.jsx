// src/components/profile/ProfileFeedGrid.jsx

import React, { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Heart, MessageCircle, Play, Pause, Film, Image as ImageIcon, Bookmark, Share2, Sparkles, Layers, MapPin, Globe, Calendar, Coins, ShieldCheck, Music, Tag, Sliders, Loader2 } from "lucide-react";
import { cn } from '../../lib/utils';
import { getPerksForLevel } from '../../services/levelSystemService';
import { pickDisplayName, resolveAvatarUrl } from '../../services/profileReadModel.js';
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
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.uid || null;
  const isDark = theme === 'dark';
  const [likedPosts, setLikedPosts] = useState({});
  const [savedMap, setSavedMap] = useState({});
  // The server's reported like state per post. The displayed count must be
  // `serverCount + (viewerLiked - serverLiked)`: the server count already
  // includes the viewer's own like, so adding +1 for a pre-liked post
  // double-counted it. Only a like that flips this session moves the number.
  const [likeBaseline, setLikeBaseline] = useState({});
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioElRef = useRef(null);
  // Ids the viewer has toggled this session. The server flag in `posts` is a
  // snapshot that can lag (or simply not change on a mocked/local write), so it
  // must never clobber a like the viewer just made.
  const touchedLikesRef = useRef(new Set());

  // Seed like/save state from the real posts (and the viewer's own liked/saved
  // snapshots) instead of assuming nothing is liked. `likedPosts` is only an
  // overlay for the current session, so it never invents a like the server did
  // not record. Keyed on a content signature because the `posts`/`savedPosts`
  // arrays are new identities every render (default `[]` props included) and an
  // identity-keyed effect would re-run forever and revert session likes.
  const seedSignature = useMemo(() => {
    const likeSig = (posts || []).map((p) => `${p?.id}:${p?.isLiked || p?.likedByMe || p?.hasLiked ? 1 : 0}`).join(',');
    const savedSig = (savedPosts || []).map((p) => p?.id).join(',');
    return `${likeSig}|${savedSig}`;
  }, [posts, savedPosts]);

  useEffect(() => {
    const liked = {};
    const baseline = {};
    for (const post of [...(posts || []), ...(savedPosts || [])]) {
      if (!post || !post.id) continue;
      const serverLiked = Boolean(post.isLiked || post.likedByMe || post.hasLiked);
      baseline[post.id] = serverLiked;
      if (serverLiked && !touchedLikesRef.current.has(post.id)) liked[post.id] = true;
    }
    setLikeBaseline((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, value] of Object.entries(baseline)) {
        if (next[id] !== value) { next[id] = value; changed = true; }
      }
      return changed ? next : prev;
    });
    setLikedPosts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, value] of Object.entries(liked)) {
        if (!next[id]) { next[id] = value; changed = true; }
      }
      return changed ? next : prev;
    });
    // Every entry in `savedPosts` is, by definition, saved by the viewer.
    const saved = {};
    for (const post of savedPosts || []) {
      if (post?.id) saved[post.id] = true;
    }
    setSavedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, value] of Object.entries(saved)) {
        if (!next[id]) { next[id] = value; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [seedSignature]);


  const handleQuickLike = useCallback(async (e, post) => {
    e.stopPropagation();
    const postId = typeof post === 'string' ? post : post?.id;
    if (!postId) return;
    // Identity comes from the live session only; a stale uid can belong to a
    // previous account on a shared device.
    if (!currentUserId) {
      toast.error('Please sign in to like posts');
      return;
    }
    const currentlyLiked = Boolean(likedPosts[postId]);
    const nextLiked = !currentlyLiked;
    // Optimistic overlay first, then the real write; roll back on failure so a
    // failed like never looks successful.
    touchedLikesRef.current.add(postId);
    setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));
    try {
      const { firestoreService } = await import('../../services/firestoreService.js');
      const res = nextLiked
        ? await firestoreService.likePost(postId, currentUserId)
        : await firestoreService.unlikePost(postId, currentUserId);
      if (res && res.success === false) {
        throw new Error(res.error || 'Could not update like');
      }
    } catch {
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
      toast.error('Could not update like');
    }
  }, [currentUserId, likedPosts]);

  const handleQuickBookmark = useCallback(async (e, post) => {
    e.stopPropagation();
    const postId = typeof post === 'string' ? post : post?.id;
    if (!postId) return;
    if (!currentUserId) {
      toast.error('Please sign in to save posts');
      return;
    }
    const currentlySaved = Boolean(savedMap[postId]);
    const nextSaved = !currentlySaved;
    setSavedMap((prev) => ({ ...prev, [postId]: nextSaved }));
    try {
      const { firestoreService } = await import('../../services/firestoreService.js');
      const res = nextSaved
        ? await firestoreService.savePost(postId, currentUserId)
        : await firestoreService.unsavePost(postId, currentUserId);
      if (res && res.success === false) {
        throw new Error(res.error || 'Could not update saved post');
      }
      toast.success(nextSaved ? 'Post saved' : 'Post removed from saved');
    } catch {
      setSavedMap((prev) => ({ ...prev, [postId]: currentlySaved }));
      toast.error('Could not update saved post');
    }
  }, [currentUserId, savedMap]);

  // Displayed like count = server count + (session like state - server baseline).
  // The server count already contains the viewer's like, so a post that arrived
  // pre-liked shows no change; a like toggled this session moves it by one.
  const likeCount = useCallback((item) => {
    const base = Number(item?.likes ?? item?.likesCount ?? 0);
    const serverLiked = Boolean(likeBaseline[item?.id]);
    const viewerLiked = Boolean(likedPosts[item?.id]);
    return base + (viewerLiked ? 1 : 0) - (serverLiked ? 1 : 0);
  }, [likeBaseline, likedPosts]);

  const handleQuickShare = useCallback(async (e, post) => {
    e.stopPropagation();
    const postId = typeof post === 'string' ? post : post?.id;
    if (!postId) return;
    const url = `${window.location.origin}/post/${postId}`;
    // Fire the real share counter for the signed-in viewer; the share itself is
    // best-effort UI, the count is the side effect that must reach the server.
    if (currentUserId && postId) {
      import('../../services/firestoreService.js')
        .then(({ firestoreService }) => firestoreService.sharePost(postId, currentUserId))
        .catch(() => {});
    }
    if (navigator.share) {
      navigator.share({
        title: post?.title || 'Arvdoul Post',
        text: post?.content || post?.caption || '',
        url,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('Post link copied to clipboard');
    }
  }, [currentUserId]);

  // Play/pause a real track. Without a media element the button only toggled an
  // icon, so the "player" never produced sound; the source is the post's stored
  // audio URL (no fallback — a track with no URL cannot be played).
  const handleToggleAudio = useCallback((e, item) => {
    e.stopPropagation();
    const src = item?.audioURL || item?.audioUrl || item?.soundUrl;
    if (!src) {
      toast.error('This track has no audio file attached.');
      return;
    }
    const el = audioElRef.current;
    if (!el) return;
    if (playingAudioId === item.id) {
      el.pause();
      setPlayingAudioId(null);
      return;
    }
    if (el.src !== src) el.src = src;
    el.play().then(() => setPlayingAudioId(item.id)).catch(() => {
      setPlayingAudioId(null);
      toast.error('Could not play this track.');
    });
  }, [playingAudioId]);

  // Shown under every paginated grid (posts/reels/videos/photos/audio/tagged).
  // Without it the profile feed silently truncated at the first page.
  const paginationFooter = (onLoadMore && (hasMore || loadingMore)) ? (
    <div className="w-full flex justify-center py-5">
      <button
        type="button"
        onClick={() => onLoadMore?.()}
        disabled={loadingMore}
        className={cn(
          'inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl border transition-all active:scale-95 disabled:opacity-60 disabled:cursor-wait',
          isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
        )}
      >
        {loadingMore ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading…</span>
          </>
        ) : (
          <span>Load more</span>
        )}
      </button>
    </div>
  ) : null;

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
  } else if (activeTab === 'videos') {
    displayItems = displayItems.filter(p => 
      p.type === 'video' || 
      p.type === 'reel' || 
      Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video')
    );
  } else if (activeTab === 'photos') {
    displayItems = displayItems.filter(p => 
      p.type === 'image' || 
      p.type === 'photo' || 
      Boolean(p.mediaURL || p.imageUrl || p.photoURL || p.coverImage)
    );
  } else if (activeTab === 'stories') {
    displayItems = displayItems.filter(p => 
      p.type === 'story' || 
      p.isStory || 
      p.isVibe
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
        title: 'No Posts Yet',
        desc: 'Published creations and updates will appear here.',
        cta: isOwner ? 'Create Post' : null,
        action: () => navigate('/create-post'),
      },
      videos: {
        icon: Film,
        title: 'No Videos Yet',
        desc: 'Full-length videos and project clips will be featured here.',
        cta: isOwner ? 'Upload Video' : null,
        action: () => navigate('/create-post'),
      },
      photos: {
        icon: ImageIcon,
        title: 'No Photos Yet',
        desc: 'High-resolution photography and visual artworks appear here.',
        cta: isOwner ? 'Share Photo' : null,
        action: () => navigate('/create-post'),
      },
      stories: {
        icon: Sparkles,
        title: 'No Stories Yet',
        desc: 'Moments and daily vibe stories will appear here.',
        cta: isOwner ? 'Post Story' : null,
        action: () => navigate('/create-story'),
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
      <>
      {/* Single hidden media element drives every track (only one plays at a
          time). It is required for the play/pause button to actually produce
          sound; the card previously toggled an icon with no audio source. */}
      <audio
        ref={audioElRef}
        onEnded={() => setPlayingAudioId(null)}
        onPause={() => setPlayingAudioId(null)}
        className="hidden"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
        {displayItems.map((item, idx) => {
          const isPlaying = playingAudioId === item.id;
          const trackTitle = item.title || item.name || 'Untitled Audio Track';
          // Only render metadata that is actually stored; inventing a duration,
          // BPM or genre made an arbitrary post look like a mastered track.
          const duration = item.duration || null;
          const bpm = item.bpm || null;
          const genre = item.genre || null;
          const waveform = Array.isArray(item.waveform) && item.waveform.length
            ? item.waveform
            : null;
          const hasAudio = Boolean(item.audioURL || item.audioUrl || item.soundUrl);

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
                  onClick={(e) => handleToggleAudio(e, item)}
                  disabled={!hasAudio}
                  aria-label={isPlaying ? "Pause track" : "Play track"}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all",
                    !hasAudio && "opacity-40 cursor-not-allowed",
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
                    {[genre, bpm ? `${bpm} BPM` : null, duration].filter(Boolean).length > 0 ? (
                      [genre, bpm ? `${bpm} BPM` : null, duration]
                        .filter(Boolean)
                        .map((part, i) => (
                          <React.Fragment key={part}>
                            {i > 0 && <span>·</span>}
                            <span>{part}</span>
                          </React.Fragment>
                        ))
                    ) : (
                      <span>{hasAudio ? 'Audio track' : 'No audio attached'}</span>
                    )}
                  </div>
                </div>

                {/* Open in Audio Studio Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/audio-editor', { state: { audioUrl: item.audioURL || item.audioUrl || item.soundUrl || '', trackId: item.id, title: trackTitle } });
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Open in Audio Studio"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>

              {/* Waveform: the stored bars when the track has them, otherwise a
                  flat idle line. A hardcoded decorative pattern made every track
                  look like it had real waveform data. */}
              <div className="flex items-end gap-1 h-8 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden">
                {(waveform || new Array(21).fill(12)).map((h, i) => {
                  const value = Number(h) || 0;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "flex-1 rounded-full transition-all duration-300",
                        isPlaying
                          ? "bg-gradient-to-t from-indigo-500 to-pink-500 animate-pulse"
                          : (isDark ? "bg-slate-700" : "bg-slate-300")
                      )}
                      style={{ height: `${Math.max(4, Math.min(100, value))}%` }}
                    />
                  );
                })}
              </div>

              {/* Track Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid={`like-button-${item.id}`}
                    onClick={(e) => handleQuickLike(e, item)}
                    className={cn(
                      "flex items-center gap-1 hover:text-rose-500 transition-colors",
                      likedPosts[item.id] && "text-rose-500"
                    )}
                  >
                    <Heart className={cn("w-3.5 h-3.5", likedPosts[item.id] && "fill-rose-500")} />
                    <span data-testid={`like-count-${item.id}`}>{likeCount(item)}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{item.comments || 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleQuickBookmark(e, item)}
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
      {paginationFooter}
      </>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 1: GRID VIEW                                    */
  /* ---------------------------------------------------- */
  if (viewMode === 'grid') {
    const isReelsTab = activeTab === 'reels';

    return (
      <>
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

              {/* Hover Overlay with Stats & Quick Actions */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 text-white">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Heart className="w-4 h-4 fill-white text-white" />
                    <span>{likeCount(item)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <MessageCircle className="w-4 h-4 fill-white text-white" />
                    <span>{item.comments || item.commentsCount || 0}</span>
                  </div>
                </div>

                {onOpenTipModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTipModal();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold border border-amber-400/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tip</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {paginationFooter}
      </>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 2: MASONRY VIEW                                 */
  /* ---------------------------------------------------- */
  if (viewMode === 'masonry') {
    return (
      <>
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
                      data-testid={`like-button-${item.id}`}
                      aria-pressed={isLiked}
                      onClick={(e) => handleQuickLike(e, item)}
                      className={cn(
                        "flex items-center gap-1 hover:text-rose-500 transition-colors",
                        isLiked && "text-rose-500"
                      )}
                    >
                      <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-rose-500")} />
                      <span data-testid={`like-count-${item.id}`}>{likeCount(item)}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{item.comments || item.commentsCount || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenTipModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTipModal();
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                        title="Tip creator"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Tip</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleQuickBookmark(e, item)}
                      className={cn(
                        "p-1 rounded hover:bg-slate-500/10 transition-colors",
                        savedMap[item.id] ? "text-indigo-500" : "text-slate-400"
                      )}
                      title={savedMap[item.id] ? "Remove bookmark" : "Bookmark post"}
                    >
                      <Bookmark className={cn("w-3.5 h-3.5", savedMap[item.id] && "fill-indigo-500")} />
                    </button>

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
            </div>
          );
        })}
      </div>
      {paginationFooter}
      </>
    );
  }

  /* ---------------------------------------------------- */
  /* MODE 3: FULL FEED VIEW                               */
  /* ---------------------------------------------------- */
  return (
    <>
    <div className="space-y-5 w-full">
      {displayItems.map((item, idx) => {
        const isVid = item.type === 'video' || item.type === 'reel';
        const mediaUrl = item.mediaURL || item.thumbnailUrl || item.mediaUrl || item.coverImage || item.image;
        const isLiked = Boolean(likedPosts[item.id]);
        const authorName = pickDisplayName([profile?.displayName, item.authorName], { fallback: 'Creator' });
        const authorAvatar = resolveAvatarUrl(profile?.photoURL || item.authorAvatar, authorName, profile?.id || profile?.uid || item.authorId);
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
                  onClick={(e) => handleQuickLike(e, item)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold hover:text-rose-500 transition-colors",
                    isLiked && "text-rose-500"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isLiked && "fill-rose-500")} />
                  <span>{likeCount(item)}</span>
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
                  onClick={(e) => handleQuickBookmark(e, item)}
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
    {paginationFooter}
    </>
  );
});

ProfileFeedGrid.displayName = 'ProfileFeedGrid';

export default ProfileFeedGrid;
