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
    expect(csp).not.toContain('picsum.photos');
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
    expect(feed).not.toContain('addCoins, followUser } = useAuth');
    expect(modal).not.toContain('addCoins } = useAuth');
    expect(feed).toContain('getUserService().followUser(user.uid, uid)');
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
    expect(block).toContain('allow write: if isSignedIn();');
    // story-doc updates remain creator-only
    expect(block).toContain('allow update, delete: if isSignedIn() && request.auth.uid == resource.data.userId;');
  });
});

describe('CreateStory honest offline state (spec §53)', () => {
  test('queued publish shows honest offline message, not "shared to followers"', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/CreateStory.jsx'), 'utf8');
    expect(src).toContain("'Offline — saved as draft. Will publish when you are back online.'");
    expect(src).not.toContain("'Story shared to your followers! 🌟'");
    expect(src).toContain("visibility: 'public'");
  });
});

describe('Account isolation (audit N002) - persisted identity cannot bleed accounts', () => {
  test('appStore never persists currentUser and migrates stale blobs', () => {
    const src = fs.readFileSync(path.join(root, 'src/store/appStore.js'), 'utf8');
    const persistBlock = src.slice(src.indexOf("name: 'arvdoul-app-store'"));
    expect(persistBlock).not.toContain('currentUser: state.currentUser');
    expect(persistBlock).toContain('version: 2');
    expect(persistBlock).toContain('migrate:');
  });

  test('getStoredUser refuses a cached user blob from a different session uid', () => {
    const src = fs.readFileSync(path.join(root, 'src/utils/security.js'), 'utf8');
    expect(src).toContain("localStorage.getItem('arvdoul_uid')");
    expect(src).toContain('parsed.uid !== sessionUid');
  });

  test('profile screens prefer the live auth user over the store mirror', () => {
    for (const rel of [
      'src/screens/Profile/FollowersScreen.jsx',
      'src/screens/Profile/FollowingScreen.jsx',
      'src/screens/Profile/FriendsScreen.jsx',
      'src/screens/Profile/HighlightsScreen.jsx',
      'src/screens/Profile/CreatorDashboardScreen.jsx',
    ]) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('const currentUser = authUser || storeUser;');
      expect(src).not.toContain('const currentUser = storeUser || authUser;');
    }
  });
});

describe('Compliance export - no fabricated personal data', () => {
  test('exportUserData never invents an email/username/createdAt for the subject', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/complianceGovernanceService.js'), 'utf8');
    expect(src).not.toContain("email: 'user@example.com'");
    expect(src).not.toContain('timestamp - 86400000 * 30');
    expect(src).toContain('async exportUserData(userId, dataSources = {})');
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
    expect(src).toContain("import { LEVELS as CANONICAL_LEVELS, LEVEL_GATES, GIFT_CATALOG } from '../shared/levelConfig.cjs';");
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
    expect(src).toContain('displayName: profile.displayName || profile.name || null');
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
  test('ProfileHeroSection does not invent a level or rank when none is stored', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/profile/ProfileHeroSection.jsx'), 'utf8');
    expect(src).not.toContain('|| 1;');
    expect(src).not.toMatch(/return \{ level: 1, title: 'Citizen'/);
    expect(src).not.toMatch(/\(\) => 'Citizen'/);
  });

  test('ProfilePublicScreen does not default a missing level to 1', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Profile/ProfilePublicScreen.jsx'), 'utf8');
    expect(src).not.toContain('Number(profileData.level) || 1');
    expect(src).not.toContain('effectiveProfile.level || 1');
  });
});

describe('Analytics view dedupe is transactional (N019)', () => {
  test('trackProfileView claims the daily marker inside a transaction', () => {
    const src = fs.readFileSync(path.join(root, 'src/services/analyticsService.js'), 'utf8');
    const body = src.slice(src.indexOf('async trackProfileView'));
    expect(body).not.toMatch(/await getDoc\(viewRef\)/);
    expect(body).toMatch(/runTransaction\(this\.firestore/);
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
    expect(src).toContain("collection(firestore, 'withdrawal_requests')");
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
    const s = src();
    expect(s).toContain("collection(firestore, 'moderation_logs')");
    expect(s).not.toContain("collection(firestore, 'audit_logs')");
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
    expect(svc).toContain("httpsCallable(functions, 'reportAd')");
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

  test('ReelsFeed reads the feed through videoService and never writes Firestore directly', () => {
    const s = read('src/components/Home/ReelsFeed.jsx');
    expect(s).not.toContain("from 'firebase/firestore'");
    expect(s).not.toContain('collection(db');
    expect(s).not.toContain('updateDoc(');
    expect(s).toContain('videoService.getVideoFeed');
    // Likes/shares are server-authoritative through the service callables.
    expect(s).toContain('videoService.likeVideo');
    expect(s).toContain('videoService.shareVideo');
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

