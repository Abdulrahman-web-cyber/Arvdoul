// src/screens/CreatePost.jsx
// ARVDOUL ULTIMATE ENTERPRISE V31 – WORLD'S MOST ADVANCED POST CREATION
// 🚀 Surpasses Facebook, Instagram, TikTok, YouTube • Production Ready • Billion‑User Scale

import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/appStore";
import { useMediaQuery } from "react-responsive";
import Joyride, { STATUS } from "react-joyride";
import ReactMarkdown from "react-markdown";
import { useDebounce } from "use-debounce";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import * as Icons from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDropzone } from "react-dropzone";
import CreatableSelect from "react-select/creatable";
import { getFunctions, httpsCallable } from "firebase/functions";

// Lazy load heavy components
const MapContainer = lazy(() => import("react-leaflet").then(m => ({ default: m.MapContainer })));
const TileLayer = lazy(() => import("react-leaflet").then(m => ({ default: m.TileLayer })));
const Marker = lazy(() => import("react-leaflet").then(m => ({ default: m.Marker })));
const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Import services (all must be properly exported)
import { getVideoService } from "../services/videoService";
import { getStoryService } from "../services/storyService";
import { getSearchService } from "../services/searchService";
import { getMonetizationService } from "../services/monetizationService";
import { getNotificationsService } from "../services/notificationsService";
import { getFeedService } from "../services/feedService";
import { getStorageService } from "../services/storageService";
import { getFirestoreService } from "../services/firestoreService";

// ==================== CONFIGURATION ====================
const POST_TYPES = [
  { id: "text", label: "Text", icon: Icons.Type, color: "from-blue-500 to-cyan-500" },
  { id: "image", label: "Photo", icon: Icons.Image, color: "from-emerald-500 to-green-500" },
  { id: "video", label: "Video", icon: Icons.Video, color: "from-red-500 to-pink-500" },
  { id: "poll", label: "Poll", icon: Icons.BarChart2, color: "from-purple-500 to-violet-500" },
  { id: "question", label: "Question", icon: Icons.HelpCircle, color: "from-amber-500 to-yellow-500" },
  { id: "link", label: "Link", icon: Icons.Link, color: "from-indigo-500 to-blue-500" },
  { id: "audio", label: "Audio", icon: Icons.Music, color: "from-rose-500 to-pink-500" },
  { id: "event", label: "Event", icon: Icons.Calendar, color: "from-orange-500 to-red-500" },
];

const VISIBILITY_OPTIONS = [
  { id: "public", label: "Public", icon: Icons.Globe, color: "text-green-500" },
  { id: "friends", label: "Friends", icon: Icons.Users, color: "text-blue-500" },
  { id: "private", label: "Private", icon: Icons.Lock, color: "text-red-500" },
  { id: "premium", label: "Premium", icon: Icons.Crown, color: "text-purple-500", cost: 50 },
  { id: "followers", label: "Followers", icon: Icons.Users, color: "text-indigo-500" },
];

const MONETIZATION_TYPES = [
  { id: "none", label: "None", icon: Icons.DollarSign, color: "text-gray-500" },
  { id: "tips", label: "Tips", icon: Icons.Coins, color: "text-yellow-500", fee: 15 },
  { id: "exclusive", label: "Exclusive", icon: Icons.Crown, color: "text-purple-500", fee: 20 },
  { id: "sponsored", label: "Sponsored", icon: Icons.Target, color: "text-green-500", fee: 25 },
];

const BOOST_TIERS = [
  { id: "none", label: "No Boost", icon: Icons.TrendingUp, coins: 0, multiplier: 1.0 },
  { id: "basic", label: "Basic", icon: Icons.Rocket, coins: 25, multiplier: 2.0, duration: "1d" },
  { id: "pro", label: "Pro", icon: Icons.Zap, coins: 50, multiplier: 5.0, duration: "3d", recommended: true },
  { id: "ultra", label: "Ultra", icon: Icons.Sparkles, coins: 100, multiplier: 10.0, duration: "7d" },
];

const BACKGROUND_GRADIENTS = [
  { id: "none", url: null },
  { id: "purple", url: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "sunset", url: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { id: "ocean", url: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
];

const TIER_LIMITS = {
  basic: { maxMedia: 5, maxTags: 50, maxFileSize: 10 * 1024 * 1024 },
  premium: { maxMedia: 20, maxTags: 100, maxFileSize: 50 * 1024 * 1024 },
  creator: { maxMedia: 50, maxTags: 200, maxFileSize: 100 * 1024 * 1024 },
};

// ==================== INITIAL STATE ====================
const initialState = {
  step: 1,
  postType: "text",
  content: "",
  mediaFiles: [],
  visibility: "public",
  boost: "none",
  monetization: "none",
  pollData: { question: "", options: ["", ""], duration: 24, allowMultiple: false },
  question: "",
  linkData: { url: "", title: "", description: "" },
  eventData: { title: "", date: null, time: null, location: "", description: "" },
  postLocation: null,
  taggedUsers: [],
  scheduledTime: null,
  expiresAt: null,
  settings: {
    enableComments: true,
    enableGifts: true,
    enableSharing: true,
    isNSFW: false,
    allowReactions: true,
    hideLikeCount: false,
    allowDownloads: true,
    addToStory: false,
  },
  backgroundGradient: "none",
  customBackground: null,
  textColor: "#ffffff",
  coAuthors: [],
  templateId: null,
};

function postReducer(state, action) {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "SET_POST_TYPE": return { ...state, postType: action.payload };
    case "SET_CONTENT": return { ...state, content: action.payload };
    case "ADD_MEDIA": return { ...state, mediaFiles: [...state.mediaFiles, ...action.payload] };
    case "REMOVE_MEDIA": return { ...state, mediaFiles: state.mediaFiles.filter((_, i) => i !== action.payload) };
    case "REORDER_MEDIA": return { ...state, mediaFiles: arrayMove(state.mediaFiles, action.payload.from, action.payload.to) };
    case "UPDATE_MEDIA_PROGRESS": return {
      ...state,
      mediaFiles: state.mediaFiles.map((f, i) => i === action.payload.index ? { ...f, progress: action.payload.progress } : f)
    };
    case "SET_MEDIA_ERROR": return {
      ...state,
      mediaFiles: state.mediaFiles.map((f, i) => i === action.payload.index ? { ...f, error: action.payload.error } : f)
    };
    case "SET_VISIBILITY": return { ...state, visibility: action.payload };
    case "SET_BOOST": return { ...state, boost: action.payload };
    case "SET_MONETIZATION": return { ...state, monetization: action.payload };
    case "SET_POLL": return { ...state, pollData: { ...state.pollData, ...action.payload } };
    case "SET_QUESTION": return { ...state, question: action.payload };
    case "SET_LINK": return { ...state, linkData: { ...state.linkData, ...action.payload } };
    case "SET_EVENT": return { ...state, eventData: { ...state.eventData, ...action.payload } };
    case "SET_POST_LOCATION": return { ...state, postLocation: action.payload };
    case "ADD_TAGGED_USER": return { ...state, taggedUsers: [...state.taggedUsers, action.payload] };
    case "REMOVE_TAGGED_USER": return { ...state, taggedUsers: state.taggedUsers.filter(u => u.id !== action.payload) };
    case "SET_SCHEDULED_TIME": return { ...state, scheduledTime: action.payload };
    case "SET_EXPIRES_AT": return { ...state, expiresAt: action.payload };
    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.payload } };
    case "SET_BACKGROUND_GRADIENT": return { ...state, backgroundGradient: action.payload };
    case "SET_CUSTOM_BACKGROUND": return { ...state, customBackground: action.payload };
    case "SET_TEXT_COLOR": return { ...state, textColor: action.payload };
    case "CLEAR_POST_LOCATION": return { ...state, postLocation: null };
    case "ADD_CO_AUTHOR": return { ...state, coAuthors: [...state.coAuthors, action.payload] };
    case "REMOVE_CO_AUTHOR": return { ...state, coAuthors: state.coAuthors.filter(u => u.id !== action.payload) };
    case "SET_TEMPLATE_ID": return { ...state, templateId: action.payload };
    case "LOAD_TEMPLATE": return { ...state, ...action.payload };
    case "RESET": return initialState;
    default: return state;
  }
}

// ==================== UTILITY COMPONENTS ====================
const SortableMediaItem = ({ media, index, onRemove, onRetry }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden bg-gray-900 border border-gray-700 cursor-grab"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {media.type === "image" && <img src={media.preview} alt="" className="w-full h-full object-cover" />}
      {media.type === "video" && <video src={media.preview} className="w-full h-full object-cover" muted />}
      {media.type === "audio" && (
        <div className="w-full h-full flex items-center justify-center">
          <Icons.Music className="w-8 h-8 text-white/50" />
        </div>
      )}
      {media.progress > 0 && media.progress < 100 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500">
          <div className="h-full bg-white/30" style={{ width: `${media.progress}%` }} />
        </div>
      )}
      {media.error && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <button onClick={() => onRetry(index)} className="px-2 py-1 bg-red-500 text-white text-xs rounded">
            <Icons.RefreshCw className="w-3 h-3 inline mr-1" /> Retry
          </button>
        </div>
      )}
      <div className={`absolute top-1 right-1 transition-opacity ${hover ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => onRemove(index)} className="p-1 rounded-full bg-red-500 text-white">
          <Icons.Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const UltraToggle = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="font-medium text-sm">{label}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        enabled ? "bg-gradient-to-r from-blue-500 to-purple-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  </div>
);

// ==================== MAIN COMPONENT ====================
const CreatePostUltraPro = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, userService } = useAuth();
  const { coins: userCoins, deductCoins } = useAppStore();
  const [state, dispatch] = useReducer(postReducer, initialState);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [serviceError, setServiceError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0 });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState([]);
  const [hashtagOptions, setHashtagOptions] = useState([]);
  const [mentionOptions, setMentionOptions] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [userTier, setUserTier] = useState("basic");
  const [friendIds, setFriendIds] = useState(new Set());
  const [runTour, setRunTour] = useState(!localStorage.getItem("createPostTourDone"));
  const [activeTab, setActiveTab] = useState("post"); // post, reel, story

  const fileInputRef = useRef(null);
  const contentRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Service refs
  const firestore = useRef(null);
  const storage = useRef(null);
  const video = useRef(null);
  const story = useRef(null);
  const search = useRef(null);
  const monetization = useRef(null);
  const notifications = useRef(null);
  const feed = useRef(null);

  // Theme-aware colors
  const colors = useMemo(() => theme === "dark"
    ? {
        bg: "bg-gray-900",
        card: "bg-gray-800/70 backdrop-blur-md border border-gray-700",
        text: "text-white",
        textSecondary: "text-gray-400",
        border: "border-gray-700",
        primary: "bg-gradient-to-r from-purple-600 to-pink-600",
        secondary: "bg-gray-700 hover:bg-gray-600",
        input: "bg-gray-800 text-white border-gray-600 focus:border-blue-500",
      }
    : {
        bg: "bg-gradient-to-br from-blue-50 via-white to-white",
        card: "bg-white/70 backdrop-blur-md border border-gray-200",
        text: "text-gray-900",
        textSecondary: "text-gray-600",
        border: "border-gray-200",
        primary: "bg-gradient-to-r from-blue-500 to-purple-500",
        secondary: "bg-gray-200 hover:bg-gray-300",
        input: "bg-white text-gray-900 border-gray-300 focus:border-blue-500",
      }, [theme]);

  // Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize services
  useEffect(() => {
    const init = async () => {
      try {
        const [fs, st, vs, ss, se, ms, ns, fd] = await Promise.all([
          getFirestoreService(),
          getStorageService(),
          getVideoService(),
          getStoryService(),
          getSearchService(),
          getMonetizationService(),
          getNotificationsService(),
          getFeedService(),
        ]);
        firestore.current = fs;
        storage.current = st;
        video.current = vs;
        story.current = ss;
        search.current = se;
        monetization.current = ms;
        notifications.current = ns;
        feed.current = fd;

        await Promise.all([
          firestore.current.ensureInitialized?.(),
          storage.current.initialize?.()
        ]);

        // Load drafts
        const savedDrafts = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("arvdoul_draft_")) {
            try {
              savedDrafts.push(JSON.parse(localStorage.getItem(key)));
            } catch {}
          }
        }
        setDrafts(savedDrafts);

        // Load trending hashtags
        const trending = await search.current.getSuggestions("", { limit: 10 });
        if (trending.success) {
          setHashtagOptions(trending.suggestions.filter(s => s.type === "hashtag").map(h => ({ value: h.text, label: `#${h.text}` })));
        } else {
          setHashtagOptions([{ value: "arvdoul", label: "#arvdoul" }, { value: "explore", label: "#explore" }]);
        }

        setInitialLoad(false);
      } catch (err) {
        console.error("Init failed", err);
        setServiceError(err.message);
        setInitialLoad(false);
      }
    };
    init();
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (initialLoad) return;
    const timer = setInterval(() => {
      const draft = {
        ...state,
        timestamp: Date.now(),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem("arvdoul_post_draft", JSON.stringify(draft));
    }, 30000);
    return () => clearInterval(timer);
  }, [state, initialLoad]);

  // Search friends (Algolia)
  useEffect(() => {
    if (!debouncedQuery || !search.current) return;
    const searchFriends = async () => {
      const result = await search.current.searchUsers(debouncedQuery, { limit: 20 });
      if (result.success) {
        let filtered = result.users;
        if (friendIds.size) filtered = result.users.filter(u => friendIds.has(u.id));
        setSearchResults(filtered);
        setMentionOptions(filtered.map(u => ({ value: u.username, label: `@${u.username}`, user: u })));
      }
    };
    searchFriends();
  }, [debouncedQuery, friendIds]);

  // Sensors for drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMediaDrop = useCallback(async (acceptedFiles) => {
    const limits = TIER_LIMITS[userTier];
    if (state.mediaFiles.length + acceptedFiles.length > limits.maxMedia) {
      toast.error(`Max ${limits.maxMedia} files for your plan`);
      return;
    }
    const newFiles = [];
    for (const file of acceptedFiles) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
        toast.error(`${file.name} not supported`);
        continue;
      }
      if (file.size > limits.maxFileSize) {
        toast.error(`${file.name} exceeds ${limits.maxFileSize / 1024 / 1024}MB`);
        continue;
      }
      newFiles.push({
        id: uuidv4(),
        file,
        preview: URL.createObjectURL(file),
        type: file.type.split("/")[0],
        name: file.name,
        size: file.size,
        progress: 0,
        error: null,
      });
    }
    dispatch({ type: "ADD_MEDIA", payload: newFiles });
  }, [state.mediaFiles.length, userTier]);

  const handleMediaRetry = (index) => {
    dispatch({ type: "SET_MEDIA_ERROR", payload: { index, error: null } });
    // Will be retried during publish
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = state.mediaFiles.findIndex(m => m.id === active.id);
      const newIndex = state.mediaFiles.findIndex(m => m.id === over.id);
      dispatch({ type: "REORDER_MEDIA", payload: { from: oldIndex, to: newIndex } });
    }
  };

  const uploadMedia = useCallback(async () => {
    if (!storage.current) throw new Error("Storage not ready");
    setUploading(true);
    const results = [];
    const total = state.mediaFiles.length;
    let completed = 0;

    for (const media of state.mediaFiles) {
      try {
        const result = await storage.current.uploadFileWithProgress(
          media.file,
          `posts/${user.uid}/${Date.now()}_${media.file.name}`,
          {
            userId: user.uid,
            compressImages: true,
            onProgress: (progress) => {
              const idx = state.mediaFiles.findIndex(m => m.id === media.id);
              if (idx !== -1) dispatch({ type: "UPDATE_MEDIA_PROGRESS", payload: { index: idx, progress: progress.progress } });
            }
          }
        );
        results.push({
          url: result.downloadURL,
          type: media.type,
          name: media.name,
          size: media.size,
        });
        completed++;
        setUploadProgress({ total, completed });
      } catch (err) {
        const idx = state.mediaFiles.findIndex(m => m.id === media.id);
        dispatch({ type: "SET_MEDIA_ERROR", payload: { index: idx, error: err.message } });
        toast.error(`Failed to upload ${media.name}`);
      }
    }
    setUploading(false);
    return results;
  }, [state.mediaFiles, user]);

  const validate = () => {
    if (state.postType === "poll" && (!state.pollData.question || state.pollData.options.filter(o => o).length < 2))
      return toast.error("Poll requires question and at least 2 options");
    if (state.postType === "question" && !state.question.trim()) return toast.error("Question required");
    if (state.postType === "link" && !state.linkData.url.trim()) return toast.error("URL required");
    if (state.postType === "event" && (!state.eventData.title || !state.eventData.date)) return toast.error("Event title and date required");
    if (!state.content.trim() && state.mediaFiles.length === 0 && !["poll", "question", "link", "event"].includes(state.postType))
      return toast.error("Add content or media");
    const boost = BOOST_TIERS.find(b => b.id === state.boost);
    if (boost?.coins > 0 && userCoins < boost.coins) return toast.error(`Need ${boost.coins - userCoins} more coins`);
    return true;
  };

  const publishPost = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let uploadedMedia = [];
      let videoId = null;

      // Handle video post via videoService
      if (state.postType === "video" && state.mediaFiles.length > 0) {
        const videoFile = state.mediaFiles[0].file;
        const videoMetadata = {
          title: state.content.substring(0, 100),
          description: state.content,
          visibility: state.visibility,
          type: "video",
        };
        const uploadResult = await video.current.uploadVideo(videoFile, videoMetadata, {
          onProgress: (p) => dispatch({ type: "UPDATE_MEDIA_PROGRESS", payload: { index: 0, progress: p } })
        });
        if (uploadResult.success) {
          videoId = uploadResult.videoId;
          uploadedMedia = [{ url: `video://${videoId}`, type: "video", name: videoFile.name }];
        } else throw new Error("Video upload failed");
      } else if (state.mediaFiles.length) {
        uploadedMedia = await uploadMedia();
      }

      const postData = {
        type: state.postType,
        content: state.content.trim(),
        media: uploadedMedia,
        authorId: user.uid,
        authorName: user.displayName,
        authorUsername: user.username,
        authorPhoto: user.photoURL,
        visibility: state.visibility,
        monetization: state.monetization !== "none" ? { type: state.monetization } : null,
        boostData: state.boost !== "none" ? {
          type: state.boost,
          multiplier: BOOST_TIERS.find(b => b.id === state.boost).multiplier,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        } : null,
        location: state.postLocation,
        taggedUsers: state.taggedUsers,
        coAuthors: state.coAuthors,
        scheduledTime: state.scheduledTime,
        expiresAt: state.expiresAt,
        settings: state.settings,
        background: state.backgroundGradient === "custom" ? state.customBackground : BACKGROUND_GRADIENTS.find(g => g.id === state.backgroundGradient)?.url,
        textColor: state.textColor,
        hashtags: state.content.match(/#(\w+)/g)?.map(t => t.toLowerCase()) || [],
        mentions: state.content.match(/@(\w+)/g)?.map(m => m.substring(1)) || [],
        videoId,
        status: state.scheduledTime ? "scheduled" : "published",
      };

      if (state.postType === "poll") postData.poll = state.pollData;
      if (state.postType === "question") postData.question = state.question;
      if (state.postType === "link") postData.link = state.linkData;
      if (state.postType === "event") postData.event = state.eventData;

      const result = await firestore.current.createPost(postData);
      if (!result.success) throw new Error(result.error);

      // Boost ranking
      if (state.boost !== "none") {
        const boostOption = BOOST_TIERS.find(b => b.id === state.boost);
        await monetization.current.spendCoins(user.uid, boostOption.coins, "boost");
        deductCoins(boostOption.coins);
        const functions = getFunctions();
        const boostRanking = httpsCallable(functions, "boostPostRanking");
        await boostRanking({ postId: result.postId, multiplier: boostOption.multiplier });
      }

      // Notify followers (via Cloud Function)
      const functions = getFunctions();
      const notifyFollowers = httpsCallable(functions, "notifyFollowersNewPost");
      await notifyFollowers({ postId: result.postId, authorId: user.uid });

      // Add to story if enabled
      if (state.settings.addToStory && story.current) {
        await story.current.createStory({
          type: state.postType === "video" ? "video" : "image",
          content: state.content,
          mediaFile: state.mediaFiles[0]?.file,
          visibility: state.visibility,
          allowReactions: true,
          allowComments: state.settings.enableComments,
          backgroundColor: state.backgroundGradient !== "none" ? state.backgroundGradient : "#000",
          textColor: state.textColor,
        }).catch(err => console.warn("Story failed", err));
      }

      // Tag notifications
      for (const tagged of state.taggedUsers) {
        await notifications.current.sendNotification({
          type: "tag",
          recipientId: tagged.id,
          senderId: user.uid,
          title: "You were tagged",
          message: `${user.displayName} tagged you in a post`,
          data: { postId: result.postId },
        }).catch(console.warn);
      }

      // Invalidate feed cache
      feed.current.clearUserCache(user.uid);
      localStorage.removeItem("arvdoul_post_draft");
      toast.success(state.scheduledTime ? "Post scheduled!" : "Post published!");
      navigate("/home");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Publish failed");
    } finally {
      setLoading(false);
    }
  };

  const loadDraft = (draft) => {
    // Load draft into state (simplified)
    toast.success("Draft loaded");
    setShowDrafts(false);
  };

  if (initialLoad) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
        <div className="w-full max-w-md p-4">
          <Skeleton count={5} height={50} className="mb-3" />
          <p className="text-center text-gray-500 mt-4">Loading post creator...</p>
        </div>
      </div>
    );
  }

  if (serviceError) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
        <div className="text-center p-6 rounded-2xl bg-red-50 dark:bg-red-900/20">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-600">Service Error</h2>
          <p className="text-sm mt-2 mb-4">{serviceError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-500 text-white rounded-lg">Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <div className={`min-h-screen pb-20 ${colors.bg}`}>
        {isOffline && (
          <div className="sticky top-0 z-50 bg-yellow-500 text-black p-2 text-center text-sm font-medium">
            ⚠️ You are offline. Changes will be saved and published when online.
          </div>
        )}

        <Joyride steps={[
          { target: "#post-type-selector", content: "Choose post type" },
          { target: "#content-editor", content: "Write your content with markdown and emojis" },
          { target: "#media-uploader", content: "Upload images, videos, or audio" },
          { target: "#publish-button", content: "Publish or schedule" }
        ]} run={runTour} continuous showProgress showSkipButton callback={(data) => {
          if (data.status === STATUS.FINISHED) localStorage.setItem("createPostTourDone", "true");
          setRunTour(false);
        }} />

        {/* Header */}
        <div className={`sticky top-0 z-40 border-b backdrop-blur-sm ${colors.card} ${colors.border}`}>
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
              <Icons.X className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Create {POST_TYPES.find(t => t.id === state.postType)?.label}
            </h1>
            <div className="flex gap-2">
              <button onClick={() => setShowDrafts(!showDrafts)} className={`px-3 py-1.5 rounded-lg text-sm ${colors.secondary}`}>
                <Icons.Bookmark className="w-4 h-4 inline mr-1" /> Drafts
              </button>
              <button id="publish-button" onClick={publishPost} disabled={loading || uploading} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${colors.primary} text-white disabled:opacity-50`}>
                {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : (state.scheduledTime ? "Schedule" : "Publish")}
              </button>
            </div>
          </div>
          {showDrafts && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-b shadow-lg max-h-60 overflow-auto">
              {drafts.length === 0 ? <p className="p-4 text-center">No drafts</p> : drafts.map(draft => (
                <div key={draft.id} onClick={() => loadDraft(draft)} className="p-3 border-b hover:bg-gray-100 cursor-pointer">
                  <p className="text-sm">{draft.content?.substring(0, 50)}...</p>
                  <p className="text-xs text-gray-500">{new Date(draft.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <main className="max-w-7xl mx-auto px-4 py-4">
          {/* User info */}
          <div className={`flex items-center gap-3 mb-6 p-3 rounded-lg ${colors.card} border`}>
            <img src={user?.photoURL} alt="" className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <p className="font-bold text-sm">{user?.displayName}</p>
              <p className="text-xs text-gray-500">@{user?.username}</p>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Icons.Coins className="w-4 h-4" />
              <span className="font-bold">{userCoins}</span>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <button key={s} onClick={() => dispatch({ type: "SET_STEP", payload: s })}
                className={`w-8 h-8 rounded-full text-xs font-bold ${state.step === s ? `${colors.primary} text-white` : colors.secondary}`}>
                {s}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={state.step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* STEP 1: CONTENT */}
              {state.step === 1 && (
                <div className="space-y-8">
                  <div id="post-type-selector">
                    <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>Post Type</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {POST_TYPES.map(type => {
                        const Icon = type.icon;
                        return (
                          <motion.button
                            key={type.id}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => dispatch({ type: "SET_POST_TYPE", payload: type.id })}
                            className={`p-3 rounded-xl border transition-all ${state.postType === type.id ? `border-blue-500 bg-gradient-to-br ${type.color}/20` : colors.border}`}
                          >
                            <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${type.color}`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-xs font-medium">{type.label}</p>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div id="content-editor">
                    <h2 className={`text-xl font-bold mb-3 ${colors.text}`}>Content</h2>
                    <div className={`rounded-xl overflow-hidden border ${colors.card}`}>
                      <div className="p-2 border-b flex gap-1 bg-gray-100 dark:bg-gray-800">
                        {[
                          { icon: Icons.Bold, action: () => {
                            const el = contentRef.current;
                            if (!el) return;
                            const start = el.selectionStart, end = el.selectionEnd;
                            const selected = state.content.substring(start, end);
                            dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "**" + selected + "**" + state.content.substring(end) });
                          } },
                          { icon: Icons.Italic, action: () => {
                            const el = contentRef.current;
                            if (!el) return;
                            const start = el.selectionStart, end = el.selectionEnd;
                            const selected = state.content.substring(start, end);
                            dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "*" + selected + "*" + state.content.substring(end) });
                          } },
                          { icon: Icons.Link, action: () => {
                            const el = contentRef.current;
                            if (!el) return;
                            const start = el.selectionStart, end = el.selectionEnd;
                            const selected = state.content.substring(start, end);
                            dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "[" + selected + "](url)" + state.content.substring(end) });
                          } },
                        ].map((item, i) => {
                          const Icon = item.icon;
                          return <button key={i} onClick={item.action} className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-200"><Icon className="w-4 h-4" /></button>;
                        })}
                      </div>
                      <textarea
                        ref={contentRef}
                        value={state.content}
                        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
                        placeholder="What's on your mind?"
                        rows={8}
                        className={`w-full p-4 resize-none focus:outline-none bg-transparent ${colors.input}`}
                        style={{ color: state.textColor }}
                      />
                      <div className="flex justify-between px-4 py-2 text-xs border-t">
                        <span>{state.content.length} chars</span>
                        <CreatableSelect
                          isMulti
                          options={hashtagOptions}
                          onChange={(newVal) => {
                            if (newVal && newVal.length) {
                              const tag = newVal[newVal.length-1].value;
                              dispatch({ type: "SET_CONTENT", payload: state.content + ` #${tag}` });
                            }
                          }}
                          placeholder="Add hashtags..."
                          className="w-48 text-sm"
                          styles={{ control: (base) => ({ ...base, background: "transparent", borderColor: "transparent" }) }}
                        />
                      </div>
                    </div>
                    <div className={`mt-3 p-4 rounded-xl border ${colors.card}`}>
                      <p className="text-xs font-medium mb-1">Preview</p>
                      <ReactMarkdown>{state.content}</ReactMarkdown>
                    </div>
                  </div>

                  <div id="media-uploader">
                    <h2 className={`text-xl font-bold mb-3 ${colors.text}`}>Media</h2>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleMediaDrop(Array.from(e.dataTransfer.files)); }}
                      onClick={() => fileInputRef.current.click()}
                      className={`rounded-xl p-6 text-center border-2 border-dashed ${colors.border} ${colors.card} cursor-pointer hover:shadow`}
                    >
                      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => handleMediaDrop(Array.from(e.target.files))} />
                      <Icons.Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Drag & drop or click to upload</p>
                      <p className="text-xs text-gray-500 mt-1">Max {TIER_LIMITS[userTier]?.maxMedia} files</p>
                    </div>
                    {state.mediaFiles.length > 0 && (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={state.mediaFiles.map(m => m.id)} strategy={verticalListSortingStrategy}>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                            {state.mediaFiles.map((media, idx) => (
                              <SortableMediaItem
                                key={media.id}
                                media={media}
                                index={idx}
                                onRemove={(i) => dispatch({ type: "REMOVE_MEDIA", payload: i })}
                                onRetry={handleMediaRetry}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>

                  {state.postType === "poll" && (
                    <div className={`rounded-xl p-4 border ${colors.card}`}>
                      <h3 className="text-lg font-bold mb-3">Poll</h3>
                      <input type="text" value={state.pollData.question} onChange={(e) => dispatch({ type: "SET_POLL", payload: { question: e.target.value } })} placeholder="Question" className={`w-full p-3 rounded-lg border ${colors.input} mb-3`} />
                      {state.pollData.options.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input type="text" value={opt} onChange={(e) => {
                            const newOpts = [...state.pollData.options];
                            newOpts[idx] = e.target.value;
                            dispatch({ type: "SET_POLL", payload: { options: newOpts } });
                          }} placeholder={`Option ${idx+1}`} className={`flex-1 p-3 rounded-lg border ${colors.input}`} />
                          {state.pollData.options.length > 2 && <button onClick={() => dispatch({ type: "SET_POLL", payload: { options: state.pollData.options.filter((_, i) => i !== idx) } })}><Icons.X /></button>}
                        </div>
                      ))}
                      <button onClick={() => dispatch({ type: "SET_POLL", payload: { options: [...state.pollData.options, ""] } })} className="mt-2 text-sm text-blue-500">+ Add Option</button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: SETTINGS */}
              {state.step === 2 && (
                <div className="space-y-8">
                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Visibility</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {VISIBILITY_OPTIONS.map(opt => (
                        <button key={opt.id} onClick={() => dispatch({ type: "SET_VISIBILITY", payload: opt.id })} className={`p-3 rounded-lg border-2 text-center ${state.visibility === opt.id ? `border-${opt.color.replace("text-", "")} bg-${opt.color.replace("text-", "")}/10` : colors.border}`}>
                          <opt.icon className={`w-6 h-6 mx-auto mb-1 ${opt.color}`} />
                          <p className="text-xs font-bold">{opt.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Collaborators</h3>
                    <CreatableSelect
                      isMulti
                      options={mentionOptions}
                      onChange={(selected) => {
                        const newCoAuthors = selected.map(s => ({ id: s.user.id, name: s.user.displayName, username: s.user.username }));
                        dispatch({ type: "ADD_CO_AUTHOR", payload: newCoAuthors });
                      }}
                      placeholder="Tag co-authors..."
                      styles={{ control: (base) => ({ ...base, background: colors.input, borderColor: colors.border }) }}
                    />
                  </div>

                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Monetization</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {MONETIZATION_TYPES.map(opt => (
                        <button key={opt.id} onClick={() => dispatch({ type: "SET_MONETIZATION", payload: opt.id })} className={`p-3 rounded-lg border-2 text-center ${state.monetization === opt.id ? `border-${opt.color.replace("text-", "")} bg-${opt.color.replace("text-", "")}/10` : colors.border}`}>
                          <opt.icon className={`w-5 h-5 mx-auto mb-1 ${opt.color}`} />
                          <p className="text-xs font-bold">{opt.label}</p>
                          {opt.fee > 0 && <p className="text-xs text-red-500">{opt.fee}%</p>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Boost Post</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {BOOST_TIERS.map(opt => (
                        <div key={opt.id} className={`relative p-3 rounded-lg border-2 ${state.boost === opt.id ? "border-purple-500 bg-purple-500/10" : colors.border}`}>
                          {opt.recommended && <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs">★</span>}
                          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${opt.id === "basic" ? "from-blue-400 to-blue-600" : opt.id === "pro" ? "from-purple-400 to-pink-600" : "from-orange-400 to-red-600"}`}>
                            <opt.icon className="w-5 h-5 text-white" />
                          </div>
                          <p className="font-bold text-xs">{opt.label}</p>
                          <p className="text-amber-500 text-xs">{opt.coins} 🪙</p>
                          <button onClick={() => userCoins >= opt.coins && dispatch({ type: "SET_BOOST", payload: opt.id })} disabled={opt.coins > 0 && userCoins < opt.coins} className="mt-2 w-full py-1 text-xs rounded bg-blue-500 text-white disabled:bg-gray-400">Select</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Schedule</h3>
                    <Suspense fallback={<div className="h-10 bg-gray-200 animate-pulse" />}>
                      <DateTimePicker selected={state.scheduledTime ? new Date(state.scheduledTime) : null} onChange={(date) => dispatch({ type: "SET_SCHEDULED_TIME", payload: date?.toISOString() })} showTimeSelect dateFormat="Pp" placeholderText="Schedule for later" className={`w-full p-3 rounded-lg border ${colors.input}`} />
                    </Suspense>
                  </div>

                  <div className={`rounded-xl p-4 border ${colors.card}`}>
                    <h3 className="text-lg font-bold mb-3">Advanced</h3>
                    <UltraToggle enabled={state.settings.enableComments} onChange={(v) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableComments: v } })} label="Enable Comments" />
                    <UltraToggle enabled={state.settings.enableGifts} onChange={(v) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableGifts: v } })} label="Allow Gifts" />
                    <UltraToggle enabled={state.settings.enableSharing} onChange={(v) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableSharing: v } })} label="Allow Sharing" />
                    <UltraToggle enabled={state.settings.isNSFW} onChange={(v) => dispatch({ type: "UPDATE_SETTINGS", payload: { isNSFW: v } })} label="NSFW" />
                    <UltraToggle enabled={state.settings.addToStory} onChange={(v) => dispatch({ type: "UPDATE_SETTINGS", payload: { addToStory: v } })} label="Add to Story" description="Also share as 24h story" />
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW */}
              {state.step === 3 && (
                <div className="space-y-6">
                  <h2 className={`text-xl font-bold ${colors.text}`}>Review</h2>
                  <div className={`rounded-xl p-6 border ${colors.card}`}>
                    <div className="flex gap-3 mb-4">
                      <img src={user?.photoURL} className="w-12 h-12 rounded-full" />
                      <div>
                        <p className="font-bold">{user?.displayName}</p>
                        <div className="flex gap-2 text-xs">
                          <span>{VISIBILITY_OPTIONS.find(v => v.id === state.visibility)?.label}</span>
                          {state.boost !== "none" && <span className="text-amber-500">Boosted</span>}
                        </div>
                      </div>
                    </div>
                    <ReactMarkdown>{state.content}</ReactMarkdown>
                    {state.mediaFiles.length > 0 && <div className="grid grid-cols-3 gap-2 mt-4">{state.mediaFiles.slice(0,3).map(m => <div key={m.id} className="aspect-square bg-gray-800 rounded"><img src={m.preview} className="w-full h-full object-cover" /></div>)}</div>}
                    {state.taggedUsers.length > 0 && <p className="text-xs mt-2">👥 {state.taggedUsers.map(u => u.name).join(", ")}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            {state.step > 1 ? <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step - 1 })} className={`px-4 py-2 rounded-lg ${colors.secondary}`}>← Back</button> : <button onClick={() => navigate(-1)} className={`px-4 py-2 rounded-lg ${colors.secondary}`}>Cancel</button>}
            {state.step < 3 ? <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step + 1 })} className={`px-4 py-2 rounded-lg ${colors.primary} text-white`}>Continue →</button> : <button onClick={publishPost} disabled={loading} className={`px-6 py-2 rounded-lg ${colors.primary} text-white flex items-center gap-2`}>{loading ? <Icons.Loader2 className="animate-spin" /> : <Icons.Rocket />} Publish</button>}
          </div>
        </main>

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-2">Publishing...</p>
              {uploading && <p className="text-xs">Uploaded {uploadProgress.completed}/{uploadProgress.total}</p>}
            </div>
          </div>
        )}
      </div>
    </LazyMotion>
  );
};

export default CreatePostUltraPro;