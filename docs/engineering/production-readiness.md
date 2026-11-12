# Production readiness

_Evidence-based. Every claim names the file or command that supports it. Items
that require a product decision, a credential, or a production-only action are
marked **BLOCKED** with the exact remaining requirement — they are not claimed as
done._

## 1. Build, lint, test

| Gate | Command | Status |
| --- | --- | --- |
| Build | `npm run build` | ✅ vite build succeeds |
| Lint | `npm run lint` | ✅ 0 errors (warnings only) |
| Unit/integration | `NODE_OPTIONS=--experimental-vm-modules npm test` | ✅ green |
| Architecture / cost / security guards | `guards` CI job (`.github/workflows/ci.yml`) | ✅ hard-failing |

The `guards` job runs the invariant suites (architecture boundaries, Firebase
cost, security services, deploy integrity, shared-config sync, Firestore rules
compile/coverage, dead-event, orphan-module, dead-wiring, status-doc honesty,
event-payload contract). New invariant suites are added there.

## 2. Observability

- **Structured logging**: `src/utils/Logger.js` emits JSON with level filtering,
  correlation-id propagation and PII/secret redaction.
- **Remote sink** (`#15`): `Logger` now supports a pluggable transport via
  `setLogSink(fn, { minLevel })`. When `VITE_LOG_ENDPOINT` is set at build time a
  batched `fetch` transport auto-installs and flushes on `visibilitychange`. With
  no endpoint the path is a **no-op** — nothing is fabricated. Tested in
  `src/__tests__/loggerSink.test.js`.
- **Metrics**: `src/services/metricsService.js` holds counters/gauges/histograms
  with percentile computation and a Prometheus text export.
- **Crash reporting**: `src/services/crashReportingService.js` buffers crashes in
  localStorage and dispatches to the Sentry ingestion endpoint **only when
  `VITE_SENTRY_DSN` is configured**; otherwise it is a no-op (no mock endpoint).

**BLOCKED (vendor/cost decision)**: a hosted log/error sink (e.g. a collector
endpoint or Sentry DSN) and the dashboards/alert rules over it. The client
transport and redaction are in place; the vendor is a budget decision.

## 3. Offline / PWA

- Canonical queue: `src/utils/OfflineQueue.js` (single instance, owner-scoped
  ops, purged on sign-out). `src/offline/syncEngine.js` re-exports it and emits
  `arvdoul-sync-status`.
- UI: `src/components/UI/OfflineIndicator.jsx` (top banner, online/offline/
  syncing/queued) and `src/screens/OfflineStatusScreen.jsx` (pending count, last
  sync, manual drain).
- **No false financial success**: a queued purchase returns
  `{ success:false, offlineQueued:true }` and `CoinsScreen` renders an *info*
  toast ("will be processed when you are back online"), never a success toast.
  Guarded by `falseSuccessToastGuard.test.js`.

**BLOCKED (product decision)**: an update-available prompt (the service worker
exists but there is no user-facing "new version, reload" affordance wired to a
waiting worker).

## 4. Reliability & recovery

- Error boundaries: `src/app/GlobalErrorBoundary.jsx` (focus management, crash
  log, forwards render errors to the crash reporter) and
  `src/components/ErrorBoundary.jsx` (function-or-node fallback).
- Release/rollback: Firebase Hosting serves immutable releases; rollback is a
  hosting re-deploy of a prior release. No automated rollback trigger.
- Backups: Firestore managed exports. **BLOCKED (production-only)**: scheduling
  and verifying an export/restore drill requires project access.

**RPO/RTO**: not asserted. They depend on the Firestore export cadence, which is
not configured in this repository. Do not claim a target without the drill.

## 5. Security controls (enforced paths)

`firestore.rules` (authorization), `functions/rateLimit.js` (server-side per-user
limits), Firebase App Check, the `index.html` meta CSP and the `firebase.json`
headers. Client-side "security" services were removed
(`securityServices.test.js` bans their return).

## 6. What is NOT done (honest list)

- Rankings writer (`rankings/*` has no producer) — **BLOCKED**, needs the product
  ranking formula and a scheduled writer (N175).
- `counter_shards` is client-writable — integrity hole, needs all counter
  mutations moved server-side (N207).
- Live streaming is signalling-only (Firestore `calls`), no media/SFU server —
  **BLOCKED (infra)**.
- Payment provider checkout is config-gated (`VITE_STRIPE_PUBLIC_KEY`); without
  it the flow reports unavailable rather than faking a success.
- Hosted observability vendor (see §2).
- Communities/events roles, appeals workflow, search relevance depth — planned
  (see `implementation-backlog.md`).
