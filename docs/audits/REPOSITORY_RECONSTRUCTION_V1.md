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
| `src/screens/**` | 136 files | includes non-Profile screens |
| `src/components/**` | 82 files | |
| `src/services/**` | 106 files | 57 have **no** non-test importer (§3) |
| `src/store/**` | 6 files | profileStore is the largest |
| `src/hooks/**` | 9 files | |
| `src/utils/**` | 26 files | |
| `src/config/**` | 1 file | `profileContracts.js` |
| `src/context/**` | 3 files | |
| `functions/*.js` | 24 modules | 152 deployable exports after the deploy fix |
| `src/__tests__/*.test.js(x)` | 62 suites | 890 tests, all green |
| routes | 147 `path=` entries | 22 are `/profile/*` |
| `firestore.rules` | 1196 lines | |
| `storage.rules` | 108 lines | |
| `firestore.indexes.json` | 120 composite indexes | |
| client `onSnapshot` sites | 30 across 19 files | cost surface (§5) |

---

## 2. Reachability

### 2.1 Cloud Functions (server)
✅ **Fixed.** `functions/index.js` previously `require`d 19 feature modules without merging their exports, so only the 11 inline functions would have deployed. It now merges every module's deployable exports (152 total). Guarded by `src/__tests__/deployIntegrity.test.js`, which loads the real entry point and asserts that every client-invoked callable is exported and that no `functions/*.js` requires an undeclared package.

### 2.2 Client services — 57 of 106 have no non-test importer
Measured by searching all of `src/**` (excluding `__tests__`) for each service stem. The list includes several categories:

**(a) Security theatre — DEAD / FALSE SECURITY (removed ✅):**
`WAFService`, `CSRFService`, `DDoSProtectionService`, `sessionSecurityService`.

**(b) Security theatre (removed ✅):** `challengeService` (client proof-of-work; the real bot control is Firebase App Check), `CSPService` (runtime CSP builder never applied — see §7), `SecureHeadersService` (header map never sent; real headers are in `firebase.json`).

**(b2) Security-adjacent, still present (open ⬜):** imported only by their own tests, never wired into any request path:
- `sanitizationService` (React escapes output; no `dangerouslySetInnerHTML` consumer)
- `apiSecurityGatewayService` (client-stored API keys, incl. a localStorage fallback)
- `botProtectionService`, `searchAbuseService`, `userIntegrityService`, `fraudDetectionService`
- plus domain-specific detectors: `childSafetyService`, `copyrightDetectionService`, `extremismDetectionService`, `selfHarmDetectionService`, `phishingDetectionService`, `scamDetectionService`, `misinformationService`, `manipulatedMediaService`, `contentProvenanceService`, `audioModerationService`, `videoModerationService`, `liveModerationService`, `safeSearchService`, `searchIndexingService`.

These are **not all equivalent** and must be classified individually before deletion (see §9). The ones that are pure security claims with no client role are theatre; the content detectors may have a legitimate future server-side home.

**(c) Infrastructure services that look aspirational:** `decentralized*`, `activityPubMeshService`, `multiRegionMeshService`, `verifiableCredentialsService`, `immutableAuditLedgerService`, `chaosDefenseService`, `activeActiveService`, `disasterRecoveryService`, `spacesOrchestrator`, `recommendationEngine`, `predictiveAnalyticsService`, `watchPartyService`, `TTLOptimizationService`, `CacheInvalidationService`, `AggregationCacheService`, `logAggregationService`, `tracingService`, `observabilityService`, `incidentService`, `costOptimizationService`, `revenueSplitsService`, `digitalEscrowService`, `complianceGovernanceService`, `communityGovernanceService`, `decentralizedBountyMarketService`, `decentralizedModerationJuryService`, `decentralizedStorageMeshService`, `decentralizedTokenBondingCurveService`, `liveInteractiveGamificationService`, `aiCoPilotDirectorService`, `samlService`, `vendorManagementService`, `viralPredictionService`, `fieldEncryptionService`.

### 2.3 Architecture boundary violations (open ⬜)
Screens/components import Firestore directly instead of going through a service — a violation of the directive's "screens cannot import firebase directly" (10 files):
`CallScreen.jsx`, `CommentsDrawer.jsx`, `CreatePost.jsx`, `CreatePost/CreateImage.jsx`, `CreatePost/CreateLink.jsx`, `GiftScreen.jsx`, `Help/HelpCenterScreen.jsx`, `PostOptionsDrawer.jsx`, `SetupProfile.jsx`, `VideoDetailScreen.jsx`.
Frozen as an allowlist by `src/__tests__/architectureBoundaries.test.js` so no *new* violation can be introduced.

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
| Profile read model | ⬜ open | still re-derived in `ProfilePublicScreen`, `ProfilePreviewScreen`, `ProfileMyScreen`, `passportService` (AUDIT V3 A-3/N018) |
| Relationship/capability | ⬜ open | `profileCapabilityEngine` vs per-screen re-derivation (N007/N017/N018) |

---

## 4. Route matrix

147 routes. Profile group (22 entries) resolves to `ProfileMyScreen`, `ProfilePublicScreen`, `ProfilePreviewScreen`, `EditProfileScreen`, `AboutScreen`, `AnalyticsScreen`, `CreatorDashboardScreen`, `HighlightsScreen`, `Followers/Following/Friends/UserList`, plus redirects (`/profile/settings` → `/settings`; `/profile/progress|achievements|titles|passport|wallet` → top-level). Deep identity routes (`/passport/:userId`, `/reputation/:userId`) live outside the Profile group. Admin group has 12 routes. No duplicate or dead routes were found in the Profile group.

---

## 5. Firebase cost surface

| Surface | Measure | Risk |
|---|---|---|
| Client listeners | 30 `onSnapshot` sites in 19 files | **High** — heaviest: `spacesService` (5), `messagesService` (4), `liveService` (4), `communityService` (3) |
| Unbounded queries | 152 `getDocs(` sites in `src/services` | **High** — needs per-query `limit` audit |
| Duplicate profile reads | AuthContext + profileStore + walletService + passportService + screens | **Medium** — consolidation pending |
| `profile_views` / `profile_analytics` | ✅ server-write-only now (`firestore.rules:705-722`); client write denied | dedupe + sharded counters in `trackProfileView` |
| Client write fallback reads | ✅ client coin write fallback removed; no `tx.get` amplification on the money path | |

No automated guard currently fails CI on a new unbounded query or a new realtime listener. Recommended: a CI guard that flags new `onSnapshot`/`getDocs` without `limit` (directive §83).

---

## 6. Dependency graph

- **Root app:** React + Vite SPA, Firebase (Auth/Firestore/Storage/Functions/Messaging/App Check), Zustand + immer, sonner, i18n. Firebase initialised once in `src/firebase/`; `getFirestore`/`getAuth`/`getStorage` centralised so callers never see `undefined`.
- **Functions runtime:** declared deps now complete ✅ — `firebase-admin`, `firebase-functions`, `stripe`, `uuid`, `@google-cloud/tasks`, `@google-cloud/storage`, `@google-cloud/speech`, `@google-cloud/video-intelligence`, `@mux/mux-node`, `@sendgrid/mail`, `algoliasearch`, `node-fetch`. Guarded by `deployIntegrity.test.js` (any undeclared external `require` fails the test).
- **Shared config:** `src/shared/levelConfig.cjs` is the single hand-edited source; `scripts/sync-shared-config.mjs` copies it to `functions/levelConfig.cjs`; `sharedConfigSync.test.js` fails CI on drift.

---

## 7. Contradictions found (documentation / config vs code)

1. **CSP is contradictory.** `index.html:19` ships a permissive meta CSP (`script-src ... 'unsafe-inline' 'unsafe-eval'`), while `CSPService` (never applied) advertises a strict nonce-based CSP. The strict policy is not the one in force. **Open.**
2. **Security headers** are real in `firebase.json` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS is *not* present) but `SecureHeadersService` (never applied) advertises `Strict-Transport-Security`. Firebase Hosting sets HSTS by default, so this is cosmetic, but the service is dead code. **Open.**
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
| N007/N017/N018 capability divergence | ⬜ open | screens/passport still re-derive privacy/capabilities |
| N011 PII boundary | ✅ mostly | `users_private` exists and is written by the owner |
| V2-01 monetization pagination | ⬜ open | history/leaderboard cursor support unverified |
| §11 shadow-system classification | ⬜ partial | 7 removed (WAF/CSRF/DDoS/session + CSP/headers/PoW); ~12 security-adjacent services still unclassified (§2.2b) |
| §83 cost guards in CI | ⬜ open | no unbounded-query/listener guard |

---

## 9. Next actions (ordered)

1. **Classify the remaining security-adjacent services** (§2.2b) as REAL CLIENT / UX-ONLY / FALSE SECURITY / DUPLICATE / DEAD, and remove the theatre with guards (as done for the first four).
2. **Consolidate the profile read model** (N018): make screens/passport consume the capability object only; never recompute privacy.
3. **CI cost guard** (§83): fail on new `onSnapshot`/`getDocs` without `limit`, and on new realtime listeners.
4. **Architecture guard** (§84): fail if `src/screens/**` or `src/components/**` import `firebase/firestore` directly (5 current violations).
5. **Reconcile the CSP** (§7.1): either apply the strict policy or delete `CSPService` and document the real policy.
6. **Monetization pagination** (V2-01).

---

## 10. Verification commands

```
NODE_OPTIONS=--experimental-vm-modules npm test        # 67 suites / 890 tests, green
npm run build                                          # vite build succeeds
npm run lint                                           # 0 errors (warnings expected)
node scripts/sync-shared-config.mjs                    # shared config copy in sync
```
