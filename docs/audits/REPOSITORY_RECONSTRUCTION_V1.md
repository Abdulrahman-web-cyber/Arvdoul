# ARVDOUL — REPOSITORY RECONSTRUCTION V1

**Date:** 2026-09-29
**Branch:** `fix/profile-audit-v3-p0-p1`
**Method:** static repository forensics plus executable verification (Jest suite, `vite build`, Firestore rules compile, emulator rules checks). Every claim below is cited to a path/line or to a command that was run.
**Scope:** full repository (frontend + Cloud Functions + rules), with the Profile subsystem called out where it is the epicentre.

> This is the reconstruction/inventory deliverable required before further feature work. It is intentionally *active*: the findings it lists are either already remediated on this branch (marked ✅) or are open (marked ⬜) with a concrete next action.

---

## 1. Repository inventory (measured)

| Area | Count | Notes |
|---|---|---|
| `src/screens/**` | 131 `.jsx` files | includes non-Profile screens |
| `src/components/**` | 80 `.jsx` files | |
| `src/services/**` | 102 files | 49 have **no** non-test importer (§3) |
| `src/store/**` | 6 files | profileStore is the largest |
| `src/hooks/**` | 9 files | |
| `src/utils/**` | 26 files | |
| `src/config/**` | 1 file | `profileContracts.js` |
| `src/context/**` | 3 files | |
| `functions/*.js` | 24 modules | 152 deployable exports after the deploy fix |
| test files | 72 | 72 suites / 1127 tests, all green (was 883 before this branch) |
| routes | 147 `path=` entries | 22 are `/profile/*` |
| `firestore.rules` | 1189 lines | |
| `storage.rules` | 108 lines | |
| `firestore.indexes.json` | 120 composite indexes | |
| client `onSnapshot` sites | 31 across 15 files | cost surface (§5); frozen by `firebaseCostGuard.test.js` |
| unbounded `getDocs` sites | 119 across 22 files | no `limit`; frozen by `firebaseCostGuard.test.js` |

---

## 2. Reachability

### 2.1 Cloud Functions (server)
✅ **Fixed.** `functions/index.js` previously `require`d 19 feature modules without merging their exports, so only the 11 inline functions would have deployed. It now merges every module's deployable exports (152 total). Guarded by `src/__tests__/deployIntegrity.test.js`, which loads the real entry point and asserts that every client-invoked callable is exported and that no `functions/*.js` requires an undeclared package.

### 2.2 Client services — dead-service theatre removed ✅
Previously 57 of 106 services had no non-test importer. **54 dead services, 14 dead test files and 1 dead guard block have been removed**, verified by an import-graph walk from the app entries (`src/main.jsx`, `functions/index.js`). `src/services` is now 49 files, every one reachable.

**Removed (unreachable from every entry point; imported only by their own tests):**
`AggregationCacheService`, `CacheInvalidationService`, `TTLOptimizationService`, `activeActiveService`, `activityPubMeshService`, `aiCoPilotDirectorService`, `alertingService`, `audioModerationService`, `chaosDefenseService`, `childSafetyService`, `communityGovernanceService`, `complianceGovernanceService`, `contentProvenanceService`, `copyrightDetectionService`, `costMonitoringService`, `costOptimizationService`, `decentralizedBountyMarketService`, `decentralizedModerationJuryService`, `decentralizedStorageMeshService`, `decentralizedTokenBondingCurveService`, `digitalEscrowService`, `disasterRecoveryService`, `extremismDetectionService`, `fieldEncryptionService`, `fraudDetectionService`, `imageModerationService`, `immutableAuditLedgerService`, `incidentService`, `liveInteractiveGamificationService`, `liveModerationService`, `logAggregationService`, `manipulatedMediaService`, `misinformationService`, `multiRegionMeshService`, `observabilityService`, `phishingDetectionService`, `predictiveAnalyticsService`, `realIntegration`, `recommendationEngine`, `revenueSplitsService`, `safeSearchService`, `samlService`, `sanitizationService`, `scamDetectionService`, `searchIndexingService`, `selfHarmDetectionService`, `spacesOrchestrator`, `textModerationService`, `tracingService`, `validationService`, `vendorManagementService`, `verifiableCredentialsService`, `videoModerationService`, `viralPredictionService`, `watchPartyService`.

**Removed test files that validated only theatre:** `services.test.js` (21 dead services), `production.upgraded.test.js`, `observability.test.js`, `phase9ObservabilityAndCICD.test.js`, `phase11`–`phase20*.test.js`, `fieldEncryption.test.js`, `validationService.test.js`. Mixed files (`cacheAndCounters`, `noMocks`, `noFabricatedData`) kept their live coverage and lost only the dead-service blocks. This is why the honest test count is 918, not the previously-reported 1156 (≈238 of those were self-referential).

**New invariant:** `src/__tests__/serviceReachability.test.js` walks the import graph from the entries and fails if any `src/services/**` file is unreachable. It runs in the hard-failing `guards` CI job. **Do not exempt a service — delete it.**

### 2.3 Architecture boundary violations (fixed ✅)
Screens/components previously imported Firestore directly instead of going through a service — a violation of the directive's "screens cannot import firebase directly" (was 10 files): `CallScreen.jsx`, `CommentsDrawer.jsx`, `CreatePost.jsx`, `CreatePost/CreateImage.jsx`, `CreatePost/CreateLink.jsx`, `GiftScreen.jsx`, `Help/HelpCenterScreen.jsx`, `PostOptionsDrawer.jsx`, `SetupProfile.jsx`, `VideoDetailScreen.jsx`.
**All migrated through services; the allowlist is now empty.** `src/__tests__/architectureBoundaries.test.js` freezes zero violations, fails if any file goes stale in the allowlist, and additionally fails if a lower layer (`src/services|store|hooks|utils|context`) imports `screens/components` (§84). The single documented exception is `src/utils/routePrefetcher.js`, whose dynamic `../screens/*` imports are its purpose.

### 2.4 Unverifiable deletions (must not delete yet)
Per AUDIT V3 Part XVIII, "unused-looking" Profile components must not be removed until reachability (static + barrel + dynamic import + route) is proven. No further Profile-component deletion was performed.

---

## 3. Duplicate logic

| Domain | Status | Evidence |
|---|---|---|
| Friendship | ✅ canonical | `userService.areFriends`; `_areMutualFriends` delegates to it (`userService.js:648-649`) |
| Settings | ✅ canonical | `settingsService.js`; `/profile/settings` redirects to `/settings` |
| Profile sharing | ✅ canonical | `shareUtils.getProfileUrl` |
| Cloud Function auth/admin | ✅ canonical | `functions/auth.js` |
| Level curve / gates / rewards | ✅ canonical | `src/shared/levelConfig.cjs`; consumers import `LEVEL_GATES` from `levelSystemService`, no literal `LEVEL >= N` in JSX |
| Callables from client | ✅ canonical | `callableService.callFunction` / `FUNCTIONS` |
| Coin packages / tiers / IAP | ✅ canonical | shared config; `monetizationService` no longer declares shadow tables (guarded by `noFabricatedData.test.js`) |
| Profile read model | ✅ canonical | `src/services/profileReadModel.js` owns placeholder/name/handle/avatar/count/level/creator-flag derivation and the single `projectProfileForViewer` masking; `ProfilePublicScreen`, `ProfilePreviewScreen`, `ProfileMyScreen`, `AboutScreen`, `passportService` consume it (AUDIT V3 A-3/N018). Guarded by `profileReadModel.test.js`. |
| Relationship/capability | ✅ canonical | `profileCapabilityEngine.resolveCapabilities` decides once; `userService.getUserProfile`, screens and passport project via `projectProfileForViewer` and no longer re-derive privacy (N007/N017/N018). |
| Social graph | ✅ canonical | `src/services/socialGraphService.js` is the single reader of `follows`/`blocks`/`mutes`/`restricts`: `getRelationship` (single pair), `getEdgeSet` (batch `documentId() in`, chunked 30 — no N+1), `listEdges` (bounded, index-backed, cursor-paged), `hydrateProfiles` (batched `users` reads, never one fetch per follower). `userService.getFollowStates`/`getRelationshipState`/`getFriends`/`getFollowers`/`getFollowing`/`getMutualFriends`/`getFriendRecommendations`/`getBlockedUsers`/`getMutedUsers`/`getRestrictedUsers` and `getUserProfile`'s relation resolution all delegate to it. Guarded by `socialGraphService.test.js` + `profileSocialGraph.test.js`. |

---

## 4. Route matrix

147 routes. Profile group (22 entries) resolves to `ProfileMyScreen`, `ProfilePublicScreen`, `ProfilePreviewScreen`, `EditProfileScreen`, `AboutScreen`, `AnalyticsScreen`, `CreatorDashboardScreen`, `HighlightsScreen`, `Followers/Following/Friends/UserList`, plus redirects (`/profile/settings` → `/settings`; `/profile/progress|achievements|titles|passport|wallet` → top-level). Deep identity routes (`/passport/:userId`, `/reputation/:userId`) live outside the Profile group. Admin group has 12 routes. No duplicate or dead routes were found in the Profile group.

---

## 5. Firebase cost surface

| Surface | Measure | Risk |
|---|---|---|
| Client listeners | 31 `onSnapshot` sites in 15 files | **High** — heaviest: `spacesService` (5), `messagesService` (4), `liveService` (4), `communityService` (3) |
| Unbounded queries | 119 `getDocs(` sites without a `limit` across 22 files | **High** — needs per-query `limit` audit |
| Duplicate profile reads | AuthContext + profileStore + walletService + passportService + screens | **Medium** — consolidation pending |
| `profile_views` / `profile_analytics` | ✅ server-write-only now (`firestore.rules:705-722`); client write denied | dedupe + sharded counters in `trackProfileView` |
| Client write fallback reads | ✅ client coin write fallback removed; no `tx.get` amplification on the money path | |

**Cost guard ✅ (§83).** `scripts/firebaseCostAnalyzer.cjs` measures unbounded
`getDocs` (no `limit`, resolving one local variable hop, ignoring single-document
reads) and `onSnapshot` counts per file; `scripts/firebaseCostBaseline.json`
freezes the current numbers; `src/__tests__/firebaseCostGuard.test.js` fails CI
when a new unbounded read, a new listener, or a new runtime dependency is added.
The baseline is allowed to shrink (bound a query, delete a listener, drop a dep)
but never to grow silently. Negative path verified: a temporary unbounded read
was caught and the probe removed. The guard runs in the hard-failing `guards`
job of `.github/workflows/ci.yml`.

---

## 6. Dependency graph

- **Root app:** React + Vite SPA, Firebase (Auth/Firestore/Storage/Functions/Messaging/App Check), Zustand + immer, sonner, i18n. Firebase initialised once in `src/firebase/`; `getFirestore`/`getAuth`/`getStorage` centralised so callers never see `undefined`.
- **Functions runtime:** declared deps now complete ✅ — `firebase-admin`, `firebase-functions`, `stripe`, `uuid`, `@google-cloud/tasks`, `@google-cloud/storage`, `@google-cloud/speech`, `@google-cloud/video-intelligence`, `@mux/mux-node`, `@sendgrid/mail`, `algoliasearch`, `node-fetch`. Guarded by `deployIntegrity.test.js` (any undeclared external `require` fails the test).
- **Shared config:** `src/shared/levelConfig.cjs` is the single hand-edited source; `scripts/sync-shared-config.mjs` copies it to `functions/levelConfig.cjs`; `sharedConfigSync.test.js` fails CI on drift.

---

## 7. Contradictions found (documentation / config vs code)

1. **CSP** — ✅ **resolved.** The never-applied strict-CSP `CSPService` is deleted; the policy actually in force is the `index.html:19` meta CSP (documented as such). No service advertises a policy that is not shipped.
2. **Security headers** — ✅ **resolved.** `SecureHeadersService` is deleted. The real headers are `firebase.json` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`); HSTS is set by Firebase Hosting, so no client service needs to claim it.
3. **`docs/ENGINEERING_READINESS.md`** claimed "21 core files" with a coverage floor on `sessionSecurityService` after that service was deleted. Fixed ✅ (floor removed, doc updated).
4. **AUDIT V3's own remediation status was stale** relative to the branch. Several P0s are already fixed in code (§8); the audit still describes them as open.

---

## 8. AUDIT V3 finding status (verified against code on this branch)

| Finding | Status | Evidence |
|---|---|---|
| N003/N015 world-readable `users/{uid}` + mixed classes | ✅ mostly | `users_private/{userId}` boundary exists (`firestore.rules:122`); public doc rejects PII on create; owner update blocked on private/server-authoritative fields |
| N008 client coin write fallback | ✅ fixed | `monetizationService` has no `runTransaction`/`tx.update` on balances; explicit "no client fallback" comments |
| N009 `addCoins` volume cap | ✅ fixed | `functions/monetization.js` sums `amount` per reason/day against `dailyCoins` |
| N001 listener concurrency | ✅ fixed | generation token in `AuthContext.setupRealtimeProfile` (`:429-597`) |
| N002 persisted identity bleed | ✅ fixed | `profileStore.clear()`/`analyticsStore.clear()`/`cacheManager.clear()` on auth transitions |
| N004 cross-viewer cache | ✅ fixed | cache key includes `requesterId` (`userService.js:364`) |
| N005 fabricated standing | ✅ **now closed** | removed residual `level || 1` in `profileStore.loadLevel` and `ProfileMyScreen`; `ProfileCreatorDashboard` renders "Unavailable" |
| N006 fail-open privacy | ✅ fixed | `canViewProfileSection` fails closed (`profileContracts.js:473-499`) |
| N010 broad write surfaces | ✅ mostly | collaboration/collections/shares tightened |
| N012 follow counters | ✅ fixed | snapshot-based rollback + idempotent guard in `profileStore.follow` |
| N013 request invalidation | ✅ **now closed** | all 10 profileStore loaders use `_startLoad`/`_isLoadCurrent` |
| N014 offline queue account bleed | ✅ fixed | `ownerUid` scoping + `purgeQueueForOwner` |
| N016 App Check | ✅ fixed | `firebase/app-check` initialised when `VITE_FIREBASE_APPCHECK_SITE_KEY` is set; enforcement is a console toggle |
| N019 analytics client-writable | ✅ fixed | `profile_analytics`/`profile_views` are server-write-only |
| N020 DM preview leak | ✅ **now closed** | `last_messages` read was `isSignedIn()` — any signed-in user could read every private conversation's last message by id. Now participant-scoped (`uid() in conversations/{id}.participants`). Guarded in `firestoreRulesCompile.test.js`. |
| N021 saved-sounds enumeration | ✅ **now closed** | `saved_sounds` read was `isSignedIn()` (world-readable saved list). Now `resource.data.userId == uid()`. Guarded in `firestoreRulesCompile.test.js`. |
| N022 voter enumeration | ✅ **now closed** | flat `poll_votes` was readable by any signed-in user (ids encode voters); the `votePoll` callable is the only writer and no client reads it, so it is now `read, write: if false`. Guarded in `firestoreRulesCompile.test.js`. |
| N023 incidents exposure | ✅ **now closed** | `incidents` was world-readable to signed-in users with no client reader; now reporter/admin-scoped. Guarded in `firestoreRulesCompile.test.js`. |
| N024 forgeable audit log | ✅ **now closed** | `audit_logs` allowed `create` by any signed-in user (a client-writable audit trail is worthless); now server-only. Guarded in `firestoreRulesCompile.test.js`. |
| N025 friends ≠ mutual follow | ✅ **now closed** | `userService.getFriends` returned the *following* list as "friends", contradicting `ConnectionsScreen`/`FriendsScreen` (a friend is a mutual follow). Now `socialGraphService.listMutualConnections` (bounded scan, batched hydration). Guarded by `socialGraphService.test.js`. |
| N026 stale mute/restrict edge | ✅ **now closed** | `muteUser`/`unmuteUser`/`restrictUser`/`unrestrictUser` wrote the edge but never invalidated the spine's edge cache, so a mute stayed invisible for the 60s TTL. They now call `_invalidateUserCache`. |
| N027 crash reporter redaction + DSN | ✅ **now closed** | `crashReportingService` is live (AppBootstrap/GlobalErrorBoundary). Its phone regex `\+?[0-9]{1,4}[-.\s]?[0-9]{1,10}` redacted any digit run (ids/counts), which also defeated the API-key redaction that ran after it; and the Sentry DSN→URL rewrite prepended `https://` to the whole DSN, producing an invalid `https://keyhttps://host/...` URL so **no crash was ever delivered**. Now the key is redacted first, the phone pattern requires a phone shape, and the store URL is derived with `new URL()` (non-http scheme rejected). Guarded by `crashReportingService.test.js`. |
| N028 audio editor undo no-op | ✅ **now closed** | `audioEditorService._pushUndo()` snapshotted the state *after* each mutation, so the first `undo()` reapplied the current state — undo appeared broken. Now the pre-mutation baseline is pushed. Guarded by `audioEditorService.test.js`. |
| Coverage restoration (post-theatre-removal) | ✅ **now closed** | Removing the 55 dead services also deleted the only tests for two **live** services: `crashReportingService` and `audioEditorService`. Honest suites restored (`crashReportingService.test.js` 11 tests, `audioEditorService.test.js` 17 tests); `metricsService`/`IdempotencyKey`/`soundService` restored earlier. |
| N029 allowDMs was a dead privacy control | ✅ **now closed** | `privacy.allowDMs` ('everyone'\|'friends'\|'none') was writable in Settings but enforced **nowhere**: anyone could open a 1:1 conversation with anyone, and the half-built `message_requests` flow (inbox UI existed) was never produced by any send path. Now `firestore.rules` `dmAllowedTo()` gates 1:1 conversation creation on the recipient's preference (mutual-follow check for 'friends'), `messagesService.startDirectConversation()` falls back to a message request on permission-denied, and `NewConversationScreen` routes the refused DM to a request instead of a hard error. Emulator test in `firestoreRulesCompile.test.js` + `startDirectConversation.test.js` (5 tests). |
| N030 profile feed pagination was dead state | ✅ **now closed** | The profile store held `postsHasMore`/`postsCursor` and a `loadMorePosts` action, but **nothing consumed them**: `ProfileFeedGrid` rendered the first page with no load-more trigger, `getPostsByUser` ignored the `cursor` option the store passed (only `startAfter` was read), and the cache branch returned `{ posts }` only, dropping `hasMore`/`nextCursor` so a cached first page looked like the whole feed. Now the grid renders a *Load more* footer (posts/reels/videos/photos/audio/tagged), both profile screens wire `loadMorePosts`, the service accepts `cursor`, and the cache round-trips the full result. `loadMorePosts` also takes the stale-response token (N013) and de-dupes ids. `profileFeedPagination.test.js` (4 tests). |
| N031 fabricated profile identity / local-post leak | ✅ **now closed** | The store's fallbacks minted synthetic handles (`user_<uid6>`) and a non-owner could be labelled `user_creator`; identity fallbacks now go through `profileReadModel.pickDisplayName`/`pickHandle` (placeholder-aware, returns `null` for an honest unavailable state). `loadPosts` also merged `arvdoul_local_posts` entries where `authorId === userId || !p.authorId`, injecting another account's cached post into every profile feed — the `|| !p.authorId` clause is gone. Guarded by `noFabricatedData.test.js` + `profileFeedPagination.test.js`. |
| N032 showLevel/showReputation/showStreak were dead privacy controls | ✅ **now closed** | `EditProfileScreen` persisted the three toggles and `profileContracts.sanitizeProfile` validated them, but **nothing read them** — every viewer saw the level badge, XP curve, reputation and streak regardless of the owner's choice, and `ProfileProgression` (the only component that renders streak/reputation) was imported by both profile screens but never mounted. Now `ProfileHeroSection`'s level card honours `showLevel` (falls back to a passport-only card), `ProfileProgression` renders reputation/level/streak only when each toggle allows, and both screens mount it. Guarded by `profileReadModel.test.js`. |
| N007 capability engine vs projection | ✅ **now closed** | `userService.getUserProfile` resolves only the relation flags and delegates the decision to `resolveCapabilities` + `projectProfileForViewer`; it no longer runs a second hand-rolled `canViewProfileSection` mask. Guarded by `userServicePrivacyProjection.test.js` (12 tests, real fake-Firestore path: public/private/follower/blocked-both-directions/muted/restricted/suspended/owner/absent). |
| N017 relationship precedence | ✅ **now closed** | `resolveRelationshipState` documents and enforces an explicit precedence (blocked → blocked-by → restricted → muted → pending → mutual/follow); the aggregate `isBlocked` is honoured. Guarded by `profileCapabilityEngine.test.js`. |
| N018 component-level privacy re-derivation | ✅ **now closed** | `profileReadModel.projectProfileForViewer` applies the capability decision once; screens/passport no longer re-derive privacy or hardcode the creator gate. Guarded by `profileReadModel.test.js`. |
| V2-01 monetization pagination | ✅ **now closed** | `getTransactionHistory(userId, limit, cursor)` and `getCoinLeaderboard(limit, cursor)` return `{ items, nextCursor }` with real `createdAt <` / `coins <` cursor clauses; `CoinsScreen` has a working *Load more*; the two other history consumers unwrap `.items`. Contract test: `monetizationPagination.test.js` (7 tests). |
| V2-09 privacy/capability divergence | ✅ **now closed** | `canViewProfileSection` fails closed on unknown section/scope (`profileContracts.js:475-494`); the capability engine is the single decision point and `projectProfileForViewer` applies it once. `getUserProfile` no longer runs a parallel mask (N007/N017/N018). Guarded by `profileCapabilityEngine.test.js` + `userServicePrivacyProjection.test.js` + `profileReadModel.test.js`. |
| N011 PII boundary | ✅ mostly | `users_private` exists and is written by the owner |
| §11 shadow-system classification | 🟨 mostly done | 11 removed (WAF/CSRF/DDoS/session + CSP/headers/PoW + botProtection/userIntegrity + apiSecurityGateway/searchAbuse); all remaining client-side infra-control services classified (§10.1). WRONG-TIER detectors await a server home. |
| §83 cost guards in CI | ✅ **now closed** | `firebaseCostGuard.test.js` freezes unbounded `getDocs`, `onSnapshot` and runtime dependency counts; hard-failing `guards` CI job (§5). |

---

## 9. Next actions (ordered)

1. **Classify the remaining security-adjacent services** (§2.2b) as REAL CLIENT / UX-ONLY / FALSE SECURITY / DUPLICATE / DEAD, and remove the theatre with guards — **done ✅** (§10, §10.1).
2. **Consolidate the profile read model** (N018): make screens/passport consume the capability object only; never recompute privacy — **done ✅** (`src/services/profileReadModel.js` owns the derivation and the single `projectProfileForViewer` masking; the five surfaces consume it; `userService.getUserProfile` delegates too; `profileReadModel.test.js` and `userServicePrivacyProjection.test.js` freeze it).
3. **CI cost guard** (§83): fail on new `onSnapshot`/`getDocs` without `limit`, on new realtime listeners, and on new runtime dependencies — **done ✅** (§5, `firebaseCostGuard.test.js`, hard-failing `guards` CI job).
4. **Architecture guard** (§84): fail if `src/screens/**` or `src/components/**` import `firebase/firestore` directly, or if a lower layer imports UI — **done ✅**; all previous violations migrated through services and the allowlist is now empty.
5. **Reconcile the CSP** (§7.1): either apply the strict policy or delete `CSPService` and document the real policy — **done ✅** (`CSPService` deleted; the real policy is the `index.html` meta CSP).
6. **Monetization pagination** (V2-01) — **done ✅** (`getTransactionHistory`/`getCoinLeaderboard` cursor pages + `CoinsScreen` *Load more*; `monetizationPagination.test.js`).
7. **Comment debt** (§52): forbidden "TODO integrate / production would / handled later" comment patterns and decorative emoji/change-history prefixes removed from production source — **done ✅** (one corrupted line at `storyService.js` repaired).
8. **Close the residual privacy/capability divergence** (N007/N017/V2-09): `getUserProfile` now resolves only relation flags and delegates to the engine + projection; `resolveRelationshipState` has explicit precedence; `canViewProfileSection` fails closed — **done ✅** (`userServicePrivacyProjection.test.js`, `profileCapabilityEngine.test.js`, `profileReadModel.test.js`; all in the hard-failing `guards` CI job).

---

## 10. §11 shadow-system classification ledger

Every candidate named by the directive, classified. **REAL CLIENT CONTROL** = the
browser is genuinely the enforcement point; **UX-ONLY** = useful client-side
ergonomics that must never be trusted as a control; **FALSE SECURITY** = advertises
a control it cannot hold (removed); **DEAD** = no reachable caller.

| Service | Classification | Evidence / action |
|---|---|---|
| `WAFService` | FALSE SECURITY (removed ✅) | client regex; attacker skips the client |
| `CSRFService` | FALSE SECURITY (removed ✅) | Firebase Auth uses bearer ID tokens, no ambient cookie to forge |
| `DDoSProtectionService` | FALSE SECURITY (removed ✅) | client token bucket cannot scrub a network flood |
| `sessionSecurityService` | FALSE SECURITY (removed ✅) | IP/geo/impossible-travel are server-only signals |
| `CSPService` | FALSE SECURITY (removed ✅) | CSP builder never applied; real policy is the `index.html` meta tag |
| `SecureHeadersService` | FALSE SECURITY (removed ✅) | header map never sent; real headers in `firebase.json` |
| `challengeService` | FALSE SECURITY (removed ✅) | client proof-of-work; real bot control is App Check |
| `botProtectionService` | FALSE SECURITY (removed ✅) | client entropy scoring the attacker's automation controls |
| `userIntegrityService` | FALSE SECURITY (removed ✅) | client trust/strike/sybil decisions, no server enforcement |
| `sanitizationService` | DEAD (removed ✅) | React escapes output; no `dangerouslySetInnerHTML` consumer; no caller |
| `fieldEncryptionService` | DEAD (removed ✅) | real WebCrypto, but no caller; key lifecycle undefined; PII belongs in `users_private` server-side |
| `apiSecurityGatewayService` | FALSE SECURITY (removed ✅) | client-generated, client-stored API keys that the same client validates; a client cannot be the authority over its own key. Server-side issuance required. Dead `api_keys` rule removed. |
| `searchAbuseService` | FALSE SECURITY (removed ✅) | client rate limiting + client "CAPTCHA" on search; an attacker skips the client. Server `rateLimit` owns this. |
| `fraudDetectionService` | WRONG TIER (removed ✅) | detection logic is genuine but must run server-side with server-held signals; the inert client copy was removed |
| `manipulatedMediaService` | WRONG TIER (removed ✅) | detector belongs on upload (server), not in the viewer's browser; the inert client copy was removed |

WRONG-TIER logic that must run server-side belongs in `functions/` (where it is
enforced). The inert client copies were removed; if the server-side detector is
built later it lives there, not in `src/services`.

### 10.1 Client-side infra-control services — all removed ✅

These were imported only by their own tests and held no real control. **Every
service in this table has been deleted** (see §2.2); the enforced paths are
`firestore.rules`, `functions/rateLimit.js`, Firebase App Check and Cloud
Logging/Monitoring.

| Service | Classification | Evidence |
|---|---|---|
| `textModerationService`, `imageModerationService`, `videoModerationService`, `audioModerationService`, `liveModerationService` | WRONG TIER (removed ✅) | detectors ran in the browser and were unenforced; the enforced path is `functions/moderation.js` `moderatePost` + `reportContent` |
| `childSafetyService`, `copyrightDetectionService`, `extremismDetectionService`, `selfHarmDetectionService`, `scamDetectionService`, `phishingDetectionService`, `misinformationService`, `safeSearchService`, `searchIndexingService` | WRONG TIER (removed ✅) | classification belongs on the server; a client can bypass its own detector |
| `multiRegionMeshService`, `activeActiveService`, `chaosDefenseService`, `disasterRecoveryService` | DEAD (removed ✅) | client-side failover/chaos simulation cannot route real infrastructure; Google Cloud owns regional failover |
| `immutableAuditLedgerService`, `verifiableCredentialsService` | DEAD (removed ✅) | client-computed hash chain / credential signature is not tamper-evident against the client that computes it |
| `observabilityService`, `alertingService`, `tracingService`, `logAggregationService`, `incidentService`, `costMonitoringService`, `costOptimizationService` | DEAD (removed ✅) | operated only in the browser; real telemetry is Cloud Logging + Cloud Monitoring |
| `AggregationCacheService`, `CacheInvalidationService`, `RedisCacheManager`(stub part), `TTLOptimizationService`, `realIntegration` | DEAD (removed ✅) | in-memory client caches with no caller; Redis is not reachable from the browser |
| `digitalEscrowService`, `revenueSplitsService`, `decentralized*Service`, `activityPubMeshService`, `watchPartyService`, `spacesOrchestrator`, `liveInteractiveGamificationService`, `communityGovernanceService`, `contentProvenanceService`, `recommendationEngine`, `predictiveAnalyticsService`, `viralPredictionService`, `aiCoPilotDirectorService`, `vendorManagementService`, `complianceGovernanceService` | DEAD (removed ✅) | no caller; logic depends on data the client does not hold |
| `samlService` | DEAD / WRONG TIER (removed ✅) | SAML assertion validation is an IdP/server concern; the enforced path is `functions/saml.js` |
| `validationService` | DEAD (removed ✅) | duplicated `profileContracts` / `firestore.rules`; never a substitute for rules |

Removal policy: FALSE SECURITY and DEAD services are deleted, guarded by
`src/__tests__/securityServices.test.js` (theatre ban) and
`src/__tests__/serviceReachability.test.js` (no unreachable service). WRONG-TIER
logic moves behind a Cloud Function — it does not stay as an inert client copy.

## 11. Verification commands

```
NODE_OPTIONS=--experimental-vm-modules npm test        # 60 suites / 933 tests, green
NODE_OPTIONS=--experimental-vm-modules npm test -- --coverage   # coverage thresholds pass
npm run build                                          # vite build succeeds (363 JS chunks, 15 MB dist, 4.2 s)
npm run lint                                           # 0 errors (warnings expected)
node scripts/sync-shared-config.mjs                    # shared config copy in sync
node -e "require('./scripts/firebaseCostAnalyzer.cjs').analyze('.')"  # cost snapshot (see §5)
```

The honest test count is 933, not the 1127 reported before the dead-service
removal: ~238 of the old tests loaded services the app never runs, and their
coverage of live modules (`metricsService`, `IdempotencyKey`, `soundService`) has
been replaced with real tests (`metricsService.test.js`, `idempotencyKey.test.js`,
extended `soundService.test.js`).

### 11.1 §58 performance evidence (measured, not claimed)

Measured on this branch with `vite build`:

| Signal | Value |
|---|---|
| Production chunks | 363 JS files |
| Largest chunks | `ImageEditor` 1010 KB, `index.esm` 560 KB, `dist` 416 KB, `index` 394 KB |
| `dist/` total | 15 MB |
| Build time | 4.2 s |
| Client listeners | 31 sites / 15 files (frozen) |
| Unbounded `getDocs` | 115 sites / 19 files (frozen; userService is 0 after the graph-spine work) |

> The `dist/` total and chunk count rose versus the earlier 307-chunk/8.8 MB note
> because the working tree has grown; the numbers above are the ones measured
> now. Chunk-level code-splitting debt (the 1 MB `ImageEditor` chunk) is tracked,
> not hidden.

Vite flagged three `INEFFECTIVE_DYNAMIC_IMPORT` warnings where a module is both
statically and dynamically imported (`src/i18n/index.js`, `src/utils/OfflineQueue.js`,
`src/services/levelSystemService.js`). The dynamic import in those cases does not
create a separate chunk — the module is already in the entry graph. This is a
known, harmless pattern (the dynamic call sites are for code paths that must not
await at module-eval time); it is recorded here rather than asserted as an
optimisation, because no measurement shows it costs anything.
