/**
 * src/__tests__/engagementEndToEnd.test.js
 *
 * End-to-end verification of fixes for:
 * - commentService.likeComment / dislikeComment / removeLikeDislike checking
 *   subcollection docs instead of capped arrays (`likesBy` / `dislikesBy`)
 * - commentService.addReaction returning `previousReaction` when switching/toggling
 * - commentService.createComment({ targetType: 'story' }) skipping posts/{id} reads/counters
 * - firestoreService.likePost failing cleanly on missing post docs & getSavedPostIds
 * - ProfileFeedGrid bookmark hydration + SavedScreen/CommentsDrawer/VideoComments wiring
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'viewer-1' } }),
}));

jest.unstable_mockModule('../utils/OfflineQueue.js', () => ({
  offlineQueue: { enqueue: async () => {}, process: async () => {} },
  OfflineQueue: class {},
}));

jest.unstable_mockModule('../utils/CountersManager.js', () => {
  const countersManager = {
    increment: jest.fn(async () => ({})),
    get: jest.fn(async ({ fallback = 0 }) => fallback),
    applyAll: jest.fn(async () => {}),
    invalidate: jest.fn(),
  };
  return { countersManager, default: countersManager };
});

jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({
    getHiddenAuthorIds: async () => new Set(),
  }),
}));

const { getCommentService } = await import('../services/commentService.js');
const { countersManager } = await import('../utils/CountersManager.js');
const { firestoreService, getFirestoreService } = await import('../services/firestoreService.js');

async function awaitCommentSvcInit(svc) {
  for (let i = 0; i < 200 && !svc.initialized; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
  svc.initialized = true;
  svc.firestore = {};
  if (svc.cleanupInterval) {
    clearInterval(svc.cleanupInterval);
    svc.cleanupInterval = null;
  }
}

describe('commentService subcollection-authoritative likes, reactions & story targets', () => {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    countersManager.increment.mockClear();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
  });

  afterEach(() => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete globalThis.navigator;
    }
  });

  test('removeLikeDislike unlikes even when likesBy array was capped and omits userId', async () => {
    const svc = getCommentService();
    await awaitCommentSvcInit(svc);

    const deletedPaths = [];
    const updatedDocs = [];

    svc.firestoreMethods = {
      doc: (_db, ...segments) => ({ path: segments.join('/') }),
      getDoc: async (ref) => {
        if (ref.path === 'comments/c1') {
          return {
            exists: () => true,
            data: () => ({ likesBy: ['other-1', 'other-2'], dislikesBy: [] }),
          };
        }
        if (ref.path === 'comments/c1/likes/u99') {
          return { exists: () => true, data: () => ({ userId: 'u99' }) };
        }
        if (ref.path === 'comments/c1/dislikes/u99') {
          return { exists: () => false, data: () => null };
        }
        return { exists: () => false };
      },
      deleteDoc: async (ref) => {
        deletedPaths.push(ref.path);
      },
      updateDoc: async (ref, data) => {
        updatedDocs.push({ path: ref.path, data });
      },
      arrayRemove: (val) => ({ _op: 'arrayRemove', val }),
      serverTimestamp: () => 'SERVER_TS',
    };

    const res = await svc.removeLikeDislike('c1', 'u99');
    expect(res).toEqual({ success: true, commentId: 'c1', action: 'removed' });
    expect(deletedPaths).toContain('comments/c1/likes/u99');
    expect(countersManager.increment).toHaveBeenCalledWith({
      docPath: 'comments/c1',
      field: 'likes',
      amount: -1,
    });
    expect(updatedDocs).toHaveLength(1);
  });

  test('likeComment detects existing subcollection like even when likesBy array omitted userId', async () => {
    const svc = getCommentService();
    await awaitCommentSvcInit(svc);

    svc.firestoreMethods = {
      doc: (_db, ...segments) => ({ path: segments.join('/') }),
      getDoc: async (ref) => {
        if (ref.path === 'comments/c2') {
          return {
            exists: () => true,
            data: () => ({ likesBy: [], dislikesBy: [] }),
          };
        }
        if (ref.path === 'comments/c2/likes/u99') {
          return { exists: () => true, data: () => ({ userId: 'u99' }) };
        }
        return { exists: () => false };
      },
    };

    await expect(svc.likeComment('c2', 'u99')).rejects.toThrow(/already liked/i);
  });

  test('addReaction returns previousReaction when switching emojis and when toggling off', async () => {
    const svc = getCommentService();
    await awaitCommentSvcInit(svc);

    let storedEmoji = '❤️';
    let reactionCounts = { '❤️': 2 };

    svc.firestoreMethods = {
      doc: (_db, ...segments) => ({ path: segments.join('/') }),
      serverTimestamp: () => 'SERVER_TS',
      runTransaction: async (_db, fn) => {
        const tx = {
          get: async (ref) => {
            if (ref.path === 'comments/c3/reactions/u1') {
              return {
                exists: () => Boolean(storedEmoji),
                data: () => (storedEmoji ? { emoji: storedEmoji } : null),
              };
            }
            return {
              exists: () => true,
              data: () => ({ reactionCounts }),
            };
          },
          set: (_ref, data) => {
            storedEmoji = data.emoji;
          },
          delete: () => {
            storedEmoji = null;
          },
          update: (_ref, patch) => {
            if (patch.reactionCounts) reactionCounts = patch.reactionCounts;
          },
        };
        await fn(tx);
      },
    };

    const switched = await svc.addReaction('c3', 'u1', '🔥');
    expect(switched).toEqual({
      success: true,
      commentId: 'c3',
      action: 'changed',
      emoji: '🔥',
      previousReaction: '❤️',
    });
    expect(reactionCounts).toEqual({ '❤️': 1, '🔥': 1 });

    const removed = await svc.addReaction('c3', 'u1', '🔥');
    expect(removed).toEqual({
      success: true,
      commentId: 'c3',
      action: 'removed',
      emoji: '🔥',
      previousReaction: '🔥',
    });
    expect(reactionCounts).toEqual({ '❤️': 1, '🔥': 0 });
  });

  test('createComment with targetType="story" skips posts/{id} lookup and counter increment', async () => {
    const svc = getCommentService();
    await awaitCommentSvcInit(svc);

    const readPaths = [];
    const writtenComments = [];

    svc._checkSpamRate = async () => ({ allowed: true, count: 0, waitTime: 0 });
    svc._awardCommentXp = async () => {};

    svc.firestoreMethods = {
      collection: (_db, name) => ({ path: name }),
      doc: (_db, ...segments) => ({ id: segments[segments.length - 1] || 'c_story_1', path: segments.join('/') }),
      getDoc: async (ref) => {
        readPaths.push(ref.path);
        return { exists: () => false };
      },
      addDoc: async (_col, data) => {
        writtenComments.push(data);
        return { id: 'c_story_1' };
      },
      setDoc: async (_ref, data) => {
        writtenComments.push(data);
      },
      serverTimestamp: () => 'SERVER_TS',
    };

    const res = await svc.createComment('story_abc', 'u1', 'Great Vibe!', {
      targetType: 'story',
      userName: 'Alice',
    });

    expect(res.success).toBe(true);
    expect(readPaths.some((p) => p.startsWith('posts/'))).toBe(false);
    expect(countersManager.increment).not.toHaveBeenCalledWith(
      expect.objectContaining({ docPath: 'posts/story_abc' })
    );
    expect(writtenComments[0].postId).toBe('story_abc');
    expect(writtenComments[0].content).toBe('Great Vibe!');
  });
});

describe('firestoreService.likePost & getSavedPostIds', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
      delete globalThis.navigator;
    }
  });

  test('likePost returns failure instead of fake success when target post does not exist', async () => {
    const fsSvc = getFirestoreService();
    fsSvc.firestore = {};
    fsSvc.initialized = true;
    fsSvc.firestoreMethods = {
      doc: (_db, ...segments) => ({ path: segments.join('/') }),
      serverTimestamp: () => 'SERVER_TS',
      runTransaction: async (_db, fn) => {
        const tx = {
          get: async () => ({ exists: () => false }),
          set: jest.fn(),
          update: jest.fn(),
        };
        await fn(tx);
      },
    };

    const res = await firestoreService.likePost('missing_post', 'u1');
    expect(res).toEqual({ success: false, error: 'Post not found' });
  });

  test('getSavedPostIds resolves viewer saved_posts across >30 ids in bounded chunks', async () => {
    const fsSvc = getFirestoreService();
    fsSvc.firestore = {};
    fsSvc.initialized = true;
    const chunkSizes = [];

    fsSvc.firestoreMethods = {
      collection: (_db, ...segments) => ({ path: segments.join('/') }),
      documentId: () => '__name__',
      where: (_f, _op, vals) => {
        chunkSizes.push(vals.length);
        return { vals };
      },
      limit: (n) => ({ n }),
      query: (_col, cond) => cond,
      getDocs: async (cond) => {
        const docs = cond.vals
          .filter((id) => id === 'p1' || id === 'p32')
          .map((id) => ({ id }));
        return { docs, forEach: (fn) => docs.forEach(fn) };
      },
    };

    const ids = Array.from({ length: 35 }, (_, i) => `p${i + 1}`);
    const savedSet = await firestoreService.getSavedPostIds('viewer-1', ids);
    expect(chunkSizes).toEqual([30, 5]);
    expect(savedSet).toEqual(new Set(['p1', 'p32']));
  });
});

describe('UI engagement & story wiring regression guards', () => {
  test('ProfileFeedGrid hydrates bookmarks via firestoreService.getSavedPostIds', () => {
    const grid = read('src/components/profile/ProfileFeedGrid.jsx');
    expect(grid).toContain('getSavedPostIds');
    expect(grid).toContain('touchedSavesRef');
  });

  test('CommentsDrawer routes reports through commentService.reportComment and renders reaction chips', () => {
    const drawer = read('src/screens/CommentsDrawer.jsx');
    expect(drawer).toContain('commentService.reportComment(');
    expect(drawer).toContain('comment.reactionCounts');
    expect(drawer).toContain('res.previousReaction');
  });

  test('SavedScreen does not fall back missing post/video thumbnails to default-profile.png', () => {
    const saved = read('src/screens/SavedScreen.jsx');
    expect(saved).not.toContain("p.mediaUrl || '/assets/default-profile.png'");
    expect(saved).not.toContain("v.thumbnailUrl || '/assets/default-profile.png'");
  });

  test('CreateStory and VibeRenderer support all 6 story/vibe modes including audio and event', () => {
    const creator = read('src/screens/CreateStory.jsx');
    const renderer = read('src/components/vibes/VibeRenderer.jsx');
    expect(creator).toContain("'STORY', 'TEXT', 'PHOTO', 'VIDEO', 'AUDIO', 'EVENT'");
    expect(creator).toContain('validateVibeEvent');
    expect(renderer).toContain("type === 'event'");
    expect(renderer).toContain("type === 'audio'");
  });
});
