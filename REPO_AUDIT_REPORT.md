# Arvdoul — Full Repository Audit & Architecture Analysis

> Audit date: 2026-08-03 · Branch: `arena/019fc8f9-arvdoul`
> Scope: every source/config file, the Cloud Functions backend, Firestore/Storage security rules, build pipeline, tests, and dead/garbage artifacts.
> Method: static analysis (grep/AST-style review of all 357 tracked files), cross-referencing the client ↔ Cloud Functions callable surface, and verifying Firebase module wiring. No code was modified.

---

## 0. Executive Summary (read this first)

The repo is a large, ambitious React 18 + Vite + Firebase social platform (feed, stories, reels, messaging, live, communities, events, monetization, admin). The **service layer and Firestore rules are genuinely strong**. But there are several issues that range from **build-breaking** to **runtime-crashing** to **security gaps**:

| # | Severity | Issue | Where |
|---|----------|-------|-------|
| 1 | 🔴 Critical | `public/index.html` is an *unrelated* "Mardiyyerh" romance page. Vite copies `public/` over the build output, so `npm run build` ships the wrong `index.html` to production. | `public/index.html` |
| 2 | 🔴 Critical | 7 active components import `db`/`storage`/`auth` from `firebase.js`, which **does not export those names**. They resolve to `undefined` and crash core flows (post, comment, reels, phone signup). | 7 files in `src/components`, `src/context` |
| 3 | 🟠 High | Client↔Functions drift: `scrapeLink` is actively invoked but **not deployed**; 4 functions are deployed as HTTP `onRequest` but the client calls them via `httpsCallable` (protocol mismatch); ~6 AI/post helpers referenced with no server impl. | `src/services`, `functions/*` |
| 4 | 🟠 High | Firestore rules gaps: `usernames` writable by **any** signed-in user (username hijack); `calls` readable/writable by **any** signed-in user (call/privacy leak); community/event/collaboration subcollections broadly writable; `post_analytics` writable by anyone. | `firestore.rules` |
| 5 | 🟡 Medium | Massive Firebase module fragmentation: 5 overlapping modules (`firebase.js`, `config.js`, `core.js`, `compat.js`, `instances.js`); 4 are dead/unused, and `index.js` has an `export *` name-collision that silently drops `getAuthInstance`/`getStorageInstance`/`initializeFirebase`. | `src/firebase/*` |
| 6 | 🟡 Medium | No Content-Security-Policy / security headers; 578 `console.*` calls (only single-line `log/debug/info` stripped in prod). | `index.html`, whole `src` |
| 7 | 🟡 Medium | Dead code / garbage / duplicate config: root `App.jsx`, `HomeScreen.jsx`, `offlineCache.js`; `src/assets/12` (21 KB text), empty 1-byte junk files `src/hooks/8`, `src/lib/68`, `src/layouts/46`; duplicate `vite.config.cjs`, `.eslintrc.cjs`, `.eslintrc.json`, `postcss.config.cjs`. | multiple |
| 8 | 🟢 Low | Test coverage near-zero (2 test files for utils only). Several stubs ("Coming soon" toasts, `generateAudioFingerprint` Chromaprint stub, ML feed stub, royalty-free music URL stub, MFA stubs). Duplicate `ErrorBoundary` (×3). `UserContext` dead. App Check configured but never initialized. | many |

---

## 1. Architecture Overview

```
src/
  main.jsx ──> app/AppBootstrap.jsx (SystemInitializer, offline-queue wiring)
            └─> routes/AppRoutes.jsx (lazy screens, Protected/Public/Auth guards)
  firebase/
    firebase.js        ← ACTIVE singleton manager (modular SDK, async getters)
    config.js / core.js / compat.js / instances.js / index.js  ← DEAD/overlapping
  context/   8 contexts (Auth, User[dead], Theme, ThemeProvider, Signup, Posts, Comments, AppStore)
  services/  25 services (auth, user, feed, video, messages, notifications, monetization, search, …)
  store/     6 zustand stores
  screens/   ~50 screens (auth, feed, video, messaging, admin, community, event, …)
  components/ feature components (Home, Videos, Stories, profile, search, messaging, UI, Shared)
  hooks/ utils/ lib/  helpers
functions/   9 Cloud Functions modules (user, feed, comments, stories, video, notifications, messaging, search, monetization)
firestore.rules / storage.rules  ← deny-by-default, ownership/role-scoped
```

**What's well-built**
- **Firestore rules** are comprehensive and deny-by-default, with ownership/participant checks and `allow write: if false` for server-only collections (coins, transactions, subscriptions, idempotency_ledger, rate_limits, fanout_tasks, admins, moderation_logs).
- **Service layer** consistently uses the async `getFirestoreInstance()` / `getAuthInstance()` pattern and includes offline-queue draining, idempotency, and sharded counters in the Cloud Functions.
- **XSS handling is correct where it matters**: rich-text rendering in `CreateText.jsx`, `CreateQuestion.jsx`, and `TextCard.jsx` passes through `DOMPurify.sanitize` before `dangerouslySetInnerHTML`.
- **Cloud Functions** are well-structured (atomic transactions, idempotency ledger, scheduled cleanup, recovery jobs for stuck tasks).

---

## 2. 🔴 Critical Bugs

### 2.1 `public/index.html` clobbers the production build
`public/index.html` is a **completely different project** — a "🌸 Mardiyyerh — My Eternal Love 🌸" romance page (Playfair Display fonts, heart-burst animations, love-letter copy). Vite copies `publicDir` contents into `outDir` *after* the build, so `dist/index.html` (the real compiled app) is **overwritten** by this page.

Consequence: `npm run build` + Firebase Hosting deploy serves the wrong page. The dev server (`vite`) uses the root `index.html` (the correct one), so this bug only manifests in **production builds** — easy to miss locally.

Fix: delete `public/index.html`. (If a custom public HTML is ever needed, it must be the real app shell, not a different project.)

### 2.2 `db` / `storage` / `auth` imported from a module that doesn't export them
`src/firebase/firebase.js` only exports async getters + `FIREBASE_CONFIG`:
```js
export { getAuthInstance, getFirestoreInstance, getStorageInstance,
         getMessagingInstance, initializeFirebase, awaitFireReady,
         isFirebaseInitialized, FIREBASE_CONFIG };
```
But 7 active files import `db`/`storage`/`auth` (synchronous values) from it and use them as **live modular-SDK instances**:

| File | Import | Used as |
|------|--------|---------|
| `src/components/Home/Composer.jsx` | `db, storage` | `collection(db,…)`, `ref(storage,…)` — post creation |
| `src/components/Home/CommentsModal.jsx` | `db` | comment CRUD |
| `src/components/Home/ReelsFeed.jsx` | `db` | `collection(db,"reels")` — reels feed |
| `src/components/Videos/CommentsDrawer.jsx` | `db` | comment reads |
| `src/context/CommentsContext.jsx` | `db` | comment create/transaction |
| `src/context/PostsContext.jsx` | `db, storage` | post CRUD |
| `src/context/SignupContext.jsx` | `auth, db, storage` | `signInWithPhoneNumber(auth,…)`, `doc(db,"audit_logs")` — phone signup |

Because `db`/`storage`/`auth` are **not exported**, they are `undefined`. Every `collection(db, …)` / `ref(storage, …)` / `signInWithPhoneNumber(auth, …)` throws `TypeError: Cannot read properties of undefined`. These are **core, user-facing flows** (creating a post, loading/adding comments, viewing reels, phone verification signup).

The rest of the codebase does this correctly by `await getFirestoreInstance()`. The canonical fix is to align these 7 files with that pattern (or add a properly-initialized synchronous `db`/`auth`/`storage` export). `src/context/UserContext.jsx` has the same bad import but is itself dead (see §7).

---

## 3. 🟠 High — Integration Gaps (Client ↔ Cloud Functions)

The client invokes `httpsCallable(...)` for named functions; the server must deploy matching `onCall` functions. Cross-referencing both sides:

**A. Referenced but NOT deployed (will throw `functions/not-found`):**
- `scrapeLink` — **actively invoked** in `CreateLink.jsx:172` (debounced link preview) → broken link previews ("Failed to fetch link preview").
- `generateAICaption`, `generateAIHashtags`, `moderatePost`, `predictPostPerformance` — wired to AI handler objects in `CreatePost.jsx`; breaking the AI-caption/hashtag/moderation/performance features when clicked.
- `reportComment` — `CommentsDrawer` builds `httpsCallable(getFunctions(),'reportComment')`, but the actual report path in `commentService.reportComment` writes to `comment_reports` client-side, so the missing callable is latent here.
- `reportPost`, `sendPushNotification`, `boostPostRanking` — referenced in services; verify before relying on them.

**B. Deployed as HTTP `onRequest` but called via `httpsCallable` (protocol mismatch → always fails):**
- `watermarkVideo`, `moderateVideo`, `generateAudioFingerprint`, `updateViralScore` (`functions/video.js`). The actual invocations in `videoService.js` are currently **commented out** (lines ~504-509), so this is a *latent* bug — uncommenting them will break. Convert to `onCall` or call them over HTTP, not `httpsCallable`.

**Note (corrected):** the entire *video engagement* set (`likeVideo`, `shareVideo`, `recordVideoView`, `payPerView`, `sendTip`, `setVideoChapters`, `createDuet`, `createStitch`, `reportVideo`, `getVideoRecommendations`, `createMuxUpload`, `getMuxPlaybackUrl`) **is** deployed as `onCall` — my first pass missed them because `video.js` destructures `const { onCall } = functions.https`. So video likes/views/tips/duets are wired correctly; only the 4 `onRequest` ones above are mismatched.

---

## 4. 🟠 High — Security & Hardening (Firestore Rules)

The rules are good overall, but these are real gaps:

1. **Username hijacking** — `match /usernames/{username} { allow create, update, delete: if isSignedIn(); }`. Any signed-in user can create/overwrite/delete **any** username doc. Should scope to `request.resource.data.userId == uid()` and validate the doc id ↔ owner relationship.
2. **Call privacy leak** — `match /calls/{callId} { allow read, write: if isSignedIn(); }`. Any authenticated user can read/write **any** call document (including ICE candidates / signaling). Scope to participants (as `messages` already does).
3. **Broad subcollection writes** — `communities/{id}/{subcollection}`, `events/{id}/{subcollection}`, `collaboration_projects/{id}/{subcollection}` allow `write: if isSignedIn()` for *any* signed-in user. Tighten to owner/member where appropriate.
4. **`post_analytics` writable by anyone** — `allow write: if isSignedIn();` lets any user forge analytics docs. Should be server-only or owner-scoped with `diff().affectedKeys()` constraints like `profile_analytics`.
5. **`stories/{id}/comments` broadly writable** — `allow write: if isSignedIn()` permits deleting others' story comments; restrict `delete` to author/admin.

**Other hardening gaps**
- **No CSP / security headers** in `index.html` (no `Content-Security-Policy`, `Referrer-Policy`, `Strict-Transport-Security`). For a UGC social app this materially raises XSS/clickjacking risk.
- **578 `console.*` statements** across `src`. The production `vite.config.js` `stripConsolePlugin` only removes *single-line* `console.log|debug|info` and leaves `console.warn`/`console.error` (and multi-line logs). This leaks internal state and bloats the bundle.
- **App Check** is configured in the (dead) `config.js` but **never initialized** in the live `firebase.js`, so it provides no protection. ReCAPTCHA *is* wired for phone auth.
- **Hardcoded Firebase config** (apiKey, projectId, etc.) lives in `firebase.js`. Web API keys are not secret, but they should come from env vars (the `VITE_FIREBASE_*` fallbacks exist) and not be committed as the primary value.

---

## 5. 🟡 Medium — Firebase Module Fragmentation

Five modules under `src/firebase/` overlap confusingly:

- `firebase.js` — **active**, used ~35× across the app. Modular SDK, async getters.
- `config.js` — dead. Contains a `FirebaseConfigManager` that **throws on import** if env vars are missing; also references `FIREBASE_CONFIG`/`ENVIRONMENT`/`FEATURES` that nothing provides.
- `core.js` — dead. Uses a completely different `window.firebase` (namespaced SDK) pattern and imports `FIREBASE_CONFIG`/`ENVIRONMENT`/`FEATURES` from `config.js` (which doesn't export them) — all `undefined`.
- `compat.js` — dead but **imports `getFirebaseAuth`, `getFirebaseFirestore`, `getFirebaseApp`, … from `firebase.js`**, none of which exist there (firebase.js exports `getAuthInstance`, etc.) → all `undefined`.
- `instances.js` — dead. Same broken imports from `firebase.js`.
- `index.js` — `export * from './firebase.js'` **and** `export * from './compat.js'`. Both export `getAuthInstance`, `getStorageInstance`, `initializeFirebase`, so per ES spec the conflicting names are **silently dropped** from the combined export. Latent landmine if anything imports the bare `src/firebase` index.

Recommendation: delete `config.js`, `core.js`, `compat.js`, `instances.js`, `index.js` (nothing imports them — verified), keeping only `firebase.js` (+ `emulators.js` if used).

---

## 6. 🟡 Medium — Dead Code, Garbage & Duplicate Config

**Wrong-project / garbage**
- `public/index.html` — unrelated "Mardiyyerh" page (see §2.1). **Delete.**
- `src/assets/12` — a 21 KB markdown "blueprint" doc saved with a numeric name as an asset. **Delete** (move to docs if needed).
- `src/hooks/8`, `src/lib/68`, `src/layouts/46` — empty 1-byte files (accidental). **Delete.**

**Dead root-level files** (the real app entry is `src/main.jsx` → `AppBootstrap`)
- `App.jsx`, `HomeScreen.jsx` (placeholder "Future Feed Area"), `offlineCache.js`. **Delete** (a real `src/utils/offlineCache.js` exists).

**Duplicate build/lint configs** (only the `.js` variants are honored)
- `vite.config.cjs` (dead; `vite.config.js` used), `.eslintrc.cjs` + `.eslintrc.json` (dead; `eslint.config.js` flat config used by ESLint 9), `postcss.config.cjs` (dead; `postcss.config.js` used). **Delete the `.cjs`/`.json` duplicates.**
- Keep `babel.config.cjs` — it is used by `jest`/`babel-jest`.

**Redundancy**
- `ErrorBoundary` exists in 3 places (`components/ErrorBoundary.jsx`, `components/Shared/ErrorBoundary.jsx`, `components/UI/ErrorBoundary.jsx`); likely only one is used.
- `UserContext.jsx` is imported by **nothing** (only itself) — superseded by `AuthContext`. Dead.

---

## 7. 🟢 Low — Stubs, Missing Features & Tests

**Stubs / placeholders**
- `src/screens/GroupInfoScreen.jsx:269,281` — `toast.info('Coming soon')` on real buttons.
- `functions/video.js:903` — `generateAudioFingerprint` is a "Chromaprint stub" (just SHA-256 of videoId; no real fingerprinting).
- `src/services/feedService.js:806` — "ML PERSONALISED FEED (stub)".
- `src/services/storyService.js:111` — `LIBRARY_URL: '…royaltyfreemusic.com…' // stub`.
- `src/services/authService.js:1180` — "Backward-compatible MFA stubs".
- `src/screens/SearchScreen` / `searchService.js` — TTL cache invalidation "not implemented".

**Testing**
- Only `src/utils/__tests__/core.test.js` and `formatters.test.js` exist — **2 test files for ~350 source files**. No coverage thresholds; no component/integration tests. CI runs `eslint` + `build` + Firebase deploy but no meaningful test gate.

**Observability / resilience**
- `AuthContext.jsx` is ~900 lines and repeats `if (!authService) throw new Error('Auth service not ready')` defensively — fine, but indicates the init sequencing is fragile.
- Many screens swallow errors with toasts; ensure failed writes (posts/comments) surface retry via the offline queue (the plumbing exists in `AppBootstrap`, good).

---

## 8. Prioritized Remediation Roadmap

**Phase 1 — Stop the bleeding (Critical/High)**
1. Delete `public/index.html`. Verify `npm run build` emits the real app shell. (§2.1)
2. Fix the 7 `db`/`storage`/`auth` imports — switch to `await getFirestoreInstance()` / `getAuthInstance()` / `getStorageInstance()` like the services, or add real synchronous bindings. (§2.2)
3. Deploy `scrapeLink` (or guard the call) and convert `watermarkVideo`/`moderateVideo`/`generateAudioFingerprint`/`updateViralScore` to `onCall` (or call via HTTP). (§3)
4. Tighten Firestore rules: `usernames`, `calls`, community/event/collaboration subcollections, `post_analytics`, story comments. (§4)

**Phase 2 — Hardening (Medium)**
5. Add CSP + security headers (via `vite` meta or hosting config); strip all `console.*` in prod. (§4, §6)
6. Delete dead Firebase modules (`config/core/compat/instances/index.js`) and duplicate configs/garbage files. (§5, §6)
7. Initialize App Check in `firebase.js` if intended; move Firebase config fully to env vars. (§4)

**Phase 3 — Quality (Low/Medium)**
8. Remove dead `UserContext`, consolidate `ErrorBoundary`, implement or remove stub features, add a real test suite (at minimum: AuthContext, feed/video services, a smoke render of `AppRoutes`).
9. Add coverage thresholds to CI and a `jest` gate.

---

## 9. Appendix — Verification Notes
- "Active `firebase.js`" export list confirmed by grepping `export` declarations (lines 277–288).
- `db`/`storage`/`auth` usage confirmed by reading `Composer.jsx`, `CommentsContext.jsx`, `PostsContext.jsx`, `ReelsFeed.jsx`, `CommentsDrawer.jsx`, `SignupContext.jsx`.
- Client callable names extracted from all `httpsCallable(...)` sites; server callables extracted from `exports.X = onCall(...)` / `onRequest(...)` in `functions/`.
- Firestore rule findings read directly from `firestore.rules`.
- Dead-code claims verified: `config.js`/`core.js`/`compat.js`/`instances.js`/`index.js` are imported by no app file; `UserContext` imported by nothing; `public/index.html` content confirmed unrelated.

> The repository also ships several prior review docs (`MASTER_REVIEW_v4.md`, `DEEP_ANALYSIS_REPORT.md`, `CODEX_REVIEW_BRUTAL.md`, `ARVDOUL_REMAINING_ISSUES.md`, etc.). This audit is independent and confirms/extends them — notably it newly identifies the `public/index.html` build clobber (§2.1), the `db`/`auth`/`storage` import crash (§2.2), and the `onRequest` vs `httpsCallable` mismatch (§3.B).
