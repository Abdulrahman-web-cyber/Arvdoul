// src/screens/VideoEditor/constants.js - ARVDOUL VIDEO STUDIO CONSTANTS
// Presets, filters, stock media, transitions, and design tokens

export const RESOLUTION_PRESETS = [
  { id: '4k_16_9', name: '4K Ultra HD (16:9)', width: 3840, height: 2160, aspect: '16:9', label: 'Original 4K' },
  { id: '1080p_16_9', name: 'Full HD (16:9)', width: 1920, height: 1080, aspect: '16:9', label: '1080p HD' },
  { id: '720p_16_9', name: 'Standard HD (16:9)', width: 1280, height: 720, aspect: '16:9', label: '720p' },
  { id: 'reel_9_16', name: 'Reel / Story / TikTok (9:16)', width: 1080, height: 1920, aspect: '9:16', label: '9:16 Vertical' },
  { id: 'square_1_1', name: 'Square Feed (1:1)', width: 1080, height: 1080, aspect: '1:1', label: '1:1 Square' },
  { id: 'portrait_4_5', name: 'Portrait (4:5)', width: 1080, height: 1350, aspect: '4:5', label: '4:5 Portrait' },
  { id: 'cinema_21_9', name: 'Cinematic Widescreen (21:9)', width: 2560, height: 1080, aspect: '21:9', label: '21:9 Cinema' },
];

export const FILTERS_LIST = [
  { id: 'none', name: 'Original', css: '', thumbnail: 'bg-gradient-to-tr from-gray-700 to-gray-500' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.45) contrast(1.15) brightness(0.92) saturate(1.1)', thumbnail: 'bg-gradient-to-tr from-amber-700 to-yellow-500' },
  { id: 'bw', name: 'Film Noir', css: 'grayscale(1) contrast(1.35) brightness(0.95)', thumbnail: 'bg-gradient-to-tr from-gray-900 to-gray-400' },
  { id: 'warm', name: 'Warm Sunset', css: 'sepia(0.3) saturate(1.4) brightness(1.05) hue-rotate(-5deg)', thumbnail: 'bg-gradient-to-tr from-orange-600 to-amber-400' },
  { id: 'cool', name: 'Cool Glacier', css: 'saturate(1.05) hue-rotate(25deg) brightness(1.05)', thumbnail: 'bg-gradient-to-tr from-cyan-700 to-blue-400' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.25) saturate(1.15) brightness(0.95) sepia(0.18)', thumbnail: 'bg-gradient-to-tr from-teal-800 to-orange-500' },
  { id: 'vivid', name: 'Vivid Pop', css: 'saturate(1.6) contrast(1.2) brightness(1.02)', thumbnail: 'bg-gradient-to-tr from-fuchsia-600 to-purple-400' },
  { id: 'cyberpunk', name: 'Cyberpunk', css: 'hue-rotate(280deg) saturate(1.7) contrast(1.3)', thumbnail: 'bg-gradient-to-tr from-purple-700 to-cyan-400' },
  { id: 'dramatic', name: 'Dramatic', css: 'contrast(1.4) brightness(0.88) saturate(1.25)', thumbnail: 'bg-gradient-to-tr from-indigo-900 to-purple-600' },
  { id: 'sunset', name: 'Sunset Gold', css: 'saturate(1.5) sepia(0.5) brightness(1.1)', thumbnail: 'bg-gradient-to-tr from-rose-600 to-amber-500' },
  { id: 'emerald', name: 'Emerald', css: 'hue-rotate(70deg) saturate(1.3) contrast(1.1)', thumbnail: 'bg-gradient-to-tr from-emerald-800 to-teal-400' },
  { id: 'noir', name: 'Monochrome', css: 'grayscale(0.9) contrast(1.5)', thumbnail: 'bg-gradient-to-tr from-zinc-800 to-zinc-500' },
];

export const TRANSITIONS_LIST = [
  { id: 'none', name: 'None', icon: 'Minus' },
  { id: 'fade', name: 'Fade to Black', icon: 'Sun' },
  { id: 'crossfade', name: 'Cross Dissolve', icon: 'Blend' },
  { id: 'slide_left', name: 'Slide Left', icon: 'ArrowLeft' },
  { id: 'slide_right', name: 'Slide Right', icon: 'ArrowRight' },
  { id: 'slide_up', name: 'Slide Up', icon: 'ArrowUp' },
  { id: 'slide_down', name: 'Slide Down', icon: 'ArrowDown' },
  { id: 'zoom_in', name: 'Zoom In', icon: 'ZoomIn' },
  { id: 'zoom_out', name: 'Zoom Out', icon: 'ZoomOut' },
  { id: 'wipe_left', name: 'Wipe Left', icon: 'MoveLeft' },
  { id: 'flash', name: 'White Flash', icon: 'Zap' },
  { id: 'glitch', name: 'Digital Glitch', icon: 'Tv' },
];

export const EFFECTS_LIST = [
  { id: 'none', name: 'None', desc: 'No special effect' },
  { id: 'vhs', name: 'VHS Tape', desc: 'Retro scanlines & chromatic aberration' },
  { id: 'grain', name: 'Film Grain', desc: 'Cinematic 35mm film texture' },
  { id: 'rgb_split', name: 'RGB Split', desc: 'Dynamic color channel dispersion' },
  { id: 'light_leak', name: 'Light Leak', desc: 'Warm vintage lens flare' },
  { id: 'vignette', name: 'Vignette', desc: 'Darkened cinematic border edges' },
  { id: 'glow', name: 'Neon Glow', desc: 'Dreamy soft bloom highlight' },
  { id: 'mirror', name: 'Mirror Kaleido', desc: 'Symmetrical reflection' },
  { id: 'pixelate', name: 'Pixel Art', desc: '8-bit retro downsampling' },
];

export const FONT_LIST = [
  { id: 'Plus Jakarta Sans', name: 'Jakarta (Modern)' },
  { id: 'Inter', name: 'Inter (Clean)' },
  { id: 'Montserrat', name: 'Montserrat (Bold)' },
  { id: 'Playfair Display', name: 'Playfair (Elegant Serif)' },
  { id: 'Bebas Neue', name: 'Bebas (Cinematic Title)' },
  { id: 'Impact', name: 'Impact (Meme/Punchy)' },
  { id: 'Poppins', name: 'Poppins (Friendly)' },
  { id: 'Cinzel', name: 'Cinzel (Luxury)' },
];

export const STICKER_CATEGORIES = [
  {
    id: 'emojis',
    name: 'Emojis',
    items: ['🔥', '✨', '❤️', '⭐', '🚀', '💯', '👑', '🎬', '🎵', '🌊', '🏔️', '🎧', '⚡', '💎', '🎯', '🏆', '😍', '🤩', '🙌', '😎', '💥', '🌈', '🎉', '💡']
  },
  {
    id: 'badges',
    name: 'Badges',
    items: ['NEW', 'LIVE', '4K', 'HDR', 'PRO', 'TOP 1', 'TRENDING', 'VIRAL', 'VIP', 'OFFICIAL']
  },
  {
    id: 'shapes',
    name: 'Shapes',
    items: ['●', '■', '▲', '★', '♦', '✦', '➔', '➜', '✔', '✖', '❤', '⚡']
  }
];

export const SAMPLE_PROJECT_MEDIA = {
  video1: {
    id: 'clip_vid_1',
    title: 'Video Clip 1.mp4',
    trackId: 'track_video_1',
    trackName: 'Video 1',
    type: 'video',
    startTime: 2.4, // seconds
    duration: 26.1, // seconds
    trimStart: 2.4,
    trimEnd: 28.5,
    speed: 1.0,
    volume: 1.0,
    opacity: 1.0,
    filter: 'cinematic',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    fxBadge: 'fx',
  },
  video2: {
    id: 'clip_vid_2',
    title: 'Video Clip 2.mp4',
    trackId: 'track_video_2',
    trackName: 'Video 2',
    type: 'video',
    startTime: 20.0,
    duration: 35.0,
    trimStart: 0,
    trimEnd: 35.0,
    speed: 1.0,
    volume: 0.8,
    opacity: 0.9,
    filter: 'none',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=600&q=80',
    fxBadge: null,
  },
  overlay: {
    id: 'clip_overlay_1',
    title: 'Gradient Overlay.png',
    trackId: 'track_overlay',
    trackName: 'Overlay',
    type: 'overlay',
    startTime: 12.0,
    duration: 25.0,
    opacity: 0.85,
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(59,130,246,0.3))',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    fxBadge: 'fx',
  },
  text1: {
    id: 'clip_text_1',
    title: 'Explore More',
    text: 'Explore More',
    trackId: 'track_text',
    trackName: 'Text',
    type: 'text',
    startTime: 10.0,
    duration: 15.0,
    x: 50,
    y: 78,
    fontSize: 32,
    fontFamily: 'Plus Jakarta Sans',
    color: '#ffffff',
    bgColor: 'rgba(16,185,129,0.25)',
    borderColor: 'rgba(52,211,153,0.6)',
    animation: 'fade',
  },
  text2: {
    id: 'clip_text_2',
    title: 'Adventure Awaits',
    text: 'Adventure Awaits',
    trackId: 'track_text',
    trackName: 'Text',
    type: 'text',
    startTime: 28.0,
    duration: 18.0,
    x: 50,
    y: 82,
    fontSize: 28,
    fontFamily: 'Plus Jakarta Sans',
    color: '#ffffff',
    bgColor: 'rgba(16,185,129,0.25)',
    borderColor: 'rgba(52,211,153,0.6)',
    animation: 'slide',
  },
  audio1: {
    id: 'clip_audio_1',
    title: 'Energetic Pop Beat.mp3',
    trackId: 'track_audio_1',
    trackName: 'Audio 1',
    type: 'audio',
    startTime: 0,
    duration: 65.0,
    volume: 0.85,
    fadeIn: 1.0,
    fadeOut: 1.5,
    color: '#10b981',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=summer-tropical-beat-112199.mp3',
    fxBadge: 'fx',
  },
  audio2: {
    id: 'clip_audio_2',
    title: 'Voice Over.wav',
    trackId: 'track_audio_2',
    trackName: 'Audio 2',
    type: 'audio',
    startTime: 5.0,
    duration: 45.0,
    volume: 1.0,
    fadeIn: 0.5,
    fadeOut: 0.5,
    color: '#3b82f6',
    url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_88447e769f.mp3?filename=voice-clip-14022.mp3',
    fxBadge: 'fx',
  }
};

export const INITIAL_TRACKS = [
  { id: 'track_video_1', name: 'Video 1', type: 'video', visible: true, locked: false, icon: 'Video' },
  { id: 'track_video_2', name: 'Video 2', type: 'video', visible: true, locked: false, icon: 'Video' },
  { id: 'track_overlay', name: 'Overlay', type: 'overlay', visible: true, locked: false, icon: 'Layers' },
  { id: 'track_text', name: 'Text', type: 'text', visible: true, locked: false, icon: 'Type' },
  { id: 'track_audio_1', name: 'Audio 1', type: 'audio', visible: true, locked: false, icon: 'Music' },
  { id: 'track_audio_2', name: 'Audio 2', type: 'audio', visible: true, locked: false, icon: 'Mic' },
];

export const INITIAL_LAYERS = [
  { id: 'layer_1', title: 'Video Clip 1', type: 'video', durationText: '00:28', durationSec: 28, visible: true, locked: false, opacity: 100, thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=160&q=80', clipId: 'clip_vid_1' },
  { id: 'layer_2', title: 'Video Clip 2', type: 'video', durationText: '00:35', durationSec: 35, visible: true, locked: false, opacity: 90, thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=160&q=80', clipId: 'clip_vid_2' },
  { id: 'layer_3', title: 'Text Layer', type: 'text', durationText: '00:05', durationSec: 5, visible: true, locked: false, opacity: 100, icon: 'Type', clipId: 'clip_text_1' },
  { id: 'layer_4', title: 'Overlay', type: 'overlay', durationText: '00:07', durationSec: 7, visible: true, locked: false, opacity: 85, thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=160&q=80', clipId: 'clip_overlay_1' },
  { id: 'layer_5', title: 'Sticker', type: 'sticker', durationText: '00:03', durationSec: 3, visible: true, locked: false, opacity: 100, icon: 'Star', clipId: null },
  { id: 'layer_6', title: 'Adjustment', type: 'adjustment', durationText: '00:45', durationSec: 45, visible: true, locked: false, opacity: 100, icon: 'Sliders', clipId: null },
  { id: 'layer_7', title: 'Music', type: 'audio', durationText: '01:45', durationSec: 105, visible: true, locked: false, opacity: 100, icon: 'Music', clipId: 'clip_audio_1' },
];

export const STOCK_VIDEOS = [
  {
    id: 'stock_1',
    title: 'Sunset Mountain Peak',
    category: 'Nature',
    duration: 28,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'stock_2',
    title: 'Cinematic Ocean Waves',
    category: 'Nature',
    duration: 35,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'stock_3',
    title: 'Neon Cyber City Skyline',
    category: 'Urban',
    duration: 24,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'stock_4',
    title: 'High Altitude Drone Flight',
    category: 'Aerial',
    duration: 30,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80'
  }
];

export const STOCK_AUDIO = [
  { id: 'audio_pop', title: 'Energetic Pop Beat', duration: '01:45', bpm: 124, genre: 'Electronic / Pop', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=summer-tropical-beat-112199.mp3' },
  { id: 'audio_chill', title: 'Midnight Chill Lo-Fi', duration: '02:10', bpm: 85, genre: 'Lo-Fi / Hip Hop', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3' },
  { id: 'audio_epic', title: 'Cinematic Epic Horizon', duration: '01:58', bpm: 110, genre: 'Orchestral / Film', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=epic-cinematic-trailer-111158.mp3' },
  { id: 'audio_upbeat', title: 'Vibrant Dance Groove', duration: '01:30', bpm: 128, genre: 'Dance / House', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_73229b47e2.mp3?filename=upbeat-dance-pop-112204.mp3' },
];

/**
 * Format total seconds to HH:MM:SS:FF or MM:SS:FF
 */
export function formatTimecode(totalSeconds, fps = 30) {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * fps);
  
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Format seconds to standard MM:SS
 */
export function formatMinutesSeconds(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}
