// src/screens/CreatePost/postMediaPipeline.js
import { getStorageService } from '../../services/storageService.js';

export async function mediaUrlToFile(url, filename = `audio_${Date.now()}.wav`, fallbackMime = 'audio/wav') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to read local media buffer');
  const blob = await res.blob();
  const mime = blob.type || fallbackMime;
  return new File([blob], filename, { type: mime });
}

export async function generateImageThumbnailBlob(file) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const timer = setTimeout(() => finish(null), 2500);
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      const maxDim = 512;
      let w = img.width || maxDim;
      let h = img.height || maxDim;
      if (w > h) {
        h = Math.max(1, Math.round((h * maxDim) / w));
        w = maxDim;
      } else {
        w = Math.max(1, Math.round((w * maxDim) / h));
        h = maxDim;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        finish(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          finish(blob || null);
        },
        'image/jpeg',
        0.8
      );
      img.onload = null;
      img.onerror = null;
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      finish(null);
    };
    img.src = objectUrl;
  });
}

export async function generateVideoThumbnailBlob(file) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const timer = setTimeout(() => finish(null), 3000);
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      const vw = video.videoWidth || 512;
      const vh = video.videoHeight || 288;
      canvas.width = 512;
      canvas.height = Math.max(1, Math.round((512 / vw) * vh));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        finish(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          finish(blob || null);
        },
        'image/jpeg',
        0.8
      );
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };
    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      finish(null);
    };
    video.src = objectUrl;
  });
}

export function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function deleteUploadedStorageAsset(storageService, pathOrUrl) {
  if (!pathOrUrl) return;
  const service = storageService || getStorageService();
  if (!service || typeof service.deleteFile !== 'function') return;
  const path =
    pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
      ? extractStoragePathFromUrl(pathOrUrl)
      : pathOrUrl;
  if (!path) return;
  try {
    await service.deleteFile(path);
  } catch (err) {
    console.warn('[postMediaPipeline] Cleanup delete failed:', err?.message);
  }
}

export async function uploadSingleMediaAsset({
  file,
  folder = 'posts',
  uid,
  signal,
  onProgress,
  maxSize,
  storageService,
}) {
  if (!uid) throw new Error('You must be signed in to upload media');
  if (!file) throw new Error('Missing file to upload');
  const service = storageService || getStorageService();
  const safeName = String(file.name || 'media').replace(/[^\w.-]/g, '_');
  const path = `${folder}/${uid}/${Date.now()}_${safeName}`;
  const res = await service.uploadFileWithProgress(file, path, {
    userId: uid,
    signal,
    maxSize,
    onProgress: (p) => {
      const percent = Math.round(typeof p?.progress === 'number' ? p.progress : p?.percent ?? 0);
      onProgress?.(percent, p);
    },
  });
  if (!res?.downloadURL) throw new Error('Upload completed without a download URL');
  return {
    downloadURL: res.downloadURL,
    storagePath: res.path || path,
    size: res.size || file.size || 0,
  };
}

export async function uploadComposerMedia(
  mediaItems,
  { uid, storageService, signal, onItemProgress, onBatchProgress } = {}
) {
  if (!uid) throw new Error('You must be signed in to upload media');
  const service = storageService || getStorageService();
  const validItems = (Array.isArray(mediaItems) ? mediaItems : []).filter(
    (m) => (m.file || m.url || m.preview) && !m.error
  );
  if (validItems.length === 0) return [];

  let completed = 0;
  const total = validItems.length;
  const results = new Array(validItems.length);
  const failures = [];

  const processItem = async (item, index) => {
    if (signal?.aborted) throw new Error('Upload cancelled');
    try {
      const existingUrl =
        typeof item.url === 'string' &&
        (item.url.startsWith('https://') || item.url.startsWith('http://'))
          ? item.url
          : null;

      let fileToUpload = item.file || null;
      if (!fileToUpload && !existingUrl) {
        const candidate = item.url || item.preview || '';
        if (candidate.startsWith('blob:') || candidate.startsWith('data:')) {
          fileToUpload = await mediaUrlToFile(
            candidate,
            item.name || `${item.type || 'media'}_${Date.now()}`,
            item.type === 'audio' ? 'audio/wav' : undefined
          );
        }
      }

      if (existingUrl) {
        let thumbUrl =
          typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http')
            ? item.thumbnail
            : typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.startsWith('http')
            ? item.thumbnailUrl
            : null;
        if (!thumbUrl && fileToUpload && item.type === 'video') {
          const thumbBlob = await generateVideoThumbnailBlob(fileToUpload);
          if (thumbBlob) {
            const thumbFile = new File([thumbBlob], `thumb_${item.id || Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            const uploadedThumb = await uploadSingleMediaAsset({
              file: thumbFile,
              folder: 'posts',
              uid,
              signal,
              storageService: service,
            });
            thumbUrl = uploadedThumb.downloadURL;
          }
        }
        results[index] = {
          url: existingUrl,
          storagePath: item.storagePath || extractStoragePathFromUrl(existingUrl),
          thumbnail: thumbUrl,
          type: item.type || 'image',
          name: item.name || '',
          alt: item.alt || '',
          duration: item.duration || 0,
        };
        completed += 1;
        onBatchProgress?.((completed / total) * 100);
        return;
      }

      if (!fileToUpload) {
        throw new Error(`Could not upload "${item.name || 'media'}"`);
      }

      const inferredType =
        item.type ||
        (fileToUpload.type?.startsWith('video/')
          ? 'video'
          : fileToUpload.type?.startsWith('audio/')
          ? 'audio'
          : 'image');

      const uploadRes = await uploadSingleMediaAsset({
        file: fileToUpload,
        folder: inferredType === 'video' ? 'videos' : 'posts',
        uid,
        signal,
        storageService: service,
        onProgress: (percent) => onItemProgress?.(item.id, percent),
      });

      let thumbUrl =
        typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http')
          ? item.thumbnail
          : typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.startsWith('http')
          ? item.thumbnailUrl
          : null;

      if (!thumbUrl) {
        let thumbBlob = null;
        if (inferredType === 'image') thumbBlob = await generateImageThumbnailBlob(fileToUpload);
        else if (inferredType === 'video') thumbBlob = await generateVideoThumbnailBlob(fileToUpload);
        if (thumbBlob) {
          try {
            const thumbFile = new File([thumbBlob], `thumb_${item.id || Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            const uploadedThumb = await uploadSingleMediaAsset({
              file: thumbFile,
              folder: 'posts',
              uid,
              signal,
              storageService: service,
            });
            thumbUrl = uploadedThumb.downloadURL;
          } catch (thumbErr) {
            console.warn('[postMediaPipeline] Thumbnail upload failed:', thumbErr?.message);
          }
        }
      }

      results[index] = {
        url: uploadRes.downloadURL,
        storagePath: uploadRes.storagePath,
        thumbnail: thumbUrl,
        type: inferredType,
        name: item.name || fileToUpload.name || '',
        alt: item.alt || '',
        duration: item.duration || 0,
      };
      completed += 1;
      onBatchProgress?.((completed / total) * 100);
    } catch (err) {
      failures.push(err?.message || 'Media upload failed');
      throw err;
    }
  };

  for (let i = 0; i < validItems.length; i += 3) {
    const chunk = validItems.slice(i, i + 3);
    await Promise.all(
      chunk.map((item, offset) =>
        processItem(item, i + offset).catch((err) => {
          console.error('[postMediaPipeline] Failed item:', err);
        })
      )
    );
  }

  if (failures.length > 0) {
    throw new Error(failures[0]);
  }
  return results.filter(Boolean);
}

export async function uploadAudioCoverIfNeeded(audioData, { uid, storageService, signal } = {}) {
  if (!audioData) return '';
  if (
    typeof audioData.coverUrl === 'string' &&
    (audioData.coverUrl.startsWith('https://') || audioData.coverUrl.startsWith('http://'))
  ) {
    return audioData.coverUrl;
  }

  let coverFile = audioData.coverFile || null;
  if (!coverFile && typeof audioData.coverUrl === 'string') {
    if (audioData.coverUrl.startsWith('blob:') || audioData.coverUrl.startsWith('data:')) {
      coverFile = await mediaUrlToFile(audioData.coverUrl, `cover_${Date.now()}.jpg`, 'image/jpeg');
    }
  }
  if (!coverFile) return '';

  const res = await uploadSingleMediaAsset({
    file: coverFile,
    folder: 'posts',
    uid,
    signal,
    storageService,
  });
  return res.downloadURL;
}
