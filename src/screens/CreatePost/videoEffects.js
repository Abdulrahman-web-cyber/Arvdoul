// src/screens/CreatePost/videoEffects.js - ARVDOUL Video Effects & Processing
// High-performance video processing using OffscreenCanvas and Canvas APIs

import { VIDEO_PERFORMANCE, VIDEO_ADJUSTMENTS, clamp } from './videoConstants';

// ==================== CANVAS UTILITIES ====================

/**
 * Create a canvas element for video processing
 */
export function createVideoCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Create an offscreen canvas for background processing
 */
export function createVideoOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  return createVideoCanvas(width, height);
}

/**
 * Draw video frame to canvas
 */
export function drawVideoFrame(video, canvas, ctx, options = {}) {
  const {
    x = 0,
    y = 0,
    width = canvas.width,
    height = canvas.height,
    flipH = false,
    flipV = false,
    rotation = 0,
    opacity = 1,
  } = options;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Calculate center for rotation
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Apply transformations
  ctx.translate(centerX, centerY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.translate(-width / 2, -height / 2);

  // Draw video frame
  ctx.drawImage(video, x, y, width, height);

  ctx.restore();
}

/**
 * Get video frame as ImageData
 */
export function getVideoFrameData(video, canvas, ctx) {
  const tempCanvas = createVideoCanvas(video.videoWidth, video.videoHeight);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(video, 0, 0);
  return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
}

// ==================== CSS FILTER BUILDERS ====================

/**
 * Build CSS filter string from video adjustments
 */
export function buildVideoFilterCSS(adjustments) {
  const filters = [];

  if (adjustments.brightness !== 100) {
    filters.push(`brightness(${adjustments.brightness}%)`);
  }
  if (adjustments.contrast !== 100) {
    filters.push(`contrast(${adjustments.contrast}%)`);
  }
  if (adjustments.saturation !== 100) {
    filters.push(`saturate(${adjustments.saturation}%)`);
  }
  if (adjustments.hue !== 0) {
    filters.push(`hue-rotate(${adjustments.hue}deg)`);
  }
  if (adjustments.blur > 0) {
    filters.push(`blur(${adjustments.blur}px)`);
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Build combined filter string (adjustments + preset filter)
 */
export function buildCombinedVideoFilter(adjustments, filterPreset, filterIntensity = 100) {
  const filters = [];

  // Base adjustments
  if (adjustments.brightness !== 100) {
    filters.push(`brightness(${adjustments.brightness}%)`);
  }
  if (adjustments.contrast !== 100) {
    filters.push(`contrast(${adjustments.contrast}%)`);
  }
  if (adjustments.saturation !== 100) {
    filters.push(`saturate(${adjustments.saturation}%)`);
  }
  if (adjustments.hue !== 0) {
    filters.push(`hue-rotate(${adjustments.hue}deg)`);
  }
  if (adjustments.blur > 0) {
    filters.push(`blur(${adjustments.blur}px)`);
  }

  // Apply preset filter with intensity
  if (filterPreset && filterPreset !== 'none') {
    if (filterIntensity < 100) {
      // Blend filter with original
      const filterParts = filterPreset.match(/(\w+)\(([^)]+)\)/g) || [];
      filterParts.forEach(part => {
        const match = part.match(/(\w+)\(([^)]+)\)/);
        if (match) {
          const [, filterName, filterValue] = match;
          const numValue = parseFloat(filterValue);
          if (!isNaN(numValue)) {
            const blendedValue = numValue * (filterIntensity / 100);
            filters.push(`${filterName}(${blendedValue}${filterValue.replace(/[-+]?[\d.]+/, '')})`);
          }
        }
      });
    } else {
      filters.push(filterPreset);
    }
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

// ==================== PIXEL MANIPULATION ====================

/**
 * Apply brightness adjustment to image data
 */
export function applyBrightness(imageData, value) {
  const data = imageData.data;
  const factor = value / 100;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor, 0, 255);
    data[i + 1] = clamp(data[i + 1] * factor, 0, 255);
    data[i + 2] = clamp(data[i + 2] * factor, 0, 255);
  }

  return imageData;
}

/**
 * Apply contrast adjustment to image data
 */
export function applyContrast(imageData, value) {
  const data = imageData.data;
  const factor = (259 * (value + 255)) / (255 * (259 - value));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128, 0, 255);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128, 0, 255);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128, 0, 255);
  }

  return imageData;
}

/**
 * Apply saturation adjustment to image data
 */
export function applySaturation(imageData, value) {
  const data = imageData.data;
  const factor = value / 100;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
    data[i] = clamp(gray + factor * (data[i] - gray), 0, 255);
    data[i + 1] = clamp(gray + factor * (data[i + 1] - gray), 0, 255);
    data[i + 2] = clamp(gray + factor * (data[i + 2] - gray), 0, 255);
  }

  return imageData;
}

/**
 * Apply exposure adjustment to image data
 */
export function applyExposure(imageData, value) {
  const data = imageData.data;
  const factor = Math.pow(2, value / 100);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor, 0, 255);
    data[i + 1] = clamp(data[i + 1] * factor, 0, 255);
    data[i + 2] = clamp(data[i + 2] * factor, 0, 255);
  }

  return imageData;
}

/**
 * Apply temperature adjustment to image data
 */
export function applyTemperature(imageData, value) {
  const data = imageData.data;
  const factor = value / 100;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + factor * 30, 0, 255); // Warm: add red
    data[i + 2] = clamp(data[i + 2] - factor * 30, 0, 255); // Cool: reduce blue
  }

  return imageData;
}

/**
 * Apply all adjustments to canvas
 */
export function applyVideoAdjustments(canvas, adjustments) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Create working copy
  const workingData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    canvas.width,
    canvas.height
  );

  // Apply adjustments in order
  if (adjustments.brightness !== 100) {
    applyBrightness(workingData, adjustments.brightness);
  }
  if (adjustments.contrast !== 100) {
    applyContrast(workingData, adjustments.contrast);
  }
  if (adjustments.saturation !== 100) {
    applySaturation(workingData, adjustments.saturation);
  }
  if (adjustments.exposure !== 0) {
    applyExposure(workingData, adjustments.exposure);
  }
  if (adjustments.temperature !== 0) {
    applyTemperature(workingData, adjustments.temperature);
  }

  ctx.putImageData(workingData, 0, 0);
  return canvas;
}

// ==================== EFFECT FUNCTIONS ====================

/**
 * Apply vignette effect to canvas
 */
export function applyVignette(canvas, intensity = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height) * 0.7;
  const factor = intensity / 100;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${factor})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

/**
 * Apply film grain effect to canvas
 */
export function applyFilmGrain(canvas, amount = 20) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = amount / 100;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 51 * factor;
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply blur effect using canvas filter
 */
export function applyBlur(canvas, amount = 10) {
  const ctx = canvas.getContext('2d');
  ctx.filter = `blur(${amount}px)`;
  const tempCanvas = createVideoCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.filter = `blur(${amount}px)`;
  tempCtx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  ctx.drawImage(tempCanvas, 0, 0);
  return canvas;
}

/**
 * Apply sharpening effect using convolution
 */
export function applySharpen(canvas, amount = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = amount / 100 * 2;

  const sharpen = [
    0, -factor, 0,
    -factor, 1 + 4 * factor, -factor,
    0, -factor, 0
  ];

  const tempData = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kidx = (ky + 1) * 3 + (kx + 1);
            const didx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += tempData[didx] * sharpen[kidx];
          }
        }
        data[idx + c] = clamp(sum, 0, 255);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply VHS effect to canvas
 */
export function applyVHS(canvas, options = {}) {
  const { tracking = 5, noise = 20 } = options;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Apply color bleeding
  const tempData = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const idx = (y * width + x) * 4;
      const prevIdx = (y * width + x - 1) * 4;
      const bleed = tracking / 100;
      
      data[idx] = clamp(tempData[idx] + (tempData[prevIdx] - tempData[idx]) * bleed, 0, 255);
    }
  }

  // Apply scanlines
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] *= 0.7;
      data[idx + 1] *= 0.7;
      data[idx + 2] *= 0.7;
    }
  }

  // Apply noise
  if (noise > 0) {
    const noiseFactor = noise / 100;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 51 * noiseFactor;
      data[i] = clamp(data[i] + n, 0, 255);
      data[i + 1] = clamp(data[i + 1] + n, 0, 255);
      data[i + 2] = clamp(data[i + 2] + n, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply glitch effect to canvas
 */
export function applyGlitch(canvas, amount = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = amount / 100;

  // RGB shift
  const tempData = new Uint8ClampedArray(data);
  const shift = Math.floor(factor * 20);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const shiftX = Math.floor(Math.random() * shift * 2 - shift);
      const newX = clamp(x + shiftX, 0, width - 1);
      const srcIdx = (y * width + newX) * 4;

      if (Math.random() < factor * 0.3) {
        data[idx] = tempData[srcIdx + 2]; // Red <- Blue
        data[idx + 1] = tempData[srcIdx + 1]; // Green
        data[idx + 2] = tempData[srcIdx]; // Blue <- Red
      }
    }
  }

  // Add horizontal displacement
  const displacement = Math.floor(factor * 30);
  for (let i = 0; i < 5 * factor; i++) {
    const y = Math.floor(Math.random() * height);
    const lineWidth = Math.floor(Math.random() * width * 0.2);
    const startX = Math.floor(Math.random() * (width - lineWidth));

    for (let x = startX; x < startX + lineWidth; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = clamp(data[idx] + 100, 0, 255);
      data[idx + 1] = clamp(data[idx + 1] - 50, 0, 255);
      data[idx + 2] = clamp(data[idx + 2] + 100, 0, 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply chromatic aberration effect
 */
export function applyChromaticAberration(canvas, offset = 5) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const tempCanvas = createVideoCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const tempData = tempCtx.getImageData(0, 0, width, height).data;
  const shift = Math.floor(offset);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Red channel shifts left
      const redX = clamp(x - shift, 0, width - 1);
      const redIdx = (y * width + redX) * 4;
      
      // Blue channel shifts right
      const blueX = clamp(x + shift, 0, width - 1);
      const blueIdx = (y * width + blueX) * 4;

      data[idx] = tempData[redIdx]; // Red from left
      data[idx + 1] = tempData[idx + 1]; // Green stays
      data[idx + 2] = tempData[blueIdx + 2]; // Blue from right
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply effect preset to canvas
 */
export function applyEffectPreset(canvas, effectId, params = {}) {
  switch (effectId) {
    case 'glow':
      // Glow is typically applied as a blur + blend
      return canvas;
    case 'blur':
      return applyBlur(canvas, params.amount || 10);
    case 'sharpen':
      return applySharpen(canvas, params.amount || 50);
    case 'vignette':
      return applyVignette(canvas, params.intensity || 50);
    case 'grain':
      return applyFilmGrain(canvas, params.amount || 20);
    case 'noise':
      return applyFilmGrain(canvas, params.amount || 20);
    case 'vhs':
      return applyVHS(canvas, params);
    case 'glitch':
      return applyGlitch(canvas, params.amount || 50);
    case 'chromatic':
      return applyChromaticAberration(canvas, params.offset || 5);
    default:
      return canvas;
  }
}

// ==================== TRANSITION FUNCTIONS ====================

/**
 * Apply dissolve transition between two frames
 */
export function applyDissolve(frame1, frame2, progress) {
  const canvas = createVideoCanvas(frame1.width, frame1.height);
  const ctx = canvas.getContext('2d');

  ctx.globalAlpha = 1 - progress;
  ctx.drawImage(frame1, 0, 0);
  ctx.globalAlpha = progress;
  ctx.drawImage(frame2, 0, 0);
  ctx.globalAlpha = 1;

  return canvas;
}

/**
 * Apply fade transition (fade to/from black)
 */
export function applyFade(frame1, frame2, progress, fadeToBlack = true) {
  const canvas = createVideoCanvas(frame1.width, frame1.height);
  const ctx = canvas.getContext('2d');

  if (fadeToBlack) {
    // Fade out
    ctx.drawImage(frame1, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${progress})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // Fade in
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = progress;
    ctx.drawImage(frame2, 0, 0);
    ctx.globalAlpha = 1;
  }

  return canvas;
}

/**
 * Apply wipe transition
 */
export function applyWipe(frame1, frame2, progress, direction = 'left') {
  const canvas = createVideoCanvas(frame1.width, frame1.height);
  const ctx = canvas.getContext('2d');

  ctx.save();

  if (direction === 'left') {
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width * (1 - progress), canvas.height);
    ctx.clip();
    ctx.drawImage(frame2, 0, 0);
    ctx.restore();

    ctx.drawImage(frame1, 0, 0);
  } else if (direction === 'right') {
    ctx.beginPath();
    ctx.rect(canvas.width * progress, 0, canvas.width * (1 - progress), canvas.height);
    ctx.clip();
    ctx.drawImage(frame2, 0, 0);
    ctx.restore();

    ctx.drawImage(frame1, 0, 0);
  } else if (direction === 'up') {
    ctx.beginPath();
    ctx.rect(0, canvas.height * progress, canvas.width, canvas.height * (1 - progress));
    ctx.clip();
    ctx.drawImage(frame2, 0, 0);
    ctx.restore();

    ctx.drawImage(frame1, 0, 0);
  } else if (direction === 'down') {
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height * (1 - progress));
    ctx.clip();
    ctx.drawImage(frame2, 0, 0);
    ctx.restore();

    ctx.drawImage(frame1, 0, 0);
  }

  return canvas;
}

/**
 * Apply zoom transition
 */
export function applyZoom(frame1, frame2, progress, zoomIn = true) {
  const canvas = createVideoCanvas(frame1.width, frame1.height);
  const ctx = canvas.getContext('2d');

  const scale = zoomIn ? 1 + progress * 0.3 : 1.3 - progress * 0.3;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Draw frame1 with zoom out
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(frame1, 0, 0);
  ctx.restore();

  // Crossfade
  ctx.globalAlpha = progress;
  ctx.drawImage(frame2, 0, 0);
  ctx.globalAlpha = 1;

  return canvas;
}

/**
 * Apply blur transition
 */
export function applyBlurTransition(frame1, frame2, progress) {
  const canvas = createVideoCanvas(frame1.width, frame1.height);
  const ctx = canvas.getContext('2d');

  const blur1 = progress * 20;
  const blur2 = (1 - progress) * 20;

  // Draw frame1 with blur
  ctx.filter = `blur(${blur1}px)`;
  ctx.drawImage(frame1, 0, 0);
  ctx.filter = 'none';

  // Crossfade
  ctx.globalAlpha = progress;
  ctx.filter = `blur(${blur2}px)`;
  ctx.drawImage(frame2, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  return canvas;
}

/**
 * Apply transition between two frames
 */
export function applyTransition(transitionId, frame1, frame2, progress) {
  switch (transitionId) {
    case 'dissolve':
      return applyDissolve(frame1, frame2, progress);
    case 'fade':
    case 'black-fade':
      return applyFade(frame1, frame2, progress, true);
    case 'white-fade':
      return applyFade(frame1, frame2, progress, false);
    case 'wipe-left':
      return applyWipe(frame1, frame2, progress, 'left');
    case 'wipe-right':
      return applyWipe(frame1, frame2, progress, 'right');
    case 'wipe-up':
      return applyWipe(frame1, frame2, progress, 'up');
    case 'wipe-down':
      return applyWipe(frame1, frame2, progress, 'down');
    case 'zoom-in':
      return applyZoom(frame1, frame2, progress, true);
    case 'zoom-out':
      return applyZoom(frame1, frame2, progress, false);
    case 'blur':
      return applyBlurTransition(frame1, frame2, progress);
    default:
      // No transition or unknown - just return frame2
      return frame2;
  }
}

// ==================== THUMBNAIL GENERATION ====================

/**
 * Generate thumbnail from video at specific time
 */
export async function generateVideoThumbnail(video, time = 0, width = 160, height = 90) {
  return new Promise((resolve, reject) => {
    const canvas = createVideoCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const handleSeeked = () => {
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          video.removeEventListener('seeked', handleSeeked);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        },
        'image/jpeg',
        0.7
      );
    };

    video.addEventListener('seeked', handleSeeked);
    video.currentTime = time;
  });
}

/**
 * Generate filmstrip thumbnails for timeline
 */
export async function generateFilmstrip(video, interval = 5000, thumbnailWidth = 120) {
  const thumbnails = [];
  const duration = video.duration;
  const aspectRatio = video.videoWidth / video.videoHeight;
  const thumbnailHeight = Math.round(thumbnailWidth / aspectRatio);

  const times = [];
  for (let time = 0; time < duration; time += interval / 1000) {
    times.push(time);
  }

  for (const time of times) {
    try {
      const thumbnail = await generateVideoThumbnail(video, time, thumbnailWidth, thumbnailHeight);
      thumbnails.push({ time, blob: thumbnail });
    } catch (error) {
      console.warn(`Failed to generate thumbnail at ${time}s:`, error);
    }
  }

  return thumbnails;
}

// ==================== VIDEO METADATA ====================

/**
 * Get video metadata
 */
export function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
        frameRate: 30, // Default, can be detected with more complex methods
        hasAudio: false,
        codec: file.type,
      };

      // Check for audio
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        metadata.hasAudio = true;
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        metadata.hasAudio = false;
        URL.revokeObjectURL(audio.src);
      };

      URL.revokeObjectURL(video.src);
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Check if file is a valid video
 */
export function isValidVideo(file) {
  return file.type.startsWith('video/');
}

// ==================== DEBOUNCE & THROTTLE ====================

/**
 * Debounce function for video processing
 */
export function debounceVideo(func, wait) {
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
 * Throttle function for video processing
 */
export function throttleVideo(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ==================== AUDIO WAVEFORM ====================

/**
 * Generate waveform data from video/audio
 */
export async function generateWaveform(audioBuffer, samples = 1000) {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform = [];

  for (let i = 0; i < samples; i++) {
    const blockStart = blockSize * i;
    let sum = 0;

    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[blockStart + j]);
    }

    waveform.push(sum / blockSize);
  }

  // Normalize
  const max = Math.max(...waveform);
  return waveform.map((v) => v / max);
}

/**
 * Extract audio from video file
 */
export async function extractAudioFromVideo(videoFile) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await videoFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

// ==================== CROP & TRANSFORM ====================

/**
 * Apply crop to video frame
 */
export function applyVideoCrop(video, canvas, cropArea) {
  const ctx = canvas.getContext('2d');
  const { x, y, width, height } = cropArea;

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(video, x, y, width, height, 0, 0, width, height);

  return canvas;
}

/**
 * Apply rotation to video frame
 */
export function applyVideoRotation(video, canvas, degrees) {
  const ctx = canvas.getContext('2d');
  const radians = (degrees * Math.PI) / 180;

  // Calculate new dimensions
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const newWidth = video.videoWidth * cos + video.videoHeight * sin;
  const newHeight = video.videoWidth * sin + video.videoHeight * cos;

  canvas.width = newWidth;
  canvas.height = newHeight;

  ctx.save();
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
  ctx.restore();

  return canvas;
}
