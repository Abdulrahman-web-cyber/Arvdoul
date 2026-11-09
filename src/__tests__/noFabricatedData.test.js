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
import { XP_RULES } from '../shared/levelConfig.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

describe('CreatorPayoutScreen - real ledger-derived figures only', () => {
  const src = fs.readFileSync(path.join(root, 'src/screens/CreatorPayoutScreen.jsx'), 'utf8');
  test('earnings breakdown is summed from the coin ledger, not a fixed ratio', () => {
    // `(balance * 0.7)` / `(balance * 0.3)` fabricated a gifts/ad split that no
    // server ever produced.
    expect(src).not.toMatch(/balance\s*\*\s*0\.[0-9]/);
    expect(src).toContain('getCoinEarningHistory');
    expect(src).toContain('sumCredits');
  });
  test('lifetime withdrawn is computed, not a hardcoded $0.00', () => {
    expect(src).not.toMatch(/>\$0\.00</);
    expect(src).toContain('lifetimeWithdrawnCoins');
  });
});

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

describe('CommentsDrawer - real commentService wiring', () => {
  test('does not write to the denied posts/{id}/comments subcollection', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/CommentsDrawer.jsx'), 'utf8');
    expect(src).not.toContain('collection(db, "posts", postId, "comments")');
    expect(src).toContain('commentService');
  });
});

describe('firestoreService - no fabricated cross-platform publish', () => {
  test('publishToPlatform does not simulate a success or invent URLs', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/firestoreService.js'), 'utf8');
    // It once slept 600ms and returned `https://<platform>.com/arvdoul_post_<id>`
    // URLs as if the post had been shared to real platforms.
    expect(src).not.toContain('Simulating cross-platform publication');
    expect(src).not.toContain('arvdoul_post_');
    // The selection UI collected a value nothing consumed (a dead prop).
    const createPost = fs.readFileSync(path.join(root, 'src/screens/CreatePost.jsx'), 'utf8');
    expect(createPost).not.toContain('CROSS_PLATFORMS');
    expect(createPost).not.toContain('TOGGLE_CROSS_PLATFORM');
    expect(createPost).not.toContain('CrossPlatformPanel');
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

  test('project roster size is a real denormalized count, never a fabricated 0/empty array', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/collaborationService.js'), 'utf8');
    // The project document has no `members` number or `team` array — members
    // live in the `team` subcollection. Reading those fields produced a
    // permanent `0` and a dead avatar row (N162).
    expect(src).not.toMatch(/members:\s*typeof/);
    expect(src).not.toMatch(/team:\s*Array\.isArray\(data\.team\)/);
    expect(src).toContain("typeof data.memberCount === 'number'");
  });

  test('the server keeps the denormalized memberCount in step with the team roster', () => {
    const fn = fs.readFileSync(path.join(root, 'functions/collaboration.js'), 'utf8');
    expect(fn).toContain('memberCount: 1'); // seeded when the owner is added
    expect(fn).toContain('memberCount: FieldValue.increment(1)');
    expect(fn).toContain('memberCount: FieldValue.increment(-1)');
  });

  test('the collaboration UI wires create + team management (no dead controls)', () => {
    const dashboard = fs.readFileSync(
      path.join(root, 'src/screens/Collaboration/ProjectDashboardScreen.jsx'), 'utf8');
    const detail = fs.readFileSync(
      path.join(root, 'src/screens/Collaboration/ProjectDetailScreen.jsx'), 'utf8');
    // The primary "New Project" action must reach the real create callable.
    expect(dashboard).toContain('collaborationService.createProject');
    // Team management must be reachable — these callables have no other caller.
    expect(detail).toContain('collaborationService.createInvite');
    expect(detail).toContain('collaborationService.updateMemberRole');
    expect(detail).toContain('collaborationService.removeTeamMember');
  });
});

describe('videoUtils - no fake thumbnail service', () => {
  test('generateThumbnail never returns picsum placeholder URLs', () => {
    const src = fs.readFileSync(path.join(root, 'src/utils/videoUtils.js'), 'utf8');
    expect(src).not.toContain('picsum.photos');
  });
});

describe('CSP headers - no placeholder image hosts', () => {
  test('the shipped CSP does not permit unsplash/picsum', () => {
    // The enforced policy is the meta tag in index.html (that CSP builder was dead
    // code that was never applied, so asserting against it proved nothing).
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const cspMatch = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/);
    expect(cspMatch).toBeTruthy();
    expect(cspMatch[1]).not.toContain('images.unsplash.com');
    expect(cspMatch[1]).not.toContain('picsum.photos');
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
    expect(src).toContain('async getPending(');
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
    expect(src).toContain('FUNCTIONS.EXPORT_USER_DATA'); // REAL GDPR Cloud Function
    const callables = fs.readFileSync(path.join(root, 'src/services/callableService.js'), 'utf8');
    expect(callables).toContain("EXPORT_USER_DATA: 'exportUserData'");
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
    expect(src).toContain('FUNCTIONS.PURCHASE_MARKETPLACE_ITEM'); // server-authoritative purchase
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

  test('liveService delegates gifts/tips to the server callable (no client debit or write)', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/liveService.js'), 'utf8');
    const giftIdx = src.indexOf('async sendLiveGift');
    const tipIdx = src.indexOf('async sendLiveTip');
    expect(giftIdx).toBeGreaterThan(-1);
    expect(tipIdx).toBeGreaterThan(giftIdx);
    const giftBlock = src.slice(giftIdx, tipIdx);
    // The server callable moves value sender -> streamer in one transaction.
    // The old client path debited via spendCoins and then wrote a `live_gifts`
    // row that the rules deny — the coins were destroyed and the streamer was
    // never paid.
    expect(giftBlock).toContain('callFunction(FUNCTIONS.SEND_LIVE_GIFT');
    expect(giftBlock).not.toContain('spendCoins');
    expect(giftBlock).not.toContain('addDoc');
    const tipBlock = src.slice(tipIdx, src.indexOf('\n  async ', tipIdx + 1));
    expect(tipBlock).toContain('callFunction(FUNCTIONS.SEND_LIVE_TIP');
    expect(tipBlock).not.toContain('transferCoins(');
    expect(tipBlock).not.toContain('addDoc');
  });
});

describe('Badge system - real stats map', () => {
  test('rankingService.getUserBadges returns a map keyed by badge id with earned/progress', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/rankingService.js'), 'utf8');
    expect(src).toContain("result[id] = { earned: earned[id], progress: def.progress, target: def.target }");
    expect(src).toContain('followerCount'); // computed from real stats
    expect(src).toContain('first_like');
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

describe('Offline drain - notification reads are retried', () => {
  test('notificationsService retries queued reads through its own offline queue', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/notificationsService.js'), 'utf8');
    // markAsRead is queued on the notification-specific offline queue and
    // replayed by processAll -> _markReadViaCF. The general op-type drain lives
    // in src/offline/syncEngine.js (see offlineDrainIntegrity.test.js).
    expect(src).toContain("this.offlineQueue.add('markAsRead'");
    expect(src).toContain('_markReadViaCF');
    expect(src).toContain('async processAll()');
  });

  test('AppBootstrap delegates the offline drain to the canonical sync engine', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/AppBootstrap.jsx'), 'utf8');
    expect(src).toContain("import('../offline/syncEngine.js')");
    expect(src).toContain('syncQueue(');
    // The old inline op-type switch was a divergent second drain that called
    // methods which do not exist; it must not come back.
    expect(src).not.toContain("case 'markAsRead':");
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

describe('Cloud functions - no fake email/IAP/video processing', () => {
  test('sendEmailNotification never fakes success', () => {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    expect(src).not.toContain('Would send to');
    expect(src).not.toContain("return { success: true, mock: true }");
    expect(src).toContain("status: 'unconfigured'"); // honest when SendGrid missing
  });

  test('verifyPurchase never mints coins without real receipt validation', () => {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    expect(src).not.toContain("we'll just simulate success and award coins");
    expect(src).toContain('Receipt required for purchase verification');
    expect(src).toContain('appstore.*');
  });

  test('processVideo storage trigger never fabricates ready', () => {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    expect(src).not.toContain('simulate processing');
    expect(src).not.toContain("setTimeout(resolve, 5000)");
    expect(src).toContain("transcodeStatus: hasMux ? 'mux_pipeline' : 'pending_upload_completion'");
  });

  test('notification-read trigger no longer mints coins', () => {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    expect(src).not.toContain("coins: admin.firestore.FieldValue.increment(1)");
  });

  test('addCoins is allowlisted per reason with daily COIN-VOLUME caps (no coin faucet)', () => {
    const src = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(src).toContain('CLIENT_ADD_REASON_LIMITS');
    // Caps must bound coin volume, not merely the number of calls.
    expect(src).toContain('dailyCoins');
    expect(src).toContain('perTx');
    expect(src).toContain("is not allowlisted for client addCoins");
    expect(src).toContain('Daily coin budget reached');
    expect(src).toContain("select('amount')");
  });

  test('video processing endpoints are onCall', () => {
    const src = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');
    expect(src).toContain('exports.watermarkVideo = onCall');
    expect(src).toContain('exports.moderateVideo = onCall');
  });
});

describe('Level gate - aligned with the real 15-level curve', () => {
  test('no hardcoded monetization gate literal (max level is 15)', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Shared/QuickAccessPanel.jsx'), 'utf8');
    expect(src).not.toContain('Level 25');
    // The gate must come from the shared config, not a literal.
    expect(src).toContain('MONETIZATION_MIN_LEVEL = LEVEL_GATES.withdrawals');
  });
});

describe('appStore - identity mirror only, no duplicate economy', () => {
  test('appStore never re-introduces a parallel in-memory coin/notification ledger', () => {
    const src = fs.readFileSync(path.join(root, 'src/store/appStore.js'), 'utf8');
    // Compare code only — the explanatory comment names the removed keys.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // A duplicate balance that no screen read could drift from the server
    // ledger; the coin truth is Firestore (monetizationService), notifications
    // are notificationsService, settings are ThemeContext/i18n.
    for (const dead of ['coins:', 'transactions:', 'addCoins', 'deductCoins', 'getCoinBalance', 'addNotification', 'notifications:', 'subscription:', 'soundEnabled', 'setTheme']) {
      expect(code).not.toContain(dead);
    }
    // The identity mirror it does own must remain.
    expect(src).toContain('setCurrentUser');
    expect(src).toContain('clearUserData');
  });

  test('QuickAccessPanel never fabricates a 1250-coin balance', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Shared/QuickAccessPanel.jsx'), 'utf8');
    // The balance header showed a fake 1250 when the real balance was unknown;
    // an unknown balance must render as unavailable, not as invented money.
    expect(src).not.toContain('?? 1250');
  });

  test('QuickAccessPanel renders unknown profile counts as unavailable, not zero', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Shared/QuickAccessPanel.jsx'), 'utf8');
    // videoCount/savedCount/collectionCount/likeCount/commentCount are not
    // stored on users/{uid}; rendering `|| 0` claimed "none" for an unknown
    // value. They must pass through the honest formatter.
    expect(src).not.toContain('stats.videoCount || 0');
    expect(src).not.toContain('stats.savedCount || 0');
    expect(src).not.toContain('stats.collectionCount || 0');
    expect(src).not.toContain('stats.commentCount || 0');
    expect(src).toContain('formatCount(stats.videoCount)');
    expect(src).toContain('formatCount(stats.likeCount)');
  });

  test('QuickAccessPanel reuses the canonical achievement catalog, not a local copy', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Shared/QuickAccessPanel.jsx'), 'utf8');
    // A hand-rolled achievements array here duplicated AchievementsScreen and
    // could disagree with the server-granted items. It must delegate to the
    // shared achievementService (ACHIEVEMENTS_CATALOG).
    expect(src).toContain('achievementService.enrichAchievements');
    expect(src).toContain('achievementService.getUserAchievements');
    expect(src).not.toContain('"First Post"');
    expect(src).not.toContain('"100 Followers"');
  });
});

describe('Poll wagers - real coin debit', () => {
  test('pollService.votePoll is server-authoritative (votePoll CF) and never writes the poll doc client-side', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/pollService.js'), 'utf8');
    expect(src).toContain('FUNCTIONS.VOTE_POLL'); // Cloud Function path
    expect(src).not.toContain('updateDoc(pollRef, updatePayload)'); // no direct poll writes
  });

  test('functions/polls.js debits wagers through the double-entry ledger', () => {
    const src = fs.readFileSync(path.join(root, 'functions/polls.js'), 'utf8');
    expect(src).toContain('exports.votePoll');
    expect(src).toContain('coin_transactions');
    expect(src).toContain('coin_supply');
    expect(src).toContain('You have already voted on this poll');
  });

  test('PollsScreen never falls back to fabricated 5000 coins', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Polls/PollsScreen.jsx'), 'utf8');
    expect(src).not.toContain('coins || 5000');
    expect(src).toContain('getBalance(');
  });
});

describe('Engagement follow - wired to the real service', () => {
  test('reels follow goes through userService, never an undefined useAuth helper', () => {
    const reels = fs.readFileSync(path.join(root, 'src/screens/ReelsScreen.jsx'), 'utf8');
    expect(reels).not.toContain('addCoins, followUser } = useAuth');
    expect(reels).toContain('getUserService().followUser(user.uid');
  });
});

describe('Spaces - honest host identity', () => {
  test('createSpace requires a real host and never fabricates identity', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/spacesService.js'), 'utf8');
    expect(src).not.toContain("'usr-creator'");
    expect(src).not.toContain("'Arvdoul Creator'");
    expect(src).not.toContain('isVerified: true');
    expect(src).toContain('Sign in to start a space');
  });
});

describe('Admin - no fabricated stats', () => {
  test('dashboard has no fake trends or email-suffix admin authz', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminDashboardScreen.jsx'), 'utf8');
    expect(src).not.toContain('@arvdoul.admin');
    expect(src).not.toContain('+12% this week');
    expect(src).not.toContain('+24% this month');
    expect(src).toContain("where('status', '==', 'pending')");
  });

  test('rules allow admin moderation of users and posts', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('allow update, delete: if isOwner(userId) || isAdmin();');
    expect(rules).toContain('|| isAdmin());');
    expect(rules).toContain('match /video_reports/{reportId}');
  });
});

describe('Shared rate limiter + admin secrets', () => {
  test('rateLimit.js exists and is required by money-path modules', () => {
    const rl = fs.readFileSync(path.join(root, 'functions/rateLimit.js'), 'utf8');
    expect(rl).toContain('module.exports = { checkRateLimit');
    expect(rl).toContain('RATE_LIMIT_EXCEEDED');
    const mon = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(mon).toContain("require('./rateLimit')");
    const notif = fs.readFileSync(path.join(root, 'functions/notifications.js'), 'utf8');
    expect(notif).toContain("require('./rateLimit')");
  });

  test('admin HTTPS endpoints fail closed (no hardcoded secrets)', () => {
    const mon = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    const notif = fs.readFileSync(path.join(root, 'functions/notifications.js'), 'utf8');
    expect(mon).not.toContain("'super-secret-change-me'");
    expect(mon).toContain('fail-closed');
    // The only 'super-secret' mention left is the explanatory comment.
    expect(notif).toContain("// `|| 'super-secret'`");
  });

  test('sendNotification is spam-hardened', () => {
    const src = fs.readFileSync(path.join(root, 'functions/notifications.js'), 'utf8');
    expect(src).toContain("checkRateLimit(senderId, 'sendNotification'");
    expect(src).toContain('Cannot send self-notifications');
    expect(src).toContain('Too many notifications to this recipient');
  });

  test('callables got rate limits', () => {
    const user = fs.readFileSync(path.join(root, 'functions/user.js'), 'utf8');
    expect(user).toContain("'deleteUserData', 2, 3600000");
    expect(user).toContain("'getMutualFriends', 60, 60000");
    const polls = fs.readFileSync(path.join(root, 'functions/polls.js'), 'utf8');
    expect(polls).toContain("'votePoll', 30, 60000");
    const exp = fs.readFileSync(path.join(root, 'functions/userExport.js'), 'utf8');
    expect(exp).toContain("'exportUserData', 1, 300000");
  });
});

describe('Storage rules - upload paths enforced', () => {
  test('sounds/videos/thumbnails paths exist with size limits', () => {
    const rules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
    expect(rules).toContain('match /sounds/{userId}/{fileName}');
    expect(rules).toContain('contentType.matches(\'audio/.*\')');
    expect(rules).toContain('match /videos/{userId}/{fileName}');
    expect(rules).toContain('match /thumbnails/{userId}/{fileName}');
    expect(rules).toContain('25 * 1024 * 1024');
  });
});

describe('firebase.json - global CDN caching', () => {
  test('hashed assets immutable + sw.js no-cache', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    const headers = cfg.hosting.headers || [];
    const assets = headers.find((h) => h.source === '/assets/**');
    expect(assets.headers.find((x) => x.key === 'Cache-Control').value).toContain('immutable');
    const sw = headers.find((h) => h.source === '/sw.js');
    expect(sw.headers.find((x) => x.key === 'Cache-Control').value).toContain('no-cache');
  });
});

describe('Ranking service - N+1 killed', () => {
  test('rankings loops use batched userMap, not per-user getDoc', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/rankingService.js'), 'utf8');
    expect(src).toContain('_fetchUsersByIds');
    expect(src).toContain("where('__name__', 'in', chunk)");
    // The four leaderboard loops must not contain the old per-user getDoc block
    expect(src).not.toContain("const userSnap = await getDoc(userRef);");
  });
});

describe('Unbounded queries bounded', () => {
  test('soundService no longer scans the whole sounds collection', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/soundService.js'), 'utf8');
    expect(src).not.toContain('const allSounds = await getDocs(soundsCol);');
    expect(src).toContain('limit(200)');
    expect(src).toContain("getDoc(doc(firestore, 'sounds', id))");
  });

  test('collections items + blocks reads are bounded', () => {
    const cols = fs.readFileSync(path.join(root, 'src/services/collectionsService.js'), 'utf8');
    expect(cols).toContain('limit(200)');
    // The block read moved onto the graph spine, which bounds every edge list;
    // the feed must delegate rather than query `blocks` itself.
    const feed = fs.readFileSync(path.join(root, 'src/services/feedService.js'), 'utf8');
    expect(feed).toContain("getSocialGraphService().listConnections(userId, 'blocked'");
    const spine = fs.readFileSync(path.join(root, 'src/services/socialGraphService.js'), 'utf8');
    expect(spine).toContain('MAX_PAGE_SIZE');
  });
});

describe('searchService - honest trending hashtags, never fabricated counts', () => {
  test('the no-Algolia facet fallback derives counts from real posts', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/searchService.js'), 'utf8');
    // It once returned a hardcoded list of tags with invented counts
    // (`count: 120`, `count: 98`, ...) presented as "N posts" in TrendingSection.
    expect(src).not.toContain('fallbackTags');
    expect(src).not.toMatch(/count:\s*(120|98|85|64|52|47|39)\b/);
    expect(src).toContain('_hashtagFacetsFromPosts');
    expect(src).toContain('doc.data().hashtags');
  });
});

describe('UI/UX - a11y + states', () => {
  test('useEscapeClose hook exists and is wired into key modals', () => {
    const hook = fs.readFileSync(path.join(root, 'src/hooks/useEscapeClose.js'), 'utf8');
    expect(hook).toContain("e.key !== 'Escape'");
    for (const f of ['src/screens/Spaces/SpacesScreen.jsx', 'src/screens/Marketplace/MarketplaceScreen.jsx',
                     'src/screens/Sounds/SoundsScreen.jsx', 'src/screens/LiveScreen.jsx']) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src).toContain('useEscapeClose');
    }
  });

  test('global focus-visible + reduced-motion kill-switch in tailwind.css', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles/tailwind.css'), 'utf8');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  test('icon-only buttons have aria-labels', () => {
    const rail = fs.readFileSync(path.join(root, 'src/components/Videos/VideoActionRail.jsx'), 'utf8');
    expect(rail).toContain('"Unlike video" : "Like video"');
    expect(rail).toContain('aria-label="Comment on video"');
    const topbar = fs.readFileSync(path.join(root, 'src/components/Videos/VideoTopBar.jsx'), 'utf8');
    expect(topbar).toContain('aria-pressed');
  });

  test('Marketplace buy has processing state', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Marketplace/MarketplaceScreen.jsx'), 'utf8');
    expect(src).toContain('buyingId');
    expect(src).toContain("'Processing…'");
  });

  test('MessagingScreen shows a skeleton loader', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/MessagingScreen.jsx'), 'utf8');
    expect(src).toContain('shimmer');
    expect(src).toContain('Loading conversations');
  });

  test('LiveScreen cleans up intervals on unmount while live', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/LiveScreen.jsx'), 'utf8');
    expect(src).toContain('myStreamRef.current && user?.uid');
    expect(src).toContain('endLiveStream(myStreamRef.current.id');
  });
});

describe('Messaging master-spec: security rules', () => {
  test('messages create requires senderId == uid(); receipts-only non-owner updates', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('request.resource.data.senderId == uid()');
    expect(rules).toContain("affectedKeys().hasOnly(['readBy', 'deliveredTo'])");
    expect(rules).toContain('isConvModerator() || isAdmin()');
  });

  test('supergroup monthly shards are covered by rules', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    // A wildcard cannot share a path segment with literal text:
    // `match /messages_{year}_{month}/{messageId}` made the entire ruleset
    // fail to compile (so `firebase deploy` rejected it and the old rules
    // stayed live). The subcollection is matched as a single wildcard and
    // validated by name instead.
    expect(rules).toMatch(/match\s+\/\{messageShardCollection\}\/\{messageId\}/);
    expect(rules).toContain("collection.matches('messages_[0-9]{4}_[0-9]{2}')");
  });

  test('last_messages writes are participant-scoped (no spoofing)', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const block = rules.slice(rules.indexOf('match /last_messages'), rules.indexOf('match /last_messages') + 500);
    expect(block).toContain('uid() in');
  });

  test('unread counters are owner-scoped (rules exist — was default-deny dead)', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain("match /unread_counters/{counterId}");
    expect(rules).toContain("counterId.endsWith('_' + uid())");
    expect(rules).toContain('match /user_unread_totals/{userId}');
  });

  test('group invites are admin-managed', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    // Top-level collection (the client reads/writes it at the root), with the
    // admin gate resolved from the invite's own conversationId. `isConvAdmin()`
    // is scoped to the `conversations/{id}` block and cannot be referenced here.
    const start = rules.indexOf('match /group_invites');
    const block = rules.slice(start, rules.indexOf('match /message_dedupe', start));
    expect(block).toContain('.data.admins');
    expect(block).toContain('request.resource.data.createdBy == uid()');
  });

  test('conversation updates cannot mutate roles/admins unless admin', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('request.resource.data.admins == resource.data.admins');
    expect(rules).toContain('request.resource.data.roles == resource.data.roles');
  });
});

describe('Messaging master-spec: backend behavior', () => {
  test('reactions moved to per-user subcollection (no message-doc rewrite)', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/messagesService.js'), 'utf8');
    expect(src).toContain("'reactions', userId");
    expect(src).toContain('collectionGroup(this.firestore, \'reactions\')');
    expect(src).not.toContain("transaction.update(msgRef, { reactions,");
  });

  test('offline queue keeps failed messages (no silent loss) + status listeners', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/messagesService.js'), 'utf8');
    expect(src).toContain('this.maxAttempts = 5');
    expect(src).toContain("status: 'failed'");
    expect(src).toContain('_emitStatus');
    expect(src).toContain('onStatus(cb)');
    expect(src).not.toContain('await this.removeFirst();');
  });

  test('typing indicator is throttled (2s) — spec §19', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/messagesService.js'), 'utf8');
    expect(src).toContain('lastTypingWriteAt');
    expect(src).toContain('now - last < 2000');
  });

  test('conversation-level read position used by ChatScreen (spec §17)', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(src).toContain('markConversationAsRead(conversationId, uid)');
    expect(src).not.toContain('markMessageAsRead(m.id, conversationId, uid)');
  });

  test('unread counters increment server-side via triggers', () => {
    const src = fs.readFileSync(path.join(root, 'functions/messaging.js'), 'utf8');
    expect(src).toContain('exports.onMessageCreated');
    expect(src).toContain('exports.onShardedMessageCreated');
    expect(src).toContain('UNREAD_INCREMENT_MAX_PARTICIPANTS = 200');
  });
});

describe('Messaging master-spec: chat UX', () => {
  test('date separators, sender grouping, unread divider, jump-to-latest', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(src).toContain("kind: 'date'");
    expect(src).toContain("kind: 'unread'");
    expect(src).toContain('groupStart');
    expect(src).toContain('New messages');
    expect(src).toContain('jump-to-latest');
    expect(src).toContain('newSinceScroll');
  });

  test('conversation details panel: pinned / media / search', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(src).toContain('getPinnedMessages');
    expect(src).toContain('getConversationMedia');
    expect(src).toContain('searchMessagesAlgolia');
    expect(src).toContain('Conversation details');
  });

  test('MessageBubble supports grouping (isGroupStart)', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/messaging/MessageBubble.jsx'), 'utf8');
    expect(src).toContain('isGroupStart = true');
  });

  test('chat reconnects cleanly on online event', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(src).toContain("window.addEventListener('online', goOnline)");
  });
});

describe('Vibes master-spec: server-enforced access (spec §6/26/28/60)', () => {
  test('stories read requires active lifecycle + visibility + no-block', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const block = rules.slice(rules.indexOf('match /stories/{storyId}'), rules.indexOf('match /archived_stories'));
    expect(block).toContain('s.expiresAt > request.time'); // expiry server-enforced
    expect(block).toContain("s.moderationStatus != 'rejected'"); // moderation enforced
    expect(block).toContain("s.visibility == 'followers'"); // audience enforced
    expect(block).toContain("s.visibility == 'private' && s.userId == viewerId"); // private = owner only
    expect(block).toContain('documents/blocks/'); // blocking enforced
    expect(block).toContain('allow read: if isSignedIn()'); // never `allow read: if true`
  });

  test('reactions/comments respect allowReactions/allowComments + active state', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('vibeData().allowReactions == true');
    expect(rules).toContain('vibeData().allowComments == true');
  });

  test('create requires status published + moderation pending; archive is owner-only', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain("request.resource.data.status == 'published'");
    expect(rules).toContain("request.resource.data.moderationStatus == 'pending'");
    expect(rules).toContain("allow read, update, delete: if isSignedIn() && resource.data.userId == uid();");
  });
});

describe('Vibes master-spec: lifecycle + client mirror (spec §4)', () => {
  test('createStory writes status published + processingState', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(src).toContain("status: 'published'");
    expect(src).toContain("processingState: 'done'");
  });

  test('_canViewStory mirrors expiry/status/block/private rules', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(src).toContain("story.status === 'expired'");
    expect(src).toContain("story.expiresAt.toDate().getTime() <= Date.now()");
    // Block check goes through the graph spine: a point read of an absent edge
    // is denied by the `resource.data` rule and would silently skip the check.
    expect(src).toContain("getSocialGraphService().getRelationship(viewerId, story.userId)");
    expect(src).toContain('edge.isBlocking || edge.isBlockedBy');
    expect(src).toContain("story.visibility === STORY_CONFIG.VISIBILITY.PRIVATE");
  });
});

describe('Vibes master-spec: one canonical viewer (spec §99)', () => {
  test('duplicate viewers are deleted and the feed no longer ships a shadow strip', () => {
    for (const dead of ['src/components/Stories/StoryViewer.jsx', 'src/components/Stories/StoryList.jsx',
                        'src/components/Stories/StoriesCarousel.jsx', 'src/components/Home/Stories.jsx',
                        'src/components/feed/VibeStrip.jsx']) {
      expect(fs.existsSync(path.join(root, dead))).toBe(false);
    }
  });

  test('StoriesScreen consumes deep-link state and clears it', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).toContain('location.state?.vibeUserId');
    expect(src).toContain('navigate(location.pathname, { replace: true, state: null })');
  });

  test('viewer has keyboard nav + unavailable state + aria labels', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).toContain("e.key === 'ArrowRight'");
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain('Vibe unavailable');
    expect(src).toContain('aria-label="Close Vibes viewer"');
  });
});

describe('Vibes master-spec: cost control (spec §57/58)', () => {
  test('analytics are buffered and flushed to shards, never per-tap doc writes', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(src).toContain('_analyticsBuffer');
    expect(src).toContain('flushAnalyticsBuffer');
    expect(src).toContain("'analytics_shards'");
    expect(src).not.toContain("'stats.forwardTaps': increment(1)");
    expect(src).not.toContain("'stats.completions': increment(1)");
  });

  test('aggregator rolls up analytics shards into stats', () => {
    const src = fs.readFileSync(path.join(root, 'functions/stories.js'), 'utf8');
    expect(src).toContain("doc.ref.collection('analytics_shards')");
    expect(src).toContain("'stats.completions': completions");
    expect(src).toContain("'stats.completionRate'");
  });
});

describe('Vibes scoring v2 (spec §37/38/39)', () => {
  test('feed scoring computes affinity (follow), remaining-time freshness, and per-creator diversity cap', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(src).toContain('followMap.set(cid, true)'); // relationship signal
    expect(src).toContain('const affinity = followMap.get(s.userId) ? 1 : 0.1;');
    expect(src).toContain('remainingFactor = 0.8 + 0.4 * fraction'); // freshness
    expect(src).toContain('MAX_STORIES_PER_CREATOR'); // diversity
    expect(src).toContain('const diverse = scored.filter(');
    expect(src).not.toContain('const score = recency * w.recency + engagement * w.engagement;'); // old no-affinity formula gone
  });
});

describe('Vibes analytics producers (spec §23/58)', () => {
  test('StoriesScreen reports completion and forward/back taps to the buffered service', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).toContain('reportStoryCompletion(currentItem.id)');
    expect(src).toContain("trackStoryAnalytics(currentItem.id, 'forward')");
    expect(src).toContain("trackStoryAnalytics(currentItem.id, 'back')");
  });
});

describe('Messaging saved messages (spec §33)', () => {
  test('rules: users/{uid}/saved_messages owner-scoped', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('match /users/{userId}/saved_messages/{messageId}');
  });

  test('service has save/unsave/isSaved/getSavedMessages with reference snapshots', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/messagesService.js'), 'utf8');
    expect(src).toContain('async saveMessage(conversationId, messageId, userId)');
    expect(src).toContain('async unsaveMessage(messageId, userId)');
    expect(src).toContain('async getSavedMessages(userId');
    expect(src).toContain("'users', userId, 'saved_messages'");
  });

  test('MessageBubble menu has Save/Unsave; ChatScreen wires it + Saved tab', () => {
    const bubble = fs.readFileSync(path.join(root, 'src/components/messaging/MessageBubble.jsx'), 'utf8');
    expect(bubble).toContain("{isSaved ? 'Unsave' : 'Save'}");
    const chat = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(chat).toContain('toggleSaveMessage');
    expect(chat).toContain("id: 'saved', label: 'Saved'");
  });
});

describe('Message requests (spec §35)', () => {
  test('rules: create by sender, respond by recipient only', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const block = rules.slice(rules.indexOf('match /message_requests'), rules.indexOf('match /message_requests') + 600);
    expect(block).toContain('request.resource.data.senderId == uid()');
    expect(block).toContain('resource.data.recipientId == uid()');
  });

  test('service: send/get/respond + idempotent deterministic id; privacy-block sends a request', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/messagesService.js'), 'utf8');
    expect(src).toContain('async sendMessageRequest(recipientId, senderId)');
    expect(src).toContain('async getMessageRequests(userId');
    expect(src).toContain('async respondToMessageRequest(');
    expect(src).toContain("'message_requests', `${recipientId}_${senderId}`");
    expect(src).toContain("reqErr.code = 'messaging/request-sent'");
  });

  test('MessagingScreen shows an Accept/Decline requests section', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/MessagingScreen.jsx'), 'utf8');
    expect(src).toContain('getMessageRequests(');
    expect(src).toContain('Message requests (');
    expect(src).toContain('handleRequestResponse(req.id, true)');
  });

  test('message_requests composite index exists', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
    const ok = idx.indexes.some((i) => i.collectionGroup === 'message_requests' &&
      i.fields.some((f) => f.fieldPath === 'recipientId') && i.fields.some((f) => f.fieldPath === 'status'));
    expect(ok).toBe(true);
  });
});

describe('Chat pagination (spec §15)', () => {
  test('ChatScreen has load-older with scroll-position preservation', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/ChatScreen.jsx'), 'utf8');
    expect(src).toContain('loadOlderMessages');
    expect(src).toContain('Load earlier messages');
    expect(src).toContain('el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop');
  });
});

describe('Vibes interactions are REAL (no toast-only fakes)', () => {
  test('StoriesScreen gift calls transferCoins (was toast-only free coins)', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).not.toContain("const monetization = getMonetizationService();\n    toast.success(`Sent 250");
    expect(src).toContain('transferCoins(');
    expect(src).toContain("'vibe_gift'");
    expect(src).toContain("You cannot gift yourself");
  });

  test('StoriesScreen reply calls replyToStory (was toast-only)', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).toContain('replyToStory(currentItem.id, text)');
    expect(src).not.toContain("toast.success(`Reply sent to ${currentStory?.user?.name}`);\n    setReplyText('');");
  });

  test('StoriesScreen reaction calls reactToStory (was toast-only)', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
    expect(src).toContain('reactToStory(currentItem.id, emoji)');
  });

  test('reactToStory no longer writes story-doc stats (rules: creator-only updates)', () => {
    const svc = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(svc).not.toContain("'stats.reactions.${oldReaction}'");
    expect(svc).not.toContain('transaction.update(storyRef, {');
  });

  test('replyToStory/commentOnStory increment analytics shards, not the story doc', () => {
    const svc = fs.readFileSync(path.join(root, 'src/services/storyService.js'), 'utf8');
    expect(svc).toContain("await this._incrementAnalyticsShard(storyId, 'replies', 1);");
    expect(svc).toContain("await this._incrementAnalyticsShard(storyId, 'comments', 1);");
  });

  test('aggregator rolls replies + comments into stats', () => {
    const fn = fs.readFileSync(path.join(root, 'functions/stories.js'), 'utf8');
    expect(fn).toContain("replies += d.replies || 0;");
    expect(fn).toContain("'stats.replies': replies");
  });

  test('shards are bounded counters writable by any signed-in user (aggregator owns doc stats)', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const block = rules.slice(rules.indexOf('match /stories/{storyId}'), rules.indexOf('match /archived_stories'));
    expect(block).toContain('match /view_shards/{shardId}');
    expect(block).toContain('match /reaction_shards/{shardId}');
    // Any signed-in user may increment the shards, but only within the shard's
    // known counter keys — arbitrary writes into the aggregation collections
    // are refused.
    expect(block).toContain('allow write: if isSignedIn() &&');
    expect(block).toMatch(/view_shards[\s\S]*?hasOnly\(\['count', 'updatedAt'\]\)/);
    expect(block).toMatch(/analytics_shards[\s\S]*?hasOnly\(\[/);
    // story-doc updates remain creator-only and exclude the moderation fields
    expect(block).toContain('allow update: if isSignedIn() && request.auth.uid == resource.data.userId &&');
    expect(block).toContain('allow delete: if isSignedIn() && request.auth.uid == resource.data.userId;');
    expect(block).toMatch(/hasAny\(\[\s*'moderationStatus'/);
  });
});

describe('CreateStory honest offline state (spec §53)', () => {
  test('queued publish shows honest offline message, not "shared to followers"', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/CreateStory.jsx'), 'utf8');
    expect(src).toContain("'Offline — saved as draft. Will publish when you are back online.'");
    expect(src).not.toContain("'Story shared to your followers! 🌟'");
    // Audience is now a real control: the payload sends the chosen visibility
    // (public/followers/private), never a hardcoded claim.
    expect(src).toMatch(/visibility:\s*audience/);
  });
});

describe('Account isolation (audit N002) - persisted identity cannot bleed accounts', () => {
  test('appStore never persists identity (no persist middleware at all)', () => {
    const src = fs.readFileSync(path.join(root, 'src/store/appStore.js'), 'utf8');
    // The mirror is memory-only; there is no persisted blob left that could
    // rehydrate account A's identity into account B's session.
    expect(src).not.toContain('persist(');
    expect(src).not.toContain('arvdoul-app-store');
  });

  test('getStoredUser refuses a cached user blob from a different session uid', () => {
    const src = fs.readFileSync(path.join(root, 'src/utils/security.js'), 'utf8');
    expect(src).toContain("localStorage.getItem('arvdoul_uid')");
    expect(src).toContain('parsed.uid !== sessionUid');
  });

  test('profile screens prefer the live auth user over the store mirror', () => {
    for (const rel of [
      'src/screens/Profile/HighlightsScreen.jsx',
      'src/screens/Profile/CreatorDashboardScreen.jsx',
    ]) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('const currentUser = authUser || storeUser;');
      expect(src).not.toContain('const currentUser = storeUser || authUser;');
    }
  });

  test('the delegating connections screens do not re-derive identity', () => {
    // Followers/Following/Friends only choose a tab; ConnectionsScreen itself
    // resolves the viewer from the live auth context, so passing a store-mirror
    // `currentUser` prop was dead and a N002 regression risk.
    for (const rel of [
      'src/screens/Profile/FollowersScreen.jsx',
      'src/screens/Profile/FollowingScreen.jsx',
      'src/screens/Profile/FriendsScreen.jsx',
    ]) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).not.toContain('currentUser={');
      expect(src).not.toContain('storeUser');
    }
    const connections = fs.readFileSync(path.join(root, 'src/screens/Profile/ConnectionsScreen.jsx'), 'utf8');
    expect(connections).toContain('const currentUser = authUser || storeUser');
  });
});

describe('Auth - signup never grants fabricated coins/levels', () => {
  test('authService creates profiles without a hardcoded starting balance', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/authService.js'), 'utf8');
    expect(src).not.toContain('coins: 50');
    expect(src).not.toContain('coins: profile.coins || 50');
    expect(src).not.toContain('coins: profile?.coins || 50');
    expect(src).not.toContain('coins: profile.coins || 0');
  });
});

describe('Monetization - canonical level curve (no duplicated drift)', () => {
  test('monetizationService reads LEVELS from the shared levelConfig', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');
    // The import must carry the canonical LEVELS table (aliased) plus the
    // shared helpers it actually uses; do not re-import symbols that are dead.
    expect(src).toMatch(
      /import \{ LEVELS as CANONICAL_LEVELS,[^}]*?GIFT_CATALOG,[^}]*?getLevelInfo \} from ['"]\.\.\/shared\/levelConfig\.cjs['"];/
    );
    expect(src).toContain('LEVELS: CANONICAL_LEVELS,');
    expect(src).not.toContain('{ level: 2, xpRequired: 100, coinReward: 10 },');
  });
});

describe('Wallet - real purchase + canonical economics', () => {
  test('WalletScreen wires the real PaymentModal contract and purchaseCoins', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Economy/WalletScreen.jsx'), 'utf8');
    expect(src).toContain('monetizationService.purchaseCoins(paymentPkg.id, paymentMethodId)');
    expect(src).toContain('onConfirm={confirmPurchase}');
    expect(src).not.toContain('onSuccess={() => {');
  });

  test('WalletScreen withdrawal threshold derives from the shared coin->USD helper', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Economy/WalletScreen.jsx'), 'utf8');
    expect(src).toContain('const MIN_WITHDRAWAL_USD = coinsToUsd(MIN_WITHDRAWAL_COINS).toFixed(2);');
    expect(src).not.toContain('placeholder="Coins to withdraw (min 5,000)"');
  });
});

describe('Video service - no synthetic creator identity', () => {
  test('videoService never invents an author name/handle/title', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/videoService.js'), 'utf8');
    expect(src).not.toContain("'Arvdoul Creator'");
    expect(src).not.toContain("'ARVDOUL Video'");
    expect(src).not.toContain("username: item.authorUsername || 'creator'");
  });

  test('VideoCard no longer hardcodes a person name as the avatar alt', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Videos/VideoCard.jsx'), 'utf8');
    expect(src).not.toContain("'Abdulrahman'");
  });
});

describe('Passport - no synthetic holder identity', () => {
  test('passportService reports an absent displayName as null', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/passportService.js'), 'utf8');
    expect(src).not.toContain("'Citizen of Arvdoul'");
    // The passport reads the projected profile, so the invariant is now pinned to
    // the projected variable — still no synthetic fallback for an absent name.
    expect(src).toContain('pickDisplayName([projected.displayName, projected.name], { fallback: null })');
  });
});

describe('PostCard / CommentsDrawer - live-session identity only', () => {
  test('no fabricated local_user identity is written from localStorage', () => {
    const card = fs.readFileSync(path.join(root, 'src/screens/PostCard.jsx'), 'utf8');
    expect(card).not.toContain("'local_user'");
    expect(card).toContain('const userId = currentUser?.uid || null;');

    const drawer = fs.readFileSync(path.join(root, 'src/screens/CommentsDrawer.jsx'), 'utf8');
    expect(drawer).not.toContain("displayName: 'You'");
    expect(drawer).toContain("toast.error('Please sign in to comment');");
  });
});

describe('VideoAnalytics RevenueTab - real payout wiring', () => {
  test('uses walletService for balances and monetizationService for payout settings', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/VideoAnalyticsScreen.jsx'), 'utf8');
    expect(src).toContain("import('../services/walletService.js')");
    expect(src).toContain("import('../services/monetizationService.js')");
    expect(src).toContain('walletService.getWalletOverview(user.uid)');
    expect(src).not.toContain('monSvc.getWalletOverview');
  });
});


describe('Profile level - no fabricated Level 1 / Citizen standing', () => {
  test('ProfileFeedGrid uses the canonical name/avatar helpers, not a Citizen stub', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/profile/ProfileFeedGrid.jsx'), 'utf8');
    // The feed fabricated an author name ('Citizen') and rendered the raw avatar
    // URL, bypassing the placeholder-rejection and fallback the read model owns.
    expect(src).not.toContain("|| 'Citizen'");
    expect(src).toContain('pickDisplayName([profile?.displayName, item.authorName]');
    expect(src).toContain('resolveAvatarUrl(');
  });

  test('ProfileHeroSection does not invent a level or rank when none is stored', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/profile/ProfileHeroSection.jsx'), 'utf8');
    expect(src).not.toMatch(/return \{ level: 1, title: 'Citizen'/);
    expect(src).not.toMatch(/\(\) => 'Citizen'/);
  });

  test('ProfilePublicScreen does not default a missing level to 1', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Profile/ProfilePublicScreen.jsx'), 'utf8');
    expect(src).not.toContain('Number(profileData.level) || 1');
    expect(src).not.toContain('effectiveProfile.level || 1');
  });

  test('citizenship surfaces render an em-dash, not a fabricated tier/rank', () => {
    // The citizenship card and roadmap modal defaulted a missing rank/tier to a
    // concrete standing ('Arrival' / 'Citizen'), which is the same class of
    // fabrication as a `|| 1` level default: it asserts standing the profile
    // does not have.
    const card = fs.readFileSync(path.join(root, 'src/components/profile/ProfileCitizenshipCard.jsx'), 'utf8');
    expect(card).not.toContain("passport.rankTitle || 'Arrival'");
    expect(card).toContain("passport.rankTitle || '—'");

    const roadmap = fs.readFileSync(path.join(root, 'src/components/profile/ProfileSystemRoadmapModal.jsx'), 'utf8');
    expect(roadmap).not.toContain("currentCitizenTier?.tier || 'Citizen'");
    expect(roadmap).toContain("currentCitizenTier?.tier || '—'");
    expect(roadmap).not.toContain("currentCitizenTier?.icon || '🏛️'");
  });

  test('ProfileFeaturedSection does not declare an unused capabilities prop', () => {
    // The prop was threaded through the public screen but never read inside the
    // component - a dead prop that implied a gate that did not exist.
    const src = fs.readFileSync(path.join(root, 'src/components/profile/ProfileFeaturedSection.jsx'), 'utf8');
    expect(src).not.toContain('capabilities');
  });

  test('surfaces render the canonical name/handle helpers, not a Citizen stub', () => {
    // TopAppBar and ConnectionsScreen invented a 'Citizen'/'citizen' identity
    // whenever the real display name/handle was missing, and AboutScreen printed
    // 'Citizen' as a rank. All three now use the read model (or an em-dash).
    const bar = fs.readFileSync(path.join(root, 'src/components/Shared/TopAppBar.jsx'), 'utf8');
    expect(bar).toContain('pickDisplayName');
    expect(bar).not.toContain("effectiveUser?.displayName || 'Citizen'");
    expect(bar).not.toContain("|| 'citizen'");

    const conn = fs.readFileSync(path.join(root, 'src/screens/Profile/ConnectionsScreen.jsx'), 'utf8');
    expect(conn).toContain('pickDisplayName');
    expect(conn).not.toContain("citizen.displayName || 'Citizen'");
    expect(conn).not.toContain("citizen.username || 'citizen'");

    const about = fs.readFileSync(path.join(root, 'src/screens/Profile/AboutScreen.jsx'), 'utf8');
    expect(about).not.toContain("rankTitle || 'Citizen'");
  });
});

describe('Analytics view dedupe is transactional and server-authoritative (N019/N010)', () => {
  test('client trackProfileView delegates to the callable, never writes Firestore', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/analyticsService.js'), 'utf8');
    const body = src.slice(src.indexOf('async trackProfileView'), src.indexOf('async getCreatorRanking'));
    expect(body).toContain('FUNCTIONS.TRACK_PROFILE_VIEW');
    // The client must not touch the analytics collections directly.
    expect(body).not.toContain("'profile_views'");
    expect(body).not.toContain("'profile_analytics'");
  });

  test('rules deny all client writes to profile_views and profile_analytics', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const blockFor = (name) => {
      const start = rules.indexOf(`match /${name}/`);
      return rules.slice(start, rules.indexOf('match /', start + 10));
    };
    for (const name of ['profile_views', 'profile_analytics']) {
      const block = blockFor(name);
      expect(block).toContain('allow write: if false;');
      expect(block).not.toMatch(/allow create:\s*if isSignedIn/);
    }
  });

  test('trackProfileView callable owns the dedupe transaction and the counter shards', () => {
    const src = fs.readFileSync(path.join(root, 'functions/analytics.js'), 'utf8');
    expect(src).toContain('db.runTransaction');
    expect(src).toContain('getUserIdFromContext');
    expect(src).toContain('checkRateLimit');
    expect(src).toContain("'counter_shards'");
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    expect(index).toContain("require('./analytics.js')");
  });

  test('server and client derive counter shard ids identically (byte-identical hash + shard count)', () => {
    // AGENTS.md: the server shard key must stay byte-identical to hashString()
    // in src/utils/CountersManager.js because the client SUMS counter_shards on
    // read. A guard that merely greps for `5381` does not catch a drifted
    // algorithm, a different modulus, or a changed shard count — any of which
    // makes client and server write/read different documents and the counter
    // silently wrong. Extract the real function bodies and the shard counts and
    // compare them exactly.
    const client = fs.readFileSync(path.join(root, 'src/utils/CountersManager.js'), 'utf8');
    const server = fs.readFileSync(path.join(root, 'functions/analytics.js'), 'utf8');

    const extractFn = (src, name) => {
      const m = src.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`));
      return m && m[0].replace(/\s+/g, ' ').trim();
    };
    const clientHash = extractFn(client, 'hashString');
    const serverHash = extractFn(server, 'hashString');
    expect(clientHash).toBeTruthy();
    expect(serverHash).toBe(clientHash);

    const extractInt = (src, patterns) => {
      for (const re of patterns) {
        const m = src.match(re);
        if (m) return Number(m[1]);
      }
      return null;
    };
    const clientShards = extractInt(client, [/shards\s*=\s*(\d+)/]);
    const serverShards = extractInt(server, [/COUNTER_SHARDS\s*=\s*(\d+)/]);
    expect(clientShards).toBe(serverShards);

    // The shard document id layout must match too: `${hash}__${field}__${index}`.
    const layout = (src) => {
      const m = src.match(/`\$\{hashString\([^`]*?\)\}__\$\{[^}]*\}__\$\{[^}]*\}`/);
      return m && m[0];
    };
    expect(layout(server)).toBeTruthy();
    expect(layout(server)).toBe(layout(client));
  });
});

describe('Offline sync - single canonical queue instance (N014)', () => {
  test('syncEngine re-exports the shared queue instead of constructing its own', () => {
    const src = fs.readFileSync(path.join(root, 'src/offline/syncEngine.js'), 'utf8');
    expect(src).not.toContain('new OfflineQueue()');
    expect(src).toContain("from '../utils/OfflineQueue'");
  });
});

describe('Audit logging - real action + metadata (not a swapped signature)', () => {
  test('every auditLogger.log call passes the action string first', () => {
    const walk = (dir) => {
      let out = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out = out.concat(walk(full));
        else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
      }
      return out;
    };
    const offenders = [];
    for (const file of walk(path.join(root, 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      const re = /auditLogger\.log\(\s*([^\n]*)/g;
      let m;
      while ((m = re.exec(src))) {
        const firstArg = m[1].trim();
        if (!/^['"]/.test(firstArg)) {
          offenders.push(`${path.relative(root, file)}: ${firstArg.slice(0, 40)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('admin screens no longer pass an actor email into audit metadata', () => {
    const adminDir = path.join(root, 'src/screens/Admin');
    for (const file of fs.readdirSync(adminDir)) {
      const src = fs.readFileSync(path.join(adminDir, file), 'utf8');
      expect(src).not.toMatch(/actorEmail:/);
    }
  });
});

describe('Admin economy - real data, server-side settlement', () => {
  const screen = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminEconomyScreen.jsx'), 'utf8');

  test('renders no seeded treasury figures or fake creators', () => {
    const src = screen();
    for (const seed of ['4825900', '144777', 'usr_sarah_craft', 'leo.sound@example.com', 'payout-101', 'tx-901']) {
      expect(src).not.toContain(seed);
    }
  });

  test('never writes a payout status directly from the client', () => {
    const src = screen();
    expect(src).not.toMatch(/updateDoc\(\s*doc\([^)]*payout_requests/);
    expect(src).not.toContain("'payout_requests'");
    const adminSvc = fs.readFileSync(path.join(root, 'src/services/adminService.js'), 'utf8');
    expect(adminSvc).toContain("'withdrawal_requests'");
  });

  test('approve/reject go through the admin settlement callable', () => {
    const src = screen();
    expect(src).toContain('FUNCTIONS.ADMIN_DECIDE_WITHDRAWAL');
    expect(src).toContain('FUNCTIONS.GET_ECONOMY_SUMMARY');
  });

  test('the Stripe settlement path exists exactly once', () => {
    const settlement = fs.readFileSync(path.join(root, 'functions/withdrawalSettlement.js'), 'utf8');
    expect(settlement).toContain('stripe.payouts.create');
    const monetization = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(monetization).not.toContain('stripe.payouts.create');
    expect(monetization).toContain("require('./withdrawalSettlement')");
  });

  test('admin callables for the economy are exported', () => {
    const admin = fs.readFileSync(path.join(root, 'functions/admin.js'), 'utf8');
    expect(admin).toContain('exports.getEconomySummary =');
    expect(admin).toContain('exports.adminDecideWithdrawal =');
  });
});

describe('Admin system health - measured telemetry only', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminSystemHealthScreen.jsx'), 'utf8');

  test('no hardcoded uptime or latency figures', () => {
    const s = src();
    for (const seed of ['99.98%', '99.95%', '99.90%', '99.99%', 'latency: 42', 'latency: 28', 'latency: 85']) {
      expect(s).not.toContain(seed);
    }
    expect(s).not.toContain('All Systems Operational');
  });

  test('no random latency estimates', () => {
    const s = src();
    expect(s).not.toMatch(/Math\.random\(\)\s*\*\s*20/);
    expect(s).not.toMatch(/s\.latency \* \(0\.9/);
  });

  test('uses the RUM service for real web vitals', () => {
    expect(src()).toContain('rumService.getWebVitals()');
  });
});

describe('Admin community governance - live directory, server-authoritative', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminCommunityManagementScreen.jsx'), 'utf8');

  test('renders no seeded community directory', () => {
    const s = src();
    for (const seed of ['comm-101', 'comm-102', 'comm-103', 'comm-104', 'usr_crypto_bot', 'quick-arbitrage-alerts']) {
      expect(s).not.toContain(seed);
    }
  });

  test('reads and mutates through the admin callables, never direct writes', () => {
    const s = src();
    expect(s).toContain('FUNCTIONS.ADMIN_LIST_COMMUNITIES');
    expect(s).toContain('FUNCTIONS.ADMIN_SET_COMMUNITY_VERIFIED');
    expect(s).toContain('FUNCTIONS.ADMIN_ISSUE_COMMUNITY_STRIKE');
    expect(s).not.toMatch(/updateDoc\(\s*doc\([^)]*'communities'/);
  });

  test('community governance callables are exported server-side', () => {
    const admin = fs.readFileSync(path.join(root, 'functions/admin.js'), 'utf8');
    expect(admin).toContain('exports.adminListCommunities =');
    expect(admin).toContain('exports.adminSetCommunityVerified =');
    expect(admin).toContain('exports.adminIssueCommunityStrike =');
  });
});

describe('Admin creator verification - live queue, server-authoritative', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminVerificationScreen.jsx'), 'utf8');

  test('renders no seeded applicant queue', () => {
    const s = src();
    for (const seed of ['verif-201', 'verif-202', 'verif-203', 'verif-204', 'usr_sarah_craft', '@sarahcraft']) {
      expect(s).not.toContain(seed);
    }
  });

  test('decisions go through applyVerificationDecision, not direct user writes', () => {
    const s = src();
    expect(s).toContain('FUNCTIONS.APPLY_VERIFICATION_DECISION');
    expect(s).not.toMatch(/updateDoc\(\s*doc\([^)]*'users'/);
    expect(s).not.toMatch(/updateDoc\(\s*doc\([^)]*'creator_verifications'/);
  });

  test('requirements come from the shared profile contract', () => {
    expect(src()).toContain('CREATOR_VERIFICATION_REQUIREMENTS');
  });
});

describe('Admin support tickets - persisted replies only', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminSupportTicketsScreen.jsx'), 'utf8');

  test('agent replies go through the admin callable, not a client write', () => {
    const s = src();
    expect(s).toContain('FUNCTIONS.ADMIN_RESOLVE_SUPPORT_TICKET');
    expect(s).toContain('FUNCTIONS.ADMIN_LIST_SUPPORT_TICKETS');
    expect(s).not.toMatch(/updateDoc\(\s*doc\([^)]*'support_tickets'/);
    expect(s).not.toContain("utils/AuditLogger.js");
    const admin = fs.readFileSync(path.join(root, 'functions', 'admin.js'), 'utf8');
    expect(admin).toContain('adminResolveSupportTicket');
    expect(admin).toContain("writeAudit(actorUid, 'support_ticket_updated'");
  });
});

describe('Admin audit logs - real server-written trail', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminAuditLogsScreen.jsx'), 'utf8');

  test('reads the collection the server actually writes to', () => {
    const adminSvc = fs.readFileSync(path.join(root, 'src/services/adminService.js'), 'utf8');
    expect(adminSvc).toContain("_readCollection('moderation_logs'");
    expect(adminSvc).not.toContain("'audit_logs'");
    const admin = fs.readFileSync(path.join(root, 'functions/admin.js'), 'utf8');
    expect(admin).toContain("db.collection('moderation_logs').add(");
  });
});

describe('Admin screens - server-authoritative admin gate', () => {
  test('admin screens never read the unreadable admins collection', () => {
    for (const file of [
      'AdminDashboardScreen.jsx',
      'AdminContentManagementScreen.jsx',
      'AdminModerationQueueScreen.jsx',
    ]) {
      const s = fs.readFileSync(path.join(root, 'src/screens/Admin', file), 'utf8');
      expect(s).not.toMatch(/getDoc\(\s*doc\(firestore, 'admins'/);
      expect(s).toContain('fetchAdminStatus');
    }
  });

  test('moderation decisions go through the resolve callable', () => {
    const s = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminModerationQueueScreen.jsx'), 'utf8');
    expect(s).toContain('FUNCTIONS.RESOLVE_USER_REPORT');
    expect(s).not.toMatch(/updateDoc\(\s*doc\(firestore, collectionName/);
  });

  test('a denied admin sees a denial state, never an empty dashboard', () => {
    // AdminDashboardScreen held the denial in `error` but never rendered it, so
    // a non-admin (or a failed count query) saw a full grid of zeros that read
    // like real, empty platform data. Every admin surface must render the
    // denial explicitly.
    for (const file of [
      'AdminDashboardScreen.jsx',
      'AdminContentManagementScreen.jsx',
      'AdminModerationQueueScreen.jsx',
    ]) {
      const s = fs.readFileSync(path.join(root, 'src/screens/Admin', file), 'utf8');
      expect(s).toContain('Access Denied');
    }
    const dash = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminDashboardScreen.jsx'), 'utf8');
    expect(dash).toMatch(/if \(error\)/);
    expect(dash).toContain('{error}');
  });
});

describe('Admin feature flags - platform-wide, server-authoritative', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/screens/Admin/AdminFeatureFlagsScreen.jsx'), 'utf8');

  test('platform toggles go through the governance callable', () => {
    const s = src();
    expect(s).toContain('FUNCTIONS.SET_FEATURE_FLAG_OVERRIDE');
    expect(s).toContain('FUNCTIONS.GET_FEATURE_FLAG_OVERRIDES');
    expect(s).not.toContain("from '../../utils/AuditLogger.js'");
  });

  test('the flag registry lives in the shared module only', () => {
    const service = fs.readFileSync(path.join(root, 'src', 'services', 'featureFlagService.js'), 'utf8');
    expect(service).toContain("from '../shared/featureFlagRegistry.cjs'");
    expect(service).not.toContain("'feed.ml_ranking': {");
    const server = fs.readFileSync(path.join(root, 'functions', 'featureFlags.js'), 'utf8');
    expect(server).toContain("require('./featureFlagRegistry.cjs')");
    expect(server).toContain('isKnownFlag');
  });

  test('the server module is required by index.js and audited', () => {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    expect(index).toContain("require('./featureFlags.js')");
    // Flag governance reuses the canonical admin helper and audit writer
    // instead of re-declaring an isAdmin check or a second audit collection.
    const server = fs.readFileSync(path.join(root, 'functions', 'featureFlags.js'), 'utf8');
    expect(server).toContain("require('./auth')");
    expect(server).toContain("require('./admin')");
    expect(server).not.toContain("collection('admins')");
    const admin = fs.readFileSync(path.join(root, 'functions', 'admin.js'), 'utf8');
    expect(admin).toContain('module.exports.writeAudit = writeAudit');
  });
});

describe('Audio Studio - real graph, no invented signal', () => {
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

  test('the engine meters and positions come from the AudioContext, not Math.random', () => {
    const engine = read('src/screens/AudioEditor/audioEngine.js');
    expect(engine).not.toContain('Math.random');
    expect(engine).toContain('createBiquadFilter');
    expect(engine).toContain('getFloatTimeDomainData');
    expect(engine).toContain('createStereoPanner');
    expect(engine).toContain('getPosition()');
  });

  test('the studio starts empty instead of seeding demo tracks', () => {
    const screen = read('src/screens/AudioEditor/AudioEditorScreen.jsx');
    expect(screen).not.toContain('INITIAL_STUDIO_TRACKS');
    expect(screen).toContain('audioStudioEngine');
    for (const seed of ['Lead Verse 1', 'Grand Chords', 'Drum Kit & 808', 'Sub & Slap Bass']) {
      expect(screen).not.toContain(seed);
    }
  });

  test('the console draws real peaks and reports a missing waveform honestly', () => {
    const consoleSrc = read('src/screens/AudioEditor/components/MultiTrackConsole.jsx');
    expect(consoleSrc).toContain('computePeaks');
    expect(consoleSrc).toContain('Waveform unavailable');
    expect(consoleSrc).not.toContain('Math.sin(idx');
    expect(consoleSrc).not.toContain('INITIAL_STUDIO_TRACKS');
  });

  test('meters and spectrum read the engine rather than animating randomly', () => {
    const transport = read('src/screens/AudioEditor/components/TransportBar.jsx');
    const eq = read('src/screens/AudioEditor/components/EqualizerModule.jsx');
    const inspector = read('src/screens/AudioEditor/components/ClipInspectorModule.jsx');
    for (const src of [transport, eq, inspector]) {
      expect(src).not.toContain('Math.random');
      expect(src).toContain('audioStudioEngine');
    }
    expect(transport).toContain('getMeter');
    expect(eq).toContain('getPresetBands');
  });

  test('the header never claims an export succeeded on a timer', () => {
    const header = read('src/screens/AudioEditor/components/StudioHeader.jsx');
    expect(header).not.toContain('setTimeout');
    expect(header).not.toContain('exported successfully');
    expect(header).toContain('isExporting');
  });

  test('EQ presets live in one shared table', () => {
    const presets = read('src/screens/AudioEditor/audioPresets.js');
    expect(presets).toContain('export const EQ_PRESET_NAMES');
    expect(presets).toContain('export function getPresetBands');
  });
});

describe('Admin support desk - server-authoritative', () => {
  test('support list/reply callables exist and are wired into the callable service', () => {
    const admin = fs.readFileSync(path.join(root, 'functions', 'admin.js'), 'utf8');
    expect(admin).toContain('exports.adminListSupportTickets');
    expect(admin).toContain('exports.adminResolveSupportTicket');
    const svc = fs.readFileSync(path.join(root, 'src/services/callableService.js'), 'utf8');
    expect(svc).toContain("ADMIN_LIST_SUPPORT_TICKETS: 'adminListSupportTickets'");
    expect(svc).toContain("ADMIN_RESOLVE_SUPPORT_TICKET: 'adminResolveSupportTicket'");
  });
});

describe('Admin moderation queue - reads the whole routing table', () => {
  test('the server lists every report collection including post/story/ad', () => {
    const admin = fs.readFileSync(path.join(root, 'functions', 'admin.js'), 'utf8');
    expect(admin).toContain('exports.adminListModerationReports');
    for (const collection of ['post_reports', 'story_reports', 'ad_reports']) {
      expect(admin).toContain(`${collection}`);
    }
    const screen = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminModerationQueueScreen.jsx'), 'utf8');
    expect(screen).toContain('FUNCTIONS.ADMIN_LIST_MODERATION_REPORTS');
  });

  test('content removal goes through the callable, not a direct posts write', () => {
    const admin = fs.readFileSync(path.join(root, 'functions', 'admin.js'), 'utf8');
    expect(admin).toContain('exports.adminModerateContent');
    expect(admin).toContain("post: 'posts'");
    const screen = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminContentManagementScreen.jsx'), 'utf8');
    expect(screen).toContain('FUNCTIONS.ADMIN_MODERATE_CONTENT');
    expect(screen).not.toContain('updateDoc');
  });
});

describe('Sponsored ads - no fabricated advertisers', () => {
  const src = () => fs.readFileSync(path.join(root, 'src/components/Ads/SponsoredPostCard.jsx'), 'utf8');

  test('no hardcoded sponsor catalogue and no random fallback', () => {
    const s = src();
    expect(s).not.toContain('VERIFIED_SPONSORS');
    expect(s).not.toContain('Math.random');
    expect(s).toContain("adState === 'loading'");
  });

  test('reporting an ad goes through the server callable', () => {
    expect(src()).toContain('reportAd');
    const svc = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');
    expect(svc).toContain('async reportAd(');
    expect(svc).toContain('FUNCTIONS.REPORT_AD');
    expect(svc).not.toMatch(/addDoc\(collection\(this\.db, 'ad_impressions'/);
    const server = fs.readFileSync(path.join(root, 'functions', 'monetization.js'), 'utf8');
    expect(server).toContain('exports.reportAd');
  });

  test('ad_reports is covered by firestore rules', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('match /ad_reports/{reportId}');
  });
});

describe('Curated sample content - removed in favour of real data', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('in-feed stories render only real story groups', () => {
    const s = read('src/components/feed/InFeedStoriesModule.jsx');
    expect(s).not.toContain('DEFAULT_STORY_CREATORS');
    expect(s).not.toContain('images.unsplash.com');
  });

  test('notifications suggestions have no fabricated creators or badge counts', () => {
    const s = read('src/screens/NotificationsScreen.jsx');
    expect(s).not.toContain('CURATED_CREATORS');
    expect(s).not.toContain('images.unsplash.com');
    expect(s).not.toMatch(/id: 'Messages', label: 'Messages', badge:/);
  });

  test('story composer has no fabricated default track or "Drafts (5)" strip', () => {
    const s = read('src/screens/CreateStory.jsx');
    expect(s).not.toContain('Lost in the City');
    expect(s).not.toContain('SAMPLE_DRAFTS');
    expect(s).not.toContain('Drafts (5)');
    expect(s).toContain('soundService.getTrendingSounds');
  });

  test('reels have no starter sparks and no hardcoded like count', () => {
    const s = read('src/screens/ReelsScreen.jsx');
    expect(s).not.toContain('STARTER_SPARKS');
    expect(s).not.toContain('128.4K');
    expect(s).not.toContain('images.unsplash.com');
  });

  test('splash progress is milestone-driven, not random', () => {
    const s = read('src/screens/SplashScreen.jsx');
    expect(s).not.toContain('Math.random');
    expect(s).not.toContain('statusSequence');
  });

  test('voice recorder meter reads the real microphone, not random bars', () => {
    const s = read('src/screens/VideoEditor/components/RecordVoiceModal.jsx');
    expect(s).not.toContain('Math.random');
    expect(s).toContain('createAnalyser');
  });

  test('edit profile has no random username fallback', () => {
    const s = read('src/screens/Profile/EditProfileScreen.jsx');
    expect(s).not.toContain('Math.floor(1000 + Math.random()');
  });
});

describe('Reels - canonical service ownership, no direct Firestore', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('ReelsScreen reads the feed through videoService and never writes Firestore directly', () => {
    const s = read('src/screens/ReelsScreen.jsx');
    expect(s).not.toContain("from 'firebase/firestore'");
    expect(s).not.toContain('collection(db');
    expect(s).not.toContain('updateDoc(');
    expect(s).toContain('videoService.getVideoFeed');
    // Likes/shares are server-authoritative through the service callables.
    expect(s).toContain('videoService.likeVideo');
    expect(s).toContain('videoService.shareVideo');
  });

  test('ReelsScreen honours the playback.autoPlayVideos setting', () => {
    const s = read('src/screens/ReelsScreen.jsx');
    expect(s).toContain('autoPlayVideos');
    expect(s).toMatch(/autoPlay=\{autoPlayEnabled\}/);
  });
});

describe('CreateStory - creative tools write real payload fields', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('story payload carries stickers, link, location and tagged users', () => {
    const s = read('src/screens/CreateStory.jsx');
    expect(s).toContain('linkUrl:');
    expect(s).toContain('location:');
    expect(s).toContain('taggedUsers:');
    expect(s).toContain('buildStickers');
    // The dead Draw tool (no compositing pipeline) must not be advertised.
    expect(s).not.toContain("id: 'draw'");
    // Flash drives the real camera torch instead of a cosmetic toast.
    expect(s).toContain('applyConstraints');
    expect(s).toContain('getCapabilities');
  });
});

describe('Action wiring - buttons call the real service signature', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('draft cloud sync uses the real firestoreService signature', () => {
    const s = read('src/screens/CreatePost.jsx');
    // saveDraft(draftId, userId, draftData); get/deleteDraft(draftId).
    expect(s).toContain('saveDraft(draft.id, userRef.current.uid, draft)');
    expect(s).toContain('getDraft(draftId)');
    expect(s).toContain('deleteDraft(draftId)');
    // The old calls passed (userId, draft) / (userId, draftId) and were silently
    // swallowed, so drafts never synced.
    expect(s).not.toContain('saveDraft(userRef.current.uid, draft)');
    expect(s).not.toContain("typeof services.current.firestore.saveDraft === 'function'");
  });

  test('ad reporting calls reportAd directly instead of gating on a typeof check', () => {
    const s = read('src/components/Ads/SponsoredPostCard.jsx');
    expect(s).toContain('getMonetizationService().reportAd(ad.id, placement)');
    expect(s).not.toContain('Reporting is unavailable right now.');
  });

  test('username generation calls the service without a dead capability guard', () => {
    const s = read('src/screens/Profile/EditProfileScreen.jsx');
    expect(s).toContain('userService.generateUniqueUsername(cleanBase, userProfile?.uid)');
    expect(s).not.toContain('Username generation is unavailable right now.');
  });
});


describe('Watch XP - the milestone award is real and server-authoritative', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('VideoCard awards through the level service, not an unpassed callback', () => {
    const s = read('src/screens/PostCard/VideoCard.jsx');
    // The component used to call onXpEarned?.() with hardcoded xp values, but
    // PostCard never passed the prop, so watching a video awarded nothing.
    expect(s).not.toContain('onXpEarned');
    expect(s).toContain("action: 'video_watched'");
    expect(s).toContain('levelSystemService.awardExperience({ userId: currentUser.uid');
    // No hardcoded XP amounts may remain in the card.
    expect(s).not.toMatch(/reason: 'watch_\d+', xp: \d+/);
  });

  test('video_watched resolves to a shared XP rule, never a component literal', () => {
    const rule = XP_RULES.video_watched;
    expect(rule).toBeDefined();
    expect(rule.xp).toBeGreaterThan(0);
    expect(rule.dailyCap).toBeGreaterThanOrEqual(rule.xp);
  });
});

describe('Rewarded ads - real inventory only, no invented sponsor or reward', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('monetizationService.getAd never fabricates a default campaign', () => {
    const s = read('src/services/monetizationService.js');
    expect(s).not.toContain('Discover Arvdoul Premium');
    expect(s).not.toContain("ad_${placement}_default");
    // No inventory means null, and the fallback query is placement-scoped.
    expect(s).toContain('return null;');
    expect(s).toContain("where('placements', 'array-contains', placement)");
  });

  test('watchAd credits a reward only for a real, active campaign', () => {
    const s = read('functions/monetization.js');
    expect(s).toContain("collection('ads').doc(adId).get()");
    expect(s).toContain("ad.active !== true");
    expect(s).toContain('MAX_AD_WATCH_SECONDS');
    expect(s).toContain('Math.min(Number(watchDurationSeconds), MAX_AD_WATCH_SECONDS)');
  });

  test('HomeScreen resolves a real ad and never claims a hardcoded ad id', () => {
    const s = read('src/screens/HomeScreen.jsx');
    expect(s).not.toContain("watchAd('feed_reward', 'rewarded_ad'");
    expect(s).toContain("watchAd('home', rewardAd.id");
    expect(s).toContain('+{AD_REWARD_COINS}');
    expect(s).not.toContain('+15 Free Coins');
    expect(s).not.toContain('Arvdoul Creator Rewards');
  });

  test('SponsoredPostCard renders real creative fields and the shared reward', () => {
    const s = read('src/components/Ads/SponsoredPostCard.jsx');
    expect(s).not.toContain('ad.rewardCoins || 5');
    expect(s).toContain('AD_REWARD_COINS');
    expect(s).toContain('adMediaUrl');
    expect(s).toContain('adClickUrl');
  });

  test('sponsored stories claim no coin reward and track a real impression', () => {
    const s = read('src/screens/StoriesScreen.jsx');
    // There is no server story-reward path, so the UI must not promise coins
    // nor call a monetization method that does not exist.
    expect(s).not.toContain('rewardCoins');
    expect(s).not.toContain('recordAdClick');
    expect(s).not.toContain('ARVDOUL Coins credited');
    expect(s).toContain("recordAdImpression(currentStory.id, 'stories_click')");
  });

  test('story ad impressions go through the server-authoritative callable', () => {
    const s = read('src/services/storyService.js');
    expect(s).toContain("getMonetizationService().recordAdImpression(adId, 'stories'");
    // ad_impressions is server-write-only: no direct client addDoc/updateDoc.
    expect(s).not.toContain("collection(this.firestore, 'ad_impressions')");
    expect(s).not.toContain('_logSponsoredStory');
    expect(s).not.toContain('lastAdImpression: serverTimestamp()');
  });

  test('feed/conversation ads use the real creative shape and no random ids', () => {
    const feed = read('src/services/feedService.js');
    expect(feed).toContain("ad.media?.url");
    expect(feed).not.toContain("ad.title || 'Sponsored'");
    const msgs = read('src/services/messagesService.js');
    expect(msgs).toContain('ad.title || adName');
    expect(msgs).not.toContain('impressionId: `imp_');
    expect(msgs).not.toContain('AD_REWARD_COINS: 2');
  });

  test('monetizationService defines no shadow subscription/ad reward tables', () => {
    const s = read('src/services/monetizationService.js');
    // The canonical tiers live in shared/levelConfig.cjs; a second table here
    // (PREMIUM/CREATOR/ENTERPRISE) contradicted the shared config.
    expect(s).not.toContain('SUBSCRIPTION_TIERS: {');
    expect(s).not.toContain('AD_REWARD_COINS: {');
  });

  test('a queued purchase/ad reports offlineQueued, never success', () => {
    // Returning `success: true` for a queued op made the UI announce "+N coins"
    // for coins the server never granted (a queued op may never replay).
    const s = read('src/services/monetizationService.js');
    const queuedSuccess = s.match(/success: true, offlineQueued: true/g) || [];
    const queuedNeutral = s.match(/success: false, offlineQueued: true/g) || [];
    expect(queuedSuccess.length).toBe(0);
    expect(queuedNeutral.length).toBeGreaterThanOrEqual(2); // purchaseCoins + watchAd
  });

  test('progression is never fabricated as Level 1 when absent', () => {
    // Audit N005/U-4: a missing level must render as unavailable, not as a
    // plausible-but-false "Level 1". `|| 1` / `Number(x) || 1` re-introduce it.
    const store = read('src/store/profileStore.js');
    expect(store).not.toContain('levelData?.level || 1');
    expect(store).toContain('levelData?.level ?? null');

    const myScreen = read('src/screens/Profile/ProfileMyScreen.jsx');
    expect(myScreen).not.toContain("currentUser?.level) || 1");
    expect(myScreen).not.toContain('effectiveProfile?.level || 1');

    const dashboard = read('src/components/profile/ProfileCreatorDashboard.jsx');
    expect(dashboard).not.toContain('Number(userLevel) || 1');

    // Same rule for the gate-bearing reads: a missing level must surface as
    // "not available", never as a Level-1 floor that could unlock or mislabel.
    const wallet = read('src/services/walletService.js');
    expect(wallet).not.toContain('Number(userData.level) || 1');
    expect(wallet).toContain('Number(userData.level) || null');

    const live = read('src/services/liveService.js');
    expect(live).not.toContain('snap.data().level || 1');

    const creator = read('src/services/creatorService.js');
    expect(creator).not.toContain('Number(userProfile.level) || 1');

    const quickAccess = read('src/components/Shared/QuickAccessPanel.jsx');
    expect(quickAccess).not.toContain('currentUser?.level || 1');

    const achievementsScreen = read('src/screens/Achievements/AchievementsScreen.jsx');
    expect(achievementsScreen).not.toContain('user.level || 1');
    // A missing streak is unknown, not "1 day": the `|| 1` floor fabricated
    // progress on every streak achievement for a brand-new account.
    expect(achievementsScreen).not.toContain('user.activeStreak || 1');
    expect(achievementsScreen).not.toContain('user.activeDaysCount || 1');

    const progressScreen = read('src/screens/Progression/ProgressScreen.jsx');
    expect(progressScreen).not.toContain('profile?.activeStreak) || 1');
    expect(progressScreen).not.toContain('profile?.activeDaysCount) || 1');
    expect(progressScreen).toContain("activeStreak ?? '—'");

    const achievementsService = read('src/services/achievementService.js');
    expect(achievementsService).not.toContain('userStats.level || 1');

    // Title eligibility is a gate-bearing read: `Number(stats.level) || 1` gave
    // every minLevel-gated title to a viewer whose standing had not loaded,
    // while the server (the authority) would reject it.
    const titleService = read('src/services/titleService.js');
    expect(titleService).not.toContain('Number(stats.level) || 1');
    expect(titleService).toContain('Number(stats.level) || 0');

    const titlesScreen = read('src/screens/Titles/TitlesScreen.jsx');
    expect(titlesScreen).not.toContain('inspectingTitle.minLevel || 1');
  });

  test('server-side title grants never floor an absent level to 1', () => {
    const src = fs.readFileSync(path.join(root, 'functions/levelSystem.js'), 'utf8');
    // The server is the authority for claimTitle/applyForCreator; an absent
    // level must fail the gate closed (0), not silently pass it as Level 1.
    expect(src).not.toContain('Number(userData.level) || 1');
    expect(src).toContain('Number(userData.level) || 0');
  });

  test('creator dashboard does not fabricate a trend line or ranking label', () => {
    const dashboard = read('src/components/profile/ProfileCreatorDashboard.jsx');
    // A single total was stretched into a 7-point "history" ([0,0,0,0,0,0,total])
    // and an absent ranking rendered as the literal 'Creator'. Both fabricated a
    // signal the analytics data did not contain.
    expect(dashboard).not.toContain('0, 0, 0, 0, 0, 0');
    expect(dashboard).toContain('No trend data yet');
    expect(dashboard).not.toMatch(/:\s*'Creator';/);
  });
});


describe('Profile hero - no fabricated join date or presence field', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('formatJoinedDate returns null instead of an invented "Joined May 2022"', () => {
    const s = read('src/components/profile/ProfileHeroSection.jsx');
    expect(s).not.toContain('Joined May 2022');
  });

  test('the online dot reads presence.status, the field the projection writes', () => {
    const s = read('src/components/profile/ProfileHeroSection.jsx');
    // `presence.state` is never written anywhere; the read model writes `status`.
    expect(s).toContain("profile?.presence?.status === 'online'");
    expect(s).not.toContain("profile?.presence?.state === 'online'");
  });
});

describe('Profile progression - masked standing is never re-defaulted to 0', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('ProfileMyScreen passes the projected streak through un-defaulted', () => {
    const s = read('src/screens/Profile/ProfileMyScreen.jsx');
    // `?? 0` turned a masked null back into a real-looking 0-day streak (N041/N044).
    expect(s).not.toContain('streak={displayedProfile?.activeStreak ?? 0}');
    expect(s).toContain('streak={displayedProfile?.activeStreak}');
  });
});

describe('Profile gates read the shared level config, never a restated literal', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('the hero verification badge does not hardcode the gate level', () => {
    const s = read('src/components/profile/ProfileHeroSection.jsx');
    // AGENTS.md: "A literal like LEVEL >= 10 in JSX is a bug."
    expect(s).not.toContain('Level 15 to Verify');
    expect(s).toContain('LEVEL_GATES?.verifiedPriority');
  });

  test('the verification modal reads the gate from the shared config', () => {
    const s = read('src/components/profile/ProfileVerificationModal.jsx');
    expect(s).not.toContain('?? 15');
    expect(s).toContain('LEVEL_GATES.verifiedPriority');
  });

  test('the verification modal renders the real requirements checklist', () => {
    const s = read('src/components/profile/ProfileVerificationModal.jsx');
    // CREATOR_VERIFICATION_REQUIREMENTS was imported but unused while the form
    // showed a vague static list; the applicant could not see why they fail.
    expect(s).toContain('CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS');
    expect(s).toContain('CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_EMAIL_VERIFIED');
    expect(s).toContain('CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_PHONE_VERIFIED');
    expect(s).toContain('checklist.map');
    expect(s).not.toContain('Authentic, notable individual or creator with consistent activity.');
  });

  test('the roadmap modal derives citizenship criteria from CITIZEN_TIERS', () => {
    const s = read('src/components/profile/ProfileSystemRoadmapModal.jsx');
    expect(s).toContain("CITIZEN_TIERS.find((t) => t.tier === 'Citizen')");
    // The level/days criteria must not be restated as literals in the JSX.
    expect(s).not.toContain('currentLevel >= 5');
    expect(s).not.toContain('activeDays >= 7');
  });

  test('the royal eligibility checklist reads thresholds from ROYAL_ELIGIBILITY', () => {
    const s = read('src/components/profile/ProfileSystemRoadmapModal.jsx');
    // The Duke/King checklist used to restate Level 70/90, 180/365 days,
    // 85/95 reputation, 80/90 contribution, 70/90 influence and 10/25
    // achievements as bare literals in JSX — a second copy of the rule that
    // getRoyalEligibility actually enforces. It now renders from the shared
    // rule object, so the two can never drift.
    expect(s).toContain('ROYAL_ELIGIBILITY');
    expect(s).toContain('rule={ROYAL_ELIGIBILITY.duke}');
    expect(s).toContain('rule={ROYAL_ELIGIBILITY.king}');
    expect(s).not.toContain('currentLevel >= 70');
    expect(s).not.toContain('currentLevel >= 90');
    expect(s).not.toContain('reputation >= 85');
    expect(s).not.toContain('reputation >= 95');
    expect(s).not.toContain('activeDays >= 180');
    expect(s).not.toContain('activeDays >= 365');
    expect(s).not.toContain('Level 70+');
    expect(s).not.toContain('Level 90+');
  });
});

describe('Profile hero XP bar shows a consistent within-level fraction', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('the XP denominator is the level span, not the absolute next-level XP', () => {
    const s = read('src/components/profile/ProfileHeroSection.jsx');
    // `nextLevelXp` is an absolute XP total (e.g. 5000 at level 10), while the
    // numerator `xpIntoLevel` is relative, so "300 / 5000 XP" was wrong. The
    // span (nextLevelXp - currentLevelXp) is the honest denominator.
    expect(s).toContain('levelInfo.nextLevelXp - levelInfo.currentLevelXp');
  });

  test('a max-level citizen sees no fabricated "100 XP" denominator', () => {
    const s = read('src/components/profile/ProfileHeroSection.jsx');
    expect(s).not.toContain('levelInfo.nextLevelXp ?? 100');
    expect(s).toContain('isMaxLevel');
  });
});

describe('Profile edit forms never reset on a whole-profile effect', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('ProfileQuickEditModal keys its reset on the target id, not the profile object', () => {
    const s = read('src/components/profile/ProfileQuickEditModal.jsx');
    // AGENTS.md: "Never reset a form from an effect keyed on the whole profile
    // object; key on uid so in-progress edits are not discarded by realtime
    // snapshots."
    expect(s).not.toContain('}, [isOpen, profile]);');
    expect(s).toContain('}, [isOpen, profileId]);');
  });
});

describe('TitlesScreen never invents the standing it evaluates against', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('eligibility is evaluated with the real scores, not 25/50/20 defaults', () => {
    const s = read('src/screens/Titles/TitlesScreen.jsx');
    // A fabricated qualifying score made a locked title look claimable while the
    // server (the authority) would reject the claim.
    expect(s).not.toContain('reputationScore: Number(profile?.reputationScore || profile?.reputation) || 50');
    expect(s).not.toContain('contributionScore: Number(profile?.contributionScore || profile?.contribution) || 25');
    expect(s).not.toContain('influenceScore: Number(profile?.influenceScore || profile?.influence) || 20');
    expect(s).toContain('reputationScore: profile?.reputationScore ?? profile?.reputation ?? null');
  });
});

describe('Marketplace purchase never fabricates a receipt', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('a missing purchaseMarketplaceItem result throws instead of inventing an order', () => {
    const s = read('src/services/marketplaceService.js');
    // The old fallback minted `ARV-ORD-<Date.now()>`, status 'Completed' and the
    // local product price when the callable failed — a fake receipt for money
    // that never moved.
    expect(s).not.toContain('ARV-ORD-');
    expect(s).not.toContain("status: 'Completed'");
    expect(s).toContain("if (!result.success || !result.order)");
  });
});

describe('Wallet availability mirrors the server hold (lockedCoins)', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('walletService derives availableCoins from lockedCoins, not a partial status sum', () => {
    const s = read('src/services/walletService.js');
    expect(s).toContain('const lockedCoins = Number(userData.lockedCoins || 0)');
    // Availability mirrors the server hold; an unknown balance stays null
    // rather than advertising 0 spendable coins.
    expect(s).toContain('const availableCoins = coins == null ? null : Math.max(0, coins - lockedCoins);');
    expect(s).toContain('availableCoins,');
    // `pending_review` requests lock coins too; omitting it over-reported balance.
    expect(s).toContain("['pending', 'pending_review', 'processing']");
  });

  test('monetizationService.getUserLevel delegates to the shared curve', () => {
    const s = read('src/services/monetizationService.js');
    expect(s).toContain('const info = getLevelInfo(experience)');
    // The local level-table re-derivation (levels.find/findIndex) is gone.
    expect(s).not.toContain('levels.find(l => l.level === currentLevel)');
    expect(s).not.toContain('currentLevel = data.level || 1;');
  });
});

describe('Profile feed grid quick actions hit the real services', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('like / save / share call firestoreService instead of local-only state', () => {
    const s = read('src/components/profile/ProfileFeedGrid.jsx');
    // These used to be pure local setState (and a local-only bookmark toast):
    // a like or save that never reached the server, shown as if it had.
    expect(s).toContain('firestoreService.likePost(');
    expect(s).toContain('firestoreService.unlikePost(');
    expect(s).toContain('firestoreService.savePost(');
    expect(s).toContain('firestoreService.unsavePost(');
    expect(s).toContain('firestoreService.sharePost(');
    // The optimistic overlay must roll back on failure, not lie.
    expect(s).toContain('Could not update like');
    expect(s).toContain('Could not update saved post');
  });

  test('the audio tab plays a real media element instead of toggling an icon', () => {
    const s = read('src/components/profile/ProfileFeedGrid.jsx');
    // The "player" had no <audio> element, so the play button never produced
    // sound; the source must be the stored URL and playback must be real.
    expect(s).toContain('<audio');
    expect(s).toContain('audioElRef');
    expect(s).toContain('.play()');
    expect(s).toContain('.pause()');
  });

  test('the audio tab does not fabricate duration/BPM/genre', () => {
    const s = read('src/components/profile/ProfileFeedGrid.jsx');
    // These defaults made an arbitrary post look like a mastered track.
    expect(s).not.toMatch(/item\.duration\s*\|\|\s*'2:45'/);
    expect(s).not.toMatch(/item\.bpm\s*\|\|\s*120/);
    expect(s).not.toMatch(/item\.genre\s*\|\|\s*'Electronic'/);
  });
});

describe('Messaging never claims E2EE the app cannot deliver', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('no surface advertises end-to-end encryption', () => {
    // E2EE needs per-user key provisioning (generateUserKeys/unlockPrivateKey),
    // which has no caller and no server path, so no message is ever encrypted
    // and no one holds a public key. A lock badge / "E2EE protected" label is
    // therefore a fabricated security claim.
    expect(read('src/screens/ChatScreen.jsx')).not.toContain('End-to-end encrypted');
    expect(read('src/screens/ConversationSettingsScreen.jsx')).not.toContain('E2EE');
    // MenuScreen described Direct Messages as "End-to-end encrypted" too.
    expect(read('src/screens/Menu/MenuScreen.jsx')).not.toMatch(/[Ee]nd-to-end encrypted/i);
  });

  test('a text send cannot be blocked by the encryption gate', () => {
    // The send path must fall back to plaintext when keys are absent; an
    // unconditional throw would make every text message fail to send.
    const s = read('src/services/messagesService.js');
    expect(s).toContain('canEncrypt');
    expect(s).not.toMatch(/throw new Error\('Your public key not found'\)/);
    expect(s).not.toMatch(/has no public key/);
  });
});

describe('Passport visa stamps read their gates from the shared config', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('no stamp threshold is restated as a literal in passportService', () => {
    const s = read('src/services/passportService.js');
    // The stamp gates (streak 7, 3 achievements, 1 title) were literals in both
    // the eligibility math and the "Requires ..." copy; a config change would
    // have left the description advertising a gate the code no longer used.
    expect(s).toContain('PASSPORT_STAMP_GATES.civicStreak');
    expect(s).toContain('PASSPORT_STAMP_GATES.honorsAchievements');
    expect(s).not.toContain('activeStreak >= 7');
    expect(s).not.toContain('verifiedAchievements.length >= 3');
    expect(s).not.toContain('Requires Level 10 or a 7-day');
    expect(s).not.toContain('or Level 15 citizenship standing');
    expect(s).not.toContain('at least 3 verified achievements');
  });

  test('the shared config owns the passport stamp gates', () => {
    const s = read('src/shared/levelConfig.cjs');
    expect(s).toContain('PASSPORT_STAMP_GATES');
    expect(s).toContain('civicStreak: 7');
  });
});

describe('Royal-eligibility copy is rendered from the shared rule', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('PassportScreen royal candidacy copy reads ROYAL_ELIGIBILITY', () => {
    const s = read('src/screens/Citizenship/PassportScreen.jsx');
    expect(s).toContain('ROYAL_ELIGIBILITY.duke.minLevel');
    expect(s).toContain('ROYAL_ELIGIBILITY.king.minLevel');
    expect(s).not.toContain('Requires Level 70, 180 Active Days');
    expect(s).not.toContain('Requires Level 90, 365 Active Days');
  });

  test('PerksRewardsScreen prestige copy reads MAX_LEVEL / ROYAL_ELIGIBILITY', () => {
    const s = read('src/screens/Progression/PerksRewardsScreen.jsx');
    expect(s).toContain('Level {MAX_LEVEL}');
    expect(s).toContain('ROYAL_ELIGIBILITY.duke.minLevel');
    expect(s).toContain('ROYAL_ELIGIBILITY.king.minLevel');
    expect(s).not.toContain('Level 70 + High Reputation');
    expect(s).not.toContain('Level 90 + Impeccable');
  });
});

describe('No user-facing gate text restates a threshold literal', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('ConnectionsScreen reads the follower gate from the shared config', () => {
    const s = read('src/screens/Profile/ConnectionsScreen.jsx');
    expect(s).toContain('LEVEL_GATES.publicFollowers}+');
    expect(s).not.toContain('At Level 3+');
  });

  test('EditProfileScreen section comments do not carry stale gate numbers', () => {
    const s = read('src/screens/Profile/EditProfileScreen.jsx');
    expect(s).not.toContain('Creators or Level 10+');
    expect(s).not.toContain('Royal Family or Level 35+');
  });

  test('ProfileVerificationModal never fabricates a Level 0 standing', () => {
    const s = read('src/components/profile/ProfileVerificationModal.jsx');
    expect(s).not.toContain('Level {userLevel || 0}');
    expect(s).toContain("userLevel !== null ? `Level ${userLevel}` : 'Unranked'");
  });
});

describe('ProfileCitizenshipCard resolves the real viewer relationship', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('the card forwards a viewerId instead of always resolving PUBLIC', () => {
    const card = read('src/components/profile/ProfileCitizenshipCard.jsx');
    expect(card).toContain('viewerId = null');
    expect(card).toContain('passportService.getPassport(userId, viewerId || (isOwner ? userId : null), profile)');
    expect(card).not.toContain('passportService.getPassport(userId, isOwner ? userId : null, profile)');
  });

  test('ProfileFeedGrid threads the current user into the card', () => {
    const grid = read('src/components/profile/ProfileFeedGrid.jsx');
    expect(grid).toContain('viewerId={currentUserId}');
  });
});


describe('Store and help copy read the shared config, never restated literals', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('SubscriptionScreen derives tiers, ids and prices from SUBSCRIPTION_TIERS', () => {
    const src = read('src/screens/SubscriptionScreen.jsx');
    expect(src).toContain('import { SUBSCRIPTION_TIERS }');
    expect(src).toContain('Object.entries(SUBSCRIPTION_TIERS)');
    // The old table hardcoded $24.99/enterprise/10,000 coins while the server
    // charges $19.99 for `premium` and rejects `createSubscription('creator')`.
    expect(src).not.toContain("id: 'enterprise'");
    expect(src).not.toContain("id: 'creator'");
    expect(src).not.toMatch(/price:\s*'\$\d/);
    expect(src).not.toContain('10,000 coins');
  });

  test('HelpCenter verification copy reads CREATOR_VERIFICATION_REQUIREMENTS', () => {
    const src = read('src/screens/Help/HelpCenterScreen.jsx');
    expect(src).toContain('CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS');
    expect(src).not.toContain('at least 1,000 followers');
    expect(src).not.toContain('last 90 days');
  });
});

describe('Offline status screen reads the real queue, never a fixed count', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('OfflineStatusScreen subscribes to the canonical sync engine', () => {
    const s = read('src/screens/OfflineStatusScreen.jsx');
    // It once rendered a hardcoded "Pending writes: 3" — a fabricated number.
    expect(s).not.toContain('Pending writes: 3');
    expect(s).not.toMatch(/>\s*Pending writes:\s*\d/);
    expect(s).toContain('subscribeSyncStatus');
    expect(s).toContain("from '../offline/syncEngine.js'");
  });
});

describe('Composer moderation never claims a pass it did not verify', () => {
  const src = fs.readFileSync(path.join(root, 'src/screens/CreatePost.jsx'), 'utf8');

  test('a failed moderation call renders an "unavailable" state, not "passed"', () => {
    // The catch branch used to dispatch `{ approved: true, fallback: true }`,
    // so an unreachable moderation provider rendered "Content passed
    // moderation" — a fabricated approval. It must surface the unknown state.
    expect(src).not.toContain('approved: true, flags: [], fallback: true');
    expect(src).toContain('unknown: true');
    expect(src).toContain('Moderation check unavailable');
  });

  test('the approval copy is gated on a real approved flag', () => {
    expect(src).toContain('state.moderationStatus.approved ? "Content passed moderation"');
  });
});

describe('Admin content list reads the real nested post stats', () => {
  const src = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminContentManagementScreen.jsx'), 'utf8');

  test('views/likes come from posts/{id}.stats, not a fabricated top-level field', () => {
    // Posts store engagement under `stats` (firestoreService writes
    // `stats: { likes, views, ... }`); the admin card read `item.views`/
    // `item.likes`, which never exist, so every row rendered "0 views 0 likes".
    expect(src).toContain('formatStat(item.stats?.views)');
    expect(src).toContain('formatStat(item.stats?.likes)');
    expect(src).not.toContain('{item.views || 0}');
    expect(src).not.toContain('{item.likes || 0}');
  });
});

describe('Admin rank titles are never fabricated from a missing level', () => {
  test('a non-finite level renders "—", not the lowest rank', () => {
    for (const rel of [
      'src/screens/Admin/AdminEconomyScreen.jsx',
      'src/screens/Admin/AdminVerificationScreen.jsx',
    ]) {
      const s = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(s).not.toContain('getRankTitle(payout.level || 0)');
      expect(s).not.toContain('getRankTitle(applicant.level || 0)');
      expect(s).toContain('Number.isFinite(');
    }
  });
});

describe('Admin aggregate counts never fabricate a measured zero', () => {
  const svc = fs.readFileSync(path.join(root, 'src/services/adminService.js'), 'utf8');
  const dash = fs.readFileSync(path.join(root, 'src/screens/Admin/AdminDashboardScreen.jsx'), 'utf8');

  test('adminService.count returns null (unknown) on failure, not 0', () => {
    // A failed aggregate rendered as 0 showed an unmeasured collection as an
    // empty one; the dashboard printed "0 users" while the query had thrown.
    expect(svc).toContain('return null;');
    expect(svc).not.toMatch(/Returns 0 on failure/);
  });

  test('the dashboard renders an unknown stat as — and revenue as unavailable', () => {
    expect(dash).toContain("value === null || value === undefined");
    expect(dash).toContain("'Unavailable'");
    expect(dash).not.toContain('stats.revenue.toLocaleString()');
    expect(dash).toContain('revenue: null');
  });
});

describe('BottomNav coin balance is unknown, not zero, before the profile loads', () => {
  const src = fs.readFileSync(path.join(root, 'src/components/Shared/BottomNav.jsx'), 'utf8');

  test('an absent balance renders — rather than claiming 0 coins', () => {
    expect(src).toContain('const coinBalance = effectiveUser?.coins ?? null;');
    expect(src).not.toContain('effectiveUser?.coins ?? 0');
    expect(src).toContain('return "—";');
  });
});

describe('MenuScreen and RankingsScreen use the read model, not a Citizen stub', () => {
  test('MenuScreen renders the canonical name/handle and an unknown balance as —', () => {
    const s = fs.readFileSync(path.join(root, 'src/screens/Menu/MenuScreen.jsx'), 'utf8');
    expect(s).not.toContain('activeUser?.displayName || "Citizen"');
    expect(s).not.toContain('activeUser?.username || "citizen"');
    expect(s).toContain('pickDisplayName(');
    expect(s).toContain('pickHandle(');
    // A missing balance must not claim an empty wallet.
    expect(s).not.toContain("typeof activeUser?.coins === 'number' ? activeUser.coins : 0");
    expect(s).toContain("typeof activeUser?.coins === 'number' ? activeUser.coins : null");
  });

  test('RankingsScreen resolves identity through the read model', () => {
    const s = fs.readFileSync(path.join(root, 'src/screens/Rankings/RankingsScreen.jsx'), 'utf8');
    expect(s).not.toContain("item.user?.displayName || item.community?.name || 'Citizen'");
    expect(s).toContain('pickDisplayName(');
    expect(s).toContain('deriveHandle(');
  });
});

describe('Wallet/economy surfaces never fabricate an empty balance', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('WalletScreen shows a retry state, not "0 Coins", when the read fails', () => {
    const s = read('src/screens/Economy/WalletScreen.jsx');
    expect(s).toContain('loadError && !wallet');
    expect(s).toContain("value === null || value === undefined ? '—'");
    // The balance must never be coerced to 0.
    expect(s).not.toContain('(wallet?.availableCoins || user?.coins || 0).toLocaleString()');
  });

  test('walletService.getTransactions fails closed instead of returning []', () => {
    const s = read('src/services/walletService.js');
    expect(s).toContain('[WalletService] getTransactions failed:');
    expect(s).not.toContain('getTransactions fallback');
  });

  test('CoinsScreen renders an unknown balance as —, not 0', () => {
    const s = read('src/screens/CoinsScreen.jsx');
    expect(s).not.toContain("Number(bal?.coins ?? bal?.balance ?? 0)");
    expect(s).toContain("balance === null ? '—' : balance.toLocaleString()");
  });

  test('ProfileMetricsGrid renders an unknown coin count as —', () => {
    const s = read('src/components/profile/ProfileMetricsGrid.jsx');
    expect(s).not.toContain('profile?.balance ?? 0;');
    expect(s).toContain('coinsCount !== null');
  });

  test('VideoAnalyticsScreen renders an unknown pending payout, not $0.00', () => {
    const s = read('src/screens/VideoAnalyticsScreen.jsx');
    expect(s).not.toContain("(walletRes.value?.pendingCoins || 0) : 0");
    expect(s).toContain('pendingCoins: null');
  });
});

describe('Analytics surfaces never fabricate zeroed metrics on a failed read (N154)', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('analyticsStore surfaces the failure instead of an all-zero fallback', () => {
    const s = read('src/store/analyticsStore.js');
    expect(s).not.toContain('Load analytics fallback used');
    expect(s).not.toContain('fallbackAnalytics');
    expect(s).toContain('state.analytics = null');
    expect(s).toContain('state.error =');
  });

  test('analyticsService rethrows a failed read instead of caching fabricated zeros', () => {
    const s = read('src/services/analyticsService.js');
    // The old "resilient fallback" returned (and cached) 0 views / 0 reach /
    // 0 coins as if measured, cleared the caller error branch and poisoned the
    // cache so later reads never retried.
    expect(s).not.toContain('fallbackAnalytics');
    expect(s).toContain('Get user analytics failed');
    expect(s).toMatch(/logger\.error\('Get user analytics failed'[\s\S]*?throw error;/);
  });

  test('ProfileCreatorDashboard renders an unknown metric as —, not 0', () => {
    const s = read('src/components/profile/ProfileCreatorDashboard.jsx');
    expect(s).not.toMatch(/Number\(analytics\?\.totalViews\)\s*\|\|\s*0/);
    expect(s).toContain("views === null ? '—'");
    expect(s).toContain("coins === null ? '—'");
  });
});

describe('Profile/progression surfaces render unknown counts, not 0 (N155)', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('ProfileMetricsGrid formatNumber does not fabricate 0 for a missing count', () => {
    const s = read('src/components/profile/ProfileMetricsGrid.jsx');
    expect(s).not.toContain("if (num === undefined || num === null) return '0';");
    expect(s).toContain("if (num === undefined || num === null) return '—';");
    expect(s).not.toContain('profile?.followersCount ?? 0');
  });

  test('RankingsScreen renders an unknown score as —, not 0', () => {
    const s = read('src/screens/Rankings/RankingsScreen.jsx');
    expect(s).not.toContain('item.score?.toLocaleString() || 0');
    expect(s).toContain("typeof item.score === 'number'");
  });

  test('ProgressScreen renders unknown XP/coins as —, not 0', () => {
    const s = read('src/screens/Progression/ProgressScreen.jsx');
    expect(s).not.toContain('Total XP: {(user?.experience || 0).toLocaleString()}');
    expect(s).not.toContain('{user?.coins || 0}');
  });

  test('walletService leaves an unknown balance null instead of 0', () => {
    const s = read('src/services/walletService.js');
    expect(s).not.toContain("Number(userData.coins || userData.coinBalance || 0)");
    expect(s).toContain('const rawCoins = userData.coins ?? userData.coinBalance ?? null;');
  });

  test('PostOptionsDrawer does not derive a creator score from follower count', () => {
    const s = read('src/screens/PostOptionsDrawer.jsx');
    expect(s).not.toContain('Math.floor((profile?.followerCount || 0) / 1000)');
  });

  test('WalletScreen gates withdrawal on a verified balance', () => {
    const s = read('src/screens/Economy/WalletScreen.jsx');
    expect(s).not.toContain('amount > (wallet?.availableCoins || 0)');
    expect(s).toContain('wallet?.availableCoins == null');
  });
});

describe('A count the ledger did not confirm is unknown, never 0 (N156)', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  test('the canonical search formatCount renders unknown as —', () => {
    const s = read('src/lib/searchUtils.jsx');
    expect(s).toContain("if (num === null || num === undefined || Number.isNaN(Number(num))) return '—';");
    // The old body printed `num.toString()` for anything that reached the end,
    // so an absent count rendered as the literal string "undefined"/"0".
    expect(s).not.toContain('return num.toString();');
  });

  test('search result mapping leaves absent counts null instead of 0', () => {
    const s = read('src/lib/searchUtils.jsx');
    expect(s).not.toContain('followers: result.followers || result.followerCount || 0');
    expect(s).toContain('followers: result.followers ?? result.followerCount ?? null');
  });

  test('search cards do not coerce absent counts to 0 before formatting', () => {
    for (const rel of [
      'src/components/search/CreatorCarousel.jsx',
      'src/components/search/TrendingSection.jsx',
      'src/components/search/SearchResults.jsx',
    ]) {
      const s = read(rel);
      expect(s).not.toMatch(/followers \|\| [\w.]+ \|\| 0/);
      expect(s).not.toMatch(/views \|\| [\w.]+ \|\| 0/);
    }
  });

  test('QuickAccessPanel routes every count through the unknown-safe formatter', () => {
    const s = read('src/components/Shared/QuickAccessPanel.jsx');
    for (const key of ['postCount', 'followerCount', 'followingCount']) {
      expect(s).not.toContain(`value: stats.${key} || 0,`);
      expect(s).toContain(`value: formatCount(stats.${key})`);
    }
  });

  test('monetizationService.getBalance reports unknown as null, not 0', () => {
    const s = read('src/services/monetizationService.js');
    expect(s).not.toContain('if (!userSnap.exists()) return 0;');
    expect(s).not.toContain("log.error('Failed to get balance:', e);\n      return 0;");
    // A null balance cannot be ranked; the lowest title would be fabricated.
    expect(s).toContain('if (balance === null) return null;');
  });

  test('the profile store reads the numeric balance, not a `.coins` off a number', () => {
    const s = read('src/store/profileStore.js');
    expect(s).not.toContain('balanceResult?.coins || 0');
    expect(s).not.toContain('balanceData?.coins || 0');
    expect(s).toContain("balance = typeof balanceResult === 'number' ? balanceResult : null;");
  });

  test('AuthContext mirrors counts as null (unknown), never a fabricated 0', () => {
    const s = read('src/context/AuthContext.jsx');
    expect(s).not.toContain('coins: userProfile?.coins || 0');
    expect(s).not.toContain('postCount: userProfile?.postCount || 0');
    expect(s).toContain('postCount: userProfile?.postCount ?? null');
  });

  test('the tip modal never claims "0 coins" for an unread balance', () => {
    const s = read('src/components/profile/ProfileTipModal.jsx');
    expect(s).not.toContain('setUserBalance(res?.coins || 0)');
    expect(s).toContain('setUserBalance(typeof res === \'number\' ? res : null)');
  });

  test('the verification flow never records a fabricated 0 follower count', () => {
    const modal = read('src/components/profile/ProfileVerificationModal.jsx');
    expect(modal).not.toContain('followerCount: profile.followerCount || 0');
    const service = read('src/services/userService.js');
    expect(service).not.toContain('followerCount: Number(applicationData.followerCount || 0)');
    const admin = read('src/screens/Admin/AdminVerificationScreen.jsx');
    expect(admin).not.toContain('Number(applicant.followerCount ?? applicant.followersCount ?? 0)');
  });

  test('PostOptionsDrawer renders an unknown author follower count as —', () => {
    const s = read('src/screens/PostOptionsDrawer.jsx');
    expect(s).not.toContain('followerCount: safePost.followerCount || 0');
    expect(s).toContain('followerCount: safePost.followerCount ?? null');
  });

  test('formatViewCount renders an absent count as —, not 0', () => {
    const s = read('src/utils/videoUtils.js');
    expect(s).not.toContain("    return '0';\n  }");
    expect(s).toContain("if (views === null || views === undefined || typeof views !== 'number' || isNaN(views)) {");
    expect(s).toContain("return '—';");
  });

  test('video surfaces never coerce an absent stat to 0 before formatting', () => {
    for (const rel of [
      'src/components/Videos/VideoCard.jsx',
      'src/screens/VideoDetailScreen.jsx',
      'src/screens/VideosScreen.jsx',
    ]) {
      const s = read(rel);
      expect(s).not.toMatch(/formatViewCount\([\w?.]+ \|\| 0\)/);
      expect(s).not.toMatch(/stats\?\.(views|likes|comments|shares) \|\| 0/);
    }
  });

  test('videoService keeps an absent stat unknown, never a fake 0', () => {
    const s = read('src/services/videoService.js');
    expect(s).not.toContain('likes: item.stats?.likes ?? item.likes ?? 0');
    expect(s).toContain('likes: item.stats?.likes ?? item.likes ?? null');
  });

  test('the reels action rail never fabricates a 0 stat', () => {
    const s = read('src/screens/ReelsScreen.jsx');
    expect(s).not.toContain('likes: v.likes ?? v.stats?.likes ?? 0');
    expect(s).toContain('likes: v.likes ?? v.stats?.likes ?? null');
    expect(s).not.toContain('(currentReel.stats.likes || 0).toLocaleString()');
  });

  test('VideoActionRail defaults a missing stat to null, not 0', () => {
    const s = read('src/components/Videos/VideoActionRail.jsx');
    expect(s).not.toContain('likes = 0,');
    expect(s).toContain('likes = null,');
  });

  test('CreatePost analytics preview has no fabricated metrics or growth rate', () => {
    const s = read('src/screens/CreatePost.jsx');
    expect(s).not.toContain('analyticsData?.totalViews ?? 0');
    expect(s).not.toContain('analyticsData?.coinsEarned ?? 0');
    // `: 12` invented a "+12% this week" growth rate when no delta was known.
    expect(s).not.toContain('Math.round(analyticsData.changes.engagement) : 12');
  });

  test('StoriesScreen renders an unknown view total as —, not 0', () => {
    const s = read('src/screens/StoriesScreen.jsx');
    expect(s).not.toContain('viewsCount: String(storiesArr[0]?.stats?.views || 0)');
    expect(s).not.toContain('currentStory.viewsCount ?? 0}');
  });

  test('comment surfaces keep an absent like total unknown', () => {
    const videoComments = read('src/components/Videos/VideoComments.jsx');
    expect(videoComments).not.toContain('{comment.likes || 0}');
    expect(videoComments).not.toContain('{reply.likes || 0}');
    const commentsDrawer = read('src/screens/CommentsDrawer.jsx');
    expect(commentsDrawer).not.toContain('formatCount(comment.likes || 0)');
  });

  test('ProfileFeedGrid comment counts go through the unknown-safe helper', () => {
    const s = read('src/components/profile/ProfileFeedGrid.jsx');
    expect(s).not.toContain('{item.comments || 0}');
    expect(s).toContain('const commentCount = useCallback');
  });

  test('PerksRewardsScreen never claims an empty treasury for an unknown balance', () => {
    const s = read('src/screens/Progression/PerksRewardsScreen.jsx');
    expect(s).not.toContain('const userCoins = Number(profile?.coins) || 0;');
    expect(s).toContain('const canAfford = userCoins != null && userCoins >= g.coins;');
  });

  test('PostAnalyticsScreen reads the real `stats` shape and renders unknown as —', () => {
    const s = read('src/screens/PostAnalyticsScreen.jsx');
    // These top-level fields are never written; reading them fabricated "0".
    expect(s).not.toContain('postDoc.viewsCount || postDoc.views || 0');
    expect(s).not.toContain('postDoc.likesCount || postDoc.likes?.length || 0');
    expect(s).toContain('postDoc.stats?.views');
  });

  test('PostCard analytics panel and comment preview do not fabricate a 0', () => {
    const s = read('src/screens/PostCard.jsx');
    expect(s).not.toContain('(postAnalytics.totalViews || 0)');
    expect(s).not.toContain('(postAnalytics.totalLikes || 0)');
    expect(s).not.toContain('View all {totalComments} comments');
    // The engagement reducer must not shift an unknown total from a fake 0.
    expect(s).not.toContain('likeCount: state.likeCount + (action.payload ? 1 : -1)');
  });

  test('PollCard renders an unknown vote total as —', () => {
    const s = read('src/screens/PostCard/PollCard.jsx');
    expect(s).not.toContain('{(opt.votes ?? 0).toLocaleString()} votes');
  });

  test('analyticsService sums engagement from the real `stats` shape', () => {
    const s = read('src/services/analyticsService.js');
    expect(s).not.toContain("p.likesCount || p.likes || 0");
    expect(s).toContain('const s = p.stats || {};');
  });

  test('postService.getPost unwraps the firestoreService envelope', () => {
    const s = read('src/services/postService.js');
    expect(s).not.toContain('return await this.fs.getPost(postId);');
    expect(s).toContain('return res.post;');
  });

  test('community/event/admin counts render an unknown total as —', () => {
    for (const f of [
      'src/screens/Community/CommunityDirectoryScreen.jsx',
      'src/screens/Community/CommunityDetailScreen.jsx',
      'src/screens/Event/EventDiscoveryScreen.jsx',
      'src/screens/Event/EventDetailScreen.jsx',
    ]) {
      expect(read(f)).not.toMatch(/stats\?\.(memberCount|activityScore|attendeeCount)\s*\|\|\s*0/);
    }
  });

  test('VideoAnalyticsScreen maps per-video counts from `stats`', () => {
    const s = read('src/screens/VideoAnalyticsScreen.jsx');
    expect(s).not.toContain('views: p.views || 0,');
    expect(s).not.toContain('likes: p.likeCount || 0,');
    expect(s).toContain('p.stats?.likes ?? p.likeCount');
  });

  test('LiveScreen viewer counts are unknown (null), never a fabricated 0', () => {
    const s = read('src/screens/LiveScreen.jsx');
    expect(s).not.toContain('const [viewerCount, setViewerCount] = useState(0)');
    expect(s).not.toContain('const [watchViewers, setWatchViewers] = useState(0)');
  });

  test('CreatorDashboard renders unmeasured metrics as —', () => {
    const s = read('src/screens/Profile/CreatorDashboardScreen.jsx');
    expect(s).not.toContain("value: analytics?.totalViews || 0");
    expect(s).not.toContain("value: analytics?.totalEngagement || 0");
    expect(s).not.toContain("Number(analytics?.coinsEarned || 0).toLocaleString()");
    expect(s).toContain("if (typeof num !== 'number' || Number.isNaN(num)) return '—';");
  });

  test('CreatorPayoutScreen keeps an unknown balance unknown', () => {
    const s = read('src/screens/CreatorPayoutScreen.jsx');
    expect(s).not.toContain('const [balance, setBalance] = useState(0)');
    expect(s).not.toContain("Number(b?.coins || b?.balance || 0)");
    expect(s).not.toContain('100% secure payouts');
  });

  test('ProfileSystemRoadmapModal does not turn absent XP into 0', () => {
    const s = read('src/components/profile/ProfileSystemRoadmapModal.jsx');
    expect(s).not.toContain('const currentXp = profile?.experience || profile?.xp || 0;');
    expect(s).toContain('XP not yet recorded');
    // Royal eligibility dimensions stay unknown, not a fabricated 0/requirement.
    expect(s).not.toContain("Number(profile?.activeDaysCount || profile?.activeDays || 0)");
    expect(s).toContain("{known ? row.current : '—'}");
  });

  test('CollectionsScreen does not offer a Public/Private control the rules cannot honour', () => {
    // `collections` is owner-scoped in firestore.rules (read/update/delete all
    // require resource.data.userId == uid()), so a "Public" folder is readable
    // by nobody. The toggle collected a flag the service dropped and no read
    // path honoured — a dead control claiming a visibility that does not exist.
    const s = read('src/screens/CollectionsScreen.jsx');
    expect(s).not.toContain('isPrivate');
    expect(s).not.toContain('private or public folders');
    expect(s).toContain('Only you');
  });
  test('VideoCard reads the real comment stat key', () => {
    const s = read('src/components/Videos/VideoCard.jsx');
    expect(s).not.toContain('formatViewCount(video?.commentsCount)');
    expect(s).toContain('video?.comments ?? video?.commentsCount');
  });
});
