// src/screens/CreatePost/createPostReducer.js
import { produce } from 'immer';
import { MEDIA_LIMITS } from './createPostConstants.js';

export const initialState = {
  postType: null,
  content: '',
  contentJSON: null,
  mediaItems: [],
  visibility: 'public',
  location: null,
  hashtags: [],
  scheduledTime: null,
  typeData: {
    poll: { options: [], allowMultiple: false },
    event: {
      date: null,
      location: '',
      locationData: null,
      description: '',
      coverImage: '',
      rsvpEnabled: false,
      capacity: null,
      timezone: null,
    },
    link: { url: '', title: '', metadata: null, thumbnail: '' },
    audio: {
      file: null,
      url: '',
      previewUrl: null,
      coverUrl: null,
      coverFile: null,
      title: '',
      artist: '',
      genre: '',
      sourceSoundId: null,
      duration: 0,
    },
    video: { file: null, url: '', duration: 0 },
  },
  pollClosesAt: null,
  step: 1,
  loading: false,
  progress: 0,
  error: null,
  draftId: null,
  clientPostId: null,
  editPostId: null,
  isDraftLoaded: false,
  isDirty: false,
  insights: null,
  moderationStatus: null,
  isContentReady: false,
  identityMeta: {
    publishAs: 'personal',
    collaborators: [],
    communityDestinationId: null,
  },
  distributionSettings: {
    allowDiscovery: true,
    allowReposts: true,
    allowRemixes: true,
    allowDownloads: true,
    category: 'general',
    mentions: [],
  },
  engagementControls: {
    enableComments: true,
    commentMode: 'everyone',
    enableReactions: true,
    enableGifts: true,
    enableSaves: true,
    enableShares: true,
  },
  commercialSettings: {
    disclosureType: 'none',
    brandPartnerId: '',
    brandPartnerName: '',
    brandPartnerHandle: '',
    partnershipId: null,
    adAuthorizationId: null,
    adAuthorizationCode: '',
    allowPartnerPromotion: false,
    affiliateLinkId: null,
    affiliateUrl: '',
    affiliateLabel: '',
    promoCode: '',
    productTag: '',
    ctaLabel: 'Learn More',
    ctaUrl: '',
  },
  creatorPrograms: {
    eligible: false,
    enableGiftsForPost: true,
    enableAdRevenueShare: false,
    enableAffiliateTracking: false,
    enableSponsorshipAttribution: false,
  },
  promotionIntent: {
    enabled: false,
    promotionKind: 'post',
    preservesOriginalPost: true,
    objective: 'reach',
    placements: ['home'],
    targetLocations: [],
    targetInterests: [],
    targetAgeMin: 18,
    dailyBudgetCents: 1000,
    currency: 'USD',
    durationDays: 7,
    complianceNotes: '',
    submitForReview: false,
  },
  safetyAccessibility: {
    contentWarning: '',
    isSensitiveMedia: false,
    ageRating: 'all',
    regionalStandard: 'global',
    copyrightConfirmed: true,
    captionsText: '',
    transcriptText: '',
    language: 'en',
    allowAutoTranslation: true,
  },
  lifecycleSettings: {
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    expiresAt: null,
    notifyFollowers: true,
    priorityAlert: false,
  },
  _past: [],
  _future: [],
};

// Keys on a media item whose mutation is upload telemetry/progress and MUST NOT
// pollute undo history or flip isDirty.
const TRANSIENT_MEDIA_KEYS = new Set([
  'progress',
  'status',
  'error',
  'uploading',
  'uploadProgress',
]);

function cloneSnapshotForHistory(state) {
  const { _past, _future, ...rest } = state;
  // Structured clone fails on File instances only in very old environments; in
  // modern browsers/JSDOM File is cloneable, with shallow fallback for safety.
  try {
    return structuredClone(rest);
  } catch {
    return {
      ...rest,
      mediaItems: Array.isArray(rest.mediaItems) ? rest.mediaItems.map((m) => ({ ...m })) : [],
      typeData: rest.typeData ? { ...rest.typeData } : {},
    };
  }
}

export function reducer(state, action) {
  if (action.type === 'UNDO') {
    if (state._past.length === 0) return state;
    const previous = state._past[state._past.length - 1];
    const newPast = state._past.slice(0, -1);
    return { ...previous, _past: newPast, _future: [state, ...state._future] };
  }
  if (action.type === 'REDO') {
    if (state._future.length === 0) return state;
    const next = state._future[0];
    const newFuture = state._future.slice(1);
    return { ...next, _past: [...state._past, state], _future: newFuture };
  }

  return produce(state, (draft) => {
    let pushHistory = false;
    switch (action.type) {
      case 'SET_POST_TYPE':
        draft.postType = action.payload;
        draft.step = 1;
        draft.isDraftLoaded = false;
        pushHistory = true;
        break;
      case 'SET_CONTENT': {
        const nextContent = action.payload;
        draft.content = nextContent;
        if (typeof nextContent === 'string') {
          const matches = nextContent.match(/#([A-Za-z0-9_]+)/g) || [];
          draft.hashtags = Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 30);
        } else {
          draft.hashtags = [];
        }
        draft.isDirty = true;
        pushHistory = true;
        break;
      }
      case 'SET_CONTENT_JSON':
        draft.contentJSON = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_MEDIA_ITEMS':
        draft.mediaItems = Array.isArray(action.payload) ? action.payload : [];
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'ADD_MEDIA_ITEMS': {
        const incoming = Array.isArray(action.payload) ? action.payload : [];
        let imageCount = draft.mediaItems.filter((i) => i.type === 'image').length;
        let videoCount = draft.mediaItems.filter((i) => i.type === 'video').length;
        const accepted = [];
        for (const m of incoming) {
          if (draft.mediaItems.length + accepted.length >= MEDIA_LIMITS.maxTotalMediaCount) break;
          if (m.type === 'image') {
            if (imageCount >= MEDIA_LIMITS.maxImages) continue;
            imageCount += 1;
          }
          if (m.type === 'video') {
            if (videoCount >= MEDIA_LIMITS.maxVideos) continue;
            videoCount += 1;
          }
          accepted.push(m);
        }
        if (accepted.length > 0) {
          draft.mediaItems.push(...accepted);
          draft.isDirty = true;
          pushHistory = true;
        }
        break;
      }
      case 'UPDATE_MEDIA_ITEM': {
        const idx =
          action.payload?.id !== undefined
            ? draft.mediaItems.findIndex((m) => m.id === action.payload.id)
            : typeof action.payload?.index === 'number'
            ? action.payload.index
            : -1;
        if (idx >= 0 && idx < draft.mediaItems.length) {
          const updates = action.payload.updates || {};
          draft.mediaItems[idx] = { ...draft.mediaItems[idx], ...updates };
          const keys = Object.keys(updates);
          const hasSubstantiveChange = keys.some((k) => !TRANSIENT_MEDIA_KEYS.has(k));
          if (hasSubstantiveChange) {
            draft.isDirty = true;
            pushHistory = true;
          }
        }
        break;
      }
      case 'UPDATE_MEDIA_PROGRESS': {
        const idx =
          action.payload?.id !== undefined
            ? draft.mediaItems.findIndex((m) => m.id === action.payload.id)
            : typeof action.payload?.index === 'number'
            ? action.payload.index
            : -1;
        if (idx >= 0 && idx < draft.mediaItems.length) {
          const updates = action.payload.updates || {};
          draft.mediaItems[idx] = { ...draft.mediaItems[idx], ...updates };
        }
        break;
      }
      case 'REMOVE_MEDIA_ITEM':
        if (typeof action.payload === 'number' && action.payload >= 0 && action.payload < draft.mediaItems.length) {
          draft.mediaItems.splice(action.payload, 1);
          draft.isDirty = true;
          pushHistory = true;
        }
        break;
      case 'REORDER_MEDIA': {
        const { from, to } = action.payload || {};
        if (
          typeof from === 'number' &&
          typeof to === 'number' &&
          from >= 0 &&
          to >= 0 &&
          from < draft.mediaItems.length &&
          to < draft.mediaItems.length &&
          from !== to
        ) {
          const [removed] = draft.mediaItems.splice(from, 1);
          draft.mediaItems.splice(to, 0, removed);
          draft.isDirty = true;
          pushHistory = true;
        }
        break;
      }
      case 'SET_VISIBILITY':
        draft.visibility = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_LOCATION':
        draft.location = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_SCHEDULED_TIME':
        draft.scheduledTime = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SEED_POLL_OPTIONS':
        if (!Array.isArray(draft.typeData.poll.options) || draft.typeData.poll.options.length === 0) {
          draft.typeData.poll.options = Array.isArray(action.payload) ? action.payload : ['', ''];
        }
        break;
      case 'SET_POLL_OPTIONS':
        draft.typeData.poll.options = Array.isArray(action.payload) ? action.payload : [];
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_ALLOW_MULTIPLE':
        draft.typeData.poll.allowMultiple = !!action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_POLL_EXPIRY':
        draft.pollClosesAt = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_EVENT_DATE':
        draft.typeData.event.date = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_EVENT_LOCATION':
        draft.typeData.event.location = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_LINK_URL':
        draft.typeData.link.url = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_LINK_TITLE':
        draft.typeData.link.title = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_TYPE_DATA': {
        const patch = action.payload || {};
        for (const [typeKey, value] of Object.entries(patch)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            draft.typeData[typeKey] = { ...(draft.typeData[typeKey] || {}), ...value };
          } else {
            draft.typeData[typeKey] = value;
          }
        }
        draft.isDirty = true;
        pushHistory = true;
        break;
      }
      // Derived metadata / timezone updates must not dirty the draft.
      case 'SET_EVENT_TIMEZONE':
        draft.typeData.event.timezone = action.payload;
        break;
      case 'SET_EVENT_LOCATION_DATA':
        draft.typeData.event.locationData = action.payload;
        break;
      case 'SET_EVENT_COVER':
        draft.typeData.event.coverImage = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_EVENT_DESCRIPTION':
        draft.typeData.event.description = action.payload;
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_EVENT_RSVP':
        draft.typeData.event.rsvpEnabled = !!action.payload;
        draft.isDirty = true;
        break;
      case 'SET_EVENT_CAPACITY':
        draft.typeData.event.capacity = action.payload;
        draft.isDirty = true;
        break;
      case 'SET_LINK_METADATA':
        draft.typeData.link.metadata = action.payload;
        break;
      case 'SET_LINK_THUMBNAIL':
        draft.typeData.link.thumbnail = action.payload;
        draft.isDirty = true;
        break;
      case 'SET_STEP':
        draft.step = action.payload;
        break;
      case 'SET_LOADING':
        draft.loading = !!action.payload;
        break;
      case 'SET_PROGRESS':
        draft.progress = action.payload;
        break;
      case 'SET_ERROR':
        draft.error = action.payload;
        break;
      case 'SET_DRAFT_ID':
        draft.draftId = action.payload;
        break;
      case 'SET_IS_DIRTY':
        draft.isDirty = !!action.payload;
        break;
      case 'SET_INSIGHTS':
        draft.insights = action.payload;
        break;
      case 'SET_MODERATION_STATUS':
        draft.moderationStatus = action.payload;
        break;
      case 'SET_CONTENT_READY':
        draft.isContentReady = !!action.payload;
        break;
      case 'SET_IDENTITY_META':
        draft.identityMeta = { ...draft.identityMeta, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_DISTRIBUTION_SETTINGS':
        draft.distributionSettings = { ...draft.distributionSettings, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_ENGAGEMENT_CONTROLS':
        draft.engagementControls = { ...draft.engagementControls, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_COMMERCIAL_SETTINGS':
        draft.commercialSettings = { ...draft.commercialSettings, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_CREATOR_PROGRAMS':
        draft.creatorPrograms = { ...draft.creatorPrograms, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_PROMOTION_INTENT':
        draft.promotionIntent = { ...draft.promotionIntent, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_SAFETY_ACCESSIBILITY':
        draft.safetyAccessibility = { ...draft.safetyAccessibility, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'SET_LIFECYCLE_SETTINGS':
        draft.lifecycleSettings = { ...draft.lifecycleSettings, ...(action.payload || {}) };
        draft.isDirty = true;
        pushHistory = true;
        break;
      case 'LOAD_DRAFT': {
        const cleanPrev = cloneSnapshotForHistory(state);
        const incoming = action.payload || {};
        Object.assign(draft, initialState, incoming);
        // Merge nested typeData so partial draft payloads never drop sub-keys
        draft.typeData = {
          poll: { ...initialState.typeData.poll, ...(incoming.typeData?.poll || {}) },
          event: { ...initialState.typeData.event, ...(incoming.typeData?.event || {}) },
          link: { ...initialState.typeData.link, ...(incoming.typeData?.link || {}) },
          audio: { ...initialState.typeData.audio, ...(incoming.typeData?.audio || {}) },
          video: { ...initialState.typeData.video, ...(incoming.typeData?.video || {}) },
        };
        draft.identityMeta = { ...initialState.identityMeta, ...(incoming.identityMeta || {}) };
        draft.distributionSettings = {
          ...initialState.distributionSettings,
          ...(incoming.distributionSettings || {}),
        };
        draft.engagementControls = {
          ...initialState.engagementControls,
          ...(incoming.engagementControls || {}),
        };
        draft.commercialSettings = {
          ...initialState.commercialSettings,
          ...(incoming.commercialSettings || {}),
        };
        draft.creatorPrograms = {
          ...initialState.creatorPrograms,
          ...(incoming.creatorPrograms || {}),
        };
        draft.promotionIntent = {
          ...initialState.promotionIntent,
          ...(incoming.promotionIntent || {}),
        };
        draft.safetyAccessibility = {
          ...initialState.safetyAccessibility,
          ...(incoming.safetyAccessibility || {}),
        };
        draft.lifecycleSettings = {
          ...initialState.lifecycleSettings,
          ...(incoming.lifecycleSettings || {}),
        };
        draft.isDraftLoaded = true;
        draft.draftId = incoming.draftId ?? null;
        draft.editPostId = incoming.editPostId ?? null;
        draft.clientPostId = incoming.clientPostId ?? null;
        draft.isDirty = !!incoming.isDirty;
        draft._past = [cleanPrev];
        draft._future = [];
        draft.isContentReady = !!(
          draft.content ||
          (Array.isArray(draft.mediaItems) && draft.mediaItems.length) ||
          draft.typeData?.audio?.url ||
          draft.typeData?.link?.url
        );
        break;
      }
      case 'RESET':
        return { ...initialState, postType: draft.postType };
      case 'CLEAR_ERROR':
        draft.error = null;
        break;
      default:
        break;
    }

    if (pushHistory) {
      const rest = cloneSnapshotForHistory(state);
      draft._past = [...state._past, rest];
      if (draft._past.length > 50) draft._past.shift();
      draft._future = [];
    }
  });
}

export function canProceedForState(state) {
  if (!state) return false;
  if (state.step === 1) return !!state.postType;
  if (state.step === 2) {
    const hasText = Boolean(
      (typeof state.content === 'string' && state.content.trim().length > 0) ||
        (state.contentJSON &&
          (typeof state.contentJSON === 'string'
            ? state.contentJSON.replace(/<[^>]+>/g, '').trim().length > 0
            : true))
    );
    switch (state.postType) {
      case 'text':
      case 'question':
        return hasText;
      case 'image':
        return (state.mediaItems?.length || 0) > 0 || hasText;
      case 'video':
        return (
          (state.mediaItems?.length || 0) > 0 ||
          Boolean(state.typeData?.video?.file || state.typeData?.video?.url) ||
          hasText
        );
      case 'audio':
        return Boolean(
          state.typeData?.audio?.file ||
            state.typeData?.audio?.url ||
            state.typeData?.audio?.previewUrl ||
            (state.mediaItems || []).some(
              (m) => m.type === 'audio' || m.file?.type?.startsWith('audio/')
            )
        );
      case 'poll': {
        const cleanOptions = (state.typeData?.poll?.options || [])
          .map((o) => (typeof o === 'string' ? o.trim() : (o?.text || '').trim()))
          .filter(Boolean);
        const uniqueCount = new Set(cleanOptions.map((o) => o.toLowerCase())).size;
        const hasValidClosing =
          !state.pollClosesAt || new Date(state.pollClosesAt).getTime() > Date.now();
        return hasText && cleanOptions.length >= 2 && uniqueCount >= 2 && hasValidClosing;
      }
      case 'event':
        return (
          hasText &&
          !!state.typeData?.event?.date &&
          new Date(state.typeData.event.date).getTime() > Date.now()
        );
      case 'link': {
        const rawUrl = (state.typeData?.link?.url || '').trim();
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return false;
        try {
          const parsed = new URL(rawUrl);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      }
      default:
        return true;
    }
  }
  return true;
}
