/**
 * src/__tests__/soundService.test.js
 * Deterministic unit tests for soundService with a fully mocked Firestore layer.
 *
 * The previous test hit the real Firestore SDK with no emulator and timed out.
 * Here, both `firebase/firestore` (dynamic imports inside the service) and the
 * Firebase singleton are mocked, so the suite is fast and hermetic.
 */

import { jest } from '@jest/globals';

// ---- Mock the Firebase singleton BEFORE importing the service ----
const mockFirestoreInstance = { type: 'mock-firestore' };
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => mockFirestoreInstance),
  getAuthInstance: jest.fn(async () => ({ currentUser: null })),
}));

// ---- In-memory fake Firestore ----
const soundsCollection = new Map();
const savedSoundsCollection = new Map();
let docCounter = 0;

function makeDocRef(firestore, path) {
  return { id: path.split('/').pop(), path, firestore };
}

function makeQuerySnapshot(docs) {
  return {
    docs,
    forEach(cb) {
      docs.forEach((d) => cb(d));
    },
    size: docs.length,
    empty: docs.length === 0,
  };
}

function makeDocSnapshot(id, data) {
  return {
    id,
    exists: () => data !== undefined,
    data: () => data,
  };
}

const mockFirestoreModule = {
  collection: (firestore, name) => ({ firestore, name }),
  query: (colRef, ...constraints) => ({ colRef, constraints }),
  where: (field, op, value) => ({ field, op, value }),
  orderBy: (field, dir) => ({ field, dir }),
  limit: (n) => ({ limit: n }),
  doc: (firestore, collectionName, id) => makeDocRef(firestore, `${collectionName}/${id}`),
  getDocs: async (q) => {
    const name = q.colRef ? q.colRef.name : q.name;
    if (name === 'sounds') {
      const items = Array.from(soundsCollection.values());
      let filtered = items;
      const whereClause = (q.constraints || []).find((c) => c.field === 'genre');
      if (whereClause) filtered = items.filter((d) => d.data.genre === whereClause.value);
      const sorted = [...filtered].sort((a, b) => (b.data.reelsCountNum || 0) - (a.data.reelsCountNum || 0));
      return makeQuerySnapshot(sorted.map((d) => makeDocSnapshot(d.id, d.data)));
    }
    if (name === 'saved_sounds') {
      return makeQuerySnapshot(
        Array.from(savedSoundsCollection.values())
          .filter((d) => d.data.userId === (q.constraints || []).find((c) => c.field === 'userId')?.value)
          .map((d) => makeDocSnapshot(d.id, d.data))
      );
    }
    return makeQuerySnapshot([]);
  },
  getDoc: async (ref) => {
    const coll = ref.path.includes('saved_sounds') ? savedSoundsCollection : soundsCollection;
    return makeDocSnapshot(ref.id, coll.get(ref.id)?.data);
  },
  setDoc: async (ref, data) => {
    const coll = ref.path.includes('saved_sounds') ? savedSoundsCollection : soundsCollection;
    coll.set(ref.id, { id: ref.id, data: { ...(coll.get(ref.id)?.data || {}), ...data } });
  },
  deleteDoc: async (ref) => {
    savedSoundsCollection.delete(ref.id);
  },
  addDoc: async (colRef, data) => {
    const id = `snd-custom-${++docCounter}`;
    soundsCollection.set(id, { id, data });
    return makeDocRef(colRef.firestore, `sounds/${id}`);
  },
  increment: (n) => ({ __increment: n }),
};

jest.unstable_mockModule('firebase/firestore', () => mockFirestoreModule);

// Seed catalog data.
soundsCollection.set('snd-sample-1', {
  id: 'snd-sample-1',
  data: {
    title: 'Neon Nights',
    artist: 'Arvdoul Originals',
    genre: 'Synthwave',
    reelsCountNum: 42,
    waveformData: [10, 20, 30],
  },
});

const { default: soundService } = await import('../services/soundService.js');

describe('soundService', () => {
  afterEach(() => {
    soundsCollection.clear();
    savedSoundsCollection.clear();
    docCounter = 0;
    soundsCollection.set('snd-sample-1', {
      id: 'snd-sample-1',
      data: {
        title: 'Neon Nights',
        artist: 'Arvdoul Originals',
        genre: 'Synthwave',
        reelsCountNum: 42,
        waveformData: [10, 20, 30],
      },
    });
  });

  test('getTrendingSounds returns seeded catalog ordered by reelsCountNum', async () => {
    soundsCollection.set('snd-sample-2', {
      id: 'snd-sample-2',
      data: { title: 'Boomer', genre: 'Hip-Hop', reelsCountNum: 99 },
    });
    const sounds = await soundService.getTrendingSounds('All');
    expect(sounds.length).toBeGreaterThan(0);
    expect(sounds[0].id).toBeDefined();
    expect(sounds[0].title).toBeDefined();
    expect(sounds[0].reelsCountNum).toBeGreaterThanOrEqual(sounds[1]?.reelsCountNum ?? 0);
  });

  test('getTrendingSounds filters by genre', async () => {
    const sounds = await soundService.getTrendingSounds('Synthwave');
    expect(sounds.length).toBe(1);
    expect(sounds[0].genre).toBe('Synthwave');
  });

  test('getTrendingSounds returns empty array when Firestore is unavailable', async () => {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    getFirestoreInstance.mockRejectedValueOnce(new Error('offline'));
    const sounds = await soundService.getTrendingSounds('All');
    expect(sounds).toEqual([]);
  });

  test('toggleSaveSound saves then unsaves a sound', async () => {
    const saved = await soundService.toggleSaveSound('snd-sample-1', 'user-1');
    expect(saved).toHaveProperty('saved');
    expect(saved.saved).toBe(true);
    expect(savedSoundsCollection.size).toBe(1);

    const unsaved = await soundService.toggleSaveSound('snd-sample-1', 'user-1');
    expect(unsaved.saved).toBe(false);
    expect(savedSoundsCollection.size).toBe(0);
  });

  test('toggleSaveSound returns graceful error object on failure', async () => {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    getFirestoreInstance.mockRejectedValueOnce(new Error('boom'));
    const result = await soundService.toggleSaveSound('snd-sample-1', 'user-1');
    expect(result.saved).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('getSavedSounds returns only sounds saved by the user', async () => {
    savedSoundsCollection.set('user-1_snd-sample-1', {
      id: 'user-1_snd-sample-1',
      data: { userId: 'user-1', soundId: 'snd-sample-1' },
    });
    savedSoundsCollection.set('user-2_snd-sample-1', {
      id: 'user-2_snd-sample-1',
      data: { userId: 'user-2', soundId: 'snd-sample-1' },
    });
    const saved = await soundService.getSavedSounds('user-1');
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('snd-sample-1');
  });

  test('uploadCustomSound persists a new sound document', async () => {
    const uploaded = await soundService.uploadCustomSound({
      title: 'Test Audio Track',
      genre: 'Hyperpop',
      artist: 'Tester',
      creatorId: 'usr-tester',
    });
    expect(uploaded.id).toContain('snd-custom-');
    expect(uploaded.title).toBe('Test Audio Track');
    expect(uploaded.genre).toBe('Hyperpop');
    expect(soundsCollection.has(uploaded.id)).toBe(true);
  });

  test('uploadCustomSound rethrows when persistence fails', async () => {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    getFirestoreInstance.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      soundService.uploadCustomSound({ title: 'X', genre: 'Y' })
    ).rejects.toThrow('disk full');
  });
});
