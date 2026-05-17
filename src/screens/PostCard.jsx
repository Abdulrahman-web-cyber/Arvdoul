// src/screens/PostCard.jsx – ARVDOUL KING 👑 EDITION (FINAL)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import firestoreService from '../services/firestoreService.js';
import * as userService from '../services/userService.js';
import * as monetizationService from '../services/monetizationService.js';
import notificationService from '../services/notificationsService.js';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Heart, MessageCircle, Share2, Bookmark, MoreVertical, Play, Pause,
  Volume2, VolumeX, Download, ChevronLeft, ChevronRight, Smile, Gift,
  MapPin, Calendar, Link as LinkIcon, HelpCircle, BarChart2, Music,
  Video, Image, ExternalLink, Copy, Quote, Clock, AlertTriangle
} from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------
// ERROR BOUNDARY
// ------------------------------------------------------------------
class PostErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('PostCard error:', error, errorInfo);
  }
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[22px] p-8 text-center bg-red-50 dark:bg-red-950/30 my-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400 font-medium">Failed to load post</p>
          <p className="text-xs text-gray-500 mt-1">{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={this.handleRetry}
            className="mt-4 px-5 py-2 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ------------------------------------------------------------------
// REACTIONS
// ------------------------------------------------------------------
const REACTIONS = [
  { emoji: '👍', label: 'Like', value: 'like' },
  { emoji: '❤️', label: 'Love', value: 'love' },
  { emoji: '😂', label: 'Haha', value: 'haha' },
  { emoji: '😮', label: 'Wow', value: 'wow' },
  { emoji: '😢', label: 'Sad', value: 'sad' },
  { emoji: '😡', label: 'Angry', value: 'angry' },
  { emoji: '🔥', label: 'Fire', value: 'fire' },
  { emoji: '🎉', label: 'Celebrate', value: 'celebrate' },
];

// ------------------------------------------------------------------
// DOUBLE TAP HEART
// ------------------------------------------------------------------
const DoubleTapHeart = ({ position }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 2.5, opacity: [0, 1, 0] }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="fixed pointer-events-none z-[9999]"
    style={{ left: position.x - 40, top: position.y - 40 }}
  >
    <FaHeart className="w-20 h-20 text-red-500 fill-current drop-shadow-2xl" />
  </motion.div>
);

// ------------------------------------------------------------------
// REACTIONS POPUP (smart positioning for small screens)
// ------------------------------------------------------------------
const ReactionsPopup = ({ onSelect, theme, onClose, triggerRect }) => {
  const ref = useRef();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (triggerRect) {
      const viewportWidth = window.innerWidth;
      const popupWidth = 280; // approximate
      let left = triggerRect.left + triggerRect.width / 2 - popupWidth / 2;
      left = Math.max(10, Math.min(left, viewportWidth - popupWidth - 10));
      setPosition({
        top: triggerRect.top - 70,
        left: left,
      });
    }
  }, [triggerRect]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.8, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 10 }}
      transition={{ type: "spring", damping: 25, stiffness: 350 }}
      className={cn(
        "fixed z-[999] flex gap-2 p-2 rounded-full shadow-xl backdrop-blur-xl border",
        theme === 'dark' ? 'bg-gray-900/90 border-gray-700' : 'bg-white/90 border-gray-200'
      )}
      style={{ top: position.top, left: position.left }}
    >
      {REACTIONS.map((r) => (
        <button
          key={r.value}
          onClick={() => { onSelect(r); onClose(); }}
          className="text-2xl hover:scale-125 transition-transform duration-150 active:scale-90 px-1"
        >
          {r.emoji}
        </button>
      ))}
    </motion.div>
  );
};

// ------------------------------------------------------------------
// MEDIA GALLERY (edge-to-edge, no borders)
// ------------------------------------------------------------------
const MediaGallery = ({ media, type, onDoubleTap, isVisible }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (type !== 'video' || !videoRef.current) return;
    if (isVisible && isPlaying) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  }, [isVisible, isPlaying, type]);

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      setVideoProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleSave = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `arvdoul_media_${Date.now()}.${url.split('?')[0].split('.').pop()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Saved to downloads');
  };

  const handlePrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const handleNext = () => setCurrentIndex(Math.min(media.length - 1, currentIndex + 1));
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) diff > 0 ? handlePrev() : handleNext();
  };

  if (type === 'video' && media[0]) {
    return (
      <div className="relative bg-black" onDoubleClick={onDoubleTap}>
        <video
          ref={videoRef}
          src={media[0].url}
          className="w-full h-auto max-h-[70vh] object-cover"
          playsInline
          loop={false}
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
        />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${videoProgress}%` }} />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => handleSave(media[0].url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (media.length === 1) {
    return (
      <div className="relative" onDoubleClick={onDoubleTap}>
        <img src={media[0].url} alt="" className="w-full h-auto max-h-[70vh] object-cover" loading="lazy" decoding="async" />
        <button onClick={() => handleSave(media[0].url)} className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 hover:opacity-100 transition">
          <Download className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onDoubleClick={onDoubleTap}>
      <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {media.map((item, idx) => (
          <img key={idx} src={item.url} alt="" className="w-full flex-shrink-0 h-auto max-h-[70vh] object-cover" loading="lazy" decoding="async" />
        ))}
      </div>
      {media.length > 1 && (
        <>
          <button onClick={handlePrev} disabled={currentIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={handleNext} disabled={currentIndex === media.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
            {media.map((_, idx) => (
              <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => handleSave(media[currentIndex].url)} className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 hover:opacity-100 transition">
            <Download className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// POLL COMPONENT (clean, no borders)
// ------------------------------------------------------------------
const PollComponent = ({ poll, postId, currentUser, theme }) => {
  const [voted, setVoted] = useState(false);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(() => {
    const opts = poll.options.map((opt, i) => ({
      id: i,
      text: opt.text || opt,
      votes: opt.votes || 0,
    }));
    const total = opts.reduce((sum, o) => sum + o.votes, 0);
    return opts.map(o => ({ ...o, percentage: total ? Math.round((o.votes / total) * 100) : 0 }));
  });

  const handleVote = async (index) => {
    if (!currentUser?.uid) return toast.error('Sign in to vote');
    if (voted && !poll.allowMultiple) return toast.error('You already voted');
    try {
      const result = await firestoreService.voteOnPoll(postId, currentUser.uid, index, poll.allowMultiple);
      if (result.success) {
        setVoted(true);
        setSelected(index);
        const newResults = [...results];
        newResults[index].votes += 1;
        const newTotal = newResults.reduce((sum, o) => sum + o.votes, 0);
        newResults.forEach(o => o.percentage = Math.round((o.votes / newTotal) * 100));
        setResults(newResults);
        toast.success('Vote recorded!');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="px-4 py-3">
      <h4 className="text-[15px] font-semibold mb-2">{poll.question}</h4>
      <div className="space-y-2">
        {results.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleVote(idx)}
            disabled={voted && !poll.allowMultiple}
            className={`w-full p-3 rounded-xl text-left relative overflow-hidden transition-all ${
              voted && idx === selected ? 'bg-purple-500/10' : 'bg-black/5 dark:bg-white/5'
            }`}
          >
            <div className="flex justify-between items-center text-sm">
              <span>{opt.text}</span>
              {voted && <span className="font-semibold text-purple-500">{opt.percentage}%</span>}
            </div>
            {voted && (
              <div className="absolute bottom-0 left-0 h-0.5 bg-purple-500 transition-all" style={{ width: `${opt.percentage}%` }} />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">{results.reduce((sum, o) => sum + o.votes, 0)} total votes</p>
    </div>
  );
};

// ------------------------------------------------------------------
// QUESTION COMPONENT
// ------------------------------------------------------------------
const QuestionComponent = ({ question, postId, currentUser, theme, answerCount, onAnswer }) => {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to answer');
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await firestoreService.answerQuestion(postId, currentUser.uid, answer.trim());
      toast.success('Answer submitted!');
      setAnswer('');
      onAnswer?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <h4 className="text-[15px] font-semibold mb-2">{question}</h4>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer..."
        rows={2}
        className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/5 border-0 resize-none text-sm focus:ring-1 focus:ring-amber-500 outline-none"
      />
      <div className="flex items-center justify-between mt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !answer.trim()}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
        <span className="text-xs text-gray-500">{answerCount || 0} answers</span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// EVENT COMPONENT (clean)
// ------------------------------------------------------------------
const EventComponent = ({ event, theme }) => {
  const [going, setGoing] = useState(false);
  const formatEventDate = (date) => {
    if (!date) return 'TBA';
    const d = date.toDate ? date.toDate() : new Date(date);
    return format(d, 'PPPp');
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <Calendar className="w-5 h-5 text-orange-500" />
        <h4 className="text-[15px] font-semibold">{event.title || 'Event'}</h4>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{formatEventDate(event.startTime || event.startDate || event.date)}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{event.location}</span>
          </div>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
        <button
          onClick={() => setGoing(!going)}
          className="mt-2 px-4 py-1.5 rounded-full text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
        >
          {going ? "Going ✓" : "Mark as Going"}
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// LINK COMPONENT
// ------------------------------------------------------------------
const LinkComponent = ({ link, theme }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied');
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <LinkIcon className="w-5 h-5 text-indigo-500" />
        <h4 className="font-semibold text-[15px] truncate">{link.title || link.url}</h4>
      </div>
      {link.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{link.description}</p>}
      <div className="flex gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-1.5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center gap-1 hover:bg-indigo-600 transition"
        >
          <ExternalLink className="w-3 h-3" /> Visit
        </a>
        <button onClick={handleCopy} className="px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 text-xs">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// AUDIO COMPONENT (with progress)
// ------------------------------------------------------------------
const AudioComponent = ({ audio, isVisible }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef();

  useEffect(() => {
    if (isVisible && playing) audioRef.current?.play();
    else audioRef.current?.pause();
  }, [isVisible, playing]);

  const togglePlay = () => setPlaying(!playing);
  const formatTime = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
        <button onClick={togglePlay} className="p-2 rounded-full bg-indigo-500 text-white shadow-md">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium truncate">{audio.name || 'Audio'}</div>
          <div className="h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{formatTime(currentTime)} / {formatTime(duration)}</div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// TEXT POST BACKGROUNDS (king‑level subtle gradients)
// ------------------------------------------------------------------
const TEXT_BACKGROUNDS = [
  'from-zinc-900 via-zinc-800 to-black',
  'from-slate-900 via-slate-800 to-gray-900',
  'from-neutral-900 via-neutral-800 to-stone-900',
  'from-gray-900 via-gray-800 to-gray-900',
  'from-[#1a1d24] via-[#20242c] to-[#15181e]',
  'from-[#0f1115] via-[#161a20] to-[#0b0d11]',
];

const getRandomBackground = (seed) => {
  const safeSeed = String(seed || 'arvdoul');
  const hash = safeSeed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const index = Math.abs(hash) % TEXT_BACKGROUNDS.length;
  return TEXT_BACKGROUNDS[index];
};

const TextBackgroundCard = ({ post }) => {
  const bgClass = getRandomBackground(post.id || post.userId);
  return (
    <div className={cn("relative w-full overflow-hidden py-8 px-4 bg-gradient-to-br", bgClass, "min-h-[180px] flex items-center")}>
      <div className="relative z-10 w-full text-white">
        {(post.hashtags || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {post.hashtags.map(tag => (
              <span key={tag} className="text-xs bg-white/10 rounded-full px-2 py-0.5">#{tag}</span>
            ))}
          </div>
        )}
        <p className="font-medium leading-relaxed text-xl break-words">{post.content}</p>
        <div className="mt-3 flex justify-end opacity-50"><Quote className="w-5 h-5" /></div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// MAIN POST CARD – KING EDITION (no borders, immersive)
// ------------------------------------------------------------------
function PostCardContent({ post, currentUser, onOpenComments, onOpenOptions, navigate }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [postData, setPostData] = useState(() => ({
    ...post,
    stats: post.stats || { likes: 0, comments: 0, shares: 0, reactions: {} },
    media: post.media || [],
    hashtags: post.hashtags || [],
    likedBy: post.likedBy || [],
    savedBy: post.savedBy || [],
  }));
  const [isLiked, setIsLiked] = useState(postData.likedBy.includes(currentUser?.uid));
  const [isSaved, setIsSaved] = useState(postData.savedBy.includes(currentUser?.uid));
  const [followState, setFollowState] = useState('none');
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [showReactionsPopup, setShowReactionsPopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [answerCount, setAnswerCount] = useState(postData.stats?.answerCount || 0);
  const [likeCount, setLikeCount] = useState(postData.stats.likes);
  const [commentCount, setCommentCount] = useState(postData.stats.comments);
  const [shareCount, setShareCount] = useState(postData.stats.shares);

  const cardRef = useRef(null);
  const reactionsButtonRef = useRef(null);
  const lastTapRef = useRef(0);
  const touchTimer = useRef(null);

  const isAuthor = currentUser?.uid === postData.authorId;
  const isCreator = (postData.authorLevel || 1) >= 5;

  // Follow logic
  useEffect(() => {
    if (!isAuthor && currentUser?.uid) {
      userService.getFollowStatus(currentUser.uid, postData.authorId).then(res => {
        if (res.isFollowing) setFollowState('following');
      });
    }
  }, [postData.authorId, currentUser, isAuthor]);

  const handleFollow = async () => {
    if (!currentUser) return toast.error('Sign in');
    const original = followState;
    setFollowState(original === 'following' ? 'none' : 'following');
    try {
      if (original === 'following') {
        await userService.unfollowUser(currentUser.uid, postData.authorId);
        toast.success(`Unfollowed ${postData.authorName}`);
      } else {
        await userService.followUser(currentUser.uid, postData.authorId);
        toast.success(`Following ${postData.authorName}`);
        notificationService.sendNotification({
          type: 'follow',
          recipientId: postData.authorId,
          senderId: currentUser.uid,
        }).catch(console.warn);
      }
    } catch (err) {
      setFollowState(original);
      toast.error('Action failed');
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUser) return toast.error('Sign in');
    const original = followState;
    let newState;
    if (original === 'friends') newState = 'none';
    else if (original === 'requested') newState = 'none';
    else newState = 'requested';
    setFollowState(newState);
    try {
      if (original === 'friends') {
        await userService.unfollowUser(currentUser.uid, postData.authorId);
        await userService.unfollowUser(postData.authorId, currentUser.uid);
        toast.success('Friend removed');
      } else if (original === 'requested') {
        await userService.declineFriendRequest(postData.authorId, currentUser.uid);
        toast.success('Request cancelled');
      } else {
        await userService.sendFriendRequest(currentUser.uid, postData.authorId);
        toast.success('Friend request sent');
      }
    } catch (err) {
      setFollowState(original);
      toast.error('Request failed');
    }
  };

  // Like, Save, Share
  const handleLike = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    const originalLiked = isLiked;
    setIsLiked(!originalLiked);
    setLikeCount(prev => originalLiked ? prev - 1 : prev + 1);
    try {
      const result = await firestoreService.likePost(postData.id, currentUser.uid);
      setLikeCount(result.stats.likes);
      if (!originalLiked && postData.authorId !== currentUser.uid) {
        notificationService.sendNotification({
          type: 'like',
          recipientId: postData.authorId,
          senderId: currentUser.uid,
          targetId: postData.id,
        }).catch(console.warn);
      }
    } catch (err) {
      setIsLiked(originalLiked);
      setLikeCount(prev => originalLiked ? prev + 1 : prev - 1);
      toast.error('Failed to like');
    }
  }, [currentUser, isLiked, postData.id, postData.authorId]);

  const handleSave = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    const original = isSaved;
    setIsSaved(!original);
    try {
      await firestoreService.savePost(postData.id, currentUser.uid);
      toast.success(original ? 'Removed from saved' : 'Post saved');
    } catch (err) {
      setIsSaved(original);
      toast.error('Failed to save');
    }
  }, [currentUser, isSaved, postData.id]);

  const handleShare = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    setShareCount(prev => prev + 1);
    try {
      await firestoreService.sharePost(postData.id, currentUser.uid);
      if (navigator.share) {
        await navigator.share({
          title: postData.content?.slice(0, 100) || 'Arvdoul post',
          text: postData.content,
          url: `${window.location.origin}/post/${postData.id}`,
        });
      } else {
        navigator.clipboard.writeText(`${window.location.origin}/post/${postData.id}`);
        toast.success('Link copied to clipboard');
      }
      toast.success('Post shared!');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setShareCount(prev => prev - 1);
        toast.error('Failed to share');
      }
    }
  }, [currentUser, postData.id, postData.content]);

  const handleSendGift = async () => {
    if (!currentUser) return toast.error('Sign in');
    try {
      await monetizationService.sendGift(currentUser.uid, postData.id, 'rose');
      setPostData(prev => ({
        ...prev,
        stats: { ...prev.stats, gifts: (prev.stats.gifts || 0) + 1, giftValue: (prev.stats.giftValue || 0) + 5 },
      }));
      toast.success('Gift sent!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Double tap & long press
  const handleDoubleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      handleLike();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
    }
    lastTapRef.current = now;
  }, [handleLike]);

  const openReactionsPopup = () => {
    if (reactionsButtonRef.current) {
      const rect = reactionsButtonRef.current.getBoundingClientRect();
      setTriggerRect(rect);
      setShowReactionsPopup(true);
    }
  };
  const closeReactionsPopup = () => setShowReactionsPopup(false);
  const longPressStart = () => { touchTimer.current = setTimeout(openReactionsPopup, 400); };
  const longPressEnd = () => { clearTimeout(touchTimer.current); closeReactionsPopup(); };

  const handleReactionSelect = (reaction) => {
    handleLike();
    toast.success(`Reacted with ${reaction.label}`);
  };

  // Visibility for video/audio autoplay
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCardVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Posted date
  const postedDateTime = useMemo(() => {
    try {
      const date = postData.createdAt?.toDate?.() || new Date(postData.createdAt);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'just now';
    }
  }, [postData.createdAt]);

  if (!postData.id) return null;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "overflow-hidden my-3 rounded-[22px]",
        isDark
          ? "bg-[#0b0d11] shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          : "bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
      )}
      onDoubleClick={handleDoubleTap}
    >
      {/* HEADER – floating, no lines */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => navigate(`/profile/${postData.authorId}`)} className="flex-shrink-0">
              <img
                src={postData.authorPhoto || '/assets/default-profile.png'}
                alt={postData.authorName}
                className="w-10 h-10 rounded-full object-cover"
                loading="lazy"
              />
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => navigate(`/profile/${postData.authorId}`)} className="text-left w-full">
                <div className="flex items-center gap-1 flex-wrap">
                  <h3 className="text-[15px] font-semibold tracking-tight truncate">{postData.authorName}</h3>
                  {postData.authorVerified && (
                    <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M22.5 12.5c0-1.58-.87-2.95-2.16-3.7.08-.42.13-.86.13-1.3 0-3.87-3.13-7-7-7-2.33 0-4.37 1.14-5.67 2.87-.85-.25-1.74-.37-2.66-.37-4.14 0-7.5 3.36-7.5 7.5 0 2.41 1.14 4.55 2.87 5.92-.04.35-.06.7-.06 1.06 0 3.87 3.13 7 7 7 1.5 0 2.89-.46 4.02-1.24.77.41 1.64.64 2.58.64 3.87 0 7-3.13 7-7 0-.37-.02-.73-.06-1.08 1.35-1.15 2.19-2.88 2.19-4.78z"/></svg>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  @{postData.authorUsername} · {postedDateTime}
                </p>
                {postData.location && (
                  <p className="text-xs flex items-center gap-1 mt-1 text-gray-500">
                    <MapPin className="w-3 h-3" /> {postData.location}
                  </p>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isAuthor && currentUser && (
              <button
                onClick={isCreator ? handleFollow : handleFriendRequest}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  followState === 'following' ? (isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700") :
                  followState === 'friends' ? "bg-green-500 text-white" :
                  followState === 'requested' ? "bg-amber-500 text-white" :
                  isDark
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                )}
              >
                {followState === 'following' ? 'Following' :
                 followState === 'friends' ? 'Friends' :
                 followState === 'requested' ? 'Requested' : (isCreator ? 'Follow' : 'Add Friend')}
              </button>
            )}
            <button onClick={() => onOpenOptions?.(postData)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* BADGE (only if not text) */}
      {postData.type !== 'text' && postData.type !== 'ad' && (
        <div className="px-4 pt-1 pb-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-xs font-medium">
            {postData.type === 'image' && <Image className="w-3 h-3" />}
            {postData.type === 'video' && <Video className="w-3 h-3" />}
            {postData.type === 'poll' && <BarChart2 className="w-3 h-3" />}
            {postData.type === 'question' && <HelpCircle className="w-3 h-3" />}
            {postData.type === 'link' && <LinkIcon className="w-3 h-3" />}
            {postData.type === 'event' && <Calendar className="w-3 h-3" />}
            {postData.type === 'audio' && <Music className="w-3 h-3" />}
            {postData.type}
          </span>
        </div>
      )}

      {/* TEXT POST (full width background) */}
      {postData.type === 'text' && (!postData.media || postData.media.length === 0) && (
        <TextBackgroundCard post={postData} />
      )}

      {/* REGULAR CONTENT (non‑text posts) */}
      {postData.content && postData.type !== 'text' && (
        <div className="px-4 py-2">
          <p className="text-[15px] leading-relaxed break-words">{postData.content}</p>
          {postData.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {postData.hashtags.map((tag) => (
                <span key={tag} className="text-blue-500 text-xs cursor-pointer hover:underline">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MEDIA (edge-to-edge) */}
      {postData.media?.length > 0 && postData.type !== 'audio' && (
        <MediaGallery
          media={postData.media}
          type={postData.type}
          onDoubleTap={handleDoubleTap}
          isVisible={isCardVisible}
        />
      )}

      {/* INTERACTIVE COMPONENTS */}
      {postData.type === 'poll' && postData.poll && (
        <PollComponent poll={postData.poll} postId={postData.id} currentUser={currentUser} theme={theme} />
      )}
      {postData.type === 'question' && (
        <QuestionComponent
          question={postData.question}
          postId={postData.id}
          currentUser={currentUser}
          theme={theme}
          answerCount={answerCount}
          onAnswer={() => setAnswerCount(prev => prev + 1)}
        />
      )}
      {postData.type === 'event' && postData.event && (
        <EventComponent event={postData.event} theme={theme} />
      )}
      {postData.type === 'link' && postData.link && (
        <LinkComponent link={postData.link} theme={theme} />
      )}
      {postData.type === 'audio' && postData.media?.[0] && (
        <AudioComponent audio={postData.media[0]} isVisible={isCardVisible} />
      )}

      {/* STATS BAR – minimal */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            {isLiked ? <FaHeart className="w-4 h-4 text-red-500 fill-current" /> : <FaRegHeart className="w-4 h-4" />}
            <span className="text-gray-700 dark:text-gray-300 font-medium">{likeCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" />
            <span className="text-gray-700 dark:text-gray-300 font-medium">{commentCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Share2 className="w-4 h-4" />
            <span className="text-gray-700 dark:text-gray-300 font-medium">{shareCount}</span>
          </div>
        </div>
      </div>

      {/* ACTION BAR – clean, horizontal */}
      <div className="flex justify-around px-2 py-2 border-t border-black/5 dark:border-white/5">
        <button
          ref={reactionsButtonRef}
          onTouchStart={longPressStart}
          onTouchEnd={longPressEnd}
          className="flex items-center gap-2 py-2 px-4 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <Smile className={`w-5 h-5 ${isLiked ? 'text-red-500' : ''}`} />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">React</span>
        </button>

        <button
          onClick={() => onOpenComments?.(postData)}
          className="flex items-center gap-2 py-2 px-4 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Comment</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 py-2 px-4 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <Share2 className="w-5 h-5" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Share</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 py-2 px-4 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-yellow-500 text-yellow-500' : ''}`} />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {isCreator && !isAuthor && (
          <button
            onClick={handleSendGift}
            className="flex items-center gap-2 py-2 px-4 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <Gift className="w-5 h-5" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Gift</span>
          </button>
        )}
      </div>

      {/* Double‑tap heart burst */}
      <AnimatePresence>
        {showHeartBurst && <DoubleTapHeart position={tapPosition} />}
      </AnimatePresence>

      {/* Reactions popup (smart position) */}
      <AnimatePresence>
        {showReactionsPopup && triggerRect && (
          <ReactionsPopup
            onSelect={handleReactionSelect}
            theme={theme}
            onClose={closeReactionsPopup}
            triggerRect={triggerRect}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// EXPORT WITH ERROR BOUNDARY
// ------------------------------------------------------------------
export default function PostCard(props) {
  const handleRetry = () => {
    window.location.reload();
  };
  return (
    <PostErrorBoundary onRetry={handleRetry}>
      <PostCardContent {...props} />
    </PostErrorBoundary>
  );
}