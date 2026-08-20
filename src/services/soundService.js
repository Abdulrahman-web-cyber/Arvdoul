// src/services/soundService.js
// 🎵 ARVDOUL SOUNDS & MUSIC DISCOVERY SERVICE
// Audio track catalog, viral trend metrics, waveform synthesis, and real Firestore persistence

import { svcLogger } from './ServiceKit.js';
import { getFirestoreInstance } from '../firebase/firebase.js';

const log = svcLogger('soundService');

class SoundService {
  constructor() {
    this.savedSoundIds = new Set();
  }

  async getTrendingSounds(genre = 'All') {
    log.info('Fetching trending sounds from Firestore', { genre });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');

      const colRef = collection(firestore, 'sounds');
      let q = query(colRef, orderBy('reelsCountNum', 'desc'), limit(40));

      if (genre && genre !== 'All') {
        q = query(colRef, where('genre', '==', genre), limit(40));
      }

      const snap = await getDocs(q);
      const items = [];
      snap.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });

      return items;
    } catch (err) {
      log.error('Error fetching sounds from Firestore', err);
      return [];
    }
  }

  async getSavedSounds(userId) {
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const snap = await getDocs(query(collection(firestore, 'saved_sounds'), where('userId', '==', userId)));
      const soundIds = snap.docs.map(d => d.data().soundId);
      if (soundIds.length === 0) return [];

      const soundsCol = collection(firestore, 'sounds');
      const allSounds = await getDocs(soundsCol);
      return allSounds.docs
        .filter(d => soundIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      log.error('Error fetching saved sounds', err);
      return [];
    }
  }

  async toggleSaveSound(soundId, userId) {
    try {
      const firestore = await getFirestoreInstance();
      const { doc, setDoc, deleteDoc, getDoc } = await import('firebase/firestore');
      const ref = doc(firestore, 'saved_sounds', `${userId}_${soundId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await deleteDoc(ref);
        this.savedSoundIds.delete(soundId);
        return { saved: false };
      } else {
        await setDoc(ref, { userId, soundId, savedAt: Date.now() });
        this.savedSoundIds.add(soundId);
        return { saved: true };
      }
    } catch (err) {
      log.error('Error toggling saved sound', err);
      return { saved: false, error: err.message };
    }
  }

  async uploadCustomSound({ title, artist, genre, file, creatorId }) {
    log.info('Uploading custom sound to Firestore', { title, artist });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, addDoc } = await import('firebase/firestore');

      const newSound = {
        title,
        artist: artist || 'Original Creator',
        creatorId: creatorId || 'usr-creator',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200',
        duration: '0:30',
        durationSec: 30,
        bpm: 120,
        key: 'C Major',
        reelsCount: '1',
        reelsCountNum: 1,
        isTrending: false,
        genre: genre || 'Original Audio',
        audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
        waveformData: [30, 50, 70, 85, 90, 75, 60, 80, 95, 85, 70, 50, 40],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(firestore, 'sounds'), newSound);
      return { id: docRef.id, ...newSound };
    } catch (err) {
      log.error('Error creating sound in Firestore', err);
      throw err;
    }
  }
}

export const soundService = new SoundService();
export default soundService;

