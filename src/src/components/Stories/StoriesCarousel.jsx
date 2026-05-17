import PropTypes from "prop-types";
import React, { useState, useEffect, useRef, useCallback, memo, Suspense, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  MessageCircle, 
  Send, 
  MoreVertical,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Bookmark,
  Share2,
  Flag,
  Clock,
  Eye,
  Users,
  Plus,
  Camera,
  Zap,
  Crown,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Type,
  Trash2,
  Download,
  Copy,
  AlertCircle,
  UserPlus,
  CheckCircle,
  ExternalLink,
  BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";
import LoadingSpinner from "../Shared/LoadingSpinner";

// ======================== ENHANCED STORY TYPES ========================

const StoryTypes = {
  IMAGE: 'image',
  VIDEO: 'video',
  TEXT: 'text',
  POLL: 'poll',
  QUESTION: 'question',
  MUSIC: 'music'
};

// ======================== ENHANCED COMPONENTS ========================

// Story Skeleton Component - Improved for zero flicker
const StorySkeleton = memo(() => {
  const { theme } = useTheme();
  
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "relative overflow-hidden rounded-2xl",
              theme === "dark" ? "bg-gray-800/30" : "bg-gray-200/30",
              "h-[280px] md:h-[300px] lg:h-[320px]",
              "backdrop-blur-sm"
            )}
          >
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>
            
            {/* Skeleton structure */}
            <div className="p-4 h-full flex flex-col">
              {/* Profile skeleton */}
              <div className="flex items-center mb-4">
                <div className={cn(
                  "w-14 h-14 rounded-full",
                  theme === "dark" ? "bg-gray-700/50" : "bg-gray-300/50"
                )} />
                <div className="ml-3 flex-1 space-y-2">
                  <div className={cn(
                    "h-4 rounded-full w-3/4",
                    theme === "dark" ? "bg-gray-700/50" : "bg-gray-300/50"
                  )} />
                  <div className={cn(
                    "h-3 rounded-full w-1/2",
                    theme === "dark" ? "bg-gray-700/50" : "bg-gray-300/50"
                  )} />
                </div>
              </div>
              
              {/* Story preview skeleton */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[1, 2].map((j) => (
                  <div
                    key={j}
                    className={cn(
                      "rounded-xl",
                      theme === "dark" ? "bg-gray-700/30" : "bg-gray-300/30"
                    )}
                  />
                ))}
              </div>
              
              {/* Stats skeleton */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-3 w-8 rounded-full",
                    theme === "dark" ? "bg-gray-700/30" : "bg-gray-300/30"
                  )} />
                  <div className={cn(
                    "h-3 w-8 rounded-full",
                    theme === "dark" ? "bg-gray-700/30" : "bg-gray-300/30"
                  )} />
                </div>
                <div className={cn(
                  "h-3 w-16 rounded-full",
                  theme === "dark" ? "bg-gray-700/30" : "bg-gray-300/30"
                )} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

StorySkeleton.displayName = "StorySkeleton";

// No Stories Component - Enhanced with real data prompts
const NoStories = memo(() => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const { currentUser } = useAppStore();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center h-full"
    >
      <div className={cn(
        "w-48 h-48 rounded-full flex items-center justify-center mb-8",
        "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10",
        "backdrop-blur-sm"
      )}>
        <Sparkles className={cn(
          "w-24 h-24",
          theme === "dark" ? "text-purple-400/80" : "text-purple-600/80"
        )} />
      </div>
      
      <h3 className={cn(
        "text-3xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent",
        theme === "dark" 
          ? "from-blue-400 to-purple-400" 
          : "from-blue-600 to-purple-600"
      )}>
        Share Your First Story
      </h3>
      
      <p className={cn(
        "text-lg mb-4 max-w-md leading-relaxed",
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      )}>
        {currentUser 
          ? `Welcome, ${currentUser.displayName || 'User'}! Start sharing moments with your friends.`
          : "Sign in to create your first story and connect with friends."
        }
      </p>
      
      <p className={cn(
        "text-sm mb-8",
        theme === "dark" ? "text-gray-400" : "text-gray-500"
      )}>
        Stories disappear after 24 hours • End-to-end encrypted
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        {currentUser ? (
          <>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                track("Create_First_Story_Click");
                navigate("/create-story");
              }}
              className={cn(
                "px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3",
                "bg-gradient-to-r from-rose-500 to-pink-600 text-white",
                "shadow-lg hover:shadow-xl transition-all duration-300",
                "min-w-[200px]"
              )}
              type="button"
            >
              <Camera className="w-5 h-5" />
              Create Your First Story
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                track("Find_Friends_Click");
                navigate("/discover");
              }}
              className={cn(
                "px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3",
                theme === "dark" 
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
                "shadow-lg hover:shadow-xl transition-all duration-300",
                "min-w-[200px]"
              )}
              type="button"
            >
              <UserPlus className="w-5 h-5" />
              Find Friends
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              track("Sign_In_From_Stories");
              navigate("/auth");
            }}
            className={cn(
              "px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3",
              "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
              "shadow-lg hover:shadow-xl transition-all duration-300",
              "min-w-[200px]"
            )}
            type="button"
          >
            Sign In to Continue
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});

NoStories.displayName = "NoStories";

// Story Item Component - Completely reworked for zero glitching
const StoryItem = memo(({ 
  story, 
  index, 
  onOpen, 
  isCurrentUser = false,
  onProfileClick 
}) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const totalStories = story.stories?.length || 0;
  const unwatchedCount = story.stories?.filter(s => !s.seen).length || 0;
  const hasStories = totalStories > 0;
  const isUnwatched = unwatchedCount > 0;
  const isExpired = story.stories?.some(s => new Date(s.expiresAt) < new Date()) || false;
  
  const handleClick = () => {
    if (isCurrentUser && !hasStories) {
      track("Create_Story_From_Empty_Click");
      navigate("/create-story");
      return;
    }
    
    if (hasStories) {
      track("Story_Item_Click", { 
        userId: story.userId, 
        unwatchedCount,
        storyCount: totalStories 
      });
      onOpen(story, index);
    }
  };
  
  const handleProfileClick = (e) => {
    e.stopPropagation();
    track("Story_Profile_Click", { userId: story.userId });
    if (onProfileClick) {
      onProfileClick(story.userId);
    } else {
      navigate(`/profile/${story.userId}`);
    }
  };
  
  // Calculate time remaining
  const getTimeRemaining = useMemo(() => {
    if (!story.stories?.[0]?.expiresAt) return null;
    const expireDate = new Date(story.stories[0].expiresAt);
    const now = new Date();
    const diffMs = expireDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 0) return "Expired";
    if (diffHours < 1) return "Soon";
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  }, [story]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        delay: index * 0.03, 
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
        transition: { type: "spring", stiffness: 400 }
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl",
        "transition-all duration-300",
        "shadow-lg hover:shadow-2xl",
        "h-[280px] sm:h-[300px] md:h-[320px]",
        "flex flex-col",
        "border",
        theme === "dark" ? "border-gray-800/50" : "border-gray-200/50",
        isExpired && "opacity-70 grayscale-30"
      )}
      onClick={handleClick}
    >
      {/* Background gradient with improved performance */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10" />
      
      {isCurrentUser && !hasStories && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-600/10 via-transparent to-gray-800/10" />
      )}
      
      {isUnwatched && !isCurrentUser && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5" />
      )}
      
      {/* Content with proper layering */}
      <div className="relative p-4 h-full flex flex-col z-10">
        {/* Profile section - Enhanced for visibility */}
        <div className="flex items-center mb-4">
          <div className="relative">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleProfileClick}
              className={cn(
                "w-14 h-14 rounded-full border-2 object-cover cursor-pointer relative overflow-hidden",
                isCurrentUser && !hasStories
                  ? "border-dashed border-gray-500"
                  : isUnwatched
                    ? "border-white"
                    : "border-gray-400/70",
                "bg-gradient-to-br from-gray-800 to-gray-900"
              )}
            >
              <img
                src={story.profilePic}
                alt={story.displayName}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  e.target.src = "/assets/default-profile.png";
                  setImageLoaded(true);
                }}
                loading="lazy"
              />
              
              {!imageLoaded && (
                <div className={cn(
                  "absolute inset-0",
                  theme === "dark" ? "bg-gray-800" : "bg-gray-300"
                )} />
              )}
              
              {isCurrentUser && !hasStories && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Plus className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </motion.div>
            
            {/* Unwatched indicator - Enhanced */}
            {isUnwatched && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500 }}
                className={cn(
                  "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center",
                  "bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs font-bold",
                  "shadow-lg border border-white/80",
                  "animate-pulse"
                )}
              >
                {unwatchedCount}
              </motion.div>
            )}
            
            {/* Premium badge */}
            {story.isPremium && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg"
              >
                <Crown className="w-3 h-3 text-black" />
              </motion.div>
            )}
            
            {/* Time indicator */}
            {getTimeRemaining && (
              <div className={cn(
                "absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg text-[10px] font-bold",
                theme === "dark" 
                  ? "bg-gray-800/90 text-gray-300" 
                  : "bg-gray-100/90 text-gray-700"
              )}>
                {getTimeRemaining}
              </div>
            )}
          </div>
          
          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn(
                "font-bold text-base truncate",
                isCurrentUser && !hasStories
                  ? theme === "dark" ? "text-gray-400" : "text-gray-500"
                  : isUnwatched
                    ? "text-white"
                    : theme === "dark" ? "text-gray-300" : "text-gray-700"
              )}>
                {story.displayName}
              </h4>
              {story.isVerified && (
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px]">✓</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-sm truncate",
                isCurrentUser && !hasStories
                  ? theme === "dark" ? "text-gray-500" : "text-gray-400"
                  : isUnwatched
                    ? "text-white/80"
                    : theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}>
                @{story.username}
              </span>
              
              {/* Story count */}
              {hasStories && (
                <div className={cn(
                  "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                  isUnwatched
                    ? "bg-white/20 text-white"
                    : theme === "dark" 
                      ? "bg-gray-700/50 text-gray-300"
                      : "bg-gray-200/70 text-gray-600"
                )}>
                  {totalStories} {totalStories === 1 ? "story" : "stories"}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Story preview or create button */}
        {isCurrentUser && !hasStories ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mb-4",
                "bg-gradient-to-br from-rose-500/20 to-pink-600/20",
                "border-2 border-dashed",
                theme === "dark" 
                  ? "border-rose-500/30" 
                  : "border-rose-500/20"
              )}
            >
              <Plus className={cn(
                "w-10 h-10",
                theme === "dark" ? "text-rose-400" : "text-rose-500"
              )} />
            </motion.div>
            <span className={cn(
              "text-lg font-semibold mb-2",
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            )}>
              Create Story
            </span>
            <p className={cn(
              "text-sm text-center px-4",
              theme === "dark" ? "text-gray-500" : "text-gray-600"
            )}>
              Share a moment with friends
            </p>
          </div>
        ) : hasStories ? (
          <>
            {/* Story preview thumbnails - Enhanced loading */}
            <div className="flex-1 grid grid-cols-2 gap-2 mb-3">
              {story.stories.slice(0, 2).map((s, idx) => {
                const isFirst = idx === 0;
                const isSeen = s.seen;
                
                return (
                  <div 
                    key={s.id || idx} 
                    className={cn(
                      "relative rounded-xl overflow-hidden",
                      isFirst ? "h-32" : "h-24",
                      "bg-gradient-to-br from-gray-800/50 to-gray-900/50"
                    )}
                  >
                    {/* Story type indicator */}
                    <div className="absolute top-2 left-2 z-10">
                      {s.type === StoryTypes.VIDEO ? (
                        <VideoIcon className="w-3 h-3 text-white/80" />
                      ) : s.type === StoryTypes.TEXT ? (
                        <Type className="w-3 h-3 text-white/80" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-white/80" />
                      )}
                    </div>
                    
                    {/* Progress indicator */}
                    <div className={cn(
                      "absolute bottom-2 left-2 right-2 h-1 rounded-full overflow-hidden",
                      isSeen ? "bg-gray-600/50" : "bg-white/30"
                    )}>
                      {!isSeen && (
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ 
                            duration: 5, 
                            ease: "linear",
                            repeat: Infinity 
                          }}
                          className="h-full bg-gradient-to-r from-blue-400 to-cyan-400"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Stats - Enhanced visibility */}
            <div className="mt-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Eye className={cn(
                    "w-4 h-4",
                    isUnwatched 
                      ? "text-white/70" 
                      : theme === "dark" 
                        ? "text-gray-500" 
                        : "text-gray-400"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    isUnwatched 
                      ? "text-white/80" 
                      : theme === "dark" 
                        ? "text-gray-400" 
                        : "text-gray-500"
                  )}>
                    {story.stories.reduce((sum, s) => sum + (s.views || 0), 0).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Heart className={cn(
                    "w-4 h-4",
                    isUnwatched 
                      ? "text-white/70" 
                      : theme === "dark" 
                        ? "text-gray-500" 
                        : "text-gray-400"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    isUnwatched 
                      ? "text-white/80" 
                      : theme === "dark" 
                        ? "text-gray-400" 
                        : "text-gray-500"
                  )}>
                    {story.stories.reduce((sum, s) => sum + (s.reactions?.length || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* Time indicator */}
              {story.stories[0]?.createdAt && (
                <div className={cn(
                  "text-xs px-2 py-1 rounded-full flex items-center gap-1",
                  isUnwatched
                    ? "bg-white/15 text-white/90"
                    : theme === "dark"
                      ? "bg-gray-800/60 text-gray-300"
                      : "bg-gray-100/80 text-gray-600"
                )}>
                  <Clock className="w-3 h-3" />
                  {(() => {
                    const date = new Date(story.stories[0].createdAt);
                    const now = new Date();
                    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
                    
                    if (diffHours < 1) return "Just now";
                    if (diffHours < 24) return `${diffHours}h`;
                    return `${Math.floor(diffHours / 24)}d`;
                  })()}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
});

StoryItem.displayName = "StoryItem";

// Story Viewer Component - Completely reworked for zero glitching
const StoryViewer = memo(({ 
  story, 
  storyIndex, 
  totalStories, 
  onClose, 
  onNext, 
  onPrevious,
  onProfileClick 
}) => {
  const { theme } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { currentUser } = useAppStore();
  const navigate = useNavigate();
  
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [seenUsers, setSeenUsers] = useState([]);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const videoRef = useRef(null);
  const progressTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const commentsEndRef = useRef(null);
  const lastSegmentRef = useRef(-1);
  
  const currentStory = story.stories?.[currentSegment];
  const totalSegments = story.stories?.length || 0;
  
  // Emoji reactions
  const emojiReactions = useMemo(() => [
    { emoji: "❤️", label: "Love", color: "text-red-500" },
    { emoji: "😂", label: "Funny", color: "text-yellow-500" },
    { emoji: "😮", label: "Wow", color: "text-blue-500" },
    { emoji: "😢", label: "Sad", color: "text-purple-500" },
    { emoji: "🔥", label: "Fire", color: "text-orange-500" },
    { emoji: "👏", label: "Clap", color: "text-green-500" },
  ], []);
  
  // Load seen users
  useEffect(() => {
    if (currentStory?.seenBy) {
      setSeenUsers(currentStory.seenBy.slice(0, 10));
    }
  }, [currentStory]);
  
  // Reset content loaded state when segment changes
  useEffect(() => {
    if (currentSegment !== lastSegmentRef.current) {
      setContentLoaded(false);
      setVideoError(false);
      lastSegmentRef.current = currentSegment;
    }
  }, [currentSegment]);
  
  // Progress tracking - Optimized for zero glitching
  useEffect(() => {
    if (!currentStory || isPaused || isLoading) {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      return;
    }
    
    const duration = currentStory.duration || 5000;
    
    progressTimeoutRef.current = setTimeout(() => {
      setCurrentSegment(prev => {
        if (prev >= totalSegments - 1) {
          setTimeout(() => onNext(), 100);
          return prev;
        }
        return prev + 1;
      });
    }, duration);
    
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [currentSegment, isPaused, currentStory, totalSegments, onNext, isLoading]);
  
  // Handle video loading with error handling
  useEffect(() => {
    if (currentStory?.type === StoryTypes.VIDEO && videoRef.current) {
      const video = videoRef.current;
      setVideoError(false);
      setIsLoading(true);
      
      const handleLoaded = () => {
        setIsLoading(false);
        setContentLoaded(true);
        if (!isPaused) {
          video.play().catch(e => {
            console.log("Video play error:", e);
            setVideoError(true);
          });
        }
      };
      
      const handleError = () => {
        setVideoError(true);
        setIsLoading(false);
      };
      
      video.addEventListener('loadeddata', handleLoaded);
      video.addEventListener('error', handleError);
      
      video.load();
      
      return () => {
        video.removeEventListener('loadeddata', handleLoaded);
        video.removeEventListener('error', handleError);
        video.pause();
        video.src = "";
      };
    } else {
      setIsLoading(false);
      setContentLoaded(true);
    }
  }, [currentStory, isPaused]);
  
  // Handle key events
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch(e.key) {
        case 'ArrowRight':
        case ' ':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'Escape':
          onClose();
          break;
        case 'm':
        case 'M':
          setIsMuted(!isMuted);
          break;
        case 'p':
        case 'P':
          setIsPaused(!isPaused);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, isMuted, isPaused]);
  
  const handleNext = useCallback(() => {
    playSound("story_next");
    track("Story_Next", { userId: story.userId, segment: currentSegment });
    
    if (currentSegment < totalSegments - 1) {
      setCurrentSegment(prev => prev + 1);
    } else {
      onNext();
    }
  }, [currentSegment, totalSegments, onNext, playSound, track, story.userId]);
  
  const handlePrevious = useCallback(() => {
    playSound("story_previous");
    track("Story_Previous", { userId: story.userId, segment: currentSegment });
    
    if (currentSegment > 0) {
      setCurrentSegment(prev => prev - 1);
    } else {
      onPrevious();
    }
  }, [currentSegment, onPrevious, playSound, track, story.userId]);
  
  const handleProfileNavigation = useCallback(() => {
    track("StoryViewer_Profile_Click", { userId: story.userId });
    onClose();
    if (onProfileClick) {
      onProfileClick(story.userId);
    } else {
      navigate(`/profile/${story.userId}`);
    }
  }, [story.userId, onClose, onProfileClick, navigate, track]);
  
  const handleReaction = useCallback((reaction) => {
    playSound("reaction");
    setSelectedReaction(reaction);
    track("Story_Reaction", { userId: story.userId, reaction: reaction.emoji });
    
    setTimeout(() => {
      setSelectedReaction(null);
    }, 2000);
  }, [playSound, track, story.userId]);
  
  const handleCommentSubmit = useCallback((e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    playSound("comment_send");
    track("Story_Comment", { 
      userId: story.userId, 
      commentLength: commentText.length 
    });
    
    setCommentText("");
  }, [commentText, playSound, track, story.userId]);
  
  const handleProgressClick = useCallback((index) => {
    setCurrentSegment(index);
    track("Story_Progress_Click", { userId: story.userId, segment: index });
  }, [track, story.userId]);
  
  const handleContainerClick = useCallback((e) => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const clickX = e.nativeEvent.offsetX;
    
    if (clickX < containerWidth / 3) {
      handlePrevious();
    } else if (clickX > (containerWidth * 2) / 3) {
      handleNext();
    } else {
      setIsPaused(prev => !prev);
    }
  }, [handleNext, handlePrevious]);
  
  const handleShare = useCallback(() => {
    track("Story_Share", { userId: story.userId });
  }, [track, story.userId]);
  
  const handleSave = useCallback(() => {
    track("Story_Save", { userId: story.userId });
  }, [track, story.userId]);
  
  const handleReport = useCallback(() => {
    track("Story_Report", { userId: story.userId });
  }, [track, story.userId]);
  
  // Format time helper
  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return "Just now";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);
  
  if (!currentStory) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Top Progress Bars - Enhanced */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-1 px-2">
        {Array.from({ length: totalSegments }).map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              handleProgressClick(index);
            }}
            className={cn(
              "flex-1 h-1.5 rounded-full overflow-hidden transition-all duration-300",
              "hover:h-2"
            )}
            aria-label={`Go to segment ${index + 1}`}
            type="button"
          >
            <div className="h-full bg-gray-600/50">
              {index === currentSegment && !isPaused && contentLoaded && (
                <motion.div
                  layoutId="storyProgress"
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ 
                    duration: (currentStory.duration || 5000) / 1000, 
                    ease: "linear" 
                  }}
                />
              )}
              {index < currentSegment && (
                <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400" />
              )}
            </div>
          </button>
        ))}
      </div>
      
      {/* Top Info Bar - Enhanced */}
      <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              handleProfileNavigation();
            }}
            className="flex items-center gap-3 group backdrop-blur-sm bg-black/30 rounded-full pl-1 pr-3 py-1"
            type="button"
          >
            <div className="relative">
              <img
                src={story.profilePic}
                alt={story.displayName}
                className="w-9 h-9 rounded-full border-2 border-white/80 object-cover"
                onError={(e) => {
                  e.target.src = "/assets/default-profile.png";
                }}
              />
              {story.isPremium && (
                <Crown className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-yellow-400" />
              )}
            </div>
            
            <div className="text-left">
              <div className="flex items-center gap-1">
                <h3 className="text-white font-bold text-sm group-hover:text-blue-300 transition-colors truncate max-w-[120px]">
                  {story.displayName}
                </h3>
                {story.isVerified && (
                  <span className="text-blue-400 text-xs">✓</span>
                )}
              </div>
              <p className="text-gray-300 text-xs">
                {formatTime(currentStory.createdAt)} · {currentSegment + 1}/{totalSegments}
              </p>
            </div>
          </motion.button>
        </div>
        
        <div className="flex items-center gap-1">
          {/* View stats */}
          {currentStory.views > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
              <Eye className="w-3.5 h-3.5" />
              <span>{currentStory.views.toLocaleString()}</span>
            </div>
          )}
          
          {/* Controls */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPaused(!isPaused);
            }}
            className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={isPaused ? "Play" : "Pause"}
            type="button"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </motion.button>
          
          {currentStory.type === StoryTypes.VIDEO && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
              type="button"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
            className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="More options"
            type="button"
          >
            <MoreVertical className="w-4 h-4" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500/70 transition-colors"
            aria-label="Close"
            type="button"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
      
      {/* Options Menu */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-14 right-2 z-30 min-w-[180px] rounded-xl bg-black/90 backdrop-blur-xl border border-gray-800 overflow-hidden shadow-2xl"
          >
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-white text-sm"
              type="button"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Story</span>
            </button>
            <button
              onClick={handleSave}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-white text-sm"
              type="button"
            >
              <Bookmark className="w-4 h-4" />
              <span>Save Story</span>
            </button>
            {story.userId !== currentUser?.uid && (
              <button
                onClick={handleReport}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-red-400 text-sm"
                type="button"
              >
                <Flag className="w-4 h-4" />
                <span>Report</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Story Content - Enhanced with proper error handling */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <LoadingSpinner />
          </div>
        )}
        
        {videoError && currentStory.type === StoryTypes.VIDEO && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-white text-lg mb-2">Video unavailable</p>
            <p className="text-gray-400 text-sm">This video could not be loaded</p>
          </div>
        )}
        
        {currentStory.type === StoryTypes.VIDEO ? (
          <motion.video
            key={currentStory.id}
            ref={videoRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: contentLoaded ? 1 : 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="max-h-full max-w-full object-contain"
            muted={isMuted}
            autoPlay={!isPaused}
            playsInline
            onEnded={handleNext}
            preload="metadata"
          >
            <source src={currentStory.content} type="video/mp4" />
          </motion.video>
        ) : currentStory.type === StoryTypes.TEXT ? (
          <motion.div
            key={currentStory.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="max-h-full max-w-full w-full h-full flex items-center justify-center p-4 md:p-8"
            style={{
              backgroundColor: currentStory.backgroundColor,
              color: currentStory.textColor,
              fontFamily: currentStory.fontFamily
            }}
          >
            <div className="text-center max-w-2xl px-4">
              <p className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                {currentStory.text}
              </p>
              {currentStory.musicTitle && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-semibold">{currentStory.musicTitle}</p>
                    <p className="text-sm opacity-80">{currentStory.musicArtist}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.img
            key={currentStory.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: contentLoaded ? 1 : 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            src={currentStory.content}
            alt="Story"
            className="max-h-full max-w-full object-contain"
            onLoad={() => {
              setContentLoaded(true);
              setIsLoading(false);
            }}
            onError={(e) => {
              e.target.src = "/assets/story-placeholder.jpg";
              setContentLoaded(true);
              setIsLoading(false);
            }}
            loading="eager"
          />
        )}
        
        {/* Selected Reaction Animation */}
        <AnimatePresence>
          {selectedReaction && (
            <motion.div
              initial={{ scale: 0, y: 100 }}
              animate={{ scale: 1.5, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <span className="text-6xl animate-bounce">{selectedReaction.emoji}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Bottom Controls - Responsive */}
      <div className="absolute bottom-4 left-2 right-2 md:left-4 md:right-4 z-20">
        {/* Quick Reactions */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-1 md:gap-2 mb-3"
        >
          {emojiReactions.map((reaction) => (
            <motion.button
              key={reaction.emoji}
              whileHover={{ scale: 1.2, y: -5 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                handleReaction(reaction);
              }}
              className={cn(
                "text-xl md:text-2xl p-1.5 md:p-2 rounded-full",
                "bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-all duration-200"
              )}
              title={reaction.label}
              type="button"
            >
              {reaction.emoji}
            </motion.button>
          ))}
        </motion.div>
        
        {/* Comments Section - Responsive */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "rounded-xl md:rounded-2xl overflow-hidden backdrop-blur-xl",
            theme === "dark" 
              ? "bg-black/40 border-gray-800/50" 
              : "bg-white/20 border-white/30",
            "border",
            "max-h-[200px] md:max-h-[250px]"
          )}
        >
          {/* Comments Header */}
          <div className="p-2 md:p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <h4 className="text-white font-semibold text-sm md:text-base">
                Comments ({currentStory.comments?.length || 0})
              </h4>
              {seenUsers.length > 0 && (
                <div className="flex items-center gap-1 text-xs md:text-sm text-gray-300">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Seen by {seenUsers.length}+</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
              <span className="text-xs md:text-sm text-gray-400">
                {currentStory.interactions || 0} interactions
              </span>
            </div>
          </div>
          
          {/* Comments List */}
          <div className="max-h-32 md:max-h-40 overflow-y-auto p-2 md:p-4">
            {currentStory.comments?.length > 0 ? (
              currentStory.comments.map((comment, idx) => (
                <div key={idx} className="mb-2 md:mb-3 last:mb-0">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-white font-medium text-xs md:text-sm">{comment.username}</span>
                        <span className="text-gray-400 text-[10px] md:text-xs">
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <p className="text-white/90 text-xs md:text-sm">{comment.text}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-3 md:py-4 text-gray-400 text-sm">
                No comments yet. Be the first!
              </div>
            )}
            <div ref={commentsEndRef} />
          </div>
          
          {/* Comment Input */}
          <form onSubmit={handleCommentSubmit} className="p-2 md:p-4 border-t border-white/10">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className={cn(
                    "w-full px-3 md:px-4 py-2 md:py-3 rounded-full text-xs md:text-sm",
                    "bg-white/10 border border-white/20",
                    "text-white placeholder-gray-400",
                    "focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  )}
                />
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!commentText.trim()}
                className={cn(
                  "p-2 md:p-3 rounded-full",
                  commentText.trim()
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                    : "bg-gray-700/50 text-gray-400"
                )}
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
      
      {/* Navigation Arrows - Responsive */}
      {currentSegment > 0 && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 p-2 md:p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          aria-label="Previous"
          type="button"
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
        </motion.button>
      )}
      
      {currentSegment < totalSegments - 1 && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 p-2 md:p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          aria-label="Next"
          type="button"
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
        </motion.button>
      )}
    </motion.div>
  );
});

StoryViewer.displayName = "StoryViewer";

// Main StoriesCarousel Component - Completely reworked for zero blinking
const StoriesCarousel = () => {
  const { theme } = useTheme();
  const { track } = useAnalytics();
  const { currentUser, friends = [] } = useAppStore();
  const navigate = useNavigate();
  
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Load stories from real data - No mock data
  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        
        // Real data loading - from app store or API
        const userStories = currentUser?.stories || [];
        const friendStories = friends
          .filter(friend => friend.stories && friend.stories.length > 0)
          .map(friend => ({
            ...friend,
            userId: friend.id || friend.uid,
            username: friend.username || friend.displayName?.toLowerCase() || `user_${friend.id}`,
            displayName: friend.displayName || friend.username || 'User',
            profilePic: friend.photoURL || friend.profilePic || '/assets/default-profile.png',
            isVerified: friend.isVerified || false,
            isPremium: friend.isPremium || false,
            isFollowing: true,
            hasUnseenStories: friend.stories?.some(s => !s.seen) || false,
            stories: friend.stories || [],
            lastUpdated: friend.lastActive || new Date().toISOString(),
            storyCount: friend.stories?.length || 0,
            isCurrentUser: false
          }));
        
        // Add current user story (empty or with content)
        const currentUserStory = {
          userId: currentUser?.uid || 'current_user',
          username: currentUser?.username || 'you',
          displayName: currentUser?.displayName || 'Your Story',
          profilePic: currentUser?.photoURL || '/assets/default-profile.png',
          isVerified: currentUser?.isVerified || false,
          isPremium: currentUser?.isPremium || false,
          isFollowing: true,
          hasUnseenStories: userStories.some(s => !s.seen) || false,
          stories: userStories,
          lastUpdated: currentUser?.lastActive || new Date().toISOString(),
          storyCount: userStories.length,
          isCurrentUser: true
        };
        
        // Combine and filter stories
        let allStories = [];
        
        if (currentUser) {
          allStories.push(currentUserStory);
          allStories = [...allStories, ...friendStories];
        } else {
          allStories = friendStories;
        }
        
        // Filter out expired stories
        const validStories = allStories.filter(story => {
          if (story.isCurrentUser) return true;
          return story.stories?.some(s => {
            if (!s.expiresAt) return true;
            return new Date(s.expiresAt) > new Date();
          });
        });
        
        // Sort stories
        const sortedStories = [...validStories].sort((a, b) => {
          // Current user always first
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          
          // Unseen stories first
          const aHasUnseen = a.stories?.some(s => !s.seen) || false;
          const bHasUnseen = b.stories?.some(s => !s.seen) || false;
          
          if (aHasUnseen && !bHasUnseen) return -1;
          if (!aHasUnseen && bHasUnseen) return 1;
          
          // Sort by last updated
          return new Date(b.lastUpdated) - new Date(a.lastUpdated);
        });
        
        setStories(sortedStories);
        setHasMore(false); // In real app, implement pagination
        
        track("Stories_Loaded", { 
          count: sortedStories.length,
          currentUserStories: currentUserStory.storyCount,
          friendStories: friendStories.length 
        });
      } catch (error) {
        console.error("Error loading stories:", error);
        track("Stories_Load_Error", { error: error.message });
        setStories([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoadComplete(true);
      }
    };
    
    loadStories();
  }, [currentUser, friends, track]);
  
  const openStoryViewer = (story, index) => {
    if (story.isCurrentUser && (!story.stories || story.stories.length === 0)) {
      track("Create_Story_From_Empty_Click");
      navigate("/create-story");
      return;
    }
    
    if (!story.stories || story.stories.length === 0) return;
    
    setSelectedStory(story);
    setSelectedIndex(index);
    setViewerOpen(true);
    track("Story_Viewer_Open", { 
      userId: story.userId,
      storyCount: story.stories.length 
    });
  };
  
  const closeStoryViewer = () => {
    setViewerOpen(false);
    setSelectedStory(null);
    track("Story_Viewer_Close");
  };
  
  const handleNextStory = () => {
    if (selectedIndex < stories.length - 1) {
      const nextIndex = selectedIndex + 1;
      const nextStory = stories[nextIndex];
      
      if (nextStory.isCurrentUser && (!nextStory.stories || nextStory.stories.length === 0)) {
        if (nextIndex < stories.length - 1) {
          handleNextStory();
          return;
        } else {
          closeStoryViewer();
          return;
        }
      }
      
      if (!nextStory.stories || nextStory.stories.length === 0) {
        closeStoryViewer();
        return;
      }
      
      setSelectedStory(nextStory);
      setSelectedIndex(nextIndex);
      track("Story_Viewer_Next", { 
        fromIndex: selectedIndex, 
        toIndex: nextIndex 
      });
    } else {
      closeStoryViewer();
    }
  };
  
  const handlePreviousStory = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      const prevStory = stories[prevIndex];
      
      if (prevStory.isCurrentUser && (!prevStory.stories || prevStory.stories.length === 0)) {
        if (prevIndex > 0) {
          handlePreviousStory();
          return;
        } else {
          return;
        }
      }
      
      if (!prevStory.stories || prevStory.stories.length === 0) return;
      
      setSelectedStory(prevStory);
      setSelectedIndex(prevIndex);
      track("Story_Viewer_Previous", { 
        fromIndex: selectedIndex, 
        toIndex: prevIndex 
      });
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    // In real app, fetch fresh data from API
    setTimeout(() => {
      setRefreshing(false);
      track("Stories_Refresh");
    }, 1000);
  };
  
  const handleProfileClick = (userId) => {
    navigate(`/profile/${userId}`);
  };
  
  const handleCreateStory = () => {
    track("Create_Story_From_Carousel");
    navigate("/create-story");
  };
  
  // Calculate stats
  const totalViews = useMemo(() => {
    return stories.reduce((sum, s) => 
      sum + (s.stories?.reduce((sSum, story) => sSum + (story.views || 0), 0) || 0), 0
    );
  }, [stories]);
  
  const newUpdatesCount = useMemo(() => {
    return stories.filter(s => !s.isCurrentUser && s.stories?.some(st => !st.seen)).length;
  }, [stories]);
  
  const hasFriendStories = useMemo(() => {
    return stories.some(s => !s.isCurrentUser && s.stories?.length > 0);
  }, [stories]);
  
  if (loading && !initialLoadComplete) {
    return <StorySkeleton />;
  }
  
  if (!hasFriendStories && stories.length <= (currentUser ? 1 : 0)) {
    return <NoStories />;
  }
  
  return (
    <div className="w-full h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 md:py-6 border-b">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <h2 className={cn(
              "text-xl md:text-2xl font-bold",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              Stories
            </h2>
            <p className={cn(
              "text-xs md:text-sm mt-1",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}>
              Updates from your friends • Disappear in 24h
            </p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "p-1.5 md:p-2 rounded-full transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-200 text-gray-600"
              )}
              aria-label="Refresh"
              type="button"
            >
              {refreshing ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </motion.button>
            
            <div className={cn(
              "text-xs md:text-sm px-2 md:px-3 py-1 rounded-full",
              theme === "dark"
                ? "bg-gray-800 text-gray-300"
                : "bg-gray-200 text-gray-700"
            )}>
              {stories.filter(s => !s.isCurrentUser).length} friends
            </div>
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-1 md:gap-2">
            <Eye className={cn(
              "w-4 h-4 md:w-5 md:h-5",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )} />
            <span className={cn(
              "text-xs md:text-sm font-medium",
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            )}>
              {totalViews.toLocaleString()} views today
            </span>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            <Users className={cn(
              "w-4 h-4 md:w-5 md:h-5",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )} />
            <span className={cn(
              "text-xs md:text-sm font-medium",
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            )}>
              {newUpdatesCount} new updates
            </span>
          </div>
        </div>
      </div>
      
      {/* Stories Grid - Responsive */}
      <div className="p-3 md:p-4 h-[calc(100%-120px)] md:h-[calc(100%-140px)] overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {stories.map((story, index) => (
            <StoryItem
              key={story.userId || story.id || index}
              story={story}
              index={index}
              onOpen={openStoryViewer}
              isCurrentUser={story.isCurrentUser}
              onProfileClick={handleProfileClick}
            />
          ))}
        </div>
        
        {/* Load more indicator */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleRefresh}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium",
                theme === "dark"
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
              type="button"
            >
              Load More Stories
            </button>
          </div>
        )}
      </div>
      
      {/* Create Story Floating Button - Responsive */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleCreateStory}
        className={cn(
          "fixed bottom-24 right-4 md:right-6 z-40 p-3 md:p-4 rounded-full",
          "bg-gradient-to-r from-rose-500 to-pink-600 text-white",
          "shadow-2xl border-2 border-white/20",
          "flex items-center justify-center"
        )}
        aria-label="Create Story"
        type="button"
      >
        <Camera className="w-5 h-5 md:w-6 md:h-6" />
      </motion.button>
      
      {/* Story Viewer Modal */}
      <AnimatePresence>
        {viewerOpen && selectedStory && selectedStory.stories?.length > 0 && (
          <StoryViewer
            story={selectedStory}
            storyIndex={selectedIndex}
            totalStories={stories.length}
            onClose={closeStoryViewer}
            onNext={handleNextStory}
            onPrevious={handlePreviousStory}
            onProfileClick={handleProfileClick}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

StoriesCarousel.propTypes = {};

export default memo(StoriesCarousel);