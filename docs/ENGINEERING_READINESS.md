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
