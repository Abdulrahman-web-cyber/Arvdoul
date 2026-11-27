// src/screens/CreatePost.jsx

import React, {
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import LoadingSpinner from '../components/Shared/LoadingSpinner.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { usePrompt } from '../components/Shared/ConfirmProvider.jsx';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import {
  ServicesContext,
  StateContext,
  useCreatePostServices,
  useCreatePostState,
} from './CreatePost/CreatePostContext.jsx';
import {
  POST_TYPES,
  VISIBILITY_OPTIONS,
  MEDIA_LIMITS,
  SURFACE_GLASS_CLASS,
} from './CreatePost/createPostConstants.js';
import {
  initialState,
  reducer,
  canProceedForState,
} from './CreatePost/createPostReducer.js';
import {
  openCreatePostDB,
  storeBlobWithDedup,
  getOwnedBlob,
  listDraftsForOwner,
  getDraftForOwner,
  saveDraftRecord,
  deleteDraftRecord,
  listDraftVersionsForOwner,
  listTemplatesForOwner,
  saveTemplateRecord,
  getTemplateForOwner,
  listOfflineQueueForOwner,
  getOfflineQueueItemForOwner,
  putOfflineQueueItem,
  deleteOfflineQueueItem,
  stripEphemeralUrlsFromMediaItems,
} from './CreatePost/createPostStorage.js';
import {
  Modal,
  VisibilityPanel,
  LocationPanel,
  SchedulingPanel,
  InsightsPanel,
  ModerationStatus,
  ReviewSummary,
} from './CreatePost/ComposerPanels.jsx';
import EditPostLoader from './CreatePost/EditPostLoader.jsx';

export {
  useCreatePostServices,
  useCreatePostState,
  VISIBILITY_OPTIONS,
  MEDIA_LIMITS,
  POST_TYPES,
  VisibilityPanel,
  LocationPanel,
  SchedulingPanel,
  InsightsPanel,
  ModerationStatus,
  ReviewSummary,
};

const EDITOR_LOADERS = {
  text: () => import('./CreatePost/CreateText'),
  image: () => import('./CreatePost/CreateImage'),
  video: () => import('./CreatePost/CreateVideo'),
  poll: () => import('./CreatePost/CreatePoll'),
  question: () => import('./CreatePost/CreateQuestion'),
  link: () => import('./CreatePost/CreateLink'),
  audio: () => import('./CreatePost/CreateAudio'),
  event: () => import('./CreatePost/CreateEvent'),
};

const preloadEditor = (typeId) => {
  const loader = EDITOR_LOADERS[typeId];
  if (loader) {
    loader().catch((err) => {
      console.warn(`[CreatePost] Editor preload note (${typeId}):`, err?.message);
    });
  }
};

// Lazy-loaded editors & secondary panels
const CreateText = lazy(EDITOR_LOADERS.text);
const CreateImage = lazy(EDITOR_LOADERS.image);
const CreateVideo = lazy(EDITOR_LOADERS.video);
const CreatePoll = lazy(EDITOR_LOADERS.poll);
const CreateQuestion = lazy(EDITOR_LOADERS.question);
const CreateLink = lazy(EDITOR_LOADERS.link);
const CreateAudio = lazy(EDITOR_LOADERS.audio);
const CreateEvent = lazy(EDITOR_LOADERS.event);
const LazyVirtuoso = lazy(() =>
  import('react-virtuoso').then((m) => ({ default: m.Virtuoso }))
);
const CreatorInsightsDrawer = lazy(() => import('./CreatePost/CreatorInsightsDrawer.jsx'));
const ComposerControlCenter = lazy(() => import('./CreatePost/sections/ComposerControlCenter.jsx'));

function DelayedEditorFallback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 160);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      {visible ? <LoadingSpinner size="lg" /> : null}
    </div>
  );
}

function CreatePostProvider({ children }) {
  useEffect(() => {
    import('../utils/routePrefetcher.js')
      .then((m) => m.prefetchCreatePostAll?.())
      .catch(() => {});
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const communityIdParam = searchParams.get('community') || null;
  const { theme } = useTheme();
  const { user } = useAuth();
  const promptDialog = usePrompt();
  const isDark = theme === 'dark';
  const prefersReducedMotion = useReducedMotion();

  const [state, dispatch] = useReducer(reducer, null, () => {
    const requestedType = searchParams.get('type');
    const isEdit = Boolean(searchParams.get('edit'));
    if (
      !isEdit &&
      requestedType &&
      requestedType !== 'vibe' &&
      POST_TYPES.some((t) => t.id === requestedType)
    ) {
      preloadEditor(requestedType);
      return { ...initialState, postType: requestedType, step: 2 };
    }
    if (typeof location.state?.prefillContent === 'string' && location.state.prefillContent.trim()) {
      const preType = location.state?.prefillType || 'text';
      preloadEditor(preType);
      return {
        ...initialState,
        postType: preType,
        content: location.state.prefillContent,
        step: 2,
      };
    }
    return initialState;
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [draftsList, setDraftsList] = useState([]);
  const [offlineQueueItems, setOfflineQueueItems] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const mountedRef = useRef(true);
  const dbRef = useRef(null);
  const dbInitDoneRef = useRef(false);
  const processingOfflineRef = useRef(false);
  const publishLockRef = useRef(false);
  const mediaPreviewUrlsRef = useRef([]);
  const initPromiseRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const stateRef = useRef(state);
  const isOfflineRef = useRef(isOffline);
  const draftsListRef = useRef(draftsList);
  const userRef = useRef(user);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);
  useEffect(() => {
    draftsListRef.current = draftsList;
  }, [draftsList]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const services = useRef({
    firestore: null,
    storage: null,
    search: null,
    feed: null,
  });

  const ensureFirestoreService = useCallback(async () => {
    if (services.current.firestore) return services.current.firestore;
    try {
      const { getFirestoreService } = await import('../services/firestoreService');
      const svc = getFirestoreService();
      services.current.firestore = svc;
      return svc;
    } catch (e) {
      console.warn('[CreatePost] Firestore init note:', e?.message);
      return null;
    }
  }, []);

  const ensureStorageService = useCallback(async () => {
    if (services.current.storage) return services.current.storage;
    try {
      const { getStorageService } = await import('../services/storageService');
      const svc = getStorageService();
      services.current.storage = svc;
      return svc;
    } catch (e) {
      console.warn('[CreatePost] Storage init note:', e?.message);
      return null;
    }
  }, []);

  const ensureSearchService = useCallback(async () => {
    if (services.current.search) return services.current.search;
    try {
      const { getSearchService } = await import('../services/searchService');
      const svc = getSearchService();
      services.current.search = svc;
      return svc;
    } catch (e) {
      console.warn('[CreatePost] Search init note:', e?.message);
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const previewUrls = mediaPreviewUrlsRef.current;
    return () => {
      mountedRef.current = false;
      clearTimeout(autoSaveTimerRef.current);
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const refreshDraftsList = useCallback(async (uidOverride) => {
    const uid = uidOverride ?? userRef.current?.uid;
    if (!dbRef.current || !uid) {
      setDraftsList([]);
      return;
    }
    const owned = await listDraftsForOwner(dbRef.current, uid);
    if (mountedRef.current) setDraftsList(owned);
  }, []);

  const refreshOfflineQueue = useCallback(async (uidOverride) => {
    const uid = uidOverride ?? userRef.current?.uid;
    if (!dbRef.current || !uid) {
      setOfflineQueueItems([]);
      return;
    }
    const owned = await listOfflineQueueForOwner(dbRef.current, uid);
    if (mountedRef.current) setOfflineQueueItems(owned);
  }, []);

  // Non-blocking background initialization: UI paints immediately on frame 1 while
  // IndexedDB drafts/queue and service instances hydrate asynchronously.
  const initBackgroundResources = useCallback(async () => {
    if (initPromiseRef.current) return initPromiseRef.current;

    const initTask = (async () => {
      try {
        const db = await openCreatePostDB();
        if (!mountedRef.current) return;
        dbRef.current = db;
        if (db) {
          await Promise.all([refreshDraftsList(), refreshOfflineQueue()]);
        }
        if (mountedRef.current) setDbReady(true);
      } catch (err) {
        console.warn('[CreatePost] Local storage init note:', err?.message);
        if (mountedRef.current) setDbReady(true);
      } finally {
        dbInitDoneRef.current = true;
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = initTask;
    return initTask;
  }, [refreshDraftsList, refreshOfflineQueue]);

  const ensureDB = useCallback(async () => {
    if (dbRef.current) return dbRef.current;
    if (dbInitDoneRef.current) return null;
    await initBackgroundResources();
    return dbRef.current;
  }, [initBackgroundResources]);

  useEffect(() => {
    initBackgroundResources();
    // Warm core publishing services & common editors after first paint
    const warm = () => {
      ensureFirestoreService();
      ensureStorageService();
      preloadEditor('text');
      preloadEditor('image');
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 1000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, 120);
    return () => clearTimeout(timer);
  }, [initBackgroundResources, ensureFirestoreService, ensureStorageService]);

  // Re-scope local drafts & queue immediately on account switch or sign-out
  useEffect(() => {
    if (!dbReady || !dbRef.current) return;
    refreshDraftsList(user?.uid);
    refreshOfflineQueue(user?.uid);
  }, [user?.uid, dbReady, refreshDraftsList, refreshOfflineQueue]);

  const hydrateDraftMedia = useCallback(async (mediaItems, uid) => {
    const restored = [];
    for (const m of Array.isArray(mediaItems) ? mediaItems : []) {
      if (m.blobId && dbRef.current && uid) {
        const blobRec = await getOwnedBlob(dbRef.current, m.blobId, uid);
        if (blobRec?.blob) {
          const file = new File([blobRec.blob], m.name || 'media', {
            type: blobRec.type || m.type || 'application/octet-stream',
          });
          const preview = URL.createObjectURL(file);
          mediaPreviewUrlsRef.current.push(preview);
          restored.push({ ...m, file, preview, blobId: null });
        } else {
          restored.push({ ...m, error: 'Original file missing' });
        }
      } else {
        restored.push(m);
      }
    }
    return restored;
  }, []);

  const persistDraft = useCallback(
    async ({ silent = false } = {}) => {
      const uid = userRef.current?.uid;
      if (!uid || !stateRef.current.postType || stateRef.current.editPostId) {
        return false;
      }
      const db = dbRef.current || (await ensureDB());
      if (!db) return false;
      const data = stateRef.current;
      setAutoSaveStatus('saving');
      try {
        const mediaToStore = [];
        for (const m of data.mediaItems || []) {
          if (m.file) {
            const blobId = await storeBlobWithDedup(db, m.file, m.type, uid);
            mediaToStore.push({
              ...m,
              file: null,
              preview: null,
              thumbnailUrl:
                typeof m.thumbnailUrl === 'string' && !m.thumbnailUrl.startsWith('blob:')
                  ? m.thumbnailUrl
                  : null,
              blobId,
            });
          } else {
            mediaToStore.push(...stripEphemeralUrlsFromMediaItems([m]));
          }
        }

        const { _past, _future, ...cleanState } = data;
        const draftPayload = {
          id: data.draftId || `draft_${uid}_${data.postType}_${Date.now()}`,
          ownerUid: uid,
          postType: data.postType,
          data: {
            ...cleanState,
            mediaItems: mediaToStore,
            draftId: undefined,
            typeData: {
              ...cleanState.typeData,
              audio: {
                ...(cleanState.typeData?.audio || {}),
                file: null,
                coverFile: null,
                previewUrl:
                  typeof cleanState.typeData?.audio?.url === 'string' &&
                  cleanState.typeData.audio.url.startsWith('http')
                    ? cleanState.typeData.audio.url
                    : null,
              },
            },
          },
          updatedAt: Date.now(),
        };

        await saveDraftRecord(db, draftPayload, uid);
        if (!data.draftId) dispatch({ type: 'SET_DRAFT_ID', payload: draftPayload.id });
        dispatch({ type: 'SET_IS_DIRTY', payload: false });
        await refreshDraftsList(uid);

        setAutoSaveStatus('saved');
        setLastSavedAt(Date.now());

        const fsService = await ensureFirestoreService();
        if (!isOfflineRef.current && fsService?.saveDraft) {
          try {
            await fsService.saveDraft(draftPayload.id, uid, draftPayload);
            if (!silent) toast.success('Draft saved and synced');
          } catch (cloudErr) {
            console.warn('[CreatePost] Cloud draft sync note:', cloudErr?.message);
            if (!silent) toast.success('Draft saved on this device');
          }
        } else if (!silent) {
          toast.success('Draft saved on this device');
        }
        return true;
      } catch (err) {
        console.warn('[CreatePost] Save draft failed:', err?.message);
        setAutoSaveStatus('error');
        if (!silent) toast.error(err?.message || 'Failed to save draft');
        return false;
      }
    },
    [ensureDB, refreshDraftsList, ensureFirestoreService]
  );

  const saveDraft = useCallback(() => persistDraft({ silent: false }), [persistDraft]);

  // Unified parent debounced autosave (replaces duplicate child autosave loops)
  useEffect(() => {
    if (!dbReady || !state.postType || !state.isDirty || state.editPostId || state.loading) {
      return;
    }
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      persistDraft({ silent: true });
    }, 2200);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [
    dbReady,
    state.postType,
    state.isDirty,
    state.editPostId,
    state.loading,
    state.content,
    state.contentJSON,
    state.mediaItems,
    state.visibility,
    state.location,
    state.scheduledTime,
    state.pollClosesAt,
    state.typeData,
    persistDraft,
  ]);

  const loadDraft = useCallback(
    async (draftId) => {
      const uid = userRef.current?.uid;
      if (!uid) return;
      const db = await ensureDB();
      let draft = db ? await getDraftForOwner(db, draftId, uid) : null;
      const fsService = !draft && !isOfflineRef.current ? await ensureFirestoreService() : null;
      if (!draft && fsService?.getDraft) {
        try {
          const cloudDraft = await fsService.getDraft(draftId);
          if (cloudDraft && (!cloudDraft.ownerUid || cloudDraft.ownerUid === uid)) {
            draft = cloudDraft;
          }
        } catch (e) {
          console.warn('[CreatePost] Cloud draft fetch failed:', e?.message);
        }
      }
      if (!draft) {
        toast.error('Draft not found');
        return;
      }
      const restoredMedia = await hydrateDraftMedia(draft.data?.mediaItems, uid);
      dispatch({
        type: 'LOAD_DRAFT',
        payload: {
          ...draft.data,
          mediaItems: restoredMedia,
          draftId: draft.id,
          postType: draft.postType,
        },
      });
      dispatch({ type: 'SET_POST_TYPE', payload: draft.postType });
      dispatch({ type: 'SET_STEP', payload: 2 });
      toast.success('Draft loaded');
    },
    [ensureDB, hydrateDraftMedia, ensureFirestoreService]
  );

  const deleteDraft = useCallback(
    async (draftId, { silent = false } = {}) => {
      const uid = userRef.current?.uid;
      if (!uid || !draftId) return;
      const db = await ensureDB();
      if (db) {
        await deleteDraftRecord(db, draftId, uid);
        await refreshDraftsList(uid);
      }
      const fsService = !isOfflineRef.current ? await ensureFirestoreService() : null;
      if (fsService?.deleteDraft) {
        try {
          await fsService.deleteDraft(draftId);
        } catch (e) {
          console.warn('[CreatePost] Cloud draft delete failed:', e?.message);
        }
      }
      if (!silent) toast.success('Draft deleted');
    },
    [ensureDB, refreshDraftsList, ensureFirestoreService]
  );

  const resumeLatestDraft = useCallback(async () => {
    if (draftsListRef.current.length === 0) return;
    await loadDraft(draftsListRef.current[0].id);
  }, [loadDraft]);

  const saveAsTemplate = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid || !stateRef.current.postType) return;
    const db = await ensureDB();
    if (!db) {
      toast.error('Local template storage unavailable');
      return;
    }
    const name = await promptDialog({
      title: 'Save as Template',
      message: 'Enter a name for this reusable post template:',
      placeholder: 'e.g. Weekly Update',
      confirmText: 'Save Template',
    });
    if (!name || !name.trim()) return;
    await saveTemplateRecord(db, {
      name,
      postType: stateRef.current.postType,
      state: stateRef.current,
      ownerUid: uid,
    });
    toast.success('Template saved');
  }, [ensureDB, promptDialog]);

  const loadTemplate = useCallback(async (templateId) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const db = await ensureDB();
    if (!db) return;
    const tpl = await getTemplateForOwner(db, templateId, uid);
    if (!tpl) {
      toast.error('Template not found');
      return;
    }
    dispatch({
      type: 'LOAD_DRAFT',
      payload: { ...tpl.data, draftId: null, postType: tpl.postType, isDirty: true },
    });
    dispatch({ type: 'SET_POST_TYPE', payload: tpl.postType });
    dispatch({ type: 'SET_STEP', payload: 2 });
    toast.success('Template loaded');
  }, [ensureDB]);

  const getDraftVersions = useCallback(async (draftId) => {
    const uid = userRef.current?.uid;
    if (!uid) return [];
    const db = await ensureDB();
    if (!db) return [];
    return listDraftVersionsForOwner(db, draftId, uid);
  }, [ensureDB]);

  const addToOfflineQueue = useCallback(
    async (postData) => {
      const uid = userRef.current?.uid;
      if (!uid) {
        throw new Error('Sign in required to queue offline posts');
      }
      const db = await ensureDB();
      if (!db) {
        throw new Error('Offline storage unavailable');
      }
      const id = postData.clientPostId || `queue_${uid}_${Date.now()}`;
      const mediaToStore = [];
      for (const m of postData.mediaItems || []) {
        if (m.file) {
          const blobId = await storeBlobWithDedup(db, m.file, m.type, uid);
          mediaToStore.push({ ...m, file: null, preview: null, blobId });
        } else {
          mediaToStore.push(...stripEphemeralUrlsFromMediaItems([m]));
        }
      }
      await putOfflineQueueItem(
        db,
        {
          id,
          ownerUid: uid,
          postType: postData.postType || stateRef.current.postType,
          data: { ...postData, mediaItems: mediaToStore, communityId: communityIdParam },
          createdAt: Date.now(),
          retries: 0,
        },
        uid
      );
      await refreshOfflineQueue(uid);
    },
    [ensureDB, refreshOfflineQueue, communityIdParam]
  );

  const uploadMedia = useCallback(
    async (mediaItems, signal) => {
      if (isOfflineRef.current) {
        throw new Error('Cannot upload media while offline');
      }
      const uid = userRef.current?.uid;
      if (!uid) throw new Error('You must be signed in to upload media');
      const [{ uploadComposerMedia }, storageService] = await Promise.all([
        import('./CreatePost/postMediaPipeline.js'),
        ensureStorageService(),
      ]);
      return uploadComposerMedia(mediaItems, {
        uid,
        storageService,
        signal,
        onItemProgress: (id, percent) =>
          dispatch({ type: 'UPDATE_MEDIA_PROGRESS', payload: { id, updates: { progress: percent } } }),
        onBatchProgress: (pct) => dispatch({ type: 'SET_PROGRESS', payload: pct }),
      });
    },
    [ensureStorageService]
  );

  const publishPost = useCallback(
    async (overrideState = null, isOfflineReplay = false) => {
      if (publishLockRef.current) return null;
      publishLockRef.current = true;
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const current = overrideState || stateRef.current;
      const communityId = current.communityId || communityIdParam;

      try {
        const [{ executePostPublish }] = await Promise.all([
          import('./CreatePost/postPublishPipeline.js'),
          ensureFirestoreService(),
          ensureStorageService(),
        ]);
        const result = await executePostPublish({
          current,
          communityId,
          userSnapshot: userRef.current,
          services: services.current,
          isOffline: isOfflineRef.current,
          isOfflineReplay,
          onMediaItemProgress: (id, percent) =>
            dispatch({ type: 'UPDATE_MEDIA_PROGRESS', payload: { id, updates: { progress: percent } } }),
          onMediaBatchProgress: (pct) => dispatch({ type: 'SET_PROGRESS', payload: pct }),
          onDeleteDraft: (id) => deleteDraft(id, { silent: true }),
          onEnqueueOffline: addToOfflineQueue,
        });

        if (!isOfflineReplay) {
          if (result.status === 'queued') {
            toast.info('You are offline — your post is queued and will publish automatically.');
            navigate('/home');
          } else if (result.status === 'updated') {
            toast.success('Post updated');
            navigate(`/post/${result.postId}`);
          } else if (result.isScheduled) {
            toast.success('Post scheduled');
            navigate('/profile');
          } else {
            if (result.linkedCampaignId) {
              toast.success('Post published and linked Ad Campaign drafted in Advertising Center.');
            } else if (result.promotionError) {
              toast.warning(`Post published, but ad campaign setup failed: ${result.promotionError}`);
            } else {
              toast.success('Post published');
            }
            navigate(communityId ? `/community/${communityId}` : '/home');
          }
        }
        return result;
      } catch (err) {
        console.error('[CreatePost] Publish error:', err);
        if (!isOfflineReplay) {
          dispatch({ type: 'SET_ERROR', payload: err?.message || 'Failed to publish post' });
          toast.error(err?.message || 'Failed to publish post');
        }
        if (isOfflineReplay) throw err;
        return null;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        publishLockRef.current = false;
      }
    },
    [communityIdParam, deleteDraft, addToOfflineQueue, navigate, ensureFirestoreService, ensureStorageService]
  );

  const processOfflineQueue = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!dbRef.current || !uid || isOfflineRef.current || processingOfflineRef.current) return;
    processingOfflineRef.current = true;
    try {
      const items = await listOfflineQueueForOwner(dbRef.current, uid);
      if (items.length === 0) return;
      toast.info(`Syncing ${items.length} queued post${items.length === 1 ? '' : 's'}...`);
      for (const item of items) {
        const restoredMedia = await hydrateDraftMedia(item.data?.mediaItems, uid);
        try {
          await publishPost({ ...item.data, mediaItems: restoredMedia }, true);
          await deleteOfflineQueueItem(dbRef.current, item.id, uid);
        } catch (err) {
          console.warn('[CreatePost] Offline replay failed:', err?.message);
          await putOfflineQueueItem(
            dbRef.current,
            { ...item, retries: (item.retries || 0) + 1 },
            uid
          );
        } finally {
          for (const m of restoredMedia) {
            if (m.preview?.startsWith('blob:')) URL.revokeObjectURL(m.preview);
          }
        }
      }
      await refreshOfflineQueue(uid);
    } finally {
      processingOfflineRef.current = false;
    }
  }, [hydrateDraftMedia, publishPost, refreshOfflineQueue]);

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      processOfflineQueue();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [processOfflineQueue]);

  const retryOfflineItem = useCallback(
    async (itemId) => {
      const uid = userRef.current?.uid;
      if (!dbRef.current || !uid) return;
      const item = await getOfflineQueueItemForOwner(dbRef.current, itemId, uid);
      if (!item) return;
      const restoredMedia = await hydrateDraftMedia(item.data?.mediaItems, uid);
      try {
        await publishPost({ ...item.data, mediaItems: restoredMedia }, true);
        await deleteOfflineQueueItem(dbRef.current, item.id, uid);
        await refreshOfflineQueue(uid);
        toast.success('Published queued post');
      } catch (err) {
        toast.error(err?.message || 'Failed to publish queued post');
      } finally {
        for (const m of restoredMedia) {
          if (m.preview?.startsWith('blob:')) URL.revokeObjectURL(m.preview);
        }
      }
    },
    [hydrateDraftMedia, publishPost, refreshOfflineQueue]
  );

  const deleteOfflineItem = useCallback(
    async (itemId) => {
      const uid = userRef.current?.uid;
      if (!dbRef.current || !uid) return;
      await deleteOfflineQueueItem(dbRef.current, itemId, uid);
      await refreshOfflineQueue(uid);
      toast.success('Removed queued post');
    },
    [refreshOfflineQueue]
  );

  const moderateContent = useCallback(async (content, mediaUrls) => {
    try {
      const { callFunction, FUNCTIONS } = await import('../services/callableService.js');
      const result = await callFunction(FUNCTIONS.MODERATE_POST, { content, mediaUrls });
      dispatch({ type: 'SET_MODERATION_STATUS', payload: result });
      return result;
    } catch (e) {
      console.warn('[CreatePost] Moderation check unavailable:', e?.message);
      const unknown = {
        approved: false,
        unknown: true,
        flags: [],
        reason: 'moderation_unavailable',
      };
      dispatch({ type: 'SET_MODERATION_STATUS', payload: unknown });
      return unknown;
    }
  }, []);

  const getPredictions = useCallback(async () => {
    try {
      const { callFunction, FUNCTIONS } = await import('../services/callableService.js');
      const result = await callFunction(FUNCTIONS.PREDICT_POST_PERFORMANCE, {
        postType: stateRef.current.postType,
        content: stateRef.current.content,
        mediaCount: stateRef.current.mediaItems.length,
        scheduledTime: stateRef.current.scheduledTime,
        visibility: stateRef.current.visibility,
      });
      dispatch({ type: 'SET_INSIGHTS', payload: result });
    } catch (insightsErr) {
      console.warn('[CreatePost] Post performance forecast unavailable:', insightsErr?.message);
    }
  }, []);

  const searchUsers = useCallback(async (query) => {
    const svc = await ensureSearchService();
    if (svc && typeof svc.searchUsers === 'function') {
      const res = await svc.searchUsers(query, { limit: 7 });
      return Array.isArray(res) ? res : res?.users || [];
    }
    return [];
  }, [ensureSearchService]);

  const debounceTimerRef = useRef(null);
  const lastModInputRef = useRef('');

  useEffect(() => {
    if (!state.postType) return;
    const hostedUrls = (state.mediaItems || [])
      .map((m) => m.url)
      .filter((u) => typeof u === 'string' && u.startsWith('http'));
    const sig = `${state.content}::${hostedUrls.join(',')}`;
    if (sig === lastModInputRef.current) return;
    lastModInputRef.current = sig;

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (state.content?.trim()) {
        moderateContent(state.content, hostedUrls);
      }
    }, 900);
    return () => clearTimeout(debounceTimerRef.current);
  }, [state.postType, state.content, state.mediaItems, moderateContent]);

  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pendingType, setPendingType] = useState(null);
  const [draftToResume, setDraftToResume] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [unsavedAction, setUnsavedAction] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  const selectPostType = useCallback(
    (typeId) => {
      if (typeId === 'vibe') {
        navigate('/create-story');
        return;
      }
      if (stateRef.current.isDirty && stateRef.current.postType) {
        setUnsavedAction('switch-type');
        setPendingType(typeId);
        setShowUnsavedModal(true);
        return;
      }
      const existingDraft = draftsListRef.current.find((d) => d.postType === typeId);
      if (existingDraft) {
        setPendingType(typeId);
        setDraftToResume(existingDraft);
        setShowDraftModal(true);
        return;
      }
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_POST_TYPE', payload: typeId });
      dispatch({ type: 'SET_STEP', payload: 2 });
    },
    [navigate]
  );

  const confirmDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    if (unsavedAction === 'back') {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_POST_TYPE', payload: null });
      dispatch({ type: 'SET_STEP', payload: 1 });
    } else if (unsavedAction === 'exit-edit') {
      dispatch({ type: 'RESET' });
      navigate(-1);
    } else if (unsavedAction === 'switch-type' && pendingType) {
      const existingDraft = draftsListRef.current.find((d) => d.postType === pendingType);
      if (existingDraft) {
        setDraftToResume(existingDraft);
        setShowDraftModal(true);
      } else {
        dispatch({ type: 'RESET' });
        dispatch({ type: 'SET_POST_TYPE', payload: pendingType });
        dispatch({ type: 'SET_STEP', payload: 2 });
      }
    }
    setUnsavedAction(null);
    setPendingType(null);
  }, [unsavedAction, pendingType, navigate]);

  const cancelDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    setUnsavedAction(null);
    setPendingType(null);
  }, []);

  const handleResumeDraft = useCallback(async () => {
    if (draftToResume) {
      await loadDraft(draftToResume.id);
    }
    setShowDraftModal(false);
    setDraftToResume(null);
    setPendingType(null);
  }, [draftToResume, loadDraft]);

  const handleStartFresh = useCallback(() => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_POST_TYPE', payload: pendingType });
    dispatch({ type: 'SET_STEP', payload: 2 });
    setShowDraftModal(false);
    setDraftToResume(null);
    setPendingType(null);
  }, [pendingType]);

  const goBackToLauncher = useCallback(() => {
    if (stateRef.current.editPostId) {
      if (stateRef.current.isDirty) {
        setUnsavedAction('exit-edit');
        setShowUnsavedModal(true);
        return;
      }
      navigate(-1);
      return;
    }
    if (stateRef.current.isDirty) {
      setUnsavedAction('back');
      setShowUnsavedModal(true);
      return;
    }
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_POST_TYPE', payload: null });
    dispatch({ type: 'SET_STEP', payload: 1 });
  }, [navigate]);

  const loadTemplates = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const db = await ensureDB();
    const all = db ? await listTemplatesForOwner(db, uid) : [];
    setTemplates(all);
    setShowTemplates(true);
  }, [ensureDB]);

  const loadVersions = useCallback(
    async (draftId) => {
      setSelectedDraftId(draftId);
      const vers = await getDraftVersions(draftId);
      setVersions(vers);
      setShowVersions(true);
    },
    [getDraftVersions]
  );

  const restoreVersion = useCallback(
    async (version) => {
      const uid = userRef.current?.uid;
      const restoredMedia = await hydrateDraftMedia(version.data?.mediaItems, uid);
      dispatch({
        type: 'LOAD_DRAFT',
        payload: {
          ...version.data,
          mediaItems: restoredMedia,
          draftId: selectedDraftId,
          postType: version.data?.postType || stateRef.current.postType,
          isDirty: true,
        },
      });
      dispatch({
        type: 'SET_POST_TYPE',
        payload: version.data?.postType || stateRef.current.postType,
      });
      dispatch({ type: 'SET_STEP', payload: 2 });
      setShowVersions(false);
      toast.success('Version restored');
    },
    [selectedDraftId, hydrateDraftMedia]
  );

  useEffect(() => {
    const handler = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (stateRef.current.postType) saveDraft();
        else toast.info('Select a post type first');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (stateRef.current.postType && stateRef.current.step === 3) publishPost();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
      if (
        e.key === 'Escape' &&
        stateRef.current.postType &&
        !showDraftModal &&
        !showUnsavedModal &&
        !showTemplates &&
        !showVersions
      ) {
        e.preventDefault();
        goBackToLauncher();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    saveDraft,
    publishPost,
    goBackToLauncher,
    showDraftModal,
    showUnsavedModal,
    showTemplates,
    showVersions,
  ]);

  useEffect(() => {
    const handler = (e) => {
      if (stateRef.current.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const canPublishForTopBar = useMemo(() => canProceedForState(state), [state]);

  useEffect(() => {
    const typeLabel = POST_TYPES.find((t) => t.id === state.postType)?.label || 'Post';
    const title = state.editPostId
      ? `Edit ${typeLabel}`
      : state.step >= 2 && state.postType
      ? `Create ${typeLabel}`
      : 'Create Post';
    window.dispatchEvent(
      new CustomEvent('arvdoul:composer_header_state', {
        detail: {
          title,
          step: state.step,
          canPublish: canPublishForTopBar,
          isPublishing: Boolean(state.loading),
          isEditing: Boolean(state.editPostId),
          scheduledTime: state.scheduledTime || null,
        },
      })
    );
  }, [
    state.step,
    state.postType,
    state.loading,
    state.editPostId,
    state.scheduledTime,
    canPublishForTopBar,
  ]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent('arvdoul:composer_header_state', { detail: null })
      );
    };
  }, []);

  useEffect(() => {
    const handleComposerPublish = () => {
      if (
        stateRef.current.step >= 2 &&
        canProceedForState(stateRef.current) &&
        !stateRef.current.loading
      ) {
        publishPost();
      }
    };
    const handleComposerBack = () => {
      if (stateRef.current.step > 2) {
        dispatch({ type: 'SET_STEP', payload: stateRef.current.step - 1 });
      } else if (stateRef.current.step === 2) {
        goBackToLauncher();
      } else {
        navigate(-1);
      }
    };
    window.addEventListener('arvdoul:composer_publish', handleComposerPublish);
    window.addEventListener('arvdoul:composer_back', handleComposerBack);
    return () => {
      window.removeEventListener('arvdoul:composer_publish', handleComposerPublish);
      window.removeEventListener('arvdoul:composer_back', handleComposerBack);
    };
  }, [publishPost, goBackToLauncher, navigate]);

  const servicesValue = useMemo(
    () => ({
      services: services.current,
      dbRef,
      isOffline,
      offlineQueueItems,
      isDark,
      prefersReducedMotion,
      autoSaveStatus,
      lastSavedAt,
      searchUsers,
      saveDraft,
      loadDraft,
      deleteDraft,
      publishPost,
      uploadMedia,
      selectPostType,
      resumeLatestDraft,
      goBackToLauncher,
      getPredictions,
      moderateContent,
      retryOfflineItem,
      deleteOfflineItem,
      saveAsTemplate,
      loadTemplate,
      loadTemplates,
      getDraftVersions,
      loadVersions,
      restoreVersion,
      showTemplates,
      setShowTemplates,
      templates,
      showVersions,
      setShowVersions,
      versions,
    }),
    [
      isOffline,
      offlineQueueItems,
      isDark,
      prefersReducedMotion,
      autoSaveStatus,
      lastSavedAt,
      searchUsers,
      saveDraft,
      loadDraft,
      deleteDraft,
      publishPost,
      uploadMedia,
      selectPostType,
      resumeLatestDraft,
      goBackToLauncher,
      getPredictions,
      moderateContent,
      retryOfflineItem,
      deleteOfflineItem,
      saveAsTemplate,
      loadTemplate,
      loadTemplates,
      getDraftVersions,
      loadVersions,
      restoreVersion,
      showTemplates,
      templates,
      showVersions,
      versions,
    ]
  );

  const stateValue = useMemo(() => ({ state, dispatch, draftsList }), [state, draftsList]);

  return (
    <ServicesContext.Provider value={servicesValue}>
      <StateContext.Provider value={stateValue}>
        {children}
        <AnimatePresence>
          {showDraftModal && (
            <Modal onClose={() => setShowDraftModal(false)} labelledBy="draft-modal-title">
              <h3 id="draft-modal-title" className="text-lg font-bold mb-1.5">
                Resume saved draft?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
                You have an unfinished {pendingType} draft saved. Would you like to continue where you left off?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleResumeDraft}
                  className="min-h-[44px] flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                  style={{ background: BRAND_GRADIENT }}
                >
                  Resume Draft
                </button>
                <button
                  type="button"
                  onClick={handleStartFresh}
                  className="min-h-[44px] flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 font-medium text-sm"
                >
                  Start Fresh
                </button>
              </div>
            </Modal>
          )}

          {showUnsavedModal && (
            <Modal onClose={cancelDiscard} labelledBy="unsaved-modal-title">
              <h3 id="unsaved-modal-title" className="text-lg font-bold mb-1.5">
                Unsaved changes
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
                Leaving now will discard changes made since your last draft save.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDiscard}
                  className="min-h-[44px] flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={cancelDiscard}
                  className="min-h-[44px] flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 font-medium text-sm"
                >
                  Keep Editing
                </button>
              </div>
            </Modal>
          )}

          {showTemplates && (
            <Modal onClose={() => setShowTemplates(false)} labelledBy="templates-modal-title">
              <div className="flex items-center justify-between mb-3">
                <h3 id="templates-modal-title" className="text-lg font-bold">
                  Saved Templates
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTemplates(false)}
                  aria-label="Close templates"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {templates.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                    No templates saved yet.
                  </p>
                )}
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{tpl.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {tpl.postType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        loadTemplate(tpl.id);
                        setShowTemplates(false);
                      }}
                      className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-white rounded-xl"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            </Modal>
          )}

          {showVersions && (
            <Modal onClose={() => setShowVersions(false)} labelledBy="versions-modal-title">
              <div className="flex items-center justify-between mb-3">
                <h3 id="versions-modal-title" className="text-lg font-bold">
                  Version History
                </h3>
                <button
                  type="button"
                  onClick={() => setShowVersions(false)}
                  aria-label="Close version history"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {versions.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                    No previous versions recorded.
                  </p>
                )}
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(ver.timestamp).toLocaleString()}
                      </p>
                      <p className="text-sm truncate">{ver.data?.content?.slice(0, 50) || 'Untitled'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreVersion(ver)}
                      className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-white rounded-xl shrink-0"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </StateContext.Provider>
    </ServicesContext.Provider>
  );
}

function StepIndicator() {
  const { state, dispatch } = useCreatePostState();
  const { autoSaveStatus, lastSavedAt } = useCreatePostServices();
  const steps = [
    { num: 1, label: 'Format' },
    { num: 2, label: 'Compose' },
    { num: 3, label: 'Publish' },
  ];

  return (
    <div className="sticky top-0 z-20 px-4 py-2.5 bg-[#F6F8FC]/85 dark:bg-[#03071B]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="relative flex items-center justify-between w-full max-w-xs mx-auto sm:mx-0">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 dark:bg-white/15 -translate-y-1/2 rounded-full" />
          <div
            className="absolute top-1/2 left-4 h-0.5 -translate-y-1/2 rounded-full transition-all duration-300"
            style={{
              background: BRAND_GRADIENT,
              width: `calc(${((state.step - 1) / 2) * 100}% - 16px)`,
            }}
          />
          {steps.map((step) => {
            const isActive = state.step >= step.num;
            const isCurrent = state.step === step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num <= state.step) dispatch({ type: 'SET_STEP', payload: step.num });
                }}
                disabled={step.num > state.step}
                className="relative z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#F6F8FC] dark:bg-[#03071B] disabled:opacity-60"
                aria-label={`Step ${step.num}: ${step.label}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                    isCurrent
                      ? 'text-white shadow-md'
                      : isActive
                      ? 'bg-arvdoul-purple/15 text-arvdoul-purple'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                  }`}
                  style={isCurrent ? { background: BRAND_GRADIENT } : {}}
                >
                  {step.num}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isCurrent
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0" aria-live="polite">
          {autoSaveStatus === 'saving' && (
            <>
              <LoadingSpinner size="xs" />
              <span>Saving draft...</span>
            </>
          )}
          {autoSaveStatus === 'saved' && lastSavedAt && (
            <>
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          )}
          {autoSaveStatus === 'error' && (
            <>
              <Icons.AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Autosave paused</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const LauncherGrid = React.memo(() => {
  const {
    selectPostType,
    resumeLatestDraft,
    offlineQueueItems,
    retryOfflineItem,
    deleteOfflineItem,
    loadTemplates,
    loadVersions,
    loadDraft,
  } = useCreatePostServices();
  const { draftsList } = useCreatePostState();

  const draftCounts = useMemo(() => {
    const counts = {};
    draftsList.forEach((d) => {
      counts[d.postType] = (counts[d.postType] || 0) + 1;
    });
    return counts;
  }, [draftsList]);

  const scheduledDrafts = useMemo(
    () =>
      draftsList
        .filter((d) => d.data?.scheduledTime)
        .sort((a, b) => new Date(a.data.scheduledTime) - new Date(b.data.scheduledTime)),
    [draftsList]
  );

  const [draftsOpen, setDraftsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState(null); // 'analytics' | 'schedule' | null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      {/* Studio Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create Post
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Choose a format to compose for your feed or community
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadTemplates}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200/90 dark:border-white/12 bg-white/85 dark:bg-[#080F2E]/75 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Icons.LayoutTemplate className="w-4 h-4 text-arvdoul-purple" />
            <span>Templates</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveSidePanel((cur) => (cur === 'schedule' ? null : 'schedule'))
            }
            aria-pressed={activeSidePanel === 'schedule'}
            className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeSidePanel === 'schedule'
                ? 'border-arvdoul-purple bg-arvdoul-purple/12 text-arvdoul-purple'
                : 'border-slate-200/90 dark:border-white/12 bg-white/85 dark:bg-[#080F2E]/75 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10'
            }`}
          >
            <Icons.Calendar className="w-4 h-4" />
            <span>Scheduled</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveSidePanel((cur) => (cur === 'analytics' ? null : 'analytics'))
            }
            aria-pressed={activeSidePanel === 'analytics'}
            className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeSidePanel === 'analytics'
                ? 'border-arvdoul-purple bg-arvdoul-purple/12 text-arvdoul-purple'
                : 'border-slate-200/90 dark:border-white/12 bg-white/85 dark:bg-[#080F2E]/75 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10'
            }`}
          >
            <Icons.BarChart2 className="w-4 h-4" />
            <span>Insights</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${activeSidePanel ? 'lg:grid-cols-12 items-start' : 'grid-cols-1'}`}>
        <div className={activeSidePanel ? 'lg:col-span-7 space-y-5' : 'space-y-5'}>
          {/* 3x3 Post Format Grid */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {POST_TYPES.map((type) => {
              const draftCount = draftCounts[type.id] || 0;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => selectPostType(type.id)}
                  onPointerDown={() => preloadEditor(type.id)}
                  onPointerEnter={() => preloadEditor(type.id)}
                  onFocus={() => preloadEditor(type.id)}
                  className={`${SURFACE_GLASS_CLASS} group relative flex flex-col items-start justify-between p-3 sm:p-5 min-h-[116px] sm:min-h-[136px] text-left hover:border-arvdoul-purple/50 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-arvdoul-purple`}
                  aria-label={`Create ${type.label}`}
                >
                  <div className="flex items-start justify-between w-full mb-2 sm:mb-3 gap-1">
                    <type.icon className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    {draftCount > 0 && (
                      <span
                        className="text-[10px] sm:text-[11px] font-semibold text-arvdoul-purple tabular-nums leading-tight shrink-0"
                        title={`${draftCount} draft${draftCount === 1 ? '' : 's'}`}
                      >
                        <span className="sm:hidden">{draftCount}</span>
                        <span className="hidden sm:inline">
                          {draftCount} draft{draftCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="block text-[13px] sm:text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">
                      {type.label}
                    </span>
                    <span className="block text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2 sm:line-clamp-1">
                      {type.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Resume Latest Draft */}
          {draftsList.length > 0 && (
            <div className={`${SURFACE_GLASS_CLASS} p-4 flex items-center justify-between gap-4`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center shrink-0">
                  <Icons.RotateCcw className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Continue Draft
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span className="capitalize">{draftsList[0].postType}</span>
                    <span aria-hidden="true"> · </span>
                    {new Date(draftsList[0].updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resumeLatestDraft}
                className="min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-semibold shrink-0 hover:opacity-95 transition-opacity"
                style={{ background: BRAND_GRADIENT }}
              >
                Continue
              </button>
            </div>
          )}

          {/* Expandable Drafts List */}
          {draftsList.length > 0 && (
            <div className={`${SURFACE_GLASS_CLASS} p-4`}>
              <button
                type="button"
                aria-expanded={draftsOpen}
                onClick={() => setDraftsOpen((v) => !v)}
                className="w-full min-h-[40px] flex items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Saved Drafts ({draftsList.length})
                </span>
                <Icons.ChevronDown
                  aria-hidden="true"
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    draftsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {draftsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 h-60 w-full">
                      <Suspense
                        fallback={
                          <div className="h-full flex items-center justify-center">
                            <LoadingSpinner size="sm" />
                          </div>
                        }
                      >
                        <LazyVirtuoso
                          data={draftsList}
                          itemContent={(_index, draft) => (
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold capitalize text-arvdoul-purple">
                                    {draft.postType}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{new Date(draft.updatedAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-900 dark:text-white truncate mt-0.5">
                                  {draft.data?.content?.slice(0, 60) || 'Untitled draft'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => loadVersions(draft.id)}
                                  className="min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/12 text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                >
                                  History
                                </button>
                                <button
                                  type="button"
                                  onClick={() => loadDraft(draft.id)}
                                  className="min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg text-white"
                                  style={{ background: BRAND_GRADIENT }}
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          )}
                        />
                      </Suspense>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Offline Queue */}
          {offlineQueueItems.length > 0 && (
            <div className={`${SURFACE_GLASS_CLASS} p-4`}>
              <button
                type="button"
                aria-expanded={queueOpen}
                onClick={() => setQueueOpen((v) => !v)}
                className="w-full min-h-[40px] flex items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                  Offline Queue ({offlineQueueItems.length})
                </span>
                <Icons.ChevronDown
                  aria-hidden="true"
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    queueOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {queueOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {offlineQueueItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold capitalize text-amber-700 dark:text-amber-300">
                              {item.postType}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => retryOfflineItem(item.id)}
                              className="min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg bg-arvdoul-purple text-white"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOfflineItem(item.id)}
                              className="min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Side Drawer / Column for Schedule or Insights */}
        {activeSidePanel && (
          <div className="lg:col-span-5">
            <Suspense
              fallback={
                <div className={`${SURFACE_GLASS_CLASS} p-8 flex items-center justify-center`}>
                  <LoadingSpinner size="sm" />
                </div>
              }
            >
              <CreatorInsightsDrawer
                activeTab={activeSidePanel}
                scheduledDrafts={scheduledDrafts}
                onEditScheduledDraft={(draft) => loadDraft(draft.id)}
                onClose={() => setActiveSidePanel(null)}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
});

function CreatorShell({ children }) {
  const { goBackToLauncher } = useCreatePostServices();
  const { state } = useCreatePostState();
  const { hasTopAppBar } = useLayoutChrome();
  const typeLabel =
    POST_TYPES.find((t) => t.id === state.postType)?.label || 'Post';

  return (
    <div className="flex flex-col min-h-full">
      {!hasTopAppBar && (
        <div className="h-14 px-4 sm:px-6 bg-white/80 dark:bg-[#080F2E]/70 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={goBackToLauncher}
              aria-label="Back to post formats"
              className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
              {state.editPostId ? `Edit ${typeLabel}` : `Create ${typeLabel}`}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function EnhancedStep3View() {
  return <ComposerControlCenter />;
}

function CreatePostShell({ children }) {
  const { state, dispatch } = useCreatePostState();
  const { goBackToLauncher, publishPost, saveDraft } = useCreatePostServices();
  const ready = canProceedForState(state);

  return (
    <div className="flex flex-col flex-1">
      {state.step > 1 && <StepIndicator />}
      <div className="flex-1 px-3 sm:px-6 pb-6">{children}</div>
      <div className="sticky bottom-0 z-20 flex justify-between items-center gap-3 px-4 sm:px-6 py-3 bg-[#F6F8FC]/90 dark:bg-[#03071B]/90 backdrop-blur-xl border-t border-slate-200/70 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            if (state.step <= 1) goBackToLauncher();
            else dispatch({ type: 'SET_STEP', payload: state.step - 1 });
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          {state.step === 3 ? 'Back to Edit' : 'Back'}
        </button>

        {state.step === 2 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="hidden sm:inline-flex min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors items-center gap-1.5"
            >
              <Icons.Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={() => publishPost()}
              disabled={state.loading || !ready}
              className="min-h-[44px] px-4 sm:px-5 py-2 rounded-xl font-semibold text-white text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {state.loading ? (
                <>
                  <LoadingSpinner size="xs" color="white" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>{state.editPostId ? 'Save Changes' : 'Publish'}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}
              disabled={!ready}
              className="min-h-[44px] px-4 sm:px-5 py-2 rounded-xl font-semibold text-white text-xs sm:text-sm transition-opacity flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
              style={ready ? { background: BRAND_GRADIENT } : { backgroundColor: '#64748b' }}
            >
              <span>Options</span>
              <Icons.ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => publishPost()}
            disabled={state.loading || !ready}
            className="min-h-[44px] px-6 py-2 rounded-xl font-semibold text-white text-sm shadow-lg hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: BRAND_GRADIENT }}
          >
            {state.loading ? (
              <>
                <LoadingSpinner size="xs" color="white" />
                <span>Publishing...</span>
              </>
            ) : (
              <span>
                {state.editPostId
                  ? 'Save Changes'
                  : state.scheduledTime
                  ? 'Schedule Post'
                  : 'Publish Post'}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePostContent() {
  const { state } = useCreatePostState();

  useEffect(() => {
    if (state.step === 2) {
      import('./CreatePost/sections/ComposerControlCenter.jsx').catch((err) => {
        console.warn('[CreatePost] Control center preload note:', err?.message);
      });
      import('./CreatePost/postPublishPipeline.js').catch((err) => {
        console.warn('[CreatePost] Publish pipeline preload note:', err?.message);
      });
    }
  }, [state.step]);

  const step2Content = useMemo(() => {
    if (!state.postType) return null;
    switch (state.postType) {
      case 'text':
        return <CreateText />;
      case 'image':
        return <CreateImage />;
      case 'video':
        return <CreateVideo />;
      case 'poll':
        return <CreatePoll />;
      case 'question':
        return <CreateQuestion />;
      case 'link':
        return <CreateLink />;
      case 'audio':
        return <CreateAudio />;
      case 'event':
        return <CreateEvent />;
      default:
        return null;
    }
  }, [state.postType]);

  if (state.step === 1 || !state.postType) {
    return (
      <ErrorBoundary fallback={<div className="p-4 text-rose-500">Launcher failed to render</div>}>
        <LauncherGrid />
      </ErrorBoundary>
    );
  }

  return (
    <Suspense fallback={<DelayedEditorFallback />}>
      <ErrorBoundary fallback={<div className="p-4 text-rose-500">Failed to load editor.</div>}>
        <CreatorShell>
          <CreatePostShell>
            {state.step === 2 ? (
              <div className="max-w-5xl mx-auto pt-4 space-y-4">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
                      01
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Content Studio
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Compose media and copy, then continue to Control Center (Sections 02–10)
                      </p>
                    </div>
                  </div>
                </div>
                {step2Content}
              </div>
            ) : (
              <EnhancedStep3View />
            )}
          </CreatePostShell>
        </CreatorShell>
      </ErrorBoundary>
    </Suspense>
  );
}

export default function CreatePostEntry() {
  return (
    <CreatePostProvider>
      <EditPostLoader />
      <CreatePostContent />
    </CreatePostProvider>
  );
}