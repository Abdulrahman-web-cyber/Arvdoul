# AGENTS.md

## Project
Arvdoul — Vite + React SPA with Firebase (Firestore/Auth/Storage), Cloud Functions, and Jest.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test` (requires `NODE_OPTIONS=--experimental-vm-modules`, already set in the script)

ESLint currently reports 0 errors and many `no-unused-vars` warnings; the config is not
JSX-aware, so JSX-used components (e.g. `ToggleRow`) are still flagged as unused. Warnings
are expected — only treat errors as failures.

## Single sources of truth
- **Settings**: `src/services/settingsService.js` owns persisted user settings
  (`DEFAULT_SETTINGS`, `mergeSettings` deep-merge, `updateSetting` with optimistic write +
  rollback, `subscribeToSettings` realtime sync, `clearApplicationCache`). Always go through
  this service — do not add parallel local-state settings.
- **Settings UI**: `/settings` (`src/screens/SettingsScreen.jsx`) is the canonical settings
  screen. `/profile/settings` redirects there. Do not reintroduce a second settings screen.
- **Profile field constraints/validation**: `src/config/profileContracts.js`
  (`PROFILE_CONSTRAINTS`, `VISIBILITY_SCOPES`, `DEFAULT_PROFILE_PRIVACY`,
  `validateProfileUpdate`). Reuse these instead of hardcoding limits or duplicating validators.
- **Profile sharing**: `src/utils/shareUtils.js` (`shareProfile`, `getProfileUrl`,
  `getProfileHandle`, `copyToClipboard`). All share entry points must use it so links resolve
  consistently. Do not rebuild `${origin}/profile/${id}` by hand — use `getProfileUrl`.
- **Friendship**: `userService.areFriends(a, b)` is canonical. `_areMutualFriends` only
  delegates to it; treat both names as one implementation, never fork the logic.
- **Account deletion**: `userService.deleteAccount(uid)` schedules deletion locally and calls
  the `deleteUserData` cloud function. The cloud function name and the client method name are
  intentionally different — do not rename one to match the other.
- **Firestore rules must cover every collection the client reads/writes.** Notably
  `previous_usernames` (old username -> userId) is read when resolving share/QR links, so it
  needs an explicit `match` block; a missing block silently denies those reads.
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
- **Feature flags**: `src/shared/featureFlagRegistry.cjs` is the canonical flag
  list (synced to `functions/featureFlagRegistry.cjs`, guarded by
  `sharedConfigSync.test.js`). Platform-wide overrides live in Firestore
  `feature_flags/{flag}` and are written ONLY by the admin-gated
  `setFeatureFlagOverride` callable (`functions/featureFlags.js`), which
  validates the name against the registry and audits to `moderation_logs`.
  `featureFlagService.setOverride()` is a device-local lever, not governance —
  never present it as an audit record.
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

## Conventions
- Profile privacy is stored on the user profile (`profile.isPrivate` plus
  `profile.privacy.*` scopes) — not in the settings document.
- Never reset a form from an effect keyed on the whole profile object; key on `uid` so
  in-progress edits are not discarded by realtime snapshots.

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
`sessionSecurityService`, `CSPService`, `SecureHeadersService` and
`challengeService` were inert (imported only by their own tests) and have been
removed. Real controls: `firestore.rules` (authorization),
`functions/rateLimit.js` (per-user sharded server limits), Firebase App Check
(bot/abuse), the `index.html` meta CSP and the `firebase.json` headers.
`src/__tests__/securityServices.test.js` fails if any is reintroduced.

## UI reaches the backend only through services
Screens/components must not import `firebase/*` directly — direct SDK use
bypasses cache scoping, authorization helpers and error normalisation.
`src/__tests__/architectureBoundaries.test.js` freezes the remaining offenders
as an explicit allowlist; remove a file from that list only after migrating it
to a service. Add no new entries.

## Reconstruction deliverable
`docs/audits/REPOSITORY_RECONSTRUCTION_V1.md` is the inventory/reachability/
duplication/cost/route/dependency reconstruction and the AUDIT V3 finding-status
ledger. Update it when a finding closes.
