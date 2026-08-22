/**
 * src/__tests__/videoData.test.js
 * Guards the mock-data removals:
 *   - videoData.js must NOT contain fabricated users/videos
 *   - it still exports the real VIRTUAL_GIFTS catalog
 *   - videoService must NOT reference INITIAL_VIDEOS (honest empty feed)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

describe('videoData - no fabricated content', () => {
  test('contains no fabricated users (Zaid/Elena/Marcus...) or Unsplash stock', () => {
    const src = fs.readFileSync(path.join(root, 'src/data/videoData.js'), 'utf8');
    // Only the documentary header may mention INITIAL_VIDEOS - never data
    const dataOnly = src.slice(src.indexOf('export const'));
    expect(dataOnly).not.toContain('INITIAL_VIDEOS');
    expect(dataOnly).not.toContain('https://images.unsplash.com');
    expect(src).not.toContain('zaid_dev');
    expect(src).not.toContain('elena_ui');
  });

  test('still exports the real VIRTUAL_GIFTS catalog', () => {
    const src = fs.readFileSync(path.join(root, 'src/data/videoData.js'), 'utf8');
    expect(src).toContain('export const VIRTUAL_GIFTS');
  });
});

describe('videoService - no mock feed fallback', () => {
  test('never references INITIAL_VIDEOS', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/videoService.js'), 'utf8');
    expect(src).not.toContain('INITIAL_VIDEOS');
  });
});

describe('Composer - no stale-balance coin overwrite', () => {
  test('does not write coins: (user.coins || 0) + N (stale balance destroyer)', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Home/Composer.jsx'), 'utf8');
    expect(src).not.toMatch(/coins:\s*\(user\.coins/);
    // The safe path uses the monetization service
    expect(src).toContain('getMonetizationService()');
  });
});

describe('CommentsModal - real commentService wiring', () => {
  test('does not write to the denied posts/{id}/comments subcollection', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Home/CommentsModal.jsx'), 'utf8');
    expect(src).not.toContain('collection(db, "posts", postId, "comments")');
    expect(src).toContain('getCommentService()');
  });
});

describe('VideoEditor - no demo project / fake stock catalog', () => {
  test('constants.js contains no demo project, sample layers, or stock media with fabricated metadata', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/VideoEditor/constants.js'), 'utf8');
    expect(src).not.toContain('SAMPLE_PROJECT_MEDIA');
    expect(src).not.toContain('INITIAL_LAYERS');
    expect(src).not.toContain('https://images.unsplash.com');
    expect(src).not.toContain('commondatastorage.googleapis.com/gtv-videos-bucket');
    // Stock catalogs exist but are honestly EMPTY (no licensed provider wired yet)
    expect(src).toContain('export const STOCK_VIDEOS = [];');
    expect(src).toContain('export const STOCK_AUDIO = [];');
  });

  test('VideoEditorScreen never sets fake Unsplash clip thumbnails', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/VideoEditor/VideoEditorScreen.jsx'), 'utf8');
    expect(src).not.toContain('https://images.unsplash.com');
    expect(src).toContain('captureVideoFrame'); // real frame extraction
    expect(src).toContain('analyzeAudioWaveform'); // real waveform analysis
    expect(src).not.toContain('Math.floor(Math.random() * 80) + 20'); // fake waveform
    expect(src).toContain("useState('Untitled Project')");
  });
});

describe('pollService - honest creator identity & timing', () => {
  test('never fabricates creator identity, avatars, durations, or starting pools', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/pollService.js'), 'utf8');
    expect(src).not.toContain('usr-creator');
    expect(src).not.toContain("'Arvdoul Creator'");
    expect(src).not.toContain("'@creator'");
    expect(src).not.toContain('https://images.unsplash.com');
    expect(src).not.toContain("'7 days left'");
    expect(src).not.toContain('isPredictionMarket ? 5000 : 0');
    expect(src).toContain('endsAt'); // real computed timestamp
  });
});

describe('collaborationService - no sample projects', () => {
  test('getStats contains no fabricated sample project or avatar service URLs', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/collaborationService.js'), 'utf8');
    expect(src).not.toContain('proj-sample-1');
    expect(src).not.toContain('https://i.pravatar.cc');
    expect(src).not.toContain('https://images.unsplash.com');
    expect(src).not.toContain("name: 'Arvdoul Launch Reel'");
    expect(src).toContain("where('ownerId', '==', userId)"); // real Firestore query
  });
});

describe('videoUtils - no fake thumbnail service', () => {
  test('generateThumbnail never returns picsum placeholder URLs', () => {
    const src = fs.readFileSync(path.join(root, 'src/utils/videoUtils.js'), 'utf8');
    expect(src).not.toContain('picsum.photos');
  });
});

describe('CSP headers - no placeholder image hosts', () => {
  test('CSP img-src allowlists no longer permit unsplash/picsum', () => {
    const csp = fs.readFileSync(path.join(root, 'src/services/CSPService.js'), 'utf8');
    expect(csp).not.toContain('images.unsplash.com');
    const sh = fs.readFileSync(path.join(root, 'src/services/securityHeadersService.js'), 'utf8');
    expect(sh).not.toContain('images.unsplash.com');
    expect(sh).not.toContain('picsum.photos');
  });
});

describe('ThumbnailDesigner - no stock photo sample', () => {
  test('default canvas is a local branded gradient, not an Unsplash photo', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ThumbnailDesigner/ThumbnailDesignerScreen.jsx'), 'utf8');
    expect(src).not.toContain('https://images.unsplash.com');
    expect(src).toContain('data:image/svg+xml'); // self-contained studio canvas
    // No demo composition: the initial layers must be the honest empty canvas
    // (image base + background only — no pre-made text/sticker layers).
    const initial = src.slice(src.indexOf('const INITIAL_LAYERS'), src.indexOf('export default function'));
    expect(initial).not.toContain("type: 'text'");
    expect(initial).not.toContain("type: 'sticker'");
    expect(initial).not.toContain("type: 'gradient'");
  });
});

describe('Service worker - never caches dev/unversioned modules', () => {
  test('sw.js only caches versioned static assets; dev URLs pass through', () => {
    const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    expect(sw).toContain("pathname.startsWith('/assets/')"); // versioned bundles only
    expect(sw).toContain("pathname.startsWith('/src/')"); // dev modules excluded
    expect(sw).toContain("pathname.startsWith('/@vite')");
    expect(sw).toContain('arvdoul-v2');
  });

  test('main.jsx registers the SW only in production and self-heals dev', () => {
    const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
    expect(main).toContain('import.meta.env.PROD');
    expect(main).toContain("navigator.serviceWorker.register('/sw.js')");
    expect(main).toContain('getRegistrations()'); // dev unregister
  });

  test('index.html no longer registers the SW unconditionally', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).not.toContain("navigator.serviceWorker.register('/sw.js')");
  });
});

describe('AI Studio - no fabricated AI output', () => {
  test('aiStudioService contains no template fallbacks or invented metrics', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/aiStudioService.js'), 'utf8');
    expect(src).not.toContain('local-fallback-template');
    expect(src).not.toContain('VIRAL_HOOK_TEMPLATES');
    expect(src).not.toContain('SAMPLE_SCRIPTS');
    expect(src).not.toContain('6:30 PM - 8:45 PM');
  });

  test('AIStudioScreen shows an honest unavailable banner instead of fake content', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/AIStudio/AIStudioScreen.jsx'), 'utf8');
    expect(src).toContain('AI gateway unavailable');
    expect(src).toContain('VITE_AI_GATEWAY_URL');
    expect(src).not.toContain('local-fallback-template');
  });
});

describe('ConflictResolutionScreen - real queued operations only', () => {
  test('no fabricated demo conflict and no hardcoded fake captions', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ConflictResolutionScreen.jsx'), 'utf8');
    expect(src).not.toContain('conflict_post_101');
    expect(src).not.toContain("'Loving the new Arvdoul update!'");
    expect(src).toContain('offlineQueue.getPending()');
  });

  test('OfflineQueue exposes real getPending/remove for the conflict UI', () => {
    const src = fs.readFileSync(path.join(root, 'src/utils/OfflineQueue.js'), 'utf8');
    expect(src).toContain('async getPending()');
    expect(src).toContain('async remove(id)');
  });
});

describe('NotificationsScreen - real timestamps, no invented copy', () => {
  test('never stamps every notification with a fabricated "Just now"', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/NotificationsScreen.jsx'), 'utf8');
    expect(src).not.toContain("timestamp: 'Just now'");
    expect(src).not.toContain("'interacted with your content.'");
    expect(src).toContain('createdAt?.toDate'); // real timestamp mapping
  });
});
