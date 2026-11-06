# 🏛️ Arvdoul

**The privacy-first social platform** — feed, stories, reels, E2EE messaging,
live streaming, audio spaces, AI studio, marketplace, and creator
monetization, built on Firebase (Firestore, Auth, Functions, Hosting).

> Production readiness: **being hardened — see [Engineering Readiness](docs/ENGINEERING_READINESS.md)**.
> No self-assigned quality scores; the gates below and the audit ledger are the source of truth.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (binds 0.0.0.0)
npm test             # 1100+ unit/integration/a11y tests across ~80 suites
npm run test:coverage # same + enforced coverage floor (see jest.config.cjs)
npm run lint         # ESLint (0 errors is the CI gate)
npm run build        # production bundle (dist/)
```

Cloud Functions live in [`functions/`](functions/) (deploy separately).

## What's inside

| Area | Highlights |
|---|---|
| **Core** | 48 services (feed, messaging, monetization, moderation, wallet…) under `src/services/`, shared toolkit in `src/utils/` (CacheManager, RateLimiter, IdempotencyKey, Logger, AuditLogger) |
| **Security** | E2EE messaging (client-side ECDH + AES-GCM; private key wrapped with a PBKDF2 password key), CSP, and server-side controls — `firestore.rules`, Cloud Functions, `functions/rateLimit.js` and App Check. Browser-side WAF/CSRF/DDoS "services" were removed as theatre (§11). |
| **Observability** | Prometheus-format metrics + RUM web vitals (`metricsService`, `rumService`), `ops/` stack (Prometheus + Grafana + alerts) — see [OBSERVABILITY.md](docs/OBSERVABILITY.md) |
| **Feature flags** | `src/services/featureFlagService.js` — Firebase Remote Config with static fallback and admin kill-switches |
| **i18n** | 7 locales (en, es, fr, de, pt, hi, ar) with RTL support — `src/i18n/` |
| **CI/CD** | `.github/workflows/` — lint, test (coverage-gated), build, `npm audit`, Firebase rules syntax check, staging/production deploys |
| **Infra** | `firestore.rules`, `firestore.indexes.json`, `storage.rules`, Firebase configs |

## Engineering gates (CI)

1. **Tests** — `npm test` must pass. The `test` job also runs `--coverage`;
   global and per-file coverage floors are enforced (`jest.config.cjs`, floor
   is currently low and ramps up over time).
2. **Lint** — ESLint errors are the gate (`no-unused-vars` warnings are expected).
3. **Build** — production bundle must compile.
4. **Security** — `npm audit` (high/critical fail) plus a Firebase rules syntax check.
5. **Accessibility** — axe-core gates on core UI primitives (WCAG 2.1 AA).
6. **i18n parity** — every locale must contain every English key.
7. **`guards` job (hard-failing)** — the invariant suites: architecture
   boundaries, Firebase cost, security-services, deploy integrity, shared-config
   sync and Firestore rules compile. Add new invariant suites here.

## Docs

- [Engineering Readiness & roadmap](docs/ENGINEERING_READINESS.md)
- [Observability stack (Prometheus/Grafana)](docs/OBSERVABILITY.md)
- [Disaster recovery](docs/DISASTER_RECOVERY.md)
- [Cost budget](docs/COST_BUDGET.md)
- [Messaging / E2EE](src/MESSAGING_README.md)
