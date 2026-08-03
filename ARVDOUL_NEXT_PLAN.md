# 🚀 ARVDOUL — WHAT'S NEXT: CHECKED & PLANNED (v1.0)

**Date:** 2026-08-03 · Based on live repo audit (all facts re-verified this session)

---

## 0. CURRENT STATE (verified snapshot)

| Dimension | Status |
|---|---|
| Build | ✅ `npm run build` passes (~3.7s) |
| Runtime crash bugs | ✅ **0** `no-undef` errors (15 → 0, all fixed) |
| Service refactors (13 prompts) | ✅ All complete + 10 shared utilities |
| Tests | ❌ **1 file** ("React is working 🎉" placeholder), no `test` script |
| Stub screens (routed) | ❌ **9+** (Chat, Settings, Saved, Collections, Network, CreateStory, ConversationSettings, Admin ×4) |
| Dead/duplicate files | ❌ **~23 in `src/` (~500 KB)** + 123 `.ultra_backups/` + 255 `dist/` files committed + junk files |
| PWA | ❌ No `sw.js` (index.html registers it → 404), manifest has **1 icon** (needs 192+512+maskable) |
| Firestore rules | ❌ Allow only 8 collections; client writes ~40 → **P0 blocker** |
| CI/CD | ❌ `lint`/`test` scripts missing, ESLint v9 no flat config, Node 18 vs 22, duplicate deploy workflows, `functions/` has no package.json |
| Observability | ❌ 732 `console.*` in src, no Sentry, audit queue never flushed |
| Offline queue | ⚠️ Built but **not wired** (no `onOnline` drain in AppBootstrap) |
| Deps hygiene | ❌ `tippy@0.0.0` (squatted pkg) + 13 truly-unused deps |
| Nav dead-ends | ❌ `/challenges`, `/change-password`, `/create-highlight`, `/email-verification`, `/explore` (+ earlier: `/analytics`, `/followers`, `/following`, `/auth`, `/discover`, `/trending`) |
| Feed counters integration | ❌ `feedService` fetches posts **without** overlay of shard-backed counts (only `firestoreService` overlays) |

---

## 1. PHASE 0 — UNBLOCK PRODUCTION (P0, do first)

### 1.1 🔥 Firestore rules rewrite (`firestore.rules`)
**Why:** the single biggest blocker — client writes to ~40 collections; rules allow 8.
**What:** per-collection `match` blocks mirroring the ownership checks the services already implement:
- `counter_shards` → signed-in write (shard keys are hashed paths; ownership implicit) + signed-in read
- `user_daily_stats` → owner read/write
- `transactions` → owner read (coin history), server-only write
- `conversations` + `conversations/{id}/messages` → **participant-membership check** (fixes the current "any user reads any chat" hole + unblocks messaging)
- `comments/{id}/likes|dislikes`, `live_viewers`, `live_comments`, `live_gifts`, `group_invites`, `blocks`, `friend_requests`, `notifications`, `notification_counters`, `push_tokens`, `user_settings`, `highlights`, `scheduled_messages`, `archived_stories`, `moderation_logs`, `comment_reports`, `user_reports`, `calls`, `post_analytics`, `profile_analytics`, `profile_views`, `communities*`, `events*`, `collaboration*` → ownership-scoped
- **Fix existing holes:** `posts/comments/stories` create must require `request.auth.uid == request.resource.data.userId`; `users` read → public profile projection or private-by-default; `follows` create/delete → validate both ids
- `storage.rules`: messages write must check chat membership; `temp` delete → owner-only

**Effort:** Med (1 file, ~200 lines) · **Blocks:** all new shard writes + messaging + communities/events/live/collaboration

### 1.2 🔥 Cloud Functions deployability
- Add `functions/package.json` (firebase-functions v5/6, firebase-admin, Node 22) + `functions/.eslintrc` + `npm` scripts
- Document required env: `MUX_SIGNING_KEY_ID/SECRET`, `MUX_WEBHOOK_SECRET`, `functions.config().perspective.api_key`
- Fix the 4 GH workflows: `npm run lint`/`test` don't exist; ESLint v9 needs `eslint.config.js` (migrate from `.eslintrc.*`); Node 18 → 22; **delete duplicate deploy workflow** (`firebase-hosting-merge.yml` vs `firebase_hosting.yml` use different secret names); PR preview workflow lacks `npm ci`

**Effort:** Low-Med · **Blocks:** backend coin/video/messaging logic actually running

### 1.3 🔥 Secrets hygiene
- Move hardcoded Firebase config out of `src/firebase/firebase.js` (and delete dead `firebase1.js`) → load from `VITE_*` env (the existing-but-unused `config.js` already implements this — wire it)
- Rotate the exposed API key after moving to env

---

## 2. PHASE 1 — COMPLETE THE FEATURES (stub screens → real)

### 2.1 💬 Messaging (biggest gap — "surpass WhatsApp/Messenger")
The service layer (E2EE, offline queue, idempotency, groups, invites, reactions) is **done and hardened** — the UI is the gap:
- **Wire the real chat UI**: `src/screens/MessagesScreen.jsx` (214 ln) + `src/components/messaging/*` (MessageBubble, MessageInput, ConversationItem, TypingIndicator — 1,273 ln) exist but are **unrouted**. Replace the 14-line `ChatScreen` stub and implement `ConversationSettingsScreen` for real
- **Missing UI** (services ready): group create/manage, invite links + QR, message reactions/long-press menu, edit/delete/forward, voice messages, attachments, typing indicator display, read receipts, pin/archive/mute, search (service `searchMessagesAlgolia` ready), scheduled messages
- Wire `MessagingContext` or `messagingStore` consistently (two parallel state layers exist — pick one as canonical)

### 2.2 ⚙️ Settings screen (currently 9-line stub)
Build real: profile edit (services ready), privacy (privacy settings in userService), notifications prefs (notificationsService ready), MFA management (authService ready), account deletion (userService), theme, blocked users list, language.

### 2.3 🔖 Saved & Collections (both stubs; backend ready)
- Saved: `firestoreService.getSavedPosts` exists → real grid UI with unsave
- Collections: new feature — collections CRUD + add/remove saved posts (collection `collections` + `collections/{id}/items`; rules + indexes)

### 2.4 🤝 Network screen (stub; userService ready)
Followers/following lists (cursor pagination ready), friend requests accept/decline UI, mutual friends, recommendations, block list management.

### 2.5 📸 Create Story (UI-only stub; storyService ready)
Real create flow: media capture/upload, text overlay, stickers, audience selector, highlights assignment.

### 2.6 🛡️ Admin (4 stub screens; server `isAdmin()` exists)
- Gate routes with `isAdmin()` (client check + CF verification)
- Real dashboards: users (list/ban/suspend/verify), content moderation queue (commentService.reportComment/moderation ready), reports triage
- Add `admins` collection rules (server-write only)

### 2.7 🧭 Navigation repair
- Add routes for the 5+ dead links (`/challenges`, `/change-password`, `/create-highlight`, `/explore`, `/trending`, `/analytics`, `/followers`, `/following`) — point at real screens (Rankings exists; change-password → authService; explore → Search; trending → feed)
- Real 404 page (currently catch-all silently redirects to `/home`)

---

## 3. PHASE 2 — WORLD-CLASS UI POLISH

### 3.1 Design-system consistency
- Audit all screens against ThemeProvider tokens (gradients, spacing, radius, springs): replace inline `bg-gradient-to-*` with the ARVDOUL DNA gradient + `GlassCard`/`GlassButton` primitives
- One canonical `LoadingSpinner`/`EmptyState`/`ErrorState` per state (multiple variants exist: `components/UI`, `components/Shared`, `components/System`)

### 3.2 Dark mode sweep
- Verify every screen in dark mode (MainLayout gradient + class-based tailwind already set up) — audit for hardcoded `bg-white`/`text-black`

### 3.3 Accessibility (WCAG AA)
- Remove `user-scalable=no` + `maximum-scale=1` (violates 1.4.4)
- Remove global `user-select:none` / `contextmenu` blocking (or scope to app chrome)
- `aria-label` pass on all icon buttons; keyboard nav; focus rings; `prefers-reduced-motion` (only IntroScreen honors it today)

### 3.4 Motion & micro-interactions
- Consistent framer-motion transitions (page, list, like-heart burst, story progress)
- Haptics (utils/haptics.js exists) wired to key interactions on mobile

### 3.5 Responsive
- Verify tablet/desktop layouts for every screen (many are mobile-first; Profile grid, messaging split-view on desktop — the "surpasses desktop apps" claim needs a real 2-pane Messages layout)

---

## 4. PHASE 3 — FEATURE ENHANCEMENTS (parity + differentiation)

| Feature | Current | Target |
|---|---|---|
| Reels/Video | `FullScreenReels.jsx`, `ReelsScreen.jsx` exist; video feed works | Gesture polish, sound-on hover, watch-history resume, duet/stitch UI (services ready), chapters UI |
| Live | Screen + service ready | Streamer control room (start/end, viewer count, gifts/tips live feed), gifts picker, viewer list |
| Coins/Wallet | CoinsScreen + monetizationService | Wallet dashboard (balance, transactions w/ cursor, withdrawal request UI, purchase flow w/ verifyPurchase CF) |
| Rankings/Reputation | RankingsScreen + rankingService | Leaderboard tabs, position change animations, badge/level UI |
| Search | Algolia wired + fallback | Typed search UX, filters, recent searches, trending topics widget |
| Stories | Service ready | Create UI (2.5), highlight ring on profiles, viewer list per story (service ready), poll/quiz/countdown interactions (services ready!) |
| Notifications | Screen ready | Group-by-day, action deep-links, push permission flow (messaging/FCM — new workstream) |
| Profile | Rich (22 components) | Theme/customization for creators, PFP badges, mutual-friend rows, featured content curation |
| Monetization for creators | analyticsService + CreatorDashboard | Coin → payout flow (withdrawal min-level gates exist in CF), boost post UI |
| Onboarding | IntroScreen/SplashScreen exist | Tutorial walkthrough (react-joyride is installed but unused!), suggested-follows during setup |
| PWA | Broken | sw.js (precache + offline shell using offlineCache.js), 192/512/maskable icons, install prompt, FCM push |
| Calls | `calls` collection referenced | Voice/video call UI (WebRTC) — stretch |

---

## 5. PHASE 4 — HARDENING & SCALE (billion-user readiness)

### 5.1 Integration gaps (from this audit)
- **feedService must overlay shard-backed counters** on posts it fetches (currently only firestoreService does) — otherwise feed shows stale `stats.likes/comments`
- Wire **OfflineQueue drain**: `offlineQueue.onOnline(handler)` in AppBootstrap with per-type handlers (comment.create, live.join/leave, live_gift, storage.upload, notification.welcome, search.analytics) — the queue is built but nothing drains it
- Audit flush: scheduled Cloud Function that drains `AuditLogger` IndexedDB queue → `audit_events` collection (with rules: server-only write, admin read)
- Single canonical state layer per domain: `MessagingContext` vs `messagingStore`; `AuthContext` vs `appStore` — document and pick one

### 5.2 Security hardening
- Input validation library (zod) at service boundaries (community/event/live currently shallow)
- Server-side rate limiting: extend CF throttling (auth attempts, message sends, comment spam — client guards are UX only)
- Remove `tippy@0.0.0` + 13 unused deps (~shrinks install + supply-chain surface); `npm audit` gate in CI
- Storage: orphaned-file cleanup CF (delete files when posts/stories deleted), signed URLs (video CF already does), malware scan hook
- Admin/moderation: role-based access end-to-end (rules + CF + UI)

### 5.3 Performance
- Bundle audit (vite-bundle-visualizer installed): ImageEditor 494KB/148KB gz is the biggest chunk — route-split or lazy-load sub-editors
- `manualChunks` exists only in unused `vite.config.cjs` — merge into active config
- Console-log stripping in prod build (babel plugin) — 732 statements today
- List virtualization audit (>100-item lists: feed uses Virtuoso ✅, others?)

### 5.4 Observability
- Logger → Sentry sink (breadcrumbs + errors), performance traces (Firebase Performance exists in config)
- SLI counters per service (feedService already has a private `_reportHealthMetrics` — wire to real metrics)
- Correlation IDs already flow through the refactored services — add to UI layer on action start

---

## 6. PHASE 5 — CLEANUP & DX (the "duplicate etc." work)

### 6.1 Dead-code removal (verified zero-import files, ~500 KB)
**Delete (no behavior change):** `src/App.jsx`, `src/index.jsx`, `src/HomeScreen.jsx`, `src/OtpVerification.jsx` (after fixing import), `src/SignupStep2VerifyContact.jsx`, `src/screens/Home.jsx`, `src/screens/ProfileScreen.jsx`, `src/screens/EditProfile.jsx`, `src/screens/ForgetPassword.jsx`, `src/screens/VerifyEmail.jsx`, `src/screens/EmailPasswordReset.jsx`, `src/screens/EmailVerification.jsx`, `src/screens/EmailLinkHandler.jsx`, `src/screens/ResetPassword.jsx`, `src/screens/MessagesScreen.jsx` (or **wire it** — see 2.1), `src/screens/SplashScreen(0).jsx`, `SplashScreen.simple.jsx`, `src/screens/SetupProfile.jsxnd`, `src/services/authService1.js`, `src/firebase/firebase1.js`, `chatScreen.jsx`/`messagingScreen.jsx` (empty), `.bak`/`.orig`/`backup` files (~15), `src/routes/738`, `src/Exp`/`src/store/USO`/`src/context/Fix`/`src/styles/Hsh`/`src/components/*/Exp` (empty), `src/context/AuthContext.jsx^C`, `w3mhelperpaneldy...`, `public/icons/766` (Termux dump), `public/367.js`, `public/logo/Tt.java`
**Git hygiene:** `git rm -r .ultra_backups/ dist/` + `.gitignore` them; untrack `package-lock` churn from cleanup

### 6.2 Config deduplication
- One `vite.config.js` (merge manualChunks from unused `.cjs`); delete `vite.config.backup.js`, `vite.config.cjs`
- One postcss config (keep `postcss.config.cjs`, delete `.js` + `.bak`)
- One Firebase module (delete `firebase1.js`, `compat.js` if unused — check imports)

### 6.3 Tooling & DX
- `eslint.config.js` flat config (migrate `.eslintrc.cjs` rules: react, hooks, a11y) + `npm run lint` script
- Prettier config + `npm run format`
- Jest: `npm test` script (config exists) + first tests: 10 utilities, then 13 services (mock Firestore), then integration (signup→profile→feed)
- `.env.example` documenting all `VITE_*` vars; CI env wiring
- README: architecture diagram, service map, runbook, ADRs (sharded counters, E2EE, cursor pagination)

---

## 7. RECOMMENDED EXECUTION ORDER (next 3 things to build)

1. **P0-1: Firestore rules rewrite** — unblocks everything; ~200-line single-file change (1-2 sessions)
2. **P0-2: CI/Functions fix** — package.json scripts, eslint.config.js, Node 22, functions/package.json (1 session)
3. **P1-1: Wire real messaging UI** — highest user-visible value; service layer already 10/10 (2-3 sessions)

Then: dead-code sweep (safe, fast win) → Settings/Saved/Network screens → PWA → tests → observability.

---

## 8. RISKS / BLIND SPOTS
- **Firebase project `arvdoul-8057b` is live** — rules changes must be tested in emulator first (firebase.json already has emulator config; nothing runs them yet)
- Feed counter overlay (5.1) changes displayed numbers — verify legacy fallback covers pre-shard data (it does by design)
- Messaging UI: two state layers exist — pick canonical before building new UI or you'll get drift
- Don't delete `src/screens/MessagesScreen.jsx` until the chat route is wired — it's the only real chat UI
