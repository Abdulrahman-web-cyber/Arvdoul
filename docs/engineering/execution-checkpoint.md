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

## Checkpoint — N170 (Storage rules ↔ client write paths: every upload denied)

The single highest-impact defect found this session. `storage.rules` and the
client disagreed on the storage layout, so nearly **every** media upload failed
with `storage/unauthorized` in production.

Evidence (Storage emulator + `@firebase/rules-unit-testing`, authenticated
context): before the fix, avatar, post, story, chat, comment-voice, event,
group-photo, community and audio-export uploads were all DENIED. Root causes:

1. Path shape: rules used `avatars/{userId}/{fileName}` (3 segments) while the
   client wrote `avatars/{uid}` (2 segments) — an unmatched path is denied.
2. Missing namespaces: `chat_media`, `comments/voice`, `events`, `group-photos`,
   `communities/avatars`, `audio_exports` had **no rule at all**.
3. Mixed/extra segments: `posts/{userId}/{postId}/{fileName}` vs client
   `posts/{uid}/{file}`; `messages/{conv}/{msgId}/{file}` vs `chat_media/{uid}/…`.
4. Delete semantics: a single `allow write` carrying `request.resource.size`
   throws on delete (no `request.resource`), so owner deletes failed too.

Fix:
- One canonical layout for every client write: `{namespace}/{ownerUid}/...`
  (`{fileName=**}` matches the zero-segment `avatars/{uid}` form).
- Message media is participant-scoped: `messages/{conversationId}/{messageId}.{ext}`,
  gated by a cross-service `firestore.get(/databases/(default)/documents/conversations/$(cid)).data.participants`
  membership check (verified: participant ALLOW, stranger DENY).
- Explicit owner `allow delete` per namespace; size/content-type gates on write only.
- Client paths updated: `userService.uploadAvatar`, `SetupProfile`,
  `CreatePost`, `CreateImage`, `CreateVideo`, `CreateEvent`, `CreateEventScreen`,
  `CreateCommunityScreen`, `NewConversationScreen`, `CommentsDrawer`,
  `messagesService`. Anonymous fallbacks (`|| 'anonymous'` / `'anon'` / `'user'`)
  now fail closed instead of writing to an unwritable path.
- Retired the `chat_media` namespace (message media now under `messages/{cid}`).

Guards:
- New `src/__tests__/storageRulesPathAlignment.test.js` — static contract
  (every client namespace has a rule; every write embeds an owner/participant
  segment; no `chat_media`) **plus** live emulator assertions (owner ALLOW,
  cross-user DENY, owner delete OK, content-type gates). Added to the
  hard-failing `guards` CI job and a new `emulators:exec --only storage` step.
- Updated `storageRulesDeploy.test.js` (line-based match-block parser so a
  nested `function` no longer truncates a block) and `noFabricatedData.test.js`
  (asserts `{fileName=**}` + the full namespace list).

Gates: `npm test` — **119 suites / 1431 passing**; `npm run build` — ✓;
`eslint src/ functions/ --quiet` — 0 errors. Live storage emulator guard:
10/10 passing.

## Checkpoint — N171 (composer persisted a session-scoped media URL)

`CreatePost.uploadMedia` fabricated a media URL whenever the real Storage
upload failed, so a published post could carry a `data:` (base64) or `blob:`
URL that renders only for the uploader's current tab and is broken for every
other viewer and after any reload.

Evidence:
- The upload was raced against a bare `setTimeout(7000)` that rejected a
  still-in-flight upload; the `catch` logged `Storage upload fallback to data
  URL` and fell through to `convertFileToDataURL(file)` → a base64 `data:` URL,
  then to `item.url || item.preview` → a `blob:` object URL.
- The background-sync branch caught the upload error with
  `console.warn("Background media upload fallback:", err)` and then wrote the
  optimistic `blob:` previews (`instantMedia`) to Firestore anyway.
- A generated video/image thumbnail (`canvas.toBlob` → `URL.createObjectURL`)
  was persisted verbatim as `media[].thumbnail` / `thumbnailUrl`.

Fix:
- `uploadMedia` uploads the file, requires a `downloadURL` (else throws),
  uploads the generated thumbnail alongside the media (or drops it if that
  fails), and throws if any item failed — no fabricated fallback URL.
- A non-file item keeps its URL only if it is not `blob:`/`data:`.
- The background sync no longer swallows the upload error; the outer `catch`
  drops the optimistic entry and enqueues the post to the offline queue.
- Deleted `convertFileToDataURL` and the 7 s timeout.

Guards: new `noFabricatedData.test.js` block asserting `convertFileToDataURL`,
`Storage upload fallback to data URL`, `Storage upload timed out` and
`Background media upload fallback` are gone, that `blob:`/`data:` candidates
are rejected, that `uploadMedia` throws on a failure, and that a generated
thumbnail is uploaded or dropped.

Gates: `npm test` — **119 suites / 1435 passing**; `npm run build` — ✓;
`eslint src/ --quiet` — 0 errors; full `guards` job list (73 suites) — 841 passing.

## Checkpoint — N172 (creator dashboard fabricated growth rate + active days)

`analyticsService.getUserAnalytics` returned a hardcoded `growthRate: 0` and,
in the new-creator fallback, derived `activeDays` from the recent-post count.
`CreatorDashboardScreen` then rendered a permanent green **"Growth Rate
+0.0%"** and a fabricated "Active Days" streak for every creator.

Evidence:
- No writer computes a growth rate: only `functions/analytics.js` seeds
  `growthRate: 0` on `profile_analytics` doc create, and `rankingService`
  reads a separate `rankings/rising` collection. So `analytics?.growthRate
  !== undefined` was always true → a confident "+0.0%" trend that never moved.
- Active days are canonical on `users/{uid}.activeDaysCount`
  (`functions/levelSystem` `recordActiveDay`), never on the analytics doc; the
  fallback's `Math.min(topPosts.length, days)` dressed a recent-post count up
  as an activity streak.
- `null >= 0` is `true` in JS, so a `null` growth rate would have crashed the
  card on `.toFixed(1)` — the guard had to be tightened too.

Fix:
- `getUserAnalytics`: `growthRate`/`activeDays` are `null` unless a real
  stored number exists (both the exists-branch and the fallback branch).
- `CreatorDashboardScreen`: the growth card renders only when
  `typeof analytics?.growthRate === 'number'`; Active Days reads
  `userProfile?.activeDaysCount ?? storeUser?.activeDaysCount ?? null` and
  renders `—` when unknown.
- `AuthContext.syncUserWithAppStore` mirror now carries `activeDaysCount` /
  `activeStreak` (absent → null).
- `analyticsStore` keeps `growthRate`/`activeDays` null when unmeasured.

Guards: new `noFabricatedData.test.js` block (N172) asserting the service no
longer seeds `0`, the dashboard gates on a real number, the dashboard reads
active days from the profile, and the identity mirror carries
`activeDaysCount`.

Gates: `npm test` — **119 suites / 1440 passing / 5 skipped**; `npm run build`
— ✓; `eslint src/ --quiet` — 0 errors; guard suites (`noFabricatedData`,
`storeContract`, `contextContract`) — 318 passing.

## Checkpoint — N173 (period-over-period change badges fabricated 0%)

`getUserAnalytics` defaulted `changes` to all-zero and computed the
views/reach deltas as `previousTotal > 0 ? … : 0`, so a brand-new creator (or
a zero baseline) saw a confident "0%" change badge on the metrics grid and the
video analytics stat/revenue cards. Fix: defaults are `null`, the `: 0`
fallbacks are `: null`, and `VideoAnalyticsScreen` passes the deltas through
only when they are real numbers (its `revenue.change` is no longer hardcoded
`0`). Guarded by `noFabricatedData.test.js`.

Gates: `npm test` (noFabricatedData) — 314 passing; `eslint src/ --quiet` — 0
errors; `npm run build` — ✓.

### N172 follow-up — server seed + store fallback + PerksRewards floor

The fabricated growth/active-days defaults existed in three more places that
would have defeated the client fix:
- `functions/analytics.js` seeded `growthRate: 0` / `activeDays: 1` on the
  `profile_analytics` doc at create, so the tightened `typeof === 'number'`
  check would have returned them. Seed removed.
- `analyticsStore` set `growthRate`/`activeDays` to `0` in its failed-read
  branch (the same unknown-is-not-zero bug as N154). Now `null`.
- `PerksRewardsScreen` read `Number(profile?.activeDaysCount || …) || 1`, a
  fabricated "1 day" that can bump a citizen tier. Now floors at 0.

Gates: `npm test` — **119 suites / 1443 passing / 5 skipped**;
`eslint src/ functions/ --quiet` — 0 errors.

## Checkpoint — N174 / N175 / N176

- **N174 (fixed)**: `analyticsService.getCreatorRanking` ordered `profile_analytics`
  by `coinsEarned`, a field no server path increments → every creator got an
  arbitrary "Top 1%" label. Now ranks only a positive, maintained score; the
  failure branch returns `label: null`; the dashboard hides the card when no real
  rank exists.
- **N176 (fixed)**: `analyticsService.getFollowerGrowth` fabricated a
  straight-line follower series when no `user_daily_stats` snapshots existed.
  Now returns `[]` until real snapshots exist.
- **N175 (confirmed, blocked)**: the `rankings/*` collections every Rankings tab
  reads have no writer anywhere (rules even say "scheduled functions compute
  rankings", but none exists). Honest empty state, not fabricated data; closing
  it needs a scheduled ranking function + a product-defined ranking formula.

Gates: `npm test` — **119 suites / 1446 passing / 5 skipped**;
`npm run build` — ✓; `eslint src/ functions/ --quiet` — 0 errors.

## Checkpoint — N177

- **N177 (fixed)**: `storyService.getABBucket`/`setABOverride` randomly assigned
  users to an A/B bucket (`Math.random() < 0.5`) and persisted it, but no code
  anywhere reads a bucket or calls either method. Removed both plus their
  service-facade exports (dead experiment with a fabricated assignment).

Gates: `npm test` — **119 suites / 1446 passing / 5 skipped**;
`npm run build` — ✓; `eslint src/ functions/ --quiet` — 0 errors.

## Checkpoint — N178

- **N178 (fixed)**: all six `rankingService` list queries passed
  `startAfter(offset)` (a raw number) to the modular SDK, which treats it as a
  field value compared against `orderBy('score')` — breaking "Load more". Now
  bounded offset paging (`limit(offset + PAGE_SIZE)` + `.slice(offset)`).
  Also `trend: data.trend || 0` → `?? null` with `TrendIndicator` showing an
  em-dash for an unmeasured trend.

Gates: `npm test` — **119 suites / 1448 passing / 5 skipped**;
`npm run build` — ✓; `eslint src/ functions/ --quiet` — 0 errors.
