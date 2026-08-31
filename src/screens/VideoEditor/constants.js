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

export const INITIAL_TRACKS = [
  { id: 'track_video_1', name: 'Video 1', type: 'video', visible: true, locked: false, icon: 'Video' },
  { id: 'track_video_2', name: 'Video 2', type: 'video', visible: true, locked: false, icon: 'Video' },
  { id: 'track_overlay', name: 'Overlay', type: 'overlay', visible: true, locked: false, icon: 'Layers' },
  { id: 'track_text', name: 'Text', type: 'text', visible: true, locked: false, icon: 'Type' },
  { id: 'track_audio_1', name: 'Audio 1', type: 'audio', visible: true, locked: false, icon: 'Music' },
  { id: 'track_audio_2', name: 'Audio 2', type: 'audio', visible: true, locked: false, icon: 'Mic' },
];

export const STOCK_VIDEOS = [];
// The stock-video library is intentionally EMPTY until a licensed media
// provider (e.g. Pexels/Pixabay API) is configured. Fabricated catalog
// entries with invented titles over third-party demo files were removed —
// never present media that does not exist.

export const STOCK_AUDIO = [];
// Same policy as STOCK_VIDEOS: no fake royalty-free catalog. The UI shows an
// honest empty state until a real licensed audio source is wired up.

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
