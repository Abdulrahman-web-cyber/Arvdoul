// src/screens/CreatePost/EditPostLoader.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useCreatePostState } from './CreatePostContext.jsx';
import { POST_TYPES } from './createPostConstants.js';
import { mediaUrlToFile } from './postMediaPipeline.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';

export default function EditPostLoader() {
  const [searchParams] = useSearchParams();
  const { postId: routePostId } = useParams();
  const { dispatch } = useCreatePostState();
  const editId = searchParams.get('edit') || routePostId || null;
  const quoteSnippet = searchParams.get('quote');
  const location = useLocation();

  const lastLocationKeyRef = useRef(null);
  const lastEditIdRef = useRef(null);
  const loadedTypeKeyRef = useRef(null);
  const loadedQuoteKeyRef = useRef(null);

  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Consume navigation state handoffs (video export, audio export, sound selection, prefill text)
  useEffect(() => {
    const file = location.state?.videoFile;
    const url = location.state?.videoUrl;
    const audioFile = location.state?.audioFile;
    const audioDataUrl = location.state?.audioDataUrl;
    const audioBlob = location.state?.audioBlob;
    const selectedAudio = location.state?.selectedAudio;
    const prefillContent = location.state?.prefillContent;
    const title = location.state?.title;
    const mediaType = location.state?.mediaType;
    const prefillType = location.state?.prefillType;

    const handoffKey = `${location.key || ''}:${Boolean(file)}:${Boolean(url)}:${Boolean(
      audioFile
    )}:${Boolean(audioDataUrl)}:${Boolean(audioBlob)}:${selectedAudio?.id || ''}:${Boolean(
      prefillContent
    )}`;

    if (
      !file &&
      !url &&
      !audioFile &&
      !audioDataUrl &&
      !audioBlob &&
      !selectedAudio &&
      !prefillContent
    ) {
      return;
    }
    if (lastLocationKeyRef.current === handoffKey) return;
    lastLocationKeyRef.current = handoffKey;

    if (file || url) {
      dispatch({
        type: 'SET_MEDIA_ITEMS',
        payload: [
          {
            id: 'video-export',
            type: mediaType === 'photo' ? 'image' : 'video',
            file: file || null,
            url: file ? '' : url,
            preview: url || '',
            name: title || 'video',
            alt: '',
          },
        ],
      });
      if (title) dispatch({ type: 'SET_CONTENT', payload: `${title} ` });
      dispatch({
        type: 'SET_POST_TYPE',
        payload: mediaType === 'audio' || mediaType === 'photo' ? mediaType : 'video',
      });
      dispatch({ type: 'SET_STEP', payload: 2 });
      return;
    }

    if (selectedAudio) {
      const audioUrl = selectedAudio.audioUrl || selectedAudio.url || '';
      if (audioUrl) {
        dispatch({
          type: 'SET_TYPE_DATA',
          payload: {
            audio: {
              url: audioUrl,
              previewUrl: audioUrl,
              title: selectedAudio.title || 'Untitled Audio',
              artist: selectedAudio.artist || selectedAudio.creatorName || '',
              genre: selectedAudio.genre || '',
              coverUrl: selectedAudio.coverUrl || selectedAudio.thumbnail || '',
              sourceSoundId: selectedAudio.id || null,
            },
          },
        });
        if (selectedAudio.title) {
          dispatch({ type: 'SET_CONTENT', payload: `${selectedAudio.title} ` });
        }
        dispatch({ type: 'SET_POST_TYPE', payload: 'audio' });
        dispatch({ type: 'SET_STEP', payload: 2 });
        return;
      }
    }

    if (audioFile || audioDataUrl || audioBlob) {
      let active = true;
      (async () => {
        let resolvedFile = audioFile || null;
        if (!resolvedFile && audioBlob) {
          resolvedFile = new File([audioBlob], `${title || 'audio_mix'}.wav`, {
            type: audioBlob.type || 'audio/wav',
          });
        } else if (!resolvedFile && audioDataUrl) {
          try {
            resolvedFile = await mediaUrlToFile(
              audioDataUrl,
              `${title || 'audio_mix'}.wav`,
              'audio/wav'
            );
          } catch (err) {
            console.warn('[EditPostLoader] Could not decode audioDataUrl:', err?.message);
          }
        }
        if (!active) return;
        const localUrl = resolvedFile ? URL.createObjectURL(resolvedFile) : audioDataUrl || '';
        dispatch({
          type: 'SET_TYPE_DATA',
          payload: {
            audio: {
              url: '',
              previewUrl: localUrl,
              file: resolvedFile,
              title: title || 'Audio Mix',
              artist: '',
            },
          },
        });
        if (title) dispatch({ type: 'SET_CONTENT', payload: `${title} ` });
        dispatch({ type: 'SET_POST_TYPE', payload: 'audio' });
        dispatch({ type: 'SET_STEP', payload: 2 });
      })();
      return () => {
        active = false;
      };
    }

    if (typeof prefillContent === 'string' && prefillContent.trim()) {
      dispatch({ type: 'SET_CONTENT', payload: prefillContent });
      dispatch({ type: 'SET_POST_TYPE', payload: prefillType || 'text' });
      dispatch({ type: 'SET_STEP', payload: 2 });
    }
  }, [location.key, location.state, dispatch]);

  // Quote Post snippet
  useEffect(() => {
    if (!quoteSnippet || loadedQuoteKeyRef.current === quoteSnippet) return;
    loadedQuoteKeyRef.current = quoteSnippet;
    const quoted = quoteSnippet
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    dispatch({
      type: 'LOAD_DRAFT',
      payload: {
        postType: 'text',
        content: `${quoted}\n\n`,
        contentJSON: null,
        mediaItems: [],
        visibility: 'public',
        isDraftLoaded: true,
        isDirty: false,
      },
    });
    dispatch({ type: 'SET_POST_TYPE', payload: 'text' });
    dispatch({ type: 'SET_STEP', payload: 2 });
  }, [quoteSnippet, dispatch]);

  // Query param ?type= deep-link
  useEffect(() => {
    const requestedType = searchParams.get('type');
    if (!requestedType || editId) return;
    const typeKey = `${location.key || ''}:${requestedType}`;
    if (loadedTypeKeyRef.current === typeKey) return;
    if (!POST_TYPES.some((t) => t.id === requestedType)) return;
    loadedTypeKeyRef.current = typeKey;
    if (requestedType === 'vibe') return;
    dispatch({ type: 'SET_POST_TYPE', payload: requestedType });
    dispatch({ type: 'SET_STEP', payload: 2 });
  }, [searchParams, location.key, editId, dispatch]);

  // Load existing post for /edit/:postId or ?edit=<id> across all 8 types
  const fetchPostForEdit = useCallback(async () => {
    if (!editId) return;
    setLoadingEdit(true);
    setEditError(null);
    try {
      const { getFirestoreService } = await import('../../services/firestoreService.js');
      const res = await getFirestoreService().getPost(editId);
      if (!res?.success || !res.post) {
        throw new Error(res?.error || 'Could not find that post to edit.');
      }
      const p = res.post;
      const postType = p.type || 'text';
      const hydratedMedia = (Array.isArray(p.media) ? p.media : []).map((m, i) => ({
        id: m.id || `edit_${i}`,
        type: m.type === 'video' ? 'video' : m.type === 'audio' ? 'audio' : 'image',
        url: m.url || '',
        preview: m.url || '',
        thumbnail: m.thumbnail || null,
        thumbnailUrl: m.thumbnail || null,
        storagePath: m.storagePath || null,
        file: null,
        name: m.name || '',
        alt: m.alt || '',
        duration: m.duration || 0,
        size: m.size || 0,
      }));

      const rawScheduled = p.scheduledTime?.toDate
        ? p.scheduledTime.toDate().toISOString()
        : p.scheduledTime || null;
      const rawClosesAt = p.poll?.closesAt?.toDate
        ? p.poll.closesAt.toDate().toISOString()
        : p.poll?.closesAt || null;

      dispatch({
        type: 'LOAD_DRAFT',
        payload: {
          postType,
          content: p.content || '',
          contentJSON: p.contentJSON || null,
          mediaItems: hydratedMedia,
          visibility: p.visibility || 'public',
          location: p.location || null,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          scheduledTime: rawScheduled,
          pollClosesAt: rawClosesAt,
          typeData: {
            poll: {
              options: Array.isArray(p.poll?.options)
                ? p.poll.options.map((o) => (typeof o === 'string' ? o : o?.text || ''))
                : [],
              allowMultiple: !!p.poll?.allowMultiple,
            },
            event: {
              date: p.event?.date?.toDate
                ? p.event.date.toDate().toISOString()
                : p.event?.date || null,
              location: p.event?.location || '',
              locationData: p.event?.locationData || null,
              description: p.event?.description || '',
              coverImage: p.event?.coverImage || '',
              rsvpEnabled: !!p.event?.rsvpEnabled,
              capacity: p.event?.capacity ?? null,
              timezone: p.event?.timezone || null,
            },
            link: {
              url: p.link?.url || '',
              title: p.link?.title || '',
              metadata: p.link?.metadata || null,
              thumbnail: p.link?.thumbnail || '',
            },
            audio: {
              file: null,
              url: p.audio?.url || '',
              previewUrl: p.audio?.url || null,
              coverUrl: p.audio?.coverUrl || null,
              coverFile: null,
              title: p.audio?.title || '',
              artist: p.audio?.artist || '',
              genre: p.audio?.genre || '',
              sourceSoundId: p.audio?.sourceSoundId || null,
              duration: p.audio?.duration || 0,
            },
            video: {
              file: null,
              url: p.video?.url || p.videoUrl || '',
              duration: p.video?.duration || 0,
            },
          },
          draftId: null,
          isDraftLoaded: true,
          isDirty: false,
          editPostId: editId,
        },
      });
      dispatch({ type: 'SET_POST_TYPE', payload: postType });
      dispatch({ type: 'SET_STEP', payload: 2 });
    } catch (err) {
      console.warn('[EditPostLoader] Failed loading post:', err?.message);
      setEditError(err?.message || 'Failed to load post for editing.');
    } finally {
      setLoadingEdit(false);
    }
  }, [editId, dispatch]);

  useEffect(() => {
    if (!editId) {
      lastEditIdRef.current = null;
      return;
    }
    if (lastEditIdRef.current === editId) return;
    lastEditIdRef.current = editId;
    fetchPostForEdit();
  }, [editId, fetchPostForEdit]);

  if (!loadingEdit && !editError) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      {loadingEdit && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#080F2E]/85 backdrop-blur-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <LoadingSpinner size="sm" />
          <span>Loading post for editing...</span>
        </div>
      )}
      {editError && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-200">
          <div className="flex items-center gap-2 min-w-0">
            <Icons.AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{editError}</span>
          </div>
          <button
            type="button"
            onClick={fetchPostForEdit}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
