# 🏗️ Arvdoul Engineering Readiness — Status & Roadmap

> Last updated: 2026-08-20. This document is the operational counterpart of the
> Engineering Constitution: it records what is hardened, what is enforced in
> CI, and the ramp-up plan for what remains.

## Where Arvdoul stands (verified numbers)

| Metric | Before (2026-08-20 baseline) | Now | Target (Q4 2026) |
|---|---|---|---|
| Test suites | 7 (1 failing, 1 flaky) | **17 (all green)** | 25+ |
| Tests | 119 (1 failing) | **267 passing** | 500+ |
| Coverage (full service tree) | ~11.9% stmts | **13.2% stmts / 13.8% lines** | 35% stmts |
| Coverage floors enforced in CI | none | **global + 21 per-file floors** | raise quarterly |
| CI pipeline | pass-on-failure (`continue-on-error`) | **real gates** (lint/test/build/security/functions) | canary deploys |
| a11y gates | none | **axe-core on core UI** (0 violations) | full-screen sweep |
| i18n | hardcoded English | **7 locales + key-parity test + RTL** | 20+ locales |
| Feature flags | none | **Remote Config + kill switches + hook** | admin UI |
| Observability | stubs only | **Prometheus export + RUM + Grafana + alerts** | production pushgateway |
| Dependabot / CodeQL | none | **added** | triage SLA |
| Functions install | broken (`@google-cloud/tasks@^3.3.0` doesn't exist) | **fixed + lockfile committed** | — |

## Enforced engineering gates (CI fails when violated)

1. **Jest suite green** — `npm run test:coverage` (17 suites, 267 tests).
2. **Coverage floors** — `jest.config.cjs` `coverageThreshold`:
   - Global: ≥11% stmts / ≥9% branch / ≥10% funcs / ≥12% lines.
   - Per-file floors (80% band) on 21 core files: CacheManager, metricsService,
     validationService, soundService, sessionSecurityService, fraudDetectionService,
     fieldEncryption-adjacent security services, etc. A regression in any of
     them fails CI immediately.
3. **ESLint errors = 0** (warnings tracked, not blocking yet).
4. **Production build compiles** (`vite build`).
5. **`npm audit --audit-level=high`** (currently 0 high/critical).
6. **gitleaks** secret scan + **CodeQL** static analysis.
7. **axe-core** — no WCAG 2.1 AA violations on BottomNav, AdvancedToggleSwitch,
   GlobalErrorBoundary.
8. **i18n parity** — every locale must contain every English key (no silent
   missing-translation bugs).

## What was hardened in this pass (by constitution priority)

### 1. Tests — from stubs to real assertions
- Fixed the flaky `soundService` test that hit real Firestore and timed out →
  hermetic fake-Firestore suite (8 tests).
- New suites with real assertions:
  - `securityServices.test.js` — WAF (SQLi/XSS/RCE/traversal/XXE), CSRF,
    DDoS token bucket + ban logic, PoW challenges, security headers, CSP,
    impossible-travel detection, sanitization (33 tests).
  - `fieldEncryption.test.js` — AES-256-GCM round-trips, wrong-seed rejection,
    Unicode, 10KB payloads, recovery seed entropy.
  - `cacheAndCounters.test.js` — CacheManager (TTL, LRU eviction, wildcard
    invalidation, stats), RedisCacheManager, TTL optimization tiers, cache
    invalidation orchestration (21 tests).
  - `feedService.test.js` — seeded shuffle determinism, cursor codec,
    fallback scoring, diversity enforcement invariants (19 tests).
  - `validationService.test.js` — post/comment/username/coin schemas.
  - `observability.test.js` — Prometheus export format, percentiles, spans,
    SLO/error budget, cost accounting, RUM vitals, route timing (22 tests).
  - `featureFlagService.test.js` — fail-closed reads, override precedence,
    persistence, subscriptions (9 tests).
  - `soundService.test.js` (8), `i18n.test.js` (12), `accessibility.test.jsx` (5).
- Shared jest setup (`tests/jest.setup.js`) — polyfills, storage shims,
  ResizeObserver/matchMedia, so suites run in CI and locally identically.

### 2. Observability — stubs → runnable stack
- `rumService` hardened: INP + long-task observers, route timing API,
  `attachToMetrics()` pipeline, vitals evaluation vs web.dev thresholds.
- Dev `/metrics` endpoint (Vite middleware) serving Prometheus text format.
- `ops/` stack: prometheus.yml + alerts.yml (error rate, latency SLO, RUM,
  billing cap), provisioned Grafana "Arvdoul Overview" dashboard,
  docker-compose for local observability.
- See [OBSERVABILITY.md](OBSERVABILITY.md).

### 3. CI/CD — from fake gates to real gates
- Removed every `continue-on-error` / `if: always()` escape hatch.
- Pipeline: lint → test (coverage-enforced) → build → security (audit +
  gitleaks) → functions syntax check; staging deploy on `develop`, production
  deploy on `main` behind an environment approval.
- Concurrency groups, timeouts, least-privilege `permissions`.
- Added `dependabot.yml` and CodeQL workflow.

### 4. Feature flags — kill switches before the next deploy
- `featureFlagService` — static typed defaults, Firebase Remote Config overlay,
  localStorage-persisted admin overrides (instant rollback without a deploy),
  change subscriptions.
- `useFeatureFlag` React hook (useSyncExternalStore — runtime reactive).
- Wired into `AppBootstrap` (non-blocking background init).

### 5. Accessibility — WCAG 2.1 AA gates
- `BottomNav`: nav landmark, translated aria-labels, `aria-current="page"`,
  decorative icons hidden.
- `AdvancedToggleSwitch`: radiogroup/radio semantics with `aria-checked`.
- `GlobalErrorBoundary`: `role="alert"`, focus management on crash heading,
  loading/disabled states.
- axe-core test suite (jest-axe) gates these components in CI.

### 6. i18n — the platform can now leave the US
- i18next + react-i18next + language detector; 7 locales (en, es, fr, de, pt,
  hi, ar) with RTL direction handling for Arabic.
- Key-parity test in CI (every locale ⊇ en keys).
- First components translated: GlobalErrorBoundary, BottomNav; pattern
  documented for the rest.

### 7. Fixes found while hardening (real bugs)
- `CSPService.handleCSPViolation(null)` crashed on malformed reports → hardened.
- `RedisCacheManager` had no TTL-multiplier getter → added (observability).
- `functions/package.json` pinned a nonexistent `@google-cloud/tasks@^3.3.0`
  → fixed to `^3.2.0` + committed lockfile (fresh installs now work).
- `soundService` test hit live Firestore → hermetic fake.

## Roadmap (next 90 days, in priority order)

1. **Raise global coverage floors** (+5 pts/quarter) by testing the highest-
   value untested services: WAF-adjacent `apiSecurityGatewayService`,
   `monetizationService` ledger, `firestoreService` CRUD, `messagesService`
   E2EE helpers, `userIntegrityService`, `DDoSProtectionService` internals.
2. **Component i18n sweep** — externalize strings across screens (Auth, Feed,
   Profile, Messaging); add `es-419`, `ja`, `ko`, `id`, `tr`, `ru`.
3. **Feature flag admin UI** — manage flags + overrides from the Admin screens
   (service layer is ready; `getSnapshot()` exposes source per flag).
4. **E2E tests** — Playwright against the Firebase emulator suite (auth →
   post → feed → message → purchase happy path).
5. **Production telemetry** — deploy a Cloud Functions `/metrics` endpoint +
   pushgateway/OTLP exporter; wire Alertmanager → PagerDuty.
6. **Canary deploys** — Firebase Hosting channel for %-based rollout on `main`
   before full promotion; automated rollback on error-rate >1% (alert rules
   already shipped in `ops/prometheus/alerts.yml`).
7. **Design system** — tokens + Storybook for the existing Tailwind UI.

## How to run everything

```bash
npm test              # full suite (fast)
npm run test:coverage # suite + coverage floors
npm run lint          # ESLint gate
npm run build         # production build gate
docker compose -f ops/docker-compose.observability.yml up -d  # observability
```

## Guardrails

- **Never lower a coverage floor** without a documented engineering decision
  and a compensating test added in the same PR.
- **Never re-add `continue-on-error`** to CI. A red pipeline is the contract.
- Every new feature flag must be registered in `DEFAULT_FLAGS` (fail-closed).
- Every new UI string must be added to **all** locale files (CI enforces).
- New shared components must pass the axe-core suite before merge.
