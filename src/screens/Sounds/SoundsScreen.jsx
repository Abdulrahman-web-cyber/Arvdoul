// src/screens/Sounds/SoundsScreen.jsx
// 🎵 ARVDOUL SOUNDS & VIRAL MUSIC DISCOVERY HUB
// Viral audio tracks, real-time waveform playback, reels creation integration, and audio stem library

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Music, 
  Bookmark, 
  Share2, 
  Plus, 
  TrendingUp, 
  Sparkles, 
  Radio, 
  Video, 
  Sliders, 
  Volume2, 
  VolumeX, 
  Check, 
  Clock, 
  Flame,
  Search,
  Disc
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import soundService from '../../services/soundService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

const GENRES = ['All', 'Hyperpop', 'Lo-Fi / Chill', 'Cyberpunk', 'Afrobeat', 'Cinematic'];

export default function SoundsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [sounds, setSounds] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Audio Playback state
  const [currentSound, setCurrentSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('Original Audio');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadSounds();
  }, [selectedGenre]);

  const loadSounds = async () => {
    setLoading(true);
    try {
      const data = await soundService.getTrendingSounds(selectedGenre);
      setSounds(data);
      if (!currentSound && data.length > 0) {
        setCurrentSound(data[0]);
      }
      if (user?.uid) {
        const saved = await soundService.getSavedSounds(user.uid);
        setSavedIds(new Set(saved.map(s => s.id)));
      }
    } catch {
      toast.error('Failed to load audio library');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySound = (snd) => {
    if (currentSound?.id === snd.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentSound(snd);
      setIsPlaying(true);
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.src = snd.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleToggleSave = async (sndId) => {
    const userId = user?.uid || 'anon-user';
    const res = await soundService.toggleSaveSound(sndId, userId);
    setSavedIds(new Set(res.saved ? [...savedIds, sndId] : [...savedIds].filter(id => id !== sndId)));
    toast.success(res.saved ? 'Saved to your sound library! 🎧' : 'Removed from saved sounds');
  };

  const handleUseInReel = (snd) => {
    toast.success(`Opening Reel Creator with "${snd.title}"! 🎬`);
    navigate('/create-post', { state: { selectedAudio: snd } });
  };

  const handleOpenAudioEditor = (snd) => {
    navigate('/audio-editor', { state: { audioTrack: snd } });
  };

  const handleUploadAudio = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (!selectedFile) {
      toast.error('Select an audio file to upload');
      return;
    }
    if (!user?.uid) {
      toast.error('Sign in to upload a sound');
      return;
    }
    try {
      const uploaded = await soundService.uploadCustomSound({
        title: newTitle,
        genre: newGenre,
        creatorId: user.uid,
        artist: user.displayName || '',
        file: selectedFile
      });
      setSounds([uploaded, ...sounds]);
      setIsUploadOpen(false);
      setNewTitle('');
      setSelectedFile(null);
      toast.success('Original sound published to Arvdoul! 🚀');
    } catch {
      toast.error('Failed to upload audio');
    }
  };

  const filteredSounds = sounds.filter(s =>
    String(s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-36 pt-2 max-w-5xl mx-auto px-3 sm:px-6">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const cur = audioRef.current.currentTime;
            const dur = audioRef.current.duration || 30;
            setProgress((cur / dur) * 100);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Music & Sound Library</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Trending Creator Sounds <Disc className="w-6 h-6 text-purple-400 animate-spin" style={{ animationDuration: '8s' }} />
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Discover viral audio tracks, add music to your reels, mix waveforms, and publish original audio stems.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-500/25 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Upload Sound
        </button>
      </div>

      {/* Search & Genre Filters */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search sounds, artists, genres or BPM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none ${
              isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedGenre === g
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                  : isDark ? 'bg-gray-800/80 text-gray-400 hover:text-white' : 'bg-white text-gray-700 shadow-sm'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Sound List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          filteredSounds.map((snd, index) => {
            const isThisPlaying = currentSound?.id === snd.id && isPlaying;
            const isSaved = savedIds.has(snd.id);

            return (
              <div
                key={snd.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  currentSound?.id === snd.id
                    ? 'bg-purple-900/30 border-purple-500 shadow-lg shadow-purple-500/10'
                    : isDark ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                {/* Left Info */}
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-sm font-extrabold text-gray-500 w-5">{index + 1}</span>

                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 group cursor-pointer" onClick={() => handlePlaySound(snd)}>
                    {snd.coverUrl ? (
                      <img src={snd.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-700/70 to-blue-700/70 flex items-center justify-center">
                        <Music className="w-5 h-5 text-white/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
                      {isThisPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white truncate">{snd.title}</h3>
                      {snd.isTrending && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-extrabold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Viral
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{snd.artist || 'Unknown artist'} • {snd.genre || 'Audio'}</p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                      <span>⏱️ {snd.duration || '—'}</span>
                      {snd.bpm != null && <span>⚡️ {snd.bpm} BPM</span>}
                      <span>🎬 {snd.reelsCount || 0} Reels</span>
                    </div>
                  </div>
                </div>

                {/* Right Interactive Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleToggleSave(snd.id)}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isSaved
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : isDark ? 'border-gray-700 bg-gray-800 text-gray-400 hover:text-white' : 'border-gray-200'
                    }`}
                    title="Save Sound"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-purple-400' : ''}`} />
                  </button>

                  <button
                    onClick={() => handleOpenAudioEditor(snd)}
                    className="p-2.5 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1"
                    title="Open in Audio Editor"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleUseInReel(snd)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Video className="w-4 h-4" /> Use in Reel
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ==================== BOTTOM STICKY AUDIO PLAYER BAR ==================== */}
      {currentSound && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-3 sm:px-6">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gray-900/95 border border-purple-500/40 p-4 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {currentSound.coverUrl ? (
                <img src={currentSound.coverUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-700/70 to-blue-700/70 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-white/70" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-white truncate">{currentSound.title}</h4>
                <p className="text-[11px] text-gray-400 truncate">{currentSound.artist || 'Unknown artist'}</p>
              </div>
            </div>

            {/* Waveform Bar simulation */}
            <div className="flex-1 w-full flex items-center gap-3">
              <button
                onClick={() => handlePlaySound(currentSound)}
                className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg shadow-purple-600/40 shrink-0"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <div className="flex-1 flex items-center gap-1 h-6">
                {(currentSound.waveformData && currentSound.waveformData.length > 0
                  ? currentSound.waveformData
                  : [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
                ).map((barHeight, idx, arr) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all duration-200 ${
                      (idx / arr.length) * 100 <= progress
                        ? 'bg-purple-400'
                        : 'bg-gray-700'
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleUseInReel(currentSound)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Video className="w-3.5 h-3.5" /> Make Reel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== UPLOAD SOUND MODAL ==================== */}
      <AnimatePresence>
        {isUploadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} shadow-2xl space-y-4`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-purple-400" /> Upload Original Sound
                </h3>
                <button onClick={() => setIsUploadOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadAudio} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Track Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midnight Horizon Beat (Prod. by Me)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Genre / Mood</label>
                  <select
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                  >
                    {GENRES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Audio File</label>
                  <label className="p-6 border-2 border-dashed border-gray-700 rounded-2xl text-center space-y-2 block cursor-pointer hover:border-purple-500/60 transition-colors">
                    <Music className="w-8 h-8 text-purple-400 mx-auto" />
                    {selectedFile ? (
                      <p className="text-xs font-bold text-white break-all">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                    ) : (
                      <p className="text-xs font-bold text-white">Select MP3, WAV or AAC Audio File</p>
                    )}
                    <span className="text-[10px] text-gray-400 block">Max 25MB — the real file is uploaded to Storage; no demo audio is used</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > 25 * 1024 * 1024) {
                          toast.error('File exceeds 25MB limit');
                          setSelectedFile(null);
                          e.target.value = '';
                          return;
                        }
                        setSelectedFile(f);
                      }}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-xl shadow-purple-500/25 hover:opacity-95"
                >
                  🚀 Publish to Sound Library
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
