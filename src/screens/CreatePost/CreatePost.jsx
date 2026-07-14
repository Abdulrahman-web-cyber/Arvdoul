// ============================================================
// src/screens/CreatePost.jsx
// ARVDOUL ULTIMATE POST CREATOR – SHELL / ORCHESTRATOR
// ============================================================

import React, {
  useReducer, useEffect, useCallback, useRef, useState, lazy, Suspense
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/appStore";
import { openDB } from "idb";
import { v4 as uuidv4 } from "uuid";
import * as Icons from "lucide-react";
import DOMPurify from "dompurify";
import LoadingSpinner from "../components/Shared/LoadingSpinner.jsx";
import ContentEditor from "./ContentEditor";
import PostSettings from "../PostSettings";
import ReviewStep from "../ReviewStep";   .    // we'll inline it later

// Lazy heavy components (for settings)
const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";

// Services
import { getFirestoreService } from "../../services/firestoreService";
import { getStorageService } from "../../services/storageService";
import { getVideoService } from "../../services/videoService";
import { getStoryService } from "../../services/storyService";
import { getSearchService } from "../../services/searchService";
import { getMonetizationService } from "../../services/monetizationService";
import { getNotificationsService } from "../../services/notificationsService";
import { getFeedService } from "../../services/feedService";
import * as userServiceAPI from "../../services/userService";
import { getFunctions, httpsCallable } from "firebase/functions";

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const ARVDOUL_GRADIENT =
  "bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500";
const CARD =
  "rounded-2xl bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-xl backdrop-blur-md";
const DRAFT_DB_NAME = "arvdoul_create_post_drafts";
const OFFLINE_QUEUE_STORE = "offline_queue";
const MEDIA_BLOB_STORE = "media_blobs";

// ──────────────────────────────────────────────
// REDUCER (global state)
// ──────────────────────────────────────────────
const initialState = {
  step: 1,
  postType: "text",
  // Rich‑text content stored as JSON (TipTap)
  contentJSON: null,
  // Plain text fallback
  contentText: "",
  mediaItems: [],         // { id, file, preview, type, progress, error, alt, blobId }
  visibility: "public",
  boost: "none",
  monetization: "none",
  tipJar: { amounts: [5,10,25] },
  collaborators: [],
  scheduleTime: null,
  expireTime: null,
  recurring: null,
  crossPlatform: [],
  seo: { title: "", description: "", canonical: "" },
  topics: [],
  settings: {
    enableComments: true, enableGifts: true, enableSharing: true,
    isNSFW: false, allowReactions: true, hideLikeCount: false,
    allowDownloads: true, addToStory: false,
  },
  backgroundGradient: "none",
  textColor: "#FFFFFF",
  aBTestVariant: null,
  premiumPreview: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "SET_POST_TYPE": return { ...state, postType: action.payload };
    case "SET_CONTENT_JSON": return { ...state, contentJSON: action.payload };
    case "SET_CONTENT_TEXT": return { ...state, contentText: action.payload };
    case "SET_MEDIA_ITEMS": return { ...state, mediaItems: action.payload };
    case "UPDATE_MEDIA_ITEM": {
      const updated = state.mediaItems.map((item, idx) =>
        idx === action.payload.index ? { ...item, ...action.payload.updates } : item
      );
      return { ...state, mediaItems: updated };
    }
    case "ADD_MEDIA_ITEMS": {
      return { ...state, mediaItems: [...state.mediaItems, ...action.payload] };
    }
    case "REMOVE_MEDIA_ITEM": {
      return { ...state, mediaItems: state.mediaItems.filter((_, i) => i !== action.payload) };
    }
    case "REORDER_MEDIA": {
      const arr = [...state.mediaItems];
      const [removed] = arr.splice(action.payload.from, 1);
      arr.splice(action.payload.to, 0, removed);
      return { ...state, mediaItems: arr };
    }
    case "SET_VISIBILITY": return { ...state, visibility: action.payload };
    case "SET_BOOST": return { ...state, boost: action.payload };
    case "SET_MONETIZATION": return { ...state, monetization: action.payload };
    case "SET_TIP_JAR": return { ...state, tipJar: action.payload };
    case "SET_COLLABORATORS": return { ...state, collaborators: action.payload };
    case "SET_SCHEDULE_TIME": return { ...state, scheduleTime: action.payload };
    case "SET_EXPIRE_TIME": return { ...state, expireTime: action.payload };
    case "SET_RECURRING": return { ...state, recurring: action.payload };
    case "TOGGLE_CROSS_PLATFORM": {
      const p = action.payload;
      const exists = state.crossPlatform.includes(p);
      return { ...state, crossPlatform: exists ? state.crossPlatform.filter(x => x !== p) : [...state.crossPlatform, p] };
    }
    case "SET_SEO": return { ...state, seo: { ...state.seo, ...action.payload } };
    case "SET_TOPICS": return { ...state, topics: action.payload };
    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.payload } };
    case "SET_BACKGROUND_GRADIENT": return { ...state, backgroundGradient: action.payload };
    case "SET_TEXT_COLOR": return { ...state, textColor: action.payload };
    case "SET_AB_TEST": return { ...state, aBTestVariant: action.payload };
    case "TOGGLE_PREMIUM_PREVIEW": return { ...state, premiumPreview: !state.premiumPreview };
    case "LOAD_DRAFT": return { ...state, ...action.payload };
    case "RESET": return initialState;
    default: return state;
  }
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────
export default function CreatePost() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { coins: userCoins, deductCoins } = useAppStore();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0 });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [initializing, setInitializing] = useState(true);
  const [serviceError, setServiceError] = useState(null);

  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const dbRef = useRef(null);

  // Service refs
  const firestoreRef = useRef(null);
  const storageRef = useRef(null);
  const videoRef = useRef(null);
  const storyRef = useRef(null);
  const searchRef = useRef(null);
  const monetizationRef = useRef(null);
  const notificationsRef = useRef(null);
  const feedRef = useRef(null);

  const isDark = theme === "dark";

  // ─── Init services and load drafts ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const [fs, st, vs, ss, se, ms, ns, fd] = await Promise.all([
          getFirestoreService(), getStorageService(), getVideoService(),
          getStoryService(), getSearchService(), getMonetizationService(),
          getNotificationsService(), getFeedService()
        ]);
        if (!mountedRef.current) return;
        firestoreRef.current = fs; storageRef.current = st; videoRef.current = vs;
        storyRef.current = ss; searchRef.current = se; monetizationRef.current = ms;
        notificationsRef.current = ns; feedRef.current = fd;
        await fs.ensureInitialized?.();
        await st.initialize?.();

        // Open IndexedDB
        dbRef.current = await openDB(DRAFT_DB_NAME, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts", { keyPath: "id" });
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
            if (!db.objectStoreNames.contains(MEDIA_BLOB_STORE)) db.createObjectStore(MEDIA_BLOB_STORE, { keyPath: "id" });
          },
        });

        // Load drafts
        const allDrafts = await dbRef.current.getAll("drafts");
        setDrafts(allDrafts.filter(d => !d.offline));
        setInitializing(false);
      } catch (err) {
        console.error(err);
        setServiceError(err.message);
        setInitializing(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // Offline detection
  useEffect(() => {
    const online = () => { setIsOffline(false); flushOfflineQueue(); };
    const offline = () => setIsOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  // ─── Offline queue ──────────────────────────────────
  const flushOfflineQueue = useCallback(async () => {
    if (!dbRef.current) return;
    const queue = await dbRef.current.getAll(OFFLINE_QUEUE_STORE);
    for (const item of queue) {
      try {
        // Replay the publish action with stored state
        await publishPost(item.payload, true);
        await dbRef.current.delete(OFFLINE_QUEUE_STORE, item.id);
      } catch (e) {
        console.warn("Offline publish failed", e);
      }
    }
  }, []);

  // ─── Draft management ──────────────────────────────
  const saveDraft = useCallback(async (overrideState = null) => {
    if (!dbRef.current) return;
    const data = overrideState || state;
    // Store media blobs separately
    const mediaToStore = [];
    for (const m of data.mediaItems) {
      if (m.file) {
        const blobId = uuidv4();
        await dbRef.current.put(MEDIA_BLOB_STORE, { id: blobId, blob: m.file, type: m.type });
        mediaToStore.push({ ...m, file: null, preview: null, blobId });
      } else {
        mediaToStore.push(m);
      }
    }
    const draft = { id: "current_draft", data: { ...data, mediaItems: mediaToStore }, updatedAt: Date.now() };
    await dbRef.current.put("drafts", draft);
    // Refresh list
    const all = await dbRef.current.getAll("drafts");
    setDrafts(all.filter(d => !d.offline));
  }, [state]);

  const loadDraft = useCallback(async (draft) => {
    // Restore media from blobs
    const restoredMedia = [];
    for (const m of draft.data.mediaItems) {
      if (m.blobId) {
        const blobRecord = await dbRef.current.get(MEDIA_BLOB_STORE, m.blobId);
        if (blobRecord) {
          const file = new File([blobRecord.blob], m.name, { type: m.type.startsWith("video") ? "video/mp4" : m.type.startsWith("audio") ? "audio/webm" : "image/jpeg" });
          restoredMedia.push({ ...m, file, preview: URL.createObjectURL(file), blobId: null });
        } else {
          restoredMedia.push({ ...m, error: "File missing" });
        }
      } else {
        restoredMedia.push(m);
      }
    }
    dispatch({ type: "LOAD_DRAFT", payload: { ...draft.data, mediaItems: restoredMedia } });
    toast.success("Draft loaded");
    setShowDrafts(false);
  }, []);

  const deleteDraft = useCallback(async (id) => {
    await dbRef.current.delete("drafts", id);
    const all = await dbRef.current.getAll("drafts");
    setDrafts(all.filter(d => !d.offline));
  }, []);

  // ─── Publish logic ──────────────────────────────────
  const uploadMedia = useCallback(async () => {
    const items = state.mediaItems.filter(m => m.file && !m.error);
    const results = [];
    let completed = 0;
    for (const media of items) {
      if (abortRef.current?.signal.aborted) throw new Error("Upload aborted");
      try {
        const result = await storageRef.current.uploadFileWithProgress(
          media.file,
          `posts/${user.uid}/${Date.now()}_${media.file.name}`,
          {
            userId: user.uid,
            onProgress: (p) => {
              const idx = state.mediaItems.indexOf(media);
              dispatch({ type: "UPDATE_MEDIA_ITEM", payload: { index: idx, updates: { progress: p.progress } } });
            }
          }
        );
        results.push({ url: result.downloadURL, type: media.type, name: media.name, alt: media.alt });
        completed++;
        setUploadProgress({ total: items.length, completed });
      } catch (err) {
        const idx = state.mediaItems.indexOf(media);
        dispatch({ type: "UPDATE_MEDIA_ITEM", payload: { index: idx, updates: { error: err.message } } });
        toast.error(`Failed to upload ${media.name}`);
      }
    }
    return results;
  }, [state.mediaItems, user]);

  const publishPost = useCallback(async (overrideState = null, isOfflineReplay = false) => {
    const current = overrideState || state;
    if (!user) return toast.error("Authentication required");

    if (isOffline && !isOfflineReplay) {
      // Save to offline queue
      const id = uuidv4();
      await dbRef.current.put(OFFLINE_QUEUE_STORE, { id, payload: current, createdAt: Date.now() });
      toast.success("Post queued for offline");
      navigate("/");
      return;
    }

    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const uploadedMedia = state.mediaItems.length ? await uploadMedia() : [];

      const postData = {
        type: current.postType,
        content: current.contentJSON,   // rich text JSON
        plainText: current.contentText,  // fallback
        media: uploadedMedia,
        authorId: user.uid,
        authorName: user.displayName,
        authorUsername: user.username,
        authorPhoto: user.photoURL,
        visibility: current.visibility,
        monetization: current.monetization !== "none" ? { type: current.monetization, tipJar: current.tipJar } : null,
        boost: current.boost !== "none" ? { type: current.boost, multiplier: BOOST_TIERS.find(b => b.id === current.boost).multiplier } : null,
        scheduleTime: current.scheduleTime,
        expireTime: current.expireTime,
        recurring: current.recurring,
        crossPlatform: current.crossPlatform,
        seo: current.seo,
        topics: current.topics,
        settings: current.settings,
        background: current.backgroundGradient,
        textColor: current.textColor,
        aBTestVariant: current.aBTestVariant,
        coAuthors: current.collaborators,
        status: current.scheduleTime ? "scheduled" : "published",
      };

      const result = await firestoreRef.current.createPost(postData);
      if (!result.success) throw new Error(result.error);

      // Boost coin deduction
      if (current.boost !== "none") {
        const boost = BOOST_TIERS.find(b => b.id === current.boost);
        if (boost.coins > 0) {
          const spend = await monetizationRef.current.spendCoins(user.uid, boost.coins, "post_boost");
          if (spend.success) {
            deductCoins(boost.coins);
            try { const fn = httpsCallable(getFunctions(), "boostPostRanking"); await fn({ postId: result.postId, multiplier: boost.multiplier }); } catch {}
          }
        }
      }

      // Notifications, story, feed cache...
      if (current.settings.addToStory && storyRef.current) {
        storyRef.current.createStory({ /* ... */ }).catch(() => {});
      }
      if (current.collaborators.length && notificationsRef.current) {
        Promise.allSettled(current.collaborators.map(u =>
          notificationsRef.current.sendNotification({ type: "coauthor", recipientId: u.id, senderId: user.uid, postId: result.postId })
        ));
      }
      feedRef.current?.clearUserCache?.(user.uid);
      await dbRef.current.delete("drafts", "current_draft");

      toast.success("Post published!");
      navigate("/");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [state, user, isOffline, uploadMedia, deductCoins, navigate]);

  // Auto‑save (debounced)
  const saveTimeout = useRef(null);
  useEffect(() => {
    if (initializing) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDraft(), 3000);
    return () => clearTimeout(saveTimeout.current);
  }, [state, saveDraft, initializing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); publishPost(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveDraft(); toast.success("Draft saved"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [publishPost, saveDraft]);

  // ─── Render ──────────────────────────────────────────
  if (initializing) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (serviceError) return <div className="min-h-screen flex items-center justify-center p-8 text-center"><p>Service error: {serviceError}</p></div>;

  return (
    <div className={`min-h-screen pb-20 transition-colors ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {isOffline && <div className="sticky top-0 z-50 bg-yellow-500 text-black p-2 text-center text-sm font-medium">⚠️ Offline – post will be queued</div>}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icons.X className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500">Create Post</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowDrafts(!showDrafts)} className="px-3 py-1.5 rounded-full text-sm bg-gray-200 dark:bg-gray-700"><Icons.Bookmark className="w-4 h-4 inline mr-1" />Drafts</button>
            <button onClick={() => publishPost()} disabled={loading} className={`px-4 py-1.5 rounded-full text-sm font-bold ${ARVDOUL_GRADIENT} text-white disabled:opacity-50`}>
              {loading ? <LoadingSpinner size="sm" /> : "Publish"}
            </button>
          </div>
        </div>
        {showDrafts && (
          <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-b shadow-xl max-h-60 overflow-auto z-50">
            {drafts.length === 0 ? <p className="p-4 text-center text-sm">No drafts</p> : drafts.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-100 dark:hover:bg-gray-700">
                <div onClick={() => loadDraft(d)} className="flex-1 cursor-pointer">
                  <p className="text-sm">{d.data.contentText?.slice(0, 50) || "Untitled"}</p>
                  <p className="text-xs text-gray-500">{new Date(d.updatedAt).toLocaleString()}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteDraft(d.id); }}><Icons.Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Step indicator */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-center gap-2 mb-8">
          {[1,2,3].map(s => (
            <button key={s} onClick={() => dispatch({ type: "SET_STEP", payload: s })}
              className={`w-8 h-8 rounded-full text-xs font-bold transition ${state.step === s ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30" : "bg-gray-200 dark:bg-gray-700"}`}>{s}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={state.step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {state.step === 1 && (
              <ContentEditor state={state} dispatch={dispatch} isDark={isDark} user={user} storage={storageRef.current} search={searchRef.current} />
            )}
            {state.step === 2 && (
              <PostSettings state={state} dispatch={dispatch} isDark={isDark} user={user} userCoins={userCoins} search={searchRef.current} />
            )}
            {state.step === 3 && (
              <ReviewStep state={state} isDark={isDark} user={user} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step - 1 })} disabled={state.step === 1} className="px-4 py-2 rounded-full bg-gray-200 dark:bg-gray-700">Back</button>
          {state.step < 3 ? (
            <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step + 1 })} className={`px-4 py-2 rounded-full ${ARVDOUL_GRADIENT} text-white`}>Continue</button>
          ) : (
            <button onClick={() => publishPost()} disabled={loading} className={`px-6 py-2 rounded-full ${ARVDOUL_GRADIENT} text-white font-bold flex items-center gap-2`}>
              {loading ? <LoadingSpinner size="sm" /> : <><Icons.Rocket className="w-4 h-4" /> Publish</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Small inline component for review step
function ReviewStep({ state, isDark, user }) {
  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-xl font-bold mb-4">Review</h2>
      <div className="flex gap-3 mb-4">
        <img src={user?.photoURL || "/assets/default-profile.png"} className="w-12 h-12 rounded-full" />
        <div><p className="font-bold">{user?.displayName}</p><p className="text-xs">@{user?.username}</p></div>
      </div>
      {/* Simplified preview: show text - with XSS protection */}
      <div className="prose dark:prose-invert max-w-none mb-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(state.contentText, { ALLOWED_TAGS: ['p','br','strong','em','u','s','blockquote','ul','ol','li','a','h1','h2','h3','h4','h5','h6'], ALLOWED_ATTR: ['href','target','rel'] }) }} />
      {state.mediaItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {state.mediaItems.slice(0,3).map(m => (
            <div key={m.id} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
              {m.type.startsWith("image") && <img src={m.preview} className="w-full h-full object-cover" />}
              {m.type.startsWith("video") && <video src={m.preview} className="w-full h-full object-cover" />}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs space-y-1 mt-2">
        <p>Visibility: {state.visibility}</p>
        {state.scheduleTime && <p>Scheduled: {new Date(state.scheduleTime).toLocaleString()}</p>}
        {state.crossPlatform.length > 0 && <p>Also posting to: {state.crossPlatform.join(", ")}</p>}
      </div>
    </div>
  );
}