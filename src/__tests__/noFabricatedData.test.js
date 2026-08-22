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

describe('DataUsageScreen - real storage, cache and GDPR export', () => {
  test('no fake USAGE_DATA, no setTimeout-only handlers', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/DataUsageScreen.jsx'), 'utf8');
    expect(src).not.toContain('USAGE_DATA');
    expect(src).not.toContain('await new Promise(resolve => setTimeout(resolve, 1500))');
    expect(src).not.toContain('You\'ll receive an email when ready');
    expect(src).toContain('navigator.storage?.estimate'); // REAL storage numbers
    expect(src).toContain('settingsService.clearApplicationCache'); // REAL cache clearing
    expect(src).toContain("'exportUserData'"); // REAL GDPR Cloud Function
  });
});

describe('Marketplace - real coin ledger, honest listings', () => {
  test('service never fabricates buyer/creator identity, ratings or download URLs', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/marketplaceService.js'), 'utf8');
    expect(src).not.toContain('usr-buyer');
    expect(src).not.toContain('usr-creator');
    expect(src).not.toContain('Arvdoul Creator');
    expect(src).not.toContain('arvdoul.cloud/downloads');
    expect(src).not.toContain('rating: 5.0');
    expect(src).not.toContain('stock: 100');
    expect(src).toContain("'purchaseMarketplaceItem'"); // server-authoritative purchase
    expect(src).toContain('creatorId: creator.uid'); // rules-compliant listing
  });

  test('screen never falls back to a fabricated 5000-coin balance', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Marketplace/MarketplaceScreen.jsx'), 'utf8');
    expect(src).not.toContain('coins || 5000');
    expect(src).not.toContain('Physical order dispatched');
  });
});

describe('soundService - real uploads only', () => {
  test('no mixkit demo URL, no fabricated metadata, real file required', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/soundService.js'), 'utf8');
    expect(src).not.toContain('assets.mixkit.co');
    expect(src).not.toContain("'usr-creator'");
    expect(src).not.toContain('bpm: 120');
    expect(src).not.toContain("key: 'C Major'");
    expect(src).toContain('uploadBytes'); // real Storage upload
    expect(src).toContain('decodeAudioData'); // real duration/waveform
  });
});

describe('Spaces & Live - no free-money tips/gifts', () => {
  test('spacesService.sendTip requires a sender and uses the real ledger', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/spacesService.js'), 'utf8');
    expect(src).toContain('transferCoins(');
    expect(src).toContain('Sign in to send a tip');
  });

  test('liveService debits coins BEFORE recording gifts/tips', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/liveService.js'), 'utf8');
    const giftIdx = src.indexOf('async sendLiveGift');
    const tipIdx = src.indexOf('async sendLiveTip');
    // spendCoins/transferCoins must appear before addDoc(live_gifts/live_tips)
    const giftBlock = src.slice(giftIdx, tipIdx);
    const spendIdx = giftBlock.indexOf('spendCoins');
    const addGiftIdx = giftBlock.indexOf("addDoc(giftsRef");
    expect(spendIdx).toBeGreaterThan(-1);
    expect(addGiftIdx).toBeGreaterThan(spendIdx);
  });
});

describe('Badge system - real stats map', () => {
  test('rankingService.getUserBadges returns a map keyed by badge id with earned/progress', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/rankingService.js'), 'utf8');
    expect(src).toContain("result[id] = { earned: earned[id], progress: def.progress, target: def.target }");
    expect(src).toContain('followerCount'); // computed from real stats
    expect(src).toContain('first_like');
  });

  test('BadgeScreen shows honest "not available" instead of fabricated zeros', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/BadgeScreen.jsx'), 'utf8');
    expect(src).toContain('Progress not available yet');
  });
});

describe('Payouts - honest account state', () => {
  test('getPayoutSettings never claims an active account when unconfigured', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');
    expect(src).toContain("accountStatus: 'unconfigured'");
    expect(src).not.toContain("return { enabled: true, accountStatus: 'active', currency: 'USD' }");
  });

  test('CreatorPayoutScreen has no simulated Stripe timer', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/CreatorPayoutScreen.jsx'), 'utf8');
    expect(src).not.toContain("setTimeout(() => {");
    expect(src).toContain('createPayoutAccount');
  });
});

describe('Video save/report - real server paths', () => {
  test('VideoBottomSheet persists saves and submits reports for real', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Videos/VideoBottomSheet.jsx'), 'utf8');
    expect(src).not.toContain("toast.success('Added to Watch Later')");
    expect(src).not.toContain("toast.success('Report submitted. Thank you!')");
    expect(src).toContain('saveVideo(');
    expect(src).toContain('reportVideo(');
  });

  test('videoService exposes save/unsave/getSavedVideos', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/videoService.js'), 'utf8');
    expect(src).toContain('async saveVideo(');
    expect(src).toContain('async unsaveVideo(');
    expect(src).toContain('async getSavedVideos(');
  });

  test('firestore.rules allow users/{uid}/saved_videos', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('match /users/{userId}/saved_videos/{videoId}');
  });
});

describe('Poll + marketplace rules compliance', () => {
  test('pollService writes top-level creatorId (rules require it)', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/pollService.js'), 'utf8');
    expect(src).toContain('creatorId: creator.uid');
  });
});

describe('Offline drain - markAsRead is retried', () => {
  test('AppBootstrap drains queued notification reads', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/AppBootstrap.jsx'), 'utf8');
    expect(src).toContain("case 'markAsRead':");
  });
});

describe('Video gift/follow/save - no local-only fakes', () => {
  test('VideoGiftModal transfers coins via the real ledger (no local-only deduction)', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Videos/VideoGiftModal.jsx'), 'utf8');
    expect(src).not.toContain('?? 1250');
    expect(src).not.toContain('Math.max(0, userCoins - selectedGift.coins)');
    expect(src).toContain('transferCoins(');
    expect(src).toContain('getBalance('); // real balance shown
  });

  test('VideoCard has no fabricated username fallback and follows for real', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Videos/VideoCard.jsx'), 'utf8');
    expect(src).not.toContain("'abdulrahman'");
    expect(src).toContain('followUser(');
    expect(src).toContain('unfollowUser(');
  });

  test('VideoFeed persists saves server-side', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Videos/VideoFeed.jsx'), 'utf8');
    expect(src).toContain('videoService.saveVideo(');
    expect(src).toContain('videoService.unsaveVideo(');
  });
});

describe('Video upload pipeline - server processing re-enabled', () => {
  test('videoService calls the moderation/watermark/fingerprint functions after upload', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/videoService.js'), 'utf8');
    expect(src).not.toContain('//     this.fns.processVideoEvent');
    expect(src).toContain("this.fns.processVideoEvent({ eventType: 'video.created', videoId })");
    expect(src).toContain('this.fns.moderateVideo({ videoId })');
    expect(src).toContain('this.fns.watermarkVideo({ videoId })');
  });

  test('functions/video.js processing endpoints are onCall (callable-compatible)', () => {
    const src = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');
    expect(src).toContain('exports.watermarkVideo = onCall');
    expect(src).toContain('exports.moderateVideo = onCall');
    expect(src).toContain('exports.updateViralScore = onCall');
  });

  test('audio fingerprint is honest (never a fabricated hash of the id)', () => {
    const src = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');
    expect(src).not.toContain('chromaprint stub');
    expect(src).toContain("audioFingerprintStatus: 'unavailable'");
  });
});

describe('Badge service - no phantom badge array', () => {
  test('rankingService badge map matches the screen contract', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/rankingService.js'), 'utf8');
    expect(src).toContain("result[id] = { earned: earned[id], progress: def.progress, target: def.target }");
    expect(src).not.toContain('snap.docs.forEach((doc) => {'); // old array path removed
  });
});
