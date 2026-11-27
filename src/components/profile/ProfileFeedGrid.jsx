// src/components/profile/ProfileFeedGrid.jsx

import React, { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Heart, MessageCircle, Play, Pause, Film, Image as ImageIcon, Bookmark, Share2, Sparkles, Layers, MapPin, Globe, Calendar, Coins, ShieldCheck, Music, Tag, Sliders, Loader2, BarChart2, Link2, Repeat2 } from "lucide-react";
import { cn } from '../../lib/utils';
import { getPerksForLevel } from '../../services/levelSystemService';
import { pickDisplayName, pickHandle, resolveAvatarUrl } from '../../services/profileReadModel.js';
import { sanitizeProfileUrl } from '../../config/profileContracts.js';
import { toast } from 'sonner';
import ProfileCitizenshipCard from './ProfileCitizenshipCard';
import { LazyImage } from '../../components/Shared/LazyImage';

function resolvePrimaryMediaUrl(item) {
  if (!item) return null;
  if (Array.isArray(item.media) && item.media.length > 0) {
    const first = item.media[0];
    if (typeof first === 'string' && first) return first;
    if (first && typeof first === 'object') {
      const m = first.url || first.mediaURL || first.mediaUrl || first.thumbnailUrl || first.src;
      if (m) return m;
    }
  }
  return (
    item.mediaURL ||
    item.thumbnailUrl ||
    item.mediaUrl ||
    item.imageUrl ||
    item.photoURL ||
    item.coverImage ||
    item.image ||
    null
  );
}

function getMediaCount(item) {
  if (!item) return 0;
  if (Array.isArray(item.media) && item.media.length > 0) return item.media.length;
  return resolvePrimaryMediaUrl(item) ? 1 : 0;
}

function formatSafeDate(raw, options) {
  if (!raw) return null;
  try {
    let d;
    if (typeof raw?.toDate === 'function') d = raw.toDate();
    else if (typeof raw?.seconds === 'number') d = new Date(raw.seconds * 1000);
    else d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, options);
  } catch {
    return null;
  }
}

const ProfileFeedGrid = memo(({
  posts = [],
  savedPosts = [],
  stories = [],
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
  // Ids the viewer has toggled this session. The server snapshot can lag (or a
  // mocked/local write may not change it), so it must never clobber a like the
  // viewer just made.
  const touchedLikesRef = useRef(new Set());
  const touchedSavesRef = useRef(new Set());

  useEffect(() => {
    touchedLikesRef.current = new Set();
    touchedSavesRef.current = new Set();
    setLikedPosts({});
    setSavedMap({});
    setLikeBaseline({});
  }, [currentUserId]);

  // Seed like/save state from the real posts (and the viewer's own liked/saved
  // snapshots) instead of assuming nothing is liked. `likedPosts` is only an
  // overlay for the current session, so it never invents a like the server did
  // not record. Keyed on a content signature because the `posts`/`savedPosts`
  // arrays are new identities every render (default `[]` props included) and an
  // identity-keyed effect would re-run forever and revert session likes.
  const seedSignature = useMemo(() => {
    const likeSig = (posts || []).map((p) => `${p?.id}`).join(',');
    const savedSig = (savedPosts || []).map((p) => p?.id).join(',');
    return `${likeSig}|${savedSig}`;
  }, [posts, savedPosts]);

  // The viewer's real like state for the visible posts. No writer ever sets a
  // post-level `isLiked`/`likedByMe`/`hasLiked` flag, so the truth is the
  // viewer's own `users/{uid}/liked_posts` subcollection — resolved in one
  // bounded `documentId() in` read for the whole grid.
  const [serverLikedIds, setServerLikedIds] = useState(() => new Set());
  const [serverSavedIds, setServerSavedIds] = useState(() => new Set());
  useEffect(() => {
    const ids = [...new Set([...(posts || []), ...(savedPosts || [])].map((p) => p?.id).filter(Boolean))];
    if (!currentUserId || ids.length === 0) {
      setServerLikedIds(new Set());
      setServerSavedIds(new Set());
      return undefined;
    }
    let cancelled = false;
    import('../../services/firestoreService.js')
      .then(async ({ firestoreService }) => {
        const [likedSet, savedSet] = await Promise.all([
          firestoreService.getLikedPostIds?.(currentUserId, ids) ?? Promise.resolve(new Set()),
          firestoreService.getSavedPostIds?.(currentUserId, ids) ?? Promise.resolve(new Set()),
        ]);
        if (!cancelled) {
          if (likedSet) setServerLikedIds(likedSet);
          if (savedSet) setServerSavedIds(savedSet);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUserId, seedSignature]);

  useEffect(() => {
    const liked = {};
    const baseline = {};
    for (const post of [...(posts || []), ...(savedPosts || [])]) {
      if (!post || !post.id) continue;
      const serverLiked = serverLikedIds.has(post.id);
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
    // Every entry in `savedPosts` or returned by `getSavedPostIds` is saved by the viewer.
    const saved = {};
    for (const post of savedPosts || []) {
      if (post?.id && !touchedSavesRef.current.has(post.id)) saved[post.id] = true;
    }
    for (const post of posts || []) {
      if (post?.id && serverSavedIds.has(post.id) && !touchedSavesRef.current.has(post.id)) {
        saved[post.id] = true;
      }
    }
    setSavedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, value] of Object.entries(saved)) {
        if (!next[id]) { next[id] = value; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [seedSignature, serverLikedIds, serverSavedIds]);


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
      if (!(res && res.alreadyLiked)) {
        import('../../store/profileStore.js')
          .then(({ useProfileStore }) => useProfileStore.getState().adjustPostLikes?.(postId, nextLiked ? 1 : -1))
          .catch(() => {});
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
    touchedSavesRef.current.add(postId);
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
  // An absent server count stays unknown (rendered '—'); only a real number is
  // shifted by the session's like delta.
  const likeCount = useCallback((item) => {
    const raw = item?.likes ?? item?.stats?.likes ?? item?.likesCount;
    const base = raw === null || raw === undefined ? null : Number(raw);
    if (base === null || Number.isNaN(base)) return '—';
    const serverLiked = Boolean(likeBaseline[item?.id]);
    const viewerLiked = Boolean(likedPosts[item?.id]);
    return Math.max(0, base + (viewerLiked ? 1 : 0) - (serverLiked ? 1 : 0));
  }, [likeBaseline, likedPosts]);
  const commentCount = useCallback((item) => {
    const raw = item?.comments ?? item?.commentsCount;
    return raw === null || raw === undefined || Number.isNaN(Number(raw)) ? '—' : Number(raw);
  }, []);

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
        .catch((e) => console.warn('[ProfileFeed] share not recorded', e?.message));
    }
    if (navigator.share) {
      navigator.share({
        title: post?.title || 'Arvdoul Post',
        text: post?.content || post?.caption || '',
        url,
      }).catch(() => {
        /* the user dismissed the native share sheet */
      });
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

  // Pause audio when leaving the audio tab or unmounting the grid
  useEffect(() => {
    if (activeTab !== 'audio' && audioElRef.current) {
      audioElRef.current.pause();
      setPlayingAudioId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const audioEl = audioElRef.current;
    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
      }
    };
  }, []);

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
          viewerId={currentUserId}
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
        "w-full rounded-2xl p-5 sm:p-7 border backdrop-blur-xl transition-colors space-y-6",
        isDark ? "bg-white/[0.025] border-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
      )}>
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold mb-2 tracking-tight">About Citizen</h3>
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
                  {profile?.website ? (() => {
                    const safeHref = sanitizeProfileUrl(profile.website);
                    return safeHref ? (
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-500 hover:underline"
                      >
                        {profile.website}
                      </a>
                    ) : (
                      <span>{profile.website}</span>
                    );
                  })() : (
                    'Not specified'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Citizen Since:{' '}
                  {formatSafeDate(profile?.createdAt, { year: 'numeric', month: 'long' }) || 'Not available'}
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
      p.type === 'spark' ||
      Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video') ||
      (Array.isArray(p.media) && p.media.some((m) => m?.type === 'video'))
    );
  } else if (activeTab === 'photos') {
    displayItems = displayItems.filter(p => {
      const isVibe = p.type === 'story' || p.type === 'vibe' || p.isStory || p.isVibe;
      if (isVibe) return false;
      const isVideoOrAudio =
        p.type === 'video' ||
        p.type === 'reel' ||
        p.type === 'spark' ||
        p.type === 'audio' ||
        p.type === 'track' ||
        p.type === 'music' ||
        Boolean(p.videoURL || p.videoUrl || p.audioURL || p.audioUrl || p.soundUrl || p.mediaType === 'video' || p.mediaType === 'audio');
      if (isVideoOrAudio) return false;
      return (
        p.type === 'image' ||
        p.type === 'photo' ||
        p.type === 'gallery' ||
        Boolean(resolvePrimaryMediaUrl(p))
      );
    });
  } else if (activeTab === 'stories') {
    const merged = [...(stories || []), ...displayItems.filter(p =>
      p.type === 'story' ||
      p.type === 'vibe' ||
      p.isStory ||
      p.isVibe
    )];
    const seen = new Set();
    displayItems = merged.filter((item) => {
      if (!item?.id) return true;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
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
    // Standard posts: exclude dedicated audio tracks and expired vibes to keep categories sharp
    displayItems = displayItems.filter(p => p.type !== 'audio' && p.type !== 'track' && p.type !== 'story' && p.type !== 'vibe');
  }

  // Loading skeleton before empty state so initial load never flashes "No Posts Yet"
  if (loading && displayItems.length === 0) {
    return (
      <div
        aria-label="Loading profile content"
        className={cn(
          "grid gap-2.5 sm:gap-3.5 w-full animate-pulse",
          activeTab === 'reels'
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            : activeTab === 'audio'
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4",
          "animate-pulse"
        )}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div
            key={n}
            className={cn(
              "rounded-[20px] sm:rounded-[24px] border backdrop-blur-xl",
              activeTab === 'reels' ? "aspect-[9/16]" : activeTab === 'audio' ? "h-36" : "aspect-square",
              isDark
                ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "bg-white/75 border-white/90 shadow-xs"
            )}
          />
        ))}
      </div>
    );
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
        title: 'No Vibes Yet',
        desc: 'Moments and daily Arvdoul Vibes will appear here.',
        cta: isOwner ? 'Post a Vibe' : null,
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
        "py-14 px-4 text-center rounded-[24px] border backdrop-blur-xl space-y-3.5 my-2 w-full",
        isDark ? "bg-white/[0.025] border-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white/65 border-white/90 text-slate-900 shadow-[0_8px_22px_rgba(38,56,120,0.06)]"
      )}>
        <div className="w-11 h-11 mx-auto rounded-2xl bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
          <EmptyIcon className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-display text-sm sm:text-base font-bold tracking-tight">{currentEmpty.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {currentEmpty.desc}
          </p>
        </div>
        {currentEmpty.cta && (
          <div className="pt-1">
            <button
              type="button"
              onClick={currentEmpty.action}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-arvdoul-gradient text-white shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
            <article
              key={item.id || idx}
              className={cn(
                "rounded-[22px] p-4 border backdrop-blur-xl transition-all duration-200 group flex flex-col justify-between gap-3",
                isDark
                  ? "bg-white/[0.025] border-white/[0.08] hover:border-arvdoul-purple/40 hover:bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "bg-white/75 border-white/90 hover:border-arvdoul-purple/40 shadow-[0_10px_26px_rgba(38,56,120,0.07)]"
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
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    !hasAudio && "opacity-40 cursor-not-allowed",
                    isPlaying
                      ? "bg-gradient-to-tr from-pink-500 to-indigo-600 text-white animate-pulse"
                      : "bg-indigo-600 text-white group-hover:scale-105 cursor-pointer"
                  )}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>

                {/* Track Details (opens post) */}
                <button
                  type="button"
                  onClick={() => (onPostClick ? onPostClick(item) : navigate(`/post/${item.id}`))}
                  className="min-w-0 flex-1 text-left cursor-pointer rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
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
                </button>

                {/* Open in Audio Studio Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/audio-editor', { state: { audioUrl: item.audioURL || item.audioUrl || item.soundUrl || '', trackId: item.id, title: trackTitle } });
                  }}
                  aria-label="Open in Audio Studio"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
                    aria-pressed={Boolean(likedPosts[item.id])}
                    aria-label={likedPosts[item.id] ? "Unlike track" : "Like track"}
                    onClick={(e) => handleQuickLike(e, item)}
                    className={cn(
                      "min-h-[36px] px-1.5 flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      likedPosts[item.id] && "text-rose-500"
                    )}
                  >
                    <Heart className={cn("w-3.5 h-3.5", likedPosts[item.id] && "fill-rose-500")} />
                    <span data-testid={`like-count-${item.id}`}>{likeCount(item)}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{commentCount(item)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleQuickBookmark(e, item)}
                    aria-label={savedMap[item.id] ? "Remove bookmark" : "Bookmark track"}
                    title={savedMap[item.id] ? "Remove bookmark" : "Bookmark track"}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  >
                    <Bookmark className={cn("w-3.5 h-3.5", savedMap[item.id] && "fill-indigo-500 text-indigo-500")} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleQuickShare(e, item)}
                    aria-label="Share track"
                    title="Share track"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
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
          const isVibe = activeTab === 'stories' || item.type === 'story' || item.type === 'vibe' || Boolean(item.isStory || item.isVibe);
          const isVid = item.type === 'video' || item.type === 'reel' || item.type === 'spark' || Boolean(item.duration || item.videoURL || item.videoUrl);
          const isReel = isReelsTab || item.type === 'reel' || item.type === 'spark';
          const isPoll = Boolean(item.poll?.options || item.type === 'poll');
          const isEvent = Boolean(item.eventDate || item.type === 'event');
          const isRepost = Boolean(item.repostedPost || item.quotedPost);
          const mediaUrl = resolvePrimaryMediaUrl(item);
          const mediaCount = getMediaCount(item);
          const formattedDate = formatSafeDate(item.createdAt, { month: 'short', day: 'numeric' });
          const openPost = () => {
            if (isVibe) {
              navigate(item.id ? `/stories?storyId=${item.id}` : '/stories');
              return;
            }
            if (onPostClick) {
              onPostClick(item);
              return;
            }
            if (item.type === 'reel' || item.subType === 'reel') {
              navigate(`/reels?reelId=${item.id}`);
              return;
            }
            navigate(isVid ? `/sparks/${item.id}` : `/post/${item.id}`);
          };

          return (
            <article
              key={item.id || idx}
              className={cn(
                "group relative rounded-[20px] sm:rounded-[24px] overflow-hidden border backdrop-blur-xl transition-all duration-300 hover:scale-[1.012] hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]",
                isDark ? "border-white/[0.08] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "border-white/90 bg-white/80",
                (isReel || isVibe) ? "aspect-[9/16]" : "aspect-square"
              )}
            >
              <button
                type="button"
                onClick={openPost}
                aria-label={item.title || item.caption || item.text || (isVibe ? 'Open Vibe' : 'Open post')}
                className="w-full h-full block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                {mediaUrl ? (
                  <LazyImage
                    src={mediaUrl}
                    alt={item.title || item.caption || item.text || 'Media item'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full flex flex-col justify-between p-4 text-left",
                    isDark
                      ? "bg-transparent text-slate-100"
                      : "bg-white text-slate-800"
                  )}>
                    <div className="space-y-1.5 min-w-0">
                      {isPoll && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                          <BarChart2 className="w-3 h-3" /> Poll
                        </span>
                      )}
                      {isEvent && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                          <Calendar className="w-3 h-3" /> Event
                        </span>
                      )}
                      {isRepost && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-500">
                          <Repeat2 className="w-3 h-3" /> Repost
                        </span>
                      )}
                      <span className="text-xs font-medium line-clamp-5 leading-relaxed block">
                        {item.content || item.caption || item.text || item.title || (isVibe ? 'Vibe' : 'Post')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2.5 sm:hidden tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {likeCount(item)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {commentCount(item)}
                        </span>
                      </div>
                      <span className="hidden sm:inline capitalize">{isVibe ? 'Vibe' : (item.type || 'post')}</span>
                      <span className="tabular-nums">{formattedDate || ''}</span>
                    </div>
                  </div>
                )}

                {isVid && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold pointer-events-none">
                    {isReel ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                    <span>{item.duration || (isReel ? 'Reel' : 'Video')}</span>
                  </div>
                )}

                {!isVid && mediaCount > 1 && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold pointer-events-none">
                    <Layers className="w-3 h-3" />
                    <span>{mediaCount}</span>
                  </div>
                )}

                {isVibe && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-md text-purple-200 flex items-center gap-1 text-[10px] font-bold pointer-events-none">
                    <Sparkles className="w-3 h-3" />
                    <span>Vibe</span>
                  </div>
                )}

                {/* Tag indicator on tagged tab */}
                {activeTab === 'tagged' && !isVibe && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-indigo-600/80 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold pointer-events-none">
                    <Tag className="w-3 h-3" />
                    <span>Tagged</span>
                  </div>
                )}

                {/* Engagement Overlay (non-interactive counters inside card button) */}
                <div
                  className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity flex flex-col text-white",
                    mediaUrl
                      ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-gradient-to-t from-black/80 via-transparent to-transparent sm:bg-none sm:bg-black/60 sm:backdrop-blur-[2px] justify-end sm:justify-center items-stretch sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-4"
                      : "opacity-0 group-hover:opacity-100 bg-black/60 backdrop-blur-[2px] justify-center items-center gap-3 p-4"
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold tabular-nums">
                      <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white text-white" />
                      <span>{likeCount(item)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold tabular-nums">
                      <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white text-white" />
                      <span>{commentCount(item)}</span>
                    </div>
                  </div>
                </div>
              </button>

              {onOpenTipModal && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTipModal();
                  }}
                  aria-label="Tip creator"
                  className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 text-[11px] font-semibold border border-amber-400/35 cursor-pointer active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span>Tip</span>
                </button>
              )}
            </article>
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
          const isVibe = activeTab === 'stories' || item.type === 'story' || item.type === 'vibe' || Boolean(item.isStory || item.isVibe);
          const isVid = item.type === 'video' || item.type === 'reel' || item.type === 'spark' || Boolean(item.videoURL || item.videoUrl);
          const mediaUrl = resolvePrimaryMediaUrl(item);
          const isLiked = Boolean(likedPosts[item.id]);
          const openPost = () => {
            if (isVibe) {
              navigate(item.id ? `/stories?storyId=${item.id}` : '/stories');
              return;
            }
            if (onPostClick) {
              onPostClick(item);
              return;
            }
            if (item.type === 'reel' || item.subType === 'reel') {
              navigate(`/reels?reelId=${item.id}`);
              return;
            }
            navigate(isVid ? `/sparks/${item.id}` : `/post/${item.id}`);
          };

          return (
            <article
              key={item.id || idx}
              className={cn(
                "break-inside-avoid rounded-[24px] overflow-hidden border backdrop-blur-xl transition-all duration-300 hover:shadow-lg group",
                isDark ? "bg-white/[0.025] border-white/[0.08] hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white/80 border-white/90 hover:border-indigo-200"
              )}
            >
              <button
                type="button"
                onClick={openPost}
                className="w-full text-left block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                {mediaUrl && (
                  <div className="relative overflow-hidden bg-slate-900">
                    <LazyImage
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

                {(item.content || item.caption || item.text) && (
                  <div className="px-3.5 pt-3.5 pb-2">
                    <p className={cn(
                      "text-xs leading-relaxed line-clamp-3",
                      isDark ? "text-slate-200" : "text-slate-800"
                    )}>
                      {item.content || item.caption || item.text}
                    </p>
                  </div>
                )}
              </button>

              <div className="px-3.5 pb-3 pt-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      data-testid={`like-button-${item.id}`}
                      aria-pressed={isLiked}
                      aria-label={isLiked ? "Unlike post" : "Like post"}
                      onClick={(e) => handleQuickLike(e, item)}
                      className={cn(
                        "min-h-[36px] px-1.5 flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        isLiked && "text-rose-500"
                      )}
                    >
                      <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-rose-500")} />
                      <span data-testid={`like-count-${item.id}`}>{likeCount(item)}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{commentCount(item)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {onOpenTipModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTipModal();
                        }}
                        className="min-h-[36px] px-2 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        title="Tip creator"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Tip</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleQuickBookmark(e, item)}
                      aria-label={savedMap[item.id] ? "Remove bookmark" : "Bookmark post"}
                      className={cn(
                        "min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        savedMap[item.id] ? "text-indigo-500" : "text-slate-400"
                      )}
                      title={savedMap[item.id] ? "Remove bookmark" : "Bookmark post"}
                    >
                      <Bookmark className={cn("w-3.5 h-3.5", savedMap[item.id] && "fill-indigo-500")} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickShare(e, item)}
                      aria-label="Share post"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
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
        const isVibe = activeTab === 'stories' || item.type === 'story' || item.type === 'vibe' || Boolean(item.isStory || item.isVibe);
        const isVid = item.type === 'video' || item.type === 'reel' || item.type === 'spark' || Boolean(item.videoURL || item.videoUrl);
        const mediaUrl = resolvePrimaryMediaUrl(item);
        const mediaCount = getMediaCount(item);
        const isLiked = Boolean(likedPosts[item.id]);
        const authorName = pickDisplayName([profile?.displayName, item.authorName], { fallback: null })
          || `user ${String(profile?.id || profile?.uid || item.authorId || '').slice(0, 6)}`;
        const authorHandle = pickHandle([profile?.username, item.authorHandle, item.authorUsername]);
        const authorAvatar = resolveAvatarUrl(profile?.photoURL || item.authorAvatar, authorName, profile?.id || profile?.uid || item.authorId);
        const formattedFeedDate = formatSafeDate(item.createdAt, { month: 'short', day: 'numeric' });
        const linkTarget = sanitizeProfileUrl(item.linkUrl || item.externalUrl);
        const pollOptions = Array.isArray(item.poll?.options) ? item.poll.options : (Array.isArray(item.options) ? item.options : null);
        const quote = item.repostedPost || item.quotedPost || null;
        const openPost = () => {
          if (isVibe) {
            navigate(item.id ? `/stories?storyId=${item.id}` : '/stories');
            return;
          }
          if (onPostClick) {
            onPostClick(item);
            return;
          }
          if (item.type === 'reel' || item.subType === 'reel') {
            navigate(`/reels?reelId=${item.id}`);
            return;
          }
          navigate(isVid ? `/sparks/${item.id}` : `/post/${item.id}`);
        };

        return (
          <article
            key={item.id || idx}
            className={cn(
              "rounded-[24px] border backdrop-blur-xl transition-all duration-300 overflow-hidden",
              isDark ? "bg-white/[0.025] border-white/[0.08] hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white/80 border-white/90 hover:border-indigo-200 shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
            )}
          >
            {/* Clickable Header + Body Button */}
            <button
              type="button"
              onClick={openPost}
              className="w-full text-left block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              {/* Header: Author Info */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/10 shrink-0">
                    {authorAvatar ? (
                      <LazyImage src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
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
                      {authorHandle && <span>@{authorHandle}</span>}
                      {authorHandle && formattedFeedDate && <span>·</span>}
                      {formattedFeedDate && <span>{formattedFeedDate}</span>}
                      {isVibe && (
                        <>
                          <span>·</span>
                          <span className="text-purple-400 font-semibold">Vibe</span>
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

              {/* Rich Post Metadata (Polls, Events, External Links, Reposts) */}
              {pollOptions && pollOptions.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {pollOptions.slice(0, 4).map((opt, optIdx) => (
                    <div
                      key={opt?.id || optIdx}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between",
                        isDark ? "bg-white/[0.04] border-white/10 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
                      )}
                    >
                      <span className="truncate">{typeof opt === 'string' ? opt : (opt?.text || opt?.label || `Option ${optIdx + 1}`)}</span>
                      {typeof opt?.votes === 'number' && (
                        <span className="tabular-nums text-[11px] opacity-70 ml-2">{opt.votes}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {item.eventDate && (
                <div className="px-4 pb-3">
                  <div className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2",
                    isDark ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  )}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.eventTitle || 'Scheduled Event'} · {formatSafeDate(item.eventDate, { month: 'short', day: 'numeric', year: 'numeric' }) || String(item.eventDate)}</span>
                  </div>
                </div>
              )}

              {linkTarget && (
                <div className="px-4 pb-3">
                  <div className={cn(
                    "px-3 py-2 rounded-xl border text-xs flex items-center gap-2 truncate",
                    isDark ? "bg-white/[0.04] border-white/10 text-indigo-300" : "bg-slate-50 border-slate-200 text-indigo-600"
                  )}>
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{linkTarget}</span>
                  </div>
                </div>
              )}

              {quote && (
                <div className="px-4 pb-3">
                  <div className={cn(
                    "p-3 rounded-xl border text-xs space-y-1",
                    isDark ? "bg-white/[0.03] border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                  )}>
                    <div className="flex items-center gap-1.5 font-semibold text-[11px] text-cyan-500">
                      <Repeat2 className="w-3.5 h-3.5" />
                      <span>{quote.authorName || 'Quoted Creation'}</span>
                    </div>
                    <p className="line-clamp-2">{quote.content || quote.caption || quote.text || 'Shared post'}</p>
                  </div>
                </div>
              )}

              {/* Media Body */}
              {mediaUrl && (
                <div className="relative w-full bg-black max-h-[520px] overflow-hidden flex items-center justify-center">
                  <LazyImage
                    src={mediaUrl}
                    alt={item.title || 'Post media'}
                    className="w-full max-h-[520px] object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {!isVid && mediaCount > 1 && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/65 text-white text-xs font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>1 / {mediaCount}</span>
                    </div>
                  )}
                  {isVid && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-lg">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </button>

            {/* Footer Actions */}
            <div className="p-4 flex items-center justify-between border-t border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  data-testid={`like-button-${item.id}`}
                  aria-pressed={isLiked}
                  aria-label={isLiked ? "Unlike post" : "Like post"}
                  onClick={(e) => handleQuickLike(e, item)}
                  className={cn(
                    "min-h-[36px] px-1.5 flex items-center gap-1.5 text-xs font-semibold hover:text-rose-500 transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isLiked && "text-rose-500"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isLiked && "fill-rose-500")} />
                  <span data-testid={`like-count-${item.id}`}>{likeCount(item)}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <MessageCircle className="w-4 h-4" />
                  <span>{commentCount(item)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenTipModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTipModal();
                    }}
                    className="min-h-[36px] px-2.5 flex items-center gap-1 rounded-lg text-xs font-semibold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                    title="Tip creator"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Tip</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => handleQuickBookmark(e, item)}
                  aria-label={savedMap[item.id] ? "Remove from saved" : "Bookmark post"}
                  className={cn(
                    "min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    savedMap[item.id] ? "text-indigo-500" : "text-slate-400"
                  )}
                  title={savedMap[item.id] ? "Remove from saved" : "Bookmark post"}
                >
                  <Bookmark className={cn("w-4 h-4", savedMap[item.id] && "fill-indigo-500")} />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleQuickShare(e, item)}
                  aria-label="Share post"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                  title="Share post"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
    {paginationFooter}
    </>
  );
});

ProfileFeedGrid.displayName = 'ProfileFeedGrid';

export default ProfileFeedGrid;
