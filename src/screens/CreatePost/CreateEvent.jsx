// src/screens/CreatePost/CreateEvent.jsx
import React, { useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useAuth } from '../../context/AuthContext';
import { getAuthService } from '../../services/authService';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from './createPostConstants.js';
import { useLocationSearch } from './useLocationSearch.js';
import {
  uploadSingleMediaAsset,
  deleteUploadedStorageAsset,
  extractStoragePathFromUrl,
} from './postMediaPipeline.js';

const DateTimePicker = lazy(() => import('react-datepicker'));

const MAX_NAME_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_COVER_SIZE = 10 * 1024 * 1024;

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim && width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], file.name || 'event_cover.jpg', { type: 'image/jpeg' }));
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });

const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', 'America/New_York', 'Europe/London', 'Africa/Lagos', 'Asia/Tokyo'];

const getUserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const EventPreview = React.memo(({ eventData }) => {
  const { name, date, location, description, coverImage, rsvpEnabled, capacity } = eventData;
  return (
    <div className={`${SURFACE_GLASS_CLASS} overflow-hidden p-4 space-y-2.5`}>
      {coverImage && (
        <LazyImage
          src={coverImage}
          alt={name ? `${name} cover` : 'Event cover'}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-40 object-cover rounded-xl"
        />
      )}
      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
        {name || 'Untitled Event'}
      </h3>
      {date && (
        <p className="text-xs font-medium text-arvdoul-purple flex items-center gap-1.5">
          <Icons.Calendar className="w-3.5 h-3.5" />
          <span>{new Date(date).toLocaleString()}</span>
        </p>
      )}
      {location && (
        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Icons.MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{location}</span>
        </p>
      )}
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
          {description}
        </p>
      )}
      {rsvpEnabled && (
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          RSVP enabled {capacity ? `· ${capacity} spots` : '· Unlimited capacity'}
        </p>
      )}
    </div>
  );
});

export default function CreateEvent() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, services, autoSaveStatus, lastSavedAt } = useCreatePostServices();
  const { user } = useAuth();

  const event = state?.typeData?.event ?? {};
  const content = state?.content ?? '';

  const [description, setDescription] = useState(event.description || '');
  const [coverImage, setCoverImage] = useState(event.coverImage || '');
  const [rsvpEnabled, setRsvpEnabled] = useState(event.rsvpEnabled || false);
  const [capacity, setCapacity] = useState(event.capacity || '');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => setDescription(event.description || ''), [event.description]);
  useEffect(() => setCoverImage(event.coverImage || ''), [event.coverImage]);
  useEffect(() => setRsvpEnabled(event.rsvpEnabled || false), [event.rsvpEnabled]);
  useEffect(() => setCapacity(event.capacity || ''), [event.capacity]);

  const isDateValid = useMemo(() => {
    if (!event.date) return false;
    const timestamp = Date.parse(event.date);
    return !Number.isNaN(timestamp) && timestamp > Date.now();
  }, [event.date]);

  useEffect(() => {
    const ready = content.trim().length > 0 && isDateValid;
    dispatch({ type: 'SET_CONTENT_READY', payload: ready });
  }, [content, isDateValid, dispatch]);

  const [timezone, setTimezone] = useState(event.timezone || getUserTimezone());
  useEffect(() => {
    setTimezone(event.timezone || getUserTimezone());
  }, [event.timezone]);
  useEffect(() => {
    dispatch({ type: 'SET_EVENT_TIMEZONE', payload: timezone });
  }, [timezone, dispatch]);

  // Location autocomplete via shared hook
  const [locationQuery, setLocationQuery] = useState(event.location || '');
  useEffect(() => {
    setLocationQuery(event.location || '');
  }, [event.location]);

  const {
    suggestions: locationSuggestions,
    loading: locationLoading,
    open: locationShow,
    setOpen: setLocationShow,
  } = useLocationSearch(locationQuery);

  const handleLocationSelect = useCallback(
    (item) => {
      dispatch({ type: 'SET_EVENT_LOCATION', payload: item.displayName });
      dispatch({
        type: 'SET_EVENT_LOCATION_DATA',
        payload: { displayName: item.displayName, lat: item.lat, lon: item.lon },
      });
      setLocationQuery(item.displayName);
      setLocationShow(false);
    },
    [dispatch, setLocationShow]
  );

  // Cover upload with abort & cleanup
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const coverInputRef = useRef(null);
  const uploadControllerRef = useRef(null);
  const sessionCoverPathRef = useRef(null);

  useEffect(() => {
    return () => {
      uploadControllerRef.current?.abort();
    };
  }, []);

  const resolveLiveUid = useCallback(() => {
    try {
      const authService = getAuthService();
      const live = authService?.getCurrentUser?.() || authService?.auth?.currentUser || null;
      return live?.uid || user?.uid || null;
    } catch {
      return user?.uid || null;
    }
  }, [user?.uid]);

  const handleCoverUpload = useCallback(
    async (file) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > MAX_COVER_SIZE) {
        toast.error('Cover image must be under 10 MB');
        return;
      }
      const uid = resolveLiveUid();
      if (!uid) {
        toast.error('You must be signed in to upload');
        return;
      }

      uploadControllerRef.current?.abort();
      const controller = new AbortController();
      uploadControllerRef.current = controller;

      setUploadingCover(true);
      setUploadProgress(0);
      try {
        const compressed = await compressImage(file);
        const result = await uploadSingleMediaAsset({
          file: compressed,
          folder: 'events',
          uid,
          signal: controller.signal,
          maxSize: MAX_COVER_SIZE,
          storageService: services?.storage,
          onProgress: (percent) => setUploadProgress(percent),
        });

        if (sessionCoverPathRef.current && sessionCoverPathRef.current !== result.storagePath) {
          deleteUploadedStorageAsset(services?.storage, sessionCoverPathRef.current);
        }
        sessionCoverPathRef.current = result.storagePath || extractStoragePathFromUrl(result.downloadURL);

        dispatch({ type: 'SET_EVENT_COVER', payload: result.downloadURL });
        setCoverImage(result.downloadURL);
        toast.success('Cover image uploaded');
      } catch (err) {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          toast.error(err?.message || 'Cover upload failed');
        }
      } finally {
        setUploadingCover(false);
        setUploadProgress(0);
      }
    },
    [resolveLiveUid, services?.storage, dispatch]
  );

  const handleCoverUrlChange = useCallback(
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
      setCoverImage(raw);
      dispatch({ type: 'SET_EVENT_COVER', payload: valid ? raw : '' });
      if (!valid && raw.length > 0) {
        toast.error('Invalid cover image URL — enter an http or https address');
      }
    },
    [dispatch]
  );

  const handleNameChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value.length <= MAX_NAME_LENGTH) {
        dispatch({ type: 'SET_CONTENT', payload: value });
      }
    },
    [dispatch]
  );

  const handleDateChange = useCallback(
    (date) => {
      dispatch({ type: 'SET_EVENT_DATE', payload: date ? date.toISOString() : null });
    },
    [dispatch]
  );

  const handleDescriptionChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value.length <= MAX_DESCRIPTION_LENGTH) {
        setDescription(value);
        dispatch({ type: 'SET_EVENT_DESCRIPTION', payload: value });
      }
    },
    [dispatch]
  );

  const handleRsvpToggle = useCallback(
    (e) => {
      const checked = e.target.checked;
      setRsvpEnabled(checked);
      dispatch({ type: 'SET_EVENT_RSVP', payload: checked });
      if (!checked) {
        setCapacity('');
        dispatch({ type: 'SET_EVENT_CAPACITY', payload: null });
      }
    },
    [dispatch]
  );

  const handleCapacityChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (value === '') {
        setCapacity('');
        dispatch({ type: 'SET_EVENT_CAPACITY', payload: null });
        return;
      }
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 100000) {
        setCapacity(value);
        dispatch({ type: 'SET_EVENT_CAPACITY', payload: parsed });
      } else {
        toast.error('Capacity must be between 1 and 100,000');
      }
    },
    [dispatch]
  );

  const previewData = useMemo(
    () => ({
      name: content,
      date: event.date,
      location: event.location,
      description,
      coverImage,
      rsvpEnabled,
      capacity: capacity || null,
    }),
    [content, event.date, event.location, description, coverImage, rsvpEnabled, capacity]
  );

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      {/* Studio Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Create Event
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Schedule gatherings, locations, and guest RSVPs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            {previewOpen ? <Icons.EyeOff className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
            <span>{previewOpen ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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

      {/* Main Form Glass Surface */}
      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="event-name-input"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block tabular-nums"
            >
              Event Name ({content.length}/{MAX_NAME_LENGTH})
            </label>
            <input
              id="event-name-input"
              type="text"
              value={content}
              onChange={handleNameChange}
              placeholder="Enter event title"
              maxLength={MAX_NAME_LENGTH}
              className={INPUT_CLASS}
              autoFocus
            />
          </div>

          <div>
            <label
              id="event-date-label"
              htmlFor="event-date-picker"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block"
            >
              Date &amp; Time
            </label>
            <Suspense fallback={<div className="h-11 animate-pulse bg-slate-200 dark:bg-white/10 rounded-xl" />}>
              <DateTimePicker
                id="event-date-picker"
                selected={event.date ? new Date(event.date) : null}
                onChange={handleDateChange}
                showTimeSelect
                dateFormat="Pp"
                placeholderText="Select date & time"
                minDate={new Date()}
                className={INPUT_CLASS}
                ariaLabelledBy="event-date-label"
              />
            </Suspense>
            {event.date && !isDateValid && (
              <p className="text-xs text-rose-500 mt-1">Event date must be in the future.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label
              htmlFor="event-location-input"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block tabular-nums"
            >
              Location ({(event.location || '').length}/{MAX_LOCATION_LENGTH})
            </label>
            <div className="relative">
              <input
                id="event-location-input"
                type="text"
                value={locationQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= MAX_LOCATION_LENGTH) {
                    setLocationQuery(val);
                    dispatch({ type: 'SET_EVENT_LOCATION', payload: val });
                  }
                }}
                onFocus={() => setLocationShow(true)}
                onBlur={() => setTimeout(() => setLocationShow(false), 200)}
                placeholder="Search venue or city..."
                maxLength={MAX_LOCATION_LENGTH}
                className={INPUT_CLASS}
              />
              {locationLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="xs" />
                </div>
              )}
            </div>
            {locationShow && locationSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#080F2E] shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
                {locationSuggestions.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lon}-${idx}`}
                    type="button"
                    onMouseDown={() => handleLocationSelect(item)}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    {item.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="event-timezone-select"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block"
            >
              Timezone
            </label>
            <select
              id="event-timezone-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={INPUT_CLASS}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="event-description-input"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block tabular-nums"
          >
            Description ({description.length}/{MAX_DESCRIPTION_LENGTH})
          </label>
          <textarea
            id="event-description-input"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Share event details, agenda, or host instructions..."
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        <div>
          <label
            htmlFor="event-cover-url"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block"
          >
            Cover Image
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-arvdoul-purple hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-arvdoul-purple disabled:opacity-50"
            >
              {uploadingCover ? <LoadingSpinner size="xs" /> : <Icons.Upload className="w-4 h-4" />}
              <span>{uploadingCover ? 'Uploading...' : 'Upload Cover'}</span>
            </button>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleCoverUpload(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <input
              id="event-cover-url"
              type="url"
              value={coverImage}
              onChange={handleCoverUrlChange}
              placeholder="Or paste an https:// image URL"
              className={`${INPUT_CLASS} flex-1 min-w-[200px]`}
            />
          </div>

          {uploadingCover && (
            <div className="mt-2.5 w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-arvdoul-purple h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(uploadProgress || 0, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <label
            htmlFor="event-rsvp-checkbox"
            className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer min-h-[40px]"
          >
            <input
              id="event-rsvp-checkbox"
              type="checkbox"
              checked={rsvpEnabled}
              onChange={handleRsvpToggle}
              className="w-4 h-4 rounded accent-arvdoul-purple focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            />
            <span>Enable RSVP registration</span>
          </label>

          {rsvpEnabled && (
            <div className="flex-1">
              <input
                aria-label="Guest capacity"
                type="number"
                min="1"
                max="100000"
                value={capacity}
                onChange={handleCapacityChange}
                placeholder="Maximum capacity (optional)"
                className={INPUT_CLASS}
              />
            </div>
          )}
        </div>

        <div
          aria-live="polite"
          className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums"
        >
          {autoSaveStatus === 'saving' && (
            <>
              <LoadingSpinner size="xs" />
              <span>Saving draft...</span>
            </>
          )}
          {autoSaveStatus === 'saved' && lastSavedAt && (
            <>
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
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
            <EventPreview eventData={previewData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
