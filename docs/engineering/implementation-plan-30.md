# Arvdoul — 30-Task Execution Plan (sub-tasked)

_Anchored to the current tree on branch `harden/n319-n320-analytics-live`. Every task
is grounded in a concrete file/count observed in the repo. Statuses: `TODO` /
`IN_PROGRESS` / `DONE` / `BLOCKED`. This is the working plan for the ongoing
harden-and-complete campaign; it supersedes the (now-stale) lead list in
`implementation-backlog.md`._

## Legend
- **New finding ids** continue the N-series above the current max (N433) → next is N434.
- **Evidence** = the file/line or command that proves the item.

---

## TIER 1 — Integrity (no fabricated / no dead data)

### T1 — N434: community `stats.eventCount` is seeded `0` and never written — DONE
- **Evidence**: `functions/communities.js:110` seeds `eventCount: 0`; no writer exists;
  `CommunityDetailScreen.jsx:465` + `communityService.js:411` render it; events carry
  `communityId` (`eventService.js:51`) so the count is derivable.
- **Sub-tasks**:
  - [x] T1.1 New `functions/eventCounters.js` `onEventWrite` trigger.
  - [x] T1.2 Delta = `shouldCount(after) - shouldCount(before)`; only write on change.
  - [x] T1.3 Merge in `functions/index.js`; guard test; CI `guards`; ledger; AGENTS.md.
- **Exit**: a community's Events card shows the real count; guard pins it.

### T2 — Extend the fabricated-data sweep to remaining display `X || 0` — DONE (verified clean)
- **Evidence**: `scripts/`-adjacent sweep done for most; re-audit `Admin/*`, `Economy/*`,
  `Profile/*` for `amount || 0`, `count || 0`, `balance || 0` in *display* position.
- **Sub-tasks**: T2.1 inventory remaining sites — DONE (full `src` sweep of `?? 0`/`|| 0`);
  T2.2 convert to `unknownNumber` → `—` — none needed (every remaining hit is either
  pre-gated on presence, a non-display accumulator, or an event-handler coordinate);
  T2.3 extend `noFabricatedData.test.js` — already covers the display cases.

### T3 — `live_streams.stats` — verify every seeded counter has a writer — DONE (verified, no change)
- **Evidence**: `liveService.startLiveStream` seeds `totalViewers/totalTips/totalGifts/
  coinsEarned`; `functions/live.js` writes `totalViewers`, `monetization.js` writes the rest.
- **Sub-tasks**: T3.1 confirm each seed has a writer — DONE; T3.2 remove any seed without one —
  none needed; T3.3 guard — the four seeds are covered by the reader/writer audit.
  All four (`totalViewers` ← `functions/live.js#onLiveViewerCreate`; `totalTips`/`totalGifts`/
  `coinsEarned` ← `functions/monetization.js`) have real writers and real readers; the two
  `stats.totalViewers = Math.max(...)` assignments in `liveService` are in-memory read clamps
  (not persisted), so there is no double-count.

### T4 — Audit server `data().X || 0` reads against writers (raw-counter class)
- **Evidence**: N431/N433 were both this class. Sweep `functions/*.js` for
  `data().\w+Count || 0` / `stats.\w+ || 0` and prove a writer exists.
- **Sub-tasks**: T4.1 grep inventory — DONE; T4.2 classify each — DONE
  (`feed.js`/`video.js`/`stories.js` reads verified; `levelSystem.js` metrics are
  N432-overlaid; the `*.data().count` reads are shard sums); T4.3 fix dead reads —
  found **N435** (video `stats.comments`) and fixed it; T4.4 guard — DONE
  (`videoCommentCounterSourceGuard.test.js`).

## TIER 2 — Backend completeness

### T5 — N175: rankings writer (scheduled) — BLOCKED on product formula
- **Sub-tasks**: T5.1 collect the candidate signals (followers, engagement, recency —
  all now real after N431/N433); T5.2 draft a documented default formula for sign-off;
  T5.3 implement `functions/ranking.js` + indexes once approved.

### T6 — Event lifecycle → community counter parity for status changes — DONE (verified, no change)
- **Sub-tasks**: T6.1 cover draft→published→cancelled transitions (T1.2 already does) — DONE;
  T6.2 cover `deleteEvent` (`eventService.deleteEvent` sets `status: 'cancelled'`, the trigger
  applies `-1`) — DONE; T6.3 test — `communityEventCountSourceGuard.test.js` covers it.

### T7 — Cloud Functions contract coverage for every export
- **Evidence**: backlog item 2 — assert every `FUNCTIONS` key resolves to a real export.
- **Sub-tasks**: T7.1 extend `deployIntegrity.test.js` — DONE (`deployIntegrity`
  "every FUNCTIONS key resolves to a deployed export"); T7.2 every export has a caller or is
  explicitly internal — DONE (`functionsInventoryGuard.test.js`: no dead FUNCTIONS key, no
  ad-hoc callable literal, no new unreferenced callable; baseline may only shrink).

### T8 — Firestore rules ↔ query parity for the top query shapes
- **Sub-tasks**: T8.1 static `queryToRuleMatrix` test; T8.2 emulator adversarial suite.

### T9 — Money-model single-source doc + invariant tests
- **Evidence**: `docs/engineering/money-model.md` exists; add append-only-ledger +
  no-negative-balance + idempotency tests.
- **Sub-tasks**: T9.1 ledger invariant test; T9.2 double-spend test; T9.3 doc parity.

### T10 — Idempotency proof under retry for money callables
- **Sub-tasks**: T10.1 `idempotency_ledger` replay test; T10.2 duplicate-trigger test.

## TIER 3 — Feed / discovery / social

### T11 — Feed per-page dedup + stable cursor
- **Sub-tasks**: T11.1 dedup set across pages; T11.2 cursor stability test.

### T12 — Bound every remaining unbounded `getDocs` (cost ratchet may only shrink)
- **Sub-tasks**: T12.1 re-run `firebaseCostAnalyzer`; T12.2 bound the offenders; T12.3 lower
  the baseline.

### T13 — Ranking inputs now real — verify `rankingService` consumers
- **Sub-tasks**: T13.1 trace `getUserBadges`/`getRisingCreators`; T13.2 remove any residual
  fabricated fallback.

## TIER 4 — UI/UX completeness

### T14 — Shared state primitives (Empty/Error/Offline/Skeleton) adoption
- **Sub-tasks**: T14.1 audit screens missing states; T14.2 adopt primitives; T14.3 extend
  `errorStateRenderedGuard`.

### T15 — Accessibility gate for core dialogs (focus trap, aria-live)
- **Sub-tasks**: T15.1 jest-axe screen set; T15.2 focus-trap assertions.

### T16 — Responsive verification at 320/360/390/768/1280
- **Sub-tasks**: T16.1 overflow audit; T16.2 fix offenders.

### T17 — i18n extraction (phased) — large
- **Sub-tasks**: T17.1 extract strings for the top screens; T17.2 RTL pass; T17.3 guard.

## TIER 5 — Platform hardening

### T18 — Offline: "pending sync" vs "done" for queued ops
- **Sub-tasks**: T18.1 financial ops never show success while queued; T18.2 tests.

### T19 — PWA update prompt + cache-version tests
### T20 — Observability sink wiring (vendor BLOCKED on budget)
### T21 — Node-version parity (`engines` + `.nvmrc` + CI matrix)
### T22 — Contract-guard expansion (route-param, event-payload)
### T23 — Story/Vibe expiry enforced in the data-access path
### T24 — Messaging bounded pagination + block enforcement in read path
### T25 — Video/Sparks bounded player mount + moderation queue
### T26 — Creator settlement reconciliation job
### T27 — Admin governance: every mutation audited + rate-limited
### T28 — Storage rules adversarial suite (MIME/size/ownership)
### T29 — Dead-code re-verification (orphan/reachability at zero)
### T30 — Independent verification pass (fresh gates + ledger reconciliation)

---

## Execution order
T1 → T2 → T3 → T4 (integrity) → T5..T10 (backend) → T11..T13 (feed) →
T14..T17 (UI) → T18..T30 (platform). Each task ends with: guard test, CI registration
where it is an invariant, ledger + checkpoint update, and a green
`eslint src functions --quiet` / jest / `npm run build`.
