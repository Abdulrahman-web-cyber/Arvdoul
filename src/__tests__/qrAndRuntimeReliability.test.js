import jsQR from 'jsqr';
import { buildMatrix } from '../utils/qrCodeGenerator.js';
import { getFeedService } from '../services/feedService.js';

function decodeMatrixWithJsQr(matrix, size, { margin = 4, scale = 4, occludeCenterFraction = 0 } = {}) {
  const totalModules = size + margin * 2;
  const imgSize = totalModules * scale;
  const data = new Uint8ClampedArray(imgSize * imgSize * 4);

  // White background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] !== 1) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (c + margin) * scale + dx;
          const py = (r + margin) * scale + dy;
          const idx = (py * imgSize + px) * 4;
          data[idx] = 7;
          data[idx + 1] = 11;
          data[idx + 2] = 20;
        }
      }
    }
  }

  if (occludeCenterFraction > 0) {
    const badgePx = Math.floor(imgSize * occludeCenterFraction);
    const start = Math.floor((imgSize - badgePx) / 2);
    const end = start + badgePx;
    for (let y = start; y < end; y++) {
      for (let x = start; x < end; x++) {
        const idx = (y * imgSize + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }
  }

  return jsQR(data, imgSize, imgSize, { inversionAttempts: 'dontInvert' });
}

describe('QR Code encoder/decoder end-to-end verification', () => {
  const payloads = [
    'https://arvdoul.app/profile/alex', // Short (<= v3)
    'https://arvdoul.app/profile/some_longer_username_handle_for_testing', // Medium (v4-v6)
    'https://ais-dev-preview.example.run.app/passport/user_9876543210abcdefghijklmnopqrstuvwxyz?ref=qr', // Long (v7+ with BCH version info)
    'https://ais-dev-ksrlvn6qbgnni24ancehpv-496530296443.europe-west3.run.app/profile/uid_1234567890abcdef_long_profile_url_check', // Very long (v9-v12)
  ];

  test.each(payloads)('encodes and roundtrip-decodes %s accurately via jsQR at ECC Level H', (url) => {
    const { matrix, size, ecLevel } = buildMatrix(url, { errorCorrectionLevel: 'H' });
    expect(ecLevel).toBe('H');
    const decoded = decodeMatrixWithJsQr(matrix, size);
    expect(decoded).not.toBeNull();
    expect(decoded.data).toBe(url);
  });

  test('survives a 17% center avatar logo occlusion via ECC Level H recovery', () => {
    const url = 'https://arvdoul.app/profile/creator_hero_uid_1234567890';
    const { matrix, size } = buildMatrix(url, { errorCorrectionLevel: 'H' });
    const decoded = decodeMatrixWithJsQr(matrix, size, { occludeCenterFraction: 0.17 });
    expect(decoded).not.toBeNull();
    expect(decoded.data).toBe(url);
  });
});

describe('FeedService pagination cursor, per-tab cache, and sparse diversity protection', () => {
  test('_getPageFromCache / _cachePage isolate pages by feedType', () => {
    const svc = getFeedService();
    const uid = 'viewer_tab_iso_1';
    svc._cachePage(uid, null, 'trending', { posts: [{ id: 'tr-1' }], nextCursor: 'c1', hasMore: true });
    svc._cachePage(uid, null, 'media', { posts: [{ id: 'md-1' }], nextCursor: 'c2', hasMore: true });

    const trend = svc._getPageFromCache(uid, null, 'trending');
    const media = svc._getPageFromCache(uid, null, 'media');
    const foryou = svc._getPageFromCache(uid, null, 'foryou');

    expect(trend?.posts?.[0]?.id).toBe('tr-1');
    expect(media?.posts?.[0]?.id).toBe('md-1');
    expect(foryou).toBeNull();
  });

  test('_applyDiversityOptimized tops up instead of starving feeds with 1-2 active authors', () => {
    const svc = getFeedService();
    const posts = Array.from({ length: 8 }, (_, i) => ({
      id: `p-${i}`,
      authorId: i < 6 ? 'author-a' : 'author-b',
      _feedScore: 100 - i,
    }));
    const result = svc._applyDiversityOptimized(posts, 'viewer-1', 6, 42, {});
    expect(result).toHaveLength(6);
    expect(new Set(result.map((p) => p.id)).size).toBe(6);
  });

  test('cursor encoding/decoding preserves per-source cursors via .s', () => {
    const svc = getFeedService();
    const sourceCursors = { following: 'post_123', trending: 'post_456' };
    const encoded = svc._encodeCursor({ v: 1, s: sourceCursors, p: 2 });
    const decoded = svc._decodeCursor(encoded);
    expect(decoded?.s).toEqual(sourceCursors);
    expect(decoded?.p).toBe(2);
  });
});
