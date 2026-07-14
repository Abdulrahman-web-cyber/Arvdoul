// src/utils/videoUtils.js - ARVDOUL VIDEO UTILITIES
// Comprehensive utilities for video formatting, validation, and manipulation

/**
 * Format video duration from seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 * @example formatDuration(65) => "1:05"
 * @example formatDuration(3665) => "1:01:05"
 */
export const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format view count with K, M, B suffixes
 * @param {number} views - Number of views
 * @returns {string} Formatted view count
 * @example formatViewCount(1200) => "1.2K"
 * @example formatViewCount(3400000) => "3.4M"
 */
export const formatViewCount = (views) => {
  if (typeof views !== 'number' || isNaN(views)) {
    return '0';
  }

  if (views >= 1_000_000_000) {
    return `${(views / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return views.toString();
};

/**
 * Format like count with abbreviated suffixes
 * @param {number} likes - Number of likes
 * @returns {string} Formatted like count
 */
export const formatLikeCount = formatViewCount;

/**
 * Format comment count
 * @param {number} comments - Number of comments
 * @returns {string} Formatted comment count
 */
export const formatCommentCount = formatViewCount;

/**
 * Format share count
 * @param {number} shares - Number of shares
 * @returns {string} Formatted share count
 */
export const formatShareCount = formatViewCount;

/**
 * Get initials from a name (max 2 characters)
 * @param {string} name - Full name or display name
 * @returns {string} Initials (1-2 characters)
 * @example getInitials("John Doe") => "JD"
 * @example getInitials("Alice") => "AL"
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') {
    return '??';
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return '??';
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  
  return trimmed.substring(0, 2).toUpperCase();
};

/**
 * Generate a thumbnail URL from video ID
 * @param {string} videoId - Video document ID
 * @param {string} [size='small'] - Thumbnail size: 'small' | 'medium' | 'large'
 * @returns {string} Thumbnail URL
 */
export const generateThumbnail = (videoId, size = 'small') => {
  if (!videoId) return '';
  const sizeMap = {
    small: '150x150',
    medium: '320x180',
    large: '640x360',
  };
  return `https://picsum.photos/seed/${videoId}/${sizeMap[size] || sizeMap.small}`;
};

/**
 * Get video URL with quality parameter
 * @param {string} videoId - Video document ID
 * @param {string} [quality='auto'] - Quality: 'auto' | '1080p' | '720p' | '480p' | '360p' | '144p'
 * @returns {string} Video URL with quality
 */
export const getVideoUrl = (videoId, quality = 'auto') => {
  if (!videoId) return '';
  const baseUrl = `/api/videos/${videoId}/stream`;
  return quality === 'auto' ? baseUrl : `${baseUrl}?quality=${quality}`;
};

/**
 * Determine optimal playback quality based on network speed
 * @param {number} [downloadSpeed] - Download speed in Mbps
 * @returns {string} Recommended quality setting
 */
export const getPlaybackQuality = (downloadSpeed) => {
  if (!downloadSpeed || downloadSpeed < 0.5) return '360p';
  if (downloadSpeed < 1) return '480p';
  if (downloadSpeed < 2.5) return '720p';
  if (downloadSpeed < 5) return '1080p';
  return 'auto';
};

/**
 * Get prefetch strategy based on network speed
 * @param {number} [downloadSpeed] - Download speed in Mbps
 * @returns {Object} Prefetch configuration
 */
export const getPrefetchStrategy = (downloadSpeed) => {
  const quality = getPlaybackQuality(downloadSpeed);
  
  if (downloadSpeed < 0.5) {
    return { preloadCount: 1, bufferSize: 5, quality: '360p' };
  }
  if (downloadSpeed < 1) {
    return { preloadCount: 2, bufferSize: 10, quality: '480p' };
  }
  if (downloadSpeed < 2.5) {
    return { preloadCount: 3, bufferSize: 15, quality: '720p' };
  }
  return { preloadCount: 4, bufferSize: 20, quality: '1080p' };
};

/**
 * Format relative time from timestamp
 * @param {number|Date|string} timestamp - Timestamp to format
 * @returns {string} Relative time string
 * @example formatTimeAgo(Date.now() - 60000) => "1 minute ago"
 */
export const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};

/**
 * Format file size to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted file size
 * @example formatFileSize(1024) => "1 KB"
 */
export const formatFileSize = (bytes) => {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

/**
 * Generate share URL for video
 * @param {string} videoId - Video document ID
 * @param {string} [baseUrl] - Base URL of the app
 * @returns {string} Shareable URL
 */
export const generateShareUrl = (videoId, baseUrl = window.location.origin) => {
  if (!videoId) return baseUrl;
  return `${baseUrl}/videos/${videoId}`;
};

/**
 * Validate video file for upload
 * @param {File} file - File to validate
 * @param {Object} [options] - Validation options
 * @param {number} [options.maxSize] - Maximum file size in bytes
 * @param {string[]} [options.allowedTypes] - Allowed MIME types
 * @param {number} [options.maxDuration] - Maximum duration in seconds
 * @param {number} [options.minDuration] - Minimum duration in seconds
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export const validateVideoFile = (file, options = {}) => {
  const errors = [];
  const {
    maxSize = 200 * 1024 * 1024, // 200MB default
    allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    maxDuration = 3600, // 1 hour
    minDuration = 3, // 3 seconds
  } = options;

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file type
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const isValidType = allowedTypes.includes(file.type) || validExtensions.includes(fileExt);
  
  if (!isValidType) {
    errors.push(`Invalid file type. Allowed: ${validExtensions.join(', ')}`);
  }

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  return {
    valid: errors.length === 0,
    errors,
    details: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: fileExt,
    },
  };
};

/**
 * Compress video file (placeholder for FFmpeg integration)
 * @param {File} file - Video file to compress
 * @param {string} [quality='medium'] - Compression quality: 'low' | 'medium' | 'high'
 * @returns {Promise<File>} Compressed video file
 */
export const compressVideo = async (file, quality = 'medium') => {
  // This is a placeholder - actual implementation would use FFmpeg.wasm
  console.warn('Video compression not implemented - requires FFmpeg integration');
  return file;
};

/**
 * Extract audio from video file (placeholder)
 * @param {File} file - Video file
 * @returns {Promise<File>} Audio file
 */
export const extractAudio = async (file) => {
  // This is a placeholder - actual implementation would use FFmpeg.wasm
  console.warn('Audio extraction not implemented - requires FFmpeg integration');
  return null;
};

/**
 * Generate video chapters from metadata (placeholder)
 * @param {Object} video - Video metadata
 * @returns {Array} Array of chapter objects { time: number, title: string }
 */
export const detectChapters = (video) => {
  // Placeholder - would use AI analysis or video timestamps
  return [];
};

/**
 * Generate transcript from video (placeholder)
 * @param {string} videoId - Video document ID
 * @returns {Promise<string>} Transcript text
 */
export const generateTranscript = async (videoId) => {
  // Placeholder - would use speech-to-text service
  console.warn('Transcript generation not implemented');
  return '';
};

/**
 * Calculate video completion percentage
 * @param {number} currentTime - Current playback time in seconds
 * @param {number} duration - Total video duration in seconds
 * @returns {number} Completion percentage (0-100)
 */
export const getCompletionPercentage = (currentTime, duration) => {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.round((currentTime / duration) * 100));
};

/**
 * Check if video is completed (watched 90%+)
 * @param {number} currentTime - Current playback time
 * @param {number} duration - Total duration
 * @returns {boolean}
 */
export const isVideoCompleted = (currentTime, duration) => {
  return getCompletionPercentage(currentTime, duration) >= 90;
};

/**
 * Format watch time statistics
 * @param {number} seconds - Watch time in seconds
 * @returns {string} Formatted watch time
 */
export const formatWatchTime = (seconds) => {
  if (!seconds || seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Calculate average watch time from history
 * @param {Array} history - Watch history entries
 * @returns {number} Average watch time in seconds
 */
export const calculateAverageWatchTime = (history) => {
  if (!history || history.length === 0) return 0;
  const total = history.reduce((sum, entry) => sum + (entry.progress || 0), 0);
  return Math.round(total / history.length);
};

/**
 * Generate unique video element ID
 * @param {string} videoId - Video document ID
 * @returns {string} Unique element ID
 */
export const getVideoElementId = (videoId) => {
  return `video-player-${videoId}`;
};

/**
 * Check if device supports Picture-in-Picture
 * @returns {boolean}
 */
export const supportsPiP = () => {
  return 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
};

/**
 * Check if device supports AirPlay
 * @returns {boolean}
 */
export const supportsAirPlay = () => {
  return HTMLVideoElement.prototype.canPlayType?.('airplay') !== undefined;
};

/**
 * Get recommended video quality based on device
 * @returns {string} Recommended quality
 */
export const getRecommendedQuality = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  
  if (isMobile || isLowMemory) return '360p';
  return 'auto';
};

/**
 * ARVDOUL gradient for video UI elements
 */
export const ARVDOUL_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';

/**
 * Glass effect classes for video overlay components
 */
export const GLASS_CLASSES = {
  container: 'backdrop-blur-2xl bg-white/8 border border-white/12 rounded-3xl',
  button: 'backdrop-blur-xl bg-white/10 border border-white/10 rounded-2xl',
  input: 'backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl',
};

/**
 * Spring animation config for Framer Motion
 */
export const SPRING_ANIMATION = {
  card: { type: 'spring', damping: 20, stiffness: 300, mass: 0.8 },
  button: { type: 'spring', damping: 15, stiffness: 400, mass: 0.5 },
  bottomSheet: { type: 'spring', damping: 25, stiffness: 200, mass: 1 },
  like: { type: 'spring', damping: 10, stiffness: 500, mass: 0.3 },
};

/**
 * Playback speed options
 */
export const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 2.5, label: '2.5x' },
  { value: 3, label: '3x' },
];

/**
 * Quality options
 */
export const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: '1080p HD' },
  { value: '720p', label: '720p HD' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
  { value: '144p', label: '144p' },
];

/**
 * Sleep timer options
 */
export const SLEEP_TIMER_OPTIONS = [
  { value: 5 * 60, label: '5 minutes' },
  { value: 10 * 60, label: '10 minutes' },
  { value: 15 * 60, label: '15 minutes' },
  { value: 30 * 60, label: '30 minutes' },
  { value: 60 * 60, label: '1 hour' },
];

/**
 * Report reasons for video reporting
 */
export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'violence', label: 'Violence or harm' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
];
