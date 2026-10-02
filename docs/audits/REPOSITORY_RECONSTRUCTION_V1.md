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
| test files | 71 | 71 suites / 1114 tests, all green (was 883 before this branch) |
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

### 2.2 Client services — 57 of 106 have no non-test importer
Measured by searching all of `src/**` (excluding `__tests__`) for each service stem. The list includes several categories:

**(a) Security theatre — DEAD / FALSE SECURITY (removed ✅):**
`WAFService`, `CSRFService`, `DDoSProtectionService`, `sessionSecurityService`.

**(b) Security theatre (removed ✅):** `challengeService` (client proof-of-work; the real bot control is Firebase App Check), `CSPService` (runtime CSP builder never applied — see §7), `SecureHeadersService` (header map never sent; real headers are in `firebase.json`), `botProtectionService` (client mouse/keystroke entropy scoring that the attacker's own automation controls), `userIntegrityService` (client-computed trust/strike/sybil decisions with no server enforcement).

**(b2) Security-adjacent, still present (open ⬜):** imported only by their own tests, never wired into any request path:
- `sanitizationService` (React escapes output; no `dangerouslySetInnerHTML` consumer)
- `apiSecurityGatewayService` (client-stored API keys, incl. a localStorage fallback)
- `searchAbuseService`, `fraudDetectionService`
- plus domain-specific detectors: `childSafetyService`, `copyrightDetectionService`, `extremismDetectionService`, `selfHarmDetectionService`, `phishingDetectionService`, `scamDetectionService`, `misinformationService`, `manipulatedMediaService`, `contentProvenanceService`, `audioModerationService`, `videoModerationService`, `liveModerationService`, `safeSearchService`, `searchIndexingService`.

These are **not all equivalent** and must be classified individually before deletion (see §9). The ones that are pure security claims with no client role are theatre; the content detectors may have a legitimate future server-side home.

**(c) Infrastructure services that look aspirational:** `decentralized*`, `activityPubMeshService`, `multiRegionMeshService`, `verifiableCredentialsService`, `immutableAuditLedgerService`, `chaosDefenseService`, `activeActiveService`, `disasterRecoveryService`, `spacesOrchestrator`, `recommendationEngine`, `predictiveAnalyticsService`, `watchPartyService`, `TTLOptimizationService`, `CacheInvalidationService`, `AggregationCacheService`, `logAggregationService`, `tracingService`, `observabilityService`, `incidentService`, `costOptimizationService`, `revenueSplitsService`, `digitalEscrowService`, `complianceGovernanceService`, `communityGovernanceService`, `decentralizedBountyMarketService`, `decentralizedModerationJuryService`, `decentralizedStorageMeshService`, `decentralizedTokenBondingCurveService`, `liveInteractiveGamificationService`, `aiCoPilotDirectorService`, `samlService`, `vendorManagementService`, `viralPredictionService`, `fieldEncryptionService`.

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
| Profile read model | ✅ canonical | `src/services/profileReadModel.js` owns placeholder/name/handle/avatar/count/level/creator-flag derivation and the single `projectProfileForViewer` masking; `ProfilePublicScreen`, `ProfilePreviewScreen`, `ProfileMyScreen`, `passportService` consume it (AUDIT V3 A-3/N018). Guarded by `profileReadModel.test.js`. |
| Relationship/capability | ✅ canonical | `profileCapabilityEngine.resolveCapabilities` decides once; screens project via `projectProfileForViewer` and no longer re-derive privacy (N007/N017/N018). |

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
| N007/N017/N018 capability divergence | ✅ **now closed** | `profileReadModel.projectProfileForViewer` applies the capability decision once; screens/passport no longer re-derive privacy or hardcode the creator gate. Guarded by `profileReadModel.test.js`. |
| V2-01 monetization pagination | ✅ **now closed** | `getTransactionHistory(userId, limit, cursor)` and `getCoinLeaderboard(limit, cursor)` return `{ items, nextCursor }` with real `createdAt <` / `coins <` cursor clauses; `CoinsScreen` has a working *Load more*; the two other history consumers unwrap `.items`. Contract test: `monetizationPagination.test.js` (7 tests). |
| N011 PII boundary | ✅ mostly | `users_private` exists and is written by the owner |
| §11 shadow-system classification | 🟨 mostly done | 11 removed (WAF/CSRF/DDoS/session + CSP/headers/PoW + botProtection/userIntegrity + apiSecurityGateway/searchAbuse); all remaining client-side infra-control services classified (§10.1). WRONG-TIER detectors await a server home. |
| §83 cost guards in CI | ✅ **now closed** | `firebaseCostGuard.test.js` freezes unbounded `getDocs`, `onSnapshot` and runtime dependency counts; hard-failing `guards` CI job (§5). |

---

## 9. Next actions (ordered)

1. **Classify the remaining security-adjacent services** (§2.2b) as REAL CLIENT / UX-ONLY / FALSE SECURITY / DUPLICATE / DEAD, and remove the theatre with guards — **done ✅** (§10, §10.1).
2. **Consolidate the profile read model** (N018): make screens/passport consume the capability object only; never recompute privacy — **done ✅** (`src/services/profileReadModel.js` owns the derivation and the single `projectProfileForViewer` masking; the four surfaces consume it; `profileReadModel.test.js` freezes it).
3. **CI cost guard** (§83): fail on new `onSnapshot`/`getDocs` without `limit`, on new realtime listeners, and on new runtime dependencies — **done ✅** (§5, `firebaseCostGuard.test.js`, hard-failing `guards` CI job).
4. **Architecture guard** (§84): fail if `src/screens/**` or `src/components/**` import `firebase/firestore` directly, or if a lower layer imports UI — **done ✅**; all previous violations migrated through services and the allowlist is now empty.
5. **Reconcile the CSP** (§7.1): either apply the strict policy or delete `CSPService` and document the real policy — **done ✅** (`CSPService` deleted; the real policy is the `index.html` meta CSP).
6. **Monetization pagination** (V2-01) — **done ✅** (`getTransactionHistory`/`getCoinLeaderboard` cursor pages + `CoinsScreen` *Load more*; `monetizationPagination.test.js`).
7. **Comment debt** (§52): forbidden "TODO integrate / production would / handled later" comment patterns and decorative emoji/change-history prefixes removed from production source — **done ✅** (one corrupted line at `storyService.js` repaired).

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
| `sanitizationService` | UX-ONLY (keep) | no `dangerouslySetInnerHTML` consumer; React escapes output; harmless defense-in-depth |
| `fieldEncryptionService` | DEAD (decision pending) | real WebCrypto, but no caller; key lifecycle is undefined; never wire client-held PII keys — PII belongs in `users_private` server-side |
| `apiSecurityGatewayService` | FALSE SECURITY (removed ✅) | client-generated, client-stored API keys that the same client validates; a client cannot be the authority over its own key. Server-side issuance required. Dead `api_keys` rule removed. |
| `searchAbuseService` | FALSE SECURITY (removed ✅) | client rate limiting + client "CAPTCHA" on search; an attacker skips the client. Server `rateLimit` owns this. |
| `fraudDetectionService` | REAL-INTENT, WRONG TIER (open ⬜) | detection logic is genuine but must run server-side with server-held signals |
| `manipulatedMediaService` | REAL-INTENT, WRONG TIER (open ⬜) | detector belongs on upload (server), not in the viewer's browser |

"WRONG TIER" services are not deleted: their algorithms are real and should be
moved behind a Cloud Function, then the client copy removed.

### 10.1 Remaining client-side infra-control services (inert, no non-test caller)

These are not referenced by any screen, component or service; they are
imported only by their own tests. None is a real client control:

| Service | Classification | Evidence |
|---|---|---|
| `textModerationService`, `imageModerationService`, `videoModerationService`, `audioModerationService`, `liveModerationService` | REAL-INTENT, WRONG TIER | detectors run in the browser and are unenforced; the enforced path is `functions/moderation.js` `moderatePost` + `reportContent` |
| `childSafetyService`, `copyrightDetectionService`, `extremismDetectionService`, `selfHarmDetectionService`, `scamDetectionService`, `phishingDetectionService`, `misinformationService`, `safeSearchService`, `searchIndexingService` | REAL-INTENT, WRONG TIER | classification belongs on the server; a client can bypass its own detector |
| `multiRegionMeshService`, `activeActiveService`, `chaosDefenseService`, `disasterRecoveryService`, `multiRegionMeshService` | DEAD | client-side failover/chaos simulation cannot route real infrastructure; Google Cloud owns regional failover |
| `immutableAuditLedgerService`, `verifiableCredentialsService` | DEAD | client-computed hash chain / credential signature is not tamper-evident against the client that computes it |
| `observabilityService`, `alertingService`, `tracingService`, `logAggregationService`, `incidentService`, `costMonitoringService`, `costOptimizationService` | DEAD / UX-ONLY | operate only in the browser (client timers/localStorage); real telemetry is Cloud Logging + Cloud Monitoring |
| `AggregationCacheService`, `CacheInvalidationService`, `RedisCacheManager`, `TTLOptimizationService`, `ServiceKit` | DEAD | in-memory client caches with no caller; Redis is not reachable from the browser |
| `digitalEscrowService`, `revenueSplitsService`, `decentralized*Service`, `activityPubMeshService`, `watchPartyService`, `spacesOrchestrator`, `liveInteractiveGamificationService`, `communityGovernanceService`, `contentProvenanceService`, `recommendationEngine`, `predictiveAnalyticsService`, `viralPredictionService`, `aiCoPilotDirectorService`, `realIntegration` | DEAD | no caller; logic depends on data the client does not hold |
| `samlService` | DEAD / WRONG TIER | SAML assertion validation is an IdP/server concern; Firebase Auth federated providers own it |
| `validationService` | UX-ONLY | duplicates `profileContracts` / `firestore.rules`; never a substitute for rules |
| `sanitizationService` | UX-ONLY (keep) | defense-in-depth; React escapes output |
| `fieldEncryptionService` | DEAD | real WebCrypto, no caller, undefined key lifecycle; PII keys must be server-side (`users_private`) |

Removal policy: FALSE SECURITY is deleted with a guard
(`src/__tests__/securityServices.test.js`). DEAD services may be deleted once no
test depends on them; WRONG TIER services move behind a Cloud Function before
the client copy is removed.

## 11. Verification commands

```
NODE_OPTIONS=--experimental-vm-modules npm test        # 71 suites / 1114 tests, green
npm run build                                          # vite build succeeds (307 chunks, 8.8 MB dist, 3.9 s)
npm run lint                                           # 0 errors (warnings expected)
node scripts/sync-shared-config.mjs                    # shared config copy in sync
node -e "require('./scripts/firebaseCostAnalyzer.cjs')"  # cost snapshot (see §5)
```

### 11.1 §58 performance evidence (measured, not claimed)

Measured on this branch with `vite build`:

| Signal | Value |
|---|---|
| Production chunks | 307 JS files, 6160 KB raw JS total |
| Largest chunks | `index` 591 KB (183 KB gzip), `index.esm` 558 KB (165 KB gzip), `ImageEditor` 443 KB (129 KB gzip), `ChatScreen` 359 KB |
| `dist/` total | 8.8 MB |
| Build time | 3.93 s |
| Client listeners | 31 sites / 15 files (frozen) |
| Unbounded `getDocs` | 119 sites / 22 files (frozen) |

Vite flagged three `INEFFECTIVE_DYNAMIC_IMPORT` warnings where a module is both
statically and dynamically imported (`src/i18n/index.js`, `src/utils/OfflineQueue.js`,
`src/services/levelSystemService.js`). The dynamic import in those cases does not
create a separate chunk — the module is already in the entry graph. This is a
known, harmless pattern (the dynamic call sites are for code paths that must not
await at module-eval time); it is recorded here rather than asserted as an
optimisation, because no measurement shows it costs anything.
