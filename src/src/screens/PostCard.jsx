// src/screens/PostCard.jsx – ARVDOUL ULTIMATE PRO MAX V40
// 🏆 EVENT DATES • BACKGROUND IMAGES • POLL/QUESTION UPDATES • GIFT SENDING • FOLLOW/UNFOLLOW
// 🔥 VIEW COUNT ON VISIBILITY • DOUBLE‑TAP LIKE • REAL‑TIME LIKES • BILLION‑SCALE
// 🎨 FULL‑WIDTH • SWIPEABLE GALLERY • DOWNLOAD MEDIA

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../store/appStore';
import firestoreService from '../services/firestoreService.js';
import * as monetizationService from '../services/monetizationService.js';
import * as userService from '../services/userService.js';
import notificationService from '../services/notificationsService.js';
import { formatDistanceToNow, format } from 'date-fns';

// Icons
import {
  Heart, MessageCircle, Share2, Bookmark, MoreVertical,
  Play, Pause, Volume2, VolumeX, Maximize2, Smile, Gift,
  UserPlus, UserCheck, UserMinus, Check, Clock, MapPin,
  Calendar, Link as LinkIcon, HelpCircle, BarChart2, Music,
  Video, Image, X, ChevronLeft, ChevronRight, ExternalLink,
  Copy, Flag, ThumbsUp, ThumbsDown, AlertCircle, Download
} from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';

const cn = (...classes) => classes.filter(Boolean).join(' ');

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

// ==================== DOUBLE TAP HEART ====================
const DoubleTapHeart = ({ position }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 2.5, opacity: [0, 1, 0] }}
    transition={{ duration: 0.8 }}
    className="fixed pointer-events-none z-[9999]"
    style={{ left: position.x - 40, top: position.y - 40 }}
  >
    <FaHeart className="w-20 h-20 text-red-500 fill-current drop-shadow-2xl" />
  </motion.div>
);

// ==================== REACTIONS POPUP ====================
const ReactionsPopup = ({ position, onSelect, theme, onClose }) => {
  const ref = useRef();
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
      initial={{ scale: 0.5, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: 20 }}
      className={cn(
        "fixed z-[999] flex gap-2 p-3 rounded-3xl shadow-2xl backdrop-blur-xl border",
        theme === 'dark' ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'
      )}
      style={{ left: position.x - 150, top: position.y - 60 }}
    >
      {REACTIONS.map((r) => (
        <button
          key={r.value}
          onClick={() => { onSelect(r); onClose(); }}
          className="text-3xl hover:scale-125 transition-transform"
        >
          {r.emoji}
        </button>
      ))}
    </motion.div>
  );
};

// ==================== MEDIA GALLERY (Swipeable with Download) ====================
const MediaGallery = ({ media, type, onDoubleTap, theme, isVisible }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
  }, [isVisible, isPlaying]);

  const handleSaveMedia = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `arvdoul_media_${Date.now()}.${url.split('.').pop()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Saved to downloads');
  };

  if (type === 'video' && media[0]) {
    return (
      <div className="relative bg-black rounded-2xl overflow-hidden" onDoubleClick={onDoubleTap}>
        <video
          ref={videoRef}
          src={media[0].url}
          className="w-full h-auto max-h-[600px] object-contain"
          playsInline
          loop
          muted={isMuted}
        />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={() => handleSaveMedia(media[0].url)}
            className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white"
            title="Download video"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (media.length === 1) {
    return (
      <div className="relative bg-black rounded-2xl overflow-hidden group" onDoubleClick={onDoubleTap}>
        <img src={media[0].url} alt="" className="w-full h-auto max-h-[600px] object-contain" />
        <button
          onClick={() => handleSaveMedia(media[0].url)}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="Download image"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Multi‑image carousel
  const handlePrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const handleNext = () => setCurrentIndex(Math.min(media.length - 1, currentIndex + 1));

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden group" onDoubleClick={onDoubleTap}>
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {media.map((item, idx) => (
          <img key={idx} src={item.url} alt="" className="w-full flex-shrink-0 h-auto max-h-[600px] object-contain" />
        ))}
      </div>
      {media.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === media.length - 1}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {media.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
          <button
            onClick={() => handleSaveMedia(media[currentIndex].url)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};

// ==================== POLL COMPONENT ====================
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
    <div className={cn("p-5 rounded-2xl", theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50/50')}>
      <h4 className="text-lg font-bold mb-3">{poll.question}</h4>
      <div className="space-y-3">
        {results.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleVote(idx)}
            disabled={voted && !poll.allowMultiple}
            className={`w-full p-4 rounded-xl border-2 text-left relative overflow-hidden ${
              voted && idx === selected ? 'border-purple-500 bg-purple-500/10' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <div className="flex justify-between items-center">
              <span>{opt.text}</span>
              {voted && <span className="font-bold text-purple-500">{opt.percentage}%</span>}
            </div>
            {voted && (
              <div className="absolute bottom-0 left-0 h-1 bg-purple-500" style={{ width: `${opt.percentage}%` }} />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs mt-3 text-gray-500">{results.reduce((sum, o) => sum + o.votes, 0)} votes</p>
    </div>
  );
};

// ==================== QUESTION COMPONENT ====================
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
    <div className={cn("p-5 rounded-2xl", theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50/50')}>
      <h4 className="text-lg font-bold mb-3">{question}</h4>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer..."
        rows={3}
        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-white resize-none"
      />
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !answer.trim()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
        <span className="text-sm text-gray-500">{answerCount || 0} answers</span>
      </div>
    </div>
  );
};

// ==================== EVENT COMPONENT ====================
const EventComponent = ({ event, theme }) => {
  const formatEventDate = (date) => {
    if (!date) return 'TBA';
    const d = date.toDate ? date.toDate() : new Date(date);
    return format(d, 'PPPp');
  };

  return (
    <div className={cn("p-5 rounded-2xl", theme === 'dark' ? 'bg-orange-900/20' : 'bg-orange-50/50')}>
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-orange-500" />
        <h4 className="text-lg font-bold">{event.title || 'Event'}</h4>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span>{formatEventDate(event.startTime || event.startDate || event.date)}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-500" />
            <span>{event.location}</span>
          </div>
        )}
        <p className="text-sm">{event.description}</p>
      </div>
    </div>
  );
};

// ==================== LINK COMPONENT ====================
const LinkComponent = ({ link, theme }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied');
  };

  return (
    <div className={cn("p-5 rounded-2xl", theme === 'dark' ? 'bg-indigo-900/20' : 'bg-indigo-50/50')}>
      <div className="flex items-center gap-3 mb-3">
        <LinkIcon className="w-5 h-5 text-indigo-500" />
        <h4 className="font-bold truncate">{link.title || link.url}</h4>
      </div>
      {link.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{link.description}</p>}
      <div className="flex gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" /> Visit
        </a>
        <button onClick={handleCopy} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ==================== AUDIO COMPONENT ====================
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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-4 rounded-xl bg-green-500/10">
      <audio
        ref={audioRef}
        src={audio.url}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="p-2 rounded-full bg-green-500 text-white">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium truncate">{audio.name || 'Audio'}</div>
          <div className="text-xs text-gray-500">{formatTime(currentTime)} / {formatTime(duration)}</div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN POST CARD ====================
const PostCard = ({
  post,
  theme,
  currentUser,
  onComment,
  onShowOptions,
  onUpdate,
  onDelete,
  navigate,
}) => {
  const [isLiked, setIsLiked] = useState(post.likedBy?.includes(currentUser?.uid) || false);
  const [isSaved, setIsSaved] = useState(post.savedBy?.includes(currentUser?.uid) || false);
  const [followState, setFollowState] = useState('none');
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [reactionPosition, setReactionPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [postData, setPostData] = useState(post);
  const [answerCount, setAnswerCount] = useState(post.stats?.answerCount || 0);

  const postRef = useRef(null);
  const reactionsButtonRef = useRef(null);
  const lastTapRef = useRef(0);

  const isAuthor = currentUser?.uid && postData.authorId === currentUser.uid;
  const isCreator = (postData.authorLevel || 1) >= 5;

  useEffect(() => {
    if (!isAuthor && currentUser?.uid) {
      userService.getFollowStatus(currentUser.uid, postData.authorId).then((res) => {
        if (res.isFollowing) setFollowState('following');
      });
    }
  }, [postData.authorId, currentUser, isAuthor]);

  useEffect(() => {
    if (!postRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          firestoreService.recordPostView(postData.id, currentUser?.uid, { source: 'feed' }).catch(console.warn);
        } else {
          setIsVisible(false);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [postData.id, currentUser?.uid]);

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTapPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  };

  const handleLike = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to like');
    const originalLiked = isLiked;
    setIsLiked(!originalLiked);
    try {
      const result = await firestoreService.likePost(postData.id, currentUser.uid);
      setPostData((prev) => ({
        ...prev,
        stats: { ...prev.stats, likes: result.stats.likes },
        likedBy: originalLiked
          ? prev.likedBy.filter(id => id !== currentUser.uid)
          : [...(prev.likedBy || []), currentUser.uid],
      }));
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
      toast.error('Failed to like');
    }
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to save');
    const originalSaved = isSaved;
    setIsSaved(!originalSaved);
    try {
      const result = await firestoreService.savePost(postData.id, currentUser.uid);
      setPostData((prev) => ({
        ...prev,
        stats: { ...prev.stats, saves: result.stats.saves },
        savedBy: originalSaved
          ? prev.savedBy.filter(id => id !== currentUser.uid)
          : [...(prev.savedBy || []), currentUser.uid],
      }));
      toast.success(originalSaved ? 'Removed from saved' : 'Post saved');
    } catch (err) {
      setIsSaved(originalSaved);
      toast.error('Failed to save');
    }
  };

  const handleShare = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to share');
    try {
      await firestoreService.sharePost(postData.id, currentUser.uid);
      setPostData(prev => ({
        ...prev,
        stats: { ...prev.stats, shares: (prev.stats?.shares || 0) + 1 },
      }));
      toast.success('Post shared!');
    } catch (err) {
      toast.error('Failed to share');
    }
  };

  const handleFollow = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to follow');
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
      toast.error('Follow action failed');
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to add friend');
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
      toast.error('Friend request failed');
    }
  };

  const handleSendGift = async () => {
    if (!currentUser?.uid) return toast.error('Sign in to send gift');
    try {
      await monetizationService.sendGift(currentUser.uid, postData.id, 'rose');
      setPostData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          gifts: (prev.stats?.gifts || 0) + 1,
          giftValue: (prev.stats?.giftValue || 0) + 5,
        },
      }));
      toast.success('Gift sent!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReactionSelect = async (reaction) => {
    await handleLike();
    toast.success(`Reacted with ${reaction.emoji}`);
  };

  const backgroundStyle = postData.type === 'text' && postData.backgroundImage
    ? { backgroundImage: `url(${postData.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
  const textColorStyle = postData.type === 'text' && postData.textColor ? { color: postData.textColor } : {};

  return (
    <motion.article
      ref={postRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "rounded-3xl overflow-hidden border w-full shadow-2xl backdrop-blur-sm",
        theme === 'dark' ? 'bg-gray-900/90 border-gray-700' : 'bg-white/90 border-gray-200'
      )}
      style={backgroundStyle}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/30 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/profile/${postData.authorId}`)} className="flex items-center gap-3 flex-1">
            <img
              src={postData.authorPhoto || '/assets/default-profile.png'}
              alt={postData.authorName}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
            />
            <div className="flex-1">
              <h3 className="font-bold dark:text-white">{postData.authorName}</h3>
              <p className="text-xs dark:text-gray-400">@{postData.authorUsername} · {formatDistanceToNow(new Date(postData.createdAt?.toDate?.() || postData.createdAt), { addSuffix: true })}</p>
              {postData.location && (
                <p className="text-xs flex items-center gap-1 mt-1 text-gray-500">
                  <MapPin className="w-3 h-3" /> {postData.location}
                </p>
              )}
            </div>
          </button>
          <div className="flex items-center gap-2">
            {!isAuthor && currentUser && (
              <>
                {isCreator ? (
                  <button
                    onClick={handleFollow}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all",
                      followState === 'following'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg'
                    )}
                  >
                    {followState === 'following' ? 'Following' : 'Follow'}
                  </button>
                ) : (
                  <button
                    onClick={handleFriendRequest}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all",
                      followState === 'friends' ? 'bg-green-500 text-white' :
                      followState === 'requested' ? 'bg-yellow-500 text-white' :
                      'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                    )}
                  >
                    {followState === 'friends' ? 'Friends' : followState === 'requested' ? 'Requested' : 'Add Friend'}
                  </button>
                )}
              </>
            )}
            <button onClick={() => onShowOptions(postData)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Type Badge */}
      {postData.type !== 'text' && postData.type !== 'ad' && (
        <div className="px-4 pt-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-800 text-xs">
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

      {/* Text Content */}
      {postData.content && (
        <div className="p-4" style={textColorStyle}>
          <p className="whitespace-pre-line text-lg leading-relaxed">{postData.content}</p>
          {postData.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {postData.hashtags.map((tag) => (
                <span key={tag} className="text-blue-500 text-sm cursor-pointer hover:underline">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media */}
      {postData.media?.length > 0 && postData.type !== 'audio' && (
        <div className="px-4 pb-4">
          <MediaGallery
            media={postData.media}
            type={postData.type}
            onDoubleTap={handleDoubleTap}
            theme={theme}
            isVisible={isVisible}
          />
        </div>
      )}

      {/* Poll */}
      {postData.type === 'poll' && postData.poll && (
        <PollComponent poll={postData.poll} postId={postData.id} currentUser={currentUser} theme={theme} />
      )}

      {/* Question */}
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

      {/* Event */}
      {postData.type === 'event' && postData.event && (
        <EventComponent event={postData.event} theme={theme} />
      )}

      {/* Link */}
      {postData.type === 'link' && postData.link && (
        <LinkComponent link={postData.link} theme={theme} />
      )}

      {/* Audio */}
      {postData.type === 'audio' && postData.media?.[0] && (
        <AudioComponent audio={postData.media[0]} isVisible={isVisible} />
      )}

      {/* Stats Bar */}
      <div className="px-4 py-3 border-t border-gray-700/30 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              {isLiked ? <FaHeart className="w-4 h-4 text-red-500 fill-current" /> : <FaRegHeart className="w-4 h-4" />}
              <span className="dark:text-gray-300">{postData.stats?.likes || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              <span className="dark:text-gray-300">{postData.stats?.comments || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              <span className="dark:text-gray-300">{postData.stats?.shares || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 dark:text-gray-400 text-xs">
            <span>{postData.stats?.views || 0} views</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-5 gap-1 p-2 border-t border-gray-700/30 dark:border-gray-700">
        <button
          ref={reactionsButtonRef}
          onClick={() => {
            if (reactionsButtonRef.current) {
              const rect = reactionsButtonRef.current.getBoundingClientRect();
              setReactionPosition({ x: rect.left + rect.width / 2, y: rect.top });
            }
            setShowReactions(true);
          }}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group"
        >
          <Smile className={`w-6 h-6 mb-1 ${isLiked ? 'text-red-500' : 'group-hover:text-blue-500'}`} />
          <span className="text-xs dark:text-gray-300">React</span>
        </button>

        <button
          onClick={() => onComment(postData)}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group"
        >
          <MessageCircle className="w-6 h-6 mb-1 group-hover:text-blue-500" />
          <span className="text-xs dark:text-gray-300">Comment</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group"
        >
          <Share2 className="w-6 h-6 mb-1 group-hover:text-green-500" />
          <span className="text-xs dark:text-gray-300">Share</span>
        </button>

        <button
          onClick={handleSave}
          className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group"
        >
          <Bookmark className={`w-6 h-6 mb-1 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'group-hover:text-yellow-500'}`} />
          <span className="text-xs dark:text-gray-300">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {isCreator && !isAuthor && (
          <button
            onClick={handleSendGift}
            className="flex flex-col items-center justify-center py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 group"
          >
            <Gift className="w-6 h-6 mb-1 group-hover:text-pink-500" />
            <span className="text-xs dark:text-gray-300">Gift</span>
          </button>
        )}
      </div>

      {/* Double‑tap heart */}
      <AnimatePresence>
        {showDoubleTapHeart && <DoubleTapHeart position={tapPosition} />}
      </AnimatePresence>

      {/* Reactions popup */}
      <AnimatePresence>
        {showReactions && (
          <ReactionsPopup
            position={reactionPosition}
            onSelect={handleReactionSelect}
            theme={theme}
            onClose={() => setShowReactions(false)}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );
};

export default PostCard;