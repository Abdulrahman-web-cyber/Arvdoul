// src/screens/VideoDetailScreen.jsx
//
// Loads a single Spark/Video by id (or url param), streams via Mux HLS (`useHlsVideo`),
// displays chapters, creator info, engagement rail, watch-next recommendations, and comments.
// Routes: /sparks/:videoId and /video/:videoId.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import videoService from '../services/videoService';
import useHlsVideo from '../hooks/useHlsVideo.js';
import VideoCreatorInfo from '../components/Videos/VideoCreatorInfo';
import VideoActionRail from '../components/Videos/VideoActionRail';
import VideoComments from '../components/Videos/VideoComments';
import VideoBottomSheet from '../components/Videos/VideoBottomSheet';
import VideoGiftModal from '../components/Videos/VideoGiftModal';
import { cn } from '../lib/utils';
import { formatDuration } from '../utils/videoUtils';
import { ArrowLeft, Volume2, VolumeX, Loader2, Play, Trash2, Clock } from 'lucide-react';
import { LazyImage } from '../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import {
  useSparkViewTracking,
  toggleSparkCreatorFollow,
  toggleSparkLike,
  toggleSparkSave,
  shareSpark,
} from '../hooks/useSparkInteractions.js';

export default function VideoDetailScreen() {
  const { videoId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';

  const [video, setVideo] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(null);
  const [saved, setSaved] = useState(false);
  const [followState, setFollowState] = useState({ isFollowing: false, requestStatus: null });
  const [followBusy, setFollowBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [watchNext, setWatchNext] = useState({ loading: false, items: [], error: null });
  const videoRef = useRef(null);

  const canonicalId = video?.canonicalPostId || video?.id;
  const ownerId = video?.authorId || video?.userId || video?.creator?.id || null;
  const isOwner = Boolean(user?.uid && ownerId && user.uid === ownerId);

  const hls = useHlsVideo({
    videoRef,
    video,
    signedUrlCacheKey: canonicalId,
    enabled: Boolean(video),
  });

  useEffect(() => {
    const urlParam = searchParams.get('url');
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data = null;
        if (videoId) {
          const res = await videoService.getVideo(videoId);
          if (res?.success && res.video) data = res.video;
        }
        if (!data && urlParam) {
          data = { id: videoId || 'external', url: urlParam, title: 'Spark', userId: null };
        }
        if (!data) throw new Error('Spark not found');
        setVideo(data);
        setLikeCount(typeof data.stats?.likes === 'number' ? data.stats.likes : (typeof data.likes === 'number' ? data.likes : null));

        const resolvedOwnerId = data.authorId || data.userId;
        if (resolvedOwnerId) {
          try {
            const { getUserService } = await import('../services/userService.js');
            const profile = await getUserService().getUserProfile(resolvedOwnerId);
            if (profile) {
              setCreator({
                id: profile.id || resolvedOwnerId,
                name: profile.displayName || profile.username,
                username: profile.username,
                avatar: profile.photoURL,
                isVerified: profile.isVerified,
                bio: profile.bio,
              });
            }
          } catch (e) {
            console.warn('Video creator profile read failed', e?.message);
          }
        }

        if (resolvedOwnerId && user?.uid && resolvedOwnerId !== user.uid) {
          try {
            const { getUserService } = await import('../services/userService.js');
            const rel = await getUserService().getFollowStatus(user.uid, resolvedOwnerId);
            setFollowState({
              isFollowing: Boolean(rel?.isFollowing),
              requestStatus: rel?.requestStatus ?? null,
            });
          } catch (e) {
            console.warn('Video creator follow-state read failed', e?.message);
          }
        } else {
          setFollowState({ isFollowing: false, requestStatus: null });
        }

        if (user?.uid && data.id) {
          try {
            const state = await videoService.getViewerVideoState(data.id, user.uid);
            setLiked(state.liked);
            setSaved(state.saved);
          } catch (e) {
            console.warn('Viewer video state read failed', e?.message);
          }
        }
      } catch (err) {
        setError(err?.message || 'Could not load this Spark.');
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId, searchParams, user?.uid]);

  // Flush real elapsed watch duration when leaving or hiding the page
  useSparkViewTracking(
    video?.id,
    user?.uid,
    (id, meta) => videoService.recordVideoView(id, meta),
    'VideoDetail'
  );

  const handleFollowToggle = async () => {
    if (!ownerId || ownerId === user?.uid || followBusy) return;
    setFollowBusy(true);
    try {
      const { getUserService } = await import('../services/userService.js');
      const svc = getUserService();
      await toggleSparkCreatorFollow({
        viewerUid: user?.uid,
        creatorId: ownerId,
        creatorLabel: creator?.username || creator?.name,
        wasFollowing: followState.isFollowing,
        wasRequested: followState.requestStatus === 'pending',
        applyState: (next) => setFollowState(
          next?.requestStatus === 'pending'
            ? { isFollowing: false, requestStatus: 'pending' }
            : { isFollowing: Boolean(next?.isFollowing), requestStatus: null }
        ),
        actions: {
          follow: (uid, id) => svc.followUser(uid, id),
          unfollow: (uid, id) => svc.unfollowUser(uid, id),
          cancelRequest: (_uid, targetId) => svc.cancelFollowRequest(user.uid, targetId),
        },
      });
    } finally {
      setFollowBusy(false);
    }
  };

  const handleLike = async () => {
    if (!video) return;
    const applyLikeState = ({ isLiked, likes }) => {
      setLiked(isLiked);
      setLikeCount(likes);
    };
    await toggleSparkLike({
      video,
      viewerUid: user?.uid,
      wasLikedOverride: liked,
      knownLikesOverride: likeCount,
      requireOwner: true,
      likeFn: (id) => videoService.likeVideo(id),
      applyState: applyLikeState,
    });
  };

  const handleShare = async () => {
    if (!video?.id) return;
    await shareSpark({
      videoId: video.id,
      canonicalId,
      title: video?.title || 'Spark on Arvdoul',
      shareFn: (id, platform) => videoService.shareVideo(id, platform),
      onShared: () => {
        setVideo((prev) => {
          if (!prev) return prev;
          const current = prev.stats?.shares ?? prev.shares;
          if (typeof current !== 'number') return prev;
          return {
            ...prev,
            shares: current + 1,
            stats: prev.stats ? { ...prev.stats, shares: current + 1 } : prev.stats,
          };
        });
      },
    });
  };

  const handleSave = async () => {
    if (!video?.id) return;
    const currentSaves =
      typeof video.stats?.saves === 'number'
        ? video.stats.saves
        : (typeof video.saves === 'number' ? video.saves : null);
    const applySaveState = ({ isSaved, saves }) => {
      setSaved(isSaved);
      setVideo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          saves,
          stats: prev.stats ? { ...prev.stats, saves } : prev.stats,
        };
      });
    };
    await toggleSparkSave({
      video,
      viewerUid: user?.uid,
      wasSavedOverride: saved,
      knownSavesOverride: currentSaves,
      saveFn: (id, uid) => videoService.saveVideo(id, uid),
      unsaveFn: (id, uid) => videoService.unsaveVideo(id, uid),
      applyState: applySaveState,
    });
  };

  const handleDeleteSpark = async () => {
    if (!isOwner || !video?.id || deleting) return;
    setDeleting(true);
    try {
      await videoService.deleteVideo(video.id);
      toast.success('Spark deleted');
      navigate('/sparks');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete Spark');
      setDeleting(false);
    }
  };

  const handleMore = () => setShowMoreMenu(true);

  useEffect(() => {
    const id = video?.id;
    if (!id) return undefined;
    let cancelled = false;
    setWatchNext({ loading: true, items: [], error: null });
    videoService.getWatchNext(id)
      .then((items) => {
        if (!cancelled) setWatchNext({ loading: false, items: Array.isArray(items) ? items : [], error: null });
      })
      .catch((err) => {
        if (!cancelled) setWatchNext({ loading: false, items: [], error: err?.message || 'Could not load recommendations.' });
      });
    return () => { cancelled = true; };
  }, [video?.id]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => { /* playback deferred until ready */ });
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const jumpToChapter = (seconds) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(Number(seconds))) return;
    el.currentTime = Math.max(0, Number(seconds));
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => { /* playback deferred until ready */ });
    }
  };

  const colors = {
    bg: isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]',
    card: isDark ? 'bg-[#080F2E]/90 border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm',
    text: isDark ? 'text-white' : 'text-slate-900',
    secondary: isDark ? 'text-slate-400' : 'text-slate-600',
  };

  const chapters = Array.isArray(video?.chapters) ? video.chapters : [];

  return (
    <div className={cn('min-h-screen pb-16', colors.bg)}>
      {/* Header (shown only when TopAppBar is absent) */}
      {!hasTopAppBar && (
        <div className={cn('sticky top-0 z-30 border-b backdrop-blur-xl', isDark ? 'bg-[#03071B]/90 border-white/[0.08]' : 'bg-[#F6F8FC]/90 border-slate-200/80')}>
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className={cn('w-5 h-5', colors.text)} />
            </button>
            <h1 className={cn('font-bold truncate flex-1', colors.text)}>{video?.title || 'Spark'}</h1>
            {isOwner && video?.processingState && video.processingState !== 'PUBLISHED' && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 shrink-0">
                <Clock className="w-3.5 h-3.5" />
                {video.processingState.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-5">
        {hasTopAppBar && isOwner && video?.processingState && video.processingState !== 'PUBLISHED' && (
          <div className="mb-3 flex items-center justify-end">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {video.processingState.replace(/_/g, ' ')}
            </span>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-arvdoul-purple animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-24">
            <p className={cn('font-semibold mb-4', colors.text)}>{error}</p>
            <button
              type="button"
              onClick={() => navigate('/sparks')}
              className="px-5 py-2.5 min-h-[44px] rounded-xl text-white font-semibold"
              style={{ background: BRAND_GRADIENT }}
            >
              Browse Sparks
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Player */}
            <div className={cn('relative rounded-2xl overflow-hidden border aspect-video bg-black', colors.card)}>
              <video
                ref={videoRef}
                poster={hls.thumbnailUrl || video.thumbnails?.[0] || video.thumbnailUrl || undefined}
                autoPlay
                loop
                muted={muted}
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="absolute inset-0"
              >
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="absolute top-3 right-3 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-black/55 backdrop-blur text-white"
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {hls.error && (
              <div className={cn('rounded-xl p-3 border text-xs flex items-center justify-between', colors.card)}>
                <span className="text-red-400 font-medium">{hls.error}</span>
                <button
                  type="button"
                  onClick={() => hls.refreshPlaybackUrl()}
                  className="px-3 py-1.5 rounded-lg text-white font-semibold"
                  style={{ background: BRAND_GRADIENT }}
                >
                  Retry Stream
                </button>
              </div>
            )}

            {/* Chapters */}
            {chapters.length > 0 && (
              <div className={cn('rounded-2xl p-3.5 border', colors.card)}>
                <p className={cn('text-xs font-bold uppercase tracking-wider mb-2', colors.secondary)}>Chapters</p>
                <div className="flex flex-wrap gap-2">
                  {chapters.map((ch, idx) => {
                    const sec = Number(ch?.time ?? ch?.startTime ?? 0);
                    return (
                      <button
                        key={`${sec}-${idx}`}
                        type="button"
                        onClick={() => jumpToChapter(sec)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                          isDark
                            ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900'
                        )}
                      >
                        {formatDuration(sec)} · {ch?.title || `Chapter ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Creator */}
            {creator && (
              <VideoCreatorInfo
                creator={creator}
                isFollowing={followState.isFollowing}
                requested={followState.requestStatus === 'pending'}
                followBusy={followBusy}
                onFollow={ownerId && ownerId !== user?.uid ? handleFollowToggle : undefined}
                onProfileClick={() => navigate(`/profile/${creator.id}`)}
              />
            )}

            {/* Title + stats + owner actions */}
            <div className={cn('rounded-2xl p-4 border', colors.card)}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h2 className={cn('font-bold text-lg', colors.text)}>{video.title || 'Untitled Spark'}</h2>
                  {video.description && (
                    <p className={cn('text-sm mt-1', colors.secondary)}>{video.description}</p>
                  )}
                  <p className={cn('text-xs mt-1.5', colors.secondary)}>
                    {typeof (video.stats?.views ?? video.views) === 'number'
                      ? `${(video.stats?.views ?? video.views).toLocaleString()} views`
                      : 'Views unavailable'}
                    {' · '}
                    {video.subType || video.category || 'spark'}
                  </p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate('/video-analytics')}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      Analytics
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSpark}
                      disabled={deleting}
                      className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Engagement rail */}
            <div className={cn('rounded-2xl p-4 border flex items-center justify-around', colors.card)}>
              <VideoActionRail
                likes={likeCount}
                comments={video.stats?.comments ?? video.comments ?? null}
                shares={video.stats?.shares ?? video.shares ?? null}
                gifts={video.stats?.gifts ?? video.gifts ?? null}
                isLiked={liked}
                isSaved={saved}
                onLike={handleLike}
                onComment={() => setShowComments(true)}
                onShare={handleShare}
                onSave={handleSave}
                onGift={ownerId ? () => setShowGiftModal(true) : undefined}
                onMore={handleMore}
              />
            </div>

            {/* Watch next */}
            {(watchNext.loading || watchNext.items.length > 0 || watchNext.error) && (
              <div className={cn('rounded-2xl p-4 border', colors.card)}>
                <h3 className={cn('font-bold mb-3', colors.text)}>More videos</h3>
                {watchNext.loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="animate-pulse space-y-2">
                        <div className="aspect-video rounded-xl bg-gray-500/20" />
                        <div className="h-3 rounded bg-gray-500/20 w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : watchNext.error ? (
                  <p className={cn('text-sm', colors.secondary)}>{watchNext.error}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {watchNext.items.slice(0, 9).map((item) => {
                      const thumb = item.thumbnails?.[0] || item.thumbnailUrl || null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate(`/sparks/${item.canonicalPostId || item.id}`)}
                          className="text-left group"
                        >
                          <div className={cn('aspect-video rounded-xl overflow-hidden border', isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200')}>
                            {thumb ? (
                              <LazyImage src={thumb} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Play className="w-6 h-6 text-white/60" /></div>
                            )}
                          </div>
                          <p className={cn('mt-1.5 text-xs font-semibold line-clamp-2', colors.text)}>{item.title || 'Untitled'}</p>
                          <p className={cn('text-[11px]', colors.secondary)}>
                            {typeof (item.stats?.views ?? item.views) === 'number'
                              ? `${(item.stats?.views ?? item.views).toLocaleString()} views`
                              : 'Views unavailable'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <VideoComments
              isOpen={showComments}
              onClose={() => setShowComments(false)}
              video={video}
              onCommentAdded={() => setVideo((prev) => {
                if (!prev) return prev;
                const current = prev.stats?.comments ?? prev.comments;
                if (typeof current !== 'number') return prev;
                return {
                  ...prev,
                  comments: current + 1,
                  stats: prev.stats ? { ...prev.stats, comments: current + 1 } : prev.stats,
                };
              })}
              onCommentDeleted={() => setVideo((prev) => {
                if (!prev) return prev;
                const current = prev.stats?.comments ?? prev.comments;
                if (typeof current !== 'number') return prev;
                const next = Math.max(0, current - 1);
                return {
                  ...prev,
                  comments: next,
                  stats: prev.stats ? { ...prev.stats, comments: next } : prev.stats,
                };
              })}
            />

            <VideoBottomSheet
              isOpen={showMoreMenu}
              onClose={() => setShowMoreMenu(false)}
              video={video}
              initialView="report"
              onSaveStateChange={(_id, nextSaved) => setSaved(Boolean(nextSaved))}
              onShared={() => setVideo((prev) => {
                if (!prev) return prev;
                const current = prev.stats?.shares ?? prev.shares;
                if (typeof current !== 'number') return prev;
                return {
                  ...prev,
                  shares: current + 1,
                  stats: prev.stats ? { ...prev.stats, shares: current + 1 } : prev.stats,
                };
              })}
              onDeleted={() => navigate('/sparks')}
            />

            <VideoGiftModal
              isOpen={showGiftModal && Boolean(video)}
              onClose={() => setShowGiftModal(false)}
              creator={creator}
              video={video}
              onGiftSent={() => setVideo((prev) => {
                if (!prev) return prev;
                const current = prev.stats?.gifts ?? prev.gifts;
                const next = typeof current === 'number' ? current + 1 : 1;
                return {
                  ...prev,
                  gifts: next,
                  stats: prev.stats ? { ...prev.stats, gifts: next } : { gifts: next },
                };
              })}
            />
          </div>
        )}
      </main>
    </div>
  );
}
