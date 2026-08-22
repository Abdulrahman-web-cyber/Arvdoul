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
      const { collection, getDocs, query, where, limit } = await import('firebase/firestore');
      const snap = await getDocs(query(
        collection(firestore, 'saved_sounds'),
        where('userId', '==', userId),
        limit(200)
      ));
      const soundIds = snap.docs.map(d => d.data().soundId);
      if (soundIds.length === 0) return [];

      // Batched by-id fetch (chunks of 30) — NEVER a full collection scan.
      const { doc, getDoc } = await import('firebase/firestore');
      const sounds = [];
      for (let i = 0; i < soundIds.length; i += 30) {
        const chunk = soundIds.slice(i, i + 30);
        const results = await Promise.allSettled(
          chunk.map(id => getDoc(doc(firestore, 'sounds', id)))
        );
        results.forEach((r, j) => {
          if (r.status === 'fulfilled' && r.value.exists()) {
            sounds.push({ id: chunk[j], ...r.value.data() });
          }
        });
      }
      return sounds;
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

  /**
   * REAL custom-sound upload: the file is uploaded to Firebase Storage and
   * the Firestore record stores the real download URL, the real duration and
   * a REAL waveform decoded from the audio bytes. No demo URLs, no invented
   * BPM/key/plays — unavailable metadata stays null and counts start at 0.
   */
  async uploadCustomSound({ title, artist, genre, file, creatorId }) {
    if (!file) throw new Error('No audio file provided');
    if (!creatorId) throw new Error('Sign in to upload a sound');
    log.info('Uploading custom sound', { title, artist, size: file.size });

    const { getStorageInstance } = await import('../firebase/firebase.js');
    const storage = await getStorageInstance();
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const firestore = await getFirestoreInstance();

    // 1. Upload the real file to Storage.
    const ext = (file.name?.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || 'mp3';
    const storageRef = ref(storage, `sounds/${creatorId}/${Date.now()}-${title.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'sound'}.${ext}`);
    await uploadBytes(storageRef, file);
    const audioUrl = await getDownloadURL(storageRef);

    // 2. Real duration + real waveform from the actual bytes (best-effort).
    let durationSec = null;
    let duration = null;
    let waveformData = null;
    try {
      const arrayBuf = await file.arrayBuffer();
      if (typeof window !== 'undefined' && window.OfflineAudioContext) {
        const ctx = new OfflineAudioContext(1, 1, 44100);
        const decoded = await ctx.decodeAudioData(arrayBuf);
        durationSec = decoded.duration;
        duration = `${Math.floor(decoded.duration / 60)}:${String(Math.floor(decoded.duration % 60)).padStart(2, '0')}`;
        const channel = decoded.getChannelData(0);
        const buckets = 13;
        const perBucket = Math.max(1, Math.floor(channel.length / buckets));
        const peaks = [];
        for (let i = 0; i < buckets; i++) {
          let peak = 0;
          for (let j = 0; j < perBucket; j++) {
            const v = Math.abs(channel[i * perBucket + j] || 0);
            if (v > peak) peak = v;
          }
          peaks.push(Math.max(4, Math.min(100, Math.round(peak * 100))));
        }
        waveformData = peaks;
      }
    } catch (err) {
      log.warn('Could not decode audio metadata (duration/waveform omitted):', err.message);
    }

    const newSound = {
      title: title || file.name || 'Untitled sound',
      artist: artist || '',
      creatorId,
      coverUrl: null,
      duration,
      durationSec,
      bpm: null,
      key: null,
      reelsCount: '0',
      reelsCountNum: 0,
      isTrending: false,
      genre: genre || 'Original Audio',
      audioUrl,
      waveformData,
      storagePath: storageRef.fullPath,
      createdAt: new Date().toISOString(),
      createdAtTS: serverTimestamp()
    };

    const docRef = await addDoc(collection(firestore, 'sounds'), newSound);
    return { id: docRef.id, ...newSound };
  }
}

export const soundService = new SoundService();
export default soundService;

