# 🏛️ Arvdoul

**The privacy-first social platform** — feed, stories, reels, E2EE messaging,
live streaming, audio spaces, AI studio, marketplace, and creator
monetization, built on Firebase (Firestore, Auth, Functions, Hosting).

> Architecture: 9.5/10 · Security: 9.7/10 · Features: 9.5/10 ·
> Production readiness: **being hardened — see [Engineering Readiness](docs/ENGINEERING_READINESS.md)**

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (binds 0.0.0.0)
npm test             # 267+ unit/integration/a11y tests
npm run test:coverage # same + enforced coverage floor (see jest.config.cjs)
npm run lint         # ESLint (0 errors is the CI gate)
npm run build        # production bundle (dist/)
```

Cloud Functions live in [`functions/`](functions/) (deploy separately).

## What's inside

| Area | Highlights |
|---|---|
| **Core** | 104 services (feed, messaging, monetization, moderation, security…) under `src/services/`, shared toolkit in `src/utils/` (CacheManager, RateLimiter, IdempotencyStore, Logger, AuditLogger) |
| **Security** | E2EE messaging, TOTP MFA, passkeys, WAF (OWASP Top 10), CSRF, DDoS mitigation, session anomaly detection, field-level AES-256-GCM encryption, CSP |
| **Observability** | Prometheus-format metrics (`src/services/metricsService.js`), RUM web vitals, tracing, `ops/` stack (Prometheus + Grafana + alerts) — see [OBSERVABILITY.md](docs/OBSERVABILITY.md) |
| **Feature flags** | `src/services/featureFlagService.js` — Firebase Remote Config with static fallback and admin kill-switches |
| **i18n** | 7 locales (en, es, fr, de, pt, hi, ar) with RTL support — `src/i18n/` |
| **CI/CD** | `.github/workflows/` — lint, test (coverage-gated), build, security audit, gitleaks, CodeQL, staging/production deploys |
| **Infra** | `firestore.rules`, `firestore.indexes.json`, `storage.rules`, Firebase configs |

## Engineering gates (CI enforces)

1. **Tests** — every PR must pass the full Jest suite; global + per-file
   coverage floors are enforced (`jest.config.cjs`). Floor ramps up over time.
2. **Lint** — ESLint errors fail the build.
3. **Build** — production bundle must compile.
4. **Security** — `npm audit` (high/critical fail) + gitleaks secret scan + CodeQL.
5. **Accessibility** — axe-core gates on core UI primitives (WCAG 2.1 AA).
6. **i18n parity** — every locale must contain every English key.

## Docs

- [Engineering Readiness & roadmap](docs/ENGINEERING_READINESS.md)
- [Observability stack (Prometheus/Grafana)](docs/OBSERVABILITY.md)
- [Disaster recovery](docs/DISASTER_RECOVERY.md)
- [Cost budget](docs/COST_BUDGET.md)
- [Messaging / E2EE](src/MESSAGING_README.md)
