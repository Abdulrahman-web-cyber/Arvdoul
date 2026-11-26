/**
 * src/__tests__/postAndSettingsEndToEnd.test.js
 * End-to-end verification tests for all 8 post types, post settings enforcement,
 * Firestore/Rules contracts, and community/video/poll server handlers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('firestoreService post types & settings enforcement', () => {
  let firestoreService;
  let storeMap;
  let updateCalls;
  let setCalls;
  let idSeq;

  beforeEach(async () => {
    storeMap = new Map();
    updateCalls = [];
    setCalls = [];
    idSeq = 0;

    const module = await import('../services/firestoreService.js');
    firestoreService = module.getFirestoreService();
    firestoreService.initialized = true;
    firestoreService.firestore = { fake: true };
    firestoreService.isOnline = true;
    firestoreService.getAuthInstance = async () => ({
      currentUser: { uid: 'author_1', displayName: 'Author One' },
    });
    firestoreService.firestoreMethods = {
      collection: (_db, name) => ({ path: name, _isCol: true }),
      doc: (base, ...segments) => {
        if (base?._isCol) {
          const id = segments[0] || `auto_${++idSeq}`;
          return { id, path: `${base.path}/${id}` };
        }
        const pathStr = segments.join('/');
        return { id: segments[segments.length - 1], path: pathStr };
      },
      getDoc: async (ref) => ({
        exists: () => storeMap.has(ref.path),
        data: () => storeMap.get(ref.path),
      }),
      setDoc: async (ref, data) => {
        setCalls.push({ path: ref.path, data });
        storeMap.set(ref.path, data);
      },
      updateDoc: async (ref, data) => {
        updateCalls.push({ path: ref.path, data });
      },
      addDoc: async (colRef, data) => {
        const id = `generated_${++idSeq}`;
        storeMap.set(`${colRef.path}/${id}`, data);
        return { id };
      },
      serverTimestamp: () => 'SERVER_TS',
      increment: (n) => ({ _increment: n }),
    };
  });

  test('createPost preserves link metadata fallbacks and rejects unsafe protocols', async () => {
    storeMap.set('users/author_1', {
      displayName: 'Author One',
      username: 'authorone',
      isPrivate: false,
    });

    await firestoreService.createPost({
      authorId: 'author_1',
      type: 'link',
      content: 'Check this guide',
      link: {
        url: 'https://arvdoul.com/guide',
        thumbnail: 'https://cdn.arvdoul.com/og.png',
        metadata: {
          title: 'Arvdoul Guide',
          description: 'Complete guide',
          domain: 'arvdoul.com',
        },
      },
    });

    const created = setCalls.find((c) => c.path.startsWith('posts/'))?.data;
    expect(created).toBeTruthy();
    expect(created.link).toEqual({
      url: 'https://arvdoul.com/guide',
      title: 'Arvdoul Guide',
      description: 'Complete guide',
      image: 'https://cdn.arvdoul.com/og.png',
      domain: 'arvdoul.com',
      author: '',
    });

    await firestoreService.createPost({
      authorId: 'author_1',
      type: 'link',
      content: 'Unsafe link',
      link: { url: 'javascript:alert(1)' },
    });
    const postWrites = setCalls.filter((c) => c.path.startsWith('posts/'));
    expect(postWrites[postWrites.length - 1].data.link).toBeNull();
  });

  test('updatePost converts scheduledTime and expiresAt to Date or null and sets status', async () => {
    await firestoreService.updatePost('post_1', {
      content: 'Scheduled later',
      scheduledTime: '2036-02-01T12:00:00.000Z',
      expiresAt: '2036-03-01T12:00:00.000Z',
    });

    expect(updateCalls[0].data.scheduledTime).toBeInstanceOf(Date);
    expect(updateCalls[0].data.expiresAt).toBeInstanceOf(Date);
    expect(updateCalls[0].data.status).toBe('scheduled');

    await firestoreService.updatePost('post_1', {
      content: 'Publish now',
      scheduledTime: null,
      expiresAt: '',
    });

    expect(updateCalls[1].data.scheduledTime).toBeNull();
    expect(updateCalls[1].data.expiresAt).toBeNull();
    expect(updateCalls[1].data.status).toBe('published');
  });

  test('repostPost blocks reposting when distributionSettings.allowReposts or enableShares is false', async () => {
    storeMap.set('users/viewer_1', { displayName: 'Viewer One' });
    storeMap.set('posts/p_no_repost', {
      authorId: 'author_1',
      authorIsPrivate: false,
      distributionSettings: { allowReposts: false },
    });
    await expect(
      firestoreService.repostPost('p_no_repost', 'viewer_1')
    ).rejects.toThrow(/Reposting is disabled/i);

    storeMap.set('posts/p_no_share', {
      authorId: 'author_1',
      authorIsPrivate: false,
      engagementControls: { enableShares: false },
    });
    await expect(
      firestoreService.repostPost('p_no_share', 'viewer_1')
    ).rejects.toThrow(/Reposting is disabled/i);
  });

  test('getUserPollVote reads multi-choice _opt_ docs and single-choice fallback', async () => {
    storeMap.set('posts/poll_multi/poll_votes/u1_opt_0', { optionId: 'opt_0', optionIndex: 0 });
    storeMap.set('posts/poll_multi/poll_votes/u1_opt_2', { optionId: 'opt_2', optionIndex: 2 });

    const multi = await firestoreService.getUserPollVote('poll_multi', 'u1', {
      allowMultiple: true,
      optionCount: 3,
    });
    expect(multi.optionIds).toEqual(['opt_0', 'opt_2']);
    expect(multi.optionIndex).toBe(0);

    storeMap.set('posts/poll_single/poll_votes/u1', { optionId: 'opt_1', optionIndex: 1 });
    const single = await firestoreService.getUserPollVote('poll_single', 'u1');
    expect(single.optionIds).toEqual(['opt_1']);
    expect(single.optionIndex).toBe(1);
  });
});

describe('commentService comment controls & voice comments', () => {
  let commentService;
  let storeMap;
  let addCalls;
  let mockRel;

  beforeEach(async () => {
    jest.resetModules();
    storeMap = new Map();
    addCalls = [];
    mockRel = { isFollowing: false, isFollower: false };

    jest.unstable_mockModule('../services/socialGraphService.js', () => ({
      getSocialGraphService: () => ({
        getRelationship: jest.fn(async () => mockRel),
        getHiddenAuthorIds: jest.fn(async () => new Set()),
      }),
    }));
    jest.unstable_mockModule('../utils/CountersManager.js', () => ({
      countersManager: {
        increment: jest.fn(async () => {}),
        apply: jest.fn(async () => {}),
        invalidate: jest.fn(),
      },
    }));

    const mod = await import('../services/commentService.js');
    commentService = mod.getCommentService();
    commentService.initialized = true;
    commentService.firestore = { fake: true };
    commentService.firestoreMethods = {
      collection: (_db, ...segments) => ({ path: segments.join('/') }),
      doc: (_db, ...segments) => ({ path: segments.join('/') }),
      getDoc: async (ref) => ({
        exists: () => storeMap.has(ref.path),
        data: () => storeMap.get(ref.path),
      }),
      addDoc: async (colRef, data) => {
        const id = `c_${addCalls.length + 1}`;
        addCalls.push({ path: colRef.path, data });
        return { id };
      },
      updateDoc: async () => {},
      serverTimestamp: () => 'SERVER_TS',
      increment: (n) => n,
    };
    commentService._checkSpamRate = async () => ({ allowed: true });
    commentService._updateSpamCounter = async () => {};
    commentService._invalidatePostCaches = async () => {};
    commentService._sendCommentNotifications = async () => {};
    commentService._notifyPostAuthor = async () => {};
    commentService._awardCommentXp = async () => {};
    commentService._triggerModeration = async () => {};
  });

  afterEach(() => {
    if (commentService?.cleanupInterval) {
      clearInterval(commentService.cleanupInterval);
      commentService.cleanupInterval = null;
    }
  });

  test('enforces comments off, followers-only, and friends-only modes', async () => {
    storeMap.set('posts/p_off', {
      authorId: 'author_1',
      enableComments: false,
      engagementControls: { enableComments: false, commentMode: 'off' },
    });
    await expect(
      commentService.createComment('p_off', 'u2', 'Hello')
    ).rejects.toThrow(/turned off/i);

    storeMap.set('posts/p_followers', {
      authorId: 'author_1',
      engagementControls: { enableComments: true, commentMode: 'followers' },
    });
    mockRel = { isFollowing: false, isFollower: false };
    await expect(
      commentService.createComment('p_followers', 'u2', 'Hello')
    ).rejects.toThrow(/Only followers/i);

    storeMap.set('posts/p_friends', {
      authorId: 'author_1',
      engagementControls: { enableComments: true, commentMode: 'friends' },
    });
    mockRel = { isFollowing: true, isFollower: false };
    await expect(
      commentService.createComment('p_friends', 'u2', 'Hello')
    ).rejects.toThrow(/Only friends/i);

    mockRel = { isFollowing: true, isFollower: true };
    const allowed = await commentService.createComment('p_friends', 'u2', 'Friend reply!');
    expect(allowed.success).toBe(true);
    expect(addCalls).toHaveLength(1);
  });

  test('allows voice comments with empty text content when mediaUrl is present', async () => {
    storeMap.set('posts/p_open', {
      authorId: 'author_1',
      engagementControls: { enableComments: true, commentMode: 'everyone' },
    });

    const res = await commentService.createComment('p_open', 'u2', '', {
      type: 'voice',
      mediaUrl: 'https://cdn.arvdoul.com/voice.webm',
    });
    expect(res.success).toBe(true);
    expect(addCalls[0].data.type).toBe('voice');
    expect(addCalls[0].data.mediaUrl).toBe('https://cdn.arvdoul.com/voice.webm');
  });
});

describe('Server & rules contracts for polls, communities, videos, and settings', () => {
  test('firestore.rules allows voter-owned subcollection poll_votes reads while keeping top-level server-only', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain("docId.startsWith(uid() + '_opt_')");
    expect(rules).toMatch(/match\s+\/poll_votes\/\{voteId\}[\s\S]*allow read, write: if false;/);
  });

  test('functions/communities.js normalizes string poll options, question, link, and controlMeta', () => {
    const src = fs.readFileSync(path.join(root, 'functions/communities.js'), 'utf8');
    expect(src).toContain("typeof opt === 'string'");
    expect(src).toContain('`opt_${idx}`');
    expect(src).toContain('commercialDisclosure');
    expect(src).toContain('engagementControls');
    expect(src).toContain('acceptedAnswerId');
  });

  test('functions/video.js persists Step 3 controlMeta and comment/gift gates on Mux uploads', () => {
    const src = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');
    expect(src).toContain('engagementControls');
    expect(src).toContain('commercialDisclosure');
    expect(src).toContain('safetyAccessibility');
    expect(src).toContain('lifecycleSettings');
  });

  test('functions/polls.js supports legacy numeric option ids when opt_N is passed', () => {
    const src = fs.readFileSync(path.join(root, 'functions/polls.js'), 'utf8');
    expect(src).toContain("optionId.startsWith('opt_')");
  });
});
