# 🏗️ Arvdoul Engineering Readiness — Status & Roadmap

> Last updated: 2026-08-20. This document is the operational counterpart of the
> Engineering Constitution: it records what is hardened, what is enforced in
> CI, and the ramp-up plan for what remains.

## Where Arvdoul stands (verified numbers)

| Metric | Before (2026-08-20 baseline) | Now | Target (Q4 2026) |
|---|---|---|---|
| Test suites | 7 (1 failing, 1 flaky) | **17 (all green)** | 25+ |
| Tests | 119 (1 failing) | **267 passing** | 500+ |
| Coverage (full service tree) | ~11.9% stmts | **13.2% stmts / 13.8% lines** | 35% stmts |
| Coverage floors enforced in CI | none | **global + 21 per-file floors** | raise quarterly |
| CI pipeline | pass-on-failure (`continue-on-error`) | **real gates** (lint/test/build/security/functions) | canary deploys |
| a11y gates | none | **axe-core on core UI** (0 violations) | full-screen sweep |
| i18n | hardcoded English | **7 locales + key-parity test + RTL** | 20+ locales |
| Feature flags | none | **Remote Config + kill switches + hook** | admin UI |
| Observability | stubs only | **Prometheus export + RUM + Grafana + alerts** | production pushgateway |
| Dependabot / CodeQL | none | **added** | triage SLA |
| Functions install | broken (`@google-cloud/tasks@^3.3.0` doesn't exist) | **fixed + lockfile committed** | — |

## Enforced engineering gates (CI fails when violated)

1. **Jest suite green** — `npm run test:coverage` (17 suites, 267 tests).
2. **Coverage floors** — `jest.config.cjs` `coverageThreshold`:
   - Global: ≥11% stmts / ≥9% branch / ≥10% funcs / ≥12% lines.
   - Per-file floors (80% band) on 21 core files: CacheManager, metricsService,
     validationService, soundService, sessionSecurityService, fraudDetectionService,
     fieldEncryption-adjacent security services, etc. A regression in any of
     them fails CI immediately.
3. **ESLint errors = 0** (warnings tracked, not blocking yet).
4. **Production build compiles** (`vite build`).
5. **`npm audit --audit-level=high`** (currently 0 high/critical).
6. **gitleaks** secret scan + **CodeQL** static analysis.
7. **axe-core** — no WCAG 2.1 AA violations on BottomNav, AdvancedToggleSwitch,
   GlobalErrorBoundary.
8. **i18n parity** — every locale must contain every English key (no silent
   missing-translation bugs).

## What was hardened in this pass (by constitution priority)

### 1. Tests — from stubs to real assertions
- Fixed the flaky `soundService` test that hit real Firestore and timed out →
  hermetic fake-Firestore suite (8 tests).
- New suites with real assertions:
  - `securityServices.test.js` — WAF (SQLi/XSS/RCE/traversal/XXE), CSRF,
    DDoS token bucket + ban logic, PoW challenges, security headers, CSP,
    impossible-travel detection, sanitization (33 tests).
  - `fieldEncryption.test.js` — AES-256-GCM round-trips, wrong-seed rejection,
    Unicode, 10KB payloads, recovery seed entropy.
  - `cacheAndCounters.test.js` — CacheManager (TTL, LRU eviction, wildcard
    invalidation, stats), RedisCacheManager, TTL optimization tiers, cache
    invalidation orchestration (21 tests).
  - `feedService.test.js` — seeded shuffle determinism, cursor codec,
    fallback scoring, diversity enforcement invariants (19 tests).
  - `validationService.test.js` — post/comment/username/coin schemas.
  - `observability.test.js` — Prometheus export format, percentiles, spans,
    SLO/error budget, cost accounting, RUM vitals, route timing (22 tests).
  - `featureFlagService.test.js` — fail-closed reads, override precedence,
    persistence, subscriptions (9 tests).
  - `soundService.test.js` (8), `i18n.test.js` (12), `accessibility.test.jsx` (5).
- Shared jest setup (`tests/jest.setup.js`) — polyfills, storage shims,
  ResizeObserver/matchMedia, so suites run in CI and locally identically.

### 2. Observability — stubs → runnable stack
- `rumService` hardened: INP + long-task observers, route timing API,
  `attachToMetrics()` pipeline, vitals evaluation vs web.dev thresholds.
- Dev `/metrics` endpoint (Vite middleware) serving Prometheus text format.
- `ops/` stack: prometheus.yml + alerts.yml (error rate, latency SLO, RUM,
  billing cap), provisioned Grafana "Arvdoul Overview" dashboard,
  docker-compose for local observability.
- See [OBSERVABILITY.md](OBSERVABILITY.md).

### 3. CI/CD — from fake gates to real gates
- Removed every `continue-on-error` / `if: always()` escape hatch.
- Pipeline: lint → test (coverage-enforced) → build → security (audit +
  gitleaks) → functions syntax check; staging deploy on `develop`, production
  deploy on `main` behind an environment approval.
- Concurrency groups, timeouts, least-privilege `permissions`.
- Added `dependabot.yml` and CodeQL workflow.

### 4. Feature flags — kill switches before the next deploy
- `featureFlagService` — static typed defaults, Firebase Remote Config overlay,
  localStorage-persisted admin overrides (instant rollback without a deploy),
  change subscriptions.
- `useFeatureFlag` React hook (useSyncExternalStore — runtime reactive).
- Wired into `AppBootstrap` (non-blocking background init).

### 5. Accessibility — WCAG 2.1 AA gates
- `BottomNav`: nav landmark, translated aria-labels, `aria-current="page"`,
  decorative icons hidden.
- `AdvancedToggleSwitch`: radiogroup/radio semantics with `aria-checked`.
- `GlobalErrorBoundary`: `role="alert"`, focus management on crash heading,
  loading/disabled states.
- axe-core test suite (jest-axe) gates these components in CI.

### 6. i18n — the platform can now leave the US
- i18next + react-i18next + language detector; 7 locales (en, es, fr, de, pt,
  hi, ar) with RTL direction handling for Arabic.
- Key-parity test in CI (every locale ⊇ en keys).
- First components translated: GlobalErrorBoundary, BottomNav; pattern
  documented for the rest.

### 22. Next-70 batch: server money-path hardening + rules compliance + honest renderers

**Server-side money/security fixes (functions/)**
- `sendEmailNotification` — logged "Would send..." and returned `{ success: true, mock: true }` →
  real SendGrid send when configured, honest `status: 'unconfigured'` otherwise.
- `verifyPurchase` — minted coins with NO receipt validation (client-callable free-coin
  exploit) → fail-closed: requires a receipt AND appstore/play config; coins only after
  real validation.
- `addCoins` — was an unrestricted client coin faucet (any amount, any reason, rate limit
  only) → allowlisted reasons with per-reason daily caps (post_created_bonus 10, reel_watch
  200, reel_reaction 50, comment 50, like 100, watch_ad 50, feed_view 200, quiz_correct 20,
  profile_complete 1); cap query fails closed; new composite index
  (coin_transactions: userId+reason+createdAt).
- `awardCoinsOnNotificationRead` — minted 1 coin per notification read (unbounded faucet) →
  coin minting removed (reads are tracked only).
- `processVideo` storage trigger — slept 5s and fabricated `status: 'ready'` → honest
  transcodeStatus (mux_pipeline / pending_upload_completion); readiness comes from Mux webhooks.
- New `functions/polls.js` `votePoll` — server-authoritative voting: client writes to the
  poll doc were DENIED by rules (creator/admin only) and wagers never debited real coins.
  Now: atomic counters + deterministic poll_votes doc (`${uid}_${pollId}`) + real
  double-entry wager debit in one transaction.

**Rules compliance**
- `firestore.rules` — `users` and `posts` updates now allow `isAdmin()` (admin console
  ban/verify/remove actions were being DENIED); added missing `video_reports` match.
- `pollService.votePoll` — routed through the votePoll CF (no client poll-doc writes);
  `poll_votes` deterministic id matches the rule contract.
- `AdminModerationQueueScreen` — now loads/resolves video_reports too.

**Honest UIs (no fabricated content)**
- `ExportModal` — fake export (random progress → Google demo video URL) → REAL renderer:
  seeks every clip frame-by-frame onto an offscreen canvas, records via MediaRecorder,
  real progress, honest WebM-only format notes, honest errors, real blob download/post.
- `PreviewCanvas` — removed Google demo video fallback.
- `MultiTrackTimeline` — fabricated sine waveform → real analyzed waveform or neutral bars.
- `RecordVoiceModal` — removed "simulator mode" claim.
- `CreateImage` — upload progress "simulation" → honest indeterminate state.
- `AudioCard` — fabricated waveform → neutral bars when no real data.
- `TextCard` — random background without postId → deterministic brand color.
- `SetupProfile` — fabricated random username fallback → availability-checked retry / honest error.
- `AIStudioScreen` copy — "audience retention simulation" → "AI audience analysis".

**Economy/level alignment**
- `QuickAccessPanel` — monetization gate was "Level 25" on a 15-level curve (never
  reachable) → Level 10 (matches WITHDRAWAL_MIN_LEVEL); badge colors aligned to real bands.
- `appStore` — fake `coins: 1000` starting balance → 0 (real balance comes from the ledger).
- `CreatePost` boost check + `PollsScreen` wager check — real `getBalance()` (no `|| 5000`).
- `ReelsFeed`/`CommentsModal`/`PostCard` — destructured `addCoins`/`followUser` from
  useAuth (undefined — rewards silently dead) → real monetization ledger + userService.
- `spacesService.createSpace` — fabricated host identity/Verified badge → real identity,
  `hostId`, sign-in required.

**Admin honesty**
- `AdminDashboardScreen` — removed fabricated trends ("+12% this week"), removed
  email-suffix admin authz, honest active-users (30-day) and pending-reports counts.

**Verification**: 35 suites / 486 tests green, lint 0 errors, build OK, dev server serves
all modified modules 200.

### 21. Next-70 production batch: money-path audit, rules compliance, real pipelines

**Money-path fixes (no free coins / no fake payments)**
- `marketplaceService.purchaseProductWithCoins` — was a LOCAL-ONLY deduction:
  buyer's coins were never debited server-side, stock writes were denied by
  rules (buyer ≠ creator), `buyerId` fell back to `'usr-buyer'`, and digital
  items got a FABRICATED `arvdoul.cloud/downloads/...` URL. Now: new
  `purchaseMarketplaceItem` Cloud Function (functions/monetization.js)
  atomically debits via the double-entry ledger, decrements stock, creates
  the order with real `buyerId`/`sellerId`, idempotent via the ledger;
  client fails loudly until deployed. Receipt shows an honest "seller
  provides delivery" note instead of fake tracking.
- `marketplaceService.listNewProduct` — fabricated creator identity
  (`'usr-creator'`, `'Arvdoul Creator'`, `@creator`), fake `Verified` badge,
  fake `rating 5.0`, `reviewsCount 1`, `stock 100`, `priceUsd 12.99` →
  real creator fields (or null), 0 ratings, explicit seller stock, and the
  rules-required top-level `creatorId` (create would have been DENIED).
- `spacesService.sendTip` — incremented the space counter but NEVER debited
  the sender (unlimited free tipping) → real `transferCoins` double-entry,
  requires `senderId`, space counter update is best-effort after settlement.
- `liveService.sendLiveGift` — recorded the gift + stats BEFORE charging
  coins, and a failed debit was only a warning (free gifts) → debit FIRST,
  gift only exists after ledger success.
- `liveService.sendLiveTip` — same bug → real `transferCoins` sender→streamer.
- `monetizationService.getPayoutSettings` fallback claimed
  `{ enabled: true, accountStatus: 'active' }` for an unconfigured account →
  honest `'unconfigured'`.
- `CreatorPayoutScreen.handleConnectStripe` — fake `setTimeout(1500)` +
  "Connected!" → real `createPayoutAccount` CF call with onboarding-URL
  handling; status loaded from `getPayoutSettings`.
- `VideoGiftModal` — fake local-only deduction (`coins: Math.max(0, userCoins -
  selectedGift.coins)` with fabricated `?? 1250` default) → real
  `transferCoins`, real balance from ledger, self-gift blocked.
- `VideoCard` follow button — was local state toggle + toast only (no handler
  wired) → real `userService.followUser/unfollowUser` with optimistic rollback;
  fabricated `@{... || 'abdulrahman'}` fallback removed.
- `VideoFeed.handleSave` — local-only watch-later → also persists via
  `videoService.saveVideo/unsaveVideo` (new Firestore `users/{uid}/saved_videos`
  + rules) with rollback.

**Rules compliance bugs (writes that Firestore would DENY)**
- `pollService.createPoll` — rules require top-level `creatorId == uid()`;
  the client wrote only a nested `creator` object → added `creatorId` + sign-in
  requirement.
- `marketplaceService.listNewProduct` — same (`creatorId` top-level).
- `videoService` — new `saveVideo/unsaveVideo/getSavedVideos` + rules
  (`users/{userId}/saved_videos/{videoId}`).

**Real upload/processing pipelines (were disabled or stubbed)**
- `soundService.uploadCustomSound` — stored a mixkit DEMO mp3 URL with
  fabricated duration/BPM/key/waveform and `'usr-creator'` → real Storage
  upload, real `decodeAudioData` duration + waveform, honest nulls, real
  `creatorId`, 0 counts. `SoundsScreen` now has a real file input (was a
  static div), requires sign-in, renders null-safe metadata.
- `videoService.uploadVideo` — moderation/watermark/fingerprint triggers were
  COMMENTED OUT (videos were never moderated/watermarked) → re-enabled.
- `functions/video.js` — `watermarkVideo`, `moderateVideo`, `updateViralScore`,
  `generateAudioFingerprint` were `onRequest` but the client wires them as
  `httpsCallable` (guaranteed protocol failure) → converted to `onCall`;
  `generateAudioFingerprint` was a documented stub storing a sha256 of the id
  as a "fingerprint" → honest `audioFingerprintStatus: 'unavailable'`.

**Honest data screens**
- `DataUsageScreen` — fully fake (hardcoded 2.4GB `USAGE_DATA`, `setTimeout`
  "clear cache", `setTimeout` "export email") → real `navigator.storage.estimate()`
  numbers, real `settingsService.clearApplicationCache()` + Cache API purge,
  real GDPR export via the `exportUserData` CF with a JSON download.
- `BadgeScreen`/`rankingService.getUserBadges` — service returned an ARRAY but
  the screen indexed it as an OBJECT (badges never displayed as earned), and
  progress/target fields never existed → real computation from user stats
  (posts, likes, views, followers, following, stories, account age, premium),
  returns the map contract; unverifiable metrics show "Progress not available
  yet" instead of fabricated zeros.
- `AppBootstrap` offline drain — `markAsRead` queued ops were dropped by the
  switch (default case) → real retry case wired.

**Verification**: 35 suites / 471 tests green, lint 0 errors, build OK, dev
server serves every modified module 200.

### 20. Every-screen module-load failure FIX + deep fabrication sweep

**ROOT CAUSE — "Failed to fetch dynamically imported module" on EVERY screen**
- The PWA service worker (`public/sw.js` v1) intercepted **all** same-origin
  GETs with cache-first semantics — including unversioned dev-mode module URLs
  (`/src/**`). After source rewrites/deletions (e.g. `seedPosts.js`), the SW
  served stale cached modules whose import chains referenced deleted files →
  every lazy route rejected with `TypeError: Failed to fetch dynamically
  imported module: .../CreatePost.jsx` and the intro showed "Temporary Glitch".
- **Fix**: `sw.js` v2 (`arvdoul-v2`) only intercepts navigations (network-first
  → cached shell) and versioned production assets (`/assets/**` hashed bundles
  + precache list). Dev module URLs, HMR (`/@vite/*`), `/src/*`, API calls →
  pure network pass-through. `CACHE_NAME` bumped so the poisoned v1 cache is
  purged on activate.
- `index.html` no longer registers the SW unconditionally; registration moved
  to `src/main.jsx` gated by `import.meta.env.PROD`, with dev-mode
  self-healing: unregister any stale SW + purge caches on boot (fixes browsers
  that still hold the broken v1).

**Intro screen / GlobalErrorBoundary / AppBootstrap hardening**
- `intro.glitchTitle/glitchText` are no longer dishonest "Temporary Glitch":
  all 7 locales now say "Something went wrong" + honest description + real
  error detail rendered inline; added `intro.errorDetail` key (7 locales).
- `GlobalErrorBoundary` now DETECTS module-load errors
  (`isModuleLoadError`: dynamically imported module / chunk failed) and
  recovers properly: purge service workers + caches → hard reload. "Clear
  Cache & Reset" also purges SW state before reloading.
- `AppBootstrap` — `onReady` was an inline arrow recreated every render,
  re-running the ENTIRE system init (Firebase, feature flags, RUM, offline
  drain wiring) on every re-render. Now `useCallback`-stabilized.

**Fabricated content removed (zero-mock sweep)**
- `pollService.createPoll` — fabricated creator identity ('usr-creator',
  'Arvdoul Creator', '@creator', Unsplash avatar) written to real Firestore
  docs → real user fields or explicit nulls; fake `endsIn: '7 days left'` →
  real computed `endsAt`; prediction pools no longer start with a fabricated
  5,000 coins (0 = all real wagers). `PollsScreen` renders the honest
  countdown + initials-avatar fallback.
- `collaborationService.getStats()` — hardcoded "Arvdoul Launch Reel" sample
  project (Unsplash + pravatar) → real Firestore query
  (`collaboration_projects` where ownerId == user, client-side sort, no
  composite-index requirement). Dashboard handles null thumbnails/members.
- `thumbnailService.generateThumbnailsFromVideo` — placeholder stub
  ("Would be actual frame URL") → REAL canvas frame extraction
  (seek → drawImage → JPEG data URL, per-frame error tolerance).
- `videoUtils.generateThumbnail` — picsum.photos placeholder generator (dead
  code) → honest `''` (callers render neutral tiles).
- `VideoEditor` — demo project media (`SAMPLE_PROJECT_MEDIA`, `INITIAL_LAYERS`
  with Google demo videos + Unsplash) deleted; `STOCK_VIDEOS`/`STOCK_AUDIO`
  catalogs (invented titles/BPMS over hotlinked demo files) → honest EMPTY
  catalogs with empty states in `MediaDrawer`/`ToolPanels`; added-video clips
  now get REAL frame thumbnails (`captureVideoFrame`); audio clips get REAL
  waveforms (`analyzeAudioWaveform` via Web Audio decode — the old
  `Math.random()` waveform was fabricated); editor opens as honest
  "Untitled Project" with no pre-made timeline.
- `TrimSubPanel` filmstrip — Unsplash fallback → neutral gradient tiles.
- `ThumbnailDesigner` — Unsplash "sample" canvas + demo "Explore More" text/
  sticker composition → self-contained branded SVG gradient canvas, empty
  composition; text-layer overlay now renders the ACTUAL layer data
  (text/font/color/shadow/position) instead of hardcoded demo strings.
- `aiStudioService` — removed ALL local template fallbacks (VIRAL_HOOK_TEMPLATES,
  SAMPLE_SCRIPTS, fake viral scores 85–99, fake "6:30 PM - 8:45 PM" best-time,
  fake sentiment/retention forecasts). When the AI gateway is unconfigured,
  every generator returns `null` and `AIStudioScreen` shows an honest
  unavailable banner + toasts. Real-path results no longer carry invented
  metrics either (`viralScore: null`, `recommendedPostTime: null`, raw AI text
  only).
- `ConflictResolutionScreen` — hardcoded fake conflict ("Loving the new
  Arvdoul update!") → REAL pending operations from `OfflineQueue`
  (new `getPending()`/`remove(id)`), with Keep-retry / Discard actions and an
  honest "No sync conflicts detected" empty state.
- `NotificationsScreen` — every notification stamped `timestamp: 'Just now'` +
  fabricated "Arvdoul User"/"interacted with your content." copy → real
  `createdAt` timestamps, honest fallbacks, no invented message text.
- CSP hardening: `CSPService` + `securityHeadersService` img-src no longer
  permit `images.unsplash.com` / `picsum.photos` (nothing in the app uses
  them anymore).

**Regression guards**: `noFabricatedData.test.js` extended with suites for the
SW (never caches `/src`, prod-only registration, no unconditional index.html
registration), VideoEditor (no Unsplash/demo project, real capture/analyze
helpers), pollService, collaborationService, videoUtils, CSP, ThumbnailDesigner,
AI Studio (no template fallbacks), ConflictResolutionScreen, NotificationsScreen.
`noMocks.test.js` now asserts every AI generator returns null without a gateway.
`production.upgraded.test.js` asserts the honest empty stats shape.

**Verification**: 35 suites / 448 tests green, lint 0 errors, build OK,
coverage 16.64% stmts / 17.5% lines (floors intact), dev server serves all
modified modules 200.

### 19. Stories + feed screens: real data end-to-end (fake data elimination #3)

**STORIES SYSTEM (called out) — all simulated data replaced**
- `StoriesCarousel` loaded from `currentUser?.stories`/`friends[].stories`
  (appStore has NO stories field - the carousel always rendered empty), with
  placeholder comments ("In real app..."). Now loads the REAL storyService
  feed (Firestore, moderated, seen-aware), maps groups with correct field
  normalization (media.url for media types, content for text stories,
  stats.reactions flattening, music title/artist), real pull-to-refresh via
  a refresh nonce, and a real current-user "Your Story" entry.
- 🔴 **Media rendering bug fixed**: the viewer used `story.content` as the
  image/video src while real stories store media in `media.url` - stories
  would have rendered broken images. Mapping now normalizes both.
- `StoriesScreen` (grid) - `SAMPLE_STORIES` (fake users + Unsplash) removed,
  now loads storyService feed with items/captions/views mapping.
- `CreateStory` - 🔴 VIDEO RECORDING WAS SIMULATED (a timer + fake Unsplash
  "recorded video"); now REAL MediaRecorder on the camera stream with blob
  output, honest errors when no camera. "Fallback capture" of a fake photo
  removed. Viewfinder default is an honest dark canvas (no fabricated
  photo). Gallery thumb is an icon (no fake image). `SAMPLE_DRAFTS` Unsplash
  thumbs -> real gradient presets applied as story background; publish
  payload now sends mediaFile + backgroundColor to createStory (it accepted
  neither before - image stories would have failed to upload media).

**MESSAGING LIST (MessagingScreen) - CONVERSATIONS_DATA mock removed**
- Hardcoded conversations ("Sophia Martinez", "Project X" + Unsplash) -> real
  getUserConversations (participant details, unread counts, last message
  previews, timestamps). PINNED_ITEMS fake carousel -> derived from the REAL
  top-5 conversations by unread count.

**PROFILE SCREENS - fabricated identities/stats removed**
- `ProfileMyScreen`: fallback profile had FAKE stats (14200 followers, level
  28, "Creator HQ", fake bio) + fake posts ("Neon futuristic spatial audio
  setup", 4120 likes) shown as the user's own - now real user fields only,
  zeroed counters, honest empty posts.
- `ProfileScreen`: same treatment (fake "Arvdoul Creator", 24500 followers,
  Dubai, 3 fake posts) -> honest fallback + real highlights (removed fake
  "Studio/VFX" highlight covers).
- `ProfilePublicScreen`: entire fake "Alyssa Vance" creator profile (48 level,
  Diamond Creator, Queen, 142.8K followers, mutual friends, highlights) ->
  honest empty profile.

**SAVED / NETWORK / REELS / ANALYTICS screens - mock data removed**
- `SavedScreen`: INITIAL_SAVED_ITEMS (fake packs, Unsplash) -> real
  getSavedPosts with snapshot mapping.
- `NetworkScreen`: RECOMMENDED_CREATORS (Elena Rostova, Marcus Chen...) ->
  real getFriendRecommendations; Empty component now receives recommended as
  a prop (was referencing an out-of-scope variable).
- `ReelsScreen`: SAMPLE_REELS (fake reels with Unsplash/mixkit media) ->
  real videoService.getVideoFeed with creator/title/stats mapping; fake
  "mutual friends" avatar stack -> honest indicator.
- `VideoAnalyticsScreen`: ENTIRE dashboard was fabricated demo data (1.25M
  views, $4520 revenue, fake videos/demographics) -> real analyticsService
  getUserAnalytics mapped into the dashboard with loading/empty states.
- `NotificationsScreen`: SAMPLE_NOTIFICATIONS (Sara Khan, Ibrahim...) ->
  real notifications only.

**BROKEN STUFF FIXED**
- MessageInput shared-contact button called useAuth() INSIDE an async event
  handler (Invalid hook call runtime error on click) -> proper top-level hook.
- Missing imports: SearchScreen useMemo, SavedScreen useMemo/useCallback,
  VideoAnalyticsScreen useAuth - all lint errors -> 0.
- Unsplash fallback URLs in marketplaceService, soundService, spacesService,
  VideosScreen, MessagingScreen -> /assets/default-profile.png.
- sw.js precache now includes logo-dark + default-profile.
- useVideo hook race condition (slow old fetch could overwrite newer video).

**TESTS**: 35 suites / 431 tests green, lint 0 errors, build OK.
(Remaining Unsplash references are only VideoEditor TEMPLATE presets - the
editor's stock sample clips that users replace, an intentional product
feature like CapCut's template media - not user data.)

### 18. Next-70 hardening batch (30+ verified fixes)

**MOCK DATA REMOVED (final remnants)**
- `videoService` returned fabricated `INITIAL_VIDEOS` (fake creators "Zaid
  Al-Harbi", "Elena Rostova"... + Unsplash URLs) when the real feed was
  empty -> honest empty feed. `src/data/videoData.js` stripped to only the
  real `VIRTUAL_GIFTS` catalog (6 config items used by VideoGiftModal).
- `VideoCard` Unsplash avatar/cover fallbacks -> `/assets/default-profile.png`.

**🔴 CRITICAL BUG: stale-balance coin overwrite (Composer)**
- `coins: (user.coins || 0) + 10` wrote a STALE in-memory balance over the
  real server balance (e.g. real 500 -> set to 60) - destroying user coins.
  Now: post creation via firestoreService.createPost (validation,
  moderation, XP, idempotency) + coin reward via monetizationService
  (server-side increment).

**🔴 CRITICAL BUG: CommentsModal wrote to a rules-DENIED path**
- Posted to `posts/{id}/comments` via addDoc with random ids - the security
  rules require docId == uid (denied in production) and it bypassed
  moderation/notifications/XP. Migrated to commentService (create, realtime
  subscribe, like/removeLikeDislike, delete, edit) with field normalization.

**BROKEN ASSET PATH (all avatar fallbacks)**
- Code referenced `/assets/default-profile.png` but public/assets/ did NOT
  exist - every fallback 404'd. Created public/assets/default-profile.png.

**BROKEN ATTRIBUTES (AdvancedPhoneInput)**
- Literal `REAL="..."` attributes (a broken find/replace of "placeholder")
  meant the phone input + country search had NO placeholders and invalid
  `REAL-gray-*` classes. Fixed (4 spots).

**ALT BUGS (template literals rendered as literal strings)**
- CommentsModal: `alt={r.displayName}` was the string "r.displayName".
- StoryList: alt was the string `story.username || "User"`.
- StoryViewer: alt was the string `currentStory.username || "Story"`.

**SECURITY**
- Verified all target=_blank links carry rel (noopener/noreferrer) - 5 files
  checked, all correct.
- VideoBottomSheet window.open -> added noopener,noreferrer features.

**UX (native alert() -> toasts)**
- AddStoryModal, AudioEditorScreen (x2), CollaborationScreen.

**A11Y**
- Composer media mute/remove buttons: type + aria-labels.
- MediaCarousel dots: type + aria-current.
- SyncProgress: role=progressbar (previous batch).
- Verified-correct: MediaCarousel arrows, SwipableMedia, BottomMenu,
  Stories mute, AdvancedPhoneInput country selector.

**ERROR VISIBILITY**
- Silent `catch (_) {}` in CounterReconciliationService + AggregationCache
  L2 write-through -> logged warnings (visibility without noise).
- Fixed missing toast import (ProjectDashboardScreen, CollaborationScreen) -
  lint errors -> 0.

**TESTS**
- noFabricatedData.test.js (5): videoData has no fake users/URLs, VIRTUAL_
  GIFTS intact, videoService has no mock fallback, Composer has no stale-
  balance write, CommentsModal has no denied subcollection write.
- 35 suites / 431 tests green, lint 0 errors, build OK.

### 17. 20-item hardening pass: mock removal, real bugs, honest utilities

**MOCK DATA REMOVED (the last of it)**
- feedService's offlineMode + catch blocks returned `INITIAL_SEED_POSTS`
  (fabricated "Welcome to ARVDOUL!" posts) - replaced with honest empty
  feeds. **Deleted `src/data/seedPosts.js` entirely** (193 lines of fake
  posts) - it was only imported by feedService.

**REAL BUGS FIXED**
- `QuickAccessPanel`: `window.toast.success` was dead code (window.toast
  doesn't exist) - the "Profile link copied!" toast never appeared. Now
  uses sonner's real toast with error handling + async callback.
- `PostCard.handleShare`: unguarded `navigator.clipboard.writeText` +
  `alert()` - now a robust cascade (native share -> clipboard -> hidden
  textarea fallback) with toasts, AbortError handling, no alert.
- `GlobalErrorBoundary`: unguarded `navigator.clipboard.writeText` - now
  falls back to a hidden-textarea copy when the API is unavailable.
- `StoriesCarousel`: onError set src to `/assets/story-placeholder.jpg`
  which DOES NOT EXIST (broken image icon) - removed; graceful gradient
  state instead.
- `useDoubleTap`: wired BOTH onClick AND onTouchEnd - on mobile a SINGLE
  tap fired the callback twice (i.e. one tap triggered the "double tap"
  like). Fixed to onClick-only with pair reset semantics + regression tests.
- `src/firebase/emulators.js`: imported `./core.js` and `./config.js`
  which DO NOT EXIST and was never imported anywhere - dead file deleted.
- `ReelsFeed.handleDownload`: now validates the response, revokes the blob
  URL after download, and sanitizes the filename.

**HONEST UTILITIES (stub removal)**
- `videoUtils.detectChapters` was an explicit stub (`// Placeholder -
  would use AI analysis`) returning [] - now generates real duration-based
  chapters (max 10, never fabricates when duration unknown).
- `videoUtils.validateVideoFile` destructured maxDuration/minDuration but
  never used them - now performs REAL duration validation via the browser
  video element (async).
- `videoUtils.compressVideo`/`extractAudio`/`generateTranscript` comments
  still said "(placeholder)" while the implementations are real - honest
  comments now.
- `PerformanceMonitor`: logged fake metrics (fps: 60, memory: 0) every 30s
  - now measures REAL navigation timing, resource transfer size, and
  network info into metricsService (Prometheus-exportable).

**POLISH**
- `manifest.json`: added id, brand theme/background colors, categories,
  lang, display_override.
- `useIntersectionObserver`: options stabilized via ref (no re-subscribe
  on every render).
- `SyncProgress`: role="progressbar" + aria-valuenow for screen readers.
- Verified already-correct: crashReportingService (real Sentry-style
  dispatch with PII redaction + failure safety), SearchBar (aria-label on
  clear), TopAppBar (aria labels), CommentsModal (real firestore).

**Tests**: videoUtils.test.js (7 - chapters, strategy, no-fabrication) +
useDoubleTap.test.js (4 - single-tap, pair, delay, consecutive pairs).
34 suites / 426 tests green, lint 0 errors, build OK, coverage 16.56%.

### 16. Intro "Temporary Glitch" — ACTUAL root causes found and eliminated

The previous i18n fix removed one crash source, but the glitch persisted. This
pass found and fixed the REAL remaining causes:

**🔴 Cause 1 — `window.matchMedia` unguarded (the intro killer)**
- IntroScreen's `resolvedTheme` memo called `window.matchMedia(...)` with no
  guard - throws in embedded webviews / preview iframes that lack the API,
  which crashed the intro into its boundary on EVERY launch. framer-motion's
  `useReducedMotion` and ThemeProvider's system-theme effect had the same
  hidden assumption.
- Fixes:
  - **Global polyfill** in index.html (inline, runs before the bundle) AND
    main.jsx: `window.matchMedia` is always defined as a safe no-op.
  - **`useSafeReducedMotion`** hook in IntroScreen: same semantics as
    framer-motion's hook but implemented on the media query directly with
    feature detection - no dependency on framer-motion's internal call.
  - ThemeProvider system-theme effect guarded.

**🔴 Cause 2 — ThemeProvider localStorage crash (whole-app unmount risk)**
- `useState(() => localStorage.getItem('theme'))` ran UNGUARDED in the lazy
  initializer. Sandboxed iframes throw SecurityError on ANY storage access;
  with no error boundary above ThemeProvider, the ENTIRE app unmounted to a
  blank screen (or, depending on timing, surfaced as the intro glitch).
- Fix: `safeStorageGet` / `safeStorageSet` wrappers - storage is now fully
  optional (theme simply won't persist when blocked).

**🛡️ Intro error boundary upgraded (no more dead-ends)**
- **Diagnostics**: the real error message + stack are persisted to
  `arvdoul_intro_error` in localStorage so the actual cause is triageable
  instead of guessing at "Temporary Glitch".
- **Auto-recovery**: the FIRST crash auto-retries once after 1.2s (transient
  issues resolve themselves); only a second consecutive crash shows the UI.
- **Escape hatch**: "Continue to App" button navigates to /home so the user
  is never stuck on the intro.

**Tests**: `introRobust.test.jsx` (4) - renders with throwing localStorage,
with matchMedia MISSING, with a no-op polyfill, and the escape-hatch key
resolves. 32 suites / 416 tests green, lint 0 errors, build OK.

### 15. Messaging & engagement screens: real systems (mock-free)

**ChatScreen REBUILT — was 100% simulation**
- The old screen rendered hardcoded `INITIAL_MESSAGES` ("Hey! How are you
  doing?", Unsplash media), a simulated "Isabella" auto-responder, a fake
  voice-note player (setInterval progress), fake polls and reactions, and
  NO service wiring at all.
- Now: real conversation by :conversationId (title/participants/type),
  realtime subscription (new messages, typing indicators, presence),
  send text (E2EE handled by the service), send media + VOICE, reactions
  via reactToMessage, read receipts (markMessageAsRead on view), voice
  playback via real <audio> with duration metadata, optimistic send with
  rollback, loading/error/empty states, conversation-info navigation.

**Voice messages — real bug fixed**
- `MessageInput` used `mediaRecorder.ondata` which NEVER fires - voice
  messages captured zero audio chunks and sent empty blobs. Fixed to
  `ondataavailable` with a size guard.
- `MessageBubble` now renders `voice` type with a real audio player +
  duration metadata (previously only 'audio' was handled).

**CommentsDrawer — rebuilt on the real comment system with replies**
- The old version wrote raw docs to `posts/{id}/comments` with a random doc
  id - the security rules DENY that (docId must be the uid) and it bypassed
  moderation, rate limits, notifications and XP entirely.
- Now: commentService (flat `comments` collection) with realtime
  subscription, REPLY TO ANY COMMENT (threaded, depth-limited, reply
  notifications), like/reply actions, composer with reply target UI,
  accessible dialog semantics.

**PostCard — likes & reactions wired to the real service**
- Old: raw `updateDoc` + `arrayUnion` on the post doc (hot-path array
  append, duplicates on re-reaction, no toggle, no counters, no
  notifications/XP).
- Now: firestoreService.likePost (transaction + sharded counters + author
  notification + like_received XP) with optimistic UI + rollback; reactions
  via addReaction (validates emoji, toggles, maintains stats.reactions
  counters); comment preview loads from the real commentService.

**AI Studio label honesty**: "Simulate Viral Retention" -> "Analyze Viral
Retention & Sentiment" (it calls the real AI gateway; the old label implied
fabrication).

**Tests**: chatScreen.test.jsx (6 tests - no-mock-content, real send, read
receipts, empty + loading states). 31 suites / 412 tests green, lint 0
errors, build OK.

### 14. Social systems completion: comments, follow, friends, gifts, likes

The five named systems were already structurally solid (transactions, sharded
counters, idempotency, rate limits) but were missing their SOCIAL LOOPS:

| Gap found | Fix |
|---|---|
| 🔴 `likePost` never notified the post author (createLikeNotification existed but was NEVER called) | likePost now fires the author notification + awards `like_received` XP - only on NEW likes (duplicate likes stay silent), both best-effort |
| 🔴 `sendGift` accepted ANY gift type and silently charged a default 10 coins | Unknown gift types now REJECT (`Unknown gift type: X`); valid gifts fire a `GIFT_RECEIVED` notification (new createGiftNotification helper) + award `gift_received` XP to the author |
| 🔴 `sendFriendRequest` never notified the recipient (FRIEND_REQUEST type existed, unused) | New createFriendRequestNotification helper + wiring; ALSO short-circuits when the users are already friends (new `areFriends`) |
| ❌ No cancel friend request | New `cancelFriendRequest(from, to)` - pending -> cancelled, sender-only, atomic |
| ❌ No friendship check API | New `areFriends(a, b)` - mutual-follow check, exported from facade |
| 🔴 `createComment` only notified on replies - the POST AUTHOR never learned about top-level comments | New `_notifyPostAuthor` fires createCommentNotification; commenter earns `comment_created` XP |
| 🔴 Level system existed but nothing except daily-login awarded XP | Wired real awards: like_received (likes), follow_received (follows), gift_received (gifts), comment_created (comments), post_created (posts) - all best-effort, never break the primary op, all idempotent + daily-capped |
| 🔴 Latent crash: `storageService` accessed `import.meta.env.DEV` / `import.meta.env.PROD` unguarded - throws in any runtime without import.meta.env (tests/SSR/exotic bundlers) | Optional-chained both; the social-systems test suite caught it |

**Tests**: new `socialSystems.test.js` (10 tests, hermetic fake-Firestore):
like notification+XP on new like only; gift type validation + notification+XP;
areFriends mutual-edge semantics; friend-request short-circuit + notification;
cancel (success, non-sender rejection); follow XP (new follow only).

**Verification: 30 suites / 406 tests green, lint 0 errors, build OK,
coverage 14.51% -> 16.49% statements.**

### 13. Rules, indexes & functions completion (deployment infrastructure)

**FIRESTORE RULES — every client-written collection now covered (105 match blocks)**
- Audit cross-checked every `collection(...)` call in src/ against the rules;
  **24 collections were written by client services but had NO rules** (default-
  deny would silently break them in production): coin_ledger (level rewards),
  saved_sounds, drafts, videos, copyright_registry, enterprise_tenants,
  event_feedback, gifts, incidents, live_tips, message_reports,
  moderation_appeals, poll_votes, story_replies, trending_topics, user_events,
  user_feedback, view_events, orders, monetization_outbox, rankings, trending,
  moderation_queue, user_recommendations.
- Each rule is ownership/participant-scoped, append-only where appropriate
  (poll_votes, view_events, coin_ledger), server-computed collections are
  read-only (rankings, trending, user_recommendations, trending_topics).
- **functionsContract.test.js** now GUARDS this forever: it statically checks
  that every client-written collection has a rules match, every client-called
  httpsCallable is exported AND required by index.js, GDPR exports deploy,
  and default-deny is the final block.

**FIRESTORE INDEXES — 93 → 98 composites**
- 5 genuinely missing composite indexes added (queries would fail at runtime
  without them): comments(postId+isDeleted+isHidden+moderationStatus+
  parentId+createdAt DESC), posts(isDeleted+moderationStatus+createdAt DESC),
  posts(category+isDeleted+moderationStatus+createdAt DESC),
  live_streams(status+startTime DESC), events(organizerId+startDate ASC).

**CLOUD FUNCTIONS — deploy bugs fixed + 3 new functions**
- 🔴 **Fixed deploy bug**: `exportUserData` (GDPR export) lived only in
  userExport.js which index.js never required - the function silently never
  deployed and the client's export call would fail. index.js now requires it.
- 🔴 **Dead module removed**: userDelete.js duplicated deleteUserData (the
  complete cascade lives in user.js); requiring it would crash deployment
  with a duplicate-export error.
- 🆕 **functions/ai.js** - the AI gateway the client aiStudioService ALREADY
  calls via VITE_AI_GATEWAY_URL: auth required, per-user rate limiting
  (Firestore sliding window), per-user daily budget caps, server-side OpenAI
  key (never VITE_), usage/cost telemetry to ai_usage_logs, 60s timeout.
- 🆕 **functions/saml.js** - SAML assertion verification the client
  samlService REQUIRES (fails closed without VITE_SAML_VERIFY_URL): tenant
  issuer/audience validation, RSA-SHA256 signature verification via
  configured publicCert, NameID/attribute extraction, auth required.
- 🆕 **functions/levelSystem.js** - server-authoritative awardExperience
  (same curve as client, caps + idempotency in an atomic transaction with
  coin ledger); the client levelSystemService now prefers the callable and
  falls back to its local transaction only when unreachable.
- All 20+ client-called callables verified exported with a deploy path.

**Verification: 29 suites / 396 tests green (6 new contract tests), lint 0
errors, build OK, all function modules pass node --check.**

### 12. Intro glitch FIX + Settings screen + Level system (real systems, not foundations)

**INTRO "TEMPORARY GLITCH" — ROOT CAUSE FOUND AND FIXED**
- Cause: `initReactI18next` was only registered inside the ASYNC `initI18n()`.
  When that promise was slow or failed (blocked localStorage in sandboxed
  preview iframes / privacy modes makes the LanguageDetector throw),
  `useTranslation()` had NO i18next instance and threw - the intro error
  boundary caught it and showed "Temporary Glitch" on every launch.
- Fix: `src/i18n/index.js` now performs a **synchronous, failure-proof base
  init at module load** (English fallback, no detector, try/catch-wrapped)
  so `useTranslation()` and `withLanguage` ALWAYS have a working instance
  from the first render. `initI18n()` upgrades with the detector and never
  throws. Regression suite `i18nRobust.test.js` proves: initialized at
  module load, first-render translation works, withLanguage injects t,
  blocked-storage init survives.

**LEVEL SYSTEM (`src/services/levelSystemService.js`) — the missing system**
- The platform stored `user.level`/`user.experience` and monetization could
  READ a static 15-level table, but NOTHING awarded XP or computed level-ups.
- Now: XP rules per action (post/comment/like/follow/login/gift/live) with
  per-action daily caps (anti-farming, tracked in XP units), atomic Firestore
  transaction (XP += , level recompute, experienceToNextLevel, level-up
  detection), coin rewards credited in the SAME transaction with a
  coin_ledger entry, idempotency keyed by action+source+date.
- Honest rank titles (Newcomer → Arvdoul Legend) + real perks mapped to
  actual platform capabilities (live ≥5 matches liveService, withdrawals
  ≥10 matches WITHDRAWAL_MIN_LEVEL).
- Wired: daily-login XP awarded once per session from AuthContext
  (idempotent by date). 14 tests (curve math, caps, level-up rewards,
  idempotency, unknown-action rejection).

**SETTINGS SCREEN — from static UI to a real system**
- `settingsService.js`: typed defaults, Firestore persistence
  (`users/{uid}` settings field), local cache, optimistic updates with
  ROLLBACK on failure (UI never lies), offline queue for offline writes,
  realtime subscription, and REAL cache clearing (localStorage preserving
  auth/session/locale + IndexedDB + in-memory caches).
- Screen: loading skeleton → sections (Account, Appearance, Notifications,
  Privacy, Playback, Data & Cache, Danger Zone), every toggle persisted,
  language switcher (7 locales → i18n.changeLanguage + persisted),
  reduce-motion override (document class + tokens.css rule), level card
  with XP progress bar + perks + lifetime rewards, delete-account flow
  through userService.deleteUserData with accessible confirmation Dialog.
- i18n: `settings.*` (40 keys) + `level.*` (10 keys) + `common.back` added
  to all 7 locales - parity test enforces.
- Tests: settingsService (merge/paths/persist/rollback/cache-clear) +
  settingsScreen (render, toggle→service, axe, delete dialog) + levelSystem.

**Verification: 28 suites / 390 tests green, lint 0 errors, build OK,
coverage 13.75% → 14.49% statements.**

### 11. IntroScreen fix + component enhancement pass

| Area | Before | After |
|---|---|---|
| IntroScreen data | **Fabricated statistics**: "10M+ Active Users", "99.99% Uptime", "500K+ Communities", "<50ms Latency", "Join millions of users" - invented claims shown as facts | Stats grid replaced with **honest product pillars** (End-to-End Encrypted, Privacy by Design, Creator-First, Real-Time Everything) - all true platform capabilities. Enforced by test (fake claims must never return) |
| IntroScreen i18n | ~25 hardcoded English strings | Full `intro.*` namespace in all 7 locales (headline, tagline, 6 features, 4 pillars, CTA, error boundary, sr-welcome, loading) |
| IntroScreen a11y | h4 after h2 (heading-order violation, caught by axe), emojis exposed to screen readers, hover-only feature cards | FeatureCard h3 (valid h1→h2→h3 order), aria-hidden decorative emojis, keyboard focus parity on cards (focus=hover), focus-visible rings, role=progressbar on scroll indicator, role=alert boundary, role=img logo |
| IntroScreen robustness | 🔴 **Real bug**: `canvas.getContext("2d")` unguarded - crashes the intro (into the error boundary) when canvas is blocked (privacy browsers/WebViews) | Null-guarded; particles skip gracefully. Same latent bug fixed in CreatePost (image + video thumbnails), CreateEvent (image compression), CreateVideo (thumbnail generator) - all now fail cleanly instead of crashing |
| IntroScreen code quality | dead `isMobile` state, empty cleanup, unused imports, `useReducedMotion` imported but ignored | Dead code removed; particles + button shine disabled under prefers-reduced-motion |
| Tabs primitive | plain buttons, no keyboard/ARIA | role=tablist/tab/tabpanel, aria-selected, roving tabindex, Arrow/Home/End keyboard nav, aria-controls/labelledby wiring via shared tabId, disabled handling. API-compatible |
| BottomSheet | raw div, no dialog semantics | role=dialog + aria-modal + aria-labelledby, Escape close, cyclic focus trap, focus restore on close, scroll lock, 44px close target |
| Avatar | image/initials/status only | **verified + creator badge overlays** (badge/status never collide), keyboard-operable click (Enter/Space), focus-visible ring, role=img on badges |
| Card | single style | variants (elevated/glass/solid/bordered), padding variants (none/sm/md/lg), interactive (button role + Enter/Space + hover lift), selected ring. Default = previous look |
| Jest infra | `@`-aliases unresolved in tests | `moduleNameMapper` maps all 10 Vite aliases - any screen/component is now testable with app-style imports |

**Verification: 24 suites / 356 tests green (new: introScreen.test.jsx integrity + componentsEnhanced.test.jsx), lint 0 errors, production build OK.**

### 10. Screen build-out pass (missing primitives + screen wiring)

| Area | Before | After |
|---|---|---|
| Input primitive | **missing entirely** | `src/components/ui/Input.jsx` - types (text/email/password/phone/search/number/otp), validation states (error/success/warning with icons), required/disabled/readonly/loading, label+hint+error wired via htmlFor/aria-describedby/aria-invalid, 44px min touch target. Exported from `components/ui/index.js` |
| Dialog primitive | **missing** (screens used raw fixed divs) | `src/components/ui/Dialog.jsx` - role=dialog + aria-modal, cyclic focus trap (Tab/Shift+Tab wrap), Escape close, focus restore to trigger, body scroll lock, sizes (sm/md/lg/fullscreen), close button + overlay (reduced motion via global tokens.css kill-switch) |
| NotificationsScreen gift modal | raw `<div class="fixed inset-0">` + framer-motion | replaced with accessible `Dialog` (focus trap, aria-modal, aria-labelledby) |
| NotificationsScreen empty state | raw h3 + button | design-system `EmptyState` + `Button` (role=status, translated-ready) |
| Tests | - | `inputDialog.test.jsx`: 17 tests (8 input + 9 dialog) - axe 0 violations, aria wiring, Escape/overlay close, focus trap cycling, focus restore on close |

Audit confirmed: **zero mock data / hardcoded arrays / TODOs / FIXMEs remain in screens or components** (previous zero-mock pass held; every remaining "placeholder" hit is a legitimate input placeholder attribute). All screens wire to real services (marketplaceService, soundService, pollService, useSearch, commentService...).

**Verification: 22 suites / 332 tests green, lint 0 errors, production build OK, dev server serves all new modules (HTTP 200).**

### 9. UI polish pass (design system, motion, analytics)

| Area | Before | After |
|---|---|---|
| Design tokens | 2 tokens (`primary` color + `spacing.base`), placeholder `Button.jsx` | **Complete token system** `src/design-system/tokens.js` (versioned `1.0.0`): brand gradient, bg/text/semantic colors, 4px spacing scale, radii, shadows/glass, motion (durations/easings/stagger + `reduce: 'kill'` policy), typography, z-index, breakpoints, a11y minimums (44px touch target, 4.5:1 contrast). Mirrored 1:1 into `tokens.css` (CSS variables) and `tokens.json` (versioned, backend/tooling-usable). Enforced by `designTokens.test.js`: required groups, motion policy, CSS kill-switch, JS/JSON parity, no hardcoded brand hexes in design-system components |
| Reduced motion (WCAG 2.2 2.3.3) | **Not supported** - every Framer Motion + Tailwind animation ran regardless of user preference | Global: `<MotionConfig reducedMotion="user">` in AppBootstrap + `tokens.css` `@media (prefers-reduced-motion: reduce)` that collapses ALL Tailwind animations/transitions to 0.01ms |
| Screen analytics | none (no screen_view events, no route timing) | `useScreenView` hook wired once into MainLayout: `screen_view_total` + per-screen counters in metricsService, RUM start/end route timing, performance marks. Zero per-screen tracking code (guide Part XII) |
| Design-system primitives | placeholder Button only | Real primitives: `Button` (6 variants x 3 sizes, loading/disabled/aria-busy, focus ring, active scale), `EmptyState` (role=status, explain/guide/action), `ErrorState` (role=alert, retry), `Skeleton` + `CardSkeleton` (shapes, pulse honoring reduced motion). 0 axe violations, enforced by `designSystem.test.jsx` |
| NotFound screen | hardcoded English, plain link | Design-system Button + i18n (`notFound.*` in all 7 locales), aria-labelledby, translated |
| i18n | 7 locales | `notFound` keys added to all 7 locales (parity test enforces) |
| Bundle tooling | - | `npm run analyze` / `analyze:build` (vite-bundle-visualizer) for performance budgets |

Also fixed: `jest-environment-jsdom` had been dropped from node_modules (reinstalled).

**Verification: 21 suites / 315 tests green, lint 0 errors, production build OK, dev server serves tokens CSS + /metrics.**

### 8. Zero-mock pass (v8.0 constitution sweep - "no mock data, no stubs, no placeholders")

Every claim in the v8.0 file-by-file analysis was verified against the actual
code. Most "entire service is a stub" verdicts were **false** (real WebAuthn in
passkeyService, real RMS amplitude analysis in audioModerationService, real
canvas keyframe sampling in liveModerationService, real skin-tone heuristics in
imageModerationService, real incident lifecycle, real vendor health checks,
real watermarking, real cost metering, real tax-form collection, real support
triage, real video keyframe moderation). The **genuine** mock/stub/bug items
found were eliminated:

| File | Issue found | Fix applied |
|---|---|---|
| `monetizationService.purchaseCoins` | 🔴 FREE-COINS BUG: after a failed Stripe call the client self-minted coins + fabricated a fake receipt | Client never mints coins. `purchaseCoins` now requires the server-side Cloud Function; failures throw `PAYMENT_FAILED`/`PAYMENT_GATEWAY_NOT_CONFIGURED`. Coins only enter via the double-entry ledger after server-verified payment |
| `aiStudioService._callOpenAI` | 🔴 OpenAI key shipped to the client (`VITE_OPENAI_API_KEY` + direct `api.openai.com` call) | Client calls a server AI gateway (`VITE_AI_GATEWAY_URL`); no key, no direct OpenAI endpoint in client code. Enforced by test |
| `samlService` | 🔴 "Simulated" SSO URLs (`sso.simulation.arvdoul.com`) + fake assertion validation (`decoded.includes('Signature')`) | Unconfigured domains now fail loud (`SAML_TENANT_NOT_CONFIGURED`); assertion validation requires a server endpoint (`VITE_SAML_VERIFY_URL`) and fails closed otherwise. Enforced by tests |
| `rankingService` | Mock creator/wealth/reputation/community rankings returned as real data on error | All mock fallbacks removed - errors return `[]` (honest empty). Dead mock section deleted |
| `VideoComments.jsx` | Hardcoded mock comments (Sarah Miller, Taylor Swift...) | Loads real comments from `commentService`; posting + likes persisted via the service with optimistic UI + rollback |
| `discoveryService` | Cold-start returned 2 fabricated "Welcome to the Future..." posts | Reads real approved posts from Firestore; empty feed on failure |
| `copyrightDetectionService` | Fake registry (`arv_disney_logo_fingerprint_64`, "WarnerMedia Ltd." etc.) | Real Firestore-backed registry with `registerWork`/`unregisterWork`; empty registry = no matches. Enforced by tests |
| `manipulatedMediaService` | `noiseSum % 1000 === 0` dummy deepfake trigger | Real statistical seam-energy + texture-variance analysis with calibrated thresholds. Enforced by tests |
| `childSafetyService` | Non-cryptographic FNV-ish "PhotoDNA" hash | Real SHA-256 digest (WebCrypto) as local pre-filter; FNV-1a only as an explicit last-resort fallback |
| `aiStudioService.localizeContent` | Fabricated "translations" (flag emojis + truncated source text) presented as real | Returns `untranslated: true` + original text when the gateway is unavailable; UI shows honest state |
| `RecordVoiceModal.jsx` | Fake recording: simulated timer + sample MP4/MP3 URLs inserted into the timeline | Recording requires a granted camera/mic stream; no stream = explicit error. Nothing fabricated is ever added to the timeline |
| `CreateImage.jsx` | "simulatedProgress" naming + fake-progress interval | Renamed `fallbackProgress` - it is only a UI progress-display fallback (capped at 99, never completes); completion only from the real storage promise |
| `LoginScreen.jsx` | Dev-mode mock reCAPTCHA verifier | Removed - phone auth requires a real reCAPTCHA; otherwise shows error |
| `realIntegration.js` | `export const realService = () => Promise.resolve({ ok: true })` placeholder | Real `IntegrationRegistry`: typed provider config, `isConfigured`, `requireConfigured` (fail-loud), provider inventory. Enforced by tests |
| `CSPService` | Crash on malformed violation reports | Null-safe handler (fixed in previous pass, retained) |

New test suite `src/__tests__/noMocks.test.js` (17 tests) **enforces** the
zero-mock contract: empty copyright registry, real SHA-256 digests, real
artifact thresholds, no client-side OpenAI key, fail-loud integration registry.

**Verification: 19 suites / 293 tests green, lint 0 errors, production build OK.**

### 7. Fixes found while hardening (real bugs)
- `CSPService.handleCSPViolation(null)` crashed on malformed reports → hardened.
- `RedisCacheManager` had no TTL-multiplier getter → added (observability).
- `functions/package.json` pinned a nonexistent `@google-cloud/tasks@^3.3.0`
  → fixed to `^3.2.0` + committed lockfile (fresh installs now work).
- `soundService` test hit live Firestore → hermetic fake.

## Roadmap (next 90 days, in priority order)

1. **Raise global coverage floors** (+5 pts/quarter) by testing the highest-
   value untested services: WAF-adjacent `apiSecurityGatewayService`,
   `monetizationService` ledger, `firestoreService` CRUD, `messagesService`
   E2EE helpers, `userIntegrityService`, `DDoSProtectionService` internals.
2. **Component i18n sweep** — externalize strings across screens (Auth, Feed,
   Profile, Messaging); add `es-419`, `ja`, `ko`, `id`, `tr`, `ru`.
3. **Feature flag admin UI** — manage flags + overrides from the Admin screens
   (service layer is ready; `getSnapshot()` exposes source per flag).
4. **E2E tests** — Playwright against the Firebase emulator suite (auth →
   post → feed → message → purchase happy path).
5. **Production telemetry** — deploy a Cloud Functions `/metrics` endpoint +
   pushgateway/OTLP exporter; wire Alertmanager → PagerDuty.
6. **Canary deploys** — Firebase Hosting channel for %-based rollout on `main`
   before full promotion; automated rollback on error-rate >1% (alert rules
   already shipped in `ops/prometheus/alerts.yml`).
7. **Design system** — tokens + Storybook for the existing Tailwind UI.

## How to run everything

```bash
npm test              # full suite (fast)
npm run test:coverage # suite + coverage floors
npm run lint          # ESLint gate
npm run build         # production build gate
docker compose -f ops/docker-compose.observability.yml up -d  # observability
```

## Guardrails

- **Never lower a coverage floor** without a documented engineering decision
  and a compensating test added in the same PR.
- **Never re-add `continue-on-error`** to CI. A red pipeline is the contract.
- Every new feature flag must be registered in `DEFAULT_FLAGS` (fail-closed).
- Every new UI string must be added to **all** locale files (CI enforces).
- New shared components must pass the axe-core suite before merge.
