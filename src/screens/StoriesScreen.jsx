// src/screens/StoriesScreen.jsx

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Search, Camera, Calendar, Plus, CheckCircle2, Volume2, VolumeX, Send, X,
  Sparkles, Music, Users, Loader2, Trash2, Share2, Bookmark, RefreshCw,
  MapPin, Link2, AtSign, Timer, HelpCircle, ChevronLeft, ChevronRight,
  ExternalLink, Type, Video
} from "lucide-react";
import { getStoryService } from '../services/storyService';
import { getMonetizationService } from '../services/monetizationService';
import { pickHandle, deriveHandle, resolveActorName } from '../services/profileReadModel.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { copyToClipboard } from '../utils/shareUtils.js';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import ArvdoulLogo from '../components/Shared/ArvdoulLogo';
import ErrorState from '../design-system/ErrorState.jsx';
import { LazyImage } from '../components/Shared/LazyImage';

// Only categories with a real backing model are offered.
const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'sponsored', label: 'Sponsored', icon: Sparkles },
  { id: 'friends', label: 'Friends' },
  { id: 'following', label: 'Following' },
];

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😮', '😂', '💎'];

function relativeTime(createdAt) {
  if (!createdAt) return null;
  const ms = typeof createdAt.toDate === 'function'
    ? createdAt.toDate().getTime()
    : new Date(createdAt).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCountdown(secondsRemaining) {
  const s = Math.max(0, Math.floor(secondsRemaining));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function StoriesScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { highlightId: routeHighlightId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Navigation / Filter State
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [archive, setArchive] = useState({ loading: false, error: null, items: [] });

  // Viewer State
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHoldingChromeHidden, setIsHoldingChromeHidden] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [flyingParticles, setFlyingParticles] = useState([]);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState(null);
  const [storiesNonce, setStoriesNonce] = useState(0);
  const [highlightGroup, setHighlightGroup] = useState(null);

  // Viewers & Delete & Highlights Sheets
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState({ loading: false, error: null, items: [] });
  const [deletingStory, setDeletingStory] = useState(false);
  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false);
  const [poll, setPoll] = useState({ loading: false, data: null, voted: null, error: null });

  const [highlightSheetOpen, setHighlightSheetOpen] = useState(false);
  const [myHighlights, setMyHighlights] = useState([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const progressIntervalRef = useRef(null);
  const storyAudioRef = useRef(null);
  const stageVideoRef = useRef(null);
  const viewedIdsRef = useRef(new Set());
  const gestureStartRef = useRef(null);
  const holdTimerRef = useRef(null);

  // Load Vibes from storyService (Firestore-backed feed)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setStoriesLoading(true);
        setStoriesError(null);
        const feed = await getStoryService().getStoriesFeed(user?.uid || '', { cacheFirst: false, limit: 30 });
        if (cancelled) return;
        const groups = feed?.groups || [];

        const { getSocialGraphService } = await import('../services/socialGraphService.js');
        const graph = getSocialGraphService();
        const creatorIds = [...new Set(groups.map((g) => g.userId).filter(Boolean))];
        let creators = new Map();
        let follows = new Map();
        try {
          const [profiles, edges] = await Promise.all([
            graph.hydrateProfiles(creatorIds, { viewerId: user?.uid || null }),
            user?.uid ? graph.getEdgeSet(user.uid, creatorIds) : Promise.resolve(new Map()),
          ]);
          creators = new Map(profiles.map((p) => [p.id, p]));
          follows = edges;
        } catch (err) {
          toast.error('Some creator details could not be loaded.');
        }
        if (cancelled) return;

        const mapped = groups.map((g) => {
          const storiesArr = g.stories || [];
          const profile = creators.get(g.userId) || null;
          const edge = follows.get(g.userId) || null;
          const name = resolveActorName([profile?.displayName, profile?.name], g.userId);
          return {
            id: g.userId,
            user: {
              id: g.userId,
              name,
              username: pickHandle([profile?.username]) || deriveHandle(name) || '',
              avatar: getSafeAvatarUrl(profile?.photoURL, name, g.userId),
              verified: Boolean(profile?.isVerified),
              category: edge?.isMutualFriend ? 'Friends' : edge?.isFollowing ? 'Following' : 'Discover',
            },
            hasUnseen: storiesArr.some((s) => !s.seen),
            timeAgo: relativeTime(storiesArr[0]?.createdAt),
            itemsCount: storiesArr.length,
            activeItemIndex: 0,
            mediaType: storiesArr[0]?.type || 'image',
            badgeType: storiesArr[0]?.type || 'image',
            mediaUrl: storiesArr[0]?.media?.url || storiesArr[0]?.content || '',
            backgroundColor: storiesArr[0]?.backgroundColor || '#0c0f24',
            textColor: storiesArr[0]?.textColor || '#FFFFFF',
            caption: storiesArr[0]?.content || '',
            viewsCount: typeof storiesArr[0]?.stats?.views === 'number' ? String(storiesArr[0].stats.views) : null,
            isSponsored: Boolean(storiesArr[0]?.isSponsored || g.isSponsored),
            ctaText: storiesArr[0]?.ctaText || '',
            ctaUrl: storiesArr[0]?.ctaUrl || '',
            items: storiesArr.map((st) => ({
              id: st.id,
              url: st.media?.url || st.content || '',
              type: st.type || 'image',
              caption: st.content || '',
              duration: st.duration || (st.type === 'video' ? 15 : 5),
              backgroundColor: st.backgroundColor || '#0c0f24',
              textColor: st.textColor || '#FFFFFF',
              font: st.font || 'default',
              location: st.location || null,
              linkUrl: st.linkUrl || st.ctaUrl || null,
              taggedUsers: st.taggedUsers || [],
              seen: Boolean(st.seen),
              views: typeof st.stats?.views === 'number' ? String(st.stats.views) : null,
              ctaText: st.ctaText || '',
              ctaUrl: st.ctaUrl || '',
              music: st.music || null,
              stickers: st.stickers || null,
            })),
          };
        }).sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen));

        setStories(mapped);
      } catch (err) {
        if (!cancelled) setStoriesError(err?.message || 'Could not load Vibes.');
        if (!cancelled) setStories([]);
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid, storiesNonce]);

  // Highlight deep links: /highlight/:highlightId or /stories?highlight=<id>
  useEffect(() => {
    const targetId = routeHighlightId || searchParams.get('highlight');
    if (!targetId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const storyService = getStoryService();
        const res = await storyService.getHighlightStories(targetId, { limit: 50 });
        if (cancelled || !res?.success || !res.stories?.length) return;
        const items = res.stories.map((st) => ({
          id: st.originalStoryId || st.storyId || st.id,
          url: st.media?.url || st.content || '',
          type: st.type || 'image',
          caption: st.content || '',
          duration: st.duration || (st.type === 'video' ? 15 : 5),
          backgroundColor: st.backgroundColor || '#0c0f24',
          textColor: st.textColor || '#FFFFFF',
          ctaText: st.ctaText || '',
          ctaUrl: st.ctaUrl || '',
          music: st.music || null,
          stickers: st.stickers || null,
        })).filter((st) => st.url || st.type === 'text');
        if (!items.length) return;
        const first = res.stories[0];
        setHighlightGroup({
          id: `highlight_${targetId}`,
          user: {
            id: first.userId || '',
            name: first.authorName || 'Highlight',
            username: '',
            avatar: getSafeAvatarUrl(first.authorPhoto, first.authorName, first.userId),
            verified: false,
            category: 'Highlight',
          },
          hasUnseen: false,
          timeAgo: null,
          itemsCount: items.length,
          mediaType: items[0].type,
          badgeType: items[0].type,
          mediaUrl: items[0].url,
          backgroundColor: items[0].backgroundColor,
          textColor: items[0].textColor,
          caption: items[0].caption,
          isSponsored: false,
          items,
        });
        setActiveStoryIndex(0);
        setActiveItemIndex(0);
        setStoryProgress(0);
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Highlight could not be opened');
      }
    })();
    return () => { cancelled = true; };
  }, [routeHighlightId, searchParams]);

  const filteredStories = useMemo(() => {
    const source = highlightGroup ? [highlightGroup, ...stories] : stories;
    return source.filter((story) => {
      if (activeCategory === 'sponsored' && !story.isSponsored) return false;
      if (activeCategory === 'friends' && story.user.category !== 'Friends') return false;
      if (activeCategory === 'following' && story.user.category !== 'Following' && story.user.category !== 'Friends') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          story.user.name.toLowerCase().includes(query) ||
          story.user.username.toLowerCase().includes(query) ||
          (story.caption && story.caption.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [stories, highlightGroup, activeCategory, searchQuery]);

  // Deep link from Home Vibes strip or Notifications: jump directly to a creator's Vibe sequence
  useEffect(() => {
    const targetUserId = location.state?.vibeUserId;
    if (!targetUserId || filteredStories.length === 0) return;
    const idx = filteredStories.findIndex((s) => s.user?.id === targetUserId);
    if (idx >= 0) {
      setActiveStoryIndex(idx);
      setActiveItemIndex(0);
      setStoryProgress(0);
      setIsPaused(false);
    }
  }, [location.state?.vibeUserId, filteredStories]);

  const handleOpenStory = (index) => {
    setActiveStoryIndex(index);
    setActiveItemIndex(0);
    setStoryProgress(0);
    setIsPaused(false);
    setQuestionAnswer('');
  };

  const handleCloseStory = useCallback(() => {
    if (location.state?.vibeUserId) {
      navigate(location.pathname, { replace: true, state: null });
    }
    setActiveStoryIndex(null);
    setActiveItemIndex(0);
    setStoryProgress(0);
    setViewersOpen(false);
    setHighlightSheetOpen(false);
    setIsPaused(false);
    setIsHoldingChromeHidden(false);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  }, [location.pathname, location.state?.vibeUserId, navigate]);

  const currentStory = activeStoryIndex !== null ? filteredStories[activeStoryIndex] : null;
  const currentItem = currentStory?.items?.[activeItemIndex] || currentStory?.items?.[0];
  const isOwnStory = Boolean(user?.uid && currentStory?.user?.id === user.uid);
  const pollSticker = (currentItem?.stickers || []).find((s) => s.type === 'poll' && s.data?.pollId) || null;
  const questionSticker = (currentItem?.stickers || []).find((s) => s.type === 'question' && s.data?.prompt) || null;
  const countdownSticker = (currentItem?.stickers || []).find((s) => s.type === 'countdown' && s.data?.seconds) || null;
  const mentionSticker = (currentItem?.stickers || []).find((s) => s.type === 'mention' && s.data?.handle) || null;
  const locationSticker = (currentItem?.stickers || []).find((s) => s.type === 'location' && s.data?.name) || null;
  const gifSticker = (currentItem?.stickers || []).find((s) => s.type === 'gif' && s.data?.url) || null;
  const activeLocationText = currentItem?.location || locationSticker?.data?.name || null;
  const activeLinkUrl = currentItem?.linkUrl || currentItem?.ctaUrl || null;

  // Report view & mark item seen in state once per opened item
  useEffect(() => {
    const storyId = currentItem?.id;
    if (activeStoryIndex === null || !storyId || !user?.uid) return;
    if (viewedIdsRef.current.has(storyId)) return;
    viewedIdsRef.current.add(storyId);

    setStories((prev) => prev.map((g) => {
      if (g.id !== currentStory?.id) return g;
      const items = (g.items || []).map((it) => (it.id === storyId ? { ...it, seen: true } : it));
      return { ...g, items, hasUnseen: items.some((it) => !it.seen) };
    }));

    getStoryService()
      .reportStoryView(storyId, user.uid)
      .catch((err) => console.warn('[Vibes] view report failed:', err?.message || err));
  }, [activeStoryIndex, currentItem?.id, currentStory?.id, user?.uid]);

  // Countdown ticker when countdown sticker is active
  useEffect(() => {
    if (!countdownSticker || activeStoryIndex === null) return undefined;
    const t = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdownSticker, activeStoryIndex]);

  // Advance / Reverse helpers
  const advanceItemOrGroup = useCallback(() => {
    if (activeItemIndex + 1 < (currentStory?.items?.length || 1)) {
      setActiveItemIndex((i) => i + 1);
      setStoryProgress(0);
      return;
    }
    if (activeStoryIndex + 1 < filteredStories.length) {
      setActiveStoryIndex((s) => s + 1);
      setActiveItemIndex(0);
      setStoryProgress(0);
      return;
    }
    handleCloseStory();
  }, [activeItemIndex, activeStoryIndex, currentStory?.items?.length, filteredStories.length, handleCloseStory]);

  const retreatItemOrGroup = useCallback(() => {
    if (activeItemIndex > 0) {
      setActiveItemIndex((i) => i - 1);
      setStoryProgress(0);
      return;
    }
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((s) => s - 1);
      const prev = filteredStories[activeStoryIndex - 1];
      setActiveItemIndex((prev?.items?.length || 1) - 1);
      setStoryProgress(0);
    }
  }, [activeItemIndex, activeStoryIndex, filteredStories]);

  const handleNextGroup = useCallback(() => {
    if (activeStoryIndex + 1 < filteredStories.length) {
      setActiveStoryIndex((s) => s + 1);
      setActiveItemIndex(0);
      setStoryProgress(0);
    } else {
      handleCloseStory();
    }
  }, [activeStoryIndex, filteredStories.length, handleCloseStory]);

  const handlePrevGroup = useCallback(() => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((s) => s - 1);
      setActiveItemIndex(0);
      setStoryProgress(0);
    }
  }, [activeStoryIndex]);

  // Sync HTML5 video playback for video Vibes
  useEffect(() => {
    const vid = stageVideoRef.current;
    if (!vid || currentItem?.type !== 'video' || activeStoryIndex === null) return;
    vid.muted = isMuted;
    if (isPaused) {
      vid.pause();
    } else {
      vid.play().catch((err) => console.warn('[Vibes] video autoplay blocked:', err?.message));
    }
  }, [currentItem?.id, currentItem?.type, activeStoryIndex, isPaused, isMuted]);

  const handleDeleteStory = async () => {
    const storyId = currentItem?.id;
    if (!storyId || deletingStory) return;
    setDeletingStory(true);
    try {
      await getStoryService().deleteStory(storyId);
      setStories((prev) => prev
        .map((g) => (g.id !== currentStory?.id ? g : { ...g, items: (g.items || []).filter((it) => it.id !== storyId) }))
        .filter((g) => (g.items || []).length > 0));
      toast.success('Vibe deleted.');
      const remaining = (currentStory?.items || []).filter((it) => it.id !== storyId);
      if (remaining.length === 0) {
        handleCloseStory();
      } else {
        setActiveItemIndex((i) => Math.min(i, remaining.length - 1));
        setStoryProgress(0);
      }
    } catch (err) {
      toast.error(err?.message || 'Could not delete this Vibe.');
    } finally {
      setDeletingStory(false);
    }
  };

  const handleOpenArchive = useCallback(async () => {
    setIsCalendarOpen(true);
    if (!user?.uid) return;
    setArchive({ loading: true, error: null, items: [] });
    try {
      const res = await getStoryService().getArchivedStories(user.uid, { limit: 24 });
      const items = Array.isArray(res) ? res : (res?.stories || []);
      setArchive({ loading: false, error: null, items });
    } catch (err) {
      setArchive({ loading: false, error: err?.message || 'Could not load your archive.', items: [] });
    }
  }, [user?.uid]);

  const handleOpenViewers = async () => {
    const storyId = currentItem?.id;
    if (!storyId) return;
    setIsPaused(true);
    setViewersOpen(true);
    setViewers({ loading: true, error: null, items: [] });
    try {
      const res = await getStoryService().getStoryViewers(storyId, { limit: 100 });
      const items = (res?.viewers || []).map((v) => {
        const p = v.profile || {};
        const name = resolveActorName([p.displayName, p.name], p.id || p.uid);
        return {
          userId: v.userId,
          name,
          handle: pickHandle([p.username]) || deriveHandle(name),
          avatar: getSafeAvatarUrl(p.photoURL, name, v.userId),
        };
      });
      setViewers({ loading: false, error: null, items });
    } catch (err) {
      setViewers({ loading: false, error: err?.message || 'Could not load viewers.', items: [] });
    }
  };

  const handleOpenHighlightSheet = async () => {
    if (!user?.uid || !currentItem?.id) return;
    setIsPaused(true);
    setHighlightSheetOpen(true);
    setHighlightsLoading(true);
    try {
      const res = await getStoryService().getHighlights(user.uid, { limit: 30 });
      setMyHighlights(res?.highlights || []);
    } catch (err) {
      toast.error(err?.message || 'Could not load highlights.');
    } finally {
      setHighlightsLoading(false);
    }
  };

  const handleSaveToExistingHighlight = async (highlightId) => {
    if (!currentItem?.id || savingHighlight) return;
    setSavingHighlight(true);
    try {
      await getStoryService().addToHighlight(highlightId, currentItem.id);
      toast.success('Added to Highlight');
      setHighlightSheetOpen(false);
      setIsPaused(false);
    } catch (err) {
      toast.error(err?.message || 'Could not save Vibe to Highlight.');
    } finally {
      setSavingHighlight(false);
    }
  };

  const handleCreateAndSaveHighlight = async (e) => {
    e.preventDefault();
    const title = newHighlightTitle.trim();
    if (!title || !user?.uid || !currentItem?.id || savingHighlight) return;
    setSavingHighlight(true);
    try {
      await getStoryService().createHighlight(user.uid, title, [currentItem.id]);
      setNewHighlightTitle('');
      toast.success(`Saved to "${title}" Highlight`);
      setHighlightSheetOpen(false);
      setIsPaused(false);
    } catch (err) {
      toast.error(err?.message || 'Could not create Highlight.');
    } finally {
      setSavingHighlight(false);
    }
  };

  const handleShareStory = async () => {
    if (!currentItem?.id) return;
    const shareUrl = `${window.location.origin}/stories`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${currentStory?.user?.name || 'Creator'} on Arvdoul Vibes`,
          text: currentItem?.caption || 'Check out this Vibe on Arvdoul',
          url: shareUrl,
        });
      } else {
        await copyToClipboard(shareUrl);
        toast.success('Vibe link copied');
      }
      getStoryService()
        .trackShare(currentItem.id)
        .catch((err) => console.warn('[Vibes] share metric failed:', err?.message || err));
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error('Could not share Vibe.');
      }
    }
  };

  // Load the current item's poll
  const currentPollSticker = (currentItem?.stickers || []).find((s) => s.type === 'poll' && s.data?.pollId);
  const currentPollId = currentPollSticker?.data?.pollId || null;
  useEffect(() => {
    if (!currentPollId || !currentItem?.id || !user?.uid) {
      setPoll({ loading: false, data: null, voted: null, error: null });
      return;
    }
    let cancelled = false;
    setPoll({ loading: true, data: null, voted: null, error: null });
    getStoryService()
      .getPoll(currentItem.id, currentPollId)
      .then((res) => {
        if (cancelled) return;
        setPoll({ loading: false, data: res?.poll || null, voted: res?.voted ?? null, error: null });
      })
      .catch((err) => {
        if (!cancelled) setPoll({ loading: false, data: null, voted: null, error: err?.message || 'Could not load the poll.' });
      });
    return () => { cancelled = true; };
  }, [currentItem?.id, currentPollId, user?.uid]);

  const handleVotePoll = async (optionIndex) => {
    if (!poll.data || poll.voted !== null || !currentItem?.id || poll.data.id == null) return;
    const pollId = poll.data.id;
    setPoll((p) => {
      const votes = [...(p.data.votes || [])];
      votes[optionIndex] = (votes[optionIndex] || 0) + 1;
      return { ...p, data: { ...p.data, votes }, voted: optionIndex };
    });
    try {
      await getStoryService().voteOnPoll(currentItem.id, pollId, optionIndex);
    } catch (err) {
      toast.error(err?.message || 'Could not record your vote.');
      const res = await getStoryService().getPoll(currentItem.id, pollId).catch((e) => {
        console.warn('[Vibes] poll refresh failed:', e?.message);
        return null;
      });
      if (res) setPoll({ loading: false, data: res.poll, voted: res.voted, error: null });
    }
  };

  // Story playback timer
  useEffect(() => {
    if (activeStoryIndex === null || !currentStory || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }
    // Video Vibes advance smoothly via timer capped by video duration (or video onEnded)
    const duration = (currentItem?.duration || 5) * 1000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + step >= 100) {
          if (currentItem?.id) {
            getStoryService().reportStoryCompletion(currentItem.id).catch((e) => {
              console.warn('[Vibes] completion not reported:', e?.message);
            });
          }
          advanceItemOrGroup();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [activeStoryIndex, activeItemIndex, isPaused, currentStory, currentItem, advanceItemOrGroup]);

  // Background music or standalone audio Vibe playback
  useEffect(() => {
    const audioSource = currentItem?.type === 'audio' ? currentItem?.url : (currentItem?.music?.audioUrl || null);
    if (!audioSource || activeStoryIndex === null) {
      if (storyAudioRef.current) {
        storyAudioRef.current.pause();
        storyAudioRef.current = null;
      }
      return;
    }
    if (!storyAudioRef.current || storyAudioRef.current.src !== audioSource) {
      storyAudioRef.current?.pause();
      storyAudioRef.current = new Audio(audioSource);
      storyAudioRef.current.loop = true;
    }
    storyAudioRef.current.muted = isMuted;
    if (isPaused) storyAudioRef.current.pause();
    else storyAudioRef.current.play().catch((err) => console.warn('[Vibes] audio play deferred:', err?.message));
  }, [currentItem, activeStoryIndex, isPaused, isMuted]);

  useEffect(() => () => {
    storyAudioRef.current?.pause();
    storyAudioRef.current = null;
  }, []);

  // Tap & Gesture handling on immersive stage
  const handleStagePointerDown = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    gestureStartRef.current = { x: clientX, y: clientY, t: Date.now() };
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setIsPaused(true);
      setIsHoldingChromeHidden(true);
    }, 200);
  };

  const handleStagePointerEnd = (e) => {
    clearTimeout(holdTimerRef.current);
    const wasHolding = isHoldingChromeHidden;
    setIsHoldingChromeHidden(false);
    if (wasHolding) {
      setIsPaused(false);
      gestureStartRef.current = null;
      return;
    }
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (!start) return;

    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const dx = endX - start.x;
    const dy = endY - start.y;

    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      handleCloseStory();
      return;
    }
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleNextGroup();
      else handlePrevGroup();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const isRight = (endX - rect.left) > rect.width / 2;
    const svc = getStoryService();
    if (isRight) {
      if (currentItem?.id) {
        svc.trackStoryAnalytics(currentItem.id, 'forward').catch((err) => {
          console.warn('Vibe forward analytics not buffered', err?.message);
        });
      }
      advanceItemOrGroup();
    } else {
      if (currentItem?.id) {
        svc.trackStoryAnalytics(currentItem.id, 'back').catch((err) => {
          console.warn('Vibe back analytics not buffered', err?.message);
        });
      }
      retreatItemOrGroup();
    }
  };

  useEffect(() => {
    if (activeStoryIndex === null) return undefined;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') handleCloseStory();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        advanceItemOrGroup();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        retreatItemOrGroup();
      } else if (e.key === 'Escape') {
        handleCloseStory();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeStoryIndex, advanceItemOrGroup, retreatItemOrGroup, handleCloseStory]);

  const [reactingId, setReactingId] = useState(null);
  const handleSendReaction = async (emoji) => {
    if (!currentItem?.id || reactingId) return;
    setReactingId(currentItem.id);
    const id = Date.now() + Math.random();
    setFlyingParticles((prev) => [...prev, { id, emoji, x: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFlyingParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1500);
    try {
      await getStoryService().reactToStory(currentItem.id, emoji);
    } catch (err) {
      toast.error(err?.message || 'Reaction could not be sent');
    } finally {
      setReactingId(null);
    }
  };

  const [gifting, setGifting] = useState(false);
  const handleGiftCoin = async () => {
    if (!user?.uid || gifting) return;
    const storyUserId = currentStory?.user?.id || currentStory?.userId;
    if (!storyUserId) { toast.error('Recipient unknown'); return; }
    if (storyUserId === user.uid) { toast.error('You cannot gift yourself'); return; }
    setGifting(true);
    try {
      const res = await getMonetizationService().transferCoins(
        user.uid, storyUserId, 250, 'vibe_gift',
        { storyId: currentItem?.id || null }
      );
      if (res?.success) {
        handleSendReaction('💎');
        toast.success(`Sent 250 Coins to ${currentStory?.user?.name}!`);
      } else {
        toast.error(res?.message || 'Gift could not be sent');
      }
    } catch (err) {
      toast.error(err?.message || 'Gift could not be sent');
    } finally {
      setGifting(false);
    }
  };

  const [replying, setReplying] = useState(false);
  const handleSendReply = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || replying) return;
    if (!currentItem?.id) { toast.error('Vibe not found'); return; }
    setReplying(true);
    try {
      await getStoryService().replyToStory(currentItem.id, text);
      toast.success(`Reply sent to ${currentStory?.user?.name}`);
      setReplyText('');
    } catch (err) {
      toast.error(err?.message || 'Reply could not be sent');
    } finally {
      setReplying(false);
    }
  };

  const handleSubmitQuestionAnswer = async (e) => {
    e.preventDefault();
    const answer = questionAnswer.trim();
    if (!answer || submittingQuestion || !currentItem?.id) return;
    setSubmittingQuestion(true);
    try {
      const promptTitle = questionSticker?.data?.prompt || 'Q&A';
      await getStoryService().replyToStory(currentItem.id, `[Q&A: ${promptTitle}] ${answer}`);
      setQuestionAnswer('');
      toast.success('Answer sent!');
    } catch (err) {
      toast.error(err?.message || 'Could not send Q&A answer');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  return (
    <div
      className={cn(
        'min-h-screen w-full select-none transition-colors duration-300 pb-24',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-gray-900'
      )}
    >
      {/* ==================== TOP APP HEADER ==================== */}
      <header
        className={cn(
          'sticky top-0 z-30 px-4 pt-4 pb-3 flex items-center justify-between backdrop-blur-xl border-b transition-all',
          isDark
            ? 'bg-[#03071B]/90 border-white/5 shadow-2xl'
            : 'bg-white/90 border-gray-200/80 shadow-sm'
        )}
      >
        <div className="flex items-center gap-3">
          <ArvdoulLogo size={32} showWordmark={false} />
          <div className="flex flex-col">
            <h1 className={cn(
              "text-2xl font-black tracking-tight font-display",
              isDark ? "text-white" : "text-slate-900"
            )}>
              Vibes
            </h1>
            <div className="w-10 h-1 rounded-full mt-0.5" style={{ background: BRAND_GRADIENT }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStoriesNonce((n) => n + 1)}
            aria-label="Refresh Vibes feed"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <RefreshCw className={cn("w-4 h-4", storiesLoading && "animate-spin")} />
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            aria-label="Search Vibes"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/create-story')}
            aria-label="Create new Vibe"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleOpenArchive}
            aria-label="Vibe memories archive"
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer',
              isDark
                ? 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-200'
            )}
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ==================== EXPANDABLE SEARCH BAR ==================== */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 max-w-5xl mx-auto"
          >
            <div
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all',
                isDark
                  ? 'bg-white/5 border-white/10 focus-within:border-white/40'
                  : 'bg-white border-gray-300 focus-within:border-slate-500 shadow-sm'
              )}
            >
              <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                aria-label="Search friends, vibes, or moments"
                type="text"
                placeholder="Search creators, vibes, or moments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CATEGORY FILTER TABS ==================== */}
      <div className="px-4 py-3.5 overflow-x-auto no-scrollbar flex items-center gap-2 max-w-5xl mx-auto">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          const Icon = tab.icon;

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                'min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold tracking-wide whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
                isActive
                  ? 'text-white shadow-md'
                  : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
              )}
              style={isActive ? { background: BRAND_GRADIENT } : undefined}
            >
              {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== VIBES GRID ==================== */}
      <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
        {/* CREATE VIBE CARD */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/create-story')}
          className={cn(
            'relative aspect-[3/4.5] rounded-3xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden border-2 border-dashed text-center',
            isDark
              ? 'bg-[#0A102D] border-white/20 hover:border-white/40'
              : 'bg-white border-slate-300 hover:border-slate-500 shadow-sm'
          )}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-3 group-hover:scale-105 transition-transform"
            style={{ background: BRAND_GRADIENT }}
          >
            <Plus className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <span className={cn('text-sm font-bold tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
            Add Vibe
          </span>
          <span className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Share a moment
          </span>
        </motion.button>

        {storiesError && !storiesLoading && (
          <div className="col-span-2 sm:col-span-3">
            <ErrorState
              title="Could not load Vibes"
              message={storiesError}
              onRetry={() => setStoriesNonce((n) => n + 1)}
            />
          </div>
        )}

        {filteredStories.length === 0 && !storiesLoading && !storiesError && (
          <div className={cn(
            'col-span-1 sm:col-span-2 lg:col-span-3 aspect-[3/4.5] sm:aspect-auto rounded-3xl p-6 flex flex-col items-center justify-center text-center border',
            isDark ? 'bg-white/[0.03] border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
          )}>
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-800')}>
              No Vibes in feed yet
            </p>
            <p className="text-xs mt-1 max-w-[220px] leading-relaxed">
              Vibes stay active for 24 hours. Share yours to start the wave.
            </p>
          </div>
        )}

        {filteredStories.map((story, index) => (
          <motion.div
            key={story.id}
            role="button"
            tabIndex={0}
            aria-label={`Open Vibe by ${story.user.name}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleOpenStory(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenStory(index);
              }
            }}
            className={cn(
              'relative aspect-[3/4.5] rounded-3xl p-3 flex flex-col justify-between cursor-pointer transition-all group overflow-hidden border shadow-lg',
              isDark
                ? 'bg-[#0B112A] border-white/10 hover:border-white/30'
                : 'bg-white border-gray-200 hover:border-slate-400 shadow-sm'
            )}
          >
            {/* Card Background Thumbnail by Media Type */}
            {story.mediaType === 'text' ? (
              <div
                className="absolute inset-0 w-full h-full flex items-center justify-center p-4 text-center"
                style={{ background: story.backgroundColor || BRAND_GRADIENT }}
              >
                <p className="text-sm font-bold text-white line-clamp-4 leading-snug">
                  {story.caption || 'Text Vibe'}
                </p>
              </div>
            ) : story.mediaType === 'audio' ? (
              <div
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 p-4"
                style={{ background: story.backgroundColor || BRAND_GRADIENT }}
              >
                <Music className="w-8 h-8 text-white/90" aria-hidden="true" />
                {story.caption && (
                  <p className="text-xs font-semibold text-white/90 text-center line-clamp-2">{story.caption}</p>
                )}
              </div>
            ) : (
              <LazyImage
                src={story.mediaUrl}
                alt={story.caption || story.user.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85 pointer-events-none" />

            {/* Top Creator Meta & Unseen Ring */}
            <div className="relative z-10 flex items-start justify-between w-full gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    "relative p-0.5 rounded-full shrink-0",
                    !story.hasUnseen && "bg-white/30"
                  )}
                  style={story.hasUnseen ? { background: BRAND_GRADIENT } : undefined}
                >
                  <LazyImage
                    src={story.user.avatar}
                    alt={story.user.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover bg-slate-900"
                  />
                </div>

                <div className="flex flex-col leading-tight min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white truncate">
                      {story.user.name}
                    </span>
                    {story.user.verified && (
                      <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  {story.timeAgo && (
                    <span className="text-[10px] text-slate-300 font-medium">
                      {story.timeAgo}
                    </span>
                  )}
                </div>
              </div>

              {story.isSponsored && (
                <div className="px-1.5 py-0.5 rounded-md bg-amber-400 text-[9px] font-black text-slate-950 shrink-0">
                  AD
                </div>
              )}
            </div>

            {/* Bottom Media Badge & Segment Count */}
            <div className="relative z-10 flex items-center justify-between w-full pt-2">
              <div className="w-7 h-7 rounded-xl bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/90">
                {story.badgeType === 'video' && <Video className="w-3.5 h-3.5" aria-hidden="true" />}
                {story.badgeType === 'image' && <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
                {story.badgeType === 'audio' && <Music className="w-3.5 h-3.5" aria-hidden="true" />}
                {story.badgeType === 'text' && <Type className="w-3.5 h-3.5" aria-hidden="true" />}
                {story.badgeType === 'event' && <Calendar className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />}
              </div>

              {story.itemsCount > 1 && (
                <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full border border-white/15">
                  {Array.from({ length: Math.min(story.itemsCount, 6) }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        i === 0 ? 'bg-white' : 'bg-white/40'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ==================== FULLSCREEN IMMERSIVE VIBE VIEWER ==================== */}
      <AnimatePresence>
        {activeStoryIndex !== null && currentStory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
          >
            {/* Desktop Previous Creator Button */}
            {activeStoryIndex > 0 && !isHoldingChromeHidden && (
              <button
                type="button"
                onClick={handlePrevGroup}
                aria-label="Previous creator Vibes"
                className="hidden md:flex absolute left-6 z-40 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 items-center justify-center text-white cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Desktop Next Creator Button */}
            {activeStoryIndex + 1 < filteredStories.length && !isHoldingChromeHidden && (
              <button
                type="button"
                onClick={handleNextGroup}
                aria-label="Next creator Vibes"
                className="hidden md:flex absolute right-6 z-40 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 items-center justify-center text-white cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Centered 9:16 Stage Frame */}
            <div className="relative w-full h-full md:max-w-[460px] md:h-[92vh] md:rounded-3xl overflow-hidden bg-[#060918] flex flex-col justify-between md:border md:border-white/15 shadow-2xl">

              {/* Segmented Progress Bars */}
              <div className={cn(
                "absolute top-0 left-0 right-0 z-30 p-3 pt-4 flex gap-1.5 transition-opacity duration-150",
                isHoldingChromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
              )}>
                {currentStory.items?.map((item, idx) => {
                  const isPast = idx < activeItemIndex;
                  const isCurrent = idx === activeItemIndex;
                  return (
                    <div
                      key={item.id || idx}
                      className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-white transition-all ease-linear"
                        style={{
                          width: isPast ? '100%' : isCurrent ? `${storyProgress}%` : '0%',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Top Navigation Bar */}
              <div className={cn(
                "absolute top-7 left-0 right-0 z-30 px-4 flex items-center justify-between gap-2 transition-opacity duration-150",
                isHoldingChromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
              )}>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseStory();
                    navigate(`/profile/${currentStory.user.id}`);
                  }}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <LazyImage
                    src={currentStory.user.avatar}
                    alt={currentStory.user.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border-2 border-white/70 object-cover shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate drop-shadow">
                        {currentStory.user.name}
                      </span>
                      {currentStory.user.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                      )}
                      {currentStory.timeAgo && (
                        <span className="text-xs text-white/75 shrink-0">• {currentStory.timeAgo}</span>
                      )}
                    </div>
                    {activeLocationText && (
                      <span className="text-[11px] text-white/80 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {activeLocationText}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isOwnStory && (
                    <button
                      type="button"
                      onClick={handleOpenViewers}
                      aria-label="See who viewed this Vibe"
                      className="h-9 px-3 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center gap-1.5 text-white cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-bold">{currentItem?.views ?? currentStory.viewsCount ?? '—'}</span>
                    </button>
                  )}
                  {isOwnStory && (
                    <button
                      type="button"
                      onClick={handleOpenHighlightSheet}
                      aria-label="Save Vibe to Highlight"
                      className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  )}
                  {isOwnStory && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStory(true)}
                      aria-label="Delete this Vibe"
                      className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:text-red-400 cursor-pointer"
                    >
                      {deletingStory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleShareStory}
                    aria-label="Share this Vibe"
                    className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    aria-label={isMuted ? 'Unmute Vibe' : 'Mute Vibe'}
                    className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseStory}
                    aria-label="Close Vibes viewer"
                    className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Interactive Multi-Media Stage */}
              <div
                onMouseDown={handleStagePointerDown}
                onMouseUp={handleStagePointerEnd}
                onTouchStart={handleStagePointerDown}
                onTouchEnd={handleStagePointerEnd}
                className="relative w-full h-full flex items-center justify-center cursor-pointer"
                style={currentItem?.type === 'text' || currentItem?.type === 'audio' ? { background: currentItem.backgroundColor || BRAND_GRADIENT } : undefined}
              >
                {currentItem?.type === 'text' ? (
                  <div className="px-8 text-center max-w-md">
                    <p
                      className="text-2xl sm:text-3xl font-extrabold leading-snug drop-shadow-md"
                      style={{ color: currentItem.textColor || '#FFFFFF' }}
                    >
                      {currentItem.caption}
                    </p>
                  </div>
                ) : currentItem?.type === 'audio' ? (
                  <div className="flex flex-col items-center justify-center px-8 text-center gap-4">
                    <div className="w-24 h-24 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-xl flex items-center justify-center">
                      <Music className="w-10 h-10 text-white" aria-hidden="true" />
                    </div>
                    {currentItem.caption && (
                      <p className="text-lg font-bold text-white max-w-xs">{currentItem.caption}</p>
                    )}
                    <span className="text-xs font-medium text-white/75">
                      {isMuted ? 'Muted — tap speaker to hear' : 'Playing Audio Vibe'}
                    </span>
                  </div>
                ) : currentItem?.type === 'video' && (currentItem?.url || currentStory.mediaUrl) ? (
                  <video
                    ref={stageVideoRef}
                    src={currentItem?.url || currentStory.mediaUrl}
                    playsInline
                    autoPlay
                    muted={isMuted}
                    onEnded={() => {
                      if (currentItem?.id) {
                        getStoryService().reportStoryCompletion(currentItem.id).catch((e) => {
                          console.warn('[Vibes] completion not reported:', e?.message);
                        });
                      }
                      advanceItemOrGroup();
                    }}
                    className="max-h-full max-w-full w-full h-full object-contain"
                  />
                ) : currentItem?.url || currentStory.mediaUrl ? (
                  <LazyImage
                    src={currentItem?.url || currentStory.mediaUrl}
                    alt={currentItem?.caption ? `Vibe by ${currentStory.user.name}: ${currentItem.caption}` : `Vibe by ${currentStory.user.name}`}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center px-6" role="status">
                    <p className="text-white font-semibold mb-1">Vibe unavailable</p>
                    <p className="text-white/60 text-sm">
                      This Vibe has expired or is no longer available.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCloseStory(); }}
                      className="mt-4 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold"
                    >
                      Close
                    </button>
                  </div>
                )}

                {/* GIF Sticker Overlay */}
                {gifSticker?.data?.url && (
                  <div className="absolute top-24 right-4 z-20 w-24 rounded-2xl overflow-hidden border border-white/30 shadow-xl pointer-events-none">
                    <LazyImage src={gifSticker.data.url} alt={gifSticker.data.title || 'GIF sticker'} className="w-full h-auto" />
                  </div>
                )}

                {/* Countdown Sticker */}
                {countdownSticker && (() => {
                  const endsAt = countdownSticker.data?.endsAt || (Date.now() + (countdownSticker.data?.seconds || 0) * 1000);
                  const secsLeft = Math.max(0, Math.floor((endsAt - countdownNow) / 1000));
                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-28 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 text-white text-center shadow-xl"
                    >
                      <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider text-white/75 font-bold">
                        <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Countdown</span>
                      </div>
                      <p className="text-lg font-black tabular-nums mt-0.5">{formatCountdown(secsLeft)}</p>
                    </div>
                  );
                })()}

                {/* Interactive Poll Sticker */}
                {pollSticker && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-40 left-4 right-4 z-20"
                  >
                    <div className="bg-black/75 backdrop-blur-md rounded-2xl border border-white/20 p-3.5 text-white shadow-xl">
                      {poll.loading ? (
                        <div className="space-y-2">
                          <div className="h-4 w-3/4 rounded bg-white/10" />
                          <div className="h-9 rounded-xl bg-white/10" />
                        </div>
                      ) : poll.error ? (
                        <p className="text-xs text-red-300">{poll.error}</p>
                      ) : poll.data ? (
                        <>
                          <p className="text-sm font-bold mb-2.5 text-center">{poll.data.question}</p>
                          <div className="space-y-2">
                            {poll.data.options.map((opt, i) => {
                              const total = (poll.data.votes || []).reduce((a, b) => a + (b || 0), 0);
                              const count = poll.data.votes?.[i] || 0;
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              const revealed = poll.voted !== null;
                              return (
                                <button
                                  type="button"
                                  key={i}
                                  onClick={(e) => { e.stopPropagation(); handleVotePoll(i); }}
                                  disabled={revealed}
                                  className={cn(
                                    'relative w-full text-left rounded-xl px-3 py-2 text-xs font-semibold overflow-hidden border transition-colors cursor-pointer',
                                    revealed
                                      ? (poll.voted === i ? 'border-white bg-white/20' : 'border-white/10 bg-white/5')
                                      : 'border-white/20 bg-white/10 hover:bg-white/20'
                                  )}
                                >
                                  {revealed && (
                                    <span
                                      className="absolute inset-y-0 left-0 opacity-30"
                                      style={{ width: `${pct}%`, background: BRAND_GRADIENT }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="relative flex items-center justify-between">
                                    <span>{opt}{poll.voted === i ? ' ✓' : ''}</span>
                                    {revealed && <span className="text-white/80 tabular-nums">{pct}%</span>}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Interactive Q&A Sticker */}
                {questionSticker && !pollSticker && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-40 left-4 right-4 z-20"
                  >
                    <form
                      onSubmit={handleSubmitQuestionAnswer}
                      className="bg-black/75 backdrop-blur-md rounded-2xl border border-white/20 p-3.5 text-white shadow-xl space-y-2.5"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white/80">
                        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{questionSticker.data.prompt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          aria-label="Answer Q&A prompt"
                          value={questionAnswer}
                          onChange={(e) => setQuestionAnswer(e.target.value)}
                          placeholder="Type your answer..."
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-white/50"
                        />
                        <button
                          type="submit"
                          disabled={!questionAnswer.trim() || submittingQuestion}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                          style={{ background: BRAND_GRADIENT }}
                        >
                          {submittingQuestion ? '…' : 'Send'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Mention, Music, & Link Pills */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "absolute bottom-28 left-4 right-4 z-20 flex flex-wrap items-center gap-2 transition-opacity",
                    isHoldingChromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}
                >
                  {currentItem?.music?.title && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                      <Music className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="truncate max-w-[160px]">{currentItem.music.title}</span>
                    </span>
                  )}
                  {mentionSticker?.data?.handle && (
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseStory();
                        navigate(`/profile/${mentionSticker.data.handle}`);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-bold text-white cursor-pointer"
                    >
                      <AtSign className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{mentionSticker.data.handle}</span>
                    </button>
                  )}
                  {activeLinkUrl && (
                    <a
                      href={activeLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-950 text-xs font-bold shadow-lg"
                    >
                      <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open link</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                {/* Caption Overlay (Non-text Vibes) */}
                {currentItem?.type !== 'text' && currentItem?.caption && (
                  <div className={cn(
                    "absolute bottom-20 left-4 right-4 z-20 transition-opacity",
                    isHoldingChromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}>
                    <div className="bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-white text-xs sm:text-sm">
                      {currentItem.caption}
                    </div>
                  </div>
                )}

                {/* Flying Reactions */}
                {flyingParticles.map((particle) => (
                  <motion.div
                    key={particle.id}
                    initial={{ opacity: 1, y: 100, scale: 1 }}
                    animate={{ opacity: 0, y: -380, scale: 1.8 }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                    className="absolute bottom-20 text-4xl pointer-events-none z-40"
                    style={{ left: `${particle.x}%` }}
                  >
                    {particle.emoji}
                  </motion.div>
                ))}
              </div>

              {/* Bottom Action Rail */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 z-30 p-3.5 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-2.5 transition-opacity",
                isHoldingChromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
              )}>
                {currentStory?.isSponsored && (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl">
                    <div className="min-w-0 pr-2">
                      <span className="text-[11px] font-bold text-amber-300 block">Sponsored</span>
                      <span className="text-xs text-white/85 truncate block">
                        {currentStory.caption || 'Explore featured partner'}
                      </span>
                    </div>
                    {currentStory.ctaUrl && (
                      <a
                        href={currentStory.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            getMonetizationService().recordAdImpression(currentStory.id, 'stories_click');
                          } catch (err) {
                            console.warn('Story click impression not recorded', err?.message);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl text-white text-xs font-bold whitespace-nowrap shadow-md"
                        style={{ background: BRAND_GRADIENT }}
                      >
                        {currentStory.ctaText || 'Learn More'}
                      </a>
                    )}
                  </div>
                )}

                {/* Quick Reactions & Gift */}
                <div className="flex items-center justify-between px-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      aria-label={`React with ${emoji}`}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-2xl hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  {!isOwnStory && (
                    <button
                      type="button"
                      onClick={handleGiftCoin}
                      disabled={gifting}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 flex items-center gap-1 shadow-lg disabled:opacity-60 cursor-pointer"
                    >
                      <span>{gifting ? 'Sending…' : 'Gift 250'}</span>
                    </button>
                  )}
                </div>

                {/* Reply Bar */}
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <input
                    aria-label="Send a reply"
                    type="text"
                    placeholder={`Reply to ${currentStory.user.name}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setIsPaused(true)}
                    onBlur={() => setIsPaused(false)}
                    className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white/50"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || replying}
                    aria-label="Send reply"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-opacity shadow-lg cursor-pointer"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Owner-only Viewers Sheet */}
              <AnimatePresence>
                {viewersOpen && (
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="absolute inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-3xl bg-[#0A102D]/98 backdrop-blur-xl border-t border-white/10 flex flex-col"
                    role="dialog"
                    aria-label="Vibe viewers"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2 text-white">
                        <Users className="w-4 h-4 text-white/80" />
                        <span className="font-bold text-sm">
                          {viewers.loading ? 'Viewers' : `${viewers.items.length} ${viewers.items.length === 1 ? 'viewer' : 'viewers'}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setViewersOpen(false); setIsPaused(false); }}
                        aria-label="Close viewers"
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="overflow-y-auto p-2">
                      {viewers.loading ? (
                        <div className="flex items-center justify-center py-10 text-white/60 gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" /> Loading viewers…
                        </div>
                      ) : viewers.error ? (
                        <div className="text-center py-10 px-6">
                          <p className="text-white font-semibold">Could not load viewers</p>
                          <p className="text-white/50 text-sm mt-1">{viewers.error}</p>
                          <button
                            type="button"
                            onClick={handleOpenViewers}
                            className="mt-4 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold"
                          >
                            Retry
                          </button>
                        </div>
                      ) : viewers.items.length === 0 ? (
                        <div className="text-center py-10 px-6">
                          <p className="text-white font-semibold">No views yet</p>
                          <p className="text-white/50 text-sm mt-1">Viewers will appear here once people watch this Vibe.</p>
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {viewers.items.map((v) => (
                            <li key={v.userId}>
                              <button
                                type="button"
                                onClick={() => { setViewersOpen(false); navigate(`/profile/${v.userId}`); }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/5 text-left cursor-pointer"
                              >
                                <LazyImage
                                  src={v.avatar}
                                  alt={v.name}
                                  className="w-11 h-11 rounded-full object-cover border border-white/10"
                                  onError={(e) => { e.target.src = getSafeAvatarUrl(null, v.name, v.userId); }}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{v.name}</p>
                                  {v.handle && <p className="text-xs font-mono text-white/50 truncate">@{v.handle}</p>}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Owner-only Save to Highlight Sheet */}
              <AnimatePresence>
                {highlightSheetOpen && (
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="absolute inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-3xl bg-[#0A102D]/98 backdrop-blur-xl border-t border-white/10 flex flex-col"
                    role="dialog"
                    aria-label="Save Vibe to Highlight"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2 text-white">
                        <Bookmark className="w-4 h-4 text-white/80" />
                        <span className="font-bold text-sm">Save to Highlight</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setHighlightSheetOpen(false); setIsPaused(false); }}
                        aria-label="Close save to highlight"
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto">
                      <form onSubmit={handleCreateAndSaveHighlight} className="flex gap-2">
                        <input
                          type="text"
                          aria-label="New highlight title"
                          value={newHighlightTitle}
                          onChange={(e) => setNewHighlightTitle(e.target.value)}
                          placeholder="New highlight title..."
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/50"
                        />
                        <button
                          type="submit"
                          disabled={!newHighlightTitle.trim() || savingHighlight}
                          className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                          style={{ background: BRAND_GRADIENT }}
                        >
                          {savingHighlight ? 'Saving…' : 'Create'}
                        </button>
                      </form>

                      {highlightsLoading ? (
                        <div className="flex items-center justify-center py-6 text-white/60 gap-2 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading Highlights…
                        </div>
                      ) : myHighlights.length === 0 ? (
                        <p className="text-xs text-white/60 text-center py-4">No existing Highlights yet. Create one above.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {myHighlights.map((hl) => (
                            <button
                              type="button"
                              key={hl.id}
                              disabled={savingHighlight}
                              onClick={() => handleSaveToExistingHighlight(hl.id)}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-left text-sm text-white transition-colors cursor-pointer"
                            >
                              <span className="font-semibold truncate">{hl.title || hl.name || 'Highlight'}</span>
                              <Plus className="w-4 h-4 text-white/60 shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== MEMORIES / ARCHIVE MODAL ==================== */}
      <AnimatePresence>
        {isCalendarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              className={cn(
                'w-full max-w-md rounded-3xl p-6 border shadow-2xl',
                isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                  <h3 className="text-lg font-bold">Vibe Memories &amp; Archive</h3>
                </div>
                <button
                  type="button"
                  aria-label="Close Vibe archive"
                  onClick={() => setIsCalendarOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Your saved Vibes, preserved past their 24-hour feed window.
              </p>

              {archive.loading ? (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : archive.error ? (
                <div className="mb-4 text-center py-6">
                  <p className="text-xs text-red-400 mb-2">{archive.error}</p>
                  <button
                    type="button"
                    onClick={handleOpenArchive}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    Retry
                  </button>
                </div>
              ) : archive.items.length === 0 ? (
                <div className="mb-4 text-center py-6">
                  <p className="text-xs text-slate-400">No archived Vibes yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Vibes you publish are saved here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-4 max-h-56 overflow-y-auto">
                  {archive.items.slice(0, 12).map((st) => {
                    const url = st.media?.url || st.mediaUrl;
                    return (
                      <div key={st.id} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                        {url ? (
                          <LazyImage src={url} alt={st.content || 'Archived Vibe'} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 px-1 text-center">
                            {st.content || 'Text Vibe'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsCalendarOpen(false);
                  navigate('/profile/highlights');
                }}
                className="w-full min-h-[44px] py-3 rounded-2xl text-white font-bold text-sm shadow-lg active:scale-95 transition-transform cursor-pointer"
                style={{ background: BRAND_GRADIENT }}
              >
                Manage Profile Highlights
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owner-only delete confirmation */}
      <AnimatePresence>
        {confirmDeleteStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setConfirmDeleteStory(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-label="Delete Vibe confirmation"
              className="w-full max-w-sm rounded-3xl p-6 border bg-[#0A102D] border-white/10 text-white shadow-2xl"
            >
              <h3 className="text-lg font-bold">Delete this Vibe?</h3>
              <p className="text-sm text-white/60 mt-1.5">
                This removes the Vibe from your feed and deletes its media. This cannot be undone.
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteStory(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => { setConfirmDeleteStory(false); await handleDeleteStory(); }}
                  disabled={deletingStory}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 font-bold text-sm disabled:opacity-50 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
