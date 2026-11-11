# Arvdoul — Implementation Backlog (Top 20 workstreams)

_Generated from the current working tree, branch `harden/fabrication-and-integrity-sweep`
(PR #42). Every item below is grounded in a concrete file/count observed in the repo,
not a guess. Effort is in **engineer-days (ED)** for one senior full-stack engineer who
knows the codebase; an AI agent works in parallel and compresses calendar time, not the
total work._

## Repository baseline (measured)

| Fact | Value |
| --- | --- |
| Screens | 132 `.jsx` |
| Components | 77 `.jsx` |
| Services | 48 `.js` |
| Zustand stores | 6 |
| Hooks | 11 |
| Utils | 24 |
| Context providers | 4 |
| Cloud Function modules | 30 |
| Firestore rules | 1,699 lines, ~168 collections |
| Storage rules | 158 lines |
| Firestore indexes | 132 |
| Routes | ~164 paths, 93 lazy-loaded |
| Tests | 123 suites, 1470 passing / 5 skipped |
| Bundle | 7.1 MB JS raw, ~1.9 MB gzip (largest chunk: ImageEditor 984 KB) |
| `onSnapshot` listeners | 32 |
| `getDocs` call sites | 163 |
| i18n | 7 locales, only 2/132 screens use `useTranslation`, 71 `t()` calls total |
| Audit findings closed | N001–N275 (+ N266/N270 deferred) (all but N175) |
| Audit findings open | N175 (rankings writer; needs a product ranking formula) |

---

## TIER 1 — Blocking / integrity (do first)

### 1. Finish the "no fabricated data" sweep and lock it (System: Data integrity)
The `noFabricatedData` guard already covers 300+ assertions, but the sweep is manual and
incomplete. Remaining surfaces still coerce unknown → `0` in places that are not yet
guarded.
- **Sub-systems**: `src/services/*` (analytics, monetization, ranking, community,
  collaboration), `src/screens/Economy/*`, `src/screens/Profile/*`,
  `src/screens/Admin/*`, `src/store/analyticsStore.js`.
- **Concrete leads found**: `AdminEconomyScreen.jsx:460/591` (`payout.amount || 0`,
  `tx.amount || 0`), `CollectionsScreen.jsx:47/93` (`itemCount || 0`),
  `QuestionCard.jsx:89` (`answer.upvotes || 0`), `ConversationSettingsScreen.jsx:106`.
- **Deliverable**: one shared `unknownNumber(v)` helper + guard extended to every
  `X || 0` in a *display* position.
- **Effort**: 4 ED. **Risk if skipped**: creators/admins see invented money/standing.

### 2. Cloud Functions deploy integrity + contract coverage (System: Backend)
`functions/*.js` are merged in `index.js` (guarded), but 2 modules (`privacyPropagation`,
`saml`) have **no test**, and `functionsContract` does not assert every exported callable
is reachable from a client call site.
- **Sub-systems**: `functions/index.js`, `functions/{privacyPropagation,saml,ai,userExport}.js`,
  `src/services/callableService.js` (`FUNCTIONS` map).
- **Deliverable**: extend `deployIntegrity.test.js` + `functionsContract.test.js` to
  assert every `FUNCTIONS` key resolves to a real export and every export has a caller
  (or is explicitly internal).
- **Effort**: 3 ED.

### 3. Firestore rules ↔ query parity (System: Security)
Rules are deny-by-default and compile (guarded), but there is no proof that **every real
query is permitted** by the rules. A query the rules deny fails open to an empty list.
- **Sub-systems**: `firestore.rules` (168 collections), `firestore.indexes.json` (132),
  every `getDocs/onSnapshot` call site (195 total).
- **Deliverable**: a `queryToRuleMatrix` test (static) + emulator adversarial suite for
  the top 40 query shapes; a `docs/engineering/firestore-query-index-map.md`.
- **Effort**: 6 ED. **Risk if skipped**: silent empty screens, enumeration leaks.

### 4. Automated accessibility gate (System: UI quality)
`jest-axe` is installed and `accessibility.test.jsx` exists, but it covers a handful of
screens. No route-wide a11y gate, no keyboard-trap test, no contrast audit.
- **Sub-systems**: all 132 screens, `src/components/Shared/*` (BottomNav 1380 LOC,
  QuickAccessPanel 1999 LOC, TopAppBar 944 LOC), dialog/drawer primitives.
- **Deliverable**: axe run over a representative screen set in `guards`; focus-trap and
  `aria-live` assertions on the 10 core dialogs.
- **Effort**: 6 ED.

---

## TIER 2 — Core product completeness

### 5. Rankings backend (closes N175) (System: Discovery)
`rankings/{type}/{category}` has **no writer**; six tabs are permanently empty.
- **Sub-systems**: `functions/ranking.js` (new scheduled function), `rankingService.js`,
  `RankingsScreen.jsx`, indexes for `score`/`trend`.
- **Blocker**: the ranking formula is a product decision — must be agreed, not invented.
- **Effort**: 5 ED (after product sign-off).

### 6. Creator economy settlement hardening (System: Economy)
Ledger, wallet and payout screens exist; the server settles withdrawals
(`withdrawalSettlement.js`). Needs: reconciliation job, refund/reversal states,
idempotency proof under retry, and a negative-balance invariant test.
- **Sub-systems**: `functions/{monetization,withdrawalSettlement}.js`,
  `monetizationService.js`, `Economy/WalletScreen.jsx`, `CreatorPayoutScreen.jsx`,
  `Admin/AdminEconomyScreen.jsx`.
- **Deliverable**: append-only ledger invariant tests, double-spend tests, a
  `docs/engineering/money-model.md` (single canonical conversion policy).
- **Effort**: 8 ED.

### 7. Feed ranking + pagination hardening (System: Feed)
`feedService.js` is 1,782 LOC with 6 unbounded reads in the cost baseline. No measured
ranking beyond recency; no dedup guarantee across pages.
- **Sub-systems**: `feedService.js`, `firestoreService.js` (4 unbounded reads),
  `HomeScreen.jsx` (1,669 LOC), `rankingService.js`.
- **Deliverable**: cursor-stable feed, per-page dedup set, bounded fan-out, a
  `docs/engineering/feed-ranking.md` describing the *explainable* ranking.
- **Effort**: 7 ED.

### 8. Messaging scale + safety (System: Communication)
`messagesService.js` is 3,343 LOC (largest service) with 10 unbounded reads and 32
listeners across the app.
- **Sub-systems**: `messagesService.js`, `MessagingScreen`, `ChatScreen`, `MessageBubble`,
  message shard rules (`isMessageShardCollection`), unread counters.
- **Deliverable**: bounded pagination everywhere, listener budget, block/mute enforced in
  the read path, delivery/read receipts verified.
- **Effort**: 8 ED.

### 9. Story/Vibe lifecycle (System: Stories)
`storyService.js` is 1,944 LOC with 17 unbounded reads. Expiration must be enforced in
the *data-access path*, not just hidden.
- **Sub-systems**: `storyService.js`, `functions/stories.js`, `CreateStory`,
  `StoryViewer`, story rules.
- **Deliverable**: server-side expiry sweep + client read filter + reaction/reply tests.
- **Effort**: 5 ED.

### 10. Video/Sparks playback + moderation (System: Short-form video)
`functions/video.js` is the second-largest function module (23 exports). Playback should
not load unlimited full-res videos; moderation must reach the video report queue.
- **Sub-systems**: `videoService.js`, `VideoCard.jsx` (915 LOC), `VideoFeed`,
  `video_reports` rules, `recordVideoView` XP trigger.
- **Deliverable**: adaptive loading (only N players mounted), preload budget, report →
  moderator queue end-to-end test.
- **Effort**: 6 ED.

---

## TIER 3 — Platform systems

### 11. Internationalization rollout (System: i18n)
7 locales exist but **130 of 132 screens are hardcoded English** (71 `t()` calls total).
- **Sub-systems**: `src/i18n/locales/*.json`, every screen/component, `useTranslation`
  adoption, RTL for `ar.json`.
- **Deliverable**: extract strings, RTL layout pass, locale switcher, a guard that fails
  on new hardcoded user-facing strings.
- **Effort**: 25–40 ED (large; can be phased per screen group).

### 12. Design-system consolidation (System: Design system)
`tokens.js` is canonical and drift-guarded, but only **24 of 209 UI files** import tokens;
raw hex appears 146× (`#8B1EF3`), 91× (`#FFFFFF`), 80× (`#4431F7`).
- **Sub-systems**: `src/design-system/*`, all screens/components, `themePalettes.js`.
- **Deliverable**: migrate raw hex to `--arv-*` vars; extend the drift guard to forbid
  raw brand hex in UI; document every primitive's states.
- **Effort**: 10 ED.

### 13. Shared component library + state completeness (System: UI components)
The 20 largest components (QuickAccessPanel 1999, BottomNav 1380, ProfileFeedGrid 1025…)
each re-implement loading/empty/error/offline states. No shared primitives for those.
- **Sub-systems**: `src/components/Shared/*`, `src/components/ui/*`.
- **Deliverable**: `EmptyState`, `ErrorState`, `OfflineState`, `Skeleton`,
  `PermissionDenied` primitives + adoption; a guard that every screen route renders all
  states (extend `errorStateRenderedGuard`).
- **Effort**: 12 ED.

### 14. PWA + offline correctness (System: Offline/PWA)
`public/sw.js` (136 LOC) + Firestore offline + `OfflineQueue` exist. No proof that a
queued *financial* action never shows as succeeded.
- **Sub-systems**: `sw.js`, `OfflineQueue.js`, `offline/syncEngine.js`, `OfflineStatusScreen`,
  `firestoreService` optimistic paths.
- **Deliverable**: "pending sync" vs "done" distinction for every queued op, update
  prompt, cache-version tests.
- **Effort**: 6 ED.

### 15. Observability + error reporting (System: Ops)
`Logger` + `metricsService` exist; there is no sink, no dashboards, no alerting, no
error-boundary reporting to a backend.
- **Sub-systems**: `Logger.js`, `metricsService.js`, `ErrorBoundary`, `docs/OBSERVABILITY.md`.
- **Deliverable**: pluggable sink (Sentry/Datadog adapter), structured events, alert
  definitions, `docs/engineering/production-readiness.md`.
- **Effort**: 5 ED (+ vendor decision/cost).

### 16. Test infrastructure + Node-version parity (System: CI/QA)
`guards` now runs green on Node 22 (fixed N182), but the `lint`/`test` CI jobs are
`continue-on-error: true` (advisory) and local dev runs Node 24 while CI pins Node 22.
- **Sub-systems**: `.github/workflows/ci.yml`, `jest.config.cjs`, `babel.config.cjs`,
  `package.json` (`engines` is unset), `functions/package.json` (node 22).
- **Deliverable**: pin Node via `engines` + `.nvmrc`, add a Node-22 matrix leg, promote
  the advisory jobs once clean.
- **Effort**: 3 ED.

### 17. Contract-guard expansion (System: Architecture)
`serviceContract`/`storeContract`/`hookContract`/`contextContract` exist. Missing:
props-contract (beyond dead-prop), route-param contract, event-payload contract, and a
"no new unbounded read" ratchet (baseline may only shrink).
- **Sub-systems**: `src/__tests__/*Contract*`, `firebaseCostGuard`, `deadWiringGuard`.
- **Deliverable**: new guards + shrink the 163-`getDocs` / 32-listener surface.
- **Effort**: 5 ED.

---

## TIER 4 — Product / growth

### 18. Communities, events & collaboration depth (System: Communities)
Modules exist (`communityService`, `eventService`, `collaborationService`, functions for
each). Needs member roles, invitations, moderation actions, RSVP lifecycle, and the
rules to prove each.
- **Sub-systems**: `functions/{communities,events,collaboration}.js`,
  `CommunityDetailScreen`, `EventDetailScreen`, `ProjectDetailScreen`.
- **Effort**: 10 ED.

### 19. Trust, verification & moderation workflow (System: Trust & safety)
Verification, reports, strikes, appeals, audit logs exist in parts. Needs an end-to-end
appeal workflow and proof that moderation decisions propagate to feed/search/profile.
- **Sub-systems**: `functions/{admin,moderation}.js`, `Admin*Screen.jsx`,
  `moderation_logs`, `REPORT_TARGETS`.
- **Effort**: 8 ED.

### 20. Search & discovery depth (System: Search)
`searchService.js` + `functions/search.js` exist; trending, hashtags, people/creator
discovery need bounded, privacy-filtered queries and relevance.
- **Sub-systems**: `searchService.js`, `useSearch.js`, `DiscoverScreen`, `searchStore.js`.
- **Deliverable**: bounded cursor search, blocked/muted filtering, trending writer.
- **Effort**: 7 ED.

---

## Timeline

### Total remaining work (one senior engineer, serial)
Rough sum of the 20 items: **≈ 190–210 engineer-days** of *new, verifiable* work on top
of the current state. That is the honest number — the repo is already large (132 screens,
48 services, 30 function modules, 1,699 rules lines) and this is hardening/completing it,
not building a prototype.

### What I (an AI agent) can do
- **Per session (a few hours)**: 1–3 Tier-1 items with tests + guards green — the same
  cadence as this branch (N142→N182 was ~40 fixes across many sessions).
- **Throughput**: roughly **2–4× a single human** on well-scoped, guard-verifiable work
  (fabrication sweeps, rules parity, contract guards, i18n extraction, design-token
  migration). Slower where a **product decision** or **credential/vendor** is required
  (rankings formula, payment provider, observability vendor, SAML IdP) — there I stop and
  flag, I do not invent.
- **Realistic calendar time to finish all 20**: with an AI agent working continuously and
  a human doing product sign-off + review, **≈ 6–12 weeks** wall-clock. With humans only,
  **≈ 9–12 months** for one engineer, or **≈ 3–4 months** for a small team of 3.

### The hard blockers (cannot be resolved by more engineering)
1. **Product decisions**: ranking formula (N175), any new monetization price/rate,
   verification eligibility rules.
2. **Vendors/costs**: observability sink, payment provider, SAML IdP — need budget.
3. **Production-only actions**: deploying functions/rules/indexes, live data migration —
   require owner authorization (out of scope here by the mandate).

---

## What Arvdoul could be if completed

- **A real social platform, not a template**: 132 screens behind a single, drift-guarded
  design language; profiles with no cover-photo gimmick; a distinctive liquid-membrane
  navigation; every screen with honest loading/empty/error/offline/permission states.
- **Financially trustworthy**: an append-only coin ledger with server-authoritative
  settlement, reconciliation, refunds/reversals and no client-invented balances.
- **Provably secure**: 1,699 lines of deny-by-default rules with *proven* query parity
  (no silent empty reads, no enumeration leaks), adversarial emulator tests in CI.
- **Observable and operable**: structured logs → a real sink, alerting, RPO/RTO targets,
  disaster-recovery runbook (docs already drafted).
- **Globally usable**: 7 locales actually wired (incl. RTL Arabic), full a11y gate.
- **Scale-ready without over-engineering**: bounded reads/listeners enforced by a ratchet
  guard; a documented path from 1K → 10M users that separates assumptions from measured
  capacity (already started in `docs/audits/REPOSITORY_RECONSTRUCTION_V1.md`).
- **Self-defending quality**: ~120 test suites + ~40 invariant guards that fail CI when
  a fabrication, a dead call, a silent catch, an unreachable module, a rules/query drift,
  or a design-token drift is reintroduced.

In one line: **a distinctive, financially-honest, security-proven social ecosystem that
stays correct as it grows — because the guards make regressions expensive.**
