/**
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

  const cropWidth = Math.max(1, Math.round(pixelCrop?.width || image.naturalWidth || 400));
  const cropHeight = Math.max(1, Math.round(pixelCrop?.height || image.naturalHeight || 400));
  const cropX = Math.max(0, Math.round(pixelCrop?.x || 0));
  const cropY = Math.max(0, Math.round(pixelCrop?.y || 0));

  // Cap dimensions to maxSize (e.g. 512x512) for lightning-fast uploads & optimal memory
  const targetWidth = Math.max(1, Math.min(cropWidth, maxSize));
  const targetHeight = Math.max(1, Math.min(cropHeight, maxSize));

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    const finalize = (blob) => {
      if (!blob) {
        reject(new Error('Failed to generate cropped image'));
        return;
      }
      const mimeType = blob.type || 'image/jpeg';
      const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `avatar_${Date.now()}.${ext}`, {
        type: mimeType,
        lastModified: Date.now(),
      });
      resolve(file);
    };

    canvas.toBlob(
      (webpBlob) => {
        if (webpBlob) {
          finalize(webpBlob);
          return;
        }
        canvas.toBlob(finalize, 'image/jpeg', 0.9);
      },
      'image/webp',
      0.88
    );
  });
}
