# AGENTS.md

## Project
Arvdoul — Vite + React SPA with Firebase (Firestore/Auth/Storage), Cloud Functions, and Jest.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test` (requires `NODE_OPTIONS=--experimental-vm-modules`, already set in the script)

ESLint reports 0 errors. `react/jsx-uses-vars` is enabled, so JSX-used components are no
longer flagged; the remaining `no-unused-vars` warnings are genuine leftovers (mostly
`catch (e)` params and dead locals), not the old JSX false positives. Only treat errors
as failures.

## Single sources of truth
- **Settings**: `src/services/settingsService.js` owns persisted user settings
  (`DEFAULT_SETTINGS`, `mergeSettings` deep-merge, `updateSetting` with optimistic write +
  rollback, `subscribeToSettings` realtime sync, `clearApplicationCache`). Always go through
  this service — do not add parallel local-state settings. Every key here must be *read*
  somewhere; a toggle that only persists is theatre. `privacy.profilePrivate` and
  `notifications.spatialAudio` / `playback.streamQuality` were removed for exactly that
  reason (profile privacy belongs on the profile; there is no spatial-audio graph or
  bitrate ladder) — do not re-add them.
- **Settings UI**: `/settings` (`src/screens/SettingsScreen.jsx`) is the canonical settings
  screen. `/profile/settings` redirects there. Do not reintroduce a second settings screen.
- **Profile field constraints/validation**: `src/config/profileContracts.js`
  (`PROFILE_CONSTRAINTS`, `VISIBILITY_SCOPES`, `DEFAULT_PROFILE_PRIVACY`,
  `validateProfileUpdate`). Reuse these instead of hardcoding limits or duplicating validators.
- **Profile sharing**: `src/utils/shareUtils.js` (`shareProfile`, `getProfileUrl`,
  `getProfileHandle`, `copyToClipboard`). All share entry points must use it so links resolve
  consistently. Do not rebuild `${origin}/profile/${id}` by hand — use `getProfileUrl`.
- **Profile read model / capabilities**: `src/services/profileCapabilityEngine.js` decides
  access (`resolveCapabilities`); `src/services/profileReadModel.js` owns the derivation every
  profile surface needs — placeholder name/handle rejection (`pickHandle`, `pickDisplayName`,
  `deriveHandle`), avatar fallback (`resolveAvatarUrl`), count/level coercion
  (`resolveCount`, `resolveLevelValue`), the standing-score clamp (`readStandingScore`),
  creator/verified flags (`resolveCreatorFlag`,
  `resolveVerifiedFlag`) — and applies the capability decision exactly once
  (`projectProfileForViewer`). `ProfilePublicScreen`, `ProfilePreviewScreen`,
  `ProfileMyScreen` and `passportService` must consume these, never re-derive privacy with a
  `capabilities.canViewX ? … : null` ternary, hardcode `LEVEL_GATES.creatorProfile`, or
  re-implement the `user_`/`creator` placeholder filter. Every privacy scope the UI exposes
  must be resolved by `resolveCapabilities` and masked by the projection — a scope that is
  settable but never read (as `profileInfo` once was) is a dead control. `projectProfileForViewer`
  masks the descriptive identity card (`IDENTITY_INFO_FIELDS`: bio/location/website/… via
  `canViewIdentity`) and the account identity (`displayName`/`username`/`photoURL`) is never
  masked, so the follow/block affordance keeps working. `AboutScreen` renders the projected
  profile, not the raw one. `userService.getUserProfile` resolves
  only the relation flags and delegates the decision to the engine + projection — it must not
  call `canViewProfileSection` itself. `profileReadModel.test.js` and
  `userServicePrivacyProjection.test.js` fail CI if any surface regresses; both are in the
  hard-failing `guards` CI job.
- **Profile surfaces fail closed.** A profile component must treat an absent capability map
  as "denied", never `capabilities?.canViewX ?? true` / `?? isOwner` — a missing prop must not
  leak follower counts or economic status (`ProfileMetricsGrid` is the reference). A "view as
  public" preview must resolve the *real* relationship from `profileStore.followStatus`; it
  must never assert `isFollowing: true` to fake a viewer, which reports `canUnfollow` for a
  stranger and hides the Follow button. `EditProfileScreen` resolves creator standing through
  `resolveCreatorFlag`, not a raw `userLevel >= LEVEL_GATES.creatorProfile` check.
  `ProfileHeader.jsx` / `ProfileStats.jsx` / `ProfileCivicCard.jsx` were removed as dead
  (superseded by `ProfileHeroSection`); do not resurrect them.
- **Friendship**: `userService.areFriends(a, b)` is canonical. `_areMutualFriends` only
  delegates to it; treat both names as one implementation, never fork the logic.
- **Social graph**: `src/services/socialGraphService.js` is the single source for
  relationship resolution and graph lists. Use `getRelationship` (one pair), `getEdgeSet`
  (batch; it chunks `documentId() in` to 30 and never scans the viewer's whole graph),
  `listEdges`/`listConnections` (bounded, index-backed, cursor-paged) or `hydrateProfiles`
  (batched `users` reads — never one `getUserProfile` per follower). Never write a new
  `getDocs` that scans `follows`/`blocks`/`mutes`/`restricts` or the viewer's graph. A
  single existence check may still be a direct point read (`userService.getFollowStatus`,
  `isBlocked`, `isMuted`, `isRestricted`) — that is one read, not a scan. `userService`
  delegates every graph *list*/batch method to the spine and `getUserProfile` resolves its
  relation through it. Every graph mutation funnels through `_invalidateUserCache`, which
  calls `socialGraphService.invalidate` — do not add a mutation that skips it.
  Blocks/mutes/restricts are party-readable only (`firestore.rules`); a world-readable
  safety collection is an enumeration leak.
- **Account deletion**: `userService.deleteAccount(uid)` schedules deletion locally and calls
  the `deleteUserData` cloud function. The cloud function name and the client method name are
  intentionally different — do not rename one to match the other.
- **Firestore rules must cover every collection the client reads/writes.** Notably
  `previous_usernames` (old username -> userId) is read when resolving share/QR links, so it
  needs an explicit `match` block; a missing block silently denies those reads.
- **Graph edge reads must be the shape the rules can prove.** `blocks`/`mutes`/
  `restricts` authorise on `resource.data.<actorField> == uid()`; Firestore rules are
  not filters. A `documentId() in [...]` list read cannot prove that condition, and a
  point read of a *missing* edge (`resource == null`) makes `resource.data.<field>`
  throw, so the read is denied. Never list-read these collections by id, and never
  point-read a possibly-absent safety edge — a denied `get` fails open to "not
  blocked". Answer "is there an edge?" with an actor-equality + other-party `in` list
  read (empty result = no edge). Use `socialGraphService.getEdgeSet`/
  `getRelationship`; if you add a collection read, use that shape, add the composite
  index, and cover it in `socialGraphEdgeReadRules.test.js`. Do not "fix" this by
  allowing `get` on a null `resource` in the rules — that turns a point read into an
  edge-existence oracle for arbitrary pairs.
- **Avatar field**: `photoURL` is the only stored avatar field on `users/{uid}`.
  `profilePicture` is accepted as an input alias by `validateProfileUpdate` and folded onto
  `photoURL` — never write `profilePicture` to Firestore.
- **Admin grant**: `admins/{uid}` is the canonical admin grant, checked by both
  `firestore.rules` `isAdmin()` and `functions/auth.js`. The collection is not
  client-readable. Use `callableService.fetchAdminStatus()` to learn your own status.
- **Cloud Function auth/admin helpers**: `functions/auth.js` is the single definition
  (`getUserIdFromContext`, `isAdmin`, `checkIsAdmin`, `assertAdmin`). Do not re-declare
  `isAdmin` in a module — a divergent check means an account can be admin for one endpoint
  and not another.
- **Design system / brand gradient**: `src/design-system/tokens.js` (+ `tokens.css`,
  `tokens.json`) is the single source of truth for the brand. Import `BRAND_GRADIENT`
  (or read the `--arv-*` CSS vars) — never re-declare the gradient literal or the
  `#8B1EF3`/`#4431F7`/`#055BFB`/`#0088FF` hexes. The old divergent family
  (`#B416DB`/`#872FE2`/`#4B6BFF`/`#0EA3E6`) is banned **in hex and `rgba()`
  decimal form** (`rgba(180,22,219)` etc.), as is the legacy BlueViolet violet
  `rgba(138,43,226)` and the rogue `from-purple-600 via-pink-600 to-cyan-500`
  gradient; `designTokenDriftGuard.test.js` (hard-failing `guards` job) fails if
  any reappears, if a non-design-system module re-declares the canonical literal,
  if the `ThemeProvider` palettes (`src/context/themePalettes.js`) stop deriving
  from the tokens, or if `tokens.js`/`tokens.css`/`tokens.json` drift.
  Signup/login/onboarding keep their own 125deg/52% geometry by policy.
- **Feature flags**: `src/shared/featureFlagRegistry.cjs` is the canonical flag
  list (synced to `functions/featureFlagRegistry.cjs`, guarded by
  `sharedConfigSync.test.js`). Platform-wide overrides live in Firestore
  `feature_flags/{flag}` and are written ONLY by the admin-gated
  `setFeatureFlagOverride` callable (`functions/featureFlags.js`), which
  validates the name against the registry and audits to `moderation_logs`.
  `featureFlagService.setOverride()` is a device-local lever, not governance —
  never present it as an audit record.
  A flag that no surface reads is a false feature claim, not a flag:
  `featureFlagConsumption.test.js` (hard-failing `guards` job) fails if a
  registered flag has no `isEnabled` / `isFlagEnabled` / `useFeatureFlag` /
  `<FeatureGate flag>` consumer. Read flags through `src/hooks/useFeatureFlag.js`
  (reactive) or `src/components/Shared/FeatureGate.jsx`; the server reads through
  `functions/featureFlags.js#isFlagEnabled` (override > registry default,
  fail-closed). Only register a flag alongside the real code it gates — do not
  add a flag for a feature that does not exist yet.
- **Calls**: `src/services/callService.js` is the canonical call implementation
  (Firestore `calls/{id}` signaling, `participants` array, `CallScreen`).
  `messagesService` must not re-implement `startCall`/`acceptCall`/`endCall`;
  the `/call/:conversationId` route takes a **conversationId**, not a uid — a
  caller with only a uid must resolve the direct conversation first.
- **Audit trail**: `functions/admin.js#writeAudit` appends to `moderation_logs`
  (admin-readable, server-write-only). `AdminAuditLogsScreen` reads that
  collection. `src/utils/AuditLogger.js` is a local IndexedDB queue and is not
  a server-side audit trail.
- **Admin gate**: `admins/{uid}` is not client-readable, so admin screens must
  call `fetchAdminStatus()` rather than `getDoc(doc(firestore, 'admins', uid))`
  (which always denies and silently shows the "no access" state).
- **Callables from the client**: go through `src/services/callableService.js`
  (`callFunction`, `FUNCTIONS`) rather than inlining `httpsCallable(getFunctions(), ...)`,
  so app binding and error normalisation stay consistent.
- **Callables are only reachable through the callable protocol.** A server-side
  `fetch`/Cloud Tasks POST to `cloudfunctions.net/<callable>` is rejected (a
  callable needs the JSON `data` envelope and an ID token), so such a pipeline
  silently no-ops. Server code must call the shared internal function in-process.
  `callableAuthGate.test.js` fails if any `functions/*.js` references a
  `cloudfunctions.net/<callable>` path, and if any callable (either export shape —
  `functions.https.onCall(` or destructured `onCall(`) lacks an auth check. When a
  Cloud Task calls an `onRequest` worker, verify the token the queue actually
  mints: an `oidcToken` is an OIDC token (`google-auth-library`), not a Firebase
  ID token.
- **Profile view analytics**: `functions/analytics.js` (`trackProfileView`) is the only
  writer of `profile_views` / `profile_analytics`; rules deny all client writes. Its
  shard key must stay byte-identical to `hashString()` in
  `src/utils/CountersManager.js` (the client sums `counter_shards` on read).

## Admin mutations are server-authoritative
An admin screen may read a collection directly only when the rules already grant
admins that read. Anything that *changes* state — or reads a collection that is
not admin-readable — goes through a callable in `functions/admin.js` that calls
`assertAdmin`, rate-limits, and writes `moderation_logs` via `writeAudit`:

- `adminListSupportTickets` / `adminResolveSupportTicket` — the support queue and
  agent replies (`support_tickets` is user-owned, so a client query cannot see
  every customer's ticket).
- `adminListModerationReports` — one server-side read over every collection in
  `REPORT_TARGETS`, so the queue cannot drift from the report routing table.
- `resolveUserReport` — report decisions (post/story/ad report types included).

Never add a second report collection without adding it to both
`functions/moderation.js` `REPORT_TARGETS` and `functions/admin.js`
`REPORT_COLLECTIONS`, and never log an admin action with the client-side
`AuditLogger` (it writes to a local IndexedDB queue, not to the server trail).

## Audio Studio
`src/screens/AudioEditor/` is a real Web Audio editor: `audioEngine.js` owns the
graph (clip sources → track gain/pan → EQ biquads → master → analyser), and the
transport, meters, spectrum and EQ curve all read from it. The project starts
empty — it only has clips once a decoded source is passed in route state. Do not
seed demo tracks, animate meters with `Math.random`, or claim an export succeeded
before `MediaRecorder` produced a blob.

## Owner / admin bootstrap
`admins/{uid}` is server-write-only, so the first admin must be claimed:
1. Set `OWNER_EMAILS` (comma-separated) for the functions deployment and deploy functions.
2. Sign in as that owner with a verified email, open `/admin/access`, and press
   *Claim ownership* (calls `bootstrapOwner`).
3. From then on, use *Grant admin access* on the same screen
   (`grantAdmin` / `revokeAdmin` / `listAdmins`). The final admin cannot be revoked.

## Contract guards
`src/__tests__/userServiceContract.test.js` fails if any `src` file calls a `userService.*`
method that is not defined on the service. Run it after adding/renaming service methods.
`src/__tests__/serviceContract.test.js` generalises that guard to EVERY service singleton
under `src/services` (object-literal, `new Class()`, and `Object.assign` export shapes): it
fails if any `import`ed service's method is called but not defined. This catches the
recurring "dead service-method call" bug class (`commentService.addReaction`,
`messagingService.getConversationMessages`, `commentService.getCommentsByTarget`) where a
feature silently no-op'd because the method never existed. It is in the hard-failing
`guards` CI job. When adding a service method, make sure the call site name matches exactly;
when renaming, update every call site.

`src/__tests__/storeContract.test.js` is the Zustand analogue: it imports every store
(`appStore`, `profileStore`, `messagingStore`, `searchStore`, `videoStore`,
`analyticsStore`) and fails if any `src` file reads a key via a selector
(`useXStore((s) => s.key)`), a destructure (`const { key } = useXStore()`), or
`useXStore.getState().key` that the store's state creator does not expose. This is the
"dead store key" class (`appStore.unreadCounts` backed the BottomNav badges while
nothing ever wrote it; `updateCurrentUser` was destructured but never defined). Add a
real state field (or fix the call site) instead of reading an invented key. It is in the
hard-failing `guards` CI job.

Navigation badge counts come from `src/hooks/useNavBadges.js`, which reads the real
sharded counters (`messagesService.getTotalUnreadCount`, `notificationsService
.getNotificationStats`, `userService.getFriendRequests`). Do not reintroduce a store
slice for unread counts; the services that change a count emit
`arvdoul:messages-read` / `arvdoul:notification-read` / `arvdoul:friend-request-changed`
and the hook refreshes on those plus window focus/visibility.

`src/__tests__/contextContract.test.js` and `src/__tests__/hookContract.test.js`
extend the same dead-key discipline to `useTheme()` and to every `src/hooks/use*`
hook: they parse the provider's context value / the hook's returned object literal and
fail if any destructure reads a key that is not provided (`useAnalytics().trackEvent`
was `undefined` while only `track` was returned). A hook's telemetry must reach a real
sink (`metricsService`), never `console.log` dressed up as tracking.

`src/__tests__/deadEventGuard.test.js` fails if any `arvdoul:*` window event is
dispatched in `src`/`public` with no `addEventListener` anywhere — a dispatched event
with no listener is a silent no-op (`arvdoul:navigate` on a notification click and
`arvdoul:post_id_synced` on an optimistic-post id swap were both dead). Add the listener
in the same change that adds the dispatch.

`src/__tests__/orphanModuleGuard.test.js` walks the import graph from the real entry
point (`src/main.jsx`) and fails if any non-entry `src/**` module is unreachable. A
module nothing imports can drift and keep stale tests green (whole "phase N"
subsystems once sat on disk reachable only from their own test). Delete dead modules
and their tests instead of exempting them; the only allowlisted entry is the
hand-edited `src/design-system/tokens.js` registry, mirrored into `tokens.css`.

`src/__tests__/deadWiringGuard.test.js` is the N076 dead-wiring guard: it fails when a
component destructures a prop it never references, or when a module is imported by every
importer without ever being referenced (an import that keeps a module "reachable" for the
orphan guard while the UI never renders it — `GlassCard`/`GlassButton` in
`VideoAnalyticsScreen`, `PageLoader`, `RouteSkeletonShell`). It is conservative (a prop
is only flagged when the identifier appears nowhere after the destructure; an import only
when *all* importers ignore it), so it stays at zero false positives. Delete the dead
import/component; do not allowlist it.

## Conventions
- Profile privacy is stored on the user profile (`profile.isPrivate` plus
  `profile.privacy.*` scopes) — not in the settings document.
- Never reset a form from an effect keyed on the whole profile object; key on `uid` so
  in-progress edits are not discarded by realtime snapshots.
- **No client-side security theatre (§11).** A browser cannot be a WAF, a CSRF
  authority, a DDoS scrubber, an API-key issuer, or a rate limiter that an attacker
  must obey. Real controls are `firestore.rules`, `functions/rateLimit.js`, App Check,
  and Cloud Functions. `src/__tests__/securityServices.test.js` bans reintroducing the
  removed theatre services; classify any new client-side "infra-control" service as
  REAL CLIENT CONTROL / UX-ONLY / FALSE SECURITY before wiring it up. The ledger lives
  in `docs/audits/REPOSITORY_RECONSTRUCTION_V1.md` §10.

## Level system — single source of truth
The level curve, reward tables, XP rules, rank bands, unlock gates and royal
eligibility live in exactly ONE hand-edited file: `src/shared/levelConfig.cjs`
(CommonJS, zero deps, so Vite and the Node 22 function runtime can both load it).

- The client imports it via `src/services/levelSystemService.js` (ESM
  `import ... from '../shared/levelConfig.cjs'`) and re-exports everything, so
  existing `from '../services/levelSystemService'` imports keep working.
- Cloud Functions can only package the `functions/` directory, so
  `scripts/sync-shared-config.mjs` copies the canonical file to
  `functions/levelConfig.cjs`. `npm run sync:shared` runs it, the
  `functions` `predeploy` hook runs it on deploy, and
  `src/__tests__/sharedConfigSync.test.js` fails CI if the copy drifts.
- Never re-declare a level curve, level name, coin reward or gate threshold in a
  component or service. Read `LEVEL_GATES` / `getLevelInfo` / `getRankTitle`
  from the shared config. A literal like `LEVEL >= 10` in JSX is a bug.
- XP is awarded only through `functions/xpAward.js#awardXp` (the shared server
  routine) — `awardExperience` is a thin callable over it, and every XP rule in
  `XP_RULES` must have a real trigger: `story_created`/`post_shared` on the
  client, `civic_vote_cast` (`polls.js`), `ad_reward_claimed` (`monetization.js`
  `watchAd`), `daily_login`/`streak_milestone` (`levelSystem.js`
  `recordActiveDay`), `live_minute` (`liveService.leaveLiveStream`),
  `video_watched` (`video.js` `recordVideoView`), and `gift_sent`/`gift_received`
  (`monetization.js` `sendGift`). `src/__tests__/xpWiring.test.js` fails if a
  rule has no trigger. Never mutate `experience`/`level` inline in a function or
  credit a level-up reward outside `awardXp`.
- **XP is credited to a resolved beneficiary, never to a client-named uid.**
  `like_received`/`follow_received`/`gift_received` are *received* actions: the
  `awardExperience` callable re-verifies the real edge server-side
  (`posts/{id}/likes/{uid}` for a like, `follows/{follower}_{following}` for a
  follow) and credits the other party; it returns a no-op when the edge is
  absent. Self-credit actions reject a foreign `userId` with
  `permission-denied`. `gift_received` is credited **only** inside `sendGift`
  (the only path that can prove a gift) — do not re-add a client-side award.
  `xpWiring.test.js` guards this.
- The shared config also owns the economy constants: `COINS_PER_DOLLAR` and
  `MIN_WITHDRAWAL_COINS`. The wallet/payout screens read them and
  `functions/monetization.js` `requestWithdrawal` enforces
  `MIN_WITHDRAWAL_COINS` server-side — never hardcode a payout rate or minimum.
- `NEW_USER_DEFAULTS` is the only place the new-account economy/status values
  live (`coins`, `level`, `experience`, `reputation`, `isVerified`, ...).
  `userService.createUserProfile` seeds from it and `firestore.rules` pins the
  `users/{uid}` create to exactly those values, so a client cannot mint coins,
  XP, a level, verification or a role at signup. `sharedConfigSync.test.js`
  guards both the sync and the rules parity.
- `GIFT_CATALOG` / `GIFT_VALUES` own the virtual-gift types and prices. Every
  picker (`src/data/videoData.js` `VIRTUAL_GIFTS`, `GiftScreen`, `PostOptionsDrawer`,
  `liveService.GIFT_TYPES`, `monetizationService.GIFTS`) derives from them, and
  the server prices gifts from `GIFT_VALUES` (`functions/monetization.js`
  `DEFAULT_GIFT_TYPES`). A gift id or price literal anywhere else is a bug.
- `COIN_PACKAGES` / `COIN_PACKAGES_BY_ID`, `SUBSCRIPTION_TIERS` and
  `AD_REWARD_COINS` own store pricing, the monthly subscription grant and the
  rewarded-ad payout. `functions/monetization.js` (`purchaseCoins`,
  `createSubscription`), `functions/index.js` (`verifyPurchase`) and the store
  screens (`CoinsScreen`, `Economy/WalletScreen`) all read these tables. Never
  re-declare a package id, price or coin amount in a screen or a function.
- Coin -> USD is display-only: use `coinsToUsd` / `formatCoinsAsUsd` from the
  shared config. Dividing by `COINS_PER_DOLLAR` by hand (or deriving a
  `1 / COINS_PER_DOLLAR` rate) in a screen is a bug — it re-implements the
  rounding policy and drifts from the payout server.
- Rank bands, perks and royal eligibility follow the Profile System blueprint
  (sections 21-22 and 31-32); `getRoyalEligibility` requires every dimension, so
  level alone can never grant a royal title.

## Offline queue — one instance, one owner
`src/utils/OfflineQueue.js` exports the single `offlineQueue` singleton.
`src/offline/syncEngine.js` re-exports it; never construct a second
`OfflineQueue` (the in-memory fallback and drain state would diverge, so
service-layer ops could never drain). Every queued op carries an `ownerUid`;
enqueues without an explicit owner bind to the live session
(`window._arvdoul_auth`), drains are scoped with `syncQueue({ ownerUid })`, and
`purgeQueueForOwner(uid)` runs on sign-out/account switch.

## No fabricated standing
A missing `level`/`xp` renders as unavailable (null), never as `Level 1` /
`Citizen`. Do not add `|| 1` level defaults or `() => 'Citizen'` fallbacks in
profile components — `src/__tests__/noFabricatedData.test.js` guards this.

## No fabricated security claims
Do not render a "secure"/"encrypted" claim a feature cannot back. Messaging has
no key provisioning (`generateUserKeys`/`unlockPrivateKey` have no caller and no
server writes a `publicKey`), so the E2EE path never encrypts and the send gate
falls back to plaintext — no lock badge or "E2EE protected" label. Likewise
`feedService` offline-mode write stubs throw instead of resolving a fake
`{ id: 'dummy' }`. `noFabricatedData.test.js` guards both.

## Cloud Functions deploy path — merge, don't just require
Firebase publishes exactly what `functions/index.js` exports. `require('./x.js')`
runs a module but does NOT deploy its functions — every module's exports must be
merged (`merge(require('./x.js'))`). Requiring without merging once dropped ~130
of 141 functions (only the 11 defined inline deployed), so every callable the app
depends on returned "not found". `src/__tests__/deployIntegrity.test.js` loads the
real `index.js` and fails if any client-called callable is not exported, and if
any `functions/*.js` requires a package not declared in `functions/package.json`
(`firebase deploy` installs only declared deps, so an undeclared require aborts
the whole deploy). `auth.js` / `pushQueue.js` are helper-only (no triggers).

## firestore.rules must compile — no wildcards mixed with literals
A `match` path segment is either `{var}`, `{var=**}` or a literal. A segment that
mixes a wildcard with text (e.g. `messages_{year}_{month}`) makes the ENTIRE
ruleset fail to compile, so `firebase deploy` rejects it and the previous rules
stay live. Match the subcollection as one wildcard and validate the name instead
(`isMessageShardCollection`). `src/__tests__/firestoreRulesCompile.test.js`
guards this (syntax, plus emulator-backed adversarial checks when the emulator
runs).

## No client-side security theatre
A browser cannot be a WAF, a CSRF authority, a DDoS scrubbing layer, or an
impossible-travel engine. `WAFService`, `CSRFService`, `DDoSProtectionService`,
`sessionSecurityService`, `CSPService`, `SecureHeadersService`,
`challengeService`, `botProtectionService` and `userIntegrityService` were inert
(imported only by their own tests) and have been removed. Real controls: `firestore.rules` (authorization),
`functions/rateLimit.js` (per-user sharded server limits), Firebase App Check
(bot/abuse), the `index.html` meta CSP and the `firebase.json` headers.
`src/__tests__/securityServices.test.js` fails if any is reintroduced.

## UI reaches the backend only through services
Screens/components must not import `firebase/*` directly — direct SDK use
bypasses cache scoping, authorization helpers and error normalisation.
`src/__tests__/architectureBoundaries.test.js` enforces this with an allowlist
that is now **empty** (all offenders migrated): callables go through
`src/services/callableService.js` (`callFunction` + `FUNCTIONS`), post
mutations through `firestoreService`, and follows/mutes/profile through
`userService`. Do not re-add direct SDK imports in UI — add a service method
and a `FUNCTIONS` key instead. Never add an allowlist entry.

## One canonical path per module (no case-only duplicates)
Two sibling entries whose names differ only by case (`components/UI` vs
`components/ui`) collapse into one on macOS/Windows, so an import silently binds
to whichever copy the filesystem kept and the other becomes unreachable. Keep a
single canonical casing. `architectureBoundaries.test.js` fails if any two
sibling entries under `src` differ only by case.

## No dead service theatre
`src/services/**` must be reachable from an app entry point (`src/main.jsx` or
`functions/index.js`). A service that no screen/hook/service imports is not "ready
for later" — it is dead weight that makes the test count lie, because its own test
is the only thing that loads it. 54 such services (client-side chaos/failover
meshes, decentralized token curves, client audit ledgers, observability stacks,
saml validation, content detectors that belong on the server) and the ~238 tests
that validated them were removed. `src/__tests__/serviceReachability.test.js`
walks the import graph and fails CI if a service becomes unreachable; it runs in
the hard-failing `guards` job. If a service is dead, delete it and its test —
never add an exemption. If logic is real but must run server-side, put it in
`functions/` (where it is actually enforced) rather than leaving an inert client copy.
Reachability is not proof of use: a service whose *only* reachable call is an
inherited method (e.g. `RedisCacheManager`, whose single caller was the inherited
`clear()` from `CacheManager`) is still dead — its own methods have no caller and
its backend never runs. Delete the class, not just the caller.

## No dead props or fabricated successes
A control that collects a value nothing reads is a bug, not a feature: the Create-Post
`CrossPlatformPanel` wrote a `crossPlatform` array into the post payload that no reader
ever consumed, and `firestoreService.publishToPlatform` "confirmed" a cross-post by
sleeping 600 ms and returning invented `https://<platform>.com/...` URLs. If a capability
has no integrated provider, remove the control and throw an honest "not available" error
(or render an unavailable state) — never fabricate a success or a URL. Guarded by
`noFabricatedData.test.js`; the same rule as §11's "no fabricated standing".

## Reconstruction deliverable
`docs/audits/REPOSITORY_RECONSTRUCTION_V1.md` is the inventory/reachability/
duplication/cost/route/dependency reconstruction and the AUDIT V3 finding-status
ledger. Update it when a finding closes.

## Firebase cost is enforced in CI
A new unbounded Firestore read, a new realtime listener, or a new runtime
dependency is a billing change, not a detail. `scripts/firebaseCostAnalyzer.cjs`
measures unbounded `getDocs` (no `limit`, one local-variable hop resolved,
single-document reads ignored) and `onSnapshot` counts per file;
`scripts/firebaseCostBaseline.json` freezes them;
`src/__tests__/firebaseCostGuard.test.js` fails when a count or the runtime
dependency count exceeds the baseline. The baseline may only shrink — bound the
query, delete the listener, or drop the dependency and lower the number in the
same change. Do not raise a baseline to make a test pass.

## Architecture layering
Lower layers never import higher ones: `src/services|store|hooks|utils|context`
must not import `screens/components` (an upward import creates a cycle and drags
JSX into modules the Functions runtime or a service test loads). Enforced by
`architectureBoundaries.test.js`; the only documented exception is
`src/utils/routePrefetcher.js`, whose dynamic `../screens/*` imports are its job.

## CI enforcement jobs must fail, not advise
The `lint`/`test` jobs in `.github/workflows/ci.yml` use `continue-on-error: true`
(advisory). The `guards` job is deliberately hard-failing and runs the invariant
suites: architecture boundaries, Firebase cost, security-services, deploy
integrity, shared-config sync, Firestore rules compile, dead-event and
orphan-module reachability. Add new invariant suites to that job.

## Realtime listeners must handle errors
Every `onSnapshot` call takes an error callback as its third argument; a
listener without one dies silently on a rules denial or dropped connection
(stale UI, no log, unhandled rejection). Log through `utils/Logger` or the
`ServiceKit` child. `src/__tests__/snapshotErrorHandling.test.js` parses each
call and fails if any is registered with only two arguments.

## Timestamps: serverTimestamp() sentinels have no .toDate()
`_buildMessage` (and every other create path) sets timestamps to
`serverTimestamp()`, a sentinel with no `.toDate()` until the write commits.
Never call `.toDate()` on a value you just built — pass a real `Date` (e.g. the
current month shard) or guard with `?.toDate?.()`. `messagesService.sendMessage`
once did this and threw a `TypeError` on every send. `reelsAndMessagesWiring.test.js`
guards the send-path shard.

## Full-height feed screens own their scroll
`MainLayout`'s `isFullHeightFeed` branch (`/`, `/home`, `/messages`, immersive
video) renders `<main class="... overflow-hidden">`, so a screen there must be
its own scroll container (`flex-1 min-h-0 overflow-y-auto`) and must not rely on
`min-h-screen`. `MessagingScreen` used `min-h-screen` and clipped its inbox;
`reelsAndMessagesWiring.test.js` asserts the inbox scrolls.

## The enforced CSP must not be nullified
`index.html` is the enforced policy. `script-src` stays first-party
(`'self' 'unsafe-inline' blob:`): the app loads no external scripts and uses
neither `eval()` nor `new Function()`, so `'unsafe-eval'` and a bare `https:`
source are not allowed back in. `securityServices.test.js` fails if either
returns or an external `<script src>` is introduced.
