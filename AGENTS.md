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
- **Callables from the client**: go through `src/services/callableService.js`
  (`callFunction`, `FUNCTIONS`) rather than inlining `httpsCallable(getFunctions(), ...)`,
  so app binding and error normalisation stay consistent.

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
- Rank bands, perks and royal eligibility follow the Profile System blueprint
  (sections 21-22 and 31-32); `getRoyalEligibility` requires every dimension, so
  level alone can never grant a royal title.
