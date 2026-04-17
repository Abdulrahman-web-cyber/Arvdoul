// src/screens/CreatePost.jsx - ARVDOUL ULTIMATE ENTERPRISE V30 (FINAL GOD TIER)
// 🚀 WORLD‑CLASS POST CREATION • PERFECT INTEGRATION • BILLION‑USER READY
// 🔥 GLASS‑MORPHIC DESIGN • LIGHT/DARK THEME • RESPONSIVE • PRODUCTION ULTIMATE

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
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/appStore";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import { useMediaQuery } from "react-responsive";
import * as JoyrideModule from "react-joyride";
const Joyride = JoyrideModule.default || JoyrideModule.Joyride;
const { STATUS } = JoyrideModule;
import EmojiPicker from "emoji-picker-react";
import ReactMarkdown from "react-markdown";
import { useDebounce } from "use-debounce";
import { format, parseISO, addDays } from "date-fns";
import { ChromePicker } from "react-color";
import { useSwipeable } from "react-swipeable";
import { v4 as uuidv4 } from "uuid";
import * as Icons from "lucide-react";

// Lazy load heavy components
const MapContainer = lazy(() => import("react-leaflet").then(m => ({ default: m.MapContainer })));
const TileLayer = lazy(() => import("react-leaflet").then(m => ({ default: m.TileLayer })));
const Marker = lazy(() => import("react-leaflet").then(m => ({ default: m.Marker })));
const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ==================== ENTERPRISE CONSTANTS ====================
const POST_TYPES = [
  { id: "text", label: "Text Post", icon: Icons.Type, color: "from-blue-500 to-cyan-500", premium: false },
  { id: "image", label: "Photo Post", icon: Icons.Image, color: "from-emerald-500 to-green-500", premium: false },
  { id: "video", label: "Video Post", icon: Icons.Video, color: "from-red-500 to-pink-500", premium: false },
  { id: "poll", label: "Interactive Poll", icon: Icons.BarChart2, color: "from-purple-500 to-violet-500", premium: false },
  { id: "question", label: "Ask Question", icon: Icons.HelpCircle, color: "from-amber-500 to-yellow-500", premium: false },
  { id: "link", label: "Share Link", icon: Icons.Link, color: "from-indigo-500 to-blue-500", premium: false },
  { id: "audio", label: "Audio Post", icon: Icons.Music, color: "from-rose-500 to-pink-500", premium: false },
  { id: "event", label: "Create Event", icon: Icons.Calendar, color: "from-orange-500 to-red-500", premium: false },
];

const VISIBILITY_OPTIONS = [
  { id: "public", label: "Public", icon: Icons.Globe, color: "text-green-500", badge: "🌍", cost: 0, description: "Everyone can see" },
  { id: "friends", label: "Friends", icon: Icons.Users, color: "text-blue-500", badge: "👥", cost: 0, description: "Only friends" },
  { id: "private", label: "Private", icon: Icons.Lock, color: "text-red-500", badge: "🔒", cost: 0, description: "Only you" },
  { id: "premium", label: "Premium", icon: Icons.Crown, color: "text-purple-500", badge: "👑", cost: 50, description: "Premium subscribers" },
  { id: "followers", label: "Followers", icon: Icons.Users, color: "text-indigo-500", badge: "⭐", cost: 0, description: "Followers only" },
  { id: "custom", label: "Custom", icon: Icons.Settings, color: "text-gray-500", badge: "⚙️", cost: 0, description: "Custom audience" },
];

const MONETIZATION_TYPES = [
  { id: "none", label: "No Monetization", icon: Icons.DollarSign, color: "text-gray-500", fee: 0 },
  { id: "tips", label: "Accept Tips", icon: Icons.Coins, color: "text-yellow-500", fee: 15, minTip: 1, maxTip: 1000, earnings: "85%" },
  { id: "exclusive", label: "Exclusive Content", icon: Icons.Crown, color: "text-purple-500", fee: 20, price: 50, earnings: "80%" },
  { id: "sponsored", label: "Sponsored", icon: Icons.Target, color: "text-green-500", fee: 25, minPrice: 100, earnings: "75%" },
  { id: "ad_revenue", label: "Ad Revenue", icon: Icons.TrendingUp, color: "text-blue-500", fee: 30, earnings: "70%" },
  { id: "subscription", label: "Subscription", icon: Icons.Users, color: "text-orange-500", fee: 10, price: 5, earnings: "90%" },
  { id: "pay_per_view", label: "Pay Per View", icon: Icons.Eye, color: "text-pink-500", fee: 20, price: 1, earnings: "80%" },
];

const BOOST_TIERS = [
  { id: "none", label: "No Boost", icon: Icons.TrendingUp, color: "from-gray-400 to-gray-600", coins: 0, duration: "0d", reach: "Normal", features: ["Standard visibility"] },
  { id: "basic", label: "Basic Boost", icon: Icons.TrendingUp, color: "from-blue-400 to-blue-600", coins: 25, duration: "1d", reach: "2x", features: ["2x reach", "Priority"] },
  { id: "pro", label: "Pro Boost", icon: Icons.Rocket, color: "from-purple-400 to-pink-600", coins: 50, duration: "3d", reach: "5x", features: ["5x reach", "Featured"], recommended: true },
  { id: "max", label: "Max Boost", icon: Icons.Zap, color: "from-orange-400 to-red-600", coins: 100, duration: "7d", reach: "10x", features: ["10x reach", "Top placement"] },
  { id: "ultra", label: "Ultra Boost", icon: Icons.Sparkles, color: "from-yellow-400 to-amber-600", coins: 250, duration: "14d", reach: "25x", features: ["25x reach", "Global promotion", "Analytics"] },
];

const BACKGROUND_IMAGES = [
  { id: "none", url: null, label: "None" },
  { id: "gradient1", url: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Purple Haze" },
  { id: "gradient2", url: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Sunset" },
  { id: "gradient3", url: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Ocean" },
  { id: "gradient4", url: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", label: "Mint" },
  { id: "gradient5", url: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", label: "Peach" },
  { id: "gradient6", url: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)", label: "Deep Space" },
  { id: "gradient7", url: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", label: "Soft Blush" },
  { id: "gradient8", url: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", label: "Cotton Candy" },
];

// Tier-based limits
const TIER_LIMITS = {
  basic: { maxMedia: 5, maxTags: 50, maxFileSize: 10 * 1024 * 1024 }, // 10MB
  premium: { maxMedia: 20, maxTags: 100, maxFileSize: 50 * 1024 * 1024 }, // 50MB
  creator: { maxMedia: 50, maxTags: 200, maxFileSize: 100 * 1024 * 1024 }, // 100MB
};

const UPLOAD_CONCURRENCY = 3;

// ==================== STATE MANAGEMENT ====================
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
  backgroundImage: "gradient1",
  customBackground: null,
  textColor: "#ffffff", // will be overridden
};

function postReducer(state, action) {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "SET_POST_TYPE": return { ...state, postType: action.payload };
    case "SET_CONTENT": return { ...state, content: action.payload };
    case "ADD_MEDIA": return { ...state, mediaFiles: [...state.mediaFiles, ...action.payload] };
    case "REMOVE_MEDIA": return { ...state, mediaFiles: state.mediaFiles.filter((_, i) => i !== action.payload) };
    case "MOVE_MEDIA_UP": {
      if (action.payload === 0) return state;
      const newFiles = [...state.mediaFiles];
      [newFiles[action.payload - 1], newFiles[action.payload]] = [newFiles[action.payload], newFiles[action.payload - 1]];
      return { ...state, mediaFiles: newFiles };
    }
    case "MOVE_MEDIA_DOWN": {
      if (action.payload === state.mediaFiles.length - 1) return state;
      const newFiles = [...state.mediaFiles];
      [newFiles[action.payload], newFiles[action.payload + 1]] = [newFiles[action.payload + 1], newFiles[action.payload]];
      return { ...state, mediaFiles: newFiles };
    }
    case "UPDATE_MEDIA_PROGRESS": return {
      ...state,
      mediaFiles: state.mediaFiles.map((f, i) => i === action.payload.index ? { ...f, progress: action.payload.progress } : f)
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
    case "SET_BACKGROUND_IMAGE": return { ...state, backgroundImage: action.payload };
    case "SET_CUSTOM_BACKGROUND": return { ...state, customBackground: action.payload };
    case "SET_TEXT_COLOR": return { ...state, textColor: action.payload };
    case "CLEAR_POST_LOCATION": return { ...state, postLocation: null };
    case "RESET": return initialState;
    default: return state;
  }
}

// ==================== ULTRA‑ADVANCED TOGGLE ====================
const UltraToggle = ({ enabled, onChange, label, description }) => {
  const { theme } = useTheme();
  return (
    <div className="flex items-center justify-between py-3 group">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          enabled 
            ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30" 
            : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xl transition-transform duration-300 ease-in-out ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
        {enabled && (
          <span className="absolute left-1 text-white">
            <Icons.Check className="w-3 h-3" />
          </span>
        )}
        {!enabled && (
          <span className="absolute right-1 text-gray-500 dark:text-gray-400">
            <Icons.X className="w-3 h-3" />
          </span>
        )}
      </button>
    </div>
  );
};

// ==================== MEDIA UPLOAD QUEUE ====================
class UploadQueue {
  constructor(concurrency = UPLOAD_CONCURRENCY) {
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
    this.results = [];
    this.errors = [];
    this.completed = 0;
    this.total = 0;
    this.listeners = [];
  }

  add(file, uploadFn) {
    this.queue.push({ file, uploadFn });
    this.total++;
    this._notify();
    this._process();
  }

  _process() {
    if (this.active >= this.concurrency || this.queue.length === 0) return;
    this.active++;
    const { file, uploadFn } = this.queue.shift();
    uploadFn(file)
      .then(result => {
        this.results.push(result);
        this.completed++;
        this.active--;
        this._notify();
        this._process();
      })
      .catch(err => {
        this.errors.push({ file, error: err });
        this.completed++;
        this.active--;
        this._notify();
        this._process();
      });
  }

  onProgress(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _notify() {
    const progress = {
      total: this.total,
      completed: this.completed,
      active: this.active,
      results: this.results,
      errors: this.errors,
    };
    this.listeners.forEach(cb => cb(progress));
  }
}

// ==================== MAIN COMPONENT ====================
const CreatePostUltraPro = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, userService } = useAuth();
  const { coins: userCoins, deductCoins, addNotification } = useAppStore();

  // State
  const [state, dispatch] = useReducer(postReducer, initialState);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [servicesReady, setServicesReady] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [debouncedLocation] = useDebounce(locationSearch, 500);
  const [locationResults, setLocationResults] = useState([]);
  const [runTour, setRunTour] = useState(!localStorage.getItem("createPostTourDone"));
  const [uploading, setUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0, active: 0 });
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [tagAllChecked, setTagAllChecked] = useState(false);
  const [userTier, setUserTier] = useState("basic"); // basic, premium, creator
  const uploadQueueRef = useRef(null);
  const [friendIds, setFriendIds] = useState(new Set()); // cache friend IDs
  const mapKey = useRef(Date.now()); // to force map remount

  const isMobile = useMediaQuery({ maxWidth: 767 });
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const contentEditorRef = useRef(null);
  const emojiButtonRef = useRef(null);

  // Service instances
  const firestoreService = useRef(null);
  const storageService = useRef(null);
  const monetizationService = useRef(null);
  const notificationsService = useRef(null);
  const feedService = useRef(null);

  // Theme‑aware default text color
  useEffect(() => {
    dispatch({ type: "SET_TEXT_COLOR", payload: theme === "dark" ? "#ffffff" : "#111827" });
  }, [theme]);

  // Theme colors – ultra‑clean glass‑morphism
  const colors = useMemo(() => theme === "dark"
    ? {
        bg: "bg-gray-900",
        card: "bg-gray-800/70 backdrop-blur-md border border-gray-700 shadow-lg",
        cardSolid: "bg-gray-800",
        text: "text-white",
        textSecondary: "text-gray-400",
        border: "border-gray-700",
        primary: "bg-gradient-to-r from-purple-600 to-pink-600",
        primaryHover: "hover:from-purple-700 hover:to-pink-700",
        secondary: "bg-gray-700 hover:bg-gray-600",
        accent: "text-purple-400",
        input: "bg-gray-800 text-white border-gray-600 focus:border-blue-500",
      }
    : {
        bg: "bg-gradient-to-br from-blue-50 via-white to-white",
        card: "bg-white/70 backdrop-blur-md border border-gray-200 shadow-lg",
        cardSolid: "bg-white",
        text: "text-gray-900",
        textSecondary: "text-gray-600",
        border: "border-gray-200",
        primary: "bg-gradient-to-r from-blue-500 to-purple-500",
        primaryHover: "hover:from-blue-600 hover:to-purple-600",
        secondary: "bg-gray-200 hover:bg-gray-300",
        accent: "text-blue-600",
        input: "bg-white text-gray-900 border-gray-300 focus:border-blue-500",
      }, [theme]);

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => state.step < 3 && dispatch({ type: "SET_STEP", payload: state.step + 1 }),
    onSwipedRight: () => state.step > 1 && dispatch({ type: "SET_STEP", payload: state.step - 1 }),
    trackMouse: true,
    preventDefaultTouchmoveEvent: true,
  });

  // Get user tier and friends list
  useEffect(() => {
    const fetchUserData = async () => {
      if (user && userService) {
        try {
          const profile = await userService.getUserProfile(user.uid);
          const tier = profile?.subscription?.tier || "basic";
          setUserTier(tier);

          // Fetch friends list (assuming userService.getFriends exists)
          if (typeof userService.getFriends === 'function') {
            const friends = await userService.getFriends(user.uid);
            setFriendIds(new Set(friends.map(f => f.id)));
          } else {
            console.warn("userService.getFriends not available, tagging will not filter by friends");
          }
        } catch (err) {
          console.warn("Failed to fetch user data", err);
        }
      }
    };
    fetchUserData();
  }, [user, userService]);

  // ========== INITIALIZE SERVICES ==========
  useEffect(() => {
    const init = async () => {
      try {
        const [fsModule, ssModule, msModule, nsModule, feedModule] = await Promise.all([
          import("../services/firestoreService.js"),
          import("../services/storageService.js"),
          import("../services/monetizationService.js"),
          import("../services/notificationsService.js"),
          import("../services/feedService.js"),
        ]);

        firestoreService.current = fsModule.default?.getService?.() || fsModule.default;
        storageService.current = ssModule.default?.getService?.() || ssModule.default;
        monetizationService.current = msModule.default?.getMonetizationService?.() || msModule.default;
        notificationsService.current = nsModule.default?.getService?.() || nsModule.default;
        feedService.current = feedModule.default?.getService?.() || feedModule.default;

        await Promise.all([
          firestoreService.current.ensureInitialized?.(),
          storageService.current.initialize?.(),
        ]);

        // Load drafts
        const savedDrafts = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("arvdoul_draft_")) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              savedDrafts.push({ id: key.replace("arvdoul_draft_", ""), ...data });
            } catch {}
          }
        }
        setDrafts(savedDrafts);

        // Load most recent draft automatically
        const autoDraft = localStorage.getItem("arvdoul_post_draft");
        if (autoDraft) {
          try {
            const data = JSON.parse(autoDraft);
            if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
              dispatch({ type: "SET_CONTENT", payload: data.content || "" });
              dispatch({ type: "SET_POST_TYPE", payload: data.postType || "text" });
              dispatch({ type: "SET_VISIBILITY", payload: data.visibility || "public" });
              if (data.pollData) dispatch({ type: "SET_POLL", payload: data.pollData });
              if (data.question) dispatch({ type: "SET_QUESTION", payload: data.question });
              if (data.linkData) dispatch({ type: "SET_LINK", payload: data.linkData });
              if (data.eventData) dispatch({ type: "SET_EVENT", payload: data.eventData });
              if (data.backgroundImage) dispatch({ type: "SET_BACKGROUND_IMAGE", payload: data.backgroundImage });
            }
          } catch (e) {
            console.warn("Failed to load draft", e);
          }
        }

        setServicesReady(true);
      } catch (err) {
        console.error("Service init failed:", err);
        setServiceError(err.message);
        toast.error("Failed to initialize services. Please refresh.");
      } finally {
        setInitialLoad(false);
      }
    };
    init();
  }, []);

  // ========== AUTO-SAVE DRAFT ==========
  useEffect(() => {
    if (!servicesReady) return;
    const timer = setInterval(() => {
      localStorage.setItem("arvdoul_post_draft", JSON.stringify({ ...state, timestamp: Date.now() }));
    }, 30000);
    return () => clearInterval(timer);
  }, [state, servicesReady]);

  // ========== SEARCH FRIENDS (ONLY FRIENDS) FOR TAGGING ==========
  useEffect(() => {
    if (!debouncedQuery || !userService) return;
    const search = async () => {
      try {
        const res = await userService.searchUsers(debouncedQuery, { limit: 20 });
        if (res.success) {
          // Filter to only friends if we have friendIds
          let filtered = res.users;
          if (friendIds.size > 0) {
            filtered = res.users.filter(u => friendIds.has(u.id));
          }
          setSearchResults(filtered);
        }
      } catch (err) {
        console.warn("User search failed", err);
      }
    };
    search();
  }, [debouncedQuery, userService, friendIds]);

  // ========== LOCATION SEARCH ==========
  useEffect(() => {
    if (!debouncedLocation) return;
    const fetchLocations = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedLocation)}&limit=5`
        );
        const data = await response.json();
        setLocationResults(data);
      } catch (error) {
        console.warn("Location search failed", error);
      }
    };
    fetchLocations();
  }, [debouncedLocation]);

  // ========== TOUR STEPS ==========
  const tourSteps = useMemo(() => [
    { target: "#post-type-selector", content: "Choose the type of post you want to create." },
    { target: "#content-editor", content: "Write your post content here. You can use markdown and emojis." },
    { target: "#media-uploader", content: "Drag & drop images, videos, or audio files." },
    { target: "#background-selector", content: "Customize the background of your text post with gradients or images." },
    { target: "#post-settings", content: "Configure visibility, monetization, boost, and other advanced options." },
    { target: "#publish-button", content: "Ready to publish? You can also save as draft." },
  ], []);

  const handleTourCallback = (data) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem("createPostTourDone", "true");
      setRunTour(false);
    }
  };

  // ========== MEDIA HANDLING ==========
  const compressImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxWidth = 1920;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
        }, file.type, 0.8);
      };
      img.onerror = reject;
    });
  }, []);

  const handleMediaDrop = useCallback(async (acceptedFiles) => {
    const limits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
    if (state.mediaFiles.length + acceptedFiles.length > limits.maxMedia) {
      toast.error(`You can only upload up to ${limits.maxMedia} files with your plan`);
      return;
    }

    const newFiles = [];
    for (const file of acceptedFiles) {
      const id = uuidv4();
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
        toast.error(`${file.name} is not supported`);
        continue;
      }
      if (file.size > limits.maxFileSize) {
        toast.error(`${file.name} exceeds ${limits.maxFileSize / 1024 / 1024}MB limit`);
        continue;
      }

      let processedFile = file;
      if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
        try {
          processedFile = await compressImage(file);
        } catch (err) {
          toast.error(`Failed to compress ${file.name}`);
          continue;
        }
      }

      newFiles.push({
        id,
        file: processedFile,
        preview: URL.createObjectURL(processedFile),
        type: processedFile.type.startsWith("image/") ? "image" : processedFile.type.startsWith("video/") ? "video" : "audio",
        name: file.name,
        size: processedFile.size,
        progress: 0,
      });
    }
    dispatch({ type: "ADD_MEDIA", payload: newFiles });
  }, [state.mediaFiles.length, compressImage, userTier]);

  // ========== UPLOAD MEDIA WITH QUEUE ==========
  const uploadMedia = useCallback(async () => {
    if (!storageService.current) throw new Error("Storage service not ready");
    setUploading(true);

    const queue = new UploadQueue(UPLOAD_CONCURRENCY);
    uploadQueueRef.current = queue;

    return new Promise((resolve, reject) => {
      const uploaded = [];
      const errors = [];

      queue.onProgress((progress) => {
        setUploadProgress(progress);
        if (progress.completed === progress.total) {
          setUploading(false);
          if (errors.length > 0) {
            toast.error(`${errors.length} files failed to upload`);
          }
          resolve(uploaded);
        }
      });

      state.mediaFiles.forEach((media, index) => {
        queue.add(media, async (fileObj) => {
          try {
            const result = await storageService.current.uploadFileWithProgress(
              fileObj.file,
              `posts/${user.uid}/${Date.now()}_${fileObj.file.name}`,
              {
                userId: user.uid,
                compressImages: true,
                onProgress: (progress) => {
                  dispatch({
                    type: "UPDATE_MEDIA_PROGRESS",
                    payload: { index, progress: progress.progress },
                  });
                },
              }
            );
            uploaded.push({
              url: result.downloadURL,
              type: fileObj.type,
              name: fileObj.file.name,
              size: fileObj.file.size,
            });
          } catch (err) {
            errors.push({ file: fileObj.name, error: err });
            toast.error(`Failed to upload ${fileObj.name}`);
          }
        });
      });
    });
  }, [state.mediaFiles, user]);

  // ========== UPLOAD CUSTOM BACKGROUND IMAGE ==========
  const handleBackgroundUpload = useCallback(async (file) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images allowed for background");
      return;
    }
    if (!storageService.current) {
      toast.error("Storage service not ready");
      return;
    }
    setBackgroundUploading(true);
    try {
      const result = await storageService.current.uploadFile(
        file,
        `post_backgrounds/${user.uid}/${Date.now()}_${file.name}`,
        { userId: user.uid, compressImages: true }
      );
      dispatch({ type: "SET_CUSTOM_BACKGROUND", payload: result.downloadURL });
      dispatch({ type: "SET_BACKGROUND_IMAGE", payload: "custom" });
      toast.success("Background uploaded");
    } catch (err) {
      toast.error("Background upload failed");
    } finally {
      setBackgroundUploading(false);
    }
  }, [user]);

  // ========== MODERATION CHECK ==========
  const moderateContent = useCallback((content) => {
    const spamPatterns = [
      /buy now|cheap|discount|click here|limited time/gi,
      /bit\.ly|goo\.gl|tinyurl|shorturl/gi,
      /casino|poker|betting|gambling/gi,
      /viagra|cialis|levitra/gi,
      /follow me|like for like|follow for follow/gi,
    ];
    const toxicWords = ["idiot", "stupid", "retard", "hate", "kill yourself"];
    let score = 0;
    spamPatterns.forEach(p => { if (p.test(content)) score += 10; });
    toxicWords.forEach(w => { if (content.toLowerCase().includes(w)) score += 5; });
    return { flagged: score > 15, score };
  }, []);

  // ========== FORMATTING HELPERS ==========
  const wrapSelection = (before, after = "") => {
    const textarea = contentEditorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = state.content.substring(start, end);
    const newText = state.content.substring(0, start) + before + selectedText + after + state.content.substring(end);
    dispatch({ type: "SET_CONTENT", payload: newText });
    // Set cursor after the inserted mark
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length + selectedText.length + after.length, start + before.length + selectedText.length + after.length);
    }, 0);
  };

  // ========== VALIDATION ==========
  const validatePost = useCallback(() => {
    if (state.postType === "poll") {
      if (!state.pollData.question.trim()) return toast.error("Poll question required");
      if (state.pollData.options.filter(o => o.trim()).length < 2) return toast.error("At least 2 options required");
    }
    if (state.postType === "question" && !state.question.trim()) return toast.error("Question required");
    if (state.postType === "link") {
      if (!state.linkData.url.trim()) return toast.error("URL required");
      try { new URL(state.linkData.url); } catch { return toast.error("Invalid URL"); }
    }
    if (state.postType === "event") {
      if (!state.eventData.title.trim()) return toast.error("Event title required");
      if (!state.eventData.date) return toast.error("Event date required");
    }
    if (!state.content.trim() && state.mediaFiles.length === 0 && !["poll", "question", "link", "event"].includes(state.postType)) {
      return toast.error("Add content or media");
    }
    const boostOption = BOOST_TIERS.find(b => b.id === state.boost);
    if (boostOption?.coins > 0 && userCoins < boostOption.coins) {
      return toast.error(`Need ${boostOption.coins - userCoins} more coins for this boost`);
    }
    const moderation = moderateContent(state.content);
    if (moderation.flagged) {
      return toast.error("Content flagged for moderation. Please revise.");
    }
    const limits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
    if (state.taggedUsers.length > limits.maxTags) {
      return toast.error(`You can tag at most ${limits.maxTags} users with your plan`);
    }
    return true;
  }, [state, userCoins, moderateContent, userTier]);

  // ========== PUBLISH ==========
  const handlePublish = async () => {
    if (!user?.uid) return toast.error("Please sign in");
    if (!validatePost()) return;
    if (!firestoreService.current || !monetizationService.current) {
      toast.error("Services not ready");
      return;
    }

    setLoading(true);
    try {
      const uploadedMedia = state.mediaFiles.length > 0 ? await uploadMedia() : [];

      const hashtags = state.content.match(/#(\w+)/g)?.map(t => t.toLowerCase()) || [];
      const mentions = state.content.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];

      const postData = {
        type: state.postType,
        content: state.content.trim(),
        media: uploadedMedia,
        authorId: user.uid,
        authorName: user.displayName,
        authorUsername: user.username,
        authorPhoto: user.photoURL,
        visibility: state.visibility,
        monetization: state.monetization !== "none" ? {
          type: state.monetization,
          enabled: true,
          settings: MONETIZATION_TYPES.find(m => m.id === state.monetization),
        } : null,
        boostData: state.boost !== "none" ? {
          type: state.boost,
          appliedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cost: BOOST_TIERS.find(b => b.id === state.boost)?.coins || 0,
        } : null,
        location: state.postLocation,
        taggedUsers: state.taggedUsers,
        scheduledTime: state.scheduledTime,
        expiresAt: state.expiresAt,
        settings: state.settings,
        backgroundImage: state.backgroundImage === "custom" ? state.customBackground : BACKGROUND_IMAGES.find(b => b.id === state.backgroundImage)?.url,
        textColor: state.textColor,
        hashtags,
        mentions,
      };

      if (state.postType === "poll") {
        postData.poll = {
          question: state.pollData.question,
          options: state.pollData.options.filter(o => o.trim()),
          duration: state.pollData.duration,
          allowMultiple: state.pollData.allowMultiple,
          votes: [],
          totalVotes: 0,
        };
      } else if (state.postType === "question") {
        postData.question = state.question;
        postData.answers = [];
      } else if (state.postType === "link") {
        postData.link = state.linkData;
      } else if (state.postType === "event") {
        postData.event = state.eventData;
      }

      const result = await firestoreService.current.createPost(postData);
      if (!result.success) throw new Error(result.error || "Post creation failed");

      if (state.boost !== "none") {
        const boostOption = BOOST_TIERS.find(b => b.id === state.boost);
        if (boostOption.coins > 0) {
          await monetizationService.current.spendCoins(user.uid, boostOption.coins, "boost", { postId: result.postId });
          deductCoins(boostOption.coins);
        }
      }

      if (state.taggedUsers.length > 0 && notificationsService.current) {
        for (const tagged of state.taggedUsers) {
          await notificationsService.current.sendNotification({
            type: "tag",
            recipientId: tagged.id,
            senderId: user.uid,
            title: "You were tagged in a post",
            message: `${user.displayName} tagged you in a post`,
            data: { postId: result.postId },
          }).catch(err => console.warn("Notification failed", err));
        }
      }

      if (feedService.current) {
        feedService.current.clearUserCache(user.uid);
      }

      localStorage.removeItem("arvdoul_post_draft");
      toast.success("Post published successfully!");
      setTimeout(() => navigate("/home"), 1500);
    } catch (err) {
      console.error("Publish failed:", err);
      toast.error(err.message || "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  // ========== DRAFT LOADING ==========
  const loadDraft = (draft) => {
    // Apply draft data to state
    setShowDrafts(false);
    toast.success("Draft loaded");
  };

  // ========== TAG ALL FRIENDS ==========
  const handleTagAll = () => {
    const limits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
    if (tagAllChecked) {
      dispatch({ type: "ADD_TAGGED_USER", payload: [] }); // clear all
    } else {
      const toAdd = searchResults.slice(0, limits.maxTags);
      toAdd.forEach(user => {
        if (!state.taggedUsers.find(u => u.id === user.id)) {
          dispatch({ type: "ADD_TAGGED_USER", payload: { id: user.id, name: user.displayName, photo: user.photoURL } });
        }
      });
      if (searchResults.length > limits.maxTags) {
        toast.info(`You can only tag ${limits.maxTags} users with your plan`);
      }
    }
    setTagAllChecked(!tagAllChecked);
  };

  // ========== RENDER STEP 1: CONTENT ==========
  const renderStep1 = () => {
    // Ensure background style is applied correctly for both themes
    const backgroundStyle = state.postType === "text" && state.backgroundImage !== "none"
      ? {
          background: state.backgroundImage === "custom" ? `url(${state.customBackground})` : BACKGROUND_IMAGES.find(b => b.id === state.backgroundImage)?.url,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};

    // Character count
    const charCount = state.content.length;

    return (
      <div className="space-y-8">
        <div id="post-type-selector">
          <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>Choose Post Type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {POST_TYPES.map(type => {
              const Icon = type.icon;
              const selected = state.postType === type.id;
              return (
                <motion.button
                  key={type.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => dispatch({ type: "SET_POST_TYPE", payload: type.id })}
                  className={`p-3 rounded-xl border transition-all ${
                    selected
                      ? `border-blue-500 bg-gradient-to-br ${type.color}/20 shadow-md`
                      : `${colors.border} ${colors.card} hover:shadow`
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg mb-2 mx-auto flex items-center justify-center bg-gradient-to-br ${type.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${colors.text}`}>{type.label}</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div id="content-editor">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xl font-bold ${colors.text}`}>Your Content</h2>
            <div className="flex gap-2 relative">
              <button
                ref={emojiButtonRef}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 rounded-lg ${colors.secondary}`}
              >
                <Icons.Smile className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setShowEmojiPicker(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-10 z-50"
                      style={{ maxWidth: "320px" }}
                    >
                      <EmojiPicker
                        onEmojiClick={(e) => {
                          dispatch({ type: "SET_CONTENT", payload: state.content + e.emoji });
                          setShowEmojiPicker(false);
                        }}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`p-2 rounded-lg ${colors.secondary}`}
              >
                <Icons.Palette className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showColorPicker && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setShowColorPicker(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-10 z-50"
                    >
                      <ChromePicker
                        color={state.textColor}
                        onChange={(color) => dispatch({ type: "SET_TEXT_COLOR", payload: color.hex })}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Background applied directly to the editor container */}
          <div className={`rounded-xl overflow-hidden border ${colors.card}`} style={backgroundStyle}>
            <div className={`p-2 border-b flex flex-wrap gap-1 ${colors.border} bg-gray-100 dark:bg-gray-800`}>
              {[
                { icon: Icons.Bold, action: () => wrapSelection("**", "**"), label: "Bold" },
                { icon: Icons.Italic, action: () => wrapSelection("*", "*"), label: "Italic" },
                { icon: Icons.Link, action: () => wrapSelection("[", "](url)"), label: "Link" },
                { icon: Icons.List, action: () => wrapSelection("\n- ", ""), label: "Bullet List" },
                { icon: Icons.ListOrdered, action: () => wrapSelection("\n1. ", ""), label: "Numbered List" },
                { icon: Icons.Heading1, action: () => wrapSelection("\n# ", ""), label: "Heading 1" },
                { icon: Icons.Heading2, action: () => wrapSelection("\n## ", ""), label: "Heading 2" },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            <textarea
              ref={contentEditorRef}
              value={state.content}
              onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
              placeholder="What's on your mind?"
              rows={8}
              className={`w-full p-4 text-base resize-none focus:outline-none bg-transparent ${colors.input}`}
              style={{ color: state.textColor }}
            />
            <div className="flex justify-end px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              {charCount} characters
            </div>
          </div>

          <div className={`mt-3 p-4 rounded-xl border ${colors.card}`}>
            <p className={`text-xs font-medium mb-1 ${colors.textSecondary}`}>Preview</p>
            <div className="prose dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{state.content}</ReactMarkdown>
            </div>
          </div>
        </div>

        {state.postType === "text" && (
          <div id="background-selector" className={`rounded-xl p-4 border ${colors.card}`}>
            <h3 className="text-lg font-bold mb-3">Post Background</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {BACKGROUND_IMAGES.map(bg => (
                <button
                  key={bg.id}
                  onClick={() => dispatch({ type: "SET_BACKGROUND_IMAGE", payload: bg.id })}
                  className={`h-16 rounded-lg border-2 overflow-hidden ${
                    state.backgroundImage === bg.id ? "border-blue-500 ring-2 ring-blue-300" : colors.border
                  }`}
                  style={{ background: bg.url || (theme === "dark" ? "#1f2937" : "#ffffff") }}
                >
                  {bg.id === "none" && <span className="text-xs">None</span>}
                </button>
              ))}
              <button
                onClick={() => backgroundInputRef.current?.click()}
                className={`h-16 rounded-lg border-2 flex items-center justify-center ${
                  state.backgroundImage === "custom" ? "border-blue-500 ring-2 ring-blue-300" : colors.border
                }`}
              >
                {state.customBackground ? (
                  <img src={state.customBackground} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Icons.Upload className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleBackgroundUpload(e.target.files[0])}
              />
            </div>
          </div>
        )}

        <div id="media-uploader">
          <h2 className={`text-xl font-bold mb-3 ${colors.text}`}>Add Media</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleMediaDrop(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-xl p-6 text-center border-2 border-dashed ${colors.border} ${colors.card} hover:shadow cursor-pointer`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(e) => handleMediaDrop(Array.from(e.target.files))}
            />
            <Icons.Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {TIER_LIMITS[userTier]?.maxMedia || 5} files max ({TIER_LIMITS[userTier]?.maxFileSize / 1024 / 1024}MB each)
            </p>
          </div>

          {state.mediaFiles.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                {state.mediaFiles.map((media, idx) => (
                  <div key={media.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
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
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {idx > 0 && (
                        <button
                          onClick={() => dispatch({ type: "MOVE_MEDIA_UP", payload: idx })}
                          className="p-1 rounded-full bg-gray-800 text-white hover:bg-gray-700"
                        >
                          <Icons.ChevronUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < state.mediaFiles.length - 1 && (
                        <button
                          onClick={() => dispatch({ type: "MOVE_MEDIA_DOWN", payload: idx })}
                          className="p-1 rounded-full bg-gray-800 text-white hover:bg-gray-700"
                        >
                          <Icons.ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => dispatch({ type: "REMOVE_MEDIA", payload: idx })}
                        className="p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <Icons.Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => dispatch({ type: "ADD_MEDIA", payload: [] })} // clear all
                className="mt-2 text-sm text-red-500 hover:text-red-600"
              >
                Clear all media
              </button>
            </>
          )}
        </div>

        {state.postType === "poll" && (
          <PollCreator pollData={state.pollData} onChange={(val) => dispatch({ type: "SET_POLL", payload: val })} theme={theme} colors={colors} />
        )}
        {state.postType === "question" && (
          <QuestionCreator question={state.question} onChange={(val) => dispatch({ type: "SET_QUESTION", payload: val })} theme={theme} colors={colors} />
        )}
        {state.postType === "link" && (
          <div className={`rounded-xl p-4 border ${colors.card}`}>
            <h3 className="text-lg font-bold mb-3">Link Details</h3>
            <div className="space-y-3">
              <input
                type="url"
                value={state.linkData.url}
                onChange={(e) => dispatch({ type: "SET_LINK", payload: { url: e.target.value } })}
                placeholder="https://..."
                className={`w-full p-3 rounded-lg border-2 focus:border-blue-500 text-sm ${colors.input}`}
              />
              <input
                type="text"
                value={state.linkData.title}
                onChange={(e) => dispatch({ type: "SET_LINK", payload: { title: e.target.value } })}
                placeholder="Title (optional)"
                className={`w-full p-3 rounded-lg border-2 focus:border-blue-500 text-sm ${colors.input}`}
              />
              <textarea
                value={state.linkData.description}
                onChange={(e) => dispatch({ type: "SET_LINK", payload: { description: e.target.value } })}
                placeholder="Description (optional)"
                rows={2}
                className={`w-full p-3 rounded-lg border-2 focus:border-blue-500 text-sm resize-none ${colors.input}`}
              />
            </div>
          </div>
        )}
        {state.postType === "event" && (
          <EventCreator eventData={state.eventData} onChange={(val) => dispatch({ type: "SET_EVENT", payload: val })} theme={theme} colors={colors} />
        )}
      </div>
    );
  };

  // ========== RENDER STEP 2: SETTINGS ==========
  const renderStep2 = () => (
    <div className="space-y-8" id="post-settings">
      <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>Post Settings</h2>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Visibility</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {VISIBILITY_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = state.visibility === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => dispatch({ type: "SET_VISIBILITY", payload: opt.id })}
                className={`p-3 rounded-lg border-2 text-center ${
                  selected ? `border-${opt.color.replace("text-", "")} bg-${opt.color.replace("text-", "")}/10` : colors.border
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-1 ${opt.color}`} />
                <p className={`text-xs font-bold ${opt.color}`}>{opt.label}</p>
                {opt.cost > 0 && <p className="text-xs mt-1">{opt.cost} 🪙</p>}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Monetization</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {MONETIZATION_TYPES.map(opt => {
            const Icon = opt.icon;
            const selected = state.monetization === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => dispatch({ type: "SET_MONETIZATION", payload: opt.id })}
                className={`p-3 rounded-lg border-2 text-center ${
                  selected ? `border-${opt.color.replace("text-", "")} bg-${opt.color.replace("text-", "")}/10` : colors.border
                }`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${opt.color}`} />
                <p className={`text-xs font-bold ${opt.color}`}>{opt.label}</p>
                {opt.fee > 0 && <p className="text-xs text-red-500 mt-1">{opt.fee}%</p>}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Boost Post</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BOOST_TIERS.map(opt => {
            const Icon = opt.icon;
            const selected = state.boost === opt.id;
            const canAfford = userCoins >= opt.coins;
            return (
              <div
                key={opt.id}
                className={`relative p-3 rounded-lg border-2 ${selected ? "border-purple-500 bg-purple-500/10" : colors.border}`}
              >
                {opt.recommended && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-bold whitespace-nowrap">
                    ★ RECOMMENDED
                  </div>
                )}
                <div className="text-center">
                  <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${opt.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-xs truncate">{opt.label}</p>
                  <p className="text-amber-500 font-bold text-xs mt-1">{opt.coins > 0 ? `${opt.coins} 🪙` : "FREE"}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.duration} • {opt.reach}</p>
                  <button
                    onClick={() => canAfford && dispatch({ type: "SET_BOOST", payload: opt.id })}
                    disabled={!canAfford && opt.coins > 0}
                    className={`mt-2 w-full py-1.5 rounded-lg text-xs font-bold ${
                      selected
                        ? "bg-green-500 text-white"
                        : canAfford
                        ? `${colors.primary} text-white`
                        : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {selected ? "SELECTED" : canAfford ? "Boost" : `Need ${opt.coins - userCoins}🪙`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Location</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLocationPicker(!showLocationPicker)}
            className={`px-4 py-2 rounded-lg font-medium ${colors.primary} text-white text-sm flex items-center gap-2`}
          >
            <Icons.MapPin className="w-4 h-4" />
            {state.postLocation ? "Change Location" : "Add Location"}
          </button>
          {state.postLocation && (
            <button
              onClick={() => dispatch({ type: "CLEAR_POST_LOCATION" })}
              className={`px-4 py-2 rounded-lg font-medium bg-red-500 text-white text-sm flex items-center gap-2`}
            >
              <Icons.X className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
        <AnimatePresence>
          {showLocationPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for a place..."
                className={`w-full p-3 rounded-lg border-2 ${colors.border} focus:border-blue-500 text-sm mb-3 ${colors.input}`}
              />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {locationResults.map((place, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      // Ensure we have lat and lon as numbers
                      const lat = parseFloat(place.lat);
                      const lon = parseFloat(place.lon);
                      if (isNaN(lat) || isNaN(lon)) {
                        toast.error("Invalid location data");
                        return;
                      }
                      dispatch({
                        type: "SET_POST_LOCATION",
                        payload: {
                          lat,
                          lon,
                          displayName: place.display_name,
                        },
                      });
                      setShowLocationPicker(false);
                    }}
                    className={`p-2 rounded-lg border ${colors.border} hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm`}
                  >
                    {place.display_name}
                  </div>
                ))}
              </div>
              {state.postLocation && (
                <Suspense fallback={<div className="h-48 bg-gray-200 animate-pulse rounded-lg" />}>
                  <div key={mapKey.current} className="h-48 mt-3 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-700">
                    <MapContainer
                      center={[state.postLocation.lat, state.postLocation.lon]}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[state.postLocation.lat, state.postLocation.lon]} />
                    </MapContainer>
                  </div>
                </Suspense>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3 flex items-center justify-between">
          <span>Tag Friends</span>
          {searchResults.length > 0 && (
            <button
              onClick={handleTagAll}
              className={`text-xs px-2 py-1 rounded ${tagAllChecked ? "bg-blue-500 text-white" : colors.secondary}`}
            >
              {tagAllChecked ? "Deselect All" : "Select All"}
            </button>
          )}
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search friends..."
          className={`w-full p-3 rounded-lg border-2 ${colors.border} focus:border-blue-500 text-sm mb-3 ${colors.input}`}
        />
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {searchResults.map(user => (
            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <img
                  src={user.photoURL || userService?.generateDefaultAvatar?.(user.id, user.displayName)}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    e.target.src = userService?.generateDefaultAvatar?.(user.id, user.displayName) || "/assets/default-profile.png";
                  }}
                />
                <span className={`text-sm font-medium ${colors.text}`}>{user.displayName}</span>
              </div>
              {state.taggedUsers.find(u => u.id === user.id) ? (
                <button
                  onClick={() => dispatch({ type: "REMOVE_TAGGED_USER", payload: user.id })}
                  className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs"
                >
                  Remove
                </button>
              ) : (
                <button
                  onClick={() => {
                    const limits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
                    if (state.taggedUsers.length >= limits.maxTags) {
                      toast.error(`You can tag at most ${limits.maxTags} users with your plan`);
                      return;
                    }
                    dispatch({ type: "ADD_TAGGED_USER", payload: { id: user.id, name: user.displayName, photo: user.photoURL } });
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${colors.primary} text-white`}
                >
                  Tag
                </button>
              )}
            </div>
          ))}
        </div>
        {state.taggedUsers.length > 0 && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.taggedUsers.map(u => (
                <span key={u.id} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-500 text-xs flex items-center gap-1">
                  <img
                    src={u.photo || userService?.generateDefaultAvatar?.(u.id, u.name)}
                    className="w-4 h-4 rounded-full"
                    onError={(e) => { e.target.src = "/assets/default-profile.png"; }}
                  />
                  {u.name}
                  <Icons.X
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => dispatch({ type: "REMOVE_TAGGED_USER", payload: u.id })}
                  />
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{state.taggedUsers.length}/{TIER_LIMITS[userTier]?.maxTags || 50} tags used</p>
          </>
        )}
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Schedule & Expiry</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Schedule post</label>
            <input
              type="datetime-local"
              value={state.scheduledTime || ""}
              onChange={(e) => dispatch({ type: "SET_SCHEDULED_TIME", payload: e.target.value })}
              className={`w-full p-3 rounded-lg border-2 ${colors.border} focus:border-blue-500 text-sm ${colors.input}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires at (optional)</label>
            <input
              type="datetime-local"
              value={state.expiresAt || ""}
              min={state.scheduledTime ? new Date(state.scheduledTime).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
              onChange={(e) => dispatch({ type: "SET_EXPIRES_AT", payload: e.target.value })}
              className={`w-full p-3 rounded-lg border-2 ${colors.border} focus:border-blue-500 text-sm ${colors.input}`}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for never expire</p>
          </div>
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${colors.card}`}>
        <h3 className="text-lg font-bold mb-3">Advanced Settings</h3>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          <UltraToggle
            enabled={state.settings.enableComments}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableComments: val } })}
            label="Enable Comments"
          />
          <UltraToggle
            enabled={state.settings.enableGifts}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableGifts: val } })}
            label="Allow Gifts"
          />
          <UltraToggle
            enabled={state.settings.enableSharing}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { enableSharing: val } })}
            label="Allow Sharing"
          />
          <UltraToggle
            enabled={state.settings.allowReactions}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { allowReactions: val } })}
            label="Allow Reactions (❤️, 🔥, etc.)"
          />
          <UltraToggle
            enabled={state.settings.hideLikeCount}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { hideLikeCount: val } })}
            label="Hide Like Count"
            description="Viewers won't see the number of likes"
          />
          <UltraToggle
            enabled={state.settings.allowDownloads}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { allowDownloads: val } })}
            label="Allow Downloads"
            description="For image/video posts"
          />
          <UltraToggle
            enabled={state.settings.isNSFW}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { isNSFW: val } })}
            label="Mark as NSFW (18+)"
          />
          <UltraToggle
            enabled={state.settings.addToStory}
            onChange={(val) => dispatch({ type: "UPDATE_SETTINGS", payload: { addToStory: val } })}
            label="Add to Story"
            description="Also share as a 24h story"
          />
        </div>
      </div>
    </div>
  );

  // ========== RENDER STEP 3: REVIEW ==========
  const renderStep3 = () => {
    const backgroundStyle = state.postType === "text" && state.backgroundImage !== "none"
      ? {
          background: state.backgroundImage === "custom" ? `url(${state.customBackground})` : BACKGROUND_IMAGES.find(b => b.id === state.backgroundImage)?.url,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};
    const textColorStyle = state.postType === "text" ? { color: state.textColor } : {};

    return (
      <div className="space-y-6">
        <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>Review & Publish</h2>

        <div className={`rounded-xl p-6 border ${colors.card}`} style={backgroundStyle}>
          <div className="flex items-center gap-3 mb-4">
            <img
              src={user?.photoURL || userService?.generateDefaultAvatar?.(user?.uid, user?.displayName)}
              alt=""
              className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-800 object-cover"
              onError={(e) => { e.target.src = "/assets/default-profile.png"; }}
            />
            <div>
              <h4 className={`font-bold ${textColorStyle}`}>{user?.displayName}</h4>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className={colors.textSecondary}>Just now</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold">
                  {VISIBILITY_OPTIONS.find(v => v.id === state.visibility)?.label}
                </span>
                {state.boost !== "none" && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold">
                    {BOOST_TIERS.find(b => b.id === state.boost)?.label} boost
                  </span>
                )}
              </div>
            </div>
          </div>

          {state.content && (
            <div className="mb-4 text-base" style={textColorStyle}>
              <ReactMarkdown>{state.content}</ReactMarkdown>
            </div>
          )}

          {state.postType === "poll" && state.pollData.question && (
            <div className="mb-4 p-4 rounded-lg bg-purple-500/10">
              <p className="font-bold mb-2">📊 {state.pollData.question}</p>
              <div className="space-y-1 text-sm">
                {state.pollData.options.filter(o => o).map((opt, i) => <div key={i}>• {opt}</div>)}
              </div>
            </div>
          )}

          {state.postType === "question" && state.question && (
            <div className="mb-4 p-4 rounded-lg bg-amber-500/10">
              <p className="font-bold">❓ {state.question}</p>
            </div>
          )}

          {state.postType === "link" && state.linkData.url && (
            <div className="mb-4 p-4 rounded-lg bg-blue-500/10">
              <a href={state.linkData.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm break-all">
                {state.linkData.title || state.linkData.url}
              </a>
            </div>
          )}

          {state.postType === "event" && state.eventData.title && (
            <div className="mb-4 p-4 rounded-lg bg-orange-500/10">
              <p className="font-bold">📅 {state.eventData.title}</p>
              <p className="text-xs mt-1">
                {state.eventData.date ? format(new Date(state.eventData.date), "PPP") : ""} {state.eventData.time}
              </p>
            </div>
          )}

          {state.mediaFiles.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              {state.mediaFiles.slice(0, 3).map((media, idx) => (
                <div key={idx} className="aspect-square rounded-lg bg-gray-900">
                  {media.type === "image" && <img src={media.preview} alt="" className="w-full h-full object-cover" />}
                  {media.type === "video" && <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Icons.Video className="w-4 h-4 text-white/50" /></div>}
                  {media.type === "audio" && <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Icons.Music className="w-4 h-4 text-white/50" /></div>}
                </div>
              ))}
              {state.mediaFiles.length > 3 && (
                <div className="aspect-square rounded-lg bg-gray-800 flex items-center justify-center text-white text-sm">
                  +{state.mediaFiles.length - 3}
                </div>
              )}
            </div>
          )}

          {state.postLocation && (
            <p className="text-xs flex items-center gap-1 text-gray-500"><Icons.MapPin className="w-3 h-3" />{state.postLocation.displayName}</p>
          )}
          {state.taggedUsers.length > 0 && (
            <p className="text-xs mt-2">👥 {state.taggedUsers.map(u => u.name).join(", ")}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${colors.card}`}>
            <p className="text-xs font-medium text-gray-500">Type</p>
            <p className="font-bold">{POST_TYPES.find(t => t.id === state.postType)?.label}</p>
            <p className="text-xs mt-2">Media: {state.mediaFiles.length} files</p>
          </div>
          <div className={`p-4 rounded-lg border ${colors.card}`}>
            <p className="text-xs font-medium text-gray-500">Monetization</p>
            <p className="font-bold">{MONETIZATION_TYPES.find(m => m.id === state.monetization)?.label}</p>
            <p className="text-xs mt-2">Boost: {BOOST_TIERS.find(b => b.id === state.boost)?.label}</p>
          </div>
          <div className={`p-4 rounded-lg border ${colors.card}`}>
            <p className="text-xs font-medium text-gray-500">Cost</p>
            <p className="font-bold text-amber-500">{BOOST_TIERS.find(b => b.id === state.boost)?.coins || 0} 🪙</p>
            <p className="text-xs mt-2">Balance: {userCoins} 🪙</p>
          </div>
        </div>
      </div>
    );
  };

  // ========== RENDER ==========
  if (initialLoad) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
        <LoadingSpinner size="xl" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading create post...</p>
      </div>
    );
  }

  if (serviceError) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
        <div className="text-center p-6 rounded-2xl bg-red-50 dark:bg-red-900/20">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Service Error</h2>
          <p className="text-sm mt-2 mb-4">{serviceError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm">
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <div className={`min-h-screen pb-20 ${colors.bg}`} {...swipeHandlers}>
        {/* Optional tour – can be removed or disabled by setting runTour to false */}
        <Joyride steps={tourSteps} run={runTour} continuous showProgress showSkipButton callback={handleTourCallback} />

        <div className={`sticky top-0 z-40 border-b backdrop-blur-sm ${colors.card} ${colors.border} shadow-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <button
              onClick={() => {
                if (state.content || state.mediaFiles.length) {
                  if (window.confirm("Discard unsaved changes?")) {
                    localStorage.removeItem("arvdoul_post_draft");
                    navigate(-1);
                  }
                } else navigate(-1);
              }}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Icons.X className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Create {POST_TYPES.find(t => t.id === state.postType)?.label}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDrafts(!showDrafts)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${colors.secondary}`}
              >
                <Icons.Bookmark className="w-4 h-4 inline mr-1" /> Drafts
              </button>
              <button
                onClick={handlePublish}
                disabled={loading || uploading}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold ${colors.primary} text-white`}
              >
                {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {showDrafts && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-b shadow-lg max-h-60 overflow-y-auto"
              >
                {drafts.length === 0 ? (
                  <p className="p-4 text-center text-gray-500">No saved drafts</p>
                ) : (
                  drafts.map(draft => (
                    <div
                      key={draft.id}
                      onClick={() => loadDraft(draft)}
                      className="p-3 border-b hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <p className="text-sm font-medium">{draft.content?.substring(0, 50)}...</p>
                      <p className="text-xs text-gray-500">{new Date(draft.timestamp).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-4">
          <div className={`flex items-center gap-3 mb-6 p-3 rounded-lg ${colors.card} border`}>
            <img
              src={user?.photoURL || userService?.generateDefaultAvatar?.(user?.uid, user?.displayName)}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => { e.target.src = "/assets/default-profile.png"; }}
            />
            <div className="flex-1">
              <p className="font-bold text-sm">{user?.displayName}</p>
              <p className="text-xs text-gray-500">@{user?.username}</p>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Icons.Coins className="w-4 h-4" />
              <span className="font-bold text-sm">{userCoins}</span>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => dispatch({ type: "SET_STEP", payload: s })}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  state.step === s ? `${colors.primary} text-white` : colors.secondary
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {state.step === 1 && renderStep1()}
              {state.step === 2 && renderStep2()}
              {state.step === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            {state.step > 1 ? (
              <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step - 1 })} className={`px-4 py-2 rounded-lg ${colors.secondary} text-sm`}>
                ← Back
              </button>
            ) : (
              <button onClick={() => navigate(-1)} className={`px-4 py-2 rounded-lg ${colors.secondary} text-sm`}>
                Cancel
              </button>
            )}
            {state.step < 3 ? (
              <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step + 1 })} className={`px-4 py-2 rounded-lg ${colors.primary} text-white text-sm`}>
                Continue →
              </button>
            ) : (
              <button onClick={handlePublish} disabled={loading} className={`px-6 py-2 rounded-lg ${colors.primary} text-white text-sm font-bold flex items-center gap-2`}>
                {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Rocket className="w-4 h-4" />}
                Publish
              </button>
            )}
          </div>
        </main>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-sm">Publishing...</p>
                {uploading && (
                  <p className="text-xs text-gray-500 mt-2">
                    Uploaded {uploadProgress.completed}/{uploadProgress.total} files
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
};

// ==================== SUB-COMPONENTS ====================
const PollCreator = ({ pollData, onChange, theme, colors }) => (
  <div className={`rounded-xl p-4 border ${colors.card}`}>
    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
      <Icons.BarChart2 className="w-5 h-5 text-purple-500" /> Create Poll
    </h3>
    <div className="space-y-4">
      <input
        type="text"
        value={pollData.question}
        onChange={(e) => onChange({ ...pollData, question: e.target.value })}
        placeholder="Poll question"
        className={`w-full p-3 rounded-lg border-2 focus:border-purple-500 text-sm ${colors.input}`}
      />
      <div>
        <p className="text-xs font-medium mb-2">Options ({pollData.options.length}/6)</p>
        {pollData.options.map((opt, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const newOpts = [...pollData.options];
                newOpts[idx] = e.target.value;
                onChange({ ...pollData, options: newOpts });
              }}
              placeholder={`Option ${idx + 1}`}
              className={`flex-1 p-3 rounded-lg border-2 focus:border-purple-500 text-sm ${colors.input}`}
            />
            {pollData.options.length > 2 && (
              <button
                onClick={() => onChange({ ...pollData, options: pollData.options.filter((_, i) => i !== idx) })}
                className="p-2 rounded-lg bg-red-500/10 text-red-500"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {pollData.options.length < 6 && (
          <button
            onClick={() => onChange({ ...pollData, options: [...pollData.options, ""] })}
            className="mt-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-sm"
          >
            <Icons.Plus className="w-4 h-4 inline mr-1" /> Add Option
          </button>
        )}
      </div>
      <div>
        <label className="text-xs font-medium">Duration: {pollData.duration} hours</label>
        <input
          type="range"
          min="1"
          max="168"
          value={pollData.duration}
          onChange={(e) => onChange({ ...pollData, duration: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pollData.allowMultiple}
          onChange={(e) => onChange({ ...pollData, allowMultiple: e.target.checked })}
          className="rounded"
        />
        Allow multiple votes
      </label>
    </div>
  </div>
);

const QuestionCreator = ({ question, onChange, theme, colors }) => (
  <div className={`rounded-xl p-4 border ${colors.card}`}>
    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
      <Icons.HelpCircle className="w-5 h-5 text-amber-500" /> Ask a Question
    </h3>
    <textarea
      value={question}
      onChange={(e) => onChange(e.target.value)}
      placeholder="What would you like to ask?"
      rows={3}
      className={`w-full p-3 rounded-lg border-2 focus:border-amber-500 text-sm resize-none ${colors.input}`}
    />
  </div>
);

const EventCreator = ({ eventData, onChange, theme, colors }) => {
  const [startDate, setStartDate] = useState(eventData.date ? new Date(eventData.date) : null);
  const [startTime, setStartTime] = useState(eventData.time || "");

  useEffect(() => {
    if (startDate) {
      onChange({ date: startDate.toISOString().split("T")[0] });
    }
  }, [startDate, onChange]);

  useEffect(() => {
    onChange({ time: startTime });
  }, [startTime, onChange]);

  return (
    <div className={`rounded-xl p-4 border ${colors.card}`}>
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Icons.Calendar className="w-5 h-5 text-orange-500" /> Event Details
      </h3>
      <div className="space-y-3">
        <input
          type="text"
          value={eventData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Event title"
          className={`w-full p-3 rounded-lg border-2 focus:border-orange-500 text-sm ${colors.input}`}
        />
        <Suspense fallback={<div className="h-10 bg-gray-200 animate-pulse rounded" />}>
          <DateTimePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            placeholderText="Select date"
            className={`w-full p-3 rounded-lg border-2 focus:border-orange-500 text-sm ${colors.input}`}
            dateFormat="yyyy-MM-dd"
          />
        </Suspense>
        <div className="relative">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={`w-full p-3 rounded-lg border-2 focus:border-orange-500 text-sm ${colors.input} pl-10`}
          />
          <Icons.Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        </div>
        <input
          type="text"
          value={eventData.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Location"
          className={`w-full p-3 rounded-lg border-2 focus:border-orange-500 text-sm ${colors.input}`}
        />
        <textarea
          value={eventData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description"
          rows={2}
          className={`w-full p-3 rounded-lg border-2 focus:border-orange-500 text-sm resize-none ${colors.input}`}
        />
      </div>
    </div>
  );
};

export default CreatePostUltraPro;