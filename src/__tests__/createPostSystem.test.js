/**
 * Unit and invariant tests for the modular CreatePost system:
 * - createPostReducer history/dirty isolation for upload telemetry
 * - media count/cap enforcement & nested typeData draft hydration
 * - canProceedForState validation across all post types
 * - template/media URL sanitization (never persists blob:/data:)
 * - hashtag extraction & publish fail-closed checks
 */

import { jest } from '@jest/globals';
import {
  initialState,
  reducer,
  canProceedForState,
} from '../screens/CreatePost/createPostReducer.js';
import {
  stripEphemeralUrlsFromMediaItems,
  sanitizeStateForTemplate,
} from '../screens/CreatePost/createPostStorage.js';
import {
  extractStoragePathFromUrl,
} from '../screens/CreatePost/postMediaPipeline.js';
import {
  extractMergedHashtags,
  extractSanitizedContent,
  executePostPublish,
} from '../screens/CreatePost/postPublishPipeline.js';

describe('CreatePost modular reducer', () => {
  test('UPDATE_MEDIA_PROGRESS mutates progress without polluting undo history or isDirty', () => {
    let s = reducer(initialState, {
      type: 'SET_MEDIA_ITEMS',
      payload: [{ id: 'img-1', type: 'image', name: 'a.jpg', progress: 0 }],
    });
    const pastLenBefore = s._past.length;
    s = reducer(s, { type: 'SET_IS_DIRTY', payload: false });

    const next = reducer(s, {
      type: 'UPDATE_MEDIA_PROGRESS',
      payload: { id: 'img-1', updates: { progress: 65, state: 'uploading' } },
    });

    expect(next.mediaItems[0].progress).toBe(65);
    expect(next._past.length).toBe(pastLenBefore);
    expect(next.isDirty).toBe(false);
  });

  test('UPDATE_MEDIA_ITEM ignores transient progress keys for history & dirty', () => {
    let s = reducer(initialState, {
      type: 'SET_MEDIA_ITEMS',
      payload: [{ id: 'img-1', type: 'image', progress: 0 }],
    });
    s = reducer(s, { type: 'SET_IS_DIRTY', payload: false });
    const pastLen = s._past.length;

    const transient = reducer(s, {
      type: 'UPDATE_MEDIA_ITEM',
      payload: { id: 'img-1', updates: { progress: 42, status: 'uploading' } },
    });
    expect(transient._past.length).toBe(pastLen);
    expect(transient.isDirty).toBe(false);

    const substantive = reducer(transient, {
      type: 'UPDATE_MEDIA_ITEM',
      payload: { id: 'img-1', updates: { alt: 'Sunset beach' } },
    });
    expect(substantive._past.length).toBe(pastLen + 1);
    expect(substantive.isDirty).toBe(true);
    expect(substantive.mediaItems[0].alt).toBe('Sunset beach');
  });

  test('SET_CONTENT extracts lowercase unique hashtags automatically', () => {
    const s = reducer(initialState, {
      type: 'SET_CONTENT',
      payload: 'Exploring #Arvdoul and #Design #arvdoul',
    });
    expect(s.hashtags).toEqual(['arvdoul', 'design']);
    expect(s.isDirty).toBe(true);
  });

  test('UNDO and REDO restore previous snapshots cleanly', () => {
    let s = reducer(initialState, { type: 'SET_CONTENT', payload: 'First' });
    s = reducer(s, { type: 'SET_CONTENT', payload: 'Second' });
    expect(s.content).toBe('Second');

    s = reducer(s, { type: 'UNDO' });
    expect(s.content).toBe('First');

    s = reducer(s, { type: 'REDO' });
    expect(s.content).toBe('Second');
  });

  test('ADD_MEDIA_ITEMS enforces per-type and total media caps', () => {
    const images = Array.from({ length: 12 }, (_, i) => ({
      id: `i-${i}`,
      type: 'image',
    }));
    const s = reducer(initialState, { type: 'ADD_MEDIA_ITEMS', payload: images });
    expect(s.mediaItems.length).toBe(10);

    const videos = Array.from({ length: 6 }, (_, i) => ({
      id: `v-${i}`,
      type: 'video',
    }));
    const vState = reducer(initialState, { type: 'ADD_MEDIA_ITEMS', payload: videos });
    expect(vState.mediaItems.length).toBe(1);
  });

  test('LOAD_DRAFT preserves nested typeData subkeys on partial draft payloads', () => {
    const s = reducer(initialState, {
      type: 'LOAD_DRAFT',
      payload: {
        postType: 'event',
        content: 'Launch Party',
        draftId: 'draft_1',
        typeData: {
          event: { location: 'Lagos', date: '2030-01-01T18:00:00.000Z' },
        },
      },
    });
    expect(s.typeData.event.location).toBe('Lagos');
    expect(s.typeData.event.rsvpEnabled).toBe(false);
    expect(s.typeData.poll.options).toEqual([]);
    expect(s.typeData.link.url).toBe('');
  });

  test('canProceedForState validates all 8 post types accurately and ignores stale isContentReady flag', () => {
    expect(canProceedForState({ ...initialState, step: 1, postType: null, isContentReady: true })).toBe(false);
    expect(canProceedForState({ ...initialState, step: 1, postType: 'text' })).toBe(true);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'text', content: '  ', isContentReady: true })).toBe(false);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'text', content: 'Hello' })).toBe(true);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'question', content: '   ' })).toBe(false);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'question', content: 'Why?' })).toBe(true);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'image', mediaItems: [{ id: '1' }] })).toBe(true);
    expect(canProceedForState({ ...initialState, step: 2, postType: 'video', mediaItems: [] })).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'video',
        typeData: { ...initialState.typeData, video: { url: 'https://cdn.test/v.mp4' } },
      })
    ).toBe(true);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'audio',
        typeData: { ...initialState.typeData, audio: { url: '', previewUrl: '', file: null } },
      })
    ).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'audio',
        typeData: { ...initialState.typeData, audio: { url: 'https://cdn.test/a.mp3', file: null } },
      })
    ).toBe(true);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'poll',
        content: 'Pick one',
        typeData: { ...initialState.typeData, poll: { options: ['Same', 'same'] } },
      })
    ).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'poll',
        content: 'Pick one',
        pollClosesAt: '2020-01-01T00:00:00Z',
        typeData: { ...initialState.typeData, poll: { options: ['A', 'B'] } },
      })
    ).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'poll',
        content: 'Pick one',
        typeData: { ...initialState.typeData, poll: { options: ['A', 'B'] } },
      })
    ).toBe(true);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'event',
        content: 'Meetup',
        typeData: { ...initialState.typeData, event: { date: '2020-06-01T12:00:00Z' } },
      })
    ).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'event',
        content: 'Meetup',
        typeData: { ...initialState.typeData, event: { date: '2035-06-01T12:00:00Z' } },
      })
    ).toBe(true);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'link',
        typeData: { ...initialState.typeData, link: { url: 'https://arvdoul.com' } },
      })
    ).toBe(true);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'link',
        typeData: { ...initialState.typeData, link: { url: 'javascript:alert(1)' } },
      })
    ).toBe(false);
    expect(
      canProceedForState({
        ...initialState,
        step: 2,
        postType: 'link',
        typeData: { ...initialState.typeData, link: { url: 'not-a-url' } },
      })
    ).toBe(false);
  });
});

describe('CreatePost storage & URL sanitization', () => {
  test('stripEphemeralUrlsFromMediaItems drops blob: and data: URLs while preserving HTTPS', () => {
    const cleaned = stripEphemeralUrlsFromMediaItems([
      {
        id: '1',
        url: 'https://firebasestorage.googleapis.com/v0/b/x/o/posts%2Fu1%2Fa.jpg',
        preview: 'blob:http://localhost/123',
        thumbnailUrl: 'data:image/png;base64,abc',
      },
      {
        id: '2',
        url: 'blob:http://localhost/456',
        thumbnail: 'https://cdn.example/t.jpg',
      },
    ]);
    expect(cleaned[0].url).toContain('https://');
    expect(cleaned[0].preview).toBeNull();
    expect(cleaned[0].thumbnailUrl).toBeNull();
    expect(cleaned[1].url).toBe('');
    expect(cleaned[1].thumbnail).toBe('https://cdn.example/t.jpg');
  });

  test('sanitizeStateForTemplate removes runtime/account identifiers and volatile URLs', () => {
    const sanitized = sanitizeStateForTemplate({
      ...initialState,
      postType: 'audio',
      content: 'Track drop',
      draftId: 'draft_1',
      editPostId: 'post_9',
      clientPostId: 'client_9',
      mediaItems: [{ id: '1', preview: 'blob:x', url: 'data:image/jpeg;base64,zz' }],
      typeData: {
        ...initialState.typeData,
        audio: { url: 'blob:http://localhost/audio', coverUrl: 'https://cdn.test/c.jpg', title: 'Beat' },
      },
    });
    expect(sanitized.draftId).toBeUndefined();
    expect(sanitized.editPostId).toBeUndefined();
    expect(sanitized.clientPostId).toBeUndefined();
    expect(sanitized.mediaItems[0].preview).toBeNull();
    expect(sanitized.mediaItems[0].url).toBe('');
    expect(sanitized.typeData.audio.url).toBe('');
    expect(sanitized.typeData.audio.coverUrl).toBe('https://cdn.test/c.jpg');
  });

  test('extractStoragePathFromUrl decodes Firebase Storage object paths', () => {
    expect(
      extractStoragePathFromUrl(
        'https://firebasestorage.googleapis.com/v0/b/arvdoul-8057b.appspot.com/o/posts%2Fuid123%2F1700_pic.jpg?alt=media'
      )
    ).toBe('posts/uid123/1700_pic.jpg');
    expect(extractStoragePathFromUrl('not-a-url')).toBeNull();
  });
});

describe('CreatePost publish pipeline helpers', () => {
  test('extractMergedHashtags merges state hashtags and content tags uniquely', () => {
    expect(extractMergedHashtags('Hello #World #Arvdoul', ['#Design', 'world'])).toEqual([
      'design',
      'world',
      'arvdoul',
    ]);
  });

  test('extractSanitizedContent strips unsafe HTML tags', () => {
    const res = extractSanitizedContent('<script>alert(1)</script>Hello world', null);
    expect(res.effectiveText).toBe('Hello world');
    expect(res.sanitizedContent).not.toContain('<script>');
  });

  test('executePostPublish fails closed when live auth is missing', async () => {
    await expect(
      executePostPublish({
        current: { ...initialState, postType: 'text', content: 'Hi' },
        userSnapshot: null,
        services: {},
        isOffline: false,
      })
    ).rejects.toThrow(/signed in/i);
  });

  test('executePostPublish validates Step 3 compliance, edit question preservation, link metadata, and event creation', async () => {
    jest.resetModules();
    const updatePost = jest.fn(async () => ({ success: true }));
    const createPost = jest.fn(async () => ({ postId: 'post_evt_1' }));
    const createEvent = jest.fn(async () => ({ id: 'evt_1' }));
    const publishEvent = jest.fn(async () => ({ success: true }));
    const updateEvent = jest.fn(async () => ({ success: true }));
    const clearUserCache = jest.fn();

    jest.unstable_mockModule('../services/authService.js', () => ({
      getAuthService: () => ({
        getCurrentUser: () => ({ uid: 'u1', displayName: 'Ada', email: 'ada@arvdoul.test' }),
      }),
    }));

    const { executePostPublish: runPublish } = await import('../screens/CreatePost/postPublishPipeline.js');
    const services = {
      firestore: { updatePost, createPost },
      event: { createEvent, publishEvent, updateEvent },
      feed: { clearUserCache },
    };

    // 1. Copyright confirmation missing -> rejects
    await expect(
      runPublish({
        current: {
          ...initialState,
          postType: 'text',
          content: 'Hello',
          safetyAccessibility: { ...initialState.safetyAccessibility, copyrightConfirmed: false },
        },
        userSnapshot: { uid: 'u1' },
        services,
        isOffline: false,
      })
    ).rejects.toThrow(/copyright/i);

    // 2. Paid partnership missing brand partner -> rejects
    await expect(
      runPublish({
        current: {
          ...initialState,
          postType: 'text',
          content: 'Sponsored post',
          commercialSettings: { ...initialState.commercialSettings, disclosureType: 'paid_partnership', brandPartnerName: '' },
        },
        userSnapshot: { uid: 'u1' },
        services,
        isOffline: false,
      })
    ).rejects.toThrow(/brand partner/i);

    // 3. Edit question post preserves answers by writing 'question.text' only
    await runPublish({
      current: {
        ...initialState,
        editPostId: 'q_edit_1',
        postType: 'question',
        content: 'Updated question?',
      },
      userSnapshot: { uid: 'u1' },
      services,
      isOffline: false,
    });
    expect(updatePost).toHaveBeenCalledWith(
      'q_edit_1',
      expect.objectContaining({
        'question.text': 'Updated question?',
      })
    );
    expect(updatePost.mock.calls[0][1].question).toBeUndefined();

    // 4. Event post creates and publishes linked event and persists event.id on post
    await runPublish({
      current: {
        ...initialState,
        postType: 'event',
        content: 'Arvdoul Summit',
        typeData: {
          ...initialState.typeData,
          event: {
            ...initialState.typeData.event,
            date: '2035-09-01T10:00:00.000Z',
            location: 'Lagos',
            capacity: 250,
            timezone: 'Africa/Lagos',
          },
        },
      },
      userSnapshot: { uid: 'u1' },
      services,
      isOffline: false,
    });
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith('evt_1', 'u1');
    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'event',
        event: expect.objectContaining({ id: 'evt_1', location: 'Lagos', capacity: 250 }),
      })
    );
  });
});
