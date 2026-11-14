# Execution checkpoint

_Last updated: this session. Branch `harden/n319-n320-analytics-live`, base `origin/main` (PR #46 merged)._

## This session — video/reel viewer-state reality (N354–N355)

- **N354 (MEDIUM, closed):** `videoService.formatVideoItem` seeded `isLiked`/`isSaved`
  from `item.isLiked`/`item.isSaved` — fields **no writer ever sets** on a `videos/{id}`
  document (`uploadVideo` writes only the content/author fields). `ReelsScreen` mapped
  those straight into the reel, so every reel rendered an unliked heart for a viewer who
  had liked it, and because `likeVideo` **toggles** server-side the next tap *unliked* it
  (the heart flipped back on, appearing to do nothing); same for save. `VideoDetailScreen`
  also read a dead `data.likedBy?.includes(uid)`. Fix: new
  `videoService._hydrateViewerVideoState(videos, uid)` resolves the real state — one
  bounded `documentId() in` read per 30 videos against `users/{uid}/saved_videos`, plus one
  point read per video against `videos/{id}/likes/{uid}` (a like doc cannot be batched
  across its per-video parent). `getVideoFeed` hydrates both branches; the dead format
  fields and the dead detail read are gone. Locked by `viewerLikeStateRealityGuard.test.js`
  (guards job).
- **N355 (MEDIUM, closed):** `ReelsScreen` and `VideoFeed` hydrated the per-creator
  `isFollowing`/`followedByViewer` badge with `getFollowing(uid, { limit: 200 })` — a
  graph-wide list whose cost grows with how many accounts the viewer follows — to answer
  "does the viewer follow these N creators?". Fix: both use
  `userService.getFollowStates(viewerId, creatorIds)` → `socialGraphService.getEdgeSet`
  (the canonical batched per-pair read, chunked `documentId() in` on the actor field).
  `integrationWiring.test.js` asserts the canonical method.

Latest verified: **169 suites / 1855 passed (5 skipped), exit 0**; `npm run lint` exit 0
(0 errors); `npm run build` green. `firebaseCostGuard` stayed green (the new saved-videos
read is explicitly `limit`-bounded).

## This session — viewer like-state reality (N352–N353)

- **N352 (MEDIUM, closed):** `PostCard`/`PostOptionsDrawer` seeded the viewer's
  `liked`/`saved`/`reaction` from `post.isLiked`/`post.liked`/`post.likedBy`/
  `post.savedBy`/`post.userReaction` — **none of which any writer ever sets** on a
  `posts/{id}` document. Fix: `firestoreService.getPostViewerState(postId, uid)`
  reads the viewer's own `posts/{id}/likes|saves|reactions/{uid}` docs in parallel.
- **N353 (MEDIUM, closed):** `ProfileFeedGrid` seeded `likedPosts`/`likeBaseline`
  from `post.isLiked`/`likedByMe`/`hasLiked` (also never written), so re-liking a
  pre-liked post double-counted. Fix: `firestoreService.getLikedPostIds(uid, ids)`
  resolves the real set in one bounded `documentId() in` read per 30 ids against
  `users/{uid}/liked_posts`.

Latest verified: **168 suites / 1851 passed (5 skipped), exit 0**; `npm run lint` exit 0
(0 errors); `npm run build` green (with the Firestore emulator live).

## This session — PostCard follow-state reality (N351)

- **N351 (MEDIUM, closed):** the `PostCard` follow button initialised
  `engagement.followState = 'none'` and only the button's own optimistic dispatch changed
  it, so a viewer who already followed the author still saw **Follow**; and tapping Follow
  on a **private** account called `followUser` (which returns `{requested:true}` and creates
  no edge) then optimistically showed **Following** for a follow that was only pending. Fix:
  a `getFollowStatus` hydration effect seeds `following`/`requested`; `handleFollow`
  reconciles the pending result into a `requested` state; the button renders **Requested**
  and gains an `aria-label`. Locked by `postCardFieldRealityGuard.test.js` (guards job).

Latest verified: **168 suites / 1848 passed (5 skipped), exit 0**; `npm run lint` exit 0;
`npm run build` green (with the Firestore emulator live).

## This session — PostCard field reality + ad disclosure (N350)

- **N350 (MEDIUM, closed):** `PostCard` rendered two more fields no writer sets —
  `post.momentum` ('trending'/'exploding') and `post.communityNotes` (no community-notes
  collection exists; the scheduler writes `trendingScore`/`personalizationScore`) — so the
  momentum badges and community-notes block were permanently dead. Separately, the feed
  inserts ad cards shaped `{ type: 'ad', isAd: true, cta, link }` (`feedService
  ._getAdOptimized`, `feed.ads` defaults **true**) but the card only checked
  `post.isSponsored`/`post.adCampaignId`: **every feed ad rendered with no sponsored label
  and no CTA.** Fix: dead reads removed (with unused `Sparkles`/`Shield` imports); the card
  treats `type === 'ad'`/`isAd === true` as sponsored and reads the ad card's `cta`/`link`;
  `postCardFieldRealityGuard.test.js` (guards job) locks all of it.

Latest verified: **168 suites / 1847 passed (5 skipped), exit 0**; `npm run lint` exit 0;
`npm run build` green (with the Firestore emulator live).

## This session — dead author-standing reads (N349)

- **N349 (MEDIUM, closed):** `PostCard` computed `isCreator = (post.authorLevel || 0) >= 5`
  and `isPremium = (post.authorLevel || 0) >= 8`, and read `post.isVerified` for the
  verified check. **No writer ever puts `authorLevel` or `isVerified` on a `posts/{id}`
  document** — standing lives on `users/{uid}` (the create path writes `authorId`,
  `authorName`, `authorIsPrivate`, `authorPhoto` only). Every read was therefore
  permanently falsy: the creator/premium avatar rings, the verified badge, the creator
  zap, and the creator-gated **Send gift** button never rendered on any feed card.
  - Fix: new `src/hooks/useAuthorStanding.js` hydrates the distinct author uids in one
    bounded batch (`socialGraphService.hydrateProfiles`, 30 ids per `documentId() in`
    read, viewer-projected, resolved ids not re-read) and returns an entry only for a
    profile that actually resolved. `PostCard`/`PostDetails` consume a resolved
    `authorStanding` prop; a caller without one renders **no** badge (never fabricated).
    `HomeScreen` feeds it the page's posts; `PostDetails` its single post.
  - Guard: `postAuthorStandingGuard.test.js` (guards job) fails on any `authorLevel`
    read or a post-document standing read.

Latest verified: **167 suites / 1843 passed (5 skipped), exit 0**; `npm run lint` exit 0;
`npm run build` green (all with the Firestore emulator live).

## This session — money/fabrication + post-author-field sweep (N344–N348)

- **N348 (HIGH, closed):** `functions/monetization.js` read the post author from
  `postSnap.data().userId`, which does not exist — posts denormalise the author
  as `authorId` (firestoreService postDoc, the communities writer, and the
  `posts` create rule all agree). Consequences: `sendGift` threw "Post has no
  author" on **every** gift (gifting was dead), and `boostPost`'s ownership
  check `data().userId !== uid` rejected the real owner (boosting was dead, and
  `boosted_posts.userId` was written `undefined`). Both now resolve `authorId`
  with a `userId` fallback. Guard: `postAuthorFieldConsistency.test.js` (in the
  `guards` job) fails on a post-author `userId` read in `functions/`, and pins
  the client writer + rules to `authorId`. A follow-up sweep confirmed
  `live_streams`/`videos`/`comments`/`questions` genuinely store `userId`, and
  `admin.js`/`user.js`/`comments.js` reads are correct (no other mismatches).
- **N344–N347 (closed in commit `f7f3207`):** idempotency-ledger ownership check
  on `requestWithdrawal`/`watchAd`; fractional-coin withdrawal rejected; money
  screens no longer double-prefix `$` (`$$5.00`) and format coins via
  `formatCoinsAsUsd`; `predictPostPerformance` + `CreatePost` no longer render a
  fabricated per-reach "earnings" figure. Guards: `moneyLedgerOwnershipGuard`,
  `moneyDisplayFormatGuard`, `predictionNoFabricatedEarnings`.
- **Emulator now runs locally for real.** `openjdk-21` (`default-jre-headless`)
  installed via `sudo apt-get`; the Firestore emulator jar was fetched directly
  (`storage.googleapis.com/firebase-preview-drop/.../cloud-firestore-emulator-v1.19.8.jar`)
  into `~/.cache/firebase/emulators/` (firebase-tools' own downloader stalled),
  then run with `java -jar … --host 127.0.0.1 --port 8080`. With
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` the emulator-gated adversarial
  assertions execute instead of skipping:
  - rules/graph suites (15 suites): **130 passed, 5 skipped**;
  - **full suite with the emulator: 166 suites / 1840 passed (5 skipped), exit 0.**

Latest verified: **166 suites / 1840 passed (5 skipped)**; `npm run lint` exit 0;
`npm run build` green (all with the emulator live).

## Current state

- Latest verified: **167 suites, 1843 passed, 5 skipped**; `npm run build`
  green; `npm run lint` exit 0 (0 errors).
- N330 closed this session (money-in integrity): the three Stripe-backed
  economy callables ran their Stripe network calls **inside** the retryable
  Firestore transaction callback — `purchaseCoins` re-charged the card each
  retry, `createSubscription` re-created the price/subscription with no
  idempotency key (a contention retry could start several paid subscriptions),
  and it also read `users/{uid}` after writing `subscriptions/{uid}` (a
  read-after-write that throws). All Stripe calls now run before the
  transaction; `transactionOrderGuard` gains a hard-zero assertion.
- N326–N329 closed this session (financial-integrity + payout-contract +
  dead-route): see the table below. The headline is N326 — a PayPal-selected
  withdrawal settled as a Stripe payout **from the platform account** with
  `stripeAccount: undefined`, and the destination came from a client-supplied
  field. Settlement is now provider-aware and server-authoritative, and a
  functions test harness (emulator-backed) covers it.
- N321 closed (prior): live presence (`isOnline`/`lastActive`) sat on the
  world-signed-in-readable `users/{uid}` doc, so a raw `getDoc` leaked a user's
  online status / activity timestamp to any authenticated client regardless of
  the profile's `presence` scope (client-masking-only, the N315 class). Presence
  moved to a scope-gated `user_presence/{uid}` document (rule mirrors
  `profileSectionReadable(userId, 'presence', 'FOLLOWERS')`); `userService`
  writes/reads it, `socialGraphService.hydrateProfiles` hydrates it opt-in with
  per-doc reads, `AuthContext` no longer fabricates `lastActive`, the dead
  `appStore.updateUserLastActive` is gone, and `users/{uid}` create/update refuse
  the two fields. `userPresencePrivacyRules.test.js` (static + emulator
  adversarial) + idempotent `scripts/migrate-user-presence.mjs`.
- N322 closed this session: `NEW_USER_DEFAULTS.totalEarned: 0` seeded a
  lifetime-earnings figure no writer maintains, so the wallet/creator surfaces
  rendered a fabricated measured "Lifetime Earned: 0" (the N320 class). Removed
  from `NEW_USER_DEFAULTS`, `createUserProfile`, and the `users/{uid}` create
  rule (still in the server-authoritative denylist). Absent now renders "—".
- N323 closed this session: a three-stop "brand mimic" gradient
  (`from-purple-500 via-pink-500 to-cyan-400` and siblings) stood in for the
  brand gradient across six modules (`RouteProgressBar`, `VideoTopBar`,
  `GroupInfoScreen`, `MessagingScreen`, `ProfileQRCodeModal`,
  `QuickAccessPanel`) plus two `components/Videos/VideoCard` /
  `components/Ads/SponsoredPostCard` fills — a second brand gradient the hex
  ratchet could not see. All migrated onto `BRAND_GRADIENT`;
  `designTokenDriftGuard.test.js` gains a hard-zero `ROGUE_BRAND_MIMIC` guard.
- The `guards` CI job (static list) passes locally; its emulator steps were run
  locally against the running Firestore emulator (127.0.0.1:8080).
- Emulator enabled locally this session (openjdk-21 installed via `sudo apt-get`;
  Firestore + Storage jars cached under `~/.cache/firebase/emulators/`).
- Commits this session: N321 (presence scope), N322 (totalEarned), N323
  (brand-mimic gradient), N325 (dead fabricated coin getter). See
  `docs/audits/REPOSITORY_RECONSTRUCTION_V1.md` §8 ledger rows N321–N325;
  N324 (coins readable on the public `users/{uid}` doc) is confirmed and
  deferred with a documented migration plan.

## Completed this session

| # | Item | Evidence |
| --- | --- | --- |
| N336 | `ring-arvdoul-purple-500` was a dead class (no `-500` shade on the flat `arvdoul-purple`) — 97 focus rings invisible | corrected to `ring-arvdoul-purple`; added a config-aware custom-colour utility assertion to `tailwindUtilities.test.js` |
| N335 | The screen canvas radial-gradient was copy-pasted in 4 screens with raw brand literals | added `brandRgba`/`brandCanvasBackground` design-system helpers; migrated all 4 |
| N334 | Keyboard focus rings used the raw Tailwind family (`ring-purple-500`/`ring-indigo-500`/`ring-blue-500`/`ring-violet-*`) — a different colour than the brand violet | standardised 97 rings across 40 files onto `ring-arvdoul-purple-500`; drift-guard assertion; added `designSystemPrimitives.test.jsx` |
| N333 | A second brand gradient shipped in 24 sites (incl. the design-system `Button` primary) because the guard only banned the pink/rose-middle mimic | migrated onto `bg-arvdoul-gradient`; added `ROGUE_BRAND_MIMIC_NEUTRAL` to the drift guard |
| N332 | A client could write its own `users/{uid}.lockedCoins`, defeating the withdrawal hold (`getAvailableBalance = coins - lockedCoins`) — filed a second withdrawal against held coins | added `lockedCoins` to `SERVER_AUTHORITATIVE_FIELDS` + both rules denylists; `serverAuthoritativeFieldsRules.test.js` (static + emulator) in `guards` |
| N331 | `payPerView` nested `transferCoinsInternal` (its own transaction) inside the outer transaction and awaited `enqueuePush` in the callback — an illegal nested transaction, so every pay-per-view purchase threw | separated the steps: transfer (idempotent) first, entitlement + push after commit; guard now bans nested `runTransaction`/`transferCoinsInternal`/`enqueuePush`/`fetch` in callbacks |
| N330 | `purchaseCoins`/`createSubscription`/`cancelSubscription` ran **Stripe network calls inside the retryable transaction callback** (`createFirestoreTransaction` retries 5×; the SDK re-runs on write-conflict). `purchaseCoins` re-charged the card each retry; `createSubscription` had **no** Stripe idempotency key, so a transient conflict could start multiple paid subscriptions; it also read `users/{uid}` **after** writing `subscriptions/{uid}` (read-after-write → throws, so subscribing failed outright). | all Stripe calls moved BEFORE the transaction; `creditSubscriptionCoins` runs before the sub-doc write so reads precede writes; `cancelSubscription` reads+cancels in Stripe first; both now reject a foreign idempotency key; `transactionOrderGuard.test.js` gains a hard-zero "no `stripe.*` inside a `runTransaction` callback" assertion |
| N326 | A PayPal-selected withdrawal settled as a Stripe payout **from the platform account** (`settleWithdrawal` always called `stripe.payouts.create` and took the destination from the client-supplied `paymentDetails.stripeAccountId`; the payout UI offered PayPal with no PayPal integration) | settlement now resolves the provider server-side (`resolvePayoutProvider`): PayPal/unknown are terminal (reject + release locked coins), a Stripe method requires `payout_settings.status === 'ready'` and the account id comes from `payout_settings`; `requestWithdrawal` validates the method before locking; `stripeWebhook` handles `account.updated` → `ready`; PayPal control removed from `CoinsScreen`/`CreatorPayoutScreen`/`VideoAnalyticsScreen`; `withdrawalSettlementProvider.test.js` (8 emulator tests) pins it |
| N327 | `walletService.requestPayout` passed the details object as `paymentMethod`, so every `WalletScreen` withdrawal threw "paymentMethod and paymentDetails required" | signature fixed to `(userId, amount, paymentMethod='stripe_connected', paymentDetails={})`; `WalletScreen` passes `'stripe_connected'` |
| N328 | `getPayoutSettings()` returned the `{ success, settings }` envelope and screens read `accountStatus`, a field the server never writes (server writes `status`) — a fully-onboarded creator showed "Not connected" forever | service unwraps `data.settings ?? data`; fallback returns honest `status: 'unconfigured'`; `CreatorPayoutScreen`/`VideoAnalyticsScreen` gate on `status === 'ready'`; `noFabricatedData` pin |
| N329 | `/image-editor` + `/image-studio` were dead routes rendering the same `ThumbnailDesignerScreen` as the reachable `/thumbnail-designer`; nothing linked to them | both aliases + their `TopAppBar`/`MainLayout` path special-cases removed |

**Functions test harness (new).** `jest.config.cjs` still excludes `/functions/` from the auto-run, but a new `firebase-functions` stub (`tests/stubs/firebase-functions.cjs`) + module mapper lets a `src/__tests__` suite `import` a real `functions/` module and exercise it against the Firestore emulator. `withdrawalSettlementProvider.test.js` is the first consumer and is wired into the `guards` CI job (which already runs the Firestore emulator).

## Completed this session (N321–N325, prior)

| # | Item | Evidence |
| --- | --- | --- |
| N182 | CI blocker (Jest 30 `require(esm)` on Node 22) | `profileFeedGridLikeCount.test.jsx` green on Node 22 + 24 |
| T1.1 | No-fabrication sweep (money/counts unknown, never 0) | `src/lib/unknownNumber.js`; `noFabricatedData` +N183 |
| T1.2 | Cloud Functions contract coverage | `deployIntegrity` asserts every `FUNCTIONS` key is deployed (129/129) |
| T1.3 | Firestore query-index parity | `firestoreQueryIndexMap.test.js`; removed dead `reels(createdAt)` index; `docs/engineering/firestore-query-index-map.md` |
| T1.4 | Accessibility gate | `a11yInteractiveGuard.test.js`; 17 interactive divs -> real controls/sliders |
| #16 | Node parity + CI promotion | `engines.node >=22`, `.nvmrc`, `.node-version`; lint + test jobs now hard-failing; test matrix Node 22 & 24 |
| #12 | Design-system consolidation (brand hex) | `brandHexRatchetGuard.test.js` + `scripts/brandHexBaseline.json` (ratchet may only shrink); LoadingSpinner/Collage migrated to `tokens.color.brand.*` (362 -> 349) |
| #13 | Shared state primitives | `design-system/PermissionDenied.jsx` replaces 3 hand-rolled admin denial cards; `sharedStatePrimitivesGuard.test.js` |
| N183 | No-fabrication sweep round 2 | `noFabricatedData` +N184 assertions; 7 count coercions -> `unknownNumber` (—) |
| N184 | Denied-block duplication + count sweep | `sharedStatePrimitivesGuard.test.js`; see N183 |
| N185 | Story/Vibe expiry in the data path (#9) | `storyService._isStoryExpired` single helper; `getUserStories` drops expired docs (the rules' list branch admits them regardless of expiry); `storyExpiryGuard.test.js` |
| N186 | No-fabrication sweep round 3 | `WalletScreen` ledger rows + `firestoreService.getPostAnalytics` counters -> `unknownNumber`; `noFabricatedData` +round-3 block |
| N187 | Prediction-market wagering removed (coin value sink) | `votePoll` no ledger debit/supply burn; `PollsScreen` wager modal gone; dead `prediction_markets` rules deleted; `noFabricatedData` guard |
| N188 | Post-poll voter reward faucet removed (unfunded mint) | `votePostPoll` no `poll_vote_reward` credit/supply increment; `PollCard` reward badge+toast gone; composer reward input + `pollReward` state gone; `noFabricatedData` + `integrationWiring` guards |
| N202 | Story `emoji_sliders` viewer update constrained to the response fields | `firestoreRulesCompile` (viewer may only add own `userVotes`; `sum`/`count`/`average` keys pinned); sibling of the poll/quiz rule |
| N203 | `support_tickets` owner-update carve-out removed (admin-only) | No client path updates a ticket (`supportTicketService` files, Help reads); `firestoreRulesCompile` guard |
| N205 | Request docs pin their deterministic id to the payload | `message_requests`/`friend_requests`/`follow_requests` create rules require `requestId == <from>_<to>`; a forged id could fabricate DM consent (`dmRequestFrom` reads by path); `firestoreRulesCompile` N205 static + emulator guard |
| N204 | `dmRequestFrom()` now requires `status == 'pending'` | A declined request no longer authorises the DM (nothing deletes the doc); `dmPermissionWiring` guard |
| N199-N201 | `hasOnly` keys-not-values sweep on post/comment/message update rules | `posts`: non-author carve-out narrowed to `stats.reactions` only (top-level `hasOnly(['stats','updatedAt'])` + nested `hasOnly(['reactions'])`), author may not touch `poll`/`gifts`/`stats`; `comments`: numeric `likes`/`dislikes` excluded (sharded counter owns them); messages: `readBy`/`deliveredTo` pinned to caller's own uid via `removeAll([uid()])`. Emulator-backed adversarial tests in `firestoreRulesCompile.test.js` (skip when no JVM) + static guards. |
| N206 | A private account's approved followers could not read its content | `postReadableByViewer`/`postListableShape` hard-required `authorIsPrivate == false` with no follower branch, so the profile grid returned 0 for every follower of a private account (the rule comment claimed the branch existed). Added `authorContentVisible()` (public author OR `followEdgeExists(uid(), authorId)`); the `follows` create rule now forbids self-creating an edge to a **private** target (`targetIsPrivate()`), closing the self-follow content leak the branch would otherwise open. Client grid omits the `authorIsPrivate` constraint only for an approved-follower view (`getPostsByUser({ constrainAuthorIsPrivate })` via `profileStore`); new `posts(authorId,authorIsPrivate,status,visibility,isDeleted,createdAt)` composite index. Emulator N206 + `profileFeedPagination` + `postVisibilityEnforcement` guards. |
| N207 | `counter_shards` accepts a client-written `value` for any shard id (fabricated counts) | Confirmed; **deferred with justification** — not closable by a rule alone (a legit `increment(±1)` is indistinguishable from an absolute `{value: 999999}`, and the shard id is unbound). Needs every counter mutation moved server-side (Admin SDK bypasses rules) + `allow write: if false`, a multi-service change. **This session:** the rule's misleading "overwrites are blocked so counters cannot be corrupted" comment (a forgery defence it does not provide) is replaced with an explicit `RESIDUAL RISK (N207)` note, the shape checks now also reject a non-numeric `value`, and `counterShardForgeryGuard.test.js` (static + emulator, incl. an `assertSucceeds` on the forged write) pins it. |
| N208 | A server-created community post had no `expiresAt`; the get-rule raised on the absent field | `postReadableByViewer` read `resource.data.expiresAt` directly (raises when absent → denies the read); `createCommunityPost` wrote no `expiresAt`, so the UI-created community post was unreadable by everyone. Rule now uses `.get('expiresAt', null)`; the callable writes `expiresAt: null`. Emulator N208 check. |
| N209 | Admin-gated Cloud Functions changed state with no audit record; a deployed admin callable was unreachable | Added `writeAudit` to `deleteUserData`, `generateFriendRecommendations`, `createBulkNotificationJob`, `generateAudioFingerprint`, `updateViralScore`, `backfillPrivacyBoundary`; wired the dead `FUNCTIONS.BACKFILL_POST_PRIVACY` key into a new *Maintenance Operations* panel on `AdminSystemHealthScreen` (+ `callableService.backfillPostPrivacy()`). Two new hard-failing guards: `functionsInventoryGuard.test.js` (dead `FUNCTIONS` key / ad-hoc `httpsCallable` literal / frozen unreferenced-callable baseline — may only shrink) and `adminAuditGuard.test.js` (no admin write without an audit record). |
| N210 | `daily_upload_counters` trusted the `userId` field but not the document id — a user could write another user's daily upload counter | Rule now pins the shard id to the caller (`shardId.matches('upload_' + uid() + '_...')`), mirroring `unread_counters`. Emulator N210 check + static guard in `firestoreRulesCompile.test.js`. |
| N211 | `functions/saml.js` claimed to reject encrypted assertions but did not; its attribute parser could not read the standard nested `<AttributeValue>` shape | Added an explicit encrypted-assertion rejection (was a misleading issuer-mismatch); `extractAttr` now tolerates the nested wrapper. New `privacyPropagationAndSaml.test.js` (real RSA-SHA256 verify; auth/issuer/audience/signature pins; propagation owner-scoping + bounded paging + audit). |
| N212 | Withdrawal settlement accepted a caller-supplied coin→USD rate; the economy summary re-derived the rate by hand | Removed the `coinsPerDollar` override (settlement reads the shared config only); `getEconomySummary` uses `coinsToUsd`. Canonical model in `docs/engineering/money-model.md`; `functionsContract` + `sharedConfigSync` guards. |
| N213 | Search returned blocked users' content — moderation was not enforced in `searchService` (the feed filtered blocks; search did not) | `_getBlockedUserIds(viewerId)` reads both block directions via the graph spine (`listConnections` `blocked` + new `blocked_by` kind, cached 60s); `_filterBlockedHits` (pre-fusion) and `_filterBlockedItems` (on built list) drop blocked authors; the cache key is per-viewer (`v: this._resolveViewerId(options)`); the sponsored slot is dropped when its author is blocked. `socialGraphService.LIST_SPECS` gained `blocked_by`. New `searchBlockFiltering.test.js` (guards job) + `socialGraphService.test.js` `blocked_by` case. |
| N214 | `useSearch` read `response.hasNextPage`/`response.cursor`, but the service returns `hasMore`/`nextCursor` — search pagination was dead | Both the initial search and `loadMore` read non-existent keys, so `setHasMore(false)`/`setCursor(null)` ran on every success: the load-more never appeared and `loadMore` always re-queried page 1. Fixed to read `hasMore`/`nextCursor`. New `searchPaginationWiring.test.js` (guards job) drives the real hook against a mocked service. |
| N215 | `searchService.search` returned an EMPTY page for every `page > 0` and `hasMore` was always false (asked the provider for page N, then sliced `finalHits[page*hitsPerPage…]` out of a one-page fusion list) | Now fetches a window of pages in one provider query (`SEARCH_CONFIG.PAGINATION.FETCH_PAGES`, default 5) and slices the requested page out of it; `total` reports the provider `nbHits`; `hasMore` = window overflows / provider total > consumed / window full. New `searchPaginationService.test.js` (guards job) pins page-1 content, `hasMore`/`total`/`totalPages`/`nextCursor`, short sets and the windowed provider call. |
| N216 | Comment "load more" was dead — `CommentsDrawer.handleLoadMore` sent `startAfter` and read `result.hasMore`/`result.nextCursor`, but `commentService.getCommentsByPost` never applied a cursor and never returned `nextCursor` (and its cache hit dropped both fields) | `getCommentsByPost` now reads `options.startAfter || options.cursor`, applies `startAfter(cursorSnap)`, and computes/stores/returns `hasMore`+`nextCursor` on both the fresh and cached paths. New `commentPaginationWiring.test.js` (guards job) drives the real method against a stubbed Firestore; `integrationWiring.test.js` gains a source-level pin. |
| N217 | `communityService.listCommunities` pushed a bare NUMBER into `query()` — every "Load More" (page > 1) threw; `hasMore` counted filtered rows | Real doc-id cursor pagination (`startAfterId` + `page` offset fallback); `hasMore` from the raw page size; returns `nextCursor`; the screen holds the cursor in a ref. |
| N218 | `eventService.listEvents` ignored `page` and the screen's `status` filter — Load More re-fetched page 1 and Upcoming/Live showed every status | Honors `options.status`, applies cursor pagination (`startAfterId` + offset fallback), returns `nextCursor`; three missing composite indexes added (`(status,createdAt)`, `(status,type,stats.attendeeCount)`, `(status,type,createdAt)`). New `directoryPaginationService.test.js` (guards job) drives both list methods against a stubbed Firestore whose `query()` rejects a non-constraint. |
| N219 | `messagesService.getUserConversations` fed its string `nextCursor` straight into `startAfter()` (needs a DocumentSnapshot) and set the cursor from the last doc of the 2× over-fetch window; the store re-sent that stale cursor on any non-refresh reload | Resolve the id cursor to a snapshot (`getDoc` → `startAfter(cursorSnap)`); `hasMore = snap.docs.length > pageSize` and `nextCursor` = last **returned** conversation id; the store now only continues from a cursor when the caller passes `startAfter` (a plain reload refetches page 1). New `conversationPaginationService.test.js` (guards job) drives the real method against a stubbed Firestore. |
| N220 | `SavedScreen` mapped a `likes` field (`p.likeCount \|\| 0` for posts, hardcoded `0` for videos) that nothing in the screen renders | Removed both dead assignments (a fabricated engagement value on a screen that shows no engagement). `noFabricatedData.test.js` gains a pin. |
| N221 | A block did not stop a DM: `sendMessage`'s catch downgraded `messaging/blocked` to a **message request**, which the rules accept (`dmRequestFrom`) with no block check — so a blocked user still reached their blocker's inbox | Two-layer fix: the client only offers a request for `messaging/privacy` (never a block), `sendMessageRequest` returns `{blocked:true}` on a block edge, `startDirectConversation` maps it to `{status:'blocked'}`, and `NewConversationScreen` shows "You cannot message this user."; `firestore.rules` gains `blockEdgeBetween(a,b)` AND-ed into the 2-participant conversation-create rule. New client tests + an emulator-backed rules case. |
| N222 | **Mute was a dead control**: `userService.muteUser` writes a `mutes` edge and the UI exposes mute/unmute, but `feedService` filtered only `blocks`, so muted authors' posts stayed in the feed | `feedService._getHiddenAuthorsCached` delegates to the spine's new `getHiddenAuthorIds(uid)` (unions blocked + blocked_by + muted, one bounded read) and all six feed builders hide the union. `noFabricatedData.test.js` pins the delegation; `feedService.test.js` gains delegation + fail-open tests. |
| N223 | The feed filtered only the **outgoing** block direction: it read `blocked` but not `blocked_by`, so a viewer blocked by someone kept seeing that person's posts (search already read both directions) | Folded into the shared `getHiddenAuthorIds` union, which includes `blocked_by`; both `blocks` composite indexes already exist. `noFabricatedData.test.js` pins all three spine reads. |
| N224 | The Sparks video feed had **no** moderation filter: `videoService.getVideoFeed`'s direct `videos`/`posts` fallback filtered only `isDeleted`, so blocked/blocked-by/muted creators' videos still surfaced | `videoService._getHiddenAuthors(userId)` delegates to the spine's `getHiddenAuthorIds`; the fallback filters those ids. `noFabricatedData.test.js` gains a pin. |
| N225 | `socialGraphService.getSuggestions` returned the server callable's recommendations and its friends-of-friends fallback with **no** safety filter, so a blocked/blocked-by/muted user could be suggested back | New `socialGraphService.getHiddenAuthorIds(userId)` (blocked + blocked_by + muted, bounded, fails open); `getSuggestions` drops hidden ids and the viewer on both paths. `socialGraphService.test.js` gains union + fail-open + blocked-candidate tests. |
| N226 | A block hid content in only one direction on comments (`CommentsDrawer`) and the home feed's own optimistic filter (`HomeScreen`): both read the outgoing-only `getBlockedUsers`, so a user who **blocked the viewer** still had their comments/posts rendered | New `userService.getBlockedUserIds(uid)` unions `blocked` + `blocked_by` via the spine; both surfaces use it (`getBlockedUsers` stays only for the manage-my-blocks screen). New `userServiceBlockReaders.test.js` (guards job); `noFabricatedData.test.js` pins the drawer's switch. |
| N227 | The **server** feed engine (`functions/feed.js`) read only the outgoing block direction in all three builders, so it served a blocker's posts into the blocked party's feed | New `resolveHiddenAuthorIds(userId)` unions `blockerId == userId` + `blockedId == userId`; all three builders use it. New `functionsModerationFilterGuard.test.js` (guards job) pins the two-direction helper. |
| N228 | `functions/video.js#getVideoRecommendations` ("watch next") had **no** block filter, so a blocked creator's videos surfaced in the "More videos" rail under the video being watched | The callable now loads both block directions (bounded, fails open) and drops hidden authors on the same-creator and tag paths. `functionsModerationFilterGuard.test.js` pins it. |
| N229 | `VideoComments` (the Sparks/Reels/VideoDetail comment sheet) rendered every comment with **no** block filter, so a blocked/blocked-by user's comments still showed where the post `CommentsDrawer` filtered them | The sheet loads `userService.getBlockedUserIds(uid)` and filters top-level comments and replies (and the header count). `noFabricatedData.test.js` pins the reader + both filters. |
| N230 | The story/Vibe feed (`storyService.getStoriesFeed`/`subscribeToFeed`) read the fan-out `users/{uid}/feeds` rows and filtered nothing, so a blocked/blocked-by/muted creator's Vibes still surfaced in the viewer's strip | New `storyService._getHiddenAuthors(userId)` delegates to the spine's `getHiddenAuthorIds`; both the paginated read and the realtime subscription drop hidden `ownerId`s. `noFabricatedData.test.js` pins it. |
| N231 | `functions/notifications.js#sendNotification` (the only notification writer) never consulted the block graph, so a blocked user could keep pushing notifications/push messages to the party who blocked them | The callable point-reads both `blocks/{sender}_{recipient}` and `blocks/{recipient}_{sender}` and skips with `reason: 'blocked'` when either exists (fails open). `functionsModerationFilterGuard.test.js` pins both reads + the gate. |
| N232 | `liveService.getLiveComments` (the `LiveScreen` live-chat poll) queried `live_comments` with no block filter, so a blocked/blocked-by/muted viewer's comments still appeared in the live chat | `getLiveComments` gains `_getHiddenAuthors(viewerId)` (spine `getHiddenAuthorIds`) and drops hidden `userId`s; `LiveScreen` passes `viewerId: user.uid`. `noFabricatedData.test.js` pins it. |
| N233 | `PostCard`'s `InlineComments` previewed the two latest comments on every card with no block filter, so a blocked/blocked-by commenter surfaced under the card even though the full `CommentsDrawer` filtered them | `InlineComments` loads `userService.getBlockedUserIds(uid)` and filters the preview; `PostCardContent` threads `currentUser`. `noFabricatedData.test.js` pins it. |
| N234 | `communityService.getCommunityPosts` queried the community feed with no block filter, so a blocked/blocked-by/muted member's posts still rendered in `CommunityDetailScreen` | `getCommunityPosts` gains `_getHiddenAuthors(viewerId)` and drops hidden `authorId`s; the screen passes `viewerId: user?.uid`. `noFabricatedData.test.js` pins it. |
| N235 | `eventService.listEvents` queried `events` with no block filter, so a blocked/blocked-by/muted organizer's event still surfaced in the Events/Explore discovery feed | `listEvents` gains `_getHiddenAuthors(viewerId)` and drops events whose `organizerId` is hidden (the viewer's own always pass); `EventDiscoveryScreen` passes `viewerId`. `noFabricatedData.test.js` pins it. |
| N236 | `pollService.getPolls` / `marketplaceService.getProducts` listed their collections with no block filter, so a blocked creator's polls/listings still surfaced | Both gain `_getHiddenAuthors(viewerId)` and drop documents whose `creatorId` is hidden; the Polls/Marketplace screens pass `user?.uid`. `noFabricatedData.test.js` pins it. |
| N237 | `soundService.getTrendingSounds` / `spacesService.getActiveSpaces` listed their collections with no block filter, so a blocked creator's sounds and a blocked host's live space still surfaced | Both gain `_getHiddenAuthors(viewerId)` and drop documents whose `creatorId`/`hostId` is hidden; the Sounds/Spaces screens and CreateStory pass the viewer id. `noFabricatedData.test.js` pins it. |
| N238 | `feedService.invalidateBlockCache` deleted `blocked_${userId}` and `clearUserCache` deleted `block_${userId}`, but the writer keys the hidden set as `hidden_${userId}` — both deletes were no-ops | Both now delete `hidden_${userId}`. `feedService.test.js` proves the entry is cached, removed by `invalidateBlockCache`, and refetched. |
| N239 | `RankingsScreen` lists users from the `rankings` collections with no block filter, so a blocked/blocked-by/muted user still appeared in the leaderboards | `rankingService` gains `_getHiddenAuthors(viewerId)` and all four builders drop hidden rows; the facade forwards `viewerId`, the screen passes `user?.uid`. New `rankingBlockFiltering.test.js` + `noFabricatedData` pin. |
| N240 | `socialGraphService.listConnections` / `listMutualConnections` hydrated a masked profile for a blocked/blocked-by/muted user, so the row still appeared in the viewer's own followers/following/friends lists | Both drop hidden ids (and the viewer's own) before hydration; no `viewerId` = unfiltered. `socialGraphService.test.js` + `noFabricatedData` pin it. |
| N241 | `liveService.getActiveLiveStreams` listed every live stream with no block filter, so a blocked/blocked-by/muted host's stream still surfaced in LiveScreen | Drops hidden hosts when a `viewerId` is supplied; `LiveScreen` passes `user?.uid`. `noFabricatedData` pins it. |
| N260 | **Secret communities were world-readable; the "obvious" fix silently re-opened the leak for list queries.** `firestore.rules` had `match /communities/{communityId} { allow read: if true; }`, so a stranger could point-read a `privacy: 'secret'` community (name, description, `members` privilege map). The natural fix `resource.data.get('privacy','public') != 'secret'` is itself a bug: in a **list** rule the `.get(field, default)` form stops proving a single permission outcome, so an unfiltered directory query returned the secret rows anyway (emulator-reproduced; a direct `resource.data.privacy != 'secret'` denies the whole list). The directory also had a "Secret" filter chip whose query could only be denied. | Rule now reads `resource.data.privacy` directly (`!= 'secret' \|\| uid() in resource.data.members \|\| isAdmin()`); the `{subcollection}` read follows the parent via a new `communityPrivacyOpen()` helper; `listCommunities`/`searchCommunities`/`getRecommendedCommunities` constrain `privacy in ['public','private']`; dead "Secret" chip + unreachable `filter === 'secret'` page removed; `CommunityDetailScreen` renders an explicit members-only state on `permission-denied`; dead `getCommunityWithAccess` (divergent privacy model) removed. `communityPrivacyRules.test.js` (static + emulator adversarial) pins it. |
| N261 | **Story replies were world-readable — a private replier → owner graph exposed to any client.** `story_replies/{id}` (written by `storyService._logStoryReply`) records `userId` (replier) and `toUserId` (owner) but the rule was `allow read: if true`, so any client could enumerate who replied to whom (plus each `storyId`). No client reads the collection (it is a write-only reply log), so the read served only leakage. | Read scoped to the two parties + admins: `isSignedIn() && (resource.data.userId == uid() \|\| resource.data.toUserId == uid() \|\| isAdmin())`. `storyReplyPrivacyRules.test.js` (static + emulator adversarial) pins it; registered in the `guards` CI job (static list + emulator step). |
| N262 | **Message-poll votes were world-readable although the feature declares them anonymous.** `polls/{pollId}/votes/{voteId}` keys the vote by the voter's uid and stores `optionIndex`, but the rule was `allow read: if true`; `messagesService.createPoll` defaults to `anonymousVotes: true`, so any client could list a conversation poll's voters and how each voted. | Read scoped to the voter + admins (`voteId == uid() \|\| isAdmin()`). The only reader (`getPollResults`) had no caller — the whole message-poll UI (`createPoll`/`votePoll`/`closePoll`/`getPollResults`) was dead — so those four methods and their facade re-exports are removed. The live creator-poll path is separate and already server-only (flat `poll_votes` deny-all; `posts/{id}/poll_votes` voter-only). |
| N263 | **Least-privilege reads for platform telemetry and live presence.** `system_health/{docId}` (only client reader = the admin health probe) and `live_viewers/{streamId}_{viewerId}` (names who is watching a stream; only client read = the host-only `getLiveViewers`) were both `allow read: if isSignedIn()`, exposing platform internals and the live presence graph to every user. | `system_health` read is `isAdmin()`. `live_viewers` read is scoped to the viewer, the stream host and admins via a new `liveStreamHost(streamId)` helper (`resource.data.userId == uid() \|\| liveStreamHost(resource.data.streamId) == uid() \|\| isAdmin()`); the list query filters `streamId`, so the helper resolves a single host document. `livePresenceAndHealthPrivacyRules.test.js` (static + emulator adversarial) pins both; registered in the `guards` CI job. |
| N264 | **Least-privilege reads for server bookkeeping, tenant SSO config and collaboration membership.** `system/{docId}` (coin-supply + scheduler cursors), `enterprise_tenants/{tenantId}` (SAML IdP metadata/ACS URLs) and `collaboration_projects/{projectId}` (+ its `team` roster) were all `allow read: if isSignedIn()`. None has a client reader that needs it (`system` = Cloud Functions only; `enterprise_tenants` = `functions/saml.js` only; the collaboration dashboard lists the viewer's own projects), so each leaked platform internals or membership/role data to any signed-in user. | `system` + `enterprise_tenants` reads are `isAdmin()`; `collaboration_projects` and subcollections are scoped to owner/member/admin via a new `collabProjectAccess(projectId)` helper (owner check + `exists(.../team/$(uid()))`); the dashboard query proves access. `livePresenceAndHealthPrivacyRules.test.js` (static + emulator adversarial) covers all three. |
| N265 | **Share records were world-readable — a private who-shared-what log.** `shares/{shareId}` records `userId` (sharer) + `postId` but was `allow read: if true`; no client reads it (the share count is a separate sharded counter), so the read only exposed who shared which post. | Read scoped to the sharer + admins. `livePresenceAndHealthPrivacyRules.test.js` (static + emulator adversarial) covers it. |
| N266 | **`events/{eventId}` is world-readable while a new event defaults to `status: 'draft'`.** The rule `allow read: if true` lets anyone who guesses the random event id read an unpublished event (title, description, location, coordinates, ticket tiers). | ⏸️ **DEFERRED** — a status-gated rule breaks `eventService.getUserRegistrations` (its `where('attendees.<uid>.status','in',[...])` list query cannot prove the status/organizer predicate; rules are not filters). Needs the registration list served server-side; exposure is non-enumerable and documented rather than half-fixed. |
| N267 | **`stories/{id}/analytics_shards` leaked one creator's private engagement to every signed-in user.** The shards (forwardTaps/backTaps/completions/comments/replies) are rolled up server-side and the creator sees `stats` on the story doc; no client reads the raw shards, yet the rule was `allow read: if isSignedIn()`. | Read scoped to the creator + admins (`vibeData().userId == uid() || isAdmin()`). `livePresenceAndHealthPrivacyRules.test.js` (static) pins it. |
| N268 | **`collections/{id}/items` (saved posts) was readable by any signed-in user.** The parent collection is owner-private, but the `items` read was a bare `isSignedIn()`, so any user could enumerate another user's saves. | The `items` read now follows the parent ownership (`get(.../collections/$(collectionId)).data.userId == uid() || isAdmin()`), matching the write clauses. `livePresenceAndHealthPrivacyRules.test.js` (static) pins it. |
| N269 | **`live_gifts/{giftId}` (live-gift ledger) was readable by every signed-in user.** The doc records senderId/recipientId/giftType/coinValue, written by `sendLiveGift` (Admin SDK); no client reads it, and the sibling `gift_transactions` is already party-scoped. | Read scoped to the two parties + admins (`senderId == uid() || recipientId == uid() || isAdmin()`). `livePresenceAndHealthPrivacyRules.test.js` (static) pins it. |
| N270 | **`highlights` + `highlightStories` are world-readable (LOW).** They store userId + storyId but no story content; `archived_stories` is private (spec §31), so a world-readable highlight leaks only the reference. | ℹ️ **INFORMATIONAL/DEFERRED** — public-vs-private highlight is a product decision (no `privacy` field); recorded, not changed. |
| N271 | **`reputation/{userId}` was readable by every signed-in user.** Server-written (isAdmin) and `getUserReputation` has no caller, so a bare `isSignedIn()` read exposed every user's standing. | Read scoped to subject + admins (`isOwner(userId) || isAdmin()`). `livePresenceAndHealthPrivacyRules.test.js` (static + emulator) pins it. |
| N272 | **`post_analytics/{postId}` was world-readable.** Server-written, no writer today, but a public read would leak future analytics; only consumer is the author-only panel. | Read scoped to author + admins (`resource.data.authorId == uid()`). Guard pins it. |
| N273 | **`posts/{postId}/daily_stats` was world-readable — via the posts-subcollection wildcard** (`match /{subcollection}/{docId}` granted any signed-in read, overriding the specific block). | Specific block reads author/admin; wildcard now excludes `daily_stats` so it cannot re-open the read. Guard pins both. |

| N274 | **`event_feedback/{feedbackId}` (each attendee's event rating + comment) was readable by every signed-in user.** The row is keyed `event_${eventId}_${uid}`; the only client reader fetched the whole list to find the caller's own rating. | Read scoped to the attendee + admins; `eventService.getMyEventFeedback` now point-reads the caller's own doc (replaces the list `getEventFeedback`); `EventDetailScreen` updated. Guard (static) pins it. |

| N275 | **`creator_profiles/{userId}` (creator bio/links + eligibility/standing) was readable by every signed-in user.** Only reader is the owner's own status view. | Read scoped to owner + admins. Guard (static) pins it. |
| N276 | Status-doc honesty (`ARVDOUL_STATUS.md` claimed 59/59 / 100% while citing 40 non-existent paths) | rewritten as an evidence-based ledger; `statusDocHonestyGuard.test.js` (guards job) fails if a documented path stops resolving or the 59/59 claim returns |
| N277 | Lite-Mode toggle + pull-to-refresh were dead/absent (claimed complete) | `src/hooks/usePullToRefresh.js` + `src/components/Shared/PullToRefresh.jsx` wired into `HomeScreen`; reactive Lite-Mode toggle in Settings + i18n (7 locales); `pullToRefresh.test.js` |
| N278 | Logger remote sink (#15) | `setLogSink`/`flushLogSink` + batched fetch transport (`VITE_LOG_ENDPOINT`); `loggerSink.test.js` |
| N279 | Event-payload contract (#17) | `eventPayloadContract.test.js` pins producer↔consumer payload shapes; `guards` job |
| N280 | MFA lockout trap fixed | service surfaces resolver; AuthContext + LoginScreen + SettingsScreen wired; `getEnrolledMFAFactors`; `mfaWiring.test.js` |
| N281 | Design-system emoji icons removed | `ErrorState`/`PermissionDenied` use lucide icons; emoji-icon guard added |
| N282 | PWA update flow unreachable | sw.js waits for SKIP_WAITING; banner reloads on controllerchange; `swUpdateFlow.test.js` |
| #12 | Design-system consolidation (continued): raw brand hex ratcheted **349 across 44 files → 58 across 7 files**. Migrated profile components, search components, Shared nav/appbar, theme context, AudioEditor, ThumbnailDesigner, PerksRewards, Rankings, CreatePost, Reels, Stories, Search, EditProfile, ImageEditor. Remaining 7 files are the policy-frozen signup/login/onboarding screens. | `brandHexRatchetGuard` (baseline lowered); build + full suite green. |

New guards registered in the hard-failing `guards` CI job: `firestoreQueryIndexMap`,
`a11yInteractiveGuard`, `brandHexRatchetGuard`, `sharedStatePrimitivesGuard`,
`storyExpiryGuard`, `functionsInventoryGuard`, `adminAuditGuard`,
`privacyPropagationAndSaml`, `searchBlockFiltering`, `searchPaginationWiring`,
`searchPaginationService`, `commentPaginationWiring`, `directoryPaginationService`,
`conversationPaginationService`, `userServiceBlockReaders`, `functionsModerationFilterGuard`,
`communityPrivacyRules`, `storyReplyPrivacyRules`, `livePresenceAndHealthPrivacyRules`.

## Fabrication / integrity sweep (this session)

| # | Item | Evidence |
| --- | --- | --- |
| N283 | `CreatePost.publishPost` fabricated a synthetic uid + "Arvdoul Creator" when no session resolved | `publishPost` throws "You must be signed in to publish"; `noFabricatedData` pin |
| N284 | `firestoreService.createPost` signed in anonymously / trusted a caller-supplied `authorId` | both fallbacks removed; `noFabricatedData` pin |
| N285 | Placeholder author identity (`"Arvdoul User"`, `User_<uid>`, `user_<uid>`, `'creator'`) across write + hydrate paths | read-model `pickDisplayName`/`deriveHandle` in CreatePost, firestoreService, HomeScreen, commentService, SavedScreen, videoService; render sites omit empty handles; `noFabricatedData` block |

Verification: 152 suites / 1,713 passed (5 skipped); eslint 0 errors; build green.

| N293 | `firestoreService.subscribeToPostStats` mapped `stats.likes ?? 0` (and views/comments/shares/saves) | each counter via `unknownNumber`; PostCard reducer keeps the prior value; `noFabricatedData` pin |
| N294 | `rankingService.getUserBadges` summed `Number(p.stats?.likes \|\| p.likes \|\| 0)` | each counter via `unknownNumber`; aggregate `null` if any counter unknown; `noFabricatedData` pin |
| N295 | `AudioCard` hardcoded the OS media-session artist as "Arvdoul Creator" for every audio post | real `authorName` from `PostCard`; `pickDisplayName([authorName], { fallback: null })`; artist omitted when unknown; `noFabricatedData` pin |
| N296 | `CreatorPayoutScreen` rendered `-${tx.amount?.toLocaleString?.() \|\| tx.amount}` beside a hardcoded "Completed" badge | amount via `unknownNumber` ('—'); badge derived from the ledger `status`/`state` (Completed/Pending/Failed, none when unknown); `noFabricatedData` pin |
| N297 | `analyticsService` new-creator fallback summed `(s.likes \|\| 0)+(s.comments \|\| 0)+(s.shares \|\| 0)` | each counter via `unknownNumber`; engagement total `null` if any unknown; `noFabricatedData` pin |
| N298 | `communityService.getCommunityStats` returned `community.stats?.memberCount \|\| 0` + weighted `(stats.likes \|\| 0)` | every counter via `unknownNumber`; weighted `weeklyEngagement` `null` if any unknown; `noFabricatedData` pin |
| N299 | `storyService` insights returned `story.stats?.comments \|\| 0` (…completionRate/forwardTaps/backTaps/replies/shares); `monetizationService.getCoinLeaderboard` mapped `coins \|\| 0` + a position title from that 0 | both via `unknownNumber`; unknown balance stays `null` with no fabricated title; `noFabricatedData` pin |

Latest verified: 152 suites / 1,732 passed (5 skipped); eslint 0 errors; build green (N299).

| N286 | Uncoerced transaction/bounty/reputation amounts rendered fabricated numbers | `unknownNumber()` guard in CoinsScreen + QuestionCard; `noFabricatedData` round-4 pin |

## Next exact task

Backlog item #1 is closed (CollectionsScreen, QuestionCard, CoinsScreen, ConversationSettingsScreen and the admin payout/tx amounts all route through `unknownNumber`). Next: sweep the remaining `x || 0` **display** coercions in the analytics/ranking services (`analyticsService` dailyStats, `rankingService` totals, `achievementService` progress) and decide, per site, whether the value is a real derived aggregate (0 is honest) or a missing-data sentinel (must be `unknownNumber`).

## Next exact tasks (dependency order)

1. **#12 Design-system consolidation** (continued) - migrate the remaining ~44 files
   of raw brand hex to `tokens`/`BRAND_GRADIENT`; lower `scripts/brandHexBaseline.json`
   in the same change (the ratchet may only shrink).
2. **#11 i18n rollout** - extract strings per screen group (only 3 screens use
   `useTranslation` today).
3. **#10 Video/Sparks** - verify the report -> moderator-queue path end to end
   (`video_reports` -> `adminListModerationReports`), plus adaptive player mounting.
4. **#9 Story/Vibe lifecycle** (done: expiry in the read path, N185) - remaining:
   the scheduled server sweep already deletes + keeps archived media; a reaction/
   reply test is still open.
5. **#14/#15/#17** - offline pending surfacing, observability sink, contract ratchet.

## Read-authorization + fabrication sweep (continuation)

| # | Item | Evidence |
| --- | --- | --- |
| N301 | Content collections shipped `allow read: if true` (world-readable): `comments` + `likes`/`dislikes`/`reactions`/`history`, `highlights`, `events` (+ subcollections), the `usernames` registry, `reaction_shards`, story reaction children, and the advanced-creator suite (`spaces`, `sounds`, `marketplace_items`, `polls`, `badges`, `user_badges`, `copyright_registry`, `previous_usernames`) | each read scoped to its real consumer — signed-in for `comments`/`usernames`/`events`/creator suite, owner-only for `highlights` + comment `history`, `allow read: if false` for comment `reactions`; new `readScopePrivacyRules.test.js` (guards job) fails on any `allow read: if true;` |
| N302 | `rankingService.getUserBadges` fabricated `0` follower/following counts (`Number(x \|\| 0)`) | both via `unknownNumber(...)`; unknown stays `null`; `noFabricatedData` pin |
| N303 | `PassportScreen` fabricated `0` verified-visa count / rendered literal `undefined`; `SpacesScreen` called `.toLocaleString()` on an unread tip total; `eventService.submitFeedback` returned `feedbackScore ?? 0` | all via `unknownNumber` (unknown → '—'); `noFabricatedData` pin |
| N305 | Auth screens (login / forgot-password / verify-email) advertised "End-to-end encrypted" + "Military-grade security" — unbackable claims | footers now say "Encrypted in transit (TLS)" + "Protected/Verified by Firebase Auth"; `noFabricatedData` pin for the three screens |
| N207 | `counter_shards` rule comment claimed overwrites were blocked "so counters cannot be corrupted" — a forgery defence it does not provide (a rule cannot tell `increment(±1)` from an absolute `{value: 999999}`) | comment replaced with an explicit `RESIDUAL RISK (N207)` note; `value is number` added to the shape checks; new `counterShardForgeryGuard.test.js` (static + emulator, incl. an `assertSucceeds` on the forged write) pins it |
| N304 | `events.privacy` written by `createEvent`/`updateEvent` but never rendered, read or enforced — a dead control implying private events | field removed from `eventService` + `CreateEventScreen`; rules note corrected; `readScopePrivacyRules` pins `eventService` no longer writes/reads `privacy` |
| N306 | `videoReadPrivacyRules.test.js` had a wrong assertion (anon must be denied a **public** video) and was **not wired into any CI emulator step**, so it never ran — the wrong assertion would have failed the moment Java was present | assertion corrected (anon may read a public video, like a public post/community; anon is still denied a private one — added), and the suite is now in the `guards` emulator step alongside `notificationCounterRuleShape` |
| N307 | Settings "Show active status" toggle persisted `settings.privacy.showActiveStatus` (no reader; presence visibility is owned by `profile.privacy.presence`) and duplicated the "Live Online Presence" scope selector beside it — plus other unread persisted fields (`user_settings.privacy.{showOnline,allowMessages,allowComments}`, `user_settings.notifications.*`, `user_settings.appearance.theme`, `messagesService.getUserPrivacySettings` output `showOnline`/`allowDiscovery`/`groupInvitePermission`, `GROUP_INVITE_PERMISSIONS`/`DEFAULT_GROUP_INVITE_SETTING`, `settings.activeStatus` i18n key) | toggle + key removed (presence controlled solely by the scope); dead seed/constants trimmed; `settingsWiring.test.js` pins `showActiveStatus`/`spatialAudio`/`streamQuality` absent |
| N308 | `EventCard` rendered five badges from fields no writer produces (`event.coinReward`, `event.friendsGoing`, `event.scarcity.seatsLeft`, `event.stats.interested`, `event.gravity`) and three prop-gated blocks from props no render site passes (`matchScore`, `attendanceVelocity`, `friendProximity`/`userAffinity`, `distanceKm`) — the `gravityLevel` tier was always `'low'` and the "Matches you"/"close friends" badges never rendered | all five phantom reads + five dead props removed, plus the `getGravityLevel` helper and its `gravityLevel` consumer; glow now reflects only `urgent`/`isLive`; `noFabricatedData` pins every removed identifier |
| N309 | `LinkCard` fabricated a green "Trusted domain" safety verdict (defaulted `onGetSafetyScore` → `{score:100}`), a view count, and two fake-success controls (Save → "Saved to bookmarks", Tip → "Sent N coins"), all from props `PostCard` never passes; the AI-summary/trending branches were permanently dead; an IndexedDB metadata cache had no producer | card renders only the publisher-supplied Open Graph fields (title falls back to the bare hostname); keeps the real external link, native share sheet and URL-derived YouTube/Vimeo embed; unreachable cache + fabricated controls + dead props removed; `noFabricatedData` pins every removed identifier |
| N310 | `eventService.getEventStats` fabricated a `0` rating (`event.stats?.feedbackScore \|\| 0`) and a `100%` attendance for capacity-less events | rating via `unknownNumber` (unknown stays `null`); capacity-less event reports no percentage; `noFabricatedData` pins both |
| N311 | `ImageCard`'s Save/Report buttons toasted "Saved to bookmarks"/"Report submitted" while `PostCard` passed no `onSave`/`onReport` — nothing was written or sent, on every feed image | `onSave` → `PostCard.handleSave` (optimistic `savePost`/`unsavePost` + offline queue), `onReport` → new `handleReportImage` via the canonical `reportContent` callable; unwired fallbacks now fail honestly; `noFabricatedData` + `integrationWiring` pins |
| N312 | `VideoCard` advertised four swipe gestures (`Share`/`Details`/`Next Video`/`Previous Video`) that `PostCard` never wires (`onShare`/`onOpenDetails`/`onNext`/`onPrev` all undefined) — the hint flashed and the optional-call was a no-op | each swipe branch gated on its handler being present (hint only shows then); `noFabricatedData` pins the gating |
| N313 | `VideoCard` always showed a Settings (quality) button that opened an empty menu — `PostCard` passes no `qualities`; also destructured an `index` prop no render site passes | quality button + menu gated on `qualities.length > 0`; dead `index` prop removed; `noFabricatedData` pins both |
| N314 | `liveService` seeded `stats.peakViewers: 0` and never updated it (no writer), yet `endLiveStream` (return + audit), `getLiveEarnings` and `getLiveAnalytics` reported it as a measured peak | seed + all three read/audit sites removed; the writer-maintained counters (`viewerCount`/`totalViewers`/tips/gifts/coins) stay; `noFabricatedData` pins both |
| N315 | `achievements/{uid}/items` + `titles/{uid}/items` were `allow read: if isSignedIn()` — a user's badges/titles were readable by any signed-in client regardless of the `achievements`/`titles` privacy scope (client-masking only) | new `profileSectionReadable(userId, section, defaultScope)` helper mirrors the client decision; both collection + `items` reads use it; `readScopePrivacyRules` static + emulator tests (13/13 live) |
| N316 | `storyService.answerQuiz` credited the quiz coin reward **inside** its `runTransaction` callback (a retryable context) — a double-mint risk and an abort on cap/network failure | reward computed in the transaction; credit runs after commit with a deterministic idempotency key; `transactionOrderGuard` fails any transaction callback awaiting a money callable |
| N317 | `HomeScreen` rewarded-ad toast announced a fabricated `+0 Coins` when the server returned no `coinsAdded` | toast only announces a server-reported amount, else "Reward credited!" |
| N318 | `AudioCard`'s smart-preload read `isNearViewport`, a prop `PostCard` never passes (it passes `isVisible`) — preload was permanently `'none'` | dead prop removed; preload keys off the real `isVisible` signal |

CI: the `guards` emulator step now also runs `readScopePrivacyRules`, `counterShardForgeryGuard`, `videoReadPrivacyRules` and `notificationCounterRuleShape`; all were executed against a local Firestore emulator (10 emulator suites, 117 tests, 0 skips) — the emulator-backed adversarial checks genuinely pass, not just skip.

Latest verified: **155 suites / 1,775 passed (5 skipped)**; `npx eslint src/ functions/ --quiet` exit 0 (0 errors); `npm run build` green. Emulator-backed `readScopePrivacyRules` 13/13, `firestoreRulesCompile` + `firestoreRulesCoverage` + `livePresenceAndHealthPrivacyRules` 70/70 (N313-N318).

## Continuation session (design-token + avatar consolidation)

| # | Item | Evidence |
| --- | --- | --- |
| N337 | The Tailwind `bg-arvdoul-gradient` utility re-declared the brand gradient as a config literal (Tailwind cannot import the ESM token) with nothing pinning the two | `designTokenDriftGuard` asserts the config literal is byte-identical to `tokens.color.brand.gradient` |
| N338 | `themePalettes.js` declared the brand violet in decimal form (`rgba(139,30,243,..)`) despite the guard requiring palettes to derive from tokens | glows/cards derive from `brandRgba()`; new `brandVioletRgbaRatchetGuard.test.js` (baseline `scripts/brandVioletRgbaBaseline.json`, 73 → 64) wired into `guards` |
| N339 | `TopAppBar`/`FollowButton` hand-wrote brand-violet glows in decimal (JS string contexts) | migrated to `brandRgba()`; ratchet baseline lowered |
| N340 | Two deterministic-avatar generators (`avatarUtils.generateDefaultAvatarSvg`, `userService.generateDefaultAvatar`) each carried their OWN palette list with DIFFERENT secondary shades — the same user rendered a different avatar in the feed vs the profile | palette single-sourced in `avatarUtils`; `userService` imports it; `avatarPaletteConsistency.test.js` (guards job) fails on a second list or the old shades; semantic-hex baseline shrinks |
| N341 | `BottomNav` brand-violet radial/linear gradients hand-wrote the decimal literal | migrated to `brandRgba()`; ratchet baseline lowered |
| N342 | Eleven more JS-string brand-violet literals survived N339/N341: the six auth/onboarding `--glow-a`/`--rim-1` style vars, `ImageEditor`, `editorConstants`, `OfflineIndicator`, `SearchScreen`, and the `EqualizerModule` canvas gradient (which also hard-coded brand indigo/blue decimals) | all derive from `brandRgba()`; new generic `brandHexRgba(token, alpha)` for the canvas stops; `designTokens.test.js` pins it; ratchet baseline 73 → 38 (residue is Tailwind arbitrary-value classes) |
| N343 | `ProfileProgression` fabricated a 0-XP bar from a missing XP value (`experience` defaulted to `0` -> `getLevelInfo(0)`) | `experience` defaults to `null`; curve consulted only when `hasExperience`; XP bar gated on `xpInfo`; `noFabricatedData.test.js` pins all three |

**Emulator verification (this session).** `openjdk-21` installed via `sudo apt-get`;
`npx firebase-tools emulators:exec --only firestore` ran the 12 rules/graph
adversarial suites for real: **12 suites / 129 tests passed, 0 skipped**.
`--only storage` ran `storageRulesPathAlignment` for real: **10 tests passed**.
The emulator-gated assertions execute (not silently skip) with Java present.

Latest verified: **162 suites / 1829 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green.

## Continuation session (viewer-state reality: comments + pending follow requests)

| # | Item | Evidence |
| --- | --- | --- |
| N356 | `VideoComments` hardcoded `isLiked: false`; `commentService.likeComment` toggles (rejects a repeat), so an already-liked comment rendered unliked and the toggle threw + reverted — the like silently no-op'd | `VideoComments` seeds `isLiked` from the comment doc's `likesBy` (viewer uid resolved via `getAuthInstance`); `commentLikeStateRealityGuard.test.js` (guards job) |
| N357 | A follow against a private account (`follow_requests/{from}_{to}`, `status: 'pending'`, no `follows` edge) was unmodelled: the graph spine returned `requestStatus: null`, `getFollowStates` dropped it, and four follow controls re-offered "Follow" (a second tap filing a duplicate request) with no way to withdraw | `socialGraphService.getRelationship`/`getEdgeSet` read the pending row (actor-equality + other-party `in` + `status == 'pending'`, only when the follow edge is wanted); `userService.getFollowStates` surfaces `requestStatus`; `ReelsScreen`/`SearchScreen`/`VideoCard`(+`VideoFeed`)/`CreatorCarousel` render a distinct Requested state and cancel via `cancelFollowRequest`; `follow_requests` composite index declared; `followRequestStateRealityGuard.test.js` (guards job) |

Latest verified: **1870 tests / 1865 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N358: two more follow surfaces + preview dead controls)

| # | Item | Evidence |
| --- | --- | --- |
| N358 | `PostOptionsDrawer` read `getFollowStatus` but dropped `requestStatus`, so a requested private author's post menu showed **Follow** (second tap = duplicate request) and a `followUser` `{requested:true}` result was optimistically rendered as a completed follow; `ProfilePreviewScreen`'s visitor perspective omitted `requestStatus` from the relationship handed to the capability engine; `ProfileHeroSection` rendered Follow/Message/Call/Gift/More with no handler in preview mode (dead controls) | drawer carries `followRequested` (from `requestStatus === 'pending'`), offers **Cancel request** via `cancelFollowRequest`, and reconciles `res.requested`/`requestStatus === 'pending'` into the requested state; preview passes `requestStatus`; hero disables + "Preview only"-labels the handler-less controls; `followRequestStateRealityGuard.test.js` (extended) and `postCardFieldRealityGuard.test.js` (new drawer test) lock it |

Latest verified: **1872 tests / 1867 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N359: ConnectionsScreen real per-row follow state)

| # | Item | Evidence |
| --- | --- | --- |
| N359 | `ConnectionsScreen` rendered `isFollowing={citizen.isFollowing}` but the spine's projection never attaches that edge, so every row showed **Follow**; the Friends tab called `getMutualFriends` (bare profiles) for others and filtered `getFollowers` on the never-set `f.isFollowing` for the owner, so it was empty for everyone | one bounded `getFollowStates(currentUserId, allIds)` over the union of the three lists stamps real `isFollowing`/`requestStatus`; Friends tab uses canonical `userService.getFriends`; `followRequestStateRealityGuard.test.js` pins it |

Latest verified: **1873 tests / 1868 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N360: NotificationsScreen network follow truthfulness)

| # | Item | Evidence |
| --- | --- | --- |
| N360 | `NotificationsScreen` `handleToggleFollow` appended the user to `following` + toasted "Following" even when `followUser` filed a pending request (private target), and the "Follow Back" button decided follow/unfollow from `following.some(...)` (the viewer's own list) so an already-followed follower showed "Follow Back" and tapping it unfollowed them | load resolves `getFollowStates` over the follower+following union into `followStates`; row renders **Requested** with real withdraw via `cancelFollowRequest`; handler reconciles `result.requested`/`requestStatus === 'pending'`; `followRequestStateRealityGuard.test.js` locks it |

Latest verified: **1874 tests / 1869 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N361: ProfilePublicScreen private-gate label)

| # | Item | Evidence |
| --- | --- | --- |
| N361 | `ProfilePublicScreen`'s "This Account is Private" gate labelled its CTA `{isFollowing ? 'Requested' : 'Follow to View'}`; `isFollowing` is false for a pending request, so a requester still saw "Follow to View" | CTA branches on `requestStatus === 'pending'`; `followRequestStateRealityGuard.test.js` pins it |

Latest verified: **1875 tests / 1870 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N362: ProfilePublicScreen friend-request keying)

| # | Item | Evidence |
| --- | --- | --- |
| N362 | `sendFriendRequest`/`cancelFriendRequest` used the raw `userId` route param (which may be a `@handle`), so the `friend_requests/{fromUid}_{toUid}` document was filed under a handle-keyed id that the accept path could never match | both resolve `friendTargetUid = profileData?.id || profileData?.uid || routeUserId`; `followRequestStateRealityGuard.test.js` pins it |

Latest verified: **1876 tests / 1871 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N363: NotificationsScreen connect fallback)

| # | Item | Evidence |
| --- | --- | --- |
| N363 | `handleConnectUser`'s friend-request fallback called `followUser` and always set `'following'` + toasted "Now following" even for a private target (pending request) | fallback reconciles `result.requested`/`requestStatus === 'pending'` into `'requested'`; `followRequestStateRealityGuard.test.js` pins it |

Latest verified: **1876 tests / 1871 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N364: video viewer follow state)

| # | Item | Evidence |
| --- | --- | --- |
| N364 | `VideoDetailScreen` passed neither `isFollowing` nor `onFollow` to `VideoCreatorInfo`, so the creator card's Follow control was dead and always read "Follow"; a pending private-account request had no state and no cancel | screen resolves `getFollowStatus(uid, video.userId)`, branches pending into a disabled "Requested" with `cancelFollowRequest`, passes `isFollowing`/`requested`/`followBusy`/`onFollow`; `followRequestStateRealityGuard.test.js` pins it; the verified badge's rogue purple→pink gradient migrated to `bg-arvdoul-gradient` |

## Continuation session (N365, N366)

| # | Item | Evidence |
| --- | --- | --- |
| N365 | `CreatorPayoutScreen.sumCredits`/lifetime-withdrawn and `VideoAnalyticsScreen.lastPayoutCoins` coerced an absent ledger `amount` to `0`, understating a measured figure | every sum returns unknown (`null` → "—") when any contributing amount is unknown; `noFabricatedData.test.js` pins `unknownNumber` + absence of `Number(tx.amount) \|\| 0` |
| N366 | `ProfilePublicScreen` passed `onFriendPress={(friend) => navigate(\`/profile/${friend.id}\`)}` but `ProfileSocialContext` calls the handler with no argument → TypeError on every tap | handler routes to `/profile/:userId/friends`; `profileReadModel.test.js` fails on a `(friend) =>` handler; `VideoFeed`'s `onFollow` no longer fabricates `{ isFollowing: true }` |

Latest verified: **1878 tests / 1873 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

## Continuation session (N367: dead handler-prop wiring sweep)

| # | Item | Evidence |
| --- | --- | --- |
| N367 | Handler props that a component referenced (or wired into an `onClick`) but that **no caller ever passed** and that were never guarded — always-undefined functions: `TimelineToolbar`'s Back/Crop/Settings buttons (`onBack`/`onCrop`/`onOpenSettings`), `TextTool`'s whole "Text Layers" section (`textLayers` + its three layer callbacks), `MessageBubble.onLongPress`, `VideoGiftModal.onSendGift`, `MessageInput.onStartRecording`/`onStopRecording`, `ExportModal.onCompleteExport`, and `ProfileSocialContext`'s `cursor-pointer` shared-communities card calling a never-passed `onCommunityClick` | dead buttons/props removed (`TimelineToolbar`, `TextTool`, `MessageInput`, `ExportModal`, `ToolPanels`, `VideoGiftModal`, `MessageBubble`); `SplashScreen.onRenderError` is now wired in `AppRoutes` to `logger.error`; the communities card is a read-only summary; new hard-failing `deadHandlerPropGuard.test.js` (guards job) fails if a handler is referenced/executed but never passed and never guarded; complementary `deadDataPropGuard.test.js` fails if a data prop is used only as a JSX truthiness gate but no caller passes it |

Latest verified: **1880 tests / 1875 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job. `AppRoutes`
also wires `SplashScreen.onMetrics` → `metricsService.recordHistogram` (the
startup timings previously had no sink).

## Commands to resume

```
git status
NODE_OPTIONS=--experimental-vm-modules npm run test -- --watchAll=false
npm run build
npm run lint
```

## Continuation session (N324: coin balance moved to users_private)

| # | Item | Evidence |
| --- | --- | --- |
| N324 | A user's coin balance (`users/{uid}.coins`) was readable by every signed-in client (`allow read: if isSignedIn()`), because Firestore rules cannot field-mask a readable document — `economicStatus` (default ONLY_ME) was enforced only by the client projection. A financial figure readable by every signed-in user. | Authoritative balance moved to `users_private/{uid}` (owner/admin only). New `functions/coinBalance.js` (`readCoinBalance`/`writeCoinBalance`/`availableFrom`) is the single accessor; `monetization.js`, `withdrawalSettlement.js`, `video.js`, `xpAward.js` repointed; `admin.js` + `monetization.js` coin-supply aggregate sum `users_private`; `privacyMigration.js` backfills `coins`/`lockedCoins`; client `monetizationService.getBalance` / `walletService` / `analyticsService._readLiveCoinBalance` read the private doc; `userService.createUserProfile` seeds the starting balance on the private doc (create-only). Rules: `coins`/`lockedCoins` added to `touchesPrivateProfileFields`, the users create pin/denylist updated, and the `users_private` create pins `coins == 100` and refuses `lockedCoins`. Cross-user `getCoinLeaderboard` (needed a public balance, no screen caller) removed with its test. `coinBalanceBoundary.test.js` (new, guards job) + `profilePiiBoundary.test.js` + `sharedConfigSync.test.js` + `noFabricatedData.test.js` pin the boundary. Legacy accounts keep a `fallbackToPublic` read until `privacyMigration` runs. |

Latest verified: **1889 tests / 1884 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green. Emulator-backed suites skip locally (no
`FIRESTORE_EMULATOR_HOST`) and run for real in the `guards` CI job.

### Remaining production-only requirement for N324

Run `functions/privacyMigration.js` against production (admin-gated callable /
scheduled sweep) to copy `coins`/`lockedCoins` into `users_private/{uid}` and
scrub them from `users/{uid}`. Until it runs, `readCoinBalance(..., { fallbackToPublic: true })`
keeps reading the legacy public field so no balance is lost.

## Continuation session (N368: event attendee roster)

| # | Item | Evidence |
| --- | --- | --- |
| N368 | `EventDetailScreen`'s attendee tab rendered `data.displayName \|\| 'User'` over a generic gradient blob. `events/{id}.attendees` stores only `{status,ticketTier,registeredAt,checkedInAt}` per uid (no name — `functions/events.js` never writes one), so **every** attendee showed the placeholder "User" and the real identity was unrecoverable. | New `getEventAttendees` callable resolves the roster server-side (bounded `documentId() in` `users` batches, placeholder stripping, `[]` for a non-attendee); `eventService.getEventAttendees` + `FUNCTIONS.GET_EVENT_ATTENDEES`; the screen renders the resolved roster with real avatars (`getSafeAvatarUrl`) plus a skeleton and a permission empty-state; the callerless `subscribeToAttendees` was removed. `eventAttendeeRosterGuard.test.js` (guards job) pins it. |

Latest verified: **1893 tests / 1888 passed (5 skipped)**; `npm run lint` exit 0
(0 errors); `npm run build` green.

## Continuation session (N266: draft-event read exposure closed)

Java 21 was installed in the workspace (`apt-get install -y default-jre-headless`),
so the Firestore/Storage emulators now run locally — every emulator-backed rules
suite is verified for real here, not only in CI.

| # | Item | Evidence |
| --- | --- | --- |
| N266 | `events/{eventId}` was `allow read: if isSignedIn()`, so any signed-in client could read a `draft`/`cancelled`/`archived` event by id (title, location, coordinates, ticket tiers) even though no discovery list surfaces it. The earlier deferral was blocked because `eventService.getUserRegistrations`'s list query (`where('attendees.<uid>.status','in',…)`) cannot prove the status/organizer predicate (rules are not filters). | Registration list moved server-side: new `getUserEventRegistrations` callable (Admin SDK, minimal projection, bounded `limit(100)`, in-memory sort to avoid an undeclarable per-uid map composite index); `eventService.getUserRegistrations()` delegates to it and `FUNCTIONS.GET_USER_EVENT_REGISTRATIONS` was added. Rule is now `isSignedIn() && (status in ['published','open','live','ended'] || organizerId == uid() || attendees[uid()] != null || isAdmin())`. `readScopePrivacyRules.test.js` updated: static gate assertions + an emulator test proving draft → organizer/attendee succeed and stranger/anonymous fail, published → any signed-in succeeds. |

Latest verified: **1893 tests / 1888 passed (5 skipped)**; emulator rules suites
(`readScopePrivacyRules`, `firestoreRulesCompile`, `socialGraphEdgeReadRules`,
`counterShardForgeryGuard`, storage path alignment, +7 more) — **139 tests
passed** locally against the Firestore/Storage emulators; `npm run lint` exit 0
(0 errors); `npm run build` green.

## Continuation session (N207 closure + N369 message_dedupe forgery)

| # | Item | Evidence |
| --- | --- | --- |
| N207 | `counter_shards` accepted a client-written absolute `value` for any shard id — a signed-in user could mint any count. The earlier deferral claimed a rule could not distinguish a legitimate `increment(±1)` from an absolute write. **That was wrong:** an emulator probe confirmed `request.resource.data.value` is the *resulting* value and `resource.data.value` the *pre-write* value, so a rule can bound the relative delta. | Rule now requires the single numeric `value` AND bounds the change to `±100` (`value - resource.data.value` in `[-100,100]` on update; `value` in `[-100,100]` on create). One-shot absolute mints (create and update) are denied; every reachable call site increments ±1 and the ±100 headroom covers the batched comment-delete (`amount: -count`). `counterShardForgeryGuard.test.js` now asserts the absolute mint `assertFails` while a legitimate ±1 increment `assertSucceeds`. Residual (documented, not fully closed): the shard id is unbound to the writer, so a client can still grind repeated bounded writes; the full fix is to move every counter mutation server-side and set `allow write: if false`. |
| N369 | `message_dedupe` was `allow read, write: if isSignedIn()`. The key is `sha256(sender:conversation:type:content:mediaHash)` — its pre-image is public — so any signed-in client could compute a victim's next key, pre-create the record, and suppress that victim's message (`_checkDuplicate` → `messaging/duplicate`). The open read also allowed enumerating recent send keys, and the rule comment overclaimed the key "cannot be forged". | Rule binds each record to its sender: `create, update` must stamp `senderId == uid()`; `read` is `resource == null || resource.data.senderId == uid()`. `messagesService.sendMessage` stamps `senderId` and `_checkDuplicate` treats a `permission-denied` read as "no duplicate of mine". New `messageDedupeGuard.test.js` (static + emulator) is registered in the hard-failing `guards` job. |

Latest verified: full emulator suite **1898 tests / 176 suites** green (incl. the two new guards);
`npm run lint` exit 0 (0 errors); `npm run build` green.

### Findings status

Closed in this session: **N207**, **N369**. Still open in the ledger: **N175**
(rankings/trending have no writer — BLOCKED on the ranking formula, a product
decision; inventing one would itself fabricate standings) and **N270**
(highlight visibility is a product decision, INFORMATIONAL).

## Continuation session 2 (N370 + N270 re-verification)

| # | Item | Evidence |
| --- | --- | --- |
| N370 | Story shard counters (`stories/{id}/view_shards`, `reaction_shards`, `analytics_shards`) bounded the KEY SET but not the VALUE, so any signed-in client could `setDoc` a shard with `count: 999999`; the sum-on-read (`_getShardedViewCount`/`_getShardedReactionCounts`) then reported a forged count. Same class as N207. `daily_upload_counters` was id-bound (N210) but its `count` was likewise unbounded — a fresh shard could be pre-set to `999999`, defeating the per-tier upload limit. | Rules now pin a bounded relative change using the N207 technique (`fieldDeltaBounded` on update, `fieldCreateBounded` on create; `request.resource.data.<f>` is the resulting value, `resource.data.<f>` the pre-write value; missing pre-write reads as the map's `get(field, null)`): `±100` for story shards, `[1,100]` create + `+0..+100` update for upload counters. New `storyShardForgeryGuard.test.js` (static + emulator adversarial) plus two new adversarial assertions in `firestoreRulesCompile.test.js`; both registered in the hard-failing `guards` job. |
| N270 | Re-verified: the `highlights` read is `isSignedIn()`, **not** world-readable — the row's title was stale. Cross-user read is intentional (`storyService.getHighlights(userId)` renders any profile's Highlights). `highlightStories` leak only the reference; the underlying `stories/{id}` stays visibility-gated. | Re-classified **NOT_AN_ISSUE / reviewed**. No code change. |

Verified: full emulator suite **1901 tests / 177 suites** green; `npm run lint`
exit 0 (0 errors); `npm run build` green.

### Findings status

Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the
ranking formula, a product decision). N270 re-classified NOT_AN_ISSUE.

## Continuation session 3 (N424–N427 — fabricated-capability audit, level perks + passport + menu)

| # | Item | Evidence |
| --- | --- | --- |
| N424 | `PassportScreen` advertised a biometric credential the platform cannot produce (“BIOMETRIC PASS”, “Biometrics” tab, “Decrypting authenticated citizen credentials…”; `MenuScreen` “Biometric sovereign passport”). No WebAuthn / `navigator.credentials` / biometric capture exists. | Page retitled “CITIZEN IDENTITY”, tab “Identity”, loader reworded, menu copy de-biometricised. |
| N425 | `LEVEL_PERKS` / `LEVEL_GATES` sold perks and gates with no implementation (Custom Badge, Custom Accent, Enhanced Identity Card, Citizen Council, Priority Cashout Review, Nation Founder Circle, Monarch Halo; dead gates `giftBoost`/`earlyAccessStudio`/`customBadge`/`citizenCouncil`/`founderCircle`). Settings cosmetic tracker listed them; `PerksRewardsScreen` claimed “verified gift earnings, coin milestone bonuses, civic governance rights”. | Perk table reduced to honours-able benefits; five dead gates removed from both `levelConfig.cjs` copies (synced via `scripts/sync-shared-config.mjs`); Settings tracker lists only Top Creator Standing + Crest Radiance; PerksRewards copy corrected. |
| N426 | Digital Passport hardcoded “Active Citizen” regardless of account state; `passportService` never surfaced `accountStatus`. | Payload now exposes the real `accountStatus` (null when absent); screen renders it, “—” when unknown. |
| N427 | Menu hub overclaimed “4K” editor + “4K UHD” badge, “24/7 ticket support”, “royalty payouts”. | Copy corrected to “Multi-track video editor”, “support tickets”, “creator payouts”. |

Verified: `npx eslint src functions --quiet` exit 0; full jest suite **185 suites / 2052 passed / 5 skipped / 2057 total** green; `functions/levelConfig.cjs` byte-identical to `src/shared/levelConfig.cjs`. New guards in `noFabricatedData.test.js` (N424–N427) plus updated `levelConfig.test.js`, `levelSystem.test.js`, `settingsScreen.test.jsx`.

### Findings status
Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the ranking formula, a product decision). N424–N427 closed.

## Continuation session 4 (N430 — royal-standing object/string mismatch + royal-benefit overclaim)

| # | Item | Evidence |
| --- | --- | --- |
| N430 | `setActiveTitle` (`functions/levelSystem.js`) stores `activeTitle` as an **object** (`{ id, name, icon, domain }`), but `ProfileHeroSection` and `EditProfileScreen` compared `profile.activeTitle === 'duke' / 'king'` — a string compare against an object, always false. Every legitimately-granted royal title was therefore invisible (no Royal Family badge, no heraldic editor section). `ProfileHeroSection`'s fallback string compare over `activeTitle`/`titles` shared the defect. Separately the `ProfileSystemRoadmapModal` Duke/King privilege lists promised a “Royal Crown Profile Badge with ambient violet profile aura”, a “Golden Monarch Crown & Radiant Halo Frame on avatar across all screens” and “Royal Standing recorded in your citizenship standing” — none of which the platform renders (the crest aura is a level-unlocked ring, there is no golden halo cosmetic, and standing lives in the passport). | `profileReadModel` gained `resolveActiveTitleId` (object *and* string shapes) and `resolveRoyalFlag` (canonical flags → active-title id → denormalized `titles` array); `ProfileHeroSection`/`EditProfileScreen` consume them; the roadmap lists only rendered benefits (Royal Family badge, title on profile, standing in the passport). |

Verified: `npx eslint src functions` exit 0 (0 errors, warnings only); full jest suite **185 suites / 2056 passed / 5 skipped / 2061 total** green; `npm run build` green. New `profileReadModel.test.js` cases (`resolveActiveTitleId`, `resolveRoyalFlag`) and a `noFabricatedData.test.js` (N430) guard pin both the read-model resolution and the corrected roadmap copy.

### Findings status
Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the ranking formula, a product decision). N270 is NOT_AN_ISSUE. N424–N430 closed.

## Continuation session 5 (N431 — stale `followerCount`/`followingCount` on the server)

| # | Item | Evidence |
| --- | --- | --- |
| N431 | `users/{uid}.followerCount`/`followingCount` are seeded `0` at signup (`NEW_USER_DEFAULTS`) and **never written again** — every follow/unfollow increments a sharded `counter_shards` doc (`CountersManager` inside `userService.followUser`/`unfollowUser`/`approveFollowRequest`/`blockUser`). Server readers trusting the raw field saw a fabricated `0`: (1) the fan-out threshold in `functions/feed.js` + `functions/stories.js` (`> 10000`) **never tripped** → a celebrity's post/story fanned out to *every* follower (the unbounded write storm the pull model exists to avoid); (2) `functions/search.js` shipped `followerCount: 0` to the Algolia user index → people-search rendered a fabricated “0 followers”; (3) `socialGraphService.hydrateProfiles`/`getSummary`, `profileReadModel`, `rankingService`, `monetizationService.getUserPopularityPosition` all read the stale raw field (only `userService.getUserProfile` applied the shard overlay). A client could also seed an arbitrary count at signup and write it via profile update (minted standing). | New `functions/userCounters.js`: `readUserCounter` sums shards in one batched `db.getAll` (legacy raw field only when no shard exists) — now used by both fan-out decisions (feed.js fails toward the pull model on an unresolvable count); scheduled `aggregateUserCounters` mirror writes the shard sum back onto `users/{uid}` (only when changed, so the Algolia `onWrite` index does not churn) so every raw reader is truthful. Counts made server-authoritative in `firestore.rules` (`touchesServerAuthoritativeFields` + create rule pins `0`) and `SERVER_AUTHORITATIVE_FIELDS`. |

Verified: `npx eslint src functions --quiet` exit 0; full jest suite **186 suites / 2063 passed / 5 skipped / 2068 total** green; `npm run build` green. New `followerCounterSourceGuard.test.js` (added to the hard-failing `guards` CI job) pins the module+merge, the byte-identical server/client shard hash + doc-id layout, the batched shard read, the mirror write shape, both fan-out reads, the fail-safe default, the rules denylist/create pin and the contract parity.

### Findings status
Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the ranking formula, a product decision). N270 is NOT_AN_ISSUE. N424–N431 closed.

## Continuation session 6 (N432 — achievements/titles scored against metric fields no writer populates)

| # | Item | Evidence |
| --- | --- | --- |
| N432 | `evaluateAchievements` / `claimTitle` score criteria against `users/{uid}` metric fields (`commentsCount`, `pollVotesCount`, `profilesVisitedCount`, `giftsSentCount`, `hostedLive`, `likesCount`, `friendsCount`, `lifetimeCoinsEarned`, `hasPassport`/`passportCreated`, `isPioneer`, and for titles `contributionScore`/`reputationScore`/`influenceScore`/`creationsCount`/`isFounder`) that **no client or server path ever writes**. The evaluators therefore read a permanent `0` and deny every qualifying user: **14 of 21 achievements and 8 of 15 titles are unearnable** (incl. royal `duke`/`king`, whose `minAchievements`/`reputation`/`contribution`/`influence` dimensions are permanently 0). A fabricated *zero* that denies a real accomplishment — the inverse of the fabricated-standing class. | New `functions/userMetrics.js#computeUserMetrics` aggregates the collections the platform actually writes with bounded aggregation reads (no collection scan): `comments.userId`→`commentsCount`, `poll_votes.userId`→`pollVotesCount`, `profile_views.viewerId`→`profilesVisitedCount`, `gift_transactions.senderId`→`giftsSentCount`, `live_streams.userId`→`hostedLive`, `posts.authorId`→`postsCount` (count) and →`likesCount` (`.aggregate({ sum })` over `stats.likes`). `evaluateAchievements` overlays it (`const stats = { ...userData, ...computed }`) and scores that; an unresolvable metric stays absent (fail-closed). Metrics with no defined source remain BLOCKED in the ledger (reputation/contribution/influence model, `friendsCount`, `lifetimeCoinsEarned`, `hasPassport`, `isPioneer`/`isFounder`). |
| N433 | `posts/{postId}.stats.{likes,comments,shares,saves}` are seeded `0` and never written again — every like/save/share/comment routes to a sharded `counter_shards` doc. `feed.js#processScoreUpdates` read top-level `likeCount`/`commentCount`/`shareCount`/`viewCount` (fields **no writer populates at all**), so the engagement term was a constant `0` and feed ranking collapsed to pure recency; `search.js#indexPost` shipped the stale `stats.*` (0) to Algolia, so content search sorted by a fabricated score. | New `functions/postCounters.js` mirrors the video counter model: a batched `db.getAll` shard read + a cursor-paged scheduled `aggregatePostCounters` that writes the sums back onto `posts/{postId}.stats` (only when changed, so the Algolia `onWrite` index does not churn). `feed.js` now reads `post.stats.*`. Shard hash + doc-id layout byte-identical to `CountersManager.js`. |

Verified: `npx eslint src functions --quiet` exit 0; full jest suite **188 suites / 2075 passed / 5 skipped / 2080 total** green; `npm run build` green. New `achievementMetricSourceGuard.test.js` and `postCounterSourceGuard.test.js` (added to the hard-failing `guards` CI job) pin the modules, the overlays, the real writer field names, the bounded aggregation shape and the fail-closed behaviour. `functionsContract.test.js` shared-module allowlist extended for `userMetrics.js` (`postCounters.js` is merged, so it needs no entry).

### Findings status
Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the ranking formula, a product decision); N432 partially BLOCKED (the metrics with no defined source). N270 is NOT_AN_ISSUE. N424–N433 closed.

## Continuation session 7 (N434 — community `stats.eventCount` had no writer)

| # | Item | Evidence |
| --- | --- | --- |
| N434 | `communities/{communityId}.stats.eventCount` is seeded `0` at community create (`functions/communities.js#createCommunity`) and **never written again** (`postCount`/`memberCount` have writers; `eventCount` does not), yet `CommunityDetailScreen.jsx` renders it as the community "Events" stat and `communityService.getCommunityStats` reads it. Every community therefore showed a fabricated "Events 0" regardless of member activity — the same counter-with-no-writer class as N431/N433. Events carry a `communityId` (client `eventService.createEvent`), so the count is derivable, but the community document is server-write-only so the derived counter must come from a server trigger. | New `functions/eventCounters.js#onEventWrite` (firestore `events/{eventId}` `onWrite`) applies a **net delta** to the owning community's `stats.eventCount` (`-1` before / `+1` after; a status-only or registration write cancels to zero, so no community is read or written). `COUNTED_EVENT_STATUSES = ['published','open','live','ended']` (draft/cancelled do not count; cancel/delete decrements). One batched `db.getAll` + one `db.batch`; **only counts toward a community the organizer is a member of** (forgery guard). New `communityEventCountSourceGuard.test.js` (guards job) pins the merge, trigger shape, net-delta logic, status set, membership guard and the real UI consumer. |

Verified: `npx eslint src functions --quiet` exit 0; full jest suite **189 suites / 2081 passed / 5 skipped / 2086 total** green; `npm run build` green. Also created `docs/engineering/implementation-plan-30.md` (the 30-task/sub-task working plan).

### Findings status
Open in the ledger: **N175** only (rankings have no writer — BLOCKED on the ranking formula, a product decision); N432 partially BLOCKED (the metrics with no defined source). N270 is NOT_AN_ISSUE. N424–N434 closed.

### Resume commands
```
cd /workspace/project/Arvdoul
git log --oneline -3          # expect HEAD on harden/n319-n320-analytics-live
npm run lint                  # exit 0
NODE_OPTIONS=--experimental-vm-modules npx jest   # 189 suites green
npm run build                 # green
```
