// src/hooks/useHlsVideo.js
//
// Production Mux + HLS playback hook for Arvdoul Sparks.
// Resolves signed playback URLs via `videoService.getMuxPlaybackUrl`, caches
// short-lived tokens in `useVideoStore`, attaches hls.js with adaptive bitrate
// & manual quality switching, falls back cleanly for Safari native HLS or
// direct MP4/WebM sources, and recovers from transient network/media errors.

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import videoService from '../services/videoService.js';
import { useVideoStore } from '../store/videoStore.js';

const SIGNED_URL_CACHE_MAX_AGE_MS = 50 * 60 * 1000;

function isHlsSource(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.m3u8(\?|$)/i.test(url) || url.includes('stream.mux.com/');
}

function isMuxStreamUrl(url) {
  return typeof url === 'string' && url.includes('stream.mux.com/');
}

function parseTargetHeight(quality) {
  if (!quality || quality === 'auto') return -1;
  const lower = String(quality).toLowerCase();
  if (lower.includes('4k') || lower.includes('2160')) return 2160;
  const match = lower.match(/(\d{3,4})p?/);
  return match ? Number(match[1]) : -1;
}

export function useHlsVideo({
  videoRef,
  video,
  signedUrlCacheKey,
  autoRefresh = true,
  quality = 'auto',
  enabled = true,
  onError,
} = {}) {
  const hlsRef = useRef(null);
  const refreshAttemptsRef = useRef(0);

  const cacheId = signedUrlCacheKey || video?.canonicalPostId || video?.id || null;
  const muxPlaybackId = video?.muxPlaybackId || null;
  const playbackPolicy = video?.playbackPolicy || (muxPlaybackId ? 'signed' : null);
  const rawFallbackUrl = video?.signedUrl || video?.videoUrl || video?.url || '';

  const [src, setSrc] = useState(() => {
    if (!rawFallbackUrl) return '';
    if (isMuxStreamUrl(rawFallbackUrl) && playbackPolicy === 'signed' && !rawFallbackUrl.includes('token=')) {
      return '';
    }
    return rawFallbackUrl;
  });
  const [thumbnailUrl, setThumbnailUrl] = useState(
    video?.thumbnailUrl || video?.thumbnail || video?.poster || ''
  );
  const [storyboardUrl, setStoryboardUrl] = useState(video?.storyboardUrl || null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  const resolvePlaybackSource = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!enabled || !video) return null;
    setError(null);

    if (!forceRefresh && video?.signedUrl && (!isMuxStreamUrl(video.signedUrl) || video.signedUrl.includes('token='))) {
      setSrc(video.signedUrl);
      if (video.thumbnailUrl) setThumbnailUrl(video.thumbnailUrl);
      if (video.storyboardUrl) setStoryboardUrl(video.storyboardUrl);
      return video.signedUrl;
    }

    if (!forceRefresh && cacheId) {
      const cached = useVideoStore.getState().getSignedUrl?.(cacheId, SIGNED_URL_CACHE_MAX_AGE_MS);
      if (cached?.url) {
        setSrc(cached.url);
        if (cached.thumbnailUrl) setThumbnailUrl(cached.thumbnailUrl);
        if (cached.storyboardUrl) setStoryboardUrl(cached.storyboardUrl);
        return cached.url;
      }
    }

    if (muxPlaybackId && (playbackPolicy === 'signed' || !rawFallbackUrl || isMuxStreamUrl(rawFallbackUrl))) {
      try {
        setIsBuffering(true);
        const signed = await videoService.getMuxPlaybackUrl({
          playbackId: muxPlaybackId,
          postId: video?.canonicalPostId || video?.id || null,
          videoId: video?.id || null,
        });
        if (signed?.url) {
          if (cacheId) {
            useVideoStore.getState().setSignedUrl?.(cacheId, {
              url: signed.url,
              thumbnailUrl: signed.thumbnailUrl || null,
              storyboardUrl: signed.storyboardUrl || null,
            });
          }
          setSrc(signed.url);
          if (signed.thumbnailUrl) setThumbnailUrl(signed.thumbnailUrl);
          if (signed.storyboardUrl) setStoryboardUrl(signed.storyboardUrl);
          return signed.url;
        }
      } catch (err) {
        if (playbackPolicy === 'public' && muxPlaybackId) {
          const publicUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8`;
          setSrc(publicUrl);
          return publicUrl;
        }
        if (rawFallbackUrl && !isMuxStreamUrl(rawFallbackUrl)) {
          setSrc(rawFallbackUrl);
          return rawFallbackUrl;
        }
        setError(err?.message || 'Unable to load Spark stream');
        onError?.(err);
        return null;
      } finally {
        setIsBuffering(false);
      }
    }

    if (rawFallbackUrl && !(isMuxStreamUrl(rawFallbackUrl) && playbackPolicy === 'signed' && !rawFallbackUrl.includes('token='))) {
      setSrc(rawFallbackUrl);
      return rawFallbackUrl;
    }

    return null;
  }, [enabled, video, cacheId, muxPlaybackId, playbackPolicy, rawFallbackUrl, onError]);

  // Resolve URL whenever the active Spark changes
  useEffect(() => {
    refreshAttemptsRef.current = 0;
    if (!enabled || !video) {
      setSrc('');
      setQualityLevels([]);
      setCurrentLevel(-1);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const resolved = await resolvePlaybackSource();
      if (cancelled) return;
      if (resolved) setSrc(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, cacheId, muxPlaybackId, rawFallbackUrl, resolvePlaybackSource, video]);

  // Attach hls.js or native src to <video>
  useEffect(() => {
    const videoEl = videoRef?.current;
    if (!videoEl || !src || !enabled) return undefined;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // Ignore cleanup failure
      }
      hlsRef.current = null;
    }

    if (isHlsSource(src) && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        const levels = Array.isArray(data?.levels)
          ? data.levels.map((lvl, index) => ({
            index,
            height: lvl.height || 0,
            width: lvl.width || 0,
            bitrate: lvl.bitrate || 0,
            label: lvl.height ? `${lvl.height}p` : `Stream ${index + 1}`,
          }))
          : [];
        setQualityLevels(levels);
        setError(null);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        if (typeof data?.level === 'number') {
          setCurrentLevel(data.level);
        }
      });

      hls.on(Hls.Events.ERROR, async (_evt, data) => {
        if (!data?.fatal) return;

        const status = data?.response?.code;
        if ((status === 401 || status === 403) && autoRefresh && refreshAttemptsRef.current < 1) {
          refreshAttemptsRef.current += 1;
          const refreshed = await resolvePlaybackSource({ forceRefresh: true });
          if (refreshed && hlsRef.current) {
            hlsRef.current.loadSource(refreshed);
            hlsRef.current.startLoad();
            return;
          }
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && refreshAttemptsRef.current < 2) {
          refreshAttemptsRef.current += 1;
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        const err = new Error(data?.details || 'Stream playback failed');
        setError(err.message);
        onError?.(err);
      });

      hls.loadSource(src);
      hls.attachMedia(videoEl);

      return () => {
        try {
          hls.destroy();
        } catch {
          // Ignore cleanup error
        }
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      };
    }

    // Safari native HLS or standard progressive MP4/WebM
    if (videoEl.src !== src) {
      videoEl.src = src;
    }
    setQualityLevels([]);
    setCurrentLevel(-1);

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // Ignore cleanup error
        }
        hlsRef.current = null;
      }
    };
  }, [src, enabled, autoRefresh, videoRef, resolvePlaybackSource, onError]);

  const setQualityLevel = useCallback((levelIndex) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = levelIndex;
    }
    setCurrentLevel(levelIndex);
  }, []);

  // Sync external store quality preference (e.g. 'auto', '1080p', '720p', '480p')
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || qualityLevels.length === 0) return;
    const targetHeight = parseTargetHeight(quality);
    if (targetHeight <= 0) {
      hls.currentLevel = -1;
      return;
    }
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (const lvl of qualityLevels) {
      if (!lvl.height) continue;
      const diff = Math.abs(lvl.height - targetHeight);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = lvl.index;
      }
    }
    if (bestIdx !== -1) {
      hls.currentLevel = bestIdx;
    }
  }, [quality, qualityLevels]);

  const refreshPlaybackUrl = useCallback(() => {
    return resolvePlaybackSource({ forceRefresh: true });
  }, [resolvePlaybackSource]);

  return {
    src,
    isHls: isHlsSource(src),
    isBuffering,
    error,
    qualityLevels,
    currentLevel,
    setQualityLevel,
    thumbnailUrl,
    storyboardUrl,
    refreshPlaybackUrl,
  };
}

export default useHlsVideo;
