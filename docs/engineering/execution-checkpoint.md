# Arvdoul — Execution Checkpoint

Continuity file for the repository-hardening work. Read this first when resuming.

## State at last update

- Branch: `reconstruction/arvdoul-platform-hardening`
- HEAD at last checkpoint: see `git log -1`
- Working tree: clean (all work committed)
- Baseline toolchain: Vite + React SPA, Firebase (Firestore/Auth/Storage), Cloud
  Functions, Jest (`NODE_OPTIONS=--experimental-vm-modules`), ESLint.

## Completed work

| Finding | Summary | Evidence |
|---|---|---|
| N142 | Service-layer writes made observable (silent write failures). | `silentWriteFailureGuard.test.js` |
| N143 | Only the real FCM service worker is registered. | commit `2442acb` |
| N144 | `notification_counters` read keyed on the reachable doc-id shape. | commit `ccaf03a` |
| N145 | Screens no longer render a misleading *empty* state when a read failed — explicit error state + log + retry. | `silentReadFailureGuard.test.js` |
| N146 | `feedService.getSmartFeed` no longer reports a failed generation as `success: true` with an empty feed; degraded feed sources and the silent `null`/`[]` reads in search/monetization/messages now log. | `feedService.js`, ledger row |

### N146 detail
- `getSmartFeed` catch now returns `success: posts.length > 0` (fallback posts
  still served and still marked `isFallback`), so an empty fallback propagates as
  a failure the UI already handles (`result.success === false` → error + retry in
  `HomeScreen`).
- Per-source readers (`_getFollowingFeedEfficient`, `_getLatestFeed`,
  `_getDiscoverFeedPaginated`, `_getSponsoredPosts`, `_getAdOptimized`) now log
  through the shared `Logger`.
- Same for the silent read returns in `searchService` (sponsored result, profile
  lookup), `monetizationService` (sponsored search result) and `messagesService`
  (conversation-list ad).
- Best-effort notification/XP/archive catches in `userService`, `storyService`,
  `firestoreService` and the screen-level balance/queue catches in `HomeScreen`,
  `MarketplaceScreen`, `PollsScreen` now log instead of swallowing.

## Quality gates (last run)

- `npm test` — 114 suites / 1356 tests passing.
- `npm run build` — ✓ built.
- `npx eslint src/ functions/ --ext .js,.jsx --quiet` — exit 0.
- Guards subset (42 suites / 580 tests) — passing.

## Next exact tasks

1. Audit the remaining `ARVDOUL_REMAINING_ISSUES.md` items against current code
   (most were verified already closed: LiveScreen↔liveService, reels route,
   sw.js push handlers, payment flow, subscription screen, trending, video
   editor, hardcoded API key).
2. Classify remaining security-adjacent services as REAL CLIENT / UX-ONLY /
   FALSE SECURITY / DUPLICATE.
3. Consider a guard for the "best-effort catch must be observable" rule in the
   non-write read path (extend `silentWriteFailureGuard` or add a sibling).

## How to resume

```bash
cd /workspace/project/Arvdoul
git status --short
git log --oneline -5
NODE_OPTIONS=--experimental-vm-modules npx jest --watchAll=false
npm run build
```

## Checkpoint — silent-catch sweep (client + server), N148

- Branch: `reconstruction/arvdoul-platform-hardening`.
- Completed: N142/N147 fire-and-forget sweep extended to the **server** runtime
  and the profile/auth sync paths. Every remaining empty/comment-only catch in
  `functions/*.js` and the flagged `src` sites now logs through the shared
  logger (server: `functions.logger`/module `log`; client: `logger`/service
  child `log`). Sites: `auth.isAdmin`/`getUserEmail`, `moderation` reportCount,
  `stories` media deletes, `user.deleteUserData` push tokens, `monetization` ad
  targeting, `authService` (rate-limit outage, attempt persist, phone/Google
  onboarding flags, `verifyEmail` profile sync), `userService` (profile-store
  sync, unfollow follower snapshot), `feedService` (interest vector, session
  state, preferences, single post, ML source, ad prefetch), `analyticsService`
  (identity + top posts), `marketplaceService`/`pollService`/`aiStudioService`
  localforage, `searchService` skipped candidate, `ProfilePublicScreen` view
  tracking, `NotificationsScreen` follow-request hydration, `videoService`
  share counter.
- New guards: `src/__tests__/sideEffectFailureGuard.test.js`,
  `src/__tests__/functionsSilentCatchGuard.test.js` and
  `src/__tests__/srcSilentCatchGuard.test.js` (all hard-failing `guards` CI
  job). The latter two make the class impossible to reintroduce: an empty
  catch must carry an explanatory comment, in `functions/` and `src/` alike.
  Every remaining empty catch in the repo now either logs or explains itself
  (0 bare `catch {}` remain in `src` or `functions`).
- Quality gates: `npm test` — **115 suites / 1358 tests passing**;
  `npm run build` — ✓ built; eslint `--quiet` — exit 0.

## Next exact tasks (updated)

1. (done) Observability guard extended to both `functions/` and `src`.
2. Continue the "no fabricated state" pass on remaining screens (loading vs
   failed vs empty tri-state) where the guard has not yet pinned them.
3. Keep chasing the "surpass major platforms" goal: profile highlight creation
   UI, richer About/Preview surfaces, and PII boundary review.

## Checkpoint — fabricated-zero sweep, N155/N156/N157

- Branch: `reconstruction/arvdoul-platform-hardening`.
- Completed: the "no fabricated standing/counts" discipline extended to every
  remaining engagement/economy surface. The root cause behind most of these
  was a **schema mismatch**: post/video/story engagement is written under
  `stats` (`firestoreService` writes `stats: { likes, comments, … }`), but a
  number of readers used non-existent top-level `viewsCount`/`likesCount`
  fields and then `|| 0`, so an unmeasured value rendered as a measured zero.
- Fixed (see ledger N155/N156/N157 for the full list): `PostAnalyticsScreen`,
  `postService.getPost` (returned the `{success, post}` envelope instead of the
  post — every caller read `undefined`), `analyticsService.getUserAnalytics`
  engagement, `PostCard` (engagement reducer + inline analytics + inline
  comments), `ProfileFeaturedSection`/`ProfilePinnedPosts`,
  `ProfileFeedGrid`, `CommentsDrawer`, `VideoComments`, `PollCard`,
  `StoriesScreen`, `LiveScreen`, `PerksRewardsScreen`, `CreatePost` analytics
  preview, plus the earlier video/reel/AuthContext/QuickAccessPanel work.
- Canonical rule (unchanged): an absent count/level/balance is **unknown** —
  render `—`, keep `null` in state, never `0`/`Level 1`/`Citizen`. A real
  measured `0` stays `0`.
- Guards: `src/__tests__/noFabricatedData.test.js` (N155/N156/N157 blocks),
  hard-failing `guards` CI job.
- Quality gates: `npm test` — **117 suites / 1408 tests passing**;
  `npm run build` — ✓ built; `eslint --quiet` — exit 0.

## Next exact tasks (updated)

1. Continue the "no fabricated state" pass: audit `CommunityDetailScreen` /
   `CommunityDirectoryScreen` member/post counts (community docs do seed
   `stats.memberCount`, so these are real, but a missing doc still renders 0).
2. Chasing "surpass major platforms": profile highlight creation UI, richer
   About/Preview surfaces, PII boundary review.
3. Re-run the `guards` job suites after any further reader changes.

## Checkpoint — fabricated-zero sweep batch 5, N158/N159

- Branch: `reconstruction/arvdoul-platform-hardening`.
- Completed: continued the "no fabricated standing" pass into the creator/economy
  and royal-eligibility surfaces.
- Fixed (see ledger N158/N159): `CreatorDashboardScreen` metrics + change
  badges, `CreatorPayoutScreen` unknown balance + unverifiable security claim,
  `ProfileSystemRoadmapModal` (XP + royal checklist dimensions), `VideoCard`
  comment stat key, `LiveScreen` viewer counts, community/event counts,
  `ProfileFeaturedSection`/`ProfilePinnedPosts`.
- Guards: `noFabricatedData.test.js` (batch-4/5 blocks), `liveWiringGuard.test.js`.
- Quality gates: `npm test` — **117 suites / 1415 tests passing**;
  `npm run build` — ✓ built; `eslint --quiet` — exit 0.

## Next exact tasks (updated)

1. Continue the "no fabricated state" pass: `ProfileHeroSection.isRoyal` stats
   still seed `|| 0` (fail-closed, so no false royal grant, but worth tightening).
2. Chasing "surpass major platforms": profile highlight creation UI, richer
   About/Preview surfaces, PII boundary review.
3. Re-run the `guards` job suites after any further reader changes.

## Checkpoint — collaboration integrity, N162/N163

- Branch: `reconstruction/arvdoul-platform-hardening`.
- Completed: the collaboration domain had a **schema mismatch** between the
  client reader and the server writer (same class as N155–N161).
  - `collaborationService.getStats` read `members` (number) and `team` (array)
    off the project document, but `functions/collaboration.js` never writes
    either — the roster lives in the `team/{uid}` subcollection. Every project
    card rendered a fabricated "0 members" and a permanently empty avatar row,
    and the `+N` overflow chip was unreachable. Fixed by denormalizing a real
    `memberCount` on the project document (`1` at create,
    `FieldValue.increment(±1)` in `addTeamMember` / `removeCollaborationTeamMember`),
    reading it in `getStats` (or `null` → "Members unavailable"), and replacing
    the dead avatar row with a real member-count line (N162).
  - `getTeam` now resolves real display names/avatars through the canonical
    `socialGraphService.hydrateProfiles` batch (the team doc only stores
    `{ userId, role, status }`), so the detail-screen roster no longer shows
    bare uids.
  - `ProjectDashboardScreen`'s primary "New Project" button had no `onClick`
    — the only create path (`createCollaborationProject` callable) was
    unreachable from the UI. Wired to an accessible `Dialog` with inline error
    handling, duplicate-submit guard, and navigate-on-success (N163).
  - `createInvite` / `updateMemberRole` / `removeTeamMember` had no caller in
    `src/` at all — the team tab was read-only, so a project owner could never
    build a team. The team tab now offers an invite dialog, inline role
    selector and per-member removal, gated by `canManageTeam` + the server's
    own role check (N164).
- Guards: `noFabricatedData.test.js` (collaboration block extended).
- Quality gates: `npm test` — **117 suites / 1419 tests passing**;
  `npm run build` — ✓ built; `eslint` — 0 errors.

## Next exact tasks (updated)

1. Continue the "no fabricated state" pass: `ProfileHeroSection.isRoyal` stats
   still seed `|| 0` (fail-closed, so no false royal grant, but worth tightening).
2. Chasing "surpass major platforms": profile highlight creation UI, richer
   About/Preview surfaces, PII boundary review.
3. Re-run the `guards` job suites after any further reader changes.

## Checkpoint — event card + className interpolation, N165/N166

- Branch: `reconstruction/arvdoul-platform-hardening`.
- N165: the in-feed `EventCard` read `stats.going` / `stats.interested` /
  preview-attendee fields that no writer produces (the real counter is
  `stats.attendeeCount`) and the never-written `banner` field (the cover is
  `coverImage`). Now reads the real counter (`null` → `—`), drops the dead
  avatar row, and reads `banner || coverImage`; the host line no longer
  fabricates "Arvdoul User" (real author name passed from `PostCard`).
- N166: a `${...}` inside a double-quoted `className`, and an escaped `\${...}`
  inside a template literal, both emit the literal text — so 2 status badges and
  19 dark/light classes across `FilterTool`/`CropTool`/`TextTool` were dead.
  Fixed all; new hard-failing `classNameInterpolationGuard.test.js` in the
  `guards` CI job.
- Quality gates: `npm test` — **118 suites / 1422 tests passing**;
  `npm run build` — ✓ built; `eslint` — 0 errors.

## Next exact tasks (updated)

1. Continue the "no fabricated state" pass into remaining readers of
   never-written fields (e.g. `event.stats.going` siblings elsewhere).
2. Chasing "surpass major platforms": profile highlight creation UI, richer
   About/Preview surfaces, PII boundary review.
3. Re-run the `guards` job suites after any further reader changes.

## Checkpoint — N167/N168 (economy + verification fabricated zeros)

- N167 `CreatorPayoutScreen`: earnings (`gifts`/`ads`/`other`) and
  `lifetimeWithdrawnCoins` are sums over the coin ledger. A **failed** read used
  to collapse to `[]` → a confident "0 Coins earned" / "$0.00 withdrawn". Now
  `null` until a fulfilled read; unknown renders "—".
- N168 `AdminVerificationScreen`: `Number(applicant.strikesCount ?? 0)` fabricated
  a clean "0 strikes ✓" and passed `meetsStrikes`; `strikesCount` is written only
  on `communities`. Absent → `null`, gate fails closed, row renders "—".
- Also: `EventDetailScreen` waitlist stat now renders "—" for an unknown count.
- Guards added to `noFabricatedData.test.js`.
- Gates: `npm test` 118 suites / 1424 tests; build ok; eslint 0 errors.

## Checkpoint — N169 (analytics earnings fabricated as 0)

- `analyticsService.getUserAnalytics`: `coinsEarned` now `null` when the field is
  absent (`typeof !== 'number'`) or the wallet read fails, instead of `|| 0`.
  The coins change-% is `null` in that case too.
- `VideoAnalyticsScreen`: revenue total is `null` when unknown (renders "—"),
  and the revenue header no longer mislabels a USD figure as "Total Coins
  Earned" → "Total Earnings (USD)".
- Guard added to `noFabricatedData.test.js`.
- Gates: `npm test` 118 suites / 1425 tests; eslint 0 errors.
