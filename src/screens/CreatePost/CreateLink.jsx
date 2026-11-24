// src/screens/CreatePost/CreateLink.jsx
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { callFunction, FUNCTIONS } from '../../services/callableService.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from './createPostConstants.js';

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const SCRAPE_DEBOUNCE = 700;

const LinkPreviewCard = React.memo(({ metadata }) => {
  if (!metadata) return null;
  const { title, description, image, siteName } = metadata;
  return (
    <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-2.5`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-arvdoul-purple">
        Link Card Preview
      </p>
      {image && (
        <LazyImage
          src={image}
          alt={title || 'Link preview image'}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-44 object-cover rounded-xl border border-slate-200/70 dark:border-white/10"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <h3 className="font-semibold text-base text-slate-900 dark:text-white line-clamp-2">
        {title || 'Untitled link'}
      </h3>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
          {description}
        </p>
      )}
      {siteName && <p className="text-xs font-medium text-arvdoul-purple">{siteName}</p>}
    </div>
  );
});

export default function CreateLink() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, autoSaveStatus, lastSavedAt } = useCreatePostServices();

  const link = state.typeData.link;
  const content = state.content || '';

  const [scraping, setScraping] = useState(false);
  const [customThumbnail, setCustomThumbnail] = useState(link.thumbnail || '');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sync local custom thumbnail input when a draft or edit payload loads
  useEffect(() => {
    setCustomThumbnail(link.thumbnail || '');
  }, [link.thumbnail]);

  const normalizedUrl = useMemo(() => (link.url || '').trim(), [link.url]);

  const isValidUrl = useMemo(() => {
    if (!normalizedUrl) return false;
    try {
      const url = new URL(normalizedUrl);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }, [normalizedUrl]);

  const metadata = link.metadata || null;
  const urlRef = useRef(normalizedUrl);
  const titleRef = useRef(link.title || '');
  titleRef.current = link.title || '';
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const requestIdRef = useRef(0);
  const scrapeTimerRef = useRef(null);

  const scrapeLink = useCallback(
    async (url) => {
      if (!url) return;
      if (metadataRef.current && metadataRef.current.url === url) return;

      const currentId = ++requestIdRef.current;
      setScraping(true);
      try {
        const data = (await callFunction(FUNCTIONS.SCRAPE_LINK, { url })) ?? {};
        if (currentId !== requestIdRef.current || urlRef.current !== url) return;
        const meta = {
          url,
          title: data.title || '',
          description: data.description || '',
          image: data.image || '',
          siteName: data.siteName || '',
        };
        dispatch({ type: 'SET_LINK_METADATA', payload: meta });
        if (!titleRef.current && meta.title) {
          dispatch({ type: 'SET_LINK_TITLE', payload: meta.title });
        }
      } catch (err) {
        if (currentId === requestIdRef.current && urlRef.current === url) {
          console.warn('[CreateLink] Preview scrape failed:', err?.message);
          toast.error('Could not fetch link preview metadata');
        }
      } finally {
        if (currentId === requestIdRef.current) {
          setScraping(false);
        }
      }
    },
    [dispatch]
  );

  useEffect(() => {
    urlRef.current = normalizedUrl;
    clearTimeout(scrapeTimerRef.current);

    if (!isValidUrl) {
      if (metadataRef.current) {
        dispatch({ type: 'SET_LINK_METADATA', payload: null });
      }
      return;
    }

    if (metadataRef.current && metadataRef.current.url !== normalizedUrl) {
      if (titleRef.current === metadataRef.current.title) {
        dispatch({ type: 'SET_LINK_TITLE', payload: '' });
      }
      dispatch({ type: 'SET_LINK_METADATA', payload: null });
    }

    if (metadataRef.current?.url === normalizedUrl) return;

    scrapeTimerRef.current = setTimeout(() => {
      scrapeLink(normalizedUrl);
    }, SCRAPE_DEBOUNCE);

    return () => clearTimeout(scrapeTimerRef.current);
  }, [normalizedUrl, isValidUrl, scrapeLink, dispatch]);

  useEffect(() => {
    dispatch({ type: 'SET_CONTENT_READY', payload: normalizedUrl.length > 0 && isValidUrl });
  }, [normalizedUrl, isValidUrl, dispatch]);

  const handleUrlChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value.length <= MAX_URL_LENGTH) {
        dispatch({ type: 'SET_LINK_URL', payload: value });
      }
    },
    [dispatch]
  );

  const handleTitleChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value.length <= MAX_TITLE_LENGTH) {
        dispatch({ type: 'SET_LINK_TITLE', payload: value });
      }
    },
    [dispatch]
  );

  const handleDescriptionChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value.length <= MAX_DESCRIPTION_LENGTH) {
        dispatch({ type: 'SET_CONTENT', payload: value });
      }
    },
    [dispatch]
  );

  const handleThumbnailChange = useCallback(
    (e) => {
      const raw = e.target.value.trim();
      let valid = true;
      if (raw.length > 0) {
        try {
          const url = new URL(raw);
          if (!['http:', 'https:'].includes(url.protocol)) valid = false;
        } catch {
          valid = false;
        }
      }
      setCustomThumbnail(raw);
      dispatch({ type: 'SET_LINK_THUMBNAIL', payload: valid ? raw : '' });
      if (!valid && raw.length > 0) {
        toast.error('Invalid thumbnail URL — must start with http:// or https://');
      }
    },
    [dispatch]
  );

  const previewData = useMemo(() => {
    if (metadata && metadata.url === normalizedUrl) {
      return {
        ...metadata,
        title: link.title || metadata.title,
        description: content || metadata.description,
        image: customThumbnail || metadata.image,
      };
    }
    return {
      title: link.title,
      description: content,
      image: customThumbnail,
      siteName: '',
    };
  }, [metadata, normalizedUrl, link.title, content, customThumbnail]);

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Share a Link
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Attach an article, resource, or web link with live preview metadata
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-label={previewOpen ? 'Switch to link editor' : 'Preview link card'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {previewOpen ? <Icons.Edit3 className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
            <span>{previewOpen ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving'}
            aria-label="Save draft"
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
          >
            {autoSaveStatus === 'saving' ? (
              <LoadingSpinner size="xs" color="white" />
            ) : (
              <Icons.Save className="w-3.5 h-3.5" />
            )}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}>
        <div>
          <label
            htmlFor="link-url-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
          >
            Web URL
          </label>
          <div className="relative">
            <Icons.Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="link-url-input"
              type="url"
              value={link.url || ''}
              onChange={handleUrlChange}
              placeholder="https://example.com/article"
              maxLength={MAX_URL_LENGTH}
              className={`${INPUT_CLASS} pl-10`}
              autoFocus
              aria-label="Link URL"
            />
          </div>
          {!isValidUrl && normalizedUrl.length > 0 && (
            <p className="text-xs text-rose-500 mt-1.5">
              Please enter a valid http or https URL
            </p>
          )}
          {scraping && (
            <div className="flex items-center gap-2 mt-2 text-xs text-arvdoul-purple">
              <LoadingSpinner size="xs" />
              <span>Fetching link metadata...</span>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="link-title-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
          >
            Custom Title ({(link.title || '').length}/{MAX_TITLE_LENGTH})
          </label>
          <input
            id="link-title-input"
            type="text"
            value={link.title || ''}
            onChange={handleTitleChange}
            placeholder="Optional headline override"
            maxLength={MAX_TITLE_LENGTH}
            className={INPUT_CLASS}
            aria-label="Custom title"
          />
        </div>

        <div>
          <label
            htmlFor="link-description-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
          >
            Commentary ({content.length}/{MAX_DESCRIPTION_LENGTH})
          </label>
          <textarea
            id="link-description-input"
            value={content}
            onChange={handleDescriptionChange}
            placeholder="Why are you sharing this link?"
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
            aria-label="Link description"
          />
        </div>

        <div>
          <label
            htmlFor="link-thumb-input"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
          >
            Custom Thumbnail URL (optional)
          </label>
          <input
            id="link-thumb-input"
            type="url"
            value={customThumbnail}
            onChange={handleThumbnailChange}
            placeholder="https://example.com/preview.jpg"
            className={INPUT_CLASS}
            aria-label="Custom thumbnail URL"
          />
        </div>

        <div className="flex items-center justify-end text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {autoSaveStatus === 'saving' && (
            <span className="flex items-center gap-1.5">
              <LoadingSpinner size="xs" /> Saving draft...
            </span>
          )}
          {autoSaveStatus === 'saved' && lastSavedAt && (
            <span className="flex items-center gap-1.5">
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <LinkPreviewCard metadata={previewData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
