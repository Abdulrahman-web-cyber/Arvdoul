# ARVDOUL PROFILE SUBSYSTEM — AUDIT V3
## Repository-Verified Architecture, Security, Correctness & Remediation Blueprint

**Audit date:** 2026-09-29
**Audited revision:** `main` @ `78f0f8d` ("refactor: remove PII handling from user profile logic")
**Method:** static repository forensics (read-only). Every finding is cited to a file and line in the audited revision. No repository code was modified.

> **Scope note / deviation.** The directive asks this audit to verify the 47 findings of a supplied *"ARVDOUL Profile Subsystem — Master Technical Audit v2.0"*. **That document is not present in the repository or the workspace.** Part III states this explicitly and classifies the findings that can be reconstructed from the repository's own audit artifacts (`MASTER_REVIEW_v4.md`, `REPO_AUDIT_REPORT.md`, `ARVDOUL_REMAINING_ISSUES.md`, `DEEP_ANALYSIS_REPORT.md`, `LAUNCH_READINESS_AUDIT.md`) and from code. Part IV (newly discovered findings) is the substantive result of this audit.

---

# PART I — EXECUTIVE ASSESSMENT

## 1. Overall subsystem state

The Profile subsystem is a large, feature-complete React SPA layer (18 screens, 40 components, 5 stores, ~20 services, 20 Cloud Function modules, 1134-line Firestore rules, 108-line Storage rules, 238 index entries). It is functionally rich but architecturally inconsistent, and its most important guarantee — privacy — is enforced in the browser, not at the security boundary.

Three systemic problems dominate everything else:

1. **Privacy is a client convention, not an authorization boundary.** `firestore.rules:71` grants every signed-in user full read of every `users/{uid}` document (`allow read: if isSignedIn(); // app layer projects private profiles`). All field masking (email, phone, coins, earnings, links, presence, privacy scopes) happens in `userService.getUserProfile` in JavaScript. A modified client, a scraper with a valid session, or any REST/SDK caller reads the raw document. This is the single largest security finding.

2. **There is no single canonical profile read model.** The same `users/{uid}` document is projected independently into `AuthContext.userProfile`, `appStore.currentUser` (localStorage-persisted), and `profileStore.profile`; several domain services (passport, reputation, titles, achievements, ranking, wallet) each re-derive identity, defaults, and capabilities with their own fallbacks. The three copies can diverge, and the persisted copy can outlive the session that created it.

3. **Financial state is partially server-authoritative and partially client-authoritative.** The Cloud Functions implement atomic transactions, idempotency ledgers, rate limits and a double-entry ledger. But (a) the client `monetizationService` contains a fallback that writes `coins`/`experience` directly to Firestore from the browser, and (b) the server `addCoins` validates the number of transactions per day, not the coin volume, while the credit `amount` is client-supplied — a bounded but real minting exploit.

## 2. Major architectural findings

- **A-1 (P2).** Duplicate profile identity in three places (AuthContext / appStore / profileStore) with no reconciliation contract. `ProfileMyScreen.jsx:64` prefers the localStorage-hydrated `appStore.currentUser` over `AuthContext.user`.
- **A-2 (P2).** No request-invalidation mechanism. `invalidateAllRequests` (referenced by the previous hardening test) does not exist in the codebase; every async loader in `profileStore` writes its result unconditionally, so a slow response for a previous account/route can overwrite current state.
- **A-3 (P2).** The profile read model is computed in `userService.getUserProfile` (client) and then re-derived independently in `ProfilePublicScreen.jsx:318-347`, `ProfilePreviewScreen.jsx:80-100`, `ProfileMyScreen.jsx:174-179`, and `passportService.js:41-51` — each with its own defaults and its own (sometimes hardcoded) relationship object.
- **A-4 (P2).** Domain services fabricate identity/progression when data is absent (Part IV N005), contradicting the directive's "no placeholders / no synthetic analytics / represent unavailable as unavailable."
- **A-5 (P2).** `functions/` modules are only loaded via side-effect `require()` in `index.js`; there is no per-function auth contract test, and `monetization.js` re-declares its own `getUserIdFromContext` instead of importing the canonical `functions/auth.js` helper.

## 3. Major security findings

- **S-1 (P0).** `users/{uid}` is world-readable to any authenticated user (`firestore.rules:71`); privacy masking is client-side only.
- **S-2 (P0).** Cross-viewer cache leak: `getUserProfile` writes the full, unmasked document (including the owner's own view with coins/links/presence) to `localStorage["arvdoul_prof_<uid>"]` (`userService.js:591`) and the L2 read (`userService.js:373`) ignores the requester. On a shared browser, viewer B can be served owner A's unmasked projection.
- **S-3 (P0).** Client-side financial write fallback in `src/services/monetizationService.js:816-1110` writes `coins`/`experience` to `users/{uid}` directly, bypassing the Cloud Function. Live callers exist (`PostCard.jsx:81`, `Composer.jsx:147`, `CommentsModal.jsx:42`, `ReelsFeed.jsx:42`).
- **S-4 (P0).** `addCoins` per-reason "daily cap" counts transactions, not coins (`functions/monetization.js:223-247`); `amount` is client-supplied and only bounded by `MAX_COIN_OPERATION` (default 10 000) and a 10/minute rate limit → an authenticated user can mint large volumes through the legitimate allowlisted path.
- **S-5 (P0/P1).** PII regression: commit `78f0f8d` removed the owner-only `users/{uid}/private/pii` boundary; `email`/`phoneNumber` are once again stored on the world-readable profile document, and `touchesServerAuthoritativeFields()` no longer blocks client reintroduction of them.
- **S-6 (P1).** Broad write surfaces in rules: `collaboration_invites/{id}` (`allow create/update/delete: if isSignedIn()`), `collections/{id}/items/{itemId}` (`allow write: if isSignedIn()`), `shares/{id}` (`allow write: if isSignedIn()`), `profile_views`/`profile_analytics` (`allow create: if isSignedIn()`).
- **S-7 (P1).** Account-isolation gaps on the client: stale `appStore.currentUser` and the `user` localStorage key can carry account A's profile into account B's session (N001/N002); `profileStore.clear()` is never called on logout.

## 4. Major data-integrity findings

- **D-1 (P1).** `profileStore` fabricates `coins: ... || 100`, `level: ... || 1`, `reputation: 100`, and `canView*: true` on error/absent data (`profileStore.js:184-193, 240-249`). Privacy flags defaulting to allow on failure is a correctness-and-privacy hazard.
- **D-2 (P1).** `passportService`, `reputationService`, `titleService`, `achievementService`, `rankingService` synthesize scores, tiers, titles and timestamps when data is missing (N005).
- **D-3 (P1).** `profileStore.follow()` rollback is not snapshot-based (`profileStore.js:704-707`), and `updateFollowStatus()` mutates `followerCount` by ±1 with no idempotency (`profileStore.js:770-782`).
- **D-4 (P1).** No idempotency key on client follow/like/save/comment; double-tap races remain.

## 5. Major UX findings

- **U-1 (P5).** 92 hardcoded hex colours across 10 Profile screens/components (violates the design-token single-source-of-truth rule).
- **U-2 (P5).** Only 6 files repo-wide use `useTranslation`; Profile is effectively English-only with ad-hoc date/number formatting.
- **U-3 (P5).** Accessibility is partial: `aria-*` present in most components but absent from several interactive surfaces; dialogs vary between the canonical `ui/Dialog.jsx` and hand-rolled overlays.
- **U-4 (P1).** Fabricated values rendered as if real (coins, reputation, passport fields) violate the "honest unavailable state" requirement.

## 6. Major scalability/cost findings

- **C-1 (P2).** `AuthContext.setupRealtimeProfile` is not concurrency-idempotent; under account switching it can leak a listener and re-subscribe on `userService` resolution (N001).
- **C-2 (P2).** Duplicate reads: the profile document is fetched independently by AuthContext, profileStore, walletService, passportService and several screens.
- **C-3 (P2).** Client fallback paths perform extra Firestore reads (`tx.get`) precisely when the primary path failed, amplifying cost during incidents.
- **C-4 (P3).** `profile_views`/`profile_analytics` are client-creatable with no dedupe → counter/analytics inflation risk.

## 7. Major missing capabilities

- No server-side privacy projection (field-level masking) — the target architecture's central requirement.
- No relationship state machine with deterministic precedence exposed from one module.
- No cache keyed by `(viewer, target, relation)`; caches are keyed by target only.
- No App Check enforcement anywhere in `functions/` or Firebase config.
- No unified observability/correlation model for profile mutations.
- No i18n namespace architecture; no accessibility test suite.

---

# PART II — REPOSITORY REALITY

All paths relative to the repository root at revision `78f0f8d`.

## 1. Actual relevant files

| Area | Files |
|---|---|
| Profile screens | `src/screens/Profile/` — `ProfileMyScreen.jsx`, `ProfilePublicScreen.jsx`, `ProfilePreviewScreen.jsx`, `ProfileScreen.jsx`, `EditProfileScreen.jsx`, `AboutScreen.jsx`, `AnalyticsScreen.jsx`, `CreatorDashboardScreen.jsx`, `HighlightsScreen.jsx`, `FollowersScreen.jsx`, `FollowingScreen.jsx`, `FriendsScreen.jsx`, `UserListScreen.jsx`, `ProfileSettingsScreen.jsx`, `index.js` |
| Profile components | `src/components/profile/` — 40 files incl. `ProfileHeader.jsx`, `ProfileHeroSection.jsx`, `ProfileTabContent.jsx`, `ProfileTabs.jsx`, `ProfileActionBar.jsx`, `ProfileActions.jsx`, `ProfileStats.jsx`, `ProfileProgression.jsx`, `CreatorDashboard.jsx`, `CreatorCharts.jsx`, `ProfileHighlights.jsx`, `ProfileMediaGrid.jsx`, `FollowButton.jsx`, `AvatarUploadModal.jsx`, `ProfileQRCodeModal.jsx` |
| Stores | `src/store/` — `profileStore.js` (824), `appStore.js` (207), `analyticsStore.js` (222), `messagingStore.js`, `searchStore.js`, `videoStore.js` |
| Context | `src/context/` — `AuthContext.jsx` (1160), `ThemeContext.jsx`, `ThemeProvider.jsx` |
| Hooks | `src/hooks/` — `useProfile.js`, `useProfileTabs.js`, `useAuth.js`, `useCreatorDashboard.js`, `useAnalytics.js`, `useOfflineSync.js` |
| Services | `userService.js` (1852), `profileCapabilityEngine.js` (245), `walletService.js`, `passportService.js`, `reputationService.js`, `titleService.js`, `achievementService.js`, `rankingService.js`, `creatorService.js`, `levelSystemService.js`, `monetizationService.js`, `analyticsService.js`, `userIntegrityService.js` |
| Config | `src/config/profileContracts.js`, `screenRegistry.js`, `badgeCatalog.js` |
| Backend | `functions/` (20 modules), `firestore.rules` (1134), `storage.rules` (108), `firestore.indexes.json` (238 entries), `firebase.json` |
| Offline | `src/offline/syncEngine.js` |

## 2. Actual screens

18 Profile screens (listed above). Routes declared in `src/routes/AppRoutes.jsx` (see §10). `/profile/settings` → `/settings`; `/profile/progress|achievements|titles|passport|wallet` → top-level redirects (`AppRoutes.jsx:615-1023`).

## 3. Actual components

40 components in `src/components/profile/`, plus shared UI (`src/components/ui/Dialog.jsx`) and cross-cutting (`src/components/Shared/QuickAccessPanel.jsx`). Barrel: `src/components/profile/index.js`.

## 4. Actual stores

`profileStore` (Zustand + immer, no persistence), `appStore` (Zustand + persist → `localStorage["arvdoul-app-store"]`), `analyticsStore` (no persistence), plus messaging/search/video stores.

## 5. Actual services

`userService` owns profile CRUD, privacy projection, follow/unfollow, blocks/mutes/restricts, friend requests, username registry. `profileCapabilityEngine` owns relationship/capability resolution. Domain services (passport, reputation, title, achievement, ranking, wallet, creator, levelSystem) read the profile doc or related collections and re-derive values.

## 6. Actual Firebase integration

Firestore, Auth, Storage, Functions, Messaging/Push. Client SDK initialised in `src/firebase/`. No App Check found in code or `firebase.json`.

## 7. Actual Cloud Functions

`functions/index.js` requires: `user.js`, `feed.js`, `comments.js`, `stories.js`, `video.js`, `notifications.js`, `messaging.js`, `search.js`, `monetization.js`, `polls.js`, `userExport.js`, `ai.js`, `saml.js`, `levelSystem.js`, `moderation.js`, `admin.js`, `auth.js`, `pushQueue.js`. Profile-relevant callables: `deleteUserData` (`user.js`), `exportUserData` (`userExport.js`), `listUsers`/`grantAdmin`/`revokeAdmin`/`listAdmins` (`admin.js`), `awardExperience`/`recordActiveDay`/`evaluateAchievements`/`claimTitle`/`setActiveTitle`/`applyForCreator` (`levelSystem.js`), and the monetization family.

## 8. Actual rules

`firestore.rules`: deny-by-default; `users/{userId}` read by any signed-in user; owner update blocked from `touchesServerAuthoritativeFields()`; extensive subcollection and feature rules (messaging, vibes/stories, live, communities, collaboration, moderation, analytics, counters). `storage.rules`: owner-write/public-read media with size+content-type constraints; messages participant-scoped; default deny.

## 9. Actual indexes

`firestore.indexes.json` — 238 index entries. Includes composite indexes for `coin_transactions` (`userId`+`reason`+`createdAt`) required by the `addCoins` cap query.

## 10. Actual routes

`/profile`, `/profile/me`, `/profile/public/:userId`, `/profile/:userId`, `/profile/edit`, `/profile/analytics`, `/profile/highlights`, `/profile/followers`, `/profile/:userId/followers`, `/profile/following`, `/profile/:userId/following`, `/profile/friends`, `/profile/:userId/friends`, `/profile/about`, `/profile/:userId/about`, `/profile/preview`, plus redirects. Deep identity routes (`/passport/:userId`, `/reputation/:userId`, …) live outside the Profile route group.

---

# PART III — AUDIT V2 VERIFICATION

**The "Master Technical Audit v2.0" (47 findings) is not present in the repository or workspace.** Per §2 and §44 of the directive ("do not assume an audit finding is true; verify it"), no finding can be confirmed against a source that does not exist. The table below classifies the findings that are reconstructable from the repository's own audit artifacts and from code.

| ID (source) | Claim | Status | Evidence at 78f0f8d | Correction |
|---|---|---|---|---|
| V2-01 (MASTER_REVIEW_v4 §85) | Missing cursor pagination in `monetizationService.getTransactionHistory` / leaderboard | CONFIRMED | `src/services/monetizationService.js` history/leaderboard use fixed `limit`, no `startAfter` | Add cursor + `nextCursor` |
| V2-02 (MASTER_REVIEW_v4 §86) | Likes/follows/comments lack client idempotency keys | CONFIRMED | `PostCard.jsx:81,109`, `profileStore.follow` | Add operation IDs |
| V2-03 (MASTER_REVIEW_v4 §151) | Undefined-symbol crashes in several screens | PARTIALLY CONFIRMED | Some imports fixed since; build passes | Re-verify per file; gate with `no-undef` |
| V2-04 (ARVDOUL_REMAINING_ISSUES §2.6) | Search trending = mock (`picsum.photos`) | UNKNOWN at current rev | Out of Profile scope | Out of scope here |
| V2-05 (DEEP_ANALYSIS_REPORT §6) | Hardcoded `ARVDOUL_GRADIENT` in `VideoAnalyticsScreen` | UNKNOWN at current rev | Out of Profile scope | Out of scope here |
| V2-06 (directive §9) | "Firestore Rules are the only real boundary" | FALSE as stated / INVERTED | `firestore.rules:71` shows the boundary does not enforce field privacy at all | MORE SEVERE THAN REPORTED — see N003 |
| V2-07 (directive §15) | Need a `normalizeProfile()` | CONFIRMED | Three divergent projections (AuthContext/appStore/profileStore) | Canonical read model (Part VI) |
| V2-08 (directive §20) | Fabricated analytics / fallback zeros | CONFIRMED — MORE SEVERE | `profileStore.js:184-193,240-249`; passport/reputation/title/achievement/ranking defaults | See N005 |
| V2-09 (directive §8/§17) | Privacy/capability can disagree | CONFIRMED | `canViewProfileSection` fail-open (`profileContracts.js:425,436-437`) | See N006/N007 |
| V2-10 (directive §13) | Multiple profile listeners possible | CONFIRMED | `AuthContext.jsx:389-393,536` | See N001 |
| V2-11 (directive §14) | Store architecture problems | CONFIRMED | Duplicate identity, dead state, no invalidation | See A-1/A-2 |
| V2-12 (directive §12) | Concurrency races | CONFIRMED | follow/unfollow ±1 (`profileStore.js:770-782`) | See D-3 |
| V2-13 (directive §34) | 19 "dead" components | UNKNOWN | Requires reachability proof (barrel + dynamic imports) | Part XVIII "Must Not Delete Yet" |

> **Verification limitation.** Because the source 47-item document was not supplied, this Part cannot enumerate all 47 IDs. Treat Part IV (new findings, all repository-cited) as the authoritative result of this audit, and re-run Part III against the actual V2 document if it is provided.

---

# PART IV — NEWLY DISCOVERED FINDINGS

## N001 — Profile realtime listener is not concurrency-safe (cross-account leak / listener leak)
**Severity:** P0 (security + resilience)
**File:** `src/context/AuthContext.jsx` — `setupRealtimeProfile`
**Evidence:**
```
389  const setupRealtimeProfile = useCallback(async (uid, firebaseUser) => {
390    if (!userService || !uid || !firebaseUser) return;
391    // Clean up previous listener
392    if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
393    try {
394      await userService.initialize();                        // await gap
...
398      const { doc, onSnapshot } = await import('firebase/firestore'); // await gap
...
536      unsubscribeProfileRef.current = unsubscribe;           // assigned AFTER the awaits
```
The ref is cleared before two `await`s and assigned after them, with no in-flight guard or uid token. Concurrent `setupRealtimeProfile(A)` / `setupRealtimeProfile(B)` (account switch, or re-subscribe when `userService` resolves — deps `[userService, authService]` at `:547`, auth effect deps at `:699`) means A's listener is never unsubscribed, B's unsubscribe handle is overwritten by A's, and A's snapshot callback (closure captures A) can call `setUserProfile(A)`/`syncUserWithAppStore(A)` over B's session. The callback guards only on `isMounted.current` (`:422`), never `uid === currentUid`.
**Root cause:** non-atomic listener lifecycle; no generation/uid guard.
**Impact:** account A's profile can appear in account B's session; a permanent Firestore listener leak (cost + data exposure).
**Reproduction:** sign in as A, then sign out and in as B within the listener-init window; observe `userProfile`/`appStore.currentUser` briefly or permanently showing A.
**Recommended fix:** capture a generation token/uid, check it inside the snapshot callback and before assigning the ref; clean up in effect teardown keyed on uid; do not re-subscribe on `userService` resolution.

## N002 — Persisted/stale identity bleeds account A into account B
**Severity:** P0 (privacy)
**Files:** `src/store/appStore.js:188-202`, `src/screens/Profile/ProfileMyScreen.jsx:63-65`, `src/context/AuthContext.jsx:577-583`, `src/components/profile/ProfileLocationModal.jsx:198`
**Evidence:** `appStore` persists `currentUser` to `localStorage["arvdoul-app-store"]`. `ProfileMyScreen.jsx:64` is `const currentUser = authStoreUser || authContextUser;` — the persisted store wins over live auth. `loadProfile(currentUserId, currentUserId)` (`:191`) then loads A's document while B is signed in. `ProfileLocationModal.jsx:198` writes a raw `user` object to localStorage that the login branch does not clear (only explicit sign-out clears it, `AuthContext.jsx:617,1042`).
**Impact:** A's profile/counters/coins render in B's session until B's snapshot lands; on a shared device this is cross-account exposure.
**Recommended fix:** clear `appStore.currentUser`, `profileStore`, `analyticsStore`, and the `user` key on every auth transition; prefer `AuthContext.user` over persisted store as the identity source; scope persisted state by uid.

## N003 — `users/{uid}` is world-readable; privacy is client-side only
**Severity:** P0 (privacy)
**File:** `firestore.rules:70-71` — `allow read: if isSignedIn(); // app layer projects private profiles`
**Impact:** Any authenticated user (or script with a valid ID token) can read every field on every profile document: email, phoneNumber, coins, earnings, reputation, privacy scopes, presence. Client masking in `userService.getUserProfile` is bypassable. This is the largest exposure in the subsystem and contradicts directive §9.
**Recommended fix:** split the document (public `users/{uid}` / owner-only `users_private/{uid}` / server-only `users_security/{uid}`) and enforce read authorization in rules (Part VI).

## N004 — Cross-viewer profile cache leak via localStorage
**Severity:** P0 (privacy)
**File:** `src/services/userService.js:373, 591`
**Evidence:** L2 cache `localStorage.getItem("arvdoul_prof_" + userId)` / `setItem("arvdoul_prof_" + userId, JSON.stringify(full))`. The key is the target only; the read path ignores `requesterId`. The owner's own view (`viewerRelation: OWNER`) does not mask coins/links/presence, and that unmasked blob is cached and later served to a different viewer.
**Impact:** on a shared browser, viewer B receives owner A's unmasked profile projection.
**Recommended fix:** key the cache by `(requesterId, targetId, relation)`, or remove client persistence of profile projections entirely and cache only server-produced, viewer-scoped projections in memory.

## N005 — Domain services fabricate identity, progression and analytics
**Severity:** P1 (correctness — violates directive §20/§44)
**Evidence:**
- `src/store/profileStore.js:184` `coins: isOwner ? (balance || Number(appCurrentUser?.coins) || 100) : 0`
- `:185` `level: level || Number(appCurrentUser?.level) || 1`; `:186` `reputation: 100`
- `:189-190,245-246` `canViewActivity: true, canViewAchievements: true` (privacy flags default to allow on error)
- `src/services/passportService.js:53-65` `level||1`, `activeDaysCount||1`, `activeStreak||1`, rep `||50`, inf `||20`, con `||25`
- `src/services/passportService.js:93-103` `citizenId = "ARV-"+uid.slice(0,8)`, `issueDate:'Genesis Era'`, `displayName:'Citizen of Arvdoul'`
- `src/services/reputationService.js:42-44,100-113` default `50/20/25`, fabricated band + `trustFactors:[{label:'Good Standing'}]`
- `src/services/titleService.js:107` `grantedAt: ... || new Date()`; injects a synthetic `resident` title for every user
- `src/services/achievementService.js:57` `earnedAt: ... || new Date()`
- `src/services/rankingService.js:446-455` missing doc → `{trust:50, reliability:50, totalScore:50, tier:'bronze'}`
- `src/services/creatorService.js:38` `level||1`; `src/services/walletService.js:22-24,44` `coins||0`, `totalEarned||0`
**Impact:** users and admins see plausible-but-false standing, reputation, passports and analytics; contradicts "represent unavailable as unavailable."
**Recommended fix:** return `null`/`{available:false}` for absent dimensions; render explicit unavailable states; delete default constants.

## N006 — `canViewProfileSection` fails open (unknown section/scope → allowed)
**Severity:** P1 (privacy)
**File:** `src/config/profileContracts.js:422-439`
**Evidence:** `:425` `const scope = profilePrivacy[section] || DEFAULT_PROFILE_PRIVACY[section] || VISIBILITY_SCOPES.EVERYONE;` and `:436-437` `default: return true;`. An unknown section name defaults to `EVERYONE`; an unrecognized stored scope returns `true`.
**Impact:** a typo, migration artifact, or attacker-influenced privacy map is treated as public; the existing hardening test only covers known scopes/sections, so the fail-open path is untested.
**Recommended fix:** fail closed — unknown section → deny, unknown scope → deny; add tests for the unknown paths.

## N007 — Capability engine and profile projection disagree (two privacy layers)
**Severity:** P1 (privacy/correctness)
**Files:** `src/services/profileCapabilityEngine.js`, `src/services/userService.js`
**Evidence:** `resolveCapabilities` grants `canViewLinks/Presence/EconomicStatus` without requiring `canViewContent` (`profileCapabilityEngine.js:166-175`), while `getUserProfile` independently decides masking from a locally-computed relation (`userService.js:480-559`) that never factors `isRestricted`/`isMuted`. The engine can say "visible" while the projection hides (or vice-versa). `resolveRelationshipState` ignores the aggregate `isBlocked` (`:44-45`) while `resolveCapabilities` reads it (`:106`).
**Recommended fix:** one deterministic pipeline — relationship → privacy → capability → projection — with a single source and a truth-table test.

## N008 — Client-side coin writes bypass the server authority boundary
**Severity:** P0 (financial integrity)
**File:** `src/services/monetizationService.js:816-1110`
**Evidence:** `addCoins` calls the callable, but on failure runs a client `runTransaction` that does `tx.update(userRef, { coins: newCoins, experience: newExp })` (`:835`) and creates a `coin_transactions` doc. `spendCoins` (`:875`), `transferCoins` (`:915-917`), `sendGift` (`:984-995`), `boostPost` (`:1069`), tip (`:1105`) share the same fallback shape. Live callers: `PostCard.jsx:81,109`, `Composer.jsx:147`, `CommentsModal.jsx:42`, `ReelsFeed.jsx:42`, `VideoGiftModal.jsx:72`.
**Impact:** if the fallback is reachable (callable temporarily undeployed/unavailable, or errors normalised as failures), the browser writes balances directly; combined with N003/N005 this is client-controlled financial state. Even where rules currently reject the write, the code expresses the wrong authority model and will silently succeed wherever rules permit.
**Recommended fix:** delete the client write fallback; surface the error; make all balance mutations server-only.

## N009 — `addCoins` daily cap counts transactions, not coin volume
**Severity:** P0 (financial integrity)
**File:** `functions/monetization.js:223-247`
**Evidence:** the cap query counts today's `coin_transactions` for the reason and compares `count >= dailyCap`; the credit is `amount` (client-supplied, `:219`), bounded only by `MAX_COIN_OPERATION` (default 10 000, `:26`) and `checkRateLimit(uid,'addCoins',10,60000)` (`:230`).
**Impact:** a caller can credit up to 10 000 coins per call, 10 calls/minute. Reason `like` (cap 100 transactions/day) yields up to 1 000 000 coins/day; `reel_watch`/`feed_view` (200) yield up to 2 000 000 coins/day. Coin volume is not capped.
**Recommended fix:** cap by summed coin volume per reason per day, or drop client `amount` and use server-defined per-reason constants.

## N010 — Broad write surfaces in rules
**Severity:** P1 (integrity/abuse)
**File:** `firestore.rules`
**Evidence:** `collaboration_invites` `allow create/update/delete: if isSignedIn()` (`:630-634`); `collections/{collectionId}/items/{itemId}` `allow read, write, delete: if isSignedIn()` (`:640-641`); `shares/{shareId}` `allow write: if isSignedIn()`; `profile_views`/`profile_analytics` `allow create: if isSignedIn()` (`:646-665`).
**Impact:** any signed-in user can modify arbitrary collaboration invites, collection items and shares, and can create view/analytics records without dedupe (counter inflation).
**Recommended fix:** scope writes to the owning user/participant; add dedupe/idempotency for analytics.

## N011 — PII boundary regression (PR#27 revert)
**Severity:** P0 (privacy)
**Commit:** `78f0f8d` "refactor: remove PII handling from user profile logic"
**Evidence:** the commit removed `match /private/{docId}` from `firestore.rules`, removed `'email','phoneNumber'` from `touchesServerAuthoritativeFields()`, removed the private-PII overlay from `functions/admin.js:listUsers` and `functions/userExport.js`, and removed the purge from `functions/user.js:deleteUserData`. `email`/`phoneNumber` are therefore stored on the world-readable `users/{uid}` document again.
**Impact:** contact PII is world-readable to any authenticated user; `deleteUserData` no longer purges the private PII doc (moot while it does not exist, but relevant if reintroduced).
**Recommended fix:** restore the split (Part VI) or an equivalent server-enforced boundary; add a regression test.

## N012 — Follow/unfollow counters are not concurrency-safe
**Severity:** P1 (integrity)
**File:** `src/store/profileStore.js:673-713, 770-782`
**Evidence:** `follow()` on failure hard-codes `isFollowing=false` and `followerCount = Math.max(0,(followerCount||1)-1)` (`:704-707`) rather than restoring a snapshot; `updateFollowStatus()` mutates `followerCount` by ±1 unconditionally (`:777-779`), so repeated calls with the same state double-count. Counters are stored client-side rather than read from `counter_shards`.
**Recommended fix:** snapshot-based rollback; derive counts from server shards; make follow idempotent server-side.

## N013 — No request invalidation; stale async writes win
**Severity:** P1 (correctness)
**Files:** `src/store/profileStore.js` (all loaders), `src/hooks/useProfile.js`
**Evidence:** no `invalidateAllRequests`/generation token exists anywhere in `src/`. Loaders (`loadProfile :92`, `loadPosts :345`, `loadLevel :540`, `loadBalance :568`, `loadPosition :596`, `loadFollowStatus :625`, `loadMutualFriends :645`) write unconditionally; effects depend on `[userId, currentUserId]` with no cleanup.
**Impact:** a slow response for account A or a previous route can overwrite current state (ties into N001/N002).
**Recommended fix:** per-store generation token bumped on identity change; discard results whose token is stale; `AbortController` for reads.

## N014 — Offline queue is not account-scoped
**Severity:** P1 (privacy/correctness)
**Files:** `src/offline/syncEngine.js` (module singleton, IndexedDB queue), `src/hooks/useOfflineSync.js`
**Evidence:** handlers carry `userId`/`followerId` in payloads (`syncEngine.js:78-106`); there is no per-uid partition and `AuthContext` never calls into `syncEngine` on logout.
**Impact:** pending operations enqueued by A can be drained and executed (with A's captured ids) after B logs in.
**Recommended fix:** partition/purge the queue on account change; re-authenticate before draining.

## N015 — `users/{uid}` mixes public, owner-only, financial and server-only data
**Severity:** P1 (architecture/privacy)
**Evidence:** the same document holds `username/displayName/photoURL/bio` (public), `privacy` (owner), `coins/earnings/totalEarned` (financial), `level/xp/reputation/influence/contribution` (server-authoritative), `email/phoneNumber` (PII). Rules cannot field-mask a readable document.
**Recommended fix:** read-model separation (Part VI).

## N016 — No App Check enforcement
**Severity:** P1 (abuse)
**Evidence:** no `enforceAppCheck` in `functions/*.js`; no App Check initialisation in `src/firebase/*.js` or `firebase.json`.
**Impact:** callables and Firestore are reachable from non-app clients holding a valid token.
**Recommended fix:** enable App Check (reCAPTCHA Enterprise / App Attest) and set `enforceAppCheck: true` on sensitive callables.

## N017 — `profileCapabilityEngine` relationship precedence is lossy
**Severity:** P2 (correctness)
**File:** `src/services/profileCapabilityEngine.js:43-56`
**Evidence:** `MUTED` is evaluated last, so muted+following reports `FOLLOWING`; `RESTRICTED` outranks follow states, dropping the edge; a stale `requestStatus` outranks `MUTUAL`; the aggregate `isBlocked` is ignored.
**Recommended fix:** define precedence explicitly and document it (Part VIII), including combination semantics.

## N018 — Component-level privacy re-derivation (fail-open)
**Severity:** P1 (privacy)
**Files:** `src/screens/Profile/ProfilePublicScreen.jsx:318-347`, `ProfilePreviewScreen.jsx:80-100`, `ProfileMyScreen.jsx:174-179`, `src/services/passportService.js:41-51,81-91`
**Evidence:** `ProfilePublicScreen` recomputes `canViewActivity: profileData.canViewActivity !== false` (fail-open) and renders `coins: Number(profileData.coins ?? profileData.coinBalance ?? 0)` regardless of `economicStatus`; passport hardcodes an empty relationship and skips the titles capability check.
**Impact:** privacy decisions diverge from the engine and can leak sections/economic data.
**Recommended fix:** components consume the capability object only; never recompute.

## N019 — Analytics/view counters are client-writable and un-deduped
**Severity:** P1 (analytics integrity)
**File:** `firestore.rules:646-665`, `src/services/analyticsService.js`
**Evidence:** `profile_analytics` `allow create: if isSignedIn()` with client-writable `dailyStats`/`lastUpdated`; `profile_views` `allow create: if isSignedIn()`.
**Impact:** fabricated view counts and analytics; contradicts directive §20.
**Recommended fix:** server-side recording with per-viewer dedupe keys and sharded counters.

## N020 — Silent failure swallowing is widespread
**Severity:** P3 (observability)
**Evidence:** 99 occurrences of `.catch(() => {})` in `src/`; multiple `catch { }` blocks in Profile/services.
**Impact:** meaningful failures are hidden, making unknown outcomes indistinguishable from success.
**Recommended fix:** log with correlation IDs; only swallow where explicitly safe; surface recoverable errors.

---

# PART V — SECURITY THREAT MODEL

## Authentication
Firebase Auth is authoritative. `functions/auth.js:getUserIdFromContext` is the canonical identity reader, but `functions/monetization.js:38` re-declares its own copy — a divergence risk. No custom claim is trusted alone (`checkIsAdmin` accepts doc or claim, `auth.js:52-57`), which is sound.

## Authorization
- Firestore: deny-by-default catch-all; per-collection owner/participant/admin checks. Weaknesses: `users/{uid}` world-readable (N003); broad write surfaces (N010); client-writable analytics (N019).
- Storage: owner-write/public-read media with size + content-type checks; messages participant-scoped; default deny. Reasonably strong.
- Functions: admin paths go through `assertAdmin`; monetary paths through `getUserIdFromContext` + transactions + rate limits.

## Privacy
Client-enforced only (N003, N004, N006, N018). No server-side field masking. The subsystem's principal weakness.

## Firestore Rules
Cannot field-mask a readable document — the root reason N003/N015 exist. Rules enforce document access, not field access.

## Storage Rules
No finding of note.

## Cloud Functions
Strong transactional/idempotent patterns; weaknesses are the `addCoins` volume gap (N009) and the duplicated auth helper.

## App Check
Absent (N016).

## Account isolation
Client-side gaps (N001, N002, N013, N014) plus no store reset on logout.

## Cache leakage
Target-keyed L2 profile cache (N004); persisted `appStore` identity (N002).

## Financial security / payouts
Server transactions and double-entry ledger are good. Client write fallback (N008) and the `addCoins` volume gap (N009) are the integrity risks. `requestWithdrawal` validates level, available balance (incl. `lockedCoins`), daily limits and a manual-review threshold — sound. `transferCoins` validates self-transfer, balance, daily limit and mutual-transfer abuse — sound.

## Abuse / rate limits
Server `checkRateLimit` present on monetary and admin callables. Client `RateLimiter` is not a boundary (correctly noted in code). Missing: server limits for follow/friend/report/block (client-only today).

---

# PART VI — CANONICAL DATA MODEL

```
User            { uid, authEmailVerified, accountStatus, roles }        // identity + authority
Profile         { uid, username, displayName, photoURL, bio, website, location,
                  createdAt, updatedAt }                                  // PUBLIC read model
PublicProfile   = Profile + { followerCount, followingCount, postCount, isCreator,
                  creatorTier, isVerified, levelBand, reputationBand }    // public derived
OwnerProfile    = PublicProfile + { privacy, links, presence, economicStatus } // owner-only
PrivateProfile  { uid, email, phoneNumber, payoutSettings }               // owner/server-only PII
SecurityProfile { uid, coins, lockedCoins, earnings, totalEarned,
                  xp, level, reputationScore, influenceScore, contributionScore,
                  monetizationEligible }                                  // server-only
Relationship    { state: NONE|FOLLOWING|FOLLOWER|MUTUAL|REQUEST_SENT|REQUEST_RECEIVED|
                  RESTRICTED|MUTED|BLOCKED|BLOCKED_BY, precedence: int }
Capabilities    { canViewProfile, canViewIdentity, canViewContent, canViewStories,
                  canViewLinks, canViewPresence, canViewEconomicStatus, canFollow,
                  canUnfollow, canMessage, canTip, canSendFriendRequest, ... }
LevelInfo       { level, xp, experienceToNextLevel, band }               // from levelConfig.cjs
MonetizationSummary { available, coins?, earnings?, tier? }              // never fabricated
Analytics       { available, range, points[] }                          // never fabricated
```

**Firestore schema recommendation:** split `users/{uid}` into `users/{uid}` (public), `users_private/{uid}` (owner PII/settings), `users_security/{uid}` (server-only financial/authority). Rules then enforce reads per collection instead of relying on client masking. Do not introduce cover-photo concepts (directive §0).

---

# PART VII — SOURCE-OF-TRUTH MATRIX

| Field | Auth | AuthContext | appStore | profileStore | Firestore | localStorage | Cloud Function | UI-derived | Authoritative | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| uid | ✔ | ✔ | ✔ | ✔ | key | `arvdoul_uid`/`user` | context.auth.uid | — | Auth | identity |
| email/phone | ✔ | — | — | — | ✔ (N011) | `user` (leak) | ✔ | — | Auth / private doc | PII |
| username | — | ✔ | ✔ | ✔ | ✔ | `arvdoul-app-store` | registry | — | Firestore | public |
| displayName/photoURL/bio/location | — | ✔ | ✔ | ✔ | ✔ | `user`,`arvdoul-app-store` | — | ✔ | Firestore | public |
| privacy scopes | — | — | — | — | ✔ | — | — | ✔ (fail-open) | Firestore | owner |
| coins/earnings | — | ✔ | ✔ | ✔ (fabricated) | ✔ | `arvdoul-app-store` | ✔ | ✔ | Cloud Function | financial |
| xp/level/reputation/influence/contribution | — | ✔ | ✔ | ✔ (fabricated) | ✔ | — | ✔ | ✔ | Cloud Function | server-only |
| followerCount/followingCount/postCount | — | ✔ | ✔ | ✔ | ✔ | — | counter_shards | ✔ | counter_shards | derived |
| isCreator/creatorTier/isVerified/accountStatus | — | ✔ | — | ✔ | ✔ | — | ✔ | ✔ | Cloud Function | server-only |
| relationship state | — | — | — | ✔ | edges | — | — | ✔ (re-derived) | profileCapabilityEngine | relationship |
| capabilities | — | — | — | ✔ | — | — | — | ✔ (re-derived) | profileCapabilityEngine | derived |
| presence/isOnline/lastActive | — | ✔ | ✔ | — | ✔ | — | — | ✔ | Firestore (server-written) | relationship-dependent |

Multiple authoritative writers exist for: coins/earnings (Cloud Function and client fallback — N008), relationship/capabilities (engine and screens/passport — N018), follower counts (client ±1 and server shards — N012). Each needs consolidation.

---

# PART VIII — RELATIONSHIP & CAPABILITY MODEL

## State machine (proposed deterministic precedence, highest wins)

```
BLOCKED        (I block target)            -> all interactions denied
BLOCKED_BY     (target blocks me)          -> all interactions denied
RESTRICTED     (I restrict target)         -> content limited; follow edge irrelevant
MUTED          (I mute target)             -> I don't see their content; follow preserved
REQUEST_RECEIVED / REQUEST_SENT            -> pending friend request
MUTUAL         (both follow)               -> CONNECTION relation
FOLLOWING      (I follow target)
FOLLOWER       (target follows me)
NONE
```
`MUTED` must be evaluated before follow states (currently last — N017), and the aggregate `isBlocked` must be honoured by `resolveRelationshipState`.

## Capability truth table (abridged; Y=allowed, N=denied, ~=depends on target's scope)

| Viewer -> | owner | public | follower | mutual | restricted | blocked | blocked-by |
|---|---|---|---|---|---|---|---|
| canViewProfile | Y | ~ | ~ | Y | ~ | N | N |
| canViewIdentity | Y | Y | Y | Y | Y | stub | stub |
| canViewContent | Y | ~ | Y | Y | N | N | N |
| canViewStories | Y | ~ | Y | Y | N | N | N |
| canViewLinks | Y | ~ | Y | Y | N | N | N |
| canViewPresence | Y | ~ | Y | Y | N | N | N |
| canViewEconomicStatus | Y | ~ | ~ | ~ | N | N | N |
| canFollow | N | Y | N | N | Y | N | N |
| canMessage | N | ~ | ~ | Y | N | N | N |
| canTip | N | Y | Y | Y | N | N | N |
| canSendFriendRequest | N | Y | Y | N | Y | N | N |
| canBlock | N | Y | Y | Y | Y | N | Y |
| canReport/canShare | N | Y | Y | Y | Y | ~ | ~ |
| canSeeFollowers/Following | Y | ~ | ~ | Y | N | N | N |

The UI must consume this table only; it must not reconstruct decisions (N018).

---

# PART IX — CONCURRENCY & IDEMPOTENCY MODEL

| Race | Current behavior | Desired | Serialization |
|---|---|---|---|
| account A logout -> B login (listener) | A's listener can survive; B's handle lost (N001) | one listener, uid-guarded | generation token + uid check |
| profile edit x 2 devices | last write wins, no version check | optimistic concurrency | `updatedAt`/version guard |
| follow -> unfollow | client ±1, non-idempotent (N012) | server idempotent edge | transaction on edge doc + shards |
| tip x double tap | client fallback can double-write (N008) | single execution | server idempotency ledger (exists) + remove fallback |
| addCoins retry | ledger prevents replay; volume uncapped (N009) | volume-capped, replay-safe | ledger + volume cap |
| withdrawal request x 2 | daily limits + lock transaction | single lock | transaction (present) |
| post create x timeout | client-generated id? | idempotent create | operation id |
| username rename x 2 devices | registry update | atomic claim | transaction on `usernames/{name}` |

**Operation identity:** prefer a client-generated ULID/UUID per user intent (`operationId`), stored in the server idempotency ledger. Do not use `Date.now()` as the sole idempotency strategy (directive §11).

---

# PART X — CACHE & OFFLINE ARCHITECTURE

**Caches:** `userService` L1/L2 profile cache (target-keyed — privacy bug, N004); `firestoreService` LRU; `profileStore`/`analyticsStore` in-memory; `appStore` localStorage; IndexedDB audit queue; IndexedDB offline queue.

**Required properties per cache:** namespace, key, scope (`(viewer,target,relation)`), TTL, max size, invalidation, cross-tab, account isolation, privacy isolation. Current caches violate account/privacy isolation (N002, N004).

**Offline classification:** READ (safe, cached, viewer-scoped); LOCAL-ONLY WRITE (drafts — safe); SAFE QUEUED WRITE (follow, like, save — idempotent + queued per-account); SERVER-AUTHORITATIVE WRITE (coins, tips, gifts, withdrawal — never queued; require online, server idempotency); FORBIDDEN OFFLINE (payout, account deletion). The queue must be partitioned by uid and purged on account change (N014).

---

# PART XI — FIRESTORE / FIREBASE ARCHITECTURE

- Reads: the profile document is read by AuthContext (raw), profileStore, walletService, passportService and screens — consolidate to one viewer-scoped read model.
- Writes: server-only for coins/xp/level/verification; owner-only for public profile fields (rules block server-authoritative fields — good).
- Listeners: profile listener lifecycle unsafe (N001).
- Indexes: 238 entries; `coin_transactions(userId,reason,createdAt)` needed by the addCoins cap query — verify present before relying on the cap (a missing index makes the cap throw, which fails closed).
- Cost risks: duplicate profile reads; client fallback reads; un-deduped analytics writes.
- Counter strategy: `counter_shards` with single-field increment updates (rules restrict to `value` only — good).

---

# PART XII — UI/UX AUDIT

- 92 hardcoded hexes across 10 Profile files violate the design-token rule (`src/design-system/tokens.js` is the single source).
- Fabricated values rendered as real (N005) — the UI must show honest unavailable states.
- Composition improved by PR#27 (new `ProfileHeader`, `ProfileTabContent`, `ProfileStats`, `CreatorDashboard`, `CreatorCharts`), but privacy/capability decisions are still re-derived in screens (N018).
- Verify: small/large phone, tablet, desktop, light/dark, long names/bios, missing avatars, huge counts, zero content, many highlights/posts, slow/offline.

---

# PART XIII — ACCESSIBILITY & i18n

- `aria-*` present in most `components/profile/*` but inconsistent; dialogs vary between canonical `ui/Dialog.jsx` and hand-rolled overlays — standardise.
- i18n is effectively absent (6 `useTranslation` usages repo-wide; none in Profile). Dates/numbers/currency are formatted ad hoc. Recommend a namespace architecture (`profile.*`) with pluralisation, interpolation, number/date/timezone formatting, RTL readiness, and translated `aria-label`s.

---

# PART XIV — TESTING BLUEPRINT

- Unit: capability/relationship truth tables; privacy fail-closed paths (N006); canonical read-model projection.
- Integration: profile load per viewer relation; cross-viewer cache isolation (N004); account-switch isolation (N001/N002).
- Rules tests: `users/{uid}` read authorization after the split; broad write surfaces (N010); analytics dedupe (N019).
- Functions tests: `addCoins` volume cap (N009); idempotency ledger replay; withdrawal locking; removal of the client fallback (N008).
- Concurrency: follow/unfollow; tip double-tap; listener account switch.
- Offline: queue partitioning (N014).
- Security regression: no PII on the public doc; no client coin writes; capability-only UI decisions.
- Visual/manual QA: device/theme matrix (Part XII).

---

# PART XV — TARGET ARCHITECTURE

```
Firebase Auth identity
        |
canonical session identity (AuthContext: uid + token only)
        |
canonical profile repository (userService — one read model per viewer relation)
        |
viewer-specific capability projection (profileCapabilityEngine — deterministic)
        |
server-enforced read models (users public / users_private owner / users_security server)
        |
UI (consumes capabilities + read model; never recomputes privacy)
```
Financial mutations: UI -> callable -> server transaction + idempotency ledger + rate limit -> (no client fallback). Realtime: one uid-guarded listener per session. Stores hold a single normalized read model; `appStore` stops duplicating identity.

---

# PART XVI — REMEDIATION ROADMAP

## P0 — Security / integrity
1. **N003/N015 — server-enforced profile read models.** Files: `firestore.rules`, `userService.js`, migration function. Dep: schema split. Risk: high. Outcome: privacy enforced at the boundary. Validation: rules tests. Rollback: keep the public doc as a compatibility view.
2. **N011 — restore PII boundary** (private doc or equivalent). Files: `firestore.rules`, `functions/admin.js`, `functions/userExport.js`, `functions/user.js`.
3. **N008 — remove client coin write fallback.** Files: `src/services/monetizationService.js`. Validation: callable-only path tests.
4. **N009 — cap addCoins by coin volume.** Files: `functions/monetization.js`.
5. **N001/N002 — session isolation.** Files: `AuthContext.jsx`, `appStore.js`, `profileStore.js`.
6. **N004 — fix cross-viewer cache.** Files: `userService.js`.

## P1 — Correctness
N005 (fabrications), N006 (fail-open privacy), N007/N018 (capability vs projection), N010 (broad writes), N012 (follow counters), N013 (request invalidation), N014 (offline queue), N016 (App Check), N019 (analytics dedupe).

## P2 — Architecture
Canonical read model; single capability pipeline; store consolidation; remove duplicate identity; auth-helper consolidation in `functions/`.

## P3 — Resilience
Idempotency for all critical mutations; unknown-outcome recovery; retry/backoff; cross-tab/cross-device sync.

## P4 — Cleanup
Dead state in `profileStore` (`stories`, `shopItems`, `refreshKey`); unused `useLocation` in AuthContext; duplicated normalisation in `EditProfileScreen`.

## P5 — UX
Design-token compliance (92 hexes); i18n namespace; accessibility standardisation; honest unavailable states.

## P6 — Performance/cost
Consolidate profile reads; remove fallback reads; listener leak fix; analytics dedupe.

---

# PART XVII — MIGRATION PLAN

1. **Additive first:** create `users_private/{uid}` and `users_security/{uid}` and dual-write (server) while `users/{uid}` remains the compatibility read. No breaking change.
2. **Backfill:** a scheduled migration copies PII/security fields to the new docs; idempotent, bounded, retry-safe; no PII in logs.
3. **Switch reads:** `userService` reads the split docs; rules updated to enforce owner/server access; keep a legacy fallback for un-migrated users.
4. **Tighten `users/{uid}`:** restrict reads to the public projection; add field-level validation.
5. **Remove fallbacks** once migration coverage is complete; delete the client coin fallback and the target-keyed cache.
6. **Rollout/rollback:** feature-flag the read switch; retain the legacy path for one release; rollback = flip the flag and restore the rules block.
7. Do not destabilise auth, posts, stories, messaging, notifications, monetization: the split is additive and compatibility-preserving.

---

# PART XVIII — FINAL IMPLEMENTATION CONTRACT

**Must Fix**
- Server-enforced profile privacy (N003/N015) and PII boundary (N011).
- Client coin write fallback removal (N008) and `addCoins` volume cap (N009).
- Session/listener isolation (N001/N002) and cross-viewer cache (N004).
- Privacy fail-open (N006) and capability/projection divergence (N007/N018).
- Fabricated profile/progression/analytics (N005).
- Broad rule write surfaces (N010); analytics dedupe (N019).

**Must Preserve**
- Server-authoritative monetary transactions, idempotency ledger, rate limits, double-entry ledger.
- Owner-only profile update with server-authoritative field protection.
- Storage rules (owner-write/public-read, size/content-type constraints).
- Existing auth/posts/stories/messaging/notifications/monetization behaviour.

**Must Not Introduce**
- Cover photos (directive §0). Placeholders, fake data, synthetic analytics, demo fallbacks. Client-side financial authority. A second settings screen or a parallel privacy model.

**Must Not Delete Yet**
- Any "unused-looking" Profile component until reachability (static + barrel + dynamic + route) is proven. The PR#27 removals (`ProfileDeepNavigation`, `ProfileEconomyCard`, `ProfileNationStanding`, `ProfilePassportCard`, `ProfileIdentityBadges`) are already merged; treat further deletions as unverified (V2-13).

**Must Test**
- Capability/relationship truth tables; privacy fail-closed; cross-viewer/account isolation; addCoins volume cap; idempotent replay; offline queue partitioning; rules coverage.

**Must Verify Before Deployment**
- Deployed rules match the repo; indexes exist for cap/ledger queries; no PII on the public doc; no client coin writes; App Check status.

**Definition of Done**
- Privacy enforced server-side; one canonical read model; deterministic capabilities; server-authoritative money; idempotent critical mutations; recoverable unknown outcomes; lifecycle-safe listeners; scoped caches; deliberate offline; real analytics; concurrency-safe counters; deterministic pagination; no fabricated values; accessible and i18n-ready UI.

---

# APPENDIX — DEFINITION OF DONE (directive §43) — ANSWERS

1. **Canonical user identity?** Firebase Auth uid.
2. **Canonical profile representation?** A single viewer-scoped read model produced by one repository (target: Part VI); today, three divergent copies.
3. **Authoritative for every field?** Part VII matrix (Auth for identity; Firestore/Functions for profile/progression/finance; `counter_shards` for counts).
4. **Public/private/relationship/owner/server classification?** Part VII "Class" column; today `users/{uid}` mixes all classes (N015).
5. **Can one user access another's private data?** Yes — `users/{uid}` is readable by any signed-in user (N003) and PII is inline (N011).
6. **Can cached data cross account/viewer boundaries?** Yes — target-keyed L2 cache (N004); persisted `appStore` identity (N002).
7. **Can a client manipulate coins?** Yes, in principle — client write fallback (N008) and volume-uncapped `addCoins` (N009).
8. **Can a financial operation double-execute?** Server paths: no (idempotency ledger). Client fallback path: yes (N008).
9. **Unknown outcome without recovery?** Partially — no operation-id model; `Date.now()` is not used as the sole key (good), but recovery is not modelled end-to-end.
10. **Can listeners leak across accounts?** Yes (N001).
11. **Can profileStore go stale vs AuthContext?** Yes — no invalidation (N013); persisted store precedence (N002).
12. **Can account A's state survive into B?** Yes (N001/N002/N014).
13. **Are relationship states deterministic?** Only for blocking cases; muted/restricted/pending precedence is lossy (N017).
14. **Capabilities from one model?** No — engine + screens + passport each derive (N018).
15. **Privacy consistent everywhere?** No — fail-open paths and divergent layers (N006/N007).
16. **Analytics real?** No — fabricated defaults and client-writable, un-deduped counters (N005/N019).
17. **Counters correct under concurrency?** No — client ±1 (N012).
18. **Pagination boundaries correct?** Mostly (cursor-based) except `monetizationService` history/leaderboard (V2-01).
19. **Reads/writes economical?** Partially — duplicate profile reads and fallback reads inflate cost.
20. **Offline classified?** Partially — no explicit classification; queue not account-scoped (N014).
21. **Retries safe?** Server yes; client fallback no (N008).
22. **Critical mutations idempotent?** Server mostly yes; client follow/like no.
23. **Functions + rules enforce server authority?** Functions largely yes; rules do not enforce field privacy (N003).
24. **Are dead components actually dead?** Not proven — requires reachability analysis (V2-13).
25. **Extensible?** After the Part VI split, yes.
26. **Arvdoul-level UI?** Partially — design-token violations (92 hexes).
27. **Mobile/tablet/desktop?** Needs the Part XII matrix verification.
28. **Dark/light consistent?** Partially — hardcoded colours risk drift.
29. **Accessible?** Partially.
30. **Localization-ready?** No (6 `useTranslation` usages repo-wide).
31. **States complete?** Loading/empty/error exist in places; restricted/blocked/permission and honest-unavailable are inconsistent (N005).
32. **Tests sufficient?** No — no rules tests, no privacy fail-closed tests, no cross-account tests.
33. **Supports larger scale?** After read-model separation and cache scoping, yes.
34. **Evolvable without re-fragmentation?** Yes, if the capability pipeline and read model become the only sources.
35. **What did Audit V2 miss?** The client-side financial write fallback (N008), the `addCoins` volume gap (N009), the cross-viewer cache leak (N004), the fail-open privacy predicate (N006), the fabricated domain-service defaults (N005), the PII regression (N011), App Check absence (N016), and the offline-queue account bleed (N014).

---

*End of AUDIT V3. This document is an audit and blueprint only; no repository code was modified. The immediately exploitable items are N003, N008 and N009 — flag as IMMEDIATE SECURITY BLOCKER with minimal containment: (a) enable App Check and tighten `users/{uid}` reads, (b) delete the client coin write fallback, (c) cap `addCoins` by coin volume.*
