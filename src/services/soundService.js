// src/services/soundService.js
// 🎵 ARVDOUL SOUNDS & MUSIC DISCOVERY SERVICE
// Audio track catalog, viral trend metrics, waveform synthesis, and reel integration

import { svcLogger } from './ServiceKit.js';

const log = svcLogger('soundService');

const TRENDING_SOUNDS = [
  {
    id: 'snd-neon-pulse',
    title: 'Neon Pulse (Hyperpop Edit)',
    artist: 'Luna Nova & K-Synthetics',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200',
    duration: '0:28',
    durationSec: 28,
    bpm: 142,
    key: 'F# Minor',
    reelsCount: '1.4M',
    isTrending: true,
    genre: 'Hyperpop / Synth',
    audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    waveformData: [12, 45, 68, 89, 95, 76, 54, 88, 92, 100, 85, 60, 42, 65, 80, 94, 70, 50, 65, 90, 85, 40]
  },
  {
    id: 'snd-tokyo-rain',
    title: 'Midnight in Tokyo (Lofi Study)',
    artist: 'ChillHop Collective',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200',
    duration: '0:45',
    durationSec: 45,
    bpm: 82,
    key: 'C Major',
    reelsCount: '890K',
    isTrending: true,
    genre: 'Lo-Fi / Chill',
    audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3',
    waveformData: [20, 30, 45, 50, 48, 52, 60, 58, 62, 65, 55, 50, 45, 40, 38, 42, 45, 50, 48, 35]
  },
  {
    id: 'snd-cyber-rush',
    title: 'Cyberpunk Overdrive',
    artist: 'Vektor 99',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200',
    duration: '0:34',
    durationSec: 34,
    bpm: 128,
    key: 'A Minor',
    reelsCount: '2.1M',
    isTrending: true,
    genre: 'Cyberpunk / EDM',
    audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3',
    waveformData: [30, 60, 90, 100, 95, 80, 70, 95, 100, 85, 75, 90, 100, 95, 80, 60, 75, 95, 90, 70]
  },
  {
    id: 'snd-lagos-groove',
    title: 'Lagos Sunsets (Afro Rhythm)',
    artist: 'Bayo & The Vibez',
    coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
    duration: '0:30',
    durationSec: 30,
    bpm: 106,
    key: 'G Major',
    reelsCount: '640K',
    isTrending: false,
    genre: 'Afrobeat',
    audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
    waveformData: [25, 40, 65, 80, 75, 85, 90, 78, 82, 88, 70, 60, 75, 85, 90, 80, 70, 65, 50, 40]
  },
  {
    id: 'snd-cinematic-horizon',
    title: 'Beyond the Stars (Epic Strings)',
    artist: 'Arvdoul Symphony Orch.',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=200',
    duration: '1:00',
    durationSec: 60,
    bpm: 90,
    key: 'D Minor',
    reelsCount: '410K',
    isTrending: false,
    genre: 'Cinematic / Film',
    audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-valley-sunset-127.mp3',
    waveformData: [15, 20, 35, 50, 65, 80, 95, 100, 90, 85, 75, 60, 50, 65, 80, 90, 85, 70, 55, 30]
  }
];

class SoundService {
  constructor() {
    this.sounds = [...TRENDING_SOUNDS];
    this.savedSoundIds = new Set(['snd-neon-pulse', 'snd-cyber-rush']);
  }

  async getTrendingSounds(genre = 'All') {
    log.info('Fetching trending sounds', { genre });
    await new Promise(r => setTimeout(r, 200));
    if (genre === 'All') return this.sounds;
    return this.sounds.filter(s => s.genre.toLowerCase().includes(genre.toLowerCase()));
  }

  async getSavedSounds() {
    return this.sounds.filter(s => this.savedSoundIds.has(s.id));
  }

  async toggleSaveSound(soundId) {
    if (this.savedSoundIds.has(soundId)) {
      this.savedSoundIds.delete(soundId);
      return { saved: false };
    } else {
      this.savedSoundIds.add(soundId);
      return { saved: true };
    }
  }

  async uploadCustomSound({ title, artist, genre, file }) {
    log.info('Uploading custom sound', { title, artist });
    const newSound = {
      id: `snd-custom-${Date.now()}`,
      title,
      artist: artist || 'Original Creator',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200',
      duration: '0:30',
      durationSec: 30,
      bpm: 120,
      key: 'C Major',
      reelsCount: '1',
      isTrending: false,
      genre: genre || 'Original Audio',
      audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
      waveformData: [30, 50, 70, 85, 90, 75, 60, 80, 95, 85, 70, 50, 40]
    };
    this.sounds.unshift(newSound);
    return newSound;
  }
}

export const soundService = new SoundService();
export default soundService;
