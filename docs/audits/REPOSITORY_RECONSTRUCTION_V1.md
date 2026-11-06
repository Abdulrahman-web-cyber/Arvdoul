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
| Social graph | ✅ canonical | `src/services/socialGraphService.js` is the single reader of `follows`/`blocks`/`mutes`/`restricts`: `getRelationship` (single pair — 6 bounded reads, tolerant of absent safety edges, see N033), `getEdgeSet` (follow reads via `documentId() in`, chunked 30; safety edges via actor-equality + other-party `in` — the shape the collection rules can prove, N033), `listEdges`/`listConnections` (bounded, index-backed, cursor-paged), `hydrateProfiles` (batched `users` reads, never one fetch per follower). `userService.getFollowStates`/`getRelationshipState`/`getFriends`/`getFollowers`/`getFollowing`/`getMutualFriends`/`getFriendRecommendations`/`getBlockedUsers`/`getMutedUsers`/`getRestrictedUsers`, `messagesService.isBlocked`/`getBlockedUsers`, `storyService._canViewStory` and `getUserProfile`'s relation resolution all delegate to it. Guarded by `socialGraphService.test.js` + `profileSocialGraph.test.js` + `socialGraphEdgeReadRules.test.js` (emulator). |

---

## 4. Route matrix

147 routes. Profile group (22 entries) resolves to `ProfileMyScreen`, `ProfilePublicScreen`, `ProfilePreviewScreen`, `EditProfileScreen`, `AboutScreen`, `AnalyticsScreen`, `CreatorDashboardScreen`, `HighlightsScreen`, `Followers/Following/Friends/UserList`, plus redirects (`/profile/settings` → `/settings`; `/profile/progress|achievements|titles|passport|wallet` → top-level). Deep identity routes (`/passport/:userId`, `/reputation/:userId`) live outside the Profile group. Admin group has 12 routes. No duplicate or dead routes were found in the Profile group.

---

## 5. Firebase cost surface

| Surface | Measure | Risk |
|---|---|---|
| Client listeners | 31 `onSnapshot` sites in 15 files | **High** — heaviest: `spacesService` (5), `messagesService` (4), `liveService` (4), `communityService` (3) |
| Unbounded queries | 109 `getDocs(` sites the analyzer still flags across 17 files; every genuine unbounded collection scan has been bounded (see the audit note below) | **Medium** — remainder are single-document / chunked `documentId() in` false positives |
| Duplicate profile reads | ✅ consolidated where it was a real duplication. `reputationService` did a second direct `users/{uid}` read **and** carried its own score-clamp copy; it now reads through `userService.getUserProfile` and shares `profileReadModel.readStandingScore` (also now used by `passportService`). `profileStore` already routes every profile read through `userService.getUserProfile`. The remaining direct `users/{uid}` reads are **single-field, single-document** reads, not duplicate projections, and are left as-is: `walletService` (coin balance), `rankingService.getUserBadges` (follower/following/createdAt counters), `liveService._getUserLevel`/`sendLiveComment` (level/displayName), `videoService._validateVideoFile` (subscription tier), `levelSystemService.getLevelInfo`. `AuthContext`'s `users/{uid}` `onSnapshot` is the session identity stream for the signed-in user, not a profile-view read | **Low** |
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

**Unbounded-query audit ✅.** Every `getDocs` in `src/services` was classified by
hand (the analyzer under-reports because it resolves only a single-line local
variable hop). Genuine unbounded reads fixed in this pass:

- `feedService._getFallbackSimpleFeed` / `_getDiscoverFeedPaginated` /
  `_getVideoFeedPaginated` — the `catch` branch called `getDocs(postsRef)` with
  **no limit at all**, reading the entire `posts` collection whenever the ordered
  query failed (missing index / field). Now falls back to a *bounded* unordered
  read (`query(postsRef, limit(limit * 3|4))`).
- `commentService.getCommentsByPost` — the `limit` was applied only when the
  caller passed one (defaulted to no bound), and the index-error fallback
  `getDocs(simpleQ)` was fully unbounded. Both now carry
  `COMMENTS_CONFIG.MAX_FETCH_LIMIT` (200).
- `communityService.getUserCommunities` / `getUserManagedCommunities` — per-user
  membership lists read with no ceiling; now `MAX_COMMUNITY_READ` (200).
- `eventService.getUserRegistrations` / `getOrganizerEvents` / `submitFeedback`
  aggregate / `getEventFeedback` — now `MAX_EVENT_READ` (200).
- `liveService` active/ended/history/statistics reads — now
  `LIVE_CONFIG.MAX_STREAM_READ` (200); `getActiveLiveStreams` /
  `getLiveHistory` apply the bound even when the caller passes no `limit`.
- `collaborationService.getTeam` / `getUserInvites` / `getContentVersions` —
  now `COLLABORATION_CONFIG.MAX_LIST_READ` (200).
- `achievementService.getUserAchievements` / `titleService.getUserTitles` —
  per-user list reads now bounded (200).
- `walletService.getWalletOverview` pending-withdrawal read, and
  `firestoreService.getPostsByUser` (limit now always applied) /
  `getPostDailyViews` (bounded to the requested day window) — bounded.

After the pass the baseline **shrank** (feedService 16→14, messagesService
11→10, achievementService 1→0, titleService 1→0, collaborationService 4→3); no
count grew. Remaining analyzer-flagged sites are single-document reads or
`documentId() in` chunked reads the analyzer cannot resolve (documented
false-positive class), not unbounded collection scans.

**Rules/graph adversarial checks in CI.** The `guards` job installs a JDK
(`actions/setup-java`, the emulator is a JVM process) and runs
`firebase-tools emulators:exec --only firestore` around
`firestoreRulesCompile.test.js` + `socialGraphEdgeReadRules.test.js`, so the
live rules assertions execute instead of skipping (they self-skip when no
emulator is reachable). `socialGraphService.test.js` additionally asserts the
*shape* of every batch safety-edge query without an emulator, so the
rules-provable-read invariant (N033) is frozen even in the unit run.

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
| N033 graph edge reads silently denied by rules | ✅ **now closed** | Two failures from the same cause (rules are not filters). (a) `getEdgeSet` batch-read `blocks`/`mutes`/`restricts` with `documentId() in [...]`, which cannot prove the rule's `resource.data.<actorField> == uid()`, so every batch hydration lost block/mute/restrict flags. (b) `getRelationship` answered "are we blocked/muted/restricted?" with *point* reads of `blocks`/`mutes`/`restricts`; a missing edge (`resource == null`) made `resource.data.<actorField>` throw, so the read was denied and the check failed open to "not blocked"/"no relationship". The same point-read shape sat in `userService` (`followUser`'s in-transaction block check, `isBlocked`/`isMuted`/`isRestricted`, `blockUser`/`unblockUser`), `messagesService` (`isBlocked`/`blockUser`/`unblockUser`) and `storyService._canViewStory`. Fixed by moving every safety-edge read onto the actor-equality + other-party `in` list shape (new reversed `blocks` index) — an empty result means "no edge". `getRelationship` is now 4 bounded list reads (block out/in, mute, restrict) plus 2 follow reads; `followUser`'s transaction now touches only `follows` (the block gate moved out); `unblockUser` resolves existence through the spine before deleting; `feedService._getBlockedUsersCached` delegates to `listConnections(userId, 'blocked')` instead of querying `blocks` itself. The rules were left `resource.data`-scoped on purpose: allowing `get` on a null `resource` would have answered "does an edge exist" for arbitrary pairs (an existence oracle), so the client shape was changed instead. Guarded by `socialGraphEdgeReadRules.test.js` (emulator, hard-failing `guards` CI job) + query-shape assertions in `socialGraphService.test.js`. |
| §11 shadow-system classification | 🟨 mostly done | 11 removed (WAF/CSRF/DDoS/session + CSP/headers/PoW + botProtection/userIntegrity + apiSecurityGateway/searchAbuse); all remaining client-side infra-control services classified (§10.1). WRONG-TIER detectors await a server home. |
| N034 unbounded collection reads | ✅ **now closed** | Hand-audited every `getDocs` in `src/services` (the analyzer resolves only a single local-variable hop, so it under-reports). Genuine full-collection scans fixed: `feedService` fallback `catch` branches (3 sites) read the **entire** `posts` collection with no limit at all; `commentService.getCommentsByPost` applied `limit` only when the caller passed one and its index-error fallback was unbounded; `communityService.getUserCommunities`/`getUserManagedCommunities`, `eventService` (registrations/organizer/feedback), `liveService` (active/ended/history/statistics), `collaborationService` (team/invites/content), `achievementService.getUserAchievements`, `titleService.getUserTitles`, `walletService.getWalletOverview` pending withdrawals, `firestoreService.getPostsByUser`/`getPostDailyViews` — all now carry a hard ceiling (200) or a caller-derived bound. Baseline **shrank** (feed 16→14, messages 11→10, achievement/title 1→0, collaboration 4→3); no count grew. Guarded by `firebaseCostGuard.test.js` (baseline may only shrink). |
| N035 `profileInfo` was a dead privacy control | ✅ **now closed** | The `privacy.profileInfo` scope ("Profile Discovery — who can view your profile info") was settable in `EditProfileScreen` and `SettingsScreen` and validated by `sanitizeProfile`, but the capability engine never resolved it (`canViewIdentity` was hardcoded `true`) and `AboutScreen` rendered bio/location/website/links straight from the raw profile with **no projection at all**. Now `resolveCapabilities` derives `canViewIdentity` from the `profileInfo` scope (never tied to `canViewContent`, owner always allowed), `projectProfileForViewer` masks the descriptive identity card (`IDENTITY_INFO_FIELDS`) once, and `AboutScreen` renders the projected profile. `displayName`/`username`/`photoURL` stay visible so the follow/block affordance still works. Guarded by `profileReadModel.test.js` + `userServicePrivacyProjection.test.js` (real fake-Firestore path: public default, CONNECTIONS denial, owner-only bypass). |
| N036 GPS coordinates leaked to the world-readable `users/{uid}` doc | ✅ **now closed** | `ProfileLocationModal` wrote full-precision `navigator.geolocation` coords into `users/{uid}` (readable by any signed-in user) and `locationPrivacy: 'hidden'` only blanked the human-readable `location` string — the exact coordinates survived, so "Keep Hidden" leaked the user's home location. `country_only` also still carried the city. Fixed at the contract boundary: `validateProfileUpdate` rounds `locationCoordinates` to 2 decimals (~1 km) and `applyLocationPrivacy` blanks `location` + clears the coordinates for `hidden`, and keeps only the country for `country_only`; `userService.updateUserProfile` turns a null coordinate into a `deleteField()`; the modal persists coords only for `public` and actively clears them otherwise; `locationPrivacy` now round-trips through `EditProfileScreen`/`ProfileMyScreen` and re-seeds the modal. Guarded by `profileSystemHardening.test.js`. |
| N037 presence privacy bypassed by the raw `isOnline` field | ✅ **now closed** | `projectProfileForViewer` masked the `presence` object when `canViewPresence` was false, but spread `...profile` left the raw `isOnline`/`lastActive` fields intact — and `ProfileHeroSection` reads `profile?.isOnline === true`. So the `presence` scope (default `FOLLOWERS`) never hid the online dot from a public viewer. The projection now masks `isOnline` and `lastActive` alongside `presence`. Guarded by `profileReadModel.test.js`. |
| N038 `creatorInfo` was a dead privacy control | ✅ **now closed** | The `privacy.creatorInfo` scope was in `DEFAULT_PROFILE_PRIVACY` and settable from neither editor, and the creator-suite fields it was meant to gate (`creatorCategory`, `inquiriesEmail`, `tipMessage`) were validated and persisted but **rendered nowhere** — so a creator's business contact sat world-readable in `users/{uid}` with no control over it. Now `resolveCapabilities` derives `canViewCreatorInfo` from the scope (standalone, like `profileInfo`; owner always allowed), `projectProfileForViewer` masks `CREATOR_INFO_FIELDS` once, `AboutScreen` renders a Creator Suite card, and both `EditProfileScreen` and `SettingsScreen` expose the scope. Guarded by `profileReadModel.test.js` (masking + engine + end-to-end wiring) + `profileCapabilityEngine.test.js`. |
| N039 economic fields bypassed the projection spread | ✅ **now closed** | `projectProfileForViewer` masked `coins` when `canViewEconomicStatus` was false, but the `...profile` spread left `coinBalance`/`balance`/`earnings`/`totalEarned`/`lifetimeEarnings`/`withdrawableBalance` on the projected object. A viewer denied economic status still read the creator's income. The projection now nulls every `ECONOMIC_FIELDS` entry. Guarded by `profileReadModel.test.js`. |
| passportService bypassed the capability projection | ✅ **now closed** | `passportService.getPassport` read `users/{uid}` directly and rendered raw fields, resolving capabilities only to attach them to the result — a second authorization path beside `userService.getUserProfile`. It now reads through `getUserService().getUserProfile(target, viewer)` and applies `projectProfileForViewer` once; `creatorTier` is additionally gated on `canViewCreatorInfo`. Guarded by `profileReadModel.test.js`.
| N040 `activity` scope hid no standing | ✅ **now closed** | `canViewActivity` was resolved by the engine and exposed on the projection, but applied to nothing: level, XP, streak, reputation, achievements and titles rendered for every viewer regardless of the "Civic Standing & Badges" scope (default `EVERYONE`, so a user who narrowed it to `ONLY_ME` still showed their whole standing). `projectProfileForViewer` now masks `STANDING_FIELDS` (arrays become `[]`, scalars `null` so the surface shows an honest unavailable state), and `passportService` reads its standing off the projection instead of the raw doc. Guarded by `profileReadModel.test.js`. |
| N041 profile surfaces read standing around the projection | ✅ **now closed** | The standing gate added for N040 was still bypassed at the surface: `ProfileMyScreen` passed the raw store `level` to the hero (`level || effectiveProfile.level`) so the visitor perspective showed the real level, and `ProfilePublicScreen` hardcoded `experience \|\| 0` / `activeStreak ?? 0`, converting a masked `null` back into a real-looking `0`. Both screens now pass the projected values through un-defaulted (`displayedProfile?.level`, `effectiveProfile?.experience`), so a denied viewer gets the honest unavailable state. Guarded by `profileReadModel.test.js`. |
| N042 the store read the wrong mutual-friends key | ✅ **now closed** | `userService.getMutualFriends` resolves `{ success, mutualFriends }`, but `profileStore.loadProfile` and `loadMutualFriends` read `mutualResult?.users` / `result?.users`, which is always `undefined`, so the mutual-friends slice was `[]` on every profile and the social-context bar never rendered a mutual. Both reads now use `mutualFriends`. Guarded by `profileReadModel.test.js`. |
| N043 AboutScreen + ProfilePreviewScreen read standing around the projection | ✅ **now closed** | The same bypass as N041 in two more surfaces. `AboutScreen` computed `hasStanding`, `rankTitle` and `perks` from the raw `effectiveProfile`, so the "Citizen Standing & Privileges" card rendered the real rank/level/perks for a viewer denied the `activity` scope; `ProfilePreviewScreen` handed the hero `effectiveProfile?.level` and the feed grid the un-projected profile, so Visitor View showed the owner's real standing. Both now read `displayedProfile` / `projectedProfile`. Dead `levelInfo`/`loading` bindings removed. Guarded by `profileReadModel.test.js`. |
| N044 profile hero fabricated a join date and read a never-written presence field | ✅ **now closed** | `formatJoinedDate` returned `'Joined May 2022'` for any missing/unparseable `createdAt`, so a profile with no join date advertised a plausible-but-false date (the exact fabrication class N005/N031 ban). It now returns `null` and the hero renders no date. The online dot read `profile.presence.state`, a field written nowhere (the read model and spine write `presence.status`), so it only ever lit via the raw `isOnline`; it now reads `presence.status`. Guarded by `noFabricatedData.test.js`. |
| N045 masked standing re-defaulted to a real-looking value at the surface | ✅ **now closed** | The same class as N041: `ProfileMyScreen` passed `streak={displayedProfile?.activeStreak ?? 0}` and `ProfileAbout` rendered `resolvedProfile.language \|\| 'English'`. Both turned an honest `null`/absent value into a plausible default, defeating the `activity`/`profileInfo` scope masking. Both now pass the projected value through un-defaulted. Guarded by `noFabricatedData.test.js`. |
| N046 ConnectionsScreen gated every list on `canViewFollowers` | ✅ **now closed** | The screen resolved capabilities but only checked `caps.canViewFollowers`, then fetched **all three** graphs regardless. A viewer the engine denied `followingList` (or `followersList`) still reached the other list through the shared screen, and the denied list was still read + hydrated (a real Firestore read for data the viewer may not see). Each tab now has its own gate (`canViewFollowers`/`canViewFollowing`/`canViewFriends`), only visible tabs render, the active tab is forced onto a visible one, and a denied list is not fetched at all. Guarded by `profileReadModel.test.js`. |
| N049 TitlesScreen fabricated the standing it evaluated against | ✅ **now closed** | The eligibility preview passed `reputationScore: … \|\| 50`, `contributionScore: … \|\| 25`, `influenceScore: … \|\| 20`, `level: … \|\| 1` — invented qualifying values. A brand-new account with no standing therefore saw locked royal titles as *claimable*, and the server call then rejected it ("Criteria not met"). The screen now forwards the real scores (null when absent), so the preview agrees with `titleService.checkEligibility` / `getRoyalEligibility`. Guarded by `noFabricatedData.test.js`. |
| N050 PassportScreen cached the Firebase auth user as the owner profile | ✅ **now closed** | `passportService.getPassport(target, viewer, cachedTargetProfile)` accepts a pre-loaded profile to skip a read, and `PassportScreen` passed the Firebase auth `user` (uid/email/photoURL only) when viewing your own passport. Every standing dimension (level, active days, reputation, influence, contribution) was therefore absent for the owner and rendered as unavailable, while a visitor viewing the same profile saw it correctly. It now passes the hydrated `userProfile` document. |
| N048 ProfileQuickEditModal reset the form on a whole-profile effect | ✅ **now closed** | The modal's prefill effect was keyed on `[isOpen, profile]`. AGENTS.md bans exactly that: a realtime snapshot swaps the profile object identity, the effect re-runs mid-edit, and the user's unsaved typing is discarded. Now keyed on `[isOpen, profileId]` (`profile.uid \|\| profile.id \|\| userId`). Guarded by `noFabricatedData.test.js`. |
| N047 profile surfaces restated level-gate thresholds as JSX literals | ✅ **now closed** | AGENTS.md bans re-declaring a gate threshold outside `src/shared/levelConfig.cjs` ("a literal like `LEVEL >= 10` in JSX is a bug"), but three surfaces did exactly that. `ProfileHeroSection` printed `Level 15 to Verify` and computed eligibility with a `?? 15` fallback; `ProfileVerificationModal` used `LEVEL_GATES?.verifiedPriority ?? 15`; `ProfileSystemRoadmapModal` restated the full-citizenship criteria as `currentLevel >= 5 && activeDays >= 7` and rendered `Level 5+` / `7 Active Days`. All three now read the threshold from the shared config (`LEVEL_GATES.verifiedPriority`, the `Citizen` row of `CITIZEN_TIERS`) and render the resolved value, so a curve change cannot make the UI advertise a gate the server enforces differently. Guarded by `noFabricatedData.test.js`. |
| Dead `/profile/:id/collections` link on the featured section | ✅ **now closed** | The "More Handpicked" card navigated to `/profile/:id/collections`, which has no route — it fell through to the 404 screen — and `collections` is owner-scoped in `firestore.rules` anyway. The card is now owner-only and links to the real `/collections` route. Guarded by `profileReadModel.test.js`. |
| §83 cost guards in CI | ✅ **now closed** | `firebaseCostGuard.test.js` freezes unbounded `getDocs`, `onSnapshot` and runtime dependency counts; hard-failing `guards` CI job (§5). |
| N051 callable auth-gate blind spot + 4 unauthenticated video callables | ✅ **now closed** | `callableAuthGate.test.js` matched only `exports.x = functions.https.onCall(`, so the 17 destructured `exports.x = onCall(` callables in `functions/video.js` were never inspected. Four were unauthenticated: `watermarkVideo`/`moderateVideo` let any signed-in user re-run watermarking or Video Intelligence moderation on *anyone's* video (an availability + storage-billing lever) — now owner-or-admin; `generateAudioFingerprint`/`updateViralScore` were public callables writing arbitrary `videos/{id}` docs — now admin-only callables wrapping shared internals. The guard now matches both export shapes and pins the video.js coverage + gating. |
| N052 broken async pipelines: server code POSTs to callable endpoints | ✅ **now closed** | A callable is only reachable through the callable protocol (a JSON `data` envelope + ID token), so a plain HTTP POST is rejected. Two pipelines did exactly that and silently no-opped. (a) The Mux `video.asset.ready` webhook enqueued `generateAudioFingerprint`/`updateViralScore` as Cloud Tasks HTTP POSTs with no auth header — now calls the internals in-process (dead Cloud Tasks plumbing removed). (b) The story video-moderation worker verified a **Firebase ID token** while `enqueueModerationTask` attaches an **OIDC token**, so every task 403'd and no story video was ever moderated — now verifies the OIDC token (google-auth-library, audience + service-account pinned). Guards: no `functions/*.js` may fetch a `cloudfunctions.net/<callable>` path, and the worker must verify OIDC (`callableAuthGate.test.js`). |
| N053 service layer bypasses the canonical `callableService` | ✅ **now closed** | 11 services imported `httpsCallable` from `firebase/functions` directly (48 call sites) instead of `callableService.callFunction`/`FUNCTIONS`. Every service now routes through `callableService` (`callFunction` for direct calls, `makeCallable` for the legacy `{ data }`-shaped `this.cfX` helpers); the only remaining `firebase/functions` imports are `callableService.js` itself and `firebase.js` (the SDK wrapper). `architectureBoundaries.test.js` gained a hard-failing `guards`-job assertion that no `src/services/*.js` (other than `callableService.js`) may import `firebase/functions`, and `functionsContract.test.js` now resolves `FUNCTIONS.<CONST>` back to callable names so the deploy contract still sees every call. |

| N054 four XP rules were dead configuration | ✅ **now closed** | `XP_RULES` defined `ad_reward_claimed`, `civic_vote_cast`, `streak_milestone` and `live_minute` and the Progression UI advertised their XP, but **no code path ever awarded them**: only the `awardExperience` callable could grant XP, and the four server actions that should have credited XP (a rewarded-ad claim, a poll vote, an active-day streak milestone, a live-stream watch) never called it. XP is now awarded through a single server routine (`functions/xpAward.js#awardXp`, which `awardExperience` delegates to) invoked by `monetization.watchAd`, `polls.votePoll`, `levelSystem.recordActiveDay` (daily login + every 7th streak day) and `video.recordVideoView` (video_watched), with `live_minute` granted from `liveService.leaveLiveStream` on real watch minutes. Every award is idempotent by action+source and capped by the shared daily limits. `audio_track_created` remains intentionally unwired (no server publish path exists) and is listed as such. Guarded by `xpWiring.test.js` (hard-failing `guards` CI job). |
| N055 global feed reads silently dropped when a fallback lost its `where` binding | ✅ **now closed** | `feedService._getFallbackSimpleFeed` destructured the Firestore helpers from `this.firestoreMethods` but omitted `where` while the privacy filter added `where('authorIsPrivate', '==', false)` in the try **and** catch branches. The missing binding threw inside both branches, so the whole fallback feed returned `[]` (a silent empty feed) and `eslint no-undef` flagged it. The destructure now includes `where`. |
| N056 `like_received`/`follow_received`/`gift_received` credited the actor, not the recipient | ✅ **now closed** | `awardExperience` ignored the payload and always credited `context.auth.uid`, but three call sites passed `userId: <the other person>` (the post author on a like, the followed user on a follow, the gift recipient). So all three "received" XP rules paid the **actor** — the exact opposite of their name — and the recipient was never rewarded. Worse, a client could have credited any uid it named. Now the callable resolves a *received* action to the real beneficiary by **verifying the relationship server-side** (`like_received` requires the caller's own `posts/{id}/likes/{uid}` edge and credits the post author; `follow_received` requires the `follows/{follower}_{following}` edge and credits the followed user), keys the award on that edge so a repeat cannot re-pay, and returns a no-op when the edge is absent. Self-credit actions now **reject** a foreign `userId` (`permission-denied`). `gift_received` is credited only inside `sendGift` (the one path that can prove a gift), and the client-side award was removed. `awardExperience`'s payload `userId` is forwarded from `levelSystemService`. Guarded by `xpWiring.test.js`. |
| N057 Cross-Platform publishing was a dead prop plus a fake success | ✅ **now closed** | The Create-Post *Audience* tab rendered a `CrossPlatformPanel` that wrote a `crossPlatform` array into the draft and into the post payload, but nothing ever read it — a pure dead prop (Twitter/LinkedIn/YouTube/Instagram toggles that changed nothing). The only consumer-shaped code, `firestoreService.publishToPlatform`, was never called and was itself theatre: it slept 600 ms and returned `{ success: true, urls: ['https://twitter.com/arvdoul_post_<id>', …] }` for posts that were never cross-posted. Both are removed: the panel, the `crossPlatform` draft field/payload/reducer case, and the `CROSS_PLATFORMS` table are gone, and `publishToPlatform` now throws an honest "not available" error instead of fabricating a share. Guarded by `noFabricatedData.test.js`. |
| N058 `RedisCacheManager` survived the "removed ✅" ledger entry | ✅ **now closed** | §10 already recorded `RedisCacheManager` (stub part) as DEAD/removed, but the full 316-line L1/L2/L3 class was still on disk. It was "reachable" only because `settingsService.clearApplicationCache` did a dynamic `import('./RedisCacheManager.js')` and called the **inherited** `clear()` — no product path ever called `getOrFetchDistributed`/`setDistributed`/`invalidateDistributed`, the Redis REST calls (or the L3 IndexedDB tier) never ran, and the browser cannot reach Redis anyway. The class, its test block and the dead `clear()` call are removed; the real cache is `utils/CacheManager.js` (76 call sites). Guarded by `serviceReachability.test.js`. |
| N059 navigation badges read a store key nothing ever wrote | ✅ **now closed** | `BottomNav` (Chat + Alerts badges) and `MenuScreen` (DM/notification rows) read `useAppStore().unreadCounts`, a key that is not defined in `appStore`'s state creator and is written nowhere — so the badges were permanently 0 and the surfaces that *did* compute counts (`messagesService.getTotalUnreadCount`, `notificationsService.getNotificationStats`) were never consumed. A new `useNavBadges` hook reads the real sharded counters (message unread totals, `notification_counters`, pending `friend_requests`) and refreshes on window focus, tab visibility, and `arvdoul:messages-read` / `arvdoul:notification-read` / `arvdoul:friend-request-changed` events emitted by the mark-read and friend-request mutations. `storeContract.test.js` (new, in the hard-failing `guards` job) imports every Zustand store and fails if any `src` file reads a selector/destructure/getState key the store does not expose — it also caught a dead `updateCurrentUser` destructure in `VideoGiftModal` (now `updateUserProfile`). |

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
9. **Bound every unbounded Firestore read** (N034): hand-audited each `getDocs` in `src/services`; the genuine full-collection scans (feedService fallback branches, commentService default/unbounded fallback, community/event/live/collaboration/achievement/title/wallet/firestoreService per-user lists) now carry a hard ceiling; the cost baseline only shrank — **done ✅** (§5 audit note, `firebaseCostGuard.test.js`).
10. **Consolidate duplicate profile reads**: `reputationService` read `users/{uid}` a second time and carried its own score-clamp copy; it now reads through `userService.getUserProfile` and uses the canonical `profileReadModel.readStandingScore` (same helper `passportService` now shares) — **done ✅** (`profileReadModel.test.js`).
11. **Make every privacy scope real**: `profileInfo` was a dead control (settable, never enforced, and `AboutScreen` rendered the card with no projection). `resolveCapabilities` now derives `canViewIdentity`, the projection masks the identity card, and `AboutScreen` consumes it — **done ✅** (N035; `profileReadModel.test.js`, `userServicePrivacyProjection.test.js`).
12. **Stop the location leak**: full-precision GPS coordinates were written to the world-readable `users/{uid}` document and `locationPrivacy: 'hidden'` only blanked the display string. The contract now rounds coordinates (~1 km), clears them for `hidden`/`country_only`, and keeps only the country for `country_only` — **done ✅** (N036; `profileSystemHardening.test.js`).
13. **Make the `creatorInfo` scope real** (N038): the creator-suite fields were writable but rendered nowhere, so the business contact was world-readable with no control. `resolveCapabilities` now derives `canViewCreatorInfo`, the projection masks `CREATOR_INFO_FIELDS`, `AboutScreen` renders the suite, and both editors expose the scope — **done ✅** (`profileReadModel.test.js`, `profileCapabilityEngine.test.js`).
14. **Gate every money field, not just `coins`** (N039): the projection spread left `earnings`/`totalEarned`/`coinBalance`/… on the object when economic status was denied. All `ECONOMIC_FIELDS` are now nulled — **done ✅** (`profileReadModel.test.js`).
15. **Collapse the passport onto the canonical read path**: `passportService` read `users/{uid}` directly and applied capabilities only as decoration. It now reads through `userService.getUserProfile` and applies `projectProfileForViewer` once — **done ✅** (`profileReadModel.test.js`).

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
