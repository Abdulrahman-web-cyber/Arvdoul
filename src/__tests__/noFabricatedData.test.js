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

  test('addCoins is allowlisted per reason with daily caps (no coin faucet)', () => {
    const src = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(src).toContain('CLIENT_ADD_REASON_CAPS');
    expect(src).toContain('post_created_bonus: 10');
    expect(src).toContain("is not allowlisted for client addCoins");
    expect(src).toContain('Daily cap reached');
  });

  test('video processing endpoints are onCall', () => {
    const src = fs.readFileSync(path.join(root, 'functions/video.js'), 'utf8');
    expect(src).toContain('exports.watermarkVideo = onCall');
    expect(src).toContain('exports.moderateVideo = onCall');
  });
});

describe('Level gate - aligned with the real 15-level curve', () => {
  test('no "Level 25" monetization gate (max level is 15)', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/Shared/QuickAccessPanel.jsx'), 'utf8');
    expect(src).not.toContain('Level 25');
    expect(src).toContain('MONETIZATION_MIN_LEVEL = 10');
  });
});

describe('appStore - no fabricated starting coins', () => {
  test('initial coins are 0, not a fake 1000', () => {
    const src = fs.readFileSync(path.join(root, 'src/store/appStore.js'), 'utf8');
    expect(src).not.toContain('coins: 1000');
    expect(src).toContain('coins: 0,');
  });
});

describe('Poll wagers - real coin debit', () => {
  test('pollService.votePoll is server-authoritative (votePoll CF) and never writes the poll doc client-side', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/pollService.js'), 'utf8');
    expect(src).toContain("'votePoll'"); // Cloud Function path
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

describe('Engagement coin rewards - wired to the real ledger', () => {
  test('components no longer destructure undefined addCoins/followUser from useAuth', () => {
    const feed = fs.readFileSync(path.join(root, 'src/components/Home/ReelsFeed.jsx'), 'utf8');
    const modal = fs.readFileSync(path.join(root, 'src/components/Home/CommentsModal.jsx'), 'utf8');
    const card = fs.readFileSync(path.join(root, 'src/components/Home/PostCard.jsx'), 'utf8');
    expect(feed).not.toContain('addCoins, followUser } = useAuth');
    expect(modal).not.toContain('addCoins } = useAuth');
    expect(card).not.toContain('addCoins } = useAuth');
    expect(feed).toContain('getUserService().followUser(user.uid, uid)');
    expect(card).toContain('"like"');
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
    const feed = fs.readFileSync(path.join(root, 'src/services/feedService.js'), 'utf8');
    expect(feed).toContain('fLimit(1000)');
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
    expect(rules).toContain('match /messages_{year}_{month}/{messageId}');
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
    const block = rules.slice(rules.indexOf('match /group_invites'), rules.indexOf('match /group_invites') + 300);
    expect(block).toContain('isConvAdmin()');
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
    expect(src).toContain("'blocks', `${viewerId}_${story.userId}`");
    expect(src).toContain("story.visibility === STORY_CONFIG.VISIBILITY.PRIVATE");
  });
});

describe('Vibes master-spec: one canonical viewer (spec §99)', () => {
  test('duplicate viewers are deleted, VibeStrip navigates to /stories', () => {
    for (const dead of ['src/components/Stories/StoryViewer.jsx', 'src/components/Stories/StoryList.jsx',
                        'src/components/Stories/StoriesCarousel.jsx', 'src/components/Home/Stories.jsx']) {
      expect(fs.existsSync(path.join(root, dead))).toBe(false);
    }
    const strip = fs.readFileSync(path.join(root, 'src/components/feed/VibeStrip.jsx'), 'utf8');
    expect(strip).not.toContain('StoryViewer');
    expect(strip).toContain("navigate('/stories', { state: { vibeUserId: userId } })");
    expect(strip).toContain('feedData?.groups'); // correct feed shape
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
