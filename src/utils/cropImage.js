/**
 * src/utils/cropImage.js - ARVDOUL Canvas Cropping & Compression Utility
 * Crops and compresses an image to an optimized square avatar blob/file.
 */

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Crops an image based on pixel coordinates and exports a compressed WebP/JPEG File.
 * @param {string} imageSrc - Object URL or Base64 data URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {number} [maxSize=512] - Target max dimensions for avatar
 * @returns {Promise<File>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, maxSize = 512) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Cap dimensions to maxSize (e.g. 512x512) for lightning-fast uploads & optimal memory
  const targetWidth = Math.min(pixelCrop.width || 400, maxSize);
  const targetHeight = Math.min(pixelCrop.height || 400, maxSize);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate cropped image'));
          return;
        }
        const file = new File([blob], `avatar_${Date.now()}.webp`, {
          type: 'image/webp',
          lastModified: Date.now(),
        });
        resolve(file);
      },
      'image/webp',
      0.88
    );
  });
}
