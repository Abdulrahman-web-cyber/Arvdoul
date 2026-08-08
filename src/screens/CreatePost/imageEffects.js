// src/screens/CreatePost/imageEffects.js - ARVDOUL Image Effects & Canvas Utilities
// High-performance offscreen canvas image processing

import { PERFORMANCE } from './editorConstants';

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create a canvas element with the given dimensions
 */
export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Create an offscreen canvas for processing
 */
export function createOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  return createCanvas(width, height);
}

/**
 * Load an image from various sources (URL, File, Blob, ImageBitmap)
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) {
      if (source.complete && source.naturalWidth > 0) {
        resolve(source);
      } else {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = source.src;
      }
      return;
    }

    if (source instanceof ImageBitmap) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      const canvas = createCanvas(source.width, source.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0);
      img.src = canvas.toDataURL();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (source instanceof File || source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else if (typeof source === 'string') {
      img.src = source;
    } else {
      reject(new Error('Invalid image source'));
    }
  });
}

/**
 * Load image and revoke object URL after loading
 */
export async function loadImageSafe(source) {
  let objectUrl = null;
  try {
    if (source instanceof File || source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      const img = await loadImage(objectUrl);
      return img;
    }
    return await loadImage(source);
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Convert image to canvas
 */
export function imageToCanvas(img) {
  const canvas = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Get image data from canvas
 */
export function getImageData(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert canvas to blob
 */
export function canvasToBlob(canvas, type = 'image/png', quality = PERFORMANCE.EXPORT_QUALITY) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * Convert canvas to data URL
 */
export function canvasToDataURL(canvas, type = 'image/png', quality = PERFORMANCE.EXPORT_QUALITY) {
  return canvas.toDataURL(type, quality);
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== ADJUSTMENT FUNCTIONS ====================

/**
 * Build CSS filter string from adjustments
 */
export function buildFilterString(adjustments) {
  const filters = [];
  
  const brightness = adjustments.brightness ?? 100;
  if (brightness !== 100) {
    filters.push(`brightness(${brightness}%)`);
  }
  
  const contrast = adjustments.contrast ?? 100;
  if (contrast !== 100) {
    filters.push(`contrast(${contrast}%)`);
  }
  
  const saturation = adjustments.saturation ?? 100;
  if (saturation !== 100) {
    filters.push(`saturate(${saturation}%)`);
  }
  
  const hue = adjustments.hue ?? 0;
  if (hue !== 0) {
    filters.push(`hue-rotate(${hue}deg)`);
  }
  
  const blur = adjustments.blur ?? 0;
  if (blur > 0) {
    filters.push(`blur(${blur}px)`);
  }
  
  const saturate = adjustments.saturate ?? 100;
  if (saturate !== 100) {
    filters.push(`saturate(${saturate}%)`);
  }
  
  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Apply adjustments to canvas using pixel manipulation
 */
export function applyAdjustmentsToCanvas(canvas, adjustments) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const brightness = (adjustments.brightness ?? 100) / 100;
  const contrast = (adjustments.contrast ?? 100) / 100;
  const saturation = (adjustments.saturation ?? 100) / 100;
  const exposure = ((adjustments.exposure ?? 0) + 100) / 100;
  const temperature = (adjustments.temperature ?? 0) / 100;
  const tint = (adjustments.tint ?? 0) / 100;
  const gamma = 100 / (adjustments.gamma ?? 100);
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Apply exposure
    r *= exposure;
    g *= exposure;
    b *= exposure;
    
    // Apply temperature (warm/cool)
    r += temperature * 30;
    b -= temperature * 30;
    
    // Apply tint
    g += tint * 20;
    
    // Apply brightness
    r *= brightness;
    g *= brightness;
    b *= brightness;
    
    // Apply contrast
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;
    
    // Apply gamma
    r = Math.pow(r / 255, gamma) * 255;
    g = Math.pow(g / 255, gamma) * 255;
    b = Math.pow(b / 255, gamma) * 255;
    
    // Apply saturation
    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    r = gray + saturation * (r - gray);
    g = gray + saturation * (g - gray);
    b = gray + saturation * (b - gray);
    
    // Clamp values
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ==================== FILTER FUNCTIONS ====================

/**
 * Parse filter string and extract values
 */
export function parseFilterString(filterStr) {
  if (!filterStr || filterStr === 'none') return null;
  
  const result = {};
  const parts = filterStr.match(/(\w+)\(([^)]+)\)/g) || [];
  
  for (const part of parts) {
    const match = part.match(/(\w+)\(([^)]+)\)/);
    if (match) {
      const [, name, value] = match;
      result[name] = value;
    }
  }
  
  return result;
}

/**
 * Apply CSS filter to canvas via temporary image
 */
export function applyFilterToCanvas(canvas, filterStr) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Create a temporary canvas for filtering
  const tempCanvas = createCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);
  
  // Create a new canvas with the filter applied
  const filteredCanvas = createCanvas(canvas.width, canvas.height);
  const filteredCtx = filteredCanvas.getContext('2d');
  
  // Create an image from the temp canvas and apply filter
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      filteredCtx.filter = filterStr;
      filteredCtx.drawImage(img, 0, 0);
      resolve(filteredCanvas);
    };
    img.src = canvasToDataURL(tempCanvas);
  });
}

// ==================== CROP & TRANSFORM ====================

/**
 * Crop canvas to specified area
 */
export function cropCanvas(canvas, cropArea) {
  const { x, y, width, height } = cropArea;
  const croppedCanvas = createCanvas(width, height);
  const ctx = croppedCanvas.getContext('2d');
  ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return croppedCanvas;
}

/**
 * Rotate canvas by angle (in degrees)
 */
export function rotateCanvas(canvas, angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  
  const newWidth = Math.round(canvas.width * cos + canvas.height * sin);
  const newHeight = Math.round(canvas.width * sin + canvas.height * cos);
  
  const rotatedCanvas = createCanvas(newWidth, newHeight);
  const ctx = rotatedCanvas.getContext('2d');
  
  // Translate to center and rotate
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return rotatedCanvas;
}

/**
 * Flip canvas horizontally
 */
export function flipCanvasH(canvas) {
  const flippedCanvas = createCanvas(canvas.width, canvas.height);
  const ctx = flippedCanvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return flippedCanvas;
}

/**
 * Flip canvas vertically
 */
export function flipCanvasV(canvas) {
  const flippedCanvas = createCanvas(canvas.width, canvas.height);
  const ctx = flippedCanvas.getContext('2d');
  ctx.translate(0, canvas.height);
  ctx.scale(1, -1);
  ctx.drawImage(canvas, 0, 0);
  return flippedCanvas;
}

/**
 * Resize canvas with quality options
 */
export function resizeCanvas(canvas, width, height, quality = 'high') {
  const resizedCanvas = createCanvas(width, height);
  const ctx = resizedCanvas.getContext('2d');
  
  if (quality === 'high') {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  } else if (quality === 'medium') {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
  } else {
    ctx.imageSmoothingEnabled = false;
  }
  
  ctx.drawImage(canvas, 0, 0, width, height);
  return resizedCanvas;
}

// ==================== COMPOSITING ====================

/**
 * Draw image with adjustments on canvas
 */
export function drawImageWithAdjustments(canvas, img, adjustments = {}, filterStr = 'none') {
  const ctx = canvas.getContext('2d');
  
  // Set filter if not already applied
  if (filterStr !== 'none') {
    ctx.filter = filterStr;
  }
  
  // Apply basic CSS filters
  const brightness = adjustments.brightness ?? 100;
  const contrast = adjustments.contrast ?? 100;
  const saturation = adjustments.saturation ?? 100;
  
  if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
    ctx.filter = [
      brightness !== 100 && `brightness(${brightness}%)`,
      contrast !== 100 && `contrast(${contrast}%)`,
      saturation !== 100 && `saturate(${saturation}%)`,
    ].filter(Boolean).join(' ');
    
    if (filterStr !== 'none') {
      ctx.filter = filterStr;
    }
  }
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  
  return canvas;
}

// ==================== EXPORT FUNCTIONS ====================

/**
 * Export canvas as blob with quality settings
 */
export async function exportCanvas(canvas, options = {}) {
  const {
    type = 'image/png',
    quality = PERFORMANCE.EXPORT_QUALITY,
    filename = 'image.png',
  } = options;
  
  const blob = await canvasToBlob(canvas, type, quality);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename,
    width: canvas.width,
    height: canvas.height,
    size: blob.size,
  };
}

/**
 * Export canvas as data URL
 */
export function exportCanvasAsDataURL(canvas, options = {}) {
  const { type = 'image/png', quality = PERFORMANCE.EXPORT_QUALITY } = options;
  return canvasToDataURL(canvas, type, quality);
}

/**
 * Download canvas as file
 */
export async function downloadCanvas(canvas, filename = 'image.png', type = 'image/png') {
  const { url, blob } = await exportCanvas(canvas, { type, filename });
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
  
  return blob;
}

// ==================== THUMBNAIL GENERATION ====================

/**
 * Generate thumbnail from canvas
 */
export function generateThumbnail(canvas, maxSize = PERFORMANCE.THUMBNAIL_SIZE) {
  const { width, height } = canvas;
  const ratio = Math.min(maxSize / width, maxSize / height);
  
  if (ratio >= 1) {
    return canvasToDataURL(canvas, 'image/jpeg', 0.7);
  }
  
  const thumbCanvas = resizeCanvas(canvas, Math.round(width * ratio), Math.round(height * ratio), 'medium');
  return canvasToDataURL(thumbCanvas, 'image/jpeg', 0.7);
}

/**
 * Generate thumbnails for filters preview
 */
export function generateFilterPreviews(canvas, filters, thumbnailSize = 80) {
  const promises = filters.map(async (filter) => {
    const { width, height } = canvas;
    const ratio = thumbnailSize / Math.max(width, height);
    
    const thumbCanvas = resizeCanvas(canvas, Math.round(width * ratio), Math.round(height * ratio), 'medium');
    const filteredCanvas = await applyFilterToCanvas(thumbCanvas, filter.value);
    
    return {
      ...filter,
      thumbnail: canvasToDataURL(filteredCanvas, 'image/jpeg', 0.6),
    };
  });
  
  return Promise.all(promises);
}

// ==================== MEMORY CLEANUP ====================

/**
 * Revoke object URL safely
 */
export function revokeObjectURL(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Clean up image resources
 */
export function cleanupImage(img) {
  if (img && img.src && img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src);
  }
}

/**
 * Clean up canvas resources
 */
export function cleanupCanvas(canvas) {
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ==================== TEXT ON PATH ====================

/**
 * Draw curved text on canvas
 */
export function drawCurvedText(ctx, text, path, font = '16px sans-serif') {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  
  const length = path.getLength();
  const textWidth = ctx.measureText(text).width;
  
  if (textWidth > length) {
    console.warn('Text is longer than path');
  }
  
  const startOffset = (length - textWidth) / 2;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const position = path.getPointAtLength(startOffset + i * (textWidth / text.length));
    const tangent = path.getTangentAtLength(startOffset + i * (textWidth / text.length));
    const angle = Math.atan2(tangent.y, tangent.x);
    
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
  
  ctx.restore();
}

// ==================== VIGNETTE & EFFECTS ====================

/**
 * Apply vignette effect to canvas
 */
export function applyVignette(canvas, intensity = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height) * 0.7;
  
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${intensity / 100})`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas;
}

/**
 * Apply grain effect to canvas
 */
export function applyGrain(canvas, intensity = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  const factor = intensity / 100;
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * factor * 0.3;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply fade effect to canvas
 */
export function applyFade(canvas, intensity = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  const factor = intensity / 100;
  ctx.fillStyle = `rgba(128, 128, 128, ${factor * 0.1})`;
  ctx.fillRect(0, 0, width, height);
  
  // Reduce contrast slightly
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = `rgba(255, 255, 255, ${factor * 0.05})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  
  return canvas;
}

// ==================== COLOR UTILITIES ====================

/**
 * Convert hex to rgb
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert rgb to hex
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Create gradient from colors
 */
export function createGradient(ctx, colors, direction = 'horizontal') {
  const { width, height } = ctx.canvas;
  let gradient;
  
  if (direction === 'horizontal') {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
  } else if (direction === 'vertical') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
  } else if (direction === 'diagonal') {
    gradient = ctx.createLinearGradient(0, 0, width, height);
  } else {
    gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
  }
  
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });
  
  return gradient;
}

// ==================== HIT TESTING ====================

/**
 * Check if point is inside rectangle
 */
export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if point is near a line segment
 */
export function pointNearLine(point, lineStart, lineEnd, threshold = 10) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance <= threshold;
}

// ==================== GEOMETRY UTILITIES ====================

/**
 * Calculate distance between two points
 */
export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate angle between two points
 */
export function angle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Rotate point around center
 */
export function rotatePoint(point, center, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Get bounding box of rotated rectangle
 */
export function getRotatedBoundingBox(rect, rotation = 0) {
  const { x, y, width, height } = rect;
  const center = { x: x + width / 2, y: y + height / 2 };
  
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  
  const rotatedCorners = corners.map(corner => rotatePoint(corner, center, rotation));
  
  const xs = rotatedCorners.map(c => c.x);
  const ys = rotatedCorners.map(c => c.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Snap angle to 45 degree increments
 */
export function snapAngle(angle, threshold = 5) {
  const snappedAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  
  for (const snapped of snappedAngles) {
    if (Math.abs(angle - snapped) <= threshold) {
      return snapped === 360 ? 0 : snapped;
    }
  }
  
  return angle;
}

// ==================== DEBOUNCE & THROTTLE ====================

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Create a cancellable debounced function
 */
export function createCancellableDebounce(func, wait) {
  let timeoutId = null;
  let lastArgs = null;
  
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
      lastArgs = null;
    }, wait);
  };
  
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };
  
  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      func(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };
  
  return debounced;
}

// ==================== COMPRESSION ====================

/**
 * Compress image using browser-image-compression
 */
export async function compressImage(file, options = {}) {
  const defaultOptions = {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    preserveExif: false,
  };
  
  try {
    const imageCompression = (await import('browser-image-compression')).default;
    return await imageCompression(file, { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Image compression failed:', error);
    return file;
  }
}

// ==================== IMAGE METADATA ====================

/**
 * Get image dimensions without loading full image
 */
export function getImageDimensions(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) {
      resolve({ width: source.naturalWidth, height: source.naturalHeight });
      return;
    }
    
    if (source instanceof File || source instanceof Blob) {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = reject;
      img.src = url;
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = source;
  });
}

/**
 * Check if image is valid
 */
export async function isValidImage(source) {
  try {
    const dimensions = await getImageDimensions(source);
    return dimensions.width > 0 && dimensions.height > 0;
  } catch {
    return false;
  }
}
