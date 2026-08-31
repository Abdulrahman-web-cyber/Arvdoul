// src/lib/searchUtils.jsx - ARVDOUL Search Utilities
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export cn from utils
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Debounce function execution
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function executedFunction(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function execution
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Highlight matching text with mark tags
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {React.ReactNode} Highlighted text
 */
export function highlightText(text, query) {
  if (!query || !text) return text;
  
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i} className="bg-gradient-to-r from-[#B416DB]/20 via-[#872FE2]/20 to-[#4B6BFF]/20 text-transparent bg-clip-text">{part}</mark>
      : part
  );
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format search result for display
 * @param {Object} result - Raw result object
 * @returns {Object} Formatted result
 */
export function formatResult(result) {
  return {
    id: result.id || result.objectID,
    type: result.type,
    title: result.displayName || result.title || result.content?.slice(0, 50) || 'Untitled',
    subtitle: result.bio || result.description || result.username || '',
    image: result.photoURL || result.thumbnail || result.mediaUrl || null,
    verified: result.isVerified || false,
    followers: result.followers || result.followerCount || 0,
    posts: result.postCount || result.posts || 0,
    views: result.viewCount || result.views || 0,
    likes: result.likeCount || result.likes || 0,
    score: result.score || 0,
  };
}

/**
 * Get icon component for result type
 * @param {string} type - Result type
 * @returns {string} Icon name
 */
export function getResultIcon(type) {
  const icons = {
    user: 'User',
    users: 'User',
    people: 'Users',
    post: 'FileText',
    posts: 'FileText',
    video: 'Video',
    videos: 'Video',
    image: 'Image',
    images: 'Image',
    community: 'Users',
    communities: 'Users',
    live: 'Radio',
    event: 'Calendar',
    poll: 'BarChart2',
    question: 'HelpCircle',
    hashtag: 'Hash',
    audio: 'Music',
    place: 'MapPin',
    all: 'Search',
  };
  return icons[type?.toLowerCase()] || 'Search';
}

/**
 * Get accent color for result type
 * @param {string} type - Result type
 * @returns {string} Color class
 */
export function getResultColor(type) {
  const colors = {
    user: 'from-blue-400 to-cyan-400',
    users: 'from-blue-400 to-cyan-400',
    people: 'from-blue-400 to-cyan-400',
    post: 'from-purple-400 to-pink-400',
    posts: 'from-purple-400 to-pink-400',
    video: 'from-red-400 to-orange-400',
    videos: 'from-red-400 to-orange-400',
    image: 'from-green-400 to-emerald-400',
    images: 'from-green-400 to-emerald-400',
    community: 'from-yellow-400 to-amber-400',
    communities: 'from-yellow-400 to-amber-400',
    live: 'from-red-500 to-rose-500',
    event: 'from-indigo-400 to-violet-400',
    poll: 'from-teal-400 to-cyan-400',
    question: 'from-orange-400 to-red-400',
    hashtag: 'from-pink-400 to-rose-400',
    audio: 'from-violet-400 to-purple-400',
    place: 'from-emerald-400 to-green-400',
  };
  return colors[type?.toLowerCase()] || 'from-[#B416DB] to-[#4B6BFF]';
}

/**
 * Format large numbers for display
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatCount(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Normalize search query
 * @param {string} query - Raw query
 * @returns {string} Normalized query
 */
export function normalizeQuery(query) {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Check if query is valid for search
 * @param {string} query - Search query
 * @returns {boolean} Is valid
 */
export function isValidQuery(query) {
  return query && query.trim().length >= 2;
}

/**
 * Parse search category
 * @param {string} tab - Tab identifier
 * @returns {string} Normalized category
 */
export function parseCategory(tab) {
  const categoryMap = {
    all: 'all',
    people: 'users',
    videos: 'videos',
    posts: 'posts',
    images: 'images',
    communities: 'communities',
    live: 'live',
    events: 'events',
    polls: 'polls',
    questions: 'questions',
    hashtags: 'hashtags',
    audio: 'audio',
    places: 'places',
  };
  return categoryMap[tab] || tab;
}

/**
 * Create AbortController for request cancellation
 * @returns {AbortController} Controller instance
 */
export function createAbortController() {
  return new AbortController();
}

export default {
  debounce,
  throttle,
  highlightText,
  formatResult,
  getResultIcon,
  getResultColor,
  formatCount,
  normalizeQuery,
  isValidQuery,
  parseCategory,
  createAbortController,
};
