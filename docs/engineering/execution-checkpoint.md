# Execution checkpoint

_Last updated: this session. Branch `harden/fabrication-and-integrity-sweep` (PR #42)._

## Current state

- Baseline: full Jest suite green (121 suites, 1464 passed, 5 skipped); `npm run
  build` green; `npm run lint` exit 0 (0 errors, warnings only).
- Latest verified: 132 suites, 1550 passed, 5 skipped; `npm run build` green;
  `npm run lint` exit 0 (0 errors, 867 warnings).
- Emulator enabled locally this session (openjdk installed) — the emulator-backed
  adversarial suites now actually execute instead of skipping.

## Completed this session

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
| N207 | `counter_shards` accepts a client-written `value` for any shard id (fabricated counts) | Confirmed; **deferred with justification** — not closable by a rule alone (a legit `increment(±1)` is indistinguishable from an absolute `{value: 999999}`, and the shard id is unbound). Needs every counter mutation moved server-side (Admin SDK bypasses rules) + `allow write: if false`, a multi-service change. Recorded in the ledger. |
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

New guards registered in the hard-failing `guards` CI job: `firestoreQueryIndexMap`,
`a11yInteractiveGuard`, `brandHexRatchetGuard`, `sharedStatePrimitivesGuard`,
`storyExpiryGuard`, `functionsInventoryGuard`, `adminAuditGuard`,
`privacyPropagationAndSaml`, `searchBlockFiltering`, `searchPaginationWiring`,
`searchPaginationService`, `commentPaginationWiring`, `directoryPaginationService`,
`conversationPaginationService`.

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

## Commands to resume

```
git status
NODE_OPTIONS=--experimental-vm-modules npm run test -- --watchAll=false
npm run build
npm run lint
```
